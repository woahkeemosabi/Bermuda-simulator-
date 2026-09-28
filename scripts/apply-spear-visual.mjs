import fs from 'node:fs';

const path = 'src/game/Game.js';
let s = fs.readFileSync( path, 'utf8' );

function patch( before, after, label ) {
	if ( s.includes( after ) ) return;
	if ( ! s.includes( before ) ) throw new Error( `spear visual patch failed: ${ label }` );
	s = s.replace( before, after );
}

patch(
	"import { Lobsters } from './Lobsters.js';",
	"import { Lobsters } from './Lobsters.js';\nimport { Spear } from './Spear.js';",
	'import',
);

patch(
	"\t\tthis.lobsters = new Lobsters( { scene: app.scene, terrain: app.terrainData, reef: app.reef } );\n\t\tthis.vendors = [ this.stand.vendor, this.chandlery.vendor ];",
	"\t\tthis.lobsters = new Lobsters( { scene: app.scene, terrain: app.terrainData, reef: app.reef } );\n\t\tthis.spear = new Spear( { scene: app.scene, camera: app.camera } );\n\t\tthis.vendors = [ this.stand.vendor, this.chandlery.vendor ];",
	'constructor',
);

patch(
	"\t\tconst act = diving ? inp.hit( 'KeyE' ) : false;\n\t\tif ( diving && ! panelOpen && act && this._lobsterTarget ) this.grabLobster();",
	"\t\tconst swimSpeed = p.velocity ? Math.hypot( p.velocity.x, p.velocity.z ) : 0;\n\t\tif ( this.spear ) this.spear.update( dt, { visible: diving && ! panelOpen, moving: Math.min( 1, swimSpeed / 2 ) } );\n\t\tconst act = diving ? inp.hit( 'KeyE' ) : false;\n\t\tif ( diving && ! panelOpen && act && this._lobsterTarget ) this.grabLobster();",
	'per-frame update',
);

patch(
	"\tfireSpear() {\n\n\t\tthis._spearCooldown = 0.7;",
	"\tfireSpear() {\n\n\t\tthis._spearCooldown = 0.7;\n\t\tif ( this.spear ) this.spear.fire();",
	'fire animation',
);

fs.writeFileSync( path, s );
console.log( 'speargun visual integration applied' );
