import assert from 'node:assert/strict';
import { requestGraphicsAdapter } from '../src/engine/gpu/Adapter.js';
import { fetchAssetBuffer } from '../src/core/AssetFetch.js';
import { recoveryURL, startupFailureHelp } from '../src/core/StartupRecovery.js';

const adapter = { name: 'test adapter' };
let requests = [];
assert.equal(await requestGraphicsAdapter({ requestAdapter: async options => { requests.push(options); return adapter; } }), adapter);
assert.equal(requests.length, 1, 'working preferred adapter is used once');
requests = [];
assert.equal(await requestGraphicsAdapter({ requestAdapter: async options => { requests.push(options); return requests.length === 1 ? null : adapter; } }), adapter);
assert.deepEqual(requests, [{ powerPreference: 'high-performance' }, {}], 'default adapter can recover a rejected power preference');
requests = [];
assert.equal(await requestGraphicsAdapter({ requestAdapter: async options => { requests.push(options); if(requests.length === 1) throw new Error('driver preference rejected'); return adapter; } }), adapter);
await assert.rejects(requestGraphicsAdapter(null), /not available/);
await assert.rejects(requestGraphicsAdapter({ requestAdapter: async () => null }), /No WebGPU adapter/);
await assert.rejects(requestGraphicsAdapter({ requestAdapter: () => new Promise(() => {}) }, 5), /timed out/);

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new Uint8Array([1,2,3]).buffer });
  assert.deepEqual([...new Uint8Array(await fetchAssetBuffer('dock.glb'))], [1,2,3]);
  globalThis.fetch = async () => ({ ok: false, status: 404 });
  await assert.rejects(fetchAssetBuffer('missing.glb'), /404/);
  globalThis.fetch = (url, {signal}) => new Promise((resolve,reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
  await assert.rejects(fetchAssetBuffer('stalled-headers.glb', 5), /download timed out/);
  globalThis.fetch = async (url, {signal}) => ({ ok: true, arrayBuffer: () => new Promise((resolve,reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))) });
  await assert.rejects(fetchAssetBuffer('stalled-body.glb', 5), /download timed out/);
} finally { globalThis.fetch = originalFetch; }

const mobile = new URL(recoveryURL('https://example.test/island/?gpuRecovery=2&desktop=1&noVeg=1&save=keep', true, true));
assert.equal(mobile.searchParams.get('quality'), 'mobile-safe');
assert.equal(mobile.searchParams.get('launch'), 'online');
assert.equal(mobile.searchParams.get('save'), 'keep');
assert.equal(mobile.searchParams.has('desktop'), false);
assert.equal(mobile.searchParams.has('gpuRecovery'), false);
assert.equal(new URL(recoveryURL(mobile.href, false, true)).searchParams.get('quality'), 'performance');
assert.match(startupFailureHelp('No WebGPU adapter found.'), /graphics acceleration/);
assert.match(startupFailureHelp('WebGPU device lost: destroyed'), /reduced graphics/);
console.log('Startup recovery passed: preferred/default GPU, unsupported/hung GPU, download failures, safe retry URLs.');
