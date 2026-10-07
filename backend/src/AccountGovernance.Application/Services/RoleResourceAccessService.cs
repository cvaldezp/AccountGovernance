using AccountGovernance.Application.Interfaces;

namespace AccountGovernance.Application.Services;

public sealed class RoleResourceAccessService(IRoleResourceCatalogCache catalog) : IRoleResourceAccessService
{
    private const string SystemAdminRole = "SystemAdmin";

    public async Task<IReadOnlyList<string>> GetAllowedResourcesAsync(
        IReadOnlyList<string> roles, CancellationToken ct = default)
    {
        if (roles.Count == 0)
            return [];

        var snapshot = await catalog.GetSnapshotAsync(ct);
        var active   = snapshot.Resources.Where(r => r.IsActive).ToList();

        // Mismo bypass SYSTEM_ADMIN_BYPASS que los Incrementos A–D: no consulta la tabla.
        if (roles.Contains(SystemAdminRole, StringComparer.OrdinalIgnoreCase))
            return active.OrderBy(r => r.SortOrder).Select(r => r.ResourceKey).ToList();

        var roleSet  = new HashSet<string>(roles, StringComparer.OrdinalIgnoreCase);
        var granted  = snapshot.Permissions
            .Where(p => p.IsActive && roleSet.Contains(p.RoleKey))
            .Select(p => p.ResourceKey)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        // Defensa en profundidad: un recurso no delegable nunca se otorga por tabla,
        // aunque alguien inserte la fila a mano en SQL.
        var delegable = active.Where(r => !r.SystemAdminOnly && granted.Contains(r.ResourceKey)).ToList();
        var effective = delegable.Select(r => r.ResourceKey).ToHashSet(StringComparer.OrdinalIgnoreCase);

        // Una acción solo es efectiva si el rol también tiene su módulo padre.
        return delegable
            .Where(r => r.ParentKey is null || effective.Contains(r.ParentKey))
            .OrderBy(r => r.SortOrder)
            .Select(r => r.ResourceKey)
            .ToList();
    }

    public async Task<bool> HasAccessAsync(
        IReadOnlyList<string> roles, string resourceKey, CancellationToken ct = default)
    {
        var allowed = await GetAllowedResourcesAsync(roles, ct);
        return allowed.Contains(resourceKey, StringComparer.OrdinalIgnoreCase);
    }
}
