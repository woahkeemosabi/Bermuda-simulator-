// Pure, allocation-free landing motion; the existing FishProps shader bends the
// actual 3D fish. No extra mesh, WebGPU pipeline, texture, particle or render pass.
// A hooked fish struggles in irregular bursts, then tires; the tail does not
// stop animating after three seconds. Species size changes the struggle cadence.
export function fishLandingMotion( seconds, kg ) {

	const t = Math.max( 0, Number(seconds) || 0 );
	const mass = Math.max( 0.05, Number(kg) || 0.5 );
	const tempo = Math.max( 0.74, Math.min( 1.35, 1.18 / Math.pow( mass, 0.14 ) ) );
	const strength = Math.max( 0.58, Math.min( 1.14, 1.15 / Math.pow( mass, 0.10 ) ) );
	// Two offset pulse trains avoid the robotic, continuous sine-wave wiggle.
	const kickA = Math.pow( Math.max( 0, Math.sin( t * 3.05 * tempo + 0.55 ) ), 3 );
	const kickB = 0.72 * Math.pow( Math.max( 0, Math.sin( t * 4.72 * tempo - 1.15 ) ), 5 );
	const burst = Math.min( 1, kickA + kickB );
	const fatigue = 0.44 + 0.56 * Math.exp( - t * 0.115 );
	const tail = Math.sin( t * 13.2 * tempo ) * 1.38 + Math.sin( t * 8.4 * tempo + 0.8 ) * 0.43;
	return {
		curl: strength * fatigue * burst * tail,
		sag: strength * fatigue * burst * ( 0.55 * Math.cos( t * 10.3 * tempo ) - 0.09 ),
		yaw: 0.17 * Math.sin( t * 1.8 ) + burst * fatigue * Math.sin( t * 7.3 * tempo ) * 0.12,
		roll: 0.09 * Math.sin( t * 2.0 + 0.4 ) + 0.19 * burst * fatigue * Math.sin( t * 9.2 * tempo ),
		jaw: 0.10 + Math.max( 0, Math.sin( t * 4.8 * tempo ) ) * 0.25 + burst * 0.28,
	};

}
