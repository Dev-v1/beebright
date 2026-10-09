# BeeBright Local

A native desktop spelling practice app using the website’s exact React components, CSS, icons, and bundled fonts. No account, admin panel, or cloud progress database. Practice connects only to a server on this computer. Includes Flash Cards, Fill in the Blank, Multiple Choice, and Type the Word, with definitions, word origins, and sentences that hide the target spelling. Speech uses a voice installed on your computer.

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

The installer adds the command to your user PATH and installs an official signed Python 3.15.0 runtime under `%LOCALAPPDATA%\BeeBright\runtime-3.15`, plus pywebview/Python.NET and Microsoft WebView2 when needed. No administrator privileges are required. Windows x64 is supported by this installer. You can review `install.ps1` before running it.

To update without opening the app, close BeeBright and run:

```powershell
beebright update
```

It checks the latest verified package and preserves your local progress. An explicit update reports a connection failure instead of claiming success. Each normal launch also checks for an update. Packages are verified with SHA-256 and installed through a staging directory. If the internet is unavailable, the installed app opens normally. Progress and settings live separately in `%LOCALAPPDATA%\BeeBright\userdata` and survive updates. Installation and updates require internet; practice does not.

## macOS and Linux install

```sh
curl -fsSL https://beebright.vercel.app/install.sh | sh
```

The installer downloads Astral uv from its official source and installs a private Python 3.15 runtime, requiring no administrator access. It adds `~/.local/bin` to your bash or zsh profile. Open a new terminal and type `beebright`, or immediately use `~/.local/bin/beebright`. The same UI opens in your default browser; keep the terminal open and use Ctrl+C to stop. No pywebview, login or cloud storage is needed. Install `espeak` or `espeak-ng` for Linux offline speech. macOS uses its built-in `say` voice.

`beebright update`, `beebright web`, `beebright create web`, and all four version flags also work here. Verified updates preserve `~/.local/share/BeeBright/userdata`. Python, uv and the app live under `~/.local/share/BeeBright`; other Python installations stay separate.

## Open BeeBright in a browser

Open the public website:

```powershell
beebright web
```

Start a local browser edition, with no login or cloud features:

```powershell
beebright create web
```

It opens `http://beebright.localhost:8765/` and serves only this computer. Keep the terminal open while practicing; press Ctrl+C to stop. If the port is busy, BeeBright chooses the next available port and prints the address. If your browser cannot resolve the friendly name, use the printed `http://127.0.0.1:8765/` address. Chrome and Edge support localhost subdomains without editing your hosts file. This is a local server, not a published website. It uses the same bundled UI, hints, offline speech, theme, and progress files as the native app. Use one edition at a time so the most recent save does not overwrite another session.

To run this mode directly from the source ZIP, use `python -m beebright_local --web`. Optional: `--port 9000`.

## Run from source

Download the release ZIP, extract it, and use Python 3.15 and the desktop dependencies:

```text
python -m pip install -r requirements.txt
python -m beebright_local
```

On macOS, speech uses `say`; on Linux, install a pywebview GTK/Qt renderer and `espeak`. The terminal installer and verified updates support macOS and Linux too; their default UI opens in the browser.

## How website fixes reach the local edition

The website repository `Dev-v1/beebright` is the canonical source. Its `local/` directory contains this app. Every website build regenerates the desktop bundle using the same React practice components, styling, fonts, hint-masking code, distractor generator, word lists, and hint data as that website commit. A desktop-only entry point removes cloud controls and connects to a Python bridge that saves progress locally. Rebuild the included UI sources with `cd ui-source`, `npm ci`, and `npx vite build --mode desktop`, then copy `dist-local/` into `beebright_local/ui/`. The installed launcher checks this bundle on every launch, falling back to the standalone GitHub release manifest when the website endpoint is unavailable.

This repository's sync workflow checks the canonical main branch hourly, copies the desktop package here, runs the local tests, and publishes a new source ZIP release when the upstream commit changes. Desktop-specific fixes belong in canonical `local/`. Website authentication and administration changes are intentionally outside the desktop feature set.

## License

BeeBright code and original content retain the website's Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International license. See `LICENSE`. Third-party dictionary adaptations retain their own attribution and license metadata, including CC BY-SA 4.0 for Wiktionary adaptations. Dictionary reference links are in the bundled hint records; original examples are labeled as such.

The old Tkinter window has been replaced by the shared website UI in a desktop WebView2 window. Practice does not connect to Clerk, Render, Neon, Google Fonts, or dictionary APIs. Attribution links open only when clicked. Earlier locally saved sessions are migrated. The old Python 3.13 runtime is not removed automatically; uninstall it through Windows Installed apps if it is no longer needed.

## Check the installed version

Run any of these in your terminal:

```powershell
beebright -v
beebright --v
beebright --version
beebright -version
```

Each prints the installed release, such as `BeeBright 2.0 (fixed)`, without opening the app or accessing the internet. Run `beebright update` separately to get the latest version.

The 2027 study list has 150 words in each of One Bee, Two Bee, and Three Bee. Each normal 2027 practice run includes all 150 in a shuffled order. Other lists use 100-question sets, and custom challenges keep their selected lengths.

## Commands

Run `beebright help` for descriptions of every command. Help and version checks work offline. `beebright update` installs the latest app and migrates older private runtimes to Python 3.15.

## BeeBright 2.0 commands

Type `beebright help` to list every command. Windows opens its desktop window; macOS and Linux open the same local UI in a browser.

| Command | Action |
|---|---|
| `beebright daily` | Same ten words each UTC day |
| `beebright review` | Missed-word review |
| `beebright compete` | Elimination spelling bee |
| `beebright doctor` | Runtime, files, speech and data checks |
| `beebright stats` | Answer totals and accuracy |
| `beebright profile` | Open local players; also list, add NAME, switch NAME |
| `beebright backup` | Save all players to a timestamped JSON file in the current terminal directory; optional FILE.json |
| `beebright restore` | Open a backup picker; optional FILE.json |
| `beebright sprint` | Two-minute timed challenge |
| `beebright lists` | Lists, levels and completion |
| `beebright practice` | Custom session controls |
| `beebright audio` | Adjust and test speech |
| `beebright origins` | Practice by origin language |
| `beebright pairs` | Confusing word-pair lessons |
| `beebright favorites` | Practice saved words |
| `beebright worksheet` | Printable blanks and a separate answer key |
| `beebright remind` | Reminder controls; also HH:MM or off |
| `beebright achievements` | Practice milestones |
| `beebright duel` | Two players alternate turns |
| `beebright changelog` | Release notes |

Reminders work while the computer is awake and you are signed in. Reopen BeeBright after restarting to resume reminders. Example: `beebright remind 18:30`, and `beebright remind off` to stop. They do not require cloud services. Practice history is limited to the most recent 5,000 answers. Origin groups match language names in supplied histories; words can appear in several groups. List completion means a word has been answered correctly at least once, rather than a claim of permanent mastery.

Website practice tools save statistics and favorites in the current browser, separately for each account. Local profiles stay on the computer. The two backup formats are separate; neither exports Clerk credentials or website account data.

## Uninstall

Close BeeBright and stop local browser practice with Ctrl+C, then run:

```text
beebright uninstall
```

This removes BeeBright, its private runtimes, terminal launcher, local saved progress and settings. Other Python installations, shared WebView2 and website account/progress remain. Back up your BeeBright `userdata` folder first if you want to retain progress. On Windows it is `%LOCALAPPDATA%\BeeBright\userdata`; on macOS/Linux it is `~/.local/share/BeeBright/userdata`.
