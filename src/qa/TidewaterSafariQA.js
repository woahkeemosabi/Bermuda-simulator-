import { probeAdapter, qualifyAdapter } from '../../scripts/tidewater-gpu-gate.mjs';
// Opt-in observation only. No shader, capability, quality or save substitution.
const KEY='tidewater-safari-qa-v1';
const report={schema:1,build:'original-safari-qa-20261029-v1',startedAt:new Date().toISOString(),userAgent:navigator.userAgent,status:'STARTING',devices:[],errors:[],losses:[],shaders:[],samples:[],startupMs:null,gpuMemoryBytes:null,gameplay:'NOT_VERIFIED'};
let previous=null;try{previous=JSON.parse(localStorage.getItem(KEY));}catch{}
const keep=(list,value)=>{list.push(value);if(list.length>300)list.shift();};
const numeric=o=>{const r={};for(let p=o;p&&p!==Object.prototype;p=Object.getPrototypeOf(p))for(const k of Object.getOwnPropertyNames(p))try{if(typeof o[k]==='number')r[k]=o[k];}catch{}return r;};
const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(report));}catch{}};
const panel=document.createElement('details');
panel.style.cssText='position:fixed;top:max(4px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:2147483647;background:#10212fee;color:white;padding:6px;border-radius:8px;max-width:90vw;font:12px system-ui';
panel.innerHTML='<summary>QA · starting</summary><p>Original ocean · test save on this preview only</p><button id="qa-export">Export report</button> <button id="qa-previous">Previous run</button><pre style="max-height:35vh;overflow:auto;white-space:pre-wrap"></pre>';
document.body.append(panel);
async function exportReport(value){
 const text=JSON.stringify(value,null,2),file=new File([text],'bermuda-safari-qa.json',{type:'application/json'});
 if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file]});return;}catch(e){if(e.name==='AbortError')return;}}
 const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),60000);
 panel.querySelector('pre').textContent=text;
}
panel.querySelector('#qa-export').onclick=()=>{persist();exportReport(report);};
panel.querySelector('#qa-previous').disabled=!previous;
panel.querySelector('#qa-previous').onclick=()=>exportReport(previous);
addEventListener('error',e=>{keep(report.errors,{type:'window',message:e.message||'Resource failed',source:e.filename||e.target?.src||null});persist();},true);
addEventListener('unhandledrejection',e=>{keep(report.errors,{type:'promise',message:String(e.reason)});persist();});
addEventListener('pagehide',persist);
export async function prepare(){
 report.adapter=await probeAdapter();report.qualification=qualifyAdapter(report.adapter);persist();
 if(report.qualification.status!=='CAPABILITY_GATE_PASSED'){
 report.status='BLOCKED';panel.open=true;panel.querySelector('summary').textContent='QA · adapter blocked';panel.querySelector('pre').textContent=report.qualification.reasons.join('\n');persist();return false;
 }
 const request=GPUAdapter.prototype.requestDevice;
 GPUAdapter.prototype.requestDevice=async function(...args){
  try{
   const d=await Reflect.apply(request,this,args);
   keep(report.devices,{requested:args[0],limits:numeric(d.limits),features:[...d.features]});persist();
   d.addEventListener('uncapturederror',e=>{keep(report.errors,{type:'GPU',message:e.error.message});persist();});
   d.lost.then(i=>{keep(report.losses,{reason:i.reason,message:i.message,at:performance.now()});report.status='DEVICE_LOST';persist();});
   return d;
  }catch(e){keep(report.errors,{type:'requestDevice',message:String(e)});persist();throw e;}
 };
 const create=GPUDevice.prototype.createShaderModule;
 GPUDevice.prototype.createShaderModule=function(...args){
  const m=Reflect.apply(create,this,args);report.shaderCount=(report.shaderCount||0)+1;
  m.getCompilationInfo().then(i=>{for(const x of i.messages)keep(report.shaders,{label:args[0]?.label,type:x.type,message:x.message,line:x.lineNum});persist();}).catch(e=>keep(report.errors,{type:'compilationInfo',message:String(e)}));return m;
 };
 report.status='LOADING';
 setInterval(()=>{
  const a=window.__app,l=document.querySelector('#loader'),hidden=!!l&&(l.classList.contains('tw-hidden')||getComputedStyle(l).display==='none');
  if(hidden&&report.startupMs===null)report.startupMs=performance.now();
  const s={at:performance.now(),visible:document.visibilityState,frame:a?.gpu?.frame??null,loaderHidden:hidden,loaderText:l?.innerText||'',quality:{mobileLite:a?.mobileLite,renderScale:a?.engine?.renderScale,cascades:a?.fft?.cascades,causticsFine:a?.caustics?.fine?.texture?.width,causticsBroad:a?.caustics?.broad?.texture?.width,wake:a?.wake?.display?.width},position:a?.player?.position?{x:a.player.position.x,y:a.player.position.y,z:a.player.position.z}:null,jsHeapBytes:performance.memory?.usedJSHeapSize??null};
  const last=report.samples.at(-1);s.submittedFPS=last&&s.frame!==null&&last.frame!==null?(s.frame-last.frame)*1000/(s.at-last.at):null;
  keep(report.samples,s);if(!report.losses.length)report.status=report.errors.length||report.shaders.some(x=>x.type==='error')?'ERRORS_RECORDED':hidden?'RUNNING_UNVERIFIED':'LOADING';
  panel.querySelector('summary').textContent='QA · '+report.status+(s.submittedFPS!==null?' · '+s.submittedFPS.toFixed(0)+' fps':'');persist();
 },2000);
 return true;
}
