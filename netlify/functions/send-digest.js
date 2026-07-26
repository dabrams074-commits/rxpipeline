// netlify/functions/send-digest.js
// Generates and sends a personalized pharma news digest via Resend
// Called on-demand from the app when user requests their digest
//
// Required env vars:
//   RESEND_API_KEY        — re_...
//   SUPABASE_URL          — https://xxx.supabase.co
//   SUPABASE_SERVICE_KEY  — service role key (for reading profiles)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const UA = 'Mozilla/5.0 (compatible; FeedFetcher-Google/1.0)';
const GN = q => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en&gl=US&ceid=US:en`;

// Therapeutic area → search keywords for Google News
const TA_KEYWORDS = {
  'Oncology':              'oncology cancer tumor immunotherapy chemotherapy',
  'Immunology':            'immunology autoimmune rheumatology dermatology biologics',
  'Neuroscience':          'neuroscience neurology CNS alzheimer parkinson multiple sclerosis',
  'Rare Disease':          'rare disease orphan drug gene therapy rare pediatric',
  'Cardiovascular':        'cardiovascular cardiology heart failure hypertension lipids',
  'Vaccines':              'vaccine vaccination mRNA immunization infectious disease',
  'Metabolic / Endocrine': 'metabolic diabetes obesity endocrine GLP-1 insulin',
  'Infectious Disease':    'infectious disease HIV antiviral antibacterial antimicrobial',
  'Ophthalmology':         'ophthalmology eye disease retina macular degeneration',
  'Diversified':           'pharmaceutical biotech drug approval pipeline FDA',
};

// Job function → relevant news angle
const FUNC_KEYWORDS = {
  'Commercial Analytics':    'pharma commercial analytics data real world evidence',
  'Medical Affairs':         'medical affairs MSL medical science liaison KOL congress',
  'Market Access':           'market access payer reimbursement formulary coverage',
  'Field Sales':             'pharma sales representative launch commercial',
  'Brand/Product Management':'pharma brand marketing launch product strategy',
  'Regulatory Affairs':      'FDA regulatory approval NDA BLA submission',
  'Clinical Development':    'clinical trial phase 3 FDA approval efficacy safety',
  'Forecasting':             'pharma forecasting market research analytics',
  'HEOR':                    'health economics outcomes research HEOR value evidence',
};

function parseRSS(xml, max = 5) {
  const items = [];
  const isAtom = /<entry[\s>]/.test(xml);
  const re = isAtom ? /<entry[\s>]([\s\S]*?)<\/entry>/g : /<item[\s>]([\s\S]*?)<\/item>/g;
  const get = (chunk, tag) => {
    const m = chunk.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'));
    return m ? m[1].trim() : '';
  };
  const clean = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').trim();
  let m;
  while ((m = re.exec(xml)) !== null && items.length < max) {
    const chunk = m[1];
    const title = clean(get(chunk, 'title'));
    let url = '';
    if (isAtom) {
      const hrefM = chunk.match(/<link[^>]+href="([^"]+)"/);
      url = hrefM ? hrefM[1] : get(chunk, 'id');
    } else {
      url = (get(chunk, 'link') || get(chunk, 'guid')).trim();
    }
    const date = get(chunk, 'pubDate') || get(chunk, 'published') || get(chunk, 'updated');
    const desc = clean(get(chunk, 'description') || get(chunk, 'summary') || '').replace(/https?:\/\/\S+/g,'').replace(/\s+/g,' ').trim().slice(0, 200);
    if (!title || !url) continue;
    const dateMs = date ? new Date(date).getTime() : 0;
    const dateStr = date ? new Date(date).toLocaleDateString('en-US', { month:'short', day:'numeric' }) : '';
    items.push({ title, url, desc, dateStr, dateMs });
  }
  return items;
}

async function fetchFeed(url, max = 5) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    return parseRSS(await res.text(), max);
  } catch { return []; }
}

function buildEmailHTML({ email, therapeuticArea, jobFunction, taNews, funcNews, industryNews, weekOf }) {
  const newsRow = (item, source) => `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #e2e6ea;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#0d6e4f;font-family:monospace;">${source}</p>
        <a href="${item.url}" style="display:block;font-size:14px;font-weight:600;color:#0d1117;text-decoration:none;line-height:1.4;margin-bottom:4px;">${item.title}</a>
        ${item.desc ? `<p style="margin:0;font-size:12px;color:#5a6370;line-height:1.55;">${item.desc}</p>` : ''}
        ${item.dateStr ? `<p style="margin:4px 0 0;font-size:11px;color:#9aa3ad;font-family:monospace;">${item.dateStr}</p>` : ''}
      </td>
    </tr>`;

  const sectionHTML = (label, items, source) => items.length === 0 ? '' : `
    <tr><td style="padding:24px 0 0;">
      <p style="margin:0 0 12px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9aa3ad;font-family:monospace;border-bottom:1px solid #e2e6ea;padding-bottom:8px;">${label}</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${items.map(i => newsRow(i, source)).join('')}
      </table>
    </td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f6f8;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 24px rgba(0,0,0,0.08);">

  <!-- Header -->
  <tr><td style="background:#0a1f17;padding:28px 36px 24px;border-bottom:3px solid #4fffb0;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.5px;">bio<span style="color:#4fffb0;">board</span>.io</td>
        <td align="right" style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#4fffb0;font-family:monospace;">Week of ${weekOf}</td>
      </tr>
    </table>
    <div style="display:inline-block;background:#4fffb0;color:#0a1f17;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:3px 10px;border-radius:99px;margin:14px 0 10px;">${therapeuticArea}</div>
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#fff;line-height:1.3;">Your personalized pharma digest</h1>
    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.55);">Curated for ${therapeuticArea} · ${jobFunction}</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:8px 36px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${sectionHTML(`${therapeuticArea} — Top Stories`, taNews, 'Industry News')}
      ${sectionHTML(`${jobFunction} — Relevant News`, funcNews, 'Your Function')}
      ${sectionHTML('Industry Headlines', industryNews, 'Pharma')}

      <!-- CTA -->
      <tr><td style="padding-top:28px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e6f4ef;border-radius:8px;">
          <tr><td style="padding:20px 24px;text-align:center;">
            <p style="margin:0 0 12px;font-size:13px;color:#5a6370;line-height:1.5;">Ready to find your next role? 22,000+ live jobs from 50+ pharma companies.</p>
            <a href="https://bioboard.io" style="display:inline-block;background:#0d6e4f;color:#fff;font-size:12px;font-weight:700;padding:10px 24px;border-radius:6px;text-decoration:none;">Open bioboard.io →</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f0f2f5;padding:20px 36px;text-align:center;border-top:1px solid #e2e6ea;">
    <p style="margin:0;font-size:11px;color:#9aa3ad;line-height:1.6;">
      You requested this digest from bioboard.io<br>
      <a href="https://bioboard.io" style="color:#0d6e4f;text-decoration:none;">bioboard.io</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

  const { email, therapeuticArea, jobFunction, pdfOnly } = JSON.parse(event.body || '{}');
  if (!email || !therapeuticArea || !jobFunction) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'email, therapeuticArea, and jobFunction are required' }) };
  }

  // Fetch news in parallel
  const taKeyword  = TA_KEYWORDS[therapeuticArea]  || therapeuticArea;
  const fnKeyword  = FUNC_KEYWORDS[jobFunction]     || jobFunction;

  const [taNews, funcNews, industryNews] = await Promise.all([
    fetchFeed(GN(`pharma biotech ${taKeyword} press release`), 4),
    fetchFeed(GN(`pharma ${fnKeyword}`), 3),
    fetchFeed('https://www.fiercepharma.com/rss/xml', 3),
  ]);

  const weekOf = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const html = buildEmailHTML({ email, therapeuticArea, jobFunction, taNews, funcNews, industryNews, weekOf });

  // PDF-only mode — return raw news items so client can build PDF with live jobs
  if (pdfOnly) {
    return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ taNews, industryNews, weekOf }) };
  }

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'RESEND_API_KEY not set' }) };

  // Send via Resend
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'bioboard.io <digest@bioboard.io>',
        to: [email],
        subject: `Your ${therapeuticArea} pharma digest — ${weekOf}`,
        html,
      }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Resend error');
    return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }
};
