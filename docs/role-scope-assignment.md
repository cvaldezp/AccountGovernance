# RoleScopeAssignment — Incremento 3

Asigna Ámbitos Administrativos (`gov.AdministrativeScopes`) a roles del
sistema (`gov.SystemRoles`). **Sin enforcement todavía**: estas asignaciones
no restringen ninguna operación real sobre usuarios/AD hasta que se
implemente el scope-check correspondiente (incremento posterior). Este
incremento entrega únicamente el modelo de datos, el CRUD administrativo y su
interfaz — LDAP, resolución de roles, `RoleScopeFieldPermission` y la
resolución automática de Scope de un usuario quedan intactos.

## Modelo de datos

```sql
gov.RoleScopeAssignments
  Id                     INT IDENTITY PK
  SystemRoleId           INT NOT NULL  → FK gov.SystemRoles(Id)
  AdministrativeScopeId  INT NOT NULL  → FK gov.AdministrativeScopes(Id)
  IsActive               BIT NOT NULL DEFAULT 1
  CreatedAt / CreatedBy
  UpdatedAt / UpdatedBy
  CONSTRAINT UQ_Gov_RoleScopeAssignments_Pair UNIQUE (SystemRoleId, AdministrativeScopeId)
```

**Relación única para toda la vida del par** — a diferencia de
`UQ_Gov_AdministrativeScopeFilters_Active` (filtrada por `IsActive=1`), esta
restricción es **sin filtro**: solo puede existir una fila por
`(SystemRoleId, AdministrativeScopeId)`, activa o inactiva. Reactivar una
asignación es siempre un `UPDATE` sobre la fila existente
(`PATCH .../status`), nunca un `INSERT` nuevo. La tabla no tiene `DELETE` —
la baja es exclusivamente `IsActive=0`, y la fila se conserva siempre para
trazabilidad y posible reactivación. El historial de cambios de estado vive
en `gov.AuditEntries`, no en filas duplicadas de esta tabla.

**FK numérica, no clave de texto** — sigue el patrón ya establecido por
`gov.SystemRoleGroups.SystemRoleId` y
`gov.AdministrativeScopeFilters.AdministrativeScopeId` (ambos `INT` FK al
`Id` del padre), no el patrón más antiguo y ya documentado como deuda de
`RoleFieldPermission.RoleName` (enum, sin FK real). `RoleKey`/`ScopeKey` se
exponen en DTOs/API vía `JOIN` en el repositorio (campos de navegación, mismo
patrón que `SystemRoleGroup.RoleKey`).

**Sin seed**: la tabla nace vacía. Antes de activar el enforcement se
diseñará y ejecutará un preflight obligatorio aparte, que decidirá en ese
momento si se necesita un ámbito "global" y cuál es su `BaseDn` validado —
este incremento no asume ninguno.

## Semántica de efectividad (documentada para el futuro enforcement)

> Una asignación será efectiva únicamente cuando estén activos
> simultáneamente: `RoleScopeAssignment.IsActive`, `SystemRole.IsActive` y
> `AdministrativeScope.IsActive`.

Desactivar posteriormente un rol o un ámbito **no modifica en cascada** las
asignaciones — simplemente las vuelve inertes mientras el padre permanezca
inactivo. Reactivar el padre reactiva automáticamente el efecto de la
asignación, sin necesidad de recrearla.

**Última asignación de un rol**: este incremento permite desactivarla
libremente, sin advertencia ni bloqueo — sin enforcement no tiene ningún
efecto operativo. El incremento de enforcement deberá incluir un **preflight
de roles sin ninguna asignación activa** antes de habilitarse, para evitar
bloqueos sorpresivos.

## Reglas de negocio

| Caso | Comportamiento |
|---|---|
| `POST` con rol inexistente | `404`-like `400 ROLE_NOT_FOUND` |
| `POST` con rol inactivo | `400 ROLE_INACTIVE` |
| `POST` con Scope inexistente | `400 SCOPE_NOT_FOUND` |
| `POST` con Scope inactivo | `400 SCOPE_INACTIVE` |
| `POST` con asignación activa ya existente | `400 DUPLICATE_ASSIGNMENT` |
| `POST` con asignación inactiva ya existente | `400 ASSIGNMENT_EXISTS_INACTIVE` — reactivar con `PATCH`, no recrear |
| `POST` exitoso | Crea la fila con `IsActive=1` directamente (no hay estado "borrador") |
| `PATCH .../status` al mismo estado que ya tiene | `400 NO_STATE_CHANGE` — no genera auditoría ni escritura, no es una mutación real |
| `PATCH .../status` a un estado distinto | Permitido, sin validar el estado del rol/Scope padre en ese momento (la efectividad se evalúa en el futuro enforcement, no al mutar) |
| Editar un Scope que tiene asignaciones | Sin efecto — las asignaciones referencian el `Id` inmutable del Scope |
| Desactivar un Scope que tiene asignaciones activas | Permitido, sin bloqueo ni cascada (ver semántica de efectividad) |

## Backend

- `Domain/Entities/RoleScopeAssignment.cs`
- `Application/DTOs/RoleScopeAssignmentDto.cs` — `RoleScopeAssignmentDto`, `CreateRoleScopeAssignmentDto`, `UpdateRoleScopeAssignmentStatusDto`
- `Application/Common/DuplicateAssignmentException.cs` — traducción de la violación de `UQ_Gov_RoleScopeAssignments_Pair`, mismo patrón que `DuplicateFilterException`
- `Application/Interfaces/IRoleScopeAssignmentRepository.cs`
- `Application/Services/{I}RoleScopeAssignmentService.cs`
- `Infrastructure/Persistence/Repositories/RoleScopeAssignmentRepository.cs`
- `Api/Controllers/RoleScopeAssignmentsController.cs`

## API

Controlador dedicado `/role-scope-assignments` (no anidado bajo
`/system-roles` ni `/administrative-scopes` — la relación es genuinamente
muchos-a-muchos y se consulta simétricamente desde ambos lados). **Toda la
API, incluida la lectura, restringida a `SystemAdmin`** — mismo criterio que
`AdministrativeScopesController`.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/role-scope-assignments` | Lista todas; filtros opcionales `?roleKey=` y `?scopeKey=` |
| `GET` | `/role-scope-assignments/{id}` | Una asignación por Id |
| `POST` | `/role-scope-assignments` | Crea `{ roleKey, scopeKey }` — exige rol y Scope activos |
| `PATCH` | `/role-scope-assignments/{id}/status` | `{ isActive }` — activa o inactiva; **sin `DELETE`** |

## Auditoría

`gov.AuditEntries`, mismos campos que el resto del sistema:
`RoleName=SystemAdmin` (fijo — la mutación ya está restringida a ese rol),
`ActionType` ∈ {`RoleScopeAssigned`, `RoleScopeActivated`,
`RoleScopeDeactivated`}, `TargetUser=RoleKey`, `FieldKey=ScopeKey`, operador y
fecha UTC automáticos. `OldValue`/`NewValue` **nunca son un `Active`/`Inactive`
suelto** — esa misma tabla ya usa ese patrón para `EnableAccount`/
`DisableAccount` sobre el estado de una cuenta AD, lo que podría confundirse
con una acción sobre un usuario. En su lugar describen la relación completa,
p.ej. `Rol 'RRHH' ↔ Ámbito 'empleados-usfq' (activa)`, para que la entrada sea
inequívoca leída de forma aislada.

## Frontend

Fuente única de datos: `frontend/src/modules/role-scope-assignments/`
(`types.ts`, `roleScopeAssignmentsApi.ts`, `useRoleScopeAssignments.ts`) — un
solo hook compartido, sin estado ni lógica de mutación duplicada.

- **Administración primaria — "Roles y Grupos"** (`SystemRolesConfigPage.tsx`):
  cada tarjeta de rol agrega una sección "Ámbitos Administrativos" con la
  misma interacción ya usada para Grupos AD (listar, activar/inactivar,
  agregar). El selector de "+ Agregar ámbito" solo ofrece Scopes activos que
  el rol todavía no tenga asignados (activa o inactivamente) — un Scope ya
  asignado se reactiva desde su propia fila, nunca se recrea. El botón
  "+ Agregar ámbito" no aparece si el rol está inactivo.
- **Referencia cruzada, solo lectura — "Ámbitos Administrativos"**
  (`AdministrativeScopesPage.tsx`): la ficha del Scope seleccionado muestra
  "Roles con este ámbito asignado", sin controles de mutación — evita
  duplicar la lógica de escritura en dos pantallas.

## Impacto y límites — confirmado

Este incremento **no modifica**: búsquedas LDAP, resolución de roles actual
(`SystemAuthorizationService`), creación/edición de usuarios, la matriz
`RoleFieldPermission` (todavía no existe `RoleScopeFieldPermission`),
resolución automática de Scope para un usuario, ni ningún enforcement sobre
operaciones de AD.

## Validación operacional pendiente

**No se cuenta con credenciales SQL funcionales en este entorno** (mismo
bloqueo de infraestructura ya documentado en `docs/account-naming-policy.md`
— `sqlcmd` falla con `Login failed for user` pese a tickets Kerberos válidos
según `klist`). El build de backend (`dotnet build`, 0 advertencias/0
errores) y el build de frontend (`tsc -b` + `vite build`, sin errores; `npx
eslint .` en el mismo baseline de 19 problemas preexistentes, sin ninguna
entrada nueva) sí se ejecutaron y pasaron. La siguiente validación queda
como verificación operacional a ejecutar por el propietario del ambiente:

1. **Aplicar `schema.sql`** en Development y confirmar:
   - `gov.RoleScopeAssignments` existe, con `UQ_Gov_RoleScopeAssignments_Pair`
     (`SELECT name, is_unique FROM sys.indexes WHERE object_id =
     OBJECT_ID('gov.RoleScopeAssignments')`).
   - `SELECT COUNT(*) FROM gov.RoleScopeAssignments` devuelve `0`.

2. **Con una cuenta `SystemAdmin` real, vía Swagger:**
   - `GET /role-scope-assignments` → `200`, `[]`.
   - `POST /role-scope-assignments { roleKey: "<rol activo>", scopeKey:
     "<scope activo>" }` → `201`, fila creada con `isActive: true`.
   - Repetir el mismo `POST` → `400 DUPLICATE_ASSIGNMENT`.
   - `PATCH /role-scope-assignments/{id}/status { isActive: false }` → `200`,
     `isActive: false`.
   - Repetir el `POST` original (mismo par, ahora inactivo) → `400
     ASSIGNMENT_EXISTS_INACTIVE`.
   - `PATCH .../status { isActive: true }` sobre la misma fila → `200`,
     reactivada — confirmar que sigue siendo la **misma** fila (`Id` sin
     cambiar) vía `GET /role-scope-assignments/{id}`.
   - `POST` con `roleKey` de un rol inactivo → `400 ROLE_INACTIVE`.
   - `POST` con `scopeKey` de un Scope inactivo → `400 SCOPE_INACTIVE`.
   - `GET /role-scope-assignments?roleKey=<rol>` y `?scopeKey=<scope>` →
     filtran correctamente.

3. **Con una cuenta sin rol `SystemAdmin`:**
   - Cualquiera de los endpoints anteriores (incluido `GET`) → `403`,
     idéntico exista o no exista el recurso solicitado (no debe ser posible
     distinguir "sin permiso" de "no existe" desde afuera).

4. **Concurrencia** (opcional, difícil de forzar manualmente): dos `POST`
   simultáneos del mismo par nuevo deben resultar en un `201` y un `400
   DUPLICATE_ASSIGNMENT` — la restricción única no filtrada de SQL Server es
   la defensa definitiva, el chequeo de aplicación (`GetByRoleAndScopeAsync`)
   es la primera línea.

5. **Auditoría**: confirmar en `gov.AuditEntries` una fila por cada mutación
   anterior, con `ActionType` correcto (`RoleScopeAssigned` /
   `RoleScopeActivated` / `RoleScopeDeactivated`), `TargetUser=RoleKey`,
   `FieldKey=ScopeKey`, `OldValue`/`NewValue` y `PerformedBy` coherentes.

6. **UI**: en "Roles y Grupos", agregar/activar/inactivar un ámbito desde la
   tarjeta de un rol; confirmar que "Ámbitos Administrativos" refleja el
   mismo dato en la ficha del Scope correspondiente (solo lectura) sin
   necesidad de recargar manualmente el módulo de Roles.

## Estado del incremento

Implementación completa (backend + frontend + documentación) según el
diseño aprobado. Build de backend y frontend verificados localmente;
`eslint` sin regresiones. **Sin commit, sin push** — pendiente de revisión
funcional por el propietario del ambiente y autorización explícita para
cerrar el incremento.
