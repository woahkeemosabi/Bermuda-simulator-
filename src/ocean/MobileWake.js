import { Group, Mesh, PlaneGeometry, Vector3 } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';

const _localStern = new Vector3();
const _stern = new Vector3();

function ultraProfile() {
	if ( typeof location === 'undefined' ) return false;
	return new URLSearchParams( location.search ).has( 'desktop' );
}

export class MobileWake {

	constructor( { scene, boat } ) {

		this.boat = boat;
		this.ultra = ultraProfile();
		this.group = new Group();
		this.group.name = 'BermudaMobileWake';
		this.group.visible = true;
		const make = ( width, length, x, opacity, z = - 1.0, name = 'wake' ) => {

			const material = new Material( {
				name: `mobile-wake-${ name }`, color: 0xc9fffa, emissive: 0x315c60, roughness: 0.94,
				transparent: true, opacity, side: 'double', depthWrite: false, receiveShadows: false,
				underwaterLighting: 'none',
			} );
			const wakeMesh = new Mesh( new PlaneGeometry( width, length ), material );
			wakeMesh.rotation.x = - Math.PI * 0.5;
			wakeMesh.position.set( x, 0.035, z );
			wakeMesh.castShadow = false;
			wakeMesh.receiveShadow = false;
			this.group.add( wakeMesh );
			return wakeMesh;

		};

		// Two shoulder trails plus the aerated propeller race. Keeping them as very cheap planes makes
		// this readable even on mobile while the full ?desktop path gets a wider, longer secondary wake.
		this.left = make( 0.46, 3.5, - 0.72, 0.62, - 1.35, 'shoulder-left' );
		this.right = make( 0.46, 3.5, 0.72, 0.62, - 1.35, 'shoulder-right' );
		this.center = make( 0.30, 4.7, 0, 0.50, - 1.95, 'prop-wash' );
		this.transomLeft = make( 0.76, 1.55, - 0.43, 0.42, - 0.50, 'transom-left' );
		this.transomRight = make( 0.76, 1.55, 0.43, 0.42, - 0.50, 'transom-right' );

		this.outerLeft = null;
		this.outerRight = null;
		if ( this.ultra ) {
			this.outerLeft = make( 0.58, 6.3, - 1.28, 0.34, - 2.72, 'outer-left' );
			this.outerRight = make( 0.58, 6.3, 1.28, 0.34, - 2.72, 'outer-right' );
		}
		scene.add( this.group );

	}

	update( dt ) {

		const b = this.boat;
		if ( ! b || ! this.group ) return;
		const speed = Math.abs( b.speed || b.velocity?.length?.() || 0 );
		const throttle = Math.abs( b.throttle || 0 );
		const moving = Math.min( 1, speed / 8 );
		const thrust = Math.max( moving, Math.min( 1, throttle ) );
		const active = moving > 0.025 || throttle > 0.08;
		this.group.visible = active;
		if ( ! active ) return;

		_localStern.set( 0, 0, - 2.25 );
		b.toWorld( _localStern, _stern );
		this.group.position.set( _stern.x, _stern.y + 0.02, _stern.z );
		this.group.rotation.y = b.getYaw();

		const now = performance.now();
		const pulse = 0.91 + Math.sin( now * 0.006 ) * 0.075 + Math.sin( now * 0.013 ) * 0.035;
		const spread = 0.76 + moving * 0.88;
		const length = 0.80 + moving * 1.62;
		this.left.scale.set( spread, length, 1 );
		this.right.scale.set( spread, length, 1 );
		this.center.scale.set( 0.76 + thrust * 0.72, 0.88 + thrust * 2.05, 1 );
		this.transomLeft.scale.set( 0.88 + thrust * 0.38, 0.82 + thrust * 0.72, 1 );
		this.transomRight.scale.set( 0.88 + thrust * 0.38, 0.82 + thrust * 0.72, 1 );

		const shoulderOpacity = pulse * ( 0.28 + moving * 0.58 );
		this.left.material.opacity = shoulderOpacity;
		this.right.material.opacity = shoulderOpacity;
		this.center.material.opacity = pulse * ( 0.24 + thrust * 0.66 );
		this.transomLeft.material.opacity = pulse * ( 0.18 + thrust * 0.48 );
		this.transomRight.material.opacity = pulse * ( 0.18 + thrust * 0.48 );

		if ( this.outerLeft && this.outerRight ) {
			// At speed, let the wake shoulders open into the long V visible in the gameplay reference.
			const outerSpread = 0.75 + moving * 1.15;
			const outerLength = 0.72 + moving * 2.35;
			this.outerLeft.position.x = - ( 1.08 + moving * 0.92 );
			this.outerRight.position.x = 1.08 + moving * 0.92;
			this.outerLeft.scale.set( outerSpread, outerLength, 1 );
			this.outerRight.scale.set( outerSpread, outerLength, 1 );
			const outerOpacity = pulse * ( 0.10 + moving * 0.42 );
			this.outerLeft.material.opacity = outerOpacity;
			this.outerRight.material.opacity = outerOpacity;
		}

	}

}
