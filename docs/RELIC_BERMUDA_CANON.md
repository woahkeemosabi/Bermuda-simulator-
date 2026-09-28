# RELIC x Bermuda Simulator canon

RELIC is part of **Bermuda Simulator / THE ISLAND**. It is not a separate visual demo and it must not replace the established Bermuda world.

## World identity to preserve

- Turquoise Bermuda shallows and ocean simulation.
- Timber waterfront/dock, limestone seawall and rock character.
- Pastel masonry buildings with dominant stepped white roofs.
- Dense subtropical planting/bougainvillea, hillside homes, marina/moorings and Bermuda landmark silhouettes.
- Existing fishing, spearfishing, lobster, swimming/diving, boat, Fish Market/Joe, Bait & Tackle/Martha, inventory/economy, markers, HUD/minimap and mobile controls.
- Do not reintroduce the removed generic stilt-village, shack, boardwalk or junk-clutter look.

## RELIC 001 visual rules

- Preserve the original low black hypercar silhouette.
- Dark obsidian/carbon surfaces, smoked canopy, restrained amber/gold details and thin rear red light blades.
- Aerolift uses **four compact underside lift chambers integrated into the chassis/wheel zones**.
- No external spider legs, wings, oversized pods, rocket/jet thrusters or obvious VTOL hardware.

## Story structure

The playable/cinematic route is:

**ROAD → AIR → OCEAN → UNDERGROUND**

1. **ROAD** — Bermuda pursuit / driving sequence through the island world.
2. **AIR** — Aerolift escape: road contact → 5–10 cm hover → higher hover → open-water flight.
3. **OCEAN** — storm/lightning failure drives Submersion and controlled ocean entry.
4. **UNDERGROUND** — concealed underwater tunnel → elevator transition → hidden dry chamber/vault beneath Bermuda.

Bermuda is the physical setting for this progression; RELIC technology should feel hidden within the island rather than pasted over it.

## Current integration pass

- RELIC 001 hero vehicle is installed in the Bermuda road/waterfront scene.
- Four integrated Aerolift chambers are represented under the chassis.
- Story anchors exist for ROAD, AIR, OCEAN and UNDERGROUND.
- A sparse underwater tunnel marker is discoverable through the existing diving world.
- A limestone-integrated vault mouth is placed on the headland as the dry-vault destination anchor.

## Next implementation work

- Replace the procedural hero car with the approved high-detail RELIC 001 model while keeping the same transform/API contract.
- Add drivable car physics and mobile driving controls without disturbing the boat controller.
- Implement Aerolift as a state transition on the same vehicle rather than a separate aircraft.
- Implement storm failure/Submersion and underwater vehicle movement.
- Turn the tunnel/vault anchors into traversable mission spaces and connect them through the story state machine.
- QA the full route on iPhone before merging each gameplay phase.
