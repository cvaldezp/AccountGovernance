using AccountGovernance.Domain.Entities;
using AccountGovernance.Domain.Enums;

namespace AccountGovernance.Application.Interfaces;

public interface IPermissionRepository
{
    Task<IReadOnlyList<FieldDefinition>>     GetFieldDefinitionsAsync(CancellationToken ct = default);
    Task<IReadOnlyList<RoleFieldPermission>> GetRolePermissionsAsync(RoleName? role = null, CancellationToken ct = default);
}
