import { InstancedMesh, Matrix4, BoxGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, Vector3 } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';
import { WATERFRONT_DECK } from './bermuda/HarbourLayout.js';

const START = { x: - 63.4, z: - 20.0, yaw: Math.PI };
function makeMaterial(name,color,roughness=.9){return new Material({name:'bermuda-'+name,color,roughness,metalness:0,underwaterLighting:'lite',localLightsCheap:true,receiveShadows:false});}
function isMobileProfile(){if(typeof navigator==='undefined')return false;return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&Math.min(screen.width,screen.height)<1024);}

export function installBermudaBlockout(app){
 if(!app||!app.scene||!app.terrainData||!app.colliders||app.bermudaBlockout)return app&&app.bermudaBlockout;
 const scene=app.scene,terrain=app.terrainData,colliders=app.colliders,mobileLite=isMobileProfile(),group=new Group(),visuals={};
 group.name='BermudaWorldBlockout'; let visualKey='quay';
 const M={limestone:makeMaterial('limestone',0xe8e3d6,.96),roof:makeMaterial('white-roof',0xf5f4ed,.92),pink:makeMaterial('pastel-pink',0xe9a7aa,.92),yellow:makeMaterial('pastel-yellow',0xe3cc79,.92),blue:makeMaterial('pastel-blue',0x9fc4d5,.92),mint:makeMaterial('pastel-mint',0xaecdb6,.92),wood:makeMaterial('dock-wood',0x8a7052,.97),asphalt:makeMaterial('road',0x777d80,.98),dark:makeMaterial('harbour-dark',0x234452,.8),green:makeMaterial('palmetto',0x4f7655,.94),trunk:makeMaterial('palm-trunk',0x806b4c,1),red:makeMaterial('channel-red',0xc7473f,.84)};
 const GEO={box:new BoxGeometry(1,1,1),cyl:new CylinderGeometry(1,1,1,8),sphere:new SphereGeometry(1,8,6)};
 const addScaled=(geo,mat,x,y,z,sx,sy,sz,ry=0)=>{const mesh=new Mesh(geo,mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.rotation.y=ry;mesh.castShadow=false;mesh.receiveShadow=false;(visuals[visualKey]||=[]).push(mesh);group.add(mesh);return mesh;};
 const box=(mat,x,y,z,w,h,d,ry=0,collide=false,tag='bermuda',walkable=false)=>{const mesh=addScaled(GEO.box,mat,x,y,z,w,h,d,ry);if(collide)colliders.addBox(new Vector3(x,y,z),new Vector3(w*.5,h*.5,d*.5),ry,{tag,walkable});return mesh;};
 const cyl=(mat,x,y,z,r,h,collide=false,tag='bermuda')=>{const mesh=addScaled(GEO.cyl,mat,x,y,z,r,h,r);if(collide)colliders.addCylinder(x,z,r,y-h*.5,y+h*.5,{tag});return mesh;};
 const sphere=(mat,x,y,z,r)=>addScaled(GEO.sphere,mat,x,y,z,r,r,r);

 // Waterfront: keep the roadway open to the beach/car area. The old continuous limestone seawall
 // read as an artificial barrier and blocked the clean route between the road and waterfront.
 box(M.asphalt,-68,1.43,-49.2,34,.18,5,0,true,'bermuda-road',true);
 visualKey='approach'; box(M.wood,-65,.55,-30,5.2,.9,34,0,true,'bermuda-landing',true);
 // Smooth the final dock-to-road rise into five shallow walkable terraces. The old 0.5 m step
 // forced mobile players to use UP just to reach RELIC; normal navigation should not require a jump.
 const approachTops=[1.10,1.20,1.30,1.40,1.50];
 for(let i=0;i<approachTops.length;i++){
  const top=approachTops[i],z=-43.45-i*.82,h=top-.90;
  box(M.wood,-65,.90+h*.5,z,5.2,h,.90,0,true,'bermuda-approach-ramp',true);
 }
 visualKey='shop-apron'; box(M.wood,WATERFRONT_DECK.x,.55,WATERFRONT_DECK.z,WATERFRONT_DECK.width,.9,WATERFRONT_DECK.depth,0,true,'bermuda-shop-apron',true);
 const planks=new InstancedMesh(GEO.box,M.wood,120),matrix=new Matrix4();
 for(let i=0;i<120;i++){matrix.makeScale(WATERFRONT_DECK.width-.08,.045,.19).setPosition(WATERFRONT_DECK.x,.9775,WATERFRONT_DECK.z-WATERFRONT_DECK.depth*.5+.2+i*.2);planks.setMatrixAt(i,matrix);}planks.instanceMatrix.needsUpdate=true;planks.computeBoundingSphere();group.add(planks);
 const piles=new InstancedMesh(GEO.cyl,M.wood,14),caps=new InstancedMesh(GEO.cyl,M.limestone,14);let n=0;
 for(const x of [WATERFRONT_DECK.x-WATERFRONT_DECK.width*.5+.18,WATERFRONT_DECK.x+WATERFRONT_DECK.width*.5-.18])for(let z=-36;z<=-15;z+=3.5){matrix.makeScale(.19,3.5,.19).setPosition(x,.25,z);piles.setMatrixAt(n,matrix);matrix.makeScale(.205,.10,.205).setPosition(x,2.04,z);caps.setMatrixAt(n,matrix);n++;colliders.addCylinder(x,z,.19,-1.5,2.1,{tag:'bermuda-piling'});}for(const mesh of [piles,caps]){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();group.add(mesh);}
 visualKey='dock';box(M.wood,-64,.58,-14.5,5.4,.96,4.8,0,true,'bermuda-landing-head',true);visualKey='quay';
 for(const [x,z] of [[-68.8,-34],[-61.2,-34],[-68.8,-19],[-61.2,-19]])cyl(M.dark,x,1.34,z,.11,.7);

 const steppedRoof=(x,baseY,z,w,d,ry=0)=>{const steps=mobileLite?3:4;for(let i=0;i<steps;i++){const inset=i*.9;box(M.roof,x,baseY+i*.24,z,Math.max(2.8,w+1.1-inset),.24,Math.max(2.5,d+1.1-inset*.82),ry);}};
 const house=({x,z,w,d,h,mat,ry=0,id})=>{visualKey=id;const ground=terrain.heightAt(x,z);box(mat,x,ground+h*.5,z,w,h,d,ry,true,'bermuda-house');steppedRoof(x,ground+h+.14,z,w,d,ry);};
 house({x:-80,z:-69,w:10,d:7,h:4.6,mat:M.pink,ry:.06,id:'house-a'});house({x:-61,z:-73.5,w:8.4,d:6.4,h:4,mat:M.yellow,ry:-.05,id:'house-b'});
 if(!mobileLite){house({x:-92,z:-82,w:8,d:6,h:4.2,mat:M.blue,ry:.1,id:'house-a'});house({x:-46,z:-87,w:9,d:6.8,h:4.4,mat:M.mint,ry:-.12,id:'house-b'});}
 visualKey='quay';
 // Keep the dock-to-houses pedestrian corridor open. The previous two long retaining-wall
 // boxes were solid and acted as invisible route blockers on mobile.
 // Collision proxies for the additional Bermuda houses stop the player walking through scenery.
 for(const [x,z,w,d,h,tag] of [[-84,-54,6,5,6,'bermuda-house-c'],[-57,-61,7,5.5,5.5,'bermuda-house-d']]){
  const gy=terrain.heightAt(x,z);colliders.addBox(new Vector3(x,gy+h*.5,z),new Vector3(w*.5,h*.5,d*.5),0,{tag});
 }
 const moorings=mobileLite?[[-51,-2,M.roof],[-75,1,M.red]]:[[-51,-2,M.roof],[-75,1,M.red],[-88,12,M.roof],[-39,9,M.red]];for(const [x,z,mat] of moorings){sphere(mat,x,.38,z,.42);cyl(M.dark,x,.08,z,.035,.42);}
 if(!mobileLite){visualKey='channel-marker';cyl(M.limestone,-91,1.35,20,.22,2.7);cyl(M.red,-91,2.85,20,.38,.45);visualKey='palmetto';const palm=(x,z,height=5.8)=>{const y=terrain.heightAt(x,z);cyl(M.trunk,x,y+height*.5,z,.16,height);for(let i=0;i<4;i++){const a=i*Math.PI*.5;addScaled(GEO.box,M.green,x+Math.sin(a)*1.15,y+height+.12,z+Math.cos(a)*1.15,.35,.08,2.6,a);}};palm(-87.5,-61.5,5.4);palm(-53,-67,6);}
 scene.add(group);
 if(app.player){const p=app.player,landingY=colliders.groundHeightAt(START.x,START.z,50);p.mode='walk';p.position.set(START.x,Number.isFinite(landingY)?landingY+.02:1.02,START.z);p.velocity.set(0,0,0);p.yaw=START.yaw;p.pitch=-.045;p.grounded=true;p.waterMean=null;p.waterH=0;p.camInit=false;}
 app.bermudaBlockout={group,materials:M,start:START,mobileLite,visuals};return app.bermudaBlockout;
}