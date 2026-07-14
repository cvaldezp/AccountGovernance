using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Entities;
using AccountGovernance.Domain.Enums;

namespace AccountGovernance.Application.Services;

public sealed class DistributionListService(
    IAdGateway                  adGateway,
    IAuditRepository            auditRepository,
    ISystemAuthorizationService systemAuth
) : IDistributionListService
{
    private const string AdDomain      = "usfq.edu.ec";
    private const int    MinQueryLength = 2;

    public async Task<Result<IReadOnlyList<DistributionListSummaryDto>>> SearchAsync(
        string query, CancellationToken ct = default)
    {
        var q = query?.Trim() ?? string.Empty;
        if (q.Length < MinQueryLength)
            return Result<IReadOnlyList<DistributionListSummaryDto>>.Fail(
                $"Ingresa al menos {MinQueryLength} caracteres para buscar.", "QUERY_TOO_SHORT");

        var lists = await adGateway.SearchDistributionListsAsync(q, ct: ct);
        var dtos  = lists.Select(l => new DistributionListSummaryDto(l.Name, l.Mail, l.Dn)).ToList();
        return Result<IReadOnlyList<DistributionListSummaryDto>>.Ok(dtos);
    }

    public async Task<Result<DistributionListDetailDto>> GetDetailAsync(
        string dn, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dn))
            return Result<DistributionListDetailDto>.Fail(
                "Debes especificar la lista de distribución.", "INVALID_DN");

        var list = await adGateway.GetDistributionListAsync(dn, ct);
        if (list is null)
            return Result<DistributionListDetailDto>.Fail(
                "Lista de distribución no encontrada en Active Directory.", "NOT_FOUND");

        return Result<DistributionListDetailDto>.Ok(new DistributionListDetailDto(
            list.Name, list.Mail, list.Description, list.ManagerDisplayName, list.MemberCount, list.Dn));
    }

    public async Task<Result<IReadOnlyList<DistributionListMemberDto>>> GetMembersAsync(
        string dn, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dn))
            return Result<IReadOnlyList<DistributionListMemberDto>>.Fail(
                "Debes especificar la lista de distribución.", "INVALID_DN");

        var members = await adGateway.GetDistributionListMembersAsync(dn, ct);
        var dtos    = members
            .Select(m => new DistributionListMemberDto(m.DisplayName, m.Mail, m.SamAccountName, m.Dn))
            .ToList();
        return Result<IReadOnlyList<DistributionListMemberDto>>.Ok(dtos);
    }

    public async Task<Result<DistributionListMemberDto>> AddMemberAsync(
        string listDn, string memberAccount, string operatorUpn, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(listDn) || string.IsNullOrWhiteSpace(memberAccount))
            return Result<DistributionListMemberDto>.Fail(
                "Debes especificar la lista y la cuenta a agregar.", "INVALID_INPUT");

        var user = await ResolveUserAsync(memberAccount, ct);
        if (user is null)
            return Result<DistributionListMemberDto>.Fail(
                $"No se encontró en Active Directory ningún usuario con la cuenta '{memberAccount}'.",
                "USER_NOT_FOUND");

        if (string.IsNullOrEmpty(user.DistinguishedName))
            return Result<DistributionListMemberDto>.Fail(
                "El usuario encontrado no tiene un DN válido en Active Directory.", "INVALID_USER_DN");

        var operatorRole = await ResolveOperatorRoleAsync(operatorUpn, ct);
        var added        = await adGateway.AddMemberToDistributionListAsync(listDn, user.DistinguishedName, ct);

        await LogAsync(
            operatorUpn, operatorRole, AuditActionType.DistributionListMemberAdded,
            listDn, user.SamAccountName, added,
            added ? null : "AddMemberToDistributionListAsync devolvió false.", ct);

        if (!added)
            return Result<DistributionListMemberDto>.Fail(
                "No se pudo agregar el miembro a la lista de distribución en Active Directory.",
                "AD_OPERATION_FAILED");

        return Result<DistributionListMemberDto>.Ok(new DistributionListMemberDto(
            user.DisplayName, user.Email, user.SamAccountName, user.DistinguishedName));
    }

    public async Task<Result<bool>> RemoveMemberAsync(
        string listDn, string memberDn, string operatorUpn, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(listDn) || string.IsNullOrWhiteSpace(memberDn))
            return Result<bool>.Fail("Debes especificar la lista y el miembro a eliminar.", "INVALID_INPUT");

        var operatorRole = await ResolveOperatorRoleAsync(operatorUpn, ct);
        var removed       = await adGateway.RemoveMemberFromDistributionListAsync(listDn, memberDn, ct);

        await LogAsync(
            operatorUpn, operatorRole, AuditActionType.DistributionListMemberRemoved,
            listDn, memberDn, removed,
            removed ? null : "RemoveMemberFromDistributionListAsync devolvió false.", ct);

        return removed
            ? Result<bool>.Ok(true)
            : Result<bool>.Fail(
                "No se pudo eliminar el miembro de la lista de distribución en Active Directory.",
                "AD_OPERATION_FAILED");
    }

    // ── Internal helpers ─────────────────────────────────────────────────────────

    /// <summary>Resolves a sAMAccountName, UPN, or mail address against AD — never creates a user.</summary>
    private async Task<User?> ResolveUserAsync(string account, CancellationToken ct)
    {
        var bySam = await adGateway.GetUserByAccountAsync(account, ct);
        return bySam ?? await adGateway.GetUserByUpnOrMailAsync(account, ct);
    }

    /// <summary>
    /// Resolves the operator's primary role through the same authorization path
    /// AuthController uses — no independent role logic. Throws if the caller's role
    /// can no longer be resolved, so a membership change is never logged under a guessed role.
    /// </summary>
    private async Task<RoleName> ResolveOperatorRoleAsync(string operatorUpn, CancellationToken ct)
    {
        var roles       = await systemAuth.GetUserRolesAsync(operatorUpn, ct);
        var primaryRole = await systemAuth.ResolvePrimaryRoleAsync(roles, ct);

        if (primaryRole is null || !Enum.TryParse<RoleName>(primaryRole, out var roleName))
            throw new InvalidOperationException(
                $"No se pudo resolver un rol válido para el operador '{operatorUpn}' — operación bloqueada.");

        return roleName;
    }

    private Task LogAsync(
        string operatorUpn, RoleName roleName, AuditActionType actionType, string listDn,
        string targetDetail, bool success, string? notes, CancellationToken ct)
    {
        return auditRepository.AddEntryAsync(new AuditEntry
        {
            Id          = Guid.NewGuid().ToString(),
            Timestamp   = DateTime.UtcNow,
            PerformedBy = operatorUpn,
            RoleName    = roleName,
            ActionType  = actionType,
            FieldKey    = "DistributionListMember",
            OldValue    = actionType == AuditActionType.DistributionListMemberRemoved ? targetDetail : null,
            NewValue    = actionType == AuditActionType.DistributionListMemberAdded   ? targetDetail : null,
            TargetUser  = listDn,
            Domain      = AdDomain,
            Success     = success,
            Notes       = notes,
        }, ct);
    }
}
