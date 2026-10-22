import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.js', import.meta.url),'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url),'utf8');
const identity = readFileSync(new URL('../src/world/BermudaIdentity.js', import.meta.url),'utf8');
const assetLayout = readFileSync(new URL('../src/world/bermuda/AssetLayout.js', import.meta.url),'utf8');
const ui = readFileSync(new URL('../src/ui/AppUI.js', import.meta.url),'utf8');

for (const cls of ['Spray','Breakers','WakeSim','BoatSpray','MarineSnow','AirMotes','Wildlife','Vegetation']) {
  assert.match(app,new RegExp('new '+cls+'\\\\s*\\\\('), 'Missing live effect: '+cls);
}
assert.doesNotMatch(app,/mobileLite\s*\?\s*\{[^;]*update\(\)\s*\{\}/);
assert.doesNotMatch(main,/app\.spray\.update\s*=|app\.breakers\.update\s*=|app\.wake\.update\s*=/);
assert.doesNotMatch(main,/\[ 'noSim', '1' \]|\[ 'noCaustics', '1' \]/);
assert.match(ui,/breakers\?\.params\?\.spray/);
assert.match(identity,/phone \? Promise\.resolve\( null \) : installBermudaModels/);
assert.match(assetLayout,/tier: 2/);
assert.doesNotMatch(assetLayout,/x:-108,z:-72/);
console.log('Full visual FX preserved; beach starts uncluttered; mobile crash guard installed.');
