# Backend — Endpoints API

Base URL (desarrollo): `http://localhost:5000`

## Usuarios

### `GET /api/users/search`

Busca usuarios por identificadores institucionales.

**Query params:** `q` (string, mínimo 3 caracteres)

**Búsqueda en AD por:** CustomBannerID · mail · userPrincipalName · sAMAccountName  
**Lógica adicional:** si `q` no tiene `@`, genera variantes `@usfq.edu.ec` y `@estud.usfq.edu.ec`; si `q ≥ 4 chars` agrega prefijo `sAMAccountName=q*`

**Respuestas:**
| Código | Body |
|--------|------|
| 200 | `UserSearchResultDto[]` |
| 400 | `{ error, code: "QUERY_TOO_SHORT" \| "TOO_MANY_RESULTS" }` |

```json
// UserSearchResultDto
{
  "samAccountName": "jdoe",
  "displayName": "John Doe",
  "email": "jdoe@usfq.edu.ec",
  "department": "Tecnología",
  "isEnabled": true,
  "customBannerID": "B00123456"
}
```

---

### `GET /api/users/{samAccountName}`

Perfil completo AD de un usuario. Búsqueda exacta por sAMAccountName.

**Atributos LDAP cargados:** 23 (DetailFetchAttributes en AdGateway)

**Respuestas:**
| Código | Body |
|--------|------|
| 200 | `UserDetailDto` |
| 404 | `{ error, code: "USER_NOT_FOUND" }` |

```json
// UserDetailDto (actualizado tras el refactor de atributos dinámicos — commit 0df4718)
// Las propiedades nombradas son solo información estructural (siempre presente,
// no gobernada por el Catálogo AD). Cualquier atributo administrable por el
// Catálogo (Oficina, Teléfono, Email Externo, Estado de Cuenta técnico, y
// cualquier atributo futuro) vive exclusivamente en "attributes", indexado por
// su AdAttributeName real — nunca duplicado como propiedad nombrada.
{
  "samAccountName": "jdoe",
  "customBannerID": "B00123456",
  "displayName": "John Doe",
  "givenName": "John",
  "sn": "Doe",
  "mail": "jdoe@usfq.edu.ec",
  "userPrincipalName": "jdoe@usfq.edu.ec",
  "company": "USFQ",
  "department": "Tecnología",
  "title": "Analista",
  "manager": "CN=Jane Smith,OU=USERS,DC=usfq,DC=edu,DC=ec",
  "mobile": null,
  "extensionAttribute1": null,
  "extensionAttribute2": null,
  "extensionAttribute3": null,
  "isEnabled": true,
  "whenCreated": "2020-03-15T08:00:00Z",
  "whenChanged": "2024-11-01T14:30:00Z",
  "lastLogon": "2026-06-16T09:15:00Z",
  "distinguishedName": "CN=John Doe,OU=USERS,DC=usfq,DC=edu,DC=ec",
  "attributes": {
    "physicalDeliveryOfficeName": "Campus Cumbayá",
    "telephoneNumber": "+593 2 297-1700",
    "Custom-External-Email-Address": "john.doe@gmail.com",
    "userAccountControl": "512"
  }
}
```

---

### `PATCH /api/users/{samAccountName}/attributes/{adAttributeName}`

Actualiza un único atributo AD de un usuario existente, vía LDAP `ModifyRequest`
(Replace, o Delete si `value` es `null`/vacío). Requiere `CanEdit=true` para ese
`FieldKey` en `gov.RoleFieldPermissions` con el rol efectivo del operador
(resuelto server-side desde la sesión, nunca del body). `userAccountControl` y
otros atributos protegidos están bloqueados — usar `PATCH .../status` para
estado de cuenta.

**Body:**
```json
{ "value": "nuevo valor" /* o null para limpiar */, "previousValue": "valor anterior" }
```

**Respuestas:**
| Código | code | Descripción |
|--------|------|-------------|
| 200 | — | `UpdateUserAttributeResultDto { adAttributeName, oldValue, newValue, changed }` |
| 400 | `PROTECTED_ATTRIBUTE` \| `INVALID_VALUE` | Atributo protegido o valor no cumple el `DataType` del Catálogo |
| 403 | `FORBIDDEN` | El rol efectivo no tiene `CanEdit` sobre ese atributo |
| 404 | `ATTRIBUTE_NOT_FOUND` \| `USER_NOT_FOUND` | Atributo inactivo/inexistente en el Catálogo, o usuario inexistente en AD |
| 409 | `STALE_VALUE` | `previousValue` no coincide con el valor real actual en AD (concurrencia) |
| 502 | `LDAP_WRITE_FAILED` | Falla la escritura LDAP (detalle técnico solo en logs del backend) |

---

### `PATCH /api/users/{samAccountName}/status`

Habilita o deshabilita una cuenta AD. Hace un toggle seguro del bit
`ACCOUNTDISABLE` (valor 2) de `userAccountControl` — lee el entero actual y
solo cambia ese bit, preservando el resto de flags existentes. El permiso se
resuelve contra la misma fila del Catálogo que gobierna "Estado de Cuenta"
(`AdAttributeName=userAccountControl`), sin regla paralela.

**Body:** `{ "enabled": true }`

**Respuestas:**
| Código | code | Descripción |
|--------|------|-------------|
| 200 | — | `UpdateAccountStatusResultDto { enabled, changed }` — estado confirmado tras re-consultar AD |
| 403 | `FORBIDDEN` | Sin permiso de edición sobre Estado de Cuenta |
| 404 | `USER_NOT_FOUND` | Usuario inexistente en AD |
| 502 | `LDAP_WRITE_FAILED` | Falla la escritura LDAP |

---

## Permisos

### `GET /api/permissions/fields/me`
Retorna los campos y permisos del usuario autenticado.

### `GET /api/permissions/matrix`
Retorna la matriz completa roles × campos.

---

## Auditoría

### `GET /api/audit`
Retorna entradas de auditoría con filtros opcionales.

---

## Dashboard

### `GET /api/dashboard/summary`
Retorna métricas de actividad (usuarios gestionados, cambios recientes, etc.).

---

## Política de nombres de cuenta

Única para todo el sistema de creación de cuentas: todos los tipos actuales
(Genéricas, Partner, Servicio, Extensión, Privilegiadas) y cualquier tipo
futuro que utilice el flujo centralizado de `AccountCreationService`.
Reemplaza la limpieza silenciosa de caracteres que existía antes
(`AccountCreationService.Ascii()` / `accountTypes.ts::normalizeToAscii()`,
ambas eliminadas): un nombre que no cumple la política se **rechaza con un
mensaje claro**, nunca se modifica sin avisar. Ver `docs/account-naming-policy.md`
para el detalle completo del algoritmo de validación y los casos de prueba.

**Sin pantalla administrativa todavía**: la política se edita hoy únicamente
vía `PUT /api/account-naming-policy` desde Swagger/Postman con una cuenta
`SystemAdmin` — no existe una sección en el portal para esto. Ver
`docs/account-naming-policy.md` § "Administración de la política".

### `GET /api/account-naming-policy`
Devuelve la política vigente. Cualquier usuario autenticado puede leerla — la
necesita el formulario de creación de cuentas para validar en vivo.

```json
{
  "allowedChars": "abcdefghijklmnopqrstuvwxyz0123456789-._",
  "minLength": 3,
  "maxLength": 20,
  "disallowLeadingTrailingSpecialChars": true,
  "disallowConsecutiveSpecialChars": true,
  "updatedAt": "2026-07-20T00:00:00Z",
  "updatedBy": null
}
```

### `PUT /api/account-naming-policy`
Edita la política. **SystemAdmin únicamente** (403 para cualquier otro rol).
Toda actualización exitosa se audita en `gov.AuditEntries`
(`ActionType=NamingPolicyUpdated`) con el valor anterior y el nuevo.

**Body:** mismo shape que la respuesta de `GET`, sin `updatedAt`/`updatedBy`.

**Validaciones (400 si fallan):** `AllowedChars` no vacío, sin mayúsculas, sin
espacios, sin caracteres de control, subconjunto del superconjunto seguro
(`abcdefghijklmnopqrstuvwxyz0123456789-._`), sin caracteres duplicados, con al
menos un carácter alfanumérico; `MinLength ≥ 1`; `MaxLength ≥ MinLength`;
`MaxLength ≤ 20` (límite real de `sAMAccountName` en Active Directory).
