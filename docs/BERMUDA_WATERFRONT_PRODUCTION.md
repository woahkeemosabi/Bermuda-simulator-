# Bermuda waterfront production pass

Status: preparation only; Meshy account authorization is pending. No production GLBs have been generated, no Meshy credits have been spent, and these modules are not connected to the live scene yet.

## Baseline

- Repository: `woahkeemosabi/Bermuda-simulator-`
- Audited main commit: `f37336e44184b31573a7f74d3b4751a04c0b63b4`
- Current deployment: https://woahkeemosabi.github.io/Bermuda-simulator-/?compose=1&gpuSafe=2&v=compose22
- Working branch: `bermuda-waterfront-assets-v1`
- Preserve mobile controls, player states, fishing, boat physics, GPU recovery, render scaling, and Compose Mode. The new loader uses the existing native engine, not a second rendering library.

## Seven separate assets

Definitions, prompts, texture direction, and budgets are in `tools/bermuda/asset-plan.json`.

| Final path | Target triangles | Final maximum base-colour texture |
| --- | ---: | ---: |
| `public/models/bermuda/waterfront-landing.glb` | 4,000 | 1,024 px |
| `public/models/bermuda/house-a.glb` | 4,000 | 1,024 px |
| `public/models/bermuda/house-b.glb` | 4,000 | 1,024 px |
| `public/models/bermuda/boathouse.glb` | 3,000 | 512 px |
| `public/models/bermuda/palmetto.glb` | 1,500 | 512 px |
| `public/models/bermuda/harbour-props.glb` | 2,000 | 512 px |
| `public/models/bermuda/channel-marker.glb` | 600 | 512 px |

Total target: 19,100 triangles for the unique assets. Repeated placements must share geometry and textures; use the native engine's instanced meshes for repeated palms and markers. Use base colour with fixed roughness, no normal/metallic maps, opaque materials or alpha cutout, and no added shadow passes. Prefer one material per asset; the loader rejects more than four.

The GLBs must embed their textures and must not require Draco, meshopt, or other unsupported extensions. Texture size limits refer to the final delivered files; Meshy's 2K texturing output still needs texture reduction before it can pass these limits. Keep Meshy task snapshots and their signed download URLs out of public assets and Git.

## Credit plan

Checked 2026-09-26 UTC (2026-09-25 Bermuda): Meshy CLI 0.4.0 `make --dry-run` estimated 20 credits for geometry and 10 for texturing per asset. https://docs.meshy.ai/en/api/pricing lists remesh at 5 credits per request.

Seven geometry tasks + seven texturing tasks + seven remesh tasks = **245 estimated credits**. No regeneration or second variants are included. Check the authenticated balance before the first paid task. Retain every accepted task ID, inspect each preview, then submit only the next required stage. Record the finished tasks' actual `consumed_credits`; unknown charges must remain unknown.

## Placement findings

The boat's current mooring is `(-57.7, 0, -13)`, heading zero. The actual model is 8.2 m long, 2.9 m wide, and draws 0.77 m. Its boarding point is 1.75 m aft of the mooring centre. The existing boarding check accepts a horizontal distance below 4.2 m and a vertical difference below 3.2 m.

Do not move the mooring toward the beach merely to shorten the current wooden pier. Sampled terrain at x=-57.7 is only 0.64 m below sea level at z=-30; that is shallower than the boat's draft. Depth at z=-14 is about 1.52 m.

Candidate landing bounds: x=-67.1 to -60.9, z=-21 to -12.5. Candidate dry spawn: x=-61.5, z=-14.75, on a deck approximately 1.06 m above sea level. This is 3.8 m horizontally from the boarding point, with approximately 1.75 m of conservative clearance between the landing's eastern edge and the hull's widest port edge. Check the actual exported landing geometry before accepting these bounds.

Replace the current long wooden blockout with a broad limestone quay connection and a short landing module. Keep houses inland, use the boathouse as a quay-side accent, leave the boarding edge free of props, and keep channel markers outside the boat's initial forward corridor. Validate both boarding and stepping ashore against the actual player/controller behavior. Do not infer collision safety from the Meshy thumbnail.

## Prepared code

`src/world/bermuda/StaticAsset.js` is an independent static-asset adapter. It preserves glTF node transforms, rejects unsupported animated assets, supports shared geometry and instanced placement, creates only lightweight base-colour materials, enforces mesh and texture budgets, and normalizes the placement pivot to bottom centre. It has not been imported by the live scene.

`node test/bermuda-assets.mjs` checks the native GLB parser and adapter against an existing repository GLB, geometry sharing, instance bounds, input rejection, and the seven asset definitions. Once the new GLBs exist, use `node test/bermuda-assets.mjs --require-production` so missing files fail the gate.

## Baseline verification

- `node test/game-logic.mjs`: passed.
- `npm run build`: passed; existing warning about a module imported both statically and dynamically.
- `node test/bermuda-assets.mjs`: passed for the prepared adapter and manifest; does not claim the missing production assets exist.
- `npm test`: the game-logic stage passed, but engine-smoke cannot run in this environment because it has no WebGPU adapter.
- The cloud browser reached the current GitHub Pages build but also reported `No WebGPU adapter found.` No claim of live 3D visual verification can be made from that browser.
- `test/life-player.mjs` is stale relative to current gameplay: it expects boarding to enter `boat`, while the current Player correctly enters `deck`; its boat stub also lacks `colliders`. Do not change the production player to satisfy that old test.

## Remaining gates before main deployment

1. Finish Meshy authorization and check the balance.
2. Generate all seven assets, inspect previews, texture, remesh, download and reduce textures.
3. Record actual credits, task lineage, bounds, triangle counts and GLB sizes.
4. Integrate the complete pack, replace the temporary blockout, and validate spawn, boat clearance and shore return.
5. Run the required-file asset gate, game tests and build. Compare the locked systems against the baseline.
6. Commit the complete state to GitHub, deploy main through the existing Pages workflow, verify deployment and asset HTTP responses, and report the limit of any unavailable iPhone/WebGPU validation.
