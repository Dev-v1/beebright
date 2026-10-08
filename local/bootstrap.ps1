param([switch]$SkipLaunch)
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
        $Manifest = Invoke-RestMethod 'https://beebright.vercel.app/local/manifest.json' -TimeoutSec 8
        if ($Manifest.version -notmatch '^[a-f0-9]{40}$' -or $Manifest.sha256 -notmatch '^[a-f0-9]{64}$' -or $Manifest.url -ne 'https://beebright.vercel.app/local/beebright-local.zip') {
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
        }
    } catch {
        if (-not (Test-Path "$Current\beebright_local\app.py")) { throw }
        Write-Host "Update check unavailable; opening the installed offline version. $($_.Exception.Message)"
    }
} finally {
    if ($Locked) { $Mutex.ReleaseMutex() }
    $Mutex.Dispose()
}
$Python = Join-Path $BeeRoot 'runtime\pythonw.exe'
if (-not (Test-Path $Python)) { throw 'BeeBright runtime is missing. Run the install command again.' }
if ($SkipLaunch) { return }
Start-Process -FilePath $Python -WorkingDirectory $Current -ArgumentList @('-m', 'beebright_local')
