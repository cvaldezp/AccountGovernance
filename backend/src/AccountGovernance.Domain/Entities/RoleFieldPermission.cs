using AccountGovernance.Domain.Enums;

namespace AccountGovernance.Domain.Entities;

public sealed class RoleFieldPermission
{
    public required RoleName RoleName  { get; init; }
    public required string   FieldKey  { get; init; }
    public required bool     CanView   { get; init; }
    public required bool     CanEdit   { get; init; }
    public required bool     IsActive  { get; init; }
    public DateTime          UpdatedAt { get; init; }
    public string?           UpdatedBy { get; init; }
}
