# Bermuda Simulator — V1 Game Bible

This file is the canonical source of truth for the Bermuda Simulator V1 progression, mission slate, world fantasy and 3D asset plan. Future implementation should preserve completed systems and extend this plan rather than replacing it with disconnected features.

## Core fantasy

Build a life in Bermuda from almost nothing:

**Explore → Work → Earn → Upgrade → Own → Unlock → Discover**

The player starts with a pedal bicycle, basic fishing/diving equipment and little cash. Fishing, diving, deliveries, marine work and relationships lead to boat ownership, property, better vehicles, island reputation and finally the RELIC mystery.

RELIC is a story payoff. It must not feel like free starting equipment.

## V1 progression ladder

Pedal bicycle → scooter / practical transport → starter lobster boat → boat upgrades → Harbour Cottage → improved/waterfront property + garage/private berth → premium vehicles → RELIC discovery → RELIC ownership.

Progress is persistent and tied to PlayerState / cloud account when the backend is active.

## Main campaign — 15 progression missions

### ACT I — Build a Life

1. **First Day** — Start with the bicycle and small cash reserve. Martha gives the player a physical parcel for Joe. Teaches movement, bicycle use, NPC interaction, missions and money.
2. **Proper Money** — Martha explains that legal fishing can earn real money. Catch a legal fish/lobster and sell it to Joe.
3. **Spiny Business** — Hand-catch three legal Caribbean/Bermuda spiny lobsters. Introduces diving/lobster work and marine legality.
4. **The First Boat** — Save for, inspect and purchase the starter lobster boat. First major ownership milestone.
5. **Three Waters** — Land one shallows fish, one reef fish and one offshore fish. Proves the player understands Bermuda waters.

### ACT II — Become Part of the Island

6. **Reef Table** — Provide a snapper, hogfish and red hind. Establishes reef-species knowledge and mixed catch gameplay.
7. **Loose Weather** — A squall approaches. Secure the player's boat and help the harbour prepare. Uses live weather, anchoring/mooring and reputation.
8. **After Dark** — Night boat trip for tarpon. Requires navigation lights and night fishing.
9. **Leave It Living** — Encounter a protected reef fish and release it. Reinforces stewardship rather than treating all wildlife as loot.
10. **Keys to the Cottage** — Reach the money/reputation threshold and purchase Harbour Cottage. Introduces permanent home, storage, bed/time advancement and property ownership.

### ACT III — Something Is Wrong

11. **Black Car** — First serious RELIC sighting. A black vehicle appears briefly on a coastal road at night and leaves unusual tracks. No ownership and no giant exposition prompt.
12. **The Blue Hole** — A normal dive/recovery job leads to an artificial object embedded deeper in limestone. Recover or scan an unfamiliar component without identifying RELIC yet.
13. **Strange Signal** — Promote the existing Strange Signal side-quest concept into the main campaign bridge. Investigate intermittent underwater light/signal activity after dark.
14. **The Limestone Door** — Sonar/diving reveal the underwater tunnel and hidden access system. Navigate the cave and discover the elevator/facility.
15. **The Road Was Never the Test** — Enter the Red Room and drive RELIC 001 for the first time. V1 finale. ROAD becomes fully available; HOVER/AIR/OCEAN/UNDERGROUND mastery can continue after the ending rather than being dumped on the player immediately.

## Substantial side quests — 6

1. **Ghost Line** — Dive and remove lost fishing line/netting from the reef.
2. **Lost Camera** — Recover a diver's lost underwater camera and return it.
3. **Blue Water Call** — Land mahi-mahi and wahoo offshore.
4. **Island Table** — Supply yellowtail snapper, hogfish, red hind and spiny lobster for a harbour gathering.
5. **Harbour Before Dark** — Complete a reef check and return before night.
6. **Mooring 17** — Replaces Strange Signal as a side quest after Strange Signal is promoted to the main campaign. An apparently occupied mooring appears on sonar at night although nothing is visible at the surface. This is a subtle mystery breadcrumb, not a direct RELIC reveal.

## Mini missions / Harbour Jobs — 24

1. Bait Bucket
2. Snapper Order
3. Hogfish Special
4. Red Hind Order
5. Lobster Pair
6. Yellowtail at Dusk
7. Night Tarpon
8. Mahi Call
9. Wahoo Run
10. Tuna on Ice
11. Jack Run
12. Rainy Bite
13. Reef Release
14. Market Cash
15. Market Crate
16. Lobster Market
17. Dock Run
18. Harbour Patrol
19. Reef Check
20. Night Buoy
21. First Light
22. Storm Ready
23. Chandlery Stock
24. Fuel Up

Mini missions should remain short, usually 1–5 minutes, rotate based on player capability/time/weather, remember recent completions, and emerge from existing gameplay rather than loading separate arcade minigames.

## Mission presentation

The island should create situations, not only menus:

- Joe or Martha can call the player over.
- Dock workers can wave or point.
- Boat horns, navigation lights, working birds and storm activity can create opportunities.
- NPC comments change with weather/time/reputation.
- Jobs use real fish, lobster, diving, boats, anchoring, purchases, property and travel.
- Some jobs vary through weather/time changes while active.
- RELIC breadcrumbs remain rare and deliberate.

## Existing systems to preserve

Do not rebuild working systems merely because a new progression layer is added. Preserve and integrate:

- fishing and Bermuda-style species
- spiny lobster diving/capture
- underwater spearfishing
- boat anchoring/mooring/persistence
- visible boat upgrades
- day/night/weather
- Martha shop and Joe fish market
- reputation
- property ownership
- vehicle persistence
- Harbour Jobs
- current RELIC ROAD/HOVER/AIR/SUB controller functionality for development/testing until story gating is intentionally enabled

## Character presentation requirement

Target: believable third-person characters approaching the 54-second gameplay reference rather than segmented/stick proxies.

Acceptance requirements:

- no procedural stick-figure visible when a production character is available
- no root-motion fighting PlayerController
- no foot skating at route turnarounds
- no 180-degree snapping
- no clothing/body inflation or skinning explosions while walking/running/swimming
- stable waterline/orientation while swimming
- NPCs can idle, walk and perform simple contextual actions cleanly on iPhone
- character animation is visually tested on device; CI/build success alone is not acceptance

## 3D production plan (Meshy)

Do not make one unique model per mission. Build a reusable asset library.

### Priority A — Characters

- dedicated Martha model
- dedicated Joe model
- 4–6 additional reusable Bermuda residents: fisherman, fisherwoman, dock/marine worker, older resident, young adult, tourist/diver/shop customer
- shared animation library where possible
- custom actions only where needed: wave/call player over, point, carry parcel/crate, inspect fish, sit/lean, work on boat, umbrella/weather reaction
- do not spend on more characters until the current skinning/clothing and locomotion pipeline passes device QA

### Priority B — Mission props

- lost underwater camera
- ghost fishing-line/net bundle
- bait bucket
- fish/lobster crates and coolers
- dive gear / marine toolbox
- mooring hardware
- navigation buoy variants
- underwater signal beacon
- strange recovered component

### Priority C — Property/interior kit

- Bermuda home furniture
- bed / wardrobe / storage chest
- shelves / kitchen pieces
- garage equipment
- dock furniture / private berth accessories

### Priority D — Mystery / facility

- underwater signal hardware
- limestone-door mechanism
- cave/elevator platform
- hidden-facility machinery
- Vault Console supporting pieces

### Priority E — RELIC

RELIC 001 should ultimately be regenerated/refined from dedicated reference imagery / multiple consistent views rather than another text-only approximation. Preserve the canonical silhouette, Stormglass, Red Room and lighting signature.

## Performance rule

The user's iPhone has demonstrated that the desktop-quality world path can run well. Do not respond to every problem by globally downgrading the world.

Prefer:

- staggered/lazy heavy asset loading
- reuse decoded assets/materials
- avoid duplicate character textures/skins
- instancing
- LOD/remesh for background props
- culling
- pooled effects
- mobile-aware NPC counts

The gameplay/world quality can remain high while background/duplicate assets use efficient tiers.

## V1 completion target

Approximately **45 authored mission types**:

- 15 main/progression missions
- 6 substantial side quests
- 24 mini missions / Harbour Jobs

Plus recurring dynamic situations (storms, weather reactions, changing fish activity, etc.).

Mission count alone is not completion. V1 is complete when the campaign is playable end-to-end and the following pillars are visually and mechanically stable:

1. character movement/cameras
2. boat persistence/handling
3. fishing/lobster/diving
4. populated believable Bermuda environment
5. day/night/weather/world reactions
6. economy/property/ownership progression
7. RELIC mystery and finale
8. save/account continuity

## Reference hierarchy

1. `Bermuda_Simulator_Gameplay_54s.mp4` — authoritative benchmark for the whole simulator's visual quality, density, water, movement, atmosphere, camera and gameplay feel.
2. Dedicated RELIC references — authoritative for RELIC design, silhouette, proportions, Stormglass, Red Room and lighting signature.

For major visual work use:

**REFERENCE → CURRENT BUILD → DIFFERENCE → REQUIRED FIX**

Do not call a visual stage complete merely because the underlying feature technically exists.
