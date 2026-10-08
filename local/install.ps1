param([switch]$SkipLaunch)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$BeeRoot = Join-Path $env:LOCALAPPDATA 'BeeBright'
$Bin = Join-Path $BeeRoot 'bin'
$Runtime = Join-Path $BeeRoot 'runtime-3.14'
New-Item -ItemType Directory -Force -Path $BeeRoot, $Bin | Out-Null
function Test-BeeRuntime([string]$Folder) {
    $Exe = Join-Path $Folder 'python.exe'
    if (-not (Test-Path $Exe) -or -not (Test-Path (Join-Path $Folder 'pythonw.exe'))) { return $false }
    try {
        & $Exe -I -c "import sys, struct; sys.exit(0 if sys.implementation.name == 'cpython' and sys.version_info[:2] == (3, 14) and struct.calcsize('P') == 8 else 1)" 2>$null
        return ($LASTEXITCODE -eq 0)
    } catch { return $false }
}
function Find-BeePython {
    $Candidates = @()
    foreach ($Hive in @('HKCU:', 'HKLM:')) {
        foreach ($Key in @(Get-ChildItem "$Hive\Software\Python\PythonCore" -ErrorAction SilentlyContinue)) {
            if ($Key.PSChildName -like '3.14*') {
                $InstallKey = Get-Item "$($Key.PSPath)\InstallPath" -ErrorAction SilentlyContinue
                if ($InstallKey) { $Candidates += [string]$InstallKey.GetValue('') }
            }
        }
    }
    $Candidates += Join-Path $env:LOCALAPPDATA 'Programs\Python\Python314'
    foreach ($Base in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) {
        if ($Base) { $Candidates += Join-Path $Base 'Python314' }
    }
    $PythonCommand = Get-Command python.exe -CommandType Application -ErrorAction SilentlyContinue
    if ($PythonCommand) { $Candidates += Split-Path $PythonCommand.Source -Parent }
    foreach ($Folder in ($Candidates | Select-Object -Unique)) {
        if ($Folder -and $Folder.TrimEnd('\') -ne $Runtime.TrimEnd('\') -and (Test-BeeRuntime $Folder)) { return $Folder }
    }
}
function Copy-BeePython([string]$Source) {
    Write-Host 'Creating BeeBright runtime from the existing Python 3.14 installation...'
    New-Item -ItemType Directory -Force -Path $Runtime, "$Runtime\Lib", "$Runtime\Lib\site-packages" | Out-Null
    # Copy only the interpreter and standard library, never third-party packages.
    Get-ChildItem $Source -File | Where-Object { $_.Name -match '^(python.*\.(exe|dll)|vcruntime.*\.dll|LICENSE.*)$' } | Copy-Item -Destination $Runtime -Force
    foreach ($Folder in @('DLLs', 'libs', 'include')) {
        if (Test-Path "$Source\$Folder") { Copy-Item "$Source\$Folder" $Runtime -Recurse -Force }
    }
    Get-ChildItem "$Source\Lib" | Where-Object { $_.Name -notin @('site-packages', '__pycache__') } | Copy-Item -Destination "$Runtime\Lib" -Recurse -Force
}
if (-not (Test-BeeRuntime $Runtime)) {
    $ExistingPython = Find-BeePython
    if ($ExistingPython) { Copy-BeePython $ExistingPython }
}
if (-not (Test-BeeRuntime $Runtime)) {
    Write-Host 'Installing the official Python runtime for BeeBright (this may take a minute)...'
    $Setup = Join-Path $BeeRoot 'python-setup.exe'
    try {
        Invoke-WebRequest 'https://www.python.org/ftp/python/3.14.8/python-3.14.8-amd64.exe' -OutFile $Setup -UseBasicParsing
        $Signature = Get-AuthenticodeSignature $Setup
        if ($Signature.Status -ne 'Valid' -or $Signature.SignerCertificate.Subject -notmatch 'Python Software Foundation') { throw 'The Python installer signature could not be verified.' }
        $SetupLog = Join-Path $BeeRoot 'python-setup.log'
        $Arguments = @('/quiet', '/log', "`"$SetupLog`"", 'InstallAllUsers=0', "TargetDir=`"$Runtime`"", 'PrependPath=0', 'Include_launcher=0', 'Include_pip=1', 'Include_test=0', 'Include_tcltk=0')
        $Process = Start-Process $Setup -ArgumentList $Arguments -PassThru -Wait
        if ($Process.ExitCode -notin @(0, 3010)) { throw "Python setup failed ($($Process.ExitCode)). Details: $SetupLog" }
        if (-not (Test-BeeRuntime $Runtime)) {
            $ExistingPython = Find-BeePython
            if ($ExistingPython) { Copy-BeePython $ExistingPython }
        }
        if (-not (Test-BeeRuntime $Runtime)) {
            # Manually removing an old runtime can leave setup registration behind.
            Write-Host 'Repairing the incomplete Python 3.14 installation...'
            $RepairLog = Join-Path $BeeRoot 'python-repair.log'
            $Process = Start-Process $Setup -ArgumentList @('/repair', '/quiet', '/log', "`"$RepairLog`"") -PassThru -Wait
            if ($Process.ExitCode -notin @(0, 3010)) { throw "Python repair failed ($($Process.ExitCode)). Details: $RepairLog" }
            if (-not (Test-BeeRuntime $Runtime)) {
                $ExistingPython = Find-BeePython
                if ($ExistingPython) { Copy-BeePython $ExistingPython }
            }
        }
    } finally { if (Test-Path $Setup) { Remove-Item $Setup -Force } }
}
if (-not (Test-BeeRuntime $Runtime)) {
    throw "Python setup did not create a working 64-bit Python 3.14 runtime at $Runtime. See $BeeRoot\python-setup.log and python-repair.log. No BeeBright launcher was installed."
}
& "$Runtime\python.exe" -I -m ensurepip --upgrade
if ($LASTEXITCODE) { throw 'The BeeBright runtime could not initialize pip.' }
# Use Microsoft's WebView2 renderer, never the legacy Internet Explorer engine.
$WebViewFound = (Get-ChildItem "${env:ProgramFiles(x86)}\Microsoft\EdgeWebView\Application\*\msedgewebview2.exe" -ErrorAction SilentlyContinue) -or (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\EdgeWebView\Application\*\msedgewebview2.exe" -ErrorAction SilentlyContinue)
if (-not $WebViewFound) {
    $WebViewSetup = Join-Path $BeeRoot 'webview2-setup.exe'
    Invoke-WebRequest 'https://go.microsoft.com/fwlink/p/?LinkId=2124703' -OutFile $WebViewSetup -UseBasicParsing
    $Signature = Get-AuthenticodeSignature $WebViewSetup
    if ($Signature.Status -ne 'Valid' -or $Signature.SignerCertificate.Subject -notmatch 'Microsoft Corporation') { throw 'WebView2 installer signature could not be verified.' }
    $Process = Start-Process $WebViewSetup -ArgumentList @('/silent','/install') -Wait -PassThru
    if ($Process.ExitCode -notin @(0,3010)) { throw "WebView2 setup failed: $($Process.ExitCode)" }
    Remove-Item $WebViewSetup -Force
}
& "$Runtime\python.exe" -m pip install --disable-pip-version-check 'pywebview==6.2.1' 'pythonnet==3.2.0'
if ($LASTEXITCODE) { throw 'BeeBright desktop dependencies could not be installed.' }
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
