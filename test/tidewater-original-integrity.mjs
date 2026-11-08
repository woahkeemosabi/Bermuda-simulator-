import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const manifest=JSON.parse(readFileSync(new URL('./tidewater-original-manifest.json',import.meta.url)));
for(const [file,expected] of Object.entries(manifest.sha256)) {
  let source=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  if(file==='src/engine/gpu/GPU.js') {
    // Sole host-side deviation: request the uniform limit demonstrated by physical Safari.
    // Removing exactly this one line must reconstruct the entire upstream file byte-for-byte.
    const insertion='\t\t\tmaxUniformBuffersPerShaderStage: L.maxUniformBuffersPerShaderStage,\n';
    assert.equal(source.split(insertion).length,2,'Exactly one documented device-limit request');
    source=source.replace(insertion,'');
  }
  assert.equal(createHash('sha256').update(source).digest('hex'),expected,
    file+' differs from upstream beyond the documented uniform-limit request');
}
console.log('9 protected files byte-identical upstream; GPU.js differs only by the uniform-limit request. No shader changes.');
