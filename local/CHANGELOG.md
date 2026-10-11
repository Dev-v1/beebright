# BeeBright 2.6 fixed

- Faster racing opponents with smooth committed overtaking.
- Compact exterior windshield and a wider cockpit view.
- Blended incline transitions around every circuit.
- Choose 1–10 laps before starting a race.

# BeeBright releases

## 2.6 bugfix

- Clicking a multiple-choice word checks it immediately. The extra Check answer button is removed from this mode.
- Correct or Incorrect appears on a raised panel in front of the dimmed choices, with the correct spelling above the selected spelling. Next word remains below the panel.

## 2.6

- Origin hints show language paths without historical spellings, roots or cognates. Uncertain histories and compounds remain qualified instead of inventing a borrowing sequence.
- Prefer recorded Merriam-Webster pronunciations on the website and the best available English voice as fallback. Local speech remains offline. Normal speech speed replaces the old slow default.
- Closer distractors preserve accents, spaces and capitalization. Correct answer positions are balanced across A, B, C and D for each new practice set, and saved sessions retain their order.
- Multiple-choice feedback appears above the answers: Correct or Incorrect, followed by the correct spelling above your choice.

## 2.5 bugfix

- Solid GT roof stays visible in both cockpit and chase cameras.
- Taller, wider windshield, slimmer interior pillars and a wider cockpit field of view.
- Live dashboard navigation shows the complete circuit, all five cars, and the nearest car behind with its distance. Speed, gear and RPM remain visible.

## 2.5 racing beta

- Tracks widened to 18–20 metres, with faster rivals and stable, committed overtaking instead of rapid side-to-side lane changes.
- Finished opponents clear the racing line instead of blocking the finish.
- High racing now uses Babylon.js PBR, HDR tone mapping, clearcoat reflections, bloom and soft shadows. Lightweight graphics remains available.
- Full cockpit lining, doors, vents, roof trim, instruments, steering and driver hands. Automatic gearbox with shift animations, a live speed/gear screen and moving tachometer.
- Private standalone racing testing edition with a bundled Windows executable and automatic source synchronization.

## 2.4 fixed

- Original logo-free GT cars with long bonnets, fastback roofs, wide wheel haunches, detailed wheels and a driving cockpit.
- Press R or use Camera (R) to switch cockpit and chase views. Holding the key does not repeatedly switch views.
- Longer, tougher Harbor, Canyon, Alpine and Midnight tracks. Alpine roads wind around sculpted mountains and climb to a 65-metre pass.
- Faster opponents use corner braking, changing racing lines and traffic-aware overtaking. Player cars gain stronger acceleration and a higher top speed.
- High quality racing gains an optional WebGPU renderer, reflective clearcoat paint, softer shadows and richer roadside scenery. WebGL 2 and software 3D remain fallbacks.

## 2.4 bugfix

- Replace overlapping Marble Run ramp boxes and turning pads with one connected track mesh. Rendered faces and sphere collision use the same triangles; open edges and jump gaps remain real.
- Race four opponents on wider, inclined Harbor, Canyon, Alpine and Midnight circuits. Live position, sequential lap checkpoints, opponent corner braking and car contact.
- Curved car bodies, rounded fenders, steering wheels, reflective paint and windows for every car in High quality. Track-specific sky reflections, warm sunlight, road textures and soft shadows.
- Stable road ribbons replace overlapping road boxes. Uphill and downhill driving follow the visible track elevation.

## 2.4

- Marble Run ramps and square turning pads share their visible geometry with sphere collision surfaces.
- Fixed-step slope contact, gravity, momentum, normalized steering and braking. Remove all railings and edge clamps; exposed edges allow real falls.
- Smoother marble-follow camera and richer High quality reflective materials, track textures and lighting.

## 2.3

- Four Neon Rally circuits with track selection and richer High quality cars, road surfaces, lighting, curbs and scenery.
- Longer Neon Dash courses with cube, ship, ball and wave portals, mode checkpoints and three attempts.
- Sheep Escape rebuilt as a hold-to-grow, release-to-lower bridge game.
- Marble Run race courses with boosts, jump gaps, moving sweepers, crystal checkpoints, braking and a timer.
- Keep the complete Space Survival ship inside the visible camera frame.
- Bowling uses narrower pin contact, damped momentum and tipping energy instead of counting every moving pin as fallen.

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
