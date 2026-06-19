using AccountGovernance.Domain.Entities;

namespace AccountGovernance.Application.Interfaces;

/// <summary>Result of an AD user search.</summary>
public sealed record AdSearchResult(
    IReadOnlyList<User> Users,
    bool                TooManyResults);

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
    string  Password              // Used inline only; never stored or logged
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
}
