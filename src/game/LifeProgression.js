import { Group, Mesh, Vector3 } from '../engine/index.js';
import { prepare, mergePrepared, box, mat4 } from '../world/boat/GeoKit.js';
import { createPropMaterial, PAT } from './GameMaterials.js';
import { MissionDirector } from './MissionDirector.js';

const DELIVERY_ID = 'martha-first-delivery';
const TMP = new Vector3();
const Y = new Vector3( 0, 1, 0 );

function buildParcel() {
	const P = [];
	const add = ( g, o ) => P.push( prepare( g, o ) );
	const cardboard = { color: 0x9c7046, rough: 0.93, pattern: PAT.woodX };
	const rope = { color: 0xd0b58b, rough: 0.9, pattern: PAT.cloth };
	add( box( 0.48, 0.34, 0.36 ), { ...cardboard, matrix: mat4( 0, 0.17, 0 ) } );
	add( box( 0.05, 0.345, 0.365 ), { ...rope, matrix: mat4( 0, 0.17, 0 ) } );
	add( box( 0.485, 0.345, 0.05 ), { ...rope, matrix: mat4( 0, 0.17, 0 ) } );
	add( box( 0.24, 0.006, 0.12 ), { color: 0xe9e2ce, rough: 0.8, matrix: mat4( 0.08, 0.346, 0.02 ) } );
	return mergePrepared( P );
}

export class LifeProgression {
	constructor( app ) {
		this.app = app;
		this.game = app.game;
		this.state = app.game?.state;
		this.player = app.player;
		this.input = app.input;
		this.missions = app.missionDirector || new MissionDirector( app );
		this.martha = app.game?.chandlery?.vendor || null;
		this.joe = app.game?.stand?.vendor || null;

		this.parcel = new Group();
		this.parcel.name = 'MarthaDeliveryParcel';
		const mesh = new Mesh( buildParcel(), createPropMaterial( 'marthaDeliveryParcel' ) );
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		this.parcel.add( mesh );
		app.scene.add( this.parcel );

		this.originalPlayerUpdate = this.player.update.bind( this.player );
		this.player.update = ( dt ) => {
			this.originalPlayerUpdate( dt );
			this.update( dt );
		};
		this.mountObjectiveUI();
		app.progression = this;
		this.updateParcelHome();
		this.refreshObjective();
	}

	mountObjectiveUI() {
		if ( typeof document === 'undefined' || document.getElementById( 'bm-objective' ) ) return;
		const style = document.createElement( 'style' );
		style.textContent = `#bm-objective{position:fixed;left:14px;top:max(92px,calc(env(safe-area-inset-top) + 82px));z-index:68;max-width:min(420px,calc(100vw - 28px));padding:8px 11px;border-radius:11px;background:rgba(5,22,31,.74);border:1px solid rgba(130,235,224,.28);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);color:#eaffff;font:600 11px/1.35 system-ui,-apple-system,sans-serif;letter-spacing:.02em;pointer-events:none}.bm-objective-kicker{display:block;font-size:9px;letter-spacing:.14em;color:#83e5db;margin-bottom:2px}`;
		document.head.appendChild( style );
		this.objectiveEl = document.createElement( 'div' );
		this.objectiveEl.id = 'bm-objective';
		document.body.appendChild( this.objectiveEl );
	}

	missionAvailable() { return this.missions.available( DELIVERY_ID ); }
	missionActive() { return this.missions.active( DELIVERY_ID ); }
	missionDone() { return this.missions.completed( DELIVERY_ID ); }
	carrying() { return !! this.state?.storyFlags?.marthaDeliveryCarrying; }

	updateParcelHome() {
		if ( ! this.martha ) return;
		const p = this.martha.position;
		this.parcel.position.set( p.x - 0.78, p.y + 0.04, p.z + 0.48 );
		this.parcel.rotation.y = this.martha.yaw || 0;
	}

	update() {
		if ( ! this.state || ! this.martha || ! this.joe ) return;
		const p = this.player;

		if ( this.missionDone() ) {
			this.parcel.visible = false;
			this.refreshObjective();
			return;
		}

		if ( this.missionActive() && this.carrying() ) {
			this.parcel.visible = true;
			if ( p.mode === 'bike' && this.app.bicycle ) {
				const b = this.app.bicycle.group;
				TMP.set( 0, 0.83, - 0.52 ).applyAxisAngle( Y, this.app.bicycle.yaw );
				this.parcel.position.copy( b.position ).add( TMP );
				this.parcel.rotation.y = this.app.bicycle.yaw;
			} else {
				const side = TMP.set( 0.38, 0.78, - 0.38 ).applyAxisAngle( Y, p.yaw || 0 );
				this.parcel.position.copy( p.position ).add( side );
				this.parcel.rotation.y = p.yaw || 0;
			}

			if ( p.mode === 'walk' && this.joe.inRange( p.position ) ) {
				p.prompt = { key: 'E', text: 'Deliver Martha\'s box to Joe' };
				if ( this.input.hit( 'KeyE' ) ) this.completeDelivery();
			}
		} else if ( this.missionAvailable() ) {
			this.parcel.visible = true;
			this.updateParcelHome();
			const shopReady = ! this.app.marthaShop || this.app.marthaShop.marthaAccessible( p.position );
			if ( shopReady && p.mode === 'walk' && this.martha.inRange( p.position ) ) {
				p.prompt = { key: 'E', text: 'Martha: take this box down to Joe' };
				if ( this.input.hit( 'KeyE' ) ) this.acceptDelivery();
			}
		} else this.parcel.visible = false;

		this.refreshObjective();
	}

	acceptDelivery() {
		if ( ! this.missions.accept( DELIVERY_ID, { storyFlags: { marthaDeliveryCarrying: true, metMartha: true }, toast: false } ) ) return false;
		this.game.toast( 'Martha: “Joe needs this box down at the dock.”', 3400 );
		this.refreshObjective();
		return true;
	}

	completeDelivery() {
		if ( ! this.missionActive() || ! this.carrying() ) return false;
		this.state.storyFlags.marthaDeliveryCarrying = false;
		if ( ! this.missions.complete( DELIVERY_ID, { storyFlags: { metJoe: true }, toast: true } ) ) return false;
		this.parcel.visible = false;
		this.refreshObjective();
		return true;
	}

	refreshObjective() {
		if ( ! this.objectiveEl ) return;
		const objective = this.missions.objective();
		if ( ! objective ) { this.objectiveEl.style.display = 'none'; return; }
		this.objectiveEl.style.display = '';
		const kicker = objective.bucket === 'active' ? 'CURRENT JOB' : objective.id === DELIVERY_ID ? 'FIRST DAY' : 'NEXT OPPORTUNITY';
		this.objectiveEl.innerHTML = `<span class="bm-objective-kicker">${ kicker }</span>${ objective.text }`;
	}
}
