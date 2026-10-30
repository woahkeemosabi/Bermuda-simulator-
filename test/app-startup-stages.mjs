// Actual App frame traversal, with unit doubles for GPU systems. No GPU validation.
import assert from 'node:assert/strict';
import {App} from '../src/App.js';
import {Environment} from '../src/sky/Environment.js';
import {GPU} from '../src/engine/gpu/GPU.js';
import {PerspectiveCamera,Vector3} from '../src/engine/index.js';
import {runStartupStages} from '../src/core/StartupStages.js';
const savedBegin=GPU.beginFrame,savedSubmit=GPU.submit;
function fixture(){
 const events=[],app=Object.create(App.prototype),fn=name=>(...args)=>events.push(name);
 app.settings={timeSpeed:0,timeOfDay:16,exposure:0.55};app.qs=new URLSearchParams('desktop');app.mobileLite=false;
 app.camera=new PerspectiveCamera();app.engine={meshRenderer:{}};app.scene={};
 app.input={hit:()=>false,endFrame:fn('input.end')};
 for(const name of ['boatCtl','boatSpray','wake','mobileWake','player','game','atmosphere','fft','seaDetail','query','caustics','marineSnow','airMotes','shoreSim','underwaterLighting','breakers','spray','clouds','oceanLOD','terrain','rocks','reef','village','vegetation','whale','boat','wildlife','localLights','profiler','ui']) app[name]={update:fn(name)};
 for(const name of ['updateFPS','updateWeather','updateSun','applyAtmosphereReadback','updateAudio'])app[name]=fn(name);
 app.query.setCamera=fn('query.camera');app.boatCtl.queueQueries=fn('boat.queries');
 app.shadows={update:fn('shadows.update'),render:fn('shadows.render')};
 app.post={lens:{update:fn('lens')},flare:{setDepthHeight:fn('flare.depth'),update:fn('flare.update'),kernel:{dispatch:fn('flare.dispatch')}},beginFrame:fn('post.begin'),render:fn('post.render'),endFrame:fn('post.end')};
 app.sceneRenderer={sceneRT:{height:695},render:fn('scene.render')};app.underwater={updateCamera:fn('underwater.camera')};
 app.environment=Object.assign(Object.create(Environment.prototype),{sky:{atmosphere:{sunDir:{value:new Vector3(0,1,0)}}},lastSun:new Vector3(),interval:3,timer:0,step:-1,primed:false,progressivePrime:false,refreshCount:0,front:0});
 app.environment.steps=Array.from({length:15},(_,i)=>()=>{events.push('reflection.'+i);if(i===14)app.environment.front=1;});
 GPU.beginFrame=()=>{GPU.frame++;events.push('begin');};GPU.submit=fn('submit');
 return {app,events};
}
try{
 const normal=fixture();normal.app._frame(1/60);assert.equal(normal.events.filter(x=>x==='submit').length,1);
 const staged=fixture();let submissions=0;
 await runStartupStages(staged.app._frameSteps(1/60,true),{ready:()=>Promise.resolve(),submit:()=>submissions++,done:()=>Promise.resolve(),check:()=>{}});
 assert.deepEqual(staged.events,normal.events.filter(x=>x!=='submit'),'All system calls and reflection bake steps retained in order');
 assert.ok(submissions>15);assert.equal(staged.app.environment.front,1);assert.equal(staged.app.environment.step,-1);assert.equal(staged.app.environment.progressivePrime,false);
 const aborted=fixture(),it=aborted.app._frameSteps(1/60,true);let next;do{next=it.next();}while(!next.done&&next.value!=='reflection-prime-0');assert.equal(aborted.app.environment.progressivePrime,true);it.return();assert.equal(aborted.app.environment.progressivePrime,false);
 console.log('Actual App traversal preserves full-system order and every reflection step; normal play submits once; abort restores priming (unit doubles only).');
}finally{GPU.beginFrame=savedBegin;GPU.submit=savedSubmit;}
