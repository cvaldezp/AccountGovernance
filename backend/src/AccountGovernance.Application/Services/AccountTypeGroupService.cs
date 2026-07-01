using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Entities;

namespace AccountGovernance.Application.Services;

public sealed class AccountTypeGroupService(
    IAccountTypeGroupRepository groupRepository,
    IAdGateway                  adGateway
) : IAccountTypeGroupService
{
    public async Task<Result<IReadOnlyList<AccountTypeGroupDto>>> GetGroupsAsync(
        string typeKey, string? subTypeKey, bool activeOnly, CancellationToken ct)
    {
        var groups = await groupRepository.GetByTypeKeyAsync(typeKey, subTypeKey, activeOnly, ct);
        return Result<IReadOnlyList<AccountTypeGroupDto>>.Ok(groups.Select(ToDto).ToList());
    }

    public async Task<Result<AccountTypeGroupDto>> CreateGroupAsync(
        string typeKey, CreateAccountTypeGroupDto dto, string updatedBy, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.GroupName))
            return Result<AccountTypeGroupDto>.Fail("El nombre del grupo es obligatorio.", "VALIDATION");
        if (string.IsNullOrWhiteSpace(dto.GroupDn))
            return Result<AccountTypeGroupDto>.Fail("El DN del grupo es obligatorio.", "VALIDATION");

        try
        {
            var id = await groupRepository.CreateAsync(
                typeKey, dto.SubTypeKey,
                dto.GroupName.Trim(), dto.GroupDn.Trim(),
                dto.GroupObjectGuid?.Trim(), dto.GroupSid?.Trim(),
                dto.IsCritical, dto.ContinueOnFailure, dto.IsActive, dto.SortOrder,
                updatedBy, ct);

            var created = await groupRepository.GetByIdAsync(id, ct);
            return created is not null
                ? Result<AccountTypeGroupDto>.Ok(ToDto(created))
                : Result<AccountTypeGroupDto>.Fail("Error al recuperar el grupo creado.", "DB_ERROR");
        }
        catch (Exception ex)
        {
            return Result<AccountTypeGroupDto>.Fail($"Error al guardar el grupo: {ex.Message}", "DB_ERROR");
        }
    }

    public async Task<Result<AccountTypeGroupDto>> UpdateGroupAsync(
        int id, UpdateAccountTypeGroupDto dto, string updatedBy, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.GroupName))
            return Result<AccountTypeGroupDto>.Fail("El nombre del grupo es obligatorio.", "VALIDATION");
        if (string.IsNullOrWhiteSpace(dto.GroupDn))
            return Result<AccountTypeGroupDto>.Fail("El DN del grupo es obligatorio.", "VALIDATION");

        if (!await groupRepository.ExistsAsync(id, ct))
            return Result<AccountTypeGroupDto>.Fail("Grupo no encontrado.", "NOT_FOUND");

        try
        {
            await groupRepository.UpdateAsync(
                id,
                dto.GroupName.Trim(), dto.GroupDn.Trim(),
                dto.GroupObjectGuid?.Trim(), dto.GroupSid?.Trim(),
                dto.IsCritical, dto.ContinueOnFailure, dto.IsActive, dto.SortOrder,
                updatedBy, ct);

            var refreshed = await groupRepository.GetByIdAsync(id, ct);
            return refreshed is not null
                ? Result<AccountTypeGroupDto>.Ok(ToDto(refreshed))
                : Result<AccountTypeGroupDto>.Fail("Error al recuperar el grupo actualizado.", "DB_ERROR");
        }
        catch (Exception ex)
        {
            return Result<AccountTypeGroupDto>.Fail($"Error al actualizar el grupo: {ex.Message}", "DB_ERROR");
        }
    }

    public async Task<Result<bool>> DeleteGroupAsync(int id, CancellationToken ct)
    {
        if (!await groupRepository.ExistsAsync(id, ct))
            return Result<bool>.Fail("Grupo no encontrado.", "NOT_FOUND");

        await groupRepository.DeleteAsync(id, ct);
        return Result<bool>.Ok(true);
    }

    public async Task<Result<ValidateAdGroupResponseDto>> ValidateAdGroupAsync(
        string query, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(query))
            return Result<ValidateAdGroupResponseDto>.Ok(
                new(false, null, null, null, null, false, "La consulta no puede estar vacía."));

        try
        {
            var result = await adGateway.GetGroupAsync(query.Trim(), ct);

            if (result.Ambiguous)
                return Result<ValidateAdGroupResponseDto>.Ok(
                    new(false, null, null, null, null, false,
                        $"Búsqueda ambigua: se encontraron {result.MatchCount ?? 2} o más grupos con ese nombre. " +
                        "Usa el DN completo para identificar el grupo exacto."));

            return result.Group is null
                ? Result<ValidateAdGroupResponseDto>.Ok(
                    new(false, null, null, null, null, false,
                        $"No se encontró ningún grupo con el nombre o DN '{query}' en Active Directory."))
                : Result<ValidateAdGroupResponseDto>.Ok(
                    new(true, result.Group.Name, result.Group.Dn, result.Group.ObjectGuid,
                        result.Group.Sid, result.Group.IsSecurity, null));
        }
        catch (Exception ex)
        {
            return Result<ValidateAdGroupResponseDto>.Ok(
                new(false, null, null, null, null, false,
                    $"No se pudo consultar Active Directory: {ex.Message}"));
        }
    }

    private static AccountTypeGroupDto ToDto(AccountTypeInitialGroup g) =>
        new(g.Id, g.TypeKey, g.SubTypeKey, g.GroupName, g.GroupDn,
            g.GroupObjectGuid, g.GroupSid, g.IsCritical, g.ContinueOnFailure, g.IsActive, g.SortOrder,
            g.UpdatedAt, g.UpdatedBy);
}
