using AccountGovernance.Domain.Entities;

namespace AccountGovernance.Application.Interfaces;

public interface IAccountCreationAuditRepository
{
    Task LogAsync(AccountCreationAuditEntry entry, CancellationToken ct);
}
