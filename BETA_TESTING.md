# Bermuda Simulator — Invite-Only Beta Pilot

**Status:** Internal staging. Do not open beta registrations or invite players yet.

## Isolated development
- The playable game on main is unchanged.
- The existing protected internal preview remains on beta/invite-only-pilot, unchanged.
- All new server-side player authentication is isolated on beta/player-login-gate.
- The public Founding Players website and its email templates remain unchanged.
- Do NOT attach play.bermudasimulator.com or merge the auth branch until the release checklist is complete.

## Staged login gate
New root Vercel Routing Middleware intercepts all requests before static HTML and game asset delivery. Anonymous HTML gets a 303 redirect to the login form. Anonymous JS, shaders, images, game assets and service-worker URLs are denied with 401. An approved email can request a Resend sign-in link valid for ten minutes. Following the link creates a signed, HttpOnly, Secure, SameSite=Lax session cookie for twelve hours. Every request rechecks the allowlist. Removing an email revokes access after env changes deploy; changing BETA_SESSION_VERSION invalidates all prior sessions. Without complete configuration, requests fail closed with HTTP 503.

**Current limitations:** The email links expire but are not single-use, and invitation status is maintained in an environment allowlist, not a durable user database. No cloud save or player identity record exists. Persistent request rate limiting and actual independent deployment bypass tests are mandatory before outside testers can access this preview.

## Server-only environment (Preview, auth branch only)
Configure in the Vercel project dashboard; do not add these variables to GitHub or expose them through a VITE_ prefix:
- BETA_ENABLED=true
- BETA_ALLOWED_EMAILS (comma-separated, approved invitation emails)
- BETA_SESSION_SECRET (minimum 32 unpredictable characters)
- BETA_SESSION_VERSION=1 (increase to revoke all sessions)
- RESEND_API_KEY (server-side only)
- BETA_FROM_EMAIL (verified domain sender)

Do not put testers' contact details or secrets into repository files.

## Release checklist
1. Confirm Vercel builds and runs the middleware for this Vite project. READY status alone does not prove access protection.
2. Add a durable rate limiter per IP and email for the request-link endpoint, and verify it independently. A production beta should also use an invitation database with one-time links, revocation audit and an admin panel.
3. Test anonymous direct GETs to /, compiled /assets JS, game images/models and service worker; every route must be denied. Use a fresh device/browser not signed in to the owner account.
4. Verify allowed email login and expiry, invalid signatures, cookie restrictions, logout and revocation.
5. Test iPhone Safari, iPhone Chrome and desktop startup/gameplay: walk, fish, sell to Joe, board and steer boat, minimap and save recovery. Confirm no new crashes.
6. Review asset cache headers, old service-worker behavior and all bypass routes. The source repository is currently public, so game source is independently available regardless of website protection. Decide whether to privatize source before a larger pilot.
7. Select first invited players and gain approval before sending any email.
8. Only when all checks pass, consider setting up play.bermudasimulator.com.

## Verification
- Gameplay CI: npm test and npm run build, unchanged.
- Auth regression: node test/beta-gate.mjs (uses a mocked email sender; it does NOT send emails).
- GitHub beta quality gate now includes both checks on the auth branch.

Existing game boot, WebGPU, controls, local save, Joe and Marta businesses, fishing and boating are not to be edited as part of this login rollout.
