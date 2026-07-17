namespace AccountGovernance.Domain.Enums;

/// <summary>
/// Operadores soportados por AdministrativeScopeFilter. Deliberadamente cerrado
/// a un conjunto simple — sin Contains/StartsWith ni un filtro LDAP libre. El
/// modelo crece agregando un valor nuevo aquí solo cuando exista un caso de
/// negocio real, nunca como una vía de escape genérica.
/// </summary>
public enum ScopeFilterOperator
{
    Equals,
    NotEquals,
    In,
    Exists,
}
