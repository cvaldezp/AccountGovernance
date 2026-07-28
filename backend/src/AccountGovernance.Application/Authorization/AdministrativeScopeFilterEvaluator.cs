using AccountGovernance.Domain.Entities;
using AccountGovernance.Domain.Enums;

namespace AccountGovernance.Application.Authorization;

/// <summary>
/// Incremento B del Motor de Autorización — evalúa los filtros de un
/// AdministrativeScope contra un usuario real o un recurso proyectado de creación,
/// ambos representados de la misma forma genérica (diccionario de atributos ya
/// cargado). Función pura, sin I/O — no consulta AD ni SQL, no conoce roles ni
/// operaciones. Deliberadamente aislada: todavía sin ningún consumidor real
/// (controller/Service/gate) — eso es del Incremento C.
///
/// Solo soporta un valor por atributo (mismo límite que User.RawAttributes hoy) —
/// atributos multivaluados (ej. memberOf completo) quedan fuera de este incremento.
/// </summary>
public static class AdministrativeScopeFilterEvaluator
{
    /// <summary>
    /// Evalúa todos los filtros activos de <paramref name="filters"/> contra
    /// <paramref name="attributes"/>. Los filtros del mismo scope se combinan con AND;
    /// un scope sin filtros activos siempre matchea (el Base DN alcanza por sí solo).
    ///
    /// Combinación con lógica de tres valores, no un simple AND booleano: un filtro
    /// que definitivamente no matchea (False) hace que el resultado global sea
    /// NoMatch aunque otro filtro sea Unavailable — un "no" real no debería quedar
    /// enmascarado por un dato faltante en otro filtro distinto. Solo cuando ningún
    /// filtro dio False pero al menos uno quedó Unavailable, el resultado global es
    /// Unavailable. Ningún False y ningún Unavailable → Match.
    /// </summary>
    public static ScopeFilterEvaluationResult Evaluate(
        IReadOnlyList<AdministrativeScopeFilter> filters,
        IReadOnlyDictionary<string, string?> attributes)
    {
        var activeFilters = filters.Where(f => f.IsActive).ToList();
        if (activeFilters.Count == 0)
            return ScopeFilterEvaluationResult.Match;

        var sawNoMatch = false;
        var missingAttributes = new List<string>();

        foreach (var filter in activeFilters)
        {
            var outcome = EvaluateSingleFilter(filter, attributes, out var missingAttributeName);

            switch (outcome)
            {
                case SingleFilterOutcome.NoMatch:
                    sawNoMatch = true;
                    break;
                case SingleFilterOutcome.Unavailable:
                    missingAttributes.Add(missingAttributeName!);
                    break;
                case SingleFilterOutcome.Match:
                    break;
            }
        }

        if (sawNoMatch)
            return ScopeFilterEvaluationResult.NoMatch;

        return missingAttributes.Count > 0
            ? ScopeFilterEvaluationResult.Unavailable(missingAttributes.Distinct().ToList())
            : ScopeFilterEvaluationResult.Match;
    }

    private enum SingleFilterOutcome { Match, NoMatch, Unavailable }

    private static SingleFilterOutcome EvaluateSingleFilter(
        AdministrativeScopeFilter filter,
        IReadOnlyDictionary<string, string?> attributes,
        out string? missingAttributeName)
    {
        missingAttributeName = null;

        // Ausencia de la clave (nunca se cargó/pidió el atributo) es distinta de una
        // clave presente con valor null/vacío — solo la primera es "no evaluable"
        // (decisión de semántica #2). La segunda sigue el camino normal de abajo.
        if (!attributes.TryGetValue(filter.AttributeName, out var rawValue))
        {
            missingAttributeName = filter.AttributeName;
            return SingleFilterOutcome.Unavailable;
        }

        if (filter.Operator == ScopeFilterOperator.Exists)
            return !string.IsNullOrEmpty(rawValue) ? SingleFilterOutcome.Match : SingleFilterOutcome.NoMatch;

        var normalizedActual = Normalize(rawValue);

        return filter.Operator switch
        {
            ScopeFilterOperator.Equals =>
                normalizedActual == Normalize(filter.Value) ? SingleFilterOutcome.Match : SingleFilterOutcome.NoMatch,

            ScopeFilterOperator.NotEquals =>
                normalizedActual != Normalize(filter.Value) ? SingleFilterOutcome.Match : SingleFilterOutcome.NoMatch,

            ScopeFilterOperator.In =>
                SplitInList(filter.Value).Contains(normalizedActual) ? SingleFilterOutcome.Match : SingleFilterOutcome.NoMatch,

            _ => throw new ArgumentOutOfRangeException(
                nameof(filter), filter.Operator, "Operador de filtro no reconocido."),
        };
    }

    private static IReadOnlyList<string> SplitInList(string? csv) =>
        (csv ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(Normalize)
            .ToList();

    // Decisión de semántica #1: comparación insensible a mayúsculas y a espacios
    // alrededor del valor — mismo criterio que ya usa schema.sql para normalizar
    // AttributeNameNormalized/ValueNormalized en el índice único de filtros.
    private static string Normalize(string? value) => (value ?? string.Empty).Trim().ToUpperInvariant();
}
