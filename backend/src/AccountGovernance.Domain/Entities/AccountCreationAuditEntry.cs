namespace AccountGovernance.Domain.Entities;

/// <summary>
/// Immutable audit record written to gov.AccountCreationAudit after each creation attempt.
/// Password is NEVER included.
/// </summary>
public sealed record AccountCreationAuditEntry(
    string   Operator,
    string   AccountTypeKey,
    string?  SubTypeKey,
    string   AccountName,
    string   SamAccountName,
    string   Upn,
    string?  DisplayName,
    string?  Company,
    string?  Description,
    string?  ExtAttr14,
    string?  TargetOU,
    string?  RecoveryEmail,
    bool     Success,
    string?  ErrorMessage
);
