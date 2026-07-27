using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AccountGovernance.Api.Controllers;

/// <summary>
/// Administra gov.RoleScopeAssignments — Incremento 3 del modelo de Scope:
/// asigna Ámbitos Administrativos a roles del sistema. Sin enforcement
/// todavía: estas asignaciones no restringen ninguna operación real hasta que
/// se implemente el scope-check sobre operaciones de usuario (incremento
/// posterior). Controlador dedicado (no anidado bajo /system-roles ni
/// /administrative-scopes) porque la relación es genuinamente muchos-a-muchos
/// y se consulta simétricamente desde ambos lados (?roleKey=, ?scopeKey=).
/// Toda la API — incluida la lectura — restringida a SystemAdmin, mismo
/// criterio que AdministrativeScopesController. Sin DELETE: la baja es
/// exclusivamente PATCH .../status — la fila se conserva siempre para
/// trazabilidad y posible reactivación.
/// </summary>
[Authorize]
[ApiController]
[Route("role-scope-assignments")]
[Produces("application/json")]
public sealed class RoleScopeAssignmentsController(
    IRoleScopeAssignmentService  service,
    ICurrentUserService          currentUser,
    ISystemAuthorizationService  systemAuth) : ControllerBase
{
    private Task<bool> IsSystemAdminAsync(CancellationToken ct)
        => systemAuth.IsSystemAdminAsync(currentUser.UserPrincipalName, ct);

    /// <summary>Lista asignaciones, con filtros opcionales por rol y/o ámbito. SystemAdmin únicamente.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<RoleScopeAssignmentDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? roleKey, [FromQuery] string? scopeKey, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return StatusCode(403, new { error = "Solo el rol SystemAdmin puede administrar asignaciones de ámbito." });

        var result = await service.GetAllAsync(roleKey, scopeKey, ct);
        return result.IsSuccess
            ? Ok(result.Data)
            : StatusCode(StatusCodes.Status500InternalServerError, new { error = result.Error });
    }

    /// <summary>Obtiene una asignación por Id. SystemAdmin únicamente.</summary>
    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(RoleScopeAssignmentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        // El gate corre antes de tocar el servicio — mismo criterio que
        // AdministrativeScopesController.GetByKey: un caller no-SystemAdmin
        // recibe siempre el mismo 403, sin importar si el id existe o no.
        if (!await IsSystemAdminAsync(ct))
            return StatusCode(403, new { error = "Solo el rol SystemAdmin puede administrar asignaciones de ámbito." });

        var result = await service.GetByIdAsync(id, ct);
        return result.IsSuccess ? Ok(result.Data) : NotFound(new { error = result.Error });
    }

    /// <summary>Asigna un ámbito a un rol. Exige que ambos existan y estén activos. SystemAdmin únicamente.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(RoleScopeAssignmentDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Create([FromBody] CreateRoleScopeAssignmentDto dto, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return StatusCode(403, new { error = "Solo el rol SystemAdmin puede administrar asignaciones de ámbito." });

        var performedBy = currentUser.UserPrincipalName ?? "sistema";
        var result      = await service.CreateAsync(dto, performedBy, ct);

        return result.IsSuccess ? StatusCode(201, result.Data) : BadRequest(new { error = result.Error, code = result.ErrorCode });
    }

    /// <summary>Activa o inactiva una asignación existente. No elimina físicamente — la fila
    /// se conserva siempre para trazabilidad y posible reactivación. SystemAdmin únicamente.</summary>
    [HttpPatch("{id:int}/status")]
    [ProducesResponseType(typeof(RoleScopeAssignmentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetStatus(
        int id, [FromBody] UpdateRoleScopeAssignmentStatusDto dto, CancellationToken ct)
    {
        if (!await IsSystemAdminAsync(ct))
            return StatusCode(403, new { error = "Solo el rol SystemAdmin puede administrar asignaciones de ámbito." });

        var performedBy = currentUser.UserPrincipalName ?? "sistema";
        var result      = await service.SetStatusAsync(id, dto, performedBy, ct);

        return result.IsSuccess
            ? Ok(result.Data)
            : result.ErrorCode == "NOT_FOUND"
                ? NotFound(new { error = result.Error })
                : BadRequest(new { error = result.Error, code = result.ErrorCode });
    }
}
