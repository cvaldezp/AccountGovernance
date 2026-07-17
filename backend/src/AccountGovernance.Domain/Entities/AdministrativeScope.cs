namespace AccountGovernance.Domain.Entities;

/// <summary>
/// Ámbito Administrativo: una población reutilizable de usuarios AD (ej.
/// "Empleados USFQ"), definida por un límite estructural de búsqueda
/// (<see cref="BaseDn"/>) más una lista abierta de filtros simples
/// (<see cref="AdministrativeScopeFilter"/>). No es solo "Dominio + OU" — es
/// la unidad reutilizable sobre la que se apoya RoleScopeAssignment /
/// RoleScopeFieldPermission en incrementos posteriores.
/// </summary>
public sealed class AdministrativeScope
{
    public int      Id                { get; init; }
    public required string ScopeKey   { get; init; }
    public required string Name       { get; init; }
    public string?  Description       { get; init; }

    /// <summary>Clasificación puramente organizativa para la UI (ej. "Institucional",
    /// "Externo"). Nunca participa en la evaluación de autorización.</summary>
    public string?  Category          { get; init; }

    /// <summary>Nodo raíz de búsqueda LDAP — el límite estructural real, no un
    /// filtro de negocio. Acota el rendimiento de cualquier búsqueda (nunca se
    /// recorre el árbol completo de AD).</summary>
    public required string BaseDn     { get; init; }

    /// <summary>Reservado para múltiples conexiones LDAP (forests separados).
    /// Sin uso funcional hasta que se confirme la necesidad real.</summary>
    public string   ConnectionProfile { get; init; } = "default";

    public bool     IsActive          { get; init; }

    /// <summary>Desempate de visualización cuando OUs se anidan/solapan — no
    /// afecta la autorización (que es unión, no "el que gana").</summary>
    public int      Priority          { get; init; }

    public string?  CreatedBy         { get; init; }
    public string?  UpdatedBy         { get; init; }
    public DateTime CreatedAt         { get; init; }
    public DateTime UpdatedAt         { get; init; }
}
