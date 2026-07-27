# Motor de Autorización — Plan del Incremento A

> Estado: **Implementado y validado.** Basado en
> `docs/authorization-engine-architecture.md` (Congelada), sección 14,
> Incremento A: "Consolidación sin cambio de comportamiento". No reabre
> ninguna decisión de arquitectura — solo aterriza ese incremento a archivos
> y pasos concretos. Alcance final, decidido tras la verificación de código
> exacto: **solo los 5 gates de Controllers** — los 3 puntos de
> `PermissionService`/`UserService` quedan explícitamente diferidos (ver
> "Puntos diferidos" más abajo), porque no son la misma forma de
> duplicación. Sin commit todavía — pendiente de revisión final.

## Objetivo

Eliminar la duplicación de la resolución de rol primario y del chequeo de
`SystemAdmin`, hoy reimplementada de forma casi idéntica en ocho puntos
distintos del backend, centralizándola en un único método reutilizable —
sin cambiar ningún comportamiento observable (mismas respuestas HTTP, mismo
contenido de respuesta, mismos registros de auditoría, para las mismas
peticiones) y sin adelantar ninguna semántica de incrementos posteriores.

## Alcance

**Incluye:**
- Un único método centralizado, `ISystemAuthorizationService.IsSystemAdminAsync(upn, ct)`,
  que reutiliza internamente el `GetUserRolesAsync` ya existente y verifica
  membresía en la lista completa de roles resueltos —
  `roles.Contains("SystemAdmin", StringComparer.OrdinalIgnoreCase)` —
  **exactamente** como hacían los 5 gates locales. **Corrección respecto de
  la versión anterior de este plan**: la lectura del código exacto (ETAPA 1)
  mostró que los 5 gates **no** usan `ResolvePrimaryRoleAsync` ni el rol
  primario — verifican membresía sobre el conjunto completo de roles
  devuelto por `GetUserRolesAsync`. El método centralizado replica
  exactamente eso, no lo que este documento asumía antes de leer el código.
- Reemplazar las cinco reimplementaciones locales de ese chequeo (detalle
  en "Archivos afectados") por una llamada a ese único método.

## Puntos diferidos (no incluidos en este incremento)

Verificación de código exacto (ETAPA 1) mostró que los 3 puntos de
`PermissionService`/`UserService` originalmente inventariados **no son la
misma forma de duplicación** que los 5 gates de Controllers, y por eso
quedan fuera de este incremento:

| Punto | Forma actual | Por qué difiere de los 5 gates |
|---|---|---|
| `UserService.CanEditFieldAsync(RoleName role, ...)` | `if (role == RoleName.SystemAdmin) return true;` | Comparación pura, sin I/O, sobre un `role` (`RoleName` enum) ya resuelto por el caller (`UsersController.ResolveRoleAsync`, fuera de alcance) — no hay ninguna llamada a `GetUserRolesAsync` que centralizar aquí. |
| `PermissionService.GetFieldsForRoleAsync(RoleName role, ...)` | `if (role == RoleName.SystemAdmin)` | Mismo patrón: comparación pura sobre un parámetro ya resuelto, no una resolución nueva. |
| `PermissionService.GetMatrixAsync()` | `string.Equals(roleKey, SystemAdminRoleKey, ...)` dentro de un bucle sobre **todos** los roles del sistema | Ni siquiera recibe el rol del operador — decide qué fila de la matriz corresponde a `SystemAdmin`, no quién está llamando. Concepto distinto, no una autorización del caller. |

**Motivo técnico del diferimiento**: forzar estos 3 puntos a llamar al
método centralizado asíncrono (basado en UPN) introduciría una consulta a
AD/SQL donde hoy hay una comparación sin costo, y una segunda resolución de
rol independiente de la que ya hizo el controller — un cambio de
rendimiento y un riesgo de divergencia entre ambas resoluciones si el
estado de AD cambia entre una llamada y otra. Eso violaría "cero cambios
observables" y "no mejores ni cambies esos comportamientos", explícitamente
prohibido para este incremento.

**No se eliminó ni se modificó su comportamiento** — los 3 puntos quedan
bit a bit idénticos a como estaban antes de este incremento (confirmado por
diff, ver "Validación final").

**Incremento en el que deben reconsiderarse**: Incremento C de la
arquitectura ("Modo sombra sobre `UpdateAttribute`: combinar resolución de
roles efectivos + evaluador de ámbito + regla de pareja completa"), que es
donde `UserService.CanEditFieldAsync` deja de ser un chequeo aislado y pasa
a integrarse al motor completo; y/o Incremento E (`RoleScopeFieldPermission`),
para los 2 puntos de `PermissionService` que alimentan directamente la UI
de matriz de permisos. La decisión exacta de cuál de los dos absorbe cada
punto se toma cuando esos incrementos se planifiquen en detalle — no aquí.

**No incluye — eliminado explícitamente en esta revisión, sin excepción:**
- Nuevos eventos de auditoría, aunque ya exista un punto donde auditar hoy.
- El motivo `SYSTEM_ADMIN_BYPASS` en ningún registro persistido — ni en
  `gov.AuditEntries` ni en ningún otro lugar. Esa trazabilidad pertenece al
  incremento que introduzca formalmente `AuthorizationDecision` (no este).
  El método centralizado de este incremento devuelve exclusivamente
  `bool` — sin motivo, sin dato adicional.
- Nuevos códigos de respuesta HTTP.
- Cambios en mensajes de error o de éxito.
- Nuevos gates en operaciones hoy sin gate (creación de cuentas,
  `AdController`, búsqueda/lectura de perfil). Eso es Incremento F.
- Cualquier cambio de acceso para cualquier usuario o rol.
- Evaluación del conjunto de roles efectivos — se sigue usando el rol
  primario, igual que hoy. Eso es Incremento C.
- Evaluación de ámbito, en ningún caso. Eso es Incremento B en adelante.
- `AuthorizationDecision` o `RoleEvaluationResult` — no se introduce
  ningún modelo conceptual del motor futuro en este incremento.
- Cambios de esquema (`schema.sql`), de contrato de API, o de frontend.

## Contrato del método centralizado

**Firma final, agregada a `ISystemAuthorizationService`:**

```
Task<bool> IsSystemAdminAsync(string? upn, CancellationToken ct = default)
```

Implementada en `SystemAuthorizationService` como:
```
var roles = await GetUserRolesAsync(upn, ct);
return roles.Contains("SystemAdmin", StringComparer.OrdinalIgnoreCase);
```
— confirmado por lectura de código exacto (ETAPA 1) que reproduce **byte a
byte** la lógica que tenían los 5 gates locales.

- **Entrada**: el UPN del operador, ya resuelto por la autenticación Entra
  (`ICurrentUserService`) — el mismo dato que hoy recibía cada
  `IsSystemAdminAsync` local.
- **Salida**: `bool` — `true` si `"SystemAdmin"` está en el conjunto de
  roles devuelto por `GetUserRolesAsync`. **No** es el rol primario — es
  membresía sobre el conjunto completo, confirmado en el código
  (`SystemRolesController.cs:25-28` y los otros 4 gates, idénticos).
- **Dependencia utilizada**: únicamente `GetUserRolesAsync(upn, ct)` — **no**
  usa `ResolvePrimaryRoleAsync` (corrección respecto de una asunción previa
  de este documento).
- **Comportamiento cuando el usuario no tiene grupos AD que matcheen
  ningún rol**: `GetUserRolesAsync` devuelve `[]`; `[].Contains("SystemAdmin")`
  es `false` — mismo 403 que cualquier no-admin. No hay camino de error
  distinto.
- **Comportamiento ante rol inexistente o inactivo**: `GetActiveRolesForAuthorizationAsync`
  (SQL) ya filtra `IsActive = 1` — un rol inactivo o inexistente simplemente
  no aparece, indistinguible de "usuario sin ese rol".
- **Comportamiento ante error de AD**: confirmado en
  `SystemAuthorizationService.GetUserRolesAsync` (líneas 30-39) — un
  `catch (Exception)` alrededor de `adGateway.GetUserGroupDnsAsync` loguea
  el error y **devuelve `[]`**, sin propagar. El método centralizado hereda
  este comportamiento sin tocarlo (no agrega ni quita manejo de errores).
- **Comportamiento ante error de SQL**: confirmado — `GetActiveRolesForAuthorizationAsync`
  (llamada dentro de `GetUserRolesAsync`) **no tiene try/catch en ningún
  punto de la cadena**; la excepción se propaga sin capturar hasta
  `ExceptionHandlingMiddleware` (middleware global), que responde
  `500 { error: "An unexpected error occurred.", code: "INTERNAL_ERROR" }`.
  Verificado con test de caracterización (`GetAll_RoleResolutionThrows_ExceptionPropagatesUncaught`
  en las 5 suites) — la excepción llega intacta hasta la acción del
  controller, antes y después del refactor.
- **`ResolvePrimaryRoleAsync` con lista vacía**: no aplica a este método
  (no lo usa), pero para cerrar el punto pendiente de la revisión anterior:
  confirmado en código (`SystemAuthorizationService.cs:80-81`) que devuelve
  `null` sin lanzar excepción.
- **`ResolvePrimaryRoleAsync` sin ningún rol activo coincidente**: confirmado
  — `throw new InvalidOperationException(...)` (fail-fast explícito,
  `SystemAuthorizationService.cs:92-98`). No aplica a los 5 puntos de este
  incremento (no usan este método), pero queda documentado para cuando
  `UsersController.ResolveRoleAsync` (fuera de alcance) se reconsidere.

No se introduce ningún modelo conceptual del motor futuro
(`AuthorizationDecision`, `RoleEvaluationResult`, motivos de
concesión/denegación) — el contrato es el mínimo necesario para deduplicar,
nada más.

## Archivos afectados

**5 gates de Controllers — únicos sustituidos en este incremento:**
1. `backend/src/AccountGovernance.Api/Controllers/SystemRolesController.cs`
2. `backend/src/AccountGovernance.Api/Controllers/PermissionsController.cs`
   (solo las acciones de mutación — la lectura sigue abierta, sin tocar)
3. `backend/src/AccountGovernance.Api/Controllers/AdministrativeScopesController.cs`
4. `backend/src/AccountGovernance.Api/Controllers/RoleScopeAssignmentsController.cs`
5. `backend/src/AccountGovernance.Api/Controllers/AccountNamingPolicyController.cs`
   (solo el `PUT` — el `GET` sigue abierto, sin tocar)

Cada uno cambia únicamente el cuerpo del método privado `IsSystemAdminAsync(CancellationToken ct)`
(de dos líneas a una, delegando al método centralizado) — los 5-8 sitios
de llamada `if (!await IsSystemAdminAsync(ct)) ...` dentro de cada
controller quedan intactos, sin tocar.

**3 puntos explícitamente diferidos** (ver sección "Puntos diferidos"):
`PermissionService.GetFieldsForRoleAsync`, `PermissionService.GetMatrixAsync`,
`UserService.CanEditFieldAsync`.

**Ubicación del método centralizado**: agregado a la interfaz
`backend/src/AccountGovernance.Application/Interfaces/ISystemAuthorizationService.cs`
e implementado en
`backend/src/AccountGovernance.Infrastructure/Services/SystemAuthorizationService.cs`
— el componente que ya exponía `GetUserRolesAsync`/`ResolvePrimaryRoleAsync`
y ya estaba inyectado en los 5 controllers.

**Explícitamente NO afectados en este incremento:**
- Los 3 puntos diferidos (arriba).
- `UsersController.cs` — `ResolveRoleAsync` resuelve el rol primario para
  fines distintos (parsear a `RoleName`), no gatea `SystemAdmin`.
- `DistributionListsController.cs` — `HasAccessAsync` compara contra
  arrays de roles (`ReadRoles`/`WriteRoles`), no colapsa a un simple
  chequeo de `SystemAdmin`.
- `AccountCreationController.cs`, `AdController.cs`,
  `AccountTypeConfigController.cs`, `AuditController.cs`,
  `DashboardController.cs` — hoy sin gate; agregarles uno es Incremento F.
- `AdGateway`/`IAdGateway`, `schema.sql`, frontend — sin cambios (confirmado
  por diff, ver "Validación final").
- `DistributionListService.ResolveOperatorRoleAsync` (`backend/src/AccountGovernance.Application/Services/DistributionListService.cs:130-133`)
  — **hallazgo de la búsqueda completa de `GetUserRolesAsync(` posterior al
  refactor, no catalogado en la verificación inicial**. Resuelve el rol
  primario del operador (`GetUserRolesAsync` + `ResolvePrimaryRoleAsync`)
  exclusivamente para registrar **con qué rol** se ejecutó una alta/baja de
  miembro en una lista de distribución (`LogAsync`, propósito de auditoría).
  No es un chequeo de SystemAdmin ni gatea ningún acceso — el gate real de
  ese controller ya ocurrió antes, vía `DistributionListsController.HasAccessAsync`
  (arrays de roles). Código sin tocar. **Aclaración de alcance**: mientras
  este uso conserve su único propósito actual — resolución de rol para
  trazabilidad de auditoría, no para decidir si una operación se permite o
  se deniega — no es una decisión de autorización y por lo tanto **no forma
  parte del backlog del Motor de Autorización**. Si en el futuro este punto
  llegara a usarse también para condicionar un acceso (dejando de ser
  exclusivamente de auditoría), debería reevaluarse como un nuevo punto a
  inventariar en ese momento, no anticiparse aquí.

## Matriz de sustitución

| # | Archivo y acción | Validación actual | Validación centralizada que la reemplaza | Respuesta HTTP actual cuando falla | Respuesta HTTP esperada después | ¿Cambia el acceso? |
|---|---|---|---|---|---|---|
| 1 | `SystemRolesController` — las 6 acciones (GET lista/detalle, PUT, POST/PUT/DELETE de grupos) | `IsSystemAdminAsync` local: rol primario == `"SystemAdmin"` | Llamada al método centralizado, mismo predicado | 403 cuando el rol primario no es `SystemAdmin` (código/mensaje exacto a confirmar contra el código antes de tocar) | 403 idéntico | No — mismo predicado, mismo resultado |
| 2 | `PermissionsController` — acciones de mutación (`CreateAttribute`, `UpdateAttribute` de catálogo, `SetAttributeStatus`, `UpdateRolePermission`); lectura sin tocar | `IsSystemAdminAsync` local | Llamada centralizada | 403 en mutación si el rol primario no es `SystemAdmin` | 403 idéntico | No |
| 3 | `AdministrativeScopesController` — las 8 acciones, incluida lectura | `IsSystemAdminAsync` local | Llamada centralizada | 403 en toda acción si no es `SystemAdmin` | 403 idéntico | No |
| 4 | `RoleScopeAssignmentsController` — las 4 acciones, incluida lectura | `IsSystemAdminAsync` local | Llamada centralizada | 403 en toda acción si no es `SystemAdmin` | 403 idéntico | No |
| 5 | `AccountNamingPolicyController` — solo `PUT`; `GET` sin tocar | `IsSystemAdminAsync` local | Llamada centralizada | 403 en `PUT` si no es `SystemAdmin` | 403 idéntico | No |
| 6 | `PermissionService.GetFieldsForRoleAsync` | Hardcode: `SystemAdmin` ve todos los campos sin consultar `RoleFieldPermissions`; otros roles ven el subconjunto con `CanView=true` | Llamada centralizada decide si aplica el atajo de "todo visible" | No aplica — siempre `200`; el efecto es el contenido del cuerpo, no el código de estado | `200` con el mismo contenido que hoy, para cada rol | No — mismo conjunto de campos visibles por rol |
**Checksum**: 5 filas = 5 controllers, coincide con "Archivos afectados" y
con el objetivo. Los 3 puntos de `PermissionService`/`UserService` **no**
forman parte de esta matriz — quedan en "Puntos diferidos", con su propia
justificación de por qué no son la misma sustitución.

## Cambios previstos

1. Agregar a `ISystemAuthorizationService`/`SystemAuthorizationService` el
   método `IsSystemAdminAsync` descrito en "Contrato del método
   centralizado" — puro `bool`, sin motivo ni dato adicional.
2. En cada uno de los 5 controllers (filas 1-5 de la matriz): cambiar el
   **cuerpo** de la implementación local de `IsSystemAdminAsync` para
   delegar al método centralizado. Los sitios de llamada
   (`if (!await IsSystemAdminAsync(ct)) ...`) no se tocan.
3. `PermissionService` y `UserService` — **sin cambios**, diferidos (ver
   "Puntos diferidos").
4. No se toca `gov.AuditEntries` ni ningún otro mecanismo de auditoría en
   este incremento.

## Pruebas de caracterización — ejecutadas

Proyecto nuevo: `backend/tests/AccountGovernance.Api.Tests` (xUnit + Moq),
agregado a `AccountGovernance.sln`. Dobles de prueba exclusivamente en
memoria (`FakeSystemAuthorizationService`, `FakeCurrentUserService`, mocks
Moq de los 5 servicios de respaldo) — sin AD real, sin SQL Server real, sin
secretos ni configuración de ambiente. Alcance: únicamente el método
centralizado y los 5 gates administrativos, ningún componente fuera de este
incremento.

31 casos, cubriendo por cada uno de los 5 controllers: `SystemAdmin` activo
(acceso permitido, backing service invocado); otro rol activo (403,
backing service nunca invocado); sin ningún rol resuelto (mismo 403 que
"otro rol" — ambos casos son `Contains=false`); rol inexistente (mismo
403); excepción de `GetUserRolesAsync` (propaga sin capturar fuera de la
acción). Para `PermissionsController` y `AccountNamingPolicyController`,
además: el endpoint de lectura permanece abierto (200, sin consultar el
gate) para cualquier rol o ausencia de rol.

**Nota sobre "rol inactivo"**: a nivel de estos tests (que mockean
`ISystemAuthorizationService` completo) un rol inactivo es indistinguible
de un rol ausente de la lista devuelta — ambos producen `Contains=false`.
Esto es correcto: `GetActiveRolesForAuthorizationAsync` filtra
`IsActive=1` en SQL, antes de que el resultado llegue a este nivel; no hay
un camino de error distinguible para caracterizar por separado.

**Resultado — línea base (código actual, antes del refactor)**:
`dotnet test` → **31/31 correctas**.

**Resultado — después del refactor**: misma suite, sin modificar ningún
caso de prueba (`Fact`/`Theory`) → **31/31 correctas**, resultado
idéntico. Única adición inevitable al proyecto de test: el método
`IsSystemAdminAsync` en `FakeSystemAuthorizationService`, requerido porque
la interfaz se amplió — implementado como pura derivación de los mismos
campos (`Roles`, `ThrowOnGetUserRoles`) ya usados por los tests, sin lógica
nueva, así que no altera lo que cada escenario ya caracterizaba.

## Validación final — resultados

- **Build**: `dotnet build AccountGovernance.sln` → `0 Advertencia(s), 0 Errores`,
  antes y después del refactor.
- **Pruebas antes/después**: 31/31 en ambas corridas (detalle arriba).
- **Búsqueda de `IsSystemAdminAsync`**: 5 definiciones privadas (una por
  controller, cada una de una sola línea delegando al método centralizado),
  1 definición en la interfaz, 1 implementación en `SystemAuthorizationService`
  — cero reimplementaciones de la lógica `GetUserRolesAsync`+`Contains`
  fuera del método centralizado.
- **Búsqueda de `GetUserRolesAsync(currentUser.UserPrincipalName`**: 4
  coincidencias restantes, las 4 esperadas y fuera de alcance —
  `AuthController` (resuelve roles para `/auth/me`), `DistributionListsController`
  (su propio chequeo por arrays), `UsersController` (alimenta `ResolveRoleAsync`),
  y `PermissionsController.GetMyFields` (lectura abierta, resuelve el rol
  propio del caller, no es un gate). Ninguna es uno de los 5 puntos
  sustituidos.
- **`PermissionService`/`UserService`**: confirmado por grep — mismas
  líneas, mismo contenido, sin ninguna modificación.
- **`schema.sql`**: `git diff --stat` vacío — sin cambios.
- **`frontend/`**: `git diff --stat` vacío — sin cambios.
- **Endpoints fuera de alcance**: sin cambios — solo los 5 controllers
  listados, más la interfaz y la implementación de `SystemAuthorizationService`.
- **`git diff --stat`**: 8 archivos de `backend/src` modificados (5
  controllers, la interfaz, la implementación, y `AccountGovernance.sln`
  por el nuevo proyecto de test), 88 inserciones / 26 eliminaciones en
  total — la mayoría de las eliminaciones son las líneas colapsadas de
  cada gate local.
- **`git status`**: working tree con los 8 archivos modificados más el
  directorio nuevo `backend/tests/` — sin commit todavía.

## Rollback

- Sin cambios de esquema, de contrato de API ni de frontend — el rollback
  es un revert de commit puro, sin migración inversa ni coordinación de
  datos.
- Si se detecta una regresión de comportamiento, revertir el commit del
  incremento restaura exactamente el comportamiento anterior, porque los 5
  puntos vuelven a su implementación local original.
- No se persiste estado nuevo (no se tocó `schema.sql`, no hay tablas ni
  columnas nuevas, no hay eventos de auditoría nuevos) — el rollback no
  deja residuos de datos que limpiar ni requiere backfill.
