using System.Globalization;

namespace AccountGovernance.Application.Services;

/// <summary>
/// Valida y normaliza un valor de atributo AD según el <c>DataType</c> configurado
/// en gov.FieldDefinitions (semántica LDAP: string/integer/flags/boolean/datetime/dn —
/// distinto de FieldType, que es el tipo de widget del formulario). Punto de
/// extensión único: agregar un nuevo <c>case</c> acá cubre validación en todo el
/// proyecto sin tocar UserService. Un DataType nulo o no reconocido se trata como
/// texto libre — no bloquea atributos ya configurados con un valor que este
/// validador todavía no conoce.
/// </summary>
internal static class AttributeValueValidator
{
    public static bool TryValidate(string? dataType, string rawValue, out string normalizedValue, out string? error)
    {
        normalizedValue = rawValue;
        error = null;

        switch (dataType?.Trim().ToLowerInvariant())
        {
            case "integer":
            case "flags":
                if (!long.TryParse(rawValue, NumberStyles.Integer, CultureInfo.InvariantCulture, out _))
                {
                    error = $"El valor debe ser un número entero para el tipo '{dataType}'.";
                    return false;
                }
                return true;

            case "boolean":
                if (rawValue.Equals("true", StringComparison.OrdinalIgnoreCase) || rawValue == "1")
                {
                    normalizedValue = "TRUE";
                    return true;
                }
                if (rawValue.Equals("false", StringComparison.OrdinalIgnoreCase) || rawValue == "0")
                {
                    normalizedValue = "FALSE";
                    return true;
                }
                error = "El valor debe ser verdadero/falso (true/false) para el tipo 'boolean'.";
                return false;

            case "datetime":
                if (!DateTime.TryParse(rawValue, CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
                {
                    error = "El valor debe ser una fecha/hora válida para el tipo 'datetime'.";
                    return false;
                }
                return true;

            case "dn":
                if (!rawValue.Contains('='))
                {
                    error = "El valor debe tener formato de Distinguished Name (ej. CN=...,OU=...) para el tipo 'dn'.";
                    return false;
                }
                return true;

            // "string", null/vacío, o cualquier DataType todavía no modelado acá:
            // texto libre, siempre válido.
            default:
                return true;
        }
    }
}
