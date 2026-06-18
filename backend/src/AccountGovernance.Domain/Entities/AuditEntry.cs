using AccountGovernance.Domain.Enums;

namespace AccountGovernance.Domain.Entities;

public sealed class AuditEntry
{
    public required string          Id          { get; init; }
    public required DateTime        Timestamp   { get; init; }
    public required string          PerformedBy { get; init; }
    public required RoleName        RoleName    { get; init; }
    public required AuditActionType ActionType  { get; init; }
    public string?                  FieldKey    { get; init; }
    public string?                  OldValue    { get; init; }
    public string?                  NewValue    { get; init; }
    public required string          TargetUser  { get; init; }
    public required string          Domain      { get; init; }
    public required bool            Success     { get; init; }
    public string?                  Notes       { get; init; }
}
