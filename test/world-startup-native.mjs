// Full App startup under native WebGPU with DOM stubs. Does not test Safari or UI interaction.
import {create,globals} from 'webgpu';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/package.json');
const {createCanvas,Image}=require('@napi-rs/canvas');const sharp=require('sharp');
Object.assign(globalThis,globals);
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:create([]),userAgent:'iPhone native test',maxTouchPoints:5}});
globalThis.location={search:'?scale=1&graphics=75&cloudtest=panorama&envtest=skip&gpuTrace=1&traceCase=fftcore&qualityTest=crisp&perf=60&resCap=462&simBudget=balanced&cloudBudget=lattice&fx=coastal-seven&G=12&noHaze=1&noAudio=1',href:'http://local/'};
globalThis.screen={width:461,height:817};globalThis.window=globalThis;
Object.assign(globalThis,{innerWidth:461,innerHeight:817,devicePixelRatio:1,addEventListener(){},removeEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),requestAnimationFrame:cb=>setTimeout(()=>cb(performance.now()),0),cancelAnimationFrame:clearTimeout,Image});
const storage=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};};
globalThis.localStorage=storage();globalThis.sessionStorage=storage();
let device,presentation;
const elements=new Map();
function element(tag='div'){
 const el=tag==='canvas'?createCanvas(1,1):{};
 Object.assign(el,{style:{setProperty(){},removeProperty(){}},dataset:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},children:[],addEventListener(){},removeEventListener(){},setAttribute(){},getAttribute(){return null;},appendChild(c){this.children.push(c);return c;},append(...c){this.children.push(...c);},remove(){},replaceChildren(...c){this.children=c;},querySelector(){return element();},querySelectorAll(){return[];},getBoundingClientRect(){return{left:0,top:0,width:461,height:817};},focus(){},requestPointerLock(){},contains(){return false;}});
 if(tag==='canvas'){const ctx=el.getContext.bind(el);el.getContext=(type,...args)=>type==='webgpu'?{configure(o){device=o.device;},getCurrentTexture(){if(!presentation||presentation.width!==el.width||presentation.height!==el.height){presentation?.destroy();presentation=device.createTexture({size:[el.width,el.height],format:navigator.gpu.getPreferredCanvasFormat(),usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_DST});}return presentation;}}:ctx(type,...args);}
 return el;
}
globalThis.document={hidden:false,visibilityState:'visible',body:element(),head:element(),documentElement:element(),createElement:element,getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelector(){return element();},querySelectorAll(){return[];},addEventListener(){},removeEventListener(){}};
const asset=url=>new URL('../public/'+String(url).replace(/^\//,''),import.meta.url);
globalThis.__assetFile=async url=>{const b=readFileSync(asset(url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
globalThis.__assetImage=async bytes=>{const {data,info}=await sharp(Buffer.from(bytes)).ensureAlpha().raw().toBuffer({resolveWithObject:true});return{data,width:info.width,height:info.height};};
globalThis.fetch=async url=>{try{return new Response(readFileSync(asset(url)));}catch(e){return new Response('',{status:404});}};
window.__bermudaMobileOutputScale=1;
const {App}=await import('../src/App.js');const {GPU}=await import('../src/engine/gpu/GPU.js');
const {applyBermudaBootLook,applyBermudaRuntimeLook}=await import('../src/world/BermudaIdentity.js');
const {verifyMobileWorld}=await import('../src/mobile/WorldRenderGate.js');
const output=process.argv[2]||'/tmp/world-startup-native.json';
const timeoutMs=Number(process.env.NATIVE_FRAME_TIMEOUT_MS||6000);
const report={source:process.env.SOURCE_SHA||'working-tree',environment:'Native Dawn / SwiftShader; DOM stubs, not Safari/UI',frameTimeoutMs:timeoutMs,productionDeadline:timeoutMs===6000,stages:[],frames:[],errors:[],passed:false};
function checkpoint(stage){
 report.stages.push({stage,ms:performance.now(),rss:process.memoryUsage().rss,resources:GPU.resources?{textures:{...GPU.resources.textures},buffers:{...GPU.resources.buffers},largest:Object.entries(GPU.resources.byLabel||{}).sort((a,b)=>b[1].bytes-a[1].bytes).slice(0,12)}:null,pending:GPU.compiler?.pending.size,active:GPU.compiler?.active});
 if(report.stages.length>200)report.stages.shift();
 writeFileSync(output,JSON.stringify(report,null,2));console.log(stage);
}
const nativeInit=GPU.init.bind(GPU);
GPU.init=async(...args)=>{
 const result=await nativeInit(...args);
 report.shaderModules={count:0,totalCharacters:0,largest:[]};
 const nativeShader=GPU.device.createShaderModule.bind(GPU.device);
 GPU.device.createShaderModule=desc=>{
  const stats=report.shaderModules;stats.count++;stats.totalCharacters+=desc.code.length;
  stats.largest.push({label:desc.label,characters:desc.code.length});stats.largest.sort((a,b)=>b.characters-a.characters);stats.largest.length=Math.min(stats.largest.length,12);
  checkpoint('shader module '+stats.count+': '+desc.label+' ('+desc.code.length+' chars)');
  if(process.env.DUMP_WAKE&&desc.label.startsWith('Wake ')){writeFileSync('/tmp/'+desc.label.replaceAll(' ','-')+'.wgsl',desc.code);if(desc.label==='Wake Columns'){report.diagnosticOnly='Exported wake shader sources; no world validation attempted';checkpoint('wake shader export complete');process.exit(0);}}
  return nativeShader(desc);
 };
 for(const method of ['createRenderPipelineAsync','createComputePipelineAsync']){
  const native=GPU.device[method].bind(GPU.device);
  GPU.device[method]=async desc=>{checkpoint('compile start: '+desc.label);const p=await native(desc);checkpoint('compile done: '+desc.label);return p;};
 }
 return result;
};
const heartbeat=setInterval(()=>{
 checkpoint('heartbeat');
 if(process.memoryUsage().rss>Number(process.env.RSS_LIMIT_MIB||1536)*1024*1024){report.failure='Diagnostic RSS budget exceeded; stopped before host exhaustion';checkpoint('diagnostic memory limit');process.exit(2);}
},2000);
try{
 const app=new App();applyBermudaBootLook(app);checkpoint('initializing');
 await app.init((p,label)=>checkpoint(label));
 GPU.device.addEventListener('uncapturederror',e=>report.errors.push(e.error.message));
 applyBermudaRuntimeLook(app);checkpoint('preparing pipelines');await app.precompile();checkpoint('verifying GPU frames');
 const submit=GPU.submit.bind(GPU);GPU.submit=(...args)=>{const start=performance.now(),frame=GPU.frame;const r=submit(...args);GPU.whenIdle().then(()=>{report.frames.push({frame,elapsedMs:performance.now()-start,draws:app.engine.meshRenderer.stats.draws});checkpoint('completed frame '+frame);},()=>{});return r;};
 await verifyMobileWorld(app,attempt=>checkpoint('verifying frame '+(attempt+1)),{timeoutMs});report.gate=window.__bermudaWorldGate;report.resources=GPU.resources;report.passed=true;checkpoint('verified');
}catch(e){report.failure=e.stack;checkpoint('failed');}
clearInterval(heartbeat);writeFileSync(output,JSON.stringify(report,null,2));process.exit(report.passed?0:1);
