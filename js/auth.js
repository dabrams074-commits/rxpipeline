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
let _isTrialUser = false;
let _needsUpgrade = false; // signed in but no active subscription

export const getUser = () => _currentUser;
export const getAuthState = () => ({
  user: _currentUser,
  needsUpgrade: _needsUpgrade,
  isTrial: _isTrialUser,
});

// ── Entry point called from main.js DOMContentLoaded ────────────────────────
export async function initAuth(onReady) {
  _showOverlay('loading');

  // Supabase automatically consumes the OAuth hash/code on first load
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.user) {
    _currentUser = session.user;
    await _checkAndGate(onReady);
  } else {
    // Let unauthenticated users see Live Roles — inline CTA handles conversion
    _hideOverlay();
    if (!_onReadyCalled) { _onReadyCalled = true; onReady?.(); }
  }

  // Keep listening so sign-in / sign-out elsewhere updates state
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user && !_onReadyCalled) {
      _currentUser = session.user;
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'sign_up', {
          method: session.user.app_metadata?.provider || 'email'
        });
      }
      await _checkAndGate(onReady);
    } else if (event === 'SIGNED_OUT') {
      _currentUser    = null;
      _onReadyCalled  = false;
      _needsUpgrade   = false;
      _isTrialUser    = false;
      _hideOverlay();
      // Re-render roles so inline CTA updates to sign-in state
      if (typeof window.renderRoles === 'function') window.renderRoles();
    }
  });
}

// ── Grant access to any signed-in user (free access, no subscription required) ──
async function _checkAndGate(onReady) {
  _updateUserPill();
  _needsUpgrade = false;
  _hideOverlay();
  if (!_onReadyCalled) {
    _onReadyCalled = true;
    onReady?.();
  }
}

// ── Public actions (wired to window.rx* in main.js) ─────────────────────────
export async function signInWithGoogle() {
  const btn = document.getElementById('btn-google-signin');
  if (btn) { btn.disabled = true; btn.textContent = 'Redirecting…'; }
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options:  { redirectTo: window.location.origin },
  });
}

export async function signInWithLinkedIn() {
  const btn = document.getElementById('btn-linkedin-signin');
  if (btn) { btn.disabled = true; btn.textContent = 'Redirecting…'; }
  await supabase.auth.signInWithOAuth({
    provider: 'linkedin_oidc',
    options:  { redirectTo: window.location.origin },
  });
}

export async function signInWithApple() {
  const btn = document.getElementById('btn-apple-signin');
  if (btn) { btn.disabled = true; btn.textContent = 'Redirecting…'; }
  await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options:  { redirectTo: window.location.origin },
  });
}

let _isSignUp = false;
export function toggleSignUp(e) {
  e.preventDefault();
  _isSignUp = !_isSignUp;
  const btn    = document.getElementById('btn-email-signin');
  const toggle = document.querySelector('.auth-toggle');
  const pwd    = document.getElementById('auth-password-input');
  if (_isSignUp) {
    btn.textContent    = 'Create account';
    toggle.innerHTML   = 'Already have an account? <a href="#" onclick="window.rxToggleSignUp(event)">Sign in</a>';
    pwd.autocomplete   = 'new-password';
  } else {
    btn.textContent    = 'Sign in';
    toggle.innerHTML   = 'Don\'t have an account? <a href="#" onclick="window.rxToggleSignUp(event)">Sign up</a>';
    pwd.autocomplete   = 'current-password';
  }
  document.getElementById('auth-email-error').style.display = 'none';
}

export async function emailAuth(e) {
  e.preventDefault();
  const email    = document.getElementById('auth-email-input').value.trim();
  const password = document.getElementById('auth-password-input').value;
  const btn      = document.getElementById('btn-email-signin');
  const errEl    = document.getElementById('auth-email-error');
  btn.disabled   = true;
  btn.textContent = _isSignUp ? 'Creating account…' : 'Signing in…';
  errEl.style.display = 'none';

  const { error } = _isSignUp
    ? await supabase.auth.signUp({ email, password })
    : await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    errEl.textContent   = error.message;
    errEl.style.display = 'block';
    btn.disabled        = false;
    btn.textContent     = _isSignUp ? 'Create account' : 'Sign in';
  } else if (_isSignUp) {
    errEl.style.cssText = 'display:block;color:var(--accent)';
    errEl.textContent   = 'Check your email for a confirmation link.';
    btn.disabled        = false;
    btn.textContent     = 'Create account';
  }
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.reload();
}

export async function manageSubscription() {
  if (!_currentUser) return;
  // Trial users see plan picker instead of going straight to monthly checkout
  if (_isTrialUser) { return showPaywall(); }
  const btn = document.getElementById('btn-manage-sub');
  if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }

  try {
    const res = await fetch('/.netlify/functions/create-portal-session', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: _currentUser.email, createdAt: _currentUser.created_at }),
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

export function showPaywall() {
  _showOverlay(_currentUser ? 'paywall' : 'login');
}

export async function startCheckout(plan = 'monthly', triggerEl = null) {
  if (!_currentUser) return;
  // Only disable the clicked button, not all plan buttons
  const btn = triggerEl instanceof HTMLElement ? triggerEl : document.getElementById('btn-start-trial');
  const origLabel = btn ? (btn.dataset.label || btn.textContent) : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Redirecting…'; }

  try {
    const res = await fetch('/.netlify/functions/create-checkout', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: _currentUser.email, userId: _currentUser.id, plan }),
    });
    const { url, error } = await res.json();
    if (url) {
      window.location.href = url;
    } else {
      throw new Error(error || 'No checkout URL returned');
    }
  } catch (e) {
    alert('Could not start checkout: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = origLabel; }
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

function _showTrialBanner(daysLeft) {
  if (document.getElementById('trial-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'trial-banner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#1a6b3c;color:#fff;text-align:center;padding:8px 16px;font-size:13px;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:12px;';
  const dismiss = () => { banner.remove(); document.body.style.paddingTop = ''; };
  banner.innerHTML = `<span>🎉 You have <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong> left in your free trial.</span><button onclick="window.rxShowPaywall()" style="background:#fff;color:#1a6b3c;border:none;border-radius:4px;padding:4px 10px;font-size:12px;font-weight:600;cursor:pointer;">Subscribe now</button><button id="trial-banner-close" style="background:none;border:none;color:#fff;font-size:16px;cursor:pointer;margin-left:4px;">×</button>`;
  document.body.prepend(banner);
  document.body.style.paddingTop = banner.offsetHeight + 'px';
  document.getElementById('trial-banner-close').addEventListener('click', dismiss);
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
