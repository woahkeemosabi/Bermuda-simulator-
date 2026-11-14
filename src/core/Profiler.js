import { GPU } from '../engine/gpu/GPU.js';

// Opt-in timestamp sampling of actual passes, including grouped FFT dispatches.
// Pass durations may overlap on tile-based GPUs; their sum is NOT total GPU time.
const MAX=128;
export class Profiler {
 constructor(renderer,{enabled=null}={}) {
  this.renderer=renderer;
  const q=new URLSearchParams(globalThis.location?.search||'');
  this.enabled=!!(enabled??q.has('profile'))&&GPU.hasTimestamp&&!q.has('bench');
  this.result={compute:0,render:0,items:[],frame:null,note:'Pass durations may overlap; sums are not total GPU time.'};
  if(!this.enabled)return;
  this.querySet=GPU.device.createQuerySet({type:'timestamp',count:MAX*2});
  this.resolveBuffer=GPU.device.createBuffer({label:'profiler resolve',size:MAX*16,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC});
  this.ring=Array.from({length:3},()=>({busy:false,buffer:GPU.device.createBuffer({label:'profiler read',size:MAX*16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}));
  GPU.profiler=this;
 }
 track() {} // Compatibility: capture actual encoder passes rather than nested kernels.
 update() {}
 attach(encoder) {
  if(!this.enabled||GPU.frame%31!==0)return;
  const slot=this.ring.find(s=>!s.busy);if(!slot)return;
  const labels=[],frame=GPU.frame;
  slot.busy=true;
  try {
   for(const [method,kind] of [['beginComputePass','compute'],['beginRenderPass','render']]) {
    const native=encoder[method].bind(encoder);
    encoder[method]=(desc={})=>{
     if(labels.length>=MAX)return native(desc);
     const i=labels.length;labels.push({name:desc.label||kind,kind});
     return native({...desc,timestampWrites:{querySet:this.querySet,beginningOfPassWriteIndex:i*2,endOfPassWriteIndex:i*2+1}});
    };
   }
  }catch(error){slot.busy=false;this.enabled=false;this.result.error=String(error);return;}
  GPU.onSubmit(enc=>{
   if(!labels.length)return;
   enc.resolveQuerySet(this.querySet,0,labels.length*2,this.resolveBuffer,0);
   enc.copyBufferToBuffer(this.resolveBuffer,0,slot.buffer,0,labels.length*16);
  },()=>{
   if(!labels.length){slot.busy=false;return;}
   slot.buffer.mapAsync(GPUMapMode.READ).then(()=>{
    const times=new BigUint64Array(slot.buffer.getMappedRange().slice(0,labels.length*16));slot.buffer.unmap();
    const items=labels.map((label,i)=>({...label,ms:Number(times[i*2+1]-times[i*2])/1e6})).filter(x=>x.ms>=0&&x.ms<6000);
    const span=Number(times[times.length-1]-times[0])/1e6;
    this.result={frame,spanMs:span,items,compute:items.filter(x=>x.kind==='compute').reduce((s,x)=>s+x.ms,0),render:items.filter(x=>x.kind==='render').reduce((s,x)=>s+x.ms,0),note:'Pass durations may overlap; sums are not total GPU time.'};
   }).catch(error=>{this.result.error=String(error);}).finally(()=>{slot.busy=false;});
  },()=>{slot.busy=false;});
 }
 summary(n=12){return [...this.result.items].sort((a,b)=>b.ms-a.ms).slice(0,n).map(x=>`${x.name} ${x.ms.toFixed(2)}`).join(' · ');}
}
