// ─────────────────────────────────────────────────────────────────────────────
// auth.js  –  Supabase Google OAuth  +  Stripe subscription gate
//
// SETUP (one-time):
//  1. Create a Supabase project at https://supabase.com
//  2. Dashboard → Authentication → Providers → Google → enable, paste Client ID/Secret
//  3. Dashboard → Authentication → URL Configuration:
//       Site URL      = https://your-site.netlify.app
//       Redirect URLs = https://your-site.netlify.app/**
//  4. Paste your Supabase URL + anon key below
//  5. In Netlify → Site settings → Environment variables, add:
//       STRIPE_SECRET_KEY  = sk_live_...
//       STRIPE_PRICE_ID    = price_...   (your $10/mo recurring price)
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ── Replace these two values with your actual Supabase project credentials ──
const SUPABASE_URL      = 'https://ubfysqhdvqognxqjdhov.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_53-ljxm_GVeTzE3UdgjaIg_7d_StFV2';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let _currentUser  = null;
let _onReadyCalled = false;

export const getUser = () => _currentUser;

// ── Entry point called from main.js DOMContentLoaded ────────────────────────
export async function initAuth(onReady) {
  _showOverlay('loading');

  // Supabase automatically consumes the OAuth hash/code on first load
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.user) {
    _currentUser = session.user;
    await _checkAndGate(onReady);
  } else {
    _showOverlay('login');
  }

  // Keep listening so sign-in / sign-out elsewhere updates state
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user && !_onReadyCalled) {
      _currentUser = session.user;
      await _checkAndGate(onReady);
    } else if (event === 'SIGNED_OUT') {
      _currentUser    = null;
      _onReadyCalled  = false;
      _showOverlay('login');
    }
  });
}

// ── Checks Stripe and either shows the app or the paywall ───────────────────
async function _checkAndGate(onReady) {
  _showOverlay('loading');
  _updateUserPill();

  try {
    const res = await fetch('/.netlify/functions/check-subscription', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: _currentUser.email }),
    });
    const { active } = await res.json();

    if (active) {
      _hideOverlay();
      if (!_onReadyCalled) {
        _onReadyCalled = true;
        onReady?.();
      }
    } else {
      _showOverlay('paywall');
    }
  } catch {
    // Network hiccup — let the user in and check again next visit
    _hideOverlay();
    if (!_onReadyCalled) {
      _onReadyCalled = true;
      onReady?.();
    }
  }
}

// ── Public actions (wired to window.rx* in main.js) ─────────────────────────
export async function signInWithGoogle() {
  const btn = document.getElementById('btn-google-signin');
  if (btn) { btn.disabled = true; btn.querySelector('.btn-google-label').textContent = 'Redirecting…'; }
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options:  { redirectTo: window.location.origin },
  });
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.reload();
}

export async function manageSubscription() {
  if (!_currentUser) return;
  const btn = document.getElementById('btn-manage-sub');
  if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }

  try {
    const res = await fetch('/.netlify/functions/create-portal-session', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: _currentUser.email }),
    });
    const { url, error } = await res.json();
    if (url) {
      window.location.href = url;
    } else {
      throw new Error(error || 'Could not open billing portal');
    }
  } catch (e) {
    alert('Could not open billing portal: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Manage subscription'; }
  }
}

export async function startCheckout() {
  if (!_currentUser) return;
  const btn = document.getElementById('btn-start-trial');
  if (btn) { btn.disabled = true; btn.textContent = 'Redirecting to checkout…'; }

  try {
    const res = await fetch('/.netlify/functions/create-checkout', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: _currentUser.email, userId: _currentUser.id }),
    });
    const { url, error } = await res.json();
    if (url) {
      window.location.href = url;
    } else {
      throw new Error(error || 'No checkout URL returned');
    }
  } catch (e) {
    alert('Could not start checkout: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Start 10-Day Free Trial →'; }
  }
}

// ── Overlay helpers ──────────────────────────────────────────────────────────
function _showOverlay(state) {
  const overlay = document.getElementById('auth-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  ['loading', 'login', 'paywall'].forEach(s => {
    const el = document.getElementById('auth-' + s);
    if (el) el.style.display = s === state ? 'flex' : 'none';
  });
  if (state === 'paywall') _renderPaywallUser();
}

function _hideOverlay() {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.style.display = 'none';
}

function _renderPaywallUser() {
  const el = document.getElementById('paywall-email');
  if (el && _currentUser) el.textContent = _currentUser.email;
}

function _updateUserPill() {
  const pill = document.getElementById('user-pill');
  if (!pill || !_currentUser) return;
  const meta   = _currentUser.user_metadata || {};
  const name   = meta.full_name || meta.name || _currentUser.email.split('@')[0];
  const avatar = meta.avatar_url || meta.picture;
  pill.innerHTML = `
    ${avatar ? `<img src="${avatar}" class="user-avatar" alt="">` : `<div class="user-avatar-initial">${name[0].toUpperCase()}</div>`}
    <span class="user-name">${name}</span>
    <button id="btn-manage-sub" class="user-manage-btn" onclick="window.rxManageSubscription()">Manage subscription</button>
    <button class="user-signout-btn" onclick="window.rxSignOut()">Sign out</button>
  `;
  pill.style.display = 'flex';
}
