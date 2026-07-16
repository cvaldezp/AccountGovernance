using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Entities;
using Microsoft.Extensions.Caching.Memory;

namespace AccountGovernance.Infrastructure.Persistence;

public sealed class FieldDefinitionsCache(
    IPermissionRepository permissionRepository,
    IMemoryCache          cache) : IFieldDefinitionsCache
{
    private const string CacheKey = "gov:field-definitions:active";
    private static readonly TimeSpan Ttl = TimeSpan.FromSeconds(30);

    public async Task<IReadOnlyList<FieldDefinition>> GetActiveAsync(CancellationToken ct = default)
    {
        if (cache.TryGetValue(CacheKey, out IReadOnlyList<FieldDefinition>? cached) && cached is not null)
            return cached;

        var definitions = await permissionRepository.GetFieldDefinitionsAsync(ct);
        cache.Set(CacheKey, definitions, Ttl);
        return definitions;
    }

    public void Invalidate() => cache.Remove(CacheKey);
}
