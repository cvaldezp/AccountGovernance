namespace AccountGovernance.Application.Interfaces;

/// <summary>
/// Maps an authenticated user's on-premises AD group memberships to system role names.
/// Role → group DN mappings are configured in appsettings Authorization:RoleMappings.
/// </summary>
public interface ISystemAuthorizationService
{
    /// <summary>
    /// Returns the list of system role names granted to the user identified by <paramref name="upn"/>.
    /// Returns an empty list when the UPN is null, the user is not found in AD, or no configured
    /// group DNs match.
    /// </summary>
    Task<IReadOnlyList<string>> GetUserRolesAsync(string? upn, CancellationToken ct = default);
}
