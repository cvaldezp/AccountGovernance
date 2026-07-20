namespace AccountGovernance.Application.DTOs;

public sealed record AccountNamingPolicyDto(
    string   AllowedChars,
    int      MinLength,
    int      MaxLength,
    bool     DisallowLeadingTrailingSpecialChars,
    bool     DisallowConsecutiveSpecialChars,
    DateTime UpdatedAt,
    string?  UpdatedBy
);

public sealed record UpdateAccountNamingPolicyDto(
    string AllowedChars,
    int    MinLength,
    int    MaxLength,
    bool   DisallowLeadingTrailingSpecialChars,
    bool   DisallowConsecutiveSpecialChars
);

/// <summary>
/// Resultado de validar/normalizar un nombre de cuenta contra la política vigente.
/// NormalizedValue siempre se calcula (trim + minúsculas culturalmente estables),
/// incluso cuando IsValid=false — así el caller puede mostrar en la vista previa
/// exactamente el valor normalizado, sin inventar ni ocultar nada, junto al motivo
/// del rechazo.
/// </summary>
public sealed record AccountNameValidationResult(
    bool    IsValid,
    string  NormalizedValue,
    string? ErrorMessage
);
