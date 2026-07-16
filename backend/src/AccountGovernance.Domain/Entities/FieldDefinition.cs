using AccountGovernance.Domain.Enums;

namespace AccountGovernance.Domain.Entities;

public sealed class FieldDefinition
{
    public required string    FieldKey        { get; init; }
    public required string    AdAttributeName { get; init; }
    public required string    DisplayName     { get; init; }
    public string             Description     { get; init; } = string.Empty;
    public required FieldType FieldType       { get; init; }
    public bool               IsSensitive     { get; init; }
    public bool               IsActive        { get; init; } = true;
    public int                SortOrder       { get; init; }
    public IReadOnlyList<string>? AllowedValues { get; init; }
    public string?            Placeholder     { get; init; }
    public string?            Category        { get; init; }
    public string?            DataType        { get; init; }
    public bool                RequiresAudit  { get; init; }
    public string?            CreatedBy       { get; init; }
    public string?            UpdatedBy       { get; init; }
    public DateTime           CreatedAt       { get; init; }
    public DateTime           UpdatedAt       { get; init; }
}
