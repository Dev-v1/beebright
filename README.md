# beebright
Spelling Bee Practice Website

## Local browser commands

`beebright web` opens https://beebright.vercel.app/.

`beebright create web` serves the offline edition at http://beebright.localhost:8765/. Keep the terminal open; Ctrl+C stops the server. No login or cloud features are required. See `local/README.md` for port fallback and source usage.

## Install on macOS or Linux

```sh
curl -fsSL https://beebright.vercel.app/install.sh | sh
```

Open a new terminal and type `beebright`. The local UI opens in your browser, without login or cloud features. The installer manages its own Python 3.14 runtime. See `local/README.md` for platform details.

## Check the installed version

Run any of these in your terminal:

```powershell
beebright -v
beebright --v
beebright --version
beebright -version
```

Each prints the installed release, such as `BeeBright 1.7`, without opening the app or accessing the internet. Run `beebright update` separately to get the latest version.

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

## Uninstall on macOS or Linux

Stop BeeBright with Ctrl+C, then remove the app, private runtime and local progress:

```sh
rm -rf "$HOME/.local/share/BeeBright"
rm -f "$HOME/.local/bin/beebright"
```

Optionally remove the `# BeeBright` PATH line from `~/.zshrc` or `~/.bashrc`.
