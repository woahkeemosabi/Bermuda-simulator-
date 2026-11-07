#!/usr/bin/env python3
"""QA-only overlay. Fail closed if the pinned source anchors change."""
from pathlib import Path
import json,os,subprocess,hashlib
r=Path('_qa/fftcore')
def patch(name,old,new,count=1):
 p=r/name;s=p.read_text();assert s.count(old)==count,(name,old[:60],s.count(old));p.write_text(s.replace(old,new))
def section(name,start,end,new):
 p=r/name;s=p.read_text();a=s.index(start);b=s.index(end,a);p.write_text(s[:a]+new+s[b:])
assert subprocess.check_output(['git','-C',str(r),'rev-parse','HEAD'],text=True).strip()=='cdc2e9eb800be092901b7772967d177a98ef2c5b'
(r/'src/mobile/QAEngine.js').write_bytes(Path('tools/qa/QAEngine.js').read_bytes())
(r/'src/engine/gpu/Readback.js').write_bytes(Path('tools/qa/Readback.js').read_bytes())
patch('src/engine/gpu/GPU.js','export const GPU = {',"import {config,metrics,event,SubmissionManager,installLedger} from '../../mobile/QAEngine.js';\nexport const GPU = {")
patch('src/engine/gpu/GPU.js','\t_submitHooks: [],','\t_submitHooks: [],\n _retired: [],\n pipelineFailures: [],\n _scopePending:false,')
patch('src/engine/gpu/GPU.js','\t\tthis.queue = device.queue;', '''\t\tthis.queue = device.queue;
        this.submissions=new SubmissionManager(this.queue,{
          onComplete:({frame,latencyMs})=>{gpuQueueAck(frame);metrics.queueMs=latencyMs;metrics.queuePeakMs=Math.max(metrics.queuePeakMs,latencyMs);},
          onFailure:e=>{this.fatalError||=e;this.abortFrame(e);gpuQueueStall(e.message);globalThis.window?.__bermudaOnGPUFailure?.(e.message);}
        });
        if(config.diagnostics)metrics.resources=installLedger(device);
        if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{
          this.submissions.setHidden(document.hidden);event('visibility',document.visibilityState);
        });''')
patch('src/engine/gpu/GPU.js',"\t\t\tif ( typeof window !== 'undefined' ) {\n\t\t\t\twindow.__bermudaGpuLost", "\t\t\tthis.submissions.fail(this.fatalError);event('device-lost',this.fatalError.message);\n\t\t\tif ( typeof window !== 'undefined' ) {\n\t\t\t\twindow.__bermudaGpuLost")
patch('src/engine/gpu/GPU.js','if(gpuAudit.traceEnabled){','if(config.scopes && !this._scopePending && this.frame%120===0){')
section('src/engine/gpu/GPU.js','\t// Submit everything recorded so far.','\t// ---- pipelines','''    submit(){
      if(!this.encoder)return this.whenIdle();
      const hooks=this._submitHooks;this._submitHooks=[];
      try{
        for(const h of hooks)h.before?.(this.encoder);
        const command=this.encoder.finish();this.encoder=null;
        const done=this.submissions.submit([command],this.frame);
        gpuSubmit(this.frame);metrics.ackCalls=this.submissions.ackCalls;metrics.peakInFlight=this.submissions.peakInFlight;
        for(const h of hooks)h.after?.();this._drainRetired();return done;
      }catch(e){for(const h of hooks)h.abort?.(e);this.abortFrame(e);throw e;}
      finally{this._closeScopes();}
    },
    whenIdle(){return this.submissions?.done()||Promise.resolve();},
    onSubmit(before,after,abort){this._submitHooks.push({before,after,abort});},
    abortFrame(e=Error('Frame cancelled')){
      this.encoder=null;const hooks=this._submitHooks;this._submitHooks=[];
      for(const h of hooks)h.abort?.(e);this._drainRetired();this._closeScopes();
    },
    retire(resource){if(!resource)return;if(this.encoder)this._retired.push(resource);else resource.destroy();},
    _drainRetired(){const old=this._retired;this._retired=[];for(const r of old)r.destroy();},
    _closeScopes(){
      if(!this._traceErrorScopesOpen)return;this._traceErrorScopesOpen=false;this._scopePending=true;metrics.scopePairs++;
      Promise.all(['out-of-memory','validation'].map(kind=>this.device.popErrorScope().then(e=>{if(e)gpuError(kind,e.message);},e=>gpuError('scope',String(e)))))
        .finally(()=>{this._scopePending=false;});
    },
''')
patch('src/engine/gpu/GPU.js','\t\t\t\th.failed = true;','\t\t\t\th.failed = true;\n                this.pipelineFailures.push(desc.label);')
patch('src/engine/gpu/GPU.js','\t\tthis.syncCompiles.push( h.label );','\t\tthis.syncCompiles.push( h.label );\n        if(this.syncCompiles.length>128)this.syncCompiles.shift();')
patch('src/engine/gpu/GPU.js','while ( this._pending.size ) await Promise.all( [ ...this._pending ] );',"while ( this._pending.size ) await Promise.all( [ ...this._pending ] );\n        if(this.pipelineFailures.length)throw Error('Pipeline failed: '+this.pipelineFailures.join(', '));")
patch('src/engine/Engine.js','\t\tthis.clock = new Timer();','\t\tthis.clock = new Timer();\n        this.clock.connect(document);')
p=r/'src/engine/Engine.js';s=p.read_text().replace('\t\t\tif ( this.mobileGpuFramePacing ) {','''            if(document.hidden)return;
            try{GPU.submissions.checkHealth();}catch(e){this.stop();this.onFrameFailure?.(e,1);return;}
            if(!GPU.submissions.available)return;
\t\t\tif ( this.mobileGpuFramePacing ) {''',1);p.write_text(s)
patch('src/engine/Engine.js',"this._gpuInFlight || ( this._mobileLastFrame && t - this._mobileLastFrame < (window.__bermudaMobilePaceMs || 42) )",'this._mobileLastFrame && t-this._mobileLastFrame<42')
section('src/engine/Engine.js','\t\t\t\tif ( this.mobileGpuFramePacing ) {\n\t\t\t\t\tthis._gpuInFlight','\t\t\t\tthis._sampleBenchmark','')
patch('src/engine/Engine.js','\t\t\t\tGPU.encoder = null;\n\t\t\t\tGPU._submitHooks = [];','\t\t\t\tGPU.abortFrame(e);')
patch('src/engine/gpu/Texture.js','GPU.onSubmit( null, () => old.destroy() );','GPU.retire(old);')
patch('src/engine/gpu/Texture.js','if ( this.gpu ) this.gpu.destroy();','if ( this.gpu ) GPU.retire(this.gpu);',2)
p=r/'src/engine/render/MeshRenderer.js';s=p.read_text()
for name in ['this.drawBuffer','b.buffer','g.index.buffer']:s=s.replace(name+'.destroy()','GPU.retire('+name+')')
p.write_text(s)
section('src/game/Vendor.js','\t\t// Wait for prior GPU uses','\n\t}\n\n\t// idle motion',"        try{old.dispose();}catch(e){console.warn('Vendor disposal',e);}\n")
patch('src/world/bermuda/StaticAsset.js',"const encoder = GPU.device.createCommandEncoder( { label: id + '-mips' } );\n                        generateMipmaps( map, encoder );\n                        GPU.queue.submit( [ encoder.finish() ] );\n                        await GPU.queue.onSubmittedWorkDone();","await GPU.whenIdle();\n                        generateMipmaps(map,GPU.getEncoder());\n                        await GPU.submit();")
for name in ['src/App.js','src/main.js','src/mobile/WorldRenderGate.js','src/core/Bench.js']:
 p=r/name;s=p.read_text().replace('GPU.queue.onSubmittedWorkDone()','GPU.whenIdle()');p.write_text(s)
patch('src/App.js','\t\t\t\tthis.frame( 1 / 60 );\n\n\t\t\t}','\t\t\t\tthis.frame( 1 / 60 );\n                await GPU.whenIdle();\n\n\t\t\t}')
patch('src/App.js',"import { GPU", "import {config,measureFrame} from './mobile/QAEngine.js';\nimport { GPU")
patch('src/App.js','\t\tthis.cpuMs = this.cpuMs === undefined ? ms : this.cpuMs * 0.95 + ms * 0.05;','\t\tthis.cpuMs = this.cpuMs === undefined ? ms : this.cpuMs * 0.95 + ms * 0.05;\n        measureFrame(ms,GPU,this);')
patch('src/App.js',"if ( !this.qs.has('freezeFFT') || !this._fftInitialized )","if ( (!this.qs.has('freezeFFT') && config.isolate!=='fft') || !this._fftInitialized )")
patch('src/App.js','\t\t// ---- render\n\t\tgpuStage',"        if(config.isolate==='render'&&this._qaRendered){GPU.submit();this.input.endFrame();return;}\n        this._qaRendered=true;\n\t\t// ---- render\n\t\tgpuStage")
patch('src/ocean/WaterQuery.js','import { G,',"import {config} from '../mobile/QAEngine.js';\nimport { G,")
patch('src/ocean/WaterQuery.js',"\t\tthis.readback = new Readback( { byteLength: MAX_QUERIES * 16, ring: 3, label: 'waterQuery' } );","\t\tthis.readback = new Readback( { byteLength: MAX_QUERIES * 16, ring: 3, label: 'waterQuery' } );\n        this.readback.onError=()=>{this._pending=false;};")
patch('src/ocean/WaterQuery.js','\t\t// Diagnostic only:',"        if(config.isolate==='queries'&&this.cpuValid)return;\n\t\t// Diagnostic only:")
patch('src/ocean/WaterQuery.js','if ( ! this._pending ) {',"if(!this._pending && !(config.isolate==='readback'&&this.cpuValid)){")
patch('src/ocean/WaterQuery.js','if ( i >= ${ MAX_QUERIES }u ) { return; }','if ( i >= u32(queryInputs[0].z) ) { return; }')
patch('src/ocean/WaterQuery.js','\t\tthis.inputBuffer.write( this.inputs );','\t\tthis.inputs[2]=this.count;\n\t\tthis.inputBuffer.write( this.inputs );')
patch('src/ocean/WaterQuery.js',"if ( typeof window !== 'undefined' && window.__bermudaThrottleWaterQueries ) {","""const a=globalThis.window?.__app,activePlayer=a?.player;
        const activeWater=a?.boatCtl?.driven||activePlayer?.mode==='swim'||(activePlayer&&(activePlayer.wade>0||activePlayer.position.y<2.8));
        if ( typeof window !== 'undefined' && window.__bermudaThrottleWaterQueries && !activeWater ) {""")
section('src/mobile/WorldRenderGate.js','  // Change only anti-aliasing/pixel scale','  await sleep(350);','')
patch('src/mobile/WorldRenderGate.js','GPU.encoder=null;GPU._submitHooks=[];','GPU.abortFrame();')
patch('src/mobile/WorldRenderGate.js','if(!submitted&&rejectPending)GPU._submitHooks=[];','if(!submitted&&rejectPending)GPU.abortFrame();')
patch('src/mobile/GpuAudit.js','const now=',"import {config} from './QAEngine.js';\nconst now=")
patch('src/mobile/GpuAudit.js',"traceEnabled:typeof location!=='undefined'&&new URLSearchParams(location.search).get('gpuTrace')==='1',",'traceEnabled:config.diagnostics,')
patch('src/mobile/GpuAudit.js','a.pendingSubmissions.push(item);','a.pendingSubmissions.push(item);\n  if(a.pendingSubmissions.length>16)a.pendingSubmissions.shift();')
patch('src/mobile/VendorStreamConfig.js',"const q=new URLSearchParams(search);","const q=new URLSearchParams(search);\n return q.get('qaMode')==='isolation'&&q.get('isolate')==='disposal';\n /*")
patch('src/mobile/VendorStreamConfig.js',"q.get('vendorStream')==='1';","q.get('vendorStream')==='1'; */")
patch('src/main.js',"import './core/BenchSeed.js';","import './core/BenchSeed.js';\nimport {config,metrics,ready,deadline,saveRecovery,restoreRecovery} from './mobile/QAEngine.js';")
patch('src/main.js',"if(gpuTraceActive && gpuTraceCase.id !== 'full')installGpuTraceControls();",'if(config.diagnostics)installGpuTraceControls();')
patch('src/main.js','\tif ( mobileFastStart ) applyMobileMemoryProfile( app );','\twindow.__bermudaRecoveryRestored=restoreRecovery(app);\n\tif ( mobileFastStart ) applyMobileMemoryProfile( app );')
patch('src/main.js','frameCount: MOBILE_FULL_PRELOAD_FRAMES,','frameCount: 8,')
patch('src/main.js','frameWaitMs: MOBILE_FULL_PRELOAD_WAIT_MS,','frameWaitMs: 130,')
section('src/main.js',"        if (gpuTraceActive && gpuTraceCase.id === 'fftcore') {\n            gpuStage('Finishing","        ui.setLoading(1, 'World and audio ready');","        window.__bermudaQAReadiness=await ready({GPU,app,audioReady:qaAudioReady,startedAt:qaWarmStart});\n")
section('src/main.js','\t\tawait Promise.race( [\n\t\t\tGPU.pipelinesReady(),','\t\tif ( this.engine',"\t\tawait deadline(GPU.pipelinesReady(),60000,'Initial shader compilation');\n")
patch('src/main.js','function showWorldFailure(message){','function showWorldFailure(message){\n app.engine?.stop();\n if(!window.__bermudaRecoverySaved)window.__bermudaRecoverySaved=saveRecovery(app);')
patch('src/main.js',"diag.hidden=gpuTraceActive && gpuTraceCase.id === 'full';",'diag.hidden=true;')
patch('src/main.js',"if (gpuTraceActive) retry.textContent='Retry full graphics';","if (gpuTraceActive) retry.textContent='Restart saved game';")
patch('src/main.js','const body=gpuDetailedReport(app,mobileRetryLevel)',"const body=window.__bermudaQAReport()+'\\n\\n'+gpuDetailedReport(app,mobileRetryLevel)")
patch('src/main.js','window.__bermudaOnGPUFailure=message=>{',"if(config.mode==='recovery')window.__bermudaQALoseDevice=()=>{saveRecovery(app);GPU.device.destroy();};\nwindow.__bermudaOnGPUFailure=message=>{")
patch('src/audio/SoundScape.js','this._buffers.set( name, buf );','this._buffers.set( name, buf );\n                    this._preloadedAudioBytes?.delete(name);')
patch('src/audio/SoundScape.js','.catch( ( e ) => this._warn( e ) );','.catch( ( e ) => this._warn( e ) ).finally(()=>this._loading.delete(name));')
patch('src/mobile/QAStartupAudio.js',"{ cache: 'force-cache' }","{ cache: 'force-cache', signal: AbortSignal.timeout(20000) }")
patch('src/game/FishPortrait.js',"console.warn( 'fish thumbnail failed', e );","try{staging.unmap();}catch(_){}\n                staging.destroy();\n                console.warn( 'fish thumbnail failed', e );")
patch('src/game/FishPortrait.js','\t\t} );\n\n\t}\n\n\t// ---- per frame','\t\t},()=>{staging.destroy();this.busy=false;this.pending.delete(species);job.resolve(null);} );\n\n\t}\n\n\t// ---- per frame')
patch('src/ocean/ComputeMips.js','import { ComputeKernel }','import { GPU, ComputeKernel }')
patch('src/ocean/ComputeMips.js','\t\t// threads (lx, ly) < width reduce','''        if(top>GPU.limits.maxStorageTexturesPerShaderStage){
          this.levelKernels=[];
          for(let level=1;level<levels;level++){
            const width=Math.max(1,res>>level);
            this.levelKernels.push({width,kernel:new ComputeKernel({label:label+' mip '+level,
              bindings:{inputMip:src(level-1),outputMip:out(level)},workgroupSize:[8,8,1],code:`
@compute @workgroup_size(WG_X,WG_Y,WG_Z) fn main(@builtin(global_invocation_id) p:vec3u){
 if(p.x>=${width}u||p.y>=${width}u){return;}let q=p.xy*2u;
 let v=(textureLoad(inputMip,q,p.z,0)+textureLoad(inputMip,q+vec2u(1u,0u),p.z,0)+textureLoad(inputMip,q+vec2u(0u,1u),p.z,0)+textureLoad(inputMip,q+vec2u(1u,1u),p.z,0))*0.25;
 textureStore(outputMip,p.xy,p.z,v);
}`})});
          }return;
        }
\t\t// threads (lx, ly) < width reduce''')
patch('src/ocean/ComputeMips.js','\t\tconst o = pass ? { pass } : undefined;','\t\tconst o = pass ? { pass } : undefined;\n        if(this.levelKernels){for(const {width,kernel} of this.levelKernels)kernel.dispatch([Math.ceil(width/8),Math.ceil(width/8),this.layers],o);return;}')
files=sorted(Path('tools/qa').glob('*'))
fingerprint=hashlib.sha256(b''.join(p.read_bytes() for p in files if p.is_file())).hexdigest()
info={'sourceCommit':os.getenv('GITHUB_SHA')or subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'patchSha256':fingerprint,'snapshot':'cdc2e9eb800be092901b7772967d177a98ef2c5b'}
(r/'public/qa-build.json').write_text(json.dumps(info,indent=2))
p=r/'index.html';s=p.read_text();p.write_text(s.replace('<head>','<head>\n<script>window.__bermudaQABuild='+json.dumps(info)+';</script>',1))
print('QA recovery overlay applied:',fingerprint)
