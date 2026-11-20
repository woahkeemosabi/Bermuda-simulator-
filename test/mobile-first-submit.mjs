import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = file('../src/App.js');
const audit = file('../src/mobile/GpuAudit.js');

const split = app.indexOf("gpuStage('Mobile bootstrap: submitting initialization compute')");
const compile = app.indexOf("await progress( 0.36, 'Compiling shaders…', 0.95 )");
assert.ok(split > 0 && compile > split, 'Initial GPU work must submit before full-coast pipeline compilation');
const block = app.slice(split - 120, compile);
assert.match(block, /mobileLite && !window\.__bermudaHighSeaOnly/);
assert.match(block, /qs\.get\('startupFlush'\) !== '0'/);
assert.match(block, /if \(GPU\.encoder\) GPU\.submit\(\)/);
assert.match(block, /await withDeadline\(GPU\.whenIdle\(\), 8000/);
assert.match(block, /if \(GPU\.fatalError\) throw GPU\.fatalError/);
assert.match(audit, /GPU logical resources/);
assert.match(audit, /Pipelines /);
assert.ok(app.includes('new MobilePostFX('), 'Retain existing mobile postprocessing');
assert.ok(app.includes('new Caustics('), 'Retain underwater lighting effects');
assert.ok(app.includes('new ShoreSim('), 'Retain shallow-water simulation');
console.log('Mobile boot submission order and full-effects invariants passed');
