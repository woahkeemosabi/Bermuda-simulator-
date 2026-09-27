import { Group } from '../engine/index.js';

// Minimal compatibility shell for the legacy Tidewater village.
// The Bermuda build no longer constructs the non-Bermudian stilt houses, cottages,
// boathouse or long wooden pier. Preserve the API expected by terrain/rocks/lights.
export class Village {

	constructor( { scene } ) {

		this.scene = scene;
		this.group = new Group();
		this.group.name = 'Village';
		this.lights = [];
		this.footprints = [];
		this.foundationChecks = [];
		this.buildings = [];
		this.sidePaths = [];
		this.path = null;
		this.pierInfo = null;
		this.textures = null;
		this.materials = null;
		this.B = null;
		this.harbor = null;
		this.town = null;
		this.inst = null;
		scene.add( this.group );

	}

	// Compatibility API used during world construction.
	getFootprints() {
		return this.footprints;
	}

	getFoundationChecks() {
		return this.foundationChecks;
	}

	getBuildings() {
		return this.buildings;
	}

	getSidePaths() {
		return this.sidePaths;
	}

	getPierInfo() {
		return this.pierInfo;
	}

	update() {}

}
