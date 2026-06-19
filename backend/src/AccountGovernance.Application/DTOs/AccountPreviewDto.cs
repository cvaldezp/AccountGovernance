namespace AccountGovernance.Application.DTOs;

public sealed record AccountPreviewRequestDto(
    string  AccountTypeKey,
    string? SubTypeKey,
    string? FirstName,
    string? LastName1,
    string? LastName2,
    string? ServiceName,
    string? Department,
    string? Company,
    string? Description
);

public sealed record AccountPreviewResponseDto(
    string UserPrincipalName,
    string SamAccountName,
    string DisplayName,
    string Description,
    string ExtensionAttribute14
);
