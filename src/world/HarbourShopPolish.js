import { BoxGeometry, Color, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, RoundedBoxGeometry, Vector3 } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';
import { FISH_MARKET, BAIT_TACKLE } from './bermuda/HarbourLayout.js';

// Small 5x7 bitmap alphabet for world-space shop signage. Spaces are deliberately retained so the
// two businesses read clearly from the dock and road rather than collapsing into an unreadable word.
const FONT = {
	A:[ '01110','10001','10001','11111','10001','10001','10001' ],
	B:[ '11110','10001','10001','11110','10001','10001','11110' ],
	C:[ '01111','10000','10000','10000','10000','10000','01111' ],
	E:[ '11111','10000','10000','11110','10000','10000','11111' ],
	F:[ '11111','10000','10000','11110','10000','10000','10000' ],
	H:[ '10001','10001','10001','11111','10001','10001','10001' ],
	I:[ '11111','00100','00100','00100','00100','00100','11111' ],
	J:[ '00111','00010','00010','00010','00010','10010','01100' ],
	K:[ '10001','10010','10100','11000','10100','10010','10001' ],
	L:[ '10000','10000','10000','10000','10000','10000','11111' ],
	M:[ '10001','11011','10101','10101','10001','10001','10001' ],
	O:[ '01110','10001','10001','10001','10001','10001','01110' ],
	R:[ '11110','10001','10001','11110','10100','10010','10001' ],
	S:[ '01111','10000','10000','01110','00001','00001','11110' ],
	T:[ '11111','00100','00100','00100','00100','00100','00100' ],
	"'":[ '00100','00100','00000','00000','00000','00000','00000' ],
	'&':[ '01100','10010','10100','01000','10101','10010','01101' ],
};

function material( name, color, roughness = 0.84, metalness = 0, emissive = 0x000000, extra = {} ) {
	return new Material( {
		name: `bermuda-shop-${ name }`, color, roughness, metalness, emissive,
		underwaterLighting: 'lite', localLightsCheap: false, receiveShadows: true, ...extra,
	} );
}

function add( parent, geo, mat, p, s, r = null, name = '' ) {
	const m = new Mesh( geo, mat );
	m.name = name;
	m.position.set( p[ 0 ], p[ 1 ], p[ 2 ] );
	m.scale.set( s[ 0 ], s[ 1 ], s[ 2 ] );
	if ( r ) m.rotation.set( r[ 0 ], r[ 1 ], r[ 2 ] );
	m.castShadow = true;
	m.receiveShadow = true;
	parent.add( m );
	return m;
}

function localToWorld( shop, lx, ly, lz ) {
	const c = Math.cos( shop.yaw ), s = Math.sin( shop.yaw );
	return new Vector3( shop.x + lx * c + lz * s, shop.baseY + ly, shop.z - lx * s + lz * c );
}

function addCollider( app, shop, lx, ly, lz, w, h, d, tag ) {
	if ( ! app.colliders ) return;
	app.colliders.addBox( localToWorld( shop, lx, ly, lz ), new Vector3( w * .5, h * .5, d * .5 ), shop.yaw, { tag } );
}

function pixelSign( parent, text, geo, mat, y, z, maxWidth ) {
	const chars = text.split( '' ).filter( c => c === ' ' || FONT[ c ] );
	let pixels = 0;
	for ( const ch of chars ) {
		if ( ! FONT[ ch ] ) continue;
		for ( const row of FONT[ ch ] ) for ( const bit of row ) if ( bit === '1' ) pixels ++;
	}
	if ( ! pixels ) return null;
	const inst = new InstancedMesh( geo, mat, pixels );
	const cell = Math.min( .055, maxWidth / Math.max( 1, chars.length * 6 ) );
	const total = chars.length * 6 * cell - cell;
	const matrix = new Matrix4();
	let n = 0;
	for ( let ci = 0; ci < chars.length; ci ++ ) {
		const pattern = FONT[ chars[ ci ] ];
		if ( ! pattern ) continue;
		for ( let row = 0; row < 7; row ++ ) for ( let col = 0; col < 5; col ++ ) {
			if ( pattern[ row ][ col ] !== '1' ) continue;
			const x = - total * .5 + ( ci * 6 + col ) * cell;
			const py = y + ( 3 - row ) * cell;
			matrix.makeScale( cell * .78, cell * .78, .022 ).setPosition( x, py, z );
			inst.setMatrixAt( n ++, matrix );
		}
	}
	inst.instanceMatrix.needsUpdate = true;
	inst.computeBoundingSphere();
	inst.castShadow = false;
	parent.add( inst );
	return inst;
}

function buildShopIdentity( app, root, shop, options, materials, geo ) {
	const g = new Group();
	g.name = options.name;
	g.position.set( shop.x, shop.baseY, shop.z );
	g.rotation.y = shop.yaw;
	root.add( g );

	// The Meshy shop GLBs remain the visible buildings. This pass now supplies only the identity layer,
	// lighting and collision instead of wrapping those assets in another procedural kiosk shell.
	const w = shop.width + .36, d = shop.depth + .34;
	const frontZ = d * .5;
	const wallH = 2.12;
	const backZ = - d * .5;

	add( g, geo.box, options.accent, [ 0, 2.34, frontZ + .205 ], [ w * .95, .70, .075 ], null, `${ options.name }-sign` );
	pixelSign( g, options.lines[ 0 ], geo.box, materials.letters, 2.48, frontZ + .255, w * .78 );
	pixelSign( g, options.lines[ 1 ], geo.box, materials.letters, 2.17, frontZ + .255, w * .82 );
	add( g, geo.box, materials.awning, [ 0, 1.98, frontZ + .47 ], [ w * .84, .065, .70 ], [ .10, 0, 0 ], `${ options.name }-awning` );

	for ( const x of [ -w * .31, w * .31 ] ) {
		add( g, geo.cyl, materials.metal, [ x, 1.94, frontZ + .34 ], [ .045, .14, .045 ], [ Math.PI * .5, 0, 0 ], `${ options.name }-lamp-arm` );
		add( g, geo.rounded, materials.lamp, [ x, 1.87, frontZ + .42 ], [ .13, .08, .13 ], null, `${ options.name }-lamp` );
	}

	// One real local light per facade creates a useful pool on the dock without consuming all eight
	// mobile local-light slots with duplicate bulbs.
	if ( app.localLights ) {
		app.localLights.add( {
			position: localToWorld( shop, 0, 1.88, frontZ + .62 ),
			color: new Color( 1.0, .72, .42 ), intensity: 18, range: 12,
			kind: 'harbour-shop', flicker: .025,
		} );
	}

	// Preserve collision even though the procedural visual shell is gone. These three thin walls and
	// the service counter match the kiosk footprint and do not close the pedestrian lane.
	addCollider( app, shop, 0, wallH * .5, backZ + .09, w, wallH, .18, `${ options.name }-wall` );
	addCollider( app, shop, -w * .5 + .09, wallH * .5, 0, .18, wallH, d, `${ options.name }-wall` );
	addCollider( app, shop, w * .5 - .09, wallH * .5, 0, .18, wallH, d, `${ options.name }-wall` );
	addCollider( app, shop, 0, .43, frontZ - .04, w, .86, .22, `${ options.name }-counter` );
	return g;
}

export function installHarbourShopPolish( app ) {
	if ( ! app?.scene || app.harbourShopPolish ) return app?.harbourShopPolish;
	const root = new Group();
	root.name = 'BermudaHarbourShopIdentity';
	app.scene.add( root );

	const M = {
		letters: material( 'sign-letters', 0xf7f2df, .48, .04, 0x15120d ),
		metal: material( 'lamp-metal', 0x35434a, .30, .80 ),
		lamp: material( 'lamp', 0xffd59a, .18, .12, 0xff9e48 ),
		awning: material( 'awning', 0xf1eadb, .78, .02 ),
	};
	const geo = {
		box: new BoxGeometry( 1, 1, 1 ),
		cyl: new CylinderGeometry( 1, 1, 1, 12 ),
		rounded: new RoundedBoxGeometry( 1, 1, 1, 2, .10 ),
	};

	// Correct canonical mapping: Martha runs Bait & Tackle; Joe runs the Fish Market.
	const martha = buildShopIdentity( app, root, BAIT_TACKLE, {
		name: 'martha-bait-tackle-identity', lines: [ "MARTHA'S", 'BAIT & TACKLE' ], accent: material( 'martha-sign', 0x234d58, .68 ),
	}, M, geo );
	const joe = buildShopIdentity( app, root, FISH_MARKET, {
		name: 'joe-fish-market-identity', lines: [ "JOE'S", 'FISH MARKET' ], accent: material( 'joe-sign', 0x7b3941, .68 ),
	}, M, geo );

	app.harbourShopPolish = { root, martha, joe };
	return app.harbourShopPolish;
}
