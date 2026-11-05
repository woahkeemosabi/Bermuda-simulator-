import assert from 'node:assert/strict';
import { cacheStartupAssets, holdUntilMobileReady, MOBILE_STARTUP_MIN_MS, isStartupCacheReady, markStartupCacheReady } from '../src/mobile/StartupAssetCache.js';

const files = new Map();
const storage = { open: async () => ({
	match: async key => files.get( key ),
	put: async ( key, response ) => { files.set( key, response ); },
}) };
let downloads = 0;
const config = {
	baseUrl: new URL('https://bermuda-simulator.vercel.app/'),
	cacheStorage: storage,
	fetchAsset: async () => { downloads ++; return new Response( 'asset file' ); },
};
const first = await cacheStartupAssets(config);
assert.deepEqual(first, { available: true, stored: 3, reused: 0, failed: 0 });
const second = await cacheStartupAssets(config);
assert.deepEqual(second, { available: true, stored: 0, reused: 3, failed: 0 });
assert.equal(downloads, 3, 'second visit must reuse the asset cache');
const localItems = new Map();
const local = {
	getItem: key => localItems.get( key ) ?? null,
	setItem: (key,value) => localItems.set( key, value ),
};
assert.equal(isStartupCacheReady(second, local), false, 'cache alone does not imply a completed minute');
assert.equal(markStartupCacheReady(first, local), true);
assert.equal(isStartupCacheReady(second, local), true, 'next visit may use a completed asset cache');

let elapsed = 8200;
const remaining = [];
await holdUntilMobileReady({
	startedAt: 0,
	now: () => elapsed,
	wait: async ms => { elapsed += ms; },
	onProgress: seconds => remaining.push( seconds ),
});
assert.equal(elapsed, MOBILE_STARTUP_MIN_MS);
assert.equal(remaining[0], 52);
assert.equal(remaining.at(-1), 1);

let checks = 0;
await assert.rejects(holdUntilMobileReady({
	startedAt: 0,
	minimumMs: 2000,
	now: () => 0,
	wait: async () => {},
	checkDevice: () => { if (++checks > 1) throw new Error('GPU lost'); },
}), /GPU lost/);

console.log('60-second mobile readiness gate and persistent startup cache verified');
