# Frontend — Agents y Skills

## Patrón

- **Skill** = operación atómica sobre datos (una sola responsabilidad, retorna datos crudos)
- **Agent** = orquestador de skills con lógica de negocio; retorna `AgentResult<T>`

```typescript
interface AgentResult<T> { success: boolean; data?: T; error?: string; }
```

## Skills

| Archivo | Responsabilidad |
|---------|----------------|
| `SearchUserSkill.ts` | Filtra `MOCK_USERS` por query (fallback sin API) |
| `GetUserAttributesSkill.ts` | Obtiene atributos de un usuario (mock) |
| `UpdateAttributeSkill.ts` | Actualiza un atributo sobre `MOCK_USERS` — activo solo bajo `VITE_USE_MOCK_DATA=true`; el flujo real pasa por `usersApi.updateUserAttribute()` (`PATCH /api/users/{sam}/attributes/{attr}`), no por este skill |
| `EnableAccountSkill.ts` | Habilita cuenta sobre `MOCK_USERS` — mismo alcance que `UpdateAttributeSkill`; el flujo real usa `usersApi.updateAccountStatus()` |
| `DisableAccountSkill.ts` | Deshabilita cuenta sobre `MOCK_USERS` — ídem |
| `PermissionValidationSkill.ts` | Dos familias de funciones: legacy (`canAccess`/`getAllowedFields`, contra `roles.config.ts`, solo usadas por el modo mock) y dinámicas (`getViewableFields`/`getEditableFields`/etc., contra `FieldConfig[]` real de `gov.RoleFieldPermissions`) |
| `AuditSkill.ts` | Registra entrada de auditoría |

> **Nota de arquitectura (2026-07-16):** `UpdateAttributeSkill`/`EnableAccountSkill`/`DisableAccountSkill`
> ya no son el camino real de escritura — quedaron confinados al modo
> `VITE_USE_MOCK_DATA=true` (ver `UserProfileAgent.updateField` y
> `UserStatusAgent.enable/disable`). Bajo `VITE_USE_MOCK_DATA=false` toda
> escritura de usuario pasa por `api/usersApi.ts` → `PATCH /api/users/...` real.

## Cliente API — `api/usersApi.ts`

| Función | Endpoint |
|---------|----------|
| `updateUserAttribute(sam, adAttributeName, value, previousValue)` | `PATCH /api/users/{sam}/attributes/{adAttributeName}` |
| `updateAccountStatus(sam, enabled)` | `PATCH /api/users/{sam}/status` |

Sin fallback a mock: bajo `VITE_USE_MOCK_DATA=false`, cualquier error de red/API
se relanza tal cual (vía `apiFetch`) y llega como error real al caller.

## Agents

| Archivo | Responsabilidad |
|---------|----------------|
| `UserSearchAgent.ts` | Llama API real → fallback mock; mapea `ApiSearchResultDto` → `User` |
| `UserProfileAgent.ts` | Obtiene perfil completo (`getProfile`, siempre API real) y escribe atributos (`updateField` — API real vía `usersApi`, o mock bajo `VITE_USE_MOCK_DATA=true`) |
| `UserStatusAgent.ts` | Habilita/deshabilita cuenta — API real vía `usersApi`, o mock bajo `VITE_USE_MOCK_DATA=true` |
| `PermissionAgent.ts` | Sin consumidores en el frontend — candidato a eliminación en una fase futura de limpieza, no removido todavía |
| `AuditAgent.ts` | Sin consumidores reales (`AuditPage` consume `api/auditApi.ts` directo) — mismo caso que `PermissionAgent.ts` |

## UserSearchAgent — flujo detallado

1. Intenta `GET {API_BASE}/api/users/search?q=` con timeout 5 s
2. Si `200 OK` → mapea `ApiSearchResultDto[]` → `User[]`
3. Si `400` → retorna `{ success: false, errorCode: err.code }` (ej. `TOO_MANY_RESULTS`)
4. Si red falla / timeout → llama `SearchUserSkill.searchUser(query)` (mock)
5. Retorna `UserSearchAgentResult` con campo opcional `fromMock: true`
