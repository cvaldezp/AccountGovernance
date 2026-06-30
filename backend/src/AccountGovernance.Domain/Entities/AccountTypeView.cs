namespace AccountGovernance.Domain.Entities;

/// <summary>Read-only joined view of gov.AccountTypes + gov.AccountTypeConfigurations + gov.AccountSubTypes.</summary>
public sealed record AccountTypeView(
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
    DateTime ConfigUpdatedAt,
    string?  ConfigUpdatedBy,
    string?  DepartmentPrefix,
    IReadOnlyList<AccountSubTypeInfo> SubTypes
);
