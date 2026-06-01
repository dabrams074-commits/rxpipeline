// Using FeedFetcher-Google UA — many pharma IR platforms whitelist Google's feed crawler
const UA  = 'Mozilla/5.0 (compatible; FeedFetcher-Google/1.0)';
const GN  = q => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en&gl=US&ceid=US:en`;

// ── Direct company investor-relations / press-release RSS feeds ───────────────
// Q4-hosted IR pages (most reliable — standard /rss/news-releases.xml path)
const COMPANY_IR_FEEDS = [
  { company:'Eli Lilly',          url:'https://investor.lilly.com/rss/news-releases.xml' },
  { company:'Amgen',              url:'https://investors.amgen.com/rss/news-releases.xml' },
  { company:'Gilead',             url:'https://investors.gilead.com/rss/news-releases.xml' },
  { company:'AbbVie',             url:'https://investors.abbvie.com/rss/news-releases.xml' },
  { company:'Regeneron',          url:'https://investor.regeneron.com/rss/news-releases.xml' },
  { company:'Biogen',             url:'https://investors.biogen.com/rss/news-releases.xml' },
  { company:'Vertex',             url:'https://investors.vrtx.com/rss/news-releases.xml' },
  { company:'Moderna',            url:'https://investors.modernatx.com/rss/news-releases.xml' },
  { company:'Alnylam',            url:'https://investors.alnylam.com/rss/news-releases.xml' },
  { company:'Ascendis',           url:'https://ir.ascendispharma.com/rss/news-releases.xml' },
  { company:'Sarepta',            url:'https://investorrelations.sarepta.com/rss/news-releases.xml' },
  { company:'Incyte',             url:'https://investor.incyte.com/rss/news-releases.xml' },
  { company:'Neurocrine',         url:'https://ir.neurocrine.com/rss/news-releases.xml' },
  { company:'Halozyme',           url:'https://ir.halozyme.com/rss/news-releases.xml' },
  { company:'Insmed',             url:'https://ir.insmed.com/rss/news-releases.xml' },
  { company:'Ultragenyx',         url:'https://ir.ultragenyx.com/rss/news-releases.xml' },
  { company:'Ionis',              url:'https://ir.ionispharma.com/rss/news-releases.xml' },
  { company:'BMS',                url:'https://news.bms.com/rss/news-releases.xml' },
  { company:'Jazz Pharmaceuticals',url:'https://investors.jazzpharma.com/rss/news-releases.xml' },
  { company:'United Therapeutics',url:'https://ir.unitedtherapeutics.com/rss/news-releases.xml' },
  { company:'Argenx',             url:'https://investors.argenx.com/rss/news-releases.xml' },
  { company:'Blueprint Medicines',url:'https://ir.blueprintmedicines.com/rss/news-releases.xml' },
  { company:'Cytokinetics',       url:'https://ir.cytokinetics.com/rss/news-releases.xml' },
  { company:'Madrigal',           url:'https://ir.madrigalpharma.com/rss/news-releases.xml' },
  { company:'Natera',             url:'https://investors.natera.com/rss/news-releases.xml' },
  { company:'Nuvalent',           url:'https://ir.nuvalent.com/rss/news-releases.xml' },
  { company:'Protagonist',        url:'https://ir.protagonist-inc.com/rss/news-releases.xml' },
  // Large pharma own newsrooms
  { company:'Pfizer',             url:'https://www.pfizer.com/news/press-releases/rss' },
  { company:'J&J',                url:'https://www.investor.jnj.com/rss/news-releases.xml' },
  { company:'Merck',              url:'https://www.merck.com/rss/feed/news/' },
  { company:'Novo Nordisk',       url:'https://www.novonordisk.com/rss.xml' },
  { company:'Roche',              url:'https://www.roche.com/media/releases.rss' },
  { company:'Novartis',           url:'https://www.novartis.com/newsroom/news-releases.rss' },
  { company:'AstraZeneca',        url:'https://www.astrazeneca.com/media-centre/press-releases/rss.xml' },
  { company:'GSK',                url:'https://www.gsk.com/en-gb/media/press-releases/feed/' },
  { company:'Sanofi',             url:'https://www.sanofi.com/en/media-room/press-releases.rss' },
  { company:'Takeda',             url:'https://www.takeda.com/newsroom/press-releases/rss.xml' },
];

// ── GlobeNewswire industry feeds (actual company PRs submitted to the wire) ───
const WIRE_FEEDS = [
  { url:'https://www.globenewswire.com/RssFeed/industry/Biotechnology',    source:'GlobeNewswire', topic:'Company News' },
  { url:'https://www.globenewswire.com/RssFeed/industry/Pharmaceuticals',  source:'GlobeNewswire', topic:'Company News' },
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
      const res = await fetch(url, { headers:{ 'User-Agent': UA }, signal: AbortSignal.timeout(7000) });
      if (!res.ok) return [];
      return parseRSS(await res.text(), max);
    } catch { return []; }
  };

  const [irResults, wireResults, topicResults] = await Promise.all([
    // Direct company IR feeds — up to 6 releases each, fail silently if blocked
    Promise.allSettled(COMPANY_IR_FEEDS.map(async f => {
      const items = await fetchFeed(f.url, 6);
      return items.map(a => ({ ...a, source: f.company, topic: 'Company News', company: f.company }));
    })),
    // Wire-service feeds — up to 20 articles each (broad company coverage)
    Promise.allSettled(WIRE_FEEDS.map(async f => {
      const items = await fetchFeed(f.url, 20);
      return items.map(a => ({ ...a, source: f.source, topic: f.topic }));
    })),
    // General topic feeds
    Promise.allSettled(TOPIC_FEEDS.map(async f => {
      const items = await fetchFeed(f.url, 10);
      return items.map(a => ({ ...a, source: f.source, topic: f.topic }));
    }))
  ]);

  const irArticles    = irResults.flatMap(r    => r.status === 'fulfilled' ? r.value : []);
  const wireArticles  = wireResults.flatMap(r  => r.status === 'fulfilled' ? r.value : []);
  const topicArticles = topicResults.flatMap(r => r.status === 'fulfilled' ? r.value : []);

  // Deduplicate across all sets — IR feeds take priority over wire, wire over topic
  const seen = new Set();
  const dedup = arr => arr.filter(a => { if (!a.url || seen.has(a.url)) return false; seen.add(a.url); return true; });

  const all = [...dedup(irArticles), ...dedup(wireArticles), ...dedup(topicArticles)];
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

    // Atom uses <link rel="alternate" href="…"/> (self-closing); RSS uses <link>…</link> or <guid>
    let url = '';
    if (isAtom) {
      const hrefM = chunk.match(/<link[^>]+href="([^"]+)"/);
      url = hrefM ? hrefM[1] : get(chunk, 'id');
    } else {
      url = (get(chunk, 'link') || get(chunk, 'guid')).trim();
    }

    // Atom: <published> or <updated>; RSS: <pubDate>
    const date = get(chunk, 'pubDate') || get(chunk, 'published') || get(chunk, 'updated');
    // Atom: <summary> or <content>; RSS: <description>
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
