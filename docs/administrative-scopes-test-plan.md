# Ámbitos Administrativos (Scope) — Plan y evidencia de pruebas

Documento de validación funcional y de seguridad para el módulo de Ámbitos
Administrativos (`gov.AdministrativeScopes` / `gov.AdministrativeScopeFilters`),
introducido en dos incrementos dentro del rediseño del modelo de autorización
(Rol + Scope + Campo). Este módulo **todavía no participa en la autorización
de operaciones sobre usuarios** — ningún endpoint de búsqueda, lectura o
escritura de usuarios consulta Scopes hoy; ese enforcement llega en
incrementos posteriores (`RoleScopeAssignment`, `RoleScopeFieldPermission`,
scope-check). Sí protege, desde este mismo incremento, su propio acceso
administrativo: toda la API de Scopes (lectura y escritura) está restringida
a `SystemAdmin` (ver sección 3).

## Estado de los incrementos

| Incremento | Alcance | Estado |
|---|---|---|
| 1 | Modelo de datos + CRUD backend (`AdministrativeScopesController`, servicio, repositorio, `schema.sql`) | **Cerrado y commiteado** — `43e9f44 feat(scope): Incremento 1 - modelo de datos y CRUD de Ambitos Administrativos` |
| 2 | UI "Ámbitos Administrativos" (maestro-detalle) + ajuste de seguridad (protección de lectura en la API) | **Cerrado** |

---

## 1. Incremento 1 — validación funcional (ejecutada, con evidencia real)

Ejecutada por el usuario vía Swagger contra la base de desarrollo real, con
el Scope de prueba `test-scope-usuarios`. Resultados confirmados por consulta
directa a `gov.AuditEntries` (evidencia pegada en la conversación original).

| Caso | Resultado esperado | Resultado obtenido |
|---|---|---|
| Crear Scope con `BaseDn` inválido, `IsActive=true` | `400 VALIDATION` | ✅ Confirmado |
| Crear Scope válido, inactivo | `201` | ✅ Confirmado (`ScopeCreated` en auditoría) |
| Activar el Scope | `200` | ✅ Confirmado (`ScopeActivated` en auditoría) |
| Editar Scope activo con `BaseDn` inválido | `400` — revalida contra AD real | ✅ Confirmado |
| Filtro `Equals` sin `Value` | `400 VALIDATION` | ✅ Confirmado |
| Filtro `Exists` sin `Value` | `201`, `value: null` | ✅ Confirmado (`ScopeFilterCreated`) |
| Filtro `In` duplicado exacto | `400 DUPLICATE_FILTER` | ✅ Confirmado |
| Filtro `In` duplicado con distinto orden/mayúsculas (`"C, A, b"` vs `"A,B,C"`) | `400 DUPLICATE_FILTER` | ✅ Confirmado — normalización de listas funciona |
| Reactivar un filtro equivalente a uno ya inactivo | `201` — un duplicado inactivo no bloquea | ✅ Confirmado (`ScopeFilterUpdated` + `ScopeFilterCreated` subsiguiente) |
| Auditoría de las 7 mutaciones exitosas | Todas registradas en `gov.AuditEntries` con operador/rol/valores correctos | ✅ Confirmado, 7 filas verificadas |
| Auditoría de operaciones rechazadas | Ninguna fila generada | ✅ Confirmado — 0 filas para los rechazos |

**Limpieza posterior al cierre del Incremento 1**: filtros de prueba eliminados,
`test-scope-usuarios` dejado inactivo (confirmado por el usuario antes de
iniciar el Incremento 2).

---

## 2. Incremento 2 — validación funcional de UX (guion acordado, ejecutado por el usuario)

Guion ejecutado por el usuario en su navegador autenticado, usando el
identificador de prueba `ui-test-scope-20260717`, en el orden acordado:
creación como borrador → edición → filtros (Equals/Exists/In) → duplicados y
BaseDN inválido → activación con BaseDN válido → desactivación final.

| # | Escenario | Estado |
|---|---|---|
| 1 | Crear Scope como borrador inactivo | Ejecutado por el usuario |
| 2 | Editar información general | Ejecutado por el usuario |
| 3 | Activar / desactivar | Ejecutado por el usuario |
| 4 | Filtro `Equals` (alta, edición) | Ejecutado por el usuario |
| 4 | Filtro `Exists` — campo Valor se oculta al seleccionarlo | Ejecutado por el usuario |
| 4 | Filtro `In` — ayuda de "valores separados por comas" | Ejecutado por el usuario |
| 5 | Estados vacíos (sin Scope seleccionado, sin filtros, lista vacía) | Ejecutado por el usuario |
| 6 | Mensaje `DUPLICATE_FILTER` | Ejecutado por el usuario |
| 6 | Mensaje de BaseDN inválido | Ejecutado por el usuario |
| 7 | `ScopeKey` de solo lectura en edición (visual + confirmado que el `PUT` no lo envía) | Ejecutado por el usuario |
| 8 | Resoluciones 1366×768 y 1920×1080 sin desbordamiento/recorte/superposición | Ejecutado por el usuario |

**Nota de trazabilidad**: el usuario ejecutó este guion y reportó únicamente
una desviación — la brecha de autorización de lectura documentada en la
sección 3 (ya corregida). Ningún otro punto del guion fue reportado como
fallido; no se solicitaron ajustes adicionales de UX.

---

## 3. Incremento 2 — hallazgo y corrección de seguridad (lectura sin autorización)

### Hallazgo

Los endpoints `GET /administrative-scopes` y `GET /administrative-scopes/{scopeKey}`
solo exigían `[Authorize]` (sesión autenticada), sin el gate `IsSystemAdminAsync`
que sí protegía las mutaciones desde el Incremento 1. Cualquier usuario
autenticado —sin importar su rol— podía leer `BaseDn`, `ConnectionProfile`,
`Filters` y demás estructura interna de AD de todos los Scopes llamando la
API directamente (Swagger, Postman, curl), aunque la UI se lo ocultara.

### Corrección aplicada

`AdministrativeScopesController.GetAll` y `GetByKey` ahora llaman
`IsSystemAdminAsync` **antes** de tocar `scopeService`, devolviendo el mismo
`403 { "error": "Solo el rol SystemAdmin puede administrar ámbitos
administrativos." }` que ya usaban las mutaciones. Sin cambios en modelos,
repositorios, esquema SQL, `AdministrativeScopeService`, endpoints de
mutación, ni autorización de otros módulos — un único archivo modificado
(`AdministrativeScopesController.cs`).

Verificado: `dotnet build` (proyecto Api completo, 0 advertencias/0 errores) y
`npm run build:development` (limpio) tras el cambio.

### Casos de prueba de seguridad — documentados, pendientes de ejecución

Requieren una segunda cuenta autenticada sin rol `SystemAdmin`, no disponible
al momento de este cierre. Se documentan como parte de la validación
funcional del incremento; quedan marcados como pendientes para QA.

| Caso | Cuenta | Petición | Resultado esperado | Estado |
|---|---|---|---|---|
| 1 | `SystemAdmin` | `GET /administrative-scopes` | `200 OK` | Pendiente de ejecución con segunda cuenta |
| 2 | Autenticado, sin `SystemAdmin` | `GET /administrative-scopes` | `403 Forbidden` | Pendiente de ejecución con segunda cuenta |
| 3 | Autenticado, sin `SystemAdmin` | `GET /administrative-scopes/{scopeKeyExistente}` | `403 Forbidden` | Pendiente de ejecución con segunda cuenta |
| 4 | Autenticado, sin `SystemAdmin` | `GET /administrative-scopes/{scopeKeyInexistente}` | `403 Forbidden` | Pendiente de ejecución con segunda cuenta |

**Confirmación explícita — no enumeración de Scopes**: por diseño del código
(`GetByKey` evalúa `IsSystemAdminAsync` como primera instrucción del método,
antes de cualquier llamada a `scopeService.GetByKeyAsync`), los Casos 3 y 4
deben producir **exactamente la misma respuesta** — mismo código `403`, mismo
cuerpo `{ "error": "Solo el rol SystemAdmin puede administrar ámbitos
administrativos." }` — sin importar si `scopeKeyExistente` corresponde a un
Scope real o `scopeKeyInexistente` a uno que no existe. El flujo de ejecución
nunca llega a consultar la base de datos para un caller no autorizado, por lo
que es estructuralmente imposible que la respuesta varíe según la existencia
del Scope. Esto impide que un usuario sin permiso pueda usar el código de
respuesta para enumerar qué `ScopeKey` existen en el sistema.

Al ejecutar estos 4 casos con una segunda cuenta, actualizar la columna
"Estado" de esta tabla con el resultado real observado (código de estado y
cuerpo de respuesta), y confirmar por inspección que los Casos 3 y 4
efectivamente coinciden byte a byte en su respuesta.

---

## Estado del módulo

### Implementado

- **Modelo**: `gov.AdministrativeScopes` / `gov.AdministrativeScopeFilters`, con `BaseDn`, `ConnectionProfile`, `Category`, `Priority` y filtros con operadores `Equals`/`NotEquals`/`In`/`Exists`.
- **CRUD**: alta, edición, activación/inactivación de Scopes; alta, edición, baja de Filters — backend y UI.
- **Auditoría**: las 7 mutaciones (`ScopeCreated`, `ScopeUpdated`, `ScopeActivated`, `ScopeDeactivated`, `ScopeFilterCreated`, `ScopeFilterUpdated`, `ScopeFilterDeleted`) quedan registradas en `gov.AuditEntries`, sin tabla paralela.
- **Validaciones**: `BaseDn` verificado contra AD real antes de activar (`OuExistsAsync`); filtros duplicados activos rechazados (`DUPLICATE_FILTER`) con normalización de atributo/valor, incluida la lista `In`; `ScopeKey` inmutable después de crear.
- **UI**: pantalla "Ámbitos Administrativos" con diseño maestro-detalle (lista + información general + filtros), estados vacíos, mensajes de error mapeados, indicadores de carga y bloqueo de doble envío.
- **Protección de la API**: `GET`, `POST`, `PUT`, `PATCH` y `DELETE` de `AdministrativeScopesController` — lectura y escritura por igual — restringidos a `SystemAdmin`, con 403 uniforme que no distingue si un `ScopeKey` existe o no (ver sección 3).

### Pendiente

- **`RoleScopeAssignment`**: asignación de Scopes a roles (Incremento 3).
- **`RoleScopeFieldPermission`**: permisos de campo por combinación Rol × Scope (incremento posterior a la asignación).
- **Resolución de Scope**: determinar a qué Scope(s) pertenece un usuario dado su `DistinguishedName`/atributos AD — no implementado todavía.
- **Enforcement**: ningún endpoint de búsqueda, lectura o escritura de usuarios valida Scope hoy — los Scopes existen como configuración, sin efecto operativo sobre cuentas de usuario.
- **Pruebas con cuenta no-SystemAdmin**: los Casos 1–4 de la sección 3 quedan documentados pero no ejecutados — requieren una segunda cuenta autenticada sin rol `SystemAdmin`.

---

## Referencias

- Controlador: `backend/src/AccountGovernance.Api/Controllers/AdministrativeScopesController.cs`
- Servicio: `backend/src/AccountGovernance.Application/Services/AdministrativeScopeService.cs`
- UI: `frontend/src/modules/scopes/`
- Esquema: `backend/src/AccountGovernance.Infrastructure/Persistence/schema.sql` (bloques `gov.AdministrativeScopes` / `gov.AdministrativeScopeFilters`)
