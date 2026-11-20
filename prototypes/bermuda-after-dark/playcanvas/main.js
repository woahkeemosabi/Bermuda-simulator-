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
const boat=new pc.Entity('boardable fishing boat');app.root.addChild(boat);
function boatBox(name,x,y,z,w,h,d,m){const e=box(name,0,0,0,w,h,d,m);boat.addChild(e);e.setLocalPosition(x,y,z);return e;}
boatBox('hull',0,0,0,3.5,.9,6.5,boatMat);
boatBox('deck',0,.55,0,3.1,.18,5.8,wood2);
boatBox('cabin',0,1.55,-1.3,2.4,1.8,2.1,white);
boatBox('wheelhouse window',0,1.75,-.2,1.9,.9,.1,stone);
boat.setPosition(4.4,.15,-5.3);
cylinder('lighthouse',24,4,-43,3,10,white);box('lighthouse light',24,9.6,-43,4,1,4,lightMat);
// Hierarchical articulated character rig. This is a procedural joint rig, not a skinned GLB.
const avatar=new pc.Entity('character root');app.root.addChild(avatar);
function joint(parent,name,x,y,z){const e=new pc.Entity(name);parent.addChild(e);e.setLocalPosition(x,y,z);return e;}
function rigBox(parent,name,x,y,z,w,h,d,m){const e=new pc.Entity(name);e.addComponent('render',{type:'box',material:m});parent.addChild(e);e.setLocalPosition(x,y,z);e.setLocalScale(w,h,d);return e;}
const hips=joint(avatar,'hips',0,.95,0);
rigBox(hips,'pelvis',0,0,0,.48,.32,.30,pants);
const spine=joint(hips,'spine',0,.25,0);
rigBox(spine,'torso',0,.25,0,.62,.68,.34,shirt);
const neck=joint(spine,'neck',0,.67,0);
rigBox(neck,'head',0,.24,0,.38,.45,.37,skin);
rigBox(neck,'hair',0,.46,-.025,.40,.13,.39,roof);
const leftShoulder=joint(spine,'left shoulder',-.39,.53,0),rightShoulder=joint(spine,'right shoulder',.39,.53,0);
const leftElbow=joint(leftShoulder,'left elbow',0,-.37,0),rightElbow=joint(rightShoulder,'right elbow',0,-.37,0);
rigBox(leftShoulder,'left upper arm',0,-.18,0,.22,.39,.25,shirt);
rigBox(rightShoulder,'right upper arm',0,-.18,0,.22,.39,.25,shirt);
rigBox(leftElbow,'left forearm',0,-.18,0,.19,.37,.21,skin);
rigBox(rightElbow,'right forearm',0,-.18,0,.19,.37,.21,skin);
const leftHip=joint(hips,'left hip',-.18,-.15,0),rightHip=joint(hips,'right hip',.18,-.15,0);
const leftKnee=joint(leftHip,'left knee',0,-.44,0),rightKnee=joint(rightHip,'right knee',0,-.44,0);
rigBox(leftHip,'left thigh',0,-.22,0,.24,.48,.29,pants);
rigBox(rightHip,'right thigh',0,-.22,0,.24,.48,.29,pants);
rigBox(leftKnee,'left shin',0,-.20,0,.20,.42,.24,pants);
rigBox(rightKnee,'right shin',0,-.20,0,.20,.42,.24,pants);
rigBox(leftKnee,'left shoe',0,-.40,-.08,.25,.15,.42,roof);
rigBox(rightKnee,'right shoe',0,-.40,-.08,.25,.15,.42,roof);
const dockGround=.46;avatar.setPosition(0,dockGround,5.2);
let gaitPhase=0,gaitWeight=0;
function animateCharacter(dt,speed,t){
 const target=pc.math.clamp(speed/3,0,1);
 gaitWeight+=(target-gaitWeight)*Math.min(1,dt*10);
 gaitPhase+=dt*(2.0+speed*2.5);
 const swing=Math.sin(gaitPhase)*gaitWeight;
 const lift=Math.max(0,Math.sin(gaitPhase))*gaitWeight;
 leftHip.setLocalEulerAngles(swing*29,0,0);rightHip.setLocalEulerAngles(-swing*29,0,0);
 leftKnee.setLocalEulerAngles(Math.max(0,-swing)*36,0,0);
 rightKnee.setLocalEulerAngles(Math.max(0,swing)*36,0,0);
 leftShoulder.setLocalEulerAngles(-swing*25+4,0,5);
 rightShoulder.setLocalEulerAngles(swing*25+4,0,-5);
 leftElbow.setLocalEulerAngles(-12-Math.max(0,swing)*12,0,0);
 rightElbow.setLocalEulerAngles(-12-Math.max(0,-swing)*12,0,0);
 hips.setLocalPosition(0,.95+Math.abs(swing)*.035+Math.sin(t*1.8)*.008*(1-gaitWeight),0);
 spine.setLocalEulerAngles(2*Math.sin(t*1.3)*(1-gaitWeight),0,-2*Math.sin(t*.9));
}
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
let aboard=false,boatSpeed=0,boatHeading=0;
function act(){
 if(aboard){const p=boat.getPosition();if(Math.abs(p.x)>7||p.z < -10||p.z>10||Math.abs(boatSpeed)>.7){info.textContent='Return alongside the dock and slow down before disembarking.';return;}aboard=false;boatSpeed=0;avatar.enabled=true;avatar.setPosition(1.8,dockGround,pc.math.clamp(p.z,-7.5,7.5));info.textContent='Disembarked · joystick to walk';return;}
 const p=avatar.getPosition(),b=boat.getPosition();
 if(Math.hypot(p.x-b.x,p.z-b.z)<6.5 && p.z<0){aboard=true;avatar.enabled=false;info.textContent='BOARDED · joystick up/down = throttle · left/right = steer · ACT = exit';}
 else info.textContent='Walk to the right edge of the dock beside the boat to board.';
}
document.querySelector('#act').addEventListener('pointerdown',e=>{e.preventDefault();act()});
let count=0,time=0;
app.on('update',dt=>{
 dt=Math.min(dt,.05);
 const dx=axisX+Number(keys.has('right'))-Number(keys.has('left'));
 const dz=axisY+Number(keys.has('down'))-Number(keys.has('up'));
 const magnitude=Math.hypot(dx,dz);
 const walkSpeed=aboard?0:Math.min(1,magnitude)*3;
 const t=performance.now()*.001;
 if(aboard){
   // Up accelerates forward, down brakes then reverses. Neutral joystick gradually reduces speed.
   const throttle=-pc.math.clamp(dz,-1,1);
   boatSpeed=pc.math.clamp(boatSpeed+throttle*dt*2.2,-2.0,5);
   if(Math.abs(throttle)<.08)boatSpeed*=Math.exp(-.45*dt);
   // Positive X on the stick means a starboard/right turn in screen/world coordinates.
   boatHeading+=dx*dt*(.35+Math.abs(boatSpeed)*.12)*(boatSpeed < -.1 ? -1 : 1);
   const p=boat.getPosition();
   const bx=p.x+Math.sin(boatHeading)*boatSpeed*dt,bz=p.z-Math.cos(boatHeading)*boatSpeed*dt;
   boat.setPosition(bx,waves(bx,bz,t)*.45+.15,bz);
   boat.setEulerAngles(Math.sin(t*1.4)*1.6,-boatHeading*180/Math.PI,Math.cos(t*1.1)*2);
 } else if(magnitude>.04){
   const scale=Math.min(1,magnitude)/magnitude,p=avatar.getPosition();
   avatar.setPosition(pc.math.clamp(p.x+dx*scale*dt*3,-2.05,2.05),dockGround,pc.math.clamp(p.z+dz*scale*dt*3,-7.9,8));
   avatar.setEulerAngles(0,Math.atan2(-dx,-dz)*180/Math.PI,0);
 }
 const p=aboard?boat.getPosition():avatar.getPosition();
 if(aboard){camera.setPosition(p.x-Math.sin(boatHeading)*9,p.y+4.6,p.z+Math.cos(boatHeading)*9);camera.lookAt(p.x+Math.sin(boatHeading)*5,p.y+1.2,p.z-Math.cos(boatHeading)*5);}else{camera.setPosition(p.x,p.y+3.3,p.z+6.8);camera.lookAt(p.x,p.y+1.3,p.z-5);}
 animateCharacter(dt,walkSpeed,t);
 updateOcean(t);
 count++;time+=dt;if(time>1){fps.textContent=Math.round(count/time)+' FPS';time=0;count=0;}
});
window.addEventListener('resize',()=>app.resizeCanvas());
app.start();
