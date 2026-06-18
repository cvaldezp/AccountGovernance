# Frontend — Páginas

| RouteKey | Componente | Descripción |
|----------|------------|-------------|
| `dashboard` | `DashboardPage` | Resumen de actividad y métricas |
| `search` | `SearchUserPage` | Búsqueda de usuarios por Banner/correo/sAMAccountName |
| `user-detail` | `UserDetailPage` | Perfil completo de un usuario AD |
| `audit` | `AuditPage` | Log de auditoría con filtros por fecha, operador, acción |
| `attribute-catalog` | `AttributeCatalogPage` | Catálogo de atributos AD con tipo y sensibilidad |
| `permissions-matrix` | `PermissionsMatrixPage` | Matriz roles × atributos con estados Editar/Ver/Sin Acceso |

## SearchUserPage

- Placeholder: "Código Banner, correo institucional o usuario AD"
- Validación mínima: 3 caracteres antes de llamar al agente
- Error controlado: `TOO_MANY_RESULTS` muestra alerta amarilla
- Fallback: si la API no responde, usa `SearchUserSkill` (mock)
- Columnas de tabla: Usuario (mono), Nombre+correo, Departamento, Cargo, Estado (badge), Acciones

## PermissionsMatrixPage

- Tabs de rol → selección activa con color del rol
- Tarjetas resumen: cuántos campos son Visibles / Editables / Sin Acceso para el rol seleccionado
- Columna del rol seleccionado resaltada con tint del color del rol
- Leyenda con `PermCell` component en el footer
