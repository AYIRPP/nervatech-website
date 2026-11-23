// Production static + API server. Zero runtime dependencies. Run: npm run build && npm start
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { submitContact } from './lib/contact.js';
import { securityHeaders, HSTS } from './lib/security.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const PORT = Number(process.env.PORT) || 3000;
const PROD = process.env.NODE_ENV === 'production';
const TRUST_PROXY = process.env.TRUST_PROXY === '1';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.ico': 'image/x-icon',
};
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.svg', '.txt', '.xml']);

function baseHeaders(req) {
  const h = { ...securityHeaders };
  const https = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
  if (PROD && https) h['Strict-Transport-Security'] = HSTS;
  return h;
}

function clientIp(req) {
  if (TRUST_PROXY) {
    const f = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (f) return f;
  }
  return req.socket.remoteAddress || 'unknown';
}

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function readBody(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function cacheControl(rel, ext) {
  if (ext === '.html') return 'no-cache';
  if (/\.[0-9a-f]{8}\.(css|js)$/.test(rel)) return 'public, max-age=31536000, immutable';
  if (ext === '.xml' || ext === '.txt') return 'public, max-age=3600';
  return 'public, max-age=604800';
}

function serveFile(req, res, file, status = 200) {
  const ext = path.extname(file).toLowerCase();
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const headers = { ...baseHeaders(req), 'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Cache-Control': status === 200 ? cacheControl(rel, ext) : 'no-cache' };
  let target = file;
  if (COMPRESSIBLE.has(ext)) {
    headers.Vary = 'Accept-Encoding';
    const ae = String(req.headers['accept-encoding'] || '');
    if (/\bbr\b/.test(ae) && fs.existsSync(file + '.br')) { target = file + '.br'; headers['Content-Encoding'] = 'br'; }
    else if (/\bgzip\b/.test(ae) && fs.existsSync(file + '.gz')) { target = file + '.gz'; headers['Content-Encoding'] = 'gzip'; }
  }
  const stat = fs.statSync(target);
  headers['Content-Length'] = stat.size;
  const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  headers.ETag = etag;
  if (status === 200 && req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }
  res.writeHead(status, headers);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(target).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { return send(res, 400, baseHeaders(req), 'Bad request'); }

    if (pathname === '/healthz') return send(res, 200, { ...baseHeaders(req), 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }, 'ok');

    if (pathname === '/api/contact') {
      const h = { ...baseHeaders(req), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
      if (req.method !== 'POST') return send(res, 405, { ...h, Allow: 'POST' }, JSON.stringify({ error: 'Method not allowed.' }));
      let body = null;
      try { body = JSON.parse(await readBody(req)); } catch { return send(res, 400, h, JSON.stringify({ error: 'Invalid request.' })); }
      const { status, json } = await submitContact(body, clientIp(req));
      return send(res, status, h, JSON.stringify(json));
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { ...baseHeaders(req), Allow: 'GET, HEAD' }, 'Method not allowed');

    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.normalize(path.join(ROOT, pathname));
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return send(res, 403, baseHeaders(req), 'Forbidden');
    if (path.basename(file).startsWith('.') || /\.(br|gz)$/.test(file)) return serveNotFound(req, res);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return serveFile(req, res, file);
    return serveNotFound(req, res);
  } catch (e) {
    console.error('[server] error:', e);
    if (!res.headersSent) send(res, 500, baseHeaders(req), 'Internal server error'); else res.end();
  }
});

function serveNotFound(req, res) {
  const nf = path.join(ROOT, '404.html');
  if (fs.existsSync(nf)) return serveFile(req, res, nf, 404);
  return send(res, 404, baseHeaders(req), 'Not found');
}

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error('dist/ not found. Run "npm run build" first.');
  process.exit(1);
}
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.listen(PORT, () => console.log(`NervaTech site running on http://localhost:${PORT}`));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
