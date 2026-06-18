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
// UserDetailDto (campos principales)
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
  "physicalDeliveryOfficeName": "Campus Cumbayá",
  "telephoneNumber": "+593 2 297-1700",
  "mobile": null,
  "externalEmail": "john.doe@gmail.com",
  "extensionAttribute1": null,
  "extensionAttribute2": null,
  "extensionAttribute3": null,
  "userAccountControl": 512,
  "isEnabled": true,
  "whenCreated": "2020-03-15T08:00:00Z",
  "whenChanged": "2024-11-01T14:30:00Z",
  "lastLogon": "2026-06-16T09:15:00Z",
  "distinguishedName": "CN=John Doe,OU=USERS,DC=usfq,DC=edu,DC=ec"
}
```

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
