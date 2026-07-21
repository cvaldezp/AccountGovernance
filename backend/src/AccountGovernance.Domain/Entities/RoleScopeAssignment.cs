namespace AccountGovernance.Domain.Entities;

/// <summary>
/// Asigna un AdministrativeScope a un SystemRole — Incremento 3. Sin
/// enforcement todavía: esta fila no restringe ninguna operación real hasta
/// que exista el scope-check sobre operaciones de usuario (incremento
/// posterior). Una asignación será efectiva únicamente cuando estén activos
/// simultáneamente: IsActive (esta fila), SystemRole.IsActive y
/// AdministrativeScope.IsActive — desactivar el rol o el ámbito no modifica
/// esta fila en cascada, solo la vuelve inerte mientras el padre esté inactivo.
/// Relación única: solo puede existir una fila por (SystemRoleId,
/// AdministrativeScopeId) en toda su vida — reactivar es un UPDATE sobre esta
/// misma fila (PATCH .../status), nunca un INSERT nuevo.
/// </summary>
public sealed class RoleScopeAssignment
{
    public int      Id                    { get; init; }
    public int      SystemRoleId          { get; init; }
    public int      AdministrativeScopeId { get; init; }
    public bool     IsActive              { get; init; }
    public DateTime CreatedAt             { get; init; }
    public string?  CreatedBy             { get; init; }
    public DateTime UpdatedAt             { get; init; }
    public string?  UpdatedBy             { get; init; }

    // Navigation — populada por JOIN en el repositorio, mismo patrón que
    // SystemRoleGroup.RoleKey / AdministrativeScopeFilter.ScopeKey.
    public string   RoleKey               { get; init; } = string.Empty;
    public string   ScopeKey              { get; init; } = string.Empty;
}
