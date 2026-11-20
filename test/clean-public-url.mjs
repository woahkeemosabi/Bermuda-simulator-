import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const main = read('../src/main.js');
const app = read('../src/App.js');
assert.doesNotMatch(main,/history\.replaceState\(/);
assert.match(main,/window\.__bermudaBootSearch = url\.search/);
assert.match(app,/window\.__bermudaBootSearch/);
assert.match(main,/get\('highSeaOnly'\) !== '0'/); // no visual preset changes in this hotfix
assert.match(main,/url\.searchParams\.set\('noVeg','1'\)/);
assert.match(main,/url\.searchParams\.set\('noSpray','1'\)/);
console.log('Public URL stays clean and existing mobile render preset is unchanged');
