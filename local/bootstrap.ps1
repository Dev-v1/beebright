param([switch]$SkipLaunch, [Parameter(Position=0)][string]$Command = '', [Parameter(Position=1)][string]$Target = '', [Alias('v', '-v', '-version')][switch]$Version, [Parameter(ValueFromRemainingArguments=$true)][string[]]$ExtraArguments)
$BeeRoot = Join-Path $env:LOCALAPPDATA 'BeeBright'
function Get-BeePackage {
    $Pointer = Join-Path $BeeRoot 'active-package.json'
    if (Test-Path $Pointer) {
        $Name = (Get-Content $Pointer -Raw | ConvertFrom-Json).package
        if ($Name -notmatch '^[a-f0-9]{40}-[a-f0-9]{8}$') { throw 'Invalid installed package pointer. Run the install command again.' }
        return Join-Path (Join-Path $BeeRoot 'packages') $Name
    }
    return Join-Path $BeeRoot 'current'
}
if ($Command -eq 'help') {
    Write-Output @'
BeeBright commands
  beebright                 Open local spelling practice; check for updates first.
  beebright update          Update the app and private Python runtime.
  beebright web             Open https://beebright.vercel.app/.
  beebright create web      Open local practice in a browser; Ctrl+C stops it.
  beebright -v              Show the installed version (also --v, --version, -version).
  beebright help            Show this command list without internet access.
  beebright uninstall       Remove BeeBright, its private runtimes and local saved progress.

  beebright daily         Start today's shared ten-word challenge.
  beebright review        Practice words you missed.
  beebright compete       Start an elimination spelling bee.
  beebright doctor        Check runtime, catalog, UI and speech.
  beebright stats         Show accuracy and answer totals.
  beebright profile       Open local players; list, add NAME, switch NAME.
  beebright backup        Save all players; optionally supply FILE.json.
  beebright restore       Open backup picker; optionally supply FILE.json.
  beebright sprint        Start a two-minute spelling sprint.
  beebright lists         Show study lists and completion.
  beebright practice      Choose list, mode and question count.
  beebright audio         Adjust and test pronunciation speed.
  beebright origins       Practice words by source language.
  beebright pairs         Practice confusing word pairs.
  beebright favorites     Practice saved favorite words.
  beebright worksheet     Create a printable worksheet and answer key.
  beebright remind        Set a reminder; HH:MM or off.
  beebright achievements  View earned practice milestones.
  beebright duel          Alternate turns between two players.
  beebright changelog     Show release notes.
Close BeeBright and stop local web practice before uninstalling.
'@
    return
}
if ($Command -eq 'uninstall') {
    $ErrorActionPreference = 'Stop'
    # Stop only BeeBright reminder workers, verified by executable path and command line.
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $_.ExecutablePath -and $_.ExecutablePath.StartsWith($BeeRoot + '\', [StringComparison]::OrdinalIgnoreCase) -and $_.CommandLine -match '--reminder-worker'
    } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    $Running = Get-Process -ErrorAction SilentlyContinue | Where-Object {
        try { $_.Path -and $_.Path.StartsWith($BeeRoot + '\', [StringComparison]::OrdinalIgnoreCase) } catch { $false }
    }
    if ($Running) { throw 'Close BeeBright and stop local web practice with Ctrl+C, then run beebright uninstall again.' }
    $BeeBin = Join-Path $BeeRoot 'bin'
    $UserPath = [string][Environment]::GetEnvironmentVariable('Path', 'User')
    $CleanPath = ($UserPath -split ';' | Where-Object { $_.Trim().TrimEnd('\') -ine $BeeBin.TrimEnd('\') }) -join ';'
    [Environment]::SetEnvironmentVariable('Path', $CleanPath, 'User')
    $env:Path = ($env:Path -split ';' | Where-Object { $_.Trim().TrimEnd('\') -ine $BeeBin.TrimEnd('\') }) -join ';'
    if (Test-Path $BeeRoot) { Remove-Item -LiteralPath $BeeRoot -Recurse -Force }
    Write-Output 'BeeBright uninstalled. Private runtimes and local saved progress were removed.'
    return
}
if ($Version) {
    $ErrorActionPreference = 'Stop'
    $ReleaseFile = Join-Path (Get-BeePackage) 'release.json'
    if (-not (Test-Path $ReleaseFile)) { throw 'Installed BeeBright version is unavailable. Run beebright update.' }
    $Release = Get-Content $ReleaseFile -Raw | ConvertFrom-Json
    Write-Output "BeeBright $($Release.version)"
    return
}
$Features = @('daily', 'review', 'compete', 'doctor', 'stats', 'profile', 'backup', 'restore', 'sprint', 'lists', 'practice', 'audio', 'origins', 'pairs', 'favorites', 'worksheet', 'remind', 'achievements', 'duel', 'changelog')
if ($Command -in $Features) {
    $ErrorActionPreference = 'Stop'
    $env:BEEBRIGHT_DATA_DIR = Join-Path $BeeRoot 'userdata'
    $Runner = "import runpy,sys; sys.path.insert(0,sys.argv.pop(1)); runpy.run_module('beebright_local',run_name='__main__')"
    $Arguments = @('-c', $Runner, (Get-BeePackage), $Command)
    if ($Target) { $Arguments += $Target }
    if ($ExtraArguments) { $Arguments += $ExtraArguments }
    & (Join-Path $BeeRoot 'runtime-3.15/python.exe') @Arguments
    if ($LASTEXITCODE) { throw 'BeeBright command failed. See the message above.' }
    return
}
if ($Command -notin @('', 'update', 'web', 'create') -or ($Command -eq 'create' -and $Target -ne 'web') -or ($Command -ne 'create' -and $Target)) { throw 'Usage: beebright | update | web | create web | help | uninstall | --version' }
$UpdateOnly = $Command -eq 'update'
if ($UpdateOnly) { $SkipLaunch = $true }
$ErrorActionPreference = 'Stop'
if ($Command -eq 'web') { Start-Process 'https://beebright.vercel.app/'; return }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$BeeRoot = Join-Path $env:LOCALAPPDATA 'BeeBright'
$Current = Get-BeePackage
$Mutex = New-Object Threading.Mutex($false, 'Local\BeeBrightUpdater')
$Locked = $false
try {
    $Locked = $Mutex.WaitOne(15000)
    if (-not $Locked) { throw 'Another BeeBright update is in progress.' }
    try {
        try {
            $Manifest = Invoke-RestMethod 'https://beebright.vercel.app/local/manifest.json' -TimeoutSec 8
            if (-not $Manifest.version) { throw 'Website update is not available yet.' }
        } catch {
            $Manifest = Invoke-RestMethod 'https://raw.githubusercontent.com/Dev-v1/beebright-local/main/update-manifest.json' -TimeoutSec 8
        }
        if ($Manifest.version -notmatch '^[a-f0-9]{40}$' -or $Manifest.sha256 -notmatch '^[a-f0-9]{64}$' -or ($Manifest.url -ne 'https://beebright.vercel.app/local/beebright-local.zip' -and $Manifest.url -notmatch '^https://github\.com/Dev-v1/beebright-local/releases/download/desktop-[a-f0-9]{12}/beebright-local-source\.zip$')) {
            throw 'Invalid BeeBright update manifest.'
        }
        $Installed = ''
        if (Test-Path "$Current\version.json") { $Installed = (Get-Content "$Current\version.json" -Raw | ConvertFrom-Json).version }
        $Complete = (Test-Path "$Current\beebright_local\app.py") -and (Test-Path "$Current\beebright_local\web.py") -and (Test-Path "$Current\beebright_local\ui\local.html") -and (Test-Path "$Current\release.json") -and (Test-Path "$Current\bootstrap.ps1")
        if ($Installed -ne $Manifest.version -or -not $Complete) {
            Write-Host 'Updating BeeBright...'
            $Stage = Join-Path $BeeRoot ('stage-' + [guid]::NewGuid().ToString('N'))
            $Zip = $Stage + '.zip'
            try {
                Invoke-WebRequest $Manifest.url -OutFile $Zip -TimeoutSec 90 -UseBasicParsing
                if ((Get-FileHash $Zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Manifest.sha256) { throw 'Update checksum did not match.' }
                Expand-Archive -LiteralPath $Zip -DestinationPath $Stage
                if (-not (Test-Path "$Stage\beebright_local\app.py")) { throw 'Update is missing the desktop app.' }
                $PackageVersion = (Get-Content "$Stage\version.json" -Raw | ConvertFrom-Json).version
                if ($PackageVersion -ne $Manifest.version) { throw 'Update version did not match.' }
                # Never rename or remove a package a running app/server may still use.
                $Packages = Join-Path $BeeRoot 'packages'
                New-Item -ItemType Directory -Force -Path $Packages | Out-Null
                $Name = $Manifest.version + '-' + [guid]::NewGuid().ToString('N').Substring(0,8)
                $NewPackage = Join-Path $Packages $Name
                Move-Item -LiteralPath $Stage -Destination $NewPackage
                if (-not (Test-Path "$NewPackage\beebright_local\web.py") -or -not (Test-Path "$NewPackage\beebright_local\ui\local.html") -or -not (Test-Path "$NewPackage\release.json") -or -not (Test-Path "$NewPackage\bootstrap.ps1")) { throw 'Update package is incomplete.' }
                Copy-Item "$NewPackage\bootstrap.ps1" "$BeeRoot\bootstrap.ps1" -Force
                $Pointer = Join-Path $BeeRoot 'active-package.json'
                $PointerStage = $Pointer + '.' + [guid]::NewGuid().ToString('N') + '.tmp'
                $PointerBackup = $PointerStage + '.backup'
                try {
                    @{package=$Name} | ConvertTo-Json -Compress | Set-Content -LiteralPath $PointerStage -Encoding Ascii
                    if (Test-Path $Pointer) { [IO.File]::Replace($PointerStage, $Pointer, $PointerBackup) }
                    else { [IO.File]::Move($PointerStage, $Pointer) }
                } finally { foreach ($TemporaryPointer in @($PointerStage, $PointerBackup)) { if (Test-Path $TemporaryPointer) { Remove-Item -LiteralPath $TemporaryPointer -Force } } }
                $Current = $NewPackage
                Write-Host 'BeeBright is up to date.'
            } finally {
                if (Test-Path $Zip) { Remove-Item $Zip -Force }
                if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force }
            }
        } else { Write-Host 'BeeBright is already up to date.' }
    } catch {
        if ($UpdateOnly -or -not (Test-Path "$Current\beebright_local\app.py")) { throw }
        Write-Host "Update check unavailable; opening the installed offline version. $($_.Exception.Message)"
    }
} finally {
    if ($Locked) { $Mutex.ReleaseMutex() }
    $Mutex.Dispose()
}
# Refresh older installed commands so arguments reach the updater on future runs.
$Bin = Join-Path $BeeRoot 'bin'
New-Item -ItemType Directory -Force -Path $Bin | Out-Null
$Launcher = '@echo off' + "`r`n" + 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LOCALAPPDATA%\BeeBright\bootstrap.ps1" %*' + "`r`n"
Set-Content -Path "$Bin\beebright.cmd" -Value $Launcher -Encoding Ascii
$Python = Join-Path $BeeRoot 'runtime-3.15\pythonw.exe'
if (-not (Test-Path $Python)) {
    Write-Host 'BeeBright now uses Python 3.15. Installing the updated runtime...'
    Invoke-WebRequest 'https://beebright.vercel.app/install.ps1' -OutFile "$BeeRoot\install-new.ps1" -UseBasicParsing
    & "$BeeRoot\install-new.ps1" -SkipLaunch
    if (-not (Test-Path $Python)) { throw 'Python 3.15 installation failed. Run the install command again.' }
}
if (-not (Test-Path $Python)) { throw 'BeeBright runtime is missing. Run the install command again.' }
if ($SkipLaunch) { return }
if ($Command -eq 'create') {
    Push-Location $Current
    try {
        & (Join-Path $BeeRoot 'runtime-3.15\python.exe') -m beebright_local --web
        if ($LASTEXITCODE) { throw 'The local web server stopped with an error.' }
    } finally { Pop-Location }
    return
}
Start-Process -FilePath $Python -WorkingDirectory $Current -ArgumentList @('-m', 'beebright_local')
