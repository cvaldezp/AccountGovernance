-- ── AccountGovernance — SQL Server schema ────────────────────────────────────
-- Database : USFQ_AccountManager
-- Schema   : gov
-- Auth     : Windows Authentication (Trusted_Connection=True)
--            No SQL logins — the connecting identity must have SQL permissions.
--
-- Deployment notes:
--   dotnet run (dev)
--     El usuario de Windows que ejecuta la app debe tener al menos:
--       GRANT SELECT, INSERT, UPDATE ON SCHEMA::gov TO [DOMINIO\usuario]
--
--   IIS (producción)
--     Opción A — App Pool Identity dedicada (recomendado):
--       1. Crear App Pool con nombre "AccountGov" en IIS.
--       2. En SQL Server: CREATE LOGIN [IIS AppPool\AccountGov] FROM WINDOWS;
--          Luego:         CREATE USER  [IIS AppPool\AccountGov] FOR LOGIN [IIS AppPool\AccountGov];
--                         GRANT SELECT, INSERT, UPDATE ON SCHEMA::gov TO [IIS AppPool\AccountGov];
--
--     Opción B — Cuenta de servicio de dominio:
--       1. Crear cuenta de dominio USFQ\svc-accountgov.
--       2. Configurar el App Pool para correr como esa cuenta.
--       3. En SQL Server: CREATE LOGIN [USFQ\svc-accountgov] FROM WINDOWS;
--          Luego:         CREATE USER  [USFQ\svc-accountgov] FOR LOGIN [USFQ\svc-accountgov];
--                         GRANT SELECT, INSERT, UPDATE ON SCHEMA::gov TO [USFQ\svc-accountgov];
--
--     Nota: ApplicationPoolIdentity (IUSR) NO puede autenticarse en SQL Server remoto.
--           Usar siempre una cuenta de dominio cuando SQL Server está en otro servidor.
-- ─────────────────────────────────────────────────────────────────────────────

USE USFQ_AccountManager;
GO

-- ── 1. Schema ─────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'gov')
    EXEC('CREATE SCHEMA gov');
GO

-- ── 2. Tables ─────────────────────────────────────────────────────────────────

IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'FieldDefinitions' AND s.name = 'gov'
)
BEGIN
    CREATE TABLE gov.FieldDefinitions (
        FieldKey        NVARCHAR(100)  NOT NULL PRIMARY KEY,
        AdAttributeName NVARCHAR(256)  NOT NULL,
        DisplayName     NVARCHAR(200)  NOT NULL,
        Description     NVARCHAR(1000) NOT NULL DEFAULT '',
        FieldType       NVARCHAR(50)   NOT NULL,   -- Text | Email | Select | Textarea
        IsSensitive     BIT            NOT NULL DEFAULT 0,
        IsActive        BIT            NOT NULL DEFAULT 1,
        SortOrder       INT            NOT NULL DEFAULT 0,
        AllowedValues   NVARCHAR(1000) NULL,        -- lista separada por coma
        Placeholder     NVARCHAR(200)  NULL,
        CreatedAt       DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt       DATETIME2      NOT NULL DEFAULT GETUTCDATE()
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'RoleFieldPermissions' AND s.name = 'gov'
)
BEGIN
    CREATE TABLE gov.RoleFieldPermissions (
        Id       INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
        RoleName NVARCHAR(100) NOT NULL,   -- DragonHelp | Registro | Seguridades | RRHH
        FieldKey NVARCHAR(100) NOT NULL REFERENCES gov.FieldDefinitions(FieldKey),
        CanView  BIT           NOT NULL DEFAULT 0,
        CanEdit  BIT           NOT NULL DEFAULT 0,
        IsActive BIT           NOT NULL DEFAULT 1,
        CONSTRAINT UQ_Gov_RoleField UNIQUE (RoleName, FieldKey)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'AuditEntries' AND s.name = 'gov'
)
BEGIN
    CREATE TABLE gov.AuditEntries (
        Id          NVARCHAR(50)   NOT NULL PRIMARY KEY,
        Timestamp   DATETIME2      NOT NULL,
        PerformedBy NVARCHAR(200)  NOT NULL,
        RoleName    NVARCHAR(100)  NOT NULL,
        ActionType  NVARCHAR(100)  NOT NULL,   -- UpdateField | EnableAccount | DisableAccount
        FieldKey    NVARCHAR(100)  NULL,
        OldValue    NVARCHAR(500)  NULL,
        NewValue    NVARCHAR(500)  NULL,
        TargetUser  NVARCHAR(200)  NOT NULL,
        Domain      NVARCHAR(200)  NOT NULL,
        Success     BIT            NOT NULL DEFAULT 1,
        Notes       NVARCHAR(1000) NULL
    );

    CREATE INDEX IX_Gov_Audit_Timestamp  ON gov.AuditEntries (Timestamp DESC);
    CREATE INDEX IX_Gov_Audit_TargetUser ON gov.AuditEntries (TargetUser);
    CREATE INDEX IX_Gov_Audit_RoleName   ON gov.AuditEntries (RoleName);
END
GO

-- ── 3. Seed: field definitions ────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM gov.FieldDefinitions WHERE FieldKey = 'field-ext-email')
BEGIN
    INSERT INTO gov.FieldDefinitions
        (FieldKey, AdAttributeName, DisplayName, Description, FieldType, IsSensitive, IsActive, SortOrder, AllowedValues, Placeholder, CreatedAt, UpdatedAt)
    VALUES
        ('field-ext-email',
         'Custom-External-Email-Address',
         'Email Externo',
         'Correo personal para recuperación de contraseña y notificaciones externas al dominio.',
         'Email', 1, 1, 1, NULL, 'usuario@dominio.com', GETUTCDATE(), GETUTCDATE()),

        ('field-office',
         'physicalDeliveryOfficeName',
         'Oficina',
         'Ubicación física del usuario dentro de la institución.',
         'Text', 0, 1, 2, NULL, 'Ciudad - Edificio / Piso', GETUTCDATE(), GETUTCDATE()),

        ('field-telephone',
         'telephoneNumber',
         'Teléfono',
         'Número de teléfono fijo laboral registrado en el directorio institucional.',
         'Text', 0, 1, 3, NULL, '+593 2 000-0000', GETUTCDATE(), GETUTCDATE()),

        ('field-account-status',
         'userAccountControl',
         'Estado de Cuenta',
         'Controla si el usuario puede autenticarse en los sistemas institucionales. Solo roles autorizados pueden modificarlo.',
         'Select', 1, 1, 4, 'Enabled,Disabled', NULL, GETUTCDATE(), GETUTCDATE());
END
GO

-- ── 4. Seed: role-field permissions ──────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM gov.RoleFieldPermissions WHERE RoleName = 'DragonHelp')
BEGIN
    INSERT INTO gov.RoleFieldPermissions (RoleName, FieldKey, CanView, CanEdit, IsActive) VALUES
        -- DragonHelp: ve y edita email/oficina; solo ve teléfono; sin acceso a estado
        ('DragonHelp', 'field-ext-email',     1, 1, 1),
        ('DragonHelp', 'field-office',        1, 1, 1),
        ('DragonHelp', 'field-telephone',     1, 0, 1),
        ('DragonHelp', 'field-account-status',0, 0, 1),
        -- Registro: edita email; solo ve el resto; sin acceso a estado
        ('Registro',   'field-ext-email',     1, 1, 1),
        ('Registro',   'field-office',        1, 0, 1),
        ('Registro',   'field-telephone',     1, 0, 1),
        ('Registro',   'field-account-status',0, 0, 1),
        -- Seguridades: acceso completo a todos los campos
        ('Seguridades','field-ext-email',     1, 1, 1),
        ('Seguridades','field-office',        1, 1, 1),
        ('Seguridades','field-telephone',     1, 1, 1),
        ('Seguridades','field-account-status',1, 1, 1),
        -- RRHH: ve estado; edita oficina y teléfono; solo ve email
        ('RRHH',       'field-ext-email',     1, 0, 1),
        ('RRHH',       'field-office',        1, 1, 1),
        ('RRHH',       'field-telephone',     1, 1, 1),
        ('RRHH',       'field-account-status',1, 0, 1);
END
GO
