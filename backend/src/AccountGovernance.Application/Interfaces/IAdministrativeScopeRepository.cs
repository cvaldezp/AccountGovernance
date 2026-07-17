using AccountGovernance.Domain.Entities;

namespace AccountGovernance.Application.Interfaces;

/// <summary>Persistencia para gov.AdministrativeScopes / gov.AdministrativeScopeFilters.</summary>
public interface IAdministrativeScopeRepository
{
    Task<IReadOnlyList<AdministrativeScope>> GetAllAsync(CancellationToken ct = default);

    Task<AdministrativeScope?> GetByKeyAsync(string scopeKey, CancellationToken ct = default);

    Task<bool> ExistsByKeyAsync(string scopeKey, CancellationToken ct = default);

    Task<int> CreateAsync(AdministrativeScope scope, CancellationToken ct = default);

    Task UpdateAsync(AdministrativeScope scope, CancellationToken ct = default);

    Task SetStatusAsync(string scopeKey, bool isActive, string updatedBy, CancellationToken ct = default);

    // ── Filters ──────────────────────────────────────────────────────────────

    Task<IReadOnlyList<AdministrativeScopeFilter>> GetFiltersByScopeKeyAsync(
        string scopeKey, CancellationToken ct = default);

    Task<AdministrativeScopeFilter?> GetFilterByIdAsync(int id, CancellationToken ct = default);

    Task<int> CreateFilterAsync(AdministrativeScopeFilter filter, CancellationToken ct = default);

    Task UpdateFilterAsync(AdministrativeScopeFilter filter, CancellationToken ct = default);

    Task DeleteFilterAsync(int id, CancellationToken ct = default);
}
