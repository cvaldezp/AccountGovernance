# Política de nombres de cuenta — diseño, algoritmo y evidencia de pruebas

## Estado del incremento

**Incremento 2.1 — aprobado y cerrado.** Código, builds (`dotnet build` de las
4 capas y `npm run build:development`) y comparación objetiva de ESLint contra
el commit base (`4a2f107` → sin errores nuevos) verificados y aprobados.

**Pendiente — verificación operacional en Development, no deuda de código**:
la validación real contra SQL Server y la API en ejecución (existencia física
del singleton, imposibilidad de insertar un segundo `Id`, idempotencia del
seed, `GET`/`PUT` reales con una cuenta `SystemAdmin`, entrada real en
`gov.AuditEntries`) no se pudo ejecutar desde este entorno — sin credenciales
SQL funcionales ni forma de obtener un token Bearer real (limitaciones de
infraestructura de este entorno de trabajo, no del incremento). El
procedimiento reproducible completo queda documentado en la sección
"Validación operacional pendiente" más abajo, para que el propietario del
ambiente lo ejecute en Development cuando corresponda.

---

Incremento 2.1. Reemplaza la limpieza silenciosa de caracteres que existía en
`AccountCreationService.Ascii()` (backend) y `accountTypes.ts::normalizeToAscii()`
(frontend) — ambas eliminadas — por una política **única para todo el sistema
de creación de cuentas**: todos los tipos actuales (Genéricas, Partner,
Servicio, Extensión, Privilegiadas) y cualquier tipo futuro que utilice el
flujo centralizado de `AccountCreationService` (confirmado por auditoría: es
el único punto del backend que llama a `IAdGateway.CreateUserAsync` — un tipo
de cuenta que se implementara fuera de ese flujo no heredaría esta política
automáticamente). Configurable sin tocar código y sin modificar nunca en
silencio el valor ingresado por el técnico.

## Regla de negocio

- Si el nombre cumple la política, se usa **exactamente igual** en
  `sAMAccountName`, `UserPrincipalName` y `mail`.
- Si no cumple, se **rechaza** con un mensaje claro.
- Única normalización permitida: trim de espacios exteriores + minúsculas
  culturalmente estables (`ToLowerInvariant`/`.toLowerCase()` sin locale).
  Nunca se elimina, translitera ni sustituye ningún carácter.

## Administración de la política — sin pantalla todavía

**Este incremento NO incluye una pantalla administrativa.** El backend expone
`GET/PUT /api/account-naming-policy` (§ más abajo), pero no existe ninguna
sección nueva en el portal para editarla visualmente — a diferencia de, por
ejemplo, el Catálogo de Atributos o los Ámbitos Administrativos, que sí tienen
UI propia. Hoy, la única forma de cambiar la política es:

1. Autenticarse como `SystemAdmin`.
2. Abrir Swagger (`/swagger`) o Postman.
3. Ejecutar `PUT /api/account-naming-policy` con el body deseado (ver ejemplo
   en `docs/backend/endpoints.md`).

No se debe describir esta política como "administrable desde el portal" en
ninguna otra parte de la documentación mientras esto siga así.

**Propuesta, sin implementar sin autorización explícita**: incorporar una
pantalla dedicada (mismo patrón que `AttributeCatalogPage.tsx`/
`AdministrativeScopesPage.tsx` — formulario simple sobre el `PUT` ya
existente) como **Incremento 2.1.1**, inmediatamente después de cerrar este
incremento, en vez de posponerlo a una fase posterior no planificada. Motivo
de la recomendación: el backend ya está completo y probado (este mismo
incremento), así que la UI sería un cambio acotado y de bajo riesgo (sin
tocar el motor de validación); dejarlo pendiente indefinidamente aumenta la
probabilidad de que, en la práctica, la política nunca se edite pese a estar
diseñada para eso. Queda a tu decisión confirmar 2.1.1 o reprogramarlo.

## Dónde vive

`gov.AccountNamingPolicy` — tabla singleton **físicamente garantizada**
(`CHECK (Id = 1)` + `PRIMARY KEY (Id)`, no por convención de "usar la primera
fila"). Repositorio sin caché (mismo patrón que `IExpirationConfigRepository`
— configuración de baja frecuencia de lectura). Toda edición es un
`UPDATE ... WHERE Id = 1` puro, sin `IF EXISTS`/`INSERT`, porque la fila
siempre existe desde que se aplicó `schema.sql`.

## Algoritmo de validación (idéntico en backend y frontend, sin regex)

1. `normalized = raw.Trim().ToLowerInvariant()` (o `.toLowerCase()` en TS)
2. `MinLength ≤ normalized.Length ≤ MaxLength`
3. Cada carácter de `normalized` debe pertenecer a `AllowedChars` (enumeración
   literal, comprobación por pertenencia a un conjunto — nunca un patrón)
4. Si `DisallowLeadingTrailingSpecialChars`: primer y último carácter deben
   ser alfanuméricos
5. Si `DisallowConsecutiveSpecialChars`: ningún par de caracteres adyacentes
   puede ser ambos no-alfanuméricos
6. `(SamPrefix?.Length ?? 0) + normalized.Length ≤ 20` — límite real de
   `sAMAccountName` en Active Directory, siempre se aplica, sin importar
   `MaxLength`

`AccountNamingPolicyService.ValidateAccountNameAsync` (backend) y
`normalizeAndValidateAccountName` (frontend, `shared/account-naming/`) son las
dos únicas implementaciones — la segunda replica la primera para dar feedback
en vivo, pero el backend sigue siendo la autoridad definitiva; el frontend
nunca decide por sí solo si un nombre es válido para la creación real.

## Validación de la propia configuración (PUT, SystemAdmin)

Rechaza: `AllowedChars` vacío, con mayúsculas, con espacios, con caracteres de
control, fuera del superconjunto seguro (`abcdefghijklmnopqrstuvwxyz0123456789-._`),
con caracteres duplicados, o sin ningún carácter alfanumérico; `MinLength < 1`;
`MaxLength < MinLength`; `MaxLength > 20`.

La regla "no debe existir una configuración que haga imposible producir un
nombre válido" se resuelve matemáticamente exigiendo al menos un carácter
alfanumérico en `AllowedChars`: si existe al menos uno y `1 ≤ MinLength ≤
MaxLength ≤ 20`, siempre es posible construir un nombre válido repitiendo ese
carácter (nunca genera extremos ni consecutivos especiales) — no hace falta un
chequeo combinatorio adicional.

## Evidencia de pruebas — ejecutada contra el código real

**Backend**: harness temporal (`dotnet run`, referenciando el proyecto
`AccountGovernance.Application` real, con un repositorio y auditoría falsos en
memoria) que invoca directamente `AccountNamingPolicyService.ValidateAccountNameAsync`
y `.UpdateAsync`. No commiteado — se eliminó tras confirmar los resultados.

**Frontend**: Node 24 con `--experimental-strip-types`, importando y
ejecutando directamente el archivo real `shared/account-naming/normalizeAndValidateAccountName.ts`
— no una reimplementación ni una copia.

### Casos de nombre de cuenta (16/16 backend, 16/16 frontend)

| # | Caso | `raw` | Prefijo | Esperado | Backend | Frontend |
|---|---|---|---|---|---|---|
| 1 | `sales-force` | `sales-force` | — | válido | ✅ | ✅ |
| 2 | `sales_force` | `sales_force` | — | válido | ✅ | ✅ |
| 3 | `sales.force` | `sales.force` | — | válido | ✅ | ✅ |
| 4 | `Sales-Force` (mayúsculas) | `Sales-Force` | — | válido → `sales-force` | ✅ | ✅ |
| 5 | Espacios exteriores | `"  sales-force  "` | — | válido → `sales-force` | ✅ | ✅ |
| 6 | `sales--force` | `sales--force` | — | rechazado (consecutivos) | ✅ | ✅ |
| 7 | `sales.-force` | `sales.-force` | — | rechazado (consecutivos) | ✅ | ✅ |
| 8 | `-sales` | `-sales` | — | rechazado (extremo) | ✅ | ✅ |
| 9 | `sales_` | `sales_` | — | rechazado (extremo) | ✅ | ✅ |
| 10 | `josé` | `josé` | — | rechazado (carácter fuera de conjunto, sin transliterar) | ✅ | ✅ |
| 11 | `sales force` | `sales force` | — | rechazado (espacio interno) | ✅ | ✅ |
| 12 | `sales@force` | `sales@force` | — | rechazado (`@` fuera de conjunto) | ✅ | ✅ |
| 13 | Longitud exacta permitida | 20 caracteres | — | válido | ✅ | ✅ |
| 14 | Longitud excedida | 21 caracteres | — | rechazado | ✅ | ✅ |
| 15 | Longitud excedida solo al agregar `SamPrefix` | 18 caracteres | `cyber` (5) → 23 > 20 | rechazado | ✅ | ✅ |
| 16 | Longitud OK con prefijo corto | 15 caracteres | `sys` (3) → 18 ≤ 20 | válido | ✅ | ✅ |

### Casos de configuración inválida en `PUT` (9/9 backend)

| # | Caso | Esperado | Resultado |
|---|---|---|---|
| 17 | `AllowedChars` vacío | rechazado | ✅ |
| 18 | `AllowedChars` con mayúsculas | rechazado | ✅ |
| 19 | `AllowedChars` con espacio | rechazado | ✅ |
| 20 | `AllowedChars` con acento | rechazado | ✅ |
| 21 | `AllowedChars` duplicado | rechazado | ✅ |
| 22 | `AllowedChars` sin alfanumérico | rechazado | ✅ |
| 23 | `MinLength < 1` | rechazado | ✅ |
| 24 | `MaxLength < MinLength` | rechazado | ✅ |
| 25 | `MaxLength > 20` | rechazado | ✅ |
| — | Configuración válida (control positivo) | **aceptado** | ✅ (confirma que no hay sobre-rechazo) |

### Casos que requieren infraestructura viva — verificados por lectura de código, no ejecutados

| Caso pedido | Verificación |
|---|---|
| Conflicto de cuenta existente en AD | `RunAdValidationsAsync`/`SamAccountNameExistsAsync` en `AccountCreationService.ValidateCreateAsync` — lógica preexistente, no modificada por este incremento; confirmado que sigue ejecutándose después de que el nombre pasa la política (mismo guard `errors.All(...)` ya existente, mis mensajes de rechazo no calzan con los prefijos que lo desactivan, así que un nombre inválido sigue evitando el round-trip a AD, como ya ocurría antes) |
| Usuario no-`SystemAdmin` editando la política | `AccountNamingPolicyController.IsSystemAdminAsync` — mismo patrón exacto ya usado y verificado en `AdministrativeScopesController`/`PermissionsController` en este mismo proyecto |

## Validación operacional pendiente — a ejecutar en Development

No es deuda técnica del incremento: el código y los builds ya están
verificados (ver "Estado del incremento" al inicio). Esto es la verificación
del *ambiente* — SQL Server real y la API en ejecución — que el propietario
del ambiente debe correr antes de dar por buena la aplicación de `schema.sql`
en Development.

### SQL

```sql
-- 1. Aplicar el bloque gov.AccountNamingPolicy de schema.sql en Development.

-- 2. Existe y hay exactamente una fila:
SELECT COUNT(*) AS RowCount FROM gov.AccountNamingPolicy;   -- esperado: 1

-- 3. La fila tiene Id=1:
SELECT Id FROM gov.AccountNamingPolicy;                      -- esperado: 1

-- 4. No es posible insertar una fila con otro Id (debe fallar por el CHECK):
INSERT INTO gov.AccountNamingPolicy (Id, AllowedChars, MinLength, MaxLength)
VALUES (2, 'abc', 1, 5);
-- esperado: error de SQL Server por violar CK_Gov_AccountNamingPolicy_Singleton

-- 5. Re-ejecutar el bloque completo del script (idempotencia):
SELECT COUNT(*) AS RowCount FROM gov.AccountNamingPolicy;   -- esperado: sigue siendo 1
```

### API (Swagger, con una cuenta `SystemAdmin` real)

1. `GET /account-naming-policy` → `200`, con la fila sembrada.
2. `PUT /account-naming-policy` con un cambio (ej. `maxLength: 18`) → `200`.
3. Repetir el `GET` → confirmar que el cambio persiste.
4. `SELECT TOP 5 * FROM gov.AuditEntries WHERE ActionType='NamingPolicyUpdated' ORDER BY Timestamp DESC` → una fila nueva, `OldValue`/`NewValue` legibles y sin datos sensibles, `PerformedBy` = UPN real del operador.
5. **Volver a hacer `PUT` con los valores originales** (`allowedChars: "abcdefghijklmnopqrstuvwxyz0123456789-._"`, `minLength: 3`, `maxLength: 20`, ambos booleanos `true`) — no dejar la política en el valor de prueba.
6. Con una cuenta autenticada sin `SystemAdmin`: `PUT` → `403`.
7. En Creación de Cuentas: confirmar que el hint del campo "Cuenta" refleja la política real.

## Referencias

- Backend: `Application/Services/AccountNamingPolicyService.cs`,
  `Api/Controllers/AccountNamingPolicyController.cs`,
  `Infrastructure/Persistence/Repositories/AccountNamingPolicyRepository.cs`
- Frontend: `frontend/src/shared/account-naming/`
- Esquema: `backend/src/AccountGovernance.Infrastructure/Persistence/schema.sql`
  (bloque `gov.AccountNamingPolicy`)
