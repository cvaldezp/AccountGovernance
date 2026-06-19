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

-- ── 3. Account-creation tables ───────────────────────────────────────────────

IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'AccountTypes' AND s.name = 'gov'
)
BEGIN
    CREATE TABLE gov.AccountTypes (
        Id           INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
        TypeKey      NVARCHAR(50)  NOT NULL,
        Label        NVARCHAR(100) NOT NULL,
        Description  NVARCHAR(500) NOT NULL,
        Badge        NVARCHAR(10)  NOT NULL,
        IsPrivileged BIT           NOT NULL DEFAULT 0,
        IsActive     BIT           NOT NULL DEFAULT 1,
        SortOrder    INT           NOT NULL DEFAULT 0,
        CreatedAt    DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt    DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_Gov_AccountTypes_TypeKey UNIQUE (TypeKey)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'AccountTypeConfigurations' AND s.name = 'gov'
)
BEGIN
    CREATE TABLE gov.AccountTypeConfigurations (
        Id                    INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
        AccountTypeId         INT           NOT NULL,
        SamPrefix             NVARCHAR(20)  NULL,           -- NULL for PRIVILEGED (prefix lives in AccountSubTypes)
        ExtensionAttribute14  NVARCHAR(50)  NOT NULL,
        TargetOU              NVARCHAR(500) NULL,           -- NULL for PRIVILEGED (OU lives in AccountSubTypes)
        DefaultPasswordLength INT           NOT NULL DEFAULT 16,
        DescriptionTemplate   NVARCHAR(500) NOT NULL DEFAULT '',
        DefaultCompany        NVARCHAR(200) NULL,           -- Fixed company for types like GENERIC ('USFQ')
        UpdatedAt             DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
        UpdatedBy             NVARCHAR(200) NULL,
        CONSTRAINT FK_Gov_AccountTypeConfig_Type FOREIGN KEY (AccountTypeId)
            REFERENCES gov.AccountTypes(Id),
        CONSTRAINT UQ_Gov_AccountTypeConfig_TypeId UNIQUE (AccountTypeId)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'AccountSubTypes' AND s.name = 'gov'
)
BEGIN
    CREATE TABLE gov.AccountSubTypes (
        Id                    INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
        AccountTypeId         INT           NOT NULL REFERENCES gov.AccountTypes(Id),
        SubTypeKey            NVARCHAR(50)  NOT NULL,
        Label                 NVARCHAR(100) NOT NULL,
        SamPrefix             NVARCHAR(20)  NOT NULL,
        ExtensionAttribute14  NVARCHAR(50)  NOT NULL,
        TargetOU              NVARCHAR(500) NULL,
        IsActive              BIT           NOT NULL DEFAULT 1,
        SortOrder             INT           NOT NULL DEFAULT 0,
        CONSTRAINT UQ_Gov_AccountSubTypes_Key UNIQUE (SubTypeKey)
    );
END
GO

-- ── 4a. Migration: add DefaultCompany column if missing (idempotent) ──────────

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE  object_id = OBJECT_ID('gov.AccountTypeConfigurations') AND name = 'DefaultCompany'
)
    ALTER TABLE gov.AccountTypeConfigurations ADD DefaultCompany NVARCHAR(200) NULL;
GO

-- ── 4b. Migration: consolidate to 5 types with uppercase keys (idempotent) ────

-- Rename lowercase type keys to uppercase
UPDATE gov.AccountTypes SET TypeKey = 'GENERIC'    WHERE TypeKey = 'generica';
UPDATE gov.AccountTypes SET TypeKey = 'PARTNER'    WHERE TypeKey = 'partner';
UPDATE gov.AccountTypes SET TypeKey = 'SERVICE'    WHERE TypeKey = 'service';
UPDATE gov.AccountTypes SET TypeKey = 'EXTENSION'  WHERE TypeKey = 'extension';
GO

-- Remove old privileged sub-types (they become AccountSubTypes under the single PRIVILEGED type)
IF EXISTS (SELECT 1 FROM gov.AccountTypes WHERE TypeKey LIKE 'privileged-%')
BEGIN
    DELETE atc
    FROM   gov.AccountTypeConfigurations atc
    INNER JOIN gov.AccountTypes at ON at.Id = atc.AccountTypeId
    WHERE  at.TypeKey LIKE 'privileged-%';

    DELETE FROM gov.AccountTypes WHERE TypeKey LIKE 'privileged-%';
END
GO

-- ── 5. Seed: account types (5 canonical types) ───────────────────────────────

IF NOT EXISTS (SELECT 1 FROM gov.AccountTypes WHERE TypeKey = 'GENERIC')
    INSERT INTO gov.AccountTypes (TypeKey, Label, Description, Badge, IsPrivileged, IsActive, SortOrder)
    VALUES ('GENERIC', 'Genérica', 'Cuentas de usuarios internos estándar.', 'GEN', 0, 1, 1);
GO

IF NOT EXISTS (SELECT 1 FROM gov.AccountTypes WHERE TypeKey = 'PARTNER')
    INSERT INTO gov.AccountTypes (TypeKey, Label, Description, Badge, IsPrivileged, IsActive, SortOrder)
    VALUES ('PARTNER', 'Partner', 'Cuentas para socios externos o proveedores.', 'PTR', 0, 1, 2);
GO

IF NOT EXISTS (SELECT 1 FROM gov.AccountTypes WHERE TypeKey = 'SERVICE')
    INSERT INTO gov.AccountTypes (TypeKey, Label, Description, Badge, IsPrivileged, IsActive, SortOrder)
    VALUES ('SERVICE', 'Servicio', 'Cuentas para servicios o aplicaciones.', 'SVC', 0, 1, 3);
GO

IF NOT EXISTS (SELECT 1 FROM gov.AccountTypes WHERE TypeKey = 'EXTENSION')
    INSERT INTO gov.AccountTypes (TypeKey, Label, Description, Badge, IsPrivileged, IsActive, SortOrder)
    VALUES ('EXTENSION', 'Extensión', 'Cuentas de extensión para usuarios existentes.', 'EXT', 0, 1, 4);
GO

IF NOT EXISTS (SELECT 1 FROM gov.AccountTypes WHERE TypeKey = 'PRIVILEGED')
    INSERT INTO gov.AccountTypes (TypeKey, Label, Description, Badge, IsPrivileged, IsActive, SortOrder)
    VALUES ('PRIVILEGED', 'Privilegiada', 'Cuentas privilegiadas con acceso elevado. El sub-tipo determina el prefijo y OU.', 'PRV', 1, 1, 5);
GO

-- ── 6. Seed: account type configurations ─────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM gov.AccountTypeConfigurations
               WHERE AccountTypeId = (SELECT Id FROM gov.AccountTypes WHERE TypeKey = 'GENERIC'))
BEGIN
    INSERT INTO gov.AccountTypeConfigurations
        (AccountTypeId, SamPrefix, ExtensionAttribute14, TargetOU, DefaultPasswordLength, DescriptionTemplate, DefaultCompany)
    SELECT at.Id, cfg.SamPrefix, cfg.ExtensionAttribute14, cfg.TargetOU, cfg.DefaultPasswordLength, cfg.DescriptionTemplate, cfg.DefaultCompany
    FROM gov.AccountTypes at
    JOIN (VALUES
        ('GENERIC',    NULL, N'Genérica',  'OU=Genericas,OU=Usuarios,DC=usfq,DC=edu,DC=ec',  16, N'Genérica',  N'USFQ'),
        ('PARTNER',    NULL,  'PARTNERS',  'OU=Partners,OU=Externos,DC=usfq,DC=edu,DC=ec',   16, 'PARTNERS',   N'USFQ'),
        ('SERVICE',    NULL,  'SERVICES',  'OU=ServiceAccounts,DC=usfq,DC=edu,DC=ec',         20, 'SERVICES',   N'USFQ'),
        ('EXTENSION',  NULL,  'EXTENSION', 'OU=Extension,OU=Usuarios,DC=usfq,DC=edu,DC=ec',  16, 'EXTENSION',  N'USFQ'),
        ('PRIVILEGED', NULL,  'PRIVILEGED', NULL,                                             20, 'PRIVILEGED', N'USFQ')
    ) AS cfg(TypeKey, SamPrefix, ExtensionAttribute14, TargetOU, DefaultPasswordLength, DescriptionTemplate, DefaultCompany)
        ON at.TypeKey = cfg.TypeKey;
END
GO

-- ── Migration: fix all config values for existing installs ───────────────────

UPDATE gov.AccountTypeConfigurations
SET    ExtensionAttribute14 = N'Genérica',
       DescriptionTemplate  = N'Genérica',
       DefaultCompany       = N'USFQ'
WHERE  AccountTypeId = (SELECT Id FROM gov.AccountTypes WHERE TypeKey = 'GENERIC');
GO

UPDATE gov.AccountTypeConfigurations
SET    ExtensionAttribute14 = 'PARTNERS',
       DescriptionTemplate  = 'PARTNERS',
       DefaultCompany       = N'USFQ'
WHERE  AccountTypeId = (SELECT Id FROM gov.AccountTypes WHERE TypeKey = 'PARTNER');
GO

UPDATE gov.AccountTypeConfigurations
SET    ExtensionAttribute14 = 'SERVICES',
       DescriptionTemplate  = 'SERVICES',
       DefaultCompany       = N'USFQ'
WHERE  AccountTypeId = (SELECT Id FROM gov.AccountTypes WHERE TypeKey = 'SERVICE');
GO

UPDATE gov.AccountTypeConfigurations
SET    ExtensionAttribute14 = 'EXTENSION',
       DescriptionTemplate  = 'EXTENSION',
       DefaultCompany       = N'USFQ'
WHERE  AccountTypeId = (SELECT Id FROM gov.AccountTypes WHERE TypeKey = 'EXTENSION');
GO

UPDATE gov.AccountTypeConfigurations
SET    ExtensionAttribute14 = 'PRIVILEGED',
       DescriptionTemplate  = 'PRIVILEGED',
       DefaultCompany       = N'USFQ'
WHERE  AccountTypeId = (SELECT Id FROM gov.AccountTypes WHERE TypeKey = 'PRIVILEGED');
GO

-- ── 7. Seed: account sub-types (PRIVILEGED only) ─────────────────────────────

IF NOT EXISTS (SELECT 1 FROM gov.AccountSubTypes WHERE SubTypeKey = 'OPERACIONES')
BEGIN
    INSERT INTO gov.AccountSubTypes
        (AccountTypeId, SubTypeKey, Label, SamPrefix, ExtensionAttribute14, TargetOU, IsActive, SortOrder)
    SELECT at.Id, sub.SubTypeKey, sub.Label, sub.SamPrefix, sub.ExtensionAttribute14, sub.TargetOU, 1, sub.SortOrder
    FROM gov.AccountTypes at
    JOIN (VALUES
        ('OPERACIONES',    'Operaciones',    'op',    'PRIV_OP',  'OU=Privilegiadas,OU=Operaciones,DC=usfq,DC=edu,DC=ec',    1),
        ('INFRAESTRUCTURA','Infraestructura','sa',    'PRIV_SA',  'OU=Privilegiadas,OU=Infraestructura,DC=usfq,DC=edu,DC=ec',2),
        ('SISTEMAS',       'Sistemas',       'sys',   'PRIV_SYS', 'OU=Privilegiadas,OU=Sistemas,DC=usfq,DC=edu,DC=ec',       3),
        ('SEGURIDAD',      'Seguridad',      'cyber', 'PRIV_CYB', 'OU=Privilegiadas,OU=Seguridad,DC=usfq,DC=edu,DC=ec',      4)
    ) AS sub(SubTypeKey, Label, SamPrefix, ExtensionAttribute14, TargetOU, SortOrder)
        ON at.TypeKey = 'PRIVILEGED';
END
GO

-- ── 8. Account creation audit log ───────────────────────────────────────────

IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'AccountCreationAudit' AND s.name = 'gov'
)
BEGIN
    CREATE TABLE gov.AccountCreationAudit (
        Id             INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
        Operator       NVARCHAR(200) NOT NULL,          -- Windows identity of the technician
        AccountTypeKey NVARCHAR(50)  NOT NULL,
        SubTypeKey     NVARCHAR(50)  NULL,
        AccountName    NVARCHAR(200) NOT NULL,          -- Raw "Cuenta" input
        SamAccountName NVARCHAR(200) NOT NULL,
        Upn            NVARCHAR(500) NOT NULL,
        DisplayName    NVARCHAR(500) NULL,
        Company        NVARCHAR(200) NULL,
        Description    NVARCHAR(500) NULL,
        ExtAttr14      NVARCHAR(100) NULL,
        TargetOU       NVARCHAR(500) NULL,
        RecoveryEmail  NVARCHAR(500) NULL,
        Success        BIT           NOT NULL,
        ErrorMessage   NVARCHAR(MAX) NULL,
        CreatedAt      DATETIME2     NOT NULL DEFAULT GETUTCDATE()
        -- Password is NEVER stored
    );

    CREATE INDEX IX_Gov_AccountAudit_CreatedAt      ON gov.AccountCreationAudit (CreatedAt DESC);
    CREATE INDEX IX_Gov_AccountAudit_SamAccountName ON gov.AccountCreationAudit (SamAccountName);
    CREATE INDEX IX_Gov_AccountAudit_Operator       ON gov.AccountCreationAudit (Operator);
END
GO

-- ── 5. Seed: field definitions ────────────────────────────────────────────────

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
