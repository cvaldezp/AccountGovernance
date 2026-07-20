using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Entities;
using AccountGovernance.Domain.Enums;

namespace AccountGovernance.Application.Services;

/// <summary>
/// Política de nombres de cuenta — única para todo el sistema de creación de
/// cuentas. Sin regex en ningún punto del motor de validación: AllowedChars es
/// una enumeración literal de caracteres, y cada regla se evalúa por pertenencia
/// a un conjunto o recorriendo el string una vez — deliberado, ver diseño
/// acordado (Incremento 2.1): evita divergencia entre motores de regex
/// frontend/backend y mantiene la lógica auditable a simple vista.
/// </summary>
public sealed class AccountNamingPolicyService(
    IAccountNamingPolicyRepository repo,
    IAuditRepository               auditRepository) : IAccountNamingPolicyService
{
    // Límite duro de sAMAccountName en Active Directory (pre-Windows 2000 logon
    // name) — no es negociable ni configurable, a diferencia de MaxLength (que
    // es el techo de negocio para el campo "Cuenta" en abstracto, sin prefijo).
    private const int AdSamAccountNameHardLimit = 20;

    // Superconjunto seguro — el único universo de caracteres que AllowedChars
    // puede usar. No es editable; es el límite fuera del cual ninguna
    // configuración de Seguridad puede salirse.
    private const string SafeCharacterSuperset = "abcdefghijklmnopqrstuvwxyz0123456789-._";

    public async Task<Result<AccountNamingPolicyDto>> GetAsync(CancellationToken ct = default)
    {
        var policy = await repo.GetAsync(ct);
        return Result<AccountNamingPolicyDto>.Ok(ToDto(policy));
    }

    public async Task<Result<AccountNamingPolicyDto>> UpdateAsync(
        UpdateAccountNamingPolicyDto dto, string updatedBy, CancellationToken ct = default)
    {
        var configError = ValidateConfig(dto);
        if (configError is not null)
            return Result<AccountNamingPolicyDto>.Fail(configError, "VALIDATION");

        var existing = await repo.GetAsync(ct);

        var updated = new AccountNamingPolicy
        {
            Id                                  = 1,
            AllowedChars                        = dto.AllowedChars,
            MinLength                           = dto.MinLength,
            MaxLength                           = dto.MaxLength,
            DisallowLeadingTrailingSpecialChars = dto.DisallowLeadingTrailingSpecialChars,
            DisallowConsecutiveSpecialChars     = dto.DisallowConsecutiveSpecialChars,
            UpdatedAt                           = DateTime.UtcNow,
            UpdatedBy                           = updatedBy,
        };

        await repo.UpdateAsync(updated, ct);

        await auditRepository.AddEntryAsync(new AuditEntry
        {
            Id          = Guid.NewGuid().ToString(),
            Timestamp   = DateTime.UtcNow,
            PerformedBy = updatedBy,
            RoleName    = RoleName.SystemAdmin,
            ActionType  = AuditActionType.NamingPolicyUpdated,
            FieldKey    = null,
            OldValue    = Describe(existing),
            NewValue    = Describe(updated),
            TargetUser  = "AccountNamingPolicy",
            Domain      = "SYSTEM",
            Success     = true,
        }, ct);

        return Result<AccountNamingPolicyDto>.Ok(ToDto(updated));
    }

    public async Task<AccountNameValidationResult> ValidateAccountNameAsync(
        string rawAccountName, string? samPrefix, CancellationToken ct = default)
    {
        // Única normalización permitida: trim + minúsculas culturalmente estables
        // (ToLowerInvariant — ignora la cultura del hilo, sin sorpresas tipo
        // Turkish-I). Nunca se elimina, translitera ni sustituye ningún carácter.
        var normalized = (rawAccountName ?? string.Empty).Trim().ToLowerInvariant();

        if (normalized.Length == 0)
            return new AccountNameValidationResult(false, normalized, null);

        var policy = await repo.GetAsync(ct);

        if (normalized.Length < policy.MinLength || normalized.Length > policy.MaxLength)
            return new AccountNameValidationResult(false, normalized,
                $"La cuenta debe tener entre {policy.MinLength} y {policy.MaxLength} caracteres.");

        var allowedSet = new HashSet<char>(policy.AllowedChars);
        foreach (var c in normalized)
        {
            if (!allowedSet.Contains(c))
                return new AccountNameValidationResult(false, normalized, BuildCharsMessage(policy));
        }

        if (policy.DisallowLeadingTrailingSpecialChars &&
            (!IsAlphanumeric(normalized[0]) || !IsAlphanumeric(normalized[^1])))
            return new AccountNameValidationResult(false, normalized,
                "La cuenta no puede comenzar ni terminar con un carácter especial.");

        if (policy.DisallowConsecutiveSpecialChars)
        {
            for (var i = 0; i < normalized.Length - 1; i++)
            {
                if (!IsAlphanumeric(normalized[i]) && !IsAlphanumeric(normalized[i + 1]))
                    return new AccountNameValidationResult(false, normalized,
                        "La cuenta no puede contener caracteres especiales consecutivos.");
            }
        }

        // Límite efectivo de sAMAccountName — siempre se aplica, sin importar
        // MaxLength: un MaxLength configurado por debajo de 20 no garantiza que
        // prefijo+cuenta quepan en el límite real de AD para tipos con prefijo
        // (ej. sub-tipos PRIVILEGED: op/sa/sys/cyber).
        var effectiveLength = (samPrefix?.Length ?? 0) + normalized.Length;
        if (effectiveLength > AdSamAccountNameHardLimit)
        {
            var message = !string.IsNullOrEmpty(samPrefix)
                ? $"Con el prefijo '{samPrefix}' de este tipo de cuenta, el nombre no puede superar los " +
                  $"{AdSamAccountNameHardLimit - samPrefix.Length} caracteres."
                : $"El nombre de cuenta no puede superar los {AdSamAccountNameHardLimit} caracteres " +
                  "(límite de Active Directory).";
            return new AccountNameValidationResult(false, normalized, message);
        }

        return new AccountNameValidationResult(true, normalized, null);
    }

    // ── Validación de la propia configuración (PUT) ─────────────────────────

    /// <summary>
    /// Cada chequeo produce un mensaje específico y se evalúa en orden — se
    /// retorna en el primer incumplimiento, mismo criterio ya usado en el resto
    /// del proyecto (ej. AdministrativeScopeService) en vez de acumular una lista.
    /// La última regla ("configuraciones que hagan imposible producir un nombre
    /// válido") se resuelve matemáticamente exigiendo al menos un carácter
    /// alfanumérico en AllowedChars: si existe al menos uno y 1 ≤ MinLength ≤
    /// MaxLength ≤ 20, siempre es posible construir un nombre válido repitiendo
    /// ese carácter (nunca produce extremos ni consecutivos especiales) — por lo
    /// tanto no hace falta un chequeo combinatorio adicional, ya queda cubierto
    /// por la regla de "al menos un alfanumérico" más las de longitud.
    /// </summary>
    private static string? ValidateConfig(UpdateAccountNamingPolicyDto dto)
    {
        var chars = dto.AllowedChars ?? string.Empty;

        if (chars.Length == 0)
            return "AllowedChars no puede estar vacío.";

        if (chars.Any(char.IsUpper))
            return "AllowedChars no puede contener mayúsculas.";

        if (chars.Any(char.IsWhiteSpace))
            return "AllowedChars no puede contener espacios.";

        if (chars.Any(char.IsControl))
            return "AllowedChars no puede contener caracteres de control.";

        var safeSet = new HashSet<char>(SafeCharacterSuperset);
        if (chars.Any(c => !safeSet.Contains(c)))
            return "AllowedChars solo puede contener caracteres del conjunto seguro: " +
                   "letras minúsculas (a-z), números (0-9), y los caracteres - . _";

        if (chars.Distinct().Count() != chars.Length)
            return "AllowedChars no puede contener caracteres duplicados.";

        if (!chars.Any(IsAlphanumeric))
            return "AllowedChars debe contener al menos un carácter alfanumérico.";

        if (dto.MinLength < 1)
            return "MinLength debe ser al menos 1.";

        if (dto.MaxLength < dto.MinLength)
            return "MaxLength no puede ser menor que MinLength.";

        if (dto.MaxLength > AdSamAccountNameHardLimit)
            return $"MaxLength no puede ser mayor que {AdSamAccountNameHardLimit} " +
                   "(límite real de sAMAccountName en Active Directory).";

        return null;
    }

    private static bool IsAlphanumeric(char c) => (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9');

    private static string BuildCharsMessage(AccountNamingPolicy policy)
    {
        var specials = string.Concat(policy.AllowedChars.Where(c => !IsAlphanumeric(c)));
        return specials.Length > 0
            ? $"Solo se permiten letras minúsculas, números, y estos caracteres: {string.Join(' ', specials.ToCharArray())}"
            : "Solo se permiten letras minúsculas y números.";
    }

    private static string Describe(AccountNamingPolicy p) =>
        $"AllowedChars={p.AllowedChars}, MinLength={p.MinLength}, MaxLength={p.MaxLength}, " +
        $"DisallowLeadingTrailingSpecialChars={p.DisallowLeadingTrailingSpecialChars}, " +
        $"DisallowConsecutiveSpecialChars={p.DisallowConsecutiveSpecialChars}";

    private static AccountNamingPolicyDto ToDto(AccountNamingPolicy p) => new(
        p.AllowedChars, p.MinLength, p.MaxLength,
        p.DisallowLeadingTrailingSpecialChars, p.DisallowConsecutiveSpecialChars,
        p.UpdatedAt, p.UpdatedBy);
}
