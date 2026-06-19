using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Entities;

namespace AccountGovernance.Application.Services;

public sealed class AccountTypeAdminService(IAccountTypeRepository repo) : IAccountTypeAdminService
{
    public async Task<Result<IReadOnlyList<AccountTypeConfigDto>>> GetAllAsync(bool activeOnly, CancellationToken ct)
    {
        var views = await repo.GetAllAsync(activeOnly, ct);
        return Result<IReadOnlyList<AccountTypeConfigDto>>.Ok(views.Select(ToDto).ToList());
    }

    public async Task<Result<AccountTypeConfigDto>> GetByKeyAsync(string typeKey, CancellationToken ct)
    {
        var view = await repo.GetByKeyAsync(typeKey, ct);
        return view is null
            ? Result<AccountTypeConfigDto>.Fail("Tipo de cuenta no encontrado.", "NOT_FOUND")
            : Result<AccountTypeConfigDto>.Ok(ToDto(view));
    }

    public async Task<Result<AccountTypeConfigDto>> UpdateConfigAsync(
        string typeKey, UpdateAccountTypeConfigDto dto, string? updatedBy, CancellationToken ct)
    {
        var existing = await repo.GetByKeyAsync(typeKey, ct);
        if (existing is null)
            return Result<AccountTypeConfigDto>.Fail("Tipo de cuenta no encontrado.", "NOT_FOUND");

        await repo.UpdateConfigAsync(typeKey, dto, updatedBy, ct);

        var updated = await repo.GetByKeyAsync(typeKey, ct);
        return Result<AccountTypeConfigDto>.Ok(ToDto(updated!));
    }

    public async Task<Result<AccountSubTypeDto>> UpdateSubTypeAsync(
        string subTypeKey, UpdateAccountSubTypeDto dto, CancellationToken ct)
    {
        await repo.UpdateSubTypeAsync(subTypeKey, dto, ct);

        var views = await repo.GetAllAsync(activeOnly: false, ct);
        var subType = views
            .SelectMany(v => v.SubTypes)
            .FirstOrDefault(s => s.SubTypeKey == subTypeKey);

        return subType is null
            ? Result<AccountSubTypeDto>.Fail("Sub-tipo no encontrado.", "NOT_FOUND")
            : Result<AccountSubTypeDto>.Ok(ToSubTypeDto(subType));
    }

    private static AccountTypeConfigDto ToDto(AccountTypeView v) => new(
        v.Id,
        v.TypeKey,
        v.Label,
        v.Description,
        v.Badge,
        v.IsPrivileged,
        v.IsActive,
        v.SortOrder,
        v.SamPrefix,
        v.ExtensionAttribute14,
        v.TargetOU,
        v.DefaultPasswordLength,
        v.DescriptionTemplate,
        v.DefaultCompany,
        v.ConfigUpdatedAt,
        v.ConfigUpdatedBy,
        v.SubTypes.Select(ToSubTypeDto).ToList()
    );

    private static AccountSubTypeDto ToSubTypeDto(AccountSubTypeInfo s) =>
        new(s.SubTypeKey, s.Label, s.SamPrefix, s.ExtensionAttribute14, s.TargetOU, s.IsActive);
}
