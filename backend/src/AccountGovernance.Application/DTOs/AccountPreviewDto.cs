namespace AccountGovernance.Application.DTOs;

public sealed record AccountPreviewRequestDto(
    string  AccountTypeKey,
    string? SubTypeKey,
    string? AccountName,
    string? FirstName,
    string? Apellidos
);

public sealed record AccountPreviewResponseDto(
    string  UserPrincipalName,
    string  SamAccountName,
    string  DisplayName,
    string  Company,
    string  Description,
    string  ExtensionAttribute14,
    string? GivenName,
    string? Sn,
    string? RecoveryEmail,
    string? TargetOU,
    string  AccountTypeKey,
    string  AccountTypeLabel,
    string? SubTypeKey,
    string? SubTypeLabel,
    string? Mail,
    string? Department,
    string? ManagerDn,
    string? ManagerDisplayName,
    IReadOnlyList<InitialGroupPreviewDto>? InitialGroups = null
);
