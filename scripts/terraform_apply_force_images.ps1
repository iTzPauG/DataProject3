param(
    [string]$Workspace = "dev-ia",
    [switch]$SkipInit,
    [switch]$AutoApprove,
    [string]$GcloudConfigDir = "",
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$TerraformArgs
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$terraformDir = Join-Path $repoRoot "terraform"
$terraformExe = Join-Path $terraformDir "terraform.exe"

if ([string]::IsNullOrWhiteSpace($GcloudConfigDir)) {
    $GcloudConfigDir = Join-Path $repoRoot ".gcloud"
}

if (-not (Test-Path -LiteralPath $GcloudConfigDir)) {
    New-Item -ItemType Directory -Path $GcloudConfigDir | Out-Null
}

$env:CLOUDSDK_CONFIG = $GcloudConfigDir

if (-not (Test-Path -LiteralPath $terraformDir)) {
    throw "No se encuentra el directorio terraform en: $terraformDir"
}

if (-not (Test-Path -LiteralPath $terraformExe)) {
    $terraformExe = "terraform"
}

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    throw "No se encontro 'gcloud' en PATH."
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "No se encontro 'docker' en PATH."
}

$dockerServerVersion = ""
try {
    $dockerServerVersion = (docker version --format "{{.Server.Version}}" 2>$null).Trim()
}
catch {
    $dockerServerVersion = ""
}

if ([string]::IsNullOrWhiteSpace($dockerServerVersion)) {
    throw @"
Docker no es accesible desde esta terminal.
Abre Docker Desktop y ejecuta esta terminal como administrador.
Si sigue fallando, agrega tu usuario al grupo 'docker-users' y cierra/sesion.
"@
}

$gcloudAccount = ""
try {
    $gcloudAccount = (gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null).Trim()
}
catch {
    $gcloudAccount = ""
}

if ([string]::IsNullOrWhiteSpace($gcloudAccount)) {
    throw @"
No hay sesion activa de gcloud para CLOUDSDK_CONFIG=$GcloudConfigDir
Ejecuta:
  gcloud auth login
  gcloud auth application-default login
  gcloud config set project project1grupo7
y luego vuelve a lanzar este script.
"@
}

Push-Location $terraformDir
try {
    if (-not $SkipInit) {
        & $terraformExe init
        if ($LASTEXITCODE -ne 0) {
            throw "terraform init falló con código $LASTEXITCODE"
        }
    }

    & $terraformExe workspace select $Workspace
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo seleccionar el workspace '$Workspace'"
    }

    $applyCmd = @(
        "apply"
        "-replace=module.registry.null_resource.docker_build_push"
        "-replace=module.registry_frontend.null_resource.docker_build_push"
    )

    if ($AutoApprove) {
        $applyCmd += "-auto-approve"
    }

    if ($TerraformArgs) {
        $applyCmd += $TerraformArgs
    }

    & $terraformExe @applyCmd
    if ($LASTEXITCODE -ne 0) {
        throw "terraform apply falló con código $LASTEXITCODE"
    }

    Write-Host ""
    Write-Host "Despliegue completado. URLs actuales:"
    & $terraformExe output -raw cloud_run_url
    & $terraformExe output -raw frontend_url
}
finally {
    Pop-Location
}
