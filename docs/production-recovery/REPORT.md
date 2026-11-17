# Production recovery investigation — 17 November 2026

## Release decision

**HOLD.** Production remains `75c06f64a2c84173fd4f8d3720bb47562f8f7c7c`. This repair is a source review branch, not another hosted game. Do not merge or deploy until the full-world validation and target-device acceptance are complete. A successful build or component test does not establish startup stability or 40 FPS.

## Historical baseline

The strongest recorded 41.5 FPS baseline is release recipe commit **`df304f3c544c5e73026a8b927c3460dd44e541ad`** (coastal-v29). The FPS is a historical report, not an independently measured iPhone result in this investigation. The release was generated; checking out that commit's ordinary `src` directory does **not** reproduce its deployed game.

Recipe: base `cdc2e9eb800be092901b7772967d177a98ef2c5b`, OceanFFT/ComputeMips/FoamTexture from `f0b0e236acf5e275127213228fa59a417010f5e6`, then the stable, lobster-visual and effect-trials preparation scripts at df304f3. The final SW cache string became v29. Coastal-v33 (`948d0a0f317bb9e224d313f8b909952e887c3a8b`) established seven-effect defaults. `bd23cbbfce83b356a75e1becd36a84f05a3bfa39` adds fish display; it is not independent evidence of 41 FPS.

The investigation examined the reachable history (1,353 commits, 164 remote refs at resume), PR metadata (96 PRs in the initial investigation), relevant source changes and release workflow/job records. It did not benchmark every historical revision on an iPhone.

The production build switched from generated pinned coastal source to actual main source at `5c89c50d3259fba328e76374931640a304024b80`. `e33f504cdc02aa4634582e65b19978b8b0fefed4` subsequently restored an older source tree. Later URL flags did not restore the generated renderer changes. These are proven source/configuration divergences; the exact first iPhone crash has not been bisected on hardware.

## Failure evidence and corrections

| Area | Evidence | Candidate correction |
|---|---|---|
| FFT mip bindings | Main requests five storage textures on the four-texture minimum device; initial native comparison failed before a completed FFT frame | Capability-aware mip split from previously tested recovery work |
| Startup | main.js overwrote precompile with a race that resolved successfully after 6.5 seconds, regardless of pending pipelines | Remove override; await bounded compilation with a rejecting deadline; prepare world variants before drawing |
| Frame pacing | Main used a 42 ms minimum, yielding only 20 rendered ticks/sec on an ideal 60 Hz display | Fractional-deadline pacer; actual elapsed-frame metrics; retain one in-flight mobile submission |
| Generated mobile budget | v29 shadow512, shoreline256, GPU spray2048/CPU512, capped462×817; main had larger buffers and only a width cap | Restore those budgets without removing the effect systems |
| Clouds | Changing sun repeatedly invalidates the panorama and requests a full redraw | Restore the historical 16-cell incremental panorama and 100 ms update cadence |
| Coastal effects | Main's first90frame stagger is temporary and frame-count based | Restore persistent caustics/shore67ms and clouds100ms cadence; accumulate cloud simulation delta |
| Wake shader | Previous native test of fused rows exceeded 2 GiB process RSS without returning a pipeline | Reuse split physics/FFT implementation, validated against independent CPU DFT; no extra persistent buffer |
| Resource lifecycle | Dropping encoder hooks can strand readback reservations and early-destroy referenced resources | Abort callbacks, deferred retirement, tracked submission completion, bounded shader creation and shared native material programs |
| Readiness | Three queue callbacks alone do not establish complete scene initialization | Require real submissions, validation/OOM scopes, completed atmosphere/query/cloud initialization, no pending pipelines and three consecutive ready frames |

The GPU loss trace supplied by the user explicitly said JS had not called GPUDevice.destroy(). No evidence proves that the application deliberately destroyed the device. Driver termination under workload/compilation pressure remains a hypothesis, not a diagnosed Apple driver cause.

## Change boundaries

Engine/compiler/resource modules and native regression tests reuse the preserved `d63d4c157cda8cc7cdc676aacd2206eea311e699` recovery branch. App/main, mobile budgets, cloud cadence and readiness are integrated against current main. No game rules, fishing economy, boat ownership, save schema, terrain, geography, buildings, models or assets are replaced. Full vegetation and water queries remain enabled; this is not a byte-identical v29 rollback.

`test/bermuda-layout.mjs` had stale assertions for G24 and disabled cloud/shore effects even before this repair. These now assert the approved G12 coastal effects and output scale1. The render contract checks now use the historical budget constants.

## Validation and limits

Fresh results are stored under `evidence/`; commands are in `.github/workflows/webgpu-validation.yml` and `test/*native.mjs`. Native Dawn with SwiftShader is software Vulkan, not Safari. DOM stubs do not test touch controls or browser caching. CPU game tests protect logic/persistence, not real interactive play.

The prior session recorded an eight-second full-world deadline failure despite successful component tests. Its local evidence was lost when the scratch environment reset; those historical numbers must not be presented as fresh results. The resumed candidate is being rerun and its new evidence persisted with this report.

No physical iPhone is connected. Sustained40FPS, long-session Safari stability, visual approval, fresh/cached Safari entry, and real touch fishing/boating remain unverified. The no-readback production gate verifies completion, not image pixels.

Pages run43955859895 succeeded at current main. Vercel's play.bermudasimulator.com also pointed to the same main SHA during inspection, with sign-in protection enabled. Protection is preserved. The review branch disables its Vercel preview; Pages publishes only main. No historical branches/assets are deleted.

## Fresh results after workspace recovery

- Candidate source tree `89872279e2f28e2c7d468e717a968ce4bab7f500` is preserved in commit `f5a5e9d8910f58c4eeff41fca6945a7f1f21836a`, draft PR97. GitHub run44103133249 passed both source/build and native GPU component jobs.
- 18 lifecycle tests pass. Gameplay/fishing/boat/persistence logic passes; build passes.
- FFT at both four/eight storage texture limits: eight frames each, zero validation errors. Cube mip/resource test:100 retirements plus aborted/retried readback pass. Shared material programs preserve red and blue pixels.
- Wake:24 moving frames, independent CPU DFT max absolute error0.000474343, compilation1.599s, zero validation errors on local SwiftShader.
- Full world, strict production eight-second frame deadline: **FAIL**, first frame deadline exceeded; no validation errors.
- Full world with explicitly diagnostic60second deadline:18 completed frames; first13.251s, later2.136–3.470s. Readiness completes in88.178s. Logical textures408,898,746bytes, buffers65,723,036bytes; process RSS2,735,534,080bytes. Driver/compiler overhead means RSS is not GPU memory. This is far from a40FPS benchmark and is not a production pass.
- Local browser automation is blocked by the environment's Unix socket restriction before Chrome starts. A real Chromium/SwiftShader CI job is added for fresh/cached startup,120 gameplay frames per run, a synthetic saved wallet and deliberate test-device loss. It is still not iPhone Safari.
- Release remains held; strict deadline is not increased to conceal the failure.
