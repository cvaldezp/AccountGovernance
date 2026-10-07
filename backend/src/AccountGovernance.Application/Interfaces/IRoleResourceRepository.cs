using AccountGovernance.Domain.Entities;

namespace AccountGovernance.Application.Interfaces;

/// <summary>Persistencia para gov.AppResources / gov.RoleResourcePermissions.</summary>
public interface IRoleResourceRepository
{
    /// <summary>Todo el catálogo, activo e inactivo, ordenado por SortOrder.</summary>
    Task<IReadOnlyList<AppResource>> GetResourcesAsync(CancellationToken ct = default);

    /// <summary>Permisos activos de roles activos (con RoleKey poblado).</summary>
    Task<IReadOnlyList<RoleResourcePermission>> GetActivePermissionsAsync(CancellationToken ct = default);
}
