# AccountGovernance — Documentación Técnica

Documentación generada y mantenida por `ArchitectureDocumentationSkill`.  
Invocar con `/architecture-documentation` cuando se agregue endpoint, pantalla, entidad, tabla o flujo.

## Índice

### Visión general
- [Arquitectura del sistema](diagrams/system-architecture.md) — diagrama Mermaid completo

### Frontend
- [Visión general](frontend/overview.md) — capas, router, roles, Design System
- [Páginas](frontend/pages.md) — todas las rutas y su comportamiento
- [Agents y Skills](frontend/agents-skills.md) — patrón y responsabilidades

### Backend
- [Visión general](backend/overview.md) — stack, proyectos, patrones
- [Endpoints API](backend/endpoints.md) — contratos HTTP completos con ejemplos
- [Entidades de dominio](backend/entities.md) — User, FieldDefinition, RoleFieldPermission, AuditEntry
- [Base de datos](backend/database.md) — tablas gov.*, schema SQL, consideraciones IIS

### Diagramas
- [Flujo búsqueda de usuario](diagrams/user-search-flow.md)
- [Flujo detalle de usuario](diagrams/user-detail-flow.md)
- [Lógica filtro LDAP](diagrams/ldap-filter-logic.md)

### Architecture Decision Records
- [ADR-001](adr/001-react-custom-router.md) — Router personalizado sin react-router-dom
- [ADR-002](adr/002-clean-architecture-api.md) — Clean Architecture para ASP.NET Core
- [ADR-003](adr/003-ldap-exact-match-search.md) — Búsqueda LDAP por identificadores exactos
- [ADR-004](adr/004-windows-auth-only.md) — Windows Authentication exclusivo

### Historial
- [Changelog](changelog.md)
