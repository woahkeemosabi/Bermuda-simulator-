# Bermuda Simulator — Invite-Only Beta Pilot

**Status:** Preparation. This branch is separated from `main` and must not be merged until gated-access QA passes.

## Preserve the playable build
- Do not modify the game's boot sequence, WebGPU renderer, mobile fast-start, UI coordinates, service worker clearing, save state, waterfront economy, fishing, Joe/Marta interactions, boat progression, or existing player controls as part of invite access.
- Protect all game routes and assets **server-side**, not with a cosmetic login overlay or client-side JavaScript.
- Keep the public Founding Players site at https://bermudasimulator.com/ independent from playable-beta deployment.
- Never expose invitation codes, signing keys, API keys, or allowlists in this repository or client JavaScript.

## Pilot deployment approach
- Use the Vercel `bermuda-simulator` project **preview deployment** for the beta branch.
- Its existing Vercel Authentication protects preview URLs. Verify protection on an incognito browser before sharing a URL.
- While the Vercel account is on Hobby, external access grants are limited; use a very small pilot until a dedicated user-facing invite login can be implemented and audited.
- Do **not** use the public production domain or add a custom `play.` subdomain until a tested, server-side invitation system protects HTML, JS bundles, asset requests, APIs and refreshes.
- Vercel shareable links are bearer links, not identity-bound beta accounts: use individually granted access for initial testing rather than distributing one reusable shareable link.

## Dedicated player accounts (next stage)
- Email allowlist, single-use or expiring invitations, identity verification, short-lived signed sessions and secure HttpOnly cookies.
- Admin capability to invite, revoke and track test accounts; no direct coupling to newsletter/consent status.
- Server-side rate limiting and recovery; no publicly accessible static asset URLs bypassing the gate.
- Distinguish *waitlist member* from *invited beta tester*: neither automatically grants the other.

## QA before any invitation
1. Preview deployment builds; no new JavaScript/asset errors.
2. Anonymous visitor denied at HTML **and** bundled JS and game asset URLs.
3. Granted individual Vercel account can enter; revoked user cannot.
4. iPhone Safari and Chrome/desktop launch without crashing; no local-save regression.
5. Player can walk, fish, trade, steer/board boat, use minimap, resume save.
6. Capture performance notes, visible bugs, date, browser and game commit for feedback.
7. Validate how source and downloadable game assets are handled; the GitHub repository is currently public.

## Scope
This branch is an access-workflow isolation branch. Gameplay features and existing email templates remain unchanged.
