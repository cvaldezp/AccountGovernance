using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Application.Services;
using AccountGovernance.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AccountGovernance.Api.Controllers;

[Authorize]
[ApiController]
[Route("permissions")]
[Produces("application/json")]
public sealed class PermissionsController(
    IPermissionService           permissionService,
    ICurrentUserService          currentUser,
    ISystemAuthorizationService  systemAuth) : ControllerBase
{
    private async Task<bool> IsSystemAdminAsync(CancellationToken ct)
    {
        var roles = await systemAuth.GetUserRolesAsync(currentUser.UserPrincipalName, ct);
        return roles.Contains("SystemAdmin", StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Return visible/editable field configuration for the caller's own resolved role.
    /// The role is never taken from client input — resolved server-side from the
    /// authenticated user's AD group membership, same as /auth/me.
    /// </summary>
    [HttpGet("fields/me")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetMyFields(CancellationToken ct)
    {
        var roles       = await systemAuth.GetUserRolesAsync(currentUser.UserPrincipalName, ct);
        var primaryRole = await systemAuth.ResolvePrimaryRoleAsync(roles, ct);

        if (primaryRole is null)
            return BadRequest(new { error = "El usuario no tiene ningún rol de sistema asignado.", code = "NO_ROLE" });

        if (!Enum.TryParse<RoleName>(primaryRole, ignoreCase: true, out var roleName))
            return BadRequest(new { error = $"Rol '{primaryRole}' no soportado todavía.", code = "UNSUPPORTED_ROLE" });

        var result = await permissionService.GetFieldsForRoleAsync(roleName, ct);
        return result.IsSuccess ? Ok(result.Data) : BadRequest(new { error = result.Error });
    }

    /// <summary>Return the full N-field × 4-role permissions matrix.</summary>
    [HttpGet("matrix")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMatrix(CancellationToken ct)
    {
        var result = await permissionService.GetMatrixAsync(ct);
        return result.IsSuccess
            ? Ok(result.Data)
            : StatusCode(StatusCodes.Status500InternalServerError, new { error = result.Error });
    }

    // ── Attribute admin (CRUD) — mutaciones restringidas a SystemAdmin ──────

    /// <summary>List every AD attribute managed by the portal (active and inactive).</summary>
    [HttpGet("attributes")]
    [ProducesResponseType(typeof(IReadOnlyList<AttributeDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllAttributes(CancellationToken ct)
    {
        var result = await permissionService.GetAllAttributesAsync(ct);
        return result.IsSuccess
            ? Ok(result.Data)
            : StatusCode(StatusCodes.Status500InternalServerError, new { error = result.Error });
    }

    /// <summary>Get a single AD attribute definition.</summary>
    [HttpGet("attributes/{fieldKey}")]
    [ProducesResponseType(typeof(AttributeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetAttributeByKey(string fieldKey, CancellationToken ct)
    {
        var result = await permissionService.GetAttributeByKeyAsync(fieldKey, ct);
        return result.IsSuccess ? Ok(result.Data) : NotFound(new { error = result.Error });
    }

    /// <summary>Create a new AD attribute definition. SystemAdmin only.</summary>
    [HttpPost("attributes")]
    [ProducesResponseType(typeof(AttributeDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateAttribute([FromBody] CreateAttributeDto dto, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return StatusCode(403, new { error = "Solo el rol SystemAdmin puede administrar atributos AD." });

        var createdBy = currentUser.UserPrincipalName ?? "sistema";
        var result    = await permissionService.CreateAttributeAsync(dto, createdBy, ct);

        return result.IsSuccess ? StatusCode(201, result.Data) : BadRequest(new { error = result.Error });
    }

    /// <summary>Edit an existing AD attribute definition. SystemAdmin only.</summary>
    [HttpPut("attributes/{fieldKey}")]
    [ProducesResponseType(typeof(AttributeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateAttribute(
        string fieldKey, [FromBody] UpdateAttributeDto dto, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return StatusCode(403, new { error = "Solo el rol SystemAdmin puede administrar atributos AD." });

        var updatedBy = currentUser.UserPrincipalName ?? "sistema";
        var result    = await permissionService.UpdateAttributeAsync(fieldKey, dto, updatedBy, ct);

        return result.IsSuccess
            ? Ok(result.Data)
            : result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });
    }

    /// <summary>Activate or deactivate an AD attribute. SystemAdmin only.</summary>
    [HttpPatch("attributes/{fieldKey}/status")]
    [ProducesResponseType(typeof(AttributeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetAttributeStatus(
        string fieldKey, [FromBody] UpdateAttributeStatusDto dto, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return StatusCode(403, new { error = "Solo el rol SystemAdmin puede administrar atributos AD." });

        var updatedBy = currentUser.UserPrincipalName ?? "sistema";
        var result    = await permissionService.SetAttributeStatusAsync(fieldKey, dto, updatedBy, ct);

        return result.IsSuccess
            ? Ok(result.Data)
            : result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });
    }

    /// <summary>Edit a single permissions-matrix cell (role × attribute). SystemAdmin only.</summary>
    [HttpPut("matrix/{roleKey}/{fieldKey}")]
    [ProducesResponseType(typeof(RolePermissionCellDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateRolePermission(
        string roleKey, string fieldKey, [FromBody] UpdateRolePermissionDto dto, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return StatusCode(403, new { error = "Solo el rol SystemAdmin puede administrar atributos AD." });

        var updatedBy = currentUser.UserPrincipalName ?? "sistema";
        var result    = await permissionService.UpdateRolePermissionAsync(roleKey, fieldKey, dto, updatedBy, ct);

        return result.IsSuccess
            ? Ok(result.Data)
            : result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });
    }
}
