const GN = (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en&gl=US&ceid=US:en`;

// General topic feeds
const TOPIC_FEEDS = [
  { url: 'https://www.fiercepharma.com/rss/xml',                                                                            source: 'FiercePharma',   topic: 'Industry' },
  { url: 'https://www.biopharmadive.com/feeds/news/',                                                                       source: 'BioPharma Dive', topic: 'Industry' },
  { url: 'https://www.statnews.com/feed/',                                                                                  source: 'STAT News',      topic: 'Industry' },
  { url: 'https://endpts.com/feed/',                                                                                        source: 'Endpoints News', topic: 'Industry' },
  { url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml',                       source: 'FDA',            topic: 'Regulatory' },
  { url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/drug-approvals-and-databases/rss.xml',         source: 'FDA Approvals',  topic: 'Regulatory' },
  { url: GN('pharma biotech drug pipeline clinical trial'),                                                                  source: 'Google News',    topic: 'Pipeline' },
  { url: GN('pharma biotech merger acquisition deal'),                                                                       source: 'Google News',    topic: 'M&A' },
  { url: GN('pharma biotech earnings revenue quarterly results'),                                                            source: 'Google News',    topic: 'Earnings' },
];

// Company-specific Google News RSS feeds
const COMPANY_FEEDS = [
  { company: 'Pfizer',              url: GN('"Pfizer" pharmaceutical') },
  { company: 'Merck',               url: GN('"Merck" pharmaceutical drug') },
  { company: 'Eli Lilly',           url: GN('"Eli Lilly" OR "Lilly" pharmaceutical') },
  { company: 'AstraZeneca',         url: GN('"AstraZeneca"') },
  { company: 'Novartis',            url: GN('"Novartis"') },
  { company: 'GSK',                 url: GN('"GSK" OR "GlaxoSmithKline" pharmaceutical') },
  { company: 'Amgen',               url: GN('"Amgen"') },
  { company: 'Sanofi',              url: GN('"Sanofi" pharmaceutical') },
  { company: 'BMS',                 url: GN('"Bristol Myers Squibb" pharmaceutical') },
  { company: 'Takeda',              url: GN('"Takeda" pharmaceutical') },
  { company: 'AbbVie',              url: GN('"AbbVie"') },
  { company: 'J&J',                 url: GN('"Johnson & Johnson" OR "Janssen" pharmaceutical') },
  { company: 'Novo Nordisk',        url: GN('"Novo Nordisk"') },
  { company: 'Roche',               url: GN('"Roche" OR "Genentech" pharmaceutical') },
  { company: 'Thermo Fisher',       url: GN('"Thermo Fisher Scientific"') },
  { company: 'Becton Dickinson',    url: GN('"Becton Dickinson" OR "BD Medical"') },
  { company: 'Zoetis',              url: GN('"Zoetis" animal health') },
  { company: 'Daiichi Sankyo',      url: GN('"Daiichi Sankyo"') },
  { company: 'Regeneron',           url: GN('"Regeneron"') },
  { company: 'Biogen',              url: GN('"Biogen"') },
  { company: 'Gilead',              url: GN('"Gilead Sciences"') },
  { company: 'Vertex',              url: GN('"Vertex Pharmaceuticals"') },
  { company: 'Moderna',             url: GN('"Moderna"') },
  { company: 'BioNTech',            url: GN('"BioNTech"') },
  { company: 'United Therapeutics', url: GN('"United Therapeutics"') },
  { company: 'Royalty Pharma',      url: GN('"Royalty Pharma"') },
  { company: 'Jazz Pharmaceuticals',url: GN('"Jazz Pharmaceuticals"') },
  { company: 'Incyte',              url: GN('"Incyte" pharmaceutical') },
  { company: 'Acadia',              url: GN('"Acadia Pharmaceuticals"') },
  { company: 'Alnylam',             url: GN('"Alnylam"') },
  { company: 'Argenx',              url: GN('"Argenx"') },
  { company: 'Ascendis',            url: GN('"Ascendis Pharma"') },
  { company: 'Sarepta',             url: GN('"Sarepta Therapeutics"') },
  { company: 'Ultragenyx',          url: GN('"Ultragenyx"') },
  { company: 'Insmed',              url: GN('"Insmed"') },
  { company: 'Blueprint Medicines', url: GN('"Blueprint Medicines"') },
  { company: 'Cytokinetics',        url: GN('"Cytokinetics"') },
  { company: 'Genmab',              url: GN('"Genmab"') },
  { company: 'Illumina',            url: GN('"Illumina" genomics sequencing') },
  { company: 'Ionis',               url: GN('"Ionis Pharmaceuticals"') },
  { company: 'Exelixis',            url: GN('"Exelixis"') },
  { company: 'Madrigal',            url: GN('"Madrigal Pharmaceuticals"') },
  { company: 'Neurocrine',          url: GN('"Neurocrine Biosciences"') },
  { company: 'Natera',              url: GN('"Natera" genetics') },
  { company: 'Halozyme',            url: GN('"Halozyme"') },
  { company: 'Arcus Biosciences',   url: GN('"Arcus Biosciences"') },
  { company: 'Protagonist',         url: GN('"Protagonist Therapeutics"') },
  { company: 'Nuvalent',            url: GN('"Nuvalent"') },
  { company: 'Disc Medicine',       url: GN('"Disc Medicine"') },
  { company: 'IQVIA',               url: GN('"IQVIA"') },
];

exports.handler = async () => {
  const fetchFeed = async (url, maxItems = 10) => {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RxPipeline/1.0)' },
        signal: AbortSignal.timeout(6000)
      });
      if (!res.ok) return [];
      const xml = await res.text();
      return parseRSS(xml, maxItems);
    } catch { return []; }
  };

  // Fetch topic feeds (up to 10 articles each) and company feeds (up to 5 each) in parallel
  const [topicResults, companyResults] = await Promise.all([
    Promise.allSettled(TOPIC_FEEDS.map(async f => {
      const items = await fetchFeed(f.url, 10);
      return items.map(a => ({ ...a, source: f.source, topic: f.topic }));
    })),
    Promise.allSettled(COMPANY_FEEDS.map(async f => {
      const items = await fetchFeed(f.url, 5);
      return items.map(a => ({ ...a, source: f.company, topic: 'Company News', company: f.company }));
    }))
  ]);

  const topicArticles = topicResults.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  const companyArticles = companyResults.flatMap(r => r.status === 'fulfilled' ? r.value : []);

  // Deduplicate company articles by URL
  const seenUrls = new Set(topicArticles.map(a => a.url));
  const uniqueCompany = companyArticles.filter(a => {
    if (seenUrls.has(a.url)) return false;
    seenUrls.add(a.url);
    return true;
  });

  const all = [...topicArticles, ...uniqueCompany];
  all.sort((a, b) => b.dateMs - a.dateMs);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=900'
    },
    body: JSON.stringify(all)
  };
};

function parseRSS(xml, maxItems = 10) {
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
    items.push({
      title,
      url,
      date: dateMs ? new Date(dateMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
      dateMs,
      summary: desc
    });
    if (items.length >= maxItems) break;
  }
  return items;
}

function get(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? (m[1] ?? m[2] ?? '') : '';
}

function clean(s) {
  return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
