using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Enums;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AccountGovernance.Infrastructure.Authorization;

/// <summary>
/// Incremento D del Motor de Autorización — normaliza
/// Authorization:EnforceScopeOnUpdateAttributeRoles una sola vez al construirse
/// (docs/authorization-engine-increment-d-plan.md, Decisión 1): recorta
/// espacios, ignora entradas vacías, elimina duplicados, compara sin distinguir
/// mayúsculas/minúsculas. Un nombre que no coincide con ningún RoleName no
/// rompe el arranque — solo se registra como warning, para que un error de
/// tipeo no habilite nada silenciosamente ni pase desapercibido.
/// </summary>
public sealed class ScopeEnforcementPolicy : IScopeEnforcementPolicy
{
    private readonly HashSet<string> _enforcedRoles;

    public ScopeEnforcementPolicy(
        IOptions<ScopeEnforcementOptions> options, ILogger<ScopeEnforcementPolicy> logger)
    {
        var normalized = (options.Value.EnforceScopeOnUpdateAttributeRoles ?? [])
            .Select(role => role?.Trim())
            .Where(role => !string.IsNullOrEmpty(role))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var knownRoleNames = Enum.GetNames<RoleName>();
        foreach (var role in normalized)
        {
            if (!knownRoleNames.Contains(role, StringComparer.OrdinalIgnoreCase))
            {
                logger.LogWarning(
                    "Configured scope-enforcement role '{Role}' does not match a known role.", role);
            }
        }

        _enforcedRoles = new HashSet<string>(normalized!, StringComparer.OrdinalIgnoreCase);
    }

    public bool IsEnforced(RoleName role) => _enforcedRoles.Contains(role.ToString());
}
