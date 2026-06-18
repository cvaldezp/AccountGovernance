using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;

namespace AccountGovernance.Application.Services;

public interface IAuditService
{
    Task<Result<IReadOnlyList<AuditEntryDto>>> GetEntriesAsync(AuditFiltersDto filters, CancellationToken ct = default);
}
