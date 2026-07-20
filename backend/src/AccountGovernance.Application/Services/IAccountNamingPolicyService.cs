using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;

namespace AccountGovernance.Application.Services;

public interface IAccountNamingPolicyService
{
    Task<Result<AccountNamingPolicyDto>> GetAsync(CancellationToken ct = default);

    Task<Result<AccountNamingPolicyDto>> UpdateAsync(
        UpdateAccountNamingPolicyDto dto, string updatedBy, CancellationToken ct = default);

    /// <summary>
    /// Normaliza (trim + minúsculas culturalmente estables — nunca transliteración
    /// ni eliminación de caracteres) y valida <paramref name="rawAccountName"/> contra
    /// la política vigente, incluyendo la longitud efectiva de sAMAccountName una vez
    /// sumado <paramref name="samPrefix"/> (nunca puede superar 20 caracteres, límite
    /// real de Active Directory, sin importar la configuración). Es la única fuente
    /// de verdad de esta regla en el backend — usada por Preview/Validate/Create.
    /// </summary>
    Task<AccountNameValidationResult> ValidateAccountNameAsync(
        string rawAccountName, string? samPrefix, CancellationToken ct = default);
}
