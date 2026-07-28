using AccountGovernance.Application.Authorization;
using AccountGovernance.Domain.Entities;
using AccountGovernance.Domain.Enums;

namespace AccountGovernance.Api.Tests.Authorization;

/// <summary>
/// Casos de prueba definidos primero en docs/authorization-engine-increment-b-plan.md
/// (sección "Casos de prueba a escribir primero") — el evaluador es código nuevo sin
/// consumidores todavía, así que estas pruebas fijan la semántica, no la caracterizan.
/// </summary>
public sealed class AdministrativeScopeFilterEvaluatorTests
{
    private static AdministrativeScopeFilter Filter(
        string attributeName, ScopeFilterOperator op, string? value, bool isActive = true) => new()
    {
        Id = 1,
        AdministrativeScopeId = 1,
        FilterType = "Test",
        AttributeName = attributeName,
        Operator = op,
        Value = value,
        IsActive = isActive,
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow,
    };

    private static Dictionary<string, string?> Attributes(params (string Key, string? Value)[] pairs) =>
        pairs.ToDictionary(p => p.Key, p => p.Value);

    // ── Caso 1-3: Equals ────────────────────────────────────────────────────────

    [Fact]
    public void Equals_ValorIdentico_Coincide()
    {
        var filters = new[] { Filter("company", ScopeFilterOperator.Equals, "USFQ") };
        var result = AdministrativeScopeFilterEvaluator.Evaluate(filters, Attributes(("company", "USFQ")));

        Assert.Equal(ScopeFilterMatchOutcome.Match, result.Outcome);
    }

    [Fact]
    public void Equals_DifiereSoloEnMayusculasYEspacios_Coincide()
    {
        var filters = new[] { Filter("extensionAttribute7", ScopeFilterOperator.Equals, "Activado") };
        var result = AdministrativeScopeFilterEvaluator.Evaluate(
            filters, Attributes(("extensionAttribute7", "  activado  ")));

        Assert.Equal(ScopeFilterMatchOutcome.Match, result.Outcome);
    }

    [Fact]
    public void Equals_ValorRealmenteDistinto_NoCoincide()
    {
        var filters = new[] { Filter("company", ScopeFilterOperator.Equals, "USFQ") };
        var result = AdministrativeScopeFilterEvaluator.Evaluate(filters, Attributes(("company", "OtraEmpresa")));

        Assert.Equal(ScopeFilterMatchOutcome.NoMatch, result.Outcome);
    }

    // ── Caso 4: NotEquals (inverso de 1-3) ──────────────────────────────────────

    [Fact]
    public void NotEquals_ValorIdentico_NoCoincide()
    {
        var filters = new[] { Filter("company", ScopeFilterOperator.NotEquals, "USFQ") };
        var result = AdministrativeScopeFilterEvaluator.Evaluate(filters, Attributes(("company", "USFQ")));

        Assert.Equal(ScopeFilterMatchOutcome.NoMatch, result.Outcome);
    }

    [Fact]
    public void NotEquals_ValorRealmenteDistinto_Coincide()
    {
        var filters = new[] { Filter("company", ScopeFilterOperator.NotEquals, "USFQ") };
        var result = AdministrativeScopeFilterEvaluator.Evaluate(filters, Attributes(("company", "OtraEmpresa")));

        Assert.Equal(ScopeFilterMatchOutcome.Match, result.Outcome);
    }

    // ── Caso 5-6: In ─────────────────────────────────────────────────────────────

    [Fact]
    public void In_ValorEnLaLista_Coincide()
    {
        var filters = new[] { Filter("department", ScopeFilterOperator.In, "Cloud, Redes, Seguridad") };
        var result = AdministrativeScopeFilterEvaluator.Evaluate(filters, Attributes(("department", "Redes")));

        Assert.Equal(ScopeFilterMatchOutcome.Match, result.Outcome);
    }

    [Fact]
    public void In_ValorFueraDeLaLista_NoCoincide()
    {
        var filters = new[] { Filter("department", ScopeFilterOperator.In, "Cloud, Redes, Seguridad") };
        var result = AdministrativeScopeFilterEvaluator.Evaluate(filters, Attributes(("department", "RRHH")));

        Assert.Equal(ScopeFilterMatchOutcome.NoMatch, result.Outcome);
    }

    // ── Caso 7-8: Exists ─────────────────────────────────────────────────────────

    [Fact]
    public void Exists_ValorNoVacio_Coincide()
    {
        var filters = new[] { Filter("extensionAttribute7", ScopeFilterOperator.Exists, null) };
        var result = AdministrativeScopeFilterEvaluator.Evaluate(
            filters, Attributes(("extensionAttribute7", "cualquier-cosa")));

        Assert.Equal(ScopeFilterMatchOutcome.Match, result.Outcome);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void Exists_ValorVacioONulo_NoCoincide(string? value)
    {
        var filters = new[] { Filter("extensionAttribute7", ScopeFilterOperator.Exists, null) };
        var result = AdministrativeScopeFilterEvaluator.Evaluate(
            filters, Attributes(("extensionAttribute7", value)));

        Assert.Equal(ScopeFilterMatchOutcome.NoMatch, result.Outcome);
    }

    // ── Caso 9: atributo ausente del diccionario → Unavailable, para los 4 operadores ──

    [Theory]
    [InlineData(ScopeFilterOperator.Equals)]
    [InlineData(ScopeFilterOperator.NotEquals)]
    [InlineData(ScopeFilterOperator.In)]
    [InlineData(ScopeFilterOperator.Exists)]
    public void AtributoAusenteDelDiccionario_EsInevaluable(ScopeFilterOperator op)
    {
        var filters = new[] { Filter("extensionAttribute7", op, "Activado") };
        var result = AdministrativeScopeFilterEvaluator.Evaluate(filters, Attributes());

        Assert.Equal(ScopeFilterMatchOutcome.Unavailable, result.Outcome);
        Assert.Equal(["extensionAttribute7"], result.MissingAttributeNames);
    }

    [Fact]
    public void AtributoPresenteConValorNulo_NoEsInevaluable_EsUnNoMatchNormal()
    {
        // Distingue explícitamente "la clave no está" (Unavailable) de "la clave está
        // pero el valor es null" (evaluación normal, decisión de semántica #2).
        var filters = new[] { Filter("extensionAttribute7", ScopeFilterOperator.Equals, "Activado") };
        var attributes = new Dictionary<string, string?> { ["extensionAttribute7"] = null };

        var result = AdministrativeScopeFilterEvaluator.Evaluate(filters, attributes);

        Assert.Equal(ScopeFilterMatchOutcome.NoMatch, result.Outcome);
    }

    // ── Caso 10: múltiples filtros — AND, con precedencia de NoMatch sobre Unavailable ──

    [Fact]
    public void MultiplesFiltros_TodosCoinciden_Coincide()
    {
        var filters = new[]
        {
            Filter("company", ScopeFilterOperator.Equals, "USFQ"),
            Filter("extensionAttribute7", ScopeFilterOperator.Exists, null),
        };
        var attributes = Attributes(("company", "USFQ"), ("extensionAttribute7", "Activado"));

        var result = AdministrativeScopeFilterEvaluator.Evaluate(filters, attributes);

        Assert.Equal(ScopeFilterMatchOutcome.Match, result.Outcome);
    }

    [Fact]
    public void MultiplesFiltros_UnoNoCoincide_ResultadoGlobalNoCoincide()
    {
        var filters = new[]
        {
            Filter("company", ScopeFilterOperator.Equals, "USFQ"),
            Filter("department", ScopeFilterOperator.Equals, "Cloud"),
        };
        var attributes = Attributes(("company", "OtraEmpresa"), ("department", "Cloud"));

        var result = AdministrativeScopeFilterEvaluator.Evaluate(filters, attributes);

        Assert.Equal(ScopeFilterMatchOutcome.NoMatch, result.Outcome);
    }

    [Fact]
    public void MultiplesFiltros_UnoNoCoincideYOtroInevaluable_NoCoincideGanaSobreInevaluable()
    {
        // Lógica de tres valores documentada en AdministrativeScopeFilterEvaluator:
        // un "no" real (False) no debe quedar enmascarado por un dato faltante en
        // otro filtro distinto — NoMatch tiene precedencia sobre Unavailable.
        var filters = new[]
        {
            Filter("company", ScopeFilterOperator.Equals, "USFQ"),   // no coincide
            Filter("department", ScopeFilterOperator.Equals, "Cloud"), // ausente del diccionario
        };
        var attributes = Attributes(("company", "OtraEmpresa"));

        var result = AdministrativeScopeFilterEvaluator.Evaluate(filters, attributes);

        Assert.Equal(ScopeFilterMatchOutcome.NoMatch, result.Outcome);
    }

    [Fact]
    public void MultiplesFiltros_NingunoNoCoincidePeroUnoInevaluable_ResultadoInevaluable()
    {
        var filters = new[]
        {
            Filter("company", ScopeFilterOperator.Equals, "USFQ"),   // coincide
            Filter("department", ScopeFilterOperator.Equals, "Cloud"), // ausente del diccionario
        };
        var attributes = Attributes(("company", "USFQ"));

        var result = AdministrativeScopeFilterEvaluator.Evaluate(filters, attributes);

        Assert.Equal(ScopeFilterMatchOutcome.Unavailable, result.Outcome);
        Assert.Equal(["department"], result.MissingAttributeNames);
    }

    [Fact]
    public void FiltrosInactivos_SeIgnoranEnLaEvaluacion()
    {
        var filters = new[]
        {
            Filter("company", ScopeFilterOperator.Equals, "USFQ"),
            Filter("department", ScopeFilterOperator.Equals, "NoImporta", isActive: false),
        };
        // "department" ni siquiera está en el diccionario — si el filtro inactivo se
        // evaluara igual, esto daría Unavailable en vez de Match.
        var attributes = Attributes(("company", "USFQ"));

        var result = AdministrativeScopeFilterEvaluator.Evaluate(filters, attributes);

        Assert.Equal(ScopeFilterMatchOutcome.Match, result.Outcome);
    }

    // ── Caso 11: scope sin filtros ───────────────────────────────────────────────

    [Fact]
    public void SinFiltros_SiempreCoincide()
    {
        var result = AdministrativeScopeFilterEvaluator.Evaluate([], Attributes());

        Assert.Equal(ScopeFilterMatchOutcome.Match, result.Outcome);
    }
}
