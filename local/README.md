# BeeBright Local

A native desktop spelling practice app using the website’s exact React components, CSS, icons, and bundled fonts. No account, admin panel, server, or cloud progress database. Includes Flash Cards, Fill in the Blank, Multiple Choice, and Type the Word, with definitions, word origins, and sentences that hide the target spelling. Speech uses a voice installed on your computer.

## Windows install

In PowerShell:

```powershell
irm https://beebright.vercel.app/install.ps1 | iex
```

If the website installer has not been deployed yet, the standalone repository also serves it:

```powershell
irm https://raw.githubusercontent.com/Dev-v1/beebright-local/main/install.ps1 | iex
```

Then run:

```text
beebright
```

The installer adds the command to your user PATH and installs an official signed Python 3.14.8 runtime under `%LOCALAPPDATA%\BeeBright\runtime-3.14`, plus pywebview/Python.NET and Microsoft WebView2 when needed. No administrator privileges are required. Windows x64 is supported by this installer. You can review `install.ps1` before running it.

Each launch checks for an update. Packages are verified with SHA-256 and installed through a staging directory. If the internet is unavailable, the installed app opens normally. Progress and settings live separately in `%LOCALAPPDATA%\BeeBright\userdata` and survive updates. Installation and updates require internet; practice does not.

## Run from source

Download the release ZIP, extract it, and use Python 3.14 and the desktop dependencies:

```text
python -m pip install -r requirements.txt
python -m beebright_local
```

On macOS, speech uses `say`; on Linux, install a pywebview GTK/Qt renderer and `espeak`. The one-command installer and automatic launch updates are currently for Windows x64.

## How website fixes reach the local edition

The website repository `Dev-v1/beebright` is the canonical source. Its `local/` directory contains this app. Every website build regenerates the desktop bundle using the same React practice components, styling, fonts, hint-masking code, distractor generator, word lists, and hint data as that website commit. A desktop-only entry point removes cloud controls and connects to a Python bridge that saves progress locally. Rebuild the included UI sources with `cd ui-source`, `npm ci`, and `npx vite build --mode desktop`, then copy `dist-local/` into `beebright_local/ui/`. The installed launcher checks this bundle on every launch, falling back to the standalone GitHub release manifest when the website endpoint is unavailable.

This repository's sync workflow checks the canonical main branch hourly, copies the desktop package here, runs the local tests, and publishes a new source ZIP release when the upstream commit changes. Desktop-specific fixes belong in canonical `local/`. Website authentication and administration changes are intentionally outside the desktop feature set.

## License

BeeBright code and original content retain the website's Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International license. See `LICENSE`. Third-party dictionary adaptations retain their own attribution and license metadata, including CC BY-SA 4.0 for Wiktionary adaptations. Dictionary reference links are in the bundled hint records; original examples are labeled as such.

The old Tkinter window has been replaced by the shared website UI in a desktop WebView2 window. Practice does not connect to Clerk, Render, Neon, Google Fonts, or dictionary APIs. Attribution links open only when clicked. Earlier locally saved sessions are migrated. The old Python 3.13 runtime is not removed automatically; uninstall it through Windows Installed apps if it is no longer needed.
