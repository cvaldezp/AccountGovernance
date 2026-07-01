using System.DirectoryServices.Protocols;
using System.Globalization;
using AccountGovernance.Domain.Entities;

namespace AccountGovernance.Infrastructure.AdGateway;

/// <summary>Maps a raw LDAP SearchResultEntry to a clean domain User.</summary>
internal static class AdUserMapper
{
    private static string? GetAttr(SearchResultEntry entry, string attr)
    {
        if (!entry.Attributes.Contains(attr)) return null;
        var vals = entry.Attributes[attr].GetValues(typeof(string));
        return vals.Length > 0 ? vals[0] as string : null;
    }

    private static DateTime? GetFileTime(SearchResultEntry entry, string attr)
    {
        var raw = GetAttr(entry, attr);
        if (raw is null || !long.TryParse(raw, out var ticks) || ticks <= 0) return null;
        return DateTime.FromFileTimeUtc(ticks);
    }

    /// <summary>
    /// Parses LDAP Generalized Time (RFC 4517): YYYYMMDDHHmmss[.f+]Z
    /// AD uses this format for whenCreated and whenChanged.
    /// </summary>
    private static DateTime? GetGeneralizedTime(SearchResultEntry entry, string attr)
    {
        var raw = GetAttr(entry, attr);
        if (raw is null) return null;

        // Strip fractional seconds (e.g. ".0", ".00") before the trailing Z
        var dotIdx = raw.IndexOf('.');
        var normalized = dotIdx >= 0
            ? string.Concat(raw.AsSpan(0, dotIdx), "Z")
            : raw;

        return DateTime.TryParseExact(
            normalized, "yyyyMMddHHmmss'Z'",
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
            out var dt)
            ? dt
            : null;
    }

    internal static User Map(SearchResultEntry entry)
    {
        // Collect all attributes into the raw bag
        var raw = new Dictionary<string, string?>();
        foreach (string name in entry.Attributes.AttributeNames)
            raw[name] = GetAttr(entry, name);

        // userAccountControl bit 1 = ACCOUNTDISABLE (enabled when bit is NOT set)
        var uacStr  = GetAttr(entry, "userAccountControl");
        var uacInt  = uacStr is not null && int.TryParse(uacStr, out var f) ? f : (int?)null;
        var enabled = uacInt is not null && (uacInt.Value & 2) == 0;

        return new User
        {
            SamAccountName    = GetAttr(entry, "sAMAccountName")             ?? string.Empty,
            DisplayName       = GetAttr(entry, "displayName")                ?? string.Empty,
            GivenName         = GetAttr(entry, "givenName"),
            Surname           = GetAttr(entry, "sn"),
            UserPrincipalName = GetAttr(entry, "userPrincipalName"),
            CustomBannerID    = GetAttr(entry, "CustomBannerID"),

            Email             = GetAttr(entry, "mail"),
            ExternalEmail     = GetAttr(entry, "Custom-External-Email-Address"),
            TelephoneNumber   = GetAttr(entry, "telephoneNumber"),
            Mobile            = GetAttr(entry, "mobile"),

            Company           = GetAttr(entry, "company"),
            Department        = GetAttr(entry, "department"),
            JobTitle          = GetAttr(entry, "title"),
            Manager           = GetAttr(entry, "manager"),
            Office            = GetAttr(entry, "physicalDeliveryOfficeName"),

            ExtensionAttribute1  = GetAttr(entry, "extensionAttribute1"),
            ExtensionAttribute2  = GetAttr(entry, "extensionAttribute2"),
            ExtensionAttribute3  = GetAttr(entry, "extensionAttribute3"),
            ExtensionAttribute13 = GetAttr(entry, "extensionAttribute13"),

            UserAccountControl = uacInt,
            IsEnabled          = enabled,
            WhenCreated        = GetGeneralizedTime(entry, "whenCreated"),
            WhenChanged        = GetGeneralizedTime(entry, "whenChanged"),
            LastLogon          = GetFileTime(entry, "lastLogonTimestamp"),
            DistinguishedName  = GetAttr(entry, "distinguishedName"),

            RawAttributes = raw,
        };
    }
}
