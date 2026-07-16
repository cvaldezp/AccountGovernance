using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AccountGovernance.Api.Controllers;

[Authorize]
[ApiController]
[Route("users")]
[Produces("application/json")]
public sealed class UsersController(IUserService userService) : ControllerBase
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
}
