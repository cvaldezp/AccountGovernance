namespace AccountGovernance.Domain.Entities;

public sealed class User
{
    // ── Identity ──────────────────────────────────────────────────────────────
    public required string SamAccountName    { get; init; }
    public required string DisplayName       { get; init; }
    public string?         GivenName         { get; init; }
    public string?         Surname           { get; init; }
    public string?         UserPrincipalName { get; init; }
    public string?         CustomBannerID    { get; init; }

    // ── Contact ───────────────────────────────────────────────────────────────
    public string?         Email             { get; init; }
    public string?         ExternalEmail     { get; init; }
    public string?         TelephoneNumber   { get; init; }
    public string?         Mobile            { get; init; }

    // ── Organization ─────────────────────────────────────────────────────────
    public string?         Company           { get; init; }
    public string?         Department        { get; init; }
    public string?         JobTitle          { get; init; }
    public string?         Manager           { get; init; }
    public string?         Office            { get; init; }

    // ── Extension attributes ──────────────────────────────────────────────────
    public string?         ExtensionAttribute1 { get; init; }
    public string?         ExtensionAttribute2 { get; init; }
    public string?         ExtensionAttribute3 { get; init; }

    // ── Account state ─────────────────────────────────────────────────────────
    public int?            UserAccountControl { get; init; }
    public bool            IsEnabled          { get; init; }
    public DateTime?       WhenCreated        { get; init; }
    public DateTime?       WhenChanged        { get; init; }
    public DateTime?       LastLogon          { get; init; }
    public string?         DistinguishedName  { get; init; }

    /// <summary>Raw LDAP attribute bag — only populated for full profile requests.</summary>
    public IReadOnlyDictionary<string, string?> RawAttributes { get; init; }
        = new Dictionary<string, string?>();
}
