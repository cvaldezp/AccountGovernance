using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Entities;
using Dapper;

namespace AccountGovernance.Infrastructure.Persistence.Repositories;

public sealed class ExpirationConfigRepository(IDbConnectionFactory db)
    : IExpirationConfigRepository
{
    public async Task<ExpirationGlobalConfig?> GetAsync(CancellationToken ct)
    {
        const string sql = """
            SELECT TOP 1 Id, AllowNoExpiration, AllowCustomDate, AllowedMonthsCsv, UpdatedAt, UpdatedBy
            FROM gov.ExpirationGlobalConfig
            ORDER BY Id
            """;

        using var conn = db.Create();
        return await conn.QuerySingleOrDefaultAsync<ExpirationGlobalConfig>(sql);
    }

    public async Task UpdateAsync(
        bool   allowNoExpiration,
        bool   allowCustomDate,
        string allowedMonthsCsv,
        string updatedBy,
        CancellationToken ct)
    {
        const string sql = """
            IF EXISTS (SELECT 1 FROM gov.ExpirationGlobalConfig)
                UPDATE TOP(1) gov.ExpirationGlobalConfig
                SET AllowNoExpiration = @AllowNoExpiration,
                    AllowCustomDate   = @AllowCustomDate,
                    AllowedMonthsCsv  = @AllowedMonthsCsv,
                    UpdatedAt         = GETUTCDATE(),
                    UpdatedBy         = @UpdatedBy
            ELSE
                INSERT INTO gov.ExpirationGlobalConfig
                    (AllowNoExpiration, AllowCustomDate, AllowedMonthsCsv, UpdatedBy)
                VALUES
                    (@AllowNoExpiration, @AllowCustomDate, @AllowedMonthsCsv, @UpdatedBy);
            """;

        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new
        {
            AllowNoExpiration = allowNoExpiration,
            AllowCustomDate   = allowCustomDate,
            AllowedMonthsCsv  = allowedMonthsCsv,
            UpdatedBy         = updatedBy,
        });
    }
}
