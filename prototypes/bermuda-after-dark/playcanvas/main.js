import * as pc from 'playcanvas';

const canvas=document.querySelector('#view');
const info=document.querySelector('#message'),fps=document.querySelector('#fps');
const error=document.querySelector('#error');
const device=await pc.createGraphicsDevice(canvas,{deviceTypes:[pc.DEVICETYPE_WEBGL2],antialias:false,alpha:false});
const app=new pc.AppBase(canvas);
const options=new pc.AppOptions();
options.graphicsDevice=device;
options.componentSystems=[pc.RenderComponentSystem,pc.CameraComponentSystem,pc.LightComponentSystem];
options.resourceHandlers=[];
app.init(options);
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
app.scene.ambientLight=new pc.Color(.46,.47,.60);

const mat=(r,g,b)=>{const m=new pc.StandardMaterial();m.diffuse=new pc.Color(r,g,b);m.metalness=0;m.gloss=5;m.update();return m;};
const wood=mat(.40,.28,.25),wood2=mat(.52,.40,.33),stone=mat(.43,.42,.48),pink=mat(.76,.38,.44),roof=mat(.43,.34,.40),sea=mat(.08,.47,.52),boatMat=mat(.67,.65,.58),shirt=mat(.83,.78,.66),skin=mat(.40,.25,.18),pants=mat(.50,.45,.33),white=mat(.84,.84,.76),green=mat(.24,.39,.29),lightMat=mat(.94,.81,.50);
function box(name,x,y,z,w,h,d,material){const e=new pc.Entity(name);e.addComponent('render',{type:'box',material});e.setPosition(x,y,z);e.setLocalScale(w,h,d);app.root.addChild(e);return e;}
function cylinder(name,x,y,z,w,h,material){const e=new pc.Entity(name);e.addComponent('render',{type:'cylinder',material});e.setPosition(x,y,z);e.setLocalScale(w,h,w);app.root.addChild(e);return e;}
function sphere(name,x,y,z,w,material){const e=new pc.Entity(name);e.addComponent('render',{type:'sphere',material});e.setPosition(x,y,z);e.setLocalScale(w,w,w);app.root.addChild(e);return e;}
// Low-cost animated wave mesh: independent of Tidewater FFT; vertex displacement plus dynamic normals.
const oceanEntity=new pc.Entity('animated ocean');
const size=160,segments=56,positions=[],indices=[],normals=[],uvs=[];
for(let z=0;z<=segments;z++)for(let x=0;x<=segments;x++){positions.push((x/segments-.5)*size,-.18,(z/segments-.5)*size-10);normals.push(0,1,0);uvs.push(x/segments,z/segments);}
for(let z=0;z<segments;z++)for(let x=0;x<segments;x++){const k=z*(segments+1)+x;indices.push(k,k+segments+1,k+1,k+1,k+segments+1,k+segments+2);}
const mesh=pc.createMesh(device,positions,{normals,uvs,indices});
const meshInstance=new pc.MeshInstance(mesh,sea,oceanEntity);
oceanEntity.addComponent('render',{meshInstances:[meshInstance]});
app.root.addChild(oceanEntity);
const waves=(x,z,t)=>.16*Math.sin(x*.32+z*.18+t*1.3)+.09*Math.sin(z*.71-x*.16-t*1.8)+.05*Math.sin(x*.98+z*.48+t*2.2);
function updateOcean(t){const vertices=mesh.vertexBuffer.lock(),view=new DataView(vertices),stride=mesh.vertexBuffer.getFormat().size;
const attr=mesh.vertexBuffer.getFormat().elements.find(e=>e.name===pc.SEMANTIC_POSITION);
const offset=attr.offset;
for(let i=0;i<positions.length/3;i++){const x=positions[i*3],z=positions[i*3+2];view.setFloat32(i*stride+offset+4,waves(x,z,t),true);}
mesh.vertexBuffer.unlock();
mesh.aabb=new pc.BoundingBox(new pc.Vec3(0,0,-10),new pc.Vec3(size/2,1,size/2));
}
box('dock',0,.2,0,5,.35,17,wood);
for(let z=-8;z<=8;z+=1.25){box('plank',0,.42,z,5.1,.08,.95,z%2?wood:wood2);}
for(let z=-7;z<=8;z+=4){for(const x of [-2.2,2.2])cylinder('dock post',x,-.6,z,.45,2.4,wood);}
box('pink cottage',-6,2.0,-5,6,4,6,pink);box('cottage roof',-6,4.2,-5,7,.65,7,roof);box('door',-3.02,1.1,-4.8,.12,2,1.2,wood);box('window',-2.99,2.5,-6.5,.1,1.3,1.3,stone);
for(let i=0;i<4;i++)box('crate',-1.9+i*.85,.95,1.0+i*.5,.75,.75,.75,wood2);
for(let i=0;i<5;i++){const x=-12+i*5,z=-27-i*3;box('cliff',x,3,z,7,6+i*.8,9,stone);cylinder('palm',x,8,z,.4,6,wood);sphere('canopy',x,11,z,4,green);}
box('fishing boat',7,.4,-8,4,.8,7,boatMat);box('cabin',7,1.55,-9.2,2.8,2.1,2.6,white);box('wheelhouse window',7,1.75,-7.85,1.9,.9,.1,stone);
cylinder('lighthouse',24,4,-43,3,10,white);box('lighthouse light',24,9.6,-43,4,1,4,lightMat);
const avatar=new pc.Entity('third-person avatar');app.root.addChild(avatar);
function childBox(name,x,y,z,w,h,d,m){const e=box(name,0,0,0,w,h,d,m);avatar.addChild(e);e.setLocalPosition(x,y,z);return e;}
childBox('body',0,1.28,0,.62,.86,.34,shirt);childBox('head',0,1.94,0,.39,.43,.36,skin);childBox('left arm',-.43,1.30,0,.22,.75,.25,skin);childBox('right arm',.43,1.30,0,.22,.75,.25,skin);childBox('left leg',-.18,.55,0,.24,.95,.28,pants);childBox('right leg',.18,.55,0,.24,.95,.28,pants);
avatar.setPosition(0,.53,5.2);
const camera=new pc.Entity('third-person follow camera');camera.addComponent('camera',{clearColor:new pc.Color(.38,.39,.55),fov:65,nearClip:.1,farClip:160});app.root.addChild(camera);
const sun=new pc.Entity('dusk light');sun.addComponent('light',{type:'directional',color:new pc.Color(.83,.77,.80),intensity:1.5,castShadows:false});sun.setEulerAngles(45,20,0);app.root.addChild(sun);
const keys=new Set(),pad=document.querySelector('#pad'),stick=document.querySelector('#stick');let axisX=0,axisY=0,activePointer=null;
function joystick(e){const rect=pad.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;const x=e.clientX-cx,y=e.clientY-cy,max=42,n=Math.max(1,Math.hypot(x,y)/max);axisX=x/n/max;axisY=y/n/max;stick.style.transform='translate('+x/n+'px,'+y/n+'px)';}
pad.addEventListener('pointerdown',e=>{e.preventDefault();activePointer=e.pointerId;pad.setPointerCapture(e.pointerId);joystick(e);});
pad.addEventListener('pointermove',e=>{if(e.pointerId===activePointer)joystick(e);});
function resetStick(e){if(e.pointerId!==activePointer)return;activePointer=null;axisX=axisY=0;stick.style.transform='translate(0,0)';}
for(const event of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(event,resetStick);
window.addEventListener('keydown',e=>{const k={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'}[e.key];if(k){keys.add(k);e.preventDefault();}if(e.key===' '||e.key==='Enter')act();});
window.addEventListener('keyup',e=>{const k={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'}[e.key];if(k)keys.delete(k);});
let quest=0;function act(){const p=avatar.getPosition();if(Math.hypot(p.x-7,p.z+8)<6){quest=1;info.textContent='BOAT FOUND · WebGL2 scene trial. Boarding and FFT ocean are not implemented yet.';}else info.textContent='Approach the fishing boat on the right to inspect it.';}
document.querySelector('#act').addEventListener('pointerdown',e=>{e.preventDefault();act()});
let count=0,time=0;
app.on('update',dt=>{dt=Math.min(dt,.05);let dx=axisX+Number(keys.has('right'))-Number(keys.has('left')),dz=axisY+Number(keys.has('down'))-Number(keys.has('up'));const magnitude=Math.hypot(dx,dz);if(magnitude>.04){const scale=Math.min(1,magnitude)/magnitude,p=avatar.getPosition();avatar.setPosition(pc.math.clamp(p.x+dx*scale*dt*3,-15,15),.53,pc.math.clamp(p.z+dz*scale*dt*3,-9,8));avatar.setEulerAngles(0,Math.atan2(-dx,-dz)*180/Math.PI,0);}const p=avatar.getPosition();const target=new pc.Vec3(p.x,p.y+3.4,p.z+6.8);camera.setPosition(target);camera.lookAt(p.x,p.y+1.2,p.z-5);updateOcean(performance.now()*.001);count++;time+=dt;if(time>1){fps.textContent=Math.round(count/time)+' FPS';time=0;count=0;}});
window.addEventListener('resize',()=>app.resizeCanvas());
app.start();
