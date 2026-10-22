import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const app=read('../src/App.js'), post=read('../src/post/MobilePostFX.js');
assert.match(app,/mobileLite && !qs.has\('fullPost'\)/);
assert.match(post,/acesFilmicToneMapping/);
assert.match(post,/sceneRenderer\.setSize/);
assert.match(post,/getCurrentTexture/);
assert.match(post,/class MobilePostFX/);
assert.doesNotMatch(post,/new (TemporalUpscale|GTAO|MotionBlur|LensFlare|RenderTarget)/);
for(const name of ['OceanFFT','Caustics','ShoreSim','Spray','Breakers','WakeSim','Wildlife'])
 assert.ok(app.includes('new '+name+'('),name+' should still be in the mobile game');
console.log('iOS compatibility post: one ACES presentation, full world simulation retained.');
