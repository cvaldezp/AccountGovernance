using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;

namespace AccountGovernance.Application.Services;

/// <summary>Administración de Accesos por Rol (pantalla Configuración → Accesos por Rol).</summary>
public interface IRoleResourceAdminService
{
    Task<Result<RoleAccessMatrixDto>> GetMatrixAsync(CancellationToken ct = default);

    Task<Result<RoleAccessCellDto>> SetAccessAsync(
        string roleKey, string resourceKey, SetRoleAccessDto dto, string performedBy, CancellationToken ct = default);
}
