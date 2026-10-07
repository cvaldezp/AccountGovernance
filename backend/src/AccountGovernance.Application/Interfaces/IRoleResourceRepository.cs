using AccountGovernance.Domain.Entities;

namespace AccountGovernance.Application.Interfaces;

/// <summary>Persistencia para gov.AppResources / gov.RoleResourcePermissions.</summary>
public interface IRoleResourceRepository
{
    /// <summary>Todo el catálogo, activo e inactivo, ordenado por SortOrder.</summary>
    Task<IReadOnlyList<AppResource>> GetResourcesAsync(CancellationToken ct = default);

    /// <summary>Permisos activos de roles activos (con RoleKey poblado).</summary>
    Task<IReadOnlyList<RoleResourcePermission>> GetActivePermissionsAsync(CancellationToken ct = default);

    /// <summary>La única fila posible para este par, activa o inactiva — la relación es
    /// única en toda su vida (UQ_Gov_RoleResourcePermissions_Pair).</summary>
    Task<RoleResourcePermission?> GetPermissionAsync(
        int systemRoleId, string resourceKey, CancellationToken ct = default);

    Task CreatePermissionAsync(
        int systemRoleId, string resourceKey, string createdBy, CancellationToken ct = default);

    Task SetPermissionStatusAsync(
        int id, bool isActive, string updatedBy, CancellationToken ct = default);
}
