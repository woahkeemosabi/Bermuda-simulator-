import { Group, Mesh, PlaneGeometry, Vector3 } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';

const _localStern = new Vector3();
const _stern = new Vector3();

export class MobileWake {

	constructor( { scene, boat } ) {

		this.boat = boat;
		this.group = new Group();
		this.group.name = 'BermudaMobileWake';
		this.group.visible = true;
		const make = ( width, length, x, opacity ) => {

			const material = new Material( {
				name: 'mobile-wake-foam', color: 0xb8f5ee, emissive: 0x315c60, roughness: 0.9,
				transparent: true, opacity, side: 'double', depthWrite: false, receiveShadows: false,
				underwaterLighting: 'none',
			} );
			const mesh = new Mesh( new PlaneGeometry( width, length ), material );
			mesh.rotation.x = - Math.PI * 0.5;
			mesh.position.x = x;
			mesh.position.y = 0.035;
			mesh.castShadow = false;
			mesh.receiveShadow = false;
			this.group.add( mesh );
			return mesh;

		};
		this.left = make( 0.42, 2.8, - 0.72, 0.62 );
		this.right = make( 0.42, 2.8, 0.72, 0.62 );
		this.center = make( 0.22, 3.7, 0, 0.46 );
		scene.add( this.group );

	}

	update( dt ) {

		const b = this.boat;
		if ( ! b || ! this.group ) return;
		const moving = Math.min( 1, Math.abs( b.speed || b.velocity?.length?.() || 0 ) / 8 );
		const active = moving > 0.025 || Math.abs( b.throttle || 0 ) > 0.08;
		this.group.visible = active;
		if ( ! active ) return;
		_localStern.set( 0, 0, - 2.25 );
		b.toWorld( _localStern, _stern );
		this.group.position.set( _stern.x, _stern.y + 0.02, _stern.z );
		this.group.rotation.y = b.getYaw();
		const pulse = 0.9 + Math.sin( performance.now() * 0.006 ) * 0.08;
		const spread = 0.7 + moving * 0.65;
		this.left.scale.set( spread, 0.75 + moving * 1.2, 1 );
		this.right.scale.set( spread, 0.75 + moving * 1.2, 1 );
		this.center.scale.set( 0.7 + moving * 0.5, 0.75 + moving * 1.6, 1 );
		for ( const mesh of [ this.left, this.right, this.center ] ) mesh.material.opacity = pulse * ( 0.25 + moving * 0.55 );

	}

}
