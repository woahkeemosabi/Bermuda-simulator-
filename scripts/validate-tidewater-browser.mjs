import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { qualifyAdapter, probeAdapter } from './tidewater-gpu-gate.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const appRoot=path.resolve(process.env.TIDEWATER_APP_ROOT||root);
const output=path.resolve(process.env.TIDEWATER_QA_OUTPUT||'audit-output/tidewater-hardware');
const port=Number(process.env.TIDEWATER_QA_PORT||4179);
const seconds=Number(process.env.TIDEWATER_QA_SECONDS||60);
const headed=process.env.TIDEWATER_QA_HEADED==='1';
const probeOnly=process.argv.includes('--probe-only');
const url='http://127.0.0.1:'+port;
// Linux availability flags only; no limit overrides, disabled validation,
// software backend selection, or GPU blocklist bypass.
const args=process.platform==='linux'?['--enable-features=Vulkan','--enable-unsafe-webgpu']:[];
fs.mkdirSync(output,{recursive:true});
const report={
  schema:1,startedAt:new Date().toISOString(),status:'NOT_RUN',probeOnly,
  scope:'Desktop Chromium; not physical iPhone Safari',browserLaunch:{headed,args},
  commit:execFileSync('git',['rev-parse','HEAD'],{cwd:appRoot,encoding:'utf8'}).trim(),
  checks:Object.fromEntries(['hardware','shaderCompilation','loader','input','rendering','fft','caustics','wake',
    'fishingUI','joeSellingUI','earn3200UI','boatPurchaseUI','physicalIPhoneSafari'].map(k=>[k,'NOT_RUN'])),
  console:[],pageErrors:[],requestFailures:[],httpErrors:[],samples:[],
  metrics:{startupMs:null,submittedFPS:null,jsHeapBytes:null,gpuMemoryBytes:null},
};
let browser,page,server;
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
function bounded(promise,ms,label){
  let timer;return Promise.race([promise,new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(new Error(label+' timed out')),ms);
  })]).finally(()=>clearTimeout(timer));
}
async function screenshot(name){
  if(page&&!page.isClosed())try{await page.screenshot({path:path.join(output,name),timeout:10000});}
  catch(e){(report.captureErrors||=[]).push(String(e));}
}
// Observational native-call wrappers: returned devices/modules, shader code,
// limits, features, dispatches, quality and saves are NEVER substituted.
function instrument(){
  const numeric=obj=>{
    const result={};for(let p=obj;p&&p!==Object.prototype;p=Object.getPrototypeOf(p))
      for(const k of Object.getOwnPropertyNames(p))try{if(typeof obj[k]==='number')result[k]=obj[k];}catch{}
    return result;
  };
  const trace=window.__tidewaterQA={devices:[],errors:[],losses:[],shaderMessages:[],shaderModules:0,pendingShaderInfo:0};
  if(!window.GPUAdapter)return;
  const request=GPUAdapter.prototype.requestDevice;
  GPUAdapter.prototype.requestDevice=async function(...args){
    const d=await Reflect.apply(request,this,args);
    trace.devices.push({requested:args[0]||{},limits:numeric(d.limits),features:[...d.features],
      adapter:{vendor:this.info?.vendor,architecture:this.info?.architecture,device:this.info?.device,
        description:this.info?.description,isFallbackAdapter:this.info?.isFallbackAdapter??this.isFallbackAdapter??null}});
    d.addEventListener('uncapturederror',e=>trace.errors.push({at:performance.now(),name:e.error.name,message:e.error.message}));
    d.lost.then(i=>trace.losses.push({at:performance.now(),reason:i.reason,message:i.message}));
    return d;
  };
  const create=GPUDevice.prototype.createShaderModule;
  GPUDevice.prototype.createShaderModule=function(...args){
    const module=Reflect.apply(create,this,args);trace.shaderModules++;trace.pendingShaderInfo++;
    module.getCompilationInfo().then(info=>{
      for(const m of info.messages)trace.shaderMessages.push({label:args[0]?.label||'',type:m.type,
        message:m.message,lineNum:m.lineNum,linePos:m.linePos});
    }).catch(e=>trace.errors.push({name:'CompilationInfoError',message:String(e)})).finally(()=>trace.pendingShaderInfo--);
    return module;
  };
}
function snapshot(){
  const a=window.__app,l=document.querySelector('#loader'),p=a?.player?.position,h=performance.memory;
  return {at:performance.now(),engineFrame:a?.engine?.frame??null,gpuFrame:a?.gpu?.frame??null,
    loaderHidden:!!l&&(l.classList.contains('tw-hidden')||getComputedStyle(l).display==='none'),
    loaderText:l?.innerText||'',position:p?{x:p.x,y:p.y,z:p.z}:null,
    canvas:{width:a?.engine?.canvas?.width??null,height:a?.engine?.canvas?.height??null},
    quality:{mobileLite:a?.mobileLite??null,recoveryMode:a?.recoveryMode??null,renderScale:a?.engine?.renderScale??null,
      oceanCascades:a?.fft?.cascades??null,causticsFine:a?.caustics?.fine?.texture?.width??null,
      causticsBroad:a?.caustics?.broad?.texture?.width??null,wakeGrid:a?.wake?.display?.width??null},
    jsHeap:h?{used:h.usedJSHeapSize,total:h.totalJSHeapSize,limit:h.jsHeapSizeLimit}:null,
    gpuTrace:window.__tidewaterQA||null};
}
try{
  if(!Number.isFinite(seconds)||seconds<10||seconds>300)throw new Error('Sample duration must be 10–300 seconds');
  if(!fs.existsSync(path.join(appRoot,'dist/index.html')))throw new Error('Run npm run build first');
  const log=fs.openSync(path.join(output,'server.txt'),'w');
  server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1',
    '--port',String(port),'--strictPort'],{cwd:appRoot,stdio:['ignore',log,log]});fs.closeSync(log);
  let online=false;
  for(let i=0;i<40;i++){
    if(server.exitCode!==null)throw new Error('Preview server exited '+server.exitCode);
    try{if((await fetch(url,{signal:AbortSignal.timeout(500)})).ok){online=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,250));
  }
  if(!online)throw new Error('Preview server unavailable');
  // A new isolated local browser, never attached to the session cloud browser.
  browser=await chromium.launch({headless:!headed,args,timeout:30000,
    ...(process.env.TIDEWATER_CHROME_PATH?{executablePath:process.env.TIDEWATER_CHROME_PATH}:{})});
  report.browserVersion=browser.version();
  try{
    const cdp=await browser.newBrowserCDPSession(),info=await cdp.send('SystemInfo.getInfo');
    report.browserGPU={devices:info.gpu.devices,auxAttributes:info.gpu.auxAttributes,featureStatus:info.gpu.featureStatus};
    // GL backend metadata is corroborating evidence, not proof of Dawn's backend.
    await cdp.detach();
  }catch(e){report.browserGPUError=String(e);}
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  page=await context.newPage();page.setDefaultTimeout(15000);
  await page.route('**/__tidewater_qa_probe__',r=>r.fulfill({contentType:'text/html',
    body:'<!doctype html><title>Tidewater GPU qualification</title><h1>GPU qualification — game not loaded</h1><pre id="result">Probing real adapter…</pre>'}));
  await page.goto(url+'/__tidewater_qa_probe__');
  report.adapter=await bounded(page.evaluate(probeAdapter),15000,'Adapter request');
  report.qualification=qualifyAdapter(report.adapter);report.checks.hardware=report.qualification.status;
  await page.locator('#result').evaluate((el,text)=>{el.textContent=text;},JSON.stringify({adapter:report.adapter,qualification:report.qualification},null,2));
  await screenshot('adapter.png');save();
  if(report.qualification.status!=='CAPABILITY_GATE_PASSED'){
    report.status='BLOCKED_UNSUITABLE_ENVIRONMENT';process.exitCode=2;
  }else if(probeOnly){report.status='CAPABILITY_GATE_PASSED_GAME_NOT_TESTED';}
  else{
    await context.addInitScript(instrument);
    page.on('console',m=>report.console.push({type:m.type(),text:m.text(),location:m.location()}));
    page.on('pageerror',e=>report.pageErrors.push(String(e)));
    page.on('requestfailed',r=>report.requestFailures.push({url:r.url(),failure:r.failure()}));
    page.on('response',r=>{if(r.status()>=400)report.httpErrors.push({url:r.url(),status:r.status()});});
    // Default desktop quality: no recovery, frozen FFT, reduced cascades or save injection.
    report.gameURL=url+'/?missions=boat&launch=online&desktop';const start=performance.now();
    await page.goto(report.gameURL,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>{const l=document.querySelector('#loader');return l&&
      (l.classList.contains('tw-hidden')||getComputedStyle(l).display==='none');},null,{timeout:120000});
    report.metrics.startupMs=performance.now()-start;report.checks.loader='PASS';await screenshot('loader-dismissed.png');
    await page.locator('.tw-start-cta').click();await page.waitForFunction(()=>window.__ui?._start===false);
    const before=await page.evaluate(snapshot);
    await page.keyboard.down('KeyW');await page.waitForTimeout(750);await page.keyboard.up('KeyW');
    const after=await page.evaluate(snapshot);
    report.inputEvidence={before:before.position,after:after.position};
    report.checks.input=before.position&&after.position&&Math.hypot(after.position.x-before.position.x,after.position.z-before.position.z)>0.05?'PASS':'FAIL';
    await screenshot('world-after-input.png');
    for(let i=0;i<=seconds;i++){
      const {gpuTrace,...s}=await page.evaluate(snapshot);report.samples.push(s);report.gpuTrace=gpuTrace;save();
      if(gpuTrace?.losses.length||gpuTrace?.errors.length)break;
      if(i<seconds)await page.waitForTimeout(1000);
    }
    await bounded(page.evaluate(()=>window.__app.gpu.queue.onSubmittedWorkDone()),15000,'GPU queue completion');
    report.queueCompleted=true;
    const final=await page.evaluate(snapshot),trace=final.gpuTrace,q=final.quality;
    report.finalState=final;report.gpuTrace=trace;
    const first=report.samples[0],last=report.samples.at(-1);
    report.metrics.submittedFPS=last.at>first.at?(last.gpuFrame-first.gpuFrame)*1000/(last.at-first.at):null;
    report.metrics.jsHeapBytes=final.jsHeap?.used??null;
    report.metrics.memoryScope='JS heap only; total browser RSS and GPU VRAM not measured';
    report.checks.shaderCompilation=trace?.shaderModules>0&&trace.pendingShaderInfo===0&&!trace.errors.length&&
      !trace.shaderMessages.some(m=>m.type==='error')&&!report.console.some(m=>m.type==='error'&&/pipeline|WebGPU|shader/i.test(m.text))?'PASS':'FAIL';
    report.fullQualityConfigurationObserved=q.oceanCascades===4&&q.causticsFine===512&&q.causticsBroad===256&&
      q.wakeGrid===512&&q.mobileLite===false&&q.recoveryMode===false&&q.renderScale===1;
    Object.assign(report.checks,{fft:'REQUIRES_NUMERICAL_AND_VISUAL_QA',caustics:'REQUIRES_VISUAL_QA',
      wake:'REQUIRES_DRIVEN_BOAT_QA',rendering:'REQUIRES_SCREENSHOT_REVIEW'});
    const d=trace?.devices[0];report.appQualification=qualifyAdapter({available:!!d,info:d?.adapter,limits:d?.limits});
    const healthy=report.appQualification.status==='CAPABILITY_GATE_PASSED'&&report.checks.input==='PASS'&&
      report.checks.shaderCompilation==='PASS'&&report.fullQualityConfigurationObserved&&final.loaderHidden&&
      final.engineFrame>before.engineFrame&&report.metrics.submittedFPS>0&&!trace.losses.length&&
      !report.pageErrors.length&&!report.httpErrors.length&&!report.requestFailures.length;
    report.startupSmoke=healthy?'PASS':'FAIL';report.status=healthy?'INCOMPLETE_MANUAL_GAMEPLAY_QA':'FAIL';
    process.exitCode=healthy?3:1;await screenshot('world-end.png');
  }
}catch(e){
  report.status=browser?'FAIL':'BLOCKED_BROWSER_UNAVAILABLE';report.error=String(e.stack||e);process.exitCode=browser?1:2;
  if(page)try{report.finalState=await bounded(page.evaluate(snapshot),5000,'Failure snapshot');}catch(e){report.snapshotError=String(e);}
  await screenshot('failure.png');
}finally{
  report.finishedAt=new Date().toISOString();save();
  if(browser)await bounded(browser.close(),10000,'Browser close').catch(e=>{report.closeError=String(e);});
  if(server)server.kill('SIGTERM');
  save();console.log(JSON.stringify({status:report.status,qualification:report.qualification,checks:report.checks,
    metrics:report.metrics,report:path.join(output,'report.json')},null,2));
}
