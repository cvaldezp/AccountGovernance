namespace AccountGovernance.Application.DTOs;

/// <summary>
/// Single request DTO shared by validate-create and create endpoints.
/// Password is never logged or persisted in audit.
/// </summary>
public sealed record AccountCreationRequestDto(
    string  AccountTypeKey,
    string? SubTypeKey,
    string? AccountName,
    string? FirstName,
    string? Apellidos,
    string? RecoveryEmail,
    string? Password,
    string? Description
);

public sealed record ValidationChecksDto(
    bool  ConfigFound,
    bool? SamAvailable,
    bool? UpnAvailable,
    bool? RecoveryEmailValid,
    bool  PasswordValid,
    bool? OuValid
);

public sealed record ValidateCreateAccountResponseDto(
    bool                       CanCreate,
    IReadOnlyList<string>      Errors,
    IReadOnlyList<string>      Warnings,
    AccountPreviewResponseDto? Preview,
    ValidationChecksDto?       Checks
);

public sealed record CreateAccountResponseDto(
    bool    Success,
    string  Message,
    string? SamAccountName,
    string? UserPrincipalName,
    string? DisplayName,
    IReadOnlyList<GroupAssignmentResultDto>? GroupAssignments = null
);
