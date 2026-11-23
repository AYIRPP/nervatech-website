// Contact form handler shared by the Node server (server.js) and Vercel (api/contact.js).
// Sends the enquiry by email through the Resend REST API (no dependencies).

const KINDS = [
  'General enquiries', 'Product enquiries', 'Enterprise solutions',
  'Partnerships', 'Investment opportunities', 'Media enquiries',
];
const LIMITS = { name: 100, company: 150, email: 254, phone: 40, message: 5000 };
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

// Simple in-memory rate limit: MAX requests per WINDOW per IP.
// (Per process. On serverless hosts each instance has its own counter, so add a WAF/edge limit for heavy traffic.)
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v.start > WINDOW_MS) hits.delete(k);
  const h = hits.get(ip);
  if (!h || now - h.start > WINDOW_MS) { hits.set(ip, { start: now, n: 1 }); return false; }
  h.n += 1;
  return h.n > MAX_PER_WINDOW;
}

const clean = (v, max) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max) : '';
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const oneLine = (s) => s.replace(/[\r\n]+/g, ' ');

async function sendEmail(payload, apiKey) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

export async function submitContact(body, ip = 'unknown', env = process.env) {
  if (!body || typeof body !== 'object') return { status: 400, json: { error: 'Invalid request.' } };

  // Honeypot or impossibly fast submission: pretend success so bots learn nothing.
  if (body.website || (Number.isFinite(body.elapsed) && body.elapsed < 1500)) {
    return { status: 200, json: { ok: true } };
  }
  if (rateLimited(ip)) {
    return { status: 429, json: { error: 'Too many enquiries from your connection. Please try again later or email us directly.' } };
  }

  const d = {
    name: clean(body.name, LIMITS.name),
    company: clean(body.company, LIMITS.company),
    email: clean(body.email, LIMITS.email),
    phone: clean(body.phone, LIMITS.phone),
    kind: KINDS.includes(body.kind) ? body.kind : 'General enquiries',
    message: clean(body.message, LIMITS.message),
  };
  if (!d.name || !d.message || !EMAIL_RE.test(d.email)) {
    return { status: 400, json: { error: 'Please add your name, a valid email and a message.' } };
  }

  const apiKey = env.RESEND_API_KEY;
  const to = env.CONTACT_TO;
  const from = env.CONTACT_FROM;
  if (!apiKey || !to || !from) {
    if (env.NODE_ENV === 'production') {
      console.error('[contact] RESEND_API_KEY, CONTACT_TO and CONTACT_FROM must be set.');
      return { status: 503, json: { error: 'Our enquiry form is temporarily unavailable. Please email info@nerva-tech.com instead.' } };
    }
    console.log('[contact:dev] email not configured; enquiry received:', d);
    return { status: 200, json: { ok: true } };
  }

  const rows = [
    ['Name', d.name], ['Company', d.company || '-'], ['Email', d.email],
    ['Phone', d.phone || '-'], ['Enquiry type', d.kind],
  ];
  try {
    await sendEmail({
      from, to: to.split(',').map((s) => s.trim()).filter(Boolean),
      reply_to: d.email,
      subject: oneLine(`Website enquiry: ${d.kind} - ${d.name}`).slice(0, 200),
      text: rows.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\nMessage:\n${d.message}`,
      html: `<table cellpadding="6" style="font-family:Arial,sans-serif;font-size:14px">${rows
        .map(([k, v]) => `<tr><td><b>${k}</b></td><td>${esc(v)}</td></tr>`).join('')}</table>` +
        `<p style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap">${esc(d.message)}</p>`,
    }, apiKey);

    if (env.CONTACT_ACK === 'true') {
      // Acknowledgement is best-effort: a failure here must not fail the enquiry.
      sendEmail({
        from, to: [d.email],
        subject: 'We have received your enquiry - NervaTech Ltd.',
        text: `Hello ${oneLine(d.name)},\n\nThank you for contacting NervaTech Ltd. We have received your enquiry and will respond as soon as we can.\n\nNervaTech Ltd.`,
      }, apiKey).catch((e) => console.error('[contact] acknowledgement failed:', e.message));
    }
    return { status: 200, json: { ok: true } };
  } catch (e) {
    console.error('[contact] send failed:', e.message);
    return { status: 502, json: { error: 'Sorry, we could not send your enquiry. Please email info@nerva-tech.com instead.' } };
  }
}
