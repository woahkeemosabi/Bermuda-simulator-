import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
const s=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=s('src/App.js'),main=s('src/main.js'),sky=s('src/sky/Environment.js'),bounce=s('src/materials/GroundBounce.js'),boat=s('src/game/BoatOwnership.js');
assert.match(main,/mobileRecovery/);assert.match(main,/url.searchParams.set\(key,'1'\)/);
assert.match(main,/'noAudio'/);assert.match(main,/recovery-no-readback/);
assert.match(app,/cascades:2/);
// Mobile reflection priming is staged for all mobile profiles unless an A/B test opts out.
assert.match(app,/progressivePrime = mobileLite && envTest !== 'instant' && envTest !== 'skip'/);
// The 32px recovery cubemap is intentionally separate from regular mobile's 64px map.
assert.match(app,/this.recoveryMode \? 32 : \(mobileLite && envTest !== 'full' \? 64 : 128\)/);
assert.match(app,/this.recoveryMode \? null : this.wake/);
assert.match(sky,/this.progressivePrime && !this.primed/);
assert.match(bounce,/recovery.*128 : 512/);
assert.match(boat,/purchasedAt/);
console.log('Recovery profile: isolated audio, 2-cascade FFT, progressive 32px HDR, 128px bounce and real boat payment.');
