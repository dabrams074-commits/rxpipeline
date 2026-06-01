const UA = 'Mozilla/5.0 (compatible; FeedFetcher-Google/1.0)';
const GN = q => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en&gl=US&ceid=US:en`;

const ALL_FEEDS = [
  // ── Wire services (actual company press releases) ──
  { url:'https://www.globenewswire.com/RssFeed/industry/Biotechnology',                                  source:'GlobeNewswire',  topic:'Company News' },
  { url:'https://www.globenewswire.com/RssFeed/industry/Pharmaceuticals',                                source:'GlobeNewswire',  topic:'Company News' },
  { url:'https://www.prnewswire.com/rss/news-releases-list.rss',                                         source:'PR Newswire',    topic:'Company News' },
  { url:'https://www.businesswire.com/rss/home/?rss=G22',                                                source:'Business Wire',  topic:'Company News' },
  { url:'https://www.biospace.com/rss/',                                                                  source:'BioSpace',       topic:'Company News' },
  // ── Industry aggregators ──
  { url:'https://www.fiercepharma.com/rss/xml',                                                          source:'FiercePharma',   topic:'Industry' },
  { url:'https://www.biopharmadive.com/feeds/news/',                                                     source:'BioPharma Dive', topic:'Industry' },
  { url:'https://www.statnews.com/feed/',                                                                 source:'STAT News',      topic:'Industry' },
  { url:'https://endpts.com/feed/',                                                                       source:'Endpoints News', topic:'Industry' },
  // ── Regulatory ──
  { url:'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml',     source:'FDA',            topic:'Regulatory' },
  { url:'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/drug-approvals-and-databases/rss.xml', source:'FDA Approvals', topic:'Regulatory' },
  // ── Google News topic feeds ──
  { url:GN('pharma biotech drug pipeline clinical trial'),                                                source:'Google News',    topic:'Pipeline' },
  { url:GN('pharma biotech merger acquisition deal'),                                                     source:'Google News',    topic:'M&A' },
  { url:GN('pharma biotech earnings revenue quarterly results'),                                          source:'Google News',    topic:'Earnings' },
];

exports.handler = async () => {
  const debug = [];

  const results = await Promise.allSettled(
    ALL_FEEDS.map(async f => {
      const start = Date.now();
      try {
        const res = await fetch(f.url, {
          headers: { 'User-Agent': UA },
          signal: AbortSignal.timeout(7000)
        });
        const status = res.status;
        if (!res.ok) {
          debug.push({ source: f.source, url: f.url, status, count: 0, ms: Date.now() - start });
          return [];
        }
        const xml = await res.text();
        const items = parseRSS(xml, 15);
        debug.push({ source: f.source, url: f.url, status, count: items.length, ms: Date.now() - start });
        return items.map(a => ({ ...a, source: f.source, topic: f.topic }));
      } catch(e) {
        debug.push({ source: f.source, url: f.url, error: e.message, count: 0, ms: Date.now() - start });
        return [];
      }
    })
  );

  const articles = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);

  const seen = new Set();
  const deduped = articles.filter(a => {
    if (!a.url || seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
  deduped.sort((a, b) => b.dateMs - a.dateMs);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ articles: deduped, debug })
  };
};

function parseRSS(xml, max = 15) {
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
