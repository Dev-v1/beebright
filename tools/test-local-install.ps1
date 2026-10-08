$ErrorActionPreference = 'Stop'
$Repo = Split-Path $PSScriptRoot -Parent
$env:LOCALAPPDATA = Join-Path $env:RUNNER_TEMP 'bee-install-test'
$Archive = Join-Path $Repo 'BeeBright-Full-Stack/beebright-spelling-bee/frontend/public/local/beebright-local.zip'
$global:BeeTestManifest = Get-Content (Join-Path $Repo 'BeeBright-Full-Stack/beebright-spelling-bee/frontend/public/local/manifest.json') -Raw | ConvertFrom-Json
function Invoke-RestMethod { return $global:BeeTestManifest }
function Invoke-WebRequest {
    param($Uri, $OutFile, $TimeoutSec, [switch]$UseBasicParsing)
    if ($Uri -like 'https://www.python.org/*') {
        Microsoft.PowerShell.Utility\Invoke-WebRequest $Uri -OutFile $OutFile -UseBasicParsing
    } elseif ($Uri -like '*/bootstrap.ps1') {
        Copy-Item (Join-Path $Repo 'local/bootstrap.ps1') $OutFile
    } else { Copy-Item $Archive $OutFile }
}
& (Join-Path $Repo 'local/install.ps1') -SkipLaunch
$Bee = Join-Path $env:LOCALAPPDATA 'BeeBright'
if (-not (Get-Command beebright.cmd -ErrorAction SilentlyContinue)) { throw 'Installer did not expose the beebright command.' }
Push-Location "$Bee/current"
try {
    & "$Bee/runtime/python.exe" -c 'import tkinter; from beebright_local.app import BeeBright; app=BeeBright(); app.update(); app.start(); app.update(); app.show_hint("origin"); app.update(); app.exit()'
    if ($LASTEXITCODE) { throw 'Installed runtime could not open the desktop UI.' }
} finally { Pop-Location }
Write-Host 'Official runtime installation, command availability, bundled Tkinter, and desktop UI passed.'
