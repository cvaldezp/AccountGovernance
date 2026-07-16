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
    // Email, Mobile son estructurales (siempre se piden, no gobernados por el
    // Catálogo AD). ExternalEmail/TelephoneNumber se quitaron de acá — son
    // atributos administrables por el Catálogo, viven solo en RawAttributes.
    public string?         Email             { get; init; }
    public string?         Mobile            { get; init; }

    // ── Organization ─────────────────────────────────────────────────────────
    public string?         Company           { get; init; }
    public string?         Department        { get; init; }
    public string?         JobTitle          { get; init; }
    public string?         Manager           { get; init; }

    // ── Extension attributes ──────────────────────────────────────────────────
    public string?         ExtensionAttribute1  { get; init; }
    public string?         ExtensionAttribute2  { get; init; }
    public string?         ExtensionAttribute3  { get; init; }
    public string?         ExtensionAttribute13 { get; init; }

    // ── Account state ─────────────────────────────────────────────────────────
    // UserAccountControl (el entero crudo) se quitó — es administrable por el
    // Catálogo (field-account-status), vive solo en RawAttributes. IsEnabled
    // es estructural: se calcula acá del bit ACCOUNTDISABLE y es la fuente
    // autoritativa para el badge/botón de habilitar-deshabilitar.
    public bool            IsEnabled          { get; init; }
    public DateTime?       WhenCreated        { get; init; }
    public DateTime?       WhenChanged        { get; init; }
    public DateTime?       LastLogon          { get; init; }
    public string?         DistinguishedName  { get; init; }

    /// <summary>Raw LDAP attribute bag — only populated for full profile requests.</summary>
    public IReadOnlyDictionary<string, string?> RawAttributes { get; init; }
        = new Dictionary<string, string?>();
}
