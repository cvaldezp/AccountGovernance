using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;

namespace AccountGovernance.Application.Services;

public interface IAccountCreationService
{
    Task<Result<IReadOnlyList<AccountTypeDto>>>    GetAccountTypesAsync(CancellationToken ct);
    Task<Result<ValidateRecoveryEmailResponseDto>> ValidateRecoveryEmailAsync(ValidateRecoveryEmailRequestDto request, CancellationToken ct);
    Task<Result<AccountPreviewResponseDto>>        PreviewAccountAsync(AccountPreviewRequestDto request, CancellationToken ct);

    Task<Result<ValidateCreateAccountResponseDto>> ValidateCreateAsync(AccountCreationRequestDto request, CancellationToken ct);
    Task<Result<CreateAccountResponseDto>>         CreateAsync(AccountCreationRequestDto request, string operatorUpn, CancellationToken ct);
}
