// netlify/functions/create-portal-session.js
// Creates a Stripe Customer Portal session so users can manage/cancel their subscription.
// Required env var: STRIPE_SECRET_KEY

exports.handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };
  }

  const { email } = JSON.parse(event.body || '{}');
  if (!email) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'email required' }) };
  }

  const SECRET   = process.env.STRIPE_SECRET_KEY;
  const SITE_URL = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888';

  // 1. Find the Stripe customer by email
  const cusRes = await fetch(
    `https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`,
    { headers: { Authorization: `Bearer ${SECRET}` } }
  );
  const cusData = await cusRes.json();

  if (!cusData.data?.length) {
    return {
      statusCode: 404,
      headers: CORS,
      body: JSON.stringify({ error: 'No Stripe customer found for this email' }),
    };
  }

  const customerId = cusData.data[0].id;

  // 2. Create a portal session for that customer
  const params = new URLSearchParams({
    customer:   customerId,
    return_url: SITE_URL,
  });

  const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${SECRET}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const portal = await portalRes.json();

  if (!portalRes.ok) {
    return {
      statusCode: portalRes.status,
      headers: CORS,
      body: JSON.stringify({ error: portal.error?.message || 'Failed to create portal session' }),
    };
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: portal.url }),
  };
};
