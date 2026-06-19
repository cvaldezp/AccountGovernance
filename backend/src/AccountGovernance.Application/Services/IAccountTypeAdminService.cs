using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;

namespace AccountGovernance.Application.Services;

public interface IAccountTypeAdminService
{
    Task<Result<IReadOnlyList<AccountTypeConfigDto>>> GetAllAsync(bool activeOnly, CancellationToken ct);
    Task<Result<AccountTypeConfigDto>>               GetByKeyAsync(string typeKey, CancellationToken ct);
    Task<Result<AccountTypeConfigDto>>               UpdateConfigAsync(string typeKey, UpdateAccountTypeConfigDto dto, string? updatedBy, CancellationToken ct);
    Task<Result<AccountSubTypeDto>>                  UpdateSubTypeAsync(string subTypeKey, UpdateAccountSubTypeDto dto, CancellationToken ct);
}
