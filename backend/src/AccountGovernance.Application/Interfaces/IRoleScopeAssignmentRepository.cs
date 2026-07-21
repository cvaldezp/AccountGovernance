using AccountGovernance.Domain.Entities;

namespace AccountGovernance.Application.Interfaces;

/// <summary>Persistencia para gov.RoleScopeAssignments.</summary>
public interface IRoleScopeAssignmentRepository
{
    Task<IReadOnlyList<RoleScopeAssignment>> GetAllAsync(
        string? roleKey, string? scopeKey, CancellationToken ct = default);

    Task<RoleScopeAssignment?> GetByIdAsync(int id, CancellationToken ct = default);

    /// <summary>Busca la única fila posible para este par, activa o inactiva — la relación
    /// es única en toda su vida (UQ_Gov_RoleScopeAssignments_Pair sin filtro).</summary>
    Task<RoleScopeAssignment?> GetByRoleAndScopeAsync(
        int systemRoleId, int administrativeScopeId, CancellationToken ct = default);

    Task<int> CreateAsync(RoleScopeAssignment assignment, CancellationToken ct = default);

    Task SetStatusAsync(int id, bool isActive, string updatedBy, CancellationToken ct = default);
}
