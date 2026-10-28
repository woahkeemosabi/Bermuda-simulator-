# Bermuda Simulator — Genie 4 & AI World-Model Readiness

**Status:** Strategy/specification only — no Genie integration, API credential, feature flag or production runtime change.
**Prepared:** 2026-10-28
**Project:** `woahkeemosabi/Bermuda-simulator-`
**Reference:** https://deepmind.google/blog/genie-4-a-new-generation-of-world-simulation/
**Related work:** Draft PR #56 restores the upstream Tidewater renderer. **Do not merge or mix this work into that restoration without separate QA.**

## 1. Release facts vs assumptions

- Google announced Genie 4 on **2026-10-27** as a **trusted-tester research preview**.
- Google states Genie 4 is *coming soon* to **Google AI Ultra / Project Genie** and **early-access Gemini API / Google AI Studio partners**.
- It demonstrates photorealistic interactive scenes, native sound and dialogue, real-time prompting/steering, and Gemini-assisted multi-step event simulation.
- Google says exact real-world fidelity, long-term object permanence, complex interactions, spatial accuracy and sustained continuity remain research limitations.
- At time of writing, **do not assume** a public model ID, stable SDK/API endpoint, general commercial access, output export format, pricing, global availability, low-latency streaming contract, or indefinite interactive sessions.
- A regular Gemini API key is **not proof** of Genie 4 entitlement.

**Core principle:** plan for API access, but never fabricate a Google API contract or claim Genie can export engine-ready 3D geometry.

## 2. Target architecture

Separate **authoritative, deterministic gameplay** from **replaceable visual/sensory world providers**.

```text
   Input (touch / keyboard / controller)
                    |
        Bermuda Game Orchestrator
          /             |           \
  Geography        Gameplay        Session / QoS
  road graph       inventory       entitlement check
  coordinates      wallet BMD      budget/latency
  collision        fish/shop       fallback/recovery
  ground truth     save/missions   consent/privacy
          \             |           /
          Render / Experience Provider Boundary
                |                 |
       Tidewater / WebGPU       Genie 4 candidate
       default/fallback        (only when supported)
                |                 |
               Player sees Bermuda
```

**Keep in code:** geo coordinates, left-side traffic rules, navigation/waypoints, missions, fishing catches/sales, Joe's market, wallet BMD, $3,200 lobster boat purchase, player inventory, boat ownership, save/reload, input mapping and anti-cheat validation. Never read game truth from an AI-produced video frame.

**Proposed internal adapter contract, not a Google SDK:**

```ts
interface WorldExperienceProvider {
  capabilities(): Promise<{
    interactive: boolean;
    inputModes: string[];
    supportsReferenceImages: boolean;
    supportsSpatialAnchors: boolean;
    sessionLimitSeconds?: number;
    averageLatencyMs?: number;
  }>;
  startSession(context: CanonicalBermudaContext): Promise<{ sessionId: string }>;
  sendInput(sessionId: string, input: NormalizedPlayerInput): Promise<void>;
  steer(sessionId: string, instruction: BoundedWorldEvent): Promise<void>;
  observe(sessionId: string): AsyncIterable<WorldFrame>;
  endSession(sessionId: string): Promise<void>;
}
```

These interfaces are **illustrative design proposals**. Actual implementation must be rewritten against published Genie documentation. Provider support for spatial anchors and individual methods **must be proven** and may never exist.

**Fallback:** if absent, unsupported, quota-exhausted or offline, retain the current WebGPU experience and saved gameplay state. AI and WebGPU may need to run as alternative experiences rather than simultaneous overlays.

## 3. Existing code boundary

Current repo is Vite/ESM with separated modules:
- `src/engine/` and `src/core/` — WebGPU rendering, control loop, GPU state.
- `src/ocean/`, `src/sky/`, `src/post/` — deterministic water/sky/presentation.
- `src/world/` — terrain, shoreline, reef, buildings, boat, colliders.
- `src/player/` — player/vehicle movement and camera.
- `src/game/`, `src/ui/` — inventory, fishing, fish stand/market, purchases, HUD.
- `src/mobile/` — device tiers and GPU diagnostics.

Do **not** implement an AI integration by editing the renderer hot path directly. Begin with a no-op adapter in a separate branch after the Tidewater restoration is stabilized. Don't add any client-side secret. Never require a Genie service response to boot the existing game.

## 4. Ground-truth Bermuda reference pack

Version and provenance-track **each** reference (location, timestamp, copyright/license, camera pose where possible):

1. **Hamilton / Front Street:** grounded road graph, recognized landmarks, shoreline, building façades, no imaginary roads. Left-hand driving.
2. **Bermuda visual DNA:** stepped white roofs, pastel buildings, limestone, subtropical vegetation, real shoreline elevations. No mountains.
3. **Harbours & docks:** realistic marina positions, dock elevations, boats, Joe's fish market, fishing route.
4. **Reefs & dive locations:** bathymetry/reef channels, water depths/visibility, species, reef boundaries, physical constraints.
5. **Weather and lighting:** daylight, clouds, storm scenarios, marine audio.
6. **Game state anchors:** spawn coordinates, waypoints, landmark IDs, authoritative interaction radii for shop, fish and boat.

Reference images must not be interpreted as an authorization to reproduce copyrighted map imagery or commercial datasets in a shipped game. Verify licensing and Google's own terms before ingestion.

## 5. Three benchmark scenes

### A — Hamilton scooter ride
**Input:** real, licensed Front Street imagery + canonical road route + Bermuda style guide.
**Test:** player travels multiple blocks on the *left*, stops, turns, returns to the same storefront, sees consistent landmarks, receives stable controls; phone and keyboard controls work.
**Reject:** invented mountains, right-side traffic, street layout drift, landmark substitution, flickering vehicles/shops.

### B — Bermuda reef night dive
**Input:** fixed dive entry/anchor position, bathymetry reference, depth bounds, reef species, diver-light behavior.
**Test:** descend/return with stable anchor position, underwater acoustic/lighting cues, repeatable interaction.
**Reject:** teleportation, impossible species, shifting reef geometry, physically incoherent dive controls.

### C — Dock → catch fish → sell to Joe → purchase
**Input:** game-controlled quest and wallet state.
**Test:** cast/catch, inventory update, market sale, wallet increases in BMD, persistence after reload; saving **$3,200** allows lobster boat purchase.
**Reject:** model claims a fish was caught when game state did not record it, inconsistent wallets, lost save on AI timeout.

## 6. Evaluation and launch gates

Record per scenario: provider/model/version, prompt and reference hashes, physical controls, user agent/device, FPS or displayed frame rate, input-to-photon latency, time to first playable scene, max valid session length, interruption/recovery, reproducibility, estimated compute cost per engaged player-minute, geo correctness, and licensing/commercial entitlements.

**Hard gates before user-facing access:**
- Google developer docs and permission explicitly support the intended integration and commercial distribution.
- Model access/quotas/pricing/region and session/runtime limits are confirmed.
- Controllable player interactions—not just visually compelling videos—pass independent tests.
- Deterministic state is retained when the world model stops, drifts, or fails.
- Keys/billing, PII, audit logging and content provenance are server-side and privacy-reviewed.
- Physical iPhone Safari QA plus desktop fallback pass without new WebGPU device-loss regressions.
- No changes to live game, persistence schema, service worker or renderer baseline without isolated branch, rollback and QA.

## 7. Rollout milestones

- **R0 — Now:** preserve this spec; collect legally usable Bermuda references; apply for Google trusted tester / early developer access.
- **R1 — Documented developer API:** validate entitlement and a minimal isolated session outside Bermuda Simulator; document actual endpoints only after official release.
- **R2 — Adapter proof:** implementation behind a disabled-by-default flag; budget caps, timeouts, explicit fallback; unit tests with a local mock (no cloud dependency).
- **R3 — Benchmark:** run Hamilton scooter and dive; assess geographic drift, interaction control, mobile support and real player cost.
- **R4 — Controlled opt-in pilot:** only after authorizing commercial use and passing quality/performance; preserve normal game for everyone else.

## 8. Immediate action list

- [ ] Project owner joins official Genie 4 waitlist (Google account action).
- [ ] Prepare/submit early-access developer application when official channel opens.
- [ ] Assemble Hamilton / reef / dock reference packs with location IDs and usage rights.
- [ ] Identify existing authoritative state and save interfaces without changing them.
- [ ] Create repeatable pass/fail benchmark checklist and baseline iPhone evidence.
- [ ] Watch official Google DeepMind, Gemini API, and AI Studio documentation for a **real** Genie 4 developer API and commercial policy.
- [ ] After PR #56 renderer QA: consider a **separate** disabled-by-default adapter scaffold.

**Non-goals:** deleting assets, changing Tidewater core, compromising current fishing economy, adding speculative packages, pretending an API already exists, or gating game startup on AI.
