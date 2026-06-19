namespace AccountGovernance.Domain.Entities;

public sealed record AccountSubTypeInfo(
    int     Id,
    string  SubTypeKey,
    string  Label,
    string  SamPrefix,
    string  ExtensionAttribute14,
    string? TargetOU,
    bool    IsActive,
    int     SortOrder
);
