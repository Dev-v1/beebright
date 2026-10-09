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
    & "$Bee/runtime-3.15/python.exe" (Join-Path $Repo "tools/test_local_ui.py")
    if ($LASTEXITCODE) { throw 'Installed runtime could not open the desktop UI.' }
    $env:BEEBRIGHT_TEST_LOCAL_WEB = '1'
    try {
        & "$Bee/runtime-3.15/python.exe" (Join-Path $Repo "tools/test_local_ui.py")
        if ($LASTEXITCODE) { throw 'Loopback browser UI or local HTTP bridge failed.' }
    } finally { Remove-Item Env:BEEBRIGHT_TEST_LOCAL_WEB }
} finally { Pop-Location }
# Reproduce reinstall after BeeBright removal with Python 3.15 left elsewhere.
$Existing = Join-Path $env:LOCALAPPDATA 'Programs/Python/Python315'
New-Item -ItemType Directory -Force -Path (Split-Path $Existing -Parent) | Out-Null
Move-Item "$Bee/runtime-3.15" $Existing
$OriginalHash = (Get-FileHash "$Existing/python.exe").Hash
& (Join-Path $Repo 'local/install.ps1') -SkipLaunch
if (-not (Test-Path "$Bee/runtime-3.15/python.exe")) { throw 'Reinstall failed to create a private runtime from existing Python.' }
if ((Get-FileHash "$Existing/python.exe").Hash -ne $OriginalHash) { throw 'Installer modified the existing Python installation.' }
& "$Bee/runtime-3.15/python.exe" -I -c "import webview, clr; import sys; assert sys.version_info[:2] == (3, 15)"
if ($LASTEXITCODE) { throw 'Reinstalled Python runtime or desktop dependencies are invalid.' }
# Manual folder deletion leaves Python's installer registration behind.
Move-Item "$Bee/runtime-3.15" (Join-Path $env:RUNNER_TEMP 'bee-runtime-backup')
Move-Item $Existing (Join-Path $env:RUNNER_TEMP 'bee-existing-backup')
& (Join-Path $Repo 'local/install.ps1') -SkipLaunch
& "$Bee/runtime-3.15/python.exe" -I -c "import webview, clr"
if ($LASTEXITCODE) { throw 'Repair after manual runtime removal failed.' }
Write-Host 'Official runtime installation, command availability, WebView2, and desktop UI passed.'
