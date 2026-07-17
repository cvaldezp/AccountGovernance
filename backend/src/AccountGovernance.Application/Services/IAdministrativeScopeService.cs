using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;

namespace AccountGovernance.Application.Services;

public interface IAdministrativeScopeService
{
    Task<Result<IReadOnlyList<AdministrativeScopeDto>>> GetAllAsync(CancellationToken ct = default);

    Task<Result<AdministrativeScopeDto>> GetByKeyAsync(string scopeKey, CancellationToken ct = default);

    Task<Result<AdministrativeScopeDto>> CreateAsync(
        CreateAdministrativeScopeDto dto, string createdBy, CancellationToken ct = default);

    Task<Result<AdministrativeScopeDto>> UpdateAsync(
        string scopeKey, UpdateAdministrativeScopeDto dto, string updatedBy, CancellationToken ct = default);

    Task<Result<AdministrativeScopeDto>> SetStatusAsync(
        string scopeKey, UpdateAdministrativeScopeStatusDto dto, string updatedBy, CancellationToken ct = default);

    Task<Result<AdministrativeScopeFilterDto>> CreateFilterAsync(
        string scopeKey, CreateAdministrativeScopeFilterDto dto, string updatedBy, CancellationToken ct = default);

    Task<Result<AdministrativeScopeFilterDto>> UpdateFilterAsync(
        string scopeKey, int filterId, UpdateAdministrativeScopeFilterDto dto, string updatedBy, CancellationToken ct = default);

    Task<Result<bool>> DeleteFilterAsync(
        string scopeKey, int filterId, string performedBy, CancellationToken ct = default);
}
