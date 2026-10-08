$ErrorActionPreference = 'Stop'
$Repo = Split-Path $PSScriptRoot -Parent
foreach ($Script in @('install.ps1', 'bootstrap.ps1')) {
    $Tokens = $null; $Errors = $null
    [Management.Automation.Language.Parser]::ParseFile((Join-Path $Repo "local/$Script"), [ref]$Tokens, [ref]$Errors) | Out-Null
    if ($Errors.Count) { throw ($Errors | Out-String) }
}
$env:LOCALAPPDATA = Join-Path $env:RUNNER_TEMP 'bee-update-test'
$Bee = Join-Path $env:LOCALAPPDATA 'BeeBright'
New-Item -ItemType Directory -Force -Path "$Bee/runtime", "$Bee/userdata" | Out-Null
Set-Content "$Bee/runtime/pythonw.exe" ''
Set-Content "$Bee/userdata/progress.json" '{"sentinel":"keep-me"}'
$Archive = Join-Path $Repo 'BeeBright-Full-Stack/beebright-spelling-bee/frontend/public/local/beebright-local.zip'
$global:BeeTestManifest = Get-Content (Join-Path $Repo 'BeeBright-Full-Stack/beebright-spelling-bee/frontend/public/local/manifest.json') -Raw | ConvertFrom-Json
function Invoke-RestMethod { return $global:BeeTestManifest }
function Invoke-WebRequest { param($Uri, $OutFile, $TimeoutSec, [switch]$UseBasicParsing) Copy-Item $Archive $OutFile }
& (Join-Path $Repo 'local/bootstrap.ps1') -SkipLaunch
if ((Get-Content "$Bee/current/version.json" -Raw | ConvertFrom-Json).version -ne $global:BeeTestManifest.version) { throw 'Update did not install.' }
if ((Get-Content "$Bee/userdata/progress.json" -Raw) -notmatch 'keep-me') { throw 'Update erased progress.' }
function Invoke-RestMethod { throw 'Simulated offline connection' }
& (Join-Path $Repo 'local/bootstrap.ps1') -SkipLaunch
if (-not (Test-Path "$Bee/current/beebright_local/app.py")) { throw 'Offline fallback lost installed app.' }
Write-Host 'Update installation, progress preservation, offline fallback, and PowerShell syntax passed.'
