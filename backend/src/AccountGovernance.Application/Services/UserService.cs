using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;

namespace AccountGovernance.Application.Services;

public sealed class UserService(IAdGateway adGateway) : IUserService
{
    public async Task<Result<IReadOnlyList<UserSearchResultDto>>> SearchAsync(
        string query, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(query) || query.Trim().Length < 3)
            return Result<IReadOnlyList<UserSearchResultDto>>.Fail(
                "Ingresa al menos 3 caracteres para buscar.", "QUERY_TOO_SHORT");

        var search = await adGateway.SearchUsersAsync(query.Trim(), ct: ct);

        if (search.TooManyResults)
            return Result<IReadOnlyList<UserSearchResultDto>>.Fail(
                "La búsqueda devuelve demasiados resultados. " +
                "Ingresa un identificador más específico: Código Banner, correo completo o usuario AD exacto.",
                "TOO_MANY_RESULTS");

        var dtos = search.Users
            .Select(u => new UserSearchResultDto(
                u.SamAccountName,
                u.DisplayName,
                u.Email,
                u.Department,
                u.IsEnabled,
                u.CustomBannerID))
            .ToList();

        return Result<IReadOnlyList<UserSearchResultDto>>.Ok(dtos);
    }

    public async Task<Result<UserDetailDto>> GetByAccountAsync(
        string samAccountName, CancellationToken ct = default)
    {
        var user = await adGateway.GetUserByAccountAsync(samAccountName, ct);
        if (user is null)
            return Result<UserDetailDto>.Fail(
                $"Usuario '{samAccountName}' no encontrado.", "USER_NOT_FOUND");

        return Result<UserDetailDto>.Ok(new UserDetailDto(
            SamAccountName:            user.SamAccountName,
            CustomBannerID:            user.CustomBannerID,
            DisplayName:               user.DisplayName,
            GivenName:                 user.GivenName,
            Sn:                        user.Surname,
            Mail:                      user.Email,
            UserPrincipalName:         user.UserPrincipalName,
            Company:                   user.Company,
            Department:                user.Department,
            Title:                     user.JobTitle,
            Manager:                   user.Manager,
            PhysicalDeliveryOfficeName: user.Office,
            TelephoneNumber:           user.TelephoneNumber,
            Mobile:                    user.Mobile,
            ExternalEmail:             user.ExternalEmail,
            ExtensionAttribute1:       user.ExtensionAttribute1,
            ExtensionAttribute2:       user.ExtensionAttribute2,
            ExtensionAttribute3:       user.ExtensionAttribute3,
            UserAccountControl:        user.UserAccountControl,
            IsEnabled:                 user.IsEnabled,
            WhenCreated:               user.WhenCreated,
            WhenChanged:               user.WhenChanged,
            LastLogon:                 user.LastLogon,
            DistinguishedName:         user.DistinguishedName));
    }
}
