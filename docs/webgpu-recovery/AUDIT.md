# Bermuda WebGPU recovery investigation — 2026-11-14

**Status: draft, not release-ready.** Base main: `f756fe83e7f936f2f6c29de65ffb90b2e61bf74e`. Work: `fix/webgpu-recovery-20261114`, PR #96. Main and the canonical Pages deployment have not been changed by this repair. No alternate hosted game was created.

## Root-cause findings supported by evidence

| Finding | Evidence | Consequence / repair |
|---|---|---|
| False shader readiness | main.js raced `pipelinesReady()` against a resolving 6,500 ms timer | Timeout previously unlocked startup. Deadlines now reject and compilation failures propagate. |
| False world readiness | main.js set `first-frame-deferred` after CPU spawn validation | Explore previously preceded the first real frame. Final world styling and pipeline discovery now precede three consecutive validated, completed HDR scene frames. |
| Frame scheduling ceiling | Engine.js rejected intervals under 42 ms | At 60 Hz it admits every third callback, about 20 FPS. Accumulated deadlines remove that ceiling; they do not make expensive GPU frames faster. |
| Invalid FFT pipeline on baseline-limit devices | `baseline-storage4.json`: five storage textures exceed a four-texture stage limit; failed pipeline reaches `setPipeline` | Preserve four cascades and all mips through single-output mip dispatches when the device limit is below five. The same native test passes in `candidate-storage4.json`. |
| Unbounded compilation / duplicate work | GPU._async launched all requests; GPU.ready could synchronously recreate an already compiling pipeline | Bound native async creation to two mobile requests; prevent a second synchronous compile of an in-flight request. Constructor-time synchronous bakes remain supported and counted. |
| Abandoned resources/readbacks | Frame-error cleanup erased submit hooks; Texture.resize deferred destruction through those hooks | Explicit abort callbacks release readback slots; retired resources are destroyed after submit or after abandoning the encoder. Water-query failures clear their pending reservation. |
| Incomplete lower-frame sampling | Seven samples passed to a classifier expecting lower samples at indices six onward | Use a full nine-point grid. |

**The actual reported iPhone loss trigger is not established.** The four-storage-texture failure is reproduced with a real native WebGPU validation error, but the affected iPhone's adapter/device limits have not been captured. A `destroyed` loss reason without details is not proof of memory exhaustion, an explicit JavaScript destroy, or a WebKit defect. No driver claim is made.

## Follow-up: reproduced wake shader compiler pressure

Full-world tracing localized another failure to the original `Wake Rows` shader. This shader inlined per-cell wake physics inside a 256-wide FFT with workgroup barriers. The isolated native Dawn/SwiftShader compilation exceeded the diagnostic 2 GiB process-RSS limit after 23.2 seconds without producing a pipeline (`wake-rows-original.json`). The neighbouring column shader compiled in 1.59 seconds. The exact generated original row shader is retained in `test/fixtures/wake-rows-fused.wgsl`.

The candidate separates per-cell physics from the row transform, using the existing spectral buffer. It changes no physics equations, grid size, FFT stages or ocean cascades and adds no persistent buffer. Isolated physics/row compilation completed in 0.325 / 0.459 seconds with 111.7 / 162.6 MiB process RSS. These are **software compiler measurements**, not Apple GPU memory or iPhone frame rates. The row transform also agrees with an independent CPU DFT within 0.000475 absolute error; 24 moving/turning boat frames produce finite data with no validation errors (`wake-split-regression.json`).

Shader module creation now occurs inside the bounded compilation slots; previously modules were all created eagerly even while native pipeline requests were queued. Identical material programs share native pipelines while retaining independent uniform bindings: two differently coloured meshes use one program with exactly the same red/blue pixel outputs (`material-program-before.json`, `material-program-after.json`). The approved `envtest=skip` profile no longer compiles unused environment convolution programs; later activation still prepares them. One-off vegetation atlases are prepared in bounded submissions before the world gate, retaining atlas resolution and releasing bake-only depth/draw resources.

Full-world preparation now completes, but the six-second first-frame gate still fails on this software renderer (`native-world-staged-atlas.json`). A separate 60-second-deadline diagnostic completed five world frames with zero validation errors and reached the gate: first queue completion 12.31 seconds, subsequent frames 2.72–3.02 seconds (`native-world-long-deadline.json`). This passes the functional readback gate only with a diagnostic timeout override; it does not pass the six-second production gate on this software device. Production deadlines have not been relaxed. **This evidence does not yet establish which failure caused the reported iPhone device loss.**

## Rendering and allocation audit

| Pipeline area | Audited behavior | Candidate instrumentation / change | Device measurements |
|---|---|---|---|
| Initialization / shaders | Constructors create compute/post pipelines; mesh variants are requested by pass traversal | Compile-only traversal after final runtime look; bounded pipeline creation; startup deadline fails closed | Full-world native process terminated during preparation; Safari pending |
| FFT ocean | 256-point, four cascades; row/column transforms; displacement/derivative mip chains | Native baseline-limit reproduction and all-cascade readbacks; timestamp captures grouped Ocean FFT pass | Software-only timing below |
| Shoreline / surf | ShoreSim storage textures/deposit buffer; Surf Crests dispatch | Actual pass timestamp capture, logical buffer/texture ledger | Not measured on target |
| Caustics | Mobile fine 256 and broad 128 textures; render and compute mip work | Portable mip generation covers caustics too; render and compute passes separately labelled | Not measured on target |
| Clouds | Weather/bounds/shadow/panorama passes, mobile cadence and panorama profile | Preserve existing profile; timestamp actual passes rather than nested unused kernel slots | Not measured on target |
| Shadows | Cascaded depth passes with staggered updates | Compile variants without recording render passes; timestamp each real cascade | Not measured on target |
| Spray | Position/velocity/info buffers; retained mobile particle capacity | Prepare lazy update pipeline before gate; capture actual update and transparent passes | Not measured on target |
| Reflections / refraction | Existing environment staging and approved envtest=skip; refraction render variants | Preserve settings; prepare refraction and hull variants | Not measured on target |
| Post-processing | Existing mobile single-pass finish; internal-resolution targets | Preserve post path; cap output short edge at 462, adjust internal resolution with hysteresis | Not measured on target |
| Queue / lifetime | Main loop and startup previously requested separate completion promises | Shared completion per central submission; maximum two mobile submissions in flight; foreground-only watchdog; explicit terminal loss | Unit and native component tests pass |

Opt-in `?profile` requests timestamp-query when supported and records actual labelled render/compute passes every 31 frames. Durations may overlap on tile-based hardware and **must not be summed as total GPU time**. Unsupported hardware reports profiling unavailable. Individual pass instrumentation is implemented; independent physical-device profiling of all listed effects remains outstanding.

`window.__bermudaPerformanceReport()` and the failure screen's Copy Diagnostics include source SHA (in CI builds), user agent, readiness state, real frame intervals, average FPS, 1% low FPS, output/internal resolution, logical resource counts/bytes, queue latency/peak in-flight, storage-texture limit, pipeline failures, loss reason, and latest timestamp sample. Samples are bounded. One-percent low is reciprocal mean of the slowest one percent of recorded frame intervals.

The 256 MiB allocation budget is a conservative application policy, **not a measured Safari memory limit**. Counters include requested buffers/textures, not shader compiler heaps, driver overhead, OS allocations or swapchain memory. Dynamic resolution waits for an idle queue and sustained pressure, changes by 0.05 with a ten-second cooldown, and preserves effects. `?fixedResolution` disables adaptation for equal-resolution comparison. Logical counters alone cannot establish memory safety.

## Verification completed

- 19 behavioural regression tests: timeout/error propagation, bounded compilation, no duplicate compilation, pacing, real interval statistics, queue capacity/loss/background watchdog, memory estimates, resource retirement, resolution hysteresis, consecutive-frame readiness and terminal errors.
- Native Dawn/SwiftShader engine smoke: 12 draws, 7,386 triangles, eight pipelines.
- Native FFT at four and eight storage-texture limits: all four cascades, finite texture data, representative mip levels; no candidate validation errors.
- Native resource regression: every mip and all six cube faces at 32/64/128/256/512 resolutions; 100 texture lifetimes; aborted and successfully retried readback; zero validation errors.
- Actual-pass timestamp instrumentation exercised against Ocean Init Spectrum / Conjugate / Copy H0 / FFT.
- Existing fishing, economy, boat ownership/fuel, save round-trip/migration, layout and production source checks pass. These are automated logic/source tests, not interactive Safari fishing or boat-operation tests.
- Vite production build and GitHub PR validation / RELIC integration checks pass at the recorded branch checkpoint.
- Loading artwork remains byte-identical: SHA256 `bc8080f07c64bb4c71375d4a7f531f08ebe25b9f8bfbf0b2cb7323c9f389eaca`. No save keys, balances or progression data were changed.

## Before / after measurements

| Measurement | Main | Candidate | Valid interpretation |
|---|---:|---:|---|
| Frames admitted in 600 synthetic 60 Hz callbacks | 200 | 600 | Scheduler only; no rendered frames |
| Four-storage-texture FFT | Validation failure before first completed frame | Eight frames completed; no validation errors | Native capability regression |
| Eight-storage-texture FFT mean after discarding first frame | 382.48 ms | 362.26 ms | Seven software-renderer samples each; too short/noisy for an optimization claim |
| Eight-storage-texture FFT reciprocal mean | 2.61 FPS | 2.76 FPS | Software FFT-only throughput, not game or iPhone FPS |
| iPhone gameplay average / 1% low / GPU frame time | Not measured | Not measured | Requires physical device |
| iPhone process GPU memory / loss events | Not measured | Not measured | Requires physical device |

Raw JSON is committed beside this report. `candidate-profile.json` includes timestamp and logical allocation evidence for the **FFT-only** workload; it is not full-world consumption.

## Failed / incomplete validation and release blockers

Full App startup was attempted with native WebGPU, actual project assets, and DOM stubs at 461×817. Initialization reached pipeline preparation; the host killed the process with exit 137 before a complete world frame. `native-world.json` records the last completed stages. The kill's cause was not independently established. This does not reproduce Safari and is not a passing world-startup test. DOM stubs also cannot validate touch controls or UI.

Still required before merge/deployment: successful full-world cold and repeated startup; physical iPhone Safari runs at the approved resolution; optional 60-second warmup; fishing/catch animation and sales; boarding/throttle/boat handling; graphics transitions; background/resume; sustained gameplay and thermals. Collect at least average FPS, 1% low, frame times, resource trends, queue completion and device-loss events per scenario, with device/OS/source SHA. No 40 FPS or iPhone stability claim is authorized by the current evidence.

There is **no production deployment deliverable yet**. Keeping this draft unmerged follows the requirement not to deploy a failing or unverified build.

## Reproduction

```sh
node test/webgpu-recovery.mjs
npm run build
# Native Vulkan runtime needed; this workspace uses Chromium's SwiftShader ICD:
VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json LD_LIBRARY_PATH=/usr/lib/chromium node test/engine-smoke.mjs
VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json LD_LIBRARY_PATH=/usr/lib/chromium STORAGE_LIMIT=4 node test/fft-capability.mjs
VK_ICD_FILENAMES=/usr/lib/chromium/vk_swiftshader_icd.json LD_LIBRARY_PATH=/usr/lib/chromium node test/gpu-resource-native.mjs
```

The full-world diagnostic additionally requires `sharp` and `@napi-rs/canvas` through `CODEX_PRIMARY_RUNTIME_NODE_MODULES`; it uses isolated in-memory storage and does not access a user's saved progress. It is deliberately not treated as a portable CI or browser-compatibility test.
