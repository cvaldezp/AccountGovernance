using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AccountGovernance.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/auth")]
[Produces("application/json")]
public sealed class AuthController(
    ICurrentUserService         currentUser,
    ISystemAuthorizationService systemAuth
) : ControllerBase
{
    /// <summary>
    /// Returns the authenticated user's profile and their system roles,
    /// derived from on-premises Active Directory group memberships.
    /// </summary>
    [HttpGet("me")]
    [ProducesResponseType(typeof(MeResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetMe(CancellationToken ct)
    {
        var roles = await systemAuth.GetUserRolesAsync(currentUser.UserPrincipalName, ct);

        return Ok(new MeResponseDto(
            Upn:         currentUser.UserPrincipalName ?? string.Empty,
            DisplayName: currentUser.DisplayName,
            Email:       currentUser.Email,
            ObjectId:    currentUser.ObjectId,
            Roles:       [.. roles]
        ));
    }
}
