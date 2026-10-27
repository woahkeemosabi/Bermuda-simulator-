# Bermuda Simulator — production audit (Phase 1: source inventory)

Date: 2026-10-26. Target: `main` at audit time. **Non-destructive: no game files, saves, or deployments were deleted or changed by this audit.**

## Verification standard

- **Source-confirmed**: file exists and/or a reachable startup code path is visible.
- **Conditional**: gated by device, query parameter, or runtime state.
- **Runtime-unverified**: no successful end-to-end browser gameplay test or iPhone Safari instrumentation was available in this audit. Never equate source presence with playable functionality.
- **Removal candidate**: not permission to delete. Require static references, network requests, bundle and runtime dependency checks, backup, and regression tests first.

## Repository footprint

GitHub recursive tree: **650 tracked files**, **670.1 MiB** of file bytes. `src/`: **287 files**, approximately **3.6 MiB**. `public/models/bermuda/`: **74 files**, **612.4 MiB** (including model preview images). Nine particularly large un-tiered originals under `public/models/bermuda/` and `expansion/` account for **430.5 MiB** in repository file bytes. These are *not* measurements of browser downloads, decoded GPU allocations, Vercel usage, or build artifact size.

Large originals (bytes): `bermuda-boathouse.glb` 71,521,256; `bermuda-dock.glb` 35,638,592; `bermuda-house-a.glb` 36,644,968; `bermuda-house-b.glb` 36,154,688; `expansion/bermuda-hillside-cluster.glb` 65,198,360; `expansion/bermuda-hilltop-landmark.glb` 68,168,068; `expansion/bermuda-house-c.glb` 38,264,240; `expansion/bermuda-house-d.glb` 54,821,196; `expansion/bermuda-limestone-seawall.glb` 44,987,496.

Multiple asset tiers exist: un-tiered originals, `desktop/`, `mobile/`, `mobile-v2/`, `mobile-v3/`, `hero/{desktop,mobile}/`, `street-life/{desktop,mobile}/`. Their coexistence is not by itself proof of duplication or safe removal; the actual requested URLs must be established.

## Confirmed startup graph

`src/main.js` imports `App`, UI and mobile wrappers and calls `applyBermudaBootLook` / `applyBermudaRuntimeLook` from `src/world/BermudaIdentity.js`.

`src/App.js` imports and constructs core WebGPU rendering and terrain/reef/ocean/boat/game systems, including `OceanFFT`, `WaterQuery`, `WaterSurface`, `WaterMaterial`, `RefractionPass`, `Spray`, `SeaDetail`, `BoatController`, `Game`, and atmosphere/environment rendering. Import/construct does not establish visual presence or full interactivity.

`src/game/Game.js` constructs `FishingRod`, `FishStand`, `Chandlery`, `CatchDisplay`, `Lobsters`, `Spear`; HUD/minimap/guide are initialized on the UI path. Catch minigame and fish-table logic exist. Joe's actual NPC interaction, shop purchase flow, and 3,200-dollar goal require runtime playtest.

`src/world/BermudaIdentity.js`: installs Bermuda blockout, harbour polish, reference world upgrade, gameplay QA, no-visible-player wrapper, and LifeProgression. Mobile: bypasses `installBermudaModels` waterfront GLB startup and runs `installWaterfrontRepair`; sets `__bermudaHeavyWorldAssetsDisabled`. RELIC geometry/story/modes are gated off in boat-only mode. Desktop reference final passes and production world/street-life assets require opt-in `?worldDecor=1` and are bypassed on mobile. `src/world/ProductionMeshyAssets.js` exists separately; **its source existence does not prove it is called in current startup**.

`src/game/FirstBoatMode.js`: default boat-only on iPhone/iPad/iPod/Android; `?missions=boat` forces; `?missions=full` overrides. Goal is 3,200; mission normalization preserves a backup of previous mission state. `LifeProgression` creates MissionDirector but normalizes boat-only objective instead of running full progression. Desktop defaults to full missions unless explicitly overridden. This is a **cross-platform product-scope inconsistency**, not a deletion instruction.

`src/main.js`: mobileLowGPU is set on mobile; URL startup logic sets `noClouds`, `noHaze`, `noCaustics`, `noSim`, `freezeFFT`, `noSpray`. `App.js` honors `freezeFFT` and `noSpray`. Thus source comments saying every effect is enabled on mobile contradict actual flags. Do not claim iPhone renders full FFT/spray from source alone.

`src/game/PropertySystem.js`, `PropertyExpansion.js`, `RelationshipSystem.js`, `SideQuestSystem.js`, `IslandMissionSystem.js`, `HarbourJobBoard.js`, `MarthaShopInterior.js`, `Relic001.js`, `RelicStory.js`, `player/Bicycle.js` exist. **Each needs import/callsite reachability and runtime interaction checks** before labeling active, dead, or deletable.

`src/mobile/` includes several independent UX/HUD wrappers; `src/ui/UI.js`, `src/ui/AppUI.js`, `src/game/GameHUD.js`, `src/game/Minimap.js` also exist. Check overlapping DOM layers, event interception, duplicate minimaps and wallet controls before consolidation.

`public/audio/` includes boat, fish, reef, birds, footsteps, waves and whale OGGs. `src/audio/SoundScape.js` is imported by App; mobile startup audio is conditionally gated. An audio file's presence does not mean it is requested.

`.github/workflows/deploy.yml` builds current production and two archive versions under `/archive/oct14/` and `/archive/sep30/`. Historical archive footprint is distinct from main-game runtime footprint. Do not remove until retention policy is approved.

## GPU crash evidence

Observed iPhone traces show Safari reporting `GPUDevice lost (destroyed)` without driver details. Crashes have occurred during atmosphere/environment compute overlap, SkyView/Water Queries, and Water Queries-only last-submission records. Last submitted kernel is **not proof of causation**. Device memory peaks, resource lifetime, shader compilation, GPU timestamps, allocation totals, canvas presentation, queue workload, and iPhone-specific profiling remain unverified. Do not delete ocean/spray based on those traces.

## Provisional manifest (not approved for deletion)

| Candidate | Decision | Evidence / gate |
| --- | --- | --- |
| Fishing rod, catch, Joe's market, Martha's chandlery, game state | KEEP | Core progression; require catch/sell/save/reload smoke test |
| Starter boat ownership, boat controller, marine environment | KEEP | Core objective; verify $3,200 purchase and navigation |
| Terrain, reef, shadows, ocean, spray | KEEP / OPTIMIZE | Visual identity; use GPU isolation and profiling rather than blanket deletion |
| Nine large un-tiered/expansion original GLBs (430.5 MiB) | ARCHIVE candidate | Prove no runtime URL, tooling, archive or asset-generation references; measure Pages artifact savings |
| Alternate desktop/mobile GLB tiers | OPTIMIZE / ARCHIVE candidate | Resolve all model loader URLs by platform; choose canonical tier only after QA |
| RELIC vehicle/story and associated hero assets | DEFER | Gated off in mobile boat-only; desktop/default behavior differs |
| Property, relationship, side-quest, expanded missions | DEFER | Out of first-boat scope; trace dynamic import and save schema before code removal |
| ReferenceFinal/ExactVideo/Detail/StreetLife visual passes | DEFER / ARCHIVE candidate | Desktop `worldDecor=1` opt-in; verify no default runtime references |
| Bicycle module | ARCHIVE candidate | Existence confirmed; verify no active instantiation or save references |
| Multiple HUD/mobile wrappers | OPTIMIZE | Consolidate only after DOM and input/event audit |
| Archive builds, dev scripts, diagnostic modes | KEEP separately pending policy | Preserve rollback and reproducibility until release stable |
| Cloud account, offline/PWA compatibility | AUDIT | Verify actual startup, service-worker and save semantics before deletion |

## Required next audit gates

1. **Static graph**: parse JS imports, dynamic imports, installers and URL/string references across all `src/`, scripts, tests and workflows. Generate file-level graph and list truly unreferenced modules. Treat reflective/dynamic references as exceptions.
2. **Asset requests**: build production; capture Chrome desktop network HAR and WebGPU adapter; distinguish JS bundle, initial requests, delayed streams, assets never fetched, GPU allocations. Test `worldDecor`, `missions` and device branches.
3. **Interactive walkthrough**: fresh save and existing save; start, spawn, walk, cast, catch, sell to Joe, buy from Martha, save/reload, purchase boat at $3,200, enter/exit, pilot, mobile controls, minimap, audio, NPC/job board; mark PASS/FAIL/NOT TESTED.
4. **iPhone Safari**: verify separately on physical iPhone. Cloud browser/desktop tests cannot establish Safari stability.
5. **GPU profiling**: count dispatches, render passes, buffer/texture allocations and peak residency across startup, idle, fish and boat scenes; compare device-loss traces and record build SHA.
6. **Deletion dry run**: branch-only removal of **verified unreachable** files, with build, tests, visual diffs, save migration and rollback. Seek explicit approval for any permanent deletion or production merge.

**Phase 1 verdict:** repository inventory and several startup gates are source-confirmed. End-to-end gameplay, network traffic, actual GPU residency and safe-delete proof remain open. No file should yet be labeled permanently safe to delete.
