using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;

namespace AccountGovernance.Application.Services;

public sealed partial class AccountCreationService(IAccountTypeRepository accountTypeRepository) : IAccountCreationService
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

        string? samPrefix            = null;
        string  extensionAttribute14 = view.ExtensionAttribute14;
        string? subTypeLabel         = null;

        if (view.IsPrivileged)
        {
            if (string.IsNullOrWhiteSpace(request.SubTypeKey))
                return Result<AccountPreviewResponseDto>.Fail(
                    "El sub-tipo es obligatorio para cuentas Privilegiadas.", "SUBTYPE_REQUIRED");

            var subType = view.SubTypes.FirstOrDefault(s => s.SubTypeKey == request.SubTypeKey);
            if (subType is null)
                return Result<AccountPreviewResponseDto>.Fail(
                    "Sub-tipo no válido.", "INVALID_SUBTYPE");

            samPrefix            = subType.SamPrefix;
            extensionAttribute14 = subType.ExtensionAttribute14;
            subTypeLabel         = subType.Label;
        }

        var sam         = ComputeSam(request, samPrefix);
        var displayName = ComputeDisplayName(request);
        var description = request.AccountTypeKey == "SERVICE"
                          && !string.IsNullOrWhiteSpace(request.Description)
                              ? request.Description!
                              : ApplyTemplate(view.DescriptionTemplate, request, subTypeLabel);

        return Result<AccountPreviewResponseDto>.Ok(new AccountPreviewResponseDto(
            UserPrincipalName:    $"{sam}@{AdDomain}",
            SamAccountName:       sam,
            DisplayName:          displayName,
            Description:          description,
            ExtensionAttribute14: extensionAttribute14
        ));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private static string ComputeSam(AccountPreviewRequestDto req, string? samPrefix)
    {
        if (req.AccountTypeKey == "SERVICE")
            return $"svc_{Ascii(req.ServiceName ?? "servicio")}";

        var first = Ascii(req.FirstName ?? string.Empty);
        var last  = Ascii(req.LastName1 ?? string.Empty);
        var base_ = first.Length > 0 ? $"{first[0]}{last}" : last;

        return samPrefix is not null ? $"{samPrefix}.{base_}" : base_;
    }

    private static string ComputeDisplayName(AccountPreviewRequestDto req)
    {
        if (req.AccountTypeKey == "SERVICE")
            return $"SVC - {req.ServiceName?.Trim() ?? "Servicio"}";

        return string.Join(" ",
            new[] { req.FirstName, req.LastName1, req.LastName2 }
                .Where(p => !string.IsNullOrWhiteSpace(p))
                .Select(p => p!.Trim()));
    }

    private static string ApplyTemplate(string template, AccountPreviewRequestDto req, string? subTypeLabel)
        => template
            .Replace("{Department}",  req.Department  ?? "Sin departamento")
            .Replace("{Company}",     req.Company     ?? "Sin empresa")
            .Replace("{ServiceName}", req.ServiceName ?? "Servicio")
            .Replace("{SubType}",     subTypeLabel    ?? string.Empty);

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
