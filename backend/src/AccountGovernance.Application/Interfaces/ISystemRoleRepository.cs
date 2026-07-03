using AccountGovernance.Domain.Entities;

namespace AccountGovernance.Application.Interfaces;

/// <summary>
/// A single active role and the AD group DNs currently mapped to it — the minimal
/// projection ISystemAuthorizationService needs to resolve a user's roles. Ordered
/// by Priority ascending (lower = resolved first) by GetActiveRolesForAuthorizationAsync.
/// </summary>
public sealed record SystemRoleAuthEntry(
    string             RoleKey,
    int                Priority,
    IReadOnlyList<string> ActiveGroupDns);

/// <summary>
/// Persistence for gov.SystemRoles / gov.SystemRoleGroups — the source of truth for
/// role→AD-group mappings, replacing the old Authorization:RoleMappings appsettings config.
/// </summary>
public interface ISystemRoleRepository
{
    Task<IReadOnlyList<SystemRole>> GetAllAsync(CancellationToken ct = default);

    Task<SystemRole?> GetByKeyAsync(string roleKey, CancellationToken ct = default);

    Task<bool> ExistsAsync(string roleKey, CancellationToken ct = default);

    Task UpdateAsync(
        string roleKey, string displayName, string? description,
        int priority, bool isActive, string updatedBy, CancellationToken ct = default);

    /// <summary>Active roles ordered by Priority ascending, each with its currently active AD group DNs.</summary>
    Task<IReadOnlyList<SystemRoleAuthEntry>> GetActiveRolesForAuthorizationAsync(CancellationToken ct = default);

    // ── Groups ───────────────────────────────────────────────────────────────

    Task<IReadOnlyList<SystemRoleGroup>> GetGroupsByRoleKeyAsync(string roleKey, CancellationToken ct = default);

    Task<SystemRoleGroup?> GetGroupByIdAsync(int id, CancellationToken ct = default);

    Task<bool> GroupExistsAsync(int id, CancellationToken ct = default);

    Task<int> CreateGroupAsync(
        string roleKey, string groupName, string groupDn,
        string? groupObjectGuid, string? groupSid, bool isActive,
        string updatedBy, CancellationToken ct = default);

    Task UpdateGroupAsync(
        int id, string groupName, string groupDn,
        string? groupObjectGuid, string? groupSid, bool isActive,
        string updatedBy, CancellationToken ct = default);

    Task DeleteGroupAsync(int id, CancellationToken ct = default);
}
