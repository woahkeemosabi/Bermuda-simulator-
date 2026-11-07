// Copied only into the pinned QA build; no production imports.
export const config = (() => {
  const q=new URLSearchParams(globalThis.location?.search||'');
  const mode=q.get('qaMode')||'baseline',isolate=q.get('isolate')||'';
  if(!['baseline','instrumented','isolation','recovery'].includes(mode))throw Error('Unknown QA mode');
  if(isolate && (mode!=='isolation'||!['fft','queries','readback','disposal','render'].includes(isolate)))throw Error('Invalid isolation');
  if(q.getAll('isolate').length>1)throw Error('One isolation variable per run');
  for(const key of ['waterTest','gpuPace','renderTest','vendorStream'])
    if(q.has(key))throw Error(key+' is replaced by qaMode/isolate');
  return Object.freeze({mode,isolate,diagnostics:mode!=='baseline',scopes:q.get('qaScopes')==='1'&&mode!=='baseline'});
})();
export const metrics={version:1,mode:config.mode,isolate:config.isolate,frames:0,cpuTotalMs:0,cpuMaxMs:0,
  queueMs:0,queuePeakMs:0,ackCalls:0,peakInFlight:0,scopePairs:0,readbackErrors:0,cancelledReadbacks:0,
  samples:[],events:[],resources:null};
export function event(kind,detail){metrics.events.push({ms:performance.now(),kind,detail:String(detail).slice(0,300)});if(metrics.events.length>64)metrics.events.shift();}
let sampleAt=-Infinity;
export function measureFrame(ms,GPU,app){
  if(!config.diagnostics)return;
  metrics.frames++;metrics.cpuTotalMs+=ms;metrics.cpuMaxMs=Math.max(ms,metrics.cpuMaxMs);
  const t=performance.now();if(t-sampleAt<1000)return;sampleAt=t;
  metrics.samples.push({ms:t,frame:GPU.frame,cpuMs:ms,queueMs:metrics.queueMs,inFlight:GPU.submissions.pending.size,
    resources:metrics.resources?JSON.parse(JSON.stringify(metrics.resources)):null,queryVersion:app.query?.version});
  if(metrics.samples.length>2048)metrics.samples.shift();
}
if(typeof window!=='undefined'){
  window.__bermudaQAConfig=config;window.__bermudaQAMetrics=metrics;
  window.__bermudaQAReport=()=>JSON.stringify({build:window.__bermudaQABuild,config,metrics,browser:navigator.userAgent},null,2);
}

export class SubmissionManager{
  constructor(queue,{now=()=>performance.now(),onComplete=()=>{},onFailure=()=>{},maxInFlight=1,timeoutMs=6500}={}){
    Object.assign(this,{queue,now,onComplete,onFailure,maxInFlight,timeoutMs});
    this.pending=new Map();this.latest=Promise.resolve();this.sequence=0;this.error=null;this.ackCalls=0;this.peakInFlight=0;this.hidden=false;
  }
  get available(){return !this.error&&this.pending.size<this.maxInFlight;}
  submit(commands,frame){
    if(this.error)throw this.error;
    if(!this.available)throw Error('GPU submission capacity exceeded');
    this.queue.submit(commands);
    const id=++this.sequence,started=this.now();let resolve,reject;
    const done=new Promise((ok,fail)=>{resolve=ok;reject=fail;});done.catch(()=>{});
    this.pending.set(id,{resolve,reject,started,watchdogSince:started});this.latest=done;
    this.peakInFlight=Math.max(this.peakInFlight,this.pending.size);this.ackCalls++;
    try{this.queue.onSubmittedWorkDone().then(()=>{
      if(!this.pending.delete(id))return;
      try{this.onComplete({frame,latencyMs:this.now()-started});resolve();}catch(e){reject(e);this.fail(e);}
    },e=>this.fail(e));}catch(e){this.fail(e);}
    return done;
  }
  done(){return this.error?Promise.reject(this.error):this.latest;}
  checkHealth(){
    if(this.error)throw this.error;
    const p=this.pending.values().next().value;
    if(!this.hidden&&p&&this.now()-p.watchdogSince>this.timeoutMs)this.fail(Error('GPU queue did not complete'));
    if(this.error)throw this.error;
  }
  setHidden(hidden){this.hidden=hidden;if(!hidden)for(const p of this.pending.values())p.watchdogSince=this.now();}
  fail(e){if(this.error)return;this.error=e instanceof Error?e:Error(String(e));for(const p of this.pending.values())p.reject(this.error);this.pending.clear();this.onFailure(this.error);}
}
export function textureBytes(d){
  const s=d.size,w=s.width??s[0],h=s.height??s[1]??1,z=s.depthOrArrayLayers??s[2]??1,f=d.format;
  const b=/rgba32/.test(f)?16:/rgba16|rg32/.test(f)?8:/rgba8|bgra8|rg16|r32|depth32|rg11b10|rgb10a2/.test(f)?4:/rg8|r16|depth16/.test(f)?2:/^r8/.test(f)?1:4;
  let bytes=0;for(let i=0;i<(d.mipLevelCount||1);i++)bytes+=Math.max(1,w>>i)*Math.max(1,h>>i)*(d.dimension==='3d'?Math.max(1,z>>i):z)*b*(d.sampleCount||1);
  return bytes;
}
export function installLedger(device){
  const stats={textures:{created:0,destroyed:0,live:0,bytes:0,peakBytes:0},buffers:{created:0,destroyed:0,live:0,bytes:0,peakBytes:0},incomplete:false};
  for(const [name,kind] of [['createTexture','textures'],['createBuffer','buffers']]){
    const native=device[name].bind(device);
    try{Object.defineProperty(device,name,{configurable:true,value(d){
      const r=native(d),s=stats[kind],bytes=kind==='buffers'?d.size:textureBytes(d);let destroyed=false;
      s.created++;s.live++;s.bytes+=bytes;s.peakBytes=Math.max(s.bytes,s.peakBytes);
      const destroy=r.destroy.bind(r);
      try{Object.defineProperty(r,'destroy',{configurable:true,value(){if(!destroyed){destroyed=true;s.destroyed++;s.live--;s.bytes-=bytes;}return destroy();}});}catch(_){stats.incomplete=true;}
      return r;
    }});}catch(_){stats.incomplete=true;}
  }return stats;
}
export async function deadline(promise,ms,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out')),Math.max(1,ms));})]);}finally{clearTimeout(timer);}}
export async function ready({GPU,app,audioReady,startedAt}){
  const remaining=()=>60000-(performance.now()-startedAt);
  const audio=await deadline(audioReady,remaining(),'Audio preparation');
  if(audio.failed)throw Error('Essential audio failed to load');
  await deadline(GPU.pipelinesReady(),remaining(),'Pipeline compilation');
  await deadline(GPU.whenIdle(),remaining(),'GPU preparation');
  if(GPU.fatalError)throw GPU.fatalError;
  if(!app.query.cpuValid)throw Error('Initial water sample unavailable');
  return {ready:true,audio,elapsedMs:performance.now()-startedAt};
}
const RECOVERY='bermuda.qa.fftcore.recovery.v1';
export function saveRecovery(app,storage=globalThis.sessionStorage){
  if(!app?.game?.state||!app?.player)return false;
  const p=app.player,b=app.boatCtl;
  try{storage.setItem(RECOVERY,JSON.stringify({version:1,game:app.game.state.toJSON(),
    player:{position:p.position.toArray(),yaw:p.yaw,pitch:p.pitch,mode:p.mode},
    boat:b?{position:b.position.toArray(),quaternion:b.quaternion.toArray(),moored:b.moored,anchored:b.anchored,
      anchor:b.anchorPosition.toArray(),anchorHeading:b.anchorHeading,mooring:{position:b.mooring.anchor.toArray(),heading:b.mooring.heading}}:null}));app.game.state.save();return true;}catch(_){return false;}
}
export function restoreRecovery(app,storage=globalThis.sessionStorage){
  try{const raw=storage.getItem(RECOVERY);if(!raw)return false;const s=JSON.parse(raw);
    if(s.version!==1||s.player?.position?.length!==3||!s.player.position.every(Number.isFinite))return false;
    if(!app.game.state.fromJSON(s.game))return false;
    const p=app.player,b=app.boatCtl;p.position.fromArray(s.player.position);p.velocity.set(0,0,0);p.camInit=false;p._camY=null;
    if(Number.isFinite(s.player.yaw))p.yaw=s.player.yaw;if(Number.isFinite(s.player.pitch))p.pitch=s.player.pitch;
    if(b&&s.boat){b.position.fromArray(s.boat.position);b.quaternion.fromArray(s.boat.quaternion).normalize();b.velocity.set(0,0,0);b.angular.set(0,0,0);b.throttle=0;b.steer=0;
      b.moored=!!s.boat.moored;b.anchored=!!s.boat.anchored;b.anchorPosition.fromArray(s.boat.anchor);b.anchorHeading=s.boat.anchorHeading;
      b.mooring.anchor.fromArray(s.boat.mooring.position);b.mooring.heading=s.boat.mooring.heading;
      if(s.player.mode==='boat')p.enterBoat();else if(s.player.mode==='deck')p.boardBoat();}
    if(s.player.mode==='swim')p.mode='swim';app.game.state.save();app.game.state.emit();storage.removeItem(RECOVERY);return true;
  }catch(_){return false;}
}
