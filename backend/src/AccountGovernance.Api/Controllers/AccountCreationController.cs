using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Services;
using Microsoft.AspNetCore.Mvc;

namespace AccountGovernance.Api.Controllers;

[ApiController]
[Route("api")]
[Produces("application/json")]
public sealed class AccountCreationController(IAccountCreationService svc) : ControllerBase
{
    /// <summary>Returns the list of supported account types with their metadata.</summary>
    [HttpGet("account-types")]
    [ProducesResponseType(typeof(IReadOnlyList<AccountTypeDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAccountTypes(CancellationToken ct)
    {
        var result = await svc.GetAccountTypesAsync(ct);
        return result.IsSuccess
            ? Ok(result.Data)
            : StatusCode(500, new { error = result.Error });
    }

    /// <summary>Validates a recovery email against Active Directory (mock in dev mode).</summary>
    [HttpPost("accounts/validate-recovery-email")]
    [ProducesResponseType(typeof(ValidateRecoveryEmailResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ValidateRecoveryEmail(
        [FromBody] ValidateRecoveryEmailRequestDto request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest(new { error = "El campo 'email' es requerido." });

        var result = await svc.ValidateRecoveryEmailAsync(request, ct);
        return result.IsSuccess
            ? Ok(result.Data)
            : BadRequest(new { error = result.Error });
    }

    /// <summary>Computes a preview of the AD attributes for the new account without creating it.</summary>
    [HttpPost("accounts/preview")]
    [ProducesResponseType(typeof(AccountPreviewResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> PreviewAccount(
        [FromBody] AccountPreviewRequestDto request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.AccountTypeKey))
            return BadRequest(new { error = "El campo 'accountTypeKey' es requerido." });

        var result = await svc.PreviewAccountAsync(request, ct);
        return result.IsSuccess
            ? Ok(result.Data)
            : BadRequest(new { error = result.Error, code = result.ErrorCode });
    }
}
