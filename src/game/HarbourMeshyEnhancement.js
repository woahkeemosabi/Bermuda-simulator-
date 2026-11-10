// Reuse the real, already-owned Meshy Bermuda harbour GLBs. No Meshy credits,
// second renderer, image generation or new ocean GPU simulation required.
// Assets are installed only after the existing iPhone FFT warmup completes.
import { loadStaticAsset, placeStaticAsset } from '../world/bermuda/StaticAsset.js';

const BASE = ((import.meta.env && import.meta.env.BASE_URL) || './') + 'models/bermuda/';
export const MESHY_RACE_MARSHAL = BASE + 'street-life/mobile/bermuda-npc-male.glb';
export const MESHY_MARINA_KIT = BASE + 'mobile-v3/bermuda-marina-kit.glb';

export async function installMeshyRaceMarshal(marshal){
  const asset=await loadStaticAsset(MESHY_RACE_MARSHAL, {
    id:'bermuda-pier-race-marshal',maxTriangles:25000,maxTextureSize:1024,
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
    id:'bermuda-marina-meshy-moored-fleet',maxTriangles:26000,maxTextureSize:1024,
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
