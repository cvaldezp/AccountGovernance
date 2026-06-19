namespace AccountGovernance.Application.DTOs;

public sealed record AccountTypeDto(
    string   Key,
    string   Label,
    string   Description,
    string   Badge,
    string   ExtensionAttribute14,
    bool     IsPrivileged,
    int      DefaultPasswordLength,
    IReadOnlyList<AccountSubTypeDto> SubTypes
);
