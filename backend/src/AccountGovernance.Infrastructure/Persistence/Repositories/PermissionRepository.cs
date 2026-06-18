using Dapper;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Entities;
using AccountGovernance.Domain.Enums;

namespace AccountGovernance.Infrastructure.Persistence.Repositories;

public sealed class PermissionRepository(IDbConnectionFactory db) : IPermissionRepository
{
    public async Task<IReadOnlyList<FieldDefinition>> GetFieldDefinitionsAsync(CancellationToken ct = default)
    {
        using var conn = db.Create();

        const string sql = """
            SELECT FieldKey, AdAttributeName, DisplayName, Description,
                   FieldType, IsSensitive, IsActive, SortOrder, AllowedValues, Placeholder
            FROM   gov.FieldDefinitions
            WHERE  IsActive = 1
            ORDER BY SortOrder
            """;

        var rows = await conn.QueryAsync<FieldDefinitionRow>(sql);

        return rows.Select(r => new FieldDefinition
        {
            FieldKey        = r.FieldKey,
            AdAttributeName = r.AdAttributeName,
            DisplayName     = r.DisplayName,
            Description     = r.Description ?? string.Empty,
            FieldType       = Enum.Parse<FieldType>(r.FieldType),
            IsSensitive     = r.IsSensitive,
            IsActive        = r.IsActive,
            SortOrder       = r.SortOrder,
            AllowedValues   = r.AllowedValues?.Split(',').Select(v => v.Trim()).ToList(),
            Placeholder     = r.Placeholder,
        }).ToList();
    }

    public async Task<IReadOnlyList<RoleFieldPermission>> GetRolePermissionsAsync(
        RoleName? role = null, CancellationToken ct = default)
    {
        using var conn = db.Create();

        const string sql = """
            SELECT RoleName, FieldKey, CanView, CanEdit, IsActive
            FROM   gov.RoleFieldPermissions
            WHERE  IsActive = 1
              AND  (@RoleName IS NULL OR RoleName = @RoleName)
            """;

        var rows = await conn.QueryAsync<PermissionRow>(sql, new { RoleName = role?.ToString() });

        return rows.Select(r => new RoleFieldPermission
        {
            RoleName = Enum.Parse<RoleName>(r.RoleName),
            FieldKey = r.FieldKey,
            CanView  = r.CanView,
            CanEdit  = r.CanEdit,
            IsActive = r.IsActive,
        }).ToList();
    }

    private sealed record FieldDefinitionRow(
        string  FieldKey,
        string  AdAttributeName,
        string  DisplayName,
        string? Description,
        string  FieldType,
        bool    IsSensitive,
        bool    IsActive,
        int     SortOrder,
        string? AllowedValues,
        string? Placeholder);

    private sealed record PermissionRow(
        string RoleName,
        string FieldKey,
        bool   CanView,
        bool   CanEdit,
        bool   IsActive);
}
