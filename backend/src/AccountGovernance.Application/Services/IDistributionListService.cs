using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;

namespace AccountGovernance.Application.Services;

/// <summary>
/// Distribution lists are never persisted — every read is a live Active Directory query.
/// Only membership changes are recorded, in gov.AuditEntries via IAuditRepository.
/// </summary>
public interface IDistributionListService
{
    Task<Result<IReadOnlyList<DistributionListSummaryDto>>> SearchAsync(
        string query, CancellationToken ct = default);

    Task<Result<DistributionListDetailDto>> GetDetailAsync(
        string dn, CancellationToken ct = default);

    Task<Result<IReadOnlyList<DistributionListMemberDto>>> GetMembersAsync(
        string dn, CancellationToken ct = default);

    /// <summary>memberAccount may be a sAMAccountName, UPN, or mail address of an existing AD user.</summary>
    Task<Result<DistributionListMemberDto>> AddMemberAsync(
        string listDn, string memberAccount, string operatorUpn, CancellationToken ct = default);

    Task<Result<bool>> RemoveMemberAsync(
        string listDn, string memberDn, string operatorUpn, CancellationToken ct = default);
}
