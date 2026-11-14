// Logical resource sizes exclude browser/driver heaps and presentation surfaces.
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
  const stats={textures:{created:0,destroyed:0,live:0,bytes:0,peakBytes:0},buffers:{created:0,destroyed:0,live:0,bytes:0,peakBytes:0},incomplete:false,byLabel:Object.create(null)};
  for(const [name,kind] of [['createTexture','textures'],['createBuffer','buffers']]){
    const native=device[name].bind(device);
    try{Object.defineProperty(device,name,{configurable:true,value(d){
      const r=native(d),s=stats[kind],bytes=kind==='buffers'?d.size:textureBytes(d);let destroyed=false;
      s.created++;s.live++;s.bytes+=bytes;s.peakBytes=Math.max(s.bytes,s.peakBytes);
      const rawKey=kind+':'+String(d.label||'(unlabelled)').slice(0,100);
      const key=stats.byLabel[rawKey]||Object.keys(stats.byLabel).length<256?rawKey:kind+':(other)';
      const bucket=stats.byLabel[key]||(stats.byLabel[key]={bytes:0,live:0,peakBytes:0});
      bucket.bytes+=bytes;bucket.live++;bucket.peakBytes=Math.max(bucket.peakBytes,bucket.bytes);
      const destroy=r.destroy.bind(r);
      try{Object.defineProperty(r,'destroy',{configurable:true,value(){if(!destroyed){destroyed=true;s.destroyed++;s.live--;s.bytes-=bytes;bucket.bytes-=bytes;bucket.live--;}return destroy();}});}catch(_){stats.incomplete=true;}
      return r;
    }});}catch(_){stats.incomplete=true;}
  }return stats;
}
