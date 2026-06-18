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
| `GetUserAttributesSkill.ts` | Obtiene atributos de un usuario |
| `UpdateAttributeSkill.ts` | Actualiza un atributo AD (stub) |
| `EnableAccountSkill.ts` | Habilita cuenta AD (stub) |
| `DisableAccountSkill.ts` | Deshabilita cuenta AD (stub) |
| `PermissionValidationSkill.ts` | Valida si el rol tiene permiso sobre un campo |
| `AuditSkill.ts` | Registra entrada de auditoría |

## Agents

| Archivo | Responsabilidad |
|---------|----------------|
| `UserSearchAgent.ts` | Llama API real → fallback mock; mapea `ApiSearchResultDto` → `User` |
| `UserProfileAgent.ts` | Obtiene perfil completo de un usuario |
| `UserStatusAgent.ts` | Gestiona habilitar/deshabilitar cuenta |
| `PermissionAgent.ts` | Valida permisos de campo para el rol activo |
| `AuditAgent.ts` | Registra y recupera entradas de auditoría |

## UserSearchAgent — flujo detallado

1. Intenta `GET {API_BASE}/api/users/search?q=` con timeout 5 s
2. Si `200 OK` → mapea `ApiSearchResultDto[]` → `User[]`
3. Si `400` → retorna `{ success: false, errorCode: err.code }` (ej. `TOO_MANY_RESULTS`)
4. Si red falla / timeout → llama `SearchUserSkill.searchUser(query)` (mock)
5. Retorna `UserSearchAgentResult` con campo opcional `fromMock: true`
