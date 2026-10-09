# BeeBright releases

## 2.2

- Easier Neon Dash courses; blue blocks are safe platforms.
- Momentum-based bowling with pin-to-pin collisions, gutters, power and spin.
- Faster, tighter Gravity Flip barriers.
- Lightweight 3D Neon Rally with braking, reverse and a chase camera.
- Three original Marble Run courses with ramps, winding bridges and crystal checkpoints.
- Space Survival invasion waves, diving and banking ships, twin lasers and shield pickups.
- Optional persistent high-quality graphics, sharper resolution and 3D shadows.
- Prefer the GPU for 3D; show graphics diagnostics and use software 3D when WebView does not offer WebGL 2.

## 2.1 bugfix

- Pause local games and release their keyboard controls while Settings is open.
- Keep Neon Dash and Marble Run course selections independent.
- Avoid repeatedly drawing paused or finished games, reducing unnecessary graphics work.
- Preserve existing spelling progress, word lists, break timers and the 2.1 Windows updater fix.

## 2.1

- Windows updates install immutable packages and atomically switch a pointer, fixing folder locks while the app or local server is running. Existing sessions keep using their old package until closed; progress stays separate.
- Optional 10-minute breaks after 50 and 100 normal practice words; finish a full set for 25 minutes. Break deadlines survive save/resume and switching games. Timed and challenge tools stay uninterrupted.
- Five browser games: Sky Hopper, Sheep Escape, Gravity Flip, Pocket Bowling and Neon Rally.
- Eight local games: those five plus Neon Dash (five original levels), Marble Run 3D (three courses) and Space Survival 3D. Three.js loads only for 3D games, with simple geometry, capped pixel density and no shadows or external assets.
- Original synthesized platformer music, optional sound, pause controls, touch controls and per-player local high scores. No game server, cloud game data, learning tasks or bee themes.
- Fix browser backup restoration rejecting a complete 150-word session.
- For installations with the old failing updater, run the install command once to refresh it; future updates use the safe package layout.

## 2.0 (fixed)

- Every 2027 level now runs all 150 words in one shuffled practice set on the website, desktop app, and local browser.
- The warm-up, setup button, and question counter show the full set size. Other word lists keep their normal 100-question sets.
- All 450 supplied words and their existing definitions, origins, and blank sentences are retained.

## 2.0

- Twenty new commands: daily, review, compete, doctor, stats, profile, backup, restore, sprint, lists, practice, audio, origins, pairs, favorites, worksheet, remind, achievements, duel and changelog.
- Shared website and local practice tools, timed sessions, daily seeded questions, word-origin filters, pair lessons, favorites and printable worksheets.
- Per-player local progress, portable backup/restore and on-device reminder notifications.
- Practice tool history on the website is saved per account in the current browser. Local tools never need a cloud account.

## 1.9

- Save local sessions immediately and serialize writes so fast exits and completing a set do not restore stale progress.
- Report a missing local bridge after ten seconds instead of leaving the opening screen indefinitely.
- Repair incomplete installed packages even when their revision matches the update manifest.

## 1.8

- Private Python 3.15 runtime, offline help, and one-command uninstall.
