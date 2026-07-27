# ADR — Motor de Autorización: requisitos funcionales

> Estado: Aprobado para fase de diseño. Solo requisitos — sin
> arquitectura ni propuestas de implementación. Basado exclusivamente en el
> relevamiento forense y el análisis de flujo/decisiones distribuidas
> realizados sobre el estado real del código (rama
> `wip/incremento-3-role-scope-assignment`, equivalente a `main` +
> Incremento 3, sin mergear).

## Objetivo

Unificar en un único punto de decisión las cuatro piezas que hoy conviven
sin integrarse — Roles (`gov.SystemRoles`/`gov.SystemRoleGroups`), Matriz de
Permisos (`gov.RoleFieldPermissions`/`gov.FieldDefinitions`), Ámbitos
Administrativos (`gov.AdministrativeScopes`/`gov.AdministrativeScopeFilters`)
y Active Directory — de modo que toda operación sobre un usuario AD resuelva
su autorización de una forma consistente, en lugar de la duplicación y los
vacíos identificados en el análisis (`IsSystemAdminAsync`/`ResolveRoleAsync`
repetidos en siete controllers, `CanEditFieldAsync` sin dimensión de scope,
operaciones enteras sin ningún gate).

## Alcance

Incluye:
- Determinación del rol efectivo de un usuario autenticado.
- Verificación de permisos por atributo AD (continuación de la matriz
  existente).
- Verificación de ámbito administrativo aplicable a una operación sobre un
  usuario AD objetivo (capacidad hoy inexistente).
- Combinación de las dimensiones rol × campo × ámbito en una única decisión.
- Cobertura de las operaciones identificadas en el relevamiento, tengan o no
  gate hoy: buscar usuarios, ver perfil, editar atributos, crear cuentas,
  activar/desactivar cuentas, administrar grupos de seguridad y listas de
  distribución. Resetear contraseña queda fuera por no existir la operación
  en el sistema (ver Exclusiones).
- Un formato de resultado de decisión consistente, consumible de la misma
  manera por todos los controllers.

No incluye: diseño de clases, interfaces, servicios, cachés, middlewares,
migraciones de esquema ni ningún artefacto de implementación. Ese trabajo
comienza recién en la fase de arquitectura posterior a este ADR.

**Distinción relevante para el alcance — no todo endpoint sin gate hoy es
equivalente.** El relevamiento diferencia tres categorías, y esa
diferencia condiciona cómo cada una debe tratarse en la arquitectura
(ver Exclusiones):

- **Deliberadamente disponibles para cualquier usuario autenticado, por
  diseño** — ej. `GET /permissions/matrix`, lectura de la política de
  nombres. Documentado explícitamente como decisión intencional.
- **Actualmente abiertos por ausencia de autorización, no por diseño** —
  ej. creación de cuentas (`AccountCreationController`), operaciones de
  `AdController`, búsqueda y lectura de perfil de usuario
  (`UsersController.Search`/`GetByAccount`), administración de grupos de
  seguridad sobre un usuario ya existente. El relevamiento no encontró
  ninguna decisión documentada que justifique esta apertura — es un vacío,
  no una decisión.
- **Exclusivos de `SystemAdmin`** — ej. administración de Roles, Ámbitos
  Administrativos, `RoleScopeAssignment`, mutaciones del catálogo de
  atributos y de la matriz de permisos.

La segunda categoría **no queda excluida del futuro enforcement** por
carecer de gate hoy — al contrario, es exactamente el conjunto que el
Requisito Funcional 7 identifica como pendiente de cobertura.

## Restricciones

Condiciones ya existentes en el sistema que cualquier diseño posterior
deberá respetar, no negociar:

- La resolución de rol depende de una consulta LDAP (`memberOf`) más una
  consulta SQL (`SystemRoles`/`SystemRoleGroups`) en cada invocación; no
  existe hoy ningún caché de roles, de `RoleFieldPermissions` ni de
  `memberOf`. El único caché existente en todo el sistema es
  `FieldDefinitionsCache` (TTL 30s), acotado al catálogo de atributos.
- `AdGateway` abre una conexión LDAP nueva por llamada, sin pool visible, y
  ninguna búsqueda pagina resultados — depende enteramente de `SizeLimit`.
- `RoleFieldPermissions.RoleName` es texto libre anclado al enum `RoleName`
  (5 valores fijos), sin FK real a `SystemRoles.Id` — a diferencia de
  `RoleScopeAssignments`, que sí usa FK numérica. Esta inconsistencia de
  tipado de rol es preexistente y **no se resuelve ni se migra en este
  documento**. Se establece como restricción explícita para la fase de
  arquitectura: (a) un rol activo en `gov.SystemRoles` sin representación
  compatible en `RoleFieldPermissions` no puede recibir acceso implícito
  por esa sola ausencia; (b) esa situación debe resolverse fail-closed
  (denegar, nunca asumir acceso); (c) el diseño debe dejar esa
  inconsistencia visible y trazable como un caso diagnosticable — no
  colapsarla en silencio a "sin acceso" indistinguible de una denegación
  regular, como ocurre hoy en `PermissionService.GetMatrixAsync`
  (`Enum.TryParse<RoleName>` fallido = todas las celdas en falso, sin
  ningún indicio de que la causa es una inconsistencia de modelo).
- `RoleFieldPermissions` no tiene ninguna columna de ámbito — es una matriz
  global por rol. No existe hoy ninguna tabla que ate permiso de campo a la
  combinación rol × ámbito.
- No existe ningún evaluador que ejecute un `AdministrativeScopeFilter`
  contra un usuario AD real; el modelo declarativo (`BaseDn` + filtros)
  existe, pero no está conectado a ninguna resolución en runtime.
- El perfil estándar de usuario (`GetUserByAccountAsync`/
  `GetUserByUpnOrMailAsync`) trunca `memberOf` a un solo valor; la lista
  completa de grupos solo se obtiene hoy por una ruta LDAP separada
  (`GetUserGroupDnsAsync`).
- `SystemAdmin` tiene acceso total hardcodeado en tres puntos distintos del
  código (no una única fuente de verdad).
- El catálogo de roles es fijo (5 roles seedados); no existe API de alta ni
  baja de roles.
- `RoleScopeAssignments` nunca elimina filas — la baja es exclusivamente
  `IsActive=0` vía `PATCH .../status`, con unicidad de par sin filtro. Este
  patrón ya está validado y no debe alterarse.

## Decisiones ya tomadas

Decisiones de diseño que ya están fijadas por el código existente y que este
ADR no reabre:

- Autenticación vía Entra ID (JWT); autorización vía pertenencia a grupos de
  Active Directory on-prem (LDAP `memberOf`). Son dos capas de identidad
  distintas y ya están fijadas así.
- El rol primario de un usuario se resuelve por menor `Priority` entre los
  roles activos a los que pertenece (`ResolvePrimaryRoleAsync`); si el
  usuario no pertenece a ningún rol activo mapeado, se falla explícitamente
  en lugar de asumir un rol por defecto.
- `SystemAdmin` tiene acceso total sin excepción, incluida edición de campos
  y de estado de cuenta, sin depender de filas en `RoleFieldPermissions`.
- Los ámbitos administrativos se definen mediante `BaseDn` (límite LDAP
  duro) más una lista de filtros con un conjunto cerrado de cuatro
  operadores (`Equals`, `NotEquals`, `In`, `Exists`) — deliberadamente sin
  filtro LDAP libre.
- Un `AdministrativeScope` nace inactivo y su activación exige validar que
  el `BaseDn` exista como OU real en AD (`AdGateway.OuExistsAsync`).
- Un rol puede tener múltiples ámbitos activos simultáneamente
  (`RoleScopeAssignments` es N:N); la semántica prevista para múltiples
  ámbitos es de unión, no de resolución por prioridad — así lo declara
  explícitamente el comentario de diseño en `AdministrativeScope.cs`, aunque
  hoy nada la ejecuta.
- `AdministrativeScope.Priority` y `AdministrativeScopeFilter.FilterType`
  son exclusivamente de UX/desempate visual y nunca participan en una
  decisión de autorización.
- Existe un patrón fail-closed ya validado: ante ausencia de definición de
  catálogo (ej. campo `field-account-status` inexistente), se deniega en
  lugar de asumir acceso.
- Toda escritura de atributo protegido está bloqueada por una denylist
  estructural (`distinguishedName`, `objectSid`, `unicodePwd`, etc.),
  independiente del rol, incluido `SystemAdmin`.

## Requisitos funcionales

1. Determinar el rol efectivo de un usuario autenticado a partir de su
   pertenencia a grupos AD, preservando la semántica de prioridad ya
   validada.
2. Verificar permisos de visualización/edición por atributo AD individual,
   preservando la matriz rol × campo ya validada operativamente.
3. Verificar el ámbito administrativo aplicable a una operación sobre un
   usuario AD objetivo — capacidad hoy inexistente en su totalidad.
4. Combinar la dimensión de campo con la dimensión de ámbito en una sola
   decisión (hoy son independientes; no existe permiso de campo con alcance
   de scope).
5. Soportar que un rol tenga múltiples ámbitos activos simultáneamente, con
   semántica de unión.
6. Resolver la decisión de autorización antes de ejecutar cualquier
   escritura sobre AD, extendiendo esa garantía —hoy solo presente en la
   edición de atributos— a las operaciones que actualmente la omiten
   (creación de cuentas, alta/baja de grupos de seguridad sobre un usuario
   existente).
7. Cubrir explícitamente las operaciones identificadas sin ningún gate hoy:
   creación de cuentas, búsqueda y lectura de perfil de usuario,
   administración de grupos de seguridad sobre un usuario existente, y los
   endpoints de `AdController`.
8. Distinguir autorización de operación (verbo: crear, activar, desactivar,
   ver, editar) de autorización de campo (atributo específico) — hoy solo
   existe la segunda de forma consistente.
9. Preservar el comportamiento fail-closed ya establecido como regla general
   de toda decisión, no solo del caso puntual donde hoy se aplica.
10. Operar con la información ya disponible del usuario objetivo (atributos
    estructurales ya mapeados, `DistinguishedName`) cuando el criterio de un
    ámbito lo permita, y hacer explícito cuándo hace falta una consulta LDAP
    adicional (ej. `memberOf` completo).
11. Distinguir estado inexistente de estado inactivo tanto para rol como
    para ámbito, replicando los códigos ya validados por
    `RoleScopeAssignment` (`ROLE_NOT_FOUND`, `ROLE_INACTIVE`,
    `SCOPE_NOT_FOUND`, `SCOPE_INACTIVE`).
12. Devolver un resultado de decisión consistente y de la misma forma para
    todos los controllers, reemplazando las formas distintas que hoy
    coexisten (`IsSystemAdminAsync` booleano, `HasAccessAsync` contra
    arrays, `CanEditFieldAsync` booleano, ausencia total).
13. Permitir declarar operaciones deliberadamente abiertas a cualquier
    autenticado (ej. lectura de la matriz de permisos, lectura de la
    política de nombres) sin forzar que toda operación quede cerrada por
    defecto — hoy ambos casos (abierto a propósito y abierto por omisión)
    existen y deben quedar distinguibles.
14. Ser consultable de forma independiente de la ejecución de la operación
    (la decisión debe poder evaluarse sin disparar la escritura sobre AD).
15. Ante un rol activo en `gov.SystemRoles` sin representación compatible en
    la matriz de permisos, denegar en modo fail-closed y dejar constancia
    diagnosticable de la inconsistencia (qué rol, qué operación, por qué se
    denegó) — un resultado distinguible de una denegación por regla de
    negocio regular, no colapsado silenciosamente en "sin acceso".

## Requisitos no funcionales

- **Trazabilidad**: las decisiones de denegación deben poder auditarse con
  el mismo mecanismo ya usado para cambios exitosos (`gov.AuditEntries`);
  hoy una denegación no genera ninguna entrada porque el flujo retorna antes
  de llegar al bloque de auditoría.
- **Consistencia de rendimiento**: la resolución de una decisión no debe
  multiplicar sin control las consultas LDAP/SQL ya incurridas hoy por
  request (mínimo una consulta LDAP + una SQL por operación gateada,
  sin caché de roles/permisos/`memberOf`).
- **No regresión sobre lo ya validado**: la máquina de estados de
  `RoleScopeAssignment` (unicidad de par, solo desactivación, nunca
  eliminación) y el gate real ya conectado en `UserService.CanEditFieldAsync`
  deben seguir funcionando sin alterar su contrato observable.
- **Diagnosticabilidad**: una denegación causada por una inconsistencia
  estructural (ej. rol sin representación compatible en la matriz de
  permisos, ver Restricciones) debe ser distinguible de una denegación por
  regla de negocio normal, de forma que sea trazable y accionable en vez de
  indistinguible de "no tiene permiso".
- **Uniformidad**: el resultado de una decisión debe tener la misma forma
  sin importar qué controller la consuma, eliminando la duplicación hoy
  presente en siete puntos distintos del código.

## Dependencias

- `gov.SystemRoles` / `gov.SystemRoleGroups` y `SystemAuthorizationService`
  (resolución de rol vía LDAP).
- `gov.RoleFieldPermissions` / `gov.FieldDefinitions` y `PermissionService`
  (matriz de permisos por campo).
- `gov.AdministrativeScopes` / `gov.AdministrativeScopeFilters` y
  `AdministrativeScopeService` (modelo declarativo de ámbito).
- `gov.RoleScopeAssignments` y `RoleScopeAssignmentService` (relación
  rol↔ámbito, Incremento 3).
- `AdGateway`/`IAdGateway` (capa LDAP completa: búsqueda, alta, modify,
  grupos, listas de distribución, `memberOf`).
- `ICurrentUserService` y la autenticación Entra ID ya configurada
  (`AddMicrosoftIdentityWebApi`).
- Disponibilidad operativa de Active Directory on-prem (LDAP) y de SQL
  Server (esquema `gov`) como fuentes de verdad.
- Resolución pendiente, fuera de este ADR, de la inconsistencia de tipado
  entre `RoleFieldPermissions.RoleName` (texto/enum) y `SystemRoles.Id` (FK
  numérica) — el motor deberá convivir con ella o su resolución deberá
  decidirse antes/durante la fase de arquitectura.

## Exclusiones

- No incluye diseño ni propuesta de clases, interfaces, servicios, cachés,
  middlewares ni ningún artefacto de implementación.
- No incluye reset de contraseña — la operación no existe hoy en el sistema
  (`unicodePwd` solo se escribe una vez, en creación de cuenta) y no formó
  parte del corpus analizado como capacidad a cubrir de inmediato.
- No incluye la definición de un ámbito "global" ni el preflight de
  enforcement mencionado en `docs/role-scope-assignment.md` — quedan como
  trabajo posterior, explícitamente fuera de este documento.
- No incluye la decisión de si se habilitará creación/eliminación dinámica
  de roles (hoy el catálogo es fijo, 5 roles seedados).
- No incluye la migración de `RoleFieldPermissions.RoleName` de enum/texto a
  FK numérica — se documenta como dependencia/deuda, no se resuelve aquí.
- No incluye estrategia de caching, pooling de conexiones LDAP ni paginación
  de búsquedas — son decisiones de implementación, fuera del alcance
  funcional de este ADR.
- No incluye cambios sobre ningún endpoint todavía — este ADR no modifica
  gates existentes ni agrega gates nuevos. **Esto no implica exclusión
  permanente**: los endpoints hoy abiertos por ausencia de autorización
  (creación de cuentas, operaciones de `AdController`, búsqueda y lectura
  de perfil de usuario, administración de grupos de seguridad sobre un
  usuario existente) no quedan fuera del futuro Motor de Autorización solo
  por carecer de gate hoy — ver la distinción de tres categorías en
  Alcance y el Requisito Funcional 7. Lo que este documento pospone es
  únicamente el cambio en sí: la fase de arquitectura deberá clasificar
  cada endpoint según esas tres categorías y proponer cómo incorporar
  progresivamente al enforcement los que hoy están abiertos por ausencia,
  sin asumir que su apertura actual es una decisión a preservar.
- Los endpoints deliberadamente abiertos por diseño (ej. lectura de la
  matriz de permisos, lectura de la política de nombres) tampoco se
  modifican en este ADR; a diferencia del punto anterior, su apertura sí
  está documentada como decisión intencional, por lo que la arquitectura
  deberá representarlos como tales, no como pendientes de cierre.
