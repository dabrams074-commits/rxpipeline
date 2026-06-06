// netlify/functions/create-checkout.js
// Creates a Stripe Checkout session (server-side – secret key is safe here)
//
// Required env vars in Netlify → Site settings → Environment variables:
//   STRIPE_SECRET_KEY  — sk_live_... or sk_test_...
//   STRIPE_PRICE_ID    — price_... (your $10/month recurring price ID)

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

  const { email, userId } = JSON.parse(event.body || '{}');
  if (!email) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'email is required' }) };
  }

  const SECRET   = process.env.STRIPE_SECRET_KEY;
  const PRICE_ID = process.env.STRIPE_PRICE_ID;
  // Netlify injects the deploy URL automatically; fall back for local dev
  const SITE_URL = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888';

  if (!SECRET || !PRICE_ID) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'Missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID env var' }),
    };
  }

  const params = new URLSearchParams({
    mode:                               'subscription',
    'payment_method_types[0]':          'card',
    'line_items[0][price]':             PRICE_ID,
    'line_items[0][quantity]':          '1',
    'subscription_data[trial_period_days]': '10',
    allow_promotion_codes:              'true',
    payment_method_collection:          'if_required',
    customer_email:                     email,
    success_url:                        `${SITE_URL}/?checkout=success`,
    cancel_url:                         `${SITE_URL}/?checkout=cancelled`,
    'metadata[supabase_user_id]':       userId || '',
  });

  try {
    const res  = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${SECRET}`,
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const session = await res.json();

    if (!res.ok) {
      return {
        statusCode: res.status,
        headers: CORS,
        body: JSON.stringify({ error: session.error?.message || 'Stripe error' }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
