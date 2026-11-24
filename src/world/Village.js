import { Group } from '../engine/index.js';
import { createVillageMaterials } from './village/VillageMaterials.js';
import { VillageTextures } from './village/TextureBaker.js';

// Compatibility shell for the removed legacy Tidewater village.
// Preserve the runtime API used by the rest of the world while constructing
// none of the non-Bermudian village/stilt-house/pier geometry.
export class Village {

	constructor( { scene } ) {

		this.scene = scene;
		this.group = new Group();
		this.group.name = 'Village';
		this.lights = [];
		this.lightSources = [];
		this.footprints = [];
		this.foundationChecks = [];
		this.buildings = [];
		this.sidePaths = [];
		this.path = null;
		this.pierInfo = null;

		// This compatibility village has no geometry. Do not allocate and bake
		// the old Tidewater texture atlas while loading Bermuda's live ocean.
		// Lazily construct legacy materials only if a consumer explicitly needs them.
		this._textures = null;
		this._materials = null;

		this.B = null;
		this.harbor = null;
		this.town = null;
		this.inst = null;
		scene.add( this.group );

	}

	get textures() {
		return this._textures || ( this._textures = new VillageTextures() );
	}
	get materials() {
		return this._materials || ( this._materials = createVillageMaterials( this.textures ) );
	}

	getFootprints() { return this.footprints; }
	getFoundationChecks() { return this.foundationChecks; }
	getBuildings() { return this.buildings; }
	getSidePaths() { return this.sidePaths; }
	getPierInfo() { return this.pierInfo; }
	getLightSources() { return this.lightSources; }
	getLights() { return this.lights; }
	update() {}

}
