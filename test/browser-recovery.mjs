// Chromium + SwiftShader with a mobile viewport, NOT real iPhone Safari.
// Run against a local Vite server. Never targets a user's production save.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out='test-results';mkdirSync(out,{recursive:true});
const report={environment:'Chromium SwiftShader, mobile UA/viewport; not Safari',passed:false,runs:[],errors:[],timeline:[]};
let browser,page,stage='initialization';
function mark(next){stage=next;report.timeline.push({at:new Date().toISOString(),stage});console.log('[browser-recovery]',stage);}
const heartbeat=setInterval(()=>console.log('[browser-recovery] running:',stage),15000);
heartbeat.unref?.();
try {
 mark('launching Chromium');
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-gpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:462,height:817},isMobile:true,hasTouch:true,deviceScaleFactor:1,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});
 page=await context.newPage();
 page.on('pageerror',e=>{report.errors.push(e.message);console.error('[browser-recovery] pageerror',e.message);});
 page.on('crash',()=>console.error('[browser-recovery] Chromium page crashed'));
 page.on('console',msg=>{if(msg.type()==='error'){report.errors.push(msg.text());console.error('[browser-recovery] browser console error:',msg.text().slice(0,1000));}});
 mark('browser page created');
 // Control: does the software WebGPU browser itself survive a bare canvas
 // swapchain clear without importing any Bermuda game code or resources?
 // A failing control means the runner/browser, not the ocean shaders, is broken.
 const smokePage=await context.newPage();
 const smokeHtml = `<!doctype html><meta charset="utf-8"><canvas id="gpu" width="96" height="96"></canvas><script>
 (async()=>{ try {
 const adapter=await navigator.gpu.requestAdapter({powerPreference:'low-power'});
 if(!adapter) throw Error('No software WebGPU adapter');
 const device=await adapter.requestDevice();
 device.lost.then(info=>{window.gpuSmoke={ok:false,reason:info.reason,message:info.message}});
 const canvas=document.getElementById('gpu');
 const ctx=canvas.getContext('webgpu');
 ctx.configure({device,format:navigator.gpu.getPreferredCanvasFormat(),alphaMode:'opaque',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_DST});
 const enc=device.createCommandEncoder();
 const pass=enc.beginRenderPass({colorAttachments:[{view:ctx.getCurrentTexture().createView(),loadOp:'clear',storeOp:'store',clearValue:[0.1,0.3,0.5,1]}]});
 pass.end();device.queue.submit([enc.finish()]);
 await device.queue.onSubmittedWorkDone();
 await new Promise(resolve=>setTimeout(resolve,350));
 if(!window.gpuSmoke)window.gpuSmoke={ok:true,adapterTextureLimit:device.limits.maxSampledTexturesPerShaderStage};
 }catch(e){window.gpuSmoke={ok:false,error:String(e)}} })()
 <\/script>`;
 await smokePage.route('**/__gpu-smoke',route=>route.fulfill({status:200,contentType:'text/html',body:smokeHtml}));
 await smokePage.goto('http://127.0.0.1:5189/__gpu-smoke');
 await smokePage.waitForFunction(()=>!!window.gpuSmoke,{},{timeout:15000});
 report.baselineGpuSmoke=await smokePage.evaluate(()=>window.gpuSmoke);
 console.log('[browser-recovery] bare GPU control',JSON.stringify(report.baselineGpuSmoke));
 await smokePage.close();
 assert.equal(report.baselineGpuSmoke.ok,true,'Software browser cannot present a basic WebGPU canvas; mobile app cannot be meaningfully tested');
 const url=process.env.TEST_URL||'http://127.0.0.1:5189/?noAudio=1';
 for(const mode of ['fresh','cached']) {
  mark(mode+': navigation started');
  const started=Date.now();if(mode==='fresh')await page.goto(url);else await page.reload();
  mark(mode+': navigation completed; waiting on readiness gate');
  await page.waitForFunction(()=>window.__bermudaWorldGate?.status==='ready'||window.__bermudaWorldGate?.status==='failed'||window.__bermudaGpuLost,{},{timeout:240000});
  mark(mode+': readiness gate settled');
  const gate=await page.evaluate(()=>window.__bermudaWorldGate);
  const gpu=await page.evaluate(()=>({
    audit:window.__bermudaGpuAudit,
    compiler:window.__app?.gpu?.compiler?.diagnostics?.(),
    report:window.__app ? window.__bermudaGpuAudit?.stage : null,
    resourceBytes:window.__app?.gpu?.resources?.textures?.bytes,
    topGpuTextures:Object.entries(window.__app?.gpu?.resources?.byLabel||{})
      .filter(([k])=>k.startsWith('textures:'))
      .sort((a,b)=>(b[1]?.bytes||0)-(a[1]?.bytes||0))
      .slice(0,22).map(([name,x])=>({name,bytes:x.bytes,live:x.live})),
  }));
  report.runs.push({mode,startupMs:Date.now()-started,gate,gpu});
  if(gate?.status!=='ready') console.error('[browser-recovery] GPU failure diagnostics',JSON.stringify(gpu).slice(0,5000));
  assert.equal(gate?.status,'ready',JSON.stringify(gate));
  mark(mode+': start overlay click');
  await page.locator('.tw-start-cta').click();
  const initial=await page.evaluate(()=>window.__app.engine.frame);
  mark(mode+': waiting on 120 rendered gameplay frames');
  await page.waitForFunction(n=>window.__app.engine.frame>=n+120,initial,{timeout:240000});
  mark(mode+': 120 gameplay frames completed');
  if(mode==='cached')assert.equal(await page.evaluate(()=>window.__app.game.state.money),1835);
  else await page.evaluate(()=>{window.__app.game.state.money=1835;window.__app.game.state.save();});
  const run=report.runs.at(-1);run.metrics=await page.evaluate(()=>window.__bermudaFrameMetrics?.());run.resources=await page.evaluate(()=>window.__app.gpu.resources);
  assert.equal(await page.evaluate(()=>!!window.__bermudaGpuLost),false);
  await page.screenshot({path:`${out}/${mode}.png`});
 }
 // Deliberate test-device loss must stop the loop, expose retry, and keep storage.
 const before=await page.evaluate(()=>({...localStorage}));
 await page.evaluate(()=>window.__app.gpu.device.destroy());
 await page.waitForFunction(()=>!!window.__bermudaGpuLost);
 await page.locator('#bm-loader-retry').waitFor({state:'visible'});
 assert.deepEqual(await page.evaluate(()=>({...localStorage})),before);
 report.deviceLossStops=true;report.passed=true;
} catch(e){
 report.failure=String(e?.stack||e);
 console.error('[browser-recovery] FAILED at '+stage,report.failure);
 if(page)await page.screenshot({path:`${out}/failure.png`,timeout:10000}).catch(()=>{});
 // Determine whether the software GPU is failing on the actual island pass,
 // shadow cascades, or the refraction/water/final combination. These QA-only
 // renderTest modes never change the public game or a player's save data.
 if(browser && /readiness gate settled/.test(stage)) {
  report.isolation=[];
  for(const variant of ['clearonly','postonly']) {
   const probe={variant};
   let ctx;
   try {
    ctx=await browser.newContext({viewport:{width:462,height:817},isMobile:true,hasTouch:true,deviceScaleFactor:1,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});
    const p=await ctx.newPage();
    await p.goto('http://127.0.0.1:5189/?noAudio=1&renderTest='+variant);
    await p.waitForFunction(()=>!!window.__bermudaGpuLost||(!!document.getElementById('bermuda-explore-countdown') && (window.__app?.gpu?.submissions?.pending?.size||0)===0),{},{timeout:90000});
    probe.result=await p.evaluate(async()=>{
     const app=window.__app;if(!app)return {error:'app unavailable'};
     try {
      app.frame(1/60);
      await Promise.race([app.gpu.whenIdle(),new Promise((_,rej)=>setTimeout(()=>rej(new Error('queue stalled')),12000))]);
      return {completed:!app.gpu.fatalError,stage:window.__bermudaGpuAudit?.stage,audit:window.__bermudaGpuAudit,loss:window.__bermudaGpuLost||null};
     }catch(e){return {error:String(e),stage:window.__bermudaGpuAudit?.stage,audit:window.__bermudaGpuAudit,loss:window.__bermudaGpuLost||null};}
    });
   }catch(error){probe.error=String(error);}
   finally{await ctx?.close().catch(()=>{});}
   report.isolation.push(probe);
   console.error('[browser-recovery] render isolation',JSON.stringify(probe).slice(0,2800));
  }
 }
}
finally {clearInterval(heartbeat);mark('writing evidence and closing browser');writeFileSync(`${out}/browser.json`,JSON.stringify(report,null,2));await browser?.close();}
if(!report.passed)process.exitCode=1;
