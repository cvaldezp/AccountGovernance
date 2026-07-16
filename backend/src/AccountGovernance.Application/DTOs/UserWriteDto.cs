namespace AccountGovernance.Application.DTOs;

/// <summary>
/// Actualiza un único atributo AD de un usuario. <see cref="PreviousValue"/> es
/// obligatorio (aunque su contenido pueda ser null) — es el valor que el cliente
/// tenía cargado en pantalla; el backend lo compara contra el valor actual real
/// en AD antes de escribir, para evitar sobrescrituras concurrentes silenciosas
/// (ver UserService.UpdateAttributeAsync, código STALE_VALUE → 409).
/// </summary>
/// <param name="Value">
/// Nuevo valor. <c>null</c> o cadena vacía limpia el atributo (LDAP Delete) en
/// vez de escribirlo (LDAP Replace).
/// </param>
public sealed record UpdateUserAttributeDto(string? Value, string? PreviousValue);

/// <summary>Resultado de <see cref="UpdateUserAttributeDto"/> — refleja lo que realmente ocurrió en AD.</summary>
public sealed record UpdateUserAttributeResultDto(
    string  AdAttributeName,
    string? OldValue,
    string? NewValue,
    bool    Changed);

/// <summary>Habilita o deshabilita una cuenta AD (bit ACCOUNTDISABLE de userAccountControl).</summary>
public sealed record UpdateAccountStatusDto(bool Enabled);

/// <summary>Resultado de <see cref="UpdateAccountStatusDto"/> — estado final confirmado tras re-consultar AD.</summary>
public sealed record UpdateAccountStatusResultDto(bool Enabled, bool Changed);
