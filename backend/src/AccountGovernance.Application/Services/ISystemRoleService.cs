using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;

namespace AccountGovernance.Application.Services;

public interface ISystemRoleService
{
    Task<Result<IReadOnlyList<SystemRoleDto>>> GetAllAsync(CancellationToken ct);

    Task<Result<SystemRoleDto>> GetByKeyAsync(string roleKey, CancellationToken ct);

    Task<Result<SystemRoleDto>> UpdateAsync(
        string roleKey, UpdateSystemRoleDto dto, string updatedBy, CancellationToken ct);

    Task<Result<SystemRoleGroupDto>> CreateGroupAsync(
        string roleKey, CreateSystemRoleGroupDto dto, string updatedBy, CancellationToken ct);

    Task<Result<SystemRoleGroupDto>> UpdateGroupAsync(
        string roleKey, int id, UpdateSystemRoleGroupDto dto, string updatedBy, CancellationToken ct);

    Task<Result<bool>> DeleteGroupAsync(string roleKey, int id, CancellationToken ct);
}
