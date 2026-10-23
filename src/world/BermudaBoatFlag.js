import { BoatMaterials } from './boat/BoatMaterials.js';

let installed = false;

function linearComponent( value ) {
	value /= 255;
	return value <= 0.04045 ? value / 12.92 : Math.pow( ( value + 0.055 ) / 1.055, 2.4 );
}

function colorVec( hex ) {
	const r = linearComponent( ( hex >> 16 ) & 255 );
	const g = linearComponent( ( hex >> 8 ) & 255 );
	const b = linearComponent( hex & 255 );
	return `vec3f( ${ r.toPrecision( 8 ) }, ${ g.toPrecision( 8 ) }, ${ b.toPrecision( 8 ) } )`;
}

// Replace only the pattern-2 flag-colour section in BoatMaterials. The cloth geometry and existing
// wind animation remain untouched, so the ensign still streams, droops and flutters with apparent
// wind; only the incorrect US artwork is replaced.
const BERMUDA_FLAG_WGSL = /* wgsl */`
	// Bermuda Red Ensign: red field, Union Jack at the hoist and a compact coat-of-arms mark on fly.
	let bermudaRed = ${ colorVec( 0xc8102e ) };
	let unionNavy = ${ colorVec( 0x012169 ) };
	let unionWhite = ${ colorVec( 0xffffff ) };
	let unionRed = ${ colorVec( 0xc8102e ) };

	let inUnion = step( u.x, 0.48 ) * step( 0.52, u.y );
	let cu = vec2f( u.x / 0.48, ( u.y - 0.52 ) / 0.48 );
	let dc = abs( cu - vec2f( 0.5 ) );
	let diagD = min( abs( cu.y - cu.x ), abs( cu.y + cu.x - 1.0 ) );
	let whiteDiag = boatInvstep( 0.075, 0.12, diagD );
	let redDiag = boatInvstep( 0.024, 0.052, diagD );
	let whiteCross = max( boatInvstep( 0.105, 0.135, dc.x ), boatInvstep( 0.105, 0.135, dc.y ) );
	let redCross = max( boatInvstep( 0.043, 0.064, dc.x ), boatInvstep( 0.043, 0.064, dc.y ) );
	var unionJack = unionNavy;
	unionJack = mix( unionJack, unionWhite, max( whiteDiag, whiteCross ) );
	unionJack = mix( unionJack, unionRed, max( redDiag, redCross ) );

	var flag = bermudaRed;
	flag = mix( flag, unionJack, inUnion );

	// At gameplay scale the full heraldic drawing would alias. A white shield with a red lion/wreck
	// silhouette preserves the Bermuda coat-of-arms read without a texture lookup or extra draw call.
	let shieldQ = vec2f( ( u.x - 0.73 ) / 0.115, ( u.y - 0.405 ) / 0.155 );
	let shieldRound = boatInvstep( 0.92, 1.05, length( shieldQ ) );
	let shieldTop = step( abs( u.x - 0.73 ), 0.115 ) * step( 0.405, u.y ) * step( u.y, 0.55 );
	let shield = max( shieldRound, shieldTop ) * step( 0.255, u.y ) * step( u.y, 0.565 );
	flag = mix( flag, ${ colorVec( 0xf7f4ec ) }, shield );

	let lionBody = step( abs( u.x - 0.73 ), 0.040 ) * step( 0.405, u.y ) * step( u.y, 0.495 );
	let lionArm = boatInvstep( 0.006, 0.018, abs( u.y - 0.462 ) ) * step( 0.665, u.x ) * step( u.x, 0.795 );
	let wreckHull = boatInvstep( 0.006, 0.017, abs( u.y - 0.335 ) ) * step( 0.660, u.x ) * step( u.x, 0.800 );
	let crest = shield * max( max( lionBody, lionArm ), wreckHull );
	flag = mix( flag, ${ colorVec( 0xc8102e ) }, crest );
`;

export function installBermudaBoatFlag() {
	if ( installed ) return;
	installed = true;
	const original = BoatMaterials.prototype.createFittings;
	if ( typeof original !== 'function' ) return;

	BoatMaterials.prototype.createFittings = function bermudaCreateFittings( ...args ) {
		const material = original.apply( this, args );
		const source = material?.surface;
		if ( typeof source !== 'string' ) return material;
		const start = source.indexOf( '\tlet stripeIdx =' );
		const end = source.indexOf( '\n\n\tvar c =', start );
		if ( start < 0 || end <= start ) {
			console.warn( 'Bermuda flag shader hook could not find the legacy flag block.' );
			return material;
		}
		material.surface = source.slice( 0, start ) + BERMUDA_FLAG_WGSL + source.slice( end );
		return material;
	};
}
