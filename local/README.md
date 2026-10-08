# BeeBright Local

A native desktop spelling practice app. No account, admin panel, server, or cloud progress database. Includes Flash Cards, Fill in the Blank, Multiple Choice, and Type the Word, with definitions, word origins, and sentences that hide the target spelling. Speech uses a voice installed on your computer.

## Windows install

In PowerShell:

```powershell
irm https://beebright.vercel.app/install.ps1 | iex
```

Then run:

```text
beebright
```

The installer adds the command to your user PATH and installs an official signed Python runtime under `%LOCALAPPDATA%\BeeBright`. No administrator privileges are required. Windows x64 is supported by this installer. You can review `install.ps1` before running it.

Each launch checks for an update. Packages are verified with SHA-256 and installed through a staging directory. If the internet is unavailable, the installed app opens normally. Progress and settings live separately in `%LOCALAPPDATA%\BeeBright\userdata` and survive updates. Installation and updates require internet; practice does not.

## Run from source

Download the release ZIP, extract it, and use Python 3.11 or later with Tkinter:

```text
python -m beebright_local
```

On macOS, speech uses `say`; on Linux, install Tkinter and `espeak`. The one-command installer and automatic launch updates are currently for Windows x64.

## How website fixes reach the local edition

The website repository `Dev-v1/beebright` is the canonical source. Its `local/` directory contains this app. Every website build regenerates the desktop bundle using the exact same hint-masking code, distractor generator, word lists, and hint data as that website commit. The installed launcher checks this bundle on every launch.

This repository's sync workflow checks the canonical main branch hourly, copies the desktop package here, runs the local tests, and publishes a new source ZIP release when the upstream commit changes. Desktop-specific fixes belong in canonical `local/`. Website authentication and administration changes are intentionally outside the desktop feature set.

## License

BeeBright code and original content retain the website's Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International license. See `LICENSE`. Third-party dictionary adaptations retain their own attribution and license metadata, including CC BY-SA 4.0 for Wiktionary adaptations. Dictionary reference links are in the bundled hint records; original examples are labeled as such.
