namespace AccountGovernance.Application.DTOs;

public sealed record UpdateAccountSubTypeDto(
    string  SamPrefix,
    string  ExtensionAttribute14,
    string? TargetOU,
    bool    IsActive
);
