import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import middleware from '../middleware.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const root = 'https://beta.example.test';
function req(path, { method = 'GET', origin, cookie, contentType, body, accept } = {}) {
  const headers = {};
  if (origin) headers.origin = origin;
  if (cookie) headers.cookie = cookie;
  if (contentType) headers['content-type'] = contentType;
  if (accept) headers.accept = accept;
  return new Request(root + path, { method, headers, body });
}

// Failing closed is mandatory: missing keys must never expose the Vite app.
delete process.env.BETA_ENABLED;
assert.equal((await middleware(req('/'))).status, 503);
assert.equal((await middleware(req('/assets/chunk.js'))).status, 503);

Object.assign(process.env, {
  BETA_ENABLED: 'true',
  BETA_SESSION_SECRET: 'this-must-be-a-long-32-byte-test-key-not-production',
  BETA_ALLOWED_EMAILS: 'alpha@example.test,beta@example.test',
  RESEND_API_KEY: 'test-secret-only',
  BETA_FROM_EMAIL: 'beta@bermudasimulator.com',
  BETA_SESSION_VERSION: 'test1'
});

const anonymous = await middleware(req('/', { accept: 'text/html' }));
assert.equal(anonymous.status, 303);
assert.equal(anonymous.headers.get('location'), '/_beta/login');

for (const path of ['/assets/chunk.js', '/models/boat.glb', '/ui/keyart-720.jpg', '/sw.js']) {
  const r = await middleware(req(path));
  assert.equal(r.status, 401, 'anonymous asset leaked: ' + path);
}
assert.equal((await middleware(req('/_beta/login'))).status, 200);
assert.equal((await middleware(req('/_beta/request', {
  method: 'POST', origin: 'https://attacker.test',
  contentType: 'application/x-www-form-urlencoded', body: 'email=alpha%40example.test'
}))).status, 403);

let emailSends = 0;
let magicLink = '';
const oldFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  assert.equal(url, 'https://api.resend.com/emails');
  emailSends++;
  const payload = JSON.parse(opts.body);
  magicLink = payload.text.match(/https:\/\/[^\s]+/)[0];
  assert.deepEqual(payload.to, ['alpha@example.test']);
  return new Response('{"id":"email-test"}', { status: 200 });
};
const emailRequest = address => req('/_beta/request', {
  method: 'POST', origin: root,
  contentType: 'application/x-www-form-urlencoded',
  body: 'email=' + encodeURIComponent(address)
});

assert.equal((await middleware(emailRequest('outsider@example.test'))).status, 200);
assert.equal(emailSends, 0, 'uninvited email should not receive any message');

assert.equal((await middleware(emailRequest('alpha@example.test'))).status, 200);
assert.equal(emailSends, 1);
assert.ok(magicLink.startsWith(root + '/_beta/verify?token='));

const verification = await middleware(new Request(magicLink));
assert.equal(verification.status, 303);
assert.equal(verification.headers.get('location'), '/');
const cookie = verification.headers.get('set-cookie').split(';')[0];
assert.ok(cookie.startsWith('__Host-bs_beta='));
assert.match(verification.headers.get('set-cookie'), /HttpOnly/);
assert.match(verification.headers.get('set-cookie'), /Secure/);
assert.equal(await middleware(req('/assets/chunk.js', { cookie })), undefined, 'invited session must reach normal Vite file');

const tokenUrl = new URL(magicLink);
tokenUrl.searchParams.set('token', tokenUrl.searchParams.get('token') + 'tampered');
assert.equal((await middleware(new Request(tokenUrl))).headers.get('location'), '/_beta/login');

process.env.BETA_ALLOWED_EMAILS = 'beta@example.test';
assert.equal((await middleware(req('/assets/chunk.js', { cookie }))).status, 401, 'revoked user should lose access');

process.env.BETA_ALLOWED_EMAILS = 'alpha@example.test,beta@example.test';
process.env.BETA_SESSION_VERSION = 'test2';
assert.equal((await middleware(req('/assets/chunk.js', { cookie }))).status, 401, 'rotating version must revoke issued cookies');

assert.equal((await middleware(req('/_beta/logout', { method: 'POST', origin: root }))).status, 303);
assert.match((await middleware(req('/_beta/logout', { method: 'POST', origin: root }))).headers.get('set-cookie'), /Max-Age=0/);

globalThis.fetch = oldFetch;
console.log('Beta auth: fail-closed / gate assets / magic link / session / revoke / CSRF smoke tests passed.');
