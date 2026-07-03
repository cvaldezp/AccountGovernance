using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Entities;
using Dapper;

namespace AccountGovernance.Infrastructure.Persistence.Repositories;

public sealed class SystemRoleRepository(IDbConnectionFactory db) : ISystemRoleRepository
{
    public async Task<IReadOnlyList<SystemRole>> GetAllAsync(CancellationToken ct = default)
    {
        using var conn = db.Create();
        var rows = await conn.QueryAsync<SystemRole>(
            "SELECT * FROM gov.SystemRoles ORDER BY Priority");
        return rows.AsList();
    }

    public async Task<SystemRole?> GetByKeyAsync(string roleKey, CancellationToken ct = default)
    {
        using var conn = db.Create();
        return await conn.QuerySingleOrDefaultAsync<SystemRole>(
            "SELECT * FROM gov.SystemRoles WHERE RoleKey = @RoleKey", new { RoleKey = roleKey });
    }

    public async Task<bool> ExistsAsync(string roleKey, CancellationToken ct = default)
    {
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM gov.SystemRoles WHERE RoleKey = @RoleKey", new { RoleKey = roleKey }) > 0;
    }

    public async Task UpdateAsync(
        string roleKey, string displayName, string? description,
        int priority, bool isActive, string updatedBy, CancellationToken ct = default)
    {
        const string sql = """
            UPDATE gov.SystemRoles
            SET DisplayName = @DisplayName,
                Description = @Description,
                Priority    = @Priority,
                IsActive    = @IsActive,
                UpdatedAt   = GETUTCDATE(),
                UpdatedBy   = @UpdatedBy
            WHERE RoleKey = @RoleKey
            """;

        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new
        {
            RoleKey = roleKey, DisplayName = displayName, Description = description,
            Priority = priority, IsActive = isActive, UpdatedBy = updatedBy,
        });
    }

    public async Task<IReadOnlyList<SystemRoleAuthEntry>> GetActiveRolesForAuthorizationAsync(
        CancellationToken ct = default)
    {
        const string sql = """
            SELECT r.RoleKey, r.Priority, g.GroupDn
            FROM   gov.SystemRoles r
            LEFT JOIN gov.SystemRoleGroups g ON g.SystemRoleId = r.Id AND g.IsActive = 1
            WHERE  r.IsActive = 1
            ORDER BY r.Priority
            """;

        using var conn = db.Create();
        var rows = await conn.QueryAsync<(string RoleKey, int Priority, string? GroupDn)>(sql);

        var entries = new List<SystemRoleAuthEntry>();
        foreach (var row in rows)
        {
            var existing = entries.FirstOrDefault(e => e.RoleKey == row.RoleKey);
            if (existing is null)
            {
                var dns = new List<string>();
                if (row.GroupDn is not null) dns.Add(row.GroupDn);
                entries.Add(new SystemRoleAuthEntry(row.RoleKey, row.Priority, dns));
            }
            else if (row.GroupDn is not null)
            {
                ((List<string>)existing.ActiveGroupDns).Add(row.GroupDn);
            }
        }

        return entries;
    }

    // ── Groups ───────────────────────────────────────────────────────────────

    private const string GroupSelectBase = """
        SELECT g.Id, g.SystemRoleId, g.GroupName, g.GroupDn, g.GroupSid, g.GroupObjectGuid,
               g.IsActive, g.CreatedAt, g.UpdatedAt, g.UpdatedBy, r.RoleKey
        FROM gov.SystemRoleGroups g
        JOIN gov.SystemRoles r ON r.Id = g.SystemRoleId
        """;

    public async Task<IReadOnlyList<SystemRoleGroup>> GetGroupsByRoleKeyAsync(
        string roleKey, CancellationToken ct = default)
    {
        var sql = GroupSelectBase + " WHERE r.RoleKey = @RoleKey ORDER BY g.Id";
        using var conn = db.Create();
        var rows = await conn.QueryAsync<SystemRoleGroup>(sql, new { RoleKey = roleKey });
        return rows.AsList();
    }

    public async Task<SystemRoleGroup?> GetGroupByIdAsync(int id, CancellationToken ct = default)
    {
        var sql = GroupSelectBase + " WHERE g.Id = @Id";
        using var conn = db.Create();
        return await conn.QuerySingleOrDefaultAsync<SystemRoleGroup>(sql, new { Id = id });
    }

    public async Task<bool> GroupExistsAsync(int id, CancellationToken ct = default)
    {
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM gov.SystemRoleGroups WHERE Id = @Id", new { Id = id }) > 0;
    }

    public async Task<int> CreateGroupAsync(
        string roleKey, string groupName, string groupDn,
        string? groupObjectGuid, string? groupSid, bool isActive,
        string updatedBy, CancellationToken ct = default)
    {
        const string sql = """
            INSERT INTO gov.SystemRoleGroups
                (SystemRoleId, GroupName, GroupDn, GroupObjectGuid, GroupSid, IsActive,
                 CreatedAt, UpdatedAt, UpdatedBy)
            VALUES (
                (SELECT Id FROM gov.SystemRoles WHERE RoleKey = @RoleKey),
                @GroupName, @GroupDn, @GroupObjectGuid, @GroupSid, @IsActive,
                GETUTCDATE(), GETUTCDATE(), @UpdatedBy
            );
            SELECT CAST(SCOPE_IDENTITY() AS INT);
            """;

        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<int>(sql, new
        {
            RoleKey = roleKey, GroupName = groupName, GroupDn = groupDn,
            GroupObjectGuid = groupObjectGuid, GroupSid = groupSid,
            IsActive = isActive, UpdatedBy = updatedBy,
        });
    }

    public async Task UpdateGroupAsync(
        int id, string groupName, string groupDn,
        string? groupObjectGuid, string? groupSid, bool isActive,
        string updatedBy, CancellationToken ct = default)
    {
        const string sql = """
            UPDATE gov.SystemRoleGroups
            SET GroupName       = @GroupName,
                GroupDn         = @GroupDn,
                GroupObjectGuid = @GroupObjectGuid,
                GroupSid        = @GroupSid,
                IsActive        = @IsActive,
                UpdatedAt       = GETUTCDATE(),
                UpdatedBy       = @UpdatedBy
            WHERE Id = @Id
            """;

        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new
        {
            Id = id, GroupName = groupName, GroupDn = groupDn,
            GroupObjectGuid = groupObjectGuid, GroupSid = groupSid,
            IsActive = isActive, UpdatedBy = updatedBy,
        });
    }

    public async Task DeleteGroupAsync(int id, CancellationToken ct = default)
    {
        using var conn = db.Create();
        await conn.ExecuteAsync("DELETE FROM gov.SystemRoleGroups WHERE Id = @Id", new { Id = id });
    }
}
