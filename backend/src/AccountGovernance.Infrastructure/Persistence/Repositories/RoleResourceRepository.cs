using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Entities;
using Dapper;

namespace AccountGovernance.Infrastructure.Persistence.Repositories;

public sealed class RoleResourceRepository(IDbConnectionFactory db) : IRoleResourceRepository
{
    public async Task<IReadOnlyList<AppResource>> GetResourcesAsync(CancellationToken ct = default)
    {
        const string sql = """
            SELECT ResourceKey, ParentKey, ResourceType, DisplayName, Description,
                   SortOrder, SystemAdminOnly, IsActive
            FROM   gov.AppResources
            ORDER  BY SortOrder, ResourceKey
            """;

        using var conn = db.Create();
        var rows = await conn.QueryAsync<AppResource>(sql);
        return rows.AsList();
    }

    public async Task<IReadOnlyList<RoleResourcePermission>> GetActivePermissionsAsync(CancellationToken ct = default)
    {
        // Solo roles activos: desactivar un rol en "Roles y Grupos" vuelve inertes
        // sus permisos sin modificar estas filas (mismo criterio que RoleScopeAssignments).
        const string sql = """
            SELECT p.Id, p.SystemRoleId, p.ResourceKey, p.IsActive,
                   p.CreatedAt, p.CreatedBy, p.UpdatedAt, p.UpdatedBy,
                   r.RoleKey
            FROM   gov.RoleResourcePermissions p
            JOIN   gov.SystemRoles r ON r.Id = p.SystemRoleId
            WHERE  p.IsActive = 1
              AND  r.IsActive = 1
            """;

        using var conn = db.Create();
        var rows = await conn.QueryAsync<RoleResourcePermission>(sql);
        return rows.AsList();
    }
}
