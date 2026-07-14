using AccountGovernance.Application.Services;
using AccountGovernance.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AccountGovernance.Api.Controllers;

[Authorize]
[ApiController]
[Route("permissions")]
[Produces("application/json")]
public sealed class PermissionsController(IPermissionService permissionService) : ControllerBase
{
    /// <summary>
    /// Return visible/editable field configuration for the given role.
    /// <para>⚠ In production the role will come from the JWT claims — query param is a dev placeholder.</para>
    /// </summary>
    [HttpGet("fields/me")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetMyFields([FromQuery] string role, CancellationToken ct)
    {
        if (!Enum.TryParse<RoleName>(role, ignoreCase: true, out var roleName))
            return BadRequest(new { error = $"Unknown role '{role}'.", code = "INVALID_ROLE" });

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
}
