using AccountGovernance.Domain.Entities;

namespace AccountGovernance.Application.Interfaces;

/// <summary>
/// Persistencia de gov.AccountNamingPolicy — fila única (Id=1), garantizada
/// físicamente por la propia tabla (ver schema.sql). Sin caché: se lee directo,
/// mismo patrón que IExpirationConfigRepository — configuración de baja
/// frecuencia de lectura, sin justificación para una capa de caché.
/// </summary>
public interface IAccountNamingPolicyRepository
{
    /// <summary>La fila siempre existe (seed la garantiza) — nunca retorna null.</summary>
    Task<AccountNamingPolicy> GetAsync(CancellationToken ct = default);

    /// <summary>UPDATE puro sobre Id=1 — la fila siempre existe, no hay upsert ni carrera.</summary>
    Task UpdateAsync(AccountNamingPolicy policy, CancellationToken ct = default);
}
