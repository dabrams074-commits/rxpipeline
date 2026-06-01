const UA = 'Mozilla/5.0 (compatible; FeedFetcher-Google/1.0)';
const GN = q => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en&gl=US&ceid=US:en`;

// ── Wire-service industry RSS feeds ──────────────────────────────────────────
// These are the actual feeds where pharma companies publish press releases.
// BusinessWire, GlobeNewswire and PRNewswire all provide public pharma/biotech RSS.
const WIRE_FEEDS = [
  // BusinessWire
  { url:'https://feed.businesswire.com/rss/home/?rss=G22&rssid=BWBIOTECHNOLOGY',     source:'Business Wire', topic:'Company News' },
  { url:'https://feed.businesswire.com/rss/home/?rss=G22&rssid=BWPHARMACEUTICALS',   source:'Business Wire', topic:'Company News' },
  { url:'https://feed.businesswire.com/rss/home/?rss=G22&rssid=BWHEALTHCARE',        source:'Business Wire', topic:'Company News' },
  // GlobeNewswire
  { url:'https://www.globenewswire.com/RssFeed/industry/Biotechnology',              source:'GlobeNewswire', topic:'Company News' },
  { url:'https://www.globenewswire.com/RssFeed/industry/Pharmaceuticals',            source:'GlobeNewswire', topic:'Company News' },
  // PRNewswire
  { url:'https://www.prnewswire.com/rss/news-releases-list.rss?category=HEALTH',     source:'PR Newswire',   topic:'Company News' },
  { url:'https://www.prnewswire.com/rss/news-releases-list.rss?category=PHARMACEUTICAL_BIOTECHNOLOGY_INDUSTRY', source:'PR Newswire', topic:'Company News' },
];

// ── General topic feeds ───────────────────────────────────────────────────────
const TOPIC_FEEDS = [
  { url:'https://www.fiercepharma.com/rss/xml',                                                                        source:'FiercePharma',   topic:'Industry' },
  { url:'https://www.biopharmadive.com/feeds/news/',                                                                   source:'BioPharma Dive', topic:'Industry' },
  { url:'https://www.statnews.com/feed/',                                                                               source:'STAT News',      topic:'Industry' },
  { url:'https://endpts.com/feed/',                                                                                     source:'Endpoints News', topic:'Industry' },
  { url:'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml',                   source:'FDA',            topic:'Regulatory' },
  { url:'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/drug-approvals-and-databases/rss.xml',     source:'FDA Approvals',  topic:'Regulatory' },
  { url:GN('pharma biotech drug pipeline clinical trial'),                                                              source:'Google News',    topic:'Pipeline' },
  { url:GN('pharma biotech merger acquisition deal'),                                                                   source:'Google News',    topic:'M&A' },
  { url:GN('pharma biotech earnings revenue quarterly results'),                                                        source:'Google News',    topic:'Earnings' },
];

exports.handler = async () => {
  const fetchFeed = async (url, max) => {
    try {
      const res = await fetch(url, { headers:{ 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) return [];
      return parseRSS(await res.text(), max);
    } catch { return []; }
  };

  const [wireResults, topicResults] = await Promise.all([
    Promise.allSettled(WIRE_FEEDS.map(async f => {
      const items = await fetchFeed(f.url, 20);
      return items.map(a => ({ ...a, source: f.source, topic: f.topic }));
    })),
    Promise.allSettled(TOPIC_FEEDS.map(async f => {
      const items = await fetchFeed(f.url, 10);
      return items.map(a => ({ ...a, source: f.source, topic: f.topic }));
    }))
  ]);

  const wireArticles  = wireResults.flatMap(r  => r.status === 'fulfilled' ? r.value : []);
  const topicArticles = topicResults.flatMap(r => r.status === 'fulfilled' ? r.value : []);

  const seen = new Set();
  const dedup = arr => arr.filter(a => { if (!a.url || seen.has(a.url)) return false; seen.add(a.url); return true; });

  const all = [...dedup(wireArticles), ...dedup(topicArticles)];
  all.sort((a, b) => b.dateMs - a.dateMs);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=900' },
    body: JSON.stringify(all)
  };
};

function parseRSS(xml, max = 20) {
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
