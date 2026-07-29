# Motor de Autorización — Plan del Incremento D

> Estado: **aprobado (2026-07-28) — listo para implementación.** Las 4
> decisiones de diseño quedaron cerradas explícitamente (ver sección
> Decisiones); no se esperan más cambios de diseño salvo un hallazgo
> inesperado durante el desarrollo. Basado en
> `docs/authorization-engine-architecture.md` (Congelada), sección 14,
> Incremento D: "Enforcement real sobre `UpdateAttribute`". Este es
> cualitativamente distinto de A, B y C: **es el primer incremento capaz
> de bloquear una operación que hoy funciona**. Todo lo anterior fue
> refactor puro (A), código aislado sin consumidores (B), o auditoría sin
> efecto (C). Acá el riesgo deja de ser teórico.

## Objetivo

Convertir la evaluación combinada campo+ámbito (ya construida y validada
en vivo en el Incremento C) de "solo audita" a "decide de verdad" sobre
`UpdateAttribute` — pero de forma reversible sin redeploy, y con una
condición de negocio que debe confirmarse **antes** de activar el bloqueo,
no solo antes de escribir el código.

## Precondición crítica — no es una decisión técnica, es de negocio

La arquitectura ya señaló este riesgo (ADR, sección Riesgos): **un rol con
cero `RoleScopeAssignment` efectivos es un estado válido hoy**, y si se
activa el bloqueo real para ese rol, queda bloqueado para **todo**, no
para una porción — porque el fail-closed ya decidido dice "sin ámbito
asignado = denegar", no "sin ámbito asignado = como estaba antes".

**Estado confirmado (2026-07-23), revisando "Roles y Grupos" para los 4
roles:**

| Rol          | `RoleScopeAssignment` | Cuenta de prueba dedicada | Validación en vivo |
|--------------|:---:|:---:|:---:|
| `DragonHelp` | Sí — `prueba-funcional-estud-01` | Sí — `account-sd` | Sí, los 5 resultados posibles (Incremento C) |
| `Seguridades`| **No — cero asignaciones** | No | No |
| `RRHH`       | **No — cero asignaciones** | No | No |
| `Registro`   | **No — cero asignaciones** | No | No |

Es decir: la precondición **no está resuelta para 3 de los 4 roles**, y no
por una laguna de evidencia sino porque la configuración de negocio
todavía no existe para ellos. Un interruptor global bloquearía de
inmediato todo lo que `Seguridades`, `RRHH` y `Registro` hacen hoy.

Además, confirmamos una limitación metodológica: la cuenta de pruebas del
propio administrador pertenece simultáneamente a todos los grupos de AD
mapeados a roles, incluido `SystemAdmin`. Como el gate real de
`UpdateAttribute` resuelve un único **rol primario** por prioridad, y
`SystemAdmin` tiene la prioridad más baja de todas, esa cuenta **siempre**
resuelve como `SystemAdmin` para la operación real — el bypass domina
siempre, sin importar qué otros grupos tenga. Por lo tanto esa cuenta
**no sirve** para validar el bloqueo efectivo de `Seguridades`, `RRHH` ni
`Registro`; hace falta una cuenta de prueba cuyo único rol efectivo sea el
rol bajo prueba, igual que `account-sd` lo fue para `DragonHelp`.

**Consecuencia para este incremento**: en vez de esperar a que los 4 roles
estén listos, el incremento se acota desde el diseño a lo que la evidencia
real permite — ver Decisión 1 (aprobada) más abajo.

## Alcance

**Incluye:**
- Activar el bloqueo real (no solo log) del resultado de
  `ShadowFieldScopeEvaluator` sobre `UpdateAttribute`, **detrás de un
  interruptor reversible sin redeploy** (ver decisión 1).
- Mantener exactamente la misma evaluación ya validada en C — sin cambiar
  la lógica de `AdministrativeScopeFilterEvaluator` ni de
  `ShadowFieldScopeEvaluator`, ya probados.
- Un código de error para la nueva denegación por ámbito (ver decisión 2).
- Pruebas que documenten el cambio de comportamiento explícitamente —
  a diferencia de A, acá el objetivo **no** es "cero cambios
  observables": el cambio es el propósito del incremento, y las pruebas
  deben dejarlo claro, no camuflarlo.

**No incluye:**
- Ninguna otra operación además de `UpdateAttribute` — `UpdateAccountStatus`,
  creación de cuentas, etc. siguen sin gate de ámbito (Incremento F).
- Activar el interruptor en ningún ambiente real — este incremento entrega
  la capacidad de activarlo, apagada por defecto. Activarla es una
  decisión operativa posterior, condicionada a la precondición de arriba.
- `RoleScopeFieldPermission` (Incremento E) ni el concepto real de
  "permiso de operación" — sigue simplificado como en C (siempre
  verdadero), heredado sin cambios.
- Cambios de esquema.

## Decisiones

### 1. Interruptor por rol (`Role-based Scope Enforcement Toggle`) — aprobada

**Aprobada (2026-07-28)**: en vez de un interruptor global, el bloqueo
real se controla por lista de roles habilitados —
`Authorization:EnforceScopeOnUpdateAttributeRoles`, un arreglo de nombres
de rol en `appsettings.json`/`appsettings.{Environment}.json`, **default
vacío (`[]`)**. Revertir sigue siendo un cambio de configuración en el
servidor + reciclado del App Pool, sin redeploy de código — se mantiene la
propiedad central del interruptor original, solo cambia la forma
(lista en vez de booleano).

**Alcance inicial de activación (cuando se decida activar, fuera de este
incremento): únicamente `DragonHelp`.** Es el único rol con evidencia
completa hoy — `RoleScopeAssignment` real, cuenta de prueba dedicada, y
los 5 resultados posibles ya validados en vivo (Incremento C). Los otros
tres roles quedan en modo sombra (auditan, nunca bloquean) hasta que
cumplan, cada uno, estos criterios:

1. `RoleScopeAssignment` configurado y revisado con quien administra ese
   rol funcionalmente (no solo "existe una fila", sino que cubre
   razonablemente a los usuarios que el rol administra hoy).
2. Permisos de campo (`RoleFieldPermissions`) validados para ese rol.
3. Al menos una cuenta de prueba dedicada cuyo único rol efectivo sea ese
   rol — no una cuenta multi-rol como la del administrador, por la
   limitación de bypass de `SystemAdmin` ya documentada arriba.
4. Validación en modo sombra (log `[SHADOW-AUTH]`) sin denegaciones
   inesperadas durante un período de uso real.
5. Activación individual: agregar el nombre del rol a
   `EnforceScopeOnUpdateAttributeRoles` — no requiere tocar código ni
   redeploy.

**Nota de diseño sobre cómo interactúa el interruptor con la evaluación
existente**: la decisión de bloquear o no se sigue basando en el
**rol primario** de la operación — el mismo rol único que ya resuelve hoy
el gate real (`CanEditFieldAsync`), por prioridad. Es decir: "¿el rol
primario de esta operación está en la lista habilitada?". La evaluación de
sombra en sí **no cambia** — se sigue calculando sobre todos los roles
efectivos del operador, exactamente como en el Incremento C. Lo único que
cambia es si, cuando la sombra dice "denegado", eso además bloquea la
operación real o solo queda en el log. Esto evita introducir una segunda
noción de "rol relevante" distinta de la que el sistema ya usa.

Consecuencia directa de esto (importante para los casos de prueba): como
`SystemAdmin` tiene la prioridad más baja de todos los roles, **si
`SystemAdmin` está entre los roles efectivos del operador, el rol primario
de la operación siempre resuelve como `SystemAdmin`**, nunca como
`DragonHelp` ni ningún otro. Un caso de prueba que combine "rol primario
`DragonHelp`" con "`SystemAdmin` entre los roles efectivos" describe un
estado que el resolvedor real nunca produce — se corrige en la sección de
casos de prueba de abajo.

**Normalización de la lista de configuración**: al leer
`Authorization:EnforceScopeOnUpdateAttributeRoles` en el arranque de la
aplicación:
- clave ausente o `null` → tratar como lista vacía;
- recortar espacios de cada entrada e ignorar entradas vacías;
- eliminar duplicados;
- comparar contra el rol primario con `StringComparer.OrdinalIgnoreCase`
  (sin distinguir mayúsculas/minúsculas, sin coincidencias parciales);
- cualquier nombre que no coincida con un `RoleName` conocido del enum
  **no rompe el arranque**, pero emite un `warning` explícito en el log al
  iniciar la aplicación (ej. *"Configured scope-enforcement role
  'DragonHlep' does not match a known role."*) — así un error de tipeo no
  habilita silenciosamente nada ni pasa desapercibido.

### 2. Código de error para la denegación por ámbito — aprobada

**Decisión aprobada (2026-07-28)**: no se introduce ningún código HTTP ni
código de dominio nuevo. La denegación por ámbito reutiliza exactamente
el mismo contrato que ya usa hoy la denegación por campo:

- **HTTP:** `403 Forbidden`.
- **Código de dominio:** `"FORBIDDEN"`, *"No tienes permiso para editar
  este atributo."* — el mismo en los 5 motivos posibles de denegación
  (campo no permitido, fuera de ámbito, sin ámbito asignado, atributo no
  disponible, excepción fail-closed).

Motivo: coherente con el patrón ya establecido en este código (ej.
`AdministrativeScopesController.GetByKey`, comentario explícito: *"un
caller no-SystemAdmin recibe siempre el mismo 403... nunca debe poder
distinguir 'no tengo permiso' de 'no existe'"*) — no exponer al usuario
final si el problema es de permiso de campo o de ámbito evita filtrar
estructura interna de AD, preserva compatibilidad con el frontend y con
cualquier integración existente sin requerir cambios, y no obliga a tocar
código de cliente. El detalle real (qué motivo específico denegó) sigue
disponible en el log `[SHADOW-AUTH]`/auditoría para quien administra el
sistema, no para quien lo usa.

Queda descartada la alternativa de un código nuevo (`"OUT_OF_SCOPE"`) para
este incremento — si en el futuro aparece una necesidad funcional real de
distinguir estos casos en la interfaz, se evalúa como un cambio aparte,
explícito y acotado, no como parte de D.

### 3. Fail-closed ante excepción en la evaluación de ámbito — aprobada

**Decisión aprobada**: cuando el rol primario de la operación está
habilitado para enforcement (está en la lista) y la evaluación de ámbito
lanza una excepción, la operación se deniega — fail-closed, no fail-open.
La respuesta al cliente no expone el detalle de la excepción; ese detalle
se registra únicamente en logs y auditoría, igual que cualquier otro
motivo de denegación (ver decisión 2, mismo código `"FORBIDDEN"`).

Esto es una inversión deliberada respecto de la garantía del Incremento C
("una excepción en la sombra nunca afecta el resultado real") — pero solo
para el rol que efectivamente tiene enforcement activo. Para mantener el
aislamiento entre roles, la distinción es explícita:

- **Rol habilitado + excepción de evaluación** → bloquear la operación
  (fail-closed).
- **Rol no habilitado + excepción de evaluación** → conservar el
  comportamiento shadow-only: se registra el error, la operación real no
  se ve afectada (mismo comportamiento que el Incremento C, sin cambios).

### 4. Activación tras el despliegue — aprobada

**Decisión aprobada (2026-07-28)**: el despliegue del Incremento D **no**
modifica `EnforceScopeOnUpdateAttributeRoles`. Estado de configuración
inmediatamente después de publicar, en todos los ambientes:

```json
{
  "Authorization": {
    "EnforceScopeOnUpdateAttributeRoles": []
  }
}
```

Es decir: se despliega el código, el comportamiento real permanece
idéntico al Incremento C (shadow-only), y activar cualquier rol —
incluido `DragonHelp`, aunque ya cumpla los 5 criterios de la Decisión 1 —
requiere una acción de configuración explícita y posterior, coordinada
aparte, no automática ni implícita en "terminar" el incremento. Cuando
llegue ese momento, activar `DragonHelp` es únicamente:

```json
{
  "Authorization": {
    "EnforceScopeOnUpdateAttributeRoles": ["DragonHelp"]
  }
}
```

— un cambio de configuración en el servidor + reciclado del App Pool, sin
tocar código ni redeploy.

## Archivos afectados

- `UserService.cs` — la rama de sombra (ya existente desde C) pasa a
  poder bloquear, condicionada a si el rol primario de la operación está
  en la nueva lista de configuración. Se reutiliza `ShadowFieldScopeEvaluator`
  tal cual, sin tocarlo.
- Configuración: nueva clave `Authorization:EnforceScopeOnUpdateAttributeRoles`
  en `appsettings.json` (default `[]`) — **sin tocar**
  `appsettings.Development.json` del repo con una lista no vacía (activar
  un rol es una acción operativa en el servidor, no un valor versionado en
  Git por default).
- Pruebas nuevas en `backend/tests/AccountGovernance.Api.Tests/`.

**Explícitamente NO afectados**: `ShadowFieldScopeEvaluator`,
`AdministrativeScopeFilterEvaluator`, `DistinguishedNameContainment` — ya
validados, no se tocan. Los 5 controllers de A, `PermissionService`,
`schema.sql`, frontend.

## Casos de prueba

Documentan el cambio de comportamiento explícitamente — el objetivo NO es
"cero cambios", es demostrar exactamente cuáles son. Los casos 2 y 3 están
separados deliberadamente: `SystemAdmin` con prioridad más baja que todos
los demás roles significa que si `SystemAdmin` está entre los roles
efectivos del operador, el rol primario de la operación **siempre**
resuelve como `SystemAdmin` — nunca puede coexistir con "rol primario
`DragonHelp`" en el mismo caso real.

1. Lista de roles habilitados vacía (default) — comportamiento
   **idéntico** al Incremento C: la evaluación sombra audita, pero nunca
   bloquea. (Caracterización del estado actual, para no perderlo de
   vista.)
2. Rol primario `SystemAdmin`, aunque otro rol efectivo (`DragonHelp`)
   también esté en `EnforceScopeOnUpdateAttributeRoles` — operación
   permitida por el bypass incondicional de `SystemAdmin`. La evaluación
   sombra puede seguir evaluando todos los roles efectivos para el log,
   pero eso no cambia el resultado real.
3. Rol primario `DragonHelp`, sin `SystemAdmin` entre los roles
   efectivos, incluido en la lista habilitada + campo permitido y ámbito
   que matchea (`ROLE_MATCH`) — operación permitida.
4. Rol primario `DragonHelp`, incluido en la lista, campo permitido pero
   ningún ámbito coincide (`OUT_OF_SCOPE`) — operación denegada, con el
   código de error de la decisión 2.
5. Rol primario `DragonHelp`, incluido en la lista, sin ningún
   `RoleScopeAssignment` activo (`NO_ACTIVE_SCOPE_ASSIGNED`) — denegada,
   mismo código.
6. Rol primario `DragonHelp`, incluido en la lista, pero el atributo
   necesario para evaluar el ámbito no está disponible
   (`SCOPE_ATTRIBUTE_UNAVAILABLE`) — denegada (fail-closed por dato
   faltante, coherente con el diseño).
7. Rol primario `DragonHelp`, incluido en la lista, y la evaluación de
   ámbito produce una excepción — denegada de forma fail-closed (decisión
   3 de arriba); el detalle técnico se registra en logs, no se expone al
   cliente.
8. Rol primario `Registro`, `Seguridades` o `RRHH` — **no** incluido en
   la lista, aunque `DragonHelp` sí esté habilitado — la evaluación sombra
   se ejecuta y audita igual que hoy, pero **nunca bloquea** esta
   operación, sin importar el resultado. Prueba explícita de que habilitar
   un rol no afecta a los demás.
9. Rol primario no incluido en la lista y excepción durante la evaluación
   sombra — la excepción se registra, la operación real conserva el
   comportamiento previo (shadow-only), sin bloquear. Complementa el caso
   7: el fail-closed de la decisión 3 aplica solo al rol habilitado, no
   globalmente.
10. La comparación entre el rol primario y las entradas de
    `EnforceScopeOnUpdateAttributeRoles` es case-insensitive
    (`StringComparer.OrdinalIgnoreCase`) y no acepta coincidencias
    parciales — `"dragonhelp"` habilita, `"Dragon"` no.

## Validación

- `dotnet build` + toda la suite existente (76 tests) sin cambios.
- Los 10 casos nuevos en verde.
- Deploy a Development **con la lista de roles habilitados vacía** —
  confirmar que el comportamiento sigue siendo shadow-only (repetir
  alguna de las pruebas ya hechas con `DragonHelp`, mismo resultado que
  hoy).
- **No agregar ningún rol a la lista en Development real** hasta que ese
  rol específico cumpla los 5 criterios de la Decisión 1 — activar un rol
  no es parte de "terminar" este incremento, es un paso posterior y
  separado, y se decide rol por rol, no todos a la vez.

## Riesgos

- **El riesgo real de este incremento no es de código, es de cobertura de
  datos** — `RoleScopeAssignment` incompleta para algún rol se traduce
  directamente en usuarios reales bloqueados de operaciones que hoy
  hacen sin problema. Por eso la precondición está al principio del
  documento, no al final.
- **Fail-closed ante excepción (decisión 3) es una inversión respecto de
  C** — hay que ser explícito en el código y en las pruebas de que esto
  es intencional, para que nadie lo confunda con una regresión de la
  garantía "nunca falla" que definía al modo sombra.
- **Los 3 roles fuera del alcance inicial (`Seguridades`, `RRHH`,
  `Registro`) pueden quedar indefinidamente en modo sombra** si nadie
  prioriza completar sus criterios de activación (Decisión 1) — el
  interruptor por rol resuelve el riesgo de bloqueo accidental, pero
  traslada el riesgo a que la cobertura real de ámbitos nunca se complete
  para esos roles. Vale la pena revisitar este punto explícitamente
  cuando se cierre el Incremento D, no asumir que se resuelve solo.

## Resultados reales de la implementación (2026-07-28)

Implementado exactamente según lo aprobado, sin desviaciones de diseño.

**Archivos nuevos:**
- `AccountGovernance.Application/Interfaces/IScopeEnforcementPolicy.cs` —
  contrato `bool IsEnforced(RoleName role)`.
- `AccountGovernance.Infrastructure/Authorization/ScopeEnforcementOptions.cs`
  — opciones (`Authorization`, `EnforceScopeOnUpdateAttributeRoles`, default `[]`).
- `AccountGovernance.Infrastructure/Authorization/ScopeEnforcementPolicy.cs`
  — implementación con la normalización completa de la Decisión 1 (trim,
  vacíos, duplicados, `OrdinalIgnoreCase`, warning en nombres desconocidos
  sin romper el arranque).
- `backend/tests/.../Authorization/ScopeEnforcementPolicyTests.cs` — 9
  pruebas, cubren el caso de prueba 10 completo.
- `backend/tests/.../UserServiceScopeEnforcementTests.cs` — 9 métodos de
  prueba cubriendo los casos 1 a 9 (el caso 4/5/6 se implementó como un
  `[Theory]` de 3 variantes, ya que `UserService` solo distingue
  `Outcome`, no el motivo específico de denegación).

**Archivos modificados:**
- `UserService.cs` — `RunShadowEvaluationAsync` ahora recibe `effectiveRole`
  y `IScopeEnforcementPolicy`, devuelve `bool` (bloqueado o no) en vez de
  `void`; `UpdateAttributeAsync` corta con `FORBIDDEN` cuando devuelve
  `true`. El log `[SHADOW-AUTH]` ganó dos campos nuevos: `enforcement` y
  `bloqueado`.
- `Infrastructure/DependencyInjection.cs` — registro de
  `ScopeEnforcementOptions` (bind) + `IScopeEnforcementPolicy` (singleton).
- `appsettings.json` — sección `Authorization.EnforceScopeOnUpdateAttributeRoles: []`.
  `appsettings.Development.json` **no se tocó**, tal como exige la Decisión 4.
- `UserServiceShadowEvaluationTests.cs` — el fixture existente de C ganó el
  mock de `IScopeEnforcementPolicy` con `IsEnforced` devolviendo `false` por
  defecto, para que las 8 pruebas originales de C sigan probando exactamente
  el mismo comportamiento sin modificarlas.

**Validación real ejecutada:**
- `dotnet build`: correcto, 0 advertencias, 0 errores.
- `dotnet test`: **94/94 en verde** (76 preexistentes sin cambios + 18
  nuevas: 9 de `ScopeEnforcementPolicyTests` + 9 de
  `UserServiceScopeEnforcementTests`).
- Búsqueda de todo el backend por `UpdateUserAttributeAsync` /
  `SetAccountEnabledAsync` (los dos únicos métodos de escritura de
  atributo/estado individual en `IAdGateway`): confirmado que **solo
  `UserService.cs` los invoca** — no existe otro camino que edite
  atributos de usuario eludiendo `UpdateAttributeAsync`/
  `UpdateAccountStatusAsync`. Los demás métodos de escritura de
  `IAdGateway` (`CreateUserAsync`, `AddUserToGroupAsync`, listas de
  distribución, etc.) son operaciones estructuralmente distintas, ya
  excluidas del alcance de D.
- Deploy a Development y activación de `DragonHelp` en la lista: **no
  ejecutados todavía** — quedan como pasos operativos separados y
  posteriores, según las Decisiones 4 y la sección Validación de arriba.
