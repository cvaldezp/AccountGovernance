namespace AccountGovernance.Application.Common;

/// <summary>
/// Converts an expiration mode + parameters into a Windows FileTime value for the AD
/// <c>accountExpires</c> attribute. Stateless — no dependencies, safe to call from any service.
/// </summary>
public static class AccountExpirationCalculator
{
    /// <summary>Parses a CSV of month integers (e.g. "1,3,6,12") into a sorted array.</summary>
    public static int[] ParseMonths(string? csv)
    {
        if (string.IsNullOrWhiteSpace(csv)) return [];
        return csv.Split(',', StringSplitOptions.RemoveEmptyEntries)
                  .Select(s => int.TryParse(s.Trim(), out var n) ? (int?)n : null)
                  .Where(n => n.HasValue)
                  .Select(n => n!.Value)
                  .OrderBy(n => n)
                  .ToArray();
    }

    /// <summary>
    /// Computes the raw Windows FileTime (100-ns intervals since 1601-01-01) and the
    /// calendar date for the expiry, validating the inputs in the process.
    /// </summary>
    /// <returns>
    /// <c>(raw: long, date: DateOnly)</c> on success, or <c>(null, null)</c> when the
    /// mode is unrecognised, "never", empty, or validation fails.
    /// Errors are appended to <paramref name="errors"/>.
    /// </returns>
    public static (long? Raw, DateOnly? Date) Compute(
        string?       mode,
        int?          months,
        DateOnly?     customDate,
        IList<string> errors)
    {
        if (mode == "months")
        {
            if (months is null or <= 0)
            {
                errors.Add("Se requiere el número de meses para la vigencia de la cuenta.");
                return (null, null);
            }
            var expiry = DateTime.UtcNow.AddMonths(months.Value);
            return (expiry.ToFileTimeUtc(), DateOnly.FromDateTime(expiry));
        }

        if (mode == "custom")
        {
            if (customDate is null)
            {
                errors.Add("Se requiere la fecha de vencimiento.");
                return (null, null);
            }
            if (customDate.Value <= DateOnly.FromDateTime(DateTime.UtcNow))
            {
                errors.Add("La fecha de vencimiento debe ser posterior a hoy.");
                return (null, null);
            }
            var expiry = customDate.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            return (expiry.ToFileTimeUtc(), customDate);
        }

        // "never", null, or unknown — caller omits accountExpires attribute
        return (null, null);
    }
}
