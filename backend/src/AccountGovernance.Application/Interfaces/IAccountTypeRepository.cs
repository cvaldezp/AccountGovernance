using AccountGovernance.Application.DTOs;
using AccountGovernance.Domain.Entities;

namespace AccountGovernance.Application.Interfaces;

public interface IAccountTypeRepository
{
    Task<IReadOnlyList<AccountTypeView>> GetAllAsync(bool activeOnly, CancellationToken ct);
    Task<AccountTypeView?>               GetByKeyAsync(string typeKey, CancellationToken ct);
    Task                                 UpdateConfigAsync(string typeKey, UpdateAccountTypeConfigDto dto, string? updatedBy, CancellationToken ct);
    Task                                 UpdateSubTypeAsync(string subTypeKey, UpdateAccountSubTypeDto dto, CancellationToken ct);
}
