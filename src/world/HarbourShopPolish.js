import { BoxGeometry, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, RoundedBoxGeometry, TorusGeometry, Vector3 } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';
import { FISH_MARKET, BAIT_TACKLE } from './bermuda/HarbourLayout.js';

const FONT = {
	A:[ '01110','10001','10001','11111','10001','10001','10001' ],
	E:[ '11111','10000','10000','11110','10000','10000','11111' ],
	H:[ '10001','10001','10001','11111','10001','10001','10001' ],
	J:[ '00111','00010','00010','00010','00010','10010','01100' ],
	M:[ '10001','11011','10101','10101','10001','10001','10001' ],
	O:[ '01110','10001','10001','10001','10001','10001','01110' ],
	R:[ '11110','10001','10001','11110','10100','10010','10001' ],
	T:[ '11111','00100','00100','00100','00100','00100','00100' ],
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
	const chars = text.split( '' ).filter( c => FONT[ c ] );
	let pixels = 0;
	for ( const ch of chars ) for ( const row of FONT[ ch ] ) for ( const bit of row ) if ( bit === '1' ) pixels ++;
	const inst = new InstancedMesh( geo, mat, pixels );
	const cell = Math.min( .055, maxWidth / Math.max( 1, chars.length * 6 ) );
	const total = chars.length * 6 * cell - cell;
	const matrix = new Matrix4();
	let n = 0;
	for ( let ci = 0; ci < chars.length; ci ++ ) {
		const pattern = FONT[ chars[ ci ] ];
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

function buildShop( app, root, shop, options, materials, geo ) {
	const g = new Group();
	g.name = options.name;
	g.position.set( shop.x, shop.baseY, shop.z );
	g.rotation.y = shop.yaw;
	root.add( g );

	const w = shop.width + .36, d = shop.depth + .34;
	const wallH = 2.12;
	const frontZ = d * .5;
	const backZ = - d * .5;

	// Opaque outer shell deliberately encloses the old generated GLB. The old asset can remain loaded
	// for safe fallback/gameplay data, but it no longer defines the visible proportions or facade.
	add( g, geo.box, options.wall, [ 0, wallH * .5, backZ + .09 ], [ w, wallH, .18 ], null, `${ options.name }-back-wall` );
	add( g, geo.box, options.wall, [ -w * .5 + .09, wallH * .5, 0 ], [ .18, wallH, d ], null, `${ options.name }-left-wall` );
	add( g, geo.box, options.wall, [ w * .5 - .09, wallH * .5, 0 ], [ .18, wallH, d ], null, `${ options.name }-right-wall` );
	add( g, geo.box, options.wall, [ 0, .43, frontZ - .04 ], [ w, .86, .18 ], null, `${ options.name }-front-base` );

	// Deep shaded service opening masks the original front face and creates actual visual depth.
	add( g, geo.box, materials.interior, [ 0, 1.38, frontZ - .13 ], [ w * .76, .94, .10 ], null, `${ options.name }-service-shadow` );
	add( g, geo.box, materials.wood, [ 0, .90, frontZ + .08 ], [ w * .88, .13, .42 ], null, `${ options.name }-counter` );
	add( g, geo.box, materials.trim, [ -w * .43, 1.43, frontZ + .015 ], [ .10, 1.10, .16 ], null, `${ options.name }-opening-trim-l` );
	add( g, geo.box, materials.trim, [ w * .43, 1.43, frontZ + .015 ], [ .10, 1.10, .16 ], null, `${ options.name }-opening-trim-r` );
	add( g, geo.box, materials.trim, [ 0, 1.94, frontZ + .015 ], [ w * .88, .10, .16 ], null, `${ options.name }-opening-trim-top` );

	// Side window with white reveal and a small Bermuda shutter detail.
	add( g, geo.box, materials.trim, [ -w * .5 - .015, 1.38, .12 ], [ .055, .90, .98 ], null, `${ options.name }-window-reveal` );
	add( g, geo.box, materials.glass, [ -w * .5 - .050, 1.38, .12 ], [ .035, .70, .76 ], null, `${ options.name }-window-glass` );
	for ( const z of [ -.42, .66 ] ) add( g, geo.box, options.accent, [ -w * .5 - .075, 1.38, z ], [ .035, .76, .18 ], null, `${ options.name }-shutter` );

	// Four broad white roof courses reproduce Bermuda's stepped limestone roof language at a scale that
	// reads clearly from the dock and road. Large overhang gives the tiny kiosks believable shelter.
	const roofY = 2.18;
	for ( let i = 0; i < 4; i ++ ) {
		const inset = i * .22;
		add( g, geo.box, materials.roof, [ 0, roofY + i * .17, -.03 ], [ w + .66 - inset, .18, d + .70 - inset * .82 ], null, `${ options.name }-roof-${ i }` );
	}
	add( g, geo.box, materials.roof, [ 0, roofY + .71, -.03 ], [ w * .38, .13, d * .36 ], null, `${ options.name }-roof-cap` );

	// Proper fascia and rain hood instead of a flat box frontage.
	add( g, geo.box, options.accent, [ 0, 2.05, frontZ + .10 ], [ w * .95, .26, .16 ], null, `${ options.name }-fascia` );
	add( g, geo.box, materials.awning, [ 0, 1.98, frontZ + .48 ], [ w * .86, .075, .78 ], [ .10, 0, 0 ], `${ options.name }-awning` );
	add( g, geo.box, materials.sign, [ 0, 2.25, frontZ + .205 ], [ w * .74, .43, .075 ], null, `${ options.name }-sign` );
	pixelSign( g, options.label, geo.box, materials.letters, 2.25, frontZ + .255, w * .60 );

	// Warm dock light pools make both kiosks useful visual landmarks at dusk/night.
	for ( const x of [ -w * .31, w * .31 ] ) {
		add( g, geo.cyl, materials.metal, [ x, 1.93, frontZ + .35 ], [ .055, .15, .055 ], [ Math.PI * .5, 0, 0 ], `${ options.name }-lamp-arm` );
		add( g, geo.rounded, materials.lamp, [ x, 1.86, frontZ + .42 ], [ .13, .08, .13 ], null, `${ options.name }-lamp` );
	}

	if ( options.kind === 'fish' ) {
		// Ice/display boxes and simple silver fish forms on the service counter.
		add( g, geo.rounded, materials.cooler, [ -.72, .99, frontZ + .18 ], [ .66, .25, .40 ], null, 'martha-ice-box' );
		add( g, geo.rounded, materials.cooler, [ .72, .99, frontZ + .18 ], [ .66, .25, .40 ], null, 'martha-ice-box' );
		for ( const x of [ -.64, 0, .64 ] ) {
			add( g, geo.rounded, materials.fish, [ x, 1.16, frontZ + .30 ], [ .34, .055, .095 ], [ 0, x * .10, 0 ], 'martha-display-fish' );
		}
		add( g, geo.box, materials.wood, [ w * .5 + .33, .38, .20 ], [ .48, .72, .58 ], null, 'martha-crate' );
	} else {
		// Rod rack, tackle cooler and coiled line immediately distinguish Joe's from Martha's kiosk.
		add( g, geo.box, materials.wood, [ w * .5 + .28, .72, .18 ], [ .42, 1.44, .50 ], null, 'joe-rod-rack' );
		for ( let i = 0; i < 5; i ++ ) {
			const x = w * .5 + .16 + ( i % 2 ) * .16;
			const z = -.02 + Math.floor( i / 2 ) * .18;
			add( g, geo.cyl, materials.metal, [ x, 1.45, z ], [ .018, 1.32, .018 ], [ 0, 0, ( i - 2 ) * .012 ], 'joe-rod' );
		}
		add( g, geo.torus, options.accent, [ .70, 1.18, frontZ + .31 ], [ .18, .18, .18 ], [ Math.PI * .5, 0, 0 ], 'joe-line-coil' );
		add( g, geo.rounded, materials.cooler, [ -.68, .98, frontZ + .22 ], [ .74, .28, .42 ], null, 'joe-tackle-cooler' );
	}

	// Collision follows the authored shell rather than one giant invisible box: counter + back + sides.
	addCollider( app, shop, 0, wallH * .5, backZ + .09, w, wallH, .18, `${ options.name }-wall` );
	addCollider( app, shop, -w * .5 + .09, wallH * .5, 0, .18, wallH, d, `${ options.name }-wall` );
	addCollider( app, shop, w * .5 - .09, wallH * .5, 0, .18, wallH, d, `${ options.name }-wall` );
	addCollider( app, shop, 0, .43, frontZ - .04, w, .86, .22, `${ options.name }-counter` );
	return g;
}

export function installHarbourShopPolish( app ) {
	if ( ! app?.scene || app.harbourShopPolish ) return app?.harbourShopPolish;
	const root = new Group();
	root.name = 'BermudaHarbourShopPolish';
	app.scene.add( root );

	const M = {
		roof: material( 'roof', 0xf7f5ec, .93, 0 ),
		trim: material( 'trim', 0xf3efe4, .87, 0 ),
		wood: material( 'counter-wood', 0x7f6041, .86, .04 ),
		interior: material( 'interior-shadow', 0x101c20, .86, .02 ),
		glass: material( 'window-glass', 0x163d49, .14, .34, 0x071318 ),
		awning: material( 'awning', 0xe7e0d2, .80, .02 ),
		sign: material( 'sign', 0x17343b, .70, .16 ),
		letters: material( 'sign-letters', 0xf4f0dc, .60, .08, 0x342f22 ),
		metal: material( 'metal', 0x343c3e, .36, .72 ),
		lamp: material( 'lamp', 0xffdca2, .22, .18, 0xffb45e ),
		cooler: material( 'cooler', 0xe9e6da, .78, .04 ),
		fish: material( 'display-fish', 0x98aeb0, .38, .54 ),
		marthaWall: material( 'martha-wall', 0xdca6a1, .90, .01 ),
		marthaAccent: material( 'martha-accent', 0x6b2f38, .68, .16 ),
		joeWall: material( 'joe-wall', 0xa9cdd0, .90, .01 ),
		joeAccent: material( 'joe-accent', 0x28576a, .66, .18 ),
	};
	const geo = {
		box: new BoxGeometry( 1, 1, 1 ),
		cyl: new CylinderGeometry( 1, 1, 1, 12 ),
		rounded: new RoundedBoxGeometry( 1, 1, 1, 2, .10 ),
		torus: new TorusGeometry( 1, .18, 8, 20 ),
	};

	const martha = buildShop( app, root, FISH_MARKET, {
		name: 'martha-fish-market', label: 'MARTHA', kind: 'fish', wall: M.marthaWall, accent: M.marthaAccent,
	}, M, geo );
	const joe = buildShop( app, root, BAIT_TACKLE, {
		name: 'joe-bait-tackle', label: 'JOE', kind: 'tackle', wall: M.joeWall, accent: M.joeAccent,
	}, M, geo );

	app.harbourShopPolish = { root, martha, joe, materials: M };
	return app.harbourShopPolish;
}
