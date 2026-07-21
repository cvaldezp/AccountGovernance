namespace AccountGovernance.Application.Common;

/// <summary>
/// Lanzada por IRoleScopeAssignmentRepository cuando la restricción única no
/// filtrada de gov.RoleScopeAssignments (UQ_Gov_RoleScopeAssignments_Pair)
/// rechaza un Create por duplicado — defensa en profundidad ante una
/// condición de carrera entre el chequeo de la aplicación
/// (GetByRoleAndScopeAsync) y la escritura real. Vive en Application (no en
/// Infrastructure) para que el servicio la capture sin depender de
/// Microsoft.Data.SqlClient — esa dependencia queda contenida en el
/// repositorio, mismo patrón que DuplicateFilterException.
/// </summary>
public sealed class DuplicateAssignmentException() : Exception("Ya existe una asignación registrada para este rol y este ámbito.");
