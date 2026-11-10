import { Group, Mesh, Vector3 } from '../engine/index.js';
import { box, roundedBox, cylinder, prepare, mergePrepared, mat4 } from '../world/boat/GeoKit.js';
import { Vendor } from './Vendor.js';
import {
 SOUND_START, SOUND_MARKS, SOUND_MARK_RADIUS, METERS_TO_KNOTS,
 raceState, sailStep, aiHelm, advanceMark, distanceToMark, distanceProgress, headingTo, angleDelta,
} from './RaceSoundRules.js';
import './RaceTheSoundMinigame.css';

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const MARSHAL={x:-65.9,y:1.13,z:-13.55};
const TEAMS=[{name:'BDA',color:0x00bdd3},{name:'GBR',color:0xd93542},{name:'AUS',color:0xf7b51e}];
const PARKED=[{x:-79,z:6,h:.34,color:0xf5f4eb},{x:-85,z:19,h:-.25,color:0xe8ad48}];
const PATROLS=[{x:-95,z:44,r:20,phase:0,color:0xcdd9e1},{x:-100,z:27,r:12,phase:Math.PI,color:0x3a87b4}];

// Reuses the existing fishing prop material/pipeline; no bitmap textures,
// second WebGPU context, additional ocean, new renderer or compute passes.
function createCatamaran(material,color,label){
 const root=new Group();root.name='RaceTheSound:'+label;
 const parts=[],add=(geo,c,m,rough=.46,metal=.08)=>parts.push(prepare(geo,{color:c,rough,metal,matrix:m}));
 for(const sign of [-1,1]){
   add(roundedBox(.8,.54,7.8,.19,2),color,mat4(sign*1.81,-.04,0),.36);
   add(box(.12,.38,3.4),0x344951,mat4(sign*1.81,-.54,-.5),.4,.4);
   add(box(.76,.09,.13),0x283b49,mat4(sign*1.81,-.52,1.55),.34,.42);
 }
 for(const z of [-2,.9,2.5])add(box(4.05,.18,.23),0x303c4a,mat4(0,.3,z),.45,.35);
 add(roundedBox(2.35,.14,2.65,.04,2),0x9ea6b0,mat4(0,.42,-.75),.52);
 add(box(.7,.08,1.1),0x1a2b35,mat4(0,.57,-.9),.24);
 const hull=new Mesh(mergePrepared(parts),material);
 hull.name=label+':hulls-and-hydrofoils';hull.castShadow=false;hull.receiveShadow=false;
 root.add(hull);
 const wingParts=[],wing=(g,c,m)=>wingParts.push(prepare(g,{color:c,rough:.35,metal:.1,matrix:m}));
 wing(roundedBox(.18,7.2,1.58,.07,2),color,mat4(0,3.8,.65));
 wing(box(.12,6.1,.09),0xe5ebeb,mat4(0,3.7,1.46));
 wing(box(.2,.16,2.75),0x2b3948,mat4(0,1,0));
 const sail=new Mesh(mergePrepared(wingParts),material);
 sail.name=label+':independent-wing';sail.castShadow=false;sail.receiveShadow=false;
 root.add(sail);
 return {root,sail};
}
// Distinct Bermuda-style harbour workboats/patrols, not duplicate racing cats.
// Reuse the single existing fishing material and low-poly geometric hull.
function createMotorboat(material,color,label,patrol=false){
 const root=new Group();root.name='BermudaHarbour:'+label;
 const p=[],add=(g,c,m)=>p.push(prepare(g,{color:c,rough:.46,metal:.12,matrix:m}));
 add(roundedBox(patrol?2.5:2.75,.76,patrol?6.4:6.1,.34,2),color,mat4(0,0,0));
 add(box(2.24,.10,4.6),0xe1e8e7,mat4(0,.45,-.25));
 add(roundedBox(1.65,1.25,2.3,.16,2),patrol?0xdfeaf2:0xf7efe3,mat4(0,1.06,-.65));
 add(box(1.47,.38,.06),0x294657,mat4(0,1.29,.55));
 add(box(1.4,.13,.3),0x293742,mat4(0,.55,2.75));
 add(cylinder(.035,.035,1.4,6),0x9caeb2,mat4(.5,2.30,-.82));
 if(patrol){
   add(box(.45,.12,.18),0x1557b7,mat4(-.32,1.76,-.3));
   add(box(.45,.12,.18),0xd13537,mat4(.32,1.76,-.3));
 }else{
   add(box(.5,.3,.7),0x635c4b,mat4(.85,.63,-2.1));
   add(box(.5,.3,.7),0x635c4b,mat4(-.85,.63,-2.1));
 }
 const hull=new Mesh(mergePrepared(p),material);
 hull.castShadow=false;hull.receiveShadow=false;
 root.add(hull);
 return {root,sail:null};
}
function makeGate(material,prev,mark,i){
 const group=new Group();group.name='RaceTheSound:gate'+(i+1);
 const dx=mark.x-prev.x,dz=mark.z-prev.z,d=Math.max(1,Math.hypot(dx,dz));
 const px=dz/d,pz=-dx/d,parts=[];
 for(const side of [-1,1]){
   const x=side*6.2*px,z=side*6.2*pz,color=side<0?0x32c5a1:0xeb635b;
   parts.push(prepare(cylinder(.42,.57,.75,10),{color,rough:.5,matrix:mat4(x,.35,z)}));
   parts.push(prepare(cylinder(.07,.07,2.2,8),{color:0xf1f4ec,rough:.35,matrix:mat4(x,1.22,z)}));
   parts.push(prepare(box(.56,.37,.13),{color,rough:.5,matrix:mat4(x,2.28,z)}));
 }
 const mesh=new Mesh(mergePrepared(parts),material);mesh.castShadow=false;mesh.receiveShadow=false;
 group.add(mesh);group.position.set(mark.x,0,mark.z);group.visible=false;
 return group;
}

export class RaceTheSoundMinigame{
 constructor(app,game){
   this.app=app;this.game=game;this.active=false;this.complete=false;this.offered=false;
   this.t=0;this.countdown=3.2;this.cameraMode=0;this.cameraSet=false;
   this.touch={left:false,right:false,throttle:false,brake:false};
   this.material=game.stand.material;
   this.marshal=new Vendor({
     name:'Skipper · Race the Sound',kind:'race',position:new Vector3(MARSHAL.x,MARSHAL.y,MARSHAL.z),
     yaw:Math.PI,radius:2.8,material:this.material,
     greeting:'Race the Sound. Three foiling cats, one finish line.',
     idle:'Talk to me whenever you are ready for the race.',
     look:{shirt:0x0d8d9f,trousers:0x172b3a,hat:0xe3e5db,skin:0x9d7456},
   });
   app.scene.add(this.marshal.group);
   const markerParts=[
     prepare(cylinder(.08,.08,2.3,8),{color:0xf4f3e9,matrix:mat4(0,1.35,0)}),
     prepare(box(.78,.50,.14),{color:0x00b9cf,matrix:mat4(0,2.40,0)}),
   ];
   const marker=new Mesh(mergePrepared(markerParts),this.material);
   marker.castShadow=false;marker.receiveShadow=false;marker.position.set(MARSHAL.x-.95,MARSHAL.y,MARSHAL.z);
   app.scene.add(marker);
   this.playerBoat=createCatamaran(this.material,TEAMS[0].color,'BDA');
   this.opponents=TEAMS.slice(1).map(v=>({...v,...createCatamaran(this.material,v.color,v.name),state:raceState()}));
   this.harbourBoats=PARKED.map((v,i)=>({...v,...createMotorboat(this.material,v.color,'MOORED'+i)}));
   this.patrolBoats=PATROLS.map((v,i)=>({...v,...createMotorboat(this.material,v.color,'PATROL'+i,true)}));
   for(const b of [this.playerBoat,...this.opponents,...this.harbourBoats,...this.patrolBoats])app.scene.add(b.root);
   for(const b of this.opponents)b.root.visible=false;
   this.gates=SOUND_MARKS.map((mark,i)=>{const g=makeGate(this.material,i===0?SOUND_START:SOUND_MARKS[i-1],mark,i);app.scene.add(g);return g;});
   this.waterSlot=-1;
   try{this.waterSlot=app.query.allocate('race-sound-v1',1+this.opponents.length+this.harbourBoats.length+this.patrolBoats.length)}
   catch(e){console.warn('Race The Sound water queries unavailable; rendering at sea level',e);}
   this.own=raceState();this.returnPose=null;this.ui=null;
   this.buildUI();
 }
 buildUI(){
   if(typeof document==='undefined')return;
   const root=document.createElement('div');root.id='rts-root';
   root.innerHTML='<section id="rts-dialog" role="dialog" aria-label="Race the Sound"><h3 id="rts-dialog-head">RACE THE SOUND</h3><p id="rts-dialog-text"></p><div class="rts-actions"><button id="rts-primary">Enter Race</button><button class="rts-ghost" id="rts-dismiss">Not now</button></div></section>'+
   '<div id="rts-top"><div><div class="rts-name">RACE THE SOUND · BDA</div><div id="rts-stage" class="rts-hint">HARBOUR QUALIFIER</div></div><div style="text-align:center"><div id="rts-time" class="rts-stat">00:00</div><div id="rts-mark" class="rts-hint">START</div></div><div style="text-align:right"><div id="rts-speed" class="rts-stat">0 KTS</div><div id="rts-place" class="rts-hint">1 / 3</div></div></div>'+
   '<div id="rts-controls"><div style="display:flex;gap:8px;align-items:flex-end"><button data-touch="left">◀ LEFT</button><button data-touch="right">RIGHT ▶</button></div><div style="display:flex;gap:8px;align-items:flex-end"><button class="rts-small" id="rts-exit">EXIT</button><button class="rts-small" id="rts-camera">CAM</button><button class="rts-small" data-touch="brake">SLOW</button><button data-touch="throttle">ACCEL</button></div></div>';
   document.body.appendChild(root);this.ui=root;
   root.querySelector('#rts-primary').addEventListener('click',()=>this._onPrimary());
   root.querySelector('#rts-dismiss').addEventListener('click',()=>this._onDismiss());
   root.querySelector('#rts-camera').addEventListener('click',()=>this.changeCamera());
   root.querySelector('#rts-exit').addEventListener('click',()=>this.leave());
   for(const el of root.querySelectorAll('[data-touch]')){
     const type=el.dataset.touch;
     el.addEventListener('pointerdown',e=>{e.preventDefault();this.touch[type]=true;el.setPointerCapture?.(e.pointerId)});
     for(const evt of ['pointerup','pointercancel','lostpointercapture','pointerleave'])el.addEventListener(evt,()=>{this.touch[type]=false});
   }
   window.addEventListener('blur',()=>this.releaseTouch());
 }
 releaseTouch(){for(const key in this.touch)this.touch[key]=false;}
 offer(){
   if(this.active||!this.ui)return;
   this.offered=true;
   this.ui.querySelector('#rts-dialog-head').textContent='RACE THE SOUND';
   this.ui.querySelector('#rts-dialog-text').textContent='A hydrofoil catamaran is waiting by the pier. Race GBR and AUS through six buoy gates, riding Bermuda Simulator’s existing FFT ocean. No boat purchase needed.';
   this.ui.querySelector('#rts-primary').textContent='START RACE';
   this.ui.querySelector('#rts-dismiss').textContent='NOT NOW';
   this.ui.querySelector('#rts-dialog').classList.add('is-on');
 }
 closeOffer(){this.offered=false;this.ui?.querySelector('#rts-dialog')?.classList.remove('is-on');}
 _onPrimary(){if(!this.active||this.complete)this.start();}
 _onDismiss(){if(this.active)this.leave();else this.closeOffer();}
 start(){
   const p=this.app.player;
   if(!this.active)this.returnPose={position:p.position.clone(),yaw:p.yaw,pitch:p.pitch};
   this.closeOffer();this.releaseTouch();
   this.active=true;this.complete=false;this.t=0;this.countdown=3.2;this.cameraMode=0;this.cameraSet=false;
   this.own=raceState(SOUND_START.x,SOUND_START.z,SOUND_START.heading);
   this.opponents.forEach((b,i)=>{b.state=raceState(SOUND_START.x+(i?9:-9),SOUND_START.z-7,SOUND_START.heading);b.root.visible=true;});
   for(const g of this.gates)g.visible=true;
   this.game.cancelLine(true);this.game.rod.equip(false);
   p.mode='race';p.busy=true;p.prompt=null;p.camInit=false;
   this.app.input.pressed.delete('KeyE');
   document.body.classList.add('rts-racing');
   this.syncRaceBoats();
   this.updateCamera(.016);this.updateHUD();
 }
 leave(){
   this.active=false;this.complete=false;this.releaseTouch();this.closeOffer();
   document.body.classList.remove('rts-racing');
   for(const b of this.opponents)b.root.visible=false;
   for(const g of this.gates)g.visible=false;
   this.playerBoat.root.position.set(SOUND_START.x,0,SOUND_START.z);
   this.playerBoat.root.rotation.set(0,0,0);
   this.own=raceState();
   const p=this.app.player,old=this.returnPose;
   p.mode='walk';p.busy=false;p.prompt=null;
   if(old){p.position.copy(old.position);p.yaw=old.yaw;p.pitch=old.pitch;}
   p.velocity.set(0,0,0);p.camInit=false;p._camY=null;p.waterMean=null;
   this.returnPose=null;this.cameraSet=false;
 }
 waterLevel(i,x,z){
   if(this.waterSlot<0||!this.app.query?.cpuValid)return 0;
   this.app.query.setPoint(this.waterSlot+i,x,z);
   const y=this.app.query.cpu[(this.waterSlot+i)*4];
   return Number.isFinite(y)?y:0;
 }
 placeAtWater(boat,x,z,heading,lift=0,bank=0,slot=-1){
   const y=slot>=0?this.waterLevel(slot,x,z):0;
   boat.root.position.x=x;boat.root.position.z=z;
   boat.root.position.y+=(y+lift-boat.root.position.y)*.16;
   boat.root.rotation.y=heading;boat.root.rotation.z=bank;
   if(boat.sail)boat.sail.rotation.y=Math.sin(this.t*.7+heading)*.12;
 }
 updateHarbour(dt){
   this.t+=clamp(dt,0,.05);
   this.harbourBoats.forEach((b,i)=>this.placeAtWater(b,b.x,b.z,b.h,0,.008,3+i));
   this.patrolBoats.forEach((b,i)=>{
     const a=this.t*.075+b.phase,x=b.x+Math.cos(a)*b.r,z=b.z+Math.sin(a)*b.r;
     this.placeAtWater(b,x,z,-a+Math.PI/2,0,.018,5+i);
   });
   if(!this.active)this.placeAtWater(this.playerBoat,SOUND_START.x,SOUND_START.z,SOUND_START.heading,0,.012,0);
 }
 syncRaceBoats(){
   this.placeAtWater(this.playerBoat,this.own.x,this.own.z,this.own.heading,this.own.foil*.63,-this.own.steering*.09,0);
   this.opponents.forEach((b,i)=>this.placeAtWater(b,b.state.x,b.state.z,b.state.heading,b.state.foil*.63,-b.state.steering*.09,1+i));
 }
 step(dt){
   if(!this.active)return;
   const h=clamp(dt,0,.05),inp=this.app.input,p=this.app.player;
   this.updateHarbour(h);
   if(inp.hit('Escape')){this.leave();return;}
   if(inp.hit('KeyV'))this.changeCamera();
   if(this.countdown>0)this.countdown-=h;
   else if(!this.complete){
     const throttle=this.touch.throttle||inp.down('KeyW')||inp.down('ArrowUp')?1:0;
     const steer=(this.touch.right||inp.down('KeyD')||inp.down('ArrowRight')?1:0)-(this.touch.left||inp.down('KeyA')||inp.down('ArrowLeft')?1:0);
     const brake=this.touch.brake||inp.down('KeyS')||inp.down('ArrowDown');
     sailStep(this.own,{throttle,steer,brake},h);
     const advanced=advanceMark(this.own);
     if(advanced&&this.own.finishTime!==null)this.finish();
     else if(advanced)this.game.toast('MARK '+this.own.gate+' / '+SOUND_MARKS.length+' CLEARED',1000);
     this.opponents.forEach((b,i)=>{
       if(b.state.finishTime!==null)return;
       const mark=SOUND_MARKS[b.state.gate];if(!mark)return;
       sailStep(b.state,aiHelm(b.state,mark,i===0?16:17.4),h);
       advanceMark(b.state);
     });
   }
   this.syncRaceBoats();
   p.position.set(this.own.x,this.playerBoat.root.position.y+1.1,this.own.z);
   p.prompt=null;p.busy=true;
   this.app.query.setPoint(p.slot,this.own.x,this.own.z);
   this.updateCamera(h);this.updateHUD();
 }
 changeCamera(){this.cameraMode=(this.cameraMode+1)%3;}
 updateCamera(dt){
   const b=this.own,cam=this.app.camera,fx=Math.sin(b.heading),fz=Math.cos(b.heading);
   const mode=this.cameraMode,target=new Vector3();
   if(mode===0)target.set(b.x-fx*13,7.2,b.z-fz*13);
   else if(mode===1)target.set(b.x+fx*.5,3.65,b.z+fz*.5);
   else target.set(b.x-fx*22,35,b.z-fz*22);
   if(!this.cameraSet){cam.position.copy(target);this.cameraSet=true;}
   else cam.position.lerp(target,1-Math.exp(-clamp(dt,0,.08)*4));
   cam.lookAt(new Vector3(b.x+fx*(mode===1?25:9),mode===2?.5:2.4,b.z+fz*(mode===1?25:9)));
 }
 standings(){
   const me=this.own;
   let ahead=0;
   for(const b of this.opponents){
     const other=b.state;
     if(me.finishTime===null){
       if(other.finishTime!==null||distanceProgress(other)>distanceProgress(me))ahead++;
     }else if(other.finishTime!==null&&other.finishTime<me.finishTime)ahead++;
   }
   return ahead+1;
 }
 finish(){
   if(this.complete)return;
   this.complete=true;
   const rank=this.standings(),reward=rank===1?150:rank===2?85:45;
   this.game.state.addMoney(reward);
   if(this.ui){
     this.ui.querySelector('#rts-dialog-head').textContent=rank===1?'YOU WON THE SOUND!':'RACE COMPLETE';
     this.ui.querySelector('#rts-dialog-text').textContent='BDA finished '+rank+' / 3 in '+this.formatTime(this.own.finishTime)+'. Race reward: BMD $'+reward+'. The supplied race boat and your fishing boat are separate.';
     this.ui.querySelector('#rts-primary').textContent='RACE AGAIN';
     this.ui.querySelector('#rts-dismiss').textContent='BACK TO PIER';
     this.ui.querySelector('#rts-dialog').classList.add('is-on');
   }
 }
 formatTime(t){
   const v=Math.max(0,t||0),m=Math.floor(v/60),s=Math.floor(v%60);
   return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
 }
 updateHUD(){
   if(!this.ui||!this.active)return;
   const next=SOUND_MARKS[this.own.gate],turn=next?angleDelta(headingTo(this.own,next),this.own.heading):0;
   const cue=turn>.18?'TURN RIGHT':turn<-.18?'TURN LEFT':'STRAIGHT';
   this.ui.querySelector('#rts-stage').textContent=this.complete?'RACE FINISHED':this.countdown>0?'START IN '+Math.max(1,Math.ceil(this.countdown)):'NEXT · '+(next?.name||'FINISH')+' · '+Math.round(distanceToMark(this.own,next))+'m · '+cue;
   this.ui.querySelector('#rts-mark').textContent=this.complete?'FINISHED':'MARK '+Math.min(this.own.gate+1,SOUND_MARKS.length)+' / '+SOUND_MARKS.length;
   this.ui.querySelector('#rts-time').textContent=this.formatTime(this.own.time);
   this.ui.querySelector('#rts-speed').textContent=Math.round(this.own.speed*METERS_TO_KNOTS)+' KTS';
   this.ui.querySelector('#rts-place').textContent=this.standings()+' / 3';
 }
}
