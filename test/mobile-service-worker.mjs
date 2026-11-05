import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const handlers = {};
const saved = new Map();
let downloads = 0;
const cache = {
	match: async request => saved.get( request.url ),
	put: async ( request, response ) => { saved.set( request.url, response ); },
	keys: async () => [...saved.keys()].map( url => new Request(url) ),
	delete: async request => saved.delete( request.url ),
};
const ctx = {
	self: {
		location: { origin: 'https://bermuda-simulator.vercel.app' },
		addEventListener: (name, cb) => { handlers[name] = cb; },
		skipWaiting: async () => {},
		clients: { claim: async () => {} },
	},
	caches: { open: async () => cache, keys: async () => [], delete: async () => true },
	fetch: async () => {
		downloads ++;
		const response = new Response('game asset');
		Object.defineProperty(response, 'type', { value: 'basic' });
		Object.defineProperty(response, 'clone', { value: () => response });
		return response;
	},
	URL, Request, Response, console,
};
vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), ctx);

function request(path){
	let reply, done;
	const event = {
		request: new Request('https://bermuda-simulator.vercel.app/' + path),
		respondWith: p => { reply = p; },
		waitUntil: p => { done = p; },
	};
	handlers.fetch(event);
	return {reply,done};
}

const html = request('index.html');
const js = request('assets/game.js');
assert.equal(html.reply, undefined, 'page navigation is never intercepted');
assert.equal(js.reply, undefined, 'game code is never cached');

const first = request('models/characters/joe.glb');
assert.equal((await first.reply).status, 200);
await first.done;
assert.equal(downloads, 1);
assert.equal(saved.size, 1);

const second = request('models/characters/joe.glb');
assert.equal((await second.reply).status, 200);
await second.done;
assert.equal(downloads, 2, 'cached asset is background-refreshed for next visit');
console.log('asset service worker excludes code and refreshes cached game files');
