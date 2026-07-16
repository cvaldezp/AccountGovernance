using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Domain.Enums;

namespace AccountGovernance.Application.Services;

public interface IPermissionService
{
    Task<Result<IReadOnlyList<FieldConfigDto>>> GetFieldsForRoleAsync(RoleName role, CancellationToken ct = default);
    Task<Result<PermissionsMatrixDto>>          GetMatrixAsync(CancellationToken ct = default);

    // ── Attribute admin (CRUD) ──────────────────────────────────────────────
    Task<Result<IReadOnlyList<AttributeDto>>> GetAllAttributesAsync(CancellationToken ct = default);
    Task<Result<AttributeDto>>                GetAttributeByKeyAsync(string fieldKey, CancellationToken ct = default);
    Task<Result<AttributeDto>>                CreateAttributeAsync(CreateAttributeDto dto, string createdBy, CancellationToken ct = default);
    Task<Result<AttributeDto>>                UpdateAttributeAsync(string fieldKey, UpdateAttributeDto dto, string updatedBy, CancellationToken ct = default);
    Task<Result<AttributeDto>>                SetAttributeStatusAsync(string fieldKey, UpdateAttributeStatusDto dto, string updatedBy, CancellationToken ct = default);

    // ── Permissions matrix — editable cells ─────────────────────────────────
    Task<Result<RolePermissionCellDto>> UpdateRolePermissionAsync(
        string roleKey, string fieldKey, UpdateRolePermissionDto dto, string updatedBy, CancellationToken ct = default);
}
