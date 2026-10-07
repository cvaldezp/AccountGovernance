using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AccountGovernance.Api.Controllers;

/// <summary>
/// Configuración → Accesos por Rol: qué módulos/acciones (gov.AppResources) tiene
/// cada rol. Exclusivo de SystemAdmin (recurso config.role-access, no delegable) —
/// estas filas controlan lo que todos los demás roles pueden hacer.
/// </summary>
[Authorize]
[ApiController]
[Route("role-access")]
[Produces("application/json")]
public sealed class RoleAccessController(
    IRoleResourceAdminService    svc,
    ICurrentUserService          currentUser,
    ISystemAuthorizationService  systemAuth
) : ControllerBase
{
    private const string ForbiddenMessage = "Solo el rol SystemAdmin puede administrar los accesos por rol.";

    private Task<bool> IsSystemAdminAsync(CancellationToken ct)
        => systemAuth.IsSystemAdminAsync(currentUser.UserPrincipalName, ct);

    /// <summary>Matriz completa: roles activos × módulos/acciones activos + celdas otorgadas.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(RoleAccessMatrixDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetMatrix(CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return StatusCode(403, new { error = ForbiddenMessage });

        var result = await svc.GetMatrixAsync(ct);
        return result.IsSuccess ? Ok(result.Data) : StatusCode(500, new { error = result.Error });
    }

    /// <summary>Otorga o revoca un módulo/acción a un rol.</summary>
    [HttpPut("{roleKey}/{resourceKey}")]
    [ProducesResponseType(typeof(RoleAccessCellDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetAccess(
        string roleKey, string resourceKey, [FromBody] SetRoleAccessDto dto, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return StatusCode(403, new { error = ForbiddenMessage });

        var performedBy = currentUser.UserPrincipalName ?? "sistema";
        var result      = await svc.SetAccessAsync(roleKey, resourceKey, dto, performedBy, ct);

        if (result.IsSuccess)
            return Ok(result.Data);

        return result.ErrorCode is "ROLE_NOT_FOUND" or "RESOURCE_NOT_FOUND"
            ? NotFound(new { error = result.Error, code = result.ErrorCode })
            : BadRequest(new { error = result.Error, code = result.ErrorCode });
    }
}
