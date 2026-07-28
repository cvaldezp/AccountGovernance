# Motor de Autorización — Plan del Incremento C

> Estado: **Implementado y validado.** Basado en
> `docs/authorization-engine-architecture.md` (Congelada), sección 14,
> Incremento C: "Modo sombra sobre `UpdateAttribute`". Las 5 decisiones
> abiertas fueron confirmadas por el usuario tal como se propusieron.
> Sin commit todavía — pendiente de revisión final, dado que este
> incremento sí toca código de producción (aunque en modo sombra).

## Resultado de la implementación

- **Archivos modificados** (2): `UserService.cs` (nuevas dependencias
  `ISystemAuthorizationService`, `IShadowFieldScopeEvaluator`,
  `ILogger<UserService>`; una rama de sombra insertada justo después de
  cargar el usuario objetivo, reutilizando ese mismo `User` sin LDAP
  adicional) y `DependencyInjection.cs` (registro del nuevo evaluador).
- **Archivos nuevos** (3 de producción + 2 de test):
  `Authorization/ShadowFieldScopeEvaluator.cs` (orquesta rol efectivo →
  permiso de campo → ámbito, reutilizando el evaluador del Incremento B),
  más `ShadowFieldScopeEvaluatorTests.cs` y
  `UserServiceShadowEvaluationTests.cs`.
- **Build**: 0 advertencias, 0 errores.
- **Pruebas**: **76/76 correctas** (59 previas de A+B, sin tocar, + 17
  nuevas de C).
- **Garantía central verificada explícitamente**: 4 pruebas dedicadas
  confirman que la sombra nunca puede afectar el resultado real —
  incluidas cuando la sombra devuelve "denegado" y cuando lanza una
  excepción (tanto desde el evaluador como desde la resolución de roles
  efectivos). También se confirmó que la sombra **no corre** en las rutas
  que ya fallan antes de cargar el usuario (usuario no encontrado, permiso
  de campo real denegado) y que **no agrega ninguna consulta LDAP
  adicional** (`GetUserByAccountAsync` sigue llamándose exactamente una
  vez).
- **`git status --short`**: exactamente los archivos previstos en
  "Archivos afectados" — ningún controller, `PermissionService`,
  `schema.sql` ni frontend tocados.
- **Validación final en vivo — completada (2026-07-28 15:03/15:05)**:
  desplegado a Development (commit base `138a893`, con los cambios de este
  incremento aún sin commitear), 76/76 tests en Release, sin rollback. El
  usuario editó el campo "Título" de un usuario de prueba real desde la UI
  — **la operación se guardó sin problemas**. El log del servidor confirma
  que la sombra corrió y quedó registrada correctamente:
  ```
  [SHADOW-AUTH] operador=<upn-de-prueba> campo=field-title objetivo=dusuariop
  resultado="Permitted" autorizadoPor=SystemAdmin
  detallePorRol=SystemAdmin:campo=True:ambito=True:motivo=SYSTEM_ADMIN_BYPASS;
  Seguridades:campo=False:ambito=False:motivo=FIELD_NOT_PERMITTED;
  RRHH:campo=False:ambito=False:motivo=FIELD_NOT_PERMITTED;
  DragonHelp:campo=False:ambito=False:motivo=FIELD_NOT_PERMITTED
  ```
  Confirma: los 4 roles efectivos del operador se evaluaron correctamente,
  el bypass de `SystemAdmin` autorizó la operación, y los otros 3 roles
  quedaron marcados `FIELD_NOT_PERMITTED` — señal real y útil de que ese
  campo no está habilitado para esos roles en la Matriz de Permisos hoy.
  Sin errores, sin excepciones, sin impacto en la operación real.

- **Validación adicional en vivo — los 5 motivos posibles, completa
  (2026-07-28 15:29 a 16:23)**: se armó un caso real dedicado con el rol
  `DragonHelp` (grupo AD `account-sd`), usando el campo "Oficina"
  (`field-office`, `DragonHelp` sí tiene permiso de edición ahí) contra el
  ámbito `prueba-funcional-estud-01` (filtro `extensionAttribute7 Equals
  "Activado"`, mismo ejemplo de
  `docs/pruebas-ambitos-roles-matriz-permisos.md`). Se registraron en el
  Catálogo AD los pasos necesarios y se probaron los 3 estados posibles
  del atributo del usuario objetivo:

  | # | Estado de `extensionAttribute7` en `dusuariop` | Motivo obtenido | ¿Coincide con lo esperado? |
  |---|---|---|---|
  | 1 | Atributo no registrado en Catálogo AD (no se carga) | `SCOPE_ATTRIBUTE_UNAVAILABLE` | ✅ |
  | 2 | Registrado y activo, valor distinto de `"Activado"` | `OUT_OF_SCOPE` | ✅ |
  | 3 | Registrado y activo, valor `"Activado"` | `ROLE_MATCH`, `autorizadoPor=DragonHelp` | ✅ |

  Sumado a `SYSTEM_ADMIN_BYPASS` y `FIELD_NOT_PERMITTED` ya confirmados
  arriba, **quedaron validados en vivo, contra Active Directory real, los
  5 motivos posibles del evaluador** — no solo contra los datos simulados
  de los tests unitarios. En los 4 casos con `DragonHelp` la edición real
  del campo se guardó siempre sin problemas, sin importar qué decía la
  sombra — la garantía central del incremento quedó demostrada en
  producción, no solo en código.

---

A diferencia de A y B, este incremento **sí toca una operación real** — en
modo sombra (audita, no bloquea), pero corre en cada request real de
`PATCH /users/{sam}/attributes/{attr}`. Por eso exige más cuidado, y
> por eso este documento tiene una sección de decisiones abiertas más
> larga que las de A y B — la arquitectura dejó varias cosas sin resolver
> a propósito, y este es el momento de resolverlas.

## Objetivo

Empezar a ejecutar, en paralelo a la operación real y **sin influir en su
resultado**, la evaluación combinada de roles efectivos + evaluador de
ámbito (Incremento B) + permiso de campo ya existente — sobre
`UpdateAttribute`, la única operación que ya tiene gate real hoy. El
propósito es recolectar evidencia real (¿los `RoleScopeAssignment`
configurados producirían resultados razonables? ¿hay roles sin ningún
ámbito que bloquearían todo si esto fuera real?) antes de activar
cualquier bloqueo real, que es el Incremento D.

## Alcance

**Incluye:**
- Resolver, para el operador de cada request de `UpdateAttribute`, el
  conjunto completo de roles efectivos (no solo el primario).
- Para cada rol efectivo, evaluar si tiene un ámbito efectivo que
  satisfaga al usuario objetivo — reutilizando el evaluador del
  Incremento B (`AdministrativeScopeFilterEvaluator` +
  `DistinguishedNameContainment`, aunque esta última no aplica acá porque
  ya hay un usuario existente, es Caso A puro).
- Registrar (auditar) qué hubiera decidido esta evaluación combinada, sin
  que el resultado real de la operación dependa de eso en absoluto.
- Pruebas que demuestren que el modo sombra nunca puede bloquear ni
  alterar el resultado real, aunque la evaluación de sombra falle o
  lance una excepción.

**No incluye:**
- Bloquear ninguna operación — eso es el Incremento D, explícitamente
  posterior y separado.
- `RoleScopeFieldPermission` (permiso de campo con dimensión de ámbito) —
  sigue siendo Incremento E; acá el permiso de campo real sigue siendo
  el `RoleFieldPermissions` de hoy, sin tocar.
- Ninguna otra operación además de `UpdateAttribute` — ni
  `UpdateAccountStatus`, ni creación de cuentas, ni nada del Incremento F.
- Cambios de esquema, **salvo que se confirme explícitamente la decisión
  4 de abajo** (que por defecto recomiendo evitar en este incremento).

## Qué ya existe y se reutiliza (sin tocarlo)

- `SystemAuthorizationService.GetUserRolesAsync` — ya resuelve el
  conjunto completo de roles efectivos (no solo primario); es lo mismo
  que ya usa `IsSystemAdminAsync` del Incremento A.
- `AdministrativeScopeFilterEvaluator.Evaluate` (Incremento B) — recibe
  los filtros de un scope + un diccionario de atributos, sin cambios.
- `IRoleScopeAssignmentRepository.GetAllAsync(roleKey, scopeKey: null)` —
  trae las asignaciones de un rol (activas e inactivas mezcladas, hay que
  filtrar `IsActive` del lado de quien llama — ya documentado como
  limitación en el ADR, no se resuelve acá).
- `UserService.UpdateAttributeAsync` — el flujo real, que **no se
  modifica en su comportamiento observable**, solo se le agrega una rama
  de ejecución en paralelo que audita.
- `User.RawAttributes` — el usuario objetivo ya se carga dentro de
  `UpdateAttributeAsync` (línea ~119, `adGateway.GetUserByAccountAsync`,
  para el chequeo de concurrencia optimista) — reutilizable para
  alimentar al evaluador de ámbito sin una consulta LDAP adicional.

## Decisiones abiertas — necesito que las confirmes antes de implementar

### 1. "Permiso de operación" no existe como concepto — ¿qué hacemos mientras tanto?

La arquitectura (sección 5) describe la pareja completa como operación +
campo + ámbito, pero **no existe hoy ninguna tabla ni concepto de "permiso
de operación"** — nunca se construyó, ni en A ni en B. Sin esto, no se
puede evaluar la pareja completa tal como está descrita.

**Recomiendo**: para este incremento, tratar el permiso de operación como
**implícito y siempre verdadero** para `UpdateAttribute` — es decir, la
pareja se reduce a **campo + ámbito** por ahora, documentando esto como
una simplificación temporal y deliberada, no como el modelo final. El
permiso de operación real queda como una pieza pendiente de diseñar en un
incremento futuro (probablemente antes o junto con el D, porque D sí
necesita bloquear de verdad y ahí la ausencia de este concepto empieza a
doler más).

*Alternativa, si preferís no simplificar*: diseñar ahora mismo un modelo
mínimo de permiso de operación (una tabla nueva) — esto es más trabajo y
un cambio de esquema, lo cual choca con mantener este incremento acotado.
No lo recomiendo para C específicamente.

### 2. ¿Dónde se resuelven los roles efectivos dentro del flujo de `UpdateAttribute`?

Hoy `UserService` **no depende de `ISystemAuthorizationService`** — recibe
el rol ya resuelto (`RoleName role`) como parámetro, calculado por
`UsersController.ResolveRoleAsync` (rol primario únicamente). Para evaluar
todos los roles efectivos, hace falta el conjunto completo, no solo el
primario.

**Recomiendo**: inyectar `ISystemAuthorizationService` en `UserService`
(nueva dependencia del constructor) y resolver los roles efectivos ahí
mismo, dentro de la rama de sombra — sin cambiar la firma pública de
`UpdateAttributeAsync` ni el parámetro `role` que ya usa el gate real.
Es un cambio de constructor, no de contrato de la operación.

*Alternativa*: resolver los roles efectivos en el controller y pasarlos
como parámetro nuevo. Es más invasivo sobre la firma del método existente
—no lo recomiendo, agrega superficie de cambio innecesaria.

### 3. ¿Cómo evitar una consulta LDAP adicional para el usuario objetivo?

**Recomiendo**: reutilizar el `User` que `UpdateAttributeAsync` ya carga
internamente (`adGateway.GetUserByAccountAsync`, ya existente para el
chequeo de concurrencia optimista) como fuente de atributos para el
evaluador de ámbito de Incremento B — la evaluación de sombra corre
**después** de esa carga, sin ninguna consulta LDAP nueva. Esto mantiene
el riesgo de rendimiento señalado en la arquitectura (sección 11) en su
caso más favorable: cero LDAP adicional para esta operación en particular.

### 4. ¿Dónde se registra la decisión de sombra?

La arquitectura (sección 10) dejó esto explícitamente diferido. Ahora es
el momento de decidir, al menos para este incremento puntual.

**Recomiendo, para C específicamente**: **no tocar `gov.AuditEntries` ni
ningún esquema todavía** — registrar la decisión de sombra como una
entrada de log estructurado (Serilog, ya usado en todo el backend) con un
scope/contexto dedicado (ej. `[SHADOW-AUTH]`, siguiendo el mismo patrón
que los `[ROLES]`/`[DB-CONFIG]` que ya existen como logs temporales en
este código). Motivo: evita comprometerse a una migración de esquema
antes de saber si la señal del modo sombra es útil tal como está
diseñada — si más adelante se confirma que hace falta persistirlo en
SQL para reportes, se diseña esa migración con datos reales de qué se
necesita guardar, no especulando ahora.

*Alternativa*: agregar ya un `ActionType` nuevo a `gov.AuditEntries`. Es
viable, pero implica un cambio de esquema en un incremento que hasta
ahora se mantuvo sin tocar `schema.sql` — lo dejaría para cuando el
Incremento D esté más cerca y se sepa con certeza qué reportes hacen
falta.

### 5. ¿Se evalúan todos los roles efectivos, o solo los que tienen algún `RoleScopeAssignment`?

**Recomiendo**: evaluar todos los roles efectivos del operador — para
cada uno, si no tiene ningún `RoleScopeAssignment` activo, la evaluación
de ese rol específico es "sin ámbito" (no participa en el OR), sin que
eso aborte la evaluación de los demás roles efectivos — mismo criterio de
fail-soft ya decidido en la arquitectura (sección 5/7).

## Contrato conceptual de la evaluación de sombra

Una función (nombre e interfaz exacta a definir al implementar, no en
este documento) que, dado el rol efectivo del operador (conjunto) y el
`User` ya cargado, calcula: para cada rol efectivo, ¿tiene al menos un
ámbito activo cuyos filtros matcheen al usuario objetivo? (usando el
evaluador de Incremento B) — y si el rol ya tiene permiso de campo real
(vía `CanEditFieldAsync`, sin cambios). El resultado combinado (¿algún rol
hubiera autorizado la pareja campo+ámbito completa?) se loguea, nunca se
usa para permitir o denegar nada.

**Garantía obligatoria**: cualquier excepción dentro de la evaluación de
sombra debe capturarse y loguearse como advertencia — **nunca debe
propagarse** y nunca debe convertir una operación real exitosa en un
error. Esto se prueba explícitamente (ver Casos de prueba).

## Archivos afectados

- `backend/src/AccountGovernance.Application/Services/UserService.cs` —
  nueva dependencia (`ISystemAuthorizationService`) y una rama de
  ejecución adicional dentro de `UpdateAttributeAsync`, después de que la
  operación real ya se resolvió (éxito o fallo) — la sombra nunca corre
  antes ni condiciona el resultado.
- Nuevo archivo para la función de evaluación de sombra en sí (ubicación
  propuesta: junto al evaluador de Incremento B, en
  `AccountGovernance.Application/Authorization/`).
- Pruebas nuevas en `backend/tests/AccountGovernance.Api.Tests/`.

**Explícitamente NO afectados**: los 5 controllers y
`SystemAuthorizationService` del Incremento A, el evaluador del
Incremento B (se reutiliza, no se modifica), `PermissionService`,
`schema.sql`, frontend.

## Casos de prueba a definir primero

1. Operación real exitosa con evaluación de sombra que hubiera dado
   "permitido" — la respuesta HTTP y el resultado no cambian.
2. Operación real exitosa con evaluación de sombra que hubiera dado
   "denegado" (ningún rol con ámbito que matchee) — la respuesta HTTP
   **sigue siendo exitosa**, sin ningún cambio. Esta es la prueba más
   importante de todo el incremento.
3. Operación real que falla por una razón ya existente (ej.
   `PreviousValue` no coincide) — el fallo real ocurre exactamente igual
   que antes, sin relación con lo que hubiera dicho la sombra.
4. La función de evaluación de sombra lanza una excepción simulada — la
   operación real sigue completándose con éxito, y la excepción queda
   solo logueada.
5. Operador con múltiples roles efectivos, uno con ámbito que matchea y
   otro sin ningún `RoleScopeAssignment` — se audita como "permitido por
   al menos un rol", sin abortar por el rol sin ámbito (fail-soft).
6. Cero consultas LDAP adicionales — verificable con un mock que cuenta
   invocaciones a `adGateway.GetUserByAccountAsync` y confirma que sigue
   siendo exactamente una, igual que antes de este incremento.

## Validación

- `dotnet build` limpio.
- Los 31 (Incremento A) + 28 (Incremento B) tests existentes sin cambios
  en su resultado.
- Los casos nuevos de arriba, en verde.
- Diff revisado línea por línea de `UserService.cs` — confirmar que la
  rama de sombra está estrictamente después de determinar el resultado
  real, nunca antes ni condicionándolo.
- Deploy a Development + prueba manual: editar un atributo real, revisar
  el log `[SHADOW-AUTH]` en el servidor, confirmar que aparece y que la
  operación se comportó exactamente igual que antes de este incremento.

## Riesgos

- **Es el primer incremento que corre en cada request real de una
  operación gateada** — el bug más peligroso posible es que la sombra
  termine influyendo el resultado real por error; por eso la garantía de
  "nunca propaga excepción" y los casos de prueba 2 y 4 son el centro de
  este incremento, no un detalle.
- **Costo de SQL adicional**: por cada request de `UpdateAttribute`, se
  suman consultas a `RoleScopeAssignment`/`AdministrativeScope`/
  `AdministrativeScopeFilter` por cada rol efectivo del operador — sin
  caché (ya señalado como restricción en el ADR). En Development el
  volumen es bajo, pero vale medirlo antes de considerar este patrón para
  operaciones de mayor tráfico.
- **Sin permiso de operación real** (decisión 1): la señal del modo
  sombra en este incremento va a ser "campo + ámbito" nada más, no la
  pareja completa que describe la arquitectura — hay que leer los
  resultados del modo sombra con ese matiz en mente, no como una
  simulación completa de la decisión final.
- **Ruido de log**: si muchos roles no tienen `RoleScopeAssignment`
  todavía (estado real hoy, según el propio riesgo ya señalado en el
  ADR), el modo sombra va a auditar "denegado" para casi todo al
  principio — es información útil (muestra qué falta configurar), no un
  indicio de que el código esté mal.
