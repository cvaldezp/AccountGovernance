using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Entities;
using AccountGovernance.Domain.Enums;

namespace AccountGovernance.Application.Services;

public sealed class AdministrativeScopeService(
    IAdministrativeScopeRepository repo,
    IAdGateway                     adGateway,
    IAuditRepository               auditRepository) : IAdministrativeScopeService
{
    public async Task<Result<IReadOnlyList<AdministrativeScopeDto>>> GetAllAsync(CancellationToken ct = default)
    {
        var scopes = await repo.GetAllAsync(ct);
        var dtos   = new List<AdministrativeScopeDto>(scopes.Count);
        foreach (var scope in scopes)
        {
            var filters = await repo.GetFiltersByScopeKeyAsync(scope.ScopeKey, ct);
            dtos.Add(ToDto(scope, filters));
        }
        return Result<IReadOnlyList<AdministrativeScopeDto>>.Ok(dtos);
    }

    public async Task<Result<AdministrativeScopeDto>> GetByKeyAsync(string scopeKey, CancellationToken ct = default)
    {
        var scope = await repo.GetByKeyAsync(scopeKey, ct);
        if (scope is null)
            return Result<AdministrativeScopeDto>.Fail("Ámbito no encontrado.", "NOT_FOUND");

        var filters = await repo.GetFiltersByScopeKeyAsync(scopeKey, ct);
        return Result<AdministrativeScopeDto>.Ok(ToDto(scope, filters));
    }

    public async Task<Result<AdministrativeScopeDto>> CreateAsync(
        CreateAdministrativeScopeDto dto, string createdBy, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.ScopeKey))
            return Result<AdministrativeScopeDto>.Fail("La clave del ámbito (ScopeKey) es obligatoria.", "VALIDATION");
        if (string.IsNullOrWhiteSpace(dto.Name))
            return Result<AdministrativeScopeDto>.Fail("El nombre es obligatorio.", "VALIDATION");
        if (string.IsNullOrWhiteSpace(dto.BaseDn))
            return Result<AdministrativeScopeDto>.Fail("El Base DN es obligatorio.", "VALIDATION");

        if (await repo.ExistsByKeyAsync(dto.ScopeKey, ct))
            return Result<AdministrativeScopeDto>.Fail(
                $"Ya existe un ámbito con ScopeKey '{dto.ScopeKey}'.", "DUPLICATE");

        if (dto.IsActive)
        {
            var activationError = await ValidateActivationAsync(dto.BaseDn, [], ct);
            if (activationError is not null)
                return Result<AdministrativeScopeDto>.Fail(activationError, "VALIDATION");
        }

        var now = DateTime.UtcNow;
        var scope = new AdministrativeScope
        {
            ScopeKey          = dto.ScopeKey.Trim(),
            Name              = dto.Name.Trim(),
            Description       = dto.Description?.Trim(),
            Category          = dto.Category?.Trim(),
            BaseDn            = dto.BaseDn.Trim(),
            ConnectionProfile = string.IsNullOrWhiteSpace(dto.ConnectionProfile) ? "default" : dto.ConnectionProfile.Trim(),
            IsActive          = dto.IsActive,
            Priority          = dto.Priority,
            CreatedBy         = createdBy,
            UpdatedBy         = createdBy,
            CreatedAt         = now,
            UpdatedAt         = now,
        };

        await repo.CreateAsync(scope, ct);

        await LogScopeAuditAsync(
            AuditActionType.ScopeCreated, scope.ScopeKey, filterId: null, createdBy,
            oldValue: null, newValue: DescribeScope(scope), ct);

        return await GetByKeyAsync(scope.ScopeKey, ct);
    }

    public async Task<Result<AdministrativeScopeDto>> UpdateAsync(
        string scopeKey, UpdateAdministrativeScopeDto dto, string updatedBy, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return Result<AdministrativeScopeDto>.Fail("El nombre es obligatorio.", "VALIDATION");
        if (string.IsNullOrWhiteSpace(dto.BaseDn))
            return Result<AdministrativeScopeDto>.Fail("El Base DN es obligatorio.", "VALIDATION");

        var existing = await repo.GetByKeyAsync(scopeKey, ct);
        if (existing is null)
            return Result<AdministrativeScopeDto>.Fail("Ámbito no encontrado.", "NOT_FOUND");

        // Si el ámbito ya está activo, cualquier edición de BaseDn/Filters debe
        // mantenerlo válido — la invariante "activo implica configuración
        // completa" aplica en todo momento, no solo al activar.
        if (existing.IsActive)
        {
            var activeFilters = (await repo.GetFiltersByScopeKeyAsync(scopeKey, ct))
                .Where(f => f.IsActive).ToList();
            var activationError = await ValidateActivationAsync(dto.BaseDn, activeFilters, ct);
            if (activationError is not null)
                return Result<AdministrativeScopeDto>.Fail(activationError, "VALIDATION");
        }

        var scope = new AdministrativeScope
        {
            ScopeKey          = scopeKey,
            Name              = dto.Name.Trim(),
            Description       = dto.Description?.Trim(),
            Category          = dto.Category?.Trim(),
            BaseDn            = dto.BaseDn.Trim(),
            ConnectionProfile = string.IsNullOrWhiteSpace(dto.ConnectionProfile) ? "default" : dto.ConnectionProfile.Trim(),
            Priority          = dto.Priority,
            UpdatedBy         = updatedBy,
            UpdatedAt         = DateTime.UtcNow,
        };

        await repo.UpdateAsync(scope, ct);

        await LogScopeAuditAsync(
            AuditActionType.ScopeUpdated, scopeKey, filterId: null, updatedBy,
            oldValue: DescribeScope(existing), newValue: DescribeScope(scope), ct);

        return await GetByKeyAsync(scopeKey, ct);
    }

    public async Task<Result<AdministrativeScopeDto>> SetStatusAsync(
        string scopeKey, UpdateAdministrativeScopeStatusDto dto, string updatedBy, CancellationToken ct = default)
    {
        var existing = await repo.GetByKeyAsync(scopeKey, ct);
        if (existing is null)
            return Result<AdministrativeScopeDto>.Fail("Ámbito no encontrado.", "NOT_FOUND");

        if (dto.IsActive)
        {
            var activeFilters = (await repo.GetFiltersByScopeKeyAsync(scopeKey, ct))
                .Where(f => f.IsActive).ToList();
            var activationError = await ValidateActivationAsync(existing.BaseDn, activeFilters, ct);
            if (activationError is not null)
                return Result<AdministrativeScopeDto>.Fail(activationError, "VALIDATION");
        }

        await repo.SetStatusAsync(scopeKey, dto.IsActive, updatedBy, ct);

        await LogScopeAuditAsync(
            dto.IsActive ? AuditActionType.ScopeActivated : AuditActionType.ScopeDeactivated,
            scopeKey, filterId: null, updatedBy,
            oldValue: existing.IsActive ? "Active" : "Inactive",
            newValue: dto.IsActive ? "Active" : "Inactive", ct);

        return await GetByKeyAsync(scopeKey, ct);
    }

    public async Task<Result<AdministrativeScopeFilterDto>> CreateFilterAsync(
        string scopeKey, CreateAdministrativeScopeFilterDto dto, string updatedBy, CancellationToken ct = default)
    {
        var scope = await repo.GetByKeyAsync(scopeKey, ct);
        if (scope is null)
            return Result<AdministrativeScopeFilterDto>.Fail("Ámbito no encontrado.", "NOT_FOUND");

        // TryValidateFilterFields ya exige completitud estructural (AttributeName +
        // Value salvo Exists) para cualquier filtro, esté o no activo el ámbito —
        // así un filtro activo nunca puede quedar a medio configurar.
        if (!TryValidateFilterFields(dto.FilterType, dto.AttributeName, dto.Operator, dto.Value,
                out var op, out var fieldError))
            return Result<AdministrativeScopeFilterDto>.Fail(fieldError!, "VALIDATION");

        if (dto.IsActive)
        {
            var duplicateError = await CheckDuplicateFilterAsync(
                scopeKey, dto.AttributeName, op, dto.Value, excludeFilterId: null, ct);
            if (duplicateError is not null)
                return Result<AdministrativeScopeFilterDto>.Fail(duplicateError, "DUPLICATE_FILTER");
        }

        var now = DateTime.UtcNow;
        var filter = new AdministrativeScopeFilter
        {
            AdministrativeScopeId = scope.Id,
            FilterType            = dto.FilterType.Trim(),
            AttributeName         = dto.AttributeName.Trim(),
            Operator              = op,
            Value                 = op == ScopeFilterOperator.Exists ? null : dto.Value?.Trim(),
            IsActive              = dto.IsActive,
            CreatedAt             = now,
            UpdatedAt             = now,
            UpdatedBy             = updatedBy,
        };

        int id;
        try
        {
            id = await repo.CreateFilterAsync(filter, ct);
        }
        catch (DuplicateFilterException)
        {
            // Defensa en profundidad: dos requests concurrentes podrían pasar el
            // chequeo de arriba al mismo tiempo — el repositorio traduce la
            // violación del índice único filtrado de SQL Server a esta excepción
            // de Application, sin que este servicio dependa de Microsoft.Data.SqlClient.
            return Result<AdministrativeScopeFilterDto>.Fail(
                "Ya existe un filtro activo equivalente en este ámbito.", "DUPLICATE_FILTER");
        }

        var created = await repo.GetFilterByIdAsync(id, ct);
        if (created is null)
            return Result<AdministrativeScopeFilterDto>.Fail("Error al recuperar el filtro creado.", "DB_ERROR");

        await LogScopeAuditAsync(
            AuditActionType.ScopeFilterCreated, scopeKey, filterId: created.Id.ToString(), updatedBy,
            oldValue: null, newValue: DescribeFilter(created), ct);

        return Result<AdministrativeScopeFilterDto>.Ok(ToFilterDto(created));
    }

    public async Task<Result<AdministrativeScopeFilterDto>> UpdateFilterAsync(
        string scopeKey, int filterId, UpdateAdministrativeScopeFilterDto dto, string updatedBy, CancellationToken ct = default)
    {
        var existing = await repo.GetFilterByIdAsync(filterId, ct);
        if (existing is null)
            return Result<AdministrativeScopeFilterDto>.Fail("Filtro no encontrado.", "NOT_FOUND");
        if (!string.Equals(existing.ScopeKey, scopeKey, StringComparison.OrdinalIgnoreCase))
            return Result<AdministrativeScopeFilterDto>.Fail(
                "El filtro no pertenece al ámbito indicado en la ruta.", "VALIDATION");

        if (!TryValidateFilterFields(dto.FilterType, dto.AttributeName, dto.Operator, dto.Value,
                out var op, out var fieldError))
            return Result<AdministrativeScopeFilterDto>.Fail(fieldError!, "VALIDATION");

        if (dto.IsActive)
        {
            var duplicateError = await CheckDuplicateFilterAsync(
                scopeKey, dto.AttributeName, op, dto.Value, excludeFilterId: filterId, ct);
            if (duplicateError is not null)
                return Result<AdministrativeScopeFilterDto>.Fail(duplicateError, "DUPLICATE_FILTER");
        }

        var filter = new AdministrativeScopeFilter
        {
            Id            = filterId,
            FilterType    = dto.FilterType.Trim(),
            AttributeName = dto.AttributeName.Trim(),
            Operator      = op,
            Value         = op == ScopeFilterOperator.Exists ? null : dto.Value?.Trim(),
            IsActive      = dto.IsActive,
            UpdatedBy     = updatedBy,
            UpdatedAt     = DateTime.UtcNow,
        };

        try
        {
            await repo.UpdateFilterAsync(filter, ct);
        }
        catch (DuplicateFilterException)
        {
            return Result<AdministrativeScopeFilterDto>.Fail(
                "Ya existe un filtro activo equivalente en este ámbito.", "DUPLICATE_FILTER");
        }

        var refreshed = await repo.GetFilterByIdAsync(filterId, ct);
        if (refreshed is null)
            return Result<AdministrativeScopeFilterDto>.Fail("Error al recuperar el filtro actualizado.", "DB_ERROR");

        await LogScopeAuditAsync(
            AuditActionType.ScopeFilterUpdated, scopeKey, filterId: filterId.ToString(), updatedBy,
            oldValue: DescribeFilter(existing), newValue: DescribeFilter(refreshed), ct);

        return Result<AdministrativeScopeFilterDto>.Ok(ToFilterDto(refreshed));
    }

    public async Task<Result<bool>> DeleteFilterAsync(
        string scopeKey, int filterId, string performedBy, CancellationToken ct = default)
    {
        var existing = await repo.GetFilterByIdAsync(filterId, ct);
        if (existing is null)
            return Result<bool>.Fail("Filtro no encontrado.", "NOT_FOUND");
        if (!string.Equals(existing.ScopeKey, scopeKey, StringComparison.OrdinalIgnoreCase))
            return Result<bool>.Fail("El filtro no pertenece al ámbito indicado en la ruta.", "VALIDATION");

        await repo.DeleteFilterAsync(filterId, ct);

        await LogScopeAuditAsync(
            AuditActionType.ScopeFilterDeleted, scopeKey, filterId: filterId.ToString(), performedBy,
            oldValue: DescribeFilter(existing), newValue: null, ct);

        return Result<bool>.Ok(true);
    }

    // ── Validaciones compartidas ─────────────────────────────────────────────

    /// <summary>
    /// Regla de activación: un Scope activo debe tener un BaseDn no vacío y
    /// verificado contra AD real, y cualquier Filter activo debe estar completo
    /// (AttributeName presente; Value presente salvo operador Exists). BaseDn
    /// solo, sin Filters, es una configuración mínima válida y suficiente.
    /// </summary>
    private async Task<string?> ValidateActivationAsync(
        string baseDn, IReadOnlyList<AdministrativeScopeFilter> activeFilters, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(baseDn))
            return "El ámbito no puede activarse sin un Base DN configurado.";

        if (!await adGateway.OuExistsAsync(baseDn.Trim(), ct))
            return $"El Base DN '{baseDn}' no existe en Active Directory — no se puede activar el ámbito.";

        foreach (var f in activeFilters)
        {
            if (string.IsNullOrWhiteSpace(f.AttributeName))
                return "Cada filtro activo debe indicar un atributo AD.";
            if (f.Operator != ScopeFilterOperator.Exists && string.IsNullOrWhiteSpace(f.Value))
                return $"El filtro sobre '{f.AttributeName}' requiere un valor para el operador {f.Operator}.";
        }

        return null;
    }

    private static bool TryValidateFilterFields(
        string filterType, string attributeName, string operatorRaw, string? value,
        out ScopeFilterOperator op, out string? error)
    {
        op    = default;
        error = null;

        if (string.IsNullOrWhiteSpace(filterType))
        {
            error = "El tipo de filtro (FilterType) es obligatorio.";
            return false;
        }
        if (string.IsNullOrWhiteSpace(attributeName))
        {
            error = "El atributo AD (AttributeName) es obligatorio.";
            return false;
        }
        if (!Enum.TryParse(operatorRaw, ignoreCase: true, out op))
        {
            error = $"Operador '{operatorRaw}' no es válido. Valores permitidos: Equals, NotEquals, In, Exists.";
            return false;
        }
        if (op != ScopeFilterOperator.Exists && string.IsNullOrWhiteSpace(value))
        {
            error = $"El operador {op} requiere un valor.";
            return false;
        }

        return true;
    }

    /// <summary>
    /// Unicidad lógica entre filtros ACTIVOS de un mismo ámbito, sobre
    /// (AttributeName normalizado, Operator, Value normalizado). AttributeName
    /// se compara sin distinguir mayúsculas/espacios (los nombres de atributo
    /// LDAP no distinguen mayúsculas). Value se compara igual, salvo para el
    /// operador In, donde además se ignora el orden de la lista separada por
    /// comas ("A,B" y "B, A" son el mismo filtro lógico). Exists siempre
    /// normaliza a un Value vacío, consistente con que su columna Value se
    /// persiste como NULL.
    /// </summary>
    private async Task<string?> CheckDuplicateFilterAsync(
        string scopeKey, string attributeName, ScopeFilterOperator op, string? value,
        int? excludeFilterId, CancellationToken ct)
    {
        var (normAttr, normValue) = Normalize(attributeName, op, value);

        var existingFilters = await repo.GetFiltersByScopeKeyAsync(scopeKey, ct);
        var isDuplicate = existingFilters.Any(f =>
        {
            if (!f.IsActive) return false;
            if (excludeFilterId is not null && f.Id == excludeFilterId.Value) return false;
            if (f.Operator != op) return false;

            var (existingAttr, existingValue) = Normalize(f.AttributeName, f.Operator, f.Value);
            return existingAttr == normAttr && existingValue == normValue;
        });

        return isDuplicate
            ? $"Ya existe un filtro activo equivalente para '{attributeName}' con el operador {op} en este ámbito."
            : null;
    }

    private static (string AttributeName, string Value) Normalize(string attributeName, ScopeFilterOperator op, string? value)
    {
        var normAttr = attributeName.Trim().ToUpperInvariant();

        if (op == ScopeFilterOperator.Exists)
            return (normAttr, string.Empty);

        if (op == ScopeFilterOperator.In)
        {
            var tokens = (value ?? string.Empty)
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(t => t.ToUpperInvariant())
                .OrderBy(t => t, StringComparer.Ordinal);
            return (normAttr, string.Join(',', tokens));
        }

        return (normAttr, (value ?? string.Empty).Trim().ToUpperInvariant());
    }

    // ── Auditoría ────────────────────────────────────────────────────────────

    /// <summary>
    /// Registra una mutación de Scope/Filter en gov.AuditEntries — misma tabla
    /// que el resto del sistema, sin historial paralelo. RoleName se fija en
    /// SystemAdmin porque estas mutaciones ya están restringidas a ese rol
    /// (mismo patrón que PermissionService.LogAttributeAuditAsync para el
    /// Catálogo de Atributos). Solo se llama tras una escritura exitosa — los
    /// rechazos de validación no generan entrada, igual que en el resto del
    /// proyecto. filterId viaja en FieldKey (columna genérica reutilizada,
    /// mismo patrón ya usado para FieldKey/roleKey en auditorías anteriores);
    /// null cuando la acción es sobre el Scope, no sobre un Filter puntual.
    /// </summary>
    private async Task LogScopeAuditAsync(
        AuditActionType actionType, string scopeKey, string? filterId, string performedBy,
        string? oldValue, string? newValue, CancellationToken ct)
    {
        await auditRepository.AddEntryAsync(new AuditEntry
        {
            Id          = Guid.NewGuid().ToString(),
            Timestamp   = DateTime.UtcNow,
            PerformedBy = performedBy,
            RoleName    = RoleName.SystemAdmin,
            ActionType  = actionType,
            FieldKey    = filterId,
            OldValue    = oldValue,
            NewValue    = newValue,
            TargetUser  = scopeKey,
            Domain      = "SYSTEM",
            Success     = true,
        }, ct);
    }

    private static string DescribeScope(AdministrativeScope s) =>
        $"Name={s.Name}, Category={s.Category ?? "-"}, BaseDn={s.BaseDn}, " +
        $"ConnectionProfile={s.ConnectionProfile}, Priority={s.Priority}";

    private static string DescribeFilter(AdministrativeScopeFilter f) =>
        $"FilterType={f.FilterType}, AttributeName={f.AttributeName}, " +
        $"Operator={f.Operator}, Value={f.Value ?? "-"}, IsActive={f.IsActive}";

    private static AdministrativeScopeDto ToDto(
        AdministrativeScope s, IReadOnlyList<AdministrativeScopeFilter> filters) => new(
        s.Id, s.ScopeKey, s.Name, s.Description, s.Category, s.BaseDn, s.ConnectionProfile,
        s.IsActive, s.Priority, s.CreatedBy, s.UpdatedBy, s.CreatedAt, s.UpdatedAt,
        filters.Select(ToFilterDto).ToList());

    private static AdministrativeScopeFilterDto ToFilterDto(AdministrativeScopeFilter f) => new(
        f.Id, f.FilterType, f.AttributeName, f.Operator.ToString(), f.Value, f.IsActive);
}
