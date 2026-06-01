const FEEDS = [
  { url: 'https://www.fiercepharma.com/rss/xml',                                                                              source: 'FiercePharma',   topic: 'Industry' },
  { url: 'https://www.biopharmadive.com/feeds/news/',                                                                         source: 'BioPharma Dive', topic: 'Industry' },
  { url: 'https://www.statnews.com/feed/',                                                                                    source: 'STAT News',      topic: 'Industry' },
  { url: 'https://endpts.com/feed/',                                                                                          source: 'Endpoints News', topic: 'Industry' },
  { url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml',                         source: 'FDA',            topic: 'Regulatory' },
  { url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/drug-approvals-and-databases/rss.xml',           source: 'FDA Approvals',  topic: 'Regulatory' },
  { url: 'https://news.google.com/rss/search?q=pharma+biotech+drug+pipeline+clinical+trial&hl=en&gl=US&ceid=US:en',          source: 'Google News',    topic: 'Pipeline' },
  { url: 'https://news.google.com/rss/search?q=pharma+biotech+merger+acquisition+deal&hl=en&gl=US&ceid=US:en',               source: 'Google News',    topic: 'M&A' },
  { url: 'https://news.google.com/rss/search?q=pharma+biotech+earnings+revenue+quarterly+results&hl=en&gl=US&ceid=US:en',   source: 'Google News',    topic: 'Earnings' },
];

exports.handler = async () => {
  const results = await Promise.allSettled(
    FEEDS.map(async f => {
      try {
        const res = await fetch(f.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RxPipeline/1.0)' }, signal: AbortSignal.timeout(6000) });
        if (!res.ok) return [];
        const xml = await res.text();
        return parseRSS(xml, f.source, f.topic);
      } catch { return []; }
    })
  );

  const articles = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  articles.sort((a, b) => b.dateMs - a.dateMs);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=900' },
    body: JSON.stringify(articles)
  };
};

function parseRSS(xml, source, topic) {
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
    items.push({ title, url, source, topic, date: dateMs ? new Date(dateMs).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '', dateMs, summary: desc });
  }
  return items.slice(0, 12);
}

function get(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? (m[1] ?? m[2] ?? '') : '';
}

function clean(s) {
  return s.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
}
