using AccountGovernance.Domain.Enums;

namespace AccountGovernance.Application.Interfaces;

/// <summary>
/// Incremento D del Motor de Autorización (docs/authorization-engine-increment-d-plan.md,
/// Decisión 1) — interruptor por rol para el bloqueo real de ámbito sobre
/// UpdateAttribute. Fuente de verdad: configuración
/// (Authorization:EnforceScopeOnUpdateAttributeRoles), no gov.SystemRoles.
/// </summary>
public interface IScopeEnforcementPolicy
{
    /// <summary>
    /// True cuando <paramref name="role"/> está en la lista de roles con
    /// enforcement activo — el resultado de la evaluación de ámbito para ese
    /// rol pasa de solo auditar a poder bloquear la operación real.
    /// </summary>
    bool IsEnforced(RoleName role);
}
