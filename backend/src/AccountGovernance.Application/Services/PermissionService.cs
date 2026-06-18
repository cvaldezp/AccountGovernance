using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Enums;

namespace AccountGovernance.Application.Services;

public sealed class PermissionService(IPermissionRepository permissionRepository) : IPermissionService
{
    public async Task<Result<IReadOnlyList<FieldConfigDto>>> GetFieldsForRoleAsync(
        RoleName role, CancellationToken ct = default)
    {
        var definitions = await permissionRepository.GetFieldDefinitionsAsync(ct);
        var permissions = await permissionRepository.GetRolePermissionsAsync(role, ct);

        var configs = definitions
            .Where(d => d.IsActive)
            .Select(d =>
            {
                var perm = permissions.FirstOrDefault(p => p.FieldKey == d.FieldKey && p.IsActive);
                return new FieldConfigDto(
                    d.FieldKey, d.AdAttributeName, d.DisplayName, d.Description,
                    d.FieldType.ToString(), d.IsSensitive,
                    perm?.CanView ?? false,
                    perm?.CanEdit ?? false,
                    d.SortOrder, d.AllowedValues, d.Placeholder);
            })
            .OrderBy(c => c.SortOrder)
            .ToList();

        return Result<IReadOnlyList<FieldConfigDto>>.Ok(configs);
    }

    public async Task<Result<PermissionsMatrixDto>> GetMatrixAsync(CancellationToken ct = default)
    {
        var definitions  = await permissionRepository.GetFieldDefinitionsAsync(ct);
        var allPerms     = await permissionRepository.GetRolePermissionsAsync(ct: ct);
        var roleNames    = Enum.GetNames<RoleName>();

        var rows = definitions
            .Where(d => d.IsActive)
            .OrderBy(d => d.SortOrder)
            .Select(d =>
            {
                var byRole = roleNames.ToDictionary(
                    r => r,
                    r =>
                    {
                        if (!Enum.TryParse<RoleName>(r, out var rn))
                            return new FieldAccessDto(false, false);
                        var p = allPerms.FirstOrDefault(x => x.RoleName == rn && x.FieldKey == d.FieldKey && x.IsActive);
                        return new FieldAccessDto(p?.CanView ?? false, p?.CanEdit ?? false);
                    });

                return new PermissionsMatrixRowDto(
                    d.FieldKey, d.DisplayName, d.AdAttributeName, d.IsSensitive, byRole);
            })
            .ToList();

        return Result<PermissionsMatrixDto>.Ok(new PermissionsMatrixDto(rows, roleNames));
    }
}
