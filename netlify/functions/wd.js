exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { subdomain, wdNum, tenant, limit, offset, searchText, appliedFacets } = body;
  if (!subdomain || !wdNum || !tenant) {
    return { statusCode: 400, body: 'Missing required fields' };
  }

  const url = `https://${subdomain}.wd${wdNum}.myworkdayjobs.com/wday/cxs/${subdomain}/${tenant}/jobs`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': `https://${subdomain}.wd${wdNum}.myworkdayjobs.com`,
        'Referer': `https://${subdomain}.wd${wdNum}.myworkdayjobs.com/${tenant}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({
        limit: limit || 20,
        offset: offset || 0,
        searchText: searchText || '',
        appliedFacets: appliedFacets || {}
      })
    });

    const data = await response.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(data)
    };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: e.message }) };
  }
};
