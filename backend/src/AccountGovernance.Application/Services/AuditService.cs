using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;

namespace AccountGovernance.Application.Services;

public sealed class AuditService(IAuditRepository auditRepository) : IAuditService
{
    public async Task<Result<IReadOnlyList<AuditEntryDto>>> GetEntriesAsync(
        AuditFiltersDto filters, CancellationToken ct = default)
    {
        var entries = await auditRepository.GetEntriesAsync(filters, ct);
        var dtos = entries
            .Select(e => new AuditEntryDto(
                e.Id, e.Timestamp, e.PerformedBy,
                e.RoleName.ToString(), e.ActionType.ToString(),
                e.FieldKey, e.OldValue, e.NewValue,
                e.TargetUser, e.Domain, e.Success, e.Notes))
            .ToList();

        return Result<IReadOnlyList<AuditEntryDto>>.Ok(dtos);
    }
}
