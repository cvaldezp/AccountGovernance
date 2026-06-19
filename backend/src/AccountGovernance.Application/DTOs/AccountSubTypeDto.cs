namespace AccountGovernance.Application.DTOs;

public sealed record AccountSubTypeDto(
    string  SubTypeKey,
    string  Label,
    string  SamPrefix,
    string  ExtensionAttribute14,
    string? TargetOU,
    bool    IsActive
);
