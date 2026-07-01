using AccountGovernance.Domain.Entities;

namespace AccountGovernance.Application.Interfaces;

public interface IExpirationConfigRepository
{
    /// <summary>Returns the singleton config row, or null if no row has been seeded yet.</summary>
    Task<ExpirationGlobalConfig?> GetAsync(CancellationToken ct);

    Task UpdateAsync(
        bool   allowNoExpiration,
        bool   allowCustomDate,
        string allowedMonthsCsv,
        string updatedBy,
        CancellationToken ct);
}
