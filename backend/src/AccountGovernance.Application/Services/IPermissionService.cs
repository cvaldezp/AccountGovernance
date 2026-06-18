using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Domain.Enums;

namespace AccountGovernance.Application.Services;

public interface IPermissionService
{
    Task<Result<IReadOnlyList<FieldConfigDto>>> GetFieldsForRoleAsync(RoleName role, CancellationToken ct = default);
    Task<Result<PermissionsMatrixDto>>          GetMatrixAsync(CancellationToken ct = default);
}
