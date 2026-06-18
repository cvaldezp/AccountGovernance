# ADR-003: Búsqueda LDAP por identificadores exactos (sin wildcard en displayName)

**Fecha:** 2026-06-17  
**Estado:** Aceptado

## Contexto

La primera implementación de búsqueda usaba un filtro wildcard sobre `sAMAccountName`, `displayName` y `mail`:

```ldap
(&(objectClass=user)(objectCategory=person)
  (|(sAMAccountName=*carlos*)(displayName=*carlos*)(mail=*carlos*)))
```

Este filtro dispara `DirectoryOperationException: The size limit was exceeded` porque AD retorna miles de entradas antes de alcanzar el límite del cliente. La excepción no controlada propagaba un 500 al frontend.

## Decisión

Reemplazar el filtro wildcard por búsqueda exacta sobre identificadores institucionales únicos:

- `CustomBannerID` — código Banner del estudiante/docente
- `mail` — correo institucional completo
- `userPrincipalName` — UPN completo
- `sAMAccountName` — login de dominio

**Normalización del query:**
- Si contiene `@`: descomponer parte local y generar variantes con `@usfq.edu.ec` / `@estud.usfq.edu.ec`
- Si no contiene `@`: agregar sufijos institucionales al query
- Prefijo `sAMAccountName=q*` solo si `len(q) ≥ 4` para evitar matches masivos

**Límite de resultados:** `SearchRequest.SizeLimit = min(maxResults, 20)`

**Manejo de `SizeLimitExceeded`:** captura `DirectoryOperationException` con `ResultCode.SizeLimitExceeded`, retorna `AdSearchResult([], TooManyResults: true)` → HTTP 400 con código `"TOO_MANY_RESULTS"`.

## Consecuencias

**Ventajas:**
- Elimina el `DirectoryOperationException` no controlado
- La búsqueda es predecible: solo retorna el usuario exacto buscado
- El frontend puede mostrar un error amigable para el caso `TOO_MANY_RESULTS`
- `SizeLimit=20` garantiza respuestas rápidas

**Limitaciones:**
- No permite búsqueda por nombre (ej. "buscar todos los Carlos") — esto es intencional en esta fase
- Si el operador no conoce el identificador exacto del usuario, debe pedírselo
- Búsqueda por displayName queda pendiente para una fase futura con estrategia diferente (ej. índice de búsqueda externo)
