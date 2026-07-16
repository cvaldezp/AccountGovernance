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

    // ── Attribute admin (CRUD) ──────────────────────────────────────────────

    public async Task<IReadOnlyList<FieldDefinition>> GetAllAttributesAsync(CancellationToken ct = default)
    {
        using var conn = db.Create();

        const string sql = """
            SELECT FieldKey, AdAttributeName, DisplayName, Description,
                   FieldType, Category, DataType, IsSensitive, RequiresAudit,
                   IsActive, SortOrder, AllowedValues, Placeholder,
                   CreatedBy, UpdatedBy, CreatedAt, UpdatedAt
            FROM   gov.FieldDefinitions
            ORDER BY SortOrder
            """;

        var rows = await conn.QueryAsync<AttributeRow>(sql);
        return rows.Select(ToEntity).ToList();
    }

    public async Task<FieldDefinition?> GetAttributeByKeyAsync(string fieldKey, CancellationToken ct = default)
    {
        using var conn = db.Create();

        const string sql = """
            SELECT FieldKey, AdAttributeName, DisplayName, Description,
                   FieldType, Category, DataType, IsSensitive, RequiresAudit,
                   IsActive, SortOrder, AllowedValues, Placeholder,
                   CreatedBy, UpdatedBy, CreatedAt, UpdatedAt
            FROM   gov.FieldDefinitions
            WHERE  FieldKey = @FieldKey
            """;

        var row = await conn.QuerySingleOrDefaultAsync<AttributeRow>(sql, new { FieldKey = fieldKey });
        return row is null ? null : ToEntity(row);
    }

    public async Task<bool> ExistsByAdAttributeNameAsync(
        string adAttributeName, string? excludeFieldKey = null, CancellationToken ct = default)
    {
        using var conn = db.Create();

        const string sql = """
            SELECT COUNT(1)
            FROM   gov.FieldDefinitions
            WHERE  AdAttributeName = @AdAttributeName
              AND  (@ExcludeFieldKey IS NULL OR FieldKey <> @ExcludeFieldKey)
            """;

        var count = await conn.ExecuteScalarAsync<int>(sql, new { AdAttributeName = adAttributeName, ExcludeFieldKey = excludeFieldKey });
        return count > 0;
    }

    public async Task CreateAttributeAsync(FieldDefinition attribute, CancellationToken ct = default)
    {
        using var conn = db.Create();

        const string sql = """
            INSERT INTO gov.FieldDefinitions
                (FieldKey, AdAttributeName, DisplayName, Description, FieldType,
                 Category, DataType, IsSensitive, RequiresAudit, IsActive, SortOrder,
                 AllowedValues, Placeholder, CreatedBy, UpdatedBy, CreatedAt, UpdatedAt)
            VALUES
                (@FieldKey, @AdAttributeName, @DisplayName, @Description, @FieldType,
                 @Category, @DataType, @IsSensitive, @RequiresAudit, @IsActive, @SortOrder,
                 @AllowedValues, @Placeholder, @CreatedBy, @UpdatedBy, @CreatedAt, @UpdatedAt)
            """;

        await conn.ExecuteAsync(sql, new
        {
            attribute.FieldKey,
            attribute.AdAttributeName,
            attribute.DisplayName,
            attribute.Description,
            FieldType     = attribute.FieldType.ToString(),
            attribute.Category,
            attribute.DataType,
            attribute.IsSensitive,
            attribute.RequiresAudit,
            attribute.IsActive,
            attribute.SortOrder,
            AllowedValues = attribute.AllowedValues is null ? null : string.Join(',', attribute.AllowedValues),
            attribute.Placeholder,
            attribute.CreatedBy,
            attribute.UpdatedBy,
            attribute.CreatedAt,
            attribute.UpdatedAt,
        });
    }

    public async Task UpdateAttributeAsync(FieldDefinition attribute, CancellationToken ct = default)
    {
        using var conn = db.Create();

        const string sql = """
            UPDATE gov.FieldDefinitions
            SET    AdAttributeName = @AdAttributeName,
                   DisplayName     = @DisplayName,
                   Description     = @Description,
                   FieldType       = @FieldType,
                   Category        = @Category,
                   DataType        = @DataType,
                   IsSensitive     = @IsSensitive,
                   RequiresAudit   = @RequiresAudit,
                   SortOrder       = @SortOrder,
                   AllowedValues   = @AllowedValues,
                   Placeholder     = @Placeholder,
                   UpdatedBy       = @UpdatedBy,
                   UpdatedAt       = @UpdatedAt
            WHERE  FieldKey = @FieldKey
            """;

        await conn.ExecuteAsync(sql, new
        {
            attribute.FieldKey,
            attribute.AdAttributeName,
            attribute.DisplayName,
            attribute.Description,
            FieldType     = attribute.FieldType.ToString(),
            attribute.Category,
            attribute.DataType,
            attribute.IsSensitive,
            attribute.RequiresAudit,
            attribute.SortOrder,
            AllowedValues = attribute.AllowedValues is null ? null : string.Join(',', attribute.AllowedValues),
            attribute.Placeholder,
            attribute.UpdatedBy,
            attribute.UpdatedAt,
        });
    }

    public async Task SetAttributeStatusAsync(string fieldKey, bool isActive, string updatedBy, CancellationToken ct = default)
    {
        using var conn = db.Create();

        const string sql = """
            UPDATE gov.FieldDefinitions
            SET    IsActive  = @IsActive,
                   UpdatedBy = @UpdatedBy,
                   UpdatedAt = @UpdatedAt
            WHERE  FieldKey = @FieldKey
            """;

        await conn.ExecuteAsync(sql, new
        {
            FieldKey  = fieldKey,
            IsActive  = isActive,
            UpdatedBy = updatedBy,
            UpdatedAt = DateTime.UtcNow,
        });
    }

    public async Task<bool> HasActiveDependenciesAsync(string fieldKey, CancellationToken ct = default)
    {
        using var conn = db.Create();

        const string sql = """
            SELECT COUNT(1)
            FROM   gov.RoleFieldPermissions
            WHERE  FieldKey = @FieldKey
              AND  IsActive = 1
              AND  (CanView = 1 OR CanEdit = 1)
            """;

        var count = await conn.ExecuteScalarAsync<int>(sql, new { FieldKey = fieldKey });
        return count > 0;
    }

    // ── Permissions matrix — editable cells ─────────────────────────────────

    public async Task UpsertRolePermissionAsync(
        RoleName roleName, string fieldKey, bool canView, bool canEdit,
        string updatedBy, CancellationToken ct = default)
    {
        using var conn = db.Create();

        // No hay ON CONFLICT en T-SQL clásico: UPDATE primero, INSERT solo si no
        // afectó ninguna fila. Un solo round-trip (un batch, sin GO) porque Dapper
        // envía todo el texto como un único comando.
        const string sql = """
            UPDATE gov.RoleFieldPermissions
            SET    CanView   = @CanView,
                   CanEdit   = @CanEdit,
                   IsActive  = 1,
                   UpdatedAt = @UpdatedAt,
                   UpdatedBy = @UpdatedBy
            WHERE  RoleName = @RoleName AND FieldKey = @FieldKey;

            IF @@ROWCOUNT = 0
                INSERT INTO gov.RoleFieldPermissions
                    (RoleName, FieldKey, CanView, CanEdit, IsActive, UpdatedAt, UpdatedBy)
                VALUES
                    (@RoleName, @FieldKey, @CanView, @CanEdit, 1, @UpdatedAt, @UpdatedBy);
            """;

        await conn.ExecuteAsync(sql, new
        {
            RoleName  = roleName.ToString(),
            FieldKey  = fieldKey,
            CanView   = canView,
            CanEdit   = canEdit,
            UpdatedAt = DateTime.UtcNow,
            UpdatedBy = updatedBy,
        });
    }

    private static FieldDefinition ToEntity(AttributeRow r) => new()
    {
        FieldKey        = r.FieldKey,
        AdAttributeName = r.AdAttributeName,
        DisplayName     = r.DisplayName,
        Description     = r.Description ?? string.Empty,
        FieldType       = Enum.Parse<FieldType>(r.FieldType),
        Category        = r.Category,
        DataType        = r.DataType,
        IsSensitive     = r.IsSensitive,
        RequiresAudit   = r.RequiresAudit,
        IsActive        = r.IsActive,
        SortOrder       = r.SortOrder,
        AllowedValues   = r.AllowedValues?.Split(',').Select(v => v.Trim()).ToList(),
        Placeholder     = r.Placeholder,
        CreatedBy       = r.CreatedBy,
        UpdatedBy       = r.UpdatedBy,
        CreatedAt       = r.CreatedAt,
        UpdatedAt       = r.UpdatedAt,
    };

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

    private sealed record AttributeRow(
        string   FieldKey,
        string   AdAttributeName,
        string   DisplayName,
        string?  Description,
        string   FieldType,
        string?  Category,
        string?  DataType,
        bool     IsSensitive,
        bool     RequiresAudit,
        bool     IsActive,
        int      SortOrder,
        string?  AllowedValues,
        string?  Placeholder,
        string?  CreatedBy,
        string?  UpdatedBy,
        DateTime CreatedAt,
        DateTime UpdatedAt);

    private sealed record PermissionRow(
        string RoleName,
        string FieldKey,
        bool   CanView,
        bool   CanEdit,
        bool   IsActive);
}
