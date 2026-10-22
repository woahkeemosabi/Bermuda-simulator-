// Buildings live in an inland neighborhood on the current playable terrain, not on the
// launch beach. These are provisional local coordinates, NOT georeferenced Bermuda parcels.
// Load a building asset only when a player approaches this neighborhood.
export const WATERFRONT_ASSETS = [
	{ id: 'dock', tier: 1, triangles: 4000, texture: 1024,
		placements: [ { x: -64, z: -14.5, width: 5.4, depth: 4.8, height: 1.5, deckY: 1.06 } ] },
	{ id: 'house-a', tier: 2, triangles: 4000, texture: 1024, placements: [
		{ x: 11, z: -126, width: 7.6, depth: 6.2, height: 5.7, yaw: 0.08 },
		{ x: 32, z: -130, width: 8.2, depth: 6.5, height: 5.9, yaw: -0.04 },
		{ x: 55, z: -119, width: 8.1, depth: 6.3, height: 5.8, yaw: 0.09 },
	] },
	{ id: 'house-b', tier: 2, triangles: 4000, texture: 1024, placements: [
		{ x: 20, z: -147, width: 8.6, depth: 6.7, height: 6.0, yaw: -0.08 },
		{ x: 44, z: -150, width: 8.0, depth: 6.3, height: 5.7, yaw: 0.06 },
		{ x: 68, z: -136, width: 8.5, depth: 6.5, height: 5.8, yaw: -0.05 },
	] },
];

export function dockSurfaceHeight(asset){const bins=new Map(),step=asset.size.y/64,a=[0,0,0],b=[0,0,0],c=[0,0,0];for(const part of asset.parts){const p=part.geometry.attributes.position.array,ix=part.geometry.index.array;for(let i=0;i<ix.length;i+=3){for(let k=0;k<3;k++){a[k]=p[ix[i]*3+k];b[k]=p[ix[i+1]*3+k];c[k]=p[ix[i+2]*3+k];}const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,area=Math.hypot(nx,ny,nz);if(area<=0||ny/area<.85)continue;const y=(a[1]+b[1]+c[1])/3;if(y<asset.size.y*.15)continue;const key=Math.round(y/step),bin=bins.get(key)||{area:0,y:0};bin.area+=area;bin.y+=area*y;bins.set(key,bin);}}const surface=[...bins.values()].sort((a,b)=>b.area-a.area)[0];if(!surface)throw new Error('Dock has no measurable horizontal deck.');return surface.y/surface.area;}
export function fitPlacement(asset,placement,terrain){const uniform=placement.width?placement.width/asset.size.x:placement.height/asset.size.y;const scaleXYZ=[placement.width?placement.width/asset.size.x:uniform,placement.height?placement.height/asset.size.y:uniform,placement.depth?placement.depth/asset.size.z:uniform];const y=placement.deckY!==undefined?placement.deckY-dockSurfaceHeight(asset)*scaleXYZ[1]:(placement.y??terrain.heightAt(placement.x,placement.z));return{...placement,y,scaleXYZ};}
