using AccountGovernance.Domain.Entities;

namespace AccountGovernance.Application.Interfaces;

/// <summary>Catálogo de recursos + permisos activos, leídos juntos.</summary>
public sealed record RoleResourceSnapshot(
    IReadOnlyList<AppResource>            Resources,
    IReadOnlyList<RoleResourcePermission> Permissions);

/// <summary>
/// Caché de corta duración de gov.AppResources + gov.RoleResourcePermissions —
/// se consulta en cada /auth/me (y, en la fase 3, en cada request protegido),
/// así que no debe ir a SQL cada vez. Mismo patrón que IFieldDefinitionsCache:
/// invalidación explícita tras cada mutación, TTL solo como respaldo.
/// </summary>
public interface IRoleResourceCatalogCache
{
    Task<RoleResourceSnapshot> GetSnapshotAsync(CancellationToken ct = default);

    void Invalidate();
}
