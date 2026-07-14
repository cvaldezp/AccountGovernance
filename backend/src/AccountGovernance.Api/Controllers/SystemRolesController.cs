using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AccountGovernance.Api.Controllers;

/// <summary>
/// Manages gov.SystemRoles / gov.SystemRoleGroups — the AD-group-to-role mappings
/// SystemAuthorizationService uses to authorize every /api/auth/me call.
/// Restricted to the SystemAdmin role — hiding this screen in the frontend is not
/// enough, since these tables control every other user's access.
/// </summary>
[Authorize]
[ApiController]
[Route("system-roles")]
[Produces("application/json")]
public sealed class SystemRolesController(
    ISystemRoleService           svc,
    ICurrentUserService          currentUser,
    ISystemAuthorizationService  systemAuth
) : ControllerBase
{
    private async Task<bool> IsSystemAdminAsync(CancellationToken ct)
    {
        var roles = await systemAuth.GetUserRolesAsync(currentUser.UserPrincipalName, ct);
        return roles.Contains("SystemAdmin", StringComparer.OrdinalIgnoreCase);
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<SystemRoleDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return StatusCode(403, new { error = "Solo el rol SystemAdmin puede administrar roles y grupos." });

        var result = await svc.GetAllAsync(ct);
        return result.IsSuccess ? Ok(result.Data) : StatusCode(500, new { error = result.Error });
    }

    [HttpGet("{roleKey}")]
    [ProducesResponseType(typeof(SystemRoleDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetByKey(string roleKey, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return StatusCode(403, new { error = "Solo el rol SystemAdmin puede administrar roles y grupos." });

        var result = await svc.GetByKeyAsync(roleKey, ct);
        return result.IsSuccess ? Ok(result.Data) : NotFound(new { error = result.Error });
    }

    [HttpPut("{roleKey}")]
    [ProducesResponseType(typeof(SystemRoleDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        string roleKey, [FromBody] UpdateSystemRoleDto dto, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return StatusCode(403, new { error = "Solo el rol SystemAdmin puede administrar roles y grupos." });

        var updatedBy = currentUser.UserPrincipalName ?? "sistema";
        var result    = await svc.UpdateAsync(roleKey, dto, updatedBy, ct);

        return result.IsSuccess
            ? Ok(result.Data)
            : result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });
    }

    [HttpPost("{roleKey}/groups")]
    [ProducesResponseType(typeof(SystemRoleGroupDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateGroup(
        string roleKey, [FromBody] CreateSystemRoleGroupDto dto, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return StatusCode(403, new { error = "Solo el rol SystemAdmin puede administrar roles y grupos." });

        var updatedBy = currentUser.UserPrincipalName ?? "sistema";
        var result    = await svc.CreateGroupAsync(roleKey, dto, updatedBy, ct);

        return result.IsSuccess
            ? StatusCode(201, result.Data)
            : result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });
    }

    [HttpPut("{roleKey}/groups/{id:int}")]
    [ProducesResponseType(typeof(SystemRoleGroupDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateGroup(
        string roleKey, int id, [FromBody] UpdateSystemRoleGroupDto dto, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return StatusCode(403, new { error = "Solo el rol SystemAdmin puede administrar roles y grupos." });

        var updatedBy = currentUser.UserPrincipalName ?? "sistema";
        var result    = await svc.UpdateGroupAsync(roleKey, id, dto, updatedBy, ct);

        return result.IsSuccess
            ? Ok(result.Data)
            : result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });
    }

    [HttpDelete("{roleKey}/groups/{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteGroup(string roleKey, int id, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return StatusCode(403, new { error = "Solo el rol SystemAdmin puede administrar roles y grupos." });

        var result = await svc.DeleteGroupAsync(roleKey, id, ct);

        return result.IsSuccess
            ? NoContent()
            : result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });
    }
}
