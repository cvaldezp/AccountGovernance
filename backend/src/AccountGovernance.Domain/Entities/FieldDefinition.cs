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
}
