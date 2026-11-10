// Original articulated Race the Sound model, recovered from the user's
// RaceTheSound_Interactive_Rig_Viewer_OFFLINE_V2.html (October 20, 2026).
// 15,720 GLB triangles, six original PBR materials, three embedded images.
// Imported into the EXISTING Bermuda Simulator renderer and FFT ocean. No iframe,
// second WebGL/WebGPU context, asset generator or substitute primitive boat.
import { BufferGeometry, Float32BufferAttribute, Group, Mesh } from '../engine/index.js';
import { mergeGeometries } from '../engine/geometry/BufferGeometryUtils.js';
import { loadStaticAsset } from '../world/bermuda/StaticAsset.js';
import { box, prepare, mergePrepared, mat4 } from '../world/boat/GeoKit.js';
import { ORIGINAL_RTS_GLB_URL } from './RaceSoundOriginalAsset.js';

const ORIGINAL_MIN_Y = -2.8399999141693115;
const Y_OFFSET = -ORIGINAL_MIN_Y;
const MODEL_SCALE = 0.83;
const PART_GROUPS = {
  Hull_Port: 'hull', Hull_Starboard: 'hull', Deck_Crossbeams_Trampoline: 'hull',
  RigidWing_Main: 'wing', RigidWing_TrailingFlap: 'flap',
  WingFrontSpar: 'wing', Hydrofoil_Port: 'portFoil', Hydrofoil_Starboard: 'starboardFoil',
  Rudder_Port_TFoil: 'portRudder', Rudder_Starboard_TFoil: 'starboardRudder',
};
function groupKey(name) {
  return PART_GROUPS[name] || (name.startsWith('WingRib_') ? 'wing' : 'hull');
}
export async function loadOriginalRaceSoundAsset() {
  const asset = await loadStaticAsset(ORIGINAL_RTS_GLB_URL, {
    id:'original-race-the-sound-foil-cat', maxTriangles:16000, maxTextureSize:1024,
    maxGpuTextureSize:512, generateGpuMipmaps:false,
  });
  if(asset.triangles!==15720 || asset.materials.size!==6 || asset.textures.size!==3)
    throw Error('Recovered Race the Sound GLB identity mismatch');
  for(const m of asset.materials.values()){
    m.roughness = Math.min(m.roughness,.48);
    m.metalness = Math.max(m.metalness,.16);
    m.receiveShadows = false;
    m.underwaterLighting = 'lite';
    m.localLightsCheap = true;
  }
  const buckets=new Map();
  for(const part of asset.parts){
    const key=groupKey(part.name)+':'+part.materialIndex;
    if(!buckets.has(key))buckets.set(key,{
      group:groupKey(part.name),materialIndex:part.materialIndex,parts:[],
    });
    buckets.get(key).parts.push(part);
  }
  const compiled=[];
  for(const bucket of buckets.values()){
    const geo = bucket.parts.length>1
      ? mergeGeometries(bucket.parts.map(p=>p.geometry))
      : bucket.parts[0].geometry;
    if(!geo)throw Error('Could not merge articulated '+bucket.group+' race component');
    geo.computeBoundingSphere();
    compiled.push({group:bucket.group,materialIndex:bucket.materialIndex,geometry:geo});
  }
  if(compiled.length>11)throw Error('Race catamaran was not batched efficiently');
  return {asset,compiled};
}

// The recovered October 20 Meshy wing is a narrow navy YZ-plane: viewed from
// straight astern it looks like a black pole on an iPhone. Overlay a tiny,
// tapered, two-sided team-colour shell on that ORIGINAL articulated wing,
// preserving its physical spars/ribs, flap, UV textures and rotating pivot.
// All patch triangles are merged into one existing-prop-material draw per boat.
function wingPanel(y0,y1,zFront0,zFront1,zAft0,zAft1,x,colour){
  const g=new BufferGeometry();
  g.setAttribute('position',new Float32BufferAttribute([
    x,y0-Y_OFFSET,zFront0,
    x,y0-Y_OFFSET,zAft0,
    x,y1-Y_OFFSET,zFront1,
    x,y1-Y_OFFSET,zAft1,
  ],3));
  g.setIndex(x>0?[0,1,2,2,1,3]:[0,2,1,2,3,1]);
  return prepare(g,{color:colour,rough:.32,metal:.06});
}
function wingProfile(y){
  const t=Math.max(0,Math.min(1,(y-.15)/22.9));
  return {front:.50-.35*t,aft:-2.95+1.08*t};
}
function overlayWing(wing,team,material){
  const primary=team.color,accent=team.name==='AUS'?0x152942:0xf6f2e7;
  const strips=[];
  for(const side of [-1,1]){
    const x=side*.19;
    const a=wingProfile(.4),b=wingProfile(22.6);
    strips.push(wingPanel(.4,22.6,a.front,b.front,a.aft,b.aft,x,primary));
    // Diagonal off-white band like the later Race the Sound sails. Use
    // the same vertex colours on both sides; no new image/texture upload.
    const low=wingProfile(6.7),high=wingProfile(11.5);
    strips.push(wingPanel(6.7,11.5,low.front,high.front,low.aft,high.aft,x+side*.014,accent));
    // Dark navy / black carbon tip that visually terminates the full wing.
    const tip0=wingProfile(17.7),tip1=wingProfile(22.6);
    strips.push(wingPanel(17.7,22.6,tip0.front,tip1.front,tip0.aft,tip1.aft,x+side*.020,0x162438));
  }
  const coloured=new Mesh(mergePrepared(strips),material);
  coloured.name='BermudaSimulator:race-event-coloured-wing';
  coloured.castShadow=false;coloured.receiveShadow=false;
  wing.add(coloured);
  return coloured;
}

function pivotGroup(parent,x=0,y=0,z=0){
  const group=new Group();group.position.set(x,y,z);parent.add(group);return group;
}

export function placeOriginalRaceSoundBoat(model,team,gameMaterial) {
  const rig=new Group();
  rig.name='RaceTheSound:OriginalArticulatedMeshy:'+team.name;
  rig.scale.setScalar(MODEL_SCALE);
  // loadStaticAsset aligns the GLB's lowest point to y=0. Put its real waterline
  // back at y=0 rather than accidentally floating 2.84m above the FFT surface.
  rig.position.y=-Y_OFFSET*MODEL_SCALE;

  const hull=pivotGroup(rig);
  const wing=pivotGroup(rig,0,Y_OFFSET,0);
  const flap=pivotGroup(wing,0,0,-.28);
  const portFoil=pivotGroup(rig,-2.45,Y_OFFSET,0);
  const starboardFoil=pivotGroup(rig,2.45,Y_OFFSET,0);
  const portRudder=pivotGroup(rig,-2.44,Y_OFFSET,-6.65);
  const starboardRudder=pivotGroup(rig,2.44,Y_OFFSET,-6.65);

  const groups={hull,wing,flap,portFoil,starboardFoil,portRudder,starboardRudder};
  for(const part of model.compiled){
    const group=groups[part.group],mesh=new Mesh(part.geometry,model.asset.materials.get(part.materialIndex));
    mesh.name='OriginalMeshy:'+part.group+':'+part.materialIndex;
    mesh.castShadow=false;mesh.receiveShadow=false;
    // The original rigid wing has a yaw pivot at the real mast, the
    // independent trailing flap has a second relative pivot.
    if(part.group==='wing')mesh.position.y=-Y_OFFSET;
    else if(part.group==='flap')mesh.position.set(0,-Y_OFFSET,.28);
    else if(part.group==='portFoil'||part.group==='starboardFoil'){
      mesh.position.set(0,-Y_OFFSET,0);
    }else if(part.group==='portRudder'||part.group==='starboardRudder'){
      mesh.position.set(0,-Y_OFFSET,0);
    }
    group.add(mesh);
  }
  const sailColour=overlayWing(wing,team,gameMaterial);
  // Colour and wing silhouette are dynamic components of the restored Meshy
  // rig; the three embedded original textures and 19 geometry parts remain.
  const accents=[
    prepare(box(.13,.10,10),{color:team.color,rough:.32,metal:.16,matrix:mat4(-2.54,Y_OFFSET+.23,0)}),
    prepare(box(.13,.10,10),{color:team.color,rough:.32,metal:.16,matrix:mat4(2.54,Y_OFFSET+.23,0)}),
  ];
  const trim=new Mesh(mergePrepared(accents),gameMaterial);
  trim.castShadow=false;trim.receiveShadow=false;hull.add(trim);

  return {
    root:rig,wing,flap,sailColour,
    foils:[portFoil,starboardFoil],
    rudders:[portRudder,starboardRudder],
  };
}
