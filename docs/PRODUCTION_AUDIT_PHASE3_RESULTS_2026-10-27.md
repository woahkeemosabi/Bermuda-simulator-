# Bermuda Simulator — Phase 3: measured audit findings

Date: 2026-10-27. Evidence: GitHub Actions run 40536804416, artifact `bermuda-game-audit` (ID 12749441061). This is **read-only evidence**, not a deletion authorization.

## Automation completed

CI job `static-and-browser` succeeded: `npm ci`, static scanner, `vite build`, Chromium install, preview server, four 15-second browser scenarios, and JSON/Markdown artifact upload. A successful CI job does **not** mean the game initialized or became playable.

Static scanner: 655 files, 359 JS-like files, 316 reached from declared roots, 43 statically unreached, 206 binary assets. The 43 include `public/sw.js`, `vite.config.js`, scripts and tools: these are **false positives** if described as unused gameplay code. The regex scanner also reports `src/core/BenchSeed.js` despite a direct side-effect import in `src/main.js`, proving the scanner is conservative and incomplete. It must not drive automatic deletion.

## Chromium browser results

| Scenario | HTTP | Canvas | Loading text after 15 seconds | GLB requests | Page exceptions |
| --- | --- | --- | --- | --- | --- |
| Desktop boat-only | 200 | 3 | COMPILING SHADERS… 44% | 2 | 0 |
| Desktop full | 200 | 2 | STARTING WEBGPU… 0% | 0 | 0 |
| Desktop worldDecor | 200 | 2 | STARTING WEBGPU… 0% | 0 | 0 |
| Mobile emulation | 200 | 2 | STARTING WEBGPU… 0% | 0 | 0 |

No scenario reached an observed playable state within 15 seconds. Thus none passed fishing, Joe, Martha, purchase, save/load, boat controls, NPC, HUD or world-object interaction. Absence of page exceptions is **not** absence of WebGPU validation errors.

Desktop boat-only requested `/models/characters/joe.glb` and `/models/characters/marta.glb`; this confirms network requests only, not successful instantiation. The other scenarios never advanced far enough to infer anything about GLB use.

## Confirmed WebGPU validation defect in Chromium

Console reported:
```
WebGPU: The number of storage textures (5) in the Compute stage exceeds
the maximum per-stage limit (4).
While validating BindGroupLayoutDescriptor "envSource mips A.g1".
WebGPU: pipeline "envSource mips A" failed:
[Invalid PipelineLayout] is invalid due to a previous error.
```

The tested adapter supports four storage textures per compute stage, while `envSource mips A` requires five. This is a **real capability-handling failure in the tested environment**. It must be resolved through a supported lower-binding implementation or robust capability gating; do not assume that the same fault is responsible for iPhone Safari's device loss. Record `adapter.limits.maxStorageTexturesPerShaderStage` and pipeline validation errors on each target device.

## Priorities

**P0 — Startup and GPU capability correctness.** Trace `envSource mips A` shader and bind-group layout; split compute passes or reduce storage texture bindings to fit supported limits. Add preflight adapter-limit checks and a fallback, then verify build, Chromium initialization and actual gameplay.

**P0 — End-to-end first-boat test.** Extend browser smoke to wait for a real ready state (not fixed 15 seconds), capture screenshots and progress, exercise UI and player actions, and report explicit PASS/FAIL/NOT REACHED. Keep iPhone Safari validation separate.

**P1 — Reachability scanner correction.** Recognize side-effect imports, non-JS entrypoints and dynamic paths; classify tooling/config/service workers separately. Produce reference evidence for each proposed asset deletion.

**P1 — Resource measurement.** Capture successful-run network HAR, scene graph, textures/buffers, render passes and GPU dispatch counts. The current audit did not reach gameplay and cannot prove runtime asset absence.

**P2 — Archive-only deletion trial.** The nine large original GLBs totaling about 430.5 MiB remain candidates, not approved deletions. Use an isolated branch and compare build/deploy and gameplay after fixing startup.

## Safety and scope

No permanent deletions. No changes to `main` gameplay, assets, saves or deployment. Chromium on Linux is not iPhone Safari. The 15-second startup timeout is too short to conclude permanent hang, but is sufficient to establish that no gameplay was verified. The full evidence is in GitHub Actions artifact `bermuda-game-audit`.
