import {GPU} from './GPU.js';
import {metrics} from '../../mobile/QAEngine.js';
export class Readback{
 constructor({byteLength,ring=3,label='readback'}){this.byteLength=Math.ceil(byteLength/4)*4;this.label=label;this.ring=Array.from({length:ring},()=>({buffer:null,busy:false,frame:0}));this.latest=null;this.frame=-1;this.onData=null;this.onError=null;this.disposed=false;}
 request(src,offset=0){
  if(this.disposed||GPU.fatalError)return false;
  const s=this.ring.find(s=>!s.busy);if(!s)return false;
  if(!s.buffer)s.buffer=GPU.device.createBuffer({label:this.label,size:this.byteLength,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
  s.busy=true;s.frame=GPU.frame;const buffer=s.buffer;let settled=false;
  const release=(error,cancelled=false)=>{if(settled)return;settled=true;try{if(buffer.mapState==='mapped')buffer.unmap();}catch(_){}s.busy=false;if(error){if(cancelled)metrics.cancelledReadbacks++;else metrics.readbackErrors++;this.onError?.(error);}};
  try{GPU.getEncoder().copyBufferToBuffer(src.getGPU?src.getGPU():src,offset,buffer,0,this.byteLength);
   GPU.onSubmit(null,()=>{Promise.resolve().then(()=>buffer.mapAsync(GPUMapMode.READ)).then(()=>{
    if(this.disposed){release();return;}const copy=buffer.getMappedRange().slice(0);release();
    if(s.frame>=this.frame){this.latest=copy;this.frame=s.frame;this.onData?.(copy,s.frame);}
   }).catch(e=>release(e));},e=>release(e,true));return true;
  }catch(e){release(e);throw e;}
 }
 dispose(){if(this.disposed)return;this.disposed=true;for(const s of this.ring){if(s.buffer)GPU.retire(s.buffer);s.buffer=null;s.busy=false;}this.latest=null;}
}
export async function readBuffer(src,byteLength,offset=0){
 await GPU.whenIdle();const b=GPU.device.createBuffer({size:Math.ceil(byteLength/4)*4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
 try{GPU.getEncoder().copyBufferToBuffer(src.getGPU?src.getGPU():src,offset,b,0,b.size);GPU.submit();await b.mapAsync(GPUMapMode.READ);return b.getMappedRange().slice(0);}
 finally{try{b.unmap();}catch(_){}GPU.retire(b);}
}
export async function readTexture(texture,{mip=0,layer=0,bytesPerTexel=null}={}){
 const {formatInfo}=await import('./GPU.js');await GPU.whenIdle();
 const w=Math.max(1,texture.width>>mip),h=Math.max(1,texture.height>>mip),row=w*(bytesPerTexel||formatInfo(texture.format).bytes),padded=Math.ceil(row/256)*256;
 const b=GPU.device.createBuffer({size:padded*h,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
 try{GPU.getEncoder().copyTextureToBuffer({texture:texture.getGPU(),mipLevel:mip,origin:{x:0,y:0,z:layer}},{buffer:b,bytesPerRow:padded,rowsPerImage:h},{width:w,height:h,depthOrArrayLayers:1});GPU.submit();await b.mapAsync(GPUMapMode.READ);
  const src=new Uint8Array(b.getMappedRange()),out=new Uint8Array(row*h);for(let y=0;y<h;y++)out.set(src.subarray(y*padded,y*padded+row),y*row);return{data:out.buffer,width:w,height:h};
 }finally{try{b.unmap();}catch(_){}GPU.retire(b);}
}
