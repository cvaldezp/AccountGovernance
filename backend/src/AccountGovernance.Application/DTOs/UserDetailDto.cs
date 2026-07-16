namespace AccountGovernance.Application.DTOs;

/// <summary>
/// Perfil completo de un usuario AD. Las propiedades nombradas son únicamente
/// información estructural (siempre presente, no gobernada por el Catálogo AD).
/// Cualquier atributo administrable por el Catálogo (Oficina, Teléfono, Email
/// Externo, Estado de Cuenta técnico, y cualquier atributo futuro) vive
/// exclusivamente en <see cref="Attributes"/>, indexado por el AdAttributeName
/// real — nunca duplicado como propiedad nombrada.
/// </summary>
public sealed record UserDetailDto(
    // Identity
    string    SamAccountName,
    string?   CustomBannerID,
    string    DisplayName,
    string?   GivenName,
    string?   Sn,
    string?   Mail,
    string?   UserPrincipalName,

    // Organization
    string?   Company,
    string?   Department,
    string?   Title,
    string?   Manager,

    // Contact
    string?   Mobile,

    // Extension attributes
    string?   ExtensionAttribute1,
    string?   ExtensionAttribute2,
    string?   ExtensionAttribute3,

    // Account state
    bool      IsEnabled,
    DateTime? WhenCreated,
    DateTime? WhenChanged,
    DateTime? LastLogon,
    string?   DistinguishedName,

    /// <summary>Todo atributo AD solicitado (base + activos del Catálogo), indexado
    /// por su AdAttributeName real exacto. Fuente única para atributos administrables.</summary>
    IReadOnlyDictionary<string, string?> Attributes
);
