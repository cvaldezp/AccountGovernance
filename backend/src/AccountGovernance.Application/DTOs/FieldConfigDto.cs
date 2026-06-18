namespace AccountGovernance.Application.DTOs;

public sealed record FieldConfigDto(
    string                  FieldKey,
    string                  AdAttributeName,
    string                  DisplayName,
    string                  Description,
    string                  FieldType,
    bool                    IsSensitive,
    bool                    CanView,
    bool                    CanEdit,
    int                     SortOrder,
    IReadOnlyList<string>?  AllowedValues,
    string?                 Placeholder
);
