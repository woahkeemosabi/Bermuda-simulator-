import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const main = read('../src/main.js');
const app = read('../src/App.js');
const gate = read('../src/mobile/WorldRenderGate.js');
// The address bar must not be rewritten to hold internal iPhone render flags.
assert.doesNotMatch(main, /history\\.replaceState\\(/);
assert.match(main, /window\\.__bermudaBootSearch = url\\.search/);
assert.match(app, /window\\.__bermudaBootSearch/);
// A full coastal build is the standard profile; sea-only is an explicit opt-in.
assert.match(main, /get\\('highSeaOnly'\\) === '1'/);
assert.doesNotMatch(main, /get\\('highSeaOnly'\\) !== '0'/);
// iPhone loss must interrupt startup verification promptly, instead of waiting
// for a validation-scope timeout on a dead device.
assert.match(gate, /GPU\\.device\\.lost\\.then/);
assert.match(gate, /Promise\\.race\\(\\[work,lost\\]\\)/);
assert.match(gate, /awaitGpuOrLoss\\(Promise\\.all\\(\\[GPU\\.device\\.popErrorScope/);
// Still preserve all ocean, coastal, and weather system constructors.
assert.match(app, /new ShoreSim\\(/);
assert.match(app, /new Caustics\\(/);
assert.match(app, /new MobilePostFX\\(/);
console.log('Clean mobile URL, full-coast defaults, and device-loss race assertions passed');
