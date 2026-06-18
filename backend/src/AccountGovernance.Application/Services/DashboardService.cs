using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Enums;

namespace AccountGovernance.Application.Services;

public sealed class DashboardService(
    IAuditRepository      auditRepository,
    IPermissionRepository permissionRepository
) : IDashboardService
{
    public async Task<Result<DashboardSummaryDto>> GetSummaryAsync(CancellationToken ct = default)
    {
        var today     = DateOnly.FromDateTime(DateTime.UtcNow);
        var weekStart = today.AddDays(-(int)today.DayOfWeek);

        var todayEntries  = await auditRepository.GetEntriesAsync(new AuditFiltersDto(DateFrom: today,     DateTo: today, PageSize: 1000), ct);
        var weekEntries   = await auditRepository.GetEntriesAsync(new AuditFiltersDto(DateFrom: weekStart, DateTo: today, PageSize: 1000), ct);
        var recentEntries = await auditRepository.GetEntriesAsync(new AuditFiltersDto(PageSize: 7), ct);
        var definitions   = await permissionRepository.GetFieldDefinitionsAsync(ct);

        var recentDtos = recentEntries
            .Select(e => new AuditEntryDto(
                e.Id, e.Timestamp, e.PerformedBy,
                e.RoleName.ToString(), e.ActionType.ToString(),
                e.FieldKey, e.OldValue, e.NewValue,
                e.TargetUser, e.Domain, e.Success, e.Notes))
            .ToList();

        return Result<DashboardSummaryDto>.Ok(new DashboardSummaryDto(
            TotalManagedFields:  definitions.Count(d => d.IsActive),
            TotalRoles:          Enum.GetValues<RoleName>().Length,
            AuditEventsToday:    todayEntries.Count,
            AuditEventsThisWeek: weekEntries.Count,
            RecentChanges:       recentDtos));
    }
}
