// Reuse the real, already-owned Meshy Bermuda harbour GLBs. No Meshy credits,
// second renderer, image generation or new ocean GPU simulation required.
// Assets are installed only after the existing iPhone FFT warmup completes.
import { Group } from '../engine/index.js';
import { loadStaticAsset, placeStaticAsset } from '../world/bermuda/StaticAsset.js';

const BASE = ((import.meta.env && import.meta.env.BASE_URL) || './') + 'models/bermuda/';
export const MESHY_RACE_MARSHAL = BASE + 'street-life/mobile/bermuda-npc-male.glb';
export const MESHY_MARINA_KIT = BASE + 'mobile-v3/bermuda-marina-kit.glb';

export async function installMeshyRaceMarshal(marshal){
  const asset=await loadStaticAsset(MESHY_RACE_MARSHAL, {
    id:'bermuda-pier-race-marshal',maxTriangles:25000,maxTextureSize:1024,maxGpuTextureSize:512,generateGpuMipmaps:false,
  });
  const height=Number(asset.size.y)||1.75;
  const scale=Math.max(.45,Math.min(3,1.77/height));
  // Vendor already owns position, talk range, yaw, collision and E / ACT.
  // Replace only the figure; do not create another NPC or interaction loop.
  const visual=placeStaticAsset(asset,[{x:0,y:0,z:0,yaw:Math.PI,scale}]);
  visual.name='BermudaMeshyRaceMarshal';
  marshal.setModel(visual);
  return {asset,visual,scale};
}

export async function installMeshyMarinaKit(app,legacyBoats){
  const asset=await loadStaticAsset(MESHY_MARINA_KIT, {
    id:'bermuda-marina-meshy-moored-fleet',maxTriangles:26000,maxTextureSize:1024,maxGpuTextureSize:512,generateGpuMipmaps:false,
  });
  // The existing asset is a grouped harbour set: *two sailboats, one motor
  // yacht, mooring buoys and fenders*. Do not animate the whole group as a
  // patrol vessel; use it ONLY for the parked fleet. Keep moving craft separate.
  const height=Number(asset.size.y)||9;
  const scale=Math.max(.45,Math.min(1.7,10/height));
  const visual=placeStaticAsset(asset,[{x:-85.5,y:-.32,z:22,yaw:-.19,scale}]);
  visual.name='BermudaMeshyMarinaMooredFleet';
  app.scene.add(visual);
  for(const boat of legacyBoats)boat.root.visible=false;
  return {asset,visual,scale};
}

// Patrols cannot use the combined marina-kit GLB (it contains three boats and
// buoys as a single arrangement). Instead instance the already loaded, detailed
// Bermuda lobster-boat geometry for moving work/patrol vessels. These meshes
// SHARE the player's boat GPU geometry/material; no new GLB, bitmap, shader or
// expensive duplicated vertex buffers on iPhone.
export function upgradeHarbourPatrols(app,patrols){
  const source=app.boat?.meshes;
  if(!source)return 0;
  const pieces=['hull','gelcoat','wood','fittings','glass']
    .map(name=>source[name]).filter(Boolean);
  if(pieces.length<3)return 0;
  for(const boat of patrols){
    const cabin=new Group();
    cabin.name='BermudaExistingDetailedPatrol';
    cabin.scale.setScalar(.66);
    cabin.position.y=-.11;
    for(const original of pieces){
      const mesh=original.clone(false);
      mesh.castShadow=false;mesh.receiveShadow=false;
      cabin.add(mesh);
    }
    boat.root.add(cabin);
    for(const child of boat.root.children)if(child!==cabin)child.visible=false;
  }
  return patrols.length;
}
