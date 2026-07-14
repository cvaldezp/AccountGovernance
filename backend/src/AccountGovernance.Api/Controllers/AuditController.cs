using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AccountGovernance.Api.Controllers;

[Authorize]
[ApiController]
[Route("audit")]
[Produces("application/json")]
public sealed class AuditController(IAuditService auditService) : ControllerBase
{
    /// <summary>
    /// Retrieve audit log entries with optional filters and server-side pagination.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetEntries(
        [FromQuery] string?   targetUser = null,
        [FromQuery] string?   actionType = null,
        [FromQuery] string?   roleName   = null,
        [FromQuery] DateOnly? dateFrom   = null,
        [FromQuery] DateOnly? dateTo     = null,
        [FromQuery] int       page       = 1,
        [FromQuery] int       pageSize   = 10,
        CancellationToken     ct         = default)
    {
        var filters = new AuditFiltersDto(
            TargetUser: targetUser,
            ActionType: actionType,
            RoleName:   roleName,
            DateFrom:   dateFrom,
            DateTo:     dateTo,
            Page:       Math.Max(1, page),
            PageSize:   Math.Clamp(pageSize, 1, 100));

        var result = await auditService.GetEntriesAsync(filters, ct);
        return result.IsSuccess
            ? Ok(result.Data)
            : StatusCode(StatusCodes.Status500InternalServerError, new { error = result.Error });
    }
}
