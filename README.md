# NervaTech Ltd. website (production build)

Static landing page + a small contact-form API. Fonts, GSAP, ScrollTrigger and three.js are self-hosted (no CDN calls).

## Run locally
```bash
npm install
cp .env.example .env      # optional locally; see "Contact form"
npm run dev               # builds, then serves on http://localhost:3000
npm test                  # smoke tests (run after a build)
```
Locally (NODE_ENV not "production") the contact form works without email set up: enquiries are printed in the terminal.

## Deploy
Always set `SITE_URL` (your public https URL, no trailing slash) when building. It feeds canonical, Open Graph, sitemap.xml and robots.txt.

**Option A: Vercel (static + serverless function)**
1. Push this folder to a Git repo and import it in Vercel. `vercel.json` already sets build command, output folder and headers.
2. Add env vars: `SITE_URL`, `RESEND_API_KEY`, `CONTACT_TO`, `CONTACT_FROM` (and optionally `CONTACT_ACK=true`).

**Option B: any Node host / VPS / Docker**
```bash
SITE_URL=https://your-domain.example npm run build
NODE_ENV=production PORT=3000 RESEND_API_KEY=... CONTACT_TO=... CONTACT_FROM=... TRUST_PROXY=1 npm start
```
or `docker build --build-arg SITE_URL=https://your-domain.example -t nervatech .` then `docker run -p 3000:3000 --env-file .env nervatech`.
Put it behind HTTPS (Nginx, Caddy, Cloudflare, or your platform's TLS). `GET /healthz` is the health check.

## Contact form
`POST /api/contact` validates input, blocks bots (honeypot, minimum fill time, 5 requests/hour/IP), and emails `CONTACT_TO` through Resend. Create a Resend account, verify your sending domain, and use that domain in `CONTACT_FROM`. In production, missing email settings make the endpoint return 503 instead of silently losing enquiries.

## Editing content
- Page copy: `src/index.html`. Styles: `src/css/styles.css`. Animations: `src/js/main.js`.
- Team section: add people to `src/data/team.json`, e.g. `[{"name":"...","role":"...","bio":"...","photo":"team/name.jpg"}]` and put photos in `src/team/`. While the file is empty, the team section and the "Read Our Story" button are left out of the build.
- Re-run `npm run build` after any change.

## Notes
- Security headers (CSP, HSTS, etc.) live in `lib/security.js` and are mirrored in `vercel.json` (a test checks they match). If you add third-party scripts, update the CSP.
- The in-memory rate limit is per server instance. For heavy traffic add an edge/WAF limit (Cloudflare, Vercel Firewall).
