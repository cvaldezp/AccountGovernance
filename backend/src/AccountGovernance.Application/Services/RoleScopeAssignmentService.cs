using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Entities;
using AccountGovernance.Domain.Enums;

namespace AccountGovernance.Application.Services;

public sealed class RoleScopeAssignmentService(
    IRoleScopeAssignmentRepository  repo,
    ISystemRoleRepository           roleRepo,
    IAdministrativeScopeRepository  scopeRepo,
    IAuditRepository                auditRepository) : IRoleScopeAssignmentService
{
    public async Task<Result<IReadOnlyList<RoleScopeAssignmentDto>>> GetAllAsync(
        string? roleKey, string? scopeKey, CancellationToken ct = default)
    {
        var rows = await repo.GetAllAsync(roleKey, scopeKey, ct);
        return Result<IReadOnlyList<RoleScopeAssignmentDto>>.Ok(rows.Select(ToDto).ToList());
    }

    public async Task<Result<RoleScopeAssignmentDto>> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var row = await repo.GetByIdAsync(id, ct);
        return row is null
            ? Result<RoleScopeAssignmentDto>.Fail("Asignación no encontrada.", "NOT_FOUND")
            : Result<RoleScopeAssignmentDto>.Ok(ToDto(row));
    }

    public async Task<Result<RoleScopeAssignmentDto>> CreateAsync(
        CreateRoleScopeAssignmentDto dto, string performedBy, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.RoleKey))
            return Result<RoleScopeAssignmentDto>.Fail("El rol (RoleKey) es obligatorio.", "VALIDATION");
        if (string.IsNullOrWhiteSpace(dto.ScopeKey))
            return Result<RoleScopeAssignmentDto>.Fail("El ámbito (ScopeKey) es obligatorio.", "VALIDATION");

        var role = await roleRepo.GetByKeyAsync(dto.RoleKey, ct);
        if (role is null)
            return Result<RoleScopeAssignmentDto>.Fail("Rol no encontrado.", "ROLE_NOT_FOUND");
        if (!role.IsActive)
            return Result<RoleScopeAssignmentDto>.Fail(
                $"El rol '{dto.RoleKey}' está inactivo — actívalo antes de asignarle un ámbito.", "ROLE_INACTIVE");

        var scope = await scopeRepo.GetByKeyAsync(dto.ScopeKey, ct);
        if (scope is null)
            return Result<RoleScopeAssignmentDto>.Fail("Ámbito no encontrado.", "SCOPE_NOT_FOUND");
        if (!scope.IsActive)
            return Result<RoleScopeAssignmentDto>.Fail(
                $"El ámbito '{dto.ScopeKey}' está inactivo — actívalo antes de asignarlo a un rol.", "SCOPE_INACTIVE");

        // La relación es única en toda su vida (UQ_Gov_RoleScopeAssignments_Pair
        // sin filtro) — si ya existe una fila para este par, nunca se crea una
        // segunda: se distingue si está activa (duplicado real) o inactiva
        // (debe reactivarse vía PATCH, no recrearse).
        var existing = await repo.GetByRoleAndScopeAsync(role.Id, scope.Id, ct);
        if (existing is not null)
        {
            return existing.IsActive
                ? Result<RoleScopeAssignmentDto>.Fail(
                    $"El rol '{dto.RoleKey}' ya tiene asignado el ámbito '{dto.ScopeKey}'.", "DUPLICATE_ASSIGNMENT")
                : Result<RoleScopeAssignmentDto>.Fail(
                    $"Ya existe una asignación inactiva entre '{dto.RoleKey}' y '{dto.ScopeKey}' — reactívala con PATCH en vez de crear una nueva.",
                    "ASSIGNMENT_EXISTS_INACTIVE");
        }

        var now = DateTime.UtcNow;
        var assignment = new RoleScopeAssignment
        {
            SystemRoleId          = role.Id,
            AdministrativeScopeId = scope.Id,
            IsActive              = true,
            CreatedBy             = performedBy,
            UpdatedBy             = performedBy,
            CreatedAt             = now,
            UpdatedAt             = now,
        };

        int id;
        try
        {
            id = await repo.CreateAsync(assignment, ct);
        }
        catch (DuplicateAssignmentException)
        {
            // Defensa en profundidad: dos requests concurrentes podrían pasar el
            // chequeo de arriba al mismo tiempo — el repositorio traduce la
            // violación de UQ_Gov_RoleScopeAssignments_Pair a esta excepción de
            // Application, sin que este servicio dependa de Microsoft.Data.SqlClient.
            return Result<RoleScopeAssignmentDto>.Fail(
                $"El rol '{dto.RoleKey}' ya tiene una asignación registrada con el ámbito '{dto.ScopeKey}'.", "DUPLICATE_ASSIGNMENT");
        }

        var created = await repo.GetByIdAsync(id, ct);
        if (created is null)
            return Result<RoleScopeAssignmentDto>.Fail("Error al recuperar la asignación creada.", "DB_ERROR");

        await LogAuditAsync(
            AuditActionType.RoleScopeAssigned, created.RoleKey, created.ScopeKey, performedBy,
            oldValue: null, newValue: DescribeRelation(created.RoleKey, created.ScopeKey, isActive: true), ct);

        return Result<RoleScopeAssignmentDto>.Ok(ToDto(created));
    }

    public async Task<Result<RoleScopeAssignmentDto>> SetStatusAsync(
        int id, UpdateRoleScopeAssignmentStatusDto dto, string performedBy, CancellationToken ct = default)
    {
        var existing = await repo.GetByIdAsync(id, ct);
        if (existing is null)
            return Result<RoleScopeAssignmentDto>.Fail("Asignación no encontrada.", "NOT_FOUND");

        // Un PATCH que no cambia el estado no es una mutación real — se rechaza
        // en vez de generar una entrada de auditoría vacía de significado
        // ("se activó" cuando ya estaba activa no describe ningún cambio real).
        if (existing.IsActive == dto.IsActive)
            return Result<RoleScopeAssignmentDto>.Fail(
                $"La asignación entre '{existing.RoleKey}' y '{existing.ScopeKey}' ya está {(dto.IsActive ? "activa" : "inactiva")}.",
                "NO_STATE_CHANGE");

        // Se permite desactivar la última asignación activa de un rol — sin
        // enforcement todavía, no tiene ningún efecto operativo. El futuro
        // incremento de enforcement deberá incluir un preflight de roles sin
        // ninguna asignación activa antes de habilitarse.
        await repo.SetStatusAsync(id, dto.IsActive, performedBy, ct);

        await LogAuditAsync(
            dto.IsActive ? AuditActionType.RoleScopeActivated : AuditActionType.RoleScopeDeactivated,
            existing.RoleKey, existing.ScopeKey, performedBy,
            oldValue: DescribeRelation(existing.RoleKey, existing.ScopeKey, existing.IsActive),
            newValue: DescribeRelation(existing.RoleKey, existing.ScopeKey, dto.IsActive), ct);

        return await GetByIdAsync(id, ct);
    }

    // ── Auditoría ────────────────────────────────────────────────────────────

    /// <summary>Registra una mutación de asignación en gov.AuditEntries — misma tabla que el
    /// resto del sistema. RoleName se fija en SystemAdmin porque estas mutaciones ya están
    /// restringidas a ese rol (mismo patrón que AdministrativeScopeService.LogScopeAuditAsync).
    /// ScopeKey viaja en FieldKey (columna genérica reutilizada, mismo patrón ya usado para
    /// filterId); RoleKey viaja en TargetUser — es el recurso administrado por esta acción.
    /// TargetUser=RoleKey podría leerse como si esto fuera una acción sobre una
    /// cuenta de usuario (la columna se llama TargetUser en todo el resto del
    /// sistema) — por eso Old/NewValue nunca son un simple "Active"/"Inactive"
    /// suelto (que en esta misma tabla también usan EnableAccount/DisableAccount
    /// para el estado de una cuenta AD): siempre describen explícitamente la
    /// relación Rol ↔ Ámbito completa vía DescribeRelation, para que la entrada
    /// sea inequívoca leída de forma aislada.</summary>
    private async Task LogAuditAsync(
        AuditActionType actionType, string roleKey, string scopeKey, string performedBy,
        string? oldValue, string? newValue, CancellationToken ct)
    {
        await auditRepository.AddEntryAsync(new AuditEntry
        {
            Id          = Guid.NewGuid().ToString(),
            Timestamp   = DateTime.UtcNow,
            PerformedBy = performedBy,
            RoleName    = RoleName.SystemAdmin,
            ActionType  = actionType,
            FieldKey    = scopeKey,
            OldValue    = oldValue,
            NewValue    = newValue,
            TargetUser  = roleKey,
            Domain      = "SYSTEM",
            Success     = true,
        }, ct);
    }

    private static string DescribeRelation(string roleKey, string scopeKey, bool isActive) =>
        $"Rol '{roleKey}' ↔ Ámbito '{scopeKey}' ({(isActive ? "activa" : "inactiva")})";

    private static RoleScopeAssignmentDto ToDto(RoleScopeAssignment a) => new(
        a.Id, a.RoleKey, a.ScopeKey, a.IsActive, a.CreatedAt, a.CreatedBy, a.UpdatedAt, a.UpdatedBy);
}
