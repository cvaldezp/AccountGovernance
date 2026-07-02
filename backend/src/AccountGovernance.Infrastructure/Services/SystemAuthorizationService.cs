using AccountGovernance.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AccountGovernance.Infrastructure.Services;

public sealed class SystemAuthorizationService(
    IAdGateway                          adGateway,
    IConfiguration                      configuration,
    ILogger<SystemAuthorizationService> logger
) : ISystemAuthorizationService
{
    public async Task<IReadOnlyList<string>> GetUserRolesAsync(
        string? upn, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(upn))
            return [];

        var mappings = configuration
            .GetSection("Authorization:RoleMappings")
            .Get<Dictionary<string, string>>() ?? [];

        if (mappings.Count == 0)
        {
            logger.LogWarning(
                "Authorization:RoleMappings is empty — {Upn} will have no system roles.", upn);
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

        var userGroups = new HashSet<string>(memberOfDns, StringComparer.OrdinalIgnoreCase);
        var roles      = new List<string>(mappings.Count);

        foreach (var (roleName, groupDn) in mappings)
        {
            if (userGroups.Contains(groupDn))
                roles.Add(roleName);
        }

        logger.LogInformation(
            "System roles resolved for {Upn}: [{Roles}]",
            upn, string.Join(", ", roles));

        return roles;
    }
}
