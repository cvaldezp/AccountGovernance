using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;

namespace AccountGovernance.Application.Services;

public interface IAccountTypeGroupService
{
    Task<Result<IReadOnlyList<AccountTypeGroupDto>>> GetGroupsAsync(
        string typeKey, string? subTypeKey, bool activeOnly, CancellationToken ct);

    Task<Result<AccountTypeGroupDto>> CreateGroupAsync(
        string typeKey, CreateAccountTypeGroupDto dto, string updatedBy, CancellationToken ct);

    Task<Result<AccountTypeGroupDto>> UpdateGroupAsync(
        int id, UpdateAccountTypeGroupDto dto, string updatedBy, CancellationToken ct);

    Task<Result<bool>> DeleteGroupAsync(int id, CancellationToken ct);

    Task<Result<ValidateAdGroupResponseDto>> ValidateAdGroupAsync(
        string query, CancellationToken ct);
}
