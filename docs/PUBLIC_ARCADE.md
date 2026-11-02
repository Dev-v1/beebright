# Public home and arcade

Signed-out visitors see the informational homepage with Sign in and Sign up controls. Signed-in visitors keep the existing practice homepage. `/games` is open to both guests and signed-in players and includes the web arcade and live Neon Rally rooms.

Create a room, share its eight-character join code, and start with U or Start race after all connected players have loaded graphics. Each race has five cars: one to five humans, with bots filling the remaining slots. Departed players become bots. When a lobby host leaves, hosting passes to another player. Guest names are self-chosen, not verified account identities.

Room simulation runs on the existing single Render API process over WebSockets. Rooms are ephemeral; server restarts end them. Use one API worker/instance for this implementation. Horizontal scaling needs shared room routing/state first. No database migration or Clerk configuration change is required.

The server accepts input controls rather than client-provided positions, enforces host-only starts, checks graphics readiness, bounds room/connection/message counts and validates browser origins. Races end after ten minutes if anyone has not finished. Solo arcade games continue to run in the browser.

Validation: `python -m unittest discover -s tests -p test_rally_rooms.py -v` in the backend and `node --test src/*.test.js` in the frontend. The public-arcade workflow also runs two independent browser contexts against a real local WebSocket server, covering guest home/arcade access, room joining, U start, rendering and replacement bots.
