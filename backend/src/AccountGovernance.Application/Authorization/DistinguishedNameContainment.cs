namespace AccountGovernance.Application.Authorization;

/// <summary>
/// Incremento B del Motor de Autorización — verifica si un DN destino cae bajo el
/// BaseDn de un AdministrativeScope (Caso B de la arquitectura: creación de cuenta,
/// donde no hay un usuario existente contra el cual evaluar filtros, solo un destino
/// proyectado). Función pura, sin I/O ni consulta a AD.
///
/// Compara componente por componente (separados por comas), nunca por substring —
/// "OU=Cloud2,..." no debe matchear contra el BaseDn "OU=Cloud,...". Normaliza
/// mayúsculas/espacios por componente (decisión de semántica #4: los DN de LDAP son
/// case-insensitive por estándar).
///
/// Limitación conocida: separa por coma sin manejar comas escapadas dentro de un
/// valor de componente (ej. "CN=Smith\, John,OU=...") — no es un parser RFC 4514
/// completo. Suficiente para los BaseDn de OU simples que usa este sistema; si
/// hiciera falta soportar comas escapadas, requiere revisar esta función primero.
/// </summary>
public static class DistinguishedNameContainment
{
    public static bool IsUnderBaseDn(string candidateDn, string baseDn)
    {
        var candidateComponents = SplitAndNormalize(candidateDn);
        var baseComponents = SplitAndNormalize(baseDn);

        if (baseComponents.Count == 0 || candidateComponents.Count < baseComponents.Count)
            return false;

        var candidateTail = candidateComponents.Skip(candidateComponents.Count - baseComponents.Count);
        return candidateTail.SequenceEqual(baseComponents);
    }

    private static List<string> SplitAndNormalize(string dn) =>
        dn.Split(',')
          .Select(component => component.Trim().ToUpperInvariant())
          .Where(component => component.Length > 0)
          .ToList();
}
