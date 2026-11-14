# WebGPU recovery investigation — 2026-11-14

Base: main f756fe83e7f936f2f6c29de65ffb90b2e61bf74e. Candidate is an isolated source branch; not a production release.

## Confirmed source defects

- main.js replaced mobile precompile with a race whose 6.5-second timeout resolved successfully. World readiness then checked CPU spawn only and deferred the first GPU frame until Explore.
- GPU.js swallowed asynchronous pipeline failures; ready() could compile the same pending pipeline synchronously. Compilation concurrency was unbounded.
- Engine.js required 42 ms between mobile frames. With 60 Hz callbacks, that admits only every third callback: 20 FPS before any GPU workload. This is a pacing ceiling, not a GPU benchmark.
- WorldRenderGate sampled seven pixels while FrameHealth expected a nine-sample grid and treated index six onward as the lower scene.
- Frame error cleanup discarded submit hooks, potentially leaving readback slots busy and deferred resource destruction unexecuted.

These defects do not establish the cause of the reported iPhone device loss. A reported `destroyed` reason without details is insufficient to distinguish browser/driver failure, memory pressure, or invalid resource usage. Device-level reproduction and diagnostics remain required.

## Candidate changes and evidence

Bound asynchronous compilation; propagate compilation errors; reject startup deadlines; discover mobile render pipeline variants without running simulation passes; require three consecutive completed, nonblack HDR frames after final world styling. Keep the original artwork and saved-game code untouched. Replace the 42 ms limiter with accumulated 60 FPS deadlines and cap mobile output's short edge at 462 pixels. Record actual submission intervals rather than clamped simulation deltas.

Initial verification: seven behavioural tests passed; native Dawn/SwiftShader engine smoke passed (12 draws, 7,386 triangles, eight pipelines); Vite production build passed. These tests do not establish Safari compatibility, world gameplay, or sustained FPS.

| Measurement | Main | Candidate | Scope |
|---|---:|---:|---|
| Frames admitted in 600 synthetic 60 Hz callbacks | 200 | 600 | Scheduling only, no rendering |
| iPhone average FPS / 1% low | Not measured | Not measured | Physical hardware required |
| iPhone GPU memory / device-loss count | Not measured | Not measured | Physical hardware required |

## Release gate

Do not merge or deploy based on software-renderer tests. Still required: cold startup, repeated launches, 60-second warmup, fishing/catch animation, boarding/throttle/boat handling, graphics transitions, background/resume, and sustained physical iPhone gameplay. Capture device and OS, source SHA, resolution, average FPS, 1% low, frame intervals, logical GPU allocations, completion latency, and loss events. Profile FFT, shoreline, caustics, clouds, shadows, spray, reflections and post separately. Logical allocation estimates are not process/driver memory measurements.

No alternate hosted game or QA page is created. The existing main-only Pages workflow remains the sole production path.
