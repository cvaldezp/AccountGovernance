using AccountGovernance.Application.Common;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Entities;
using Dapper;
using Microsoft.Data.SqlClient;

namespace AccountGovernance.Infrastructure.Persistence.Repositories;

public sealed class RoleScopeAssignmentRepository(IDbConnectionFactory db) : IRoleScopeAssignmentRepository
{
    // Números de error estándar de SQL Server para violación de índice/constraint
    // único — dispara UQ_Gov_RoleScopeAssignments_Pair (ver schema.sql).
    private const int SqlUniqueViolation_Index      = 2601;
    private const int SqlUniqueViolation_Constraint = 2627;

    private const string Select = """
        SELECT a.Id, a.SystemRoleId, a.AdministrativeScopeId, a.IsActive,
               a.CreatedAt, a.CreatedBy, a.UpdatedAt, a.UpdatedBy,
               r.RoleKey, s.ScopeKey
        FROM   gov.RoleScopeAssignments a
        JOIN   gov.SystemRoles r           ON r.Id = a.SystemRoleId
        JOIN   gov.AdministrativeScopes s  ON s.Id = a.AdministrativeScopeId
        """;

    public async Task<IReadOnlyList<RoleScopeAssignment>> GetAllAsync(
        string? roleKey, string? scopeKey, CancellationToken ct = default)
    {
        var sql = Select + " WHERE 1 = 1";
        if (!string.IsNullOrWhiteSpace(roleKey))  sql += " AND r.RoleKey = @RoleKey";
        if (!string.IsNullOrWhiteSpace(scopeKey)) sql += " AND s.ScopeKey = @ScopeKey";
        sql += " ORDER BY r.RoleKey, s.ScopeKey";

        using var conn = db.Create();
        var rows = await conn.QueryAsync<RoleScopeAssignment>(sql, new { RoleKey = roleKey, ScopeKey = scopeKey });
        return rows.AsList();
    }

    public async Task<RoleScopeAssignment?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        using var conn = db.Create();
        return await conn.QuerySingleOrDefaultAsync<RoleScopeAssignment>(
            Select + " WHERE a.Id = @Id", new { Id = id });
    }

    public async Task<RoleScopeAssignment?> GetByRoleAndScopeAsync(
        int systemRoleId, int administrativeScopeId, CancellationToken ct = default)
    {
        using var conn = db.Create();
        return await conn.QuerySingleOrDefaultAsync<RoleScopeAssignment>(
            Select + " WHERE a.SystemRoleId = @SystemRoleId AND a.AdministrativeScopeId = @AdministrativeScopeId",
            new { SystemRoleId = systemRoleId, AdministrativeScopeId = administrativeScopeId });
    }

    public async Task<int> CreateAsync(RoleScopeAssignment assignment, CancellationToken ct = default)
    {
        const string sql = """
            INSERT INTO gov.RoleScopeAssignments
                (SystemRoleId, AdministrativeScopeId, IsActive, CreatedAt, CreatedBy, UpdatedAt, UpdatedBy)
            VALUES
                (@SystemRoleId, @AdministrativeScopeId, @IsActive, @CreatedAt, @CreatedBy, @UpdatedAt, @UpdatedBy);
            SELECT CAST(SCOPE_IDENTITY() AS INT);
            """;

        using var conn = db.Create();
        try
        {
            return await conn.ExecuteScalarAsync<int>(sql, new
            {
                assignment.SystemRoleId,
                assignment.AdministrativeScopeId,
                assignment.IsActive,
                assignment.CreatedAt,
                assignment.CreatedBy,
                assignment.UpdatedAt,
                assignment.UpdatedBy,
            });
        }
        catch (SqlException ex) when (IsUniqueViolation(ex))
        {
            // Defensa en profundidad ante condición de carrera — ver
            // DuplicateAssignmentException y UQ_Gov_RoleScopeAssignments_Pair en
            // schema.sql. El chequeo normal (GetByRoleAndScopeAsync) ya lo hizo
            // RoleScopeAssignmentService antes de llegar acá.
            throw new DuplicateAssignmentException();
        }
    }

    public async Task SetStatusAsync(int id, bool isActive, string updatedBy, CancellationToken ct = default)
    {
        const string sql = """
            UPDATE gov.RoleScopeAssignments
            SET    IsActive  = @IsActive,
                   UpdatedBy = @UpdatedBy,
                   UpdatedAt = @UpdatedAt
            WHERE  Id = @Id
            """;

        using var conn = db.Create();
        var rowsAffected = await conn.ExecuteAsync(sql, new
        {
            Id        = id,
            IsActive  = isActive,
            UpdatedBy = updatedBy,
            UpdatedAt = DateTime.UtcNow,
        });

        // Id es la PK — un UPDATE por Id debe afectar exactamente una fila. El
        // servicio ya confirmó que la fila existe (GetByIdAsync) antes de llamar
        // acá, así que 0 filas solo podría ocurrir por un borrado concurrente
        // fuera de este flujo (esta tabla no expone DELETE); más de una fila
        // sería un error de integridad de la propia PK. En ambos casos es un
        // estado que nunca debería ocurrir — no es un fallo de validación de
        // negocio (no tiene código de error de Result<T>), es una falla
        // inesperada que debe propagarse como tal (500).
        if (rowsAffected != 1)
            throw new InvalidOperationException(
                $"UPDATE sobre gov.RoleScopeAssignments (Id={id}) afectó {rowsAffected} fila(s) — se esperaba exactamente 1.");
    }

    private static bool IsUniqueViolation(SqlException ex) =>
        ex.Errors.Cast<SqlError>().Any(e =>
            e.Number == SqlUniqueViolation_Index || e.Number == SqlUniqueViolation_Constraint);
}
