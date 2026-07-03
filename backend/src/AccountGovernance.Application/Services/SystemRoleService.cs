using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Entities;

namespace AccountGovernance.Application.Services;

public sealed class SystemRoleService(ISystemRoleRepository repo) : ISystemRoleService
{
    public async Task<Result<IReadOnlyList<SystemRoleDto>>> GetAllAsync(CancellationToken ct)
    {
        var roles = await repo.GetAllAsync(ct);
        var dtos  = new List<SystemRoleDto>(roles.Count);
        foreach (var role in roles)
        {
            var groups = await repo.GetGroupsByRoleKeyAsync(role.RoleKey, ct);
            dtos.Add(ToDto(role, groups));
        }
        return Result<IReadOnlyList<SystemRoleDto>>.Ok(dtos);
    }

    public async Task<Result<SystemRoleDto>> GetByKeyAsync(string roleKey, CancellationToken ct)
    {
        var role = await repo.GetByKeyAsync(roleKey, ct);
        if (role is null)
            return Result<SystemRoleDto>.Fail("Rol no encontrado.", "NOT_FOUND");

        var groups = await repo.GetGroupsByRoleKeyAsync(roleKey, ct);
        return Result<SystemRoleDto>.Ok(ToDto(role, groups));
    }

    public async Task<Result<SystemRoleDto>> UpdateAsync(
        string roleKey, UpdateSystemRoleDto dto, string updatedBy, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.DisplayName))
            return Result<SystemRoleDto>.Fail("El nombre visible es obligatorio.", "VALIDATION");
        if (dto.Priority < 1)
            return Result<SystemRoleDto>.Fail("La prioridad debe ser un número positivo.", "VALIDATION");
        if (!await repo.ExistsAsync(roleKey, ct))
            return Result<SystemRoleDto>.Fail("Rol no encontrado.", "NOT_FOUND");

        await repo.UpdateAsync(
            roleKey, dto.DisplayName.Trim(), dto.Description?.Trim(),
            dto.Priority, dto.IsActive, updatedBy, ct);

        return await GetByKeyAsync(roleKey, ct);
    }

    public async Task<Result<SystemRoleGroupDto>> CreateGroupAsync(
        string roleKey, CreateSystemRoleGroupDto dto, string updatedBy, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.GroupName))
            return Result<SystemRoleGroupDto>.Fail("El nombre del grupo es obligatorio.", "VALIDATION");
        if (string.IsNullOrWhiteSpace(dto.GroupDn))
            return Result<SystemRoleGroupDto>.Fail("El DN del grupo es obligatorio.", "VALIDATION");
        if (!await repo.ExistsAsync(roleKey, ct))
            return Result<SystemRoleGroupDto>.Fail("Rol no encontrado.", "NOT_FOUND");

        try
        {
            var id = await repo.CreateGroupAsync(
                roleKey, dto.GroupName.Trim(), dto.GroupDn.Trim(),
                dto.GroupObjectGuid?.Trim(), dto.GroupSid?.Trim(), dto.IsActive,
                updatedBy, ct);

            var created = await repo.GetGroupByIdAsync(id, ct);
            return created is not null
                ? Result<SystemRoleGroupDto>.Ok(ToGroupDto(created))
                : Result<SystemRoleGroupDto>.Fail("Error al recuperar el grupo creado.", "DB_ERROR");
        }
        catch (Exception ex)
        {
            return Result<SystemRoleGroupDto>.Fail($"Error al guardar el grupo: {ex.Message}", "DB_ERROR");
        }
    }

    public async Task<Result<SystemRoleGroupDto>> UpdateGroupAsync(
        string roleKey, int id, UpdateSystemRoleGroupDto dto, string updatedBy, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.GroupName))
            return Result<SystemRoleGroupDto>.Fail("El nombre del grupo es obligatorio.", "VALIDATION");
        if (string.IsNullOrWhiteSpace(dto.GroupDn))
            return Result<SystemRoleGroupDto>.Fail("El DN del grupo es obligatorio.", "VALIDATION");

        var existing = await repo.GetGroupByIdAsync(id, ct);
        if (existing is null)
            return Result<SystemRoleGroupDto>.Fail("Grupo no encontrado.", "NOT_FOUND");
        if (!string.Equals(existing.RoleKey, roleKey, StringComparison.OrdinalIgnoreCase))
            return Result<SystemRoleGroupDto>.Fail(
                "El grupo no pertenece al rol indicado en la ruta.", "VALIDATION");

        try
        {
            await repo.UpdateGroupAsync(
                id, dto.GroupName.Trim(), dto.GroupDn.Trim(),
                dto.GroupObjectGuid?.Trim(), dto.GroupSid?.Trim(), dto.IsActive,
                updatedBy, ct);

            var refreshed = await repo.GetGroupByIdAsync(id, ct);
            return refreshed is not null
                ? Result<SystemRoleGroupDto>.Ok(ToGroupDto(refreshed))
                : Result<SystemRoleGroupDto>.Fail("Error al recuperar el grupo actualizado.", "DB_ERROR");
        }
        catch (Exception ex)
        {
            return Result<SystemRoleGroupDto>.Fail($"Error al actualizar el grupo: {ex.Message}", "DB_ERROR");
        }
    }

    public async Task<Result<bool>> DeleteGroupAsync(string roleKey, int id, CancellationToken ct)
    {
        var existing = await repo.GetGroupByIdAsync(id, ct);
        if (existing is null)
            return Result<bool>.Fail("Grupo no encontrado.", "NOT_FOUND");
        if (!string.Equals(existing.RoleKey, roleKey, StringComparison.OrdinalIgnoreCase))
            return Result<bool>.Fail("El grupo no pertenece al rol indicado en la ruta.", "VALIDATION");

        await repo.DeleteGroupAsync(id, ct);
        return Result<bool>.Ok(true);
    }

    private static SystemRoleDto ToDto(SystemRole r, IReadOnlyList<SystemRoleGroup> groups) =>
        new(r.Id, r.RoleKey, r.DisplayName, r.Description, r.Priority, r.IsActive,
            r.UpdatedAt, r.UpdatedBy, groups.Select(ToGroupDto).ToList());

    private static SystemRoleGroupDto ToGroupDto(SystemRoleGroup g) =>
        new(g.Id, g.SystemRoleId, g.GroupName, g.GroupDn, g.GroupObjectGuid, g.GroupSid,
            g.IsActive, g.UpdatedAt, g.UpdatedBy);
}
