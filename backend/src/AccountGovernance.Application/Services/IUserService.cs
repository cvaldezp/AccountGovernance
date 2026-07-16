using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Domain.Enums;

namespace AccountGovernance.Application.Services;

public interface IUserService
{
    Task<Result<IReadOnlyList<UserSearchResultDto>>> SearchAsync(
        string query, CancellationToken ct = default);

    Task<Result<UserDetailDto>> GetByAccountAsync(
        string samAccountName, CancellationToken ct = default);

    /// <summary>
    /// Writes a single AD attribute for <paramref name="samAccountName"/>.
    /// <paramref name="effectiveRole"/> and <paramref name="operatorUpn"/> must be
    /// resolved server-side from the authenticated session — never taken from the
    /// request body.
    /// </summary>
    Task<Result<UpdateUserAttributeResultDto>> UpdateAttributeAsync(
        string samAccountName, string adAttributeName, UpdateUserAttributeDto dto,
        RoleName effectiveRole, string operatorUpn, CancellationToken ct = default);

    /// <summary>
    /// Enables or disables the account for <paramref name="samAccountName"/>. The
    /// permission check reuses the same FieldConfig (gov.RoleFieldPermissions) as
    /// the Estado de Cuenta field shown in the UI — no separate permission rule.
    /// </summary>
    Task<Result<UpdateAccountStatusResultDto>> UpdateAccountStatusAsync(
        string samAccountName, UpdateAccountStatusDto dto,
        RoleName effectiveRole, string operatorUpn, CancellationToken ct = default);
}
