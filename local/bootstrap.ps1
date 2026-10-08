param([switch]$SkipLaunch, [Parameter(Position=0)][string]$Command = '')
if ($Command -notin @('', 'update')) { throw 'Usage: beebright [update]' }
$UpdateOnly = $Command -eq 'update'
if ($UpdateOnly) { $SkipLaunch = $true }
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$BeeRoot = Join-Path $env:LOCALAPPDATA 'BeeBright'
$Current = Join-Path $BeeRoot 'current'
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
        if ($Installed -ne $Manifest.version) {
            Write-Host 'Updating BeeBright...'
            $Stage = Join-Path $BeeRoot ('stage-' + [guid]::NewGuid().ToString('N'))
            $Zip = $Stage + '.zip'
            try {
                Invoke-WebRequest $Manifest.url -OutFile $Zip -TimeoutSec 90 -UseBasicParsing
                if ((Get-FileHash $Zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Manifest.sha256) { throw 'Update checksum did not match.' }
                Expand-Archive -LiteralPath $Zip -DestinationPath $Stage
                if (-not (Test-Path "$Stage\beebright_local\app.py")) { throw 'Update is missing the desktop app.' }
                $Version = (Get-Content "$Stage\version.json" -Raw | ConvertFrom-Json).version
                if ($Version -ne $Manifest.version) { throw 'Update version did not match.' }
                $Old = Join-Path $BeeRoot 'previous'
                if (Test-Path $Old) { Remove-Item $Old -Recurse -Force }
                if (Test-Path $Current) { Move-Item $Current $Old }
                try { Move-Item $Stage $Current } catch {
                    if (Test-Path $Old) { Move-Item $Old $Current }
                    throw
                }
                Copy-Item "$Current\bootstrap.ps1" "$BeeRoot\bootstrap.ps1" -Force
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
$Python = Join-Path $BeeRoot 'runtime-3.14\pythonw.exe'
if (-not (Test-Path $Python)) {
    Write-Host 'BeeBright now uses Python 3.14. Installing the updated runtime...'
    Invoke-WebRequest 'https://beebright.vercel.app/install.ps1' -OutFile "$BeeRoot\install-new.ps1" -UseBasicParsing
    & "$BeeRoot\install-new.ps1" -SkipLaunch
    if (-not (Test-Path $Python)) { throw 'Python 3.14 installation failed. Run the install command again.' }
}
if (-not (Test-Path $Python)) { throw 'BeeBright runtime is missing. Run the install command again.' }
if ($SkipLaunch) { return }
Start-Process -FilePath $Python -WorkingDirectory $Current -ArgumentList @('-m', 'beebright_local')
