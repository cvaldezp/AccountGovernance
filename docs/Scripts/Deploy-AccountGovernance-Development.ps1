#requires -Version 5.1

<#
.SYNOPSIS
    Compila y despliega AccountGovernance en Development.

.DESCRIPTION
    1. Compila frontend Vite en modo development.
    2. Publica backend ASP.NET Core en Release.
    3. Crea respaldo remoto.
    4. Detiene el Application Pool.
    5. Copia frontend y backend.
    6. Conserva configuración propia del servidor.
    7. Inicia el Application Pool.
    8. Valida frontend y API.
    9. Ejecuta rollback automático ante errores.

.REQUIREMENTS
    - Windows PowerShell 5.1.
    - Node.js y npm.
    - SDK .NET correspondiente al proyecto.
    - Acceso administrativo a \\SERVIDOR\C$.
    - PowerShell Remoting habilitado.
    - Permisos sobre IIS remoto.
#>

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Evita caracteres incorrectos en la salida de Vite/npm.
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = [Console]::OutputEncoding

# ============================================================
# CONFIGURACIÓN
# ============================================================

# Cambiar por el nombre real del servidor.
$Server = "D-ACC-FEN-01"

# Application Pool que ejecuta el backend.
$AppPool = "account-governance-int"

# Repositorio local.
$RepositoryRoot = "C:\RepositorioClaude\AccountGovernanceRepo"

# Proyectos.
$FrontendProject = Join-Path $RepositoryRoot "frontend"

$BackendCsproj = Join-Path `
    $RepositoryRoot `
    "backend\src\AccountGovernance.Api\AccountGovernance.Api.csproj"

$BackendTestsCsproj = Join-Path `
    $RepositoryRoot `
    "backend\tests\AccountGovernance.Api.Tests\AccountGovernance.Api.Tests.csproj"

# Artefactos locales generados.
$FrontendSource = Join-Path $FrontendProject "dist"
$BackendSource  = "C:\Publish\AccountGovernance"

# Ruta remota.
$DeployRoot = "\\$Server\C$\inetpub\account-governance-int"
$BackendTarget = Join-Path $DeployRoot "api"

# Respaldos remotos.
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

$BackupRoot = "\\$Server\C$\inetpub\backups\account-governance-int"
$BackupPath = Join-Path $BackupRoot $Timestamp

# URLs para validación posterior.
$FrontendUrl = "https://account-governance-int.usfq.edu.ec"
$HealthUrl   = "https://account-governance-int.usfq.edu.ec/api/health"

# Configuración de ejecución.
$RunBackendTests = $true
$RunNpmCi        = $true
$RunHealthChecks = $true

# Si el certificado no es válido desde la máquina de despliegue,
# puedes cambiar temporalmente este valor a $true.
$IgnoreCertificateErrorsDuringValidation = $false

# Archivos del backend que deben conservarse desde el servidor.
# No serán reemplazados por el contenido publicado localmente.
$BackendFilesToPreserve = @(
    "appsettings.Development.json",
    "appsettings.Production.json"
)

# Carpetas del backend que deben conservarse.
$BackendDirectoriesToPreserve = @(
    "logs"
)

# ============================================================
# VARIABLES DE ESTADO
# ============================================================

$AppPoolStopped     = $false
$DeploymentStarted  = $false
$DeploymentFinished = $false
$BackupCreated      = $false

$PreservedFiles = @{}

# ============================================================
# FUNCIONES GENERALES
# ============================================================

function Write-Section {
    param(
        [Parameter(Mandatory)]
        [string]$Title
    )

    Write-Host ""
    Write-Host "============================================================" `
        -ForegroundColor Cyan
    Write-Host $Title -ForegroundColor Cyan
    Write-Host "============================================================" `
        -ForegroundColor Cyan
}

function Assert-CommandExists {
    param(
        [Parameter(Mandatory)]
        [string]$CommandName
    )

    if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
        throw "No se encontró el comando requerido: $CommandName"
    }
}

function Assert-PathExists {
    param(
        [Parameter(Mandatory)]
        [string]$Path,

        [Parameter(Mandatory)]
        [string]$Description
    )

    if (-not (Test-Path $Path)) {
        throw "No existe $Description`: $Path"
    }
}

function Invoke-NativeCommand {
    param(
        [Parameter(Mandatory)]
        [string]$Executable,

        [Parameter()]
        [string[]]$Arguments = @(),

        [Parameter(Mandatory)]
        [string]$FailureMessage,

        [Parameter()]
        [string]$WorkingDirectory
    )

    $PreviousLocation = $null
    $PreviousErrorActionPreference = $ErrorActionPreference
    $ExitCode = $null

    try {
        if (-not [string]::IsNullOrWhiteSpace($WorkingDirectory)) {
            $PreviousLocation = Get-Location
            Set-Location $WorkingDirectory
        }

        # PowerShell 5.1 convierte stderr de programas externos
        # en NativeCommandError cuando ErrorActionPreference es Stop.
        # Aquí permitimos la salida y evaluamos el código real del proceso.
        $ErrorActionPreference = "Continue"

        & $Executable @Arguments 2>&1 |
            ForEach-Object {
                Write-Host $_
            }

        $ExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $PreviousErrorActionPreference

        if ($null -ne $PreviousLocation) {
            Set-Location $PreviousLocation
        }
    }

    if ($null -eq $ExitCode) {
        throw "$FailureMessage No se obtuvo un código de salida."
    }

    if ($ExitCode -ne 0) {
        throw "$FailureMessage Código de salida: $ExitCode."
    }
}

function Invoke-Robocopy {
    param(
        [Parameter(Mandatory)]
        [string]$Source,

        [Parameter(Mandatory)]
        [string]$Destination,

        [Parameter()]
        [string[]]$ExcludeDirectories = @(),

        [Parameter()]
        [string[]]$ExcludeFiles = @(),

        [Parameter()]
        [switch]$ListOnly
    )

    if (-not (Test-Path $Source)) {
        throw "No existe la carpeta de origen para Robocopy: $Source"
    }

    New-Item `
        -ItemType Directory `
        -Path $Destination `
        -Force |
        Out-Null

    $Arguments = @(
        $Source,
        $Destination,
        "/MIR",
        "/R:2",
        "/W:2",
        "/COPY:DAT",
        "/DCOPY:DAT",
        "/NP",
        "/TEE"
    )

    if ($ExcludeDirectories.Count -gt 0) {
        $Arguments += "/XD"

        foreach ($Directory in $ExcludeDirectories) {
            $Arguments += $Directory
        }
    }

    if ($ExcludeFiles.Count -gt 0) {
        $Arguments += "/XF"

        foreach ($File in $ExcludeFiles) {
            $Arguments += $File
        }
    }

    if ($ListOnly) {
        $Arguments += "/L"
    }

    $PreviousErrorActionPreference = $ErrorActionPreference

    try {
        $ErrorActionPreference = "Continue"

        & robocopy @Arguments

        $RobocopyExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $PreviousErrorActionPreference
    }

    # Robocopy:
    # 0 a 7 = éxito, copia o diferencias no críticas.
    # 8 o superior = error.
    if ($RobocopyExitCode -ge 8) {
        throw @"
Robocopy presentó un error.

Código: $RobocopyExitCode
Origen: $Source
Destino: $Destination
"@
    }

    Write-Host "Robocopy terminó con código $RobocopyExitCode." `
        -ForegroundColor DarkGray
}

# ============================================================
# FUNCIONES IIS REMOTO
# ============================================================

function Test-RemoteAppPool {
    param(
        [Parameter(Mandatory)]
        [string]$ComputerName,

        [Parameter(Mandatory)]
        [string]$PoolName
    )

    Invoke-Command `
        -ComputerName $ComputerName `
        -ScriptBlock {
            param($PoolName)

            Import-Module WebAdministration -ErrorAction Stop

            if (-not (Test-Path "IIS:\AppPools\$PoolName")) {
                throw "No existe el Application Pool '$PoolName'."
            }

            $State = (Get-WebAppPoolState -Name $PoolName).Value

            [PSCustomObject]@{
                AppPool = $PoolName
                State   = $State
                Exists  = $true
            }
        } `
        -ArgumentList $PoolName
}

function Stop-RemoteAppPool {
    param(
        [Parameter(Mandatory)]
        [string]$ComputerName,

        [Parameter(Mandatory)]
        [string]$PoolName
    )

    Invoke-Command `
        -ComputerName $ComputerName `
        -ScriptBlock {
            param($PoolName)

            Import-Module WebAdministration -ErrorAction Stop

            if (-not (Test-Path "IIS:\AppPools\$PoolName")) {
                throw "No existe el Application Pool '$PoolName'."
            }

            $CurrentState = (Get-WebAppPoolState -Name $PoolName).Value

            if ($CurrentState -ne "Stopped") {
                Stop-WebAppPool -Name $PoolName
            }

            $TimeoutSeconds = 30

            while (
                (Get-WebAppPoolState -Name $PoolName).Value -ne "Stopped" -and
                $TimeoutSeconds -gt 0
            ) {
                Start-Sleep -Seconds 1
                $TimeoutSeconds--
            }

            $FinalState = (Get-WebAppPoolState -Name $PoolName).Value

            if ($FinalState -ne "Stopped") {
                throw "No se pudo detener el Application Pool '$PoolName'."
            }

            Write-Output "Application Pool detenido: $PoolName"
        } `
        -ArgumentList $PoolName
}

function Start-RemoteAppPool {
    param(
        [Parameter(Mandatory)]
        [string]$ComputerName,

        [Parameter(Mandatory)]
        [string]$PoolName
    )

    Invoke-Command `
        -ComputerName $ComputerName `
        -ScriptBlock {
            param($PoolName)

            Import-Module WebAdministration -ErrorAction Stop

            if (-not (Test-Path "IIS:\AppPools\$PoolName")) {
                throw "No existe el Application Pool '$PoolName'."
            }

            $CurrentState = (Get-WebAppPoolState -Name $PoolName).Value

            if ($CurrentState -ne "Started") {
                Start-WebAppPool -Name $PoolName
            }

            $TimeoutSeconds = 30

            while (
                (Get-WebAppPoolState -Name $PoolName).Value -ne "Started" -and
                $TimeoutSeconds -gt 0
            ) {
                Start-Sleep -Seconds 1
                $TimeoutSeconds--
            }

            $FinalState = (Get-WebAppPoolState -Name $PoolName).Value

            if ($FinalState -ne "Started") {
                throw "No se pudo iniciar el Application Pool '$PoolName'."
            }

            Write-Output "Application Pool iniciado: $PoolName"
        } `
        -ArgumentList $PoolName
}

# ============================================================
# FUNCIONES DE VALIDACIÓN HTTP
# ============================================================

function Test-DeploymentUrl {
    param(
        [Parameter(Mandatory)]
        [string]$Uri,

        [Parameter()]
        [int[]]$AcceptedStatusCodes = @(200),

        [Parameter()]
        [int]$Attempts = 6,

        [Parameter()]
        [int]$DelaySeconds = 5,

        [Parameter()]
        [bool]$IgnoreCertificateErrors = $false
    )

    $PreviousCertificateCallback =
        [System.Net.ServicePointManager]::ServerCertificateValidationCallback

    try {
        [System.Net.ServicePointManager]::SecurityProtocol =
            [System.Net.SecurityProtocolType]::Tls12

        if ($IgnoreCertificateErrors) {
            [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {
                param(
                    $Sender,
                    $Certificate,
                    $Chain,
                    $SslPolicyErrors
                )

                return $true
            }
        }

        for ($Attempt = 1; $Attempt -le $Attempts; $Attempt++) {
            try {
                Write-Host `
                    "Validando $Uri - intento $Attempt de $Attempts..." `
                    -ForegroundColor Cyan

                $Response = Invoke-WebRequest `
                    -Uri $Uri `
                    -UseBasicParsing `
                    -TimeoutSec 20 `
                    -ErrorAction Stop

                $StatusCode = [int]$Response.StatusCode

                if ($AcceptedStatusCodes -contains $StatusCode) {
                    Write-Host `
                        "Validación correcta: HTTP $StatusCode" `
                        -ForegroundColor Green

                    return
                }

                Write-Warning "La URL respondió HTTP $StatusCode."
            }
            catch {
                $StatusCode = $null

                if ($_.Exception.Response) {
                    try {
                        $StatusCode = [int]$_.Exception.Response.StatusCode
                    }
                    catch {
                        $StatusCode = $null
                    }
                }

                if (
                    $null -ne $StatusCode -and
                    $AcceptedStatusCodes -contains $StatusCode
                ) {
                    Write-Host `
                        "Validación correcta: HTTP $StatusCode" `
                        -ForegroundColor Green

                    return
                }

                Write-Warning $_.Exception.Message
            }

            if ($Attempt -lt $Attempts) {
                Start-Sleep -Seconds $DelaySeconds
            }
        }

        throw @"
La URL no respondió con un código aceptado.

URL:
$Uri

Códigos aceptados:
$($AcceptedStatusCodes -join ", ")

Intentos:
$Attempts
"@
    }
    finally {
        [System.Net.ServicePointManager]::ServerCertificateValidationCallback =
            $PreviousCertificateCallback
    }
}

# ============================================================
# FUNCIONES DE CONFIGURACIÓN Y ROLLBACK
# ============================================================

function Save-ServerConfigurationFiles {
    param(
        [Parameter(Mandatory)]
        [string]$ServerBackendPath,

        [Parameter(Mandatory)]
        [string[]]$FilesToPreserve
    )

    $Result = @{}

    foreach ($FileName in $FilesToPreserve) {
        $ServerFile = Join-Path $ServerBackendPath $FileName

        if (Test-Path $ServerFile) {
            $TemporaryFileName = (
                "AccountGovernance_{0}_{1}" -f
                $Timestamp,
                $FileName
            )

            $TemporaryFile = Join-Path $env:TEMP $TemporaryFileName

            Copy-Item `
                -Path $ServerFile `
                -Destination $TemporaryFile `
                -Force `
                -ErrorAction Stop

            $Result[$FileName] = $TemporaryFile

            Write-Host `
                "Archivo preservado temporalmente: $FileName" `
                -ForegroundColor DarkYellow
        }
        else {
            Write-Host `
                "No existe en el servidor y no será preservado: $FileName" `
                -ForegroundColor DarkGray
        }
    }

    return $Result
}

function Restore-ServerConfigurationFiles {
    param(
        [Parameter(Mandatory)]
        [hashtable]$Files,

        [Parameter(Mandatory)]
        [string]$ServerBackendPath
    )

    foreach ($FileName in $Files.Keys) {
        $TemporaryFile = $Files[$FileName]
        $DestinationFile = Join-Path $ServerBackendPath $FileName

        Copy-Item `
            -Path $TemporaryFile `
            -Destination $DestinationFile `
            -Force `
            -ErrorAction Stop

        Write-Host `
            "Configuración restaurada: $FileName" `
            -ForegroundColor DarkYellow
    }
}

function Remove-TemporaryConfigurationFiles {
    param(
        [Parameter(Mandatory)]
        [hashtable]$Files
    )

    foreach ($TemporaryFile in $Files.Values) {
        if (Test-Path $TemporaryFile) {
            Remove-Item `
                -Path $TemporaryFile `
                -Force `
                -ErrorAction SilentlyContinue
        }
    }
}

function Restore-DeploymentBackup {
    param(
        [Parameter(Mandatory)]
        [string]$Backup,

        [Parameter(Mandatory)]
        [string]$Destination
    )

    if (-not (Test-Path $Backup)) {
        throw "No existe el respaldo requerido: $Backup"
    }

    Write-Host ""
    Write-Host "Restaurando respaldo..." -ForegroundColor Yellow
    Write-Host "Origen: $Backup"
    Write-Host "Destino: $Destination"

    Invoke-Robocopy `
        -Source $Backup `
        -Destination $Destination
}

# ============================================================
# PREVALIDACIONES
# ============================================================

Write-Section "ACCOUNT GOVERNANCE - DEPLOY DEVELOPMENT"

Write-Host "Servidor:          $Server"
Write-Host "Application Pool:  $AppPool"
Write-Host "Repositorio:       $RepositoryRoot"
Write-Host "Frontend:          $FrontendProject"
Write-Host "Backend:           $BackendCsproj"
Write-Host "Destino remoto:    $DeployRoot"
Write-Host "Respaldo:          $BackupPath"

if ($Server -eq "NOMBRE_SERVIDOR") {
    throw "Debes reemplazar NOMBRE_SERVIDOR por el servidor real."
}

Assert-CommandExists -CommandName "dotnet"
Assert-CommandExists -CommandName "npm.cmd"
Assert-CommandExists -CommandName "robocopy"
Assert-CommandExists -CommandName "Invoke-Command"

Assert-PathExists `
    -Path $RepositoryRoot `
    -Description "el repositorio"

Assert-PathExists `
    -Path $FrontendProject `
    -Description "el proyecto frontend"

Assert-PathExists `
    -Path $BackendCsproj `
    -Description "el proyecto principal del backend"

Assert-PathExists `
    -Path (Join-Path $FrontendProject "package.json") `
    -Description "package.json"

Write-Host ""
Write-Host "Validando comunicación remota..." `
    -ForegroundColor Cyan

$RemoteInformation = Invoke-Command `
    -ComputerName $Server `
    -ScriptBlock {
        [PSCustomObject]@{
            ComputerName = $env:COMPUTERNAME
            UserName     = "$env:USERDOMAIN\$env:USERNAME"
            PowerShell   = $PSVersionTable.PSVersion.ToString()
        }
    }

$RemoteInformation | Format-List

Write-Host "Validando acceso a la unidad administrativa..." `
    -ForegroundColor Cyan

if (-not (Test-Path "\\$Server\C$")) {
    throw "No existe acceso administrativo a \\$Server\C$."
}

Write-Host "Validando Application Pool..." `
    -ForegroundColor Cyan

Test-RemoteAppPool `
    -ComputerName $Server `
    -PoolName $AppPool |
    Format-List

# ============================================================
# COMPILAR FRONTEND
# ============================================================

Write-Section "1. COMPILACIÓN DEL FRONTEND"

if (Test-Path $FrontendSource) {
    Write-Host "Eliminando dist anterior..." `
        -ForegroundColor DarkGray

    Remove-Item `
        -Path $FrontendSource `
        -Recurse `
        -Force `
        -ErrorAction Stop
}

if ($RunNpmCi) {
    $PackageLock = Join-Path $FrontendProject "package-lock.json"

    if (Test-Path $PackageLock) {
        Write-Host "Instalando dependencias con npm ci..." `
            -ForegroundColor Cyan

        Invoke-NativeCommand `
            -Executable "npm.cmd" `
            -Arguments @(
                "ci",
                "--no-audit",
                "--no-fund"
            ) `
            -WorkingDirectory $FrontendProject `
            -FailureMessage "npm ci falló."
    }
    else {
        Write-Warning "No existe package-lock.json. Se utilizará npm install."

        Invoke-NativeCommand `
            -Executable "npm.cmd" `
            -Arguments @(
                "install",
                "--no-audit",
                "--no-fund"
            ) `
            -WorkingDirectory $FrontendProject `
            -FailureMessage "npm install falló."
    }
}

Write-Host "Generando frontend para Development..." `
    -ForegroundColor Cyan

Invoke-NativeCommand `
    -Executable "npm.cmd" `
    -Arguments @(
        "run",
        "build",
        "--",
        "--mode",
        "development"
    ) `
    -WorkingDirectory $FrontendProject `
    -FailureMessage "La compilación del frontend falló."

$FrontendIndex = Join-Path $FrontendSource "index.html"

if (-not (Test-Path $FrontendIndex)) {
    throw "La compilación terminó, pero no existe $FrontendIndex."
}

$FrontendAssets = Join-Path $FrontendSource "assets"

if (-not (Test-Path $FrontendAssets)) {
    throw "La compilación terminó, pero no existe $FrontendAssets."
}

Write-Host ""
Write-Host "Frontend compilado correctamente." `
    -ForegroundColor Green
Write-Host "Salida: $FrontendSource" `
    -ForegroundColor Green

# ============================================================
# PRUEBAS DEL BACKEND
# ============================================================

if ($RunBackendTests) {
    Write-Section "2. PRUEBAS AUTOMATIZADAS DEL BACKEND"

    Assert-PathExists `
        -Path $BackendTestsCsproj `
        -Description "el proyecto de pruebas"

    Invoke-NativeCommand `
        -Executable "dotnet.exe" `
        -Arguments @(
            "test",
            $BackendTestsCsproj,
            "--configuration",
            "Release",
            "--verbosity",
            "minimal"
        ) `
        -FailureMessage "Las pruebas automatizadas fallaron."
}

# ============================================================
# PUBLICAR BACKEND
# ============================================================

Write-Section "3. PUBLICACIÓN LOCAL DEL BACKEND"

if (Test-Path $BackendSource) {
    Write-Host "Eliminando publicación anterior..." `
        -ForegroundColor DarkGray

    Remove-Item `
        -Path $BackendSource `
        -Recurse `
        -Force `
        -ErrorAction Stop
}

New-Item `
    -ItemType Directory `
    -Path $BackendSource `
    -Force |
    Out-Null

Invoke-NativeCommand `
    -Executable "dotnet.exe" `
    -Arguments @(
        "publish",
        $BackendCsproj,
        "--configuration",
        "Release",
        "--output",
        $BackendSource,
        "/p:EnvironmentName=Development"
    ) `
    -FailureMessage "La publicación del backend falló."

$BackendDll = Join-Path $BackendSource "AccountGovernance.Api.dll"
$BackendWebConfig = Join-Path $BackendSource "web.config"
$BackendRuntimeConfig = Join-Path `
    $BackendSource `
    "AccountGovernance.Api.runtimeconfig.json"

Assert-PathExists `
    -Path $BackendDll `
    -Description "AccountGovernance.Api.dll publicado"

Assert-PathExists `
    -Path $BackendWebConfig `
    -Description "web.config publicado"

Assert-PathExists `
    -Path $BackendRuntimeConfig `
    -Description "runtimeconfig del backend"

Write-Host ""
Write-Host "Backend publicado correctamente." `
    -ForegroundColor Green
Write-Host "Salida: $BackendSource" `
    -ForegroundColor Green

# ============================================================
# DESPLIEGUE
# ============================================================

Write-Section "4. DESPLIEGUE REMOTO"

try {
    $DeploymentStarted = $true

    Write-Host "Deteniendo Application Pool..." `
        -ForegroundColor Yellow

    Stop-RemoteAppPool `
        -ComputerName $Server `
        -PoolName $AppPool

    $AppPoolStopped = $true

    Write-Host ""
    Write-Host "Creando respaldo remoto..." `
        -ForegroundColor Cyan

    New-Item `
        -ItemType Directory `
        -Path $BackupRoot `
        -Force |
        Out-Null

    if (Test-Path $DeployRoot) {
        Invoke-Robocopy `
            -Source $DeployRoot `
            -Destination $BackupPath

        $BackupCreated = $true

        Write-Host "Respaldo creado correctamente:" `
            -ForegroundColor Green
        Write-Host $BackupPath -ForegroundColor Green
    }
    else {
        Write-Warning @"
La ruta de despliegue no existe todavía.
No se creó respaldo porque no existe una versión anterior.
"@
    }

    Write-Host ""
    Write-Host "Preservando configuraciones del servidor..." `
        -ForegroundColor Cyan

    if (Test-Path $BackendTarget) {
        $PreservedFiles = Save-ServerConfigurationFiles `
            -ServerBackendPath $BackendTarget `
            -FilesToPreserve $BackendFilesToPreserve
    }

    New-Item `
        -ItemType Directory `
        -Path $DeployRoot `
        -Force |
        Out-Null

    New-Item `
        -ItemType Directory `
        -Path $BackendTarget `
        -Force |
        Out-Null

    Write-Host ""
    Write-Host "Copiando frontend..." `
        -ForegroundColor Cyan

    # Se excluye api para que /MIR no elimine el backend.
    Invoke-Robocopy `
        -Source $FrontendSource `
        -Destination $DeployRoot `
        -ExcludeDirectories @(
            "api"
        )

    Write-Host ""
    Write-Host "Copiando backend..." `
        -ForegroundColor Cyan

    Invoke-Robocopy `
        -Source $BackendSource `
        -Destination $BackendTarget `
        -ExcludeDirectories $BackendDirectoriesToPreserve `
        -ExcludeFiles $BackendFilesToPreserve

    if ($PreservedFiles.Count -gt 0) {
        Write-Host ""
        Write-Host "Restaurando configuración del servidor..." `
            -ForegroundColor Cyan

        Restore-ServerConfigurationFiles `
            -Files $PreservedFiles `
            -ServerBackendPath $BackendTarget
    }

    Write-Host ""
    Write-Host "Iniciando Application Pool..." `
        -ForegroundColor Yellow

    Start-RemoteAppPool `
        -ComputerName $Server `
        -PoolName $AppPool

    $AppPoolStopped = $false

    if ($RunHealthChecks) {
        Write-Section "5. VALIDACIÓN POSTERIOR"

        Test-DeploymentUrl `
            -Uri $HealthUrl `
            -AcceptedStatusCodes @(200) `
            -Attempts 8 `
            -DelaySeconds 5 `
            -IgnoreCertificateErrors `
                $IgnoreCertificateErrorsDuringValidation

        Test-DeploymentUrl `
            -Uri $FrontendUrl `
            -AcceptedStatusCodes @(200) `
            -Attempts 6 `
            -DelaySeconds 5 `
            -IgnoreCertificateErrors `
                $IgnoreCertificateErrorsDuringValidation
    }

    $DeploymentFinished = $true

    Write-Section "DESPLIEGUE COMPLETADO"

    Write-Host "Frontend:" -ForegroundColor Green
    Write-Host $FrontendUrl

    Write-Host ""
    Write-Host "Backend:" -ForegroundColor Green
    Write-Host $HealthUrl

    Write-Host ""
    Write-Host "Ruta remota:" -ForegroundColor Green
    Write-Host $DeployRoot

    if ($BackupCreated) {
        Write-Host ""
        Write-Host "Respaldo:" -ForegroundColor Green
        Write-Host $BackupPath
    }
}
catch {
    Write-Section "ERROR DURANTE EL DESPLIEGUE"

    Write-Host $_.Exception.Message `
        -ForegroundColor Red

    if ($BackupCreated -and (Test-Path $BackupPath)) {
        Write-Host ""
        Write-Host "Ejecutando rollback automático..." `
            -ForegroundColor Yellow

        try {
            if (-not $AppPoolStopped) {
                Stop-RemoteAppPool `
                    -ComputerName $Server `
                    -PoolName $AppPool

                $AppPoolStopped = $true
            }

            Restore-DeploymentBackup `
                -Backup $BackupPath `
                -Destination $DeployRoot

            Start-RemoteAppPool `
                -ComputerName $Server `
                -PoolName $AppPool

            $AppPoolStopped = $false

            Write-Host ""
            Write-Host "Rollback completado correctamente." `
                -ForegroundColor Green
        }
        catch {
            Write-Host ""
            Write-Host "ERROR DURANTE EL ROLLBACK:" `
                -ForegroundColor Red
            Write-Host $_.Exception.Message `
                -ForegroundColor Red

            Write-Host ""
            Write-Host "Se requiere revisión manual." `
                -ForegroundColor Red

            Write-Host "Respaldo disponible en:"
            Write-Host $BackupPath

            Write-Host "Destino:"
            Write-Host $DeployRoot
        }
    }
    else {
        Write-Warning @"
No existe un respaldo previo para rollback automático.
Se intentará iniciar el Application Pool.
"@
    }

    throw
}
finally {
    if ($AppPoolStopped) {
        Write-Host ""
        Write-Host `
            "Intentando iniciar el Application Pool desde finally..." `
            -ForegroundColor Yellow

        try {
            Start-RemoteAppPool `
                -ComputerName $Server `
                -PoolName $AppPool

            $AppPoolStopped = $false
        }
        catch {
            Write-Warning @"
No se pudo iniciar automáticamente el Application Pool.

Servidor:
$Server

Application Pool:
$AppPool

Detalle:
$($_.Exception.Message)
"@
        }
    }

    Remove-TemporaryConfigurationFiles `
        -Files $PreservedFiles
}

# ============================================================
# RESULTADO FINAL
# ============================================================

if ($DeploymentStarted -and $DeploymentFinished) {
    Write-Host ""
    Write-Host "El proceso terminó correctamente." `
        -ForegroundColor Green
}