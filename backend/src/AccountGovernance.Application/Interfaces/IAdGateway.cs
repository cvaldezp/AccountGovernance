using AccountGovernance.Domain.Entities;

namespace AccountGovernance.Application.Interfaces;

/// <summary>Result of an AD user search.</summary>
/// <param name="Users">Matched users (may be empty).</param>
/// <param name="TooManyResults">
/// True when the LDAP server hit its size limit before returning all matches.
/// The caller should ask the user for a more specific identifier.
/// </param>
public sealed record AdSearchResult(
    IReadOnlyList<User> Users,
    bool                TooManyResults);

/// <summary>
/// Abstraction over the Active Directory connection.
/// All AD I/O is routed through this interface so Infrastructure stays isolated.
/// </summary>
public interface IAdGateway
{
    /// <summary>
    /// Search users by institutional identifier (Banner code, mail, UPN, sAMAccountName).
    /// Returns at most <paramref name="maxResults"/> entries (hard cap: 20).
    /// </summary>
    Task<AdSearchResult> SearchUsersAsync(
        string query,
        int    maxResults = 20,
        CancellationToken ct = default);

    /// <summary>Fetch a full user profile by exact sAMAccountName. Returns null when not found.</summary>
    Task<User?> GetUserByAccountAsync(
        string samAccountName,
        CancellationToken ct = default);
}
