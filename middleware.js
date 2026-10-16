/*
 * Bermuda Simulator — invite-only login gate (isolated beta branch).
 * Vercel Routing Middleware runs before static HTML and /assets requests.
 * Do not merge into the public game's main branch.
 * Environment: BETA_ENABLED, BETA_SESSION_SECRET (32+ chars),
 * BETA_ALLOWED_EMAILS (comma-separated), RESEND_API_KEY, BETA_FROM_EMAIL.
 *
 * No identities or credentials are stored in the game/localStorage.
 * Invitation access is managed by the server-only environment allowlist.
 */
export const config = { runtime: 'edge' };

const COOKIE = '__Host-bs_beta';
const encoder = new TextEncoder();
const headers = {
  'Cache-Control': 'no-store, private',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY'
};
const getEnv = () => typeof process === 'undefined' ? {} : process.env;
const normalEmail = value => String(value || '').trim().toLowerCase();
const allowed = (email, env) => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return false;
  return String(env.BETA_ALLOWED_EMAILS || '').split(',').map(normalEmail).filter(Boolean).includes(email);
};
const configured = env => env.BETA_ENABLED === 'true'
  && String(env.BETA_SESSION_SECRET || '').length >= 32
  && String(env.BETA_ALLOWED_EMAILS || '').trim().length > 0
  && String(env.RESEND_API_KEY || '').length > 0
  && String(env.BETA_FROM_EMAIL || '').includes('@');
const base64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
function decodeBase64url(value) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value) || value.length > 4096) throw Error('Invalid token');
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(base64), ch => ch.charCodeAt(0));
}
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign','verify']);
}
async function issueToken(email, purpose, duration, env) {
  const payload = { email, purpose, issued: Math.floor(Date.now() / 1000), expires: Math.floor(Date.now() / 1000) + duration, version: env.BETA_SESSION_VERSION || '1' };
  const data = base64url(encoder.encode(JSON.stringify(payload)));
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(env.BETA_SESSION_SECRET), encoder.encode(data)));
  return data + '.' + base64url(signature);
}
async function readToken(token, purpose, env) {
  try {
    if (!token || token.length > 4096) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const verified = await crypto.subtle.verify('HMAC', await hmacKey(env.BETA_SESSION_SECRET), decodeBase64url(parts[1]), encoder.encode(parts[0]));
    if (!verified) return null;
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64url(parts[0])));
    const now = Math.floor(Date.now() / 1000);
    if (payload.purpose !== purpose || payload.version !== (env.BETA_SESSION_VERSION || '1') || !Number.isFinite(payload.expires) || payload.expires <= now || payload.issued > now + 30 || payload.expires - payload.issued > (purpose === 'login' ? 600 : 43200)) return null;
    return allowed(payload.email, env) ? payload.email : null;
  } catch (_) { return null; }
}
function cookieValue(request) {
  const raw = request.headers.get('cookie') || '';
  const match = raw.match(/(?:^|;\s*)__Host-bs_beta=([^;]+)/);
  return match ? match[1] : '';
}
function respond(text, status = 200, extra = {}) {
  return new Response(text, { status, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', ...extra } });
}
function redirect(url, extra = {}) {
  return new Response(null, { status: 303, headers: { ...headers, Location: url, ...extra } });
}
function loginPage(message = 'Sign in using the email address you were invited with.') {
  const safe = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>Bermuda Simulator — Private Beta</title><style>*,*::before,*::after{box-sizing:border-box}html{background:#08141c;color:#f2f7fa;font-family:system-ui,-apple-system,sans-serif}body{min-height:100dvh;margin:0;display:grid;place-items:center;padding:20px;background:radial-gradient(circle at 50% 10%,#114756 0%,#08141c 65%)}main{width:min(100%,410px);padding:34px;border:1px solid #31505d;border-radius:18px;background:rgba(9,22,30,.94)}.eyebrow{color:#50d7d5;letter-spacing:.18em;font-size:.73rem;font-weight:700}h1{font-size:2rem;line-height:1.1;margin:18px 0}p{color:#bdcdd6;line-height:1.5}label{display:block;margin:24px 0 8px;font-weight:600;font-size:.9rem}input,button{width:100%;padding:14px;border-radius:9px;font:inherit}input{background:#111f28;border:1px solid #60808a;color:white}button{background:#50d7d5;border:0;margin-top:14px;font-weight:800;color:#001d23;cursor:pointer}.foot{font-size:.75rem;color:#8eabb6;margin-top:24px}</style></head><body><main><div class="eyebrow">FOUNDING PLAYERS · PRIVATE ACCESS</div><h1>BERMUDA<br>SIMULATOR</h1><p>' + safe + '</p><form method="POST" action="/_beta/request"><label for="email">Invited email address</label><input id="email" name="email" type="email" autocomplete="email" required maxlength="254" placeholder="you@example.com"><button type="submit">SEND SIGN-IN LINK</button></form><p class="foot">An invitation is required. No public beta registration is open.</p></main></body></html>';
}
function sameOrigin(request, url) {
  return request.headers.get('origin') === url.origin;
}
export default async function middleware(request) {
  const env = getEnv();
  const url = new URL(request.url);
  const path = url.pathname;
  const ready = configured(env);

  // Fail closed until server-side credentials and invitation allowlist are set.
  if (!ready) return respond('Private beta is not configured. Please check back later.', 503);

  if (path === '/_beta/login' && request.method === 'GET') {
    return respond(loginPage(), 200, { 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" });
  }
  if (path === '/_beta/request' && request.method === 'POST') {
    if (!sameOrigin(request, url) || !(request.headers.get('content-type') || '').startsWith('application/x-www-form-urlencoded')) return respond('Invalid request', 403);
    let body;
    try { body = await request.text(); } catch (_) { return respond('Invalid request', 400); }
    if (body.length > 1024) return respond('Invalid request', 413);
    const email = normalEmail(new URLSearchParams(body).get('email'));
    // Generic response for non-invited addresses: never enumerate the allowlist.
    const generic = loginPage('If this email is invited, you will receive a private sign-in link shortly.');
    if (!allowed(email, env)) return respond(generic);
    const token = await issueToken(email, 'login', 600, env);
    const link = url.origin + '/_beta/verify?token=' + encodeURIComponent(token);
    try {
      const sent = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: env.BETA_FROM_EMAIL,
          to: [email],
          subject: 'Bermuda Simulator private beta — sign-in link',
          text: 'Use this sign-in link within 10 minutes:\n' + link + '\n\nIf you did not request this, ignore it.'
        })
      });
      if (!sent.ok) return respond('Sign-in is temporarily unavailable. Try again later.', 503);
    } catch (_) { return respond('Sign-in is temporarily unavailable. Try again later.', 503); }
    return respond(generic);
  }
  if (path === '/_beta/verify' && request.method === 'GET') {
    const email = await readToken(url.searchParams.get('token'), 'login', env);
    if (!email) return redirect('/_beta/login');
    const session = await issueToken(email, 'session', 43200, env);
    return redirect('/', { 'Set-Cookie': COOKIE + '=' + session + '; Path=/; Max-Age=43200; Secure; HttpOnly; SameSite=Lax' });
  }
  if (path === '/_beta/logout' && request.method === 'POST') {
    if (!sameOrigin(request, url)) return respond('Invalid request', 403);
    return redirect('/_beta/login', { 'Set-Cookie': COOKIE + '=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax' });
  }
  if (path.startsWith('/_beta/')) return respond('Not found', 404);

  const currentEmail = await readToken(cookieValue(request), 'session', env);
  if (currentEmail) return; // Let Vercel serve existing HTML/JS/assets unmodified.

  // Do not leak static JS, shaders, models or assets to visitors without a session.
  const wantsHtml = request.method === 'GET' && (path === '/' || path.endsWith('.html') || (request.headers.get('accept') || '').includes('text/html'));
  if (wantsHtml) return redirect('/_beta/login');
  return new Response('Unauthorized', { status: 401, headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } });
}
