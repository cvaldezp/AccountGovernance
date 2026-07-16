using System.Text.RegularExpressions;
using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Entities;
using AccountGovernance.Domain.Enums;

namespace AccountGovernance.Application.Services;

public sealed partial class PermissionService(
    IPermissionRepository permissionRepository,
    IAuditRepository      auditRepository,
    ISystemRoleRepository systemRoleRepository,
    IFieldDefinitionsCache fieldDefinitionsCache) : IPermissionService
{
    // SystemAdmin siempre tiene acceso total por regla de negocio — no depende de
    // lo que diga gov.RoleFieldPermissions, y no se puede editar por celda (ver
    // UpdateRolePermissionAsync). Se centraliza aquí para que lectura y escritura
    // apliquen exactamente la misma regla.
    private const string SystemAdminRoleKey = "SystemAdmin";

    // RFC 4512 §1.4 (descr): letra inicial, luego letras/dígitos/guiones. No
    // previene inyección de filtro LDAP (AdAttributeName nunca se concatena en un
    // filtro — solo viaja como parámetro "attributes to return" de SearchRequest),
    // pero sí evita nombres malformados o con metacaracteres antes de guardarlos.
    [GeneratedRegex(@"^[a-zA-Z][a-zA-Z0-9-]*$")]
    private static partial Regex LdapAttributeNamePattern();

    public async Task<Result<IReadOnlyList<FieldConfigDto>>> GetFieldsForRoleAsync(
        RoleName role, CancellationToken ct = default)
    {
        var definitions = await permissionRepository.GetFieldDefinitionsAsync(ct);

        // SystemAdmin siempre tiene acceso total (misma regla que GetMatrixAsync) —
        // no depende de filas en gov.RoleFieldPermissions, así que ni siquiera se
        // consulta esa tabla para este caso.
        if (role == RoleName.SystemAdmin)
        {
            var fullAccessConfigs = definitions
                .Where(d => d.IsActive)
                .Select(d => new FieldConfigDto(
                    d.FieldKey, d.AdAttributeName, d.DisplayName, d.Description,
                    d.FieldType.ToString(), d.IsSensitive,
                    CanView: true, CanEdit: true,
                    d.SortOrder, d.AllowedValues, d.Placeholder))
                .OrderBy(c => c.SortOrder)
                .ToList();

            return Result<IReadOnlyList<FieldConfigDto>>.Ok(fullAccessConfigs);
        }

        var permissions = await permissionRepository.GetRolePermissionsAsync(role, ct);

        var configs = definitions
            .Where(d => d.IsActive)
            .Select(d =>
            {
                var perm = permissions.FirstOrDefault(p => p.FieldKey == d.FieldKey && p.IsActive);
                return new FieldConfigDto(
                    d.FieldKey, d.AdAttributeName, d.DisplayName, d.Description,
                    d.FieldType.ToString(), d.IsSensitive,
                    perm?.CanView ?? false,
                    perm?.CanEdit ?? false,
                    d.SortOrder, d.AllowedValues, d.Placeholder);
            })
            .OrderBy(c => c.SortOrder)
            .ToList();

        return Result<IReadOnlyList<FieldConfigDto>>.Ok(configs);
    }

    public async Task<Result<PermissionsMatrixDto>> GetMatrixAsync(CancellationToken ct = default)
    {
        var definitions  = await permissionRepository.GetFieldDefinitionsAsync(ct);
        var allPerms     = await permissionRepository.GetRolePermissionsAsync(ct: ct);

        // Eje de roles: gov.SystemRoles (activos, en orden de Priority) — ya no
        // Enum.GetNames<RoleName>(). RoleFieldPermission.RoleName sigue siendo el
        // enum interno (no se toca en esta fase); el mapeo RoleKey→RoleName se
        // resuelve aquí con Enum.TryParse. Hoy los 5 roles activos en
        // gov.SystemRoles coinciden 1:1 con el enum, así que todos resuelven — un
        // rol futuro sin equivalente en el enum aparecería en la matriz pero
        // siempre en "Sin acceso" hasta que se migre RoleName a un RoleKey string.
        var activeRoles = await systemRoleRepository.GetActiveRolesForAuthorizationAsync(ct);
        var roleKeys    = activeRoles.Select(r => r.RoleKey).ToList();

        var rows = definitions
            .Where(d => d.IsActive)
            .OrderBy(d => d.SortOrder)
            .Select(d =>
            {
                var byRole = roleKeys.ToDictionary(
                    roleKey => roleKey,
                    roleKey =>
                    {
                        if (string.Equals(roleKey, SystemAdminRoleKey, StringComparison.OrdinalIgnoreCase))
                            return new FieldAccessDto(true, true);
                        if (!Enum.TryParse<RoleName>(roleKey, ignoreCase: true, out var rn))
                            return new FieldAccessDto(false, false);
                        var p = allPerms.FirstOrDefault(x => x.RoleName == rn && x.FieldKey == d.FieldKey && x.IsActive);
                        return new FieldAccessDto(p?.CanView ?? false, p?.CanEdit ?? false);
                    });

                return new PermissionsMatrixRowDto(
                    d.FieldKey, d.DisplayName, d.AdAttributeName, d.IsSensitive, byRole);
            })
            .ToList();

        return Result<PermissionsMatrixDto>.Ok(new PermissionsMatrixDto(rows, roleKeys));
    }

    // ── Attribute admin (CRUD) ───────────────────────────────────────────────

    public async Task<Result<IReadOnlyList<AttributeDto>>> GetAllAttributesAsync(CancellationToken ct = default)
    {
        var attributes = await permissionRepository.GetAllAttributesAsync(ct);
        return Result<IReadOnlyList<AttributeDto>>.Ok(attributes.Select(ToDto).ToList());
    }

    public async Task<Result<AttributeDto>> GetAttributeByKeyAsync(string fieldKey, CancellationToken ct = default)
    {
        var attribute = await permissionRepository.GetAttributeByKeyAsync(fieldKey, ct);
        return attribute is null
            ? Result<AttributeDto>.Fail("Atributo no encontrado.", "NOT_FOUND")
            : Result<AttributeDto>.Ok(ToDto(attribute));
    }

    public async Task<Result<AttributeDto>> CreateAttributeAsync(
        CreateAttributeDto dto, string createdBy, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.FieldKey))
            return Result<AttributeDto>.Fail("La clave del atributo (FieldKey) es obligatoria.", "VALIDATION");
        if (string.IsNullOrWhiteSpace(dto.AdAttributeName))
            return Result<AttributeDto>.Fail("El atributo LDAP (AdAttributeName) es obligatorio.", "VALIDATION");
        if (!LdapAttributeNamePattern().IsMatch(dto.AdAttributeName.Trim()))
            return Result<AttributeDto>.Fail(
                $"'{dto.AdAttributeName}' no es un nombre de atributo LDAP válido " +
                "(debe empezar con una letra y contener solo letras, números y guiones).", "VALIDATION");
        if (string.IsNullOrWhiteSpace(dto.DisplayName))
            return Result<AttributeDto>.Fail("El nombre visible es obligatorio.", "VALIDATION");
        if (!Enum.TryParse<FieldType>(dto.FieldType, ignoreCase: true, out var fieldType))
            return Result<AttributeDto>.Fail($"Tipo de campo '{dto.FieldType}' no es válido.", "VALIDATION");

        if (await permissionRepository.GetAttributeByKeyAsync(dto.FieldKey, ct) is not null)
            return Result<AttributeDto>.Fail($"Ya existe un atributo con FieldKey '{dto.FieldKey}'.", "DUPLICATE");

        if (await permissionRepository.ExistsByAdAttributeNameAsync(dto.AdAttributeName, ct: ct))
            return Result<AttributeDto>.Fail(
                $"Ya existe un atributo que usa el atributo LDAP '{dto.AdAttributeName}'.", "DUPLICATE");

        var now = DateTime.UtcNow;
        var attribute = new FieldDefinition
        {
            FieldKey        = dto.FieldKey.Trim(),
            AdAttributeName = dto.AdAttributeName.Trim(),
            DisplayName     = dto.DisplayName.Trim(),
            Description     = dto.Description?.Trim() ?? string.Empty,
            FieldType       = fieldType,
            Category        = dto.Category?.Trim(),
            DataType        = dto.DataType?.Trim(),
            IsSensitive     = dto.IsSensitive,
            RequiresAudit   = dto.RequiresAudit,
            IsActive        = true,
            SortOrder       = dto.SortOrder,
            AllowedValues   = dto.AllowedValues,
            Placeholder     = dto.Placeholder?.Trim(),
            CreatedBy       = createdBy,
            UpdatedBy       = createdBy,
            CreatedAt       = now,
            UpdatedAt       = now,
        };

        await permissionRepository.CreateAttributeAsync(attribute, ct);
        fieldDefinitionsCache.Invalidate();
        await LogAttributeAuditAsync(AuditActionType.CreateAttribute, attribute.FieldKey, createdBy, null,
            $"AdAttributeName={attribute.AdAttributeName}, DisplayName={attribute.DisplayName}", ct);

        return await GetAttributeByKeyAsync(attribute.FieldKey, ct);
    }

    public async Task<Result<AttributeDto>> UpdateAttributeAsync(
        string fieldKey, UpdateAttributeDto dto, string updatedBy, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.AdAttributeName))
            return Result<AttributeDto>.Fail("El atributo LDAP (AdAttributeName) es obligatorio.", "VALIDATION");
        if (!LdapAttributeNamePattern().IsMatch(dto.AdAttributeName.Trim()))
            return Result<AttributeDto>.Fail(
                $"'{dto.AdAttributeName}' no es un nombre de atributo LDAP válido " +
                "(debe empezar con una letra y contener solo letras, números y guiones).", "VALIDATION");
        if (string.IsNullOrWhiteSpace(dto.DisplayName))
            return Result<AttributeDto>.Fail("El nombre visible es obligatorio.", "VALIDATION");
        if (!Enum.TryParse<FieldType>(dto.FieldType, ignoreCase: true, out var fieldType))
            return Result<AttributeDto>.Fail($"Tipo de campo '{dto.FieldType}' no es válido.", "VALIDATION");

        var existing = await permissionRepository.GetAttributeByKeyAsync(fieldKey, ct);
        if (existing is null)
            return Result<AttributeDto>.Fail("Atributo no encontrado.", "NOT_FOUND");

        if (await permissionRepository.ExistsByAdAttributeNameAsync(dto.AdAttributeName, fieldKey, ct))
            return Result<AttributeDto>.Fail(
                $"Ya existe otro atributo que usa el atributo LDAP '{dto.AdAttributeName}'.", "DUPLICATE");

        var updated = new FieldDefinition
        {
            FieldKey        = existing.FieldKey,
            AdAttributeName = dto.AdAttributeName.Trim(),
            DisplayName     = dto.DisplayName.Trim(),
            Description     = dto.Description?.Trim() ?? string.Empty,
            FieldType       = fieldType,
            Category        = dto.Category?.Trim(),
            DataType        = dto.DataType?.Trim(),
            IsSensitive     = dto.IsSensitive,
            RequiresAudit   = dto.RequiresAudit,
            IsActive        = existing.IsActive,
            SortOrder       = dto.SortOrder,
            AllowedValues   = dto.AllowedValues,
            Placeholder     = dto.Placeholder?.Trim(),
            CreatedBy       = existing.CreatedBy,
            UpdatedBy       = updatedBy,
            CreatedAt       = existing.CreatedAt,
            UpdatedAt       = DateTime.UtcNow,
        };

        await permissionRepository.UpdateAttributeAsync(updated, ct);
        fieldDefinitionsCache.Invalidate();
        await LogAttributeAuditAsync(AuditActionType.UpdateAttribute, fieldKey, updatedBy,
            $"AdAttributeName={existing.AdAttributeName}, DisplayName={existing.DisplayName}",
            $"AdAttributeName={updated.AdAttributeName}, DisplayName={updated.DisplayName}", ct);

        return await GetAttributeByKeyAsync(fieldKey, ct);
    }

    public async Task<Result<AttributeDto>> SetAttributeStatusAsync(
        string fieldKey, UpdateAttributeStatusDto dto, string updatedBy, CancellationToken ct = default)
    {
        var existing = await permissionRepository.GetAttributeByKeyAsync(fieldKey, ct);
        if (existing is null)
            return Result<AttributeDto>.Fail("Atributo no encontrado.", "NOT_FOUND");

        await permissionRepository.SetAttributeStatusAsync(fieldKey, dto.IsActive, updatedBy, ct);
        fieldDefinitionsCache.Invalidate();
        await LogAttributeAuditAsync(
            dto.IsActive ? AuditActionType.ActivateAttribute : AuditActionType.DeactivateAttribute,
            fieldKey, updatedBy, existing.IsActive.ToString(), dto.IsActive.ToString(), ct);

        return await GetAttributeByKeyAsync(fieldKey, ct);
    }

    // ── Permissions matrix — editable cells ─────────────────────────────────

    public async Task<Result<RolePermissionCellDto>> UpdateRolePermissionAsync(
        string roleKey, string fieldKey, UpdateRolePermissionDto dto, string updatedBy, CancellationToken ct = default)
    {
        if (dto.Access is not ("None" or "View" or "Edit"))
            return Result<RolePermissionCellDto>.Fail(
                $"Access '{dto.Access}' inválido. Use None, View o Edit.", "VALIDATION");

        var activeRoles = await systemRoleRepository.GetActiveRolesForAuthorizationAsync(ct);
        if (!activeRoles.Any(r => string.Equals(r.RoleKey, roleKey, StringComparison.OrdinalIgnoreCase)))
            return Result<RolePermissionCellDto>.Fail(
                $"Rol '{roleKey}' no encontrado o inactivo en gov.SystemRoles.", "NOT_FOUND");

        if (string.Equals(roleKey, SystemAdminRoleKey, StringComparison.OrdinalIgnoreCase))
            return Result<RolePermissionCellDto>.Fail(
                "SystemAdmin siempre tiene acceso total; no se puede editar por celda.", "VALIDATION");

        // Limitación conocida y documentada (ver GetMatrixAsync): un rol activo en
        // gov.SystemRoles sin equivalente en el enum RoleName no se puede editar
        // todavía — requeriría migrar RoleFieldPermission.RoleName a string.
        if (!Enum.TryParse<RoleName>(roleKey, ignoreCase: true, out var roleNameEnum))
            return Result<RolePermissionCellDto>.Fail(
                $"El rol '{roleKey}' existe en gov.SystemRoles pero no tiene un mapeo interno soportado " +
                $"todavía para edición de permisos por celda. Roles soportados: " +
                $"{string.Join(", ", Enum.GetNames<RoleName>())}.", "UNSUPPORTED_ROLE");

        var attribute = await permissionRepository.GetAttributeByKeyAsync(fieldKey, ct);
        if (attribute is null || !attribute.IsActive)
            return Result<RolePermissionCellDto>.Fail("Atributo no encontrado o inactivo.", "NOT_FOUND");

        var (canView, canEdit) = dto.Access switch
        {
            "View" => (true, false),
            "Edit" => (true, true),
            _      => (false, false), // "None"
        };

        var existingPerms = await permissionRepository.GetRolePermissionsAsync(roleNameEnum, ct);
        var previous       = existingPerms.FirstOrDefault(p => p.FieldKey == fieldKey);
        var previousAccess = previous is null ? "None" : previous.CanEdit ? "Edit" : previous.CanView ? "View" : "None";

        await permissionRepository.UpsertRolePermissionAsync(roleNameEnum, fieldKey, canView, canEdit, updatedBy, ct);

        await auditRepository.AddEntryAsync(new AuditEntry
        {
            Id          = Guid.NewGuid().ToString(),
            Timestamp   = DateTime.UtcNow,
            PerformedBy = updatedBy,
            RoleName    = RoleName.SystemAdmin,
            ActionType  = AuditActionType.UpdateRolePermission,
            FieldKey    = fieldKey,
            OldValue    = $"Access={previousAccess}",
            NewValue    = $"Access={dto.Access}",
            TargetUser  = roleKey,
            Domain      = "SYSTEM",
            Success     = true,
        }, ct);

        return Result<RolePermissionCellDto>.Ok(new RolePermissionCellDto(roleKey, fieldKey, canView, canEdit));
    }

    private async Task LogAttributeAuditAsync(
        AuditActionType actionType, string fieldKey, string performedBy,
        string? oldValue, string? newValue, CancellationToken ct)
    {
        await auditRepository.AddEntryAsync(new AuditEntry
        {
            Id          = Guid.NewGuid().ToString(),
            Timestamp   = DateTime.UtcNow,
            PerformedBy = performedBy,
            RoleName    = RoleName.SystemAdmin,
            ActionType  = actionType,
            FieldKey    = fieldKey,
            OldValue    = oldValue,
            NewValue    = newValue,
            TargetUser  = fieldKey,
            Domain      = "SYSTEM",
            Success     = true,
        }, ct);
    }

    private static AttributeDto ToDto(FieldDefinition d) => new(
        d.FieldKey, d.AdAttributeName, d.DisplayName, d.Description, d.FieldType.ToString(),
        d.Category, d.DataType, d.IsSensitive, d.RequiresAudit, d.IsActive, d.SortOrder,
        d.AllowedValues, d.Placeholder, d.CreatedBy, d.UpdatedBy, d.CreatedAt, d.UpdatedAt);
}
