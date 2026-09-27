// World dimensions are metres. Fit each GLB only after reading its actual bounds.
export const WATERFRONT_ASSETS = [
	{ id: 'dock', triangles: 4000, texture: 1024, placements: [ { x: -64, z: -14.5, width: 5.4, depth: 4.8, height: 1.5, deckY: 1.06 } ] },
	{ id: 'house-a', triangles: 4000, texture: 1024, placements: [
		{ x: -80, z: -69, width: 10, depth: 7, height: 6.1, yaw: 0.06 },
		{ x: -92, z: -82, width: 8, depth: 6, height: 5.7, yaw: 0.1, desktopOnly: true },
	] },
	{ id: 'house-b', triangles: 4000, texture: 1024, placements: [
		{ x: -61, z: -73.5, width: 8.4, depth: 6.4, height: 5.5, yaw: -0.05 },
		{ x: -46, z: -87, width: 9, depth: 6.8, height: 5.9, yaw: -0.12, desktopOnly: true },
	] },
	{ id: 'boathouse', triangles: 3000, texture: 512, placements: [ { x: -52.5, z: -55.5, width: 5.5, depth: 4.5, height: 5.1 } ] },
	{ id: 'palmetto', triangles: 1500, texture: 512, placements: [ { x: -87.5, z: -61.5, height: 5.4 }, { x: -53, z: -67, height: 6 } ] },
	{ id: 'harbour-props', triangles: 2050, texture: 512, placements: [ { x: -73, z: -45, y: 1.45, width: 2.2 } ] },
	{ id: 'channel-marker', triangles: 600, texture: 512, placements: [ { x: -91, z: 20, y: -0.3, height: 3.2 } ] },
];

// Broad upward-facing deck triangles locate the walkable surface below the ladder.
export function dockSurfaceHeight( asset ) {
	const bins = new Map(), step = asset.size.y / 64;
	const a = [ 0, 0, 0 ], b = [ 0, 0, 0 ], c = [ 0, 0, 0 ];
	for ( const part of asset.parts ) {
		const p = part.geometry.attributes.position.array, ix = part.geometry.index.array;
		for ( let i = 0; i < ix.length; i += 3 ) {
			for ( let k = 0; k < 3; k ++ ) { a[ k ] = p[ ix[ i ] * 3 + k ]; b[ k ] = p[ ix[ i + 1 ] * 3 + k ]; c[ k ] = p[ ix[ i + 2 ] * 3 + k ]; }
			const ux = b[ 0 ] - a[ 0 ], uy = b[ 1 ] - a[ 1 ], uz = b[ 2 ] - a[ 2 ];
			const vx = c[ 0 ] - a[ 0 ], vy = c[ 1 ] - a[ 1 ], vz = c[ 2 ] - a[ 2 ];
			const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
			const area = Math.hypot( nx, ny, nz );
			if ( area <= 0 || ny / area < 0.85 ) continue;
			const y = ( a[ 1 ] + b[ 1 ] + c[ 1 ] ) / 3;
			if ( y < asset.size.y * 0.15 ) continue;
			const key = Math.round( y / step ), bin = bins.get( key ) || { area: 0, y: 0 };
			bin.area += area; bin.y += area * y; bins.set( key, bin );
		}
	}
	const surface = [ ...bins.values() ].sort( ( a, b ) => b.area - a.area )[ 0 ];
	if ( ! surface ) throw new Error( 'Dock has no measurable horizontal deck.' );
	return surface.y / surface.area;
}

export function fitPlacement( asset, placement, terrain ) {
	const uniform = placement.width ? placement.width / asset.size.x : placement.height / asset.size.y;
	const scaleXYZ = [ placement.width ? placement.width / asset.size.x : uniform,
		placement.height ? placement.height / asset.size.y : uniform,
		placement.depth ? placement.depth / asset.size.z : uniform ];
	const y = placement.deckY !== undefined ? placement.deckY - dockSurfaceHeight( asset ) * scaleXYZ[ 1 ] :
		( placement.y ?? terrain.heightAt( placement.x, placement.z ) );
	return { ...placement, y, scaleXYZ };
}
