// Focused Bermuda Simulator gameplay QA fixes that sit on top of the existing boat/player systems.
// Keep this layer small: the underlying BoatController remains authoritative for physics.

export function installBermudaGameplayQA( app ) {

	if ( ! app || app.__bermudaGameplayQAInstalled ) return;
	app.__bermudaGameplayQAInstalled = true;

	const boat = app.boatCtl;
	if ( ! boat ) return;

	// Compatibility entry point for older call sites and future mission code. There must be one
	// authoritative anchor state: BoatController.anchored.
	boat.setAnchorState = ( on ) => {

		if ( on ) {

			if ( boat.anchored ) return true;
			return boat.toggleAnchor();

		}
		if ( ! boat.anchored ) return false;
		return boat.raiseAnchor();

	};

	// A recovery-to-berth must also clear an old anchor. Previously reset() could move the boat to
	// the dock while leaving anchored=true, after which the next anchored update could pull it back
	// to the stale offshore anchor position.
	const baseReset = boat.reset.bind( boat );
	boat.reset = ( ...args ) => {

		boat.anchored = false;
		const result = baseReset( ...args );
		boat.anchorPosition.copy( boat.position );
		boat.anchorHeading = boat.getYaw();
		return result;

	};

	// Make anchoring explicit and visible to the player. The existing HUD/minimap already consumes
	// boat.anchored and boat.position; these toasts confirm the state transition on desktop and mobile.
	const baseToggleAnchor = boat.toggleAnchor.bind( boat );
	boat.toggleAnchor = () => {

		const result = baseToggleAnchor();
		if ( app.game?.toast ) {

			app.game.toast(
				boat.anchored
					? 'Anchor down · boat will remain here while you swim or dive'
					: 'Anchor up · ready to get underway',
				boat.anchored ? 3200 : 2200
			);

		}
		return result;

	};

	// Do not silently raise the anchor merely because forward/reverse is pressed. Deliberate K/Anchor
	// input is required; this prevents an anchored dive boat from being released by an accidental
	// throttle touch when the player returns to the helm.
	const baseRaiseAnchor = boat.raiseAnchor.bind( boat );
	boat.raiseAnchor = () => {

		const input = app.input;
		const throttleHeld = !! ( input && ( input.down( 'KeyW' ) || input.down( 'KeyS' ) ) );
		const anchorControlHeld = !! ( input && input.down( 'KeyK' ) );
		if ( boat.anchored && throttleHeld && ! anchorControlHeld ) {

			if ( app.game?.toast ) {

				const now = performance.now();
				if ( ! boat.__anchorReminderAt || now - boat.__anchorReminderAt > 1800 ) {

					boat.__anchorReminderAt = now;
					app.game.toast( 'Anchor is down · use ANCHOR / K to raise it', 1700 );

				}

			}
			return false;

		}
		return baseRaiseAnchor();

	};

	window.__bermudaGameplayQA = {
		boat,
		get anchored() { return boat.anchored; },
		get boatPosition() { return { x: boat.position.x, y: boat.position.y, z: boat.position.z }; },
	};

}
