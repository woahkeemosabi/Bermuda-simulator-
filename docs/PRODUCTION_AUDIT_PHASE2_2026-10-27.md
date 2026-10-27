# Bermuda Simulator — Phase 2: startup reachability and cleanup gates

Audit date: 2026-10-27. Repository: `woahkeemosabi/Bermuda-simulator-`. Based on source reads from `main`; no browser playthrough or device profiler was available. **This is a dependency audit, not a claim that every system is playable. No deletion or gameplay modification performed.**

## Source-confirmed call graph

```text
src/main.js
  ├─ new App() [src/App.js]
  │    ├─ WebGPU scene, terrain, reef, vegetation, shadows, atmosphere, reflections
  │    ├─ OceanFFT, WaterSurface, WaterMaterial, WaterQuery, Spray, WakeSim
  │    ├─ BoatModel + BoatController
  │    └─ new Game()
  │         ├─ GameState
  │         ├─ FishingRod, FishStand, Chandlery, CatchDisplay
  │         ├─ Lobsters, Spear
  │         └─ UI path: GameHUD, Minimap, Guide
  ├─ applyBermudaBootLook()
  ├─ applyBermudaRuntimeLook()
  │    ├─ BermudaBlockout, HarbourShopPolish, ReferenceWorldUpgrade [both]
  │    ├─ ReferenceDetailUpgrade, ReferenceStreetLife [desktop + worldDecor=1]
  │    ├─ Relic001, RelicStory, RelicMobileModes [not boat-only]
  │    ├─ BermudaGameplayQA, NoVisiblePlayer [both]
  │    ├─ WaterfrontRepair [mobile]
  │    ├─ ReferenceFinalPass, ReferenceFinalRuntimeFix,
  │    │  ReferenceExactVideoPass, ProductionWorldAssetsNoPlayer,
  │    │  ReferenceStreetLifeModels [desktop + worldDecor=1]
  │    ├─ LifeProgression → MissionDirector [both]
  │    ├─ BoatOwnership [boat-only]
  │    └─ BermudaModels [desktop; skipped on mobile]
  └─ AppUI + StableMobileControls + MobileScreenshotHUD [mobile]
```

### Key conditional behavior

- `firstBoatModeEnabled()`: mobile user agent defaults to boat-only; desktop defaults to broader missions unless `?missions=boat` is supplied. `?missions=full` forces expanded mission mode.
- `BermudaIdentity.js` mobile path explicitly bypasses waterfront GLB loading and heavy world/character passes. It does **not** bypass the procedural Bermuda blockout or basic fishing/boat systems.
- `BermudaModels.js` loads `WATERFRONT_ASSETS` via tiered `mobile-v2` / `mobile-v3` paths (depending on asset entry) when installed. On mobile this installer is bypassed at the current startup gate; the presence of mobile GLBs in `public/` does not mean iPhone downloads them.
- `ProductionWorldAssetsNoPlayer.js` includes hero RELIC and lobster assets, but its installer is called only inside the desktop `worldDecor=1` branch. Its separate `ProductionMeshyAssets.js` counterpart exists and needs all-callsite confirmation before any archival action.
- `ReferenceStreetLife.js` and `ReferenceStreetLifeModels.js` are small placeholder state installers; this is not evidence of actual interactive NPCs.
- `Game.js` directly constructs rod, fish stand, chandlery, catch display, lobsters and spear; this is stronger evidence than mere module presence. Runtime successful cast/catch/sale is still unverified.
- `BoatOwnership.js` is instantiated in boat-only mode, and references the `STARTER_BOAT_PRICE=3200` constant. Verify physical purchase sign, currency deduction, persistence and actual pilotable boat.
- `src/main.js` installs `BermudaMobileStable.js` and `MobileScreenshotHUD.js`. `BermudaMobileUX.js` is imported for branding; its separate `installMobileControls` function is not shown as called by the inspected main startup. Do **not** remove that module without checking all references.
- Mobile launch sets `noClouds`, `noHaze`, `noCaustics`, `noSim`, `freezeFFT`, `noSpray`. These flags conflict with full-fidelity descriptions and must be treated as an explicit low-GPU profile. This does not prove that the corresponding renderer modules are never initialized.

## System classification

| System | Source status | iPhone startup | Decision | Evidence required |
| --- | --- | --- | --- | --- |
| Fishing rod, catch minigame, fish table, market | Directly constructed / imported | Core path | KEEP | Cast, catch, sell, wallet, reload |
| Chandlery and gear upgrades | Directly constructed / imported | Core path | KEEP | Buy, equip, persist |
| Lobsters and spear | Directly constructed / imported | Core path | KEEP, possibly later release | Spear/harvest playtest |
| BoatController, BoatModel, BoatOwnership | Constructed; ownership boat-only | Core path | KEEP | Purchase, boarding, driving |
| MissionDirector, LifeProgression | Installed | Boat-only normalization | KEEP simplified | Objective persistence |
| PropertySystem, PropertyExpansion | Modules exist | No startup instantiation shown in inspected path | DEFER | Global callsite and save-schema scan |
| SideQuestSystem, IslandMissionSystem, RelationshipSystem | Modules exist | No startup instantiation shown in inspected path | DEFER | Global callsite scan |
| HarbourJobBoard, MarthaShopInterior | Modules exist | No startup instantiation shown in inspected path | INVESTIGATE | Verify alternate install path and interactions |
| RELIC storyline and hero vehicle | Conditional | Deferred boat-only | DEFER | Desktop mission compatibility |
| ReferenceWorldUpgrade | Called | Yes | KEEP pending geometry review | Screenshot/scene-graph audit |
| ReferenceDetailUpgrade / ReferenceFinalPass / ExactVideoPass | Conditional | No on mobile | ARCHIVE candidate | Desktop visual comparison |
| ProductionWorldAssetsNoPlayer and Meshy street life | Conditional | No on mobile | ARCHIVE candidate | Desktop asset requests |
| Waterfront GLB tiers | Installed on desktop | No on mobile | OPTIMIZE / ARCHIVE candidate | HAR by platform |
| Core terrain, reef, FFT, waves, reflections | Constructed | Mixed feature flags | KEEP / OPTIMIZE | GPU profiling, graphics acceptance |
| StableMobileControls + ScreenshotHUD | Called | Yes | KEEP, CONSOLIDATE | DOM/event conflict audit |
| BermudaMobileUX alternative control installer | Module imported | Separate control installer not shown called | AUDIT | All-callsite scan |
| NoVisiblePlayer | Called | Yes | KEEP for first-person mode | Camera and avatar test |
| Historical archives | Workflow publishes | Separate URLs | RETAIN pending approval | Rollback and deployment-cost review |

## Deletion decision gates

1. **Do not delete the nine 430.5 MiB originals yet.** First scan all source, build scripts, tests, HTML, archive generation and asset tooling for literal/dynamic references; then record network requests from the deployed build. Model names and directory size alone are not sufficient.
2. **Do not delete any JavaScript module merely because it is not instantiated on iPhone.** Desktop or opt-in gameplay may still use it.
3. **Do not delete the offline/service-worker logic until user save persistence and cache recovery are tested** on an existing installation.
4. **Do not conflate unused downloadable assets with GPU crash causes.** A file that is never fetched cannot directly consume runtime GPU memory.
5. **No changes to localStorage schema, wallet, inventory, mission completion, or boat ownership without migration and rollback tests.**

## Outstanding Phase 2 verification (not performed)

- Full static import/callsite graph across all 287 `src/` files, including dynamic imports, HTML, scripts, tests and workflow-generated code.
- Production build dependency report and dist asset inventory.
- Browser network HAR: mobile, desktop, `worldDecor=1`, `missions=boat`, `missions=full`.
- Actual browser playthrough and iPhone Safari test; no PASS claim without successful interaction.
- Scene graph counts, DOM HUD overlays, texture/buffer allocations, GPU memory residency and driver telemetry.
- Safe-delete manifest with explicit file paths, dependency proof, byte savings, test coverage, rollback.

## Recommended next execution

Create a **separate audit branch**, add a read-only Node dependency scanner and browser instrumentation that exports an inventory JSON (no deletes), run it in CI, and publish results for review. Follow with live browser testing and an approved deletion manifest. **Do not merge a destructive cleanup to main while iPhone stability remains unverified.**
