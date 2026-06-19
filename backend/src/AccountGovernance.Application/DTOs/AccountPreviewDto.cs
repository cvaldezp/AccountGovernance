namespace AccountGovernance.Application.DTOs;

public sealed record AccountPreviewRequestDto(
    string  AccountTypeKey,
    string? SubTypeKey,
    string? AccountName,
    string? FirstName,
    string? Apellidos
);

public sealed record AccountPreviewResponseDto(
    string UserPrincipalName,
    string SamAccountName,
    string DisplayName,
    string Company,
    string Description,
    string ExtensionAttribute14
);
