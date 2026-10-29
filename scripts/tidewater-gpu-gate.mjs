// Qualification only: no fake adapters, altered limits, or software rendering.
export function qualifyAdapter(probe) {
  const reasons=[];
  const info=probe?.info||{};
  const identity=[info.vendor,info.architecture,info.device,info.description].filter(Boolean).join(' ');
  if(!probe?.available)reasons.push('No WebGPU adapter');
  if(/swiftshader|llvmpipe|lavapipe|software|\bwarp\b|basic render|null backend/i.test(identity)||probe?.isFallbackAdapter===true||info.isFallbackAdapter===true)
    reasons.push('Software/fallback adapter is ineligible');
  if(probe?.available&&!/nvidia|\bamd\b|advanced micro devices|intel|apple|qualcomm|\barm\b|imagination/i.test(identity))
    reasons.push('Hardware identity not established');
  if(!(probe?.limits?.maxStorageTexturesPerShaderStage>=5))reasons.push('Requires at least 5 storage textures per shader stage');
  // Physical Safari evidence adds a 22-texture / 13-uniform-buffer layout.
  if(!(probe?.limits?.maxSampledTexturesPerShaderStage>=22))reasons.push('Requires at least 22 sampled textures per shader stage');
  if(!(probe?.limits?.maxUniformBuffersPerShaderStage>=13))reasons.push('Requires at least 13 uniform buffers per shader stage');
  return {status:reasons.length?'BLOCKED_UNSUITABLE_ENVIRONMENT':'CAPABILITY_GATE_PASSED',reasons,
    preferredStorageLimitMet:probe?.limits?.maxStorageTexturesPerShaderStage>=8,gameplayValidated:false};
}

// Runs on a blank local-origin page BEFORE any game code is loaded.
export async function probeAdapter() {
  const result={userAgent:navigator.userAgent,secureContext:isSecureContext,apiAvailable:!!navigator.gpu,
    available:false,info:null,limits:null,features:null,backend:null,driver:null,
    wgslLanguageFeatures:[...(navigator.gpu?.wgslLanguageFeatures||[])]};
  try {
    const adapter=await navigator.gpu?.requestAdapter({powerPreference:'high-performance'});
    if(!adapter)return result;
    const info=adapter.info||(adapter.requestAdapterInfo?await adapter.requestAdapterInfo():{});
    result.available=true;
    result.info=Object.fromEntries(['vendor','architecture','device','description','isFallbackAdapter','subgroupMinSize','subgroupMaxSize']
      .filter(k=>info[k]!==undefined).map(k=>[k,info[k]]));
    result.isFallbackAdapter=info.isFallbackAdapter??adapter.isFallbackAdapter??null;
    result.limits={};
    for(let p=adapter.limits;p&&p!==Object.prototype;p=Object.getPrototypeOf(p))
      for(const k of Object.getOwnPropertyNames(p))try{if(typeof adapter.limits[k]==='number')result.limits[k]=adapter.limits[k];}catch{}
    result.features=[...adapter.features].sort();
  }catch(error){result.error=String(error);}
  return result;
}
