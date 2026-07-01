using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Entities;
using Dapper;
using Microsoft.Extensions.Logging;

namespace AccountGovernance.Infrastructure.Persistence.Repositories;

public sealed class AccountTypeGroupRepository(
    IDbConnectionFactory                    db,
    ILogger<AccountTypeGroupRepository>     logger
) : IAccountTypeGroupRepository
{
    private const string SelectBase = """
        SELECT g.Id, g.AccountTypeId, g.AccountSubTypeId, g.GroupName, g.GroupDn,
               g.GroupObjectGuid, g.GroupSid, g.IsCritical, g.ContinueOnFailure, g.IsActive, g.SortOrder,
               g.CreatedAt, g.UpdatedAt, g.UpdatedBy,
               acct.TypeKey, ast.SubTypeKey
        FROM gov.AccountTypeInitialGroups g
        JOIN gov.AccountTypes acct ON acct.Id = g.AccountTypeId
        LEFT JOIN gov.AccountSubTypes ast ON ast.Id = g.AccountSubTypeId
        """ + "\n";

    public async Task<IReadOnlyList<AccountTypeInitialGroup>> GetByTypeKeyAsync(
        string typeKey, string? subTypeKey, bool activeOnly, CancellationToken ct)
    {
        var sql = SelectBase + """
            WHERE acct.TypeKey = @TypeKey
              AND (
                  (@SubTypeKey IS NULL AND g.AccountSubTypeId IS NULL)
                  OR
                  (@SubTypeKey IS NOT NULL AND ast.SubTypeKey = @SubTypeKey)
              )
            """ + (activeOnly ? " AND g.IsActive = 1" : string.Empty) + """
            ORDER BY g.SortOrder, g.Id
            """;

        using var conn = db.Create();
        var rows = await conn.QueryAsync<AccountTypeInitialGroup>(
            sql, new { TypeKey = typeKey, SubTypeKey = subTypeKey });
        return rows.AsList();
    }

    public async Task<IReadOnlyList<AccountTypeInitialGroup>> GetForCreationAsync(
        int accountTypeId, int? accountSubTypeId, CancellationToken ct)
    {
        var sql = SelectBase + """
            WHERE g.AccountTypeId = @AccountTypeId
              AND (g.AccountSubTypeId IS NULL OR g.AccountSubTypeId = @AccountSubTypeId)
              AND g.IsActive = 1
            ORDER BY g.SortOrder, g.Id
            """;

        // [DIAG] Log SQL and params before execution to identify any syntax errors
        logger.LogDebug(
            "[GetForCreationAsync] params: AccountTypeId={AccountTypeId}, AccountSubTypeId={AccountSubTypeId} | SQL:\n{Sql}",
            accountTypeId, accountSubTypeId, sql);

        try
        {
            using var conn = db.Create();
            var rows = await conn.QueryAsync<AccountTypeInitialGroup>(
                sql, new { AccountTypeId = accountTypeId, AccountSubTypeId = accountSubTypeId });
            return rows.AsList();
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "[GetForCreationAsync] SQL FAILED — AccountTypeId={AccountTypeId}, AccountSubTypeId={AccountSubTypeId} | SQL:\n{Sql}",
                accountTypeId, accountSubTypeId, sql);
            throw;
        }
    }

    public async Task<AccountTypeInitialGroup?> GetByIdAsync(int id, CancellationToken ct)
    {
        var sql = SelectBase + " WHERE g.Id = @Id";
        using var conn = db.Create();
        return await conn.QuerySingleOrDefaultAsync<AccountTypeInitialGroup>(sql, new { Id = id });
    }

    public async Task<int> CreateAsync(
        string  typeKey,
        string? subTypeKey,
        string  groupName,
        string  groupDn,
        string? groupObjectGuid,
        string? groupSid,
        bool    isCritical,
        bool    continueOnFailure,
        bool    isActive,
        int     sortOrder,
        string  updatedBy,
        CancellationToken ct)
    {
        const string sql = """
            INSERT INTO gov.AccountTypeInitialGroups
                (AccountTypeId, AccountSubTypeId, GroupName, GroupDn, GroupObjectGuid, GroupSid,
                 IsCritical, ContinueOnFailure, IsActive, SortOrder, CreatedAt, UpdatedAt, UpdatedBy)
            VALUES (
                (SELECT Id FROM gov.AccountTypes WHERE TypeKey = @TypeKey),
                (SELECT Id FROM gov.AccountSubTypes WHERE SubTypeKey = @SubTypeKey),
                @GroupName, @GroupDn, @GroupObjectGuid, @GroupSid,
                @IsCritical, @ContinueOnFailure, @IsActive, @SortOrder, GETUTCDATE(), GETUTCDATE(), @UpdatedBy
            );
            SELECT CAST(SCOPE_IDENTITY() AS INT);
            """;

        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, new
        {
            TypeKey = typeKey, SubTypeKey = subTypeKey,
            GroupName = groupName, GroupDn = groupDn,
            GroupObjectGuid = groupObjectGuid, GroupSid = groupSid,
            IsCritical = isCritical, ContinueOnFailure = continueOnFailure,
            IsActive = isActive, SortOrder = sortOrder,
            UpdatedBy = updatedBy,
        });
    }

    public async Task UpdateAsync(
        int     id,
        string  groupName,
        string  groupDn,
        string? groupObjectGuid,
        string? groupSid,
        bool    isCritical,
        bool    continueOnFailure,
        bool    isActive,
        int     sortOrder,
        string  updatedBy,
        CancellationToken ct)
    {
        const string sql = """
            UPDATE gov.AccountTypeInitialGroups
            SET GroupName         = @GroupName,
                GroupDn           = @GroupDn,
                GroupObjectGuid   = @GroupObjectGuid,
                GroupSid          = @GroupSid,
                IsCritical        = @IsCritical,
                ContinueOnFailure = @ContinueOnFailure,
                IsActive          = @IsActive,
                SortOrder         = @SortOrder,
                UpdatedAt         = GETUTCDATE(),
                UpdatedBy         = @UpdatedBy
            WHERE Id = @Id
            """;

        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new
        {
            Id = id, GroupName = groupName, GroupDn = groupDn,
            GroupObjectGuid = groupObjectGuid, GroupSid = groupSid,
            IsCritical = isCritical, ContinueOnFailure = continueOnFailure,
            IsActive = isActive, SortOrder = sortOrder,
            UpdatedBy = updatedBy,
        });
    }

    public async Task DeleteAsync(int id, CancellationToken ct)
    {
        using var conn = db.Create();
        await conn.ExecuteAsync("DELETE FROM gov.AccountTypeInitialGroups WHERE Id = @Id", new { Id = id });
    }

    public async Task<bool> ExistsAsync(int id, CancellationToken ct)
    {
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM gov.AccountTypeInitialGroups WHERE Id = @Id", new { Id = id }) > 0;
    }
}
