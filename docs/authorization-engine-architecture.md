# Arquitectura — Motor de Autorización

> Estado: **Congelada — aprobada conceptualmente.** Historial de revisión:
> decisiones abiertas cerradas (SystemAdmin, roles efectivos, creación de
> cuentas, estrategia de evaluación de filtros); corrección de la frontera
> `AuthorizationDecision`/`OperationResult` y del fail-soft entre roles para
> `SCOPE_ATTRIBUTE_UNAVAILABLE`, con `RoleEvaluationResult` y precedencia
> determinista formalizados (sección 8), y alcance del Incremento A acotado
> (sección 14); ajuste editorial final: el algoritmo consolidado (sección 5)
> evalúa y agrega a `SystemAdmin` mediante las mismas dos etapas que
> cualquier otro rol, sin retorno privilegiado, y se documentó que el orden
> de evaluación entre roles no es parte de la semántica del motor. No se
> realizarán más cambios de arquitectura sobre este documento; la
> implementación procede por los incrementos aquí definidos (sección 14),
> empezando por el Incremento A. Diseño conceptual —
> sin código, sin clases/interfaces concretas, sin cambios sobre
> `schema.sql`, APIs ni servicios existentes. Basado en
> `docs/authorization-engine-adr.md` (Aprobado para fase de diseño). Todo lo
> que este documento da por sentado (decisiones ya tomadas, restricciones,
> requisitos) proviene de ese ADR; no se reabre nada de lo ya acordado ahí.

## 1. Contexto y límites del motor

El motor es una **capa de decisión**, no una capa de datos ni de ejecución.
Se ubica entre los Controllers/Services actuales y las dos fuentes que ya
existen y no se reemplazan: los repositorios sobre el esquema `gov` (roles,
matriz de permisos, ámbitos, asignaciones) y `AdGateway` (acceso LDAP). El
motor no reimplementa ninguno de los dos — los consulta.

**Qué NO hace el motor:**
- No autentica. La autenticación Entra ID sigue resolviendo el UPN antes de
  que el motor intervenga.
- No accede a LDAP de escritura. El motor solo lee (directamente o
  reutilizando datos que el Service que lo invoca ya cargó); toda escritura
  sobre AD sigue siendo responsabilidad exclusiva del Service correspondiente
  (`UserService`, `AccountCreationService`, etc.), después de recibir una
  decisión favorable.
- No persiste su propio modelo de datos nuevo más allá de lo que ya existe
  (`SystemRoles`, `RoleFieldPermissions`, `AdministrativeScopes`,
  `RoleScopeAssignments`) y de lo que el ADR ya identificó como deuda
  pendiente (`RoleScopeFieldPermission`) — cualquier tabla nueva se decide
  en el incremento correspondiente (sección 14), no en este documento.
- No decide validaciones de negocio ajenas a autorización (formato de
  atributo, política de nombres, unicidad de cuenta) — esas siguen donde
  están hoy.
- No resuelve todavía la migración `RoleName` → FK de `SystemRoles` (deuda
  reconocida en el ADR); convive con ella en modo fail-closed diagnosticable
  (sección 7).

**Qué SÍ hace:** dado un operador, una operación, opcionalmente un recurso
objetivo (o proyectado) y opcionalmente un campo, produce una
`AuthorizationDecision` (sección 8) que cubre **exclusivamente** tres
dimensiones — permiso de operación, permiso de campo y ámbito. El llamador
usa esa decisión para decidir si continúa o corta con 403.

**Frontera formal entre autorización y ejecución — decidido, aplica a toda
decisión, no es un caso especial de `SystemAdmin`:** `AuthorizationDecision`
nunca equivale a "la operación terminó correctamente". El motor no produce,
ni condiciona, ni conoce el resultado de ejecutar la operación. Después de
recibir `Allowed = true` (por cualquier motivo, sección 8), el Service sigue
ejecutando sus propias validaciones técnicas y de negocio —denylist de
atributos protegidos, formato, concurrencia optimista, disponibilidad de
AD/entorno— exactamente como hoy, y produce su propio `OperationResult`,
una estructura totalmente independiente de `AuthorizationDecision`. Un
`OperationResult` puede fallar aunque `AuthorizationDecision.Allowed` sea
`true`. Detalle de ambas estructuras en sección 8.

## 2. Modelo conceptual de la decisión

Toda decisión se construye a partir de las mismas siete piezas, con los
mismos nombres en todos los puntos de integración:

- **Operador**: el UPN ya resuelto desde el JWT Entra (`ICurrentUserService`).
  No cambia respecto de hoy.
- **Roles efectivos**: el conjunto de roles activos a los que pertenece el
  operador (no solo el primario) — mismo resultado que hoy produce
  `SystemAuthorizationService.GetUserRolesAsync`. **Decidido**: los roles
  efectivos, no el rol primario, son la fuente de autorización. Cada rol
  efectivo se evalúa de forma independiente y completa (operación + campo +
  ámbito, sección 5); el resultado final es la unión (OR) de esas
  evaluaciones completas — nunca la combinación de fragmentos de distintos
  roles (detalle y ejemplo en sección 5). `ResolvePrimaryRoleAsync` se
  conserva únicamente para presentación, desempate visual o resúmenes de
  auditoría — no participa en el cálculo de la decisión de autorización.
- **Operación**: un identificador estable de la acción a autorizar (ej.
  `UpdateAttribute`, `CreateAccount`, `ActivateAccount`, `SearchUsers`,
  `ViewProfile`, `ManageSecurityGroup`) — independiente de la ruta HTTP, para
  que el mismo catálogo de operaciones sea consultable desde cualquier
  controller sin acoplarse a su forma de exponerse.
- **Usuario o recurso objetivo**: el usuario AD sobre el que recae la
  operación, cuando existe. En creación de cuenta no hay un usuario
  preexistente — el "recurso objetivo" en ese caso es la OU/`BaseDn`
  destino, un caso distinto que se trata aparte (sección 4).
- **Ámbito**: el/los `AdministrativeScope` efectivos que aplican a esa
  combinación de rol y recurso objetivo, resueltos evaluando
  `AdministrativeScopeFilter` (sección 4).
- **Campo**: cuando la operación es de lectura/edición de un atributo
  puntual, el `FieldKey` involucrado. No todas las operaciones tienen esta
  dimensión (crear cuenta, activar/desactivar no operan sobre un campo
  individual).
- **Resultado y motivo**: la salida del motor es una `AuthorizationDecision`
  — no es "la operación completa terminó bien o mal", es únicamente si las
  tres dimensiones (operación, campo, ámbito) lo permiten. Para operaciones
  de lectura compuesta (ej. "ver perfil") el resultado también puede acotar
  *qué subconjunto* de campos es visible (mismo patrón que hoy produce
  `GetFieldsForRoleAsync`). Cuando la decisión es una concesión, el motivo
  indica además **cómo** se concedió: por bypass total de `SystemAdmin`
  (`AuthorizationDecisionReason.SYSTEM_ADMIN_BYPASS`) o por el rol efectivo
  concreto cuya evaluación completa fue positiva
  (`AuthorizationDecisionReason.ROLE_MATCH`). Ninguno de los dos casos
  implica que la operación en sí haya tenido éxito — eso lo determina el
  `OperationResult` del Service, independiente y posterior. Detalle de
  ambas estructuras en sección 8.

## 3. Flujo de resolución de roles

No se reinventa — se preserva el flujo ya validado y se centraliza su punto
de invocación:

1. Operador (UPN) → `AdGateway.GetUserGroupDnsAsync` (LDAP, `memberOf`).
2. Cruce contra `SystemRoleRepository.GetActiveRolesForAuthorizationAsync`
   (SQL, roles activos + sus `GroupDn` activos).
3. Roles efectivos = intersección de grupos del operador con grupos
   asignados a roles activos.
4. Rol primario = el de menor `Priority` entre los roles efectivos —
   **solo para presentación, desempate visual o resúmenes de auditoría**.
   No es un insumo de la decisión de autorización: esa se calcula sobre el
   conjunto completo de roles efectivos (sección 5).

Esto es exactamente lo que hoy hace `SystemAuthorizationService`, solo que
hoy se invoca de forma independiente y duplicada desde siete controllers.
El motor no cambia el algoritmo — cambia que haya un único punto que lo
invoque, para que las siguientes capas (campo, ámbito) lo consuman sin
volver a resolverlo.

Si el UPN no pertenece a ningún rol activo, o pertenece a roles cuya
resolución es ambigua respecto de `RoleFieldPermissions` (deuda
`RoleName`), el resultado es fail-closed con motivo diagnosticable
(secciones 7 y 8) — nunca una excepción no controlada ni un acceso
implícito.

## 4. Flujo de resolución de ámbitos

Esta es la capacidad que hoy no existe en ningún punto del código. Dos
casos distintos, porque el recurso objetivo no siempre existe todavía:

**Caso A — recurso objetivo es un usuario AD existente** (editar atributo,
ver perfil, activar/desactivar, administrar grupos de un usuario ya
creado):
1. Obtener los `AdministrativeScope` activos asignados (vía
   `RoleScopeAssignment`, con sus tres estados `IsActive` simultáneos —
   asignación, rol y scope — según la semántica de efectividad ya
   documentada) a alguno de los roles efectivos del operador.
2. Para cada scope candidato, evaluar sus `AdministrativeScopeFilter`
   activos contra los atributos del usuario objetivo, usando **primero**
   los atributos que el Service que invoca ya tiene cargados (ej.
   `UserService` ya llama `GetUserByAccountAsync` en el flujo de edición) y
   solo pidiendo una consulta LDAP adicional cuando el filtro necesita un
   atributo no incluido en esa carga (el caso ya identificado de `memberOf`
   truncado en el perfil estándar).
3. El ámbito efectivo de la decisión es la **unión** de todos los scopes
   cuyos filtros matchean — no "el de mayor prioridad", conforme a la
   semántica ya declarada en el comentario de diseño de
   `AdministrativeScope.cs` y confirmada como decisión tomada en el ADR.
4. Si el rol no tiene ningún `RoleScopeAssignment` efectivo, el resultado es
   "sin ámbito" — tratamiento en sección 7 (fail-closed, no "acceso total
   implícito").

**Caso B — no hay recurso objetivo preexistente, hay un recurso proyectado**
(creación de cuenta). **Decidido**: en lugar de evaluar contra un usuario
real, se evalúa contra un **recurso proyectado** — la representación de la
cuenta tal como quedaría si se creara, construida enteramente a partir de
lo que la solicitud de creación ya propone, sin haber escrito nada todavía
en AD. El recurso proyectado incluye:

- OU / `BaseDn` de destino.
- Dominio o `ConnectionProfile` de destino.
- Tipo y subtipo de cuenta solicitados.
- Los atributos propuestos por la solicitud que sean relevantes para los
  filtros del scope evaluado (solo los que el filtro necesita, no todos).

La evaluación de ámbito sobre el recurso proyectado ocurre **antes** de
cualquier escritura en AD — nunca se crea la cuenta primero para verificar
el ámbito después. La creación solo se permite cuando, para al menos un rol
efectivo (evaluado como par completo, sección 5): (a) ese rol tiene permiso
para la operación `CREATE_ACCOUNT`; (b) ese rol tiene al menos un
`RoleScopeAssignment` efectivo; y (c) el recurso proyectado satisface los
filtros de ese mismo scope.

**Fail-closed por dato faltante, con alcance por rol (no global)**: si un
filtro del scope depende de un atributo que la solicitud de creación no
incluye o que todavía no tiene valor definido, la evaluación de ese filtro
**para ese rol** no se omite ni se asume verdadera — ese rol queda marcado
con `SCOPE_ATTRIBUTE_UNAVAILABLE` (sección 5, sección 8) y **no** interrumpe
la evaluación de los demás roles efectivos. Si otro rol completa operación +
ámbito por una vía que sí puede evaluarse, la creación se permite por ese
otro rol. Solo si ningún rol logra completar la terna, la decisión global es
una denegación, con motivo seleccionado por precedencia determinista
(sección 8).

**Estrategia de evaluación de filtros — en memoria como regla, LDAP
controlado como excepción (decidido):**

- **Principal**: evaluación en memoria, usando `DistinguishedName` y los
  atributos del usuario (o del recurso proyectado, Caso B) ya obtenidos,
  contra los filtros estructurados y el conjunto cerrado de operadores ya
  existente (`Equals`, `NotEquals`, `In`, `Exists`). No se admite
  almacenar ni ejecutar LDAP libre proveniente de configuración — los
  filtros de un `AdministrativeScope` siguen siendo exclusivamente
  estructurados, tal como ya lo restringe el modelo actual.
- **Consulta adicional controlada**: cuando un filtro necesita información
  multivaluada o no cargada por el flujo que invoca al motor (el caso ya
  identificado de `memberOf` completo), el motor puede disparar una
  consulta LDAP adicional específica para ese dato puntual — no una
  consulta genérica ni configurable por el administrador del scope.
- **Filtros LDAP generados por el sistema, para búsquedas masivas**: cuando
  la operación requiere evaluar el scope sobre una población de usuarios
  (no un usuario puntual ya cargado — ej. listar/buscar dentro de un
  ámbito), el motor puede traducir los operadores estructurados del scope
  en un filtro LDAP válido generado por el propio sistema. Esto es distinto
  de un filtro LDAP libre: el administrador nunca escribe ni almacena
  sintaxis LDAP — solo `AttributeName`/`Operator`/`Value` ya validados por
  el modelo actual — y es el motor quien controla la traducción, sin
  concatenar valores no saneados.

## 5. Combinación de permiso de operación, permiso de campo y ámbito

**Decidido — evaluación por rol, unión de resultados completos, sin
combinar fragmentos.** La decisión no se arma verificando cada dimensión de
forma independiente y global ("¿algún rol tiene el campo? ¿algún rol tiene
el ámbito?") — eso permitiría fabricar un permiso que ningún rol posee por
sí solo. En cambio, para cada rol efectivo se evalúa una **pareja completa**
rol–operación–ámbito–campo, y el resultado final es el OR lógico entre esas
evaluaciones completas, no entre sus partes.

Para un rol dado, la pareja completa es:

1. **Permiso de operación**: ¿ese rol tiene permitido ejecutar esta
   operación en general? (SQL puro, sin LDAP — evaluable primero).
2. **Permiso de campo**, cuando la operación tiene dimensión de campo: ¿ese
   mismo rol puede ver/editar ese `FieldKey`? Reutiliza
   `RoleFieldPermissions` — hoy es rol × campo sin ámbito; el ADR ya marca
   como requisito futuro combinarlo con ámbito (`RoleScopeFieldPermission`,
   sección 14, incremento E) — hasta que ese incremento exista, esta
   verificación se mantiene como está hoy, sin dimensión de scope.
3. **Ámbito**, cuando la operación tiene recurso objetivo (o recurso
   proyectado, Caso B de sección 4): ¿ese mismo rol tiene un
   `RoleScopeAssignment` efectivo cuyo scope es satisfecho por el recurso?
   Reutiliza atributos ya cargados cuando es posible (sección 4).

Un rol autoriza la operación únicamente si **las tres verificaciones que
aplican son positivas para ese mismo rol**. La decisión final es
"permitido" si **al menos un** rol efectivo autoriza completo (`ROLE_MATCH`,
sección 8); es "denegado" si ningún rol lo logra — aunque distintos roles
cubran distintas partes por separado.

**Un fallo de un rol nunca detiene la evaluación de los demás (fail-soft
entre roles, corregido en esta revisión).** Esto incluye explícitamente el
caso en que un rol no puede resolverse por falta de datos de ámbito
(`SCOPE_ATTRIBUTE_UNAVAILABLE`, sección 4/7): ese fallo se registra como
resultado de **ese** rol y la evaluación continúa con el siguiente rol
efectivo. Si otro rol completa operación + campo + ámbito, la decisión
global es `PERMITIDO` por ese otro rol — el fallo del primero queda
conservado únicamente como detalle de diagnóstico
(`RoleEvaluationResult`, sección 8), nunca como motivo de una denegación
global mientras exista un rol que sí autorice.

**Algoritmo consolidado — dos etapas uniformes, sin retorno privilegiado
para ningún rol (corregido en esta revisión).** `SystemAdmin` ya no corta
el flujo con un retorno propio: participa de la misma etapa de evaluación
que cualquier otro rol efectivo, produciendo el mismo tipo de
`RoleEvaluationResult` — solo que, por definición del bypass (sección 6),
ese resultado es trivialmente positivo en las tres dimensiones, sin
consultar `RoleFieldPermissions` ni `RoleScopeAssignment`. La
`AuthorizationDecision` final se obtiene siempre en una segunda etapa de
**agregación**, idéntica para todos los roles, `SystemAdmin` incluido.

**Etapa 1 — Evaluar** (una vez por cada rol efectivo, `SystemAdmin`
incluido; el orden entre roles es irrelevante, ver nota más abajo):

```
para cada rol en roles_efectivos:      # cualquier orden, incluso en paralelo

    si rol == "SystemAdmin":
        registrar(RoleEvaluationResult(
            RoleKey="SystemAdmin", OperationAllowed=true,
            FieldAllowed=true (o NotApplicable si la operación no tiene campo),
            ScopeAllowed=true (o NotApplicable si la operación no tiene recurso),
            DecisionReason=SYSTEM_ADMIN_BYPASS))
        continuar con el próximo rol   # sigue siendo UNA evaluación más,
                                        # no un corte del algoritmo

    r ← RoleEvaluationResult(RoleKey=rol)
    r.OperationAllowed ← permiso_operación(rol, operación)
    si NOT r.OperationAllowed:
        r.DecisionReason ← OPERATION_NOT_PERMITTED
        registrar(r); continuar con el próximo rol

    si campo aplica:
        r.FieldAllowed ← permiso_campo(rol, campo)
        si NOT r.FieldAllowed:
            r.DecisionReason ← FIELD_NOT_PERMITTED
            registrar(r); continuar con el próximo rol
    si no: r.FieldAllowed ← NotApplicable

    si recurso (u objetivo proyectado) aplica:
        ámbitos ← RoleScopeAssignment efectivos del rol
        si ámbitos vacío:
            r.ScopeAllowed ← false; r.DecisionReason ← NO_ACTIVE_SCOPE_ASSIGNED
            registrar(r); continuar con el próximo rol
        evaluación ← evaluar_filtros(ámbitos, recurso)      # sección 4
        si evaluación.dato_faltante:
            r.ScopeAllowed ← false; r.DecisionReason ← SCOPE_ATTRIBUTE_UNAVAILABLE
            r.ErroresODatosFaltantes ← evaluación.detalle
            registrar(r); continuar con el próximo rol      # NO aborta el bucle
        si NOT evaluación.matchea:
            r.ScopeAllowed ← false; r.DecisionReason ← OUT_OF_SCOPE
            registrar(r); continuar con el próximo rol
        r.ScopeAllowed ← true; r.ScopeKeyCoincidente ← evaluación.scope_efectivo
    si no: r.ScopeAllowed ← NotApplicable

    r.DecisionReason ← ROLE_MATCH
    registrar(r)
```

**Etapa 2 — Agregar** (una única vez, sobre el conjunto completo
`resultados_por_rol` ya calculado, sin importar en qué orden se calculó
cada elemento):

```
si resultados_por_rol vacío:                          # ningún rol efectivo
    devolver AuthorizationDecision(Allowed=false, Reason=NO_EFFECTIVE_ROLE,
                                    ResultadosPorRol=[])

si existe r en resultados_por_rol con r.DecisionReason == SYSTEM_ADMIN_BYPASS:
    devolver AuthorizationDecision(Allowed=true, Reason=SYSTEM_ADMIN_BYPASS,
                                    RolQueAutorizó="SystemAdmin",
                                    ResultadosPorRol=resultados_por_rol)

si existe r en resultados_por_rol con r.DecisionReason == ROLE_MATCH:
    devolver AuthorizationDecision(Allowed=true, Reason=ROLE_MATCH,
                                    RolQueAutorizó=r.RoleKey,
                                    ResultadosPorRol=resultados_por_rol)

# ningún rol (incluido SystemAdmin, si estuviera presente sin matchear —
# caso que no ocurre porque su resultado siempre es positivo) autorizó
devolver AuthorizationDecision(
    Allowed=false,
    Reason=seleccionar_por_precedencia(resultados_por_rol),   # sección 8
    ResultadosPorRol=resultados_por_rol
)
```

La `AuthorizationDecision` es siempre el resultado de la Etapa 2 — nunca de
un retorno anticipado dentro de la Etapa 1. El motor termina ahí en ambos
casos (`SYSTEM_ADMIN_BYPASS` o `ROLE_MATCH`); el Service continúa aparte
con su propio `OperationResult` (sección 1), que no es parte de este
algoritmo para ningún rol.

**Nota — el orden de evaluación de los roles no es parte de la semántica
del motor.** La Etapa 1 puede ejecutarse en cualquier orden, o incluso en
paralelo, sobre el conjunto de roles efectivos — el resultado de la Etapa 2
depende únicamente del **conjunto** `resultados_por_rol`, nunca de la
secuencia en que se calculó. Esto es distinto del orden de verificación
*dentro* de una pareja (operación → campo → ámbito, más arriba), que sigue
siendo una optimización válida para cortar temprano el cálculo de **un**
`RoleEvaluationResult` — esa optimización interna no cambia el resultado de
ese rol, y el orden entre roles tampoco cambia el resultado de la
agregación.

**Prohibición explícita de combinar permisos parciales entre roles
distintos.** Nunca se toma el resultado de una verificación (ej. ámbito)
obtenido para el Rol A y se lo combina con el resultado de otra
verificación (ej. campo) obtenido para el Rol B. Cada verificación de la
pareja se evalúa y se conserva ligada al mismo rol de principio a fin.

**Ejemplo (tomado literalmente del criterio aprobado):** el Rol A tiene
`RoleScopeAssignment` efectivo sobre el Scope X pero no puede editar el
campo F; el Rol B puede editar F pero no tiene asignación sobre el Scope X.
Un operador con ambos roles **no** puede editar F sobre un usuario dentro
de X — ni el Rol A (falla en campo) ni el Rol B (falla en ámbito) completan
la pareja por sí solos, y no se permite tomar el ámbito de A y el campo de
B para fabricar una autorización que ninguno de los dos tiene por sí mismo.

**Creación de cuentas** sigue la misma regla de pareja completa, sin
dimensión de campo: un rol autoriza `CreateAccount` únicamente si ese mismo
rol tiene permiso para la operación `CREATE_ACCOUNT`, tiene un
`RoleScopeAssignment` efectivo, y el recurso proyectado (sección 4, Caso B)
satisface ese mismo scope. El resultado final es el OR entre los roles que
completan esa terna.

El orden de evaluación dentro de una pareja prioriza lo más barato primero
(operación → campo → ámbito) para cortar temprano sin necesidad de resolver
ámbito si el rol ya falló en operación o campo — es una optimización de
evaluación, no altera el resultado.

## 6. Tratamiento especial de SystemAdmin

**Decidido.** `SystemAdmin` tiene bypass total sobre las tres
verificaciones de la sección 5 — permiso de operación, permiso de campo y
asignación de ámbito — consolidado en un único lugar (el motor), no
replicado en Controllers ni Services como ocurre hoy en tres puntos
distintos (`PermissionService` en dos métodos,
`UserService.CanEditFieldAsync`). El bypass se modela como un
`RoleEvaluationResult` trivialmente positivo, evaluado y agregado por el
mismo algoritmo de dos etapas que cualquier otro rol (sección 5) — no como
un camino separado ni un retorno anticipado.

**El bypass es estrictamente sobre esas tres verificaciones — las únicas
que el motor decide (sección 1).** No es que el bypass "salte" las demás
capas: esas capas nunca fueron responsabilidad del motor, para ningún rol,
`SystemAdmin` incluido. El motor devuelve su `AuthorizationDecision` y
termina ahí; el Service, de forma completamente separada, sigue ejecutando
lo mismo que ejecuta para cualquier otro resultado con `Allowed=true`:

- Autenticación (Entra ID) — sigue siendo obligatoria antes de que el motor
  intervenga.
- Existencia real del usuario o recurso objetivo (o validez del recurso
  proyectado, Caso B de sección 4).
- Validaciones técnicas propias de cada Service (formato de datos, reglas
  de negocio no relacionadas con autorización).
- La denylist de atributos protegidos (`ProtectedAttributes`) — ni
  `SystemAdmin` puede escribir `distinguishedName`, `unicodePwd`, etc.,
  exactamente como hoy.
- Validaciones de formato (`AttributeValueValidator`).
- Concurrencia optimista (comparación de `PreviousValue`).
- Restricciones de conexión o entorno (timeouts, disponibilidad de AD/SQL).
- Auditoría — tanto la `AuthorizationDecision` (`SYSTEM_ADMIN_BYPASS`) como
  el `OperationResult` posterior del Service (éxito o el error técnico que
  corresponda) se auditan igual que para cualquier otro rol (sección 10).

**Ejemplo (aclara la frontera de sección 1):** `SystemAdmin` puede recibir
`AuthorizationDecision(Allowed=true, Reason=SYSTEM_ADMIN_BYPASS)` para
`UpdateAttribute`, y aun así el `OperationResult` del `UserService` puede
fallar — porque el atributo está en `ProtectedAttributes`, porque
`PreviousValue` no coincide con el valor real (concurrencia optimista), o
porque AD no está disponible. Ninguno de esos tres fallos es un problema de
autorización ni contradice `Allowed=true` — son fallos de `OperationResult`,
una estructura distinta que el motor no produce ni conoce.

**El resultado debe indicarlo explícitamente.** Cuando la concesión ocurre
por esta vía, el motivo de la decisión es
`AuthorizationDecisionReason.SYSTEM_ADMIN_BYPASS` — nunca indistinguible de
una concesión regular por evaluación de pareja rol–operación–ámbito–campo
(sección 5). Esto permite auditar y diagnosticar por separado cuántas
operaciones se están autorizando por bypass administrativo versus por
evaluación normal.

**Punto de diseño cerrado**: esta lógica vive únicamente en el motor.
Ningún Controller ni Service vuelve a implementar su propio chequeo de
`SystemAdmin` — es exactamente la consolidación que ya motivaba el
Incremento A (sección 14).

## 7. Comportamiento fail-closed

Regla general aplicada de forma uniforme a las tres verificaciones de la
sección 5, extendiendo el patrón que hoy solo existe puntualmente en
`UpdateAccountStatusAsync`:

- Rol sin fila de permiso de operación definida → denegar.
- Campo sin fila en `RoleFieldPermissions` → denegar (ya es así hoy).
- Rol sin ningún `RoleScopeAssignment` efectivo → denegar cualquier
  operación que tenga dimensión de ámbito, **no** tratarlo como "sin
  restricción" ni como "acceso total". Este es un estado hoy alcanzable sin
  fricción (el ADR lo señala como riesgo), y el motor no debe interpretarlo
  como ausencia de necesidad de ámbito.
- Rol activo en `SystemRoles` sin representación compatible en la matriz de
  permisos (deuda `RoleName`) → denegar con motivo diagnosticable
  específico (`ROLE_UNMAPPED_INCONSISTENT`, sección 8), nunca colapsado en
  un "sin acceso" indistinguible de una denegación de negocio normal — este
  es el requisito explícito agregado al ADR.
- Resolución de ámbito incompleta para un rol dado — ya sea porque no se
  pudo obtener un atributo necesario de un usuario existente (timeout de
  LDAP, Caso A) o porque un filtro depende de un atributo que la solicitud
  de creación no envía o no tiene valor todavía (Caso B, sección 4) → **ese
  rol** queda marcado `SCOPE_ATTRIBUTE_UNAVAILABLE`, nunca asumir que "sin
  datos" equivale a "sin restricción" para ese rol. Este fail-closed es por
  rol, no global — no interrumpe la evaluación de los demás roles efectivos
  (sección 5); la decisión global solo es una denegación si ningún rol
  logra autorizar.

## 8. Resultado estándar de autorización y códigos de denegación

**Tres estructuras conceptuales distintas, no una sola** (corregido en esta
revisión — antes se hablaba de "un único resultado" de forma ambigua):

### `AuthorizationDecision` — lo único que produce el motor

- `Allowed`: si las tres dimensiones (operación, campo, ámbito) lo
  permiten. **No** indica si la operación en sí tuvo éxito (sección 1).
- `Reason`: código de motivo — de concesión o de denegación (tabla más
  abajo), siempre presente, no solo cuando se deniega.
- `RolQueAutorizó`: el rol efectivo cuya evaluación completa fue positiva
  (cuando `Reason=ROLE_MATCH`), o `"SystemAdmin"` (cuando
  `Reason=SYSTEM_ADMIN_BYPASS`). Ausente si `Allowed=false`.
- `ÁmbitoEfectivo` / `ScopeKey` coincidente, cuando la decisión involucró
  ámbito.
- `CamposPermitidos`: para operaciones de lectura compuesta, el subconjunto
  visible — no solo un booleano global.
- `ResultadosPorRol`: la lista completa de `RoleEvaluationResult` (abajo)
  de **todos** los roles efectivos evaluados, incluidos los que fallaron
  antes de encontrar el que autorizó — se conserva siempre, para
  diagnóstico, incluso cuando `Allowed=true`.

### `RoleEvaluationResult` — detalle interno por rol efectivo (nuevo)

Registrado para cada rol efectivo evaluado, `SystemAdmin` incluido (su
resultado es trivialmente positivo en las tres dimensiones, por definición
del bypass, sección 6 — pero sigue siendo un `RoleEvaluationResult` como
cualquier otro, producido en la misma Etapa 1 de la sección 5):

- `RoleKey`.
- `OperationAllowed`: booleano.
- `FieldAllowed`: booleano, o `NotApplicable` si la operación no tiene
  dimensión de campo.
- `ScopeAllowed`: booleano, o `NotApplicable` si la operación no tiene
  recurso objetivo/proyectado.
- `DecisionReason`: el motivo específico de **este** rol (`ROLE_MATCH` si
  autorizó, o el primero de los códigos de denegación que le aplicó).
- `ScopeKeyCoincidente`: cuando `ScopeAllowed=true`.
- `ErroresODatosFaltantes`: detalle cuando `DecisionReason` es
  `SCOPE_ATTRIBUTE_UNAVAILABLE` (qué atributo faltaba, de qué filtro).

### `OperationResult` — producido por el Service, no por el motor

- Éxito o error real de ejecutar la operación (escritura en AD, validación
  técnica, etc.).
- Completamente independiente de `AuthorizationDecision`: **puede fallar
  aunque `AuthorizationDecision.Allowed` sea `true`** (ejemplo en
  sección 6). El motor nunca lo produce ni lo condiciona.

### Códigos de motivo

Se reutilizan literalmente los ya validados por `RoleScopeAssignment` donde
aplican, y se agregan los que hoy no existen porque la capacidad tampoco
existe. Incluye tanto motivos de concesión como de denegación:

| Código | Tipo | Reutilizado de | Significado |
|---|---|---|---|
| `ROLE_MATCH` | Concesión | Nuevo | Un rol efectivo completó la pareja rol–operación–ámbito–campo (evaluación normal) |
| `SYSTEM_ADMIN_BYPASS` | Concesión | Nuevo | El operador es `SystemAdmin`; se concede sin evaluar operación/campo/ámbito (sección 6), sin saltarse ninguna otra validación |
| `OPERATION_NOT_PERMITTED` | Denegación (por rol) | Nuevo | Ese rol no tiene permitida esa operación en general |
| `FIELD_NOT_PERMITTED` | Denegación (por rol) | Renombrado de `FORBIDDEN` actual | Ese rol no puede ver/editar ese campo |
| `NO_ACTIVE_SCOPE_ASSIGNED` | Denegación (por rol) | Nuevo | Ese rol no tiene ningún `RoleScopeAssignment` activo — distinto de `OUT_OF_SCOPE` (que sí tiene ámbitos, pero el recurso no matchea) |
| `OUT_OF_SCOPE` | Denegación (por rol) | Nuevo | El recurso objetivo (o proyectado) no cae dentro de ningún ámbito efectivo de ese rol |
| `SCOPE_ATTRIBUTE_UNAVAILABLE` | Denegación (por rol) | Nuevo | Un filtro de scope depende de un atributo no disponible (usuario existente, Caso A) o no enviado (creación, Caso B) para ese rol — fail-closed por dato faltante, no por regla de negocio |
| `ROLE_UNMAPPED_INCONSISTENT` | Denegación (por rol) | Nuevo | Ese rol está activo en `SystemRoles` pero sin representación compatible en la matriz de permisos (deuda `RoleName`) |
| `NO_EFFECTIVE_ROLE` | Denegación (global, caso especial) | Nuevo | El operador no pertenece a ningún rol activo — no hay ningún `RoleEvaluationResult` que producir, se resuelve antes del bucle por rol, igual que `SystemAdmin` |

Los códigos `ROLE_NOT_FOUND`/`ROLE_INACTIVE`/`SCOPE_NOT_FOUND`/
`SCOPE_INACTIVE` de `RoleScopeAssignment` **no participan en la evaluación
en vivo** del motor — pertenecen al CRUD administrativo de asignaciones
(crear/activar una asignación), donde sí tiene sentido validar existencia
de un rol o scope puntual por su clave. En la evaluación en vivo, los roles
efectivos ya son activos por construcción (los resuelve
`SystemAuthorizationService`) y los `RoleScopeAssignment` "efectivos" ya
son activos por definición de efectividad (sección 4) — por eso no
producen esos códigos durante una decisión, solo durante la administración.

### Precedencia determinista del motivo global de denegación

Cuando ningún rol autoriza, la decisión global necesita **un** motivo
representativo, pero distintos roles pueden haber fallado por razones
distintas. La precedencia es fija y documentada, no "el más específico" sin
definir:

1. `ROLE_UNMAPPED_INCONSISTENT`
2. `SCOPE_ATTRIBUTE_UNAVAILABLE`
3. `OPERATION_NOT_PERMITTED`
4. `FIELD_NOT_PERMITTED`
5. `NO_ACTIVE_SCOPE_ASSIGNED`
6. `OUT_OF_SCOPE`

`NO_EFFECTIVE_ROLE` **no participa en esta precedencia** — es el primer
caso que resuelve la Etapa 2 de agregación (sección 5), antes de buscar
`SYSTEM_ADMIN_BYPASS` o `ROLE_MATCH`, porque si `resultados_por_rol` está
vacío (no hay ningún rol efectivo, ni siquiera `SystemAdmin`) no existe
ningún `RoleEvaluationResult` entre los cuales elegir.

**Justificación de la precedencia, en dos niveles:**

- **Nivel 1 (posiciones 1-2) — problemas de integridad de datos, no
  decisiones de negocio**: `ROLE_UNMAPPED_INCONSISTENT` y
  `SCOPE_ATTRIBUTE_UNAVAILABLE` indican que algo está mal configurado o
  incompleto (la deuda `RoleName`, un atributo que debería estar disponible
  y no lo está), no que el operador legítimamente no tenga acceso. Estos
  motivos priman siempre porque necesitan atención operativa, no son "el
  usuario no tiene permiso".
- **Nivel 2 (posiciones 3-6) — reglas de negocio normales, en el orden en
  que se evalúan dentro de una pareja**: un rol que falla en
  `OPERATION_NOT_PERMITTED` nunca llegó a evaluar campo ni ámbito — es el
  bloqueo más fundamental posible para ese rol. Un rol que falla en
  `OUT_OF_SCOPE` en cambio ya tenía permiso de operación y de campo, solo
  falló en el último paso — es el más "cercano a autorizar". Priorizar los
  motivos más tempranos/fundamentales cuando hay que elegir uno solo
  comunica la restricción más básica presente entre los roles que
  fallaron, en vez de la más incidental.

Cuando varios roles comparten el motivo de mayor precedencia, no hace falta
elegir un rol representativo — el motivo global es el mismo código para
todos ellos. En todos los casos, `ResultadosPorRol` conserva el detalle
completo de **cada** rol evaluado y su motivo específico, sin perder
información por haber seleccionado un motivo global.

## 9. Puntos de integración con Controllers, Services y AdGateway

- **Controllers**: hoy cada uno resuelve rol y decide localmente
  (`IsSystemAdminAsync`/`ResolveRoleAsync`/`HasAccessAsync`, repetidos siete
  veces). El motor centraliza esa resolución — el controller sigue siendo
  quien recibe el resultado y corta con 403 si corresponde, exactamente
  igual que hoy, solo que consultando un único punto en vez de reimplementar
  la lógica. Esto incluye el bypass de `SystemAdmin` (sección 6): ningún
  controller vuelve a implementarlo por su cuenta.
- **Services** (`UserService`, `AccountCreationService`, etc.): siguen
  siendo dueños de la ejecución. La consulta al motor precede a la llamada a
  `AdGateway`, pero el Service conserva sus propias validaciones no
  relacionadas con autorización (formato, concurrencia optimista, reglas de
  negocio) exactamente donde están hoy.
- **AdGateway**: no se modifica ni se le agregan responsabilidades de
  decisión. El motor lo consulta solo para lectura cuando necesita un
  atributo del recurso objetivo que el Service invocador no cargó todavía
  (caso ya señalado en sección 4) — nunca ejecuta una operación de
  escritura.

## 10. Auditoría de decisiones permitidas y denegadas

Extiende el mecanismo ya existente (`gov.AuditEntries`), sin reemplazarlo,
para cubrir el vacío detectado en el análisis: hoy una denegación no genera
ninguna entrada porque el flujo retorna antes de llegar al bloque de
auditoría. Toda decisión del motor —permitida o denegada— debería quedar
registrada con: operador, operación, recurso objetivo (cuando exista),
ámbito(s) evaluado(s), resultado y código de motivo. Se preserva la regla
de enmascarado ya validada (`RequiresAudit`) para no filtrar valores
sensibles en una entrada de denegación. La forma exacta de extender
`AuditEntries` (nuevas columnas, nuevos `ActionType`, o un registro
separado) es una decisión de implementación que no se resuelve en este
documento — se deja para el incremento correspondiente (sección 14).

## 11. Impacto sobre rendimiento y consultas SQL/LDAP

Punto de partida ya documentado en el ADR: cada request gateada hoy cuesta
como mínimo 1 consulta LDAP (`memberOf`) + 1 SQL (`SystemRoles`/
`SystemRoleGroups`), sin ningún caché. Agregar resolución de ámbito suma,
en el peor caso:

- +1 a +2 consultas SQL para obtener `RoleScopeAssignment` +
  `AdministrativeScope`/`AdministrativeScopeFilter` asociados al rol.
- +1 consulta LDAP **solo** cuando el filtro de ámbito necesita un atributo
  que el Service invocador no cargó ya como parte de su propio flujo (el
  caso más costoso es cuando se necesita `memberOf` completo, hoy solo
  disponible por la ruta dedicada y separada del perfil estándar).

En el caso más favorable (operaciones que ya cargan el perfil completo del
usuario objetivo, como `UpdateAttribute`), la resolución de ámbito no
agrega ninguna consulta LDAP nueva, solo SQL. En el caso más desfavorable
(operaciones que hoy no cargan el usuario objetivo en absoluto, como
`SearchUsers`), sí duplica el costo LDAP.

Este documento **no decide** una estrategia de caching (queda
explícitamente excluida por el ADR) — solo deja constancia de que es un
riesgo real y que la estrategia de adopción incremental (sección 12) debe
permitir medir este impacto operación por operación antes de generalizarlo,
en vez de asumir que el costo es aceptable de antemano.

## 12. Estrategia de adopción incremental sin activar enforcement global de golpe

Principio: ninguna operación pasa de "sin gate" o "gate parcial" a
"enforcement completo" en un solo paso.

1. **Modo sombra (shadow)**: para una operación dada, el motor evalúa la
   decisión y la audita (sección 10), pero **no bloquea** — se compara qué
   habría denegado el motor contra lo que hoy se permite, para detectar
   ámbitos mal asignados o roles sin `RoleScopeAssignment` antes de que
   eso bloquee a alguien real.
2. **Orden de incorporación**: empezar por operaciones que **ya tienen**
   gate hoy (`UpdateAttribute`, activar/desactivar) — el riesgo de romper
   algo es menor porque ya existe una verificación de campo funcionando; la
   dimensión de ámbito se suma sin quitar lo que ya protege. Recién después
   extender a operaciones hoy completamente abiertas (creación de cuentas,
   búsqueda/perfil, `AdController`, administración de grupos) — nunca al
   revés.
3. **Gate de preparación por operación**: una operación no pasa de sombra a
   enforcement real hasta confirmar que los roles relevantes tienen
   `RoleScopeAssignment` efectivos poblados — si no, activar el
   enforcement produciría bloqueos masivos por `NO_ACTIVE_SCOPE_ASSIGNED`
   en vez de decisiones correctas.
4. **Reversión disponible**: cada operación debe poder volver a modo sombra
   (o a su estado actual sin motor) si el enforcement produce bloqueos
   inesperados, sin que eso implique revertir código — el mecanismo
   concreto para lograrlo es una decisión de implementación diferida
   (sección 14).

## 13. Riesgos y decisiones que permanecen abiertas

**Riesgos vigentes** (no eliminados por las decisiones tomadas en esta
revisión):
- Duplicación de costo LDAP en operaciones que hoy no cargan el recurso
  objetivo (sección 11), sin una estrategia de mitigación decidida todavía.
- Roles con cero `RoleScopeAssignment` efectivos son un estado válido hoy y
  se volverían un bloqueo total en cuanto una operación pase a enforcement
  real para ese rol — mitigado solo parcialmente por el modo sombra
  (sección 12), que depende de que alguien revise sus resultados antes de
  activar.
- El fail-closed por dato faltante en creación (`SCOPE_ATTRIBUTE_UNAVAILABLE`,
  Caso B de sección 4) depende de que el formulario de creación efectivamente
  envíe los atributos que los filtros de scope necesitan evaluar — si un
  scope referencia un atributo que el flujo de creación no captura hoy,
  toda creación bajo ese scope quedaría bloqueada hasta ajustar el
  formulario, no por un error de autorización sino por un dato faltante en
  el flujo previo.

**Decisiones cerradas en esta revisión** (quedan aquí solo para
trazabilidad, no se repiten como abiertas): tratamiento de `SystemAdmin`
con motivo explícito `SYSTEM_ADMIN_BYPASS` (sección 6); roles efectivos
—no el rol primario— como fuente de autorización, con unión de
evaluaciones completas por pareja rol–operación–ámbito–campo y prohibición
explícita de combinar fragmentos entre roles distintos (sección 5);
evaluación de ámbito en creación contra un recurso proyectado, antes de
escribir en AD, con fail-closed por dato faltante (sección 4, Caso B); y
estrategia de evaluación de filtros —en memoria como regla, consulta LDAP
adicional controlada o filtro LDAP generado por el sistema para búsquedas
masivas como excepciones, nunca LDAP libre desde configuración (sección 4).

**Decisiones que siguen realmente abiertas:**
- El concepto de ámbito "global" para roles no-`SystemAdmin` sigue
  explícitamente fuera de alcance (excluido también por el ADR) — sin él,
  cualquier rol no-`SystemAdmin` que eventualmente necesite ver "todo"
  queda sin mecanismo. No se define aquí; es el Incremento H (sección 14).
- El mecanismo concreto de reversión de una operación desde enforcement
  real de vuelta a modo sombra (sección 12, paso 4) no está definido — se
  sabe que debe existir, no cómo.
- La forma exacta de extender `AuditEntries` para decisiones de
  autorización (columnas nuevas, `ActionType` nuevos, o registro separado,
  sección 10) es una decisión de implementación diferida al incremento
  correspondiente, no resuelta en este documento.

## 14. División propuesta en incrementos pequeños y validables

Cada incremento es independiente, revisable y no activa enforcement por sí
solo salvo que se indique:

- **Incremento A — Consolidación sin cambio de comportamiento (implementado
  y commiteado en `5629dc3`)**: centralizó únicamente los cinco chequeos
  `IsSystemAdminAsync` idénticos que existían en Controllers
  (`SystemRolesController`, `PermissionsController`,
  `AdministrativeScopesController`, `RoleScopeAssignmentsController`,
  `AccountNamingPolicyController`), preservando exactamente la fuente y la
  comparación que ya tenían:
  `GetUserRolesAsync(upn, ct).Contains("SystemAdmin", StringComparer.OrdinalIgnoreCase)`
  — **no** `ResolvePrimaryRoleAsync`, que los cinco gates nunca usaron (una
  asunción incorrecta de una versión anterior de este documento, corregida
  durante la implementación — ver
  `docs/authorization-engine-increment-a-plan.md`). El conjunto de roles
  efectivos como fuente de autorización (secciones 2 y 5) sigue siendo del
  Incremento C, no de este.

  Confirmado como refactor puro, sin excepción: mismo origen de roles,
  misma comparación, mismos códigos HTTP, mismos cuerpos de respuesta,
  mismo manejo de excepciones (propagación sin capturar de errores SQL,
  igual que antes), misma auditoría — sin ningún cambio, ni en
  `gov.AuditEntries` ni en ningún otro mecanismo. No introdujo, ni como
  dato interno ni como motivo de auditoría: `SYSTEM_ADMIN_BYPASS` ni ningún
  otro motivo de autorización, `AuthorizationDecision`,
  `RoleEvaluationResult`, evaluación de ámbitos, ni evaluación formal
  multi-rol del motor futuro — todo eso sigue siendo de los Incrementos B
  en adelante, sin adelantarse aquí. Tampoco tocó `PermissionService` ni
  `UserService`: sus tres chequeos de `SystemAdmin` son estructuralmente
  distintos (comparaciones síncronas sobre un rol ya resuelto, no una
  resolución nueva) y quedan diferidos a los Incrementos C y/o E, según se
  documenta en `docs/authorization-engine-increment-a-plan.md`.
- **Incremento B — Evaluador de ámbito, aislado**: construir la función que
  evalúa un `AdministrativeScopeFilter` en memoria contra atributos ya
  cargados, cubriendo tanto un usuario existente (Caso A) como un recurso
  proyectado de creación (Caso B) con su fail-closed por dato faltante
  (`SCOPE_ATTRIBUTE_UNAVAILABLE`) — verificable con pruebas propias, sin
  conectarla todavía a ningún gate real ni a la generación de filtros LDAP
  para búsquedas masivas (eso queda para cuando exista una operación que lo
  necesite).
- **Incremento C — Modo sombra sobre `UpdateAttribute`**: combinar
  resolución de roles efectivos + evaluador de ámbito + la regla de pareja
  completa por rol con unión de resultados (sección 5) sobre la operación
  que ya tiene gate hoy, auditando decisiones sin bloquear (sección 12,
  paso 1-2).
- **Incremento D — Enforcement real sobre `UpdateAttribute`**: activar el
  bloqueo real una vez el modo sombra confirme datos consistentes para los
  roles involucrados.
- **Incremento E — `RoleScopeFieldPermission`**: extender el permiso de
  campo con dimensión de ámbito, con su propio CRUD administrativo,
  siguiendo el patrón ya maduro de `RoleScopeAssignment` (sin DELETE, solo
  activar/desactivar).
- **Incremento F — Cobertura de operaciones hoy sin gate**: creación de
  cuentas (con evaluación contra el recurso proyectado, sección 4, antes de
  cualquier escritura en AD), `AdController`, búsqueda y lectura de perfil,
  administración de grupos de seguridad sobre usuario existente — en modo
  sombra primero, enforcement después, uno por uno, no todos juntos.
- **Incremento G — Resolución de la deuda `RoleName`/`SystemRoles`**: una
  vez el motor esté validado en producción con el modelo actual, migrar
  `RoleFieldPermissions.RoleName` a FK real — separado porque toca esquema
  y no debería bloquear los incrementos anteriores.
- **Incremento H — Ámbito "global" y preflight de enforcement**: definir
  (si se decide que hace falta) el concepto de ámbito sin restricción para
  roles no-`SystemAdmin`, ya mencionado como pendiente en
  `docs/role-scope-assignment.md`.

Ningún incremento de esta lista está autorizado a implementarse todavía —
este documento es la propuesta de diseño completa para revisión.
