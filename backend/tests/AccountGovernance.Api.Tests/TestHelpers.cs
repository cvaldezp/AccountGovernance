using Microsoft.AspNetCore.Mvc;

namespace AccountGovernance.Api.Tests;

internal static class TestHelpers
{
    /// <summary>
    /// Controllers here return anonymous objects like `new { error = "..." }` —
    /// reflection is the only way to read that back from a test without coupling
    /// to a named DTO the production code doesn't use.
    /// </summary>
    public static string? GetErrorMessage(this ObjectResult result)
        => result.Value?.GetType().GetProperty("error")?.GetValue(result.Value) as string;
}
