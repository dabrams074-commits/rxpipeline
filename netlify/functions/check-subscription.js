// netlify/functions/check-subscription.js
// Checks whether a user has an active or trialing Stripe subscription.
//
// Required env var:
//   STRIPE_SECRET_KEY — sk_live_... or sk_test_...

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

  const { email, createdAt } = JSON.parse(event.body || '{}');
  if (!email) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ active: false, error: 'email required' }),
    };
  }

  // 10-day free trial based on account creation date
  if (createdAt) {
    const daysSinceSignup = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceSignup < 10) {
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true, reason: 'trial', daysLeft: Math.ceil(10 - daysSinceSignup) }),
      };
    }
  }

  const SECRET = process.env.STRIPE_SECRET_KEY;
  if (!SECRET) {
    // Stripe not yet configured — let all authenticated users in
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: true, reason: 'stripe_not_configured' }),
    };
  }

  const stripeGet = (path) =>
    fetch(`https://api.stripe.com/v1${path}`, {
      headers: { Authorization: `Bearer ${SECRET}` },
    }).then(r => r.json());

  try {
    // 1. Find the Stripe customer for this email
    const customers = await stripeGet(
      `/customers?email=${encodeURIComponent(email)}&limit=5`
    );

    if (!customers.data?.length) {
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false, reason: 'no_customer' }),
      };
    }

    // Check all matching customers (email duplication is possible)
    for (const customer of customers.data) {
      // Check active subscriptions
      const activeSubs = await stripeGet(
        `/subscriptions?customer=${customer.id}&status=active&limit=1`
      );
      if (activeSubs.data?.length) {
        return {
          statusCode: 200,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: true, status: 'active' }),
        };
      }

      // Check trialing subscriptions
      const trialSubs = await stripeGet(
        `/subscriptions?customer=${customer.id}&status=trialing&limit=1`
      );
      if (trialSubs.data?.length) {
        return {
          statusCode: 200,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: true, status: 'trialing' }),
        };
      }
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false, reason: 'no_active_subscription' }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ active: false, error: e.message }),
    };
  }
};
