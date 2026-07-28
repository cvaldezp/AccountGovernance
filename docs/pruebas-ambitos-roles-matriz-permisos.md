# Guía de pruebas funcionales — Ámbitos Administrativos y Roles y Grupos

> Ambiente: **Development** — `https://account-governance-int.usfq.edu.ec`
> Commit desplegado al momento de escribir esta guía: `f7a0925`
> Audiencia: Usuario Funcional (sin conocimientos técnicos previos requeridos)

## Antes de empezar — respuesta a la pregunta clave

**¿"Ámbitos Administrativos" y "Roles y Grupos" están relacionados entre sí? Sí.**
**¿Están relacionados con "Matriz de Permisos"? No, todavía no.**

Para que las pruebas tengan sentido, es importante entender esto de entrada:

| Relación | ¿Existe hoy? | Detalle |
|---|---|---|
| Ámbitos Administrativos ↔ Roles y Grupos | ✅ Sí | Desde cada rol, en "Roles y Grupos", se le pueden asignar uno o más Ámbitos. Esa asignación es visible desde las dos pantallas (es la misma información mostrada de dos formas distintas). |
| Ámbitos Administrativos / Roles y Grupos ↔ Matriz de Permisos | ❌ No | La Matriz de Permisos es un módulo completamente aparte. Define qué **campos** de un usuario (nombre, correo, cargo, etc.) puede ver o editar cada rol — no tiene ninguna noción de "Ámbito" todavía. |
| ¿Asignar un Ámbito a un Rol restringe algo de verdad? | ❌ No, todavía | La propia pantalla lo dice explícitamente: *"Configuración preparatoria. Las asignaciones entre roles y ámbitos todavía no restringen las operaciones sobre Active Directory."* Es decir: hoy podés guardar la relación, pero **no cambia nada** en lo que un usuario puede o no hacer sobre una cuenta real. Eso está planeado para una etapa futura.

**Qué significa esto para las pruebas**: vas a probar que la información se guarda correctamente y que las dos pantallas la muestran de forma consistente entre sí — no vas a poder probar "que alguien quede bloqueado de algo" todavía, porque esa parte no está construida aún. Si en algún momento esperás ver un efecto de bloqueo/restricción y no lo ves, **no es un error** — es el comportamiento esperado de esta etapa.

### El "Base DN" del Ámbito y el "Grupo AD" del Rol no son lo mismo

Es fácil confundirlos porque los dos son cosas de Active Directory, pero cumplen roles distintos:

| | **Grupo AD** (en "Roles y Grupos") | **Base DN** (en "Ámbitos Administrativos") |
|---|---|---|
| Qué es | Un grupo de seguridad de AD (ej. `account-seg`) | Una carpeta/ubicación (OU) dentro del árbol de AD |
| Para qué sirve | Determina **quién tiene el Rol** — si tu cuenta es miembro de ese grupo, obtenés ese Rol | Determina **qué población de cuentas cubre el Ámbito** |
| Es sobre | El **operador** (quien usa el sistema) | Las **cuentas administradas** (sobre quién se actúa) |

**No hay ninguna relación técnica automática entre los dos** — el Grupo AD de un Rol puede estar en cualquier parte del árbol, y el Base DN de un Ámbito puede apuntar a una carpeta totalmente distinta, sin conexión estructural entre ambos. La única relación que existe es la que se crea **manualmente** en el paso 2.3 ("asignar este Ámbito a este Rol") — y como ya se explicó, esa asignación todavía no tiene ningún efecto real.

## Requisitos previos

- Acceso a `https://account-governance-int.usfq.edu.ec` con una cuenta de dominio USFQ.
- **Tu cuenta debe pertenecer al rol `SystemAdmin`** — "Ámbitos Administrativos" y "Roles y Grupos" son exclusivas de ese rol; si tu cuenta no lo tiene, ni siquiera vas a ver esas opciones en el menú lateral. Si no estás seguro de tener este rol, coordinalo con el equipo técnico antes de empezar.
- Un navegador actualizado (Chrome/Edge recomendado).
- Tener a mano un nombre de **Base DN** de prueba (la ubicación dentro de Active Directory que vas a usar para el Ámbito de prueba) — pedíselo al equipo técnico si no lo tenés; **no inventes uno**, porque el sistema va a intentar validarlo contra Active Directory real al activarlo.

## Parte 1 — Ámbitos Administrativos

Menú lateral → **Ámbitos Administrativos**.

### 1.1 Crear un Ámbito nuevo (queda como borrador)

1. Hacer clic en **"+ Nuevo Ámbito"**.
2. Completar:
   - **ScopeKey** (identificador único, en minúsculas, sin espacios — ej. `prueba-funcional-01`). *Anotalo, no se puede cambiar después.*
   - **Nombre** (ej. "Prueba funcional — Empleados de prueba").
   - **Descripción** (opcional).
   - **Categoría** (opcional). Es un campo puramente cosmético: una
     etiqueta de texto libre para organizar visualmente la lista de
     Ámbitos cuando haya muchos (ej. "Facultades", "Administrativo",
     "Prueba"). No se valida contra nada y no afecta el comportamiento del
     sistema — se puede dejar vacía sin problema.
   - **Base DN** — el que te haya dado el equipo técnico. Este campo sí es
     importante, con más detalle:
     - **Qué es**: "DN" (*Distinguished Name*) es la "dirección completa"
       de una carpeta dentro de Active Directory (el sistema donde viven
       todas las cuentas de usuario de la universidad) — equivalente a una
       ruta de carpetas en una unidad compartida, pero con su propia
       sintaxis. Ejemplo: `OU=Empleados,OU=Cumbaya,DC=usfq,DC=edu,DC=ec` se
       lee de adentro hacia afuera: la carpeta "Empleados", dentro de la
       carpeta "Cumbaya", dentro del dominio `usfq.edu.ec`.
     - **Para qué se usa**: define qué porción de Active Directory abarca
       el Ámbito — es el límite estructural. Todo lo que esté dentro de esa
       carpeta (y sus subcarpetas) queda "bajo" ese Ámbito.
     - **Por qué tiene que ser real**: al activar el Ámbito (paso 1.4), el
       sistema consulta Active Directory de verdad para confirmar que esa
       carpeta existe — si no existe, la activación se rechaza con error.
       No se puede inventar un valor esperando que funcione.
     - **Por qué te lo tiene que dar el equipo técnico**: para no
       arriesgarte a apuntar por error a una carpeta productiva importante
       (ej. la de todos los empleados reales) — necesitás que alguien que
       conozca la estructura real de AD de la universidad te indique una
       carpeta apropiada para pruebas.
     - **Cómo se va a usar más adelante**: hoy este valor solo se guarda,
       no restringe nada (ver la aclaración al inicio de esta guía). En una
       etapa futura, el sistema lo usará para determinar automáticamente si
       una cuenta de AD "pertenece" a este Ámbito.
   - **Connection Profile** — dejar el valor por defecto salvo que te indiquen otro.
   - **Prioridad** — dejar el valor por defecto (no afecta el comportamiento, solo el orden visual).
3. Hacer clic en **"Crear como borrador"**.

**Resultado esperado**: el Ámbito aparece en la lista de la izquierda con la etiqueta **"inactivo"**. Esto es correcto — todo Ámbito nuevo nace inactivo, a propósito.

### 1.2 Editar la información general

1. Hacer clic sobre el Ámbito recién creado, en la lista.
2. Hacer clic en **"Editar"**.
3. Cambiar el Nombre o la Descripción.
4. Hacer clic en **"Guardar"**.

**Resultado esperado**: los cambios se reflejan de inmediato en la ficha. El **ScopeKey no se puede editar** (aparece bloqueado/gris) — es intencional.

### 1.3 Agregar un filtro de pertenencia

**Importante antes de empezar**: al igual que el Base DN y la asignación
Rol↔Ámbito, **hoy ningún filtro se evalúa contra usuarios reales todavía**.
El sistema valida que el filtro esté completo (que tenga los campos
obligatorios según el operador elegido), pero no ejecuta ninguna
comparación real contra Active Directory — eso queda para una etapa
futura. Configurarlo ahora sirve para dejarlo listo, no para que empiece a
filtrar nada hoy.

1. Con el Ámbito seleccionado, en la sección **"Filtros"**, hacer clic en **"+ Agregar filtro"**.
2. Completar:
   - **Tipo de filtro** — etiqueta libre, solo descriptiva (ej.
     "ExtensionAttribute", "Company", "Domain"). No afecta nada
     técnicamente, es para que se entienda de un vistazo qué tipo de
     criterio es.
   - **Atributo AD** — el nombre técnico exacto del atributo de Active
     Directory que se evaluará sobre cada usuario (ej. `company`,
     `extensionAttribute7`). Tiene que coincidir con el nombre real del
     atributo en AD.
   - **Operador** — define cómo se compara ese atributo contra el Valor.
     Son 4 opciones cerradas (no se puede escribir una condición libre):
     - `Equals` — el valor del atributo debe ser **exactamente igual** al
       Valor indicado.
     - `NotEquals` — debe ser **distinto**.
     - `In` — debe coincidir con **alguno de una lista** (separados por
       comas en el Valor).
     - `Exists` — alcanza con que el atributo **tenga algún valor
       cargado** (no importa cuál) — por eso acá no se pide Valor.
   - **Valor** — el dato contra el que se compara. No aplica si el
     operador es `Exists`.
3. Hacer clic en **"Guardar"**.

**Resultado esperado**: el filtro aparece listado dentro de la ficha del Ámbito, marcado como activo.

**Ejemplo trabajado**: un Ámbito con Base DN
`OU=Cloud,OU=STUDENTS,OU=USERS,OU=Cumbaya,DC=usfq,DC=edu,DC=ec`, con un
filtro que exige que `extensionAttribute7` tenga literalmente el texto
"Activado":

```
Tipo de filtro: ExtensionAttribute
Atributo AD:    extensionAttribute7
Operador:       Equals
Valor:          Activado
```

**Advertencia sobre `Equals`**: compara **texto exacto**. Antes de
cargarlo, confirmá con el equipo de AD cómo está guardado literalmente ese
valor hoy en los usuarios reales (¿"Activado" con mayúscula inicial?
¿"activado" en minúsculas? ¿con o sin tilde?) — si no coincide carácter por
carácter, el día que esto empiece a evaluarse de verdad, no va a matchear.
Como el evaluador todavía no existe, hoy no hay forma de probar esto en
vivo — solo de dejarlo bien configurado para cuando exista.

### 1.4 Activar el Ámbito

1. Con el Ámbito seleccionado (y ya con Base DN cargado), hacer clic en **"Activar"**.

**Resultado esperado (camino feliz)**: si el Base DN existe realmente en Active Directory, el estado cambia a **"activo"**.

**Resultado esperado (Base DN inválido)**: si el Base DN no existe en Active Directory, el sistema debe **rechazar la activación** con un mensaje de error — esto es una validación real contra AD, no cosmética. Vale la pena probarlo a propósito una vez con un Base DN inventado, para confirmar que el sistema efectivamente lo bloquea.

### 1.5 Inactivar el Ámbito

1. Con el Ámbito activo, hacer clic en **"Inactivar"**.

**Resultado esperado**: vuelve a "inactivo". Se puede reactivar después sin perder la configuración ni los filtros.

## Parte 2 — Roles y Grupos

Menú lateral → **Roles y Grupos**.

### 2.1 Revisar los roles existentes

**Resultado esperado**: se listan los roles del sistema (`SystemAdmin`, `Seguridades`, `RRHH`, `Registro`, `DragonHelp`), cada uno con su nombre visible, prioridad, y sus grupos de Active Directory asociados.

### 2.2 Editar metadatos de un rol

1. Elegir un rol (idealmente uno que **no** sea `SystemAdmin`, para no arriesgar tu propio acceso).
2. Hacer clic en **"Editar rol"**.
3. Cambiar la Descripción (evitar tocar Prioridad o el checkbox "Activo" salvo que sepas exactamente qué estás probando — desactivar un rol afecta a todos los usuarios que dependen de él).
4. Guardar.

**Resultado esperado**: el cambio se refleja de inmediato.

### 2.3 Asignar el Ámbito de prueba a un rol

1. En el rol que uses de prueba, bajar hasta la sección **"Ámbitos Administrativos"** (dentro de la misma tarjeta del rol).
2. Hacer clic en **"+ Agregar ámbito"**.
3. En el desplegable, elegir el Ámbito creado en la Parte 1 — **solo va a aparecer si está activo** (paso 1.4). Si no lo ves en la lista, confirmá que quedó activo.
4. Guardar.

**Resultado esperado**: el Ámbito aparece listado en esa sección, con la etiqueta "activo", y el mensaje ya conocido de que todavía no restringe nada.

### 2.4 Inactivar / reactivar la asignación

1. Sobre la asignación recién creada, hacer clic en **"Inactivar"**.
2. Confirmar que cambia a "inactivo".
3. Hacer clic en **"Reactivar"**.

**Resultado esperado**: alterna correctamente entre los dos estados. **No debería aparecer nunca un botón para "eliminar" la asignación** — por diseño, solo se activa/inactiva, nunca se borra (esto es intencional, no un botón faltante).

## Parte 3 — Verificación cruzada (las dos pantallas deben coincidir)

Esta es la prueba más importante de esta guía, porque confirma que ambas pantallas leen la misma información real.

1. Volver a **Ámbitos Administrativos**.
2. Seleccionar el mismo Ámbito de prueba.
3. Bajar hasta la sección **"Roles con este ámbito asignado"**.

**Resultado esperado**: el rol que usaste en la Parte 2 aparece ahí, con el mismo estado (activo/inactivo) que dejaste en "Roles y Grupos". Si inactivás/reactivás desde una pantalla y volvés a la otra, el cambio debe reflejarse sin necesidad de nada especial (puede requerir recargar la página).

> Nota: esta vista desde "Ámbitos Administrativos" es **de solo lectura** — no vas a encontrar ahí un botón para asignar o quitar; eso solo se hace desde "Roles y Grupos". Es esperado.

## Parte 4 — Qué NO debería pasar (importante para no reportar falsos errores)

Probá esto a propósito, para confirmar que el comportamiento actual es el esperado:

- Asignale el Ámbito de prueba a un rol, y luego probá una operación normal sobre una cuenta de Active Directory (buscar un usuario, ver su ficha, etc.) usando un usuario que tenga ese rol. **No debería notarse ningún cambio de comportamiento** — el Ámbito no bloquea ni habilita nada todavía. Si notás algún cambio, sí es importante reportarlo.
- Entrá a **Matriz de Permisos** y confirmá que **no hay ninguna mención a Ámbitos** en esa pantalla — es un módulo aparte (ver Parte 5).

## Parte 5 — Matriz de Permisos (prueba independiente, sin relación con lo anterior)

Menú lateral → **Matriz de Permisos**. Esta prueba es opcional y separada — inclúyela solo si también querés cubrir este módulo.

1. Confirmar que se ve una tabla con **atributos de usuario** (Nombre, Correo, Cargo, etc.) en las filas y **roles del sistema** en las columnas.
2. Confirmar que cualquier usuario autenticado puede **ver** esta matriz (no hace falta ser `SystemAdmin` para mirarla).
3. Si tu cuenta es `SystemAdmin`: hacer clic sobre una celda de un rol que **no** sea `SystemAdmin`, alternar entre "Sin acceso" / "Ver" / "Editar", y guardar.

**Resultado esperado**: el cambio se guarda y se refleja en la matriz. La fila de `SystemAdmin` no se puede editar — tiene acceso total fijo por diseño, no depende de esta tabla.

**Recordatorio**: nada de lo que cambies acá tiene ninguna relación con los Ámbitos Administrativos ni con las asignaciones de la Parte 2 — son dos sistemas independientes hoy.

## Plantilla de registro de resultados

| # | Caso | Resultado esperado | OK / Falla | Observaciones |
|---|---|---|---|---|
| 1.1 | Crear Ámbito | Aparece como "inactivo" | | |
| 1.2 | Editar Ámbito | Cambios guardados, ScopeKey bloqueado | | |
| 1.3 | Agregar filtro | Filtro visible en la ficha | | |
| 1.4a | Activar con Base DN válido | Pasa a "activo" | | |
| 1.4b | Activar con Base DN inválido | Rechazado con error | | |
| 1.5 | Inactivar Ámbito | Vuelve a "inactivo" | | |
| 2.1 | Ver roles | Lista completa de 5 roles | | |
| 2.2 | Editar rol | Cambios guardados | | |
| 2.3 | Asignar Ámbito a rol | Aparece en la sección, activo | | |
| 2.4 | Inactivar/reactivar asignación | Alterna correctamente, sin opción de eliminar | | |
| 3 | Verificación cruzada | Ambas pantallas muestran el mismo estado | | |
| 4 | Sin efecto real sobre AD | Ninguna operación real cambia de comportamiento | | |
| 5 | Matriz de Permisos, sin relación | Módulo aparte, sin mención de Ámbitos | | |

## Glosario breve

- **Ámbito Administrativo (Scope)**: una definición de "qué parte de Active Directory" (una carpeta/OU + criterios opcionales) — todavía no restringe nada por sí sola.
- **ScopeKey**: identificador técnico único de un Ámbito, no editable después de crearlo.
- **Base DN**: la ruta dentro de Active Directory que define el Ámbito (ej. una carpeta de empleados).
- **Rol**: perfil de acceso al sistema (`SystemAdmin`, `Seguridades`, `RRHH`, `Registro`, `DragonHelp`), determinado por a qué grupos de Active Directory pertenece cada usuario.
- **Matriz de Permisos**: tabla que define qué campo de un usuario puede ver/editar cada rol — no tiene relación con los Ámbitos todavía.
