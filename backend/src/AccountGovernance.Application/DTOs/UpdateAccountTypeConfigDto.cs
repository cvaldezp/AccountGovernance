namespace AccountGovernance.Application.DTOs;

public sealed record UpdateAccountTypeConfigDto(
    string?  SamPrefix,
    string   ExtensionAttribute14,
    string?  TargetOU,
    int      DefaultPasswordLength,
    string   DescriptionTemplate,
    bool     IsActive
);
