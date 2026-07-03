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
    ISystemAuthorizationService systemAuth,
    ILogger<AuthController>     logger
) : ControllerBase
{
    /// <summary>
    /// Returns the authenticated user's profile and their system roles,
    /// derived from on-premises Active Directory group memberships.
    /// IsAuthorized is false when the user matches no configured AD group —
    /// the frontend must block access in that case.
    /// </summary>
    [HttpGet("me")]
    [ProducesResponseType(typeof(MeResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetMe(CancellationToken ct)
    {
        // TEMP LOG — remove once claim resolution is validated end-to-end.
        // Logs claim types/values from the validated token, never the raw JWT itself.
        var claimsSummary = string.Join(" | ", User.Claims.Select(c => $"{c.Type}={c.Value}"));
        logger.LogInformation("[AUTH] Claims disponibles en el token: {Claims}", claimsSummary);

        // TEMP LOG — remove once role/authorization resolution is validated end-to-end.
        logger.LogInformation("[AUTH] Usuario autenticado: {Upn}", currentUser.UserPrincipalName);

        var roles        = await systemAuth.GetUserRolesAsync(currentUser.UserPrincipalName, ct);
        var isAuthorized = roles.Count > 0;
        var primaryRole  = await systemAuth.ResolvePrimaryRoleAsync(roles, ct);

        // TEMP LOG — remove once role/authorization resolution is validated end-to-end.
        logger.LogInformation(
            "[AUTH] Roles recibidos para {Upn}: [{Roles}]",
            currentUser.UserPrincipalName, string.Join(", ", roles));
        logger.LogInformation("[AUTH] Rol primario resuelto para {Upn}: {PrimaryRole}",
            currentUser.UserPrincipalName, primaryRole);
        logger.LogInformation(
            isAuthorized ? "[AUTH] Usuario autorizado: {Upn}" : "[AUTH] Usuario sin autorización: {Upn}",
            currentUser.UserPrincipalName);

        return Ok(new MeResponseDto(
            Upn:          currentUser.UserPrincipalName ?? string.Empty,
            DisplayName:  currentUser.DisplayName,
            Email:        currentUser.Email,
            ObjectId:     currentUser.ObjectId,
            Roles:        [.. roles],
            PrimaryRole:  primaryRole,
            Permissions:  [], // reserved for future action-level grants
            IsAuthorized: isAuthorized
        ));
    }
}
