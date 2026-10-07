using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Entities;
using AccountGovernance.Domain.Enums;

namespace AccountGovernance.Application.Services;

public sealed class RoleResourceAdminService(
    IRoleResourceRepository   repo,
    ISystemRoleRepository     roleRepo,
    IRoleResourceCatalogCache catalogCache,
    IAuditRepository          auditRepository) : IRoleResourceAdminService
{
    private const string SystemAdminRole = "SystemAdmin";

    public async Task<Result<RoleAccessMatrixDto>> GetMatrixAsync(CancellationToken ct = default)
    {
        // Lectura directa (no el caché): la pantalla de administración debe ver
        // siempre el estado real, incluso si alguien tocó la tabla fuera de la app.
        var roles       = await roleRepo.GetAllAsync(ct);
        var resources   = await repo.GetResourcesAsync(ct);
        var permissions = await repo.GetActivePermissionsAsync(ct);

        var roleDtos = roles
            .Where(r => r.IsActive)
            .OrderBy(r => r.Priority)
            .Select(r => new RoleAccessRoleDto(
                r.RoleKey, r.DisplayName,
                string.Equals(r.RoleKey, SystemAdminRole, StringComparison.OrdinalIgnoreCase)))
            .ToList();

        var resourceDtos = resources
            .Where(r => r.IsActive)
            .OrderBy(r => r.SortOrder)
            .Select(r => new RoleAccessResourceDto(
                r.ResourceKey, r.ParentKey, r.ResourceType, r.DisplayName,
                r.Description, r.SortOrder, r.SystemAdminOnly))
            .ToList();

        var grantDtos = permissions
            .Select(p => new RoleAccessGrantDto(p.RoleKey, p.ResourceKey))
            .ToList();

        return Result<RoleAccessMatrixDto>.Ok(new RoleAccessMatrixDto(roleDtos, resourceDtos, grantDtos));
    }

    public async Task<Result<RoleAccessCellDto>> SetAccessAsync(
        string roleKey, string resourceKey, SetRoleAccessDto dto, string performedBy, CancellationToken ct = default)
    {
        var role = await roleRepo.GetByKeyAsync(roleKey, ct);
        if (role is null)
            return Result<RoleAccessCellDto>.Fail("Rol no encontrado.", "ROLE_NOT_FOUND");
        if (!role.IsActive)
            return Result<RoleAccessCellDto>.Fail(
                $"El rol '{roleKey}' está inactivo — actívalo en Roles y Grupos antes de configurar sus accesos.", "ROLE_INACTIVE");

        // SystemAdmin tiene todo siempre (bypass), no tiene filas en la tabla.
        if (string.Equals(role.RoleKey, SystemAdminRole, StringComparison.OrdinalIgnoreCase))
            return Result<RoleAccessCellDto>.Fail(
                "SystemAdmin tiene acceso a todo siempre; sus accesos no se configuran.", "SYSTEM_ADMIN_FIXED");

        var resources = await repo.GetResourcesAsync(ct);
        var resource  = resources.FirstOrDefault(
            r => string.Equals(r.ResourceKey, resourceKey, StringComparison.OrdinalIgnoreCase));
        if (resource is null || !resource.IsActive)
            return Result<RoleAccessCellDto>.Fail("Módulo o acción no encontrado.", "RESOURCE_NOT_FOUND");
        if (resource.SystemAdminOnly)
            return Result<RoleAccessCellDto>.Fail(
                $"'{resource.DisplayName}' es exclusivo de SystemAdmin y no se puede delegar a otro rol.", "NOT_DELEGABLE");

        // Una fila por par en toda su vida: se crea la primera vez que se otorga,
        // después solo cambia IsActive (sin DELETE, mismo patrón que RoleScopeAssignments).
        var existing = await repo.GetPermissionAsync(role.Id, resource.ResourceKey, ct);
        var current  = existing?.IsActive ?? false;
        if (current == dto.Granted)
            return Result<RoleAccessCellDto>.Fail(
                $"'{resource.DisplayName}' ya está {(dto.Granted ? "otorgado" : "revocado")} para el rol '{role.RoleKey}'.",
                "NO_STATE_CHANGE");

        if (existing is null)
            await repo.CreatePermissionAsync(role.Id, resource.ResourceKey, performedBy, ct);
        else
            await repo.SetPermissionStatusAsync(existing.Id, dto.Granted, performedBy, ct);

        // El cambio se refleja en el próximo /auth/me sin esperar el TTL.
        catalogCache.Invalidate();

        await auditRepository.AddEntryAsync(new AuditEntry
        {
            Id          = Guid.NewGuid().ToString(),
            Timestamp   = DateTime.UtcNow,
            PerformedBy = performedBy,
            RoleName    = RoleName.SystemAdmin,
            ActionType  = dto.Granted ? AuditActionType.RoleResourceGranted : AuditActionType.RoleResourceRevoked,
            FieldKey    = resource.ResourceKey,
            OldValue    = Describe(role.RoleKey, resource, current),
            NewValue    = Describe(role.RoleKey, resource, dto.Granted),
            TargetUser  = role.RoleKey,
            Domain      = "SYSTEM",
            Success     = true,
        }, ct);

        return Result<RoleAccessCellDto>.Ok(new RoleAccessCellDto(role.RoleKey, resource.ResourceKey, dto.Granted));
    }

    // Igual que RoleScopeAssignmentService.DescribeRelation: TargetUser=RoleKey podría
    // leerse como una cuenta de usuario, así que Old/NewValue describen la relación completa.
    private static string Describe(string roleKey, AppResource resource, bool granted) =>
        $"Rol '{roleKey}' → '{resource.DisplayName}' ({(granted ? "otorgado" : "sin acceso")})";
}
