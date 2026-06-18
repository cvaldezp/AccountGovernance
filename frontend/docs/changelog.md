# Changelog

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
