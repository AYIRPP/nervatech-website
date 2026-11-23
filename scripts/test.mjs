// Smoke tests: node scripts/test.mjs  (run after "npm run build")
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CSP } from '../lib/security.js';
import { submitContact } from '../lib/contact.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.error('FAIL  ' + name + '\n', e.message); process.exitCode = 1; } };

const req = (port, method, p, { headers = {}, body } = {}) => new Promise((res, rej) => {
  const r = http.request({ port, method, path: p, headers }, (x) => { const c = []; x.on('data', (d) => c.push(d)); x.on('end', () => res({ status: x.statusCode, headers: x.headers, body: Buffer.concat(c) })); });
  r.on('error', rej); if (body) r.write(body); r.end();
});
const post = (port, obj, extra = {}) => req(port, 'POST', '/api/contact', { headers: { 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(obj) });
const good = { name: 'Ada', email: 'ada@example.com', message: 'Hello there', kind: 'General enquiries', elapsed: 5000 };

console.log('Static build checks');
const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
await t('no external CDN or font hosts in built HTML', () => assert.ok(!/cdnjs|googleapis|gstatic|unpkg|jsdelivr/.test(html)));
await t('scripts load in order: gsap, ScrollTrigger, three, main', () => {
  const s = [...html.matchAll(/<script defer src="\/([^"]+)"/g)].map((m) => m[1]);
  assert.equal(s.length, 4); assert.match(s[0], /^vendor\/gsap/); assert.match(s[1], /^vendor\/ScrollTrigger/); assert.match(s[2], /^vendor\/three/); assert.match(s[3], /^js\/main/);
});
await t('every local reference in HTML exists in dist', () => {
  for (const m of html.matchAll(/(?:src|href)="\/([^"#?]+\.[a-z0-9]+)"/g)) assert.ok(fs.existsSync(path.join(root, 'dist', m[1])), 'missing ' + m[1]);
});
await t('vercel.json CSP matches lib/security.js', () => {
  const v = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const csp = v.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;
  assert.equal(csp, CSP);
});
await t('contact form posts to /api/contact', () => assert.ok(fs.readFileSync(path.join(root, 'src/js/main.js'), 'utf8').includes("fetch('/api/contact'")));

console.log('Contact handler (mocked email provider)');
const realFetch = globalThis.fetch;
const sent = [];
globalThis.fetch = async (url, init) => { sent.push({ url, init, body: JSON.parse(init.body) }); return { ok: true, status: 200, text: async () => '' }; };
const env = { RESEND_API_KEY: 'k', CONTACT_TO: 'a@x.com, b@x.com', CONTACT_FROM: 'Site <s@x.com>', NODE_ENV: 'production' };
await t('sends notification with reply_to and escaped HTML', async () => {
  const r = await submitContact({ ...good, name: 'Eve <script>', message: '<b>hi</b>' }, '1.1.1.1', env);
  assert.equal(r.status, 200); const m = sent.at(-1);
  assert.equal(m.url, 'https://api.resend.com/emails'); assert.deepEqual(m.body.to, ['a@x.com', 'b@x.com']); assert.equal(m.body.reply_to, 'ada@example.com');
  assert.ok(!m.body.html.includes('<script>') && m.body.html.includes('&lt;script&gt;'));
});
await t('subject cannot be header-injected', async () => {
  await submitContact({ ...good, name: 'X\r\nBcc: evil@x.com' }, '1.1.1.2', env);
  assert.ok(!/[\r\n]/.test(sent.at(-1).body.subject));
});
await t('rejects invalid email / empty message', async () => {
  assert.equal((await submitContact({ ...good, email: 'nope' }, '1.1.1.3', env)).status, 400);
  assert.equal((await submitContact({ ...good, message: '   ' }, '1.1.1.3', env)).status, 400);
});
await t('honeypot and too-fast submissions are silently dropped', async () => {
  const n = sent.length;
  assert.equal((await submitContact({ ...good, website: 'spam.com' }, '1.1.1.4', env)).status, 200);
  assert.equal((await submitContact({ ...good, elapsed: 200 }, '1.1.1.4', env)).status, 200);
  assert.equal(sent.length, n);
});
await t('rate limit: 6th request from one IP gets 429', async () => {
  let last; for (let i = 0; i < 6; i++) last = await submitContact(good, '9.9.9.9', env);
  assert.equal(last.status, 429);
});
await t('production without email config returns 503', async () => {
  assert.equal((await submitContact(good, '2.2.2.2', { NODE_ENV: 'production' })).status, 503);
});
await t('provider failure returns 502', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 500, text: async () => 'boom' });
  const r = await submitContact(good, '3.3.3.3', env); assert.equal(r.status, 502);
});
globalThis.fetch = realFetch;

console.log('HTTP server');
const port = 3900 + Math.floor(Math.random() * 90);
const srv = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(port), NODE_ENV: 'development' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => srv.stdout.on('data', (d) => /running/.test(String(d)) && r()));
try {
  await t('GET / is 200 with security headers and no-cache', async () => {
    const r = await req(port, 'GET', '/');
    assert.equal(r.status, 200); assert.equal(r.headers['content-security-policy'], CSP);
    assert.equal(r.headers['x-content-type-options'], 'nosniff'); assert.equal(r.headers['cache-control'], 'no-cache');
  });
  await t('brotli served when accepted, gzip fallback, identity otherwise', async () => {
    assert.equal((await req(port, 'GET', '/', { headers: { 'Accept-Encoding': 'br, gzip' } })).headers['content-encoding'], 'br');
    assert.equal((await req(port, 'GET', '/', { headers: { 'Accept-Encoding': 'gzip' } })).headers['content-encoding'], 'gzip');
    assert.equal((await req(port, 'GET', '/')).headers['content-encoding'], undefined);
  });
  await t('hashed assets are immutable-cached', async () => {
    const css = html.match(/href="(\/css\/[^"]+)"/)[1];
    const r = await req(port, 'GET', css); assert.equal(r.status, 200); assert.match(r.headers['cache-control'], /immutable/);
  });
  await t('conditional GET returns 304', async () => {
    const a = await req(port, 'GET', '/robots.txt');
    assert.equal((await req(port, 'GET', '/robots.txt', { headers: { 'If-None-Match': a.headers.etag } })).status, 304);
  });
  await t('unknown path -> branded 404; traversal blocked', async () => {
    const r = await req(port, 'GET', '/nope'); assert.equal(r.status, 404); assert.ok(r.body.toString().includes('Page not found'));
    for (const p of ['/../server.js', '/%2e%2e/server.js', '/..%2f..%2fetc/passwd', '/index.html.br']) {
      const x = await req(port, 'GET', p); assert.ok([403, 404].includes(x.status), p + ' -> ' + x.status); assert.ok(!x.body.toString().includes('createServer'));
    }
  });
  await t('/healthz ok', async () => assert.equal((await req(port, 'GET', '/healthz')).body.toString(), 'ok'));
  await t('POST /api/contact valid (dev mode) -> 200; GET -> 405; bad JSON -> 400; oversize -> 400', async () => {
    assert.equal((await post(port, good)).status, 200);
    assert.equal((await req(port, 'GET', '/api/contact')).status, 405);
    assert.equal((await req(port, 'POST', '/api/contact', { headers: { 'Content-Type': 'application/json' }, body: '{bad' })).status, 400);
    assert.equal((await post(port, { ...good, message: 'x'.repeat(40000) }).catch(() => ({ status: 400 }))).status, 400);
  });
} finally { srv.kill(); }
console.log(`\n${pass} checks passed${process.exitCode ? ' (with failures)' : ''}`);
