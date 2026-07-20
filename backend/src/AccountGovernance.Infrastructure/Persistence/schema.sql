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

-- ── 4c. Migration: add DepartmentPrefix column (idempotent) ─────────────────────

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE  object_id = OBJECT_ID('gov.AccountTypeConfigurations') AND name = 'DepartmentPrefix'
)
    ALTER TABLE gov.AccountTypeConfigurations ADD DepartmentPrefix NVARCHAR(20) NULL;
GO

UPDATE gov.AccountTypeConfigurations SET DepartmentPrefix = 'GEN'
WHERE AccountTypeId = (SELECT Id FROM gov.AccountTypes WHERE TypeKey = 'GENERIC')    AND DepartmentPrefix IS NULL;
UPDATE gov.AccountTypeConfigurations SET DepartmentPrefix = 'PART'
WHERE AccountTypeId = (SELECT Id FROM gov.AccountTypes WHERE TypeKey = 'PARTNER')    AND DepartmentPrefix IS NULL;
UPDATE gov.AccountTypeConfigurations SET DepartmentPrefix = 'SVC'
WHERE AccountTypeId = (SELECT Id FROM gov.AccountTypes WHERE TypeKey = 'SERVICE')    AND DepartmentPrefix IS NULL;
UPDATE gov.AccountTypeConfigurations SET DepartmentPrefix = 'EXT'
WHERE AccountTypeId = (SELECT Id FROM gov.AccountTypes WHERE TypeKey = 'EXTENSION')  AND DepartmentPrefix IS NULL;
UPDATE gov.AccountTypeConfigurations SET DepartmentPrefix = 'PRV'
WHERE AccountTypeId = (SELECT Id FROM gov.AccountTypes WHERE TypeKey = 'PRIVILEGED') AND DepartmentPrefix IS NULL;
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

-- ── 9. Initial groups for account creation ───────────────────────────────────

IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'AccountTypeInitialGroups' AND s.name = 'gov'
)
BEGIN
    CREATE TABLE gov.AccountTypeInitialGroups (
        Id               INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
        AccountTypeId    INT           NOT NULL,
        AccountSubTypeId INT           NULL,
        GroupName        NVARCHAR(256) NOT NULL,
        GroupDn          NVARCHAR(512) NOT NULL,
        GroupObjectGuid  NVARCHAR(64)  NULL,
        GroupSid         NVARCHAR(256) NULL,
        IsCritical        BIT           NOT NULL DEFAULT 1,
        ContinueOnFailure BIT           NOT NULL DEFAULT 1,
        IsActive          BIT           NOT NULL DEFAULT 1,
        SortOrder        INT           NOT NULL DEFAULT 0,
        CreatedAt        DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt        DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
        UpdatedBy        NVARCHAR(200) NULL,

        CONSTRAINT FK_InitialGroups_AccountType
            FOREIGN KEY (AccountTypeId) REFERENCES gov.AccountTypes(Id),
        CONSTRAINT FK_InitialGroups_AccountSubType
            FOREIGN KEY (AccountSubTypeId) REFERENCES gov.AccountSubTypes(Id)
    );

    CREATE INDEX IX_InitialGroups_TypeId    ON gov.AccountTypeInitialGroups (AccountTypeId);
    CREATE INDEX IX_InitialGroups_SubTypeId ON gov.AccountTypeInitialGroups (AccountSubTypeId);
    CREATE INDEX IX_InitialGroups_Active    ON gov.AccountTypeInitialGroups (IsActive);
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
        -- SystemAdmin: acceso completo a todos los campos (super usuario)
        ('SystemAdmin','field-ext-email',     1, 1, 1),
        ('SystemAdmin','field-office',        1, 1, 1),
        ('SystemAdmin','field-telephone',     1, 1, 1),
        ('SystemAdmin','field-account-status',1, 1, 1),
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

-- ── Migration: add ContinueOnFailure to gov.AccountTypeInitialGroups ──────────
IF NOT EXISTS (

    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('gov.AccountTypeInitialGroups')
      AND name = 'ContinueOnFailure'
)
BEGIN
    ALTER TABLE gov.AccountTypeInitialGroups
        ADD ContinueOnFailure BIT NOT NULL DEFAULT(1);
END
GO

-- ── Migration: extend gov.FieldDefinitions / gov.RoleFieldPermissions for the
--    attribute-admin module (idempotent). Category/DataType stay nullable in
--    this phase — hardening to NOT NULL is a later migration once every row
--    has real values. RequiresAudit is a plain business boolean (no need for
--    a third state), so it goes straight to NOT NULL DEFAULT(0). ───────────

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('gov.FieldDefinitions') AND name = 'Category')
    ALTER TABLE gov.FieldDefinitions ADD Category NVARCHAR(50) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('gov.FieldDefinitions') AND name = 'DataType')
    ALTER TABLE gov.FieldDefinitions ADD DataType NVARCHAR(50) NULL;
GO

-- RequiresAudit: el ADD y el backfill de los 4 seed corren solo la primera vez
-- que se crea la columna — en cualquier ejecución posterior de este script
-- (columna ya existente) ambos se saltan, así que un valor cambiado
-- manualmente desde el admin nunca se revierte si este script se vuelve a
-- correr por error o para validación (schema.sql es de aplicación manual,
-- no se ejecuta automáticamente en cada arranque de la app).
--
-- SQL Server valida los nombres de columna en tiempo de compilación de cada
-- batch: un ALTER TABLE...ADD y un UPDATE que use esa columna NO pueden vivir
-- en el mismo batch (falla con "Invalid column name"), así que van separados
-- por GO. Para que el backfill sepa si la columna se acaba de crear en ESTA
-- ejecución (y no simplemente ya existía de antes), el primer batch deja una
-- bandera en una tabla temporal de sesión (#RequiresAuditJustAdded); el
-- segundo batch backfillea solo si encuentra esa bandera.
IF COL_LENGTH('gov.FieldDefinitions', 'RequiresAudit') IS NULL
BEGIN
    ALTER TABLE gov.FieldDefinitions
        ADD RequiresAudit BIT NOT NULL
        CONSTRAINT DF_Gov_FieldDefinitions_RequiresAudit DEFAULT(0);

    IF OBJECT_ID('tempdb..#RequiresAuditJustAdded') IS NOT NULL DROP TABLE #RequiresAuditJustAdded;
    CREATE TABLE #RequiresAuditJustAdded (Flag BIT);
    INSERT INTO #RequiresAuditJustAdded VALUES (1);
END
GO

IF OBJECT_ID('tempdb..#RequiresAuditJustAdded') IS NOT NULL
BEGIN
    UPDATE gov.FieldDefinitions
    SET RequiresAudit = 1
    WHERE FieldKey IN ('field-ext-email', 'field-account-status');

    -- field-office y field-telephone permanecen en 0 por el DEFAULT.
    DROP TABLE #RequiresAuditJustAdded;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('gov.FieldDefinitions') AND name = 'CreatedBy')
    ALTER TABLE gov.FieldDefinitions ADD CreatedBy NVARCHAR(256) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('gov.FieldDefinitions') AND name = 'UpdatedBy')
    ALTER TABLE gov.FieldDefinitions ADD UpdatedBy NVARCHAR(256) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('gov.RoleFieldPermissions') AND name = 'UpdatedAt')
    ALTER TABLE gov.RoleFieldPermissions ADD UpdatedAt DATETIME2 NOT NULL DEFAULT(GETUTCDATE());
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('gov.RoleFieldPermissions') AND name = 'UpdatedBy')
    ALTER TABLE gov.RoleFieldPermissions ADD UpdatedBy NVARCHAR(256) NULL;
GO

-- Backfill de Category/DataType para los 4 registros seed existentes.
-- COALESCE por columna: si alguien ya los configuró manualmente (desde el
-- futuro admin o a mano en BD), ese valor se conserva; solo se completa lo
-- que esté en NULL. A diferencia de RequiresAudit, este backfill sí puede
-- repetirse en cualquier reejecución manual del script sin riesgo, porque
-- COALESCE nunca pisa un valor ya no-NULL.
UPDATE gov.FieldDefinitions SET
    Category = COALESCE(Category, 'contact'),
    DataType = COALESCE(DataType, 'string')
    WHERE FieldKey = 'field-ext-email';

UPDATE gov.FieldDefinitions SET
    Category = COALESCE(Category, 'organizational'),
    DataType = COALESCE(DataType, 'string')
    WHERE FieldKey = 'field-office';

UPDATE gov.FieldDefinitions SET
    Category = COALESCE(Category, 'contact'),
    DataType = COALESCE(DataType, 'string')
    WHERE FieldKey = 'field-telephone';

UPDATE gov.FieldDefinitions SET
    Category = COALESCE(Category, 'account'),
    DataType = COALESCE(DataType, 'flags')
    WHERE FieldKey = 'field-account-status';
GO

-- Constraint única de AdAttributeName — solo se crea si no hay duplicados hoy.
-- Si los hay: PRINT explicativo + SELECT de los registros duplicados, se omite
-- únicamente la creación de la constraint, y el resto del script sigue normal
-- (nada de RAISERROR/THROW que pueda abortar el batch).
IF EXISTS (
    SELECT AdAttributeName FROM gov.FieldDefinitions
    GROUP BY AdAttributeName HAVING COUNT(*) > 1
)
BEGIN
    PRINT 'ADVERTENCIA: no se creó UQ_Gov_FieldDefinitions_AdAttributeName porque existen valores de AdAttributeName duplicados en gov.FieldDefinitions. Revisa el SELECT de duplicados a continuación, resuélvelos manualmente y vuelve a ejecutar el script para que la constraint se cree.';

    SELECT FieldKey, AdAttributeName
    FROM gov.FieldDefinitions
    WHERE AdAttributeName IN (
        SELECT AdAttributeName FROM gov.FieldDefinitions
        GROUP BY AdAttributeName HAVING COUNT(*) > 1
    )
    ORDER BY AdAttributeName, FieldKey;
END
ELSE IF NOT EXISTS (
    SELECT 1 FROM sys.key_constraints
    WHERE name = 'UQ_Gov_FieldDefinitions_AdAttributeName'
      AND parent_object_id = OBJECT_ID('gov.FieldDefinitions')
)
BEGIN
    ALTER TABLE gov.FieldDefinitions
        ADD CONSTRAINT UQ_Gov_FieldDefinitions_AdAttributeName UNIQUE (AdAttributeName);
END
GO

-- ── Verificación de la migración de atributos AD. schema.sql es un script de
--    aplicación manual (no corre en cada arranque de la app — nada en el
--    código lo invoca, ver Program.cs), así que estas consultas se imprimen
--    únicamente cuando alguien lo ejecuta a mano (sqlcmd/SSMS/Azure Data
--    Studio), justo para que el DBA valide el resultado de la migración. ────

PRINT '--- Verificación: columnas creadas ---';
SELECT t.name AS TableName, c.name AS ColumnName, ty.name AS DataType, c.is_nullable
FROM   sys.columns c
JOIN   sys.tables  t  ON c.object_id = t.object_id
JOIN   sys.types   ty ON c.user_type_id = ty.user_type_id
WHERE  t.name IN ('FieldDefinitions', 'RoleFieldPermissions')
  AND  c.name IN ('Category','DataType','RequiresAudit','CreatedBy','UpdatedBy','UpdatedAt')
ORDER BY t.name, c.name;

PRINT '--- Verificación: metadata resultante de gov.FieldDefinitions ---';
SELECT FieldKey, AdAttributeName, Category, DataType, RequiresAudit, CreatedBy, UpdatedBy
FROM   gov.FieldDefinitions
ORDER BY SortOrder;

PRINT '--- Verificación: constraint única UQ_Gov_FieldDefinitions_AdAttributeName ---';
SELECT name, type_desc
FROM   sys.key_constraints
WHERE  parent_object_id = OBJECT_ID('gov.FieldDefinitions')
  AND  name = 'UQ_Gov_FieldDefinitions_AdAttributeName';

PRINT '--- Verificación: duplicados de AdAttributeName (debe estar vacío) ---';
SELECT AdAttributeName, COUNT(*) AS Cantidad
FROM   gov.FieldDefinitions
GROUP BY AdAttributeName
HAVING COUNT(*) > 1;

PRINT '--- Verificación: total de registros en gov.FieldDefinitions ---';
SELECT COUNT(*) AS TotalFieldDefinitions FROM gov.FieldDefinitions;

PRINT '--- Verificación: distribución por Category ---';
SELECT ISNULL(Category, '(sin categoría)') AS Category, COUNT(*) AS Cantidad
FROM   gov.FieldDefinitions
GROUP BY Category
ORDER BY Category;
GO

-- ── 10. Global expiration configuration (singleton) ──────────────────────────
-- One row controls which expiration options are available system-wide.
-- The operator picks the actual expiration date at account-creation time.

IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'ExpirationGlobalConfig' AND s.name = 'gov'
)
BEGIN
    CREATE TABLE gov.ExpirationGlobalConfig (
        Id                INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
        AllowNoExpiration BIT           NOT NULL DEFAULT 1,  -- allow "Sin expiración"
        AllowCustomDate   BIT           NOT NULL DEFAULT 1,  -- allow "Fecha específica"
        AllowedMonthsCsv  NVARCHAR(100) NOT NULL DEFAULT '1,2,3,6,9,12,18,24,36,48,60',
        UpdatedAt         DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
        UpdatedBy         NVARCHAR(200) NULL
    );
END
GO

-- Seed: ensure exactly one config row exists
IF NOT EXISTS (SELECT 1 FROM gov.ExpirationGlobalConfig)
    INSERT INTO gov.ExpirationGlobalConfig
        (AllowNoExpiration, AllowCustomDate, AllowedMonthsCsv)
    VALUES
        (1, 1, '1,2,3,6,9,12,18,24,36,48,60');
GO

-- ── 11. System roles — replaces Authorization:RoleMappings/RolePriority in appsettings ──
-- SystemAuthorizationService resolves AD-group membership against these tables at runtime.
-- Lower Priority = resolved first when a user matches more than one role (see ResolvePrimaryRole).

IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'SystemRoles' AND s.name = 'gov'
)
BEGIN
    CREATE TABLE gov.SystemRoles (
        Id          INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
        RoleKey     NVARCHAR(100) NOT NULL,
        DisplayName NVARCHAR(200) NOT NULL,
        Description NVARCHAR(500) NULL,
        Priority    INT           NOT NULL,
        IsActive    BIT           NOT NULL DEFAULT 1,
        CreatedAt   DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt   DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
        UpdatedBy   NVARCHAR(200) NULL,
        CONSTRAINT UQ_Gov_SystemRoles_RoleKey UNIQUE (RoleKey)
    );

    CREATE INDEX IX_Gov_SystemRoles_Priority ON gov.SystemRoles (Priority);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'SystemRoleGroups' AND s.name = 'gov'
)
BEGIN
    CREATE TABLE gov.SystemRoleGroups (
        Id              INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
        SystemRoleId    INT           NOT NULL,
        GroupName       NVARCHAR(256) NOT NULL,
        GroupDn         NVARCHAR(512) NOT NULL,
        GroupSid        NVARCHAR(256) NULL,
        GroupObjectGuid NVARCHAR(64)  NULL,
        IsActive        BIT           NOT NULL DEFAULT 1,
        CreatedAt       DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt       DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
        UpdatedBy       NVARCHAR(200) NULL,
        CONSTRAINT FK_Gov_SystemRoleGroups_Role FOREIGN KEY (SystemRoleId)
            REFERENCES gov.SystemRoles(Id),
        CONSTRAINT UQ_Gov_SystemRoleGroups_RoleDn UNIQUE (SystemRoleId, GroupDn)
    );

    CREATE INDEX IX_Gov_SystemRoleGroups_RoleId ON gov.SystemRoleGroups (SystemRoleId);
    CREATE INDEX IX_Gov_SystemRoleGroups_Active ON gov.SystemRoleGroups (IsActive);
END
GO

-- Seed: initial roles (idempotent — insert only if RoleKey missing)
IF NOT EXISTS (SELECT 1 FROM gov.SystemRoles WHERE RoleKey = 'SystemAdmin')
    INSERT INTO gov.SystemRoles (RoleKey, DisplayName, Description, Priority, IsActive)
    VALUES ('SystemAdmin', 'Super Usuario Administrador', 'Acceso total al sistema, incluida esta configuración de roles y grupos.', 1, 1);
GO

IF NOT EXISTS (SELECT 1 FROM gov.SystemRoles WHERE RoleKey = 'Seguridades')
    INSERT INTO gov.SystemRoles (RoleKey, DisplayName, Description, Priority, IsActive)
    VALUES ('Seguridades', 'Seguridades', 'Acceso completo a todos los campos de cuentas.', 10, 1);
GO

IF NOT EXISTS (SELECT 1 FROM gov.SystemRoles WHERE RoleKey = 'RRHH')
    INSERT INTO gov.SystemRoles (RoleKey, DisplayName, Description, Priority, IsActive)
    VALUES ('RRHH', 'Recursos Humanos', 'Gestión de estado, oficina y teléfono de cuentas.', 20, 1);
GO

IF NOT EXISTS (SELECT 1 FROM gov.SystemRoles WHERE RoleKey = 'Registro')
    INSERT INTO gov.SystemRoles (RoleKey, DisplayName, Description, Priority, IsActive)
    VALUES ('Registro', 'Registro', 'Pendiente de asignar grupo AD.', 30, 1);
GO

IF NOT EXISTS (SELECT 1 FROM gov.SystemRoles WHERE RoleKey = 'DragonHelp')
    INSERT INTO gov.SystemRoles (RoleKey, DisplayName, Description, Priority, IsActive)
    VALUES ('DragonHelp', 'Dragon Help Desk', 'Mesa de ayuda — edición de email y oficina.', 40, 1);
GO

-- Seed: initial AD group mappings (idempotent). Registro is intentionally left without a group.
IF NOT EXISTS (SELECT 1 FROM gov.SystemRoleGroups WHERE GroupDn = 'CN=account-admin,OU=SECURITY,OU=GROUPS,OU=Cumbaya,DC=usfq,DC=edu,DC=ec')
    INSERT INTO gov.SystemRoleGroups (SystemRoleId, GroupName, GroupDn, IsActive)
    SELECT Id, 'account-admin', 'CN=account-admin,OU=SECURITY,OU=GROUPS,OU=Cumbaya,DC=usfq,DC=edu,DC=ec', 1
    FROM gov.SystemRoles WHERE RoleKey = 'SystemAdmin';
GO

IF NOT EXISTS (SELECT 1 FROM gov.SystemRoleGroups WHERE GroupDn = 'CN=account-seg,OU=SECURITY,OU=GROUPS,OU=Cumbaya,DC=usfq,DC=edu,DC=ec')
    INSERT INTO gov.SystemRoleGroups (SystemRoleId, GroupName, GroupDn, IsActive)
    SELECT Id, 'account-seg', 'CN=account-seg,OU=SECURITY,OU=GROUPS,OU=Cumbaya,DC=usfq,DC=edu,DC=ec', 1
    FROM gov.SystemRoles WHERE RoleKey = 'Seguridades';
GO

IF NOT EXISTS (SELECT 1 FROM gov.SystemRoleGroups WHERE GroupDn = 'CN=account-rrhh,OU=SECURITY,OU=GROUPS,OU=Cumbaya,DC=usfq,DC=edu,DC=ec')
    INSERT INTO gov.SystemRoleGroups (SystemRoleId, GroupName, GroupDn, IsActive)
    SELECT Id, 'account-rrhh', 'CN=account-rrhh,OU=SECURITY,OU=GROUPS,OU=Cumbaya,DC=usfq,DC=edu,DC=ec', 1
    FROM gov.SystemRoles WHERE RoleKey = 'RRHH';
GO

IF NOT EXISTS (SELECT 1 FROM gov.SystemRoleGroups WHERE GroupDn = 'CN=account-sd,OU=SECURITY,OU=GROUPS,OU=Cumbaya,DC=usfq,DC=edu,DC=ec')
    INSERT INTO gov.SystemRoleGroups (SystemRoleId, GroupName, GroupDn, IsActive)
    SELECT Id, 'account-sd', 'CN=account-sd,OU=SECURITY,OU=GROUPS,OU=Cumbaya,DC=usfq,DC=edu,DC=ec', 1
    FROM gov.SystemRoles WHERE RoleKey = 'DragonHelp';
GO

-- ═══════════════════════════════════════════════════════════════════════════
-- Modelo de Scope (Ámbito Administrativo) — Incremento 1.
-- Solo modelo de datos + CRUD: estas tablas NO restringen ninguna operación
-- real todavía. El enforcement llega en incrementos posteriores, una vez que
-- existan RoleScopeAssignment/RoleScopeFieldPermission y el scope-check.
-- Sin seed de datos reales — los BaseDn reales se cargan cuando el equipo de
-- infraestructura confirme el inventario de dominios/ConnectionProfiles
-- (Incremento 0), para no activar un ámbito con un DN inventado.
-- ═══════════════════════════════════════════════════════════════════════════

IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'AdministrativeScopes' AND s.name = 'gov'
)
BEGIN
    CREATE TABLE gov.AdministrativeScopes (
        Id                INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
        ScopeKey          NVARCHAR(100) NOT NULL,
        Name              NVARCHAR(200) NOT NULL,
        Description       NVARCHAR(500) NULL,
        Category          NVARCHAR(50)  NULL,
        BaseDn            NVARCHAR(500) NOT NULL,
        ConnectionProfile NVARCHAR(100) NOT NULL DEFAULT ('default'),
        IsActive          BIT           NOT NULL DEFAULT 0,
        Priority          INT           NOT NULL DEFAULT 100,
        CreatedBy         NVARCHAR(200) NULL,
        UpdatedBy         NVARCHAR(200) NULL,
        CreatedAt         DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt         DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_Gov_AdministrativeScopes_ScopeKey UNIQUE (ScopeKey)
    );

    CREATE INDEX IX_Gov_AdministrativeScopes_Priority ON gov.AdministrativeScopes (Priority);
    CREATE INDEX IX_Gov_AdministrativeScopes_Active   ON gov.AdministrativeScopes (IsActive);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'AdministrativeScopeFilters' AND s.name = 'gov'
)
BEGIN
    CREATE TABLE gov.AdministrativeScopeFilters (
        Id                     INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
        AdministrativeScopeId  INT           NOT NULL,
        FilterType             NVARCHAR(50)  NOT NULL,
        AttributeName          NVARCHAR(200) NOT NULL,
        Operator               NVARCHAR(20)  NOT NULL,
        Value                  NVARCHAR(500) NULL,
        IsActive               BIT           NOT NULL DEFAULT 1,
        CreatedAt              DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt              DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
        UpdatedBy              NVARCHAR(200) NULL,
        CONSTRAINT FK_Gov_AdministrativeScopeFilters_Scope FOREIGN KEY (AdministrativeScopeId)
            REFERENCES gov.AdministrativeScopes(Id),
        CONSTRAINT CK_Gov_AdministrativeScopeFilters_Operator
            CHECK (Operator IN ('Equals', 'NotEquals', 'In', 'Exists'))
    );

    CREATE INDEX IX_Gov_AdministrativeScopeFilters_ScopeId ON gov.AdministrativeScopeFilters (AdministrativeScopeId);
    CREATE INDEX IX_Gov_AdministrativeScopeFilters_Active  ON gov.AdministrativeScopeFilters (IsActive);
END
GO

-- Unicidad lógica entre filtros ACTIVOS de un mismo ámbito — defensa en
-- profundidad en SQL Server, complementaria al chequeo de la aplicación
-- (AdministrativeScopeService.CheckDuplicateFilterAsync), que es quien da el
-- mensaje entendible al usuario. Este índice es la última línea de defensa
-- ante una condición de carrera (dos requests concurrentes pasando el chequeo
-- de la aplicación al mismo tiempo).
--
-- Decisiones de diseño, explícitas para no introducir un constraint incorrecto:
-- 1. Índice ÚNICO FILTRADO (WHERE IsActive = 1): SQL Server no soporta un
--    UNIQUE CONSTRAINT condicional — un índice filtrado sí. Sin el filtro,
--    dos filtros equivalentes donde uno está inactivo (ej. se desactivó uno y
--    luego se creó un reemplazo activo) romperían la unicidad exigida, que es
--    solo entre ACTIVOS.
-- 2. Columnas computadas PERSISTED normalizadas (no las columnas crudas):
--    AttributeName/Value se comparan sin distinguir mayúsculas ni espacios en
--    la aplicación — el índice debe usar la misma normalización o divergiría
--    del chequeo de la aplicación. ISNULL(Value,'') convierte explícitamente
--    NULL (usado por el operador Exists) en cadena vacía, para no depender de
--    la semántica particular de SQL Server sobre NULLs en índices únicos.
-- 3. LIMITACIÓN CONOCIDA, documentada a propósito (no se resuelve en este
--    incremento): el operador In no se normaliza a nivel SQL. La aplicación
--    (AdministrativeScopeService.Normalize) sí ordena y compara los tokens
--    separados por coma sin importar el orden en que se escribieron — pero
--    ValueNormalized guarda el texto tal cual, así que dos filtros In
--    concurrentes con el mismo conjunto de valores en distinto orden (ej.
--    "A,B" y "B,A") NO son detectados como duplicados por este índice.
--    Resolverlo en SQL exigiría una función escalar con SCHEMABINDING solo
--    para ese caso — complejidad real para un beneficio marginal que la
--    aplicación ya cubre. Mejora futura evaluada y pospuesta a propósito:
--    normalizar (ordenar) el Value de los filtros In ANTES de persistirlo
--    (en la propia aplicación, al guardar), para que el valor almacenado
--    quede siempre en un orden canónico y el índice SQL empiece a detectar
--    también este caso sin cambiar su definición.
IF COL_LENGTH('gov.AdministrativeScopeFilters', 'AttributeNameNormalized') IS NULL
BEGIN
    ALTER TABLE gov.AdministrativeScopeFilters
        ADD AttributeNameNormalized AS UPPER(LTRIM(RTRIM(AttributeName))) PERSISTED;
END
GO

IF COL_LENGTH('gov.AdministrativeScopeFilters', 'ValueNormalized') IS NULL
BEGIN
    ALTER TABLE gov.AdministrativeScopeFilters
        ADD ValueNormalized AS UPPER(LTRIM(RTRIM(ISNULL(Value, '')))) PERSISTED;
END
GO

-- Diagnóstico previo obligatorio: el índice único filtrado solo se crea si NO
-- hay ya duplicados activos con la misma representación normalizada — mismo
-- patrón ya usado arriba para UQ_Gov_FieldDefinitions_AdAttributeName. Si los
-- hay: PRINT explicativo + SELECT de los filtros en conflicto (con sus Id,
-- para que el DBA pueda inactivar/editar uno de cada grupo), se omite
-- ÚNICAMENTE la creación del índice, y el resto del script sigue normal — no
-- se elimina ni modifica ningún dato automáticamente. Recomendado: volver a
-- ejecutar este bloque después de resolver los duplicados, para que el
-- índice quede creado.
IF EXISTS (
    SELECT AdministrativeScopeId, AttributeNameNormalized, Operator, ValueNormalized
    FROM   gov.AdministrativeScopeFilters
    WHERE  IsActive = 1
    GROUP BY AdministrativeScopeId, AttributeNameNormalized, Operator, ValueNormalized
    HAVING COUNT(*) > 1
)
BEGIN
    PRINT 'ADVERTENCIA: no se creó UQ_Gov_AdministrativeScopeFilters_Active porque existen filtros ACTIVOS duplicados (misma representación normalizada) en gov.AdministrativeScopeFilters. Revisa el SELECT de duplicados a continuación, resuélvelos manualmente (inactiva o edita uno de cada grupo) y vuelve a ejecutar este bloque para que el índice se cree.';

    SELECT f.Id, s.ScopeKey, f.AttributeName, f.AttributeNameNormalized, f.Operator, f.Value, f.ValueNormalized
    FROM   gov.AdministrativeScopeFilters f
    JOIN   gov.AdministrativeScopes s ON s.Id = f.AdministrativeScopeId
    WHERE  f.IsActive = 1
      AND  EXISTS (
          SELECT 1 FROM gov.AdministrativeScopeFilters f2
          WHERE  f2.IsActive = 1
            AND  f2.Id <> f.Id
            AND  f2.AdministrativeScopeId  = f.AdministrativeScopeId
            AND  f2.AttributeNameNormalized = f.AttributeNameNormalized
            AND  f2.Operator                = f.Operator
            AND  f2.ValueNormalized         = f.ValueNormalized
      )
    ORDER BY s.ScopeKey, f.AttributeNameNormalized, f.Id;
END
ELSE IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UQ_Gov_AdministrativeScopeFilters_Active'
      AND object_id = OBJECT_ID('gov.AdministrativeScopeFilters')
)
BEGIN
    CREATE UNIQUE INDEX UQ_Gov_AdministrativeScopeFilters_Active
        ON gov.AdministrativeScopeFilters (AdministrativeScopeId, AttributeNameNormalized, Operator, ValueNormalized)
        WHERE IsActive = 1;
END
GO

-- Verificación (para que un DBA confirme manualmente el resultado):
SELECT COUNT(*) AS AdministrativeScopes_Count        FROM gov.AdministrativeScopes;
SELECT COUNT(*) AS AdministrativeScopeFilters_Count   FROM gov.AdministrativeScopeFilters;

SELECT name, filter_definition
FROM   sys.indexes
WHERE  object_id = OBJECT_ID('gov.AdministrativeScopeFilters')
  AND  is_unique = 1
  AND  has_filter = 1;
GO

-- ═══════════════════════════════════════════════════════════════════════════
-- Política de nombres de cuenta (Incremento 2.1) — reemplaza la limpieza
-- silenciosa de caracteres (AccountCreationService.Ascii() /
-- accountTypes.ts::normalizeToAscii()) por una regla configurable, única
-- para todo el sistema de creación de cuentas (Genéricas, Partner, Servicio,
-- Extensión, Privilegiadas y cualquier tipo futuro).
--
-- Singleton físico: la tabla solo admite Id=1 — CHECK (Id = 1) + PRIMARY KEY
-- (Id) garantizan que nunca pueda existir una segunda fila, sin depender de
-- la convención de "usar la primera fila". El seed corre una sola vez; a
-- partir de ahí, UpdateAsync es un UPDATE puro sobre Id=1 (la fila siempre
-- existe desde que se aplicó este script) — no hay branch IF EXISTS/INSERT
-- que pueda introducir una carrera en la actualización.
-- ═══════════════════════════════════════════════════════════════════════════

IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = 'AccountNamingPolicy' AND s.name = 'gov'
)
BEGIN
    CREATE TABLE gov.AccountNamingPolicy (
        Id                                   INT           NOT NULL,
        AllowedChars                         NVARCHAR(100) NOT NULL,
        MinLength                            INT           NOT NULL,
        MaxLength                            INT           NOT NULL,
        DisallowLeadingTrailingSpecialChars  BIT           NOT NULL DEFAULT 1,
        DisallowConsecutiveSpecialChars      BIT           NOT NULL DEFAULT 1,
        UpdatedAt                            DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
        UpdatedBy                            NVARCHAR(200) NULL,
        CONSTRAINT PK_Gov_AccountNamingPolicy PRIMARY KEY (Id),
        -- Garantía física de singleton: ninguna fila con Id distinto de 1 puede
        -- existir jamás. Combinado con la PK, es matemáticamente imposible tener
        -- más de una fila en esta tabla.
        CONSTRAINT CK_Gov_AccountNamingPolicy_Singleton CHECK (Id = 1)
    );
END
GO

-- Seed idempotente — semilla segura sugerida en el diseño: minúsculas, dígitos,
-- '-', '.', '_'. MaxLength=20 porque coincide con el límite real de AD para
-- sAMAccountName cuando el tipo de cuenta no agrega prefijo (ver validación de
-- longitud efectiva en AccountNamingPolicyService, que sí considera el prefijo).
IF NOT EXISTS (SELECT 1 FROM gov.AccountNamingPolicy WHERE Id = 1)
    INSERT INTO gov.AccountNamingPolicy
        (Id, AllowedChars, MinLength, MaxLength,
         DisallowLeadingTrailingSpecialChars, DisallowConsecutiveSpecialChars)
    VALUES
        (1, 'abcdefghijklmnopqrstuvwxyz0123456789-._', 3, 20, 1, 1);
GO

-- Verificación (para que un DBA confirme manualmente el resultado):
SELECT COUNT(*) AS AccountNamingPolicy_RowCount FROM gov.AccountNamingPolicy;  -- debe ser exactamente 1
SELECT * FROM gov.AccountNamingPolicy;
GO
