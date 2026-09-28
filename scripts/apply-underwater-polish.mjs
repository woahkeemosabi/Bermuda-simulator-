import fs from 'node:fs';

const read = ( path ) => fs.readFileSync( path, 'utf8' );
const write = ( path, text ) => fs.writeFileSync( path, text );

function replaceOnce( text, from, to, label ) {

	if ( text.includes( to ) ) return text;
	if ( ! text.includes( from ) ) throw new Error( `underwater polish: ${ label } anchor not found` );
	return text.replace( from, to );

}

// --------------------------------------------------------------------------- Spear
{

	const path = 'src/game/Spear.js';
	let s = read( path );
	if ( ! s.includes( 'UNDERWATER_POLISH_V1' ) ) {

		s = replaceOnce(
			s,
			"import { prepare, mergePrepared, box, cylinder, rod, torus, mat4 } from '../world/boat/GeoKit.js';\nimport { createPropMaterial } from './GameMaterials.js';",
			"import { prepare, mergePrepared, box, cylinder, rod, torus, sphere, mat4 } from '../world/boat/GeoKit.js';\nimport { createPropMaterial } from './GameMaterials.js';\nimport { standard } from '../materials/Materials.js';",
			'Spear imports',
		);

		s = replaceOnce(
			s,
			"const _rest = new Vector3( 0.29, - 0.29, - 0.73 );",
			"const _rest = new Vector3( 0.29, - 0.29, - 0.73 );\nconst _fx = new Vector3();\n// UNDERWATER_POLISH_V1: physical grab hands, impact kick and world-space bubble bursts.",
			'Spear marker',
		);

		const classAnchor = "\nexport class Spear {\n";
		if ( ! s.includes( classAnchor ) ) throw new Error( 'underwater polish: Spear class anchor not found' );
		const gloves = `
function gloveGeometry() {

	const parts = [];
	const add = ( geometry, matrix = null, color = 0x11191d ) => parts.push( prepare( geometry, { color, rough: 0.82, metal: 0, matrix } ) );
	// Neoprene palm / cuff and four readable fingers. They are deliberately compact so they do not
	// obscure the target when they surge forward for a lobster grab.
	add( box( 0.12, 0.045, 0.17 ), mat4( 0, 0, - 0.03 ) );
	add( box( 0.105, 0.052, 0.105 ), mat4( 0, 0, 0.1 ), 0x172126 );
	for ( let i = 0; i < 4; i ++ ) {

		const x = ( i - 1.5 ) * 0.027;
		add( rod( new Vector3( x, 0, - 0.08 ), new Vector3( x * 1.06, 0.002, - 0.205 - Math.abs( i - 1.5 ) * 0.008 ), 0.012, 7, 0.009 ) );

	}
	add( rod( new Vector3( 0.055, - 0.004, 0.01 ), new Vector3( 0.105, - 0.006, - 0.085 ), 0.014, 7, 0.01 ), null, 0x172126 );
	return mergePrepared( parts );

}
`;
		s = s.replace( classAnchor, gloves + classAnchor );

		s = replaceOnce(
			s,
			"\t\tthis.root.add( this.body );\n\t\tthis.root.add( this.shaft );\n\n\t\tthis.visible = false;\n\t\tthis.shotT = 0;\n\t\tthis.swayT = 0;\n\t\tthis.kick = 0;\n\t\tthis.root.visible = false;",
			"\t\tthis.root.add( this.body );\n\t\tthis.root.add( this.shaft );\n\n\t\tconst gloveGeo = gloveGeometry();\n\t\tthis.handL = new Mesh( gloveGeo, this.material );\n\t\tthis.handR = new Mesh( gloveGeo, this.material );\n\t\tthis.handL.visible = this.handR.visible = false;\n\t\tthis.root.add( this.handL );\n\t\tthis.root.add( this.handR );\n\n\t\t// A tiny pooled world-space bubble effect makes spear impacts and close-range grabs readable\n\t\t// without allocating meshes during gameplay. The pool lives outside the camera-following root.\n\t\tthis.fxRoot = new Group();\n\t\tthis.fxRoot.name = 'UnderwaterHuntFX';\n\t\tscene.add( this.fxRoot );\n\t\tthis.bubbleMaterial = standard( { color: 0xc8f4ff, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.46, depthWrite: false } );\n\t\tconst bubbleGeo = sphere( 1, 8, 6 );\n\t\tthis.bubbles = [];\n\t\tfor ( let i = 0; i < 18; i ++ ) {\n\n\t\t\tconst mesh = new Mesh( bubbleGeo, this.bubbleMaterial );\n\t\t\tmesh.visible = false;\n\t\t\tthis.fxRoot.add( mesh );\n\t\t\tthis.bubbles.push( { mesh, velocity: new Vector3(), life: 0, age: 0, size: 0.03 } );\n\n\t\t}\n\t\tthis._bubbleCursor = 0;\n\t\tthis.visible = false;\n\t\tthis.shotT = 0;\n\t\tthis.grabT = 0;\n\t\tthis.impactT = 0;\n\t\tthis.swayT = 0;\n\t\tthis.kick = 0;\n\t\tthis.root.visible = false;",
			'Spear constructor',
		);

		const oldMethods = `	fire() {

		// Instant gameplay hit detection is handled by Game.fireSpear(); this supplies the visual
		// launch / recoil so the action has a readable first-person physical response.
		this.shotT = 0.34;
		this.kick = 1;

	}

	update( dt, { visible = false, moving = 0 } = {} ) {

		this.visible = visible;
		this.root.visible = visible;
		if ( ! visible ) {

			this.shotT = 0;
			this.kick = 0;
			return;

		}

		this.swayT += dt * ( 1.35 + Math.min( 1, moving ) * 1.5 );
		this.root.position.copy( this.camera.position );
		this.root.quaternion.copy( this.camera.quaternion );

		const swayX = Math.sin( this.swayT * 1.7 ) * 0.008;
		const swayY = Math.sin( this.swayT * 2.15 + 0.8 ) * 0.006;
		this.body.position.set( _rest.x + swayX, _rest.y + swayY, _rest.z + this.kick * 0.055 );

		if ( this.shotT > 0 ) {

			this.shotT = Math.max( 0, this.shotT - dt );
			const u = 1 - this.shotT / 0.34;
			// Shaft snaps forward in the first third, hangs at extension briefly, then visually reloads.
			let travel;
			if ( u < 0.28 ) travel = u / 0.28;
			else if ( u < 0.56 ) travel = 1;
			else travel = Math.max( 0, 1 - ( u - 0.56 ) / 0.44 );
			this.shaft.position.set( _rest.x + swayX, _rest.y + swayY + 0.052, _rest.z - travel * 1.05 );
			this.kick += ( 0 - this.kick ) * Math.min( 1, dt * 9 );

		} else {

			this.shaft.position.set( _rest.x + swayX, _rest.y + swayY + 0.052, _rest.z );
			this.kick += ( 0 - this.kick ) * Math.min( 1, dt * 12 );

		}

	}
`;
		const newMethods = `	fire() {

		// Instant gameplay hit detection is handled by Game.fireSpear(); this supplies the visual
		// launch / recoil so the action has a readable first-person physical response.
		this.shotT = 0.34;
		this.kick = 1;
		_fx.set( _rest.x, _rest.y + 0.055, _rest.z - 1.2 ).applyQuaternion( this.camera.quaternion ).add( this.camera.position );
		this.burst( _fx, 4, 0.45 );

	}

	burst( position, count = 8, strength = 1 ) {

		if ( ! position ) return;
		for ( let i = 0; i < count; i ++ ) {

			const b = this.bubbles[ this._bubbleCursor ++ % this.bubbles.length ];
			const a = Math.random() * Math.PI * 2, r = Math.random() * 0.08 * strength;
			b.mesh.position.set( position.x + Math.cos( a ) * r, position.y + ( Math.random() - 0.5 ) * 0.06, position.z + Math.sin( a ) * r );
			b.velocity.set( ( Math.random() - 0.5 ) * 0.16 * strength, 0.16 + Math.random() * 0.34 * strength, ( Math.random() - 0.5 ) * 0.16 * strength );
			b.life = 0.48 + Math.random() * 0.5;
			b.age = 0;
			b.size = 0.012 + Math.random() * 0.025 * strength;
			b.mesh.scale.setScalar( b.size );
			b.mesh.visible = true;

		}

	}

	impact( position, strength = 1 ) {

		this.impactT = 0.24;
		this.kick = Math.max( this.kick, 1.35 );
		this.burst( position, 11, strength );

	}

	grab( position = null ) {

		this.grabT = 0.72;
		this.shotT = 0;
		if ( position ) this.burst( position, 6, 0.7 );

	}

	updateBubbles( dt ) {

		for ( const b of this.bubbles ) {

			if ( b.life <= 0 ) continue;
			b.age += dt;
			b.life -= dt;
			if ( b.life <= 0 ) { b.mesh.visible = false; continue; }
			b.mesh.position.addScaledVector( b.velocity, dt );
			b.velocity.y += dt * 0.12;
			b.velocity.x *= Math.max( 0, 1 - dt * 0.8 );
			b.velocity.z *= Math.max( 0, 1 - dt * 0.8 );
			b.mesh.scale.setScalar( b.size * ( 1 + b.age * 0.32 ) );

		}

	}

	update( dt, { visible = false, moving = 0 } = {} ) {

		this.updateBubbles( dt );
		this.visible = visible;
		this.root.visible = visible;
		if ( ! visible ) {

			this.shotT = 0;
			this.grabT = 0;
			this.impactT = 0;
			this.kick = 0;
			this.handL.visible = this.handR.visible = false;
			return;

		}

		this.swayT += dt * ( 1.35 + Math.min( 1, moving ) * 1.5 );
		this.root.position.copy( this.camera.position );
		this.root.quaternion.copy( this.camera.quaternion );
		this.impactT = Math.max( 0, this.impactT - dt );

		const swayX = Math.sin( this.swayT * 1.7 ) * 0.008;
		const swayY = Math.sin( this.swayT * 2.15 + 0.8 ) * 0.006;
		const impactShake = this.impactT > 0 ? Math.sin( this.impactT * 92 ) * 0.012 * ( this.impactT / 0.24 ) : 0;

		if ( this.grabT > 0 ) {

			this.grabT = Math.max( 0, this.grabT - dt );
			const u = 1 - this.grabT / 0.72;
			const reach = Math.sin( Math.min( 1, u ) * Math.PI );
			const close = Math.sin( Math.min( 1, u ) * Math.PI * 2 ) * 0.025;
			this.handL.visible = this.handR.visible = true;
			this.handL.position.set( - 0.17 + close, - 0.2 + swayY, - 0.52 - reach * 0.78 );
			this.handR.position.set( 0.17 - close, - 0.2 + swayY, - 0.52 - reach * 0.78 );
			this.handL.rotation.set( - 0.16, - 0.12, - 0.16 );
			this.handR.rotation.set( - 0.16, 0.12, 0.16 );
			// Drop the gun out of the sight line while both hands reach for the animal.
			this.body.position.set( _rest.x + 0.18, _rest.y - reach * 0.42, _rest.z + reach * 0.12 );
			this.shaft.position.set( _rest.x + 0.18, _rest.y + 0.052 - reach * 0.42, _rest.z + reach * 0.12 );
			return;

		}

		this.handL.visible = this.handR.visible = false;
		this.body.position.set( _rest.x + swayX + impactShake, _rest.y + swayY, _rest.z + this.kick * 0.055 );

		if ( this.shotT > 0 ) {

			this.shotT = Math.max( 0, this.shotT - dt );
			const u = 1 - this.shotT / 0.34;
			// Shaft snaps forward in the first third, hangs at extension briefly, then visually reloads.
			let travel;
			if ( u < 0.28 ) travel = u / 0.28;
			else if ( u < 0.56 ) travel = 1;
			else travel = Math.max( 0, 1 - ( u - 0.56 ) / 0.44 );
			this.shaft.position.set( _rest.x + swayX + impactShake, _rest.y + swayY + 0.052, _rest.z - travel * 1.05 );
			this.kick += ( 0 - this.kick ) * Math.min( 1, dt * 9 );

		} else {

			this.shaft.position.set( _rest.x + swayX + impactShake, _rest.y + swayY + 0.052, _rest.z );
			this.kick += ( 0 - this.kick ) * Math.min( 1, dt * 12 );

		}

	}
`;
		if ( ! s.includes( oldMethods ) ) throw new Error( 'underwater polish: Spear methods anchor not found' );
		s = s.replace( oldMethods, newMethods );
		write( path, s );

	}

}

// --------------------------------------------------------------------------- Lobsters
{

	const path = 'src/game/Lobsters.js';
	let s = read( path );
	const from = "\t\treturn best ? { id: best.id, distance: bestT, cm: best.bodyCm, kg: best.kg } : null;";
	const to = "\t\treturn best ? { id: best.id, distance: bestT, cm: best.bodyCm, kg: best.kg, position: new Vector3( best.x, this.floorAt( best.x, best.z ) + 0.18 * best.size, best.z ) } : null;";
	s = replaceOnce( s, from, to, 'lobster hit position' );
	write( path, s );

}

// --------------------------------------------------------------------------- Fish hit reaction
{

	const path = 'src/world/Fish.js';
	let s = read( path );
	if ( ! s.includes( 'this.spearRespawn = new Float32Array' ) ) {

		s = replaceOnce(
			s,
			"\t\tthis.jump = new Float32Array( n ); // mullet: 0 swimming, 1 rising to the surface, 2 in the air",
			"\t\tthis.jump = new Float32Array( n ); // mullet: 0 swimming, 1 rising to the surface, 2 in the air\n\t\tthis.spearRespawn = new Float32Array( n ); // struck fish recoil briefly before returning to their home",
			'fish spear timer',
		);

		s = replaceOnce(
			s,
			"\t\t\tfor ( let i = g.offset; i < g.offset + g.count; i ++ ) {\n\n\t\t\t\tconst k = i * 3, rx = this.pos[ k ] - origin.x, ry = this.pos[ k + 1 ] - origin.y, rz = this.pos[ k + 2 ] - origin.z;",
			"\t\t\tfor ( let i = g.offset; i < g.offset + g.count; i ++ ) {\n\n\t\t\t\tif ( this.spearRespawn[ i ] > 0 ) continue;\n\t\t\t\tconst k = i * 3, rx = this.pos[ k ] - origin.x, ry = this.pos[ k + 1 ] - origin.y, rz = this.pos[ k + 2 ] - origin.z;",
			'fish hit exclusion',
		);

		const oldHit = `		const hit = { index: best, model: g.sp.model, length: L, distance: bestT, position: new THREE.Vector3( this.pos[ k ], this.pos[ k + 1 ], this.pos[ k + 2 ] ) };
		// Remove the struck individual from the immediate view and respawn it back at its home.
		const a = g.rng() * TAU, rr = 1.5 + g.rng() * Math.max( 1, g.zone.r * 0.7 );
		const x = g.home.x + Math.cos( a ) * rr, z = g.home.z + Math.sin( a ) * rr;
		const y = this.clampY( g.sp, x, z, g.home.y );
		this.pos.set( [ x, y, z ], k ); this.prev.set( [ x, y, z ], k );
		this.panic[ best ] = 1;
		return hit;`;
		const newHit = `		const hit = { index: best, model: g.sp.model, length: L, distance: bestT, position: new THREE.Vector3( this.pos[ k ], this.pos[ k + 1 ], this.pos[ k + 2 ] ) };
		// Give the struck fish a visible recoil instead of teleporting it on the impact frame. It is
		// non-targetable during this short reaction, then quietly respawns near its group's home.
		const kick = Math.max( 0.9, L * 3.4 );
		this.vel[ k ] = direction.x * kick;
		this.vel[ k + 1 ] = direction.y * kick + 0.12;
		this.vel[ k + 2 ] = direction.z * kick;
		this.panic[ best ] = 1;
		this.spearRespawn[ best ] = 0.42;
		g.alarm = Math.max( g.alarm, 3.5 );
		return hit;`;
		if ( ! s.includes( oldHit ) ) throw new Error( 'underwater polish: fish hit reaction anchor not found' );
		s = s.replace( oldHit, newHit );

		const loopAnchor = "\t\tlet any = false;\n\t\tfor ( const g of this.groups ) {\n\n\t\t\tconst was = g.active;";
		const loopReplace = `		let any = false;
		for ( const g of this.groups ) {

			// Finish a spear-hit reaction by placing the fish back near its normal home. Keeping the
			// timer in the shared fish state also prevents a single target from being harvested twice.
			for ( let i = g.offset; i < g.offset + g.count; i ++ ) if ( this.spearRespawn[ i ] > 0 ) {

				this.spearRespawn[ i ] -= dt;
				if ( this.spearRespawn[ i ] <= 0 ) {

					const a = g.rng() * TAU, rr = 1.5 + g.rng() * Math.max( 1, g.zone.r * 0.7 );
					const x = g.home.x + Math.cos( a ) * rr, z = g.home.z + Math.sin( a ) * rr;
					const y = this.clampY( g.sp, x, z, g.home.y );
					const k = i * 3;
					this.pos.set( [ x, y, z ], k ); this.prev.set( [ x, y, z ], k );
					const speed = g.sp.cruise * this.size[ i ];
					this.vel.set( [ Math.cos( a ) * speed, 0, Math.sin( a ) * speed ], k );
					this.panic[ i ] = 0;

				}

			}
			const was = g.active;`;
		if ( ! s.includes( loopAnchor ) ) throw new Error( 'underwater polish: fish update loop anchor not found' );
		s = s.replace( loopAnchor, loopReplace );
		write( path, s );

	}

}

// --------------------------------------------------------------------------- HUD underwater catch presentation
{

	const path = 'src/game/GameHUD.js';
	let s = read( path );
	if ( ! s.includes( '.gm-dive-catch {' ) ) {

		const cssAnchor = ".gm-row.has-cm { grid-template-columns: 1fr auto auto auto auto; }\n\n/* catch card:";
		const css = `.gm-row.has-cm { grid-template-columns: 1fr auto auto auto auto; }

/* compact underwater hunting confirmation: never blocks steering or the reticle */
.gm-dive-catch { position: absolute; left: 50%; top: max(calc(74 * var(--tw-u)), 12vh); transform: translate(-50%, -14px) scale(0.96);
	min-width: min(360px, 82vw); padding: calc(10 * var(--tw-u)) calc(18 * var(--tw-u)); border-radius: var(--tw-r-lg);
	background: linear-gradient(135deg, rgba(4,24,34,0.88), rgba(8,48,58,0.74)); border: 1px solid rgba(var(--tw-aqua-rgb),0.34);
	box-shadow: 0 14px 38px rgba(0,0,0,0.3), 0 0 24px rgba(var(--tw-aqua-rgb),0.12); text-align: center;
	font: 500 var(--tw-fs-md) var(--tw-font); color: var(--tw-ink); opacity: 0; pointer-events: none; }
.gm-dive-catch.is-on { animation: gm-dive-catch 3.1s var(--tw-ease) both; }
.gm-dive-catch-kicker { font-size: var(--tw-fs-sm); font-weight: 800; letter-spacing: 0.24em; color: var(--tw-aqua); }
.gm-dive-catch strong { display: block; margin-top: 3px; font-size: calc(18 * var(--tw-u)); }
.gm-dive-catch-meta { margin-top: 3px; font-family: var(--tw-mono); color: var(--tw-ink-2); }
.gm-dive-catch-status { margin-top: 4px; font-size: var(--tw-fs-sm); color: var(--tw-sun); }
.gm-dive-catch-status.is-release { color: var(--tw-coral); }
@keyframes gm-dive-catch { 0% { opacity: 0; transform: translate(-50%, -14px) scale(0.96); } 10%, 72% { opacity: 1; transform: translate(-50%, 0) scale(1); } 100% { opacity: 0; transform: translate(-50%, -6px) scale(0.99); } }

/* catch card:`;
		if ( ! s.includes( cssAnchor ) ) throw new Error( 'underwater polish: HUD CSS anchor not found' );
		s = s.replace( cssAnchor, css );

		s = replaceOnce(
			s,
			"\t\tthis.dot = h( 'div', 'gm-dot' );\n\t\tthis.catchScrim = h( 'div', 'gm-catch-scrim' );",
			"\t\tthis.dot = h( 'div', 'gm-dot' );\n\t\tthis.diveCatch = h( 'div', 'gm-dive-catch tw-glass' );\n\t\tthis.catchScrim = h( 'div', 'gm-catch-scrim' );",
			'HUD dive element',
		);
		s = replaceOnce(
			s,
			"\t\thud.append( this.catchScrim, this.purse, this.fight, this.bite, this.cast, this.dot, this.catchCard );",
			"\t\thud.append( this.catchScrim, this.purse, this.fight, this.bite, this.cast, this.dot, this.diveCatch, this.catchCard );",
			'HUD append',
		);

		const methodAnchor = "\n\t// ---- catch card\n";
		const diveMethod = `
	showDiveCatch( info, verb = 'SPEARED' ) {

		const f = FISH[ info.species ];
		if ( ! f || ! this.diveCatch ) return;
		let status = info.kept ? ( info.record ? 'NEW RECORD · STORED' : info.newSpecies ? 'NEW SPECIES · STORED' : 'STORED IN COOLER' ) : 'RELEASED';
		if ( info.protectedSpecies ) status = 'PROTECTED · RELEASED';
		else if ( info.legalSize === false ) status = 'UNDERSIZE · RELEASED';
		else if ( ! info.kept ) status = 'COOLER FULL · RELEASED';
		this.diveCatch.innerHTML = \
			\`<div class="gm-dive-catch-kicker">\${ verb }</div><strong>\${ f.name }</strong>\` +
			\`<div class="gm-dive-catch-meta">\${ info.cm } cm · \${ info.kg.toFixed( 2 ) } kg · $\${ info.value }</div>\` +
			\`<div class="gm-dive-catch-status \${ info.kept ? '' : 'is-release' }">\${ status }</div>\`;
		this.diveCatch.classList.remove( 'is-on' );
		void this.diveCatch.offsetWidth;
		this.diveCatch.classList.add( 'is-on' );

	}
`;
		if ( ! s.includes( methodAnchor ) ) throw new Error( 'underwater polish: HUD method anchor not found' );
		s = s.replace( methodAnchor, diveMethod + methodAnchor );
		write( path, s );

	}

}

// --------------------------------------------------------------------------- Game wiring
{

	const path = 'src/game/Game.js';
	let s = read( path );
	if ( ! s.includes( 'UNDERWATER_POLISH_V1' ) ) {

		s = replaceOnce(
			s,
			"\t\tthis._lobsterTarget = null;\n\t\tthis.applyGear();",
			"\t\tthis._lobsterTarget = null;\n\t\t// UNDERWATER_POLISH_V1: physical grab / impact feedback and non-blocking dive catch HUD.\n\t\tthis.applyGear();",
			'Game marker',
		);
		s = replaceOnce( s, "\t\t\taiming: rod.equipped,", "\t\t\taiming: rod.equipped || diving,", 'underwater reticle' );
		s = replaceOnce(
			s,
			"\t\tconst hit = this.lobsters.grab( app.camera.position, this._spearDir, 1.8 );\n\t\tif ( ! hit ) return false;\n\t\tconst kept = this.state.addFish( 'spinyLobster', hit.kg, app.settings?.timeOfDay ?? 12, hit.cm );",
			"\t\tconst hit = this.lobsters.grab( app.camera.position, this._spearDir, 1.8 );\n\t\tif ( ! hit ) return false;\n\t\tif ( this.spear ) this.spear.grab( hit.position );\n\t\tconst kept = this.state.addFish( 'spinyLobster', hit.kg, app.settings?.timeOfDay ?? 12, hit.cm );",
			'lobster grab animation',
		);
		s = replaceOnce(
			s,
			"\t\tthis.toast( `Grabbed Caribbean spiny lobster · ${ hit.cm } cm · ${ hit.kg.toFixed( 2 ) } kg`, 2600 );\n\t\treturn true;",
			"\t\tthis.toast( `Grabbed Caribbean spiny lobster · ${ hit.cm } cm · ${ hit.kg.toFixed( 2 ) } kg`, 1800 );\n\t\tif ( this.hud && this.state.lastCatch ) this.hud.showDiveCatch( this.state.lastCatch, 'HAND CAPTURE' );\n\t\treturn true;",
			'lobster catch HUD',
		);
		s = replaceOnce(
			s,
			"\t\tif ( ! hit ) { this.toast( 'Spear missed', 650 ); return; }\n\t\tconst species = this._spearByModel.get( hit.model );",
			"\t\tif ( ! hit ) { this.toast( 'Spear missed', 650 ); return; }\n\t\tif ( this.spear ) this.spear.impact( hit.position, 1 );\n\t\tconst species = this._spearByModel.get( hit.model );",
			'spear impact feedback',
		);
		s = replaceOnce(
			s,
			"\t\tif ( this.hud && info ) this.hud.showCatch( info, 5500 );",
			"\t\tif ( this.hud && info ) this.hud.showDiveCatch( info, 'SPEARED' );",
			'spear dive HUD',
		);
		write( path, s );

	}

}

console.log( 'underwater hunting polish applied' );
