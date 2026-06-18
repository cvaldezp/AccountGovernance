# Backend — Base de Datos

**Motor:** SQL Server  
**Base de datos:** `USFQ_AccountManager`  
**Schema:** `gov`  
**Autenticación:** Windows Authentication exclusiva (`Trusted_Connection=True;TrustServerCertificate=True`)

## Tablas

### `gov.FieldDefinitions`

Catálogo de atributos AD configurables. No hardcoded — se gestiona desde la base.

```sql
Id                INT IDENTITY PRIMARY KEY
FieldKey          NVARCHAR(100) NOT NULL UNIQUE
AdAttributeName   NVARCHAR(200) NOT NULL
DisplayName       NVARCHAR(200) NOT NULL
Description       NVARCHAR(500) NULL
FieldType         NVARCHAR(50) NOT NULL   -- 'text' | 'email' | 'select' | 'textarea'
IsSensitive       BIT NOT NULL DEFAULT 0
IsActive          BIT NOT NULL DEFAULT 1
SortOrder         INT NOT NULL DEFAULT 0
AllowedValues     NVARCHAR(MAX) NULL      -- JSON array para 'select'
CreatedAt         DATETIME2 NOT NULL DEFAULT GETUTCDATE()
UpdatedAt         DATETIME2 NOT NULL DEFAULT GETUTCDATE()
```

### `gov.RoleFieldPermissions`

Matriz roles × campos. Controla qué rol puede ver o editar cada atributo.

```sql
Id                INT IDENTITY PRIMARY KEY
RoleName          NVARCHAR(100) NOT NULL
FieldDefinitionId INT NOT NULL REFERENCES gov.FieldDefinitions(Id)
CanView           BIT NOT NULL DEFAULT 0
CanEdit           BIT NOT NULL DEFAULT 0
IsActive          BIT NOT NULL DEFAULT 1
CreatedAt         DATETIME2 NOT NULL DEFAULT GETUTCDATE()

INDEX IX_Gov_RoleField (RoleName, FieldDefinitionId)
```

### `gov.AuditEntries`

Log inmutable de operaciones. No tiene UPDATE ni DELETE.

```sql
Id                      BIGINT IDENTITY PRIMARY KEY
Timestamp               DATETIME2 NOT NULL DEFAULT GETUTCDATE()
OperatorSamAccountName  NVARCHAR(100) NOT NULL
OperatorRole            NVARCHAR(100) NOT NULL
ActionType              NVARCHAR(100) NOT NULL
TargetSamAccountName    NVARCHAR(100) NOT NULL
FieldKey                NVARCHAR(100) NULL
OldValue                NVARCHAR(MAX) NULL
NewValue                NVARCHAR(MAX) NULL
Success                 BIT NOT NULL
ErrorMessage            NVARCHAR(MAX) NULL

INDEX IX_Gov_Audit_Timestamp  (Timestamp DESC)
INDEX IX_Gov_Audit_Operator   (OperatorSamAccountName)
INDEX IX_Gov_Audit_Target     (TargetSamAccountName)
```

## IIS / App Pool

- La identidad del App Pool debe tener `db_datareader + db_datawriter + EXECUTE` en schema `gov`
- `ApplicationPoolIdentity` no puede autenticarse a SQL Server remoto — usar cuenta de servicio de dominio
- Ver documentación completa en `schema.sql`
