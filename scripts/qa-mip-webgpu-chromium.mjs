// Real WebGPU startup + first gameplay frames on Chromium's software adapter.
// Not an iPhone Safari test. No changes to the production or deployed QA game.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const port=4187, address='http://127.0.0.1:'+port;
const siteArg=process.argv.find(a=>a.startsWith('--site-dir='));
const siteDir=siteArg ? siteArg.slice('--site-dir='.length) : '.';
console.log('[WebGPU smoke] Testing compiled site from '+siteDir);
const results={status:'unverified',adapter:null,started:false,frame:null,samples:[],errors:[],console:[],pageErrors:[]};
const hardStop=setTimeout(()=>{
  results.status='timeout-software-webgpu';
  results.errors.push('Browser/adapter experiment exceeded 150s');
  mkdirSync('audit-output',{recursive:true});
  writeFileSync('audit-output/mip-webgpu-chromium.json',JSON.stringify(results,null,2));
  console.error('WebGPU Chromium experiment timed out; not certified');
  process.exit(2);
},150000);

const server=spawn('npm',['run','preview','--','--host','127.0.0.1','--port',String(port)],{cwd:siteDir,stdio:'ignore'});
let browser, failure=null;
try {
  let ready=false;
  for(let i=0;i<80;i++){
    try{const response=await fetch(address);if(response.ok){ready=true;break;}}catch(_){}
    await new Promise(resolve=>setTimeout(resolve,350));
  }
  if(!ready)throw new Error('Vite preview was not reachable');
  browser=await chromium.launch({headless:true,args:[
    '--no-sandbox','--enable-unsafe-webgpu','--enable-features=Vulkan,WebGPU',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader'
  ]});
  const context=await browser.newContext({
    viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  });
  const page=await context.newPage();
  page.on('console',msg=>{const line=msg.text();if(msg.type()==='error'||/^\[Bermuda (?:init|FFT|Foam|precompile)\]/.test(line)){results.console.push(line.slice(0,1000)); if(/^\[Bermuda (?:init|FFT|Foam|precompile)\]/.test(line))console.log('INIT_CHECKPOINT '+line);}});
  page.on('pageerror',e=>results.pageErrors.push(String(e).slice(0,1000)));
  page.on('requestfailed',req=>{if(/\.wgsl($|\?)/.test(req.url()))results.errors.push('WGSL fetch '+req.url());});
  await page.goto(address+'/?gpuTrace=1&traceCase=fftcore&qualityTest=crisp&vendorStream=1',{waitUntil:'domcontentloaded',timeout:30000});
  const adapterPromise=page.evaluate(async()=>{
    if(!navigator.gpu)return {available:false,reason:'navigator.gpu unavailable'};
    const adapter=await navigator.gpu.requestAdapter();
    if(!adapter)return {available:false,reason:'requestAdapter returned null'};
    return {available:true,
      maxStorageTexturesPerShaderStage:adapter.limits.maxStorageTexturesPerShaderStage,
      maxSampledTexturesPerShaderStage:adapter.limits.maxSampledTexturesPerShaderStage
    };
  });
  results.adapter=await Promise.race([
    adapterPromise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('WebGPU requestAdapter timed out after 15s')),15000))
  ]);
  if(results.adapter.available){
    // Engine.frame is normally ZERO until 'Tap to Explore'. Previously this
    // smoke never clicked Explore, so it could report a false zero-frame failure.
    const start=Date.now();
    const snapshot=()=>page.evaluate(()=>{
      const btn=document.querySelector('.tw-start-cta');
      const visible=!!btn && !!(btn.offsetWidth||btn.offsetHeight||btn.getClientRects().length);
      return {
        atMs:Date.now(),
        engineFrame:window.__app?.engine?.frame ?? null,
        gpuFrame:window.__bermudaGpuAudit?.frame ?? null,
        stage:window.__bermudaGpuAudit?.stage ?? null,
        shaderWarmup:window.__bermudaShaderWarmup ?? null,
        startVisible:visible,
        gpuLost:window.__bermudaGpuLost || null,
        canvases:document.querySelectorAll('canvas').length,
        loaderText:document.querySelector('#loader')?.innerText?.slice(0,160)||''
      };
    });
    for(let i=0;i<24;i++){
      await page.waitForTimeout(5000);
      const sample=await snapshot();
      sample.elapsedMs=Date.now()-start;
      results.samples.push(sample);
      if(sample.gpuLost)break;
      if(sample.startVisible) {
        await page.locator('.tw-start-cta').click({timeout:8000});
        results.started=true;
        await page.waitForTimeout(8500);
        results.frame=await snapshot();
        break;
      }
    }
    if(!results.frame && results.samples.length)results.frame=results.samples.at(-1);
    const material=[...results.console,...results.pageErrors,...results.errors];
    const limit=material.filter(s=>/maxStorageTexturesPerShaderStage|5\s+(writable|storage)|storage\s+textures?.{0,80}(limit|4)|exceeded.{0,50}storage\s+texture/i.test(s));
    const lost=material.filter(s=>/GPU device lost|external Instance reference no longer exists|GPUPipelineError/i.test(s));
    if(limit.length){
      results.status='failed-storage-texture-validation';
      failure=new Error('4-storage-texture validation failed: '+limit.slice(0,2).join(' | '));
    }else if(lost.length||results.frame?.gpuLost){
      results.status='failed-software-adapter-device-loss';
      failure=new Error('Software adapter invalid or lost: '+(lost[0]||results.frame.gpuLost));
    }else if(!results.started){
      results.status='blocked-before-tap-to-explore';
      failure=new Error('Game did not finish loading; inspect recorded shader warmup stages');
    }else if(!(results.frame?.engineFrame>0)){
      results.status='started-but-no-gameplay-frames';
      failure=new Error('Explore was clicked but no gameplay frames were rendered');
    }else if(results.adapter.maxStorageTexturesPerShaderStage!==4){
      results.status='inconclusive-adapter-not-four';
    }else{
      results.status='rendered-gameplay-with-four-storage-texture-adapter';
    }
  }else results.status='inconclusive-no-webgpu-adapter';
  await context.close();
}catch(error){
  failure ||= error;
  results.status='browser-experiment-failed';
  results.errors.push(String(error));
}finally{
  try{await Promise.race([browser?.close()||Promise.resolve(),new Promise(r=>setTimeout(r,10000))]);}catch(_){}
  server.kill('SIGTERM');clearTimeout(hardStop);
  mkdirSync('audit-output',{recursive:true});
  writeFileSync('audit-output/mip-webgpu-chromium.json',JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
}
if(failure)process.exitCode=1;
