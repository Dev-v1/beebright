# Public home and arcade

Signed-out visitors see the informational homepage with Sign in and Sign up controls. Signed-in visitors keep the existing practice homepage. `/games` is open to both guests and signed-in players and includes the web arcade and live Neon Rally rooms.

Create a room, share its eight-character join code, and start with U or Start race after all connected players have loaded graphics. Each race has five cars: one to five humans, with bots filling the remaining slots. Departed players become bots. When a lobby host leaves, hosting passes to another player. Guest names are self-chosen, not verified account identities.

Race physics and bots run in a dedicated worker on the host’s device, using the local edition’s driving engine. Graphics render on each player’s own device. The Render process only coordinates rooms, relays controls and validates/relays host snapshots. The host tab should stay open; a departing or unresponsive host hands its latest race state to another ready player without resetting progress. Rooms are ephemeral; server restarts end them. Use one API worker/instance for this implementation. Horizontal scaling needs shared room routing/state first. No database migration or Clerk configuration change is required.

The server enforces host-only starts and host-only position updates, checks graphics readiness, bounds room/connection/message counts and validates browser origins. Host snapshots are finite, bounded and cannot change server-owned names, membership or bot slots. This is a casual host-trusted game, not a ranked anti-cheat system. Races end after ten minutes if anyone has not finished. Solo arcade games continue to run in the browser.

Cars use oriented body collisions at fixed 120 Hz contact substeps, with positional separation and momentum response. Crashes do not respawn cars or clear checkpoints. Road queries use a spatial index, host rendering receives fresh worker poses and other players interpolate network snapshots. The car model, terrain/scenery and High-quality renderer match the local edition. FPS depends on device and connection; no fixed frame rate is promised.

Validation: `python -m unittest discover -s tests -p test_rally_rooms.py -v` in the backend and `node --test src/*.test.js` in the frontend. The public-arcade workflow also runs two independent browser contexts against a real local WebSocket server, covering guest home/arcade access, room joining, U start, rendering and replacement bots.
