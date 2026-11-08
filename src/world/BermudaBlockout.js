import { InstancedMesh, Matrix4, BoxGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, Vector3 } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';
import { WATERFRONT_DECK } from './bermuda/HarbourLayout.js';

const START = { x: - 63.4, z: - 20.0, yaw: Math.PI };
function makeMaterial(name,color,roughness=.9){return new Material({name:'bermuda-'+name,color,roughness,metalness:0,underwaterLighting:'lite',localLightsCheap:true,receiveShadows:false});}
function makePierConcrete(name,color){
 const mat=makeMaterial(name,color,.97);
 // Salt-weathered cast concrete in world metres: no additional texture bindings.
 mat.surface=`
  let fCell=floor(in.P*12.0);
  var q=fract(fCell*vec3f(0.1031,0.11369,0.13787));
  q += vec3f(dot(q,q.yzx+vec3f(33.33)));
  let fleck=fract((q.x+q.y)*q.z);
  let coarseCell=floor(in.P*1.55);
  let coarse=fract(dot(coarseCell,vec3f(0.071,0.137,0.193))*0.6180339);
  let aggregate=select(1.0,0.83,fleck>0.986);
  let tidal=1.0-0.10*(1.0-smoothstep(0.08,0.74,in.P.y))*(1.0-abs(in.N.y));
  s.albedo *= (0.94+0.055*fleck+0.045*coarse)*aggregate*tidal;
  s.roughness=0.98;
 `;
 return mat;
}
function isMobileProfile(){if(typeof navigator==='undefined')return false;return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&Math.min(screen.width,screen.height)<1024);}

export function installBermudaBlockout(app){
 if(!app||!app.scene||!app.terrainData||!app.colliders||app.bermudaBlockout)return app&&app.bermudaBlockout;
 const scene=app.scene,terrain=app.terrainData,colliders=app.colliders,mobileLite=isMobileProfile(),group=new Group(),visuals={};
 group.name='BermudaWorldBlockout'; let visualKey='quay';
 const M={limestone:makeMaterial('limestone',0xe8e3d6,.96),roof:makeMaterial('white-roof',0xf5f4ed,.92),pink:makeMaterial('pastel-pink',0xe9a7aa,.92),yellow:makeMaterial('pastel-yellow',0xe3cc79,.92),blue:makeMaterial('pastel-blue',0x9fc4d5,.92),mint:makeMaterial('pastel-mint',0xaecdb6,.92),concrete:makePierConcrete('weathered-pier-concrete',0xc9ceca),joint:makeMaterial('pier-expansion-joint',0x9ba4a0,.98),edge:makeMaterial('pier-coping',0xdbded8,.97),asphalt:makeMaterial('road',0x777d80,.98),dark:makeMaterial('harbour-dark',0x234452,.8),green:makeMaterial('palmetto',0x4f7655,.94),trunk:makeMaterial('palm-trunk',0x806b4c,1),red:makeMaterial('channel-red',0xc7473f,.84)};
 const GEO={box:new BoxGeometry(1,1,1),cyl:new CylinderGeometry(1,1,1,8),sphere:new SphereGeometry(1,8,6)};
 const addScaled=(geo,mat,x,y,z,sx,sy,sz,ry=0)=>{const mesh=new Mesh(geo,mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.rotation.y=ry;mesh.castShadow=false;mesh.receiveShadow=false;(visuals[visualKey]||=[]).push(mesh);group.add(mesh);return mesh;};
 const box=(mat,x,y,z,w,h,d,ry=0,collide=false,tag='bermuda',walkable=false)=>{const mesh=addScaled(GEO.box,mat,x,y,z,w,h,d,ry);if(collide)colliders.addBox(new Vector3(x,y,z),new Vector3(w*.5,h*.5,d*.5),ry,{tag,walkable});return mesh;};
 const cyl=(mat,x,y,z,r,h,collide=false,tag='bermuda')=>{const mesh=addScaled(GEO.cyl,mat,x,y,z,r,h,r);if(collide)colliders.addCylinder(x,z,r,y-h*.5,y+h*.5,{tag});return mesh;};
 const sphere=(mat,x,y,z,r)=>addScaled(GEO.sphere,mat,x,y,z,r,r,r);

 // Open beach: the former raised asphalt strip at z=-49.2 crossed the sand.
 // Remove its mesh AND walkable collider, retaining the dock approach and shops.
 visualKey='approach'; box(M.concrete,-65,.55,-30,5.2,.9,34,0,true,'bermuda-landing',true);
 // Beach-to-pier stairs are at the LANDWARD entrance of the existing dock (z=-47).
 // Begin at the actual sand elevation, then meet the 1.0m timber deck without a gap.
 // Tread height adapts in either direction to avoid an unwalkable lip on mobile.
 const pierTop=1.0,beachTop=Math.max(.05,Math.min(2.4,terrain.heightAt(-65,-50.1)));
 const stairCount=Math.max(4,Math.min(8,Math.ceil(Math.abs(pierTop-beachTop)/.18)));
 const stairZ0=-50.1,stairZ1=-47.0,treadDepth=(stairZ1-stairZ0)/stairCount;
 const stairBase=Math.min(pierTop,beachTop)-.18;
 visualKey='beach-pier-stairs';
 for(let i=0;i<stairCount;i++){
  const top=beachTop+(pierTop-beachTop)*(i+1)/stairCount,z=stairZ0+(i+.5)*treadDepth;
  box(M.concrete,-65,stairBase+(top-stairBase)*.5,z,5.2,top-stairBase,treadDepth+.025,0,true,'bermuda-beach-pier-step',true);
 }
 visualKey='shop-apron'; box(M.concrete,WATERFRONT_DECK.x,.55,WATERFRONT_DECK.z,WATERFRONT_DECK.width,.9,WATERFRONT_DECK.depth,0,true,'bermuda-shop-apron',true);
 // Seven subtle cast-concrete expansion joints replace 120 timber strips.
 // Non-colliding details preserve the original walkable concrete slab.
 const joints=new InstancedMesh(GEO.box,M.joint,7),matrix=new Matrix4();
 for(let i=0;i<7;i++){matrix.makeScale(WATERFRONT_DECK.width-.25,.009,.028).setPosition(WATERFRONT_DECK.x,1.0045,WATERFRONT_DECK.z-WATERFRONT_DECK.depth*.5+2.7+i*3.15);joints.setMatrixAt(i,matrix);}joints.instanceMatrix.needsUpdate=true;joints.computeBoundingSphere();group.add(joints);
 // Concrete coping along the two outer dock edges.
 visualKey='pier-coping';for(const x of [WATERFRONT_DECK.x-WATERFRONT_DECK.width*.5+.055,WATERFRONT_DECK.x+WATERFRONT_DECK.width*.5-.055])box(M.edge,x,.993,WATERFRONT_DECK.z,.09,.045,WATERFRONT_DECK.depth);
 const piles=new InstancedMesh(GEO.cyl,M.concrete,14),caps=new InstancedMesh(GEO.cyl,M.limestone,14);let n=0;
 for(const x of [WATERFRONT_DECK.x-WATERFRONT_DECK.width*.5+.18,WATERFRONT_DECK.x+WATERFRONT_DECK.width*.5-.18])for(let z=-36;z<=-15;z+=3.5){matrix.makeScale(.19,3.5,.19).setPosition(x,.25,z);piles.setMatrixAt(n,matrix);matrix.makeScale(.205,.10,.205).setPosition(x,2.04,z);caps.setMatrixAt(n,matrix);n++;colliders.addCylinder(x,z,.19,-1.5,2.1,{tag:'bermuda-piling'});}for(const mesh of [piles,caps]){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();group.add(mesh);}
 visualKey='dock';box(M.concrete,-64,.58,-14.5,5.4,.96,4.8,0,true,'bermuda-landing-head',true);visualKey='quay';
 for(const [x,z] of [[-68.8,-34],[-61.2,-34],[-68.8,-19],[-61.2,-19]])cyl(M.dark,x,1.34,z,.11,.7);

 // No cottages, roofs or residential collision boxes belong at the launch beach.
 // Residential geometry is a separate district, streamed only after the player approaches it.
 const moorings=mobileLite?[[-51,-2,M.roof],[-75,1,M.red]]:[[-51,-2,M.roof],[-75,1,M.red],[-88,12,M.roof],[-39,9,M.red]];for(const [x,z,mat] of moorings){sphere(mat,x,.38,z,.42);cyl(M.dark,x,.08,z,.035,.42);}
 if(!mobileLite){visualKey='channel-marker';cyl(M.limestone,-91,1.35,20,.22,2.7);cyl(M.red,-91,2.85,20,.38,.45);visualKey='palmetto';const palm=(x,z,height=5.8)=>{const y=terrain.heightAt(x,z);cyl(M.trunk,x,y+height*.5,z,.16,height);for(let i=0;i<4;i++){const a=i*Math.PI*.5;addScaled(GEO.box,M.green,x+Math.sin(a)*1.15,y+height+.12,z+Math.cos(a)*1.15,.35,.08,2.6,a);}};palm(-87.5,-61.5,5.4);palm(-53,-67,6);}
 scene.add(group);
 if(app.player){const p=app.player,landingY=colliders.groundHeightAt(START.x,START.z,50);p.mode='walk';p.position.set(START.x,Number.isFinite(landingY)?landingY+.02:1.02,START.z);p.velocity.set(0,0,0);p.yaw=START.yaw;p.pitch=-.045;p.grounded=true;p.waterMean=null;p.waterH=0;p.camInit=false;}
 app.bermudaBlockout={group,materials:M,start:START,mobileLite,visuals};return app.bermudaBlockout;
}