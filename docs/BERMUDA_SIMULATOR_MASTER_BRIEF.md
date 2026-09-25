# Bermuda Simulator — Master Build Brief

## 1. Product Vision
Build a premium browser-based Bermuda exploration simulator that feels unmistakably Bermudian from the first 30 seconds: turquoise shallows, deeper reef channels, pastel homes with white stepped roofs, limestone shoreline, moorings, docks, boats, subtropical vegetation, bright Atlantic light, and a believable marine soundscape.

The simulator begins as a focused coastal experience and later becomes the immersive 3D front end for Bermuda Ocean Brain.

## 2. Working Title
**Bermuda Simulator**

Alternative working names for later brand testing:
- Bermuda Waters
- Bermuda Explorer
- 32°N
- Island 441

For development, use **Bermuda Simulator** until the world and gameplay prove themselves.

## 3. Core Player Fantasy
The player is not looking at a map of Bermuda. The player is **inside Bermuda**.

The first experience should be:
1. Spawn on a dock.
2. Look across clear turquoise water.
3. Walk to a small boat.
4. Board and take the helm.
5. Leave the harbour.
6. Cross from shallow aqua water into a darker channel.
7. Stop near a reef/cove.
8. Enter the water and swim below the surface.

If that eight-step loop feels excellent, the prototype has succeeded.

## 4. v0.1 Vertical Slice
### Geographic inspiration
Hamilton Harbour / Great Sound inspired coastal slice.

The first release is **not** a complete 1:1 Bermuda recreation. It is a tightly authored Bermuda environment that establishes the rendering, controls, visual identity, water, boat handling, swimming and performance envelope.

### Required v0.1 features
- Browser launch with loading/progress state
- First-person walking
- Mouse/keyboard controls on desktop
- Touch/mobile control path designed from the start
- Board / leave small motorboat
- First- and third-person boat camera
- Boat propulsion and steering
- Water interaction and wake
- Swimming above and below the surface
- Visible seabed in shallow water
- Turquoise-to-deep-blue water transition
- Small reef/coral area
- Bermuda-style shoreline architecture
- White stepped roofs
- Limestone coastal material language
- Subtropical vegetation
- Daylight sky and atmospheric haze
- Minimal HUD
- Minimap
- One exploration objective: dock → boat → cove/reef → swim → return

### Explicitly deferred from v0.1
- Full Bermuda island
- AIS/live data
- AI agent
- Multiplayer
- Accounts
- Large economy system
- Complex missions
- Full fishing progression
- Traffic simulation
- Aircraft
- Full GIS layer stack

## 5. Visual Direction
**Slightly stylized realism.**

Target: visually convincing enough to feel premium and geographically specific, but not constrained by photogrammetric perfection.

### Bermuda visual pillars
1. Clear shallow water with readable seabed.
2. Strong depth-based color transitions.
3. Bright white stepped roofs against pastel walls.
4. Limestone walls, cliffs and shoreline edges.
5. Dense green subtropical vegetation.
6. Marinas, pilings, moorings and small boats.
7. Atlantic light: high clarity, strong sun, humid haze without tropical-jungle exaggeration.
8. Reef and channel geography visible through water color.

## 6. Technical Foundation
Use **Tidewater** (`dgreenheck/tidewater`) as the initial engine/reference implementation rather than rebuilding the difficult ocean stack from zero.

Tidewater is a static Vite project using its own WebGPU/WGSL renderer. Its architecture already separates the major systems we need:
- `src/engine/` — renderer, GPU resources, geometry, scene graph, materials, lighting
- `src/ocean/` — FFT ocean, shore waves, caustics, underwater lighting, wake
- `src/sky/` — sky, atmosphere and clouds
- `src/world/` — terrain, village, reef, vegetation, wildlife and boat
- `src/player/` — walking, swimming, boat and free camera
- `src/game/` — gameplay, HUD and minimap
- `src/post/` — underwater composite, haze, bloom, motion blur and post-processing
- `src/audio/` — environmental and interaction audio

Tidewater build path:
- `npm install`
- `npm run dev`
- `npm run build`
- output: `dist/`

## 7. Bermuda Conversion Strategy
Do not rewrite the engine first. Preserve known-good systems and replace the fictional world incrementally.

### Conversion order
1. Confirm upstream Tidewater runs unchanged.
2. Create Bermuda development branch.
3. Rebrand loading/title shell only.
4. Freeze gameplay additions.
5. Replace terrain height/depth representation.
6. Tune shallow/deep water palette for Bermuda.
7. Replace generic village silhouette with Bermuda building kit.
8. Replace vegetation mix with Bermuda-appropriate vegetation.
9. Build Bermuda dock/harbour spawn.
10. Place reef/cove objective.
11. Tune boat route and player loop.
12. Profile desktop and iPhone performance.

## 8. Geographic Data Plan
### Phase A — authored prototype
Use hand-authored terrain inspired by Hamilton Harbour / Great Sound. This gets the experience playable quickly.

### Phase B — real geography
Introduce Bermuda elevation/bathymetry data after the rendering and coordinate pipelines are stable.

Required geographic pipeline later:
- elevation / terrain raster
- bathymetry / depth raster
- shoreline mask
- reef / shallow-water classification
- coordinate transform into local simulation coordinates
- mesh/heightfield generation
- LOD/chunk strategy

Real data should improve an already-working game, not become the first blocker.

## 9. First Gameplay Loop
**Harbour Run**

1. Player spawns beside a small centre-console/skiff.
2. HUD objective: `Take the boat out.`
3. Player boards and starts engine.
4. Marker appears near a shallow reef/cove.
5. Player navigates out of harbour and through a deeper channel.
6. At the marker: `Stop engine — enter water.`
7. Player swims down to a reef/objective.
8. Inspect or collect a simple marker/object.
9. Return to boat and dock.

This loop tests every foundation system without adding unnecessary scope.

## 10. UI / HUD
Minimal, cinematic and readable.

Default HUD:
- small circular minimap
- current objective
- contextual interaction prompt
- boat speed while at helm
- optional depth reading

No dense dashboard in Explore Mode.

Later modes can expose richer data.

## 11. Future Modes
### Explore Mode
First-person island, boating, swimming, diving and discovery.

### Marine Mode
Fishing, reef exploration, wrecks, species, navigation and boat progression.

### God’s Eye Mode
Free-flight 3D Bermuda spatial environment.

### Live Mode
Optional real-world feeds such as AIS, weather and marine observations.

### History Mode
Historical wrecks, storms, coastlines and contextual storytelling.

All modes should ultimately share one Bermuda world model.

## 12. Performance Targets
### Desktop target
- 60 fps target on capable modern GPU
- dynamic resolution fallback

### Mobile/iPhone target
- 30 fps minimum target for supported devices
- reduced volumetric/cloud quality
- reduced vegetation density
- reduced reflection/post-processing cost
- touch-first steering and movement
- adaptive render scale

Mobile is not an afterthought because Bermuda Simulator should be something a person can open from a URL and immediately show someone.

## 13. Milestones
### M0 — Upstream Proof
Tidewater fork/source builds unchanged and deploys publicly.

### M1 — Bermuda Identity Pass
Loading shell, palette, architecture kit, vegetation and harbour composition clearly read as Bermuda.

### M2 — Playable Harbour Run
Dock → boat → reef/cove → swim → return loop works end-to-end.

### M3 — Real Geography Prototype
One real Bermuda geographic sector is imported successfully.

### M4 — Expanded Marine Gameplay
Fishing/diving/wreck exploration and progression.

### M5 — Ocean Brain Bridge
Introduce God’s Eye / live-data mode without compromising Explore Mode.

## 14. Definition of Done for v0.1
v0.1 is done when a new person can open a public URL, enter the world without instructions, recognize the Bermuda inspiration, board the boat, navigate to the reef/cove, swim underwater, return, and want to explore further.

The benchmark is not feature count. The benchmark is whether the world feels coherent, beautiful and worth inhabiting.
