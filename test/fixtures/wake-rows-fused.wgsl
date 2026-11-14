diagnostic( off, derivative_uniformity );
struct Frame {
	view: mat4x4f,
	proj: mat4x4f,
	viewProj: mat4x4f,
	invView: mat4x4f,
	invProj: mat4x4f,
	invViewProj: mat4x4f,
	viewProjNoJitter: mat4x4f,
	prevViewProjNoJitter: mat4x4f,
	cameraPos: vec3f,
	near: f32,
	prevCameraPos: vec3f,
	far: f32,
	resolution: vec2f,
	invResolution: vec2f,
	outputResolution: vec2f,
	jitter: vec2f,
	prevJitter: vec2f,
	frameIndex: u32,
	time: f32,
	dt: f32,
	seaLevel: f32,
	sunDir: vec3f,
	night: f32,
	sunColor: vec3f,
	exposure: f32,
	skyIrradiance: vec3f,
	cameraUnderwater: f32,
	horizonColor: vec3f,
	cameraWaterHeight: f32,
	waterAbsorption: vec3f,
	windSpeed: f32,
	waterScattering: vec3f,
	envIntensity: f32,
	windDir: vec2f,
	reversedDepth: f32,
	pad0: f32,
	debug: vec4f,
};

struct TerrainParams {
	origin: f32,
	size: f32,
	res: f32,
	shoreRes: f32,
	sunBake: vec3f,
	sunBaked: f32,
};

struct WakeKernel {
	origin: vec2f,
	prev: vec2f,
	center: vec2f,
	boatPos: vec2f,
	boatRot: vec2f,
	dead: vec2f,
	trim: vec3f,
	reset: f32,
	pileBox: vec4f,
	dt: f32,
	amount: f32,
	source: f32,
	wash: f32,
	bow: f32,
	speed: f32,
	washW: f32,
	boil: f32,
	visc: f32,
	dyn: f32,
	hollow: f32,
	hollowK: f32,
	amplitude: f32,
	foamGain: f32,
	aerGain: f32,
	aerOut: f32,
	nearRate: f32,
};

@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var smpLinearRepeat: sampler;
@group(0) @binding(2) var smpLinearClamp: sampler;
@group(0) @binding(3) var smpLinearMirror: sampler;
@group(0) @binding(4) var smpAnisoRepeat: sampler;
@group(0) @binding(5) var smpAnisoClamp: sampler;
@group(0) @binding(6) var smpAniso4Repeat: sampler;
@group(0) @binding(7) var smpNearestClamp: sampler;
@group(0) @binding(8) var smpNearestRepeat: sampler;
@group(0) @binding(9) var smpShadow: sampler_comparison;
@group(1) @binding(0) var terrainHeightTex: texture_2d<f32>;
@group(1) @binding(1) var terrainNormalTex: texture_2d<f32>;
@group(1) @binding(2) var terrainSplatTex: texture_2d<f32>;
@group(1) @binding(3) var terrainDetailTex: texture_2d<f32>;
@group(1) @binding(4) var terrainShoreTex: texture_2d<f32>;
@group(1) @binding(5) var terrainSunShadowTex: texture_2d<f32>;
@group(1) @binding(6) var<uniform> terrainParams: TerrainParams;
@group(1) @binding(7) var<storage, read_write> wakeState: array<vec4f>;
@group(1) @binding(8) var<storage, read_write> wakeScratch: array<vec4f>;
@group(1) @binding(9) var<storage, read_write> wakeSpec: array<vec4f>;
@group(1) @binding(10) var<storage, read_write> wakeAerA: array<f32>;
@group(1) @binding(11) var<storage, read_write> wakeAerB: array<f32>;
@group(1) @binding(12) var wakeHullTex: texture_2d<f32>;
@group(1) @binding(13) var<uniform> wk: WakeKernel;
@group(1) @binding(14) var wakePileTex: texture_2d<f32>;
@group(1) @binding(15) var wakeDisplayOut: texture_storage_2d<rgba16float, write>;
@group(1) @binding(16) var wakeAerOut: texture_storage_2d<rgba16float, write>;
// ---- common

const PI: f32 = 3.141592653589793;
const TWO_PI: f32 = 6.283185307179586;
const INV_PI: f32 = 0.3183098861837907;
const EPS: f32 = 1e-5;

fn sat( x: f32 ) -> f32 { return clamp( x, 0.0, 1.0 ); }
fn sat3( x: vec3f ) -> vec3f { return clamp( x, vec3f( 0.0 ), vec3f( 1.0 ) ); }
fn pow2( x: f32 ) -> f32 { return x * x; }
fn pow4( x: f32 ) -> f32 { let y = x * x; return y * y; }
fn pow5( x: f32 ) -> f32 { let y = x * x; return y * y * x; }
fn luminance( c: vec3f ) -> f32 { return dot( c, vec3f( 0.2126, 0.7152, 0.0722 ) ); }
fn remap( x: f32, a: f32, b: f32, c: f32, d: f32 ) -> f32 { return c + ( x - a ) * ( d - c ) / ( b - a ); }
fn remapClamp( x: f32, a: f32, b: f32, c: f32, d: f32 ) -> f32 { return mix( c, d, sat( ( x - a ) / ( b - a ) ) ); }
fn rotate2( v: vec2f, a: f32 ) -> vec2f { let c = cos( a ); let s = sin( a ); return vec2f( c * v.x - s * v.y, s * v.x + c * v.y ); }

// ---- depth (reversed-Z: 1 at the near plane, 0 at far / infinity)

// positive view-space distance along the view axis from a depth-buffer value
fn viewDepth( d: f32 ) -> f32 {
	let v = frame.invProj * vec4f( 0.0, 0.0, d, 1.0 );
	return - v.z / v.w;
}

// uv (0..1, y down) + depth -> world / view position
fn ndcFromUv( uv: vec2f, d: f32 ) -> vec4f { return vec4f( uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, d, 1.0 ); }
fn worldFromDepth( uv: vec2f, d: f32 ) -> vec3f {
	let p = frame.invViewProj * ndcFromUv( uv, d );
	return p.xyz / p.w;
}
fn viewFromDepth( uv: vec2f, d: f32 ) -> vec3f {
	let p = frame.invProj * ndcFromUv( uv, d );
	return p.xyz / p.w;
}
// world direction of the camera ray through uv
fn viewRay( uv: vec2f ) -> vec3f {
	let p = frame.invViewProj * ndcFromUv( uv, 0.5 );
	return normalize( p.xyz / p.w - frame.cameraPos );
}
// world position -> uv (y down) and depth
fn projectToUv( P: vec3f ) -> vec3f {
	let c = frame.viewProjNoJitter * vec4f( P, 1.0 );
	let n = c.xyz / c.w;
	return vec3f( n.x * 0.5 + 0.5, 0.5 - n.y * 0.5, n.z );
}
fn isSky( d: f32 ) -> bool { return d <= 0.0; }

// ---- hashes

fn pcg( v: u32 ) -> u32 {
	let state = v * 747796405u + 2891336453u;
	let word = ( ( state >> ( ( state >> 28u ) + 4u ) ) ^ state ) * 277803737u;
	return ( word >> 22u ) ^ word;
}
fn pcg3( v0: vec3u ) -> vec3u {
	var v = v0 * 1664525u + 1013904223u;
	v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
	v ^= v >> vec3u( 16u );
	v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
	return v;
}
fn u32ToUnit( h: u32 ) -> f32 { return f32( h >> 8u ) * ( 1.0 / 16777216.0 ) + ( 0.5 / 16777216.0 ); }
// float hash in [0, 1) of a float seed (TSL hash())
fn hash11( p: f32 ) -> f32 { return u32ToUnit( pcg( bitcast<u32>( p ) ^ 0x9e3779b9u ) ); }
fn hash21( p: vec2f ) -> f32 { return u32ToUnit( pcg( bitcast<u32>( p.x ) ^ pcg( bitcast<u32>( p.y ) ) ) ); }
fn hash31( p: vec3f ) -> f32 { return u32ToUnit( pcg3( bitcast<vec3u>( p ) ).x ); }
fn hash22( p: vec2f ) -> vec2f {
	let h = pcg3( vec3u( bitcast<vec2u>( p ), 0x51ed270bu ) );
	return vec2f( u32ToUnit( h.x ), u32ToUnit( h.y ) );
}
fn hash33( p: vec3f ) -> vec3f {
	let h = pcg3( bitcast<vec3u>( p ) );
	return vec3f( u32ToUnit( h.x ), u32ToUnit( h.y ), u32ToUnit( h.z ) );
}
fn hashU( a: u32, b: u32 ) -> f32 { return u32ToUnit( pcg( a ^ pcg( b ) ) ); }
fn ihash3( p: vec3i ) -> vec3u { return pcg3( bitcast<vec3u>( p ) ); }

// Jimenez interleaved gradient noise at a pixel (0..1)
fn interleavedGradientNoise( px: vec2f ) -> f32 { return fract( 52.9829189 * fract( dot( px, vec2f( 0.06711056, 0.00583715 ) ) ) ); }

// i-th of n points of a Vogel disc (unit radius), rotated by phi
fn vogelDiskSample( i: i32, n: i32, phi: f32 ) -> vec2f {
	let r = sqrt( ( f32( i ) + 0.5 ) / f32( n ) );
	let theta = f32( i ) * 2.399963229728653 + phi;
	return vec2f( cos( theta ), sin( theta ) ) * r;
}

// ---- gradient noise: MaterialX (three's MaterialXNoise.js) bit for bit — the same Jenkins
// lookup3 hash, gradients, quintic fade and gradient scales (0.6616 in 2D, 0.982 in 3D), so the
// procedural patterns land where they did in the three.js version.

fn _mxRotl( x: u32, k: u32 ) -> u32 { return ( x << k ) | ( x >> ( 32u - k ) ); }
fn _mxFinal( a0: u32, b0: u32, c0: u32 ) -> u32 {
	var a = a0; var b = b0; var c = c0;
	c ^= b; c -= _mxRotl( b, 14u );
	a ^= c; a -= _mxRotl( c, 11u );
	b ^= a; b -= _mxRotl( a, 25u );
	c ^= b; c -= _mxRotl( b, 16u );
	a ^= c; a -= _mxRotl( c, 4u );
	b ^= a; b -= _mxRotl( a, 14u );
	c ^= b; c -= _mxRotl( b, 24u );
	return c;
}
fn mxHash2( x: i32, y: i32 ) -> u32 { let s = 0xdeadbeefu + ( 2u << 2u ) + 13u; return _mxFinal( s + u32( x ), s + u32( y ), s ); }
fn mxHash3( x: i32, y: i32, z: i32 ) -> u32 { let s = 0xdeadbeefu + ( 3u << 2u ) + 13u; return _mxFinal( s + u32( x ), s + u32( y ), s + u32( z ) ); }
fn _mxGrad2( hash: u32, x: f32, y: f32 ) -> f32 {
	let h = hash & 7u;
	let u = select( y, x, h < 4u );
	let v = 2.0 * select( x, y, h < 4u );
	return select( u, - u, ( h & 1u ) != 0u ) + select( v, - v, ( h & 2u ) != 0u );
}
fn _gradDot3( h: u32, p: vec3f ) -> f32 {
	let hh = h & 15u;
	let u = select( p.y, p.x, hh < 8u );
	let v = select( select( p.z, p.x, hh == 12u || hh == 14u ), p.y, hh < 4u );
	return select( u, - u, ( hh & 1u ) != 0u ) + select( v, - v, ( hh & 2u ) != 0u );
}
fn _fade3( t: vec3f ) -> vec3f { return t * t * t * ( t * ( t * 6.0 - 15.0 ) + 10.0 ); }
fn _h3( i: vec3i ) -> u32 { return mxHash3( i.x, i.y, i.z ); }

fn perlin3( p: vec3f ) -> f32 {
	let fl = floor( p );
	let i = vec3i( fl );
	let f = p - fl;
	let u = _fade3( f );
	let n000 = _gradDot3( _h3( i ), f );
	let n100 = _gradDot3( _h3( i + vec3i( 1, 0, 0 ) ), f - vec3f( 1.0, 0.0, 0.0 ) );
	let n010 = _gradDot3( _h3( i + vec3i( 0, 1, 0 ) ), f - vec3f( 0.0, 1.0, 0.0 ) );
	let n110 = _gradDot3( _h3( i + vec3i( 1, 1, 0 ) ), f - vec3f( 1.0, 1.0, 0.0 ) );
	let n001 = _gradDot3( _h3( i + vec3i( 0, 0, 1 ) ), f - vec3f( 0.0, 0.0, 1.0 ) );
	let n101 = _gradDot3( _h3( i + vec3i( 1, 0, 1 ) ), f - vec3f( 1.0, 0.0, 1.0 ) );
	let n011 = _gradDot3( _h3( i + vec3i( 0, 1, 1 ) ), f - vec3f( 0.0, 1.0, 1.0 ) );
	let n111 = _gradDot3( _h3( i + vec3i( 1, 1, 1 ) ), f - vec3f( 1.0, 1.0, 1.0 ) );
	let x0 = mix( mix( n000, n100, u.x ), mix( n010, n110, u.x ), u.y );
	let x1 = mix( mix( n001, n101, u.x ), mix( n011, n111, u.x ), u.y );
	return mix( x0, x1, u.z ) * 0.982;
}
fn perlin2( p: vec2f ) -> f32 {
	let fl = floor( p );
	let X = i32( fl.x ); let Y = i32( fl.y );
	let fx = p.x - fl.x; let fy = p.y - fl.y;
	let u = _fade3( vec3f( fx, fy, 0.0 ) );
	let v0 = _mxGrad2( mxHash2( X, Y ), fx, fy );
	let v1 = _mxGrad2( mxHash2( X + 1, Y ), fx - 1.0, fy );
	let v2 = _mxGrad2( mxHash2( X, Y + 1 ), fx, fy - 1.0 );
	let v3 = _mxGrad2( mxHash2( X + 1, Y + 1 ), fx - 1.0, fy - 1.0 );
	let s1 = 1.0 - u.x;
	return ( ( 1.0 - u.y ) * ( v0 * s1 + v1 * u.x ) + u.y * ( v2 * s1 + v3 * u.x ) ) * 0.6616;
}
fn mx_noise_float3( p: vec3f ) -> f32 { return perlin3( p ); }
fn mx_noise_float2( p: vec2f ) -> f32 { return perlin2( p ); }
// MaterialX vec3 noise: one hash per corner, its three low bytes pick the gradients
fn _mxGrad3v( h: u32, p: vec3f ) -> vec3f { return vec3f( _gradDot3( h & 0xffu, p ), _gradDot3( ( h >> 8u ) & 0xffu, p ), _gradDot3( ( h >> 16u ) & 0xffu, p ) ); }
fn mx_noise_vec3( p: vec3f ) -> vec3f {
	let fl = floor( p );
	let i = vec3i( fl );
	let f = p - fl;
	let u = _fade3( f );
	let n000 = _mxGrad3v( _h3( i ), f );
	let n100 = _mxGrad3v( _h3( i + vec3i( 1, 0, 0 ) ), f - vec3f( 1.0, 0.0, 0.0 ) );
	let n010 = _mxGrad3v( _h3( i + vec3i( 0, 1, 0 ) ), f - vec3f( 0.0, 1.0, 0.0 ) );
	let n110 = _mxGrad3v( _h3( i + vec3i( 1, 1, 0 ) ), f - vec3f( 1.0, 1.0, 0.0 ) );
	let n001 = _mxGrad3v( _h3( i + vec3i( 0, 0, 1 ) ), f - vec3f( 0.0, 0.0, 1.0 ) );
	let n101 = _mxGrad3v( _h3( i + vec3i( 1, 0, 1 ) ), f - vec3f( 1.0, 0.0, 1.0 ) );
	let n011 = _mxGrad3v( _h3( i + vec3i( 0, 1, 1 ) ), f - vec3f( 0.0, 1.0, 1.0 ) );
	let n111 = _mxGrad3v( _h3( i + vec3i( 1, 1, 1 ) ), f - vec3f( 1.0, 1.0, 1.0 ) );
	let x0 = mix( mix( n000, n100, u.x ), mix( n010, n110, u.x ), u.y );
	let x1 = mix( mix( n001, n101, u.x ), mix( n011, n111, u.x ), u.y );
	return mix( x0, x1, u.z ) * 0.982;
}
fn mx_fractal_noise_float3( p: vec3f, octaves: i32, lacunarity: f32, diminish: f32 ) -> f32 {
	var r = 0.0; var amp = 1.0; var q = p;
	for ( var i = 0; i < octaves; i++ ) { r += amp * perlin3( q ); amp *= diminish; q *= lacunarity; }
	return r;
}
fn mx_cell_noise_float3( p: vec3f ) -> f32 { let i = vec3i( floor( p ) ); return f32( mxHash3( i.x, i.y, i.z ) ) / f32( 0xffffffffu ); }
fn mx_cell_noise_float2( p: vec2f ) -> f32 { let i = vec2i( floor( p ) ); return f32( mxHash2( i.x, i.y ) ) / f32( 0xffffffffu ); }
// distances to the nearest two feature points (F1, F2), jitter 0..1
fn mx_worley_noise_vec2_3( p: vec3f, jitter: f32 ) -> vec2f {
	let i = vec3i( floor( p ) );
	let f = fract( p );
	var d1 = 1e9; var d2 = 1e9;
	for ( var z = -1; z <= 1; z++ ) { for ( var y = -1; y <= 1; y++ ) { for ( var x = -1; x <= 1; x++ ) {
		let c = vec3i( x, y, z );
		let h = ihash3( i + c );
		let o = vec3f( f32( c.x ), f32( c.y ), f32( c.z ) ) + ( vec3f( u32ToUnit( h.x ), u32ToUnit( h.y ), u32ToUnit( h.z ) ) - 0.5 ) * jitter + 0.5 - f;
		let d = dot( o, o );
		if ( d < d1 ) { d2 = d1; d1 = d; } else if ( d < d2 ) { d2 = d; }
	} } }
	return sqrt( vec2f( d1, d2 ) );
}
fn mx_worley_noise_vec2_2( p: vec2f, jitter: f32 ) -> vec2f {
	let i = vec2i( floor( p ) );
	let f = fract( p );
	var d1 = 1e9; var d2 = 1e9;
	for ( var y = -1; y <= 1; y++ ) { for ( var x = -1; x <= 1; x++ ) {
		let c = vec2i( x, y );
		let h = ihash3( vec3i( i + c, 0 ) );
		let o = vec2f( f32( c.x ), f32( c.y ) ) + ( vec2f( u32ToUnit( h.x ), u32ToUnit( h.y ) ) - 0.5 ) * jitter + 0.5 - f;
		let d = dot( o, o );
		if ( d < d1 ) { d2 = d1; d1 = d; } else if ( d < d2 ) { d2 = d; }
	} }
	return sqrt( vec2f( d1, d2 ) );
}

// ---- normals

// orthonormal basis around n (Frisvad / Duff et al.)
fn basis( n: vec3f ) -> mat3x3f {
	let s = select( -1.0, 1.0, n.z >= 0.0 );
	let a = -1.0 / ( s + n.z );
	let b = n.x * n.y * a;
	let t = vec3f( 1.0 + s * n.x * n.x * a, s * b, -s * n.x );
	let bt = vec3f( b, s + n.y * n.y * a, -n.y );
	return mat3x3f( t, bt, n );
}

// Perturb a world-space normal by a height field sampled with screen-space derivatives
// (Mikkelsen, "Bump Mapping Unparametrized Surfaces"; TSL perturbNormal equivalent).
// dhdx / dhdy: dpdx / dpdy of the height (in metres) at this pixel.
fn perturbNormalByHeight( P: vec3f, N: vec3f, dhdx: f32, dhdy: f32, strength: f32 ) -> vec3f {
	let dPdx = dpdx( P );
	let dPdy = dpdy( P );
	let r1 = cross( dPdy, N );
	let r2 = cross( N, dPdx );
	let det = dot( dPdx, r1 );
	let grad = sign( det ) * ( dhdx * r1 + dhdy * r2 ) * strength;
	return normalize( abs( det ) * N - grad );
}

// tangent-space normal map sample (xy in -1..1) applied with a derivative-based TBN
fn perturbNormalByMap( P: vec3f, N: vec3f, uv: vec2f, mapN: vec3f ) -> vec3f {
	let dp1 = dpdx( P ); let dp2 = dpdy( P );
	let duv1 = dpdx( uv ); let duv2 = dpdy( uv );
	let dp2perp = cross( dp2, N ); let dp1perp = cross( N, dp1 );
	let T = dp2perp * duv1.x + dp1perp * duv2.x;
	let B = dp2perp * duv1.y + dp1perp * duv2.y;
	let invmax = inverseSqrt( max( max( dot( T, T ), dot( B, B ) ), 1e-20 ) );
	return normalize( mat3x3f( T * invmax, B * invmax, N ) * mapN );
}

// ---- color

fn srgbToLinear( c: vec3f ) -> vec3f {
	return select( pow( ( c + 0.055 ) / 1.055, vec3f( 2.4 ) ), c / 12.92, c <= vec3f( 0.04045 ) );
}
fn linearToSrgb( c: vec3f ) -> vec3f {
	return select( 1.055 * pow( c, vec3f( 1.0 / 2.4 ) ) - 0.055, c * 12.92, c <= vec3f( 0.0031308 ) );
}

// ---- wakeCommon

const WAKE_N: u32 = 256u;
const WAKE_HALF: u32 = 128u;
const WAKE_MASK: u32 = 255u;
const WAKE_CELL: f32 = 0.4;
const WAKE_SIZE: f32 = 102.4;
const WAKE_TW: u32 = 32u;
const WAKE_TH: u32 = 88u;

// integer lattice hash -> [0, 1), smooth value noise
fn wakeHash( ix: i32, iy: i32 ) -> f32 {
	var v = ( u32( ix ) * 0x8da6b343u ) ^ ( u32( iy ) * 0xd8163841u );
	v = ( v ^ ( v >> 13u ) ) * 0x5bd1e995u;
	v = v ^ ( v >> 15u );
	return f32( v >> 8u ) * ( 1.0 / 16777216.0 );
}

fn wakeNoise( q: vec2f ) -> f32 {
	let i = floor( q );
	let fr = fract( q );
	let u = fr * fr * ( 3.0 - 2.0 * fr );
	let ix = i32( i.x ); let iy = i32( i.y );
	let a = wakeHash( ix, iy ); let b = wakeHash( ix + 1, iy );
	let c = wakeHash( ix, iy + 1 ); let d = wakeHash( ix + 1, iy + 1 );
	return mix( mix( a, b, u.x ), mix( c, d, u.x ), u.y );
}

// ---- terrain

fn terrainUvOf( xz: vec2f ) -> vec2f {
	return ( xz - terrainParams.origin ) / terrainParams.size;
}

// exact bilinear height at world xz (matches TerrainData.heightAt)
fn terrainHeightAt( xz: vec2f ) -> f32 {
	let res = terrainParams.res;
	let f = ( xz - terrainParams.origin ) / terrainParams.size * res - 0.5;
	let fc = clamp( f, vec2f( 0.0 ), vec2f( res - 1.001 ) );
	let i = floor( fc );
	let t = fract( fc );
	let ii = vec2i( i );
	let a = textureLoad( terrainHeightTex, ii, 0 ).x;
	let b = textureLoad( terrainHeightTex, ii + vec2i( 1, 0 ), 0 ).x;
	let c = textureLoad( terrainHeightTex, ii + vec2i( 0, 1 ), 0 ).x;
	let d = textureLoad( terrainHeightTex, ii + vec2i( 1, 1 ), 0 ).x;
	let h = mix( mix( a, b, t.x ), mix( c, d, t.x ), t.y );
	// outside the domain: deep ocean floor
	let outside = f.x < 0.0 || f.y < 0.0 || f.x > res - 1.0 || f.y > res - 1.0;
	return select( h, -90.0, outside );
}

// filtered normal (xz components), rock mask, ambient occlusion
fn terrainNormalRock( xz: vec2f ) -> vec4f {
	let s = textureSample( terrainNormalTex, smpLinearClamp, terrainUvOf( xz ) );
	return vec4f( s.xy * 2.0 - 1.0, s.z, s.w );
}
// explicit mip (e.g. in the vertex stage)
fn terrainNormalRockLevel( xz: vec2f, level: f32 ) -> vec4f {
	let s = textureSampleLevel( terrainNormalTex, smpLinearClamp, terrainUvOf( xz ), level );
	return vec4f( s.xy * 2.0 - 1.0, s.z, s.w );
}
fn terrainNormalAt( xz: vec2f ) -> vec3f {
	let nr = terrainNormalRockLevel( xz, 0.0 );
	return normalize( vec3f( nr.x, sqrt( max( 1.0 - nr.x * nr.x - nr.y * nr.y, 0.0025 ) ), nr.y ) );
}

// loose sand, worn ground / paths, gullies (land) or seagrass (seabed), seabed rubble (the
// eroded beach scarp face on land)
fn terrainSplat( xz: vec2f ) -> vec4f {
	return textureSample( terrainSplatTex, smpLinearClamp, terrainUvOf( xz ) );
}
fn terrainSplatLevel( xz: vec2f, level: f32 ) -> vec4f {
	return textureSampleLevel( terrainSplatTex, smpLinearClamp, terrainUvOf( xz ), level );
}

// shore field: (T, dirX, dirZ, exposure), bilinear via loads (float32 data)
fn terrainShoreSample( xz: vec2f ) -> vec4f {
	let res = terrainParams.shoreRes;
	let f = ( xz - terrainParams.origin ) / terrainParams.size * res - 0.5;
	let fc = clamp( f, vec2f( 0.0 ), vec2f( max( res - 1.001, 0.0 ) ) );
	let i = floor( fc );
	let t = fract( fc );
	let ii = vec2i( i );
	let mx = vec2i( max( i32( res ) - 1, 0 ) );
	let a = textureLoad( terrainShoreTex, ii, 0 );
	let b = textureLoad( terrainShoreTex, min( ii + vec2i( 1, 0 ), mx ), 0 );
	let c = textureLoad( terrainShoreTex, min( ii + vec2i( 0, 1 ), mx ), 0 );
	let d = textureLoad( terrainShoreTex, min( ii + vec2i( 1, 1 ), mx ), 0 );
	return mix( mix( a, b, t.x ), mix( c, d, t.x ), t.y );
}

// 0 (in the terrain's shadow) .. 1 (lit) for a world position, soft penumbra that widens with the
// occluder distance
fn terrainSunShadowAt( P: vec3f ) -> f32 {
	let N = f32( textureDimensions( terrainSunShadowTex ).x );
	let st = clamp( terrainUvOf( P.xz ) * N - 0.5, vec2f( 0.0 ), vec2f( N - 1.001 ) );
	let i = vec2i( floor( st ) );
	let t = fract( st );
	let s = mix(
		mix( textureLoad( terrainSunShadowTex, i, 0 ), textureLoad( terrainSunShadowTex, i + vec2i( 1, 0 ), 0 ), t.x ),
		mix( textureLoad( terrainSunShadowTex, i + vec2i( 0, 1 ), 0 ), textureLoad( terrainSunShadowTex, i + vec2i( 1, 1 ), 0 ), t.x ),
		t.y
	);
	let w = s.y * 0.012 + 0.35;
	return mix( 1.0, smoothstep( -w, w, P.y - s.x ), terrainParams.sunBaked );
}

// ---- wakeSim

const WAKE_LOG2N: u32 = 8u;

fn wakeBrev( v: u32 ) -> u32 { return reverseBits( v ) >> ( 32u - WAKE_LOG2N ); }

// toroidal texel -> world cell index in the window starting at o
fn wakeWorldIndex( i: i32, o: i32 ) -> i32 { return o + ( ( i - o ) & i32( WAKE_MASK ) ); }
fn wakeInWindow( I: i32, J: i32, o: vec2f ) -> bool {
	return I >= i32( o.x ) && I < i32( o.x ) + i32( WAKE_N ) && J >= i32( o.y ) && J < i32( o.y ) + i32( WAKE_N );
}

// state of texel (c, r) if it held the same world cell last step, else zero
fn wakeLoadState( c: u32, r: u32 ) -> vec4f {
	let I = wakeWorldIndex( i32( c ), i32( wk.origin.x ) );
	let J = wakeWorldIndex( i32( r ), i32( wk.origin.y ) );
	let keep = wakeInWindow( I, J, wk.prev ) && wk.reset < 0.5;
	return select( vec4f( 0.0 ), wakeState[ r * WAKE_N + c ], keep );
}

fn wakeLoadAer( c: u32, r: u32 ) -> f32 {
	let I = wakeWorldIndex( i32( c ), i32( wk.origin.x ) );
	let J = wakeWorldIndex( i32( r ), i32( wk.origin.y ) );
	let keep = wakeInWindow( I, J, wk.prev ) && wk.reset < 0.5;
	return select( 0.0, wakeAerA[ r * WAKE_N + c ], keep );
}

fn wakeCellPos( c: u32, r: u32 ) -> vec2f {
	let I = wakeWorldIndex( i32( c ), i32( wk.origin.x ) );
	let J = wakeWorldIndex( i32( r ), i32( wk.origin.y ) );
	return vec2f( f32( I ) + 0.5, f32( J ) + 0.5 ) * WAKE_CELL;
}

// sqrt of the blend weights of the four operators (deep, 6, 1.8, 0.6 m) for local depth d:
// the two levels bracketing d share the weight (fitted for <= 5 % phase-speed error over
// 1-100 m wavelengths down to 0.5 m depth); below 0.6 m the shallowest one fades out
fn wakeDepthWeights( d: f32 ) -> vec4f {
	let t0 = 1.0 - exp( ( d - 6.0 ) / - 9.0 );
	let t1 = pow( sat( ( d - 1.8 ) / 4.2 ), 0.8 );
	let t2 = pow( sat( ( d - 0.6 ) / 1.2 ), 0.85 );
	let w0 = select( 0.0, t0, d > 6.0 );
	let w1 = select( select( 0.0, t1, d > 1.8 ), 1.0 - t0, d > 6.0 );
	let w2 = select( select( select( 0.0, t2, d > 0.6 ), 1.0 - t1, d > 1.8 ), 0.0, d > 6.0 );
	let w3 = select( select( sat( d / 0.6 ), 1.0 - t2, d > 0.6 ), 0.0, d > 1.8 );
	return sqrt( vec4f( w0, w1, w2, w3 ) );
}

// hull immersion (m) at boat-frame (x, z): design immersion + scheduled heave / trim
fn wakeImmersionAt( x: f32, z: f32 ) -> f32 {
	let huv = vec2f( abs( x ) / 1.9, ( z - -4.7 ) / 9.392847878998529 );
	let D = textureSampleLevel( wakeHullTex, smpLinearClamp, huv, 0.0 ).x;
	return max( D + wk.trim.x + wk.trim.y * x + wk.trim.z * z, 0.0 ) * smoothstep( 0.0, 0.04, D );
}

// radix-2 DIT butterflies (bit-reversed in, natural order out); dir = -1 forward, +1 inverse
// (unnormalized): twiddle and pair index of thread t in stage s
fn wakeTwiddle( t: u32, s: u32, dir: f32 ) -> vec2f {
	let half = 1u << s;
	let pos = t & ( half - 1u );
	let ang = f32( pos ) * ( dir * PI / f32( half ) );
	return vec2f( cos( ang ), sin( ang ) );
}
fn wakeStageIndex( t: u32, s: u32 ) -> u32 {
	let half = 1u << s;
	return ( ( t >> s ) << ( s + 1u ) ) | ( t & ( half - 1u ) );
}
fn wakeCmul( b: vec4f, w: vec2f ) -> vec4f {
	return vec4f( b.x * w.x - b.y * w.y, b.x * w.y + b.y * w.x, b.z * w.x - b.w * w.y, b.z * w.y + b.w * w.x );
}


fn wakeCell( col: u32, row: u32 ) -> vec4f {
	let dt = wk.dt;
	let idx = row * WAKE_N + col;
	let p = wakeCellPos( col, row );
	let s = wakeLoadState( col, row );
	let cL = ( col + WAKE_MASK ) & WAKE_MASK; let cR = ( col + 1u ) & WAKE_MASK;
	let rD = ( row + WAKE_MASK ) & WAKE_MASK; let rU = ( row + 1u ) & WAKE_MASK;
	let sL = wakeLoadState( cL, row ); let sR = wakeLoadState( cR, row );
	let sD = wakeLoadState( col, rD ); let sU = wakeLoadState( col, rU );

	let d = frame.seaLevel - terrainHeightAt( p );

	// boat frame of the cell
	let rel = p - wk.boatPos;
	let cs = wk.boatRot.x; let sn = wk.boatRot.y;
	let bx = rel.x * cs - rel.y * sn;
	let bz = rel.x * sn + rel.y * cs;
	// hull pressure head (m): hydrostatic (immersion, with the speed-scheduled trim) and a
	// dynamic part where the hull enters the water: ~ K U^2/2g times the rise of the bottom
	let e = 0.7;
	let Ph = wakeImmersionAt( bx, bz );
	let entry = max( ( wakeImmersionAt( bx, bz - e ) - wakeImmersionAt( bx, bz + e ) ) / ( 2.0 * e ), 0.0 );
	// transom stern at speed: the flow separates at the transom and leaves a hollow behind it
	// (then the rooster tail and the quarter waves)
	let aft = -3.9 - bz;
	let hollow = wakeImmersionAt( bx, -3.65 ) * exp( - max( aft, 0.0 ) / wk.hollow ) * smoothstep( - 0.3, 0.3, aft );
	let P = ( max( Ph, hollow * wk.hollowK ) + entry * wk.dyn ) * wk.source;

	// on a (re)start the water under the hull is already displaced: no transient
	let h = select( s.x, - P, wk.reset > 0.5 );
	let w = s.y;

	let gx = ( sR.x - sL.x ) / ( 2.0 * WAKE_CELL ); let gz = ( sU.x - sD.x ) / ( 2.0 * WAKE_CELL );
	let slope = length( vec2f( gx, gz ) );

	// obstacles: dry land, pier piles
	let puv = ( p - wk.pileBox.xy ) / wk.pileBox.zw;
	let pileIn = select( 0.0, 1.0, puv.x > 0.0 && puv.x < 1.0 && puv.y > 0.0 && puv.y < 1.0 );
	let pile = textureSampleLevel( wakePileTex, smpLinearClamp, puv, 0.0 ).x * pileIn;
	let wet = smoothstep( 0.0, 0.05, d );
	let keep = wet * sat( 1.0 - pile * 2.5 );

	// breaking: steep crests (deep water) and depth-limited (surf zone); free waves only, the
	// forced depression under the hull is steep but does not break
	let brk = sat( ( slope - 0.2 ) / 0.2 ) * ( 1.0 - smoothstep( 0.0, 0.03, P ) );
	let surf = sat( ( h - d * 0.42 ) / max( d * 0.3, 0.03 ) ) * wet;
	let turb = s.w;

	// propeller wash / transom wake (boat frame): widens behind the transom, streaky
	// (lateral noise that changes as the boat moves on) and patchy
	let time = frame.time;
	let behind = -3.9 - bz;
	let washW = max( behind, 0.0 ) * 0.1 + wk.washW;
	let inWash = smoothstep( - 0.6, 0.3, behind ) * smoothstep( 7.0, 1.5, behind ) * smoothstep( washW, washW * 0.3, abs( bx ) );
	let streak = wakeNoise( vec2f( bx * 1.7, time * 0.9 ) );
	let patchN = wakeNoise( p * 0.45 + time * 0.13 );
	// churning white right behind the transom (the propeller race), streaks and patches further aft
	let race = smoothstep( 7.0, 0.0, behind ) * 0.9;
	// streaks: noise stretched along the track (fixed in the water), deposited with the wash so
	// the band is laid down as long ragged streaks, not a uniform ribbon
	let along = p.x * sn + p.y * cs; let across = p.x * cs - p.y * sn;
	let streaks = wakeNoise( vec2f( along * 0.12, across * 0.9 ) ) * 0.7 + wakeNoise( vec2f( along * 0.3, across * 1.9 ) + 5.3 ) * 0.3;
	let mottle = clamp( ( streaks - 0.5 ) * 3.2, - 0.85, 0.85 ) + 1.0;
	let washGen = inWash * wk.wash * ( wk.speed + 1.5 ) * ( streak * patchN * 0.6 + race + 0.08 ) * mix( mottle, 1.0, smoothstep( 3.0, 0.0, behind ) * 0.7 );

	// bow: the spray thrown off the forward hull falls back in a band just outside the
	// waterline (up to ~1.3 m out), where the bow wave rolls away from the hull
	let outside = 1.0 - smoothstep( 0.0, 0.03, Ph );
	let nearHull = smoothstep( 0.0, 0.03, wakeImmersionAt( max( abs( bx ) - 0.9, 0.0 ), bz ) );
	let bowBand = outside * nearHull * smoothstep( - 0.5, 1.2, bz ) * smoothstep( 4.2, 3.2, bz );
	let bowGen = bowBand * wk.bow * ( wk.speed + 1.0 ) * ( wakeNoise( vec2f( bz * 1.5, time * 3.0 ) ) * 1.4 + 0.1 ) * 0.35;

	// Dissipation is a turbulent eddy viscosity acting on w in flux form: it conserves mass
	// exactly, damps short (breaking, choppy) waves ~k^2 and leaves the refilling flow behind
	// the hull alone. Breaking crests and the surf feed the turbulence; the turbulent wash
	// also stirs the surface (boils).
	let nuC = min( turb * 0.6, 1.0 ) + wk.visc;
	let flux = ( ( nuC + min( sL.w * 0.6, 1.0 ) + wk.visc ) * ( sL.y - w )
		+ ( nuC + min( sR.w * 0.6, 1.0 ) + wk.visc ) * ( sR.y - w )
		+ ( nuC + min( sD.w * 0.6, 1.0 ) + wk.visc ) * ( sD.y - w )
		+ ( nuC + min( sU.w * 0.6, 1.0 ) + wk.visc ) * ( sU.y - w ) ) * ( 0.5 / ( WAKE_CELL * WAKE_CELL ) );
	// boils: Laplacian of (turbulence x noise), so the stirring sums to zero (conserves mass)
	var boil = 0.0;
	if ( turb + sL.w + sR.w + sD.w + sU.w > 0.02 ) {
		let drift = vec2f( time * 0.5, time * - 0.35 );
		let c0 = ( wakeNoise( p * 0.45 + drift ) - 0.5 ) * min( turb, 1.5 );
		boil = ( wakeNoise( ( p - vec2f( WAKE_CELL, 0.0 ) ) * 0.45 + drift ) - 0.5 ) * min( sL.w, 1.5 )
			+ ( wakeNoise( ( p + vec2f( WAKE_CELL, 0.0 ) ) * 0.45 + drift ) - 0.5 ) * min( sR.w, 1.5 )
			+ ( wakeNoise( ( p - vec2f( 0.0, WAKE_CELL ) ) * 0.45 + drift ) - 0.5 ) * min( sD.w, 1.5 )
			+ ( wakeNoise( ( p + vec2f( 0.0, WAKE_CELL ) ) * 0.45 + drift ) - 0.5 ) * min( sU.w, 1.5 )
			- c0 * 4.0;
	}
	let w1 = ( w + flux * dt + boil * ( dt * wk.boil ) ) * exp( dt * - 0.006 ) * keep;

	// foam: thick foam thins quickly (bubbles rise and burst), the lace lingers
	let lapF = ( sL.z + sR.z + sD.z + sU.z - s.z * 4.0 ) / ( WAKE_CELL * WAKE_CELL );
	// foam streaks widen: molecular-ish spreading plus turbulent mixing in the wash
	let f0 = max( s.z + lapF * min( dt * ( turb * 0.3 + 0.04 ), 0.03 ), 0.0 );
	let gen = ( washGen + bowGen + brk * 3.0 + surf * 4.0 ) * wk.foamGain;
	// the lace breaks up as it ages: it lingers in some patches and streaks and clears fast in
	// others (a fixed noise in the water: the pattern stays put while the foam thins)
	let breakup = wakeNoise( p * 0.17 + vec2f( 13.1, 7.3 ) ) * 0.65 + wakeNoise( p * 0.55 + vec2f( 3.7, 1.9 ) ) * 0.35;
	let clr = smoothstep( 0.3, 0.72, breakup ) * 2.6 + 0.2;
	let foam = min( f0 * exp( - dt * ( f0 * f0 * 0.6 + clr / 35.0 ) ) + gen * dt, 3.0 );
	let turb1 = min( turb * exp( dt * ( - 1.0 / 6.0 ) ) + ( inWash * wk.wash * ( wk.speed + 1.5 ) * 0.5 + brk * 4.0 + surf * 6.0 ) * dt, 3.0 );

	// aeration (0..~3): injected broadly by the race (not only where the surface foam is), by
	// breaking and the surf; mixed sideways by the turbulence; the bubbles rise out over ~25 s
	let aC = wakeLoadAer( col, row );
	let lapA = wakeLoadAer( cL, row ) + wakeLoadAer( cR, row ) + wakeLoadAer( col, rD ) + wakeLoadAer( col, rU ) - aC * 4.0;
	let a0 = max( aC + lapA * min( ( turb * 0.35 + 0.07 ) * dt / ( WAKE_CELL * WAKE_CELL ), 0.2 ), 0.0 );
	// the bubble cloud is wider than the white race and its edge wanders (soft, irregular)
	let wA = washW * ( wakeNoise( p * 0.22 + time * 0.05 ) * 0.8 + 0.8 );
	let aerBand = smoothstep( - 0.6, 0.3, behind ) * smoothstep( 9.0, 2.0, behind ) * smoothstep( wA, wA * 0.2, abs( bx ) );
	let aerGen = ( aerBand * wk.wash * ( wk.speed + 1.5 ) * ( ( race * 1.2 + 0.15 ) * ( patchN * 1.3 + streak * 0.5 + 0.1 ) )
		* ( mottle * mottle * 0.55 ) + bowGen * 0.6 + brk * 1.5 + surf * 2.0 ) * wk.aerGain;
	// bubbles rise out over ~25 s, faster in some patches (mottled as it ages)
	let rise = smoothstep( 0.25, 0.75, breakup * 0.6 + patchN * 0.4 ) * 1.3 + 0.45;
	let aer = min( a0 * exp( - dt * ( a0 * 0.06 + rise / 25.0 ) ) + aerGen * dt, 3.0 ) * wet;
	wakeAerB[ idx ] = aer;
	textureStore( wakeAerOut, vec2u( col, row ), vec4f( aer, 0.0, 0.0, 0.0 ) );

	wakeScratch[ idx ] = vec4f( h, w1, foam, turb1 );
	// the free surface is h (pushed down under the hull, the hollow behind the transom)
	textureStore( wakeDisplayOut, vec2u( col, row ), vec4f( h, gx, gz, foam ) );

	return wakeDepthWeights( d ) * ( h + P );
}

var<workgroup> shRow: array<vec4f, 256>;

@compute @workgroup_size( 128, 1, 1 )
fn main( @builtin( local_invocation_id ) lid: vec3u, @builtin( workgroup_id ) wid: vec3u ) {
	let t = lid.x;
	let row = wid.x;
	for ( var e = 0u; e < 2u; e++ ) {
		let col = t + e * WAKE_HALF;
		shRow[ wakeBrev( col ) ] = wakeCell( col, row );
	}
	workgroupBarrier();

	for ( var s = 0u; s < WAKE_LOG2N; s++ ) {
		let half = 1u << s;
		let i0 = wakeStageIndex( t, s );
		let w = wakeTwiddle( t, s, -1.0 );
		{
			let i = i0 + 0u;
			let j = i + half;
			let a = shRow[ i ];
			let bw = wakeCmul( shRow[ j ], w );
			shRow[ i ] = a + bw;
			shRow[ j ] = a - bw;
		}
		workgroupBarrier();
	}

	for ( var e = 0u; e < 2u; e++ ) {
		let col = t + e * WAKE_HALF;
		wakeSpec[ row * WAKE_N + col ] = shRow[ col ];
	}
}
