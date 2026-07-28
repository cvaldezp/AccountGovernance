using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Enums;

namespace AccountGovernance.Application.Authorization;

public enum ShadowAuthorizationOutcome { Permitted, Denied }

/// <summary>Detalle de la evaluación de un rol efectivo — se conserva siempre,
/// aunque otro rol ya haya autorizado, para poder auditar por qué cada rol
/// individual habría fallado (Incremento C, sección 5 de la arquitectura).</summary>
public sealed record ShadowRoleEvaluation(
    string RoleKey,
    bool FieldAllowed,
    bool ScopeAllowed,
    IReadOnlyList<string> MissingAttributes,
    string Reason);

public sealed record ShadowAuthorizationDecision(
    ShadowAuthorizationOutcome Outcome,
    string? AuthorizedByRole,
    IReadOnlyList<ShadowRoleEvaluation> PerRole);

public interface IShadowFieldScopeEvaluator
{
    /// <summary>
    /// Evalúa, para cada rol efectivo, la pareja campo+ámbito (sin dimensión de
    /// operación — decisión de semántica #1 del Incremento C, documentada como
    /// simplificación temporal) contra un usuario ya cargado. El resultado es de
    /// solo lectura/auditoría — el llamador es responsable de no dejar que
    /// ninguna excepción de acá se propague ni de usar el resultado para permitir
    /// o denegar nada real.
    /// </summary>
    Task<ShadowAuthorizationDecision> EvaluateAsync(
        IReadOnlyList<string> effectiveRoles,
        string fieldKey,
        IReadOnlyDictionary<string, string?> targetAttributes,
        CancellationToken ct = default);
}

public sealed class ShadowFieldScopeEvaluator(
    IPermissionRepository            permissionRepository,
    IRoleScopeAssignmentRepository   roleScopeAssignmentRepository,
    IAdministrativeScopeRepository   administrativeScopeRepository
) : IShadowFieldScopeEvaluator
{
    private const string SystemAdminRoleKey = "SystemAdmin";

    public async Task<ShadowAuthorizationDecision> EvaluateAsync(
        IReadOnlyList<string> effectiveRoles,
        string fieldKey,
        IReadOnlyDictionary<string, string?> targetAttributes,
        CancellationToken ct = default)
    {
        var perRole = new List<ShadowRoleEvaluation>();
        string? authorizedBy = null;

        foreach (var roleKey in effectiveRoles)
        {
            // Mismo bypass ya establecido en Incremento A/arquitectura sección 6 —
            // SystemAdmin siempre pasa, sin consultar RoleFieldPermissions ni
            // RoleScopeAssignments para este rol.
            if (string.Equals(roleKey, SystemAdminRoleKey, StringComparison.OrdinalIgnoreCase))
            {
                perRole.Add(new ShadowRoleEvaluation(roleKey, true, true, [], "SYSTEM_ADMIN_BYPASS"));
                authorizedBy ??= roleKey;
                continue;
            }

            if (!Enum.TryParse<RoleName>(roleKey, ignoreCase: true, out var roleName))
            {
                // Deuda RoleName (ADR, Restricciones) — este rol no tiene
                // representación en la matriz de permisos. Fail-closed y
                // diagnosticable: se registra el motivo, nunca se asume acceso.
                perRole.Add(new ShadowRoleEvaluation(roleKey, false, false, [], "ROLE_UNMAPPED_INCONSISTENT"));
                continue;
            }

            var fieldPermissions = await permissionRepository.GetRolePermissionsAsync(roleName, ct);
            var fieldAllowed = fieldPermissions.Any(p => p.FieldKey == fieldKey && p.IsActive && p.CanEdit);

            if (!fieldAllowed)
            {
                perRole.Add(new ShadowRoleEvaluation(roleKey, false, false, [], "FIELD_NOT_PERMITTED"));
                continue;
            }

            var (scopeAllowed, missing, scopeReason) = await EvaluateScopeForRoleAsync(roleKey, targetAttributes, ct);
            perRole.Add(new ShadowRoleEvaluation(roleKey, true, scopeAllowed, missing, scopeReason));

            if (scopeAllowed)
                authorizedBy ??= roleKey;
        }

        var outcome = authorizedBy is not null
            ? ShadowAuthorizationOutcome.Permitted
            : ShadowAuthorizationOutcome.Denied;

        return new ShadowAuthorizationDecision(outcome, authorizedBy, perRole);
    }

    private async Task<(bool ScopeAllowed, IReadOnlyList<string> Missing, string Reason)> EvaluateScopeForRoleAsync(
        string roleKey, IReadOnlyDictionary<string, string?> attributes, CancellationToken ct)
    {
        var assignments = await roleScopeAssignmentRepository.GetAllAsync(roleKey, null, ct);
        var activeAssignments = assignments.Where(a => a.IsActive).ToList();

        if (activeAssignments.Count == 0)
            return (false, [], "NO_ACTIVE_SCOPE_ASSIGNED");

        var missingAcrossScopes = new List<string>();

        foreach (var assignment in activeAssignments)
        {
            var scope = await administrativeScopeRepository.GetByKeyAsync(assignment.ScopeKey, ct);
            if (scope is null || !scope.IsActive)
                continue;

            var filters = await administrativeScopeRepository.GetFiltersByScopeKeyAsync(assignment.ScopeKey, ct);
            var result = AdministrativeScopeFilterEvaluator.Evaluate(filters, attributes);

            if (result.Outcome == ScopeFilterMatchOutcome.Match)
                return (true, [], "ROLE_MATCH");

            if (result.Outcome == ScopeFilterMatchOutcome.Unavailable)
                missingAcrossScopes.AddRange(result.MissingAttributeNames);
        }

        return missingAcrossScopes.Count > 0
            ? (false, missingAcrossScopes.Distinct().ToList(), "SCOPE_ATTRIBUTE_UNAVAILABLE")
            : (false, [], "OUT_OF_SCOPE");
    }
}
