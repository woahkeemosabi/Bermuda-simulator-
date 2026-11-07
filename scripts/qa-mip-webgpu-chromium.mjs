// WebGPU compatibility smoke for a software Chromium adapter. Not a Safari test.
// Captures shader-limit validation errors while running the real game bundle.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const port = 4187;
const address = 'http://127.0.0.1:' + port;
const results = { status:'unverified', adapter: null, frame: null, errors:[], console:[], pageErrors:[] };
const server = spawn('npm', ['run','preview','--','--host','127.0.0.1','--port',String(port)], { stdio:'ignore' });
let browser;
let failure = null;
try {
  let ready = false;
  for (let i=0;i<80;i++) {
    try { const response = await fetch(address); if (response.ok) {ready=true; break;} } catch (_) {}
    await new Promise(resolve=>setTimeout(resolve, 350));
  }
  if (!ready) throw new Error('Vite preview was not reachable');
  browser = await chromium.launch({
    headless:true,
    args: [
      '--no-sandbox',
      '--enable-unsafe-webgpu',
      '--enable-features=Vulkan,WebGPU',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader'
    ]
  });
  const context = await browser.newContext({
    viewport:{width:390,height:844},
    deviceScaleFactor:2,
    isMobile:true,hasTouch:true,
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  });
  const page=await context.newPage();
  page.on('console', msg => { if (msg.type()==='error') results.console.push(msg.text().slice(0,700)); });
  page.on('pageerror', error => results.pageErrors.push(String(error).slice(0,700)));
  page.on('requestfailed', req => { if (/\.wgsl($|\?)/.test(req.url())) results.errors.push('WGSL fetch '+req.url()); });
  await page.goto(address+'/?gpuTrace=1&traceCase=fftcore&qualityTest=crisp&vendorStream=1', {waitUntil:'domcontentloaded',timeout:30000});
  results.adapter=await page.evaluate(async()=>{
    if(!navigator.gpu)return {available:false,reason:'navigator.gpu unavailable'};
    const adapter=await navigator.gpu.requestAdapter();
    if(!adapter)return {available:false,reason:'requestAdapter returned null'};
    return {available:true,
      maxStorageTexturesPerShaderStage:adapter.limits.maxStorageTexturesPerShaderStage,
      maxSampledTexturesPerShaderStage:adapter.limits.maxSampledTexturesPerShaderStage
    };
  });
  if(results.adapter.available) {
    await page.waitForTimeout(55000);
    results.frame=await page.evaluate(()=>({
      frame:window.__app?.engine?.frame ?? null,
      stage:window.__bermudaGpuAudit?.stage ?? null,
      canvases:document.querySelectorAll('canvas').length,
      loaderText:document.querySelector('#loader')?.innerText?.slice(0,120) || '',
      gpuLost:window.__bermudaGpuLost || null
    }));
    const material = [...results.console, ...results.pageErrors, ...results.errors];
    const limit=material.filter(s=>/maxStorageTexturesPerShaderStage|5\s+(writable|storage)|storage\s+textures?.{0,80}(limit|4)|exceeded.{0,50}storage\s+texture/i.test(s));
    if(limit.length) {
      results.status='failed-storage-texture-validation';
      failure=new Error('4-storage-texture WebGPU validation failed: '+limit.slice(0,2).join(' | '));
    } else if(results.adapter.maxStorageTexturesPerShaderStage!==4) {
      results.status='inconclusive-adapter-not-four';
    } else {
      results.status='no-five-texture-errors-observed-in-55s';
    }
  } else results.status='inconclusive-no-webgpu-adapter';
  await context.close();
} catch (error) {
  failure ||= error;
  results.status='browser-experiment-failed';
  results.errors.push(String(error));
} finally {
  try{await browser?.close();}catch(_){}
  server.kill('SIGTERM');
  mkdirSync('audit-output',{recursive:true});
  writeFileSync('audit-output/mip-webgpu-chromium.json',JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
}
if(failure)process.exitCode=1;
