// netlify/functions/admin-data.js
// Admin dashboard data — Stripe subscribers + Supabase users
//
// Required env vars:
//   STRIPE_SECRET_KEY        — sk_live_... or sk_test_...
//   SUPABASE_URL             — https://xxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY — service_role JWT (NOT the anon key)
//   ADMIN_EMAIL              — the email address allowed to access this endpoint

exports.handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

  const STRIPE_KEY     = process.env.STRIPE_SECRET_KEY;
  const SB_URL         = process.env.SUPABASE_URL;
  const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ADMIN_EMAIL    = process.env.ADMIN_EMAIL;

  const missing = ['STRIPE_SECRET_KEY','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','ADMIN_EMAIL']
    .filter(k => !process.env[k]);
  if (missing.length) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: `Missing env vars: ${missing.join(', ')}` }) };
  }

  // ── 1. Verify caller is the admin ──────────────────────────────────────────
  const authHeader = event.headers?.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'No token' }) };

  const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SB_SERVICE_KEY },
  });
  if (!userRes.ok) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Invalid token' }) };
  const { email: callerEmail } = await userRes.json();
  if (callerEmail !== ADMIN_EMAIL) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  const stripeGet = (path) =>
    fetch(`https://api.stripe.com/v1${path}`, {
      headers: { Authorization: `Bearer ${STRIPE_KEY}` },
    }).then(r => r.json());

  // ── 2. Stripe — fetch all customers + subscriptions ────────────────────────
  async function fetchAllStripeCustomers() {
    const customers = [];
    let url = '/customers?limit=100&expand[]=data.subscriptions';
    while (url) {
      const page = await stripeGet(url);
      if (page.error) throw new Error(page.error.message);
      customers.push(...(page.data || []));
      url = page.has_more ? `/customers?limit=100&starting_after=${page.data[page.data.length-1].id}&expand[]=data.subscriptions` : null;
    }
    return customers;
  }

  // ── 3. Supabase — fetch all auth users ────────────────────────────────────
  async function fetchAllSupabaseUsers() {
    const users = [];
    let page = 1;
    while (true) {
      const res = await fetch(`${SB_URL}/auth/v1/admin/users?page=${page}&per_page=1000`, {
        headers: { Authorization: `Bearer ${SB_SERVICE_KEY}`, apikey: SB_SERVICE_KEY },
      });
      const data = await res.json();
      const batch = data.users || [];
      users.push(...batch);
      if (batch.length < 1000) break;
      page++;
    }
    return users;
  }

  try {
    const [stripeCustomers, sbUsers] = await Promise.all([
      fetchAllStripeCustomers(),
      fetchAllSupabaseUsers(),
    ]);

    // ── Build subscriber rows ─────────────────────────────────────────────
    const subscribers = [];
    let mrr = 0;

    for (const customer of stripeCustomers) {
      const subs = customer.subscriptions?.data || [];
      if (!subs.length) {
        // Customer exists but no subscription
        subscribers.push({
          email:   customer.email,
          name:    customer.name || '',
          status:  'no_sub',
          created: customer.created,
          trialEnd: null,
          amount:  0,
        });
        continue;
      }
      for (const sub of subs) {
        const amount = (sub.items?.data?.[0]?.price?.unit_amount || 0) / 100;
        if (sub.status === 'active') mrr += amount;
        subscribers.push({
          email:    customer.email,
          name:     customer.name || '',
          status:   sub.status,           // active | trialing | canceled | past_due
          created:  sub.created,
          trialEnd: sub.trial_end,
          amount,
          cancelAt: sub.cancel_at,
        });
      }
    }

    // ── Summary metrics ───────────────────────────────────────────────────
    const active   = subscribers.filter(s => s.status === 'active').length;
    const trialing = subscribers.filter(s => s.status === 'trialing').length;
    const cancelled= subscribers.filter(s => s.status === 'canceled').length;
    const pastDue  = subscribers.filter(s => s.status === 'past_due').length;

    // ── Merge Supabase users (for last_sign_in, auth provider) ───────────
    const emailToSbUser = {};
    for (const u of sbUsers) {
      if (u.email) emailToSbUser[u.email.toLowerCase()] = u;
    }

    const enriched = subscribers.map(s => ({
      ...s,
      lastSignIn: emailToSbUser[s.email?.toLowerCase()]?.last_sign_in_at || null,
      authProvider: emailToSbUser[s.email?.toLowerCase()]?.app_metadata?.provider || 'unknown',
    }));

    // ── Recent sign-ins from Supabase (all users, not just subscribers) ──
    const recentActivity = sbUsers
      .filter(u => u.last_sign_in_at)
      .sort((a, b) => new Date(b.last_sign_in_at) - new Date(a.last_sign_in_at))
      .slice(0, 50)
      .map(u => ({
        email:      u.email,
        lastSignIn: u.last_sign_in_at,
        createdAt:  u.created_at,
        provider:   u.app_metadata?.provider || 'unknown',
      }));

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metrics: { total: sbUsers.length, active, trialing, cancelled, pastDue, mrr },
        subscribers: enriched.sort((a, b) => b.created - a.created),
        activity: recentActivity,
      }),
    };
  } catch (e) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }
};
