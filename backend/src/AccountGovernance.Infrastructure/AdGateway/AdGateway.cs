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
    ILogger<AdGateway>         logger,
    IFieldDefinitionsCache     fieldDefinitionsCache
) : IAdGateway
{
    // Minimal attribute set for search results (list view) — unchanged, out of
    // scope for the dynamic-attributes work (only the detail view needs it).
    private static readonly string[] SearchFetchAttributes =
    [
        "sAMAccountName", "displayName", "mail", "department",
        "physicalDeliveryOfficeName",
        "CustomBannerID",
        "userAccountControl",
    ];

    // Structural attributes the app always needs for the detail view, regardless
    // of what's configured in gov.FieldDefinitions. Attributes managed through
    // the AD Attribute Catalog (Oficina, Teléfono, Email Externo, Estado de
    // Cuenta técnico, y cualquier atributo futuro) NO viven acá — se agregan
    // dinámicamente en GetDetailAttributesAsync().
    private static readonly string[] BaseDetailAttributes =
    [
        "sAMAccountName", "displayName", "givenName", "sn", "userPrincipalName",
        "mail", "mobile",
        "company", "department", "title", "manager",
        "CustomBannerID",
        "extensionAttribute1", "extensionAttribute2", "extensionAttribute3", "extensionAttribute13",
        "userAccountControl", "whenCreated", "whenChanged",
        "lastLogonTimestamp", "distinguishedName", "memberOf",
    ];

    private static readonly string[] ExistenceAttributes = ["sAMAccountName"];

    /// <summary>
    /// Atributos a pedir para la vista de detalle: los estructurales fijos más
    /// los que estén activos hoy en gov.FieldDefinitions (Catálogo AD) — sin
    /// duplicados. Así un atributo nuevo creado en el Catálogo se consulta
    /// automáticamente, sin tocar este archivo ni recompilar.
    /// </summary>
    private async Task<string[]> GetDetailAttributesAsync(CancellationToken ct)
    {
        var active = await fieldDefinitionsCache.GetActiveAsync(ct);
        return BaseDetailAttributes
            .Concat(active.Select(d => d.AdAttributeName))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    // ── User search ────────────────────────────────────────────────────────────

    public async Task<AdSearchResult> SearchUsersAsync(
        string query, int maxResults = 20, CancellationToken ct = default)
    {
        var q      = query.Trim();
        var filter = BuildSearchFilter(q);
        var cap    = Math.Min(maxResults, options.Value.MaxSearchResults);

        logger.LogDebug("AD search — filter: {Filter}", filter);

        var result = await RunSearchAsync(q, filter, cap, SearchFetchAttributes, ct);

        return result;
    }

    public async Task<User?> GetUserByAccountAsync(
        string samAccountName, CancellationToken ct = default)
    {
        var escaped    = EscapeLdap(samAccountName);
        var filter     = $"(&(objectClass=user)(objectCategory=person)(sAMAccountName={escaped}))";
        var attributes = await GetDetailAttributesAsync(ct);
        var result     = await RunSearchAsync(samAccountName, filter, 1, attributes, ct);
        return result.Users.Count > 0 ? result.Users[0] : null;
    }

    public async Task<User?> GetUserByUpnOrMailAsync(
        string upnOrMail, CancellationToken ct = default)
    {
        var esc        = EscapeLdap(upnOrMail);
        var filter     = $"(&(objectClass=user)(objectCategory=person)(|(userPrincipalName={esc})(mail={esc})))";
        var attributes = await GetDetailAttributesAsync(ct);
        var result     = await RunSearchAsync(upnOrMail, filter, 1, attributes, ct);
        return result.Users.Count > 0 ? result.Users[0] : null;
    }

    // ── Pre-creation validation ────────────────────────────────────────────────

    public Task<bool> SamAccountNameExistsAsync(string sam, CancellationToken ct = default)
    {
        var filter = $"(&(objectClass=user)(sAMAccountName={EscapeLdap(sam)}))";
        return CountAsync(filter, ct);
    }

    public Task<bool> UserPrincipalNameExistsAsync(string upn, CancellationToken ct = default)
    {
        var filter = $"(&(objectClass=user)(userPrincipalName={EscapeLdap(upn)}))";
        return CountAsync(filter, ct);
    }

    public Task<bool> UserExistsAndIsEnabledAsync(string upnOrMail, CancellationToken ct = default)
    {
        // Match by UPN or mail; exclude disabled accounts (ACCOUNTDISABLE bit = 0x02)
        var esc    = EscapeLdap(upnOrMail);
        var filter = $"(&(objectClass=user)(|(userPrincipalName={esc})(mail={esc}))" +
                     "(!(userAccountControl:1.2.840.113556.1.4.803:=2)))";
        return CountAsync(filter, ct);
    }

    public Task<bool> OuExistsAsync(string ouDistinguishedName, CancellationToken ct = default)
    {
        return Task.Run(() =>
        {
            using var conn = CreateConnection();
            conn.Bind();

            var req = new SearchRequest(
                ouDistinguishedName,
                "(objectClass=organizationalUnit)",
                SearchScope.Base,
                ["distinguishedName"])
            {
                SizeLimit = 1,
                TimeLimit = TimeSpan.FromSeconds(options.Value.TimeoutSeconds),
            };

            try
            {
                var resp = (SearchResponse)conn.SendRequest(req);
                return resp.Entries.Count > 0;
            }
            catch (DirectoryOperationException ex)
                when (ex.Response?.ResultCode == ResultCode.NoSuchObject)
            {
                return false;
            }
        }, ct);
    }

    // ── Account provisioning ───────────────────────────────────────────────────

    public Task<AdCreateUserResult> CreateUserAsync(AdCreateUserRequest req, CancellationToken ct = default)
    {
        return Task.Run<AdCreateUserResult>(() =>
        {
            using var conn = CreateConnection();
            conn.Bind();

            try
            {
                // 1. Create the disabled user object
                var addReq = new AddRequest(req.UserDn);
                addReq.Attributes.Add(new DirectoryAttribute("objectClass",
                    "top", "person", "organizationalPerson", "user"));
                addReq.Attributes.Add(new DirectoryAttribute("sAMAccountName",       req.SamAccountName));
                addReq.Attributes.Add(new DirectoryAttribute("userPrincipalName",    req.UserPrincipalName));
                addReq.Attributes.Add(new DirectoryAttribute("displayName",          req.DisplayName));
                addReq.Attributes.Add(new DirectoryAttribute("userAccountControl",   "514")); // disabled

                if (!string.IsNullOrWhiteSpace(req.GivenName))
                    addReq.Attributes.Add(new DirectoryAttribute("givenName", req.GivenName));
                if (!string.IsNullOrWhiteSpace(req.Sn))
                    addReq.Attributes.Add(new DirectoryAttribute("sn", req.Sn));
                if (!string.IsNullOrWhiteSpace(req.Company))
                    addReq.Attributes.Add(new DirectoryAttribute("company", req.Company));
                if (!string.IsNullOrWhiteSpace(req.Description))
                    addReq.Attributes.Add(new DirectoryAttribute("description", req.Description));
                if (!string.IsNullOrWhiteSpace(req.ExtensionAttribute14))
                    addReq.Attributes.Add(new DirectoryAttribute("extensionAttribute14", req.ExtensionAttribute14));
                if (!string.IsNullOrWhiteSpace(req.RecoveryEmail))
                    addReq.Attributes.Add(new DirectoryAttribute("Custom-External-Email-Address", req.RecoveryEmail));
                if (!string.IsNullOrWhiteSpace(req.Mail))
                    addReq.Attributes.Add(new DirectoryAttribute("mail", req.Mail));
                if (!string.IsNullOrWhiteSpace(req.Department))
                    addReq.Attributes.Add(new DirectoryAttribute("department", req.Department));
                if (!string.IsNullOrWhiteSpace(req.ManagerDn))
                    addReq.Attributes.Add(new DirectoryAttribute("manager", req.ManagerDn));
                if (req.AccountExpiresRaw.HasValue)
                    addReq.Attributes.Add(new DirectoryAttribute("accountExpires", req.AccountExpiresRaw.Value.ToString()));

                conn.SendRequest(addReq);

                // 2. Set password (requires SSL or signed/sealed SASL — encoding: UTF-16LE with quotes)
                var pwdBytes = Encoding.Unicode.GetBytes($"\"{req.Password}\"");
                var pwdMod   = new DirectoryAttributeModification
                {
                    Name      = "unicodePwd",
                    Operation = DirectoryAttributeOperation.Replace,
                };
                pwdMod.Add(pwdBytes);

                var setPwd = new ModifyRequest(req.UserDn);
                setPwd.Modifications.Add(pwdMod);
                conn.SendRequest(setPwd);

                // 3. Enable the account
                var enableMod = new DirectoryAttributeModification
                {
                    Name      = "userAccountControl",
                    Operation = DirectoryAttributeOperation.Replace,
                };
                enableMod.Add("512"); // Normal account, enabled
                var enable = new ModifyRequest(req.UserDn);
                enable.Modifications.Add(enableMod);
                conn.SendRequest(enable);

                // 4. Read back the objectGuid
                var searchReq = new SearchRequest(
                    req.UserDn, "(objectClass=user)", SearchScope.Base, ["objectGuid"])
                {
                    SizeLimit = 1,
                    TimeLimit = TimeSpan.FromSeconds(options.Value.TimeoutSeconds),
                };
                var searchResp = (SearchResponse)conn.SendRequest(searchReq);
                string? guid   = null;
                if (searchResp.Entries.Count > 0)
                {
                    var raw = searchResp.Entries[0].Attributes["objectGuid"];
                    if (raw?.Count > 0)
                        guid = new Guid((byte[])raw[0]).ToString();
                }

                logger.LogInformation(
                    "AD user created — SAM: {Sam}, UPN: {Upn}, DN: {Dn}",
                    req.SamAccountName, req.UserPrincipalName, req.UserDn);

                return new AdCreateUserResult(true, "Cuenta creada correctamente en Active Directory.", guid);
            }
            catch (Exception ex)
            {
                logger.LogError(ex,
                    "Error creating AD user SAM={Sam}, UPN={Upn}",
                    req.SamAccountName, req.UserPrincipalName);

                // Try to clean up the partial object
                try
                {
                    conn.SendRequest(new DeleteRequest(req.UserDn));
                    logger.LogWarning("Cleaned up partial AD object {Dn}", req.UserDn);
                }
                catch { /* best-effort rollback */ }

                return new AdCreateUserResult(false, $"Error en Active Directory: {ex.Message}", null);
            }
        }, ct);
    }

    public Task<bool> DeleteUserAsync(string userDn, CancellationToken ct = default)
    {
        return Task.Run(() =>
        {
            using var conn = CreateConnection();
            conn.Bind();
            try
            {
                conn.SendRequest(new DeleteRequest(userDn));
                logger.LogWarning("AD user deleted (rollback) — DN: {Dn}", userDn);
                return true;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to delete AD user for rollback — DN: {Dn}", userDn);
                return false;
            }
        }, ct);
    }

    // ── Group operations ───────────────────────────────────────────────────────

    private static readonly string[] GroupFetchAttributes =
        ["cn", "distinguishedName", "objectGUID", "objectSid", "groupType"];

    public Task<AdGroupSearchResult> GetGroupAsync(string query, CancellationToken ct = default)
    {
        return Task.Run<AdGroupSearchResult>(() =>
        {
            using var conn = CreateConnection();
            conn.Bind();

            var isDn = query.Contains('=');

            // ── DN lookup: use SearchScope.Base for an exact, efficient match ──
            if (isDn)
            {
                var req = new SearchRequest(
                    query, "(objectClass=group)", SearchScope.Base, GroupFetchAttributes)
                {
                    SizeLimit = 1,
                    TimeLimit = TimeSpan.FromSeconds(options.Value.TimeoutSeconds),
                };

                SearchResponse resp;
                try
                {
                    resp = (SearchResponse)conn.SendRequest(req);
                }
                catch (DirectoryOperationException ex)
                    when (ex.Response?.ResultCode is ResultCode.NoSuchObject
                                                 or ResultCode.InvalidDNSyntax)
                {
                    return new AdGroupSearchResult(null, false, null);
                }

                return resp.Entries.Count == 0
                    ? new AdGroupSearchResult(null, false, null)
                    : new AdGroupSearchResult(MapGroupEntry(resp.Entries[0]), false, null);
            }

            // ── Name / sAMAccountName search — SizeLimit=2 to detect ambiguity ──
            {
                var escaped = EscapeLdap(query);
                var filter  = $"(&(objectClass=group)(|(cn={escaped})(sAMAccountName={escaped})))";

                var req = new SearchRequest(
                    options.Value.BaseDn, filter, SearchScope.Subtree, GroupFetchAttributes)
                {
                    SizeLimit = 2,
                    TimeLimit = TimeSpan.FromSeconds(options.Value.TimeoutSeconds),
                };

                int matchCount = 0;
                List<SearchResultEntry>? entries = null;

                try
                {
                    var resp  = (SearchResponse)conn.SendRequest(req);
                    matchCount = resp.Entries.Count;
                    entries = [.. resp.Entries.Cast<SearchResultEntry>()];
                }
                catch (DirectoryOperationException ex)
                    when (ex.Response is SearchResponse sr
                       && sr.ResultCode == ResultCode.SizeLimitExceeded)
                {
                    // Server found ≥2 — it returned what it could before the limit
                    matchCount = sr.Entries.Count > 0 ? sr.Entries.Count : 2;
                    entries    = null; // treat as ambiguous
                }

                if (matchCount == 0)
                    return new AdGroupSearchResult(null, false, null);

                if (matchCount >= 2 || entries is null)
                    return new AdGroupSearchResult(null, true, matchCount);

                return new AdGroupSearchResult(MapGroupEntry(entries[0]), false, null);
            }
        }, ct);
    }

    private static AdGroupInfo MapGroupEntry(SearchResultEntry entry)
    {
        var name = GetStringAttr(entry, "cn") ?? string.Empty;
        var dn   = entry.DistinguishedName ?? GetStringAttr(entry, "distinguishedName") ?? string.Empty;

        string? objectGuid = null;
        var guidAttr = entry.Attributes["objectGUID"];
        if (guidAttr?.Count > 0)
        {
            try { objectGuid = new Guid((byte[])guidAttr[0]).ToString(); }
            catch { /* malformed */ }
        }

        string? sid = null;
        var sidAttr = entry.Attributes["objectSid"];
        if (sidAttr?.Count > 0)
        {
            try
            {
#pragma warning disable CA1416 // Windows-only API — this project runs on Windows AD infrastructure
                sid = new System.Security.Principal.SecurityIdentifier((byte[])sidAttr[0], 0).ToString();
#pragma warning restore CA1416
            }
            catch { /* malformed */ }
        }

        int groupType = 0;
        var typeAttr = entry.Attributes["groupType"];
        if (typeAttr?.Count > 0)
            int.TryParse(typeAttr[0]?.ToString(), out groupType);

        var isSecurity = (groupType & unchecked((int)0x80000000)) != 0;
        return new AdGroupInfo(name, dn, objectGuid, sid, isSecurity);
    }

    public Task<bool> AddUserToGroupAsync(string userDn, string groupDn, CancellationToken ct = default) =>
        ModifyGroupMemberAsync(groupDn, userDn, DirectoryAttributeOperation.Add, ct);

    /// <summary>
    /// Adds or removes a single DN from a group's `member` attribute. Shared by regular
    /// (security) group membership and distribution list membership — AD treats both the
    /// same way at the LDAP level (a group object with a multivalued `member` attribute).
    /// </summary>
    private Task<bool> ModifyGroupMemberAsync(
        string groupDn, string memberDn, DirectoryAttributeOperation operation, CancellationToken ct)
    {
        return Task.Run(() =>
        {
            using var conn = CreateConnection();
            conn.Bind();

            var mod = new DirectoryAttributeModification
            {
                Name      = "member",
                Operation = operation,
            };
            mod.Add(memberDn);

            var req = new ModifyRequest(groupDn);
            req.Modifications.Add(mod);

            try
            {
                conn.SendRequest(req);
                logger.LogInformation(
                    "Group membership {Operation} — Member: {MemberDn}, Group: {GroupDn}",
                    operation, memberDn, groupDn);
                return true;
            }
            catch (DirectoryOperationException ex)
            {
                logger.LogError(ex,
                    "Failed to {Operation} member {MemberDn} on group {GroupDn}",
                    operation, memberDn, groupDn);
                return false;
            }
        }, ct);
    }

    // ── Distribution lists ──────────────────────────────────────────────────────

    private static readonly string[] DistributionListFetchAttributes =
        ["cn", "distinguishedName", "mail", "description", "managedBy", "member", "groupType"];

    private static readonly string[] DistributionMemberFetchAttributes =
        ["sAMAccountName", "displayName", "mail", "userPrincipalName", "distinguishedName"];

    // groupType bit 0x80000000 (2147483648) = ADS_GROUP_TYPE_SECURITY_ENABLED.
    // Negating a bit-AND match on that bit isolates pure distribution groups.
    private const string DistributionOnlyFilter = "(!(groupType:1.2.840.113556.1.4.803:=2147483648))";

    public Task<IReadOnlyList<AdDistributionListInfo>> SearchDistributionListsAsync(
        string query, int maxResults = 20, CancellationToken ct = default)
    {
        return Task.Run<IReadOnlyList<AdDistributionListInfo>>(() =>
        {
            using var conn = CreateConnection();
            conn.Bind();

            var escaped = EscapeLdap(query.Trim());
            var filter  = $"(&(objectClass=group){DistributionOnlyFilter}(|(cn=*{escaped}*)(mail=*{escaped}*)))";
            var cap     = Math.Min(maxResults, options.Value.MaxSearchResults);

            var req = new SearchRequest(
                options.Value.BaseDn, filter, SearchScope.Subtree, DistributionListFetchAttributes)
            {
                SizeLimit = cap,
                TimeLimit = TimeSpan.FromSeconds(options.Value.TimeoutSeconds),
            };

            SearchResponse resp;
            try
            {
                resp = (SearchResponse)conn.SendRequest(req);
            }
            catch (DirectoryOperationException ex)
                when (ex.Response is SearchResponse sr && sr.ResultCode == ResultCode.SizeLimitExceeded)
            {
                logger.LogWarning("Distribution list search size limit exceeded for query '{Query}'", query);
                resp = sr;
            }

            var lists = new List<AdDistributionListInfo>(resp.Entries.Count);
            foreach (SearchResultEntry entry in resp.Entries)
                lists.Add(MapDistributionListEntry(conn, entry));

            return lists;
        }, ct);
    }

    public Task<AdDistributionListInfo?> GetDistributionListAsync(string dn, CancellationToken ct = default)
    {
        return Task.Run<AdDistributionListInfo?>(() =>
        {
            using var conn = CreateConnection();
            conn.Bind();

            var req = new SearchRequest(
                dn, "(objectClass=group)", SearchScope.Base, DistributionListFetchAttributes)
            {
                SizeLimit = 1,
                TimeLimit = TimeSpan.FromSeconds(options.Value.TimeoutSeconds),
            };

            SearchResponse resp;
            try
            {
                resp = (SearchResponse)conn.SendRequest(req);
            }
            catch (DirectoryOperationException ex)
                when (ex.Response?.ResultCode is ResultCode.NoSuchObject or ResultCode.InvalidDNSyntax)
            {
                return null;
            }

            return resp.Entries.Count == 0 ? null : MapDistributionListEntry(conn, resp.Entries[0]);
        }, ct);
    }

    /// <summary>
    /// Maps a group entry plus its resolved `managedBy` display name. Runs a second Base-scope
    /// search on the same connection when a manager DN is present — cheap and avoids a full
    /// second gateway round-trip.
    /// </summary>
    private AdDistributionListInfo MapDistributionListEntry(LdapConnection conn, SearchResultEntry entry)
    {
        var name      = GetStringAttr(entry, "cn") ?? string.Empty;
        var dn        = entry.DistinguishedName ?? GetStringAttr(entry, "distinguishedName") ?? string.Empty;
        var mail      = GetStringAttr(entry, "mail");
        var desc      = GetStringAttr(entry, "description");
        var managerDn = GetStringAttr(entry, "managedBy");

        var memberCount = entry.Attributes["member"]?.Count ?? 0;

        string? managerDisplayName = null;
        if (!string.IsNullOrEmpty(managerDn))
        {
            try
            {
                var mreq = new SearchRequest(
                    managerDn, "(objectClass=*)", SearchScope.Base, ["displayName"])
                {
                    SizeLimit = 1,
                    TimeLimit = TimeSpan.FromSeconds(options.Value.TimeoutSeconds),
                };
                var mresp = (SearchResponse)conn.SendRequest(mreq);
                if (mresp.Entries.Count > 0)
                    managerDisplayName = GetStringAttr(mresp.Entries[0], "displayName");
            }
            catch (DirectoryOperationException)
            {
                // Manager DN could not be resolved (deleted/moved) — fall back to the raw DN.
            }
        }

        return new AdDistributionListInfo(name, dn, mail, desc, managerDn, managerDisplayName, memberCount);
    }

    public Task<IReadOnlyList<AdDistributionListMemberInfo>> GetDistributionListMembersAsync(
        string dn, CancellationToken ct = default)
    {
        return Task.Run<IReadOnlyList<AdDistributionListMemberInfo>>(() =>
        {
            using var conn = CreateConnection();
            conn.Bind();

            // Reverse lookup via memberOf — one query instead of resolving each `member` DN.
            var filter = $"(&(objectClass=user)(objectCategory=person)(memberOf={EscapeLdap(dn)}))";
            var req = new SearchRequest(
                options.Value.BaseDn, filter, SearchScope.Subtree, DistributionMemberFetchAttributes)
            {
                SizeLimit = options.Value.MaxSearchResults,
                TimeLimit = TimeSpan.FromSeconds(options.Value.TimeoutSeconds),
            };

            SearchResponse resp;
            try
            {
                resp = (SearchResponse)conn.SendRequest(req);
            }
            catch (DirectoryOperationException ex)
                when (ex.Response is SearchResponse sr && sr.ResultCode == ResultCode.SizeLimitExceeded)
            {
                logger.LogWarning("Distribution list member search size limit exceeded for DN '{Dn}'", dn);
                resp = sr;
            }

            var members = new List<AdDistributionListMemberInfo>(resp.Entries.Count);
            foreach (SearchResultEntry entry in resp.Entries)
            {
                try
                {
                    var user = AdUserMapper.Map(entry, DistributionMemberFetchAttributes);
                    members.Add(new AdDistributionListMemberInfo(
                        user.DisplayName, user.Email, user.SamAccountName,
                        user.DistinguishedName ?? string.Empty));
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Skipping malformed distribution list member entry for list {Dn}", dn);
                }
            }

            return members;
        }, ct);
    }

    public Task<bool> AddMemberToDistributionListAsync(
        string listDn, string memberDn, CancellationToken ct = default) =>
        ModifyGroupMemberAsync(listDn, memberDn, DirectoryAttributeOperation.Add, ct);

    public Task<bool> RemoveMemberFromDistributionListAsync(
        string listDn, string memberDn, CancellationToken ct = default) =>
        ModifyGroupMemberAsync(listDn, memberDn, DirectoryAttributeOperation.Delete, ct);

    public Task<IReadOnlyList<string>> GetUserGroupDnsAsync(string upn, CancellationToken ct = default)
    {
        return Task.Run<IReadOnlyList<string>>(() =>
        {
            using var conn = CreateConnection();
            conn.Bind();

            var filter = $"(&(objectClass=user)(userPrincipalName={EscapeLdap(upn)}))";
            var req    = new SearchRequest(
                options.Value.BaseDn,
                filter,
                SearchScope.Subtree,
                ["memberOf"])
            {
                SizeLimit = 1,
                TimeLimit = TimeSpan.FromSeconds(options.Value.TimeoutSeconds),
            };

            var resp = (SearchResponse)conn.SendRequest(req);
            if (resp.Entries.Count == 0)
                return [];

            var memberOf = resp.Entries[0].Attributes["memberOf"];
            if (memberOf is null)
                return [];

            var groups = new List<string>(memberOf.Count);
            for (var i = 0; i < memberOf.Count; i++)
            {
                var val = memberOf[i]?.ToString();
                if (val is not null) groups.Add(val);
            }

            return groups;
        }, ct);
    }

    private static string? GetStringAttr(SearchResultEntry entry, string name)
    {
        var attr = entry.Attributes[name];
        return attr?.Count > 0 ? attr[0]?.ToString() : null;
    }

    // ── Filter construction ────────────────────────────────────────────────────

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

    // ── Internal helpers ───────────────────────────────────────────────────────

    private Task<bool> CountAsync(string filter, CancellationToken ct)
    {
        return Task.Run(() =>
        {
            using var conn = CreateConnection();
            conn.Bind();

            var req = new SearchRequest(
                options.Value.BaseDn, filter, SearchScope.Subtree, ExistenceAttributes)
            {
                SizeLimit = 1,
                TimeLimit = TimeSpan.FromSeconds(options.Value.TimeoutSeconds),
            };

            var resp = (SearchResponse)conn.SendRequest(req);
            return resp.Entries.Count > 0;
        }, ct);
    }

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
                try   { users.Add(AdUserMapper.Map(entry, attributes)); }
                catch (Exception ex)
                {
                    logger.LogWarning(
                        ex, "Skipping malformed AD entry {DN}", entry.DistinguishedName);
                }
            }

            return new AdSearchResult(users, TooManyResults: false);
        }, ct);
    }

    // ── Connection ─────────────────────────────────────────────────────────────

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
