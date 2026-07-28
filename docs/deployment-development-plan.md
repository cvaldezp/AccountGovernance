# Plan de despliegue — Ambiente Development

> Estado: **Ejecutado — deploy completado el 2026-07-28 10:08 vía
> `docs/Scripts/Deploy-AccountGovernance-Development.ps1`.** Commit
> desplegado: `aafc657` (`wip/incremento-3-role-scope-assignment`).
> Servidor: `D-ACC-FEN-01`, App Pool `account-governance-int` — valores
> confirmados por el propio despliegue exitoso, resolviendo los pendientes
> de correlación de la sección 4a. Detalle de la ejecución en la sección 7.

## 7. Resultado de la ejecución (2026-07-28)

- **Script usado**: `docs/Scripts/Deploy-AccountGovernance-Development.ps1`
  (no generado en esta conversación — aportado por el usuario, revisado
  completo antes de ejecutar).
- **Build frontend**: `npm ci` (157 paquetes) + `npm run build -- --mode
  development` → `dist/` generado sin errores (`index.html` + assets,
  ~697 KB JS / 17 KB CSS). Nota ya señalada antes de ejecutar: este comando
  **no** pasa por el gate `check-env.mjs` de `build:development` — no tuvo
  consecuencia esta vez porque `.env.development` ya era válido, pero
  sigue siendo una diferencia real respecto del comando "definitivo" de la
  sección 5.1.
- **Pruebas backend**: `dotnet test` (Release) → **31/31 correctas**.
- **Publish backend**: `dotnet publish -c Release
  /p:EnvironmentName=Development` → exitoso, `C:\Publish\AccountGovernance`.
- **Respaldo remoto**: creado antes de tocar nada activo —
  `\\D-ACC-FEN-01\C$\inetpub\backups\account-governance-int\20260728_100803`
  (referencia para rollback manual si hiciera falta más adelante).
- **Copia**: frontend → `\\D-ACC-FEN-01\C$\inetpub\account-governance-int`
  (excluyendo `api`), backend →
  `...\account-governance-int\api` (excluyendo `logs` y
  `appsettings.*.json`). `appsettings.Development.json` del servidor
  preservado y restaurado tal cual estaba — no se sobrescribió con la
  versión placeholder del repo.
- **App Pool**: detenido antes de copiar, reiniciado después — sin
  intervención manual necesaria.
- **Validación posterior**: `GET /api/health` → `503` en los primeros dos
  intentos (proceso ASP.NET Core recién reiniciado, arranque en curso),
  `200` en el tercero — comportamiento esperado, no un fallo.
  `GET https://account-governance-int.usfq.edu.ec` → `200` de inmediato.
- **Rollback**: no se activó — el script nunca entró al bloque de error.
- **Validación funcional (SQL + AD)**: confirmada por el usuario tras el
  deploy — login vía Entra ID + carga del dashboard resolvió `GET
  /api/auth/me` correctamente, lo que ejercita en una sola request tanto
  LDAP (`P-AD-DS-04.usfq.edu.ec`, `memberOf`) como SQL
  (`D-SQL-DB-10`, `gov.SystemRoles`/`SystemRoleGroups`). Con esto, el
  deploy queda validado de punta a punta: build, tests, publish, copia,
  respaldo, liveness y dependencias externas reales.

**Cierre**: deploy de `wip/incremento-3-role-scope-assignment` (commit
`aafc657`) a Development completado y validado sin necesidad de rollback.

### Redeploy — 2026-07-28 10:47

Commit `f7a0925` (`feat(frontend): panel "Acerca de" con versión/commit/
build reales en el sidebar`). Mismo procedimiento, mismo resultado limpio:
31/31 tests, respaldo `20260728_104647`, `appsettings.Development.json`
preservado, health en `200` al tercer intento (warm-up normal), frontend
`200` inmediato. Sin rollback. El panel "Acerca de" del sidebar ahora debe
mostrar `v1.0.0 · f7a0925` en el ambiente — pendiente de confirmación
visual por el usuario.

## 1. Estado exacto a desplegar

- **Rama**: `wip/incremento-3-role-scope-assignment`.
- **HEAD**: `aafc657` (`docs(authorization): add approved ADR and frozen architecture`).
- **Últimos commits**:
  ```
  aafc657 docs(authorization): add approved ADR and frozen architecture
  5629dc3 refactor(authorization): centralize SystemAdmin controller checks
  b1e0294 feat(role-scope-assignment): nota de configuración preparatoria en UI
  b124370 wip(role-scope-assignment): resguardo temporal del Incremento 3
  0d87882 feat(account-creation): Incremento 2.1 - politica de nombres de cuenta configurable
  ```
- **Working tree**: limpio (`nothing to commit`), sincronizado con
  `origin/wip/incremento-3-role-scope-assignment` (ya publicado, ver
  sesión anterior). No hay cambios sin commitear.
- **Frontend y backend incluidos**: sí, ambos — no hay commits pendientes
  de un lado y no del otro; la rama contiene el estado completo de los dos.
- **Build**: `dotnet build backend/AccountGovernance.sln` → **0
  advertencias, 0 errores** (verificado en esta sesión, antes de escribir
  este plan).
- **Pruebas**: `dotnet test backend/tests/AccountGovernance.Api.Tests` →
  **31/31 correctas** (verificado en esta sesión).
- **No verificado en esta fase** (deliberadamente, para no ejecutar nada
  todavía): build de producción del frontend (`npm run build:development`)
  y lint. Se incluyen como paso explícito de la estrategia de despliegue
  (sección 5), no como parte de esta verificación de estado.

## 2. Backend

- **Framework y versión objetivo**: .NET 8 (`net8.0`), confirmado en los
  4 `.csproj` de `backend/src/`. SDK disponible en esta máquina: `10.0.302`
  (compila `net8.0` sin problema, ya verificado). **En el servidor** hace
  falta el **ASP.NET Core Hosting Bundle 8.0** (no el SDK completo) para
  que IIS pueda alojar la app in-process — su presencia en el servidor de
  Development es un pendiente explícito (sección 4).
- **Ruta del proyecto publicable**:
  `backend/src/AccountGovernance.Api/AccountGovernance.Api.csproj`
  (referencia en cascada a `AccountGovernance.Infrastructure` →
  `AccountGovernance.Application` → `AccountGovernance.Domain`; `dotnet
  publish` sobre el `.csproj` de `Api` arrastra las tres).
- **Método correcto de `dotnet publish`**: el propio `.csproj` ya define
  `EnvironmentName` con default `Development` (líneas 13-15) y un target
  `SetWebConfigEnvironment` que solo reescribe `ASPNETCORE_ENVIRONMENT` en
  el `web.config` **publicado** (nunca en el archivo fuente) cuando se pasa
  `-p:EnvironmentName=...`. Para Development, **no hace falta pasar ese
  parámetro** — es el default:
  ```
  dotnet publish backend/src/AccountGovernance.Api/AccountGovernance.Api.csproj -c Release -o <carpeta-publicación>
  ```
  (Comando propuesto, no ejecutado — la carpeta de salida real depende de
  la estrategia de la sección 5, no de una ruta fija en el repo.)
- **Configuración esperada para Development**: `appsettings.Development.json`
  ya existe en el repo y ya apunta a la infraestructura real de Development
  (no son valores de ejemplo):
  - SQL: `Server=D-SQL-DB-10;Database=USFQ_AccountManager;Trusted_Connection=True;TrustServerCertificate=True;`
  - AD: `Server=P-AD-DS-04.usfq.edu.ec`, `BaseDn=OU=USERS,OU=Cumbaya,DC=usfq,DC=edu,DC=ec`, `Domain=USFQ`, `Username=srvaccount`
  - Entra ID (`AzureAd`): `TenantId=9f119962-8c62-431c-a8ef-e7e0a42d11fc`,
    `ClientId=903db22a-47ad-4c29-8594-88c557c9e456`,
    `Audience=api://903db22a-47ad-4c29-8594-88c557c9e456`
  - `dotnet publish` incluye `appsettings.json` +
    `appsettings.Development.json` automáticamente (son `Content` items
    por convención del SDK Web); no hace falta copiarlos aparte.
- **Contenido y función del `web.config` existente**
  (`backend/src/AccountGovernance.Api/web.config`): configura el módulo
  `AspNetCoreModuleV2` en modo **in-process**, apunta a
  `.\AccountGovernance.Api.dll`, deshabilita `stdoutLogEnabled` por
  defecto (Serilog ya escribe a `logs/accountgovernance-*.log` y a
  consola — el log de stdout de IIS sería redundante salvo para depurar un
  fallo de arranque muy temprano, antes de que Serilog levante), y fija
  `ASPNETCORE_ENVIRONMENT=Development` — coincide con el ambiente destino,
  no requiere edición manual para este deploy.
- **Variables de entorno requeridas**: ninguna adicional más allá de lo
  que ya fija `web.config` (`ASPNETCORE_ENVIRONMENT=Development`). El
  secreto de AD (`ActiveDirectory:Password`) **no** está en
  `appsettings.Development.json` (placeholder `"USE_DOTNET_USER_SECRETS"`)
  — cómo se suministra ese valor en el servidor real es un **pendiente
  crítico**, ver sección 4 y el riesgo asociado en sección 5.
- **Archivos `appsettings` necesarios**: `appsettings.json` (base) +
  `appsettings.Development.json` (override) — ambos ya versionados en el
  repo, sin cambios necesarios para este deploy.
- **Dependencias externas**:
  - **SQL Server** `D-SQL-DB-10`, base `USFQ_AccountManager`, autenticación
    **Windows Integrada** (`Trusted_Connection=True`) — la identidad que
    necesita el acceso es la del **App Pool**, no un usuario/password en la
    cadena de conexión.
  - **Active Directory** `P-AD-DS-04.usfq.edu.ec`, bind LDAP con el usuario
    de servicio `srvaccount` (credencial separada de la identidad del App
    Pool, resuelta vía configuración/secreto, no vía Windows Integrated).
  - **Entra ID**: valida tokens JWT contra el tenant/App Registration ya
    configurados (`AzureAd` arriba) — requiere que el servidor tenga
    salida a `https://login.microsoftonline.com` (HTTPS saliente).
  - **CORS**: la política `"Frontend"` (`Program.cs:86-92`) solo aplica
    orígenes cross-origin; como el frontend se sirve como **child
    application `/api` bajo el mismo sitio IIS** (mismo origen, confirmado
    por el comentario de `vite.config.ts` y por el patrón ya documentado en
    `.env.development`), **CORS no debería necesitar ningún origen
    adicional para este despliegue** — el default (`http://localhost:5173`,
    solo relevante para desarrollo local) no se usa en Development real.
- **Permisos requeridos por el App Pool**:
  - Lectura/ejecución sobre la carpeta de publicación del backend.
  - Escritura sobre `logs/` (Serilog escribe archivo diario ahí,
    `appsettings.json:13-19`) — sin este permiso el proceso puede arrancar
    igual (Serilog no aborta por fallo de sink) pero sin logging a
    archivo.
  - Acceso de red a `D-SQL-DB-10` vía su identidad (SQL Windows Integrado)
    — pendiente confirmar qué identidad corre el App Pool y si ya tiene
    ese acceso otorgado (sección 4).
  - Salida HTTPS a `login.microsoftonline.com` (Entra ID) y salida LDAP
    (puerto 389, `UseSSL=false` en el default base) a
    `P-AD-DS-04.usfq.edu.ec`.
- **Health endpoint disponible para validación**: `GET /health`
  (`Program.cs:116-124`) — **liveness únicamente**, sin healthchecks
  registrados, **no toca SQL ni AD** (comentario explícito en el código:
  "Readiness (AD/DB connectivity) is a separate concern, not implemented
  here"). Responde `{"status":"Healthy"}` con `200` si el proceso
  arrancó — **no sirve para validar conectividad a SQL/AD**, eso requiere
  una prueba funcional real (sección 5, "Validación de backend").
  Anónimo — no requiere token.

## 3. Frontend

- **Ubicación del proyecto**: `frontend/` (raíz del repo).
- **Comando de instalación**: `npm install` (o `npm ci` si se quiere
  respetar exactamente `package-lock.json`, más apropiado para un
  build reproducible de deploy).
- **Comando de build**: existe un script **ya dedicado a Development**:
  ```
  npm run build:development
  ```
  (`package.json:9`) — ejecuta `node scripts/check-env.mjs development`
  (gate que exige `.env.development` real, sin placeholders, para
  `VITE_AZURE_CLIENT_ID`/`VITE_AZURE_TENANT_ID`/`VITE_AZURE_API_SCOPE`),
  luego `tsc -b` (typecheck) y `vite build --mode development`.
- **Archivo `.env`/`.env.development` requerido**: **ya existe en el
  repo**, `frontend/.env.development`, con valores reales (no placeholder)
  para el ambiente Development — confirmado por su propio comentario:
  *"Ambiente Development publicado en IIS:
  https://account-governance-int.usfq.edu.ec"*. No hace falta crearlo.
- **Variables `VITE_` necesarias** (`REQUIRED_KEYS` en `check-env.mjs:13`):
  `VITE_AZURE_CLIENT_ID`, `VITE_AZURE_TENANT_ID`, `VITE_AZURE_API_SCOPE` —
  las tres ya tienen valores reales en `.env.development`. Además
  `VITE_USE_MOCK_DATA=false` (no usa datos simulados).
- **Ruta base de la API**: **no existe** `VITE_API_BASE_URL` — el frontend
  llama siempre por ruta relativa `/api/...`, resuelta contra el mismo
  origen. Esto depende de que IIS/HAProxy efectivamente sirvan el backend
  bajo el path `/api` del mismo sitio — confirmado como patrón ya
  establecido (comentario en `vite.config.ts:9-13`), pero la
  configuración real de ese enrutamiento en el servidor de Development es
  un pendiente a confirmar (sección 4), no algo que este repo controle.
- **Comportamiento de rutas SPA**: la app **no usa `react-router` ni
  manipula la URL del navegador** (`history.pushState`/`popstate`) —
  confirmado por ausencia total de esas referencias en
  `frontend/src/routes/AppRoutes.tsx` y por `0` ocurrencias de
  `react-router` en `package-lock.json`. La navegación interna es
  enteramente en memoria (switch sobre un estado `currentRoute`). El login
  de Entra ID usa `loginRedirect` con `redirectUri: window.location.origin`
  (`msalConfig.ts:11`) — vuelve siempre a la raíz `/`, nunca a una
  subruta. **Conclusión**: no hay URLs profundas que IIS deba resolver a
  `index.html` — la app entera vive en `/`. Ver matiz en sección 4 (URL
  Rewrite).
- **Contenido generado en `dist/`**: no personalizado en
  `vite.config.ts` (sin sección `build.outDir`) — sale al default de Vite,
  `frontend/dist/`, con `index.html` + assets con hash + `favicon.svg` +
  `fonts/` (copiados desde `frontend/public/`, según referencia en
  `index.html:6`).
- **Requisitos de IIS para servir React**: sitio o child application
  configurado para servir contenido estático desde `dist/`, con
  `index.html` como documento por defecto. **No parece necesario el
  módulo URL Rewrite para fallback SPA** (dado el punto anterior — sin
  rutas profundas), pero queda como pendiente de confirmación explícita en
  sección 4, no como una certeza absoluta — no se puede descartar sin ver
  la configuración real del sitio.

## 4. Servidor destino — pendientes explícitos (nada asumido)

No se completa nada de esto sin que lo confirmes:

- [ ] **Nombre del servidor** (hostname/IP de la máquina Windows real —
  distinto del hostname público `account-governance-int.usfq.edu.ec`, que
  es el nombre externo/HAProxy, no necesariamente el nombre de la máquina
  IIS).
- [ ] **Ruta física del backend** en el servidor (carpeta donde hoy vive
  la publicación actual, si existe una — para saber si esto es una
  actualización in situ o una carpeta nueva).
- [ ] **Ruta física del frontend** en el servidor.
- [ ] **Nombre del sitio IIS** (y si el backend es efectivamente una
  *child application* `/api` bajo ese mismo sitio, como sugiere el código,
  o un sitio/puerto separado detrás de HAProxy).
- [ ] **Nombre de los App Pools** (backend y frontend, si son distintos;
  el frontend estático normalmente no necesita App Pool .NET, pero
  depende de cómo esté armado el sitio hoy).
- [ ] **Bindings y hostnames** configurados en IIS para este sitio.
- [ ] **HTTPS y certificado** — `account-governance-int.usfq.edu.ec` es
  HTTPS; confirmar si el certificado ya está instalado y vigente en el
  servidor IIS o si la terminación TLS ocurre en HAProxy (más probable,
  dado que HAProxy ya está en el flujo — ver `Program.cs:115`,
  "Liveness endpoint for HAProxy").
- [ ] **Método de copia o publicación** disponible (¿acceso RDP?,
  ¿carpeta compartida (`\\servidor\ruta`)?, ¿algún pipeline/script ya
  existente de una publicación anterior?, ¿acceso vía esta sesión o lo
  hacés vos manualmente con los artefactos que yo prepare?).
- [ ] **Identidad del App Pool** del backend (cuenta de servicio Windows) y
  si ya tiene otorgado acceso a `D-SQL-DB-10`/`USFQ_AccountManager` vía
  Windows Integrado.
- [ ] **Cómo se suministra hoy `ActiveDirectory:Password`** en el
  servidor — el placeholder en el repo (`"USE_DOTNET_USER_SECRETS"`)
  sugiere `dotnet user-secrets`, pero ese mecanismo depende del perfil de
  usuario local y no es el patrón típico para IIS en un servidor. Si el
  ambiente ya funciona hoy, **algo ya lo resuelve** ahí — necesito saber
  qué, para no romperlo al republicar.
- [ ] **Confirmación de acceso** — que el servidor efectivamente alcanza
  `D-SQL-DB-10` (puerto SQL) y `P-AD-DS-04.usfq.edu.ec` (LDAP 389) por
  red, y que `srvaccount` tiene los permisos de lectura/escritura
  necesarios sobre `OU=USERS,OU=Cumbaya,DC=usfq,DC=edu,DC=ec`.
- [x] **Existencia del ASP.NET Core Hosting Bundle 8.0** — **CONFIRMADO**
  (sección 4a): runtime `8.0.18` presente en el servidor, coincide con el
  target `net8.0`.
- [ ] **URL Rewrite** — según el análisis de la sección 3, probablemente
  no se necesita para el frontend (sin rutas profundas), pero confirmar
  si el sitio IIS actual ya tiene una regla de este tipo configurada (y
  por qué, si la tiene) antes de asumir que no hace falta.
- [ ] **Configuración en HAProxy**, si aplica — el propio backend ya
  asume su existencia (`Program.cs:115`, comentario "Liveness endpoint
  for HAProxy"). Confirmar si el redeploy de esta rama requiere tocar esa
  configuración (no debería, si el sitio/puerto/path no cambian) o si es
  puramente informativo para este plan.

## 4a. Datos recopilados del servidor — validación de solo lectura (2026-07-27)

Reporte recibido, ejecutado sobre el servidor. **El nivel de enmascarado
aplicado tiene un problema estructural**: reutiliza el mismo placeholder
(`<SITIO_IIS>`, `<CUENTA_DOMINIO_ENMASCARADA>`, `<RUTA_LOCAL_ENMASCARADA>`)
para los **6 sitios IIS distintos** que existen en el servidor y para
campos que son diferentes entre sí (nombre de sitio, ruta física, cuenta de
identidad) — el enmascarado protegió los valores, pero también destruyó la
correlación entre ellos. Resultado: no puedo determinar con certeza **cuál
de los 6 sitios** corresponde a `account-governance-int.usfq.edu.ec`. No
voy a completar esos campos con una suposición.

### Confirmado (verificable, no depende de la correlación rota)

- **SO del servidor**: Windows Server 2025 Standard, build 10.0.26100,
  64-bit.
- **Runtime .NET instalado**: `Microsoft.AspNetCore.App 8.0.18` +
  `Microsoft.NETCore.App 8.0.18` — **coincide con el target `net8.0`** del
  proyecto. Confirma que el **ASP.NET Core Hosting Bundle 8.0 ya está
  instalado** (pendiente #12 de la sección 4, resuelto). Sin SDK instalado
  en el servidor — esperable y correcto para un host de IIS: el publish
  debe ser **framework-dependent** (no self-contained), tal como ya
  proponía este plan.
- **`AspNetCoreModuleV2`** presente (`%ProgramFiles%\...\aspnetcorev2.dll`)
  — requisito para hosting in-process, confirmado disponible.
- **`RewriteModule`** presente a nivel de servidor
  (`%SystemRoot%\...\rewrite.dll`) — **disponible si hiciera falta**, pero
  esto solo confirma que el módulo está instalado, no que haya una regla
  activa en el sitio real (pendiente #13 sigue abierto, ver abajo).
- **Web Deploy / WMSVC**: servicio `WMSVC Web Management Service`
  `Running`, puerto `8172` en escucha — confirma que **Web Deploy es una
  opción técnica disponible** en este servidor como método de publicación
  alternativo a copia manual de archivos. No confirma si hay delegación de
  Web Deploy configurada específicamente para el sitio/App Pool del
  backend — eso sigue pendiente.
- **Existe exactamente una aplicación IIS con `path: /api`**, con
  `enabledProtocols: http` — consistente con "backend como child
  application `/api`". El campo `Site` de esa fila vino vacío en el
  reporte, así que no puedo confirmar bajo cuál de los 6 sitios cuelga.
- **Identidad de los 6 App Pools**: `IdentityType: SpecificUser` en todos
  — confirma que corren bajo cuentas de dominio explícitas (no
  `ApplicationPoolIdentity` genérica), consistente con la necesidad de
  acceso Windows Integrado a SQL Server que ya identificamos. No puedo
  saber cuál cuenta específica corresponde al App Pool del backend por el
  mismo problema de correlación.
- **Certificados con clave privada presentes**: hay al menos dos
  certificados wildcard `*.usfq.edu.ec` — uno con vigencia hasta
  `12/10/2026` y **otro ya vencido desde `30/9/2025`**. No puedo confirmar
  cuál de los dos (si alguno) es el que efectivamente usa el binding HTTPS
  del sitio real, porque `certificateHash` también salió enmascarado sin
  poder correlacionarlo a un sitio específico — pero es un hallazgo que
  vale la pena verificar puntualmente antes del deploy (ver pendiente
  nuevo, abajo).
- **Bindings — patrón de hostname observado**: uno de los 6 sitios tiene
  binding con sufijo `-devl.usfq.edu.ec`; los otros cinco usan
  `.usfq.edu.ec` sin ese sufijo. Es un indicio razonable de que el sitio
  con `-devl` es el de Development, pero **no es una confirmación** — el
  hostname público real es `account-governance-int.usfq.edu.ec`, que no
  coincide literalmente con ninguno de los dos patrones mostrados (podría
  ser que el binding real no sea visible por el enmascarado, o que el
  patrón `-devl` no sea el de este sitio en particular). Necesito
  confirmación directa, no una inferencia por patrón de nombre.

### Sensible — no debe guardarse en este documento ni en Git

- Nombre real del servidor, nombre real del sitio IIS, ruta física real,
  nombre/cuenta real del App Pool, thumbprints reales de certificado —
  aunque el reporte los enmascaró, **si en algún momento me pasás la
  versión sin enmascarar (o la corregida con mejor correlación), la uso
  solo para completar este plan con un marcador de "confirmado" y una
  referencia indirecta (p. ej. "el sitio con binding `-devl`"), nunca
  pegando el valor real en este archivo versionado en Git.**
- El valor del secreto `ActiveDirectory:Password` — no se pidió, no se
  recibió, y no debe pedirse en texto plano en ningún reporte. Lo que
  necesito es únicamente **dónde/cómo vive** ese secreto (mecanismo, no
  valor), ver siguiente punto.

### Pendiente — no resuelto por este reporte

- [ ] **Cuál de los 6 sitios es `account-governance-int.usfq.edu.ec`** —
  bloqueado por el enmascarado sin correlación. Ver propuesta de
  re-consulta más abajo.
- [ ] **Mecanismo real del secreto de AD** — la sección 12 del reporte
  ("Variables de entorno del sistema") salió con **todos los valores como
  `<VALOR_NO_RECOLECTADO>`**, incluidas `ASPNETCORE_ENVIRONMENT` y
  `DOTNET_ENVIRONMENT` — no aporta nada todavía sobre si
  `ActiveDirectory:Password` viene de una variable de entorno del App
  Pool, de un `secrets.json`, o de otro mecanismo. La sección 13 ("Archivos
  principales") **falló por completo** (`ERROR AL CONSULTAR ESTA SECCIÓN:
  The property 'Site' cannot be found on this object`) — no hay dato
  utilizable ahí tampoco. Sigue siendo el pendiente más importante del
  plan (riesgo ya señalado en la sección 6).
- [ ] **Validez del certificado HTTPS realmente usado por el sitio de
  Development** — dado que hay un wildcard `*.usfq.edu.ec` vencido desde
  `30/9/2025` entre los certificados disponibles en el servidor, hace
  falta confirmar puntualmente que el binding del sitio correcto usa el
  certificado vigente (`12/10/2026`), no el vencido.
- [ ] **Resultado de las pruebas locales no intrusivas — inconclusas, no
  alarmantes**: las 4 pruebas contra `localhost` (`/`, `/api/health`, HTTP
  y HTTPS) devolvieron `404` o conexión cerrada. Esto **no significa
  necesariamente que el sitio esté caído** — IIS enruta por *host header*
  (los bindings son `*:443:<hostname>`, no por IP), así que pegarle a
  `localhost` sin el header `Host` correcto típicamente da `404` aunque el
  sitio funcione perfectamente contra su hostname real. No lo interpreto
  como una falla; lo interpreto como una prueba que no probó lo que
  necesitábamos probar.

### Qué necesito para destrabar esto (sin pedir nada sensible)

Idealmente, una consulta de solo lectura **ya filtrada por el hostname
público conocido**, para que devuelva un solo resultado sin depender de
que el enmascarado distinga 6 filas idénticas:

```powershell
Get-IISSite | Where-Object {
    $_.Bindings.bindingInformation -match 'account-governance-int'
} | Select-Object Name, Id, State, PhysicalPath, ApplicationPool

Get-WebApplication -Site '<nombre_del_sitio_encontrado_arriba>' |
    Where-Object Path -eq '/api' |
    Select-Object Path, PhysicalPath, ApplicationPool

Get-IISAppPool '<nombre_del_pool_encontrado_arriba>' |
    Select-Object Name, State, ProcessModel

# Certificado realmente asociado al binding HTTPS de ESE sitio puntual:
Get-WebBinding -Name '<nombre_del_sitio>' -Protocol https |
    Select-Object bindingInformation, certificateHash
```

Y para el secreto de AD, un chequeo puntual de **existencia**, sin volcar
contenido:

```powershell
# Variables de entorno definidas específicamente en el App Pool (no las del sistema):
Get-ItemProperty "IIS:\AppPools\<nombre_del_pool>" -Name environmentVariables

# Existencia (no contenido) de un secrets.json bajo el perfil de la identidad del pool:
Test-Path "C:\Users\<identidad_del_pool>\AppData\Roaming\Microsoft\UserSecrets\account-governance-api-dev\secrets.json"

# Existencia (no contenido) de una entrada <environmentVariables> en el web.config publicado del /api:
Select-String -Path "<ruta_física_del_api>\web.config" -Pattern "ActiveDirectory" -SimpleMatch
```

Con esos cuatro-cinco datos puntuales alcanza para cerrar los pendientes
de correlación — no hace falta repetir el reporte completo.

## 5. Estrategia de despliegue propuesta (sin ejecutar)

Procedimiento seguro para un ambiente que **ya existe y está en uso** —
prioridad: no romper lo que ya funciona. Los comandos de build (5.1) son
**definitivos** — no dependen de ningún pendiente de servidor. Los
comandos de servidor (5.2 en adelante) usan **placeholders explícitos**
(`<...>`) para los 3-4 valores todavía bloqueados por la correlación rota
del reporte (sección 4a) — se completan solos, sin reescribir el resto del
procedimiento, en cuanto los tengamos.

### 5.1 Comandos de build (definitivos, ejecutables ya mismo si se aprueba)

**Backend** — framework-dependent (el runtime 8.0.18 ya está confirmado en
el servidor, sección 4a; no hace falta `--self-contained`):
```powershell
dotnet publish backend/src/AccountGovernance.Api/AccountGovernance.Api.csproj `
  -c Release `
  -o build/backend-publish
```
(Sin `-p:EnvironmentName=...` — `Development` ya es el default del
`.csproj`, y coincide con el binding `ASPNETCORE_ENVIRONMENT=Development`
que ya trae el `web.config` fuente.)

**Frontend**:
```powershell
cd frontend
npm ci
npm run build:development
cd ..
```
(`npm ci`, no `npm install` — respeta exactamente `package-lock.json`
para un build reproducible. `build:development` ya incluye el gate
`check-env.mjs` que valida `.env.development` antes de compilar.)

### 5.2 Prechecks
1. Confirmar los pendientes de la sección 4a — en particular, **cuál de
   los 6 sitios es el correcto** y **cómo está resuelto hoy el secreto de
   AD** — antes de tocar cualquier carpeta real.
2. `dotnet build` + `dotnet test` (backend) — ya verificado en esta
   sesión (31/31), repetir si pasa tiempo entre este plan y la ejecución.
3. Ejecutar 5.1 completo — **primera ejecución real todavía pendiente**,
   no se corrió como parte de esta fase de planificación.
4. Verificar espacio en disco en el servidor.

### 5.3 Respaldo de la versión actual (en el servidor, antes de tocar nada)
```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backendPath  = '<ruta_física_del_api>'          # sección 4a, pendiente
$frontendPath = '<ruta_física_del_frontend>'      # sección 4a, pendiente
$backupRoot   = '<ruta_de_respaldos>'             # a acordar

Copy-Item -Path $backendPath  -Destination "$backupRoot\backend-$stamp"  -Recurse
Copy-Item -Path $frontendPath -Destination "$backupRoot\frontend-$stamp" -Recurse
```
El respaldo del backend debe copiar la carpeta **completa**, incluida
cualquier configuración server-específica que no venga del repo (el
secreto de AD, si vive ahí — sección 4a).

### 5.4 Publicación en carpetas temporales / staging (no reemplazo directo)
```powershell
$stagingBackend  = '<ruta_staging>\backend'
$stagingFrontend = '<ruta_staging>\frontend'

# Copiar los artefactos de 5.1 (build/backend-publish y frontend/dist)
# al staging del servidor — vía el método de copia que se confirme
# (carpeta compartida, Web Deploy ya disponible según sección 4a, etc.)
Copy-Item -Path 'build\backend-publish\*' -Destination $stagingBackend -Recurse -Force
Copy-Item -Path 'frontend\dist\*'         -Destination $stagingFrontend -Recurse -Force
```

**Exclusión explícita de configuración/secretos del servidor**: el
artefacto de `dotnet publish` **incluye** `appsettings.json` +
`appsettings.Development.json` del repo (contienen el placeholder
`"USE_DOTNET_USER_SECRETS"`, sin secreto real — no hay nada que excluir
ahí). Lo que sí debe **preservarse y no sobrescribirse** es cualquier
mecanismo server-específico que ya resuelva ese secreto hoy (variable de
entorno del App Pool, `secrets.json` bajo el perfil de la identidad,
o una entrada en el `web.config` **publicado** que no exista en el
`web.config` del repo) — exactamente lo que la consulta de la sección 4a
busca identificar antes de sobrescribir. Hasta confirmarlo, el paso
seguro es: **no reemplazar `web.config` en el servidor si el mecanismo
resulta ser una entrada ahí**, o **reaplicar la variable de entorno del
App Pool después de publicar**, según lo que se confirme.

### 5.5 Reciclado controlado del App Pool
```powershell
Stop-WebAppPool -Name '<nombre_del_app_pool>'   # sección 4a, pendiente
```
Detener (no solo reciclar) libera los locks sobre los `.dll` del backend
mientras se reemplazan los archivos — más seguro que un `Restart` directo
sobre archivos en uso.

### 5.6 Reemplazo atómico (rename, no sobrescritura archivo por archivo)
```powershell
Rename-Item -Path $backendPath  -NewName "previous-backend-$stamp"
Rename-Item -Path $stagingBackend -NewName (Split-Path $backendPath -Leaf)
Move-Item   -Path (Join-Path (Split-Path $stagingBackend) (Split-Path $backendPath -Leaf)) -Destination (Split-Path $backendPath)

# mismo patrón para $frontendPath / $stagingFrontend
```
(Pseudocódigo de renombrado — la forma exacta depende de si `staging` y la
ruta activa están en el mismo volumen; si no lo están, `Rename-Item` no
sirve entre volúmenes y hay que usar `Move-Item`/`robocopy /MOVE`. Se
ajusta cuando se confirme la ruta real.)

### 5.7 Reinicio y validación de backend
```powershell
Start-WebAppPool -Name '<nombre_del_app_pool>'
Start-Sleep -Seconds 5
Invoke-WebRequest -Uri 'https://account-governance-int.usfq.edu.ec/api/health' -UseBasicParsing
```
Esperar `200 {"status":"Healthy"}` — confirma que el proceso arrancó,
**no** que SQL/AD estén accesibles (sección 2). Seguido de una prueba
funcional real (un endpoint que sí toque SQL, uno que sí toque AD) y
revisión de `logs/accountgovernance-*.log` en la ruta activa nueva.

### 5.8 Validación de frontend
- Cargar `https://account-governance-int.usfq.edu.ec/` en un browser,
  confirmar `loginRedirect` a Entra ID y retorno correcto tras autenticar.
- DevTools: llamadas a `/api/...` resuelven al mismo origen, sin errores
  CORS, con datos reales.
- Ejercitar al menos una pantalla por módulo tocado en esta rama (Roles y
  Grupos, Ámbitos Administrativos, RoleScopeAssignment) — confirma "cero
  cambios observables" del Incremento A también a nivel visual.

### 5.9 Rollback completo
```powershell
Stop-WebAppPool -Name '<nombre_del_app_pool>'
Rename-Item -Path $backendPath -NewName "failed-backend-$stamp"
Rename-Item -Path "<backupRoot>\backend-$stamp" -NewName (Split-Path $backendPath -Leaf)
Move-Item   -Path "<backupRoot>\$(Split-Path $backendPath -Leaf)" -Destination (Split-Path $backendPath)
Start-WebAppPool -Name '<nombre_del_app_pool>'
# mismo patrón para frontend
```
Repetir 5.7/5.8 después del rollback antes de cerrar el incidente — un
rollback no confirmado es tan riesgoso como el deploy que falló.

### 5.10 Evidencias y logs
Conservar: salida completa de 5.1 (ambos comandos), timestamp exacto de
cada paso, resultado de las validaciones 5.7/5.8, y el hash de commit
desplegado (`aafc657`) — trazabilidad de qué versión exacta quedó
corriendo.

## 6. Riesgos identificados

- **Secreto de AD no resuelto en este plan** (sección 4) — el riesgo más
  concreto: si se sobrescribe la carpeta de publicación sin preservar
  cómo se suministra hoy `ActiveDirectory:Password`, el backend puede
  arrancar (health check pasa) pero fallar en cualquier operación real
  contra AD, con un `500` genérico gracias al middleware de excepciones —
  fácil de no notar si la validación se limita a `/health`.
- **Identidad del App Pool sin confirmar** — si cambia la identidad al
  republicar (por ejemplo, si el App Pool se recrea en vez de reusarse),
  se pierde el acceso Windows Integrado a `D-SQL-DB-10` sin ningún error
  explícito hasta el primer intento de consulta SQL.
- **Ambiente ya en uso** — a diferencia de un primer deploy, este
  reemplaza algo que otras personas pueden estar usando activamente; la
  ventana de downtime (pasos 11-14) debe coordinarse, no asumirse libre.
- **Ausencia de endpoint de *readiness***: `/health` no prueba SQL/AD
  (confirmado en código, sección 2) — el equipo no tiene una señal
  automática de "listo de verdad", solo "el proceso arrancó". La
  validación funcional manual (pasos 16, 19) es la única red de
  seguridad real hasta que exista un readiness check.
- **Build del frontend no verificado todavía en esta sesión** —
  `npm run build:development` no se ejecutó como parte de esta fase de
  planificación (deliberado, para no generar artefactos antes de
  aprobación); podría revelar errores de TypeScript o de lint no
  detectados por el backend.
- **Certificado wildcard vencido presente en el servidor** (sección 4a):
  hay dos certificados `*.usfq.edu.ec` en el almacén de certificados con
  clave privada — uno vigente hasta `12/10/2026` y otro vencido desde
  `30/9/2025`. No se pudo confirmar cuál usa el binding HTTPS del sitio de
  Development real; si fuera el vencido, el sitio serviría HTTPS roto
  aunque el backend/frontend estén perfectamente publicados — riesgo
  independiente del código, a verificar antes o durante el deploy.
- **Enmascarado del reporte de validación impidió confirmar la
  correlación sitio↔pool↔ruta** — no es un riesgo del despliegue en sí,
  pero bloquea completar los pasos 5.3-5.9 con valores reales; ejecutarlos
  con un placeholder equivocado (asumiendo, por ejemplo, que el sitio con
  binding `-devl` es el correcto sin confirmarlo) podría tocar el sitio
  equivocado entre los 6 existentes en el mismo servidor.
