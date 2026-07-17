using AccountGovernance.Application.Common;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Entities;
using AccountGovernance.Domain.Enums;
using Dapper;
using Microsoft.Data.SqlClient;

namespace AccountGovernance.Infrastructure.Persistence.Repositories;

public sealed class AdministrativeScopeRepository(IDbConnectionFactory db) : IAdministrativeScopeRepository
{
    // Números de error estándar de SQL Server para violación de índice/constraint
    // único — dispara UQ_Gov_AdministrativeScopeFilters_Active (ver schema.sql).
    private const int SqlUniqueViolation_Index      = 2601;
    private const int SqlUniqueViolation_Constraint = 2627;

    private const string ScopeSelect = """
        SELECT Id, ScopeKey, Name, Description, Category, BaseDn, ConnectionProfile,
               IsActive, Priority, CreatedBy, UpdatedBy, CreatedAt, UpdatedAt
        FROM   gov.AdministrativeScopes
        """;

    public async Task<IReadOnlyList<AdministrativeScope>> GetAllAsync(CancellationToken ct = default)
    {
        using var conn = db.Create();
        var rows = await conn.QueryAsync<AdministrativeScope>(ScopeSelect + " ORDER BY Priority, Name");
        return rows.AsList();
    }

    public async Task<AdministrativeScope?> GetByKeyAsync(string scopeKey, CancellationToken ct = default)
    {
        using var conn = db.Create();
        return await conn.QuerySingleOrDefaultAsync<AdministrativeScope>(
            ScopeSelect + " WHERE ScopeKey = @ScopeKey", new { ScopeKey = scopeKey });
    }

    public async Task<bool> ExistsByKeyAsync(string scopeKey, CancellationToken ct = default)
    {
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM gov.AdministrativeScopes WHERE ScopeKey = @ScopeKey",
            new { ScopeKey = scopeKey }) > 0;
    }

    public async Task<int> CreateAsync(AdministrativeScope scope, CancellationToken ct = default)
    {
        const string sql = """
            INSERT INTO gov.AdministrativeScopes
                (ScopeKey, Name, Description, Category, BaseDn, ConnectionProfile,
                 IsActive, Priority, CreatedBy, UpdatedBy, CreatedAt, UpdatedAt)
            VALUES
                (@ScopeKey, @Name, @Description, @Category, @BaseDn, @ConnectionProfile,
                 @IsActive, @Priority, @CreatedBy, @UpdatedBy, @CreatedAt, @UpdatedAt);
            SELECT CAST(SCOPE_IDENTITY() AS INT);
            """;

        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, new
        {
            scope.ScopeKey,
            scope.Name,
            scope.Description,
            scope.Category,
            scope.BaseDn,
            scope.ConnectionProfile,
            scope.IsActive,
            scope.Priority,
            scope.CreatedBy,
            scope.UpdatedBy,
            scope.CreatedAt,
            scope.UpdatedAt,
        });
    }

    public async Task UpdateAsync(AdministrativeScope scope, CancellationToken ct = default)
    {
        const string sql = """
            UPDATE gov.AdministrativeScopes
            SET    Name              = @Name,
                   Description       = @Description,
                   Category          = @Category,
                   BaseDn            = @BaseDn,
                   ConnectionProfile = @ConnectionProfile,
                   Priority          = @Priority,
                   UpdatedBy         = @UpdatedBy,
                   UpdatedAt         = @UpdatedAt
            WHERE  ScopeKey = @ScopeKey
            """;

        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new
        {
            scope.ScopeKey,
            scope.Name,
            scope.Description,
            scope.Category,
            scope.BaseDn,
            scope.ConnectionProfile,
            scope.Priority,
            scope.UpdatedBy,
            scope.UpdatedAt,
        });
    }

    public async Task SetStatusAsync(string scopeKey, bool isActive, string updatedBy, CancellationToken ct = default)
    {
        const string sql = """
            UPDATE gov.AdministrativeScopes
            SET    IsActive  = @IsActive,
                   UpdatedBy = @UpdatedBy,
                   UpdatedAt = @UpdatedAt
            WHERE  ScopeKey = @ScopeKey
            """;

        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new
        {
            ScopeKey  = scopeKey,
            IsActive  = isActive,
            UpdatedBy = updatedBy,
            UpdatedAt = DateTime.UtcNow,
        });
    }

    // ── Filters ──────────────────────────────────────────────────────────────

    private const string FilterSelect = """
        SELECT f.Id, f.AdministrativeScopeId, f.FilterType, f.AttributeName, f.Operator,
               f.Value, f.IsActive, f.CreatedAt, f.UpdatedAt, f.UpdatedBy, s.ScopeKey
        FROM   gov.AdministrativeScopeFilters f
        JOIN   gov.AdministrativeScopes s ON s.Id = f.AdministrativeScopeId
        """;

    public async Task<IReadOnlyList<AdministrativeScopeFilter>> GetFiltersByScopeKeyAsync(
        string scopeKey, CancellationToken ct = default)
    {
        var sql = FilterSelect + " WHERE s.ScopeKey = @ScopeKey ORDER BY f.Id";
        using var conn = db.Create();
        var rows = await conn.QueryAsync<FilterRow>(sql, new { ScopeKey = scopeKey });
        return rows.Select(ToFilterEntity).ToList();
    }

    public async Task<AdministrativeScopeFilter?> GetFilterByIdAsync(int id, CancellationToken ct = default)
    {
        var sql = FilterSelect + " WHERE f.Id = @Id";
        using var conn = db.Create();
        var row = await conn.QuerySingleOrDefaultAsync<FilterRow>(sql, new { Id = id });
        return row is null ? null : ToFilterEntity(row);
    }

    public async Task<int> CreateFilterAsync(AdministrativeScopeFilter filter, CancellationToken ct = default)
    {
        const string sql = """
            INSERT INTO gov.AdministrativeScopeFilters
                (AdministrativeScopeId, FilterType, AttributeName, Operator, Value, IsActive,
                 CreatedAt, UpdatedAt, UpdatedBy)
            VALUES
                (@AdministrativeScopeId, @FilterType, @AttributeName, @Operator, @Value, @IsActive,
                 @CreatedAt, @UpdatedAt, @UpdatedBy);
            SELECT CAST(SCOPE_IDENTITY() AS INT);
            """;

        using var conn = db.Create();
        try
        {
            return await conn.ExecuteScalarAsync<int>(sql, new
            {
                filter.AdministrativeScopeId,
                filter.FilterType,
                filter.AttributeName,
                Operator = filter.Operator.ToString(),
                filter.Value,
                filter.IsActive,
                filter.CreatedAt,
                filter.UpdatedAt,
                filter.UpdatedBy,
            });
        }
        catch (SqlException ex) when (IsUniqueViolation(ex))
        {
            // Defensa en profundidad ante condición de carrera — ver
            // DuplicateFilterException y UQ_Gov_AdministrativeScopeFilters_Active
            // en schema.sql. El chequeo normal (sin condición de carrera) ya lo
            // hizo AdministrativeScopeService antes de llegar acá.
            throw new DuplicateFilterException();
        }
    }

    public async Task UpdateFilterAsync(AdministrativeScopeFilter filter, CancellationToken ct = default)
    {
        const string sql = """
            UPDATE gov.AdministrativeScopeFilters
            SET    FilterType    = @FilterType,
                   AttributeName = @AttributeName,
                   Operator      = @Operator,
                   Value         = @Value,
                   IsActive      = @IsActive,
                   UpdatedBy     = @UpdatedBy,
                   UpdatedAt     = @UpdatedAt
            WHERE  Id = @Id
            """;

        using var conn = db.Create();
        try
        {
            await conn.ExecuteAsync(sql, new
            {
                filter.Id,
                filter.FilterType,
                filter.AttributeName,
                Operator = filter.Operator.ToString(),
                filter.Value,
                filter.IsActive,
                filter.UpdatedBy,
                filter.UpdatedAt,
            });
        }
        catch (SqlException ex) when (IsUniqueViolation(ex))
        {
            throw new DuplicateFilterException();
        }
    }

    private static bool IsUniqueViolation(SqlException ex) =>
        ex.Errors.Cast<SqlError>().Any(e =>
            e.Number == SqlUniqueViolation_Index || e.Number == SqlUniqueViolation_Constraint);

    public async Task DeleteFilterAsync(int id, CancellationToken ct = default)
    {
        using var conn = db.Create();
        await conn.ExecuteAsync("DELETE FROM gov.AdministrativeScopeFilters WHERE Id = @Id", new { Id = id });
    }

    private static AdministrativeScopeFilter ToFilterEntity(FilterRow r) => new()
    {
        Id                    = r.Id,
        AdministrativeScopeId = r.AdministrativeScopeId,
        FilterType            = r.FilterType,
        AttributeName         = r.AttributeName,
        Operator              = Enum.Parse<ScopeFilterOperator>(r.Operator),
        Value                 = r.Value,
        IsActive              = r.IsActive,
        CreatedAt             = r.CreatedAt,
        UpdatedAt             = r.UpdatedAt,
        UpdatedBy             = r.UpdatedBy,
        ScopeKey              = r.ScopeKey,
    };

    private sealed record FilterRow(
        int      Id,
        int      AdministrativeScopeId,
        string   FilterType,
        string   AttributeName,
        string   Operator,
        string?  Value,
        bool     IsActive,
        DateTime CreatedAt,
        DateTime UpdatedAt,
        string?  UpdatedBy,
        string   ScopeKey);
}
