# beebright
Spelling Bee Practice Website

## Local browser commands

`beebright web` opens https://beebright.vercel.app/.

`beebright create web` serves the offline edition at http://beebright.localhost:8765/. Keep the terminal open; Ctrl+C stops the server. No login or cloud features are required. See `local/README.md` for port fallback and source usage.

## Install on macOS or Linux

```sh
curl -fsSL https://beebright.vercel.app/install.sh | sh
```

Open a new terminal and type `beebright`. The local UI opens in your browser, without login or cloud features. The installer manages its own Python 3.15 runtime. See `local/README.md` for platform details.

## Check the installed version

Run any of these in your terminal:

```powershell
beebright -v
beebright --v
beebright --version
beebright -version
```

Each prints the installed release, such as `BeeBright 1.8`, without opening the app or accessing the internet. Run `beebright update` separately to get the latest version.

## Commands

Run `beebright help` for descriptions of every command. Help and version checks work offline. `beebright update` installs the latest app and migrates older private runtimes to Python 3.15.

## Uninstall

Close BeeBright and stop local browser practice with Ctrl+C, then run:

```text
beebright uninstall
```

This removes BeeBright, its private runtimes, terminal launcher, local saved progress and settings. Other Python installations, shared WebView2 and website account/progress remain. Back up your BeeBright `userdata` folder first if you want to retain progress. On Windows it is `%LOCALAPPDATA%\BeeBright\userdata`; on macOS/Linux it is `~/.local/share/BeeBright/userdata`.
