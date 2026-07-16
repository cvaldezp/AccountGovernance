using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Application.Services;
using AccountGovernance.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AccountGovernance.Api.Controllers;

[Authorize]
[ApiController]
[Route("users")]
[Produces("application/json")]
public sealed class UsersController(
    IUserService                 userService,
    ICurrentUserService          currentUser,
    ISystemAuthorizationService  systemAuth) : ControllerBase
{
    /// <summary>Search users by Banner code, institutional email, or sAMAccountName (min 3 chars).</summary>
    [HttpGet("search")]
    [ProducesResponseType(typeof(IReadOnlyList<UserSearchResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Search([FromQuery] string q, CancellationToken ct)
    {
        var result = await userService.SearchAsync(q, ct);

        return result.IsSuccess
            ? Ok(result.Data)
            : BadRequest(new { error = result.Error, code = result.ErrorCode });
    }

    /// <summary>Get the full AD profile for a user by their sAMAccountName.</summary>
    [HttpGet("{samAccountName}")]
    [ProducesResponseType(typeof(UserDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetByAccount(string samAccountName, CancellationToken ct)
    {
        var result = await userService.GetByAccountAsync(samAccountName, ct);
        return result.IsSuccess
            ? Ok(result.Data)
            : NotFound(new { error = result.Error, code = result.ErrorCode });
    }

    /// <summary>
    /// Update a single AD attribute for a user. The role used for the permission
    /// check is resolved server-side from the authenticated session — the same
    /// pattern as /permissions/fields/me — never taken from the request body.
    /// </summary>
    [HttpPatch("{samAccountName}/attributes/{adAttributeName}")]
    [ProducesResponseType(typeof(UpdateUserAttributeResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> UpdateAttribute(
        string samAccountName, string adAttributeName,
        [FromBody] UpdateUserAttributeDto dto, CancellationToken ct)
    {
        var (role, roleError) = await ResolveRoleAsync(ct);
        if (roleError is not null) return roleError;

        var result = await userService.UpdateAttributeAsync(
            samAccountName, adAttributeName, dto, role!.Value,
            currentUser.UserPrincipalName ?? "sistema", ct);

        return result.IsSuccess ? Ok(result.Data) : MapError(result.Error!, result.ErrorCode);
    }

    /// <summary>
    /// Enable or disable a user account. The permission check reuses the same
    /// FieldConfig (gov.RoleFieldPermissions) as the Estado de Cuenta field shown
    /// in the UI — there is no separate permission rule for this action.
    /// </summary>
    [HttpPatch("{samAccountName}/status")]
    [ProducesResponseType(typeof(UpdateAccountStatusResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<IActionResult> UpdateStatus(
        string samAccountName, [FromBody] UpdateAccountStatusDto dto, CancellationToken ct)
    {
        var (role, roleError) = await ResolveRoleAsync(ct);
        if (roleError is not null) return roleError;

        var result = await userService.UpdateAccountStatusAsync(
            samAccountName, dto, role!.Value, currentUser.UserPrincipalName ?? "sistema", ct);

        return result.IsSuccess ? Ok(result.Data) : MapError(result.Error!, result.ErrorCode);
    }

    /// <summary>Resolves the caller's primary system role from their AD group membership —
    /// never from client input. Mirrors PermissionsController.GetMyFields exactly.</summary>
    private async Task<(RoleName? Role, IActionResult? Error)> ResolveRoleAsync(CancellationToken ct)
    {
        var roles       = await systemAuth.GetUserRolesAsync(currentUser.UserPrincipalName, ct);
        var primaryRole = await systemAuth.ResolvePrimaryRoleAsync(roles, ct);

        if (primaryRole is null)
            return (null, BadRequest(new { error = "El usuario no tiene ningún rol de sistema asignado.", code = "NO_ROLE" }));

        if (!Enum.TryParse<RoleName>(primaryRole, ignoreCase: true, out var roleName))
            return (null, BadRequest(new { error = $"Rol '{primaryRole}' no soportado todavía.", code = "UNSUPPORTED_ROLE" }));

        return (roleName, null);
    }

    private IActionResult MapError(string error, string? code) => code switch
    {
        "ATTRIBUTE_NOT_FOUND" or "USER_NOT_FOUND" => NotFound(new { error, code }),
        "PROTECTED_ATTRIBUTE" or "INVALID_VALUE"  => BadRequest(new { error, code }),
        "FORBIDDEN"                               => StatusCode(StatusCodes.Status403Forbidden, new { error, code }),
        "STALE_VALUE"                             => Conflict(new { error, code }),
        "LDAP_WRITE_FAILED"                       => StatusCode(StatusCodes.Status502BadGateway, new { error, code }),
        _                                          => BadRequest(new { error, code }),
    };
}
