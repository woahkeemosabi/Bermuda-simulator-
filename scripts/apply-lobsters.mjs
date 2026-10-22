import fs from 'node:fs';

function read( path ) { return fs.readFileSync( path, 'utf8' ); }
function write( path, text ) { fs.writeFileSync( path, text ); }
function replaceOnce( text, before, after, label ) {
	if ( text.includes( after ) ) return text;
	if ( ! text.includes( before ) ) throw new Error( `lobster patch failed: ${ label }` );
	return text.replace( before, after );
}

// ---- FishTable: persistent inventory / value metadata. No habitat weight means rod fishing never rolls it.
{
	const path = 'src/game/FishTable.js';
	let s = read( path );
	if ( ! s.includes( 'spinyLobster:' ) ) {
		const marker = '\n};\n\nexport const FISH_IDS';
		const entry = "\n\tspinyLobster: { name: 'Caribbean spiny lobster', sci: 'Panulirus argus', lw: [ 0.01, 3.0 ], model: 'lobster', habitat: {}, kg: [ 0.5, 3.5 ], price: 22, fight: 0, stamina: 0, time: 'night', rarity: 0 },";
		if ( ! s.includes( marker ) ) throw new Error( 'lobster patch failed: FishTable end marker' );
		s = s.replace( marker, entry + marker );
	}
	write( path, s );
}

// ---- GameState: allow world catches to provide a measured length instead of deriving one from weight.
{
	const path = 'src/game/GameState.js';
	let s = read( path );
	s = replaceOnce(
		s,
		'addFish( species, kg, timeOfDay = 12 ) {',
		'addFish( species, kg, timeOfDay = 12, cmOverride = null ) {',
		'GameState addFish signature',
	);
	s = replaceOnce(
		s,
		'const cm = Math.round( fishLengthCm( species, kg ) );',
		'const cm = Number.isFinite( cmOverride ) ? Math.round( cmOverride ) : Math.round( fishLengthCm( species, kg ) );',
		'GameState measured length',
	);
	write( path, s );
}

// ---- Game: instantiate the physical lobster population and route underwater ACT to grabbing at close range.
{
	const path = 'src/game/Game.js';
	let s = read( path );
	s = replaceOnce(
		s,
		"import { Guide } from './Guide.js';",
		"import { Guide } from './Guide.js';\nimport { Lobsters } from './Lobsters.js';",
		'Game lobster import',
	);
	s = replaceOnce(
		s,
		"\t\tthis.chandlery = new Chandlery( { scene: app.scene, terrain: app.terrainData, colliders: app.colliders, material: this.stand.material } );\n\t\tthis.vendors = [ this.stand.vendor, this.chandlery.vendor ];",
		"\t\tthis.chandlery = new Chandlery( { scene: app.scene, terrain: app.terrainData, colliders: app.colliders, material: this.stand.material } );\n\t\tthis.lobsters = new Lobsters( { scene: app.scene, terrain: app.terrainData, reef: app.reef } );\n\t\tthis.vendors = [ this.stand.vendor, this.chandlery.vendor ];",
		'Game lobster world construction',
	);
	s = replaceOnce(
		s,
		"\t\tfor ( const [ id, f ] of Object.entries( FISH ) ) if ( ! this._spearByModel.has( f.model ) ) { this._spearByModel.set( f.model, id ); this._spearModels.add( f.model ); }\n\t\tthis.applyGear();",
		"\t\tfor ( const [ id, f ] of Object.entries( FISH ) ) if ( ! this._spearByModel.has( f.model ) ) { this._spearByModel.set( f.model, id ); this._spearModels.add( f.model ); }\n\t\tthis._lobsterTarget = null;\n\t\tthis.applyGear();",
		'Game lobster target state',
	);
	const oldAction = "\t\tthis._spearCooldown = Math.max( 0, this._spearCooldown - dt );\n\t\tconst diving = p.mode === 'swim' && ( p.diveDepth || 0 ) > 0.35;\n\t\tif ( diving && ! panelOpen && this._spearCooldown <= 0 && ( lDown || inp.hit( 'KeyE' ) ) ) this.fireSpear();";
	const newAction = "\t\tthis._spearCooldown = Math.max( 0, this._spearCooldown - dt );\n\t\tconst diving = p.mode === 'swim' && ( p.diveDepth || 0 ) > 0.35;\n\t\tif ( this.lobsters ) this.lobsters.update( dt, p, app.camera );\n\t\tthis._lobsterTarget = null;\n\t\tif ( diving && this.lobsters ) {\n\n\t\t\tp.getViewDir( this._spearDir ).normalize();\n\t\t\tthis._lobsterTarget = this.lobsters.target( app.camera.position, this._spearDir, 1.8 );\n\n\t\t}\n\t\tconst act = diving ? inp.hit( 'KeyE' ) : false;\n\t\tif ( diving && ! panelOpen && act && this._lobsterTarget ) this.grabLobster();\n\t\telse if ( diving && ! panelOpen && this._spearCooldown <= 0 && ( lDown || act ) ) this.fireSpear();";
	s = replaceOnce( s, oldAction, newAction, 'Game underwater action routing' );
	const oldPrompt = "\t\tif ( ! p.prompt && diving ) p.prompt = { key: 'E', text: 'Spear · aim at a fish and ACT' };\n\t\telse if ( ! p.prompt && can ) p.prompt = this.prompt();";
	const newPrompt = "\t\tif ( ! p.prompt && diving && this._lobsterTarget ) p.prompt = { key: 'E', text: 'Grab Caribbean spiny lobster' };\n\t\telse if ( ! p.prompt && diving ) p.prompt = { key: 'E', text: 'Spear · aim at a fish and ACT' };\n\t\telse if ( ! p.prompt && can ) p.prompt = this.prompt();";
	s = replaceOnce( s, oldPrompt, newPrompt, 'Game lobster prompt' );
	if ( ! s.includes( '\tgrabLobster() {' ) ) {
		const marker = "\n\t// Spear the fish actually under the reticle.";
		const method = `
\t// Close-range hand capture of the visible lobster under the reticle. It shares the cooler,
\t// persistence and fish-stand economy, but deliberately skips FishPortrait because lobsters use
\t// their own world geometry rather than a fish model.
\tgrabLobster() {

\t\tconst app = this.app;
\t\tif ( ! this.lobsters ) return false;
\t\tapp.player.getViewDir( this._spearDir ).normalize();
\t\tconst target = this.lobsters.target( app.camera.position, this._spearDir, 1.8 );
\t\tif ( ! target ) return false;
\t\tif ( ! this.state.fits( target.kg ) ) {

\t\t\tthis.toast( 'Cooler full · lobster left on the reef', 1800 );
\t\t\treturn false;

\t\t}
\t\tconst hit = this.lobsters.grab( app.camera.position, this._spearDir, 1.8 );
\t\tif ( ! hit ) return false;
\t\tconst kept = this.state.addFish( 'spinyLobster', hit.kg, app.settings?.timeOfDay ?? 12, hit.cm );
\t\tif ( ! kept ) {

\t\t\tthis.lobsters.restore( hit.id );
\t\t\tthis.toast( 'Lobster released', 1600 );
\t\t\treturn false;

\t\t}
\t\tthis.toast( \`Grabbed Caribbean spiny lobster · \${ hit.cm } cm · \${ hit.kg.toFixed( 2 ) } kg\`, 2600 );
\t\treturn true;

\t}
`;
		if ( ! s.includes( marker ) ) throw new Error( 'lobster patch failed: fireSpear marker' );
		s = s.replace( marker, method + marker );
	}
	write( path, s );
}

// ---- HUD copy: catches can now include lobster as well as fish.
{
	const path = 'src/game/GameHUD.js';
	let s = read( path );
	s = s.replace("${ s.inventory.length } fish · ${ s.holdKg.toFixed( 1 ) } of ${ s.stats.holdKg } kg · worth $${ s.holdValue }", "${ s.inventory.length } catch${ s.inventory.length === 1 ? '' : 'es' } · ${ s.holdKg.toFixed( 1 ) } of ${ s.stats.holdKg } kg · worth $${ s.holdValue }");
	s = s.replace('<b>Fish log</b><br>', '<b>Catch log</b><br>');
	s = s.replace('Come back when you\\\'ve got fish.', 'Come back when you\\\'ve got a catch.');
	write( path, s );
}

console.log( 'lobster gameplay integration applied' );
