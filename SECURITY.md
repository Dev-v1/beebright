# Security

Report suspected vulnerabilities privately to the repository owner. Do not post access tokens, private keys, account data or working attacks in public issues. Test only your own accounts, rooms and disposable classroom data.

## Enforced boundaries

- Clerk bearer sessions require an RS256 signature, expiration and user subject; configured issuers and authorized origins are checked. Desktop credentials remain hashed, expiring, revocable and account scoped.
- Classroom management and student activity remain restricted to the classroom owner. Progress and studio data remain scoped to the authenticated account. Only configured administrators can import or publish word lists.
- API bodies are bounded before JSON/multipart parsing: 4 MiB normally and 16 MiB for PDF upload envelopes, with the existing 15 MiB PDF-file limit retained. Chunked or understated content lengths do not bypass the limits. Reads time out after 30 seconds; concurrent body processing and uploads are bounded.
- Dictionary/audio traffic shares a per-IP budget of 240 requests per minute and at most eight concurrent requests per API process. Client-supplied forwarding headers are not used as identity. Classroom/device routes retain their existing rate limits. Limits are per-process and are not a substitute for platform-level DDoS protection or distributed rate limiting.
- Private API responses use `Cache-Control: no-store`. Browser headers restrict framing, embedded objects, base URLs and unused device permissions without disabling Clerk, speech playback or game workers.
- The API remains a single-process coordinator for ephemeral casual racing rooms. Only hosts submit positions, snapshots are bounded and validated, and guest names/activity are self-reported. Rooms are not a ranked anti-cheat system.

## Regression checks

CI runs all backend tests against disposable Postgres, frontend tests and builds, browser multiplayer tests, CodeQL and dependency audits. Python dependencies are checked with pinned PyPA pip-audit; JavaScript dependencies are checked with npm audit. Fix identified vulnerabilities rather than adding blanket audit exclusions.

No production secrets belong in Git or browser bundles. Store backend secrets in Render and only frontend publishable configuration in Vercel. A tracked-file pattern scan supplements these controls; it does not prove that no secret has ever existed. Rotate any credential suspected of exposure.

These controls reduce specific risks. They do not establish that the application is impossible to compromise or replace an independent security assessment.
