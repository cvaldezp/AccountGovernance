using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AccountGovernance.Api.Controllers;

[Authorize]
[ApiController]
[Route("account-type-configs")]
[Produces("application/json")]
public sealed class AccountTypeConfigController(
    IAccountTypeAdminService    svc,
    IAccountTypeGroupService    groupSvc,
    ICurrentUserService         currentUser,
    ISystemAuthorizationService systemAuth
) : ControllerBase
{
    // Toda la configuración de tipos de cuenta y grupos iniciales (lectura y
    // escritura) es exclusiva de SystemAdmin. El flujo de Creación de Cuentas
    // no depende de este controller — usa GET /account-types (AccountCreationController).
    private const string ForbiddenMessage =
        "Solo el rol SystemAdmin puede administrar tipos de cuenta y grupos iniciales.";

    private Task<bool> IsSystemAdminAsync(CancellationToken ct)
        => systemAuth.IsSystemAdminAsync(currentUser.UserPrincipalName, ct);

    private ObjectResult Forbidden() => StatusCode(403, new { error = ForbiddenMessage });

    /// <summary>Returns all account types with their full configuration. Pass activeOnly=false to include inactive types.</summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(IReadOnlyList<AccountTypeConfigDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll([FromQuery] bool activeOnly = false, CancellationToken ct = default)
    {
        if (!await IsSystemAdminAsync(ct))
            return Forbidden();

        var result = await svc.GetAllAsync(activeOnly, ct);
        return result.IsSuccess ? Ok(result.Data) : StatusCode(500, new { error = result.Error });
    }

    /// <summary>Returns the configuration for a single account type by its key.</summary>
    [HttpGet("{typeKey}")]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(AccountTypeConfigDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetByKey(string typeKey, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return Forbidden();

        var result = await svc.GetByKeyAsync(typeKey, ct);
        return result.IsSuccess
            ? Ok(result.Data)
            : NotFound(new { error = result.Error, code = result.ErrorCode });
    }

    /// <summary>Updates the operational configuration for an account type.</summary>
    [HttpPut("{typeKey}")]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(AccountTypeConfigDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateConfig(
        string typeKey, [FromBody] UpdateAccountTypeConfigDto dto, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return Forbidden();

        if (string.IsNullOrWhiteSpace(dto.ExtensionAttribute14))
            return BadRequest(new { error = "El campo 'extensionAttribute14' es requerido." });

        if (dto.DefaultPasswordLength is < 8 or > 64)
            return BadRequest(new { error = "La longitud de contraseña debe estar entre 8 y 64." });

        var updatedBy = User.Identity?.Name ?? "sistema";
        var result    = await svc.UpdateConfigAsync(typeKey, dto, updatedBy, ct);

        return result.IsSuccess
            ? Ok(result.Data)
            : result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });
    }

    /// <summary>Updates the configuration for a specific privileged account sub-type.</summary>
    [HttpPut("{typeKey}/subtypes/{subTypeKey}")]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(AccountSubTypeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateSubType(
        string typeKey, string subTypeKey, [FromBody] UpdateAccountSubTypeDto dto, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return Forbidden();

        if (string.IsNullOrWhiteSpace(dto.SamPrefix))
            return BadRequest(new { error = "El campo 'samPrefix' es requerido para sub-tipos." });

        if (string.IsNullOrWhiteSpace(dto.ExtensionAttribute14))
            return BadRequest(new { error = "El campo 'extensionAttribute14' es requerido." });

        var result = await svc.UpdateSubTypeAsync(subTypeKey, dto, ct);

        return result.IsSuccess
            ? Ok(result.Data)
            : result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });
    }

    // ── Group endpoints ───────────────────────────────────────────────────────

    /// <summary>Returns type-level groups for an account type (AccountSubTypeId IS NULL).</summary>
    [HttpGet("{typeKey}/groups")]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(IReadOnlyList<AccountTypeGroupDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetGroups(
        string typeKey, [FromQuery] bool activeOnly = false, CancellationToken ct = default)
    {
        if (!await IsSystemAdminAsync(ct))
            return Forbidden();

        var result = await groupSvc.GetGroupsAsync(typeKey, null, activeOnly, ct);
        return result.IsSuccess ? Ok(result.Data) : StatusCode(500, new { error = result.Error });
    }

    /// <summary>Creates a type-level group (applies to all subtypes of this type).</summary>
    [HttpPost("{typeKey}/groups")]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(AccountTypeGroupDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateGroup(
        string typeKey, [FromBody] CreateAccountTypeGroupDto dto, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return Forbidden();

        var updatedBy = User.Identity?.Name ?? "sistema";
        var result    = await groupSvc.CreateGroupAsync(typeKey, dto with { SubTypeKey = null }, updatedBy, ct);

        return result.IsSuccess
            ? StatusCode(201, result.Data)
            : BadRequest(new { error = result.Error });
    }

    /// <summary>Returns subtype-specific groups.</summary>
    [HttpGet("{typeKey}/subtypes/{subTypeKey}/groups")]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(IReadOnlyList<AccountTypeGroupDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSubTypeGroups(
        string typeKey, string subTypeKey, [FromQuery] bool activeOnly = false, CancellationToken ct = default)
    {
        if (!await IsSystemAdminAsync(ct))
            return Forbidden();

        var result = await groupSvc.GetGroupsAsync(typeKey, subTypeKey, activeOnly, ct);
        return result.IsSuccess ? Ok(result.Data) : StatusCode(500, new { error = result.Error });
    }

    /// <summary>Creates a subtype-specific group.</summary>
    [HttpPost("{typeKey}/subtypes/{subTypeKey}/groups")]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(AccountTypeGroupDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateSubTypeGroup(
        string typeKey, string subTypeKey, [FromBody] CreateAccountTypeGroupDto dto, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return Forbidden();

        var updatedBy = User.Identity?.Name ?? "sistema";
        var result    = await groupSvc.CreateGroupAsync(typeKey, dto with { SubTypeKey = subTypeKey }, updatedBy, ct);

        return result.IsSuccess
            ? StatusCode(201, result.Data)
            : BadRequest(new { error = result.Error });
    }

    /// <summary>Updates an existing initial group (any type/subtype).</summary>
    [HttpPut("groups/{id:int}")]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(AccountTypeGroupDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateGroup(
        int id, [FromBody] UpdateAccountTypeGroupDto dto, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return Forbidden();

        var updatedBy = User.Identity?.Name ?? "sistema";
        var result    = await groupSvc.UpdateGroupAsync(id, dto, updatedBy, ct);

        return result.IsSuccess
            ? Ok(result.Data)
            : result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });
    }

    /// <summary>Deletes an initial group by ID.</summary>
    [HttpDelete("groups/{id:int}")]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteGroup(int id, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return Forbidden();

        var result = await groupSvc.DeleteGroupAsync(id, ct);

        return result.IsSuccess
            ? NoContent()
            : result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error });
    }
}
