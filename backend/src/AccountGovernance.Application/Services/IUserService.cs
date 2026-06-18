using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;

namespace AccountGovernance.Application.Services;

public interface IUserService
{
    Task<Result<IReadOnlyList<UserSearchResultDto>>> SearchAsync(
        string query, CancellationToken ct = default);

    Task<Result<UserDetailDto>> GetByAccountAsync(
        string samAccountName, CancellationToken ct = default);
}
