namespace AccountGovernance.Application.DTOs;

public sealed record DashboardSummaryDto(
    int                          TotalManagedFields,
    int                          TotalRoles,
    int                          AuditEventsToday,
    int                          AuditEventsThisWeek,
    IReadOnlyList<AuditEntryDto> RecentChanges
);
