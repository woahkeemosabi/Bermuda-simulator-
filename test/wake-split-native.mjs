// Check the split physics/FFT boundary against an independent CPU DFT, then run a moving boat.
import './headless.mjs';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
navigator.userAgent='iPhone native wake regression';
const {GPU}=await import('../src/engine/gpu/GPU.js');
const {ShaderModule}=await import('../src/engine/gpu/Shader.js');
const {readBuffer}=await import('../src/engine/gpu/Readback.js');
const {G}=await import('../src/engine/render/Frame.js');
const {Vector3}=await import('../src/engine/index.js');
const {WakeSim}=await import('../src/ocean/WakeSim.js');
await GPU.init({headless:true});
const errors=[];GPU.device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
const terrainGPU={module:new ShaderModule({name:'deepWater',code:'fn terrainHeightAt(xz:vec2f)->f32{return -20.0;}'})};
const lines={zAft:-3.4,wlEnd:3.6,bottomAt(x,z){if(z<this.zAft||z>this.wlEnd||Math.abs(x)>1.1)return NaN;return -.4*(1-x*x/1.21);}};
let yaw=0;
const boat={model:{lines},position:new Vector3(),velocity:new Vector3(0,0,7),driven:true,throttle:.8,rpm:1,forward:v=>v.set(Math.sin(yaw),0,Math.cos(yaw))};
const started=performance.now(),wake=new WakeSim(null,{terrainGPU,boat});await GPU.pipelinesReady();
const compileMs=performance.now()-started,N=wake.display.width;
assert.equal(N,256);
const dispatch=wake._dispatch;wake._dispatch=()=>{};wake.update(1/60);wake._dispatch=dispatch;
G.time.value=1;G.dt.value=1/60;G.seaLevel.value=0;
const seed=new Float32Array(N*N*4);
for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=(y*N+x)*4;seed[i]=.02*Math.sin(x*.11)*Math.cos(y*.07);seed[i+1]=.001*Math.cos(x*.19);seed[i+2]=.03;seed[i+3]=.05;}
wake.state.write(seed);
GPU.beginFrame();wake.physicsKernel.dispatch([N/8,N/8,1]);GPU.submit();await GPU.whenIdle();
const input=new Float32Array(await readBuffer(wake.spec,wake.spec.byteLength));
assert.ok(input.some(v=>Math.abs(v)>.001));assert.ok(input.every(Number.isFinite));
GPU.beginFrame();wake.rowKernel.dispatch(N);GPU.submit();await GPU.whenIdle();
const actual=new Float32Array(await readBuffer(wake.spec,wake.spec.byteLength));
let maxError=0;
for(const y of [0,63,127,200,255])for(let k=0;k<N;k++)for(const pair of [0,2]){
 let re=0,im=0;
 for(let x=0;x<N;x++){
  const a=-2*Math.PI*k*x/N,c=Math.cos(a),s=Math.sin(a),i=(y*N+x)*4+pair;
  re+=input[i]*c-input[i+1]*s;im+=input[i]*s+input[i+1]*c;
 }
 const o=(y*N+k)*4+pair;
 maxError=Math.max(maxError,Math.abs(re-actual[o]),Math.abs(im-actual[o+1]));
}
assert.ok(maxError<.0005,'CPU DFT error '+maxError);
const frameMs=[];
for(let i=0;i<24;i++){
 yaw+=.003;boat.velocity.set(Math.sin(yaw)*7,0,Math.cos(yaw)*7);boat.position.addScaledVector(boat.velocity,1/60);G.time.value+=1/60;
 const start=performance.now();GPU.beginFrame();wake.update(1/60);GPU.submit();await GPU.whenIdle();frameMs.push(performance.now()-start);
}
const state=new Float32Array(await readBuffer(wake.state,wake.state.byteLength));
assert.ok(state.every(Number.isFinite));assert.ok(state.some(v=>Math.abs(v)>.001));assert.deepEqual(errors,[]);
const report={environment:'Dawn / software Vulkan ('+(process.env.VK_ICD_FILENAMES?.split('/').at(-1)||'ICD unspecified')+'), mobile 256x256 wake; not iPhone',passed:true,compileMs,maxRowDFTError:maxError,movingBoatFrames:24,frameMs,errors,logicalResources:GPU.resources};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2));console.log(JSON.stringify(report));process.exit(0);
