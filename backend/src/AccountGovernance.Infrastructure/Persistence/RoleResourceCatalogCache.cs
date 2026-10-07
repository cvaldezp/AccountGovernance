using AccountGovernance.Application.Interfaces;
using Microsoft.Extensions.Caching.Memory;

namespace AccountGovernance.Infrastructure.Persistence;

public sealed class RoleResourceCatalogCache(
    IRoleResourceRepository repository,
    IMemoryCache            cache) : IRoleResourceCatalogCache
{
    private const string CacheKey = "gov:role-resources:snapshot";
    private static readonly TimeSpan Ttl = TimeSpan.FromSeconds(30);

    public async Task<RoleResourceSnapshot> GetSnapshotAsync(CancellationToken ct = default)
    {
        if (cache.TryGetValue(CacheKey, out RoleResourceSnapshot? cached) && cached is not null)
            return cached;

        var snapshot = new RoleResourceSnapshot(
            await repository.GetResourcesAsync(ct),
            await repository.GetActivePermissionsAsync(ct));
        cache.Set(CacheKey, snapshot, Ttl);
        return snapshot;
    }

    public void Invalidate() => cache.Remove(CacheKey);
}
