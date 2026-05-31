exports.handler = async () => {
  const all = [];
  let from = 0;
  const num = 10;
  const seenIds = new Set();

  while (true) {
    const url = `https://jobs.gsk.com/api/jobs?keywords=&lang=en-gb&from=${from}&num=${num}`;
    let data;
    try {
      const res = await fetch(url);
      if (!res.ok) break;
      data = await res.json();
    } catch {
      break;
    }

    const jobs = data.jobs || [];
    if (jobs.length === 0) break;

    let anyNew = false;
    for (const j of jobs) {
      const d = j.data || j;
      const id = d.req_id || d.slug || '';
      if (id && seenIds.has(id)) continue;
      if (id) seenIds.add(id);
      anyNew = true;
      all.push({
        id,
        title: d.title || '',
        dept: (d.categories || [])[0]?.name || '',
        location: [d.city, d.state, d.country].filter(Boolean).join(', '),
        posted: d.posted_date || '',
        url: d.apply_url || d.canonical_url || 'https://jobs.gsk.com/en-gb/jobs'
      });
    }

    if (!anyNew || all.length >= 2000) break;
    from += num;
    await new Promise(r => setTimeout(r, 100));
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ jobs: all })
  };
};
