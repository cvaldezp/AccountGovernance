# Changelog

## [2026-07-20] — Incremento 2.1: política de nombres de cuenta configurable

### Agregado

**Backend**
- `gov.AccountNamingPolicy` — tabla singleton física (`CHECK (Id=1)` + PK, sin
  depender de convención), única política de nombres para todo el sistema de
  creación de cuentas.
- `GET/PUT /api/account-naming-policy` — lectura para cualquier autenticado,
  edición exclusiva de `SystemAdmin`, auditada en `gov.AuditEntries`
  (`AuditActionType.NamingPolicyUpdated`).
- `AccountNamingPolicyService.ValidateAccountNameAsync` — única fuente de
  normalización (trim + minúsculas culturalmente estables, `ToLowerInvariant`)
  y validación (charset, longitud, extremos, consecutivos, longitud efectiva
  de `sAMAccountName` considerando el prefijo del tipo/subtipo, tope duro de
  20 caracteres) — sin regex en ningún punto del motor de validación.
- Validación de la propia configuración al editar (`PUT`): rechaza
  `AllowedChars` vacío, con mayúsculas, espacios, caracteres de control, fuera
  del superconjunto seguro, duplicados, o sin ningún alfanumérico; `MinLength`,
  `MaxLength` y su relación mutua; `MaxLength > 20`.

**Frontend**
- `shared/account-naming/` — módulo reutilizable por cualquier tipo de cuenta
  presente o futuro: cliente API, y `normalizeAndValidateAccountName()` que
  replica el mismo algoritmo del backend (sin regex) para dar feedback en vivo
  mientras el técnico escribe.
- Campo "Cuenta" del formulario de creación: error visible y hint dinámico
  construido desde la política real (nunca texto hardcodeado); el botón
  "Crear cuenta" queda deshabilitado mientras el nombre no sea válido.

### Corregido

- El sistema eliminaba silenciosamente caracteres no soportados del campo
  "Cuenta" (`AccountCreationService.Ascii()` / `accountTypes.ts::normalizeToAscii()`,
  ambas eliminadas) — la vista previa nunca coincidía con lo realmente
  almacenado en AD (ej. `sales-force` se guardaba como `salesforce` sin
  avisar). Ahora: si el nombre cumple la política, se usa exactamente igual en
  `sAMAccountName`/`UserPrincipalName`/`mail`; si no, se rechaza con un
  mensaje claro — nunca se modifica sin que el usuario lo sepa.

### Pruebas

Ver `docs/account-naming-policy.md` — 16 casos de nombre + 9 casos de
configuración inválida ejecutados contra el código real (backend vía harness
temporal referenciando `AccountGovernance.Application`; frontend vía Node 24
con type-stripping nativo sobre el módulo TypeScript real, sin reimplementar
la lógica). Los 2 casos que requieren infraestructura viva (conflicto de AD,
gate de autorización HTTP) se verificaron por lectura de código, no ejecución.
Comparación objetiva de ESLint contra el commit base (`4a2f107`, vía git
worktree aislado) confirmó cero errores nuevos introducidos.

**Pendiente — verificación operacional en Development (no es deuda de
código, es una tarea del propietario del ambiente)**: aplicar `schema.sql` y
validar el singleton físico, y ejercitar `GET`/`PUT /api/account-naming-policy`
con una cuenta `SystemAdmin` real, confirmando la entrada en `gov.AuditEntries`.
Procedimiento reproducible completo en `docs/account-naming-policy.md`
§ "Validación operacional pendiente".

**Sin pantalla administrativa todavía**: la política se edita hoy solo vía
`PUT` desde Swagger/Postman. Propuesto (no implementado, pendiente de
autorización) como Incremento 2.1.1.

---

## [2026-07-16] — Hito v1: integración real con Active Directory

### Agregado

**Backend**
- `PATCH /api/users/{samAccountName}/attributes/{adAttributeName}` — escritura real de atributos AD vía LDAP `ModifyRequest` (Replace/Delete), con validación de denylist de atributos protegidos, `FieldDefinition` activo, `CanEdit` real por rol, `DataType`, chequeo de concurrencia (`previousValue` → 409) y auditoría real
- `PATCH /api/users/{samAccountName}/status` — habilita/deshabilita cuenta con toggle seguro del bit `ACCOUNTDISABLE` de `userAccountControl` (preserva el resto de flags; no reutiliza el overwrite fijo 512/514 de creación de cuenta)
- `IAdGateway.UpdateUserAttributeAsync` / `SetAccountEnabledAsync` — nuevos métodos LDAP de escritura
- `UserService.UpdateAttributeAsync` / `UpdateAccountStatusAsync` — orquestación de validaciones + auditoría
- `AttributeValueValidator` — validación/normalización extensible por `DataType` (string/integer/flags/boolean/datetime/dn)
- Reutiliza `AuditActionType.UpdateField` / `EnableAccount` / `DisableAccount` (existían en el enum desde una fase previa sin consumidor real)

**Frontend**
- `api/usersApi.ts` — cliente real de escritura (`updateUserAttribute`, `updateAccountStatus`)
- `UserProfileAgent.updateField` y `UserStatusAgent.enable/disable` — rama real (API) vs. mock (`VITE_USE_MOCK_DATA=true`), sin fallback silencioso
- `UserDetailPage` — tras un guardado exitoso, re-consulta `GET /api/users/{sam}` y refresca desde el valor real de AD, en vez de mutación optimista local

### Corregido

- El botón "Guardar" de Detalle de Usuario devolvía "Usuario no encontrado" para cualquier usuario real — resuelto: el flujo comparaba el `samAccountName` real contra IDs de `MOCK_USERS` (`'1'`, `'a1'`, etc.), nunca llegaba al backend

### Cierre de fase — módulos ya sin mocks (bajo `VITE_USE_MOCK_DATA=false`)

Catálogo de atributos AD, Matriz de Permisos, Auditoría, Búsqueda de Usuario,
Detalle de Usuario (lectura y escritura), habilitar/deshabilitar cuenta.
Detalle en `docs/backend/endpoints.md` y `docs/frontend/agents-skills.md`.

### Deuda de documentación conocida (no resuelta en este hito)

- `docs/backend/database.md` — el esquema de `gov.AuditEntries`/`gov.FieldDefinitions`
  documentado no coincide con `schema.sql`/las entidades reales (`AuditEntry`,
  `FieldDefinition`) desde antes de este hito; pendiente de una revisión dedicada.
- `agents/PermissionAgent.ts` y `agents/AuditAgent.ts` — cero consumidores en el
  frontend, candidatos a eliminación en una fase de limpieza futura (no removidos
  todavía, ver nota en `docs/frontend/agents-skills.md`).

---

## [2026-06-17]

### Agregado

**Frontend**
- `SearchUserPage` — búsqueda por Código Banner, correo institucional o usuario AD; validación mínimo 3 caracteres; alerta controlada para `TOO_MANY_RESULTS`
- `UserSearchAgent` — integración con API real (`GET /api/users/search`) con fallback a mock si la API no está disponible
- `AttributeCatalogPage` — tabla de catálogo de atributos AD con tipo, sensibilidad y estado
- `PermissionsMatrixPage` — matriz N×roles con tabs de selección de rol, celdas Editar/Ver/Sin Acceso y tarjetas resumen

**Backend (`AccountGovernance.Api`)**
- `GET /api/users/search?q=` — búsqueda de usuarios por identificadores institucionales (CustomBannerID, mail, UPN, sAMAccountName); filtro LDAP exacto; manejo de `SizeLimitExceeded`
- `GET /api/users/{samAccountName}` — perfil completo AD con 25 campos: identidad, contacto, organización, extensionAttributes, UAC, whenCreated, whenChanged
- `UserDetailDto` — DTO completo de detalle de usuario AD
- `AdGateway` — separación `SearchFetchAttributes` / `DetailFetchAttributes`; escapado LDAP (RFC 4515); parseo Generalized Time para whenCreated/whenChanged
- `AdUserMapper` — mapeo completo de 23 atributos LDAP a dominio `User`
- Esquema SQL `gov` en base `USFQ_AccountManager`; tablas: `gov.FieldDefinitions`, `gov.RoleFieldPermissions`, `gov.AuditEntries`

### Modificado

- `User.cs` (dominio) ampliado con GivenName, Surname, UPN, Company, Manager, Mobile, ExtensionAttribute1-3, UserAccountControl, WhenCreated, WhenChanged
- `IAdGateway.SearchUsersAsync` — default `maxResults` reducido de 50 a 20
- `UserService.SearchAsync` — mínimo 3 caracteres (era 2)
- `AdGateway.SearchFetchAttributes` — conjunto mínimo para lista (7 attrs) separado de `DetailFetchAttributes` (23 attrs)

---

## [2026-06-16]

### Agregado

**Frontend**
- SPA React 19 + Vite + TypeScript con router personalizado basado en `RouteKey`
- Sistema de diseño en `src/shared/ui/` con tokens USFQ (rojo `#ED1C24`, tipografía Libre Baskerville / Quicksand)
- Roles: `DragonHelp`, `Registro`, `Seguridades`, `RRHH` con matriz de permisos por campo AD
- `DashboardPage` — resumen de actividad
- `AuditPage` — log de auditoría con filtros
- Sidebar con secciones Principal y Configuración

**Backend**
- Solución Clean Architecture con 4 proyectos: Domain, Application, Infrastructure, Api
- Swagger (Swashbuckle), Serilog (Console + File), CORS para `http://localhost:5173`
- `ExceptionHandlingMiddleware` — oculta detalles fuera de Development
- Windows Authentication exclusivo — sin credenciales SQL
- `GET /api/permissions/fields/me`, `GET /api/permissions/matrix`, `GET /api/audit`, `GET /api/dashboard/summary`
