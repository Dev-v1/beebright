$ErrorActionPreference = 'Stop'
$Repo = Split-Path $PSScriptRoot -Parent
$env:LOCALAPPDATA = Join-Path $env:RUNNER_TEMP 'bee-install-test'
$Archive = Join-Path $Repo 'BeeBright-Full-Stack/beebright-spelling-bee/frontend/public/local/beebright-local.zip'
$global:BeeTestManifest = Get-Content (Join-Path $Repo 'BeeBright-Full-Stack/beebright-spelling-bee/frontend/public/local/manifest.json') -Raw | ConvertFrom-Json
function Invoke-RestMethod { return $global:BeeTestManifest }
function Invoke-WebRequest {
    param($Uri, $OutFile, $TimeoutSec, [switch]$UseBasicParsing)
    if ($Uri -like 'https://www.python.org/*' -or $Uri -like 'https://go.microsoft.com/*') {
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
    & "$Bee/runtime-3.14/python.exe" (Join-Path $Repo "tools/test_local_ui.py")
    if ($LASTEXITCODE) { throw 'Installed runtime could not open the desktop UI.' }
} finally { Pop-Location }
Write-Host 'Official runtime installation, command availability, WebView2, and desktop UI passed.'
