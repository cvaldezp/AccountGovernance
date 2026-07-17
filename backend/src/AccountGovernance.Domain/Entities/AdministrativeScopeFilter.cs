using AccountGovernance.Domain.Enums;

namespace AccountGovernance.Domain.Entities;

/// <summary>
/// Una regla simple de pertenencia a un AdministrativeScope: "¿AttributeName
/// del usuario cumple Operator+Value?". El evaluador de autorización es
/// genérico sobre estos tres campos — agregar un criterio de negocio nuevo
/// (Company, extensionAttribute14, etc.) es una fila de datos, no código nuevo.
/// </summary>
public sealed class AdministrativeScopeFilter
{
    public int      Id                    { get; init; }
    public int      AdministrativeScopeId { get; init; }

    /// <summary>Etiqueta amigable para la UI (Domain/Company/ExtensionAttribute/Other).
    /// Solo UX — no condiciona la lógica de evaluación.</summary>
    public required string FilterType     { get; init; }

    public required string AttributeName  { get; init; }
    public ScopeFilterOperator Operator   { get; init; }

    /// <summary>Ignorado cuando Operator = Exists.</summary>
    public string?  Value                 { get; init; }

    public bool     IsActive              { get; init; }
    public DateTime CreatedAt             { get; init; }
    public DateTime UpdatedAt             { get; init; }
    public string?  UpdatedBy             { get; init; }

    // Navigation — populada por consultas del repositorio vía JOIN, mismo patrón que SystemRoleGroup.RoleKey.
    public string   ScopeKey              { get; init; } = string.Empty;
}
