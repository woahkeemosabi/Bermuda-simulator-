# Bermuda After Dark — isolated PS1-style Tidewater fork

Status: **preproduction / branch isolation**. This branch is NOT the production Bermuda Simulator. Do not merge it into main.

## Game identity
Standalone third-person Bermuda maritime mystery, late-1990s console presentation, real FFT ocean simulation beneath intentionally low-fidelity art. The existing simulator's economy, local storage keys, authentication and deployment domains must NOT be shared with the finished game.

## First vertical slice (acceptance criteria)
1. A small fictional Bermuda-inspired dock with one accessible shop, one NPC, and a moored fishing boat.
2. Third-person player locomotion, camera collision, and an ACT interaction prompt.
3. Talk to the dockkeeper to receive a signal-investigation objective.
4. Board the boat and travel to a visible offshore beacon using the existing FFT ocean physics.
5. Interact with the beacon, receive a story clue, and return to the dock.
6. Runs in iPhone Safari without WebGPU device loss; report FPS, memory estimate, device-loss events, and startup time.

## Visual specification
- Internal scene render: 320–480 vertical-equivalent pixels, nearest-neighbor upscale; UI stays native resolution.
- Affine/quantized UV treatment, restrained vertex jitter, 64–128px textures, limited palette and atmospheric distance fog.
- Deliberate silhouette-first models, legible navigational landmarks, Bermuda pastel cottages and limestone walls.
- Preserve FFT ocean geometry and motion, but simplify the surface material into quantized color bands and low-frequency specular highlights.
- No CRT full-screen simulation in the first milestone; avoid expensive full-screen passes.
- Day-to-night lighting should be authored rather than copying the simulator's mobile post-processing.
- Marine snow disabled.

## Architecture
- First validate this branch with a self-contained prototype scene and game-specific namespace.
- Then move to a separate GitHub repository and deployment **before** inviting testers. GitHub connector currently cannot create repositories.
- Do not reuse the existing production domain, save keys, Supabase player_saves table, or wallet values.
- No modifications to the production main branch.
- Compare reference screenshot and measured GPU cost on iPhone before integrating additional effects.

## First implementation tasks
- Extract minimal Tidewater renderer and ocean modules into a scene bootstrap.
- Create low-poly dock, character, boat and beacon assets.
- Build pixel-resolution renderer and PS1-style material variants behind a game-specific setting.
- Implement third-person movement, interaction and boat traversal.
- Add an isolated smoke test and iPhone acceptance checklist.

## Art target
Atmospheric PS1 maritime adventure, not a modern photorealistic simulator with pixelation applied on top.
