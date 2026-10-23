// World dimensions are metres. Fit each GLB only after reading its actual bounds.
export const WATERFRONT_ASSETS = [
 {id:'dock',triangles:4000,texture:1024,placements:[{x:-64,z:-14.5,width:5.4,depth:4.8,height:1.5,deckY:1.06}]},
 // Reuse the two validated house meshes as instanced residential fabric. The 54-second reference
 // reads as a continuous Bermuda lane, not a handful of isolated hero props; these extra instances
 // add that layered depth without another GLB decode or another texture allocation.
 {id:'house-a',triangles:4000,texture:1024,placements:[
   {x:-108,z:-72,width:7.6,depth:6.2,height:5.7,yaw:.08},
   {x:-98,z:-78,width:8.2,depth:6.5,height:5.9,yaw:-.04},
   {x:-80,z:-69,width:10,depth:7,height:6.1,yaw:.06},
   {x:-69,z:-83,width:7.5,depth:6.0,height:5.6,yaw:.09},
   {x:-55,z:-80,width:8.3,depth:6.3,height:5.8,yaw:-.07},
   {x:-38,z:-75,width:7.7,depth:6.1,height:5.6,yaw:.06},
   {x:-25,z:-83,width:8.1,depth:6.4,height:5.8,yaw:-.05}
 ]},
 {id:'house-b',triangles:4000,texture:1024,placements:[
   {x:-102,z:-91,width:8.6,depth:6.7,height:6.0,yaw:-.08},
   {x:-92,z:-82,width:8,depth:6,height:5.7,yaw:.1},
   {x:-84,z:-93,width:8.8,depth:6.8,height:6.0,yaw:.04},
   {x:-72,z:-94,width:8.0,depth:6.3,height:5.7,yaw:-.09},
   {x:-61,z:-73.5,width:8.4,depth:6.4,height:5.5,yaw:-.05},
   {x:-46,z:-87,width:9,depth:6.8,height:5.9,yaw:-.12},
   {x:-32,z:-94,width:8.5,depth:6.5,height:5.8,yaw:.08},
   {x:-20,z:-77,width:7.7,depth:6.0,height:5.6,yaw:-.05}
 ]},
 {id:'boathouse',triangles:3000,texture:512,placements:[{x:-52.5,z:-55.5,width:5.5,depth:4.5,height:5.1}]},
 {id:'palmetto',triangles:1500,texture:512,placements:[{x:-108,z:-62,height:6.2},{x:-101,z:-68,height:5.6},{x:-91,z:-61.5,height:5.4},{x:-86,z:-75,height:5.9},{x:-78,z:-60.5,height:5.8},{x:-72,z:-72,height:5.4},{x:-65,z:-61.5,height:5.5},{x:-58,z:-76,height:5.7},{x:-53,z:-67,height:6},{x:-42,z:-60.5,height:5.3},{x:-35,z:-73,height:5.5},{x:-28,z:-61.5,height:5.0}]},
 {id:'harbour-props',triangles:2050,texture:512,placements:[{x:-73,z:-45,y:1.45,width:2.2}]},
 {id:'channel-marker',triangles:600,texture:512,placements:[{x:-91,z:20,y:-.3,height:3.2}]}
];

// Only the dock is boot-critical. Everything decorative keeps its blockout fallback visible
// and streams after gameplay starts, so a slow GLB cannot hold iOS Safari at 98%.
for(const a of WATERFRONT_ASSETS)a.tier=a.id==='dock'?1:2;

// IMPORTANT: fish-market.glb and bait-tackle.glb are deliberately NOT streamed here. Joe and Martha
// now use the native Tidewater gameplay stalls. Loading those replacement buildings hid the real
// stalls and created the visually incoherent/inaccessible storefronts seen in mobile QA.
WATERFRONT_ASSETS.push(
 {id:'house-c',tier:2,version:'mobile-v3',triangles:6000,texture:1024,placements:[{x:-84,z:-54,width:6,depth:5,height:6}]},
 {id:'house-d',tier:2,version:'mobile-v3',triangles:6000,texture:1024,placements:[{x:-57,z:-61,width:7,depth:5.5,height:5.5}]},
 // No waterfront seawall is loaded here: the dock-to-road/car route stays visually and physically open.
 {id:'bougainvillea-cluster',tier:2,version:'mobile-v3',triangles:2500,texture:512,placements:[{x:-104,z:-65,height:4},{x:-94,z:-69,height:4},{x:-88,z:-61,height:5},{x:-78,z:-49,height:4},{x:-74,z:-61,height:4},{x:-62,z:-64,height:4},{x:-55,z:-51,height:4},{x:-44,z:-67,height:4},{x:-30,z:-65,height:4}]},
 {id:'rocky-shoreline',tier:2,version:'mobile-v3',triangles:4500,texture:512,placements:[{x:-91,z:-38,y:-.6,width:12,height:3},{x:-39,z:-38,y:-.6,width:11,height:3}]},
 // Sink and overlap the backdrop into the native terrain instead of presenting the GLB as a
 // freestanding shelf. Extra Z depth creates a broad transition zone hidden behind the houses.
 {id:'hillside-cluster',tier:3,version:'mobile-v3',triangles:5000,texture:512,placements:[{x:-77,z:-105,y:-3.0,width:44,depth:42,height:18}]},
 {id:'hilltop-landmark',tier:3,version:'mobile-v3',triangles:4000,texture:512,placements:[{x:-80,z:-139,y:11.5,width:22,depth:26,height:8}]},
 {id:'marina-kit',tier:3,version:'mobile-v3',triangles:3500,texture:512,placements:[{x:-112,z:4,y:-1.4,width:19,depth:16,height:17}]}
);

export function dockSurfaceHeight(asset){const bins=new Map(),step=asset.size.y/64,a=[0,0,0],b=[0,0,0],c=[0,0,0];for(const part of asset.parts){const p=part.geometry.attributes.position.array,ix=part.geometry.index.array;for(let i=0;i<ix.length;i+=3){for(let k=0;k<3;k++){a[k]=p[ix[i]*3+k];b[k]=p[ix[i+1]*3+k];c[k]=p[ix[i+2]*3+k];}const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,area=Math.hypot(nx,ny,nz);if(area<=0||ny/area<.85)continue;const y=(a[1]+b[1]+c[1])/3;if(y<asset.size.y*.15)continue;const key=Math.round(y/step),bin=bins.get(key)||{area:0,y:0};bin.area+=area;bin.y+=area*y;bins.set(key,bin);}}const surface=[...bins.values()].sort((a,b)=>b.area-a.area)[0];if(!surface)throw new Error('Dock has no measurable horizontal deck.');return surface.y/surface.area;}
export function fitPlacement(asset,placement,terrain){const uniform=placement.width?placement.width/asset.size.x:placement.height/asset.size.y;const scaleXYZ=[placement.width?placement.width/asset.size.x:uniform,placement.height?placement.height/asset.size.y:uniform,placement.depth?placement.depth/asset.size.z:uniform];const y=placement.deckY!==undefined?placement.deckY-dockSurfaceHeight(asset)*scaleXYZ[1]:(placement.y??terrain.heightAt(placement.x,placement.z));return{...placement,y,scaleXYZ};}
