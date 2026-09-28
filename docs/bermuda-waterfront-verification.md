# Bermuda waterfront expansion

Implementation continues from recoverable main `84ccb74da318d173a64b621e6e9949037ff23d12` on `bermuda-waterfront-expansion-recovery`.

## Recovery evidence

Original generation run: 36351012281; preserved task records: artifact 10942663382.
Recovery and remesh run: 36355181074 (successful).
`tools/bermuda/expansion-lineage.json` records source IDs, parent/remesh IDs, actual charges, file hashes and texture/triangle counts.
Six existing sources were recovered: limestone seawall, houses C/D, hillside cluster, hilltop landmark, bougainvillea.
Only four unstarted sources were generated: rocky shoreline, marina kit, Fish Market, Bait & Tackle.
All ten were remeshed from existing source task IDs. Recorded recovery balance: 675 → 505 credits, 170 spent. No new generation was requested during scene integration.
High-detail sources remain separate from runtime files in the repository and recovery artifacts.

## Runtime budget

Only mobile-v2/mobile-v3 are referenced by the waterfront loader. Raw expansion GLBs are not requested.

| Tier | Unique triangles | GLB bytes | Triangles including instances |
|---|---:|---:|---:|
| Startup (dock, A/B, market, tackle) | 21,317 | 8,149,648 | 28,624 |
| Secondary | 25,909 | 8,734,472 | 42,313 |
| Deferred | 10,348 | 2,190,192 | 10,348 |
| Total | 57,574 | 19,074,312 | 81,285 |

These are the 17 Meshy assets only, not total game memory/geometry. Existing boat, characters, terrain, fixtures and water are additional. Textures are 512 or 1024 PNG, compatible with the native GLB parser. Shared geometry/materials and instancing avoid duplicate textures. Sequential uploads bound temporary decode pressure; distance culling limits draws. Background loading begins after gameplay starts. Secondary failures are recorded without blocking gameplay.

## Shared dock transforms

| Object | X | Base Y | Z | Yaw |
|---|---:|---:|---:|---:|
| Fish Market | -66 | 1.00 | -22 | π/2 |
| Joe | -64.6 | 1.06 | -22.7 | π/2 |
| Bait & Tackle | -66 | 1.00 | -29 | π/2 |
| Martha | -64.6 | 1.06 | -29.6 | π/2 |
| Spawn | -63.4 | 1.02 | -20 | π |
| Boat berth (unchanged) | -59.2 | 0 | -14.5 | 0 |

Lamp world Y is 2.85 for both shops. Shop visuals, vendor interaction, ice fish, collisions, objective/minimap constants and lamps share dock transforms. The east walking corridor is clear for a 0.3 m radius character. Legacy stall-kit downloads have been removed from both vendors. The old Debris system stays disabled.

Boarding/ACT keeps mooring active; throttle releases it. The berth spring now remains active while the helm is occupied.

## Quality

Safe link: `compose=1&gpuSafe=2&scale=0.72&noClouds=1&noHaze=1&noCaustics=1&noSim=1&noVeg=1&G=16`.
Opt-in Mobile High: `compose=1&quality=mobile-high` (omit gpuSafe).
High selects scale 0.85/G24, caustics/haze on, Bermuda gardens on, half-resolution refraction unchanged, 1024² shadows with three cascades. Shore simulation remains off unless explicitly selected with `shoreSim=1`; this is experimental, not phone-certified.
Both mobile paths retain FFT. Clouds, legacy procedural vegetation, wake/spray/breakers, marine snow, air motes and distant wildlife/whale are disabled. Audio and its Safari resume handlers are preserved. Recovery overrides High after a detected GPU failure.

## Verification and limits

- Production build and CPU fishing/economy/upgrades/fuel checks pass.
- Dock placement checks deliberately use underwater terrain (-4 m) and verify explicit vendor Y, interaction reach and walking clearance.
- Asset tests verify all 17 hashes, actual triangle counts, embedded PNG dimensions, placement scales and dock top alignment.
- Player simulation tests walking/swimming/diving, ACT boarding, occupied mooring, throttle release and >60 seconds driving. The `--bermuda` variant uses the real boat model, real terrain and Bermuda dock colliders.
- Native WebGPU workflow renders actual models against Bermuda terrain heights, shows vendor stand-ins, uploads all tiers, submits 120 further frames, and checks validation errors/device loss. Its water/ground shading is simplified for layout inspection; these images are not live Safari screenshots.
- Cloud browser startup reports `No WebGPU adapter found`. Interactive loader-to-play, shop-menu UI, Safari audio background/resume, iPhone quality limits and long-duration iPhone GPU stability are **not verified** here. CPU/native GPU checks do not certify those behaviors.
- Mobile High stays opt-in pending real-device verification. No claim of matching the photographic reference: generated shop roofs and low-poly plants still have limited fidelity.
