using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AccountGovernance.Api.Controllers;

/// <summary>
/// Administra gov.AdministrativeScopes / gov.AdministrativeScopeFilters — Incremento 1
/// del modelo de Scope. Sin enforcement todavía: estos ámbitos no restringen ninguna
/// operación real hasta que se implementen RoleScopeAssignment y el scope-check
/// (incrementos posteriores). Mutaciones restringidas a SystemAdmin.
/// </summary>
[Authorize]
[ApiController]
[Route("administrative-scopes")]
[Produces("application/json")]
public sealed class AdministrativeScopesController(
    IAdministrativeScopeService  scopeService,
    ICurrentUserService          currentUser,
    ISystemAuthorizationService  systemAuth) : ControllerBase
{
    private async Task<bool> IsSystemAdminAsync(CancellationToken ct)
    {
        var roles = await systemAuth.GetUserRolesAsync(currentUser.UserPrincipalName, ct);
        return roles.Contains("SystemAdmin", StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>Lista todos los ámbitos administrativos (activos e inactivos).</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<AdministrativeScopeDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var result = await scopeService.GetAllAsync(ct);
        return result.IsSuccess
            ? Ok(result.Data)
            : StatusCode(StatusCodes.Status500InternalServerError, new { error = result.Error });
    }

    /// <summary>Obtiene un ámbito administrativo por su ScopeKey.</summary>
    [HttpGet("{scopeKey}")]
    [ProducesResponseType(typeof(AdministrativeScopeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetByKey(string scopeKey, CancellationToken ct)
    {
        var result = await scopeService.GetByKeyAsync(scopeKey, ct);
        return result.IsSuccess ? Ok(result.Data) : NotFound(new { error = result.Error });
    }

    /// <summary>Crea un nuevo ámbito administrativo. SystemAdmin únicamente.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(AdministrativeScopeDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Create([FromBody] CreateAdministrativeScopeDto dto, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return StatusCode(403, new { error = "Solo el rol SystemAdmin puede administrar ámbitos administrativos." });

        var createdBy = currentUser.UserPrincipalName ?? "sistema";
        var result    = await scopeService.CreateAsync(dto, createdBy, ct);

        return result.IsSuccess ? StatusCode(201, result.Data) : BadRequest(new { error = result.Error, code = result.ErrorCode });
    }

    /// <summary>Edita un ámbito administrativo existente. SystemAdmin únicamente.</summary>
    [HttpPut("{scopeKey}")]
    [ProducesResponseType(typeof(AdministrativeScopeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        string scopeKey, [FromBody] UpdateAdministrativeScopeDto dto, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return StatusCode(403, new { error = "Solo el rol SystemAdmin puede administrar ámbitos administrativos." });

        var updatedBy = currentUser.UserPrincipalName ?? "sistema";
        var result    = await scopeService.UpdateAsync(scopeKey, dto, updatedBy, ct);

        return result.IsSuccess
            ? Ok(result.Data)
            : result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });
    }

    /// <summary>Activa o inactiva un ámbito administrativo. SystemAdmin únicamente.
    /// Al activar, valida BaseDn contra AD real y que los filtros activos estén completos.</summary>
    [HttpPatch("{scopeKey}/status")]
    [ProducesResponseType(typeof(AdministrativeScopeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetStatus(
        string scopeKey, [FromBody] UpdateAdministrativeScopeStatusDto dto, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return StatusCode(403, new { error = "Solo el rol SystemAdmin puede administrar ámbitos administrativos." });

        var updatedBy = currentUser.UserPrincipalName ?? "sistema";
        var result    = await scopeService.SetStatusAsync(scopeKey, dto, updatedBy, ct);

        return result.IsSuccess
            ? Ok(result.Data)
            : result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });
    }

    // ── Filters ──────────────────────────────────────────────────────────────

    /// <summary>Agrega un filtro de pertenencia a un ámbito. SystemAdmin únicamente.</summary>
    [HttpPost("{scopeKey}/filters")]
    [ProducesResponseType(typeof(AdministrativeScopeFilterDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateFilter(
        string scopeKey, [FromBody] CreateAdministrativeScopeFilterDto dto, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return StatusCode(403, new { error = "Solo el rol SystemAdmin puede administrar ámbitos administrativos." });

        var updatedBy = currentUser.UserPrincipalName ?? "sistema";
        var result    = await scopeService.CreateFilterAsync(scopeKey, dto, updatedBy, ct);

        return result.IsSuccess
            ? StatusCode(201, result.Data)
            : result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });
    }

    /// <summary>Edita un filtro existente. SystemAdmin únicamente.</summary>
    [HttpPut("{scopeKey}/filters/{filterId:int}")]
    [ProducesResponseType(typeof(AdministrativeScopeFilterDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateFilter(
        string scopeKey, int filterId, [FromBody] UpdateAdministrativeScopeFilterDto dto, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return StatusCode(403, new { error = "Solo el rol SystemAdmin puede administrar ámbitos administrativos." });

        var updatedBy = currentUser.UserPrincipalName ?? "sistema";
        var result    = await scopeService.UpdateFilterAsync(scopeKey, filterId, dto, updatedBy, ct);

        return result.IsSuccess
            ? Ok(result.Data)
            : result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });
    }

    /// <summary>Elimina un filtro. SystemAdmin únicamente.</summary>
    [HttpDelete("{scopeKey}/filters/{filterId:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteFilter(string scopeKey, int filterId, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return StatusCode(403, new { error = "Solo el rol SystemAdmin puede administrar ámbitos administrativos." });

        var performedBy = currentUser.UserPrincipalName ?? "sistema";
        var result       = await scopeService.DeleteFilterAsync(scopeKey, filterId, performedBy, ct);

        return result.IsSuccess
            ? NoContent()
            : result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });
    }
}
