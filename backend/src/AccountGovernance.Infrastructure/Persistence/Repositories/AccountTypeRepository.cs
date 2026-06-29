using Dapper;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Entities;

namespace AccountGovernance.Infrastructure.Persistence.Repositories;

public sealed class AccountTypeRepository(IDbConnectionFactory db) : IAccountTypeRepository
{
    private const string SelectSql = """
        SELECT
            at.Id,
            at.TypeKey,
            at.Label,
            at.Description,
            at.Badge,
            at.IsPrivileged,
            at.IsActive,
            at.SortOrder,
            atc.SamPrefix,
            atc.ExtensionAttribute14,
            atc.TargetOU,
            atc.DefaultPasswordLength,
            atc.DescriptionTemplate,
            atc.DefaultCompany,
            atc.UpdatedAt  AS ConfigUpdatedAt,
            atc.UpdatedBy  AS ConfigUpdatedBy
        FROM  gov.AccountTypes           at
        INNER JOIN gov.AccountTypeConfigurations atc ON atc.AccountTypeId = at.Id
        """;

    private const string SubTypeSql = """
        SELECT
            st.Id,
            st.AccountTypeId,
            st.SubTypeKey,
            st.Label,
            st.SamPrefix,
            st.ExtensionAttribute14,
            st.TargetOU,
            st.IsActive,
            st.SortOrder
        FROM gov.AccountSubTypes st
        WHERE st.IsActive = 1
        """;

    public async Task<IReadOnlyList<AccountTypeView>> GetAllAsync(bool activeOnly, CancellationToken ct)
    {
        using var conn = db.Create();

        var sql  = SelectSql + (activeOnly ? " WHERE at.IsActive = 1" : string.Empty) + " ORDER BY at.SortOrder";
        var rows = (await conn.QueryAsync<TypeRow>(sql)).ToList();

        var subTypeRows = rows.Count > 0
            ? (await conn.QueryAsync<SubTypeRow>(SubTypeSql + " ORDER BY st.SortOrder")).ToList()
            : [];

        var subTypeMap = subTypeRows
            .GroupBy(s => s.AccountTypeId)
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyList<AccountSubTypeInfo>)g
                    .Select(s => new AccountSubTypeInfo(s.Id, s.SubTypeKey, s.Label, s.SamPrefix, s.ExtensionAttribute14, s.TargetOU, s.IsActive, s.SortOrder))
                    .ToList());

        return rows.Select(r => ToView(r, subTypeMap.GetValueOrDefault(r.Id, []))).ToList();
    }

    public async Task<AccountTypeView?> GetByKeyAsync(string typeKey, CancellationToken ct)
    {
        using var conn = db.Create();

        var row = await conn.QuerySingleOrDefaultAsync<TypeRow>(
            SelectSql + " WHERE at.TypeKey = @TypeKey",
            new { TypeKey = typeKey });

        if (row is null) return null;

        var subTypeRows = await conn.QueryAsync<SubTypeRow>(
            SubTypeSql + " AND st.AccountTypeId = @Id ORDER BY st.SortOrder",
            new { row.Id });

        var subtypes = subTypeRows
            .Select(s => new AccountSubTypeInfo(s.Id, s.SubTypeKey, s.Label, s.SamPrefix, s.ExtensionAttribute14, s.TargetOU, s.IsActive, s.SortOrder))
            .ToList();

        return ToView(row, subtypes);
    }

    public async Task UpdateConfigAsync(
        string typeKey, UpdateAccountTypeConfigDto dto, string? updatedBy, CancellationToken ct)
    {
        using var conn = db.Create();
        conn.Open();
        using var tx = conn.BeginTransaction();

        await conn.ExecuteAsync("""
            UPDATE gov.AccountTypes
            SET    IsActive  = @IsActive,
                   UpdatedAt = GETUTCDATE()
            WHERE  TypeKey = @TypeKey
            """,
            new { dto.IsActive, TypeKey = typeKey }, tx);

        await conn.ExecuteAsync("""
            UPDATE gov.AccountTypeConfigurations
            SET    SamPrefix             = @SamPrefix,
                   ExtensionAttribute14  = @ExtensionAttribute14,
                   TargetOU              = @TargetOU,
                   DefaultPasswordLength = @DefaultPasswordLength,
                   DescriptionTemplate   = @DescriptionTemplate,
                   DefaultCompany        = @DefaultCompany,
                   UpdatedAt             = GETUTCDATE(),
                   UpdatedBy             = @UpdatedBy
            WHERE  AccountTypeId = (SELECT Id FROM gov.AccountTypes WHERE TypeKey = @TypeKey)
            """,
            new
            {
                dto.SamPrefix,
                dto.ExtensionAttribute14,
                dto.TargetOU,
                dto.DefaultPasswordLength,
                dto.DescriptionTemplate,
                dto.DefaultCompany,
                UpdatedBy = updatedBy,
                TypeKey   = typeKey,
            }, tx);

        tx.Commit();
    }

    public async Task UpdateSubTypeAsync(string subTypeKey, UpdateAccountSubTypeDto dto, CancellationToken ct)
    {
        using var conn = db.Create();

        await conn.ExecuteAsync("""
            UPDATE gov.AccountSubTypes
            SET    SamPrefix             = @SamPrefix,
                   ExtensionAttribute14  = @ExtensionAttribute14,
                   TargetOU              = @TargetOU,
                   IsActive              = @IsActive
            WHERE  SubTypeKey = @SubTypeKey
            """,
            new { dto.SamPrefix, dto.ExtensionAttribute14, dto.TargetOU, dto.IsActive, SubTypeKey = subTypeKey });
    }

    // ── Private helpers ───────────────────────────────────────────────────────────

    private static AccountTypeView ToView(TypeRow r, IReadOnlyList<AccountSubTypeInfo> subTypes) => new(
        r.Id,
        r.TypeKey,
        r.Label,
        r.Description,
        r.Badge,
        r.IsPrivileged,
        r.IsActive,
        r.SortOrder,
        r.SamPrefix,
        r.ExtensionAttribute14,
        r.TargetOU,
        r.DefaultPasswordLength,
        r.DescriptionTemplate,
        r.DefaultCompany,
        r.ConfigUpdatedAt,
        r.ConfigUpdatedBy,
        subTypes
    );

    private sealed record TypeRow(
        int      Id,
        string   TypeKey,
        string   Label,
        string   Description,
        string   Badge,
        bool     IsPrivileged,
        bool     IsActive,
        int      SortOrder,
        string?  SamPrefix,
        string   ExtensionAttribute14,
        string?  TargetOU,
        int      DefaultPasswordLength,
        string   DescriptionTemplate,
        string?  DefaultCompany,
        DateTime ConfigUpdatedAt,
        string?  ConfigUpdatedBy);

    private sealed record SubTypeRow(
        int     Id,
        int     AccountTypeId,
        string  SubTypeKey,
        string  Label,
        string  SamPrefix,
        string  ExtensionAttribute14,
        string? TargetOU,
        bool    IsActive,
        int     SortOrder);
}
