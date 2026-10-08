# beebright
Spelling Bee Practice Website

## Uninstall BeeBright on Windows

Close BeeBright first. These PowerShell commands remove BeeBright, its private Python runtime, and all saved local progress and settings. They also remove the BeeBright command from your user PATH. They leave other Python installations and the shared Microsoft WebView2 runtime in place.

```powershell
$BeeRoot = Join-Path $env:LOCALAPPDATA 'BeeBright'
$BeeBin = Join-Path $BeeRoot 'bin'
$UserPath = [string][Environment]::GetEnvironmentVariable('Path', 'User')
$CleanPath = ($UserPath -split ';' | Where-Object {
    $_.Trim().TrimEnd('\') -ine $BeeBin.TrimEnd('\')
}) -join ';'
[Environment]::SetEnvironmentVariable('Path', $CleanPath, 'User')
$env:Path = ($env:Path -split ';' | Where-Object {
    $_.Trim().TrimEnd('\') -ine $BeeBin.TrimEnd('\')
}) -join ';'
Remove-Item -LiteralPath $BeeRoot -Recurse -Force -ErrorAction SilentlyContinue
```

Open a new terminal afterward. To keep your progress for a future reinstall, copy `%LOCALAPPDATA%\BeeBright\userdata` somewhere safe before running these commands. Removing the local app does not delete your website account or its cloud progress.
