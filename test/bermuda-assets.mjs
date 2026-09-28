import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseGLB } from '../src/engine/loaders/GLTF.js';
import { staticGeometry } from '../src/world/bermuda/StaticAsset.js';
import { WATERFRONT_ASSETS, fitPlacement, dockSurfaceHeight } from '../src/world/bermuda/AssetLayout.js';
import { Vector3 } from '../src/engine/index.js';
const lineage = JSON.parse(readFileSync('tools/bermuda/task-lineage.json'));
const expansion = JSON.parse(readFileSync('tools/bermuda/expansion-lineage.json'));
let triangles = 0, bytes = 0;
for (const entry of WATERFRONT_ASSETS) {
 const name = 'bermuda-' + entry.id;
 const record = (entry.version ? expansion : lineage).assets[name];
 const data = readFileSync('public/models/bermuda/' + (entry.version || 'mobile-v2') + '/' + name + '.glb');
 assert.equal(createHash('sha256').update(data).digest('hex'), record.sha256);
 const gltf = parseGLB(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
 const asset = staticGeometry(gltf);
 assert.equal(asset.triangles, record.triangles);
 assert(asset.triangles <= entry.triangles);
 asset.size = asset.bounds.getSize(new Vector3());
 const center = asset.bounds.getCenter(new Vector3());
 for (const part of asset.parts) part.geometry.translate(-center.x, -asset.bounds.min.y, -center.z);
 for (const image of gltf.images) {
  const png = Buffer.from(image.bytes); assert.equal(png.subarray(1,4).toString(),'PNG');
  assert(png.readUInt32BE(16) <= entry.texture && png.readUInt32BE(20) <= entry.texture);
 }
 for (const p of entry.placements) {
  const fit = fitPlacement(asset,p,{heightAt:()=>1.45});
  assert(fit.scaleXYZ.every(x=>Number.isFinite(x)&&x>0));
  if(p.deckY !== undefined) assert(Math.abs(fit.y + dockSurfaceHeight(asset)*fit.scaleXYZ[1]-p.deckY)<1e-6);
 }
 triangles += asset.triangles; bytes += data.length;
 console.log(name, asset.triangles, data.length, record.task_id);
}
assert.equal(WATERFRONT_ASSETS.length,17); assert(triangles <= 65000);
console.log({triangles,bytes});
