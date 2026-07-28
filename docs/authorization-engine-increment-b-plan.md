# Motor de Autorización — Plan del Incremento B

> Estado: **Implementado y validado.** Basado en
> `docs/authorization-engine-architecture.md` (Congelada), sección 14,
> Incremento B: "Evaluador de ámbito, aislado". Las 4 decisiones de
> semántica fueron confirmadas por el usuario tal como se propusieron y
> se implementaron sin cambios. Sin commit todavía — pendiente de
> revisión final.

## Resultado de la implementación

- **Archivos nuevos**: `backend/src/AccountGovernance.Application/Authorization/`
  (`AdministrativeScopeFilterEvaluator.cs`, `ScopeFilterEvaluationResult.cs`,
  `DistinguishedNameContainment.cs`) y
  `backend/tests/AccountGovernance.Api.Tests/Authorization/`
  (`AdministrativeScopeFilterEvaluatorTests.cs`,
  `DistinguishedNameContainmentTests.cs`).
- **Build**: `dotnet build` → 0 advertencias, 0 errores.
- **Pruebas**: **59/59 correctas** (31 del Incremento A, sin tocar, + 28
  nuevas de este incremento — más de las 17 mínimas del plan original,
  se agregaron casos adicionales para la lógica de tres valores y para
  filtros inactivos).
- **`git status --short`**: solo las dos carpetas nuevas — **cero
  archivos existentes modificados**, confirmado.
- La combinación de múltiples filtros usa lógica de tres valores (no un
  AND booleano simple): un `NoMatch` real tiene precedencia sobre un
  `Unavailable` de otro filtro distinto — documentado en el código y
  cubierto por pruebas dedicadas
  (`MultiplesFiltros_UnoNoCoincideYOtroInevaluable_...`).

## Objetivo

Construir, de forma **aislada** (sin conectarla a ningún gate, controller
ni Service real todavía), la lógica que hoy no existe en ningún punto del
código: determinar si un usuario real (Caso A) o un recurso proyectado de
creación (Caso B) satisface los filtros de un `AdministrativeScope`. Es
código enteramente nuevo — a diferencia del Incremento A, **no modifica
ningún archivo existente**, así que no aplica el marco de "cero cambios
observables" de la misma manera: acá el riesgo no es romper algo que ya
funciona, es dejar mal definida una semántica que después sea costosa de
cambiar una vez que otros incrementos empiecen a depender de ella.

## Alcance

**Incluye:**
- Una función que evalúa el conjunto de `AdministrativeScopeFilter`
  activos de un scope contra un diccionario de atributos ya cargado
  (`AttributeName → Valor`) — sirve tanto para un usuario real (Caso A)
  como para un recurso proyectado de creación (Caso B), porque ambos se
  representan con la misma forma genérica.
- El fail-closed por dato faltante (`SCOPE_ATTRIBUTE_UNAVAILABLE`,
  sección 4/7/8 de la arquitectura): si el filtro necesita un atributo que
  no está en el diccionario provisto, la función debe señalarlo como
  "no evaluable", no como "no matchea".
- Una función separada para la verificación de contención de DN (Caso B,
  creación de cuenta): ¿el DN destino cae bajo el `BaseDn` del scope? —
  es lógica de comparación de texto, no requiere LDAP.
- Pruebas unitarias exhaustivas de ambas funciones, escritas **antes** de
  fijar la implementación final (ver sección "Casos de prueba").

**No incluye — explícitamente fuera de este incremento:**
- Conectar el evaluador a ningún controller, Service o gate real. Sigue
  siendo código sin consumidores en producción.
- La consulta LDAP adicional controlada (ej. `memberOf` completo) — el
  evaluador solo consume lo que ya se le entrega armado; no decide ni
  ejecuta ninguna llamada a `AdGateway`.
- La generación de filtros LDAP para búsquedas masivas (arquitectura,
  sección 4, tercer punto de "Estrategia de evaluación de filtros") —
  eso es de un incremento posterior, cuando exista una operación que
  necesite evaluar una población en vez de un usuario puntual.
- Soporte para atributos multivaluados (ver "Límite explícito" más abajo).
- `AuthorizationDecision`, `RoleEvaluationResult`, la agregación por rol,
  o cualquier otro elemento del algoritmo consolidado (sección 5 de la
  arquitectura) — eso es del Incremento C.
- Cambios de esquema, de API, o de frontend.

## Decisiones de semántica que necesito que confirmes antes de implementar

La arquitectura dejó estas decisiones deliberadamente abiertas para "el
momento de implementar" — ese momento es ahora. No las voy a asumir
solo:

1. **¿Comparación sensible o insensible a mayúsculas/minúsculas?**
   Recomiendo **insensible** (`Equals`/`NotEquals`/`In` comparan
   ignorando mayúsculas y espacios al inicio/final), por dos razones: (a)
   es consistente con cómo ya se normaliza `AttributeNameNormalized`/
   `ValueNormalized` en `schema.sql` (`UPPER(LTRIM(RTRIM(...)))`) para la
   unicidad de filtros — usar otro criterio en la evaluación en vivo
   crearía dos nociones distintas de "igual" en el mismo sistema; (b) es
   el caso de uso real que ya surgió en las pruebas funcionales (el riesgo
   de que `"Activado"` no matchee `"activado"` por una diferencia de
   mayúscula, que señalamos en `docs/pruebas-ambitos-roles-matriz-permisos.md`).
2. **¿Qué significa "atributo no disponible" vs. "atributo vacío"?**
   Propongo distinguir tres estados, no dos: (a) la clave no está en el
   diccionario de atributos provisto → `SCOPE_ATTRIBUTE_UNAVAILABLE`
   (fail-closed, no evaluable); (b) la clave está pero su valor es
   `null`/cadena vacía → se evalúa igual, simplemente no va a matchear
   `Equals`/`In`/`Exists` casi nunca (excepto `NotEquals`, que si `Value`
   no es vacío, sí sería verdadero) — esto es un resultado normal, no un
   fail-closed.
3. **Atributos multivaluados — límite explícito, no soportado en este
   incremento.** `User.RawAttributes` (`IReadOnlyDictionary<string,
   string?>`) ya trunca a un solo valor por atributo (deuda ya documentada
   en el relevamiento original). El evaluador de este incremento **solo
   soporta comparación de un único valor por atributo** — si en el futuro
   hace falta evaluar un filtro contra un atributo multivaluado real (ej.
   `memberOf` completo), va a requerir una extensión del contrato, no
   entra en este incremento.
4. **Contención de DN (Caso B) — ¿comparación exacta de sufijo, o
   normalizada?** Propongo comparar el DN destino contra el `BaseDn`
   normalizando mayúsculas/minúsculas y espacios alrededor de cada
   componente separado por comas (los DN de LDAP son case-insensitive por
   estándar, y los espacios después de una coma son comunes y no
   significativos) — nunca una comparación de substring ingenua, para
   evitar falsos positivos (ej. que `OU=Cloud2,...` matchee por error
   contra `OU=Cloud,...`).

**Si alguna de estas cuatro no es lo que esperás, decímelo antes de que
implemente — cambiar la semántica después de que Incremento C empiece a
depender de ella es mucho más costoso que ajustarla ahora.**

## Contrato conceptual de las funciones

**Evaluador de filtros** — entrada: la lista de `AdministrativeScopeFilter`
activos de un scope, y un diccionario `AttributeName → Valor` ya cargado
(sea de un usuario real o de un recurso proyectado). Salida: una de tres
posibilidades por scope evaluado — *coincide*, *no coincide*, o *no
evaluable* (con el nombre del atributo faltante, para poblar
`ErroresODatosFaltantes` cuando el motor completo exista en el
Incremento C). Ningún I/O — función pura, 100% testeable sin mocks de
AD/SQL.

**Verificación de contención de DN** — entrada: el DN destino (string) y
el `BaseDn` del scope (string). Salida: booleano. También pura, sin I/O.

No propongo todavía nombres de clases/interfaces/namespace — eso es
detalle de implementación que se resuelve al escribir el código, no en
este documento de planificación.

## Archivos afectados

**Todos nuevos — ningún archivo existente se modifica en este
incremento:**
- Lógica del evaluador de filtros (ubicación propuesta: capa
  `AccountGovernance.Application`, junto al resto de la lógica de
  autorización — a confirmar el namespace exacto al implementar).
- Lógica de contención de DN (misma capa).
- Proyecto de test: se reutiliza `backend/tests/AccountGovernance.Api.Tests`
  (ya existe desde el Incremento A) o se evalúa crear uno nuevo específico
  de `Application` si el existente resulta demasiado acoplado a
  Controllers — a decidir al implementar, según cómo quede más limpio.

**Explícitamente NO afectados:**
- Los 5 controllers y `SystemAuthorizationService` del Incremento A — sin
  tocar.
- `AdministrativeScopeService`, `AdministrativeScopesController`,
  `RoleScopeAssignmentService` — el CRUD ya validado en producción sigue
  intacto.
- `PermissionService`, `UserService` — siguen diferidos, sin relación con
  este incremento.
- `schema.sql`, frontend.

## Casos de prueba a escribir primero

A diferencia del Incremento A (donde "caracterizábamos" comportamiento
existente), acá no hay comportamiento previo — así que las pruebas
**definen** la semántica antes de que exista la implementación final
(equivalente a TDD). Mínimo indispensable:

**Evaluador de filtros:**
1. `Equals` — coincide cuando el valor es idéntico.
2. `Equals` — coincide cuando difiere solo en mayúsculas/espacios
   (si se confirma la decisión #1).
3. `Equals` — no coincide cuando el valor es realmente distinto.
4. `NotEquals` — inverso de los tres anteriores.
5. `In` — coincide cuando el valor está en la lista separada por comas.
6. `In` — no coincide cuando no está.
7. `Exists` — coincide cuando el atributo tiene cualquier valor no vacío.
8. `Exists` — no coincide cuando el valor es vacío/null.
9. **Atributo ausente del diccionario** → resultado "no evaluable"
   (`SCOPE_ATTRIBUTE_UNAVAILABLE`), para los 4 operadores.
10. **Múltiples filtros en un mismo scope** — todos deben cumplirse (AND
    entre filtros del mismo scope; la unión OR es entre scopes distintos,
    eso ya está resuelto en la arquitectura, sección 4, y no se reabre
    acá — solo se prueba que este evaluador aplique AND correctamente
    dentro de un scope).
11. Scope sin filtros (solo `BaseDn`) → siempre "coincide" (ya documentado
    en el flujo actual: *"Sin filtros — el ámbito se identifica solo por
    su Base DN, lo cual es válido y suficiente"*).

**Contención de DN:**
12. DN destino exactamente igual al `BaseDn` → contenido.
13. DN destino como hijo directo del `BaseDn` → contenido.
14. DN destino como nieto (dos niveles) del `BaseDn` → contenido.
15. DN destino fuera del `BaseDn` → no contenido.
16. DN destino con un `BaseDn` "parecido" pero no real
    (`OU=Cloud2,...` vs `OU=Cloud,...`) → no contenido (evita falsos
    positivos por comparación de substring ingenua).
17. Diferencias de mayúsculas/espacios en los componentes del DN → sigue
    contenido (si se confirma la decisión #4).

## Validación

- `dotnet build` limpio.
- Los ~17 casos de arriba (más los que surjan al escribirlos) en verde.
- Confirmar que **ningún archivo fuera de los nuevos** aparece en
  `git diff --stat` — este incremento no debería tocar nada existente,
  a diferencia del A.
- Sin necesidad de desplegar a Development — el evaluador no está
  conectado a ningún flujo real todavía, así que no hay nada que validar
  en el servidor para este incremento puntual.

## Riesgos

- **Semántica mal definida ahora es cara de corregir después** — es el
  riesgo central de este incremento, por eso las 4 decisiones de arriba
  se piden confirmar explícitamente antes de escribir código, no después.
- **Límite de un solo valor por atributo** (decisión #3) puede quedar
  corto el día que un filtro real necesite evaluar contra `memberOf`
  completo — está documentado como límite consciente, no un olvido, pero
  vale la pena tenerlo presente para el Incremento C.
- **Sin consumidor real todavía** — como nada lo usa en producción, un
  error de diseño acá no se nota hasta que el Incremento C lo conecte;
  por eso la cobertura de pruebas de este incremento importa más de lo
  habitual, es la única red de seguridad que tiene por ahora.
