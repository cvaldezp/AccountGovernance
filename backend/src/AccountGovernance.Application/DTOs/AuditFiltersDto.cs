namespace AccountGovernance.Application.DTOs;

public sealed record AuditFiltersDto(
    string?   TargetUser = null,
    string?   ActionType = null,
    string?   RoleName   = null,
    DateOnly? DateFrom   = null,
    DateOnly? DateTo     = null,
    int       Page       = 1,
    int       PageSize   = 10
);
