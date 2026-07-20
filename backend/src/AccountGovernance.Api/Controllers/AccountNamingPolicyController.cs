using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AccountGovernance.Api.Controllers;

/// <summary>
/// Política de nombres de cuenta — única para todo el sistema de creación de
/// cuentas. Lectura disponible para cualquier usuario autenticado (la misma
/// población que puede acceder a los formularios de creación, sin gate de rol
/// adicional — igual que AccountCreationController); edición exclusiva de
/// SystemAdmin, auditada en gov.AuditEntries.
/// </summary>
[Authorize]
[ApiController]
[Route("account-naming-policy")]
[Produces("application/json")]
public sealed class AccountNamingPolicyController(
    IAccountNamingPolicyService  svc,
    ICurrentUserService          currentUser,
    ISystemAuthorizationService  systemAuth) : ControllerBase
{
    private async Task<bool> IsSystemAdminAsync(CancellationToken ct)
    {
        var roles = await systemAuth.GetUserRolesAsync(currentUser.UserPrincipalName, ct);
        return roles.Contains("SystemAdmin", StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>Devuelve la política vigente. Cualquier usuario autenticado puede leerla
    /// (la necesita el formulario de creación de cuentas para validar en vivo).</summary>
    [HttpGet]
    [ProducesResponseType(typeof(AccountNamingPolicyDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var result = await svc.GetAsync(ct);
        return result.IsSuccess
            ? Ok(result.Data)
            : StatusCode(StatusCodes.Status500InternalServerError, new { error = result.Error });
    }

    /// <summary>Edita la política. SystemAdmin únicamente.</summary>
    [HttpPut]
    [ProducesResponseType(typeof(AccountNamingPolicyDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Update([FromBody] UpdateAccountNamingPolicyDto dto, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return StatusCode(403, new { error = "Solo el rol SystemAdmin puede administrar la política de nombres de cuenta." });

        var updatedBy = currentUser.UserPrincipalName ?? "sistema";
        var result    = await svc.UpdateAsync(dto, updatedBy, ct);

        return result.IsSuccess ? Ok(result.Data) : BadRequest(new { error = result.Error, code = result.ErrorCode });
    }
}
