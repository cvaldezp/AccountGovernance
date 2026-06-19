namespace AccountGovernance.Application.DTOs;

public sealed record AccountTypeConfigDto(
    int      Id,
    string   TypeKey,
    string   Label,
    string   Description,
    string   Badge,
    bool     IsPrivileged,
    bool     IsActive,
    int      SortOrder,
    string?  SamPrefix,
    string   ExtensionAttribute14,
    string?  TargetOU,
    int      DefaultPasswordLength,
    string   DescriptionTemplate,
    string?  DefaultCompany,
    DateTime UpdatedAt,
    string?  UpdatedBy,
    IReadOnlyList<AccountSubTypeDto> SubTypes
);
