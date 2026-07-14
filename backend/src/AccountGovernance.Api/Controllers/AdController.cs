using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AccountGovernance.Api.Controllers;

[Authorize]
[ApiController]
[Route("ad")]
[Produces("application/json")]
public sealed class AdController(IAccountTypeGroupService groupSvc) : ControllerBase
{
    /// <summary>Validates that an AD group exists and returns its properties (name, DN, GUID, SID, type).</summary>
    [HttpPost("groups/validate")]
    [ProducesResponseType(typeof(ValidateAdGroupResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ValidateGroup(
        [FromBody] ValidateAdGroupRequestDto dto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.Query))
            return BadRequest(new { error = "El campo 'query' es obligatorio." });

        var result = await groupSvc.ValidateAdGroupAsync(dto.Query, ct);
        return result.IsSuccess ? Ok(result.Data) : StatusCode(500, new { error = result.Error });
    }
}
