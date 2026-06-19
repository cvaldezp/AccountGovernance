using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Services;
using Microsoft.AspNetCore.Mvc;

namespace AccountGovernance.Api.Controllers;

[ApiController]
[Route("api/account-type-configs")]
[Produces("application/json")]
public sealed class AccountTypeConfigController(IAccountTypeAdminService svc) : ControllerBase
{
    /// <summary>Returns all account types with their full configuration. Pass activeOnly=false to include inactive types.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<AccountTypeConfigDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll([FromQuery] bool activeOnly = false, CancellationToken ct = default)
    {
        var result = await svc.GetAllAsync(activeOnly, ct);
        return result.IsSuccess ? Ok(result.Data) : StatusCode(500, new { error = result.Error });
    }

    /// <summary>Returns the configuration for a single account type by its key.</summary>
    [HttpGet("{typeKey}")]
    [ProducesResponseType(typeof(AccountTypeConfigDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetByKey(string typeKey, CancellationToken ct)
    {
        var result = await svc.GetByKeyAsync(typeKey, ct);
        return result.IsSuccess
            ? Ok(result.Data)
            : NotFound(new { error = result.Error, code = result.ErrorCode });
    }

    /// <summary>Updates the operational configuration for an account type. Does not modify the type label or description.</summary>
    [HttpPut("{typeKey}")]
    [ProducesResponseType(typeof(AccountTypeConfigDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateConfig(
        string typeKey, [FromBody] UpdateAccountTypeConfigDto dto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.ExtensionAttribute14))
            return BadRequest(new { error = "El campo 'extensionAttribute14' es requerido." });

        if (dto.DefaultPasswordLength is < 8 or > 64)
            return BadRequest(new { error = "La longitud de contraseña debe estar entre 8 y 64." });

        var updatedBy = User.Identity?.Name ?? "sistema";
        var result    = await svc.UpdateConfigAsync(typeKey, dto, updatedBy, ct);

        return result.IsSuccess
            ? Ok(result.Data)
            : result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });
    }

    /// <summary>Updates the configuration for a specific privileged account sub-type (prefix, EA14, TargetOU, IsActive).</summary>
    [HttpPut("{typeKey}/subtypes/{subTypeKey}")]
    [ProducesResponseType(typeof(AccountSubTypeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateSubType(
        string typeKey, string subTypeKey, [FromBody] UpdateAccountSubTypeDto dto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.SamPrefix))
            return BadRequest(new { error = "El campo 'samPrefix' es requerido para sub-tipos." });

        if (string.IsNullOrWhiteSpace(dto.ExtensionAttribute14))
            return BadRequest(new { error = "El campo 'extensionAttribute14' es requerido." });

        var result = await svc.UpdateSubTypeAsync(subTypeKey, dto, ct);

        return result.IsSuccess
            ? Ok(result.Data)
            : result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });
    }
}
