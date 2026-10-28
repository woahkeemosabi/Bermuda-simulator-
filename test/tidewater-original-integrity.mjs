import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const manifest=JSON.parse(readFileSync(new URL('./tidewater-original-manifest.json',import.meta.url)));
for(const [file,expected] of Object.entries(manifest.sha256))
  assert.equal(createHash('sha256').update(readFileSync(new URL('../'+file,import.meta.url))).digest('hex'),expected,
    file+' must remain identical to upstream '+manifest.upstreamCommit);
console.log(Object.keys(manifest.sha256).length+' original engine/ocean files match upstream '+manifest.upstreamCommit);
