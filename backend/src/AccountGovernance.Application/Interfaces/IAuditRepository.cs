using AccountGovernance.Application.DTOs;
using AccountGovernance.Domain.Entities;

namespace AccountGovernance.Application.Interfaces;

public interface IAuditRepository
{
    Task<IReadOnlyList<AuditEntry>> GetEntriesAsync(AuditFiltersDto filters, CancellationToken ct = default);
    Task<AuditEntry>                AddEntryAsync(AuditEntry entry, CancellationToken ct = default);
}
