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
const report={environment:'Native Dawn / SwiftShader; DOM stubs, not Safari/UI',stages:[],errors:[],passed:false};
function checkpoint(stage){report.stages.push({stage,ms:performance.now()});writeFileSync(output,JSON.stringify(report,null,2));console.log(stage);}
try{
 const app=new App();applyBermudaBootLook(app);checkpoint('initializing');
 await app.init((p,label)=>checkpoint(label));
 GPU.device.addEventListener('uncapturederror',e=>report.errors.push(e.error.message));
 applyBermudaRuntimeLook(app);checkpoint('preparing pipelines');await app.precompile();checkpoint('verifying GPU frames');
 await verifyMobileWorld(app);report.gate=window.__bermudaWorldGate;report.resources=GPU.resources;report.passed=true;checkpoint('verified');
}catch(e){report.failure=e.stack;checkpoint('failed');}
writeFileSync(output,JSON.stringify(report,null,2));process.exit(report.passed?0:1);
