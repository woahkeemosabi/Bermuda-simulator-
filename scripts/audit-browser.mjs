#!/usr/bin/env node
// Chromium-only read-only browser smoke. Does not establish iPhone Safari stability.
import fs from 'node:fs';
import { chromium } from 'playwright';
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:4173/Bermuda-simulator-/';
const scenarios=[
 {name:'desktop-boat',query:'?missions=boat&launch=online'},
 {name:'desktop-full',query:'?missions=full&launch=online'},
 {name:'desktop-decor',query:'?missions=boat&worldDecor=1&launch=online'},
 {name:'mobile-boat',query:'?missions=boat&launch=online',mobile:true}
];
const results=[];
fs.mkdirSync('audit-output',{recursive:true});
for(const scenario of scenarios){
 // New browser GPU process for each case: previous WebGPUDevice resource residency
 // must not stall or contaminate subsequent scenarios.
 const browser=await chromium.launch({headless:true,args:['--enable-unsafe-webgpu','--enable-features=Vulkan,UseSkiaRenderer,WebGPU']});
 const context=await browser.newContext({
  viewport:scenario.mobile?{width:392,height:695}:{width:1280,height:800},
  deviceScaleFactor:1,isMobile:!!scenario.mobile,hasTouch:!!scenario.mobile,
  userAgent:scenario.mobile?'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1':undefined
 });
 const page=await context.newPage();
 const requests=[],errors=[],consoleErrors=[],failedRequests=[],httpErrors=[];
 page.on('request',r=>requests.push({url:r.url(),method:r.method(),resourceType:r.resourceType()}));
 page.on('response',r=>{if(r.status()>=400)httpErrors.push({url:r.url(),status:r.status()});});
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('requestfailed',r=>failedRequests.push({url:r.url(),failure:r.failure()}));
 page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 let status=null,navError=null,readyObserved=false,startClicked=false;
 try{
  const response=await page.goto(new URL(scenario.query,base).toString(),{waitUntil:'domcontentloaded',timeout:45000});
  status=response?.status()??null;
  try{
   await page.waitForFunction(()=>{
    const loader=document.getElementById('loader');
    return loader && (getComputedStyle(loader).display==='none'||loader.classList.contains('tw-hidden'));
   },null,{timeout:Number(process.env.AUDIT_WAIT_MS||90000),polling:500});
   readyObserved=true;
   const start=page.locator('.tw-start-cta');
   if(await start.isVisible().catch(()=>false)){
    await start.click({timeout:8000});
    startClicked=true;
    await page.waitForTimeout(2500);
   }
  }catch(e){/* Explicitly recorded as not-ready rather than misreported as pass. */}
 }catch(e){navError=String(e);}
 const state=await page.evaluate(()=>{
  const q=s=>document.querySelector(s);
  const loader=q('#loader');
  return {title:document.title,canvasCount:document.querySelectorAll('canvas').length,
   bodyText:(document.body?.innerText||'').slice(0,1600),
   gpuSupported:!!navigator.gpu,
   loaderVisible:!!loader && getComputedStyle(loader).display!=='none' && !loader.classList.contains('tw-hidden'),
   gpuLost:window.__bermudaGpuLost||null,
   gpuStage:window.__bermudaGpuAudit?.stage||null,
   gpuAudit:window.__bermudaGpuAudit ? (a=>({stage:a.stage,stageAt:a.stageAt,frame:a.frame,submits:a.submits,queueAckFrame:a.queueAckFrame,queueAckAt:a.queueAckAt,queueStall:a.queueStall,lastSubmitAt:a.lastSubmitAt,currentFrameComputeCount:a.currentFrameComputeCount,lastSubmittedComputeCount:a.lastSubmittedComputeCount,lastSubmittedComputes:a.lastSubmittedComputes,lastSubmittedRenders:a.lastSubmittedRenders,errors:a.errors,reason:a.reason,lastError:a.lastError}))(window.__bermudaGpuAudit) : null,
   worldGate:window.__bermudaWorldGate||null,
   loadScreenText:(document.body?.innerText||'').slice(0,300),
   appPresent:!!document.querySelector('#app'),
   hudPresent:!!q('.gm-hud'),
   walletText:q('.gm-money')?.textContent??null,
   startVisible:!!q('.tw-start')&&getComputedStyle(q('.tw-start')).display!=='none'};
 }).catch(e=>({evaluationError:String(e)}));
 const requestsByPath=[...new Set(requests.map(r=>{try{return new URL(r.url).pathname;}catch{return r.url;}}))].sort();
 const data={scenario:scenario.name,status,navError,readyObserved,startClicked,state,requestCount:requests.length,requestsByPath,
  requestedGLBs:requestsByPath.filter(p=>p.endsWith('.glb')),
  failedRequests:failedRequests.slice(0,30),httpErrors:httpErrors.slice(0,30),
  errors:errors.slice(0,30),consoleErrors:consoleErrors.slice(0,30),
  caveat:'Chromium smoke only; not iPhone Safari and not a verified playable end-to-end session'};
 results.push(data);
 try { if(readyObserved)await page.screenshot({path:'audit-output/'+scenario.name+'.png',fullPage:false,timeout:12000}); }
 catch(e){data.screenshotError=String(e);}
 console.log(scenario.name,JSON.stringify({status,readyObserved,startClicked,loaderVisible:state.loaderVisible,canvasCount:state.canvasCount,requestedGLBs:data.requestedGLBs.length,errors:errors.length,webgpuErrors:consoleErrors.length,navError}));
 await context.close();
 await browser.close();
}
fs.writeFileSync('audit-output/browser-smoke.json',JSON.stringify({base,results},null,2)+'\n');
