namespace AccountGovernance.Domain.Entities;

/// <summary>
/// Fila única (Id=1, garantizado físicamente por CHECK en gov.AccountNamingPolicy —
/// ver schema.sql) que define la política de nombres de cuenta para todo el sistema
/// de creación de cuentas (Genéricas, Partner, Servicio, Extensión, Privilegiadas y
/// cualquier tipo futuro). AllowedChars es una enumeración LITERAL de caracteres
/// permitidos, nunca un patrón/regex — la validación es por pertenencia a un
/// conjunto, no por expresión regular.
/// </summary>
public sealed class AccountNamingPolicy
{
    public int      Id                                  { get; set; } = 1;
    public required string AllowedChars                 { get; set; }
    public int      MinLength                           { get; set; }
    public int      MaxLength                            { get; set; }
    public bool     DisallowLeadingTrailingSpecialChars   { get; set; }
    public bool     DisallowConsecutiveSpecialChars       { get; set; }
    public DateTime UpdatedAt                             { get; set; }
    public string?  UpdatedBy                             { get; set; }
}
