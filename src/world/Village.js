import { Group } from '../engine/index.js';
import { createVillageMaterials } from './village/VillageMaterials.js';
import { VillageTextures } from './village/TextureBaker.js';

// Minimal compatibility shell for the removed legacy Tidewater village.
// Keep the shared material API because other world systems still reference
// village.materials.*, but do not construct any of the non-Bermudian village geometry.
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

		// Compatibility resources only. These preserve consumers of materials.wood,
		// materials.hard, etc. while leaving all legacy village meshes unbuilt.
		this.textures = new VillageTextures();
		this.materials = createVillageMaterials( this.textures );

		this.B = null;
		this.harbor = null;
		this.town = null;
		this.inst = null;
		scene.add( this.group );

	}

	getFootprints() { return this.footprints; }
	getFoundationChecks() { return this.foundationChecks; }
	getBuildings() { return this.buildings; }
	getSidePaths() { return this.sidePaths; }
	getPierInfo() { return this.pierInfo; }
	update() {}

}
