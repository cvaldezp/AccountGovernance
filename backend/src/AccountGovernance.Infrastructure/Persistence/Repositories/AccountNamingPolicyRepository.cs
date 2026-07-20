using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Entities;
using Dapper;

namespace AccountGovernance.Infrastructure.Persistence.Repositories;

public sealed class AccountNamingPolicyRepository(IDbConnectionFactory db) : IAccountNamingPolicyRepository
{
    public async Task<AccountNamingPolicy> GetAsync(CancellationToken ct = default)
    {
        const string sql = """
            SELECT Id, AllowedChars, MinLength, MaxLength,
                   DisallowLeadingTrailingSpecialChars, DisallowConsecutiveSpecialChars,
                   UpdatedAt, UpdatedBy
            FROM   gov.AccountNamingPolicy
            WHERE  Id = 1
            """;

        using var conn = db.Create();
        // QuerySingleAsync (no OrDefault): la fila siempre existe tras el seed —
        // si esto lanza, es una señal real de que el schema no se aplicó, no un
        // caso a tolerar en silencio.
        return await conn.QuerySingleAsync<AccountNamingPolicy>(sql);
    }

    public async Task UpdateAsync(AccountNamingPolicy policy, CancellationToken ct = default)
    {
        const string sql = """
            UPDATE gov.AccountNamingPolicy
            SET    AllowedChars                        = @AllowedChars,
                   MinLength                            = @MinLength,
                   MaxLength                            = @MaxLength,
                   DisallowLeadingTrailingSpecialChars  = @DisallowLeadingTrailingSpecialChars,
                   DisallowConsecutiveSpecialChars      = @DisallowConsecutiveSpecialChars,
                   UpdatedAt                            = @UpdatedAt,
                   UpdatedBy                            = @UpdatedBy
            WHERE  Id = 1
            """;

        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new
        {
            policy.AllowedChars,
            policy.MinLength,
            policy.MaxLength,
            policy.DisallowLeadingTrailingSpecialChars,
            policy.DisallowConsecutiveSpecialChars,
            policy.UpdatedAt,
            policy.UpdatedBy,
        });
    }
}
