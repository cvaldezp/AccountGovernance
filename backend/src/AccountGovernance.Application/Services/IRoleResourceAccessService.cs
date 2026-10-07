namespace AccountGovernance.Application.Services;

/// <summary>
/// Resuelve a qué módulos/acciones (gov.AppResources) tiene acceso un conjunto
/// de roles ya resuelto (ISystemAuthorizationService.GetUserRolesAsync).
/// Reglas: SystemAdmin tiene todo; el resto recibe la unión de los permisos de
/// todos sus roles; una acción solo cuenta si también tiene su módulo padre;
/// recursos inactivos o no delegables nunca se otorgan por tabla.
/// </summary>
public interface IRoleResourceAccessService
{
    Task<IReadOnlyList<string>> GetAllowedResourcesAsync(
        IReadOnlyList<string> roles, CancellationToken ct = default);

    Task<bool> HasAccessAsync(
        IReadOnlyList<string> roles, string resourceKey, CancellationToken ct = default);
}
