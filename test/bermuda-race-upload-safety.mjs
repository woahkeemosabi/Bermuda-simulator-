import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { downsampleRGBA8 } from '../src/world/bermuda/StaticAsset.js';

const image={ width:1024, height:1024, data:new Uint8Array(1024*1024*4) };
for(let i=0;i<image.data.length;i+=4){image.data[i]=173;image.data[i+1]=49;image.data[i+2]=222;image.data[i+3]=255;}
const resized=downsampleRGBA8(image,512);
assert.equal(resized.width,512);
assert.equal(resized.height,512);
assert.equal(resized.data.length,512*512*4);
assert.deepEqual(Array.from(resized.data.subarray(0,4)),[173,49,222,255]);
assert.strictEqual(downsampleRGBA8(resized,512),resized);
assert.equal(downsampleRGBA8(image,256).width,256);
const portrait=downsampleRGBA8({width:512,height:1024,data:new Uint8Array(512*1024*4)},256);
assert.equal(portrait.width,128);assert.equal(portrait.height,256);
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
for(const p of ['src/game/RaceSoundOriginalModel.js','src/game/HarbourMeshyEnhancement.js']){
  const s=source(p);
  assert.ok(s.includes('maxGpuTextureSize:512'),p+' must cap racing texture residency');
  assert.ok(s.includes('generateGpuMipmaps:false'),p+' must not launch extra GPU mip passes on Safari');
}
const glb=source('src/game/RaceSoundOriginalModel.js');
assert.ok(glb.includes('asset.textures.size!==3'), 'Keep exact original 3 racing textures and 15,720-triangle boat');
assert.ok(glb.includes('maxMaterials:6, ignoreAnimations:true'), 'Original GLB must load its 6 materials and discard only its demo animation');
const staticAsset=source('src/world/bermuda/StaticAsset.js');
assert.ok(staticAsset.includes('maxMaterials = 4, ignoreAnimations = false'), 'Other Meshy assets retain strict default limits');
assert.ok(staticAsset.includes('if (ignoreAnimations && gltf.animations.length)'), 'Opt-in original demo clip must be removed before staticGeometry');
assert.ok(staticAsset.includes('materials.size >= maxMaterials'), 'Original 6-material GLB must not fail after uploading four materials');
console.log('Bermuda Simulator iPhone: 1024px -> 512px, original GLBs, no GPU mip compute PASS');
