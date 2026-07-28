namespace AccountGovernance.Application.Authorization;

/// <summary>
/// Three-valued outcome of evaluating a scope's filters against a set of already-loaded
/// attributes — never just true/false, because a missing attribute is not the same as a
/// definite non-match (Incremento B, decisión de semántica #2).
/// </summary>
public enum ScopeFilterMatchOutcome
{
    Match,
    NoMatch,
    Unavailable,
}

/// <summary>
/// Result of <see cref="AdministrativeScopeFilterEvaluator.Evaluate"/>. When
/// <see cref="Outcome"/> is <see cref="ScopeFilterMatchOutcome.Unavailable"/>,
/// <see cref="MissingAttributeNames"/> lists every attribute a filter needed but that
/// was absent from the attributes supplied — never a value, only the attribute name.
/// </summary>
public sealed record ScopeFilterEvaluationResult(
    ScopeFilterMatchOutcome Outcome,
    IReadOnlyList<string> MissingAttributeNames)
{
    public static readonly ScopeFilterEvaluationResult Match = new(ScopeFilterMatchOutcome.Match, []);
    public static readonly ScopeFilterEvaluationResult NoMatch = new(ScopeFilterMatchOutcome.NoMatch, []);

    public static ScopeFilterEvaluationResult Unavailable(IReadOnlyList<string> missingAttributeNames)
        => new(ScopeFilterMatchOutcome.Unavailable, missingAttributeNames);
}
