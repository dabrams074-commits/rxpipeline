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

  const { email, userId, plan } = JSON.parse(event.body || '{}');
  if (!email) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'email is required' }) };
  }

  const SECRET          = process.env.STRIPE_SECRET_KEY;
  const PRICE_ID_MONTHLY = process.env.STRIPE_PRICE_ID;
  const PRICE_ID_6MO     = process.env.STRIPE_PRICE_ID_6MO;
  // Netlify injects the deploy URL automatically; fall back for local dev
  const SITE_URL = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888';

  const PRICE_ID = (plan === '6mo' && PRICE_ID_6MO) ? PRICE_ID_6MO : PRICE_ID_MONTHLY;

  if (!SECRET || !PRICE_ID) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'Missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID env var' }),
    };
  }

  const isOneTime = (plan === '6mo');

  const params = new URLSearchParams({
    mode:                               isOneTime ? 'payment' : 'subscription',
    'payment_method_types[0]':          'card',
    'line_items[0][price]':             PRICE_ID,
    'line_items[0][quantity]':          '1',
    allow_promotion_codes:              'true',
    customer_email:                     email,
    success_url:                        `${SITE_URL}/?checkout=success`,
    cancel_url:                         `${SITE_URL}/?checkout=cancelled`,
    'metadata[supabase_user_id]':       userId || '',
    'metadata[plan]':                   plan || 'monthly',
  });

  // Subscriptions get a 10-day free trial; one-time payments don't
  if (!isOneTime) {
    params.append('subscription_data[trial_period_days]', '10');
  }

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
