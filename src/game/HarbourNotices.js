import { Mesh, PlaneGeometry, Vector3, Color } from '../engine/index.js';
import { Texture } from '../engine/gpu/Texture.js';
import { generateMipmaps } from '../engine/gpu/Mipmaps.js';
import { standard } from '../materials/Materials.js';

// One small, cached texture shared by both faces: real notices in the world, not a HUD label.
export class HarbourNotices {
	constructor( board, lights ) {
		this.canvas = document.createElement( 'canvas' );
		this.canvas.width = 1024;
		this.canvas.height = 640;
		this.ctx = this.canvas.getContext( '2d' );
		this.texture = new Texture( {
			label: 'harbourJobNotices', width: 1024, height: 640,
			format: 'rgba8unorm-srgb', mips: true, usage: [ 'sample', 'render', 'copyDst' ],
		} );
		const material = standard( {
			name: 'harbourJobNotices', roughness: 0.94,
			side: 'double',
			textures: { jobNotices: this.texture },
			surface: /* wgsl */`
	let ink = textureSample( jobNotices, smpLinearClamp, vec2f( in.uv.x, 1.0 - in.uv.y ) ).rgb;
	s.albedo = ink;
	// A restrained readability floor complements the warm board light after dusk.
	s.emissive = ink * 0.14 * smoothstep( 0.15, 0.75, frame.night );
`,
		} );
		for ( const side of [ - 1, 1 ] ) {
			const face = new Mesh( new PlaneGeometry( 1.4, 0.9 ), material );
			face.name = `HarbourNotices:${ side }`;
			face.position.set( 0, 1.43, side < 0 ? - 0.094 : 0.049 );
			// Double-sided rendering lets the same UV orientation remain readable from either dock
			// approach; rotating the rear card would mirror the printed notices.
			board.add( face );
		}
		const bulb = new Mesh( new PlaneGeometry( 0.24, 0.035 ), standard( {
			name: 'harbourBoardLight', color: 0xffe6b4,
			surface: 's.emissive = vec3f( 1.0, 0.72, 0.42 ) * smoothstep( 0.15, 0.75, frame.night );',
			side: 'double',
		} ) );
		bulb.position.set( 0, 2.025, - 0.15 );
		bulb.rotation.x = Math.PI / 2;
		board.add( bulb );
		lights?.add( {
			position: new Vector3( board.position.x, board.position.y + 2.08, board.position.z - 0.38 ),
			color: new Color( 1.0, 0.78, 0.52 ), intensity: 1.8, range: 3, kind: 'lantern',
		} );
	}

	update( jobs, activeId ) {
		const key = jobs.map( ( j ) => j.id ).join( '|' ) + ':' + ( activeId || '' );
		if ( key === this.key ) return;
		this.key = key;
		const c = this.ctx;
		c.fillStyle = '#927650'; c.fillRect( 0, 0, 1024, 640 );
		c.fillStyle = '#173d43'; c.fillRect( 14, 12, 996, 108 );
		c.fillStyle = '#fff3d1'; c.font = 'bold 62px sans-serif';
		c.textAlign = 'center'; c.fillText( 'HARBOUR JOBS', 512, 86 );
		jobs.slice( 0, 3 ).forEach( ( job, i ) => {
			const y = 140 + i * 160;
			c.save();
			c.translate( 512, y + 70 ); c.rotate( [ - 0.008, 0.006, - 0.005 ][ i ] );
			c.fillStyle = '#594831'; c.fillRect( - 474, - 62, 960, 142 );
			c.fillStyle = [ '#fff3d4', '#edf1df', '#f9e9cc' ][ i ]; c.fillRect( - 480, - 68, 960, 142 );
			c.fillStyle = '#963e32'; c.beginPath(); c.arc( - 455, - 49, 8, 0, Math.PI * 2 ); c.fill();
			c.textAlign = 'left'; c.fillStyle = '#17383e'; c.font = 'bold 46px sans-serif';
			c.fillText( job.title, - 428, - 8, 670 );
			c.font = '27px sans-serif'; c.fillStyle = '#3f4a45';
			const words = job.text.split( ' ' ); let line = '', row = 0;
			for ( const word of words ) {
				const next = line ? line + ' ' + word : word;
				if ( line && c.measureText( next ).width > 710 ) {
					c.fillText( line, - 428, 28 + row * 30 ); row ++; line = word;
				} else line = next;
			}
			c.fillText( line, - 428, 28 + row * 30 );
			c.textAlign = 'right'; c.font = 'bold 40px sans-serif'; c.fillStyle = '#173d43';
			c.fillText( '$' + job.reward, 455, - 8 );
			c.font = 'bold 19px sans-serif';
			c.fillText( job.id === activeId ? 'IN PROGRESS' : activeId ? 'NEXT JOB' : 'REWARD', 455, 24 );
			c.restore();
		} );
		this.texture.upload( c.getImageData( 0, 0, 1024, 640 ).data );
		generateMipmaps( this.texture );
	}
}
