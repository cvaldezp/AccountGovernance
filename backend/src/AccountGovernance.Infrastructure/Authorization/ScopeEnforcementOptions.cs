namespace AccountGovernance.Infrastructure.Authorization;

public sealed class ScopeEnforcementOptions
{
    public const string Section = "Authorization";

    /// <summary>
    /// Nombres de RoleName (case-insensitive) para los que UpdateAttribute
    /// bloquea de verdad según la evaluación de ámbito, en vez de solo
    /// auditarla. Vacío por defecto — ver docs/authorization-engine-increment-d-plan.md.
    /// </summary>
    public IReadOnlyList<string> EnforceScopeOnUpdateAttributeRoles { get; init; } = [];
}
