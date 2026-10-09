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

## BeeBright 2.0 practice tools

The website and local edition share daily challenges, review, mock bees, sprints, custom sessions, origins, word pairs, favorites, printable worksheets, duels, statistics and achievements. Open **Practice tools** from the main navigation. Local terminal commands also provide player profiles, backup/restore, reminders, diagnostics and release notes. See [the local command reference](local/README.md#beebright-20-commands).

Statistics and favorites on the website are per-account browser data. Existing session cloud saves remain supported. The local edition keeps everything on the computer and does not need an account.

## Break arcade (2.1)

Normal practice offers optional 10-minute breaks after each 50 words and a 25-minute break on completing the set. Skip a break or end it early whenever you want. The timer continues while a game is paused or the window is hidden; expired breaks show a return button without forcing you into another question. Saved breaks retain their original deadline. Timed challenges are not interrupted.

The website has Sky Hopper, Sheep Escape, Gravity Flip, Pocket Bowling (five frames; pins count without strike/spare bonuses), and Neon Rally. Local editions also have Neon Dash with five original courses and optional original synthesized music, Marble Run 3D with three courses, and Space Survival 3D. Games have no learning tasks or bee themes. Keyboard and touch controls are included. Scores are saved per local player, or in the website browser for the signed-in account. No games require Render requests or game servers.

Three.js is MIT licensed; its license is included in the source ZIP. The two 3D games require WebGL 2. If unavailable, the six local 2D games still work. Graphics use low-poly meshes, no shadows, a 1.5x pixel-density cap and release GPU resources when leaving a game. The 3D engine loads only on demand. All original art and music are generated locally; there are no third-party music downloads.

## Uninstall

Close BeeBright and stop local browser practice with Ctrl+C, then run:

```text
beebright uninstall
```

This removes BeeBright, its private runtimes, terminal launcher, local saved progress and settings. Other Python installations, shared WebView2 and website account/progress remain. Back up your BeeBright `userdata` folder first if you want to retain progress. On Windows it is `%LOCALAPPDATA%\BeeBright\userdata`; on macOS/Linux it is `~/.local/share/BeeBright/userdata`.
