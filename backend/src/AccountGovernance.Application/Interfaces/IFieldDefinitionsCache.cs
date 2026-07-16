using AccountGovernance.Domain.Entities;

namespace AccountGovernance.Application.Interfaces;

/// <summary>
/// Short-TTL cache of the active gov.FieldDefinitions rows. Wraps
/// IPermissionRepository.GetFieldDefinitionsAsync so callers that only need
/// "which attributes are active right now" (e.g. AdGateway building its LDAP
/// attribute list) don't hit SQL on every request. Caches full entities, not
/// just AdAttributeName, so the same cache can serve future consumers that
/// need other FieldDefinition properties.
/// </summary>
public interface IFieldDefinitionsCache
{
    Task<IReadOnlyList<FieldDefinition>> GetActiveAsync(CancellationToken ct = default);

    /// <summary>Called by PermissionService after Create/Update/SetStatus so the next
    /// read reflects the change immediately instead of waiting for the TTL.</summary>
    void Invalidate();
}
