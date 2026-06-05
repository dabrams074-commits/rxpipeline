const UA = 'Mozilla/5.0 (compatible; FeedFetcher-Google/1.0)';
const GN = q => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en&gl=US&ceid=US:en`;

// ── Per-company Google News feeds (confirmed working) ─────────────────────────
const COMPANY_FEEDS = [
  { company:'Pfizer',              url: GN('"Pfizer" pharmaceutical press release') },
  { company:'Merck',               url: GN('"Merck" pharmaceutical press release') },
  { company:'Eli Lilly',           url: GN('"Eli Lilly" OR "Lilly" pharmaceutical press release') },
  { company:'AstraZeneca',         url: GN('"AstraZeneca" press release') },
  { company:'Novartis',            url: GN('"Novartis" press release') },
  { company:'GSK',                 url: GN('"GSK" OR "GlaxoSmithKline" press release') },
  { company:'Amgen',               url: GN('"Amgen" press release') },
  { company:'Sanofi',              url: GN('"Sanofi" press release') },
  { company:'BMS',                 url: GN('"Bristol Myers Squibb" press release') },
  { company:'Takeda',              url: GN('"Takeda" pharmaceutical press release') },
  { company:'AbbVie',              url: GN('"AbbVie" press release') },
  { company:'J&J',                 url: GN('"Johnson & Johnson" OR "Janssen" press release') },
  { company:'Novo Nordisk',        url: GN('"Novo Nordisk" press release') },
  { company:'Roche',               url: GN('"Roche" OR "Genentech" press release') },
  { company:'Regeneron',           url: GN('"Regeneron" press release') },
  { company:'Biogen',              url: GN('"Biogen" press release') },
  { company:'Gilead',              url: GN('"Gilead Sciences" press release') },
  { company:'Vertex',              url: GN('"Vertex Pharmaceuticals" press release') },
  { company:'Moderna',             url: GN('"Moderna" press release') },
  { company:'BioNTech',            url: GN('"BioNTech" press release') },
  { company:'Alnylam',             url: GN('"Alnylam" press release') },
  { company:'Argenx',              url: GN('"Argenx" press release') },
  { company:'Daiichi Sankyo',      url: GN('"Daiichi Sankyo" press release') },
  { company:'Incyte',              url: GN('"Incyte" pharmaceutical press release') },
  { company:'Neurocrine',          url: GN('"Neurocrine Biosciences" press release') },
  { company:'Sarepta',             url: GN('"Sarepta Therapeutics" press release') },
  { company:'Ionis',               url: GN('"Ionis Pharmaceuticals" press release') },
  { company:'Halozyme',            url: GN('"Halozyme" press release') },
  { company:'Blueprint Medicines', url: GN('"Blueprint Medicines" press release') },
  { company:'Exelixis',            url: GN('"Exelixis" press release') },
  { company:'Ultragenyx',          url: GN('"Ultragenyx" press release') },
  { company:'Insmed',              url: GN('"Insmed" press release') },
  { company:'Genmab',              url: GN('"Genmab" press release') },
  { company:'Madrigal',            url: GN('"Madrigal Pharmaceuticals" press release') },
  { company:'Jazz Pharmaceuticals',url: GN('"Jazz Pharmaceuticals" press release') },
  { company:'Acadia',              url: GN('"Acadia Pharmaceuticals" press release') },
  { company:'Ascendis',            url: GN('"Ascendis Pharma" press release') },
  { company:'Cytokinetics',        url: GN('"Cytokinetics" press release') },
  { company:'IQVIA',               url: GN('"IQVIA" press release') },
  { company:'Thermo Fisher',       url: GN('"Thermo Fisher Scientific" press release') },
  { company:'Natera',              url: GN('"Natera" press release') },
];

// ── Industry / topic feeds ────────────────────────────────────────────────────
const TOPIC_FEEDS = [
  { url:'https://www.prnewswire.com/rss/news-releases-list.rss',        source:'PR Newswire',    topic:'Company News' },
  { url:'https://www.fiercepharma.com/rss/xml',                         source:'FiercePharma',   topic:'Industry' },
  { url:'https://www.biopharmadive.com/feeds/news/',                    source:'BioPharma Dive', topic:'Industry' },
  { url:'https://www.statnews.com/feed/',                               source:'STAT News',      topic:'Industry' },
  { url:'https://endpts.com/feed/',                                     source:'Endpoints News', topic:'Industry' },
  { url:GN('FDA drug approval announcement'),                           source:'FDA',            topic:'Regulatory' },
  { url:GN('FDA press release pharmaceutical'),                         source:'FDA News',       topic:'Regulatory' },
  { url:GN('pharma biotech drug pipeline clinical trial'),              source:'Google News',    topic:'Pipeline' },
  { url:GN('pharma biotech merger acquisition deal'),                   source:'Google News',    topic:'M&A' },
  { url:GN('pharma biotech earnings revenue quarterly results'),        source:'Google News',    topic:'Earnings' },
  // ── Medical Journals ───────────────────────────────────────────────────────
  { url:'https://www.nejm.org/action/showFeed?type=etoc&feed=rss&jc=nejm',                           source:'NEJM',                   topic:'Journals' },
  { url:'https://evidence.nejm.org/action/showFeed?type=etoc&feed=rss&jc=evid',                      source:'NEJM Evidence',          topic:'Journals' },
  { url:'https://www.thelancet.com/rssfeed/lancet_online.xml',                                        source:'The Lancet',             topic:'Journals' },
  { url:'https://jamanetwork.com/rss/site_3/67.xml',                                                  source:'JAMA',                   topic:'Journals' },
  { url:'https://www.nature.com/nm.rss',                                                              source:'Nature Medicine',        topic:'Journals' },
  { url:'https://www.nature.com/nbt.rss',                                                             source:'Nature Biotechnology',   topic:'Journals' },
  { url:'https://www.cell.com/cell/rss',                                                              source:'Cell',                   topic:'Journals' },
  { url:'https://ascopubs.org/action/showFeed?type=etoc&feed=rss&jc=jco',                            source:'J Clinical Oncology',    topic:'Journals' },
  { url:'https://aacrjournals.org/clincancerres/rss/1',                                               source:'Clinical Cancer Res',   topic:'Journals' },
  { url:'https://ashpublications.org/rss/site_1/1.xml',                                               source:'Blood (ASH)',            topic:'Journals' },
  { url:'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/medwatch/rss.xml',        source:'FDA MedWatch',           topic:'Journals' },
];

exports.handler = async () => {
  const fetchFeed = async (url, max) => {
    try {
      const res = await fetch(url, { headers:{ 'User-Agent': UA }, signal: AbortSignal.timeout(7000) });
      if (!res.ok) return [];
      return parseRSS(await res.text(), max);
    } catch { return []; }
  };

  const [coResults, topicResults] = await Promise.all([
    Promise.allSettled(COMPANY_FEEDS.map(async f => {
      const items = await fetchFeed(f.url, 4);
      return items.map(a => ({ ...a, source: f.company, topic: 'Company News', company: f.company }));
    })),
    Promise.allSettled(TOPIC_FEEDS.map(async f => {
      const items = await fetchFeed(f.url, 12);
      return items.map(a => ({ ...a, source: f.source, topic: f.topic }));
    }))
  ]);

  const coArticles    = coResults.flatMap(r    => r.status === 'fulfilled' ? r.value : []);
  const topicArticles = topicResults.flatMap(r => r.status === 'fulfilled' ? r.value : []);

  const seen = new Set();
  const dedup = arr => arr.filter(a => { if (!a.url || seen.has(a.url)) return false; seen.add(a.url); return true; });

  const all = [...dedup(coArticles), ...dedup(topicArticles)];
  all.sort((a, b) => b.dateMs - a.dateMs);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=900' },
    body: JSON.stringify(all)
  };
};

function parseRSS(xml, max = 12) {
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
