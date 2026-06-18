using Dapper;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Entities;
using AccountGovernance.Domain.Enums;

namespace AccountGovernance.Infrastructure.Persistence.Repositories;

public sealed class AuditRepository(IDbConnectionFactory db) : IAuditRepository
{
    public async Task<IReadOnlyList<AuditEntry>> GetEntriesAsync(
        AuditFiltersDto filters, CancellationToken ct = default)
    {
        using var conn = db.Create();

        const string sql = """
            SELECT Id, Timestamp, PerformedBy, RoleName, ActionType,
                   FieldKey, OldValue, NewValue, TargetUser, Domain, Success, Notes
            FROM   gov.AuditEntries
            WHERE  (@TargetUser IS NULL OR TargetUser LIKE '%' + @TargetUser + '%')
              AND  (@ActionType IS NULL OR ActionType = @ActionType)
              AND  (@RoleName   IS NULL OR RoleName   = @RoleName)
              AND  (@DateFrom   IS NULL OR CAST(Timestamp AS DATE) >= @DateFrom)
              AND  (@DateTo     IS NULL OR CAST(Timestamp AS DATE) <= @DateTo)
            ORDER BY Timestamp DESC
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY
            """;

        var rows = await conn.QueryAsync<AuditRow>(sql, new
        {
            filters.TargetUser,
            filters.ActionType,
            filters.RoleName,
            DateFrom  = filters.DateFrom?.ToDateTime(TimeOnly.MinValue),
            DateTo    = filters.DateTo?.ToDateTime(TimeOnly.MaxValue),
            Offset    = (filters.Page - 1) * filters.PageSize,
            filters.PageSize,
        });

        return rows.Select(r => new AuditEntry
        {
            Id          = r.Id,
            Timestamp   = r.Timestamp,
            PerformedBy = r.PerformedBy,
            RoleName    = Enum.Parse<RoleName>(r.RoleName),
            ActionType  = Enum.Parse<AuditActionType>(r.ActionType),
            FieldKey    = r.FieldKey,
            OldValue    = r.OldValue,
            NewValue    = r.NewValue,
            TargetUser  = r.TargetUser,
            Domain      = r.Domain,
            Success     = r.Success,
            Notes       = r.Notes,
        }).ToList();
    }

    public async Task<AuditEntry> AddEntryAsync(AuditEntry entry, CancellationToken ct = default)
    {
        using var conn = db.Create();

        const string sql = """
            INSERT INTO gov.AuditEntries
                (Id, Timestamp, PerformedBy, RoleName, ActionType,
                 FieldKey, OldValue, NewValue, TargetUser, Domain, Success, Notes)
            VALUES
                (@Id, @Timestamp, @PerformedBy, @RoleName, @ActionType,
                 @FieldKey, @OldValue, @NewValue, @TargetUser, @Domain, @Success, @Notes)
            """;

        await conn.ExecuteAsync(sql, new
        {
            entry.Id,
            entry.Timestamp,
            entry.PerformedBy,
            RoleName   = entry.RoleName.ToString(),
            ActionType = entry.ActionType.ToString(),
            entry.FieldKey,
            entry.OldValue,
            entry.NewValue,
            entry.TargetUser,
            entry.Domain,
            entry.Success,
            entry.Notes,
        });

        return entry;
    }

    // Internal Dapper projection record — never crosses layer boundaries
    private sealed record AuditRow(
        string   Id,
        DateTime Timestamp,
        string   PerformedBy,
        string   RoleName,
        string   ActionType,
        string?  FieldKey,
        string?  OldValue,
        string?  NewValue,
        string   TargetUser,
        string   Domain,
        bool     Success,
        string?  Notes);
}
