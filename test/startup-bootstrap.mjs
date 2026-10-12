// Execute the real inline bootstrap with a mock browser/service-worker transport. No GPU required.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';

const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const code = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
const recovery = await fs.readFile(new URL('../src/core/StartupRecovery.js', import.meta.url), 'utf8');

async function boot({mobile=false, forced=false, select=null, active=true, installed=false}) {
  const events=[], elements=new Map();
  const el = id => {
    if (!elements.has(id)) elements.set(id, { dataset:{}, style:{}, classList:{add(){},toggle(){}}, addEventListener(name, fn){this[name]=fn;}, textContent:'' });
    return elements.get(id);
  };
  const worker = { postMessage(data, ports) {
    events.push(data.type === 'SET_NETWORK_MODE' ? 'mode:' + data.mode : data.type);
    const reply = data.type === 'SET_NETWORK_MODE' ? {mode:data.mode} : {ready:installed,playable:installed,fullBytes:161000000};
    queueMicrotask(() => ports?.[0]?.reply(reply));
  }};
  const sw = {controller:active?worker:null, getRegistration:async()=>active?{active:worker}:undefined, addEventListener(){}, removeEventListener(){}, register(){throw new Error('Online mode must not install an offline package');}};
  const context = vm.createContext({
    console, URL, URLSearchParams, Promise, queueMicrotask,
    setTimeout:(fn,ms)=>setTimeout(fn,ms).unref(), clearTimeout,
    MessageChannel:class {constructor(){this.port1={};this.port2={reply:data=>this.port1.onmessage?.({data})};}},
    navigator:{userAgent:mobile?'iPhone':'Chrome Desktop',maxTouchPoints:mobile?1:0,serviceWorker:sw,gpu:{}},
    screen:{width:mobile?390:1400,height:900},
    location:{href:'https://example.test/island/'+(forced?'?launch=online':''),search:forced?'?launch=online':'',protocol:'https:'},
    window:{matchMedia:()=>({matches:false}),addEventListener(){}},
    document:{getElementById:el,querySelector:el,documentElement:{classList:{toggle(){}}},body:{appendChild(){}},createElement:()=>el('badge')},
  });
  const mod = new vm.SourceTextModule(code,{context, importModuleDynamically:async specifier=>{
    events.push('import:'+specifier);
    const stub = new vm.SyntheticModule([],function(){},{context});
    await stub.link(()=>{}); await stub.evaluate(); return stub;
  }});
  await mod.link(async()=>{ const dep=new vm.SourceTextModule(recovery,{context}); await dep.link(()=>{}); return dep; });
  const done=mod.evaluate();
  if(select){
    for(let n=0;n<30 && el('launch-mode').dataset.open!=='1';n++) await new Promise(r=>setTimeout(r,1));
    assert.equal(el('launch-mode').dataset.open,'1','mobile mode picker opens');
    await el('launch-'+select).click();
  }
  await done;
  return {events,elements,mode:context.window.__bermudaLaunchMode};
}

for (const options of [{},{mobile:true,forced:true},{mobile:true,select:'online'},{active:false},{mobile:true,forced:true,active:false}]) {
  const r=await boot(options);
  assert(r.events.includes('import:/src/main.js'));
  assert(!r.events.includes('INSTALL_FULL_OFFLINE'));
  if(options.active!==false) assert(r.events.indexOf('mode:online') < r.events.indexOf('import:/src/main.js'), 'clear stale offline mode before engine import');
  assert.equal(r.mode,'online');
}
const offline=await boot({mobile:true,installed:true,select:'offline'});
assert(offline.events.indexOf('mode:offline') < offline.events.indexOf('import:/src/main.js'));
assert(!offline.events.includes('INSTALL_FULL_OFFLINE'));
console.log('Bootstrap passed: desktop, mobile Online, recovery link, fresh device, and installed Offline.');
