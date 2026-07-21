using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;

namespace AccountGovernance.Application.Services;

public interface IRoleScopeAssignmentService
{
    Task<Result<IReadOnlyList<RoleScopeAssignmentDto>>> GetAllAsync(
        string? roleKey, string? scopeKey, CancellationToken ct = default);

    Task<Result<RoleScopeAssignmentDto>> GetByIdAsync(int id, CancellationToken ct = default);

    Task<Result<RoleScopeAssignmentDto>> CreateAsync(
        CreateRoleScopeAssignmentDto dto, string performedBy, CancellationToken ct = default);

    Task<Result<RoleScopeAssignmentDto>> SetStatusAsync(
        int id, UpdateRoleScopeAssignmentStatusDto dto, string performedBy, CancellationToken ct = default);
}
