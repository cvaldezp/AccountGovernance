using AccountGovernance.Domain.Entities;

namespace AccountGovernance.Application.Interfaces;

public interface IAccountTypeGroupRepository
{
    /// <summary>
    /// Returns groups for a type. When subTypeKey is null: only type-level groups (AccountSubTypeId IS NULL).
    /// When subTypeKey is provided: only that subtype's groups.
    /// </summary>
    Task<IReadOnlyList<AccountTypeInitialGroup>> GetByTypeKeyAsync(
        string typeKey, string? subTypeKey, bool activeOnly, CancellationToken ct);

    /// <summary>Returns all active groups to apply when creating an account — type-level plus subtype-specific.</summary>
    Task<IReadOnlyList<AccountTypeInitialGroup>> GetForCreationAsync(
        int accountTypeId, int? accountSubTypeId, CancellationToken ct);

    Task<AccountTypeInitialGroup?> GetByIdAsync(int id, CancellationToken ct);

    Task<int> CreateAsync(
        string  typeKey,
        string? subTypeKey,
        string  groupName,
        string  groupDn,
        string? groupObjectGuid,
        string? groupSid,
        bool    isCritical,
        bool    continueOnFailure,
        bool    isActive,
        int     sortOrder,
        string  updatedBy,
        CancellationToken ct);

    Task UpdateAsync(
        int     id,
        string  groupName,
        string  groupDn,
        string? groupObjectGuid,
        string? groupSid,
        bool    isCritical,
        bool    continueOnFailure,
        bool    isActive,
        int     sortOrder,
        string  updatedBy,
        CancellationToken ct);

    Task       DeleteAsync(int id, CancellationToken ct);
    Task<bool> ExistsAsync(int id, CancellationToken ct);
}
