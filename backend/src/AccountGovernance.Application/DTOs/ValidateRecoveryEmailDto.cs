namespace AccountGovernance.Application.DTOs;

public sealed record ValidateRecoveryEmailRequestDto(string Email);

public sealed record ValidateRecoveryEmailResponseDto(
    bool    IsValid,
    string  Message,
    string? UserDisplayName
);
