$ErrorActionPreference = 'Stop'
$Repo = Split-Path $PSScriptRoot -Parent
foreach ($Script in @('install.ps1', 'bootstrap.ps1')) {
    $Tokens = $null; $Errors = $null
    [Management.Automation.Language.Parser]::ParseFile((Join-Path $Repo "local/$Script"), [ref]$Tokens, [ref]$Errors) | Out-Null
    if ($Errors.Count) { throw ($Errors | Out-String) }
}
$env:LOCALAPPDATA = Join-Path $env:RUNNER_TEMP 'bee-update-test'
$Bee = Join-Path $env:LOCALAPPDATA 'BeeBright'
New-Item -ItemType Directory -Force -Path "$Bee/runtime-3.15", "$Bee/userdata" | Out-Null
Set-Content "$Bee/runtime-3.15/pythonw.exe" ''
Set-Content "$Bee/userdata/progress.json" '{"sentinel":"keep-me"}'
$Archive = Join-Path $Repo 'BeeBright-Full-Stack/beebright-spelling-bee/frontend/public/local/beebright-local.zip'
$global:BeeTestManifest = Get-Content (Join-Path $Repo 'BeeBright-Full-Stack/beebright-spelling-bee/frontend/public/local/manifest.json') -Raw | ConvertFrom-Json
function Invoke-RestMethod { return $global:BeeTestManifest }
function Invoke-WebRequest { param($Uri, $OutFile, $TimeoutSec, [switch]$UseBasicParsing) Copy-Item $Archive $OutFile }
New-Item -ItemType Directory -Force -Path "$Bee/current/beebright_local" | Out-Null
Set-Content "$Bee/current/beebright_local/app.py" '# running legacy app'
$LegacyLock = [IO.File]::Open("$Bee/current/beebright_local/app.py", 'Open', 'Read', 'Read')
try { & (Join-Path $Repo 'local/bootstrap.ps1') -SkipLaunch } finally { $LegacyLock.Dispose() }
$Package = Join-Path "$Bee/packages" (Get-Content "$Bee/active-package.json" -Raw | ConvertFrom-Json).package
if (-not (Test-Path "$Bee/current/beebright_local/app.py")) { throw 'Update moved the locked legacy package.' }
if ((Get-Content "$Package/version.json" -Raw | ConvertFrom-Json).version -ne $global:BeeTestManifest.version) { throw 'Update did not install.' }
if ((Get-Content "$Bee/userdata/progress.json" -Raw) -notmatch 'keep-me') { throw 'Update erased progress.' }
$HeldPackage = $Package
$PackageLock = [IO.File]::Open("$HeldPackage/beebright_local/app.py", 'Open', 'Read', 'Read')
Remove-Item "$HeldPackage/bootstrap.ps1"
try { & (Join-Path $Repo 'local/bootstrap.ps1') update } finally { $PackageLock.Dispose() }
$Package = Join-Path "$Bee/packages" (Get-Content "$Bee/active-package.json" -Raw | ConvertFrom-Json).package
if ($Package -eq $HeldPackage -or -not (Test-Path "$HeldPackage/beebright_local/app.py")) { throw 'Locked package repair was unsafe.' }
$global:BeeTestLaunched = $false
function Start-Process { $global:BeeTestLaunched = $true; throw 'Update command must not launch the UI.' }
& (Join-Path $Repo 'local/bootstrap.ps1') update
if ($global:BeeTestLaunched) { throw 'Update opened the UI.' }
if ((Get-Content "$Bee/bin/beebright.cmd" -Raw) -notmatch '%\*') { throw 'Launcher did not forward update argument.' }
function Invoke-RestMethod { throw 'Simulated offline connection' }
$UpdateFailed = $false
try { & (Join-Path $Repo 'local/bootstrap.ps1') update } catch { $UpdateFailed = $true }
if (-not $UpdateFailed) { throw 'Explicit update falsely succeeded while offline.' }
& (Join-Path $Repo 'local/bootstrap.ps1') -SkipLaunch
if (-not (Test-Path "$Package/beebright_local/app.py")) { throw 'Offline fallback lost installed app.' }
$global:BeeTestOpened = ''
function Start-Process { param($FilePath) $global:BeeTestOpened = $FilePath }
& (Join-Path $Repo 'local/bootstrap.ps1') web
if ($global:BeeTestOpened -ne 'https://beebright.vercel.app/') { throw 'Web command did not open the website.' }
$InvalidCommandFailed = $false
try { & (Join-Path $Repo 'local/bootstrap.ps1') create invalid } catch { $InvalidCommandFailed = $true }
if (-not $InvalidCommandFailed) { throw 'Invalid create command did not report usage.' }
Write-Host 'Update installation, progress preservation, offline fallback, and PowerShell syntax passed.'

# Exercise the real Windows PowerShell argument binder for every spelling.
$ExpectedRelease = Get-Content "$Package/release.json" -Raw | ConvertFrom-Json
foreach ($Flag in @('-v', '--v', '--version', '-version')) {
    $Output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Repo 'local/bootstrap.ps1') $Flag
    if ($LASTEXITCODE -ne 0 -or ($Output -join "`n") -ne "BeeBright $($ExpectedRelease.version)") {
        throw "Version flag $Flag failed: $Output"
    }
}
Write-Host 'All four offline installed-version flags passed.'

$Help = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Repo 'local/bootstrap.ps1') help
if ($LASTEXITCODE -ne 0 -or ($Help -join "`n") -notmatch 'beebright uninstall') { throw 'Help did not list commands.' }
$SavedUserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$Unrelated = Join-Path $env:LOCALAPPDATA 'unrelated-python'
New-Item -ItemType Directory -Force $Unrelated | Out-Null
try {
    [Environment]::SetEnvironmentVariable('Path', ($SavedUserPath + ';' + "$Bee\bin"), 'User')
    & (Join-Path $Repo 'local/bootstrap.ps1') uninstall
    if (Test-Path $Bee) { throw 'Uninstall left the private runtime or local data behind.' }
    if (-not (Test-Path $Unrelated)) { throw 'Uninstall removed unrelated files.' }
    if (([Environment]::GetEnvironmentVariable('Path', 'User') -split ';') -contains "$Bee\bin") { throw 'Uninstall left the launcher on PATH.' }
} finally { [Environment]::SetEnvironmentVariable('Path', $SavedUserPath, 'User') }
Write-Host 'Offline help and scoped uninstall passed.'
