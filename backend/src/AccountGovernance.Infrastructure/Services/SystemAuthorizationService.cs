using AccountGovernance.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace AccountGovernance.Infrastructure.Services;

public sealed class SystemAuthorizationService(
    IAdGateway                          adGateway,
    ISystemRoleRepository               roleRepository,
    ILogger<SystemAuthorizationService> logger
) : ISystemAuthorizationService
{
    public async Task<IReadOnlyList<string>> GetUserRolesAsync(
        string? upn, CancellationToken ct = default)
    {
        // TEMP LOG — remove once role resolution is validated end-to-end.
        logger.LogInformation("[ROLES] upn autenticado: {Upn}", upn);

        if (string.IsNullOrWhiteSpace(upn))
            return [];

        var activeRoles = await roleRepository.GetActiveRolesForAuthorizationAsync(ct);

        if (activeRoles.Count == 0)
        {
            logger.LogWarning(
                "gov.SystemRoles has no active roles — {Upn} will have no system roles.", upn);
            return [];
        }

        IReadOnlyList<string> memberOfDns;
        try
        {
            memberOfDns = await adGateway.GetUserGroupDnsAsync(upn, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to query AD group membership for UPN: {Upn}", upn);
            return [];
        }

        // TEMP LOG — remove once role resolution is validated end-to-end.
        logger.LogInformation(
            "[ROLES] cantidad de grupos AD encontrados para {Upn}: {Count}", upn, memberOfDns.Count);
        foreach (var dn in memberOfDns)
            logger.LogDebug("[ROLES] memberOf: {Dn}", dn);

        var userGroups = new HashSet<string>(memberOfDns, StringComparer.OrdinalIgnoreCase);
        var roles      = new List<string>(activeRoles.Count);

        foreach (var role in activeRoles)
        {
            if (role.ActiveGroupDns.Count == 0)
            {
                // TEMP LOG — remove once role resolution is validated end-to-end.
                logger.LogInformation(
                    "[ROLES] rol {Role} no tiene ningún grupo AD activo configurado — se omite.",
                    role.RoleKey);
                continue;
            }

            if (role.ActiveGroupDns.Any(dn => userGroups.Contains(dn)))
                roles.Add(role.RoleKey);
            else
                // TEMP LOG — remove once role resolution is validated end-to-end.
                logger.LogInformation(
                    "[ROLES] ningún grupo mapeado a {Role} encontrado en memberOf de {Upn} — DNs esperados: [{GroupDns}]",
                    role.RoleKey, upn, string.Join(", ", role.ActiveGroupDns));
        }

        logger.LogInformation(
            "[ROLES] roles resueltos para {Upn}: [{Roles}]",
            upn, string.Join(", ", roles));

        return roles;
    }

    public async Task<string?> ResolvePrimaryRoleAsync(
        IReadOnlyList<string> roles, CancellationToken ct = default)
    {
        if (roles.Count == 0)
            return null;

        // Already ordered by Priority ascending (lower = resolved first).
        var activeRoles = await roleRepository.GetActiveRolesForAuthorizationAsync(ct);

        foreach (var candidate in activeRoles)
        {
            if (roles.Contains(candidate.RoleKey, StringComparer.OrdinalIgnoreCase))
                return candidate.RoleKey;
        }

        // roles is non-empty (checked above) but none of its entries appear among the
        // currently active gov.SystemRoles — the role became inactive/deleted between
        // GetUserRolesAsync and this call, or the two queries otherwise drifted apart.
        // Fail fast instead of guessing a role by arrival order.
        throw new InvalidOperationException(
            $"None of the resolved roles [{string.Join(", ", roles)}] are currently active " +
            $"in gov.SystemRoles [{string.Join(", ", activeRoles.Select(r => r.RoleKey))}].");
    }
}
