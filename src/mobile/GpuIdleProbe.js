// Independent WebGPU device lifecycle A/B. This script does NOT load the simulator.
const params=new URLSearchParams(location.search),mode=params.get('gpuProbe')==='clear'?'clear':'idle';
const app=document.getElementById('app'),loader=document.getElementById('loader'),fps=document.getElementById('fps');
if(loader)loader.style.display='none';
if(fps)fps.style.display='none';
app.replaceChildren();
app.style.cssText='position:fixed;inset:0;overflow:auto;box-sizing:border-box;padding:24px;background:#041721;color:#e5fbff;font:14px/1.6 ui-monospace,Menlo,monospace';
const title=document.createElement('h2'),report=document.createElement('pre'),canvas=document.createElement('canvas');
title.textContent='Bermuda WebGPU • device lifetime';
title.style.cssText='font:600 20px system-ui';
report.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';
canvas.width=256;canvas.height=384;canvas.style.cssText='width:128px;height:192px;border:1px solid #7cdddf';
app.append(title,report,canvas);
let device,ctx,loss=null,err='',submits=0,acks=0;
const started=performance.now(),events=[];
const stamp=()=>Math.round((performance.now()-started)/1000);
function note(x){events.push(stamp()+'s '+x);if(events.length>10)events.shift()}
function show(){
 report.textContent=[
  'TEST '+mode.toUpperCase()+' | '+stamp()+' seconds | '+(loss?'DEVICE LOST':'DEVICE ACTIVE'),
  'Submissions '+submits+' | Completed '+acks,
  'Visibility '+document.visibilityState,
  'Loss '+(loss?JSON.stringify(loss):'none'),
  'Error '+(err||'none'),
  'No Bermuda world, water, clouds, shadows, post or game loaded.',
  '',
  'Recent events:',...events,'',
  'Leave this test open for 45 seconds without switching apps.'
 ].join('\n');
 app.style.borderTop='5px solid '+(loss?'#ff6961':'#28d2b7');
}
note('boot');
try{
 if(!navigator.gpu)throw Error('WebGPU not available');
 const adapter=await navigator.gpu.requestAdapter({powerPreference:'low-power'});
 if(!adapter)throw Error('No WebGPU adapter');
 device=await adapter.requestDevice();
 note('device acquired');
 device.lost.then(info=>{loss={reason:info.reason||'unknown',message:info.message||'not provided'};note('DEVICE LOST');show()});
 device.addEventListener?.('uncapturederror',e=>{err=String(e.error?.message||e);note('uncaptured error');show()});
 ctx=canvas.getContext('webgpu');
 if(!ctx)throw Error('WebGPU canvas unavailable');
 ctx.configure({device,format:navigator.gpu.getPreferredCanvasFormat(),alphaMode:'opaque'});
 note('canvas configured');
 if(mode==='clear'){
  const draw=()=>{
   if(loss)return;
   try{
    const encoder=device.createCommandEncoder({label:'probe'});
    const pass=encoder.beginRenderPass({colorAttachments:[{
     view:ctx.getCurrentTexture().createView(),loadOp:'clear',storeOp:'store',clearValue:[.04,.22,.32,1]
    }]});
    pass.end();device.queue.submit([encoder.finish()]);submits++;
    device.queue.onSubmittedWorkDone().then(()=>{acks++;show()},e=>{err=String(e);note('queue error');show()});
   }catch(e){err=String(e);note('draw failed')}
   show();
  };
  draw();setInterval(draw,200);
 }
}catch(e){err=String(e);note('initialization error')}
document.addEventListener('visibilitychange',()=>{note('visibility '+document.visibilityState);show()});
addEventListener('pagehide',()=>note('pagehide'));
setInterval(show,1000);show();
