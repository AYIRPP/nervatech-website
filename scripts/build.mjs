// Build: src/ -> dist/  (self-hosted fonts + libraries, minified/hashed CSS+JS, SEO files, precompressed assets)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'src');
const DIST = path.join(root, 'dist');
const require = createRequire(import.meta.url);

const fail = (m) => { console.error('\nBuild error: ' + m + '\n'); process.exit(1); };
const hash = (buf) => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
const write = (rel, data) => { const f = path.join(DIST, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); };
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function replaceOnce(str, from, to, label) {
  if (!str.includes(from)) fail(`could not find ${label} in src/index.html (has it been edited?)`);
  return str.replace(from, () => to);
}

let esbuild;
try { esbuild = await import('esbuild'); } catch { fail('dependencies missing. Run "npm install" first.'); }
const pkgFile = (spec) => { try { return require.resolve(spec); } catch { fail(`dependency file not found: ${spec}. Run "npm install".`); } };

const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '');
if (!SITE_URL) console.warn('WARNING: SITE_URL is not set. Canonical, Open Graph and sitemap URLs will be omitted. Set it for production, e.g. SITE_URL=https://example.com');

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

// 1. Static assets (images etc.)
fs.cpSync(path.join(SRC, 'assets'), path.join(DIST, 'assets'), { recursive: true });
const teamDir = path.join(SRC, 'team');
if (fs.existsSync(teamDir)) fs.cpSync(teamDir, path.join(DIST, 'team'), { recursive: true });

// 2. Fonts (self-hosted, latin subset): Inter 400/500/600, Manrope 700/800
const FONTS = [['inter', 'Inter', [400, 500, 600]], ['manrope', 'Manrope', [700, 800]]];
let fontCss = '';
const preload = [];
for (const [pkg, family, weights] of FONTS) {
  for (const w of weights) {
    const file = pkgFile(`@fontsource/${pkg}/files/${pkg}-latin-${w}-normal.woff2`);
    const name = `${pkg}-${w}.woff2`;
    fs.mkdirSync(path.join(DIST, 'fonts'), { recursive: true });
    fs.copyFileSync(file, path.join(DIST, 'fonts', name));
    fontCss += `@font-face{font-family:'${family}';font-style:normal;font-weight:${w};font-display:swap;src:url(../fonts/${name}) format('woff2')}\n`;
    if ((pkg === 'inter' && w === 400) || (pkg === 'manrope' && w === 800)) preload.push(`/fonts/${name}`);
  }
}

// 3. CSS (fonts + site styles), minified + content-hashed
const css = esbuild.transformSync(fontCss + read('css/styles.css'), { loader: 'css', minify: true }).code;
const cssName = `css/styles.${hash(css)}.css`;
write(cssName, css);

// 4. JS (site script), minified + content-hashed
const js = esbuild.transformSync(read('js/main.js'), { loader: 'js', minify: true, target: 'es2019' }).code;
const jsName = `js/main.${hash(js)}.js`;
write(jsName, js);

// 5. Vendor libraries (self-hosted)
const vendor = [
  ['gsap.min', pkgFile('gsap/dist/gsap.min.js')],
  ['ScrollTrigger.min', pkgFile('gsap/dist/ScrollTrigger.min.js')],
  ['three.min', path.join(path.dirname(pkgFile('three/package.json')), 'build', 'three.min.js')],
].map(([n, f]) => {
  if (!fs.existsSync(f)) fail(`missing ${f}. Run "npm install".`);
  const buf = fs.readFileSync(f);
  const rel = `vendor/${n}.${hash(buf)}.js`;
  write(rel, buf);
  return rel;
});

// 6. HTML
let html = read('index.html');

// 6a. remove CDN references, add local ones
const gf = /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\s*/.exec(html);
if (!gf) fail('Google Fonts link not found in src/index.html');
html = html.replace(gf[0], () => '');
html = replaceOnce(html, '<link rel="stylesheet" href="css/styles.css">', `${preload.map((p) => `<link rel="preload" href="${p}" as="font" type="font/woff2" crossorigin>`).join('\n')}\n<link rel="stylesheet" href="/${cssName}">\n<noscript><style>.rv{opacity:1!important;transform:none!important}</style></noscript>`, 'stylesheet link');
html = html.replace(/<script src="https:\/\/cdnjs[^>]*><\/script>\s*/g, '');
html = replaceOnce(html, '<script src="js/main.js"></script>', [...vendor, jsName].map((s) => `<script defer src="/${s}"></script>`).join('\n'), 'main script tag');
html = replaceOnce(html, 'href="assets/favicon.png"', 'href="/assets/favicon.png"', 'favicon link');
if (/cdnjs|googleapis/.test(html)) fail('an external CDN reference is still present in index.html');

// 6b. Team section: render real members only; remove the section if there are none
const team = JSON.parse(read('data/team.json')).filter((m) => m && m.name && m.name.trim());
const sectionRe = /<section id="team"[\s\S]*?<\/section>\s*/;
const heroLinkRe = /<a class="btn p" href="#team">Read Our Story<\/a>/;
if (!sectionRe.test(html)) fail('team section not found');
if (team.length === 0) {
  html = html.replace(sectionRe, '').replace(heroLinkRe, '');
  console.log('Team section: no members in src/data/team.json, section removed from the build.');
} else {
  const cards = team.map((m) => `<article class="card tm rv"><div class="ph has"${m.photo ? ` style="background-image:url('/${esc(m.photo)}')" role="img" aria-label="Photo of ${esc(m.name)}"` : ''}></div><div class="in"><h3>${esc(m.name)}</h3>${m.role ? `<p class="rl">${esc(m.role)}</p>` : ''}${m.bio ? `<p>${esc(m.bio)}</p>` : ''}</div></article>`).join('');
  html = html.replace(/<p>Click a photo space[^<]*<\/p><div class="team" id="team-grid"><\/div>/, () => `<div class="team" id="team-grid">${cards}</div>`);
  if (html.includes('Click a photo space')) fail('could not rewrite the team grid');
}

// 6c. SEO: canonical, Open Graph, Twitter, theme colour, JSON-LD
const titleM = /<title>([^<]*)<\/title>/.exec(html);
const descM = /<meta name="description" content="([^"]*)">/.exec(html);
if (!titleM || !descM) fail('title or meta description missing');
const sameAs = [...html.matchAll(/href="(https:\/\/www\.(?:instagram|tiktok|linkedin)\.com\/[^"]+)"/g)].map((m) => m[1]);
const emailM = /href="mailto:([^"]+)"/.exec(html);
const telM = /href="tel:([^"]+)"/.exec(html);
const abs = (p) => (SITE_URL ? `${SITE_URL}${p}` : p);
const ld = { '@context': 'https://schema.org', '@type': 'Organization', name: 'NervaTech Ltd.', description: descM[1], ...(SITE_URL && { url: SITE_URL + '/', logo: abs('/assets/logo-navy.png') }), ...(sameAs.length && { sameAs }), ...((emailM || telM) && { contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', ...(emailM && { email: emailM[1] }), ...(telM && { telephone: telM[1] }) } }) };
const seo = [
  '<meta name="theme-color" content="#071B36">',
  '<meta name="robots" content="index,follow,max-image-preview:large">',
  SITE_URL && `<link rel="canonical" href="${SITE_URL}/">`,
  '<meta property="og:type" content="website">',
  '<meta property="og:site_name" content="NervaTech Ltd.">',
  `<meta property="og:title" content="${titleM[1]}">`,
  `<meta property="og:description" content="${descM[1]}">`,
  SITE_URL && `<meta property="og:url" content="${SITE_URL}/">`,
  SITE_URL && `<meta property="og:image" content="${abs('/assets/og-image.png')}">`,
  SITE_URL && '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">',
  `<meta name="twitter:card" content="${SITE_URL ? 'summary_large_image' : 'summary'}">`,
  `<meta name="twitter:title" content="${titleM[1]}">`,
  `<meta name="twitter:description" content="${descM[1]}">`,
  SITE_URL && `<meta name="twitter:image" content="${abs('/assets/og-image.png')}">`,
  `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
].filter(Boolean).join('\n');
html = replaceOnce(html, '</head>', seo + '\n</head>', '</head>');

// minify whitespace between tags lightly (safe): collapse blank lines
html = html.replace(/\n{2,}/g, '\n');
write('index.html', html);
write('404.html', fs.readFileSync(path.join(SRC, '404.html')));

// 7. robots.txt + sitemap.xml
write('robots.txt', `User-agent: *\nAllow: /\n${SITE_URL ? `Sitemap: ${SITE_URL}/sitemap.xml\n` : ''}`);
if (SITE_URL) write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE_URL}/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url></urlset>\n`);

// 8. Precompress text assets (brotli + gzip)
let n = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f);
    else if (/\.(html|css|js|json|svg|txt|xml)$/.test(e.name)) {
      const buf = fs.readFileSync(f);
      fs.writeFileSync(f + '.br', zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }));
      fs.writeFileSync(f + '.gz', zlib.gzipSync(buf, { level: 9 }));
      n++;
    }
  }
})(DIST);
console.log(`Build complete: dist/ (${n} text files precompressed)`);
