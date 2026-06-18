# Backend — Entidades de Dominio

## `User` (`AccountGovernance.Domain.Entities`)

Modelo de dominio que representa un usuario de Active Directory. No contiene lógica de negocio.

| Propiedad | Tipo | Atributo LDAP | Notas |
|-----------|------|---------------|-------|
| `SamAccountName` | `string` (required) | `sAMAccountName` | Identificador principal |
| `DisplayName` | `string` (required) | `displayName` | |
| `GivenName` | `string?` | `givenName` | |
| `Surname` | `string?` | `sn` | |
| `UserPrincipalName` | `string?` | `userPrincipalName` | |
| `CustomBannerID` | `string?` | `CustomBannerID` | Código Banner institucional |
| `Email` | `string?` | `mail` | |
| `ExternalEmail` | `string?` | `Custom-External-Email-Address` | |
| `TelephoneNumber` | `string?` | `telephoneNumber` | |
| `Mobile` | `string?` | `mobile` | |
| `Company` | `string?` | `company` | |
| `Department` | `string?` | `department` | |
| `JobTitle` | `string?` | `title` | |
| `Manager` | `string?` | `manager` | DN del manager |
| `Office` | `string?` | `physicalDeliveryOfficeName` | |
| `ExtensionAttribute1` | `string?` | `extensionAttribute1` | |
| `ExtensionAttribute2` | `string?` | `extensionAttribute2` | |
| `ExtensionAttribute3` | `string?` | `extensionAttribute3` | |
| `UserAccountControl` | `int?` | `userAccountControl` | Raw UAC flags |
| `IsEnabled` | `bool` | — | Derivado: UAC bit 2 = 0 |
| `WhenCreated` | `DateTime?` | `whenCreated` | LDAP Generalized Time |
| `WhenChanged` | `DateTime?` | `whenChanged` | LDAP Generalized Time |
| `LastLogon` | `DateTime?` | `lastLogonTimestamp` | LDAP FileTime |
| `DistinguishedName` | `string?` | `distinguishedName` | |
| `RawAttributes` | `IReadOnlyDictionary<string, string?>` | — | Solo en detalle completo |

## `FieldDefinition` (`gov.FieldDefinitions`)

Define un atributo AD configurable desde la base de datos.

| Propiedad | Tipo |
|-----------|------|
| `Id` | `int` |
| `FieldKey` | `string` |
| `AdAttributeName` | `string` |
| `DisplayName` | `string` |
| `Description` | `string` |
| `FieldType` | `FieldType` (enum) |
| `IsSensitive` | `bool` |
| `IsActive` | `bool` |
| `SortOrder` | `int` |

## `RoleFieldPermission` (`gov.RoleFieldPermissions`)

Matriz de permisos: qué rol puede ver/editar qué campo.

| Propiedad | Tipo |
|-----------|------|
| `Id` | `int` |
| `RoleName` | `RoleName` (enum) |
| `FieldDefinitionId` | `int` |
| `CanView` | `bool` |
| `CanEdit` | `bool` |
| `IsActive` | `bool` |

## `AuditEntry` (`gov.AuditEntries`)

Registro inmutable de cada acción realizada en el sistema.

| Propiedad | Tipo |
|-----------|------|
| `Id` | `long` |
| `Timestamp` | `DateTime` |
| `OperatorSamAccountName` | `string` |
| `OperatorRole` | `RoleName` |
| `ActionType` | `AuditActionType` |
| `TargetSamAccountName` | `string` |
| `FieldKey` | `string?` |
| `OldValue` | `string?` |
| `NewValue` | `string?` |
| `Success` | `bool` |
| `ErrorMessage` | `string?` |
