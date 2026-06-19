using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Entities;

namespace AccountGovernance.Application.Services;

public sealed partial class AccountCreationService(
    IAccountTypeRepository          accountTypeRepository,
    IAdGateway                      adGateway,
    IAccountCreationAuditRepository auditRepository
) : IAccountCreationService
{
    private const string AdDomain = "usfq.edu.ec";

    public async Task<Result<IReadOnlyList<AccountTypeDto>>> GetAccountTypesAsync(CancellationToken ct)
    {
        var views = await accountTypeRepository.GetAllAsync(activeOnly: true, ct);
        var dtos = views.Select(v => new AccountTypeDto(
            v.TypeKey,
            v.Label,
            v.Description,
            v.Badge,
            v.ExtensionAttribute14,
            v.IsPrivileged,
            v.DefaultPasswordLength,
            v.DefaultCompany,
            v.DescriptionTemplate,
            v.SubTypes.Select(s => new AccountSubTypeDto(
                s.SubTypeKey, s.Label, s.SamPrefix, s.ExtensionAttribute14, s.TargetOU, s.IsActive
            )).ToList()
        )).ToList();
        return Result<IReadOnlyList<AccountTypeDto>>.Ok(dtos);
    }

    public Task<Result<ValidateRecoveryEmailResponseDto>> ValidateRecoveryEmailAsync(
        ValidateRecoveryEmailRequestDto request, CancellationToken ct)
    {
        var email = (request.Email ?? string.Empty).Trim().ToLowerInvariant();

        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
            return Done(new ValidateRecoveryEmailResponseDto(false, "El correo no tiene un formato válido.", null));

        if (email.EndsWith($"@{AdDomain}", StringComparison.Ordinal))
        {
            var local       = email.Split('@')[0];
            var displayName = string.Join(" ",
                local.Split('.').Select(p => p.Length > 0 ? char.ToUpper(p[0]) + p[1..] : p));

            return Done(new ValidateRecoveryEmailResponseDto(
                true, $"Usuario encontrado en AD: {displayName}", displayName));
        }

        return Done(new ValidateRecoveryEmailResponseDto(
            false, "No se encontró un usuario en AD con ese correo de recuperación.", null));
    }

    public async Task<Result<AccountPreviewResponseDto>> PreviewAccountAsync(
        AccountPreviewRequestDto request, CancellationToken ct)
    {
        var view = await accountTypeRepository.GetByKeyAsync(request.AccountTypeKey, ct);
        if (view is null)
            return Result<AccountPreviewResponseDto>.Fail(
                "Tipo de cuenta no válido.", "INVALID_ACCOUNT_TYPE");

        string? samPrefix = null;

        if (view.IsPrivileged)
        {
            if (string.IsNullOrWhiteSpace(request.SubTypeKey))
                return Result<AccountPreviewResponseDto>.Fail(
                    "El sub-tipo es obligatorio para cuentas Privilegiadas.", "SUBTYPE_REQUIRED");

            var subType = view.SubTypes.FirstOrDefault(s => s.SubTypeKey == request.SubTypeKey);
            if (subType is null)
                return Result<AccountPreviewResponseDto>.Fail(
                    "Sub-tipo no válido.", "INVALID_SUBTYPE");

            samPrefix = subType.SamPrefix;
        }

        var sam         = ComputeSam(request, samPrefix);
        var displayName = ComputeDisplayName(request);
        var company     = view.DefaultCompany ?? "USFQ";
        var description = view.DescriptionTemplate;
        var extensionAttribute14 = view.ExtensionAttribute14;

        return Result<AccountPreviewResponseDto>.Ok(new AccountPreviewResponseDto(
            UserPrincipalName:    $"{sam}@{AdDomain}",
            SamAccountName:       sam,
            DisplayName:          displayName,
            Company:              company,
            Description:          description,
            ExtensionAttribute14: extensionAttribute14
        ));
    }

    // ── Validate-create (Phase 1 — dry run) ──────────────────────────────────────

    public async Task<Result<ValidateCreateAccountResponseDto>> ValidateCreateAsync(
        AccountCreationRequestDto request, CancellationToken ct)
    {
        var errors   = new List<string>();
        var warnings = new List<string>();

        // Resolve type
        var view = await accountTypeRepository.GetByKeyAsync(request.AccountTypeKey, ct);
        if (view is null)
        {
            errors.Add("Tipo de cuenta no válido.");
            return Result<ValidateCreateAccountResponseDto>.Ok(
                new(false, errors, warnings, null));
        }

        // Resolve sub-type for PRIVILEGED
        string? samPrefix = null;
        string? targetOU  = view.TargetOU;

        if (view.IsPrivileged)
        {
            if (string.IsNullOrWhiteSpace(request.SubTypeKey))
            {
                errors.Add("El sub-tipo es obligatorio para cuentas Privilegiadas.");
            }
            else
            {
                var subType = view.SubTypes.FirstOrDefault(s => s.SubTypeKey == request.SubTypeKey);
                if (subType is null)
                    errors.Add("Sub-tipo no válido.");
                else
                {
                    samPrefix = subType.SamPrefix;
                    targetOU  = subType.TargetOU;
                }
            }
        }

        // Required field: Cuenta
        if (string.IsNullOrWhiteSpace(request.AccountName))
            errors.Add("El campo 'Cuenta' es obligatorio.");

        // Compute attributes
        var sam         = ComputeSamFromRequest(request, samPrefix);
        var upn         = sam.Length > 0 ? $"{sam}@{AdDomain}" : string.Empty;
        var displayName = ComputeDisplayNameFromRequest(request);
        var company     = view.DefaultCompany ?? "USFQ";
        var description = view.DescriptionTemplate;
        var ea14        = view.ExtensionAttribute14;

        var preview = new AccountPreviewResponseDto(upn, sam, displayName, company, description, ea14);

        // Password length
        if (string.IsNullOrEmpty(request.Password))
            errors.Add("La contraseña es obligatoria.");
        else if (request.Password.Length < view.DefaultPasswordLength)
            errors.Add($"La contraseña debe tener al menos {view.DefaultPasswordLength} caracteres.");

        // Recovery email presence
        if (string.IsNullOrWhiteSpace(request.RecoveryEmail))
            errors.Add("El correo de recuperación es obligatorio.");

        // Early-exit before AD checks if we already have blocking errors
        if (errors.Count == 0 || errors.All(e => e.StartsWith("La contraseña") || e.StartsWith("El correo")))
            await RunAdValidationsAsync(sam, upn, request.RecoveryEmail, targetOU, errors, warnings, ct);

        var canCreate = errors.Count == 0;
        return Result<ValidateCreateAccountResponseDto>.Ok(
            new(canCreate, errors, warnings, preview));
    }

    // ── Create account (Phase 2 — real AD creation) ────────────────────────────

    public async Task<Result<CreateAccountResponseDto>> CreateAsync(
        AccountCreationRequestDto request, string operatorUpn, CancellationToken ct)
    {
        // Re-validate before creating
        var valResult = await ValidateCreateAsync(request, ct);
        if (!valResult.IsSuccess)
            return Result<CreateAccountResponseDto>.Fail("Error interno de validación.", "VALIDATION_ERROR");

        if (!valResult.Data!.CanCreate)
            return Result<CreateAccountResponseDto>.Fail(
                "Validación fallida. Corrija los errores antes de crear la cuenta.", "VALIDATION_FAILED");

        // Resolve type + sub-type again (same path as validate)
        var view = await accountTypeRepository.GetByKeyAsync(request.AccountTypeKey, ct);
        if (view is null)
            return Result<CreateAccountResponseDto>.Fail("Tipo de cuenta no válido.", "INVALID_ACCOUNT_TYPE");

        string? samPrefix = null;
        string? targetOU  = view.TargetOU;

        if (view.IsPrivileged && !string.IsNullOrWhiteSpace(request.SubTypeKey))
        {
            var subType = view.SubTypes.FirstOrDefault(s => s.SubTypeKey == request.SubTypeKey);
            if (subType is not null)
            {
                samPrefix = subType.SamPrefix;
                targetOU  = subType.TargetOU;
            }
        }

        var sam         = ComputeSamFromRequest(request, samPrefix);
        var upn         = $"{sam}@{AdDomain}";
        var displayName = ComputeDisplayNameFromRequest(request);
        var givenName   = request.FirstName?.Trim();
        var sn          = request.Apellidos?.Trim();
        var company     = view.DefaultCompany ?? "USFQ";
        var description = view.DescriptionTemplate;
        var ea14        = view.ExtensionAttribute14;

        if (string.IsNullOrWhiteSpace(targetOU))
            return Result<CreateAccountResponseDto>.Fail(
                "No hay OU destino configurada para este tipo de cuenta.", "NO_TARGET_OU");

        var userDn    = $"CN={EscapeDn(displayName)},{targetOU}";
        var adRequest = new AdCreateUserRequest(
            UserDn:               userDn,
            SamAccountName:       sam,
            UserPrincipalName:    upn,
            DisplayName:          displayName,
            GivenName:            givenName,
            Sn:                   sn,
            Company:              company,
            Description:          description,
            ExtensionAttribute14: ea14,
            RecoveryEmail:        request.RecoveryEmail,
            Password:             request.Password ?? string.Empty
        );

        AdCreateUserResult adResult;
        try
        {
            adResult = await adGateway.CreateUserAsync(adRequest, ct);
        }
        catch (Exception ex)
        {
            adResult = new AdCreateUserResult(false, $"Error inesperado en Active Directory: {ex.Message}", null);
        }

        // Audit log (no password)
        var auditEntry = new AccountCreationAuditEntry(
            Operator:       operatorUpn,
            AccountTypeKey: request.AccountTypeKey,
            SubTypeKey:     request.SubTypeKey,
            AccountName:    request.AccountName ?? string.Empty,
            SamAccountName: sam,
            Upn:            upn,
            DisplayName:    displayName,
            Company:        company,
            Description:    description,
            ExtAttr14:      ea14,
            TargetOU:       targetOU,
            RecoveryEmail:  request.RecoveryEmail,
            Success:        adResult.Success,
            ErrorMessage:   adResult.Success ? null : adResult.Message
        );

        try
        {
            await auditRepository.LogAsync(auditEntry, ct);
        }
        catch
        {
            // Audit failure is non-blocking; the AD gateway logs AD-level errors
        }

        return adResult.Success
            ? Result<CreateAccountResponseDto>.Ok(
                new CreateAccountResponseDto(true, adResult.Message, sam, upn, displayName))
            : Result<CreateAccountResponseDto>.Fail(adResult.Message, "AD_ERROR");
    }

    // ── AD validation helpers ─────────────────────────────────────────────────

    private async Task RunAdValidationsAsync(
        string    sam,
        string    upn,
        string?   recoveryEmail,
        string?   targetOU,
        List<string> errors,
        List<string> warnings,
        CancellationToken ct)
    {
        if (!string.IsNullOrEmpty(sam))
            await TryAdCheckAsync(
                () => adGateway.SamAccountNameExistsAsync(sam, ct),
                exists  => errors.Add($"El sAMAccountName '{sam}' ya existe en Active Directory."),
                warning => warnings.Add("No se pudo verificar si el sAMAccountName ya existe en AD (servicio no disponible)."),
                ct);

        if (!string.IsNullOrEmpty(upn))
            await TryAdCheckAsync(
                () => adGateway.UserPrincipalNameExistsAsync(upn, ct),
                exists  => errors.Add($"El UPN '{upn}' ya existe en Active Directory."),
                warning => warnings.Add("No se pudo verificar si el UPN ya existe en AD (servicio no disponible)."),
                ct);

        if (!string.IsNullOrWhiteSpace(recoveryEmail))
            await TryAdCheckAsync(
                async () => !await adGateway.UserExistsAndIsEnabledAsync(recoveryEmail, ct),
                notFound => errors.Add($"El correo de recuperación '{recoveryEmail}' no corresponde a un usuario habilitado en AD."),
                warning  => warnings.Add("No se pudo verificar el correo de recuperación en AD (servicio no disponible)."),
                ct);

        if (!string.IsNullOrWhiteSpace(targetOU))
            await TryAdCheckAsync(
                async () => !await adGateway.OuExistsAsync(targetOU, ct),
                notFound => errors.Add($"La OU destino no existe en Active Directory."),
                warning  => warnings.Add("No se pudo verificar la OU destino en AD (servicio no disponible)."),
                ct);
        else
            warnings.Add("No hay OU destino configurada para este tipo/sub-tipo.");
    }

    private static async Task TryAdCheckAsync(
        Func<Task<bool>>    check,
        Action<bool>        onTrue,
        Action<Exception>   onError,
        CancellationToken   _)
    {
        try
        {
            if (await check()) onTrue(true);
        }
        catch (Exception ex)
        {
            onError(ex);
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private static string ComputeSamFromRequest(AccountCreationRequestDto req, string? samPrefix)
    {
        var cuenta = Ascii(req.AccountName ?? string.Empty);
        return samPrefix is not null ? $"{samPrefix}{cuenta}" : cuenta;
    }

    private static string ComputeDisplayNameFromRequest(AccountCreationRequestDto req)
        => string.Join(" ",
            new[] { req.FirstName, req.Apellidos }
                .Where(p => !string.IsNullOrWhiteSpace(p))
                .Select(p => p!.Trim()));

    // RFC 4514 — escape special characters in DN values
    private static string EscapeDn(string value) =>
        value.Replace("\\", "\\\\")
             .Replace(",",  "\\,")
             .Replace("+",  "\\+")
             .Replace("\"", "\\\"")
             .Replace("<",  "\\<")
             .Replace(">",  "\\>")
             .Replace(";",  "\\;")
             .Replace("#",  "\\#");

    private static string ComputeSam(AccountPreviewRequestDto req, string? samPrefix)
    {
        var cuenta = Ascii(req.AccountName ?? string.Empty);
        return samPrefix is not null ? $"{samPrefix}{cuenta}" : cuenta;
    }

    private static string ComputeDisplayName(AccountPreviewRequestDto req)
        => string.Join(" ",
            new[] { req.FirstName, req.Apellidos }
                .Where(p => !string.IsNullOrWhiteSpace(p))
                .Select(p => p!.Trim()));

    [GeneratedRegex(@"[^a-z0-9]")]
    private static partial Regex NonAlphanumericRegex();

    private static string Ascii(string input)
    {
        var sb = new StringBuilder();
        foreach (var c in input.Normalize(NormalizationForm.FormD))
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        return NonAlphanumericRegex().Replace(sb.ToString().ToLowerInvariant(), string.Empty);
    }

    private static Task<Result<ValidateRecoveryEmailResponseDto>> Done(ValidateRecoveryEmailResponseDto dto) =>
        Task.FromResult(Result<ValidateRecoveryEmailResponseDto>.Ok(dto));
}
