namespace AccountGovernance.Application.DTOs;

public sealed record AuditEntryDto(
    string   Id,
    DateTime Timestamp,
    string   PerformedBy,
    string   RoleName,
    string   ActionType,
    string?  FieldKey,
    string?  OldValue,
    string?  NewValue,
    string   TargetUser,
    string   Domain,
    bool     Success,
    string?  Notes
);
