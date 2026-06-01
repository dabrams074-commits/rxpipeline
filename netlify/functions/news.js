const UA = 'Mozilla/5.0 (compatible; FeedFetcher-Google/1.0)';
const GN = q => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en&gl=US&ceid=US:en`;

// ── Company investor-relations / press-release RSS feeds ─────────────────────
const COMPANY_FEEDS = [
  { company:'Pfizer',           color:'#0093D0', url:'https://www.pfizer.com/news/press-releases/rss' },
  { company:'Merck',            color:'#009A44', url:'https://www.merck.com/rss/feed/news/' },
  { company:'Eli Lilly',        color:'#D52B1E', url:'https://investor.lilly.com/rss/news-releases.xml' },
  { company:'AstraZeneca',      color:'#830051', url:GN('"AstraZeneca" press release pipeline') },
  { company:'Novartis',         color:'#ED1C24', url:GN('"Novartis" press release pipeline') },
  { company:'GSK',              color:'#F36633', url:GN('"GSK" OR "GlaxoSmithKline" press release') },
  { company:'Regeneron',        color:'#003087', url:'https://investor.regeneron.com/rss/news-releases.xml' },
  { company:'Biogen',           color:'#CD0000', url:'https://investors.biogen.com/rss/news-releases.xml' },
  { company:'Gilead',           color:'#E31837', url:GN('"Gilead Sciences" press release') },
  { company:'Vertex',           color:'#6600CC', url:'https://investors.vrtx.com/rss/news-releases.xml' },
  { company:'Amgen',            color:'#2E60A3', url:GN('"Amgen" press release pipeline') },
  { company:'Sanofi',           color:'#7B2D8B', url:GN('"Sanofi" press release pipeline') },
  { company:'BMS',              color:'#BE0000', url:GN('"Bristol Myers Squibb" press release') },
  { company:'AbbVie',           color:'#071D49', url:GN('"AbbVie" press release pipeline') },
  { company:'Moderna',          color:'#333333', url:'https://investors.modernatx.com/rss/news-releases.xml' },
  { company:'Novo Nordisk',     color:'#004B87', url:GN('"Novo Nordisk" press release') },
  { company:'J&J',              color:'#CC0000', url:GN('"Johnson & Johnson" OR "Janssen" press release') },
  { company:'Alnylam',          color:'#005A9C', url:'https://investors.alnylam.com/rss/news-releases.xml' },
  { company:'Argenx',           color:'#003366', url:GN('"Argenx" press release pipeline') },
  { company:'Ascendis',         color:'#6E2B8E', url:'https://ir.ascendispharma.com/rss/news-releases.xml' },
];

// ── Industry aggregator feeds ────────────────────────────────────────────────
const INDUSTRY_FEEDS = [
  { source:'BioSpace',        topic:'Industry',    url:'https://www.biospace.com/rss/' },
  { source:'FiercePharma',    topic:'Industry',    url:'https://www.fiercepharma.com/rss/xml' },
  { source:'Endpoints News',  topic:'Industry',    url:'https://endpts.com/feed/' },
  { source:'STAT News',       topic:'Industry',    url:'https://www.statnews.com/feed/' },
  { source:'Pharmaphorum',    topic:'Industry',    url:'https://pharmaphorum.com/feed/' },
  { source:'BioPharma Dive',  topic:'Industry',    url:'https://www.biopharmadive.com/feeds/news/' },
  { source:'FDA',             topic:'Regulatory',  url:'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml' },
  { source:'FDA Approvals',   topic:'Regulatory',  url:'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/drug-approvals-and-databases/rss.xml' },
  { source:'Google News',     topic:'Pipeline',    url:GN('pharma biotech drug pipeline clinical trial') },
  { source:'Google News',     topic:'M&A',         url:GN('pharma biotech merger acquisition deal') },
  { source:'Google News',     topic:'Earnings',    url:GN('pharma biotech earnings revenue quarterly results') },
];

exports.handler = async () => {
  const fetchFeed = async (url, max) => {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(7000) });
      if (!res.ok) return [];
      return parseRSS(await res.text(), max);
    } catch { return []; }
  };

  const [coResults, indResults] = await Promise.all([
    Promise.allSettled(COMPANY_FEEDS.map(async f => {
      const items = await fetchFeed(f.url, 6);
      return items.map(a => ({ ...a, source: f.company, company: f.company, color: f.color, mode: 'company', topic: 'Company News' }));
    })),
    Promise.allSettled(INDUSTRY_FEEDS.map(async f => {
      const items = await fetchFeed(f.url, 10);
      return items.map(a => ({ ...a, source: f.source, topic: f.topic, mode: 'industry' }));
    }))
  ]);

  const coArticles  = coResults.flatMap(r  => r.status === 'fulfilled' ? r.value : []);
  const indArticles = indResults.flatMap(r => r.status === 'fulfilled' ? r.value : []);

  // Deduplicate by URL across both sets
  const seen = new Set();
  const dedup = arr => arr.filter(a => { if (seen.has(a.url)) return false; seen.add(a.url); return true; });

  const all = [...dedup(coArticles), ...dedup(indArticles)];
  all.sort((a, b) => b.dateMs - a.dateMs);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=900' },
    body: JSON.stringify(all)
  };
};

function parseRSS(xml, max = 10) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const chunk = m[1];
    const title = clean(get(chunk, 'title'));
    const url   = (get(chunk, 'link') || get(chunk, 'guid')).trim();
    const date  = get(chunk, 'pubDate');
    const desc  = clean(get(chunk, 'description')).slice(0, 220);
    if (!title || !url) continue;
    const dateMs = date ? new Date(date).getTime() : 0;
    items.push({ title, url, date: dateMs ? new Date(dateMs).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '', dateMs, summary: desc });
    if (items.length >= max) break;
  }
  return items;
}

function get(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? (m[1] ?? m[2] ?? '') : '';
}

function clean(s) {
  return s.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
}
