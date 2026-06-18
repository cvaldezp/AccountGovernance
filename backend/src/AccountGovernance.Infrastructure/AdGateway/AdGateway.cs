using System.DirectoryServices.Protocols;
using System.Net;
using System.Text;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AccountGovernance.Infrastructure.AdGateway;

public sealed class AdGateway(
    IOptions<AdGatewayOptions> options,
    ILogger<AdGateway>         logger
) : IAdGateway
{
    // Minimal attribute set for search results (list view)
    private static readonly string[] SearchFetchAttributes =
    [
        "sAMAccountName", "displayName", "mail", "department",
        "physicalDeliveryOfficeName",
        "CustomBannerID",
        "userAccountControl",
    ];

    // Full attribute set for the single-user detail view
    private static readonly string[] DetailFetchAttributes =
    [
        "sAMAccountName", "displayName", "givenName", "sn", "userPrincipalName",
        "mail", "Custom-External-Email-Address", "telephoneNumber", "mobile",
        "company", "department", "title", "manager",
        "physicalDeliveryOfficeName",
        "CustomBannerID",
        "extensionAttribute1", "extensionAttribute2", "extensionAttribute3",
        "userAccountControl", "whenCreated", "whenChanged",
        "lastLogonTimestamp", "distinguishedName",
    ];

    // ── Public API ────────────────────────────────────────────────────────────

    public async Task<AdSearchResult> SearchUsersAsync(
        string query, int maxResults = 20, CancellationToken ct = default)
    {
        var q      = query.Trim();
        var filter = BuildSearchFilter(q);
        var cap    = Math.Min(maxResults, options.Value.MaxSearchResults);

        logger.LogDebug("AD search — filter: {Filter}", filter);
        return await RunSearchAsync(q, filter, cap, SearchFetchAttributes, ct);
    }

    public async Task<User?> GetUserByAccountAsync(
        string samAccountName, CancellationToken ct = default)
    {
        var escaped = EscapeLdap(samAccountName);
        var filter  = $"(&(objectClass=user)(objectCategory=person)(sAMAccountName={escaped}))";
        var result  = await RunSearchAsync(samAccountName, filter, 1, DetailFetchAttributes, ct);
        return result.Users.Count > 0 ? result.Users[0] : null;
    }

    // ── Filter construction ───────────────────────────────────────────────────

    /// <summary>
    /// Narrow OR filter on institutional identifiers only.
    /// No wildcard on displayName — avoids size-limit explosions.
    /// </summary>
    private string BuildSearchFilter(string q)
    {
        var escaped = EscapeLdap(q);
        var or      = new StringBuilder();

        or.Append($"(CustomBannerID={escaped})");
        or.Append($"(mail={escaped})");
        or.Append($"(userPrincipalName={escaped})");
        or.Append($"(sAMAccountName={escaped})");

        if (q.Contains('@'))
        {
            var localPart = EscapeLdap(q.Split('@')[0]);
            or.Append($"(sAMAccountName={localPart})");
            or.Append($"(mail={localPart}@usfq.edu.ec)");
            or.Append($"(mail={localPart}@estud.usfq.edu.ec)");
            or.Append($"(userPrincipalName={localPart}@usfq.edu.ec)");
            or.Append($"(userPrincipalName={localPart}@estud.usfq.edu.ec)");
        }
        else
        {
            or.Append($"(mail={escaped}@usfq.edu.ec)");
            or.Append($"(mail={escaped}@estud.usfq.edu.ec)");
            or.Append($"(userPrincipalName={escaped}@usfq.edu.ec)");
            or.Append($"(userPrincipalName={escaped}@estud.usfq.edu.ec)");

            if (q.Length >= 4)
                or.Append($"(sAMAccountName={escaped}*)");
        }

        return $"(&(objectClass=user)(objectCategory=person)(|{or}))";
    }

    // ── Search execution ──────────────────────────────────────────────────────

    private Task<AdSearchResult> RunSearchAsync(
        string rawQuery, string filter, int sizeLimit,
        string[] attributes, CancellationToken ct)
    {
        return Task.Run(() =>
        {
            using var conn = CreateConnection();
            conn.Bind();

            var opts    = options.Value;
            var request = new SearchRequest(
                opts.BaseDn, filter, SearchScope.Subtree, attributes)
            {
                SizeLimit = sizeLimit,
                TimeLimit = TimeSpan.FromSeconds(opts.TimeoutSeconds),
            };

            SearchResponse response;
            try
            {
                response = (SearchResponse)conn.SendRequest(request);
            }
            catch (DirectoryOperationException ex)
                when (ex.Response is SearchResponse sr
                   && sr.ResultCode == ResultCode.SizeLimitExceeded)
            {
                logger.LogWarning(
                    "LDAP size limit exceeded for query '{Query}' (limit={Limit})",
                    rawQuery, sizeLimit);
                return new AdSearchResult([], TooManyResults: true);
            }

            var users = new List<User>(response.Entries.Count);
            foreach (SearchResultEntry entry in response.Entries)
            {
                try   { users.Add(AdUserMapper.Map(entry)); }
                catch (Exception ex)
                {
                    logger.LogWarning(
                        ex, "Skipping malformed AD entry {DN}", entry.DistinguishedName);
                }
            }

            return new AdSearchResult(users, TooManyResults: false);
        }, ct);
    }

    // ── Connection ────────────────────────────────────────────────────────────

    private LdapConnection CreateConnection()
    {
        var opts = options.Value;
        var id   = new LdapDirectoryIdentifier(opts.Server, opts.Port);
        var cred = new NetworkCredential(opts.Username, opts.Password, opts.Domain);

        var conn = new LdapConnection(id, cred) { AuthType = AuthType.Negotiate };
        conn.SessionOptions.ProtocolVersion = 3;
        conn.Timeout = TimeSpan.FromSeconds(opts.TimeoutSeconds);

        if (opts.UseSSL)
            conn.SessionOptions.SecureSocketLayer = true;

        return conn;
    }

    // RFC 4515 — escape special characters in LDAP filter values
    private static string EscapeLdap(string input) =>
        input.Replace("\\", "\\5c")
             .Replace("*",  "\\2a")
             .Replace("(",  "\\28")
             .Replace(")",  "\\29")
             .Replace("\0", "\\00");
}
