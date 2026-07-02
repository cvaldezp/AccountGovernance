using AccountGovernance.Domain.Entities;

namespace AccountGovernance.Application.Interfaces;

/// <summary>Result of an AD user search.</summary>
public sealed record AdSearchResult(
    IReadOnlyList<User> Users,
    bool                TooManyResults);

/// <summary>Basic info returned when looking up an AD group.</summary>
public sealed record AdGroupInfo(
    string  Name,
    string  Dn,
    string? ObjectGuid,
    string? Sid,
    bool    IsSecurity
);

/// <summary>
/// Result of a group search that may match 0, 1, or more than 1 group.
/// When Ambiguous=true the caller should ask the user for a more specific query (full DN).
/// </summary>
public sealed record AdGroupSearchResult(
    AdGroupInfo? Group,       // non-null only when exactly one group was found
    bool         Ambiguous,   // true when 2+ groups matched the query
    int?         MatchCount   // approximate count when Ambiguous=true
);

/// <summary>Full set of attributes needed to create an AD user account.</summary>
public sealed record AdCreateUserRequest(
    string  UserDn,
    string  SamAccountName,
    string  UserPrincipalName,
    string  DisplayName,
    string? GivenName,
    string? Sn,
    string? Company,
    string? Description,
    string? ExtensionAttribute14,
    string? RecoveryEmail,
    string? Mail,
    string? Department,
    string? ManagerDn,
    string  Password,             // Used inline only; never stored or logged
    long?   AccountExpiresRaw = null  // Windows FileTime; null = omit attribute (never expires)
);

public sealed record AdCreateUserResult(
    bool    Success,
    string  Message,
    string? ObjectGuid
);

/// <summary>
/// Abstraction over the Active Directory connection.
/// All AD I/O is routed through this interface so Infrastructure stays isolated.
/// </summary>
public interface IAdGateway
{
    // ── User search ──────────────────────────────────────────────────────────

    Task<AdSearchResult> SearchUsersAsync(
        string query,
        int    maxResults = 20,
        CancellationToken ct = default);

    Task<User?> GetUserByAccountAsync(
        string samAccountName,
        CancellationToken ct = default);

    /// <summary>Returns a full user profile matching the given UPN or mail address, or null if not found.</summary>
    Task<User?> GetUserByUpnOrMailAsync(
        string upnOrMail,
        CancellationToken ct = default);

    // ── Pre-creation validation ───────────────────────────────────────────────

    /// <summary>Returns true when a user with the given sAMAccountName already exists.</summary>
    Task<bool> SamAccountNameExistsAsync(string sam, CancellationToken ct = default);

    /// <summary>Returns true when a user with the given userPrincipalName already exists.</summary>
    Task<bool> UserPrincipalNameExistsAsync(string upn, CancellationToken ct = default);

    /// <summary>Returns true when a user matching the given UPN or mail exists and is enabled.</summary>
    Task<bool> UserExistsAndIsEnabledAsync(string upnOrMail, CancellationToken ct = default);

    /// <summary>Returns true when the OU distinguished name exists in AD.</summary>
    Task<bool> OuExistsAsync(string ouDistinguishedName, CancellationToken ct = default);

    // ── Account provisioning ──────────────────────────────────────────────────

    /// <summary>Creates a new user in AD with the given attributes and password.</summary>
    Task<AdCreateUserResult> CreateUserAsync(AdCreateUserRequest request, CancellationToken ct = default);

    /// <summary>Deletes a user from AD by DN — used for rollback after partial creation failures.</summary>
    Task<bool> DeleteUserAsync(string userDn, CancellationToken ct = default);

    // ── Group operations ──────────────────────────────────────────────────────────

    /// <summary>
    /// Looks up an AD group by DN (when the query contains '='), by CN, or by sAMAccountName.
    /// Returns Found (single match), NotFound, or Ambiguous (2+ matches).
    /// </summary>
    Task<AdGroupSearchResult> GetGroupAsync(string query, CancellationToken ct = default);

    /// <summary>Adds the user (by DN) as a member of the group (by DN). Returns true on success.</summary>
    Task<bool> AddUserToGroupAsync(string userDn, string groupDn, CancellationToken ct = default);

    // ── Authorization support ─────────────────────────────────────────────────────

    /// <summary>Returns the DN of each group the specified user is a direct member of (via memberOf attribute).</summary>
    Task<IReadOnlyList<string>> GetUserGroupDnsAsync(string upn, CancellationToken ct = default);
}
