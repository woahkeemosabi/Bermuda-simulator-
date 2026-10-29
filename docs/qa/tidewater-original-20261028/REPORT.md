# Original Tidewater GPU validation — 28 October 2026

**Release verdict: FAIL — physical iPhone startup lost its GPU device. No verified playable candidate. Do not merge.**

The user's physical iPhone reports a qualifying Apple adapter, but its first supplied full-quality startup screenshot shows DEVICE_LOST. Agent-controlled environments remain unsuitable. Build and CPU-test success are not rendering or gameplay acceptance. Work is isolated on `test/tidewater-original-high-limit-20261028`; production and restoration PR #56 remain unchanged.

## Physical iPhone capability evidence — 29 October update

The user supplied [WebGPU Report output](evidence/iphone-adapter-20261029.txt) from their iPhone: Apple vendor/architecture, fallback false, storage-texture limit 44 and sampled-texture limit 44. This passes the adapter gate and exceeds the preferred 8/32 limits. Exact model, OS/browser version, backend and driver are not present in this export. This is user-supplied capability evidence, not an observed game run. The agent-controlled environments remain unsuitable. The subsequent physical iPhone startup attempt failed, as documented below.

The opt-in `tidewaterQA` recorder captures real requested and granted device limits, shader messages, uncaptured errors, device loss, loader timing and submitted-frame samples. Its bounded local log can be exported using the iPhone share sheet. The previous run can be recovered after a reload; the last seconds before a process crash may be absent. JS heap is recorded only when exposed; GPU memory stays unknown. The preview launch uses the existing `desktop` switch to select full quality while retaining the existing physical-device touch controls. No shader or game save is changed by this recorder. All gameplay remains unverified.

## Physical iPhone startup failure — 29 October

The user supplied [this screenshot](evidence/iphone-device-lost-20261029.jpeg) after opening the isolated original-renderer preview. It shows **QA · DEVICE_LOST · 0 fps**, **COMPILING SHADERS…**, **94%**, and an elapsed loader display of **5:32**. The same screenshot was attached twice; it is one observed failure, not two independent test runs.

Candidate: `74edf2bb17c4a7178e6dd8d0fd03bc4d96db9911`. Preview: `dpl_EXHPXF6G59EZzrw7w2jJCBVUmGiT` at `bermuda-simulator-bfd95nx5i-akeemalbouy-1327.vercel.app`. The screenshot only shows a shortened hostname, so its association with this candidate is based on the conversation and supplied test link, pending the exported runtime report.

**Confirmed:** the QA recorder observed device loss; the loading screen remained visible at capture; interactive gameplay was not demonstrated. **Unknown:** exact loss time/reason/message, granted game-device limits, failing pipeline, shader diagnostics, peak memory and whether any earlier work completed. The displayed 5:32 is elapsed loading time at screenshot capture, not the device-loss timestamp or successful startup duration. The 0 fps display is a sampled submitted-frame counter, not a GPU execution benchmark.

Source review at the candidate commit:

- `src/App.js:462–525`: the “Compiling shaders” stage covers post-pipeline construction, pipeline readiness waits, two precompile frames and a queue-completion wait. The screenshot does not distinguish those substeps.
- `src/ui/UI.js:3209–3240`: progress creeps toward the stage ceiling over time. 94% does not mean 94% of shaders compiled.
- `src/engine/gpu/GPU.js:64–65, 159–198`: the original device-loss listener logs to the console; asynchronous pipeline failures are handled/logged; pipeline readiness waits for pending promises. The original module does not invoke Bermuda's separate failure callback.
- `src/main.js:229–265`: the loading error UI depends on startup rejection or the Bermuda failure callback.
- `src/qa/TidewaterSafariQA.js`: the observer independently records device loss and updates its QA status. It does not terminate the application's pending startup. This explains the conflicting failure badge and continuing loader without establishing the cause of GPU loss.

No speculative shader or quality change was made in response. Next evidence is **QA → Export report** from the same tab (or **Previous run** after one reload). That JSON contains the loss event, native requested/granted limits and captured shader/errors. A runtime repair and another full-quality physical-device run are required before a playable claim. Fishing, Joe selling, earning 3,200 and boat purchase remain untested through the real UI.

## Pinned sources

| Source | Commit |
|---|---|
| Original Tidewater | 4811ba48d795197de5621985f404e765c0b7c0ef |
| Supplied original test branch | c8ac53d88e34c6a78d5b217b9c14a6342cf94384 |
| Compatibility restoration, PR #56 | 19e2d9f00b737a4a75acbc87e6105e8c3b98e4e9 |
| Production main at inspection | 6d4105d32e788e4060e52c849195aa68e8910ac6 |

Ten core engine/ocean files match the upstream bytes, including GPU scheduling, Engine, scene/mesh rendering, ComputeMips, FFT, underwater lighting, caustics, wake and water surface. See the [hash manifest](../../../test/tidewater-original-manifest.json) and [comparison evidence](evidence/source-integrity.json).

The initial QA commit altered no application source or assets. The subsequent opt-in Safari QA commit adds an early conditional import in index.html, a diagnostic module and a separate test launcher; it does not change engine/ocean code or existing Bermuda assets. Protected Bermuda world, gameplay, player, mobile, UI, App, main and public-asset paths also match the pinned compatibility and production revisions. The entire Bermuda application is not pristine upstream: existing WebP support in GLTF, FullscreenPass diagnostics, WaterQuery mobile throttling, MobileWake and Environment scheduling are preserved.

## Environment findings

| Environment | Adapter, backend, driver | Limits/features | Result |
|---|---|---|---|
| Local Linux workspace | No exposed DRM/NVIDIA GPU devices. Native Dawn returned no adapter; Vulkan initialization reported no drivers. No selected backend/driver identifiable. | Unavailable | BLOCKED |
| Session cloud Chrome | Public WebGPU probe could not obtain an adapter. Internal chrome://gpu was disallowed by browser URL policy; no bypass attempted. | WGSL language features exposed, but no adapter limits/features. Language features do not establish hardware support. | BLOCKED |
| Historical GitHub original run | Ubuntu hosted runner / Chromium 156.0.8078.4. Adapter model, driver and selected backend omitted by old script; hardware backing unverified. | Desktop storage-texture limit 4; emulated-mobile final probe returned no adapter. | INELIGIBLE |
| Hardware provisioner / runner | No suitable provisioning tool exposed. Actions runner inventory could not be inspected through the available connector. This does not prove the account has no GPU runners. | No qualifying environment obtained | BLOCKED |

[Local inventory](evidence/local-environment.json) · [Native Dawn result](evidence/local-dawn-adapter.json) · [Cloud probe screenshot](evidence/tidewater-webgpu-unavailable-20261028.jpg).

The runtime capability check also found no environment-status tool or network-policy snapshot exposed to this executor. No new hardware access or credential readiness was inferred. A prior local Chromium installation attempt returned invalid/truncated archives; it did not produce a usable browser. The revised workflow uses the browser installer on its separate Actions runner.

## Revised qualification run — confirmed evidence

[Actions run 40786864924](https://github.com/woahkeemosabi/Bermuda-simulator-/actions/runs/40786864924) tested candidate `d5aee2ffcb2f9176343c1f6e4929d9c418a84da1` and pinned compatibility `19e2d9f00b737a4a75acbc87e6105e8c3b98e4e9` on the same hosted runner. The source/CPU/build job passed. The hardware job failed at its mandatory final gate, correctly rejecting both environments instead of reporting green.

| Observation | Original and compatibility |
|---|---|
| Browser | Headless Chromium 156.0.8078.4 on Linux |
| WebGPU identity | vendor google; architecture swiftshader; isFallbackAdapter true |
| Browser graphics stack | ANGLE / Vulkan 1.3.0 / SwiftShader Device (Subzero); SwANGLE driver 5.0.0 |
| Dawn backend / driver | Not independently exposed by WebGPU; browser GL metadata above is not proof of Dawn backend |
| Storage / sampled textures per shader stage | 4 / 16 — below the 5 / 21 gate |
| Hardware Vulkan support | Browser metadata reports false |
| Outcome | BLOCKED_UNSUITABLE_ENVIRONMENT before game navigation |
| Runtime/gameplay/performance | NOT RUN; startup, FPS, JS heap and GPU memory null |

Full numeric limits, all 21 adapter features and 14 WGSL language features are retained in each raw report. Advertised features include timestamp-query, subgroups, float32-filterable, float32-blendable, bgra8unorm-storage and BC/ETC2/ASTC compression; feature availability does not make this software adapter eligible. No game device was created, so empty error arrays do not constitute a clean GPU/gameplay result.

- Original: [raw report](evidence/ci-40786864924/original/report.json), [adapter screenshot](evidence/ci-40786864924/original/adapter.png), [server log](evidence/ci-40786864924/original/server.txt).
- Compatibility: [raw report](evidence/ci-40786864924/compatibility/report.json), [adapter screenshot](evidence/ci-40786864924/compatibility/adapter.png), [server log](evidence/ci-40786864924/compatibility/server.txt).

Artifact 12859382562 was downloaded and its ZIP SHA-256 verified as `94028791df23874a19865751881287b92200b676b63e388b8399f0e60222fea5`. The screenshot's heading contains a text-encoding blemish; its recorded adapter values are unchanged. These are qualification screenshots, not rendered-game screenshots.

## Original versus compatibility diagnostics

These are historical **unsupported-environment diagnostics**, not qualifying hardware validation. Both old Actions jobs appeared green because their script logged failed startup without returning a failure exit code.

| Check | Original — run 40738172751 | Compatibility — run 40737498783 |
|---|---|---|
| Desktop HTTP | 200 | 200 |
| Loader | Remained “COMPILING SHADERS… 78%” after 60 s wait | Remained “COMPILING SHADERS… 78%” after 60 s wait |
| Logged GPU failures | Five storage writes exceed four; envSource, Ocean Mips A, caustics and underwater-light pipelines affected | Sampled-texture layouts need 17–21 bindings versus a ceiling of 16 |
| Emulated mobile | STARTING WEBGPU; no adapter at final probe | STARTING WEBGPU |
| Interactive gameplay | Not reached | Not reached |
| Physical iPhone Safari | Not tested | Not tested |

Five storage textures alone are insufficient for this preserved full scene: the observed post-processing layouts require at least **21 sampled textures** too. The gate requires 5 storage / 21 sampled and reports whether the preferred storage limit of 8 is available. Upstream requests up to 8 storage / 32 sampled. Passing these floors is not proof that all other requirements or shaders pass.

- [Original Actions run](https://github.com/woahkeemosabi/Bermuda-simulator-/actions/runs/40738172751): [JSON](evidence/original-browser-40738172751.json), [log excerpt](evidence/original-browser-40738172751.txt).
- [Compatibility Actions run](https://github.com/woahkeemosabi/Bermuda-simulator-/actions/runs/40737498783): [JSON](evidence/compatibility-browser-40737498783.json), [log excerpt](evidence/compatibility-browser-40737498783.txt).

The historical scripts retained only the first 12 errors. These are not exhaustive error counts. Compatibility's missing storage error in this excerpt does not establish every mip dispatch passed.

## Acceptance matrix

| Requirement | Result |
|---|---|
| Original core shaders / renderer source | PASS — 10 byte-identical upstream files |
| Bermuda assets / geography / controls / HUD / gameplay preserved | PASS — source comparison, not visual runtime QA |
| Build | PASS — build only |
| Game logic, harbour layout, first-boat mode | PASS — CPU only |
| Earn/save 3,200 and purchase/save boat | PASS — CPU integration only; supplied catches, no real UI |
| Qualifying genuine GPU | PASS — user-supplied Apple adapter capabilities; actual game-device limits await JSON export |
| Shader compilation on qualifying hardware | ATTEMPTED, NOT VERIFIED — device lost while loader showed shader stage |
| FFT numerical output / animated ocean | NOT RUN |
| Caustics / moving-boat wake | NOT RUN |
| Rendering and loader disappearance | FAIL — physical iPhone screenshot still shows loader at 94% with DEVICE_LOST |
| Walk/look/cast/fight/catch / sell to Joe through UI | NOT RUN |
| Earn 3,200 / reload / purchase / board / drive through UI | NOT RUN |
| Physical iPhone Safari | FAIL — user-supplied startup screenshot; exact browser/OS still await runtime report |
| Comparable hardware FPS and memory | NOT RUN |

CPU evidence: [verification log](evidence/local-verification.txt). The economy test supplies 521 grunt catches/sales, moves the wallet from 75 to 3,201, reloads, buys for exactly 3,200, prevents a duplicate charge and verifies persisted ownership with 1 remaining. It tests neither fishing input nor Joe's actual interface. No real browser save receives injected fish or cash.

The harbour CPU fixture emits a relative-asset URL warning under Node while its assertions pass. This does not verify browser asset rendering.

## Measurements and limitations

Successful startup time, FPS, browser RSS, JS heap and GPU VRAM are **not measured** on qualifying hardware. The old 60-second loader wait is not a successful startup measurement. Historical device-loss status is unknown; absence of a log is not a pass.

The revised runner collects actual adapter limits/features and local-browser GPU metadata before loading the game. On a qualified run it records real shader compilation messages, uncaptured errors, device loss, actual game-device limits, loader/input checks, screenshots, startup duration, submitted-frame rate and JS heap where exposed. Submitted-frame rate is not GPU execution time or display presentation rate. JS heap is not total browser memory or GPU allocation. Instrumentation adds overhead.

The runner uses only a new localhost browser profile. It does not connect to the session cloud browser, production origin or an existing player's save. Its wrappers call native WebGPU methods and return native results unchanged. No adapter values, shaders, dispatches or quality are substituted.

## Reproduction on real hardware

Use a trusted existing GPU machine and browser. Do not spoof limits, use SwiftShader/llvmpipe/WARP, disable validation or reduce quality.

```sh
git checkout test/tidewater-original-high-limit-20261028
npm ci
node test/tidewater-original-integrity.mjs
node test/tidewater-gpu-gate.mjs
node test/first-boat-economy.mjs
npm run build
npx playwright install chromium
node scripts/validate-tidewater-browser.mjs --probe-only
TIDEWATER_QA_HEADED=1 node scripts/validate-tidewater-browser.mjs
```

An optional TIDEWATER_CHROME_PATH selects an installed Chromium executable. Linux availability flags do not raise limits or force hardware. Adapter information must still qualify. GL metadata is not proof of Dawn's selected backend; unavailable backend/driver information stays unknown.

Exit codes: **2** environment blocked; **1** execution failed; **3** startup smoke passed but visual/gameplay QA incomplete. **0** is possible only for a successful --probe-only check, explicitly labeled game not tested. Full validation cannot silently become green with manual checks outstanding.

For a same-machine comparison, build the pinned compatibility revision in a separate worktree and run the same harness:

```sh
git worktree add --detach ../bermuda-compat 19e2d9f00b737a4a75acbc87e6105e8c3b98e4e9
(cd ../bermuda-compat && npm ci && npm run build)
TIDEWATER_APP_ROOT=../bermuda-compat TIDEWATER_QA_PORT=4180 TIDEWATER_QA_OUTPUT=audit-output/compatibility TIDEWATER_QA_HEADED=1 node scripts/validate-tidewater-browser.mjs
```

The workflow can select an already-configured self-hosted runner labeled webgpu via its hardware input. No runner, paid service or subscription was provisioned. The standard Ubuntu job is capability qualification, and must fail if unsuitable. Artifact collection uses continue-on-error, followed by a mandatory gate so blocked/incomplete checks cannot become a green validation.

## Remaining hardware acceptance work

1. Record physical GPU, OS, browser, driver/backend where available, adapter features/limits and actual game-device limits. Independently corroborate hardware identity if metadata is insufficient.
2. Confirm the four 256-point FFT cascades, 512/256 caustics, 512-square wake and full default quality. Independently qualify native Dawn before running existing FFT/caustics/wake numerical tests.
3. Review unobstructed world screenshots and animation; inspect underwater caustics and wake while driving. Object presence and frame counters do not establish visual correctness.
4. Start an isolated save. Dismiss the loader/start overlay, move/look, cast/fight/land fish, and sell through Joe's real UI. Capture inventory and wallet changes.
5. Earn at least BMD 3,200 from legitimate sales, reload, buy using E, verify exact charge, boarding/driving and ownership after reload. Check insufficient funds and duplicate-charge protection.
6. Compare cold/warm startup and sustained frame-time/error/device-loss behavior on the same hardware/settings for both revisions. Report JS heap, process RSS and VRAM separately when measurable.
7. Test physical iPhone Safari separately; Chromium mobile emulation is not an iPhone result.

**No merge or production deployment. No playable-success claim until the outstanding hardware and gameplay checks are actually completed.**

