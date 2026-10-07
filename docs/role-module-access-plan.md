# Accesos por Rol a Módulos y Acciones — Plan

> Estado: **aprobado (2026-10-07). Fase 1 implementada** (pendiente de
> aplicar `schema.sql` en Development y validar en vivo). Fases 2 y 3
> pendientes.
> Decisiones tomadas por el usuario funcional:
> - El permiso controla **menú + pantalla + API** (una sola fuente de verdad).
> - Granularidad **módulos + acciones**.
> - Configuración **delegable solo en sus módulos operativos** (Catálogo AD,
>   Tipos de Cuenta, Grupos Iniciales). Lo que define autorización de otros
>   roles queda fijo en SystemAdmin.
> - El sistema **arranca restringido**, no con los accesos de hoy.
> - Se implementa **antes del Incremento E** (E queda en pausa con su plan).

## Objetivo

Una pantalla de Configuración donde SystemAdmin define, por rol, a qué
módulos del portal entra (menú y pantalla) y qué acciones puede ejecutar
dentro de cada módulo. El mismo permiso lo respetan el Sidebar, el guard
de ruta del frontend y el backend (403 si el rol no tiene el permiso).

## Punto de partida (2026-10-07)

Ya implementado como paso previo (mismo día):
- Toda la sección **Configuración** es exclusiva de SystemAdmin: menú,
  guard de ruta (`RouterView`) y API (`AccountTypeConfigController` completo
  y lectura de Catálogo AD / Matriz en `PermissionsController`).
- `frontend/src/routes/routeAccess.ts` (`ROUTE_ACCESS` + `canAccessRoute`)
  centraliza qué rol ve cada pantalla. **Este mapa estático es lo que este
  plan reemplaza** por datos reales desde la base.

Gates actuales en el backend fuera de Configuración:

| Endpoint | Gate hoy |
|---|---|
| `GET /dashboard/summary` | Ninguno (cualquier autenticado) |
| `GET /users/search`, `GET /users/{sam}` | Ninguno |
| `PATCH /users/{sam}/attributes/...`, `.../status` | Matriz de Permisos + ámbito (Incrementos C/D) |
| `GET /audit` | Ninguno |
| `/account-types`, `/accounts/*` (incluye **crear cuenta en AD**) | Ninguno |
| `POST /ad/groups/validate` | Ninguno |
| `/distribution-lists/*` | `ReadRoles`/`WriteRoles` fijos en código |

Los "Ninguno" coinciden con el **Incremento F** de
`authorization-engine-architecture.md` ("cobertura de operaciones hoy sin
gate"). Este plan le da a F el mecanismo de rol→operación; la evaluación
de ámbito sobre el recurso proyectado (creación de cuentas) sigue siendo
parte de F y no entra acá.

## Modelo de datos (`schema.sql`, bloques idempotentes)

```sql
-- Catálogo de recursos: lo define el código (cada recurso corresponde a
-- una pantalla/endpoint real), se siembra desde schema.sql y NO se edita
-- desde la UI.
CREATE TABLE gov.AppResources (
    ResourceKey       NVARCHAR(100) NOT NULL PRIMARY KEY,  -- 'users.search'
    ParentKey         NVARCHAR(100) NULL,                  -- acción → su módulo
    ResourceType      NVARCHAR(20)  NOT NULL,              -- Module | Action | Tab
    DisplayName       NVARCHAR(200) NOT NULL,
    Description       NVARCHAR(500) NULL,
    SortOrder         INT           NOT NULL DEFAULT 0,
    SystemAdminOnly   BIT           NOT NULL DEFAULT 0,    -- no delegable
    IsActive          BIT           NOT NULL DEFAULT 1,
    CONSTRAINT FK_Gov_AppResources_Parent FOREIGN KEY (ParentKey)
        REFERENCES gov.AppResources(ResourceKey)
);

-- Permiso rol→recurso. Mismo patrón que RoleScopeAssignments: FK real a
-- SystemRoles, sin DELETE, solo activar/desactivar.
CREATE TABLE gov.RoleResourcePermissions (
    Id            INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    SystemRoleId  INT           NOT NULL,
    ResourceKey   NVARCHAR(100) NOT NULL,
    IsActive      BIT           NOT NULL DEFAULT 1,
    CreatedAt     DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    CreatedBy     NVARCHAR(200) NULL,
    UpdatedAt     DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    UpdatedBy     NVARCHAR(200) NULL,
    CONSTRAINT FK_Gov_RoleResourcePermissions_Role FOREIGN KEY (SystemRoleId)
        REFERENCES gov.SystemRoles(Id),
    CONSTRAINT FK_Gov_RoleResourcePermissions_Resource FOREIGN KEY (ResourceKey)
        REFERENCES gov.AppResources(ResourceKey),
    CONSTRAINT UQ_Gov_RoleResourcePermissions UNIQUE (SystemRoleId, ResourceKey)
);
```

## Catálogo inicial de recursos

| ResourceKey | Tipo | Padre | Endpoints que protege | No delegable |
|---|---|---|---|---|
| `dashboard` | Module | — | `GET /dashboard/summary` | |
| `users` | Module | — | `GET /users/search`, `GET /users/{sam}` | |
| `account-creation` | Module | — | `GET /account-types`, `/accounts/validate-*`, `/accounts/preview` | |
| `account-creation.create` | Action | `account-creation` | `POST /accounts/create`, `POST /ad/groups/validate` | |
| `audit` | Module | — | `GET /audit` | |
| `distribution-lists` | Module | — | search/detail/members (GET) | |
| `distribution-lists.manage-members` | Action | `distribution-lists` | `POST members`, `POST members/remove` | |
| `config.attribute-catalog` | Module | — | `GET /permissions/attributes[/{key}]` | |
| `config.attribute-catalog.edit` | Action | `config.attribute-catalog` | `POST/PUT/PATCH /permissions/attributes...` | |
| `config.account-types` | Module | — | `GET /account-type-configs[/{typeKey}]` | |
| `config.account-types.edit` | Action | `config.account-types` | `PUT /account-type-configs/{typeKey}[/subtypes/...]` | |
| `config.initial-groups` | Module | — | `GET /account-type-configs/.../groups` | |
| `config.initial-groups.edit` | Action | `config.initial-groups` | `POST/PUT/DELETE` de grupos | |
| `config.permissions-matrix` | Module | — | `GET/PUT /permissions/matrix...` | ✔ |
| `config.system-roles` | Module | — | `SystemRolesController` | ✔ |
| `config.administrative-scopes` | Module | — | Scopes + RoleScopeAssignments | ✔ |
| `config.role-access` | Module | — | la pantalla de este plan | ✔ |

Reglas:
- Una **acción** solo es efectiva si el rol también tiene su **módulo**
  padre (la UI lo refleja: desactivar el módulo deshabilita sus acciones).
- **SystemAdmin** tiene todo siempre, sin consultar la tabla (mismo bypass
  `SYSTEM_ADMIN_BYPASS` de los Incrementos A–D).
- Recursos `SystemAdminOnly` no se pueden otorgar a otro rol (el backend
  rechaza el grant con 400, la UI no muestra el control). Evita escalada de
  privilegios: nadie distinto de SystemAdmin puede llegar a editar la
  Matriz (se daría a sí mismo permiso de editar atributos), roles, ámbitos
  ni esta misma pantalla.
- **Edición de atributos y habilitar/deshabilitar cuenta no entran acá**:
  siguen gobernados por la Matriz de Permisos + ámbitos (C/D, y E a
  futuro). Duplicarlos en esta pantalla crearía dos lugares para otorgar
  lo mismo. Requisito mínimo: tener el módulo `users`.
- `Tab` queda soportado en el modelo; hoy no existe ninguna pestaña en el
  portal, así que el catálogo inicial no tiene ninguna.

## Siembra inicial — restringida (aprobada 2026-10-07)

Decisión: el sistema arranca restringido. **Propuesta** de matriz inicial
(✔ = otorgado; SystemAdmin no aparece porque tiene todo siempre). Las
responsabilidades de cada rol no están documentadas en el repo; esta
propuesta se dedujo de la configuración real (`RoleFieldPermissions`,
`DistributionListsController`, descripciones de `gov.SystemRoles`) y el
usuario funcional la aprobó sin cambios:

| Recurso | Seguridades | RRHH | Registro | DragonHelp |
|---|:-:|:-:|:-:|:-:|
| `dashboard` | ✔ | ✔ | ✔ | ✔ |
| `users` (buscar y ver perfil) | ✔ | ✔ | ✔ | ✔ |
| `account-creation` (ver) | ✔ | ✔ | ✔ | |
| `account-creation.create` | ✔ | ✔ | ✔ | |
| `audit` | ✔ | | | |
| `distribution-lists` | ✔ | | ✔ | ✔ |
| `distribution-lists.manage-members` | ✔ | | | |
| `config.*` delegables | | | | |

Cambios respecto de hoy (lo que se pierde el día del despliegue):
- **DragonHelp** deja de poder crear cuentas (mesa de ayuda: edita email/oficina).
- **RRHH, Registro y DragonHelp** dejan de ver la Auditoría (expone qué hizo
  cada operador sobre cada cuenta).
- Listas de distribución y Configuración: sin cambios respecto de hoy.

Límite conocido: `account-creation.create` otorga crear cuentas de
**cualquier tipo** — restringir por población (RRHH solo empleados,
Registro solo estudiantes) requiere evaluar el ámbito sobre la cuenta
proyectada, que sigue siendo parte del Incremento F.

Bloque idempotente (`INSERT ... SELECT ... WHERE NOT EXISTS`, mismo
criterio que el Incremento E): solo inserta filas que no existen, nunca
pisa un cambio hecho después desde la pantalla.

## Backend

- `IRoleResourceAccessService.HasAccessAsync(upn, resourceKey, ct)` y
  `GetAllowedResourcesAsync(upn, ct)`: resuelve roles con
  `ISystemAuthorizationService.GetUserRolesAsync` (igual que hoy) + tabla
  cacheada en `IMemoryCache` (patrón de `FieldDefinitionsCache`: invalidación
  explícita en cada mutación, TTL 30 s de respaldo).
- Atributo de filtro `[RequireResource("users")]` sobre cada acción de
  controller: devuelve `403` con el mismo cuerpo `{ error }` que los gates
  actuales (no `Forbid()`, decisión ya vigente). Reemplaza los
  `ReadRoles`/`WriteRoles` fijos de `DistributionListsController` y los
  `IsSystemAdminAsync` manuales de Configuración (estos últimos solo por
  consistencia — su resultado es idéntico).
- `GET /auth/me` devuelve las claves permitidas en `permissions: string[]`
  (campo que ya existía en `MeResponseDto`, reservado y siempre vacío hasta
  ahora). El frontend no vuelve a calcular permisos por su cuenta.
- CRUD admin (`config.role-access`, SystemAdmin): `GET /role-access`
  (matriz roles × recursos), `PUT /role-access/{roleKey}/{resourceKey}`
  (`{ isActive }`). Cada cambio se audita en `gov.AuditEntries`
  (`GrantResource`/`RevokeResource`, `TargetUser = roleKey`,
  `FieldKey = resourceKey`, mismo patrón que `UpdateRolePermission`).

## Frontend

- `routeAccess.ts`: `ROUTE_ACCESS` pasa de lista de roles a
  `RouteKey → ResourceKey` (`ROUTE_RESOURCE`); `canAccessRoute` consulta
  `user.permissions` (de `/auth/me`). Sidebar y `RouterView` no cambian de forma.
- Hook `useCan(resourceKey)` para ocultar acciones (ej. botón "Crear
  cuenta", "Agregar miembro").
- Pantalla nueva **Configuración → Accesos por Rol**: columnas = roles
  activos de `gov.SystemRoles`; filas = módulos con sus acciones anidadas;
  celda = interruptor con actualización optimista por celda (mismo patrón
  que `useMatrixEditor`). SystemAdmin fijo en "todo", filas no delegables
  bloqueadas con su motivo visible.

## Implementación por fases

1. ✅ **Modelo + seed + servicio + `/auth/me` + frontend leyendo `permissions`.**
   La restricción ya se ve en el menú y en las pantallas (seed restringido),
   pero la API todavía no la exige — se cierra en la fase 3.
2. **Pantalla Accesos por Rol** (CRUD + auditoría) **+ alta de roles nuevos
   desde "Roles y Grupos"** (aprobado 2026-10-07).
3. **Enforcement en backend** con `[RequireResource]`, endpoint por
   endpoint, con tests de gate por controller (patrón
   `*ControllerGateTests`).

## Roles nuevos (ej. `Desarrollo`)

Un rol del portal = una fila en `gov.SystemRoles` (`RoleKey`) + los grupos
de AD mapeados en `gov.SystemRoleGroups` ("Roles y Grupos"). Los roles de
un usuario = los `RoleKey` activos cuyos grupos contienen al usuario en AD.

- Este modelo usa `SystemRoleId` (FK), no una lista fija: un rol nuevo
  aparece solo como columna en Accesos por Rol, **sin ningún permiso**
  (fail-closed) hasta que SystemAdmin se los otorgue. La matriz inicial
  solo siembra los 4 roles actuales; no fija la lista de roles.
- Un usuario con varios roles recibe la **unión** de los permisos de
  todos sus roles (no solo los del rol primario).

Bloqueos actuales para un rol nuevo, fuera de este modelo:
1. **No existe alta de roles desde la UI**: `SystemRolesController` solo
   edita roles existentes y sus grupos; un rol nuevo requiere `INSERT`
   manual en `gov.SystemRoles`.
2. **El frontend fija los 5 roles** (`VALID_ROLES` en
   `MsalAuthProvider.tsx`, tipo `RoleName` en `types/index.ts`). Un
   usuario cuyo único rol sea `Desarrollo` queda sin sesión utilizable
   (`primaryRole` inválido → `user = null`); si tiene además otro rol,
   `Desarrollo` se descarta en silencio. **Se corrige en la fase 1** —
   sin esto la pantalla de accesos no tendría sentido para roles nuevos.
3. **El backend usa el enum `RoleName`** para la Matriz de Permisos y
   `fields/me`: un rol nuevo recibe `UNSUPPORTED_ROLE` (no puede ver el
   detalle de usuario ni configurarse en la Matriz). Es la deuda del
   Incremento G; el Incremento E (`RoleScopeFieldPermission` con
   `SystemRoleId`) la resuelve para los permisos de campo.

## Fase 1 — implementado (2026-10-07)

Backend:
- `schema.sql`: `gov.AppResources`, `gov.RoleResourcePermissions`, seed del
  catálogo (17 recursos) y de la matriz restringida. Bloques idempotentes.
- `AppResource`, `RoleResourcePermission` (Domain);
  `IRoleResourceRepository`/`RoleResourceRepository` (solo lectura por
  ahora); `IRoleResourceCatalogCache`/`RoleResourceCatalogCache` (IMemoryCache,
  TTL 30 s); `IRoleResourceAccessService`/`RoleResourceAccessService` (reglas).
- `AuthController.GetMe`: `Permissions` = recursos permitidos.
- 9 tests nuevos (`Authorization/RoleResourceAccessServiceTests`): bypass
  SystemAdmin, unión de roles, acción sin módulo padre, no delegable,
  inactivo, rol nuevo sin filas, comparación sin mayúsculas. 121/121.

Frontend:
- Roles dinámicos: `RoleName` pasa a `string`; `MsalAuthProvider` ya no
  filtra contra la lista fija `VALID_ROLES` (bloqueo 2 de "Roles nuevos",
  resuelto).
- `routes/routeAccess.ts`: `ROUTE_RESOURCE` + `canAccessRoute` +
  `useCan(resourceKey)`. Sidebar y `RouterView` usan `user.permissions`.
- Acciones: "Crear cuenta" deshabilitado sin `account-creation.create`;
  agregar/quitar miembros de listas usa `distribution-lists.manage-members`
  (reemplaza `WRITE_ROLES` fijo).

**Orden de despliegue obligatorio**: aplicar el bloque nuevo de
`schema.sql` **antes** de desplegar este backend. Sin las tablas,
`/auth/me` falla y nadie puede entrar al portal.

Pendiente para fase 3 (sin cambios todavía): la API sigue aplicando sus
reglas fijas (`IsSystemAdminAsync`, `ReadRoles`/`WriteRoles`), y las
pantallas de Configuración siguen mostrando controles de edición solo a
SystemAdmin — delegar un módulo de Configuración desde la pantalla de la
fase 2 no tendrá efecto real hasta la fase 3.

