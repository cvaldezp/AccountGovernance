using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AccountGovernance.Api.Controllers;

/// <summary>
/// Distribution lists are read live from Active Directory — nothing about a list or its
/// membership is persisted. Only membership changes are recorded, via IDistributionListService,
/// in gov.AuditEntries. Access follows the same AD-group-derived roles every other screen uses:
/// SystemAdmin/Seguridades can read and modify, DragonHelp/Registro can only read, RRHH has no access.
/// </summary>
[Authorize]
[ApiController]
[Route("distribution-lists")]
[Produces("application/json")]
public sealed class DistributionListsController(
    IDistributionListService     svc,
    ICurrentUserService          currentUser,
    ISystemAuthorizationService  systemAuth
) : ControllerBase
{
    private static readonly string[] WriteRoles = ["SystemAdmin", "Seguridades"];
    private static readonly string[] ReadRoles   = ["SystemAdmin", "Seguridades", "DragonHelp", "Registro"];

    private async Task<bool> HasAccessAsync(string[] allowedRoles, CancellationToken ct)
    {
        var roles = await systemAuth.GetUserRolesAsync(currentUser.UserPrincipalName, ct);
        return roles.Any(r => allowedRoles.Contains(r, StringComparer.OrdinalIgnoreCase));
    }

    private const string ReadDeniedMessage =
        "No tienes acceso a Listas de Distribución.";
    private const string WriteDeniedMessage =
        "Solo SystemAdmin y Seguridades pueden modificar listas de distribución.";

    [HttpGet("search")]
    [ProducesResponseType(typeof(IReadOnlyList<DistributionListSummaryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Search([FromQuery] string q, CancellationToken ct)
    {
        if (!await HasAccessAsync(ReadRoles, ct))
            return StatusCode(403, new { error = ReadDeniedMessage });

        var result = await svc.SearchAsync(q, ct);
        return result.IsSuccess ? Ok(result.Data) : BadRequest(new { error = result.Error, code = result.ErrorCode });
    }

    [HttpGet("detail")]
    [ProducesResponseType(typeof(DistributionListDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetDetail([FromQuery] string dn, CancellationToken ct)
    {
        if (!await HasAccessAsync(ReadRoles, ct))
            return StatusCode(403, new { error = ReadDeniedMessage });

        var result = await svc.GetDetailAsync(dn, ct);
        return result.IsSuccess ? Ok(result.Data) : NotFound(new { error = result.Error, code = result.ErrorCode });
    }

    [HttpGet("members")]
    [ProducesResponseType(typeof(IReadOnlyList<DistributionListMemberDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetMembers([FromQuery] string dn, CancellationToken ct)
    {
        if (!await HasAccessAsync(ReadRoles, ct))
            return StatusCode(403, new { error = ReadDeniedMessage });

        var result = await svc.GetMembersAsync(dn, ct);
        return result.IsSuccess ? Ok(result.Data) : BadRequest(new { error = result.Error, code = result.ErrorCode });
    }

    [HttpPost("members")]
    [ProducesResponseType(typeof(DistributionListMemberDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> AddMember(
        [FromBody] AddDistributionListMemberRequestDto dto, CancellationToken ct)
    {
        if (!await HasAccessAsync(WriteRoles, ct))
            return StatusCode(403, new { error = WriteDeniedMessage });

        var operatorUpn = currentUser.UserPrincipalName ?? "sistema";
        var result      = await svc.AddMemberAsync(dto.ListDn, dto.MemberAccount, operatorUpn, ct);

        return result.IsSuccess
            ? StatusCode(201, result.Data)
            : BadRequest(new { error = result.Error, code = result.ErrorCode });
    }

    [HttpPost("members/remove")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> RemoveMember(
        [FromBody] RemoveDistributionListMemberRequestDto dto, CancellationToken ct)
    {
        if (!await HasAccessAsync(WriteRoles, ct))
            return StatusCode(403, new { error = WriteDeniedMessage });

        var operatorUpn = currentUser.UserPrincipalName ?? "sistema";
        var result      = await svc.RemoveMemberAsync(dto.ListDn, dto.MemberDn, operatorUpn, ct);

        return result.IsSuccess ? NoContent() : BadRequest(new { error = result.Error, code = result.ErrorCode });
    }
}
