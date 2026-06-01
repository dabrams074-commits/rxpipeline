const UA = 'Mozilla/5.0 (compatible; FeedFetcher-Google/1.0)';
const GN = q => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en&gl=US&ceid=US:en`;

// ── Company press releases via wire-service site: searches ───────────────────
// Searches Google News for each company's releases on the actual wire services
// where pharma companies publish official press releases
const COMPANY_PR_FEEDS = [
  { company:'Pfizer',             url: GN('"Pfizer" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Merck',              url: GN('"Merck" pharmaceutical (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Eli Lilly',          url: GN('"Eli Lilly" OR "Lilly" pharmaceutical (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'AstraZeneca',        url: GN('"AstraZeneca" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Novartis',           url: GN('"Novartis" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'GSK',                url: GN('"GSK" OR "GlaxoSmithKline" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Amgen',              url: GN('"Amgen" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Sanofi',             url: GN('"Sanofi" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'BMS',                url: GN('"Bristol Myers Squibb" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Takeda',             url: GN('"Takeda" pharmaceutical (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'AbbVie',             url: GN('"AbbVie" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'J&J',                url: GN('"Johnson & Johnson" OR "Janssen" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Novo Nordisk',       url: GN('"Novo Nordisk" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Roche',              url: GN('"Roche" OR "Genentech" pharmaceutical (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Regeneron',          url: GN('"Regeneron" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Biogen',             url: GN('"Biogen" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Gilead',             url: GN('"Gilead Sciences" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Vertex',             url: GN('"Vertex Pharmaceuticals" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Moderna',            url: GN('"Moderna" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'BioNTech',           url: GN('"BioNTech" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Alnylam',            url: GN('"Alnylam" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Argenx',             url: GN('"Argenx" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Daiichi Sankyo',     url: GN('"Daiichi Sankyo" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Incyte',             url: GN('"Incyte" pharmaceutical (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Neurocrine',         url: GN('"Neurocrine Biosciences" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Sarepta',            url: GN('"Sarepta Therapeutics" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Alnylam',            url: GN('"Alnylam Pharmaceuticals" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Ionis',              url: GN('"Ionis Pharmaceuticals" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Halozyme',           url: GN('"Halozyme" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Blueprint Medicines',url: GN('"Blueprint Medicines" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Exelixis',           url: GN('"Exelixis" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Ultragenyx',         url: GN('"Ultragenyx" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Insmed',             url: GN('"Insmed" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Genmab',             url: GN('"Genmab" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Natera',             url: GN('"Natera" genetics (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Madrigal',           url: GN('"Madrigal Pharmaceuticals" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Jazz Pharmaceuticals',url:GN('"Jazz Pharmaceuticals" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Acadia',             url: GN('"Acadia Pharmaceuticals" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Ascendis',           url: GN('"Ascendis Pharma" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Cytokinetics',       url: GN('"Cytokinetics" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'IQVIA',              url: GN('"IQVIA" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Thermo Fisher',      url: GN('"Thermo Fisher Scientific" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
  { company:'Zoetis',             url: GN('"Zoetis" (site:businesswire.com OR site:globenewswire.com OR site:prnewswire.com)') },
];

// ── General topic feeds ────────────────────────────────────────────────────────
const TOPIC_FEEDS = [
  { url:'https://www.fiercepharma.com/rss/xml',                                                                          source:'FiercePharma',   topic:'Industry' },
  { url:'https://www.biopharmadive.com/feeds/news/',                                                                     source:'BioPharma Dive', topic:'Industry' },
  { url:'https://www.statnews.com/feed/',                                                                                 source:'STAT News',      topic:'Industry' },
  { url:'https://endpts.com/feed/',                                                                                       source:'Endpoints News', topic:'Industry' },
  { url:'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml',                     source:'FDA',            topic:'Regulatory' },
  { url:'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/drug-approvals-and-databases/rss.xml',       source:'FDA Approvals',  topic:'Regulatory' },
  { url:GN('pharma biotech drug pipeline clinical trial'),                                                                source:'Google News',    topic:'Pipeline' },
  { url:GN('pharma biotech merger acquisition deal'),                                                                     source:'Google News',    topic:'M&A' },
  { url:GN('pharma biotech earnings revenue quarterly results'),                                                          source:'Google News',    topic:'Earnings' },
];

exports.handler = async () => {
  const fetchFeed = async (url, max) => {
    try {
      const res = await fetch(url, { headers:{ 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) return [];
      return parseRSS(await res.text(), max);
    } catch { return []; }
  };

  const [prResults, topicResults] = await Promise.all([
    Promise.allSettled(COMPANY_PR_FEEDS.map(async f => {
      const items = await fetchFeed(f.url, 5);
      return items.map(a => ({ ...a, source: f.company, topic: 'Company News', company: f.company }));
    })),
    Promise.allSettled(TOPIC_FEEDS.map(async f => {
      const items = await fetchFeed(f.url, 10);
      return items.map(a => ({ ...a, source: f.source, topic: f.topic }));
    }))
  ]);

  const prArticles    = prResults.flatMap(r    => r.status === 'fulfilled' ? r.value : []);
  const topicArticles = topicResults.flatMap(r => r.status === 'fulfilled' ? r.value : []);

  const seen = new Set();
  const dedup = arr => arr.filter(a => { if (!a.url || seen.has(a.url)) return false; seen.add(a.url); return true; });

  const all = [...dedup(prArticles), ...dedup(topicArticles)];
  all.sort((a, b) => b.dateMs - a.dateMs);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=900' },
    body: JSON.stringify(all)
  };
};

function parseRSS(xml, max = 10) {
  const items = [];
  const isAtom = /<entry[\s>]/.test(xml);
  const re = isAtom ? /<entry[\s>]([\s\S]*?)<\/entry>/g : /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
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
    const desc = clean(get(chunk, 'description') || get(chunk, 'summary') || get(chunk, 'content')).slice(0, 220);
    if (!title || !url) continue;
    const dateMs = date ? new Date(date).getTime() : 0;
    items.push({ title, url, date: dateMs ? new Date(dateMs).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '', dateMs, summary: desc });
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
