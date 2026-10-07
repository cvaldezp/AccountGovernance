using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Entities;
using Dapper;

namespace AccountGovernance.Infrastructure.Persistence.Repositories;

public sealed class RoleResourceRepository(IDbConnectionFactory db) : IRoleResourceRepository
{
    private const string SelectPermission = """
        SELECT p.Id, p.SystemRoleId, p.ResourceKey, p.IsActive,
               p.CreatedAt, p.CreatedBy, p.UpdatedAt, p.UpdatedBy,
               r.RoleKey
        FROM   gov.RoleResourcePermissions p
        JOIN   gov.SystemRoles r ON r.Id = p.SystemRoleId
        """;

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
        using var conn = db.Create();
        var rows = await conn.QueryAsync<RoleResourcePermission>(
            SelectPermission + " WHERE p.IsActive = 1 AND r.IsActive = 1");
        return rows.AsList();
    }

    public async Task<RoleResourcePermission?> GetPermissionAsync(
        int systemRoleId, string resourceKey, CancellationToken ct = default)
    {
        using var conn = db.Create();
        return await conn.QuerySingleOrDefaultAsync<RoleResourcePermission>(
            SelectPermission + " WHERE p.SystemRoleId = @SystemRoleId AND p.ResourceKey = @ResourceKey",
            new { SystemRoleId = systemRoleId, ResourceKey = resourceKey });
    }

    public async Task CreatePermissionAsync(
        int systemRoleId, string resourceKey, string createdBy, CancellationToken ct = default)
    {
        const string sql = """
            INSERT INTO gov.RoleResourcePermissions
                (SystemRoleId, ResourceKey, IsActive, CreatedBy, UpdatedBy)
            VALUES
                (@SystemRoleId, @ResourceKey, 1, @CreatedBy, @CreatedBy)
            """;

        using var conn = db.Create();
        await conn.ExecuteAsync(sql, new { SystemRoleId = systemRoleId, ResourceKey = resourceKey, CreatedBy = createdBy });
    }

    public async Task SetPermissionStatusAsync(
        int id, bool isActive, string updatedBy, CancellationToken ct = default)
    {
        const string sql = """
            UPDATE gov.RoleResourcePermissions
            SET    IsActive  = @IsActive,
                   UpdatedBy = @UpdatedBy,
                   UpdatedAt = GETUTCDATE()
            WHERE  Id = @Id
            """;

        using var conn = db.Create();
        var rowsAffected = await conn.ExecuteAsync(sql, new { Id = id, IsActive = isActive, UpdatedBy = updatedBy });

        // Id es la PK y el servicio ya confirmó que la fila existe — mismo criterio
        // que RoleScopeAssignmentRepository.SetStatusAsync: cualquier otro resultado
        // es una falla inesperada (500), no una validación de negocio.
        if (rowsAffected != 1)
            throw new InvalidOperationException(
                $"UPDATE sobre gov.RoleResourcePermissions (Id={id}) afectó {rowsAffected} fila(s) — se esperaba exactamente 1.");
    }
}
