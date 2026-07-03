namespace AccountGovernance.Application.Interfaces;

/// <summary>
/// Maps an authenticated user's on-premises AD group memberships to system role names.
/// Role → group DN mappings and role priority live in gov.SystemRoles / gov.SystemRoleGroups
/// (managed via ISystemRoleService), not in appsettings.
/// </summary>
public interface ISystemAuthorizationService
{
    /// <summary>
    /// Returns the list of system role names granted to the user identified by <paramref name="upn"/>.
    /// Returns an empty list when the UPN is null, the user is not found in AD, no active
    /// gov.SystemRoles exist, or no active group DNs match.
    /// </summary>
    Task<IReadOnlyList<string>> GetUserRolesAsync(string? upn, CancellationToken ct = default);

    /// <summary>
    /// Resolves the single highest-priority role from <paramref name="roles"/>, using the
    /// Priority column on gov.SystemRoles (lower = resolved first). Returns null when
    /// <paramref name="roles"/> is empty. This is the sole source of role-priority logic —
    /// the frontend must not re-implement it.
    /// </summary>
    /// <exception cref="InvalidOperationException">
    /// Thrown when <paramref name="roles"/> is non-empty but none of its entries are currently
    /// active in gov.SystemRoles — this is intentionally fail-fast: the service never assigns
    /// a role by arrival order.
    /// </exception>
    Task<string?> ResolvePrimaryRoleAsync(IReadOnlyList<string> roles, CancellationToken ct = default);
}
