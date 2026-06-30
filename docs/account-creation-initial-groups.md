# Módulo de Grupos Iniciales — Account Creation

## Resumen

El módulo de **Grupos Iniciales** permite configurar grupos de Active Directory que se asignan automáticamente al momento de crear una cuenta. Los grupos pueden estar definidos a nivel de tipo de cuenta (aplica a todos) o a nivel de sub-tipo (sólo para esa área, e.g. Operaciones dentro de Privilegiada).

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend                                                       │
│  ┌─────────────────────┐   ┌──────────────────────────────┐    │
│  │  InitialGroupsPage  │   │  AccountPreview              │    │
│  │  (configuración)    │   │  "Grupos iniciales" section  │    │
│  └────────┬────────────┘   └──────────────┬───────────────┘    │
│           │                               │                     │
│           ▼                               ▼                     │
│  initialGroupsApi.ts              accountCreationApi.ts         │
└───────────┬───────────────────────────────┬─────────────────────┘
            │                               │
            ▼                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend API                                                    │
│  ┌──────────────────────────┐  ┌──────────────────────────┐    │
│  │  AccountTypeConfigCtrl   │  │  AdController            │    │
│  │  CRUD /groups endpoints  │  │  POST /ad/groups/validate│    │
│  └───────────┬──────────────┘  └──────────────────────────┘    │
│              │                                                   │
│              ▼                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  AccountTypeGroupService  ◄──  IAdGateway.GetGroupAsync  │   │
│  └───────────┬──────────────────────────────────────────────┘   │
│              │                                                   │
│              ▼                                                   │
│  ┌──────────────────────────┐                                   │
│  │  AccountTypeGroupRepo    │──► gov.AccountTypeInitialGroups   │
│  └──────────────────────────┘                                   │
└─────────────────────────────────────────────────────────────────┘

Flujo creación de cuenta:
  AccountCreationService.CreateAsync
    ├── CreateUserAsync (AD)
    └── Para cada grupo activo:
          AddUserToGroupAsync
          ├── Crítico + falla → DeleteUserAsync + return error
          └── No crítico + falla → warning, continúa
```

---

## Base de datos

### Tabla: `gov.AccountTypeInitialGroups`

| Columna           | Tipo           | Descripción                                           |
|-------------------|----------------|-------------------------------------------------------|
| `Id`              | INT IDENTITY   | PK                                                    |
| `AccountTypeId`   | INT NOT NULL   | FK → `gov.AccountTypes.Id`                            |
| `AccountSubTypeId`| INT NULL       | FK → `gov.AccountSubTypes.Id`. NULL = aplica a todos  |
| `GroupName`       | NVARCHAR(256)  | Nombre amigable del grupo                             |
| `GroupDn`         | NVARCHAR(512)  | DN completo en AD                                     |
| `GroupObjectGuid` | NVARCHAR(64)   | GUID del objeto AD (opcional, mejora resolución)      |
| `GroupSid`        | NVARCHAR(256)  | SID del grupo (opcional, referencia)                  |
| `IsCritical`      | BIT DEFAULT 1  | Si falla el alta → revertir creación de cuenta        |
| `IsActive`        | BIT DEFAULT 1  | Sólo los activos se procesan en la creación           |
| `SortOrder`       | INT DEFAULT 0  | Orden de asignación                                   |
| `CreatedAt`       | DATETIME2      | Timestamp UTC de creación                             |
| `UpdatedAt`       | DATETIME2      | Timestamp UTC de última actualización                 |
| `UpdatedBy`       | NVARCHAR(200)  | Windows identity del operador                         |

### Reglas de alcance

- `AccountSubTypeId IS NULL` → el grupo aplica a **todos los sub-tipos** de ese tipo.
- `AccountSubTypeId IS NOT NULL` → el grupo aplica **sólo** a ese sub-tipo.

---

## API Endpoints

### Configuración de grupos

| Método   | Ruta                                                     | Descripción                                  |
|----------|----------------------------------------------------------|----------------------------------------------|
| `GET`    | `/api/account-type-configs/{typeKey}/groups`             | Grupos tipo-nivel (sin sub-tipo)             |
| `POST`   | `/api/account-type-configs/{typeKey}/groups`             | Crear grupo tipo-nivel                        |
| `GET`    | `/api/account-type-configs/{typeKey}/subtypes/{key}/groups` | Grupos específicos de un sub-tipo          |
| `POST`   | `/api/account-type-configs/{typeKey}/subtypes/{key}/groups` | Crear grupo para un sub-tipo              |
| `PUT`    | `/api/account-type-configs/groups/{id}`                  | Actualizar grupo existente                   |
| `DELETE` | `/api/account-type-configs/groups/{id}`                  | Eliminar grupo                               |

### Validación AD

| Método | Ruta                    | Body                    | Descripción                         |
|--------|-------------------------|-------------------------|-------------------------------------|
| `POST` | `/api/ad/groups/validate` | `{ "query": "DN o CN" }` | Busca el grupo en AD, retorna GUID/SID |

#### Ejemplo respuesta validación:
```json
{
  "isValid": true,
  "groupName": "GRP-ServiceAccounts",
  "dn": "CN=GRP-ServiceAccounts,OU=Grupos,DC=usfq,DC=edu,DC=ec",
  "objectGuid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "sid": "S-1-5-21-...",
  "isSecurity": true,
  "error": null
}
```

---

## Flujo de creación de cuenta con grupos

### `POST /api/accounts/validate-create`

Incluye en la respuesta `preview.initialGroups[]`:
```json
{
  "id": 1,
  "groupName": "GRP-ServiceAccounts",
  "groupDn": "CN=GRP-ServiceAccounts,...",
  "isCritical": true,
  "existsInAd": true
}
```

Si un grupo no existe en AD: se agrega un `warning` (no bloquea `canCreate`).

### `POST /api/accounts/create`

Después de crear el usuario en AD:
1. Obtiene todos los grupos activos para el tipo/sub-tipo.
2. Para cada grupo: `AddUserToGroupAsync(userDn, groupDn)`.
3. Si un grupo **crítico falla**: elimina el usuario (rollback) y retorna error.
4. Si un grupo **no crítico falla**: continúa, registra el error en `groupAssignments`.
5. Retorna `groupAssignments[]` con el resultado de cada grupo.

```json
{
  "success": true,
  "message": "Cuenta creada correctamente.",
  "samAccountName": "jperez",
  "userPrincipalName": "jperez@usfq.edu.ec",
  "groupAssignments": [
    { "groupName": "GRP-ServiceAccounts", "success": true, "error": null },
    { "groupName": "GRP-Optional-Notify", "success": false, "error": "..." }
  ]
}
```

---

## Seguridad

- **Passwords NUNCA** se loguean, almacenan en auditoría, ni se incluyen en DTOs de grupos.
- Los logs de asignación de grupos incluyen: operador, SAM, DN del usuario, nombre del grupo, resultado.
- La auditoría principal en `gov.AccountCreationAudit` registra el operador y el éxito/fallo de la cuenta.

---

## Pendiente — Fase 2

- Tabla `gov.AccountCreationGroupAudit` para auditoría granular por grupo en base de datos.
- Resolución por `objectGUID` cuando el grupo ha sido movido (DN cambiado).
- Reordenamiento drag-and-drop en la UI de configuración.
- Pruebas de integración con AD real (task: AG-XXX).
