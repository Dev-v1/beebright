param([switch]$SkipLaunch)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$BeeRoot = Join-Path $env:LOCALAPPDATA 'BeeBright'
$Bin = Join-Path $BeeRoot 'bin'
$Runtime = Join-Path $BeeRoot 'runtime'
New-Item -ItemType Directory -Force -Path $BeeRoot, $Bin | Out-Null
if (-not (Test-Path "$Runtime\pythonw.exe")) {
    Write-Host 'Installing the official Python runtime for BeeBright (this may take a minute)...'
    $Setup = Join-Path $BeeRoot 'python-setup.exe'
    try {
        Invoke-WebRequest 'https://www.python.org/ftp/python/3.13.16/python-3.13.16-amd64.exe' -OutFile $Setup -UseBasicParsing
        $Signature = Get-AuthenticodeSignature $Setup
        if ($Signature.Status -ne 'Valid' -or $Signature.SignerCertificate.Subject -notmatch 'Python Software Foundation') { throw 'The Python installer signature could not be verified.' }
        $Arguments = @('/quiet', 'InstallAllUsers=0', "TargetDir=`"$Runtime`"", 'PrependPath=0', 'Include_launcher=0', 'Include_pip=0', 'Include_test=0', 'Include_tcltk=1')
        $Process = Start-Process $Setup -ArgumentList $Arguments -PassThru -Wait
        if ($Process.ExitCode -notin @(0, 3010)) { throw "Python setup failed: $($Process.ExitCode)" }
    } finally { if (Test-Path $Setup) { Remove-Item $Setup -Force } }
}
try {
    Invoke-WebRequest 'https://beebright.vercel.app/local/bootstrap.ps1' -OutFile "$BeeRoot\bootstrap.ps1" -UseBasicParsing
    if ((Get-Content "$BeeRoot\bootstrap.ps1" -Raw) -notmatch 'BeeBrightUpdater') { throw 'Website launcher is not available yet.' }
} catch {
    Invoke-WebRequest 'https://raw.githubusercontent.com/Dev-v1/beebright-local/main/bootstrap.ps1' -OutFile "$BeeRoot\bootstrap.ps1" -UseBasicParsing
}
$Command = '@echo off' + "`r`n" + 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LOCALAPPDATA%\BeeBright\bootstrap.ps1"' + "`r`n"
Set-Content -Path "$Bin\beebright.cmd" -Value $Command -Encoding Ascii
$UserPath = [string][Environment]::GetEnvironmentVariable('Path', 'User')
if (($UserPath -split ';') -notcontains $Bin) { [Environment]::SetEnvironmentVariable('Path', ($UserPath.TrimEnd(';') + ';' + $Bin), 'User') }
if (($env:Path -split ';') -notcontains $Bin) { $env:Path += ';' + $Bin }
& "$BeeRoot\bootstrap.ps1" -SkipLaunch:$SkipLaunch
Write-Host 'Installed! Type beebright to open the desktop app. Your progress stays on this laptop.'
