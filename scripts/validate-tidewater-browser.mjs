import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const port=4179;
const server=spawn('npm',['run','preview','--','--host','127.0.0.1','--port',String(port)],{stdio:'ignore'});
const results=[];
try {
 let online=false;
 for(let i=0;i<60;i++){
  try { const r=await fetch('http://127.0.0.1:'+port+'/');if(r.ok){online=true;break;} }catch{}
  await new Promise(r=>setTimeout(r,500));
 }
 if(!online)throw Error('Preview server failed to start');
 const browser=await chromium.launch({headless:true,args:['--enable-unsafe-webgpu','--enable-features=Vulkan,WebGPU']});
 for(const scenario of [{name:'desktop-boat',mobile:false},{name:'mobile-boat',mobile:true}]){
  const context=await browser.newContext(scenario.mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}:{viewport:{width:1280,height:720}});
  const page=await context.newPage(),errors=[],consoleErrors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  const response=await page.goto('http://127.0.0.1:'+port+'/?missions=boat&launch=online',{waitUntil:'domcontentloaded',timeout:30000});
  let ready=false;
  try {await page.waitForFunction(()=>{const l=document.querySelector('#loader');return l&&(l.classList.contains('tw-hidden')||getComputedStyle(l).display==='none');},null,{timeout:60000});ready=true;}catch{}
  const state=await page.evaluate(async()=>{let adapter=null,adapterError=null;try{adapter=await navigator.gpu?.requestAdapter({powerPreference:'high-performance'});}catch(e){adapterError=String(e);}return {title:document.title,canvasCount:document.querySelectorAll('canvas').length,loaderText:document.querySelector('#loader')?.innerText?.slice(0,180)||'',gpu:!!navigator.gpu,adapterAvailable:!!adapter,maxStorageTexturesPerShaderStage:adapter?.limits?.maxStorageTexturesPerShaderStage??null,adapterError};});
  results.push({scenario:scenario.name,http:response.status(),ready,state,errors:errors.slice(0,12),consoleErrors:consoleErrors.slice(0,12)});
  await context.close();
 }
 await browser.close();
}finally{server.kill('SIGTERM');fs.mkdirSync('audit-output',{recursive:true});fs.writeFileSync('audit-output/tidewater-baseline-browser.json',JSON.stringify(results,null,2));}
console.log(JSON.stringify(results,null,2));
