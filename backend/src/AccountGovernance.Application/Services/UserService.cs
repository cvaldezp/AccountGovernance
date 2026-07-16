using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Entities;
using AccountGovernance.Domain.Enums;

namespace AccountGovernance.Application.Services;

public sealed class UserService(
    IAdGateway             adGateway,
    IPermissionRepository  permissionRepository,
    IAuditRepository       auditRepository,
    IFieldDefinitionsCache fieldDefinitionsCache) : IUserService
{
    // Atributos LDAP que nunca deben escribirse a través del endpoint genérico de
    // atributos, sin importar lo que diga gov.FieldDefinitions o el rol del
    // operador — ver UpdateAttributeAsync. userAccountControl tiene su propio
    // flujo dedicado (UpdateAccountStatusAsync) que hace un toggle de bit seguro,
    // nunca un Replace del valor completo.
    private static readonly HashSet<string> ProtectedAttributes = new(StringComparer.OrdinalIgnoreCase)
    {
        "distinguishedName", "objectGUID", "objectSid", "sAMAccountName", "userPrincipalName",
        "userAccountControl", "unicodePwd", "pwdLastSet", "memberOf",
    };

    // AdAttributeName real de la fila del Catálogo que gobierna Estado de Cuenta
    // (ver UserDetailPage.tsx::isAccountStatusField en el frontend, mismo criterio).
    private const string AccountStatusAdAttributeName = "userAccountControl";

    public async Task<Result<IReadOnlyList<UserSearchResultDto>>> SearchAsync(
        string query, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(query) || query.Trim().Length < 3)
            return Result<IReadOnlyList<UserSearchResultDto>>.Fail(
                "Ingresa al menos 3 caracteres para buscar.", "QUERY_TOO_SHORT");

        var search = await adGateway.SearchUsersAsync(query.Trim(), ct: ct);

        if (search.TooManyResults)
            return Result<IReadOnlyList<UserSearchResultDto>>.Fail(
                "La búsqueda devuelve demasiados resultados. " +
                "Ingresa un identificador más específico: Código Banner, correo completo o usuario AD exacto.",
                "TOO_MANY_RESULTS");

        var dtos = search.Users
            .Select(u => new UserSearchResultDto(
                u.SamAccountName,
                u.DisplayName,
                u.Email,
                u.Department,
                u.IsEnabled,
                u.CustomBannerID))
            .ToList();

        return Result<IReadOnlyList<UserSearchResultDto>>.Ok(dtos);
    }

    public async Task<Result<UserDetailDto>> GetByAccountAsync(
        string samAccountName, CancellationToken ct = default)
    {
        var user = await adGateway.GetUserByAccountAsync(samAccountName, ct);
        if (user is null)
            return Result<UserDetailDto>.Fail(
                $"Usuario '{samAccountName}' no encontrado.", "USER_NOT_FOUND");

        return Result<UserDetailDto>.Ok(new UserDetailDto(
            SamAccountName:      user.SamAccountName,
            CustomBannerID:      user.CustomBannerID,
            DisplayName:         user.DisplayName,
            GivenName:           user.GivenName,
            Sn:                  user.Surname,
            Mail:                user.Email,
            UserPrincipalName:   user.UserPrincipalName,
            Company:             user.Company,
            Department:          user.Department,
            Title:               user.JobTitle,
            Manager:             user.Manager,
            Mobile:              user.Mobile,
            ExtensionAttribute1: user.ExtensionAttribute1,
            ExtensionAttribute2: user.ExtensionAttribute2,
            ExtensionAttribute3: user.ExtensionAttribute3,
            IsEnabled:           user.IsEnabled,
            WhenCreated:         user.WhenCreated,
            WhenChanged:         user.WhenChanged,
            LastLogon:           user.LastLogon,
            DistinguishedName:   user.DistinguishedName,
            Attributes:          user.RawAttributes));
    }

    public async Task<Result<UpdateUserAttributeResultDto>> UpdateAttributeAsync(
        string samAccountName, string adAttributeName, UpdateUserAttributeDto dto,
        RoleName effectiveRole, string operatorUpn, CancellationToken ct = default)
    {
        if (ProtectedAttributes.Contains(adAttributeName))
            return Result<UpdateUserAttributeResultDto>.Fail(
                $"El atributo '{adAttributeName}' no puede modificarse desde este endpoint.",
                "PROTECTED_ATTRIBUTE");

        var definitions = await fieldDefinitionsCache.GetActiveAsync(ct);
        var fieldDef = definitions.FirstOrDefault(
            d => string.Equals(d.AdAttributeName, adAttributeName, StringComparison.OrdinalIgnoreCase));
        if (fieldDef is null)
            return Result<UpdateUserAttributeResultDto>.Fail(
                $"El atributo '{adAttributeName}' no existe o no está activo en el Catálogo AD.",
                "ATTRIBUTE_NOT_FOUND");

        if (!await CanEditFieldAsync(effectiveRole, fieldDef.FieldKey, ct))
            return Result<UpdateUserAttributeResultDto>.Fail(
                "No tienes permiso para editar este atributo.", "FORBIDDEN");

        string? normalizedNewValue = null;
        if (!string.IsNullOrEmpty(dto.Value))
        {
            if (!AttributeValueValidator.TryValidate(fieldDef.DataType, dto.Value, out var normalized, out var validationError))
                return Result<UpdateUserAttributeResultDto>.Fail(validationError!, "INVALID_VALUE");
            normalizedNewValue = normalized;
        }

        var user = await adGateway.GetUserByAccountAsync(samAccountName, ct);
        if (user is null)
            return Result<UpdateUserAttributeResultDto>.Fail(
                $"Usuario '{samAccountName}' no encontrado en Active Directory.", "USER_NOT_FOUND");

        user.RawAttributes.TryGetValue(fieldDef.AdAttributeName, out var oldValue);

        // previousValue es obligatorio: el cliente debe enviar exactamente lo que
        // tenía cargado en pantalla. "" y null se tratan como equivalentes (ambos
        // representan "atributo ausente") para no generar falsos 409 por esa
        // diferencia de representación entre el DTO de lectura y el de escritura.
        if (!string.Equals(NullIfEmpty(oldValue), NullIfEmpty(dto.PreviousValue), StringComparison.Ordinal))
            return Result<UpdateUserAttributeResultDto>.Fail(
                "El valor cambió desde que se cargó la pantalla. Recarga la página e intenta de nuevo.",
                "STALE_VALUE");

        if (string.Equals(NullIfEmpty(oldValue), NullIfEmpty(normalizedNewValue), StringComparison.Ordinal))
            return Result<UpdateUserAttributeResultDto>.Ok(
                new UpdateUserAttributeResultDto(fieldDef.AdAttributeName, oldValue, normalizedNewValue, Changed: false));

        var writeOk = await adGateway.UpdateUserAttributeAsync(
            samAccountName, fieldDef.AdAttributeName, normalizedNewValue, ct);

        await auditRepository.AddEntryAsync(new AuditEntry
        {
            Id          = Guid.NewGuid().ToString(),
            Timestamp   = DateTime.UtcNow,
            PerformedBy = operatorUpn,
            RoleName    = effectiveRole,
            ActionType  = AuditActionType.UpdateField,
            FieldKey    = fieldDef.FieldKey,
            OldValue    = fieldDef.RequiresAudit ? oldValue : "***",
            NewValue    = fieldDef.RequiresAudit ? normalizedNewValue : "***",
            TargetUser  = samAccountName,
            Domain      = "AD",
            Success     = writeOk,
            Notes       = writeOk ? null : "Falló la escritura en Active Directory.",
        }, ct);

        if (!writeOk)
            return Result<UpdateUserAttributeResultDto>.Fail(
                "No se pudo actualizar el atributo en Active Directory. Intenta de nuevo.", "LDAP_WRITE_FAILED");

        return Result<UpdateUserAttributeResultDto>.Ok(
            new UpdateUserAttributeResultDto(fieldDef.AdAttributeName, oldValue, normalizedNewValue, Changed: true));
    }

    public async Task<Result<UpdateAccountStatusResultDto>> UpdateAccountStatusAsync(
        string samAccountName, UpdateAccountStatusDto dto,
        RoleName effectiveRole, string operatorUpn, CancellationToken ct = default)
    {
        var definitions = await fieldDefinitionsCache.GetActiveAsync(ct);
        var fieldDef = definitions.FirstOrDefault(
            d => string.Equals(d.AdAttributeName, AccountStatusAdAttributeName, StringComparison.OrdinalIgnoreCase));

        // Mismo criterio que GetFieldsForRoleAsync: SystemAdmin siempre puede,
        // incluso si por algún motivo la fila de Estado de Cuenta no está en el
        // Catálogo. Para cualquier otro rol, si la fila no existe no hay ninguna
        // fuente de verdad de permisos para este campo — se rechaza (fail closed),
        // en vez de asumir acceso.
        if (effectiveRole != RoleName.SystemAdmin)
        {
            if (fieldDef is null)
                return Result<UpdateAccountStatusResultDto>.Fail(
                    "El campo Estado de Cuenta no está configurado en el Catálogo AD.", "FORBIDDEN");

            if (!await CanEditFieldAsync(effectiveRole, fieldDef.FieldKey, ct))
                return Result<UpdateAccountStatusResultDto>.Fail(
                    "No tienes permiso para cambiar el estado de esta cuenta.", "FORBIDDEN");
        }

        var user = await adGateway.GetUserByAccountAsync(samAccountName, ct);
        if (user is null)
            return Result<UpdateAccountStatusResultDto>.Fail(
                $"Usuario '{samAccountName}' no encontrado en Active Directory.", "USER_NOT_FOUND");

        if (user.IsEnabled == dto.Enabled)
            return Result<UpdateAccountStatusResultDto>.Ok(
                new UpdateAccountStatusResultDto(dto.Enabled, Changed: false));

        var writeOk = await adGateway.SetAccountEnabledAsync(samAccountName, dto.Enabled, ct);

        // Re-consultar y confirmar el estado final real, no asumirlo del valor
        // pedido — si SetAccountEnabledAsync reportó éxito pero AD hizo algo
        // distinto (poco probable, pero es la garantía que pide el punto 6 del
        // diseño), el resultado auditado y devuelto refleja la verdad de AD.
        var confirmed   = writeOk ? await adGateway.GetUserByAccountAsync(samAccountName, ct) : null;
        var finalEnabled = confirmed?.IsEnabled ?? user.IsEnabled;
        var actuallyChanged = writeOk && confirmed is not null && confirmed.IsEnabled != user.IsEnabled;

        await auditRepository.AddEntryAsync(new AuditEntry
        {
            Id          = Guid.NewGuid().ToString(),
            Timestamp   = DateTime.UtcNow,
            PerformedBy = operatorUpn,
            RoleName    = effectiveRole,
            ActionType  = dto.Enabled ? AuditActionType.EnableAccount : AuditActionType.DisableAccount,
            FieldKey    = fieldDef?.FieldKey ?? AccountStatusAdAttributeName,
            OldValue    = user.IsEnabled ? "Enabled" : "Disabled",
            NewValue    = finalEnabled   ? "Enabled" : "Disabled",
            TargetUser  = samAccountName,
            Domain      = "AD",
            Success     = writeOk && actuallyChanged,
            Notes       = writeOk ? null : "Falló la escritura en Active Directory.",
        }, ct);

        if (!writeOk || !actuallyChanged)
            return Result<UpdateAccountStatusResultDto>.Fail(
                "No se pudo actualizar el estado de la cuenta en Active Directory. Intenta de nuevo.",
                "LDAP_WRITE_FAILED");

        return Result<UpdateAccountStatusResultDto>.Ok(
            new UpdateAccountStatusResultDto(finalEnabled, Changed: true));
    }

    private async Task<bool> CanEditFieldAsync(RoleName role, string fieldKey, CancellationToken ct)
    {
        if (role == RoleName.SystemAdmin) return true;

        var perms = await permissionRepository.GetRolePermissionsAsync(role, ct);
        return perms.Any(p => p.FieldKey == fieldKey && p.IsActive && p.CanEdit);
    }

    private static string? NullIfEmpty(string? value) => string.IsNullOrEmpty(value) ? null : value;
}
