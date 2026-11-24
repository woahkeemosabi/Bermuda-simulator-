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
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-webgpu','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:462,height:817},isMobile:true,hasTouch:true,deviceScaleFactor:1,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});
 page=await context.newPage();
 page.on('pageerror',e=>{report.errors.push(e.message);console.error('[browser-recovery] pageerror',e.message);});
 page.on('crash',()=>console.error('[browser-recovery] Chromium page crashed'));
 page.on('console',msg=>{if(msg.type()==='error'){report.errors.push(msg.text());console.error('[browser-recovery] browser console error:',msg.text().slice(0,1000));}});
 mark('browser page created');
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
} catch(e){report.failure=String(e?.stack||e);console.error('[browser-recovery] FAILED at '+stage,report.failure);if(page)await page.screenshot({path:`${out}/failure.png`,timeout:10000}).catch(()=>{});}
finally {clearInterval(heartbeat);mark('writing evidence and closing browser');writeFileSync(`${out}/browser.json`,JSON.stringify(report,null,2));await browser?.close();}
if(!report.passed)process.exitCode=1;
