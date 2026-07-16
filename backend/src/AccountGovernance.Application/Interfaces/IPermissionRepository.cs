using AccountGovernance.Domain.Entities;
using AccountGovernance.Domain.Enums;

namespace AccountGovernance.Application.Interfaces;

public interface IPermissionRepository
{
    Task<IReadOnlyList<FieldDefinition>>     GetFieldDefinitionsAsync(CancellationToken ct = default);
    Task<IReadOnlyList<RoleFieldPermission>> GetRolePermissionsAsync(RoleName? role = null, CancellationToken ct = default);

    // ── Attribute admin (CRUD) ──────────────────────────────────────────────
    Task<IReadOnlyList<FieldDefinition>> GetAllAttributesAsync(CancellationToken ct = default);
    Task<FieldDefinition?>               GetAttributeByKeyAsync(string fieldKey, CancellationToken ct = default);
    Task<bool>                           ExistsByAdAttributeNameAsync(string adAttributeName, string? excludeFieldKey = null, CancellationToken ct = default);
    Task                                 CreateAttributeAsync(FieldDefinition attribute, CancellationToken ct = default);
    Task                                 UpdateAttributeAsync(FieldDefinition attribute, CancellationToken ct = default);
    Task                                 SetAttributeStatusAsync(string fieldKey, bool isActive, string updatedBy, CancellationToken ct = default);
    Task<bool>                           HasActiveDependenciesAsync(string fieldKey, CancellationToken ct = default);

    // ── Permissions matrix — editable cells ─────────────────────────────────
    Task UpsertRolePermissionAsync(
        RoleName roleName, string fieldKey, bool canView, bool canEdit,
        string updatedBy, CancellationToken ct = default);
}
