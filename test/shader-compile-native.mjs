// Isolate a generated WGSL compute shader from world allocation and gameplay.
import './headless.mjs';
import {GPU} from '../src/engine/gpu/GPU.js';
import {readFileSync,writeFileSync} from 'node:fs';
const [source,out]=process.argv.slice(2);let code=readFileSync(source,'utf8');
if(process.env.UNROLL_WAKE){
 const header='for ( var s = 0u; s < WAKE_LOG2N; s++ ) {';
 for(let start;(start=code.indexOf(header))>=0;){
  let level=1,end=start+header.length;
  for(;level&&end<code.length;end++){if(code[end]==='{')level++;if(code[end]==='}')level--;}
  const body=code.slice(start+header.length,end-1);
  const n=Number(/const WAKE_LOG2N: u32 = (\d+)/.exec(code)?.[1]||8);
  code=code.slice(0,start)+Array.from({length:n},(_,i)=>'{ let s = '+i+'u;'+body+'}').join('\n')+code.slice(end);
 }
}
const report={source,unrolled:!!process.env.UNROLL_WAKE,characters:code.length,environment:'Dawn/SwiftShader',samples:[],passed:false};
const start=performance.now();
function record(stage){report.samples.push({stage,ms:performance.now()-start,rss:process.memoryUsage().rss});writeFileSync(out,JSON.stringify(report,null,2));}
await GPU.init({headless:true});record('device ready');
const timer=setInterval(()=>{record('compiling');if(process.memoryUsage().rss>2048*1024*1024){report.failure='Diagnostic 2 GiB RSS limit';record('stopped');process.exit(2);}},1000);
try {
 const module=GPU.device.createShaderModule({label:source,code});record('module created');
 await GPU.device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});
 report.passed=true;record('pipeline complete');
}catch(e){report.failure=e.message;record('failed');}
clearInterval(timer);console.log(JSON.stringify(report));process.exit(report.passed?0:1);
