namespace AccountGovernance.Application.Common;

/// <summary>
/// Lanzada por IAdministrativeScopeRepository cuando el índice único filtrado
/// de gov.AdministrativeScopeFilters (UQ_Gov_AdministrativeScopeFilters_Active)
/// rechaza un Create/Update por duplicado — defensa en profundidad ante una
/// condición de carrera entre el chequeo de la aplicación y la escritura real.
/// Vive en Application (no en Infrastructure) para que el servicio la capture
/// sin depender de Microsoft.Data.SqlClient — esa dependencia queda contenida
/// en el repositorio, que es quien conoce el motor de base de datos real.
/// </summary>
public sealed class DuplicateFilterException() : Exception("Ya existe un filtro activo equivalente en este ámbito.");
