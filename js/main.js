import {
  STAGES, jobs, editId, tFilters, panelJobId,
  saveJobs, loadJobs, loadJobsFromCloud, saveJobsToCloud,
  setJobs, setEditId, setPanelJobId, resetTFilters
} from './store.js';

import { initAuth, signInWithGoogle, signInWithLinkedIn, signInWithApple, signOut, startCheckout, manageSubscription, toggleSignUp, emailAuth, supabase } from './auth.js';
window.rxSignInWithGoogle      = signInWithGoogle;
window.rxSignInWithLinkedIn    = signInWithLinkedIn;
window.rxSignInWithApple       = signInWithApple;
window.rxSignOut               = signOut;
window.rxStartCheckout         = startCheckout;
window.rxManageSubscription    = manageSubscription;
window.rxToggleSignUp          = toggleSignUp;
window.rxEmailAuth             = emailAuth;

import {
  FETCH_COMPANIES, all_jobs, pfizer_filtered, addedRoleSet, selectedCompanies,
  saveAddedRoles, buildCompanyCheckboxes, toggleCoSelect, selectAllCompanies, selectNoneCompanies,
  fetchAllCompanyJobs, setPfizerFiltered, initCachedLibrary, forceRefreshBaseline
} from './api.js';

// ══════════════════════════════════════════
// SHARED UTILITIES
// ══════════════════════════════════════════
export function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
export function uid() { return Math.random().toString(36).slice(2, 10); }
export function todayStr(offset = 0) { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); }
export function fmtDate(s) { if (!s) return ''; const d = new Date(s + 'T00:00:00'); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
export function showToast(msg) { const t = document.getElementById('toast'); t.textContent = '✓ ' + msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2600); }

// ══════════════════════════════════════════
// VIEW SWITCHING
// ══════════════════════════════════════════
let currentView = 'home';
function switchView(v) {
  currentView = v;
  ['home', 'tracker', 'library', 'liveroles', 'news', 'community'].forEach(id => {
    document.getElementById('view-' + id).classList.toggle('active', v === id);
  });
  ['tracker', 'library', 'liveroles', 'news', 'community'].forEach(id => {
    const el = document.getElementById('tab-' + id);
    if (el) el.classList.toggle('active', v === id);
  });
  if (v === 'library') { renderLibrary(); preloadNews(); }
  if (v === 'tracker') renderTracker();
  if (v === 'home') updateHomeCards();
  if (v === 'news') loadNews();
  if (v === 'community') { loadWins(); loadPosts(); }
}

function updateHomeCards() {
  const trackerBadge = document.getElementById('home-tracker-badge');
  if (trackerBadge) trackerBadge.textContent = jobs.length + (jobs.length === 1 ? ' role tracked' : ' roles tracked');
  const libBadge = document.getElementById('home-lib-badge');
  if (libBadge) libBadge.textContent = FETCH_COMPANIES.length + ' companies';
  const rolesBadge = document.getElementById('home-roles-badge');
  if (rolesBadge) rolesBadge.textContent = all_jobs.length > 0 ? all_jobs.length + ' roles loaded' : 'Fetch to load';
  loadHomeCommunity();
}

async function loadHomeCommunity() {
  const winsEl  = document.getElementById('home-wins');
  const postsEl = document.getElementById('home-posts');
  if (!winsEl || !postsEl) return;

  const [winsRes, postsRes] = await Promise.all([
    supabase.from('job_wins').select('*').order('created_at', { ascending: false }).limit(3),
    supabase.from('community_posts').select('*').order('created_at', { ascending: false }).limit(3),
  ]);

  if (!winsRes.data?.length) {
    winsEl.innerHTML = '<div class="home-community-empty">No wins yet — be the first!</div>';
  } else {
    winsEl.innerHTML = winsRes.data.map(w => `
      <div class="home-community-item" onclick="switchView('community')">
        <div class="win-avatar" style="width:26px;height:26px;font-size:0.75rem">${w.display_name[0].toUpperCase()}</div>
        <div style="flex:1;min-width:0">
          <div class="home-ci-name">${esc(w.display_name)} <span class="home-ci-meta">got a role at ${esc(w.company)}</span></div>
          ${w.message ? `<div class="home-ci-text">${esc(w.message)}</div>` : ''}
        </div>
        <div class="win-time">${timeAgo(w.created_at)}</div>
      </div>`).join('');
  }

  if (!postsRes.data?.length) {
    postsEl.innerHTML = '<div class="home-community-empty">No posts yet — start the conversation!</div>';
  } else {
    postsEl.innerHTML = postsRes.data.map(p => `
      <div class="home-community-item" onclick="switchView('community')">
        <div class="win-avatar" style="width:26px;height:26px;font-size:0.75rem">${p.display_name[0].toUpperCase()}</div>
        <div style="flex:1;min-width:0">
          <div class="home-ci-name">${esc(p.display_name)} <span class="home-ci-meta">${esc(p.category)}</span></div>
          <div class="home-ci-text">${esc(p.message)}</div>
        </div>
        <div class="win-time">${timeAgo(p.created_at)}</div>
      </div>`).join('');
  }
}

// ══════════════════════════════════════════
// NOTES PANEL
// ══════════════════════════════════════════
function openPanel(id) {
  const j = jobs.find(x => x.id === id); if (!j) return;
  setPanelJobId(id);
  document.getElementById('panel-company').textContent = j.company || '';
  document.getElementById('panel-role').textContent = j.role || '—';
  document.getElementById('panel-notes').value = j.notes || '';
  const stageColor = { Sourced: 'muted', Applied: 'green', Interviewing: 'muted', Offer: 'orange', Rejected: 'muted' };
  document.getElementById('panel-meta').innerHTML = [
    j.stage ? `<span class="tag ${stageColor[j.stage] || 'muted'}" style="${j.stage === 'Interviewing' ? 'background:rgba(124,111,255,0.12);color:var(--accent2);border:1px solid rgba(124,111,255,0.2)' : ''}">${esc(j.stage)}</span>` : '',
    j.area ? `<span class="tag area">${esc(j.area)}</span>` : '',
    j.level ? `<span class="tag green">${esc(j.level)}</span>` : '',
    j.func ? `<span class="tag orange">${esc(j.func)}</span>` : '',
  ].join('');
  renderPanelInterviews(j);
  renderActivity(j);
  document.getElementById('panelOverlay').classList.add('open');
  document.getElementById('notesPanel').classList.add('open');
}

function closePanel() {
  document.getElementById('panelOverlay').classList.remove('open');
  document.getElementById('notesPanel').classList.remove('open');
  setPanelJobId(null);
}

function savePanel() {
  const j = jobs.find(x => x.id === panelJobId); if (!j) return;
  const newNotes = document.getElementById('panel-notes').value.trim();
  if (newNotes !== j.notes) {
    j.notes = newNotes;
    if (!j.activity) j.activity = [];
    j.activity.unshift({ text: 'Notes updated', time: new Date().toISOString() });
  }
  saveJobs(); renderTracker(); showToast('Notes saved');
  renderActivity(j);
}

function renderPanelInterviews(j) {
  const list = document.getElementById('panel-interviews');
  const ivs = j.interviews || [];
  if (!ivs.length) {
    list.innerHTML = '<div style="font-family:\'DM Mono\',monospace;font-size:0.68rem;color:var(--muted);padding:8px 0;text-transform:uppercase;letter-spacing:.3px">No interviews scheduled</div>';
    return;
  }
  list.innerHTML = ivs.map((iv, i) => `
    <div class="interview-item">
      <div class="interview-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
      <div class="interview-info">
        <div class="interview-type">${esc(iv.type || 'Interview')}</div>
        <div class="interview-date">${fmtDateLong(iv.date)}</div>
      </div>
      <button class="interview-del" onclick="removeInterview(${i})" title="Remove"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>`).join('');
}

function fmtDateLong(s) {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function addInterview() {
  const type = document.getElementById('pi-type').value;
  const date = document.getElementById('pi-date').value;
  if (!date) { showToast('Please select a date'); return; }
  const j = jobs.find(x => x.id === panelJobId); if (!j) return;
  if (!j.interviews) j.interviews = [];
  j.interviews.push({ type: type || 'Interview', date });
  j.interviews.sort((a, b) => a.date.localeCompare(b.date));
  if (!j.activity) j.activity = [];
  j.activity.unshift({ text: `${type || 'Interview'} scheduled — ${fmtDateLong(date)}`, time: new Date().toISOString() });
  if (j.stage === 'Sourced' || j.stage === 'Applied') j.stage = 'Interviewing';
  saveJobs();
  document.getElementById('pi-type').value = ''; document.getElementById('pi-date').value = '';
  renderPanelInterviews(j); renderActivity(j); renderTracker();
  showToast('Interview added');
}

function removeInterview(idx) {
  const j = jobs.find(x => x.id === panelJobId); if (!j || !j.interviews) return;
  const removed = j.interviews.splice(idx, 1)[0];
  if (!j.activity) j.activity = [];
  j.activity.unshift({ text: `Removed ${removed.type || 'interview'} — ${fmtDateLong(removed.date)}`, time: new Date().toISOString() });
  saveJobs(); renderPanelInterviews(j); renderActivity(j); renderTracker();
}

function renderActivity(j) {
  const list = document.getElementById('panel-activity');
  const acts = (j.activity || []).slice(0, 12);
  if (!acts.length) {
    list.innerHTML = '<div style="font-family:\'DM Mono\',monospace;font-size:0.68rem;color:var(--muted);padding:8px 0;text-transform:uppercase;letter-spacing:.3px">No activity yet</div>';
    return;
  }
  list.innerHTML = acts.map(a => `
    <div class="activity-item">
      <div class="activity-dot"></div>
      <div><div class="activity-text">${esc(a.text)}</div><div class="activity-time">${fmtRelTime(a.time)}</div></div>
    </div>`).join('');
}

function fmtRelTime(iso) {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ══════════════════════════════════════════
// CSV EXPORT & TRACKER UI
// ══════════════════════════════════════════
function exportCSV() {
  if (!jobs.length) { showToast('No jobs to export'); return; }
  const headers = ['Company', 'Role', 'Stage', 'Priority', 'Therapeutic Area', 'Job Type', 'Level', 'Function', 'Recruiter', 'Careers URL', 'Date Added', 'Next Interview Date', 'Interview Type', 'Notes'];
  const rows = jobs.map(j => {
    const nextIv = j.interviews && j.interviews.length ? j.interviews[0] : null;
    return [
      j.company, j.role, j.stage, j.priority === 'high' ? 'High' : j.priority === 'low' ? 'Low' : 'Medium',
      j.area, j.jobtype, j.level, j.func, j.recruiter, j.url, j.date, nextIv ? nextIv.date : '', nextIv ? nextIv.type : '',
      (j.notes || '').replace(/\n/g, ' ')
    ].map(v => '"' + (String(v || '').replace(/"/g, '""')) + '"');
  });
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `bioboard-${todayStr()}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
  showToast(`Exported ${jobs.length} roles to CSV`);
}

function clearSearchBar() {
  document.getElementById('t-search').value = '';
  ['sb-area', 'sb-level', 'sb-func', 'sb-type'].forEach(id => {
    const el = document.getElementById(id); if (el) { el.value = ''; el.classList.remove('active'); }
  });
  resetTFilters();
  document.getElementById('sb-clear-btn').classList.remove('show');
  renderTracker();
}

function updateClearBtn() {
  const q = document.getElementById('t-search').value;
  const any = q || tFilters.area || tFilters.type || tFilters.level || tFilters.func;
  document.getElementById('sb-clear-btn').classList.toggle('show', !!any);
}

function filteredJobs() {
  const q = document.getElementById('t-search').value.toLowerCase();
  return jobs.filter(j => {
    const mQ = !q || j.company.toLowerCase().includes(q) || j.role.toLowerCase().includes(q) || (j.area || '').toLowerCase().includes(q);
    const mA = !tFilters.area || j.area === tFilters.area;
    const mT = !tFilters.type || j.jobtype === tFilters.type;
    const mL = !tFilters.level || j.level === tFilters.level;
    const mF = !tFilters.func || j.func === tFilters.func || FUNC_GROUP_MAP[j.func] === tFilters.func;
    return mQ && mA && mT && mL && mF;
  });
}

function renderTracker() {
  const vis = filteredJobs();
  STAGES.forEach(s => {
    const items = vis.filter(j => j.stage === s);
    const cntEl = document.getElementById('cnt-' + s);
    if (cntEl) cntEl.textContent = items.length;
    const bodyEl = document.getElementById('body-' + s);
    if (bodyEl) {
      bodyEl.innerHTML = items.length === 0
        ? '<div class="empty-col">No roles</div>' : items.map(j => jobCardHTML(j)).join('');
    }
  });
  updateTrackerStats();
  document.getElementById('tracker-badge').textContent = jobs.length;
}

export function updateJobStage(id, newStage) {
  const j = jobs.find(x => x.id === id);
  if (!j) return;
  const oldStage = j.stage;
  if (oldStage !== newStage) {
    j.stage = newStage;
    if (!j.activity) j.activity = [];
    j.activity.unshift({ text: `Stage changed: ${oldStage} → ${newStage}`, time: new Date().toISOString() });
    saveJobs();
    renderTracker();
  }
}

function jobCardHTML(j) {
  const nextIv = j.interviews && j.interviews.length ? j.interviews[0] : null;
  const ivBadge = nextIv ? `<span class="card-interview-date"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${fmtDate(nextIv.date)}</span>` : '';
  return `<div class="job-card pri-${j.priority || 'med'}" id="card-${j.id}" onclick="openPanel('${j.id}')" style="cursor:pointer">
    <div class="card-company">${esc(j.company)}</div>
    <div class="card-role">${esc(j.role || '—')}</div>
    <div class="card-tags">
      ${j.area ? `<span class="tag area">${esc(j.area)}</span>` : ''}
      ${j.level ? `<span class="tag green">${esc(j.level)}</span>` : ''}
      ${j.func ? `<span class="tag orange">${esc(j.func)}</span>` : ''}
      ${j.jobtype ? `<span class="tag muted">${esc(j.jobtype)}</span>` : ''}
      ${ivBadge}
    </div>
    ${j.notes ? `<div class="card-notes">${esc(j.notes)}</div>` : ''}
    <div class="card-footer">
      <span class="card-date">${fmtDate(j.date)}</span>
      <div class="card-actions">
        <a class="card-btn site" href="${esc(j.url || '#')}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="Open careers page"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Careers</a>
        <select class="card-btn" style="background: transparent; outline: none; appearance: none; cursor: pointer; color: var(--soft);" onclick="event.stopPropagation()" onchange="event.stopPropagation(); updateJobStage('${j.id}', this.value)">
          ${STAGES.map(s => `<option value="${s}" ${s === j.stage ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <button class="card-btn edit" onclick="event.stopPropagation();editJob('${j.id}')" title="Edit"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="card-btn del" onclick="event.stopPropagation();deleteJob('${j.id}')" title="Remove"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>
      </div>
    </div>
  </div>`;
}

function updateTrackerStats() {
  document.getElementById('stat-applied').textContent = `${jobs.filter(j => j.stage === 'Applied').length} Applied`;
  document.getElementById('stat-int').textContent = `${jobs.filter(j => j.stage === 'Interviewing').length} Interviewing`;
  document.getElementById('stat-offers').textContent = `${jobs.filter(j => j.stage === 'Offer').length} Offers`;
}

// ══════════════════════════════════════════
// MODAL FORMS
// ══════════════════════════════════════════
function openModal(reset = true) {
  if (reset) {
    setEditId(null); document.getElementById('modalTitle').textContent = 'Add Role';
    ['f-company', 'f-role', 'f-url', 'f-recruiter', 'f-notes', 'f-area', 'f-jobtype', 'f-level', 'f-func', 'f-intdate', 'f-inttype'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('f-stage').value = 'Sourced'; document.getElementById('f-priority').value = 'med';
  }
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); }

function editJob(id) {
  const j = jobs.find(x => x.id === id); if (!j) return;
  setEditId(id); document.getElementById('modalTitle').textContent = 'Edit Role';
  document.getElementById('f-company').value = j.company || ''; document.getElementById('f-role').value = j.role || '';
  document.getElementById('f-url').value = j.url || ''; document.getElementById('f-area').value = j.area || '';
  document.getElementById('f-jobtype').value = j.jobtype || ''; document.getElementById('f-level').value = j.level || '';
  document.getElementById('f-func').value = j.func || ''; document.getElementById('f-stage').value = j.stage || 'Sourced';
  document.getElementById('f-priority').value = j.priority || 'med'; document.getElementById('f-recruiter').value = j.recruiter || '';
  document.getElementById('f-notes').value = j.notes || '';
  const nextIv = j.interviews && j.interviews.length ? j.interviews[0] : null;
  document.getElementById('f-intdate').value = nextIv ? nextIv.date : ''; document.getElementById('f-inttype').value = nextIv ? nextIv.type : '';
  openModal(false);
}

function saveJob() {
  const company = document.getElementById('f-company').value.trim(); const role = document.getElementById('f-role').value.trim();
  if (!company || !role) { alert('Company and role are required.'); return; }
  const intDate = document.getElementById('f-intdate').value; const intType = document.getElementById('f-inttype').value;
  const data = {
    company, role, url: document.getElementById('f-url').value.trim(), area: document.getElementById('f-area').value,
    jobtype: document.getElementById('f-jobtype').value, level: document.getElementById('f-level').value,
    func: document.getElementById('f-func').value, stage: document.getElementById('f-stage').value,
    priority: document.getElementById('f-priority').value, recruiter: document.getElementById('f-recruiter').value.trim(),
    notes: document.getElementById('f-notes').value.trim(),
  };
  if (editId) {
    const j = jobs.find(x => x.id === editId);
    if (j) {
      const oldStage = j.stage; Object.assign(j, data);
      if (!j.activity) j.activity = [];
      if (oldStage !== data.stage) j.activity.unshift({ text: `Stage changed: ${oldStage} → ${data.stage}`, time: new Date().toISOString() });
      if (intDate) {
        if (!j.interviews) j.interviews = [];
        if (!j.interviews.find(iv => iv.date === intDate && iv.type === (intType || 'Interview'))) {
          j.interviews.push({ type: intType || 'Interview', date: intDate });
          j.interviews.sort((a, b) => a.date.localeCompare(b.date));
          j.activity.unshift({ text: `${intType || 'Interview'} scheduled — ${fmtDateLong(intDate)}`, time: new Date().toISOString() });
        }
      }
    }
  } else {
    const newJob = { id: uid(), date: todayStr(), interviews: [], activity: [], ...data };
    if (intDate) {
      newJob.interviews.push({ type: intType || 'Interview', date: intDate });
      newJob.activity.push({ text: `Role added — ${intType || 'Interview'} on ${fmtDateLong(intDate)}`, time: new Date().toISOString() });
    } else {
      newJob.activity.push({ text: 'Role added to pipeline', time: new Date().toISOString() });
    }
    jobs.push(newJob);
  }
  saveJobs(); closeModal(); renderTracker();
}

function deleteJob(id) {
  if (!confirm('Remove this role?')) return;
  setJobs(jobs.filter(x => x.id !== id));
  saveJobs(); renderTracker(); renderCompanyIntelligence();
}

// ══════════════════════════════════════════
// COMPANY LIBRARY / INTELLIGENCE
// ══════════════════════════════════════════
let starredCos = new Set(JSON.parse(localStorage.getItem('rxp-starred-cos') || '[]'));
let libView = 'grid';

export function toggleStar(companyName) {
  if (starredCos.has(companyName)) starredCos.delete(companyName);
  else starredCos.add(companyName);
  localStorage.setItem('rxp-starred-cos', JSON.stringify([...starredCos]));
  renderCompanyIntelligence();
  
  FETCH_COMPANIES.sort((a, b) => {
    const aStar = starredCos.has(a.name) ? 1 : 0;
    const bStar = starredCos.has(b.name) ? 1 : 0;
    if (aStar !== bStar) return bStar - aStar;
    return a.name.localeCompare(b.name);
  });
  buildCompanyCheckboxes();
}

export function renderCompanyIntelligence() {
  const container = document.getElementById('lib-container');
  if (!container) return;

  const counts = {};
  all_jobs.forEach(j => { counts[j.company] = (counts[j.company] || 0) + 1; });

  const q = (document.getElementById('l-search')?.value || '').toLowerCase();

  let list = FETCH_COMPANIES.map(c => {
    return { name: c.name, count: counts[c.name] || 0 };
  });

  if (q) list = list.filter(c => c.name.toLowerCase().includes(q));

  list.sort((a, b) => {
    const aStar = starredCos.has(a.name) ? 1 : 0;
    const bStar = starredCos.has(b.name) ? 1 : 0;
    if (aStar !== bStar) return bStar - aStar;
    if (b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name);
  });

  const cntEl = document.getElementById('l-count');
  if (cntEl) cntEl.textContent = list.length + ' companies';

  if (list.length === 0) { container.innerHTML = '<div style="padding:60px;text-align:center;font-family:DM Mono,monospace;font-size:0.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">No companies match your search</div>'; return; }

  const fetchStr = all_jobs.length > 0 ? new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never';

  const groups = [...new Set(FETCH_COMPANIES.map(c => c.group))];
  const byGroup = Object.fromEntries(groups.map(g => [g, []]));
  list.forEach(c => {
    const co = FETCH_COMPANIES.find(f => f.name === c.name);
    const grp = co?.group || 'Other';
    if (!byGroup[grp]) byGroup[grp] = [];
    byGroup[grp].push(c);
  });

  container.innerHTML = groups.filter(g => byGroup[g]?.length).map(g => `
    <div class="lib-group-header">${esc(g)}</div>
    <div class="company-grid lib-group-grid">${byGroup[g].map(c => {
      const starred = starredCos.has(c.name);
      return `<div class="co-card" style="position:relative;">
      <div class="co-card-inner">
        <div class="co-avatar" style="background:${starred ? '#ffcc00' : 'var(--border)'}; color:${starred ? '#000' : '#fff'}; width:40px; height:40px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:1.1rem; flex-shrink:0;">
          ${c.name.charAt(0)}
        </div>
        <div style="flex:1;min-width:0;margin-left:12px;">
          <div class="co-name" style="display:flex;justify-content:space-between;align-items:center;font-weight:600;color:var(--text);font-size:1rem;">
            ${esc(c.name)}
            <button onclick="toggleStar('${esc(c.name).replace(/'/g, "\\'")}')" style="background:none;border:none;cursor:pointer;color:${starred ? '#ffcc00' : 'var(--muted)'};padding:0;display:flex;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${starred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </button>
          </div>
          <div class="co-hq" style="color:var(--accent2);font-weight:500;margin-top:4px;font-size:0.8rem;">${c.count.toLocaleString()} Active Roles</div>
        </div>
      </div>
      <div class="co-desc" style="font-size:0.75rem; color:var(--muted); margin-top:16px; border-top:1px solid var(--border); padding-top:12px;">
        Last Fetched: ${fetchStr}
      </div>
      ${(() => {
        const coNews = newsArticles.filter(a => a._cos && a._cos.includes(c.name)).slice(0, 3);
        if (!coNews.length) return '';
        return `<div class="co-news">
          <div class="co-news-label">Recent News</div>
          ${coNews.map(a => `<a class="co-news-item" href="${esc(a.url)}" target="_blank" rel="noopener">
            <span class="co-news-src">${esc(a.source)}</span>
            <span class="co-news-title">${esc(a.title)}</span>
          </a>`).join('')}
        </div>`;
      })()}
      <div class="co-actions" style="margin-top:12px;">
        <a class="btn-visit" href="https://careers.${c.name.toLowerCase().replace(/[\s&]/g, '')}.com" target="_blank" rel="noopener" style="width:100%;justify-content:center;padding:8px 12px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text);text-decoration:none;font-weight:500;font-size:0.8rem;display:flex;align-items:center;gap:6px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Careers Site
        </a>
      </div>
    </div>`;
    }).join('')}</div>`).join('');

  return; // grouped rendering done, skip old single-pass below
  container.innerHTML = list.map(c => {
    const starred = starredCos.has(c.name);
    return `<div class="co-card" style="position:relative;">
      <div class="co-card-inner">
        <div class="co-avatar" style="background:${starred ? '#ffcc00' : 'var(--border)'}; color:${starred ? '#000' : '#fff'}; width:40px; height:40px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:1.1rem; flex-shrink:0;">
          ${c.name.charAt(0)}
        </div>
        <div style="flex:1;min-width:0;margin-left:12px;">
          <div class="co-name" style="display:flex;justify-content:space-between;align-items:center;font-weight:600;color:var(--text);font-size:1rem;">
            ${esc(c.name)}
            <button onclick="toggleStar('${esc(c.name).replace(/'/g, "\\'")}')" style="background:none;border:none;cursor:pointer;color:${starred ? '#ffcc00' : 'var(--muted)'};padding:0;display:flex;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${starred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </button>
          </div>
          <div class="co-hq" style="color:var(--accent2);font-weight:500;margin-top:4px;font-size:0.8rem;">${c.count.toLocaleString()} Active Roles</div>
        </div>
      </div>
      <div class="co-desc" style="font-size:0.75rem; color:var(--muted); margin-top:16px; border-top:1px solid var(--border); padding-top:12px;">
        Last Fetched: ${fetchStr}
      </div>
      <div class="co-actions" style="margin-top:12px;">
        <a class="btn-visit" href="https://careers.${c.name.toLowerCase().replace(/[\s&]/g, '')}.com" target="_blank" rel="noopener" style="width:100%;justify-content:center;padding:8px 12px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text);text-decoration:none;font-weight:500;font-size:0.8rem;display:flex;align-items:center;gap:6px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Careers Site
        </a>
      </div>
    </div>`;
  }).join('');
}

const renderLibrary = renderCompanyIntelligence;

function setLibView(mode) {
  libView = mode; document.getElementById('lib-container').className = mode === 'grid' ? 'company-grid' : 'company-list';
  document.getElementById('vbtn-grid').classList.toggle('active', mode === 'grid'); document.getElementById('vbtn-list').classList.toggle('active', mode === 'list');
}

let currentLibTab = 'companies';
function switchLibTab(tab) {
  currentLibTab = tab; document.getElementById('subtab-companies').classList.toggle('active', tab === 'companies'); document.getElementById('subtab-roles').classList.toggle('active', tab === 'roles');
  document.getElementById('lib-panel-companies').style.display = tab === 'companies' ? '' : 'none'; document.getElementById('lib-panel-roles').style.display = tab === 'roles' ? '' : 'none';
}

// ══════════════════════════════════════════
// LIVE ROLES UI HELPERS

// City → State lookup for major US pharma hubs
const CITY_STATE = {
  // ── Massachusetts ──
  'Boston':'Massachusetts','Cambridge':'Massachusetts','Waltham':'Massachusetts',
  'Lexington':'Massachusetts','Watertown':'Massachusetts','Needham':'Massachusetts',
  'Norwood':'Massachusetts','Andover':'Massachusetts','North Andover':'Massachusetts',
  'Woburn':'Massachusetts','Wilmington':'Massachusetts','Burlington':'Massachusetts',
  'Bedford':'Massachusetts','Billerica':'Massachusetts','Chelmsford':'Massachusetts',
  'Lowell':'Massachusetts','Framingham':'Massachusetts','Marlborough':'Massachusetts',
  'Westborough':'Massachusetts','Shrewsbury':'Massachusetts','Worcester':'Massachusetts',
  'Southborough':'Massachusetts','Natick':'Massachusetts','Wellesley':'Massachusetts',
  'Newton':'Massachusetts','Quincy':'Massachusetts','Braintree':'Massachusetts',
  // ── New Jersey ──
  'Kenilworth':'New Jersey','Rahway':'New Jersey','Whitehouse Station':'New Jersey',
  'West Point':'New Jersey','Titusville':'New Jersey','Raritan':'New Jersey',
  'New Brunswick':'New Jersey','Princeton':'New Jersey','Hopewell':'New Jersey',
  'Bridgewater':'New Jersey','Parsippany':'New Jersey','Whippany':'New Jersey',
  'Madison':'New Jersey','Morristown':'New Jersey','Florham Park':'New Jersey',
  'Bedminster':'New Jersey','Basking Ridge':'New Jersey','Warren':'New Jersey',
  'Murray Hill':'New Jersey','Summit':'New Jersey','South Plainfield':'New Jersey',
  'Franklin Lakes':'New Jersey','Rockaway':'New Jersey','Plainsboro':'New Jersey',
  'East Hanover':'New Jersey','South Brunswick':'New Jersey','Piscataway':'New Jersey',
  'Cranbury':'New Jersey','Pennington':'New Jersey','Trenton':'New Jersey',
  'Cherry Hill':'New Jersey','Mount Laurel':'New Jersey','Marlton':'New Jersey',
  // ── New York ──
  'Tarrytown':'New York','Pearl River':'New York','Sleepy Hollow':'New York',
  'New York':'New York','New York City':'New York','NYC':'New York',
  'Peekskill':'New York','Yonkers':'New York','White Plains':'New York',
  'Rye':'New York','Armonk':'New York','Hawthorne':'New York',
  'Suffern':'New York','Orangeburg':'New York','Mineola':'New York',
  'Melville':'New York','Hauppauge':'New York','Stony Brook':'New York',
  'Brooklyn':'New York','Queens':'New York','Manhattan':'New York','Bronx':'New York',
  'Buffalo':'New York','Rochester':'New York','Albany':'New York','Syracuse':'New York',
  // ── Pennsylvania ──
  'Horsham':'Pennsylvania','Spring House':'Pennsylvania','Upper Gwynedd':'Pennsylvania',
  'North Wales':'Pennsylvania','Lansdale':'Pennsylvania','Philadelphia':'Pennsylvania',
  'Collegeville':'Pennsylvania','King of Prussia':'Pennsylvania','Radnor':'Pennsylvania',
  'Wayne':'Pennsylvania','Malvern':'Pennsylvania','West Chester':'Pennsylvania',
  'Conshohocken':'Pennsylvania','Upper Merion':'Pennsylvania','Fort Washington':'Pennsylvania',
  'Blue Bell':'Pennsylvania','Audubon':'Pennsylvania','Ambler':'Pennsylvania',
  'Frazer':'Pennsylvania','Exton':'Pennsylvania','Berwyn':'Pennsylvania',
  'Phoenixville':'Pennsylvania','Pottstown':'Pennsylvania','Norristown':'Pennsylvania',
  'Pittsburgh':'Pennsylvania','Allentown':'Pennsylvania','Bethlehem':'Pennsylvania',
  // ── Illinois ──
  'North Chicago':'Illinois','Lake County':'Illinois','Abbott Park':'Illinois',
  'Deerfield':'Illinois','Mettawa':'Illinois','Libertyville':'Illinois',
  'Mundelein':'Illinois','Waukegan':'Illinois','Gurnee':'Illinois',
  'Bannockburn':'Illinois','Lincolnshire':'Illinois','Buffalo Grove':'Illinois',
  'Northbrook':'Illinois','Glenview':'Illinois','Skokie':'Illinois',
  'Evanston':'Illinois','Schaumburg':'Illinois','Rosemont':'Illinois',
  'Oak Brook':'Illinois','Lombard':'Illinois','Naperville':'Illinois',
  'Bolingbrook':'Illinois','Chicago':'Illinois','Romeoville':'Illinois',
  // ── California ──
  'South San Francisco':'California','San Francisco':'California','Brisbane':'California',
  'San Carlos':'California','Redwood City':'California','Menlo Park':'California',
  'Palo Alto':'California','Mountain View':'California','Sunnyvale':'California',
  'Santa Clara':'California','San Jose':'California','Pleasanton':'California',
  'Dublin':'California','Emeryville':'California','Oakland':'California',
  'Berkeley':'California','Foster City':'California','Burlingame':'California',
  'San Mateo':'California','Hayward':'California','Fremont':'California',
  'Thousand Oaks':'California','Newbury Park':'California','Camarillo':'California',
  'Simi Valley':'California','Westlake Village':'California','Irvine':'California',
  'San Diego':'California','San Diego County':'California','San Diego, CA':'California',
  'La Jolla':'California','Carlsbad':'California',
  'Oceanside':'California','Escondido':'California','Vista':'California',
  'San Marcos':'California','Solana Beach':'California','Del Mar':'California',
  'Los Angeles':'California','Santa Monica':'California','El Segundo':'California',
  'Torrance':'California','Long Beach':'California','Anaheim':'California',
  'Sacramento':'California','Davis':'California','Vacaville':'California',
  // ── Maryland ──
  'Gaithersburg':'Maryland','Rockville':'Maryland','Bethesda':'Maryland',
  'Silver Spring':'Maryland','Germantown':'Maryland','Hanover':'Maryland',
  'Hunt Valley':'Maryland','Owings Mills':'Maryland','Baltimore':'Maryland',
  'Beltsville':'Maryland','Laurel':'Maryland','Columbia':'Maryland',
  // ── North Carolina ──
  'Research Triangle Park':'North Carolina','Durham':'North Carolina',
  'Morrisville':'North Carolina','Cary':'North Carolina','Raleigh':'North Carolina',
  'Chapel Hill':'North Carolina','Mebane':'North Carolina','Pittsboro':'North Carolina',
  'Sanford':'North Carolina','Wilson':'North Carolina','Greensboro':'North Carolina',
  // ── Connecticut ──
  'Groton':'Connecticut','New Haven':'Connecticut','Stamford':'Connecticut',
  'Shelton':'Connecticut','Branford':'Connecticut','Guilford':'Connecticut',
  'Wallingford':'Connecticut','Meriden':'Connecticut','Hartford':'Connecticut',
  'Mystic':'Connecticut','New London':'Connecticut','Waterford':'Connecticut',
  // ── Delaware ──
  'Wilmington':'Delaware','Newark':'Delaware','Middletown':'Delaware',
  // ── Indiana ──
  'Indianapolis':'Indiana','Carmel':'Indiana','Fishers':'Indiana',
  'Bloomington':'Indiana','West Lafayette':'Indiana',
  // ── Washington ──
  'Seattle':'Washington','Bothell':'Washington','Redmond':'Washington',
  'Bellevue':'Washington','Kirkland':'Washington','Tacoma':'Washington',
  'Spokane':'Washington','Olympia':'Washington',
  // ── Georgia ──
  'Atlanta':'Georgia','Alpharetta':'Georgia','Tucker':'Georgia',
  'Smyrna':'Georgia','Marietta':'Georgia','Kennesaw':'Georgia',
  'Peachtree City':'Georgia','Augusta':'Georgia',
  // ── Minnesota ──
  'Minneapolis':'Minnesota','St. Paul':'Minnesota','Saint Paul':'Minnesota',
  'Bloomington':'Minnesota','Plymouth':'Minnesota','Minnetonka':'Minnesota',
  'Maple Grove':'Minnesota','Eden Prairie':'Minnesota','Eagan':'Minnesota',
  // ── Texas ──
  'Houston':'Texas','Dallas':'Texas','Austin':'Texas','San Antonio':'Texas',
  'Plano':'Texas','Irving':'Texas','Fort Worth':'Texas','Arlington':'Texas',
  'Sugar Land':'Texas','The Woodlands':'Texas','Round Rock':'Texas',
  // ── Florida ──
  'Miami':'Florida','Miramar':'Florida','Weston':'Florida','Boca Raton':'Florida',
  'Orlando':'Florida','Tampa':'Florida','Jacksonville':'Florida','Gainesville':'Florida',
  'Sunrise':'Florida','Pembroke Pines':'Florida','Hollywood':'Florida',
  // ── Colorado ──
  'Denver':'Colorado','Boulder':'Colorado','Longmont':'Colorado',
  'Englewood':'Colorado','Greenwood Village':'Colorado','Aurora':'Colorado',
  'Westminster':'Colorado','Broomfield':'Colorado','Loveland':'Colorado',
  // ── Ohio ──
  'Cincinnati':'Ohio','Columbus':'Ohio','Cleveland':'Ohio',
  'Beachwood':'Ohio','Brecksville':'Ohio','Dublin':'Ohio',
  'Maumee':'Ohio','Toledo':'Ohio','Akron':'Ohio','Dayton':'Ohio',
  // ── Wisconsin ──
  'Middleton':'Wisconsin','Madison':'Wisconsin','Milwaukee':'Wisconsin',
  'Waukesha':'Wisconsin','Racine':'Wisconsin','Kenosha':'Wisconsin',
  // ── Tennessee ──
  'Nashville':'Tennessee','Memphis':'Tennessee','Brentwood':'Tennessee',
  'Franklin':'Tennessee','Knoxville':'Tennessee',
  // ── Missouri ──
  'St. Louis':'Missouri','Saint Louis':'Missouri','Kansas City':'Missouri',
  'Chesterfield':'Missouri','Creve Coeur':'Missouri',
  // ── Michigan ──
  'Ann Arbor':'Michigan','Detroit':'Michigan','Kalamazoo':'Michigan',
  'Grand Rapids':'Michigan','Midland':'Michigan','Portage':'Michigan',
  // ── Arizona ──
  'Phoenix':'Arizona','Scottsdale':'Arizona','Tempe':'Arizona',
  'Tucson':'Arizona','Chandler':'Arizona','Gilbert':'Arizona','Mesa':'Arizona',
  // ── Oregon ──
  'Portland':'Oregon','Hillsboro':'Oregon','Beaverton':'Oregon',
  'Lake Oswego':'Oregon','Tigard':'Oregon',
  // ── Utah ──
  'Salt Lake City':'Utah','South Jordan':'Utah','Sandy':'Utah','Provo':'Utah',
  // ── Virginia ──
  'McLean':'Virginia','Tysons':'Virginia','Reston':'Virginia',
  'Herndon':'Virginia','Arlington':'Virginia','Alexandria':'Virginia',
  'Richmond':'Virginia','Charlottesville':'Virginia',
  // ── Kansas ──
  'Overland Park':'Kansas','Lenexa':'Kansas','Kansas City':'Kansas',
  // ── Kentucky ──
  'Louisville':'Kentucky','Lexington':'Kentucky','Covington':'Kentucky',
  // ── New Jersey (additional) ──
  'Morris Plains':'New Jersey','Parsippany-Troy Hills':'New Jersey',
  'Hanover':'New Jersey','Cedar Knolls':'New Jersey','Mine Hill':'New Jersey',
  // ── Florida (additional) ──
  'Winter Park':'Florida','Deerfield Beach':'Florida','Ponte Vedra':'Florida',
  'Lake Mary':'Florida','Altamonte Springs':'Florida','Sanford':'Florida',
  // ── Texas (additional) ──
  'Denton':'Texas','Frisco':'Texas','McKinney':'Texas','Allen':'Texas',
  'Lewisville':'Texas','Flower Mound':'Texas','Southlake':'Texas',
  'Grapevine':'Texas','Coppell':'Texas','Mansfield':'Texas',
  // ── California (additional) ──
  'Pleasanton':'California','Petaluma':'California','Novato':'California',
  'San Rafael':'California','Larkspur':'California','Mill Valley':'California',
  // ── Pennsylvania (additional) ──
  'Lansdale':'Pennsylvania','Gwynedd':'Pennsylvania','Kulpsville':'Pennsylvania',
};

// Build lowercase version for case-insensitive lookup
const CITY_STATE_LC = Object.fromEntries(Object.entries(CITY_STATE).map(([k,v]) => [k.toLowerCase(), v]));

// Abbr → full state name map
const STATE_ABBR_TO_NAME = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',
  CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',
  IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',
  ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',
  MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',
  NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',
  ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',
  RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',
  UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',
  WI:'Wisconsin',WY:'Wyoming',DC:'District of Columbia',PR:'Puerto Rico',
};

export function inferState(location) {
  if (!location) return '';
  const l = location.trim().replace(/\s*[–—]\s*/g, ' - ');

  // Bare US designations → "Nationwide"
  if (/^(us|usa|united states|u\.s\.a?\.?)$/i.test(l.replace(/[,.\s]+$/, ''))) return 'Nationwide';

  // 0. Parenthetical format: "Cambridge (USA)", "East Hanover (New Jersey)", "Watertown (Massachusetts)"
  //    → check content in parens for state name, and city before parens via city lookup
  const parenMatch = l.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    const cityPart  = parenMatch[1].trim();
    const parenPart = parenMatch[2].trim();
    // Check if paren content is a state name
    if (US_STATE_NAMES.has(parenPart)) return parenPart;
    if (STATE_NAMES_LC.has(parenPart.toLowerCase())) {
      for (const s of US_STATE_NAMES) { if (s.toLowerCase() === parenPart.toLowerCase()) return s; }
    }
    const parenUp = parenPart.toUpperCase().replace(/[^A-Z]/g, '');
    if (STATE_ABBR_TO_NAME[parenUp]) return STATE_ABBR_TO_NAME[parenUp];
    // Otherwise look up the city part
    const cityResult = CITY_STATE_LC[cityPart.toLowerCase()];
    if (cityResult) return cityResult;
  }

  // Helper: check a single token against abbr map and full state names
  function checkToken(t) {
    if (!t) return '';
    const up = t.toUpperCase().replace(/[^A-Z]/g, '');  // strip digits/punct
    if (STATE_ABBR_TO_NAME[up]) return STATE_ABBR_TO_NAME[up];
    const lc = t.toLowerCase().trim();
    if (US_STATE_NAMES.has(t.trim())) return t.trim();
    if (STATE_NAMES_LC.has(lc)) {
      for (const s of US_STATE_NAMES) { if (s.toLowerCase() === lc) return s; }
    }
    return '';
  }

  // 1. Comma-separated parts: "City, ST, Country" or "City, ST"
  const parts = l.split(',').map(p => p.trim());
  for (const p of parts) {
    const r = checkToken(p);
    if (r) return r;
  }

  // 2. Dash-separated: "City - ST - US" or "AbbVie - IL - US"
  const segs = l.split(' - ').map(s => s.trim());
  for (const s of segs) {
    const r = checkToken(s);
    if (r) return r;
  }

  // 3. Space-separated words — catches "North Chicago IL" or "Glenview IL 60025"
  const words = l.split(/[\s,]+/);
  for (const w of words) {
    const up = w.toUpperCase().replace(/[^A-Z]/g, '');
    if (up.length === 2 && STATE_ABBR_TO_NAME[up]) return STATE_ABBR_TO_NAME[up];
  }

  // 4. City lookup — case-insensitive, tries each comma part, dash segment, and bare location
  const cityLookup = (s) => CITY_STATE_LC[s.toLowerCase().trim()] || '';
  for (const p of parts) {
    const r = cityLookup(p);
    if (r) return r;
  }
  for (const s of segs) {
    const r = cityLookup(s);
    if (r) return r;
  }
  // Try full string in case there are no commas or dashes
  const r = cityLookup(l);
  if (r) return r;

  // All segments are just US/country designations with no state → Nationwide
  const nonUsSegs = segs.filter(s => !/^(us|usa|united states|u\.s\.a?\.?|american?)$/i.test(s));
  if (segs.length > 1 && nonUsSegs.length === 0) return 'Nationwide';

  return '';
}

// ══════════════════════════════════════════
export function buildFilters() {
  const companies = [...new Set(all_jobs.map(j => j.company).filter(Boolean))].sort();
  const rawCountries = all_jobs.map(j => j._country || inferCountry(j.location || '')).filter(Boolean);
  const countrySet = [...new Set(rawCountries)];
  const hasMultiple   = countrySet.includes('Multiple');
  const hasRemote     = countrySet.includes('Remote');
  const hasFieldBased = countrySet.includes('Field Based');
  const hasOther = all_jobs.some(j => !(j._country || inferCountry(j.location || '')));
  const countries = countrySet.filter(c => c !== 'Multiple' && c !== 'Remote' && c !== 'Field Based').sort();
  if (hasFieldBased) countries.push('Field Based');
  if (hasRemote) countries.push('Remote');
  if (hasMultiple) countries.push('Multiple');
  if (hasOther) countries.push('Other (unclassified)');
  const presentFuncs = new Set(all_jobs.map(j => inferFunc(j.title, j.dept || '')).filter(Boolean));
  const funcOptgroups = FUNC_GROUPS
    .filter(g => g.items.some(i => presentFuncs.has(i)) || presentFuncs.has(g.group))
    .map(g => {
      const regularItems = g.items.filter(i => presentFuncs.has(i) && !i.startsWith('Other /'));
      const otherItem    = g.items.find(i => i.startsWith('Other /') && presentFuncs.has(i));
      const otherOption  = otherItem ? `<option value="${esc(otherItem)}">Other</option>` : '';
      return `<optgroup label="${esc(g.group)}"><option value="${esc(g.group)}">— All ${esc(g.group)} —</option>${regularItems.map(i => `<option value="${esc(i)}">${esc(i)}</option>`).join('')}${otherOption}</optgroup>`;
    }).join('');
  // Build state list from US jobs
  const usJobs = all_jobs.filter(j => (j._country || inferCountry(j.location || '')) === 'United States');
  const allStates     = usJobs.map(j => inferState(j.location || '')).filter(Boolean);
  const hasNationwide = allStates.includes('Nationwide');
  const hasNoState    = usJobs.some(j => !inferState(j.location || ''));
  const stateSet      = [...new Set(allStates.filter(s => s !== 'Nationwide'))].sort();

  document.getElementById('r-company').innerHTML = '<option value="">All Companies</option>' + companies.map(d => `<option>${esc(d)}</option>`).join('');
  document.getElementById('r-func').innerHTML = '<option value="">All Functions</option>' + funcOptgroups + (presentFuncs.has('Other') ? '<option value="Other">Other</option>' : '');
  document.getElementById('r-loc').innerHTML = '<option value="">All Countries</option>' + countries.map(c => `<option>${esc(c)}</option>`).join('');
  document.getElementById('r-state').innerHTML = '<option value="">All States</option>' +
    stateSet.map(s => `<option>${esc(s)}</option>`).join('') +
    (hasNationwide ? '<option value="Nationwide">Nationwide (no specific state)</option>' : '') +
    (hasNoState    ? '<option value="__nostate__">Other (no state)</option>' : '');
  document.getElementById('roles-filters').style.display = 'flex';
}

export function parsePostedDate(posted) {
  if (!posted) return 0;
  const p = posted.toLowerCase().trim();
  if (p === 'today' || p === 'just posted') return Date.now();
  const ago = p.match(/(\d+)\s*(hour|day|week|month)s?\s*ago/);
  if (ago) {
    const n = parseInt(ago[1]);
    const ms = { hour: 3600000, day: 86400000, week: 604800000, month: 2592000000 }[ago[2]];
    return Date.now() - n * ms;
  }
  const d = new Date(posted);
  return isNaN(d) ? 0 : d.getTime();
}

// ── Country inference ────────────────────────────────────────────────────────

const COUNTRY_ALIASES = {
  // Common uppercase aliases / abbreviations
  'US':'United States','USA':'United States','U.S.A.':'United States','U.S.':'United States',
  'UK':'United Kingdom','U.K.':'United Kingdom','GB':'United Kingdom','Great Britain':'United Kingdom',
  'England':'United Kingdom','Scotland':'United Kingdom','Wales':'United Kingdom','Northern Ireland':'United Kingdom',
  'UAE':'United Arab Emirates','KSA':'Saudi Arabia',
  'Holland':'Netherlands','The Netherlands':'Netherlands',
  'Republic of Ireland':'Ireland','Eire':'Ireland',
  'Czechia':'Czech Republic','Türkiye':'Turkey',
  'United States of America':'United States',
  // Lowercase ISO-2 codes returned by SmartRecruiters
  'us':'United States','gb':'United Kingdom','uk':'United Kingdom',
  'de':'Germany','fr':'France','ch':'Switzerland','jp':'Japan',
  'cn':'China','in':'India','ca':'Canada','au':'Australia',
  'nl':'Netherlands','be':'Belgium','se':'Sweden','dk':'Denmark',
  'no':'Norway','fi':'Finland','es':'Spain','it':'Italy',
  'ie':'Ireland','at':'Austria','pl':'Poland','hu':'Hungary',
  'cz':'Czech Republic','sk':'Slovakia','ro':'Romania','bg':'Bulgaria',
  'gr':'Greece','pt':'Portugal','hr':'Croatia','rs':'Serbia',
  'si':'Slovenia','sg':'Singapore','kr':'South Korea','tw':'Taiwan',
  'hk':'Hong Kong','il':'Israel','tr':'Turkey','za':'South Africa',
  'br':'Brazil','mx':'Mexico','ar':'Argentina','co':'Colombia',
  'cl':'Chile','pe':'Peru','ru':'Russia','ua':'Ukraine',
  'pk':'Pakistan','bd':'Bangladesh','ph':'Philippines','my':'Malaysia',
  'id':'Indonesia','th':'Thailand','vn':'Vietnam',
  'sa':'Saudi Arabia','ae':'United Arab Emirates','eg':'Egypt',
  'ke':'Kenya','ng':'Nigeria','ma':'Morocco',
  'nz':'New Zealand','lu':'Luxembourg','is':'Iceland',
  'ee':'Estonia','lv':'Latvia','lt':'Lithuania','mt':'Malta',
  'cy':'Cyprus','jo':'Jordan','lb':'Lebanon','kw':'Kuwait',
  'qa':'Qatar','bh':'Bahrain','om':'Oman','iq':'Iraq',
  'pr':'Puerto Rico','cr':'Costa Rica','pa':'Panama',
  'gt':'Guatemala','do':'Dominican Republic','ec':'Ecuador',
  'uy':'Uruguay','py':'Paraguay','bo':'Bolivia','ve':'Venezuela',
  'lk':'Sri Lanka','np':'Nepal','mm':'Myanmar','kh':'Cambodia',
  'az':'Azerbaijan','ge':'Georgia','am':'Armenia','kz':'Kazakhstan',
  'uz':'Uzbekistan','by':'Belarus','md':'Moldova','al':'Albania',
  'ba':'Bosnia and Herzegovina','mk':'North Macedonia','me':'Montenegro',
  'xk':'Kosovo',
  // ISO-3 codes used by Workday (e.g. Merck: "USA - NJ - Rahway", "MYS - Selangor - ...")
  'USA':'United States','GBR':'United Kingdom','DEU':'Germany','FRA':'France',
  'CHE':'Switzerland','JPN':'Japan','CHN':'China','IND':'India',
  'CAN':'Canada','AUS':'Australia','NLD':'Netherlands','BEL':'Belgium',
  'SWE':'Sweden','DNK':'Denmark','NOR':'Norway','FIN':'Finland',
  'ESP':'Spain','ITA':'Italy','IRL':'Ireland','AUT':'Austria',
  'POL':'Poland','HUN':'Hungary','CZE':'Czech Republic','SVK':'Slovakia',
  'ROU':'Romania','BGR':'Bulgaria','GRC':'Greece','PRT':'Portugal',
  'HRV':'Croatia','SRB':'Serbia','SVN':'Slovenia','SGP':'Singapore',
  'KOR':'South Korea','TWN':'Taiwan','HKG':'Hong Kong','ISR':'Israel',
  'TUR':'Turkey','ZAF':'South Africa','BRA':'Brazil','MEX':'Mexico',
  'ARG':'Argentina','COL':'Colombia','CHL':'Chile','PER':'Peru',
  'RUS':'Russia','UKR':'Ukraine','PAK':'Pakistan','BGD':'Bangladesh',
  'PHL':'Philippines','MYS':'Malaysia','IDN':'Indonesia','THA':'Thailand',
  'VNM':'Vietnam','SAU':'Saudi Arabia','ARE':'United Arab Emirates',
  'EGY':'Egypt','KEN':'Kenya','NGA':'Nigeria','MAR':'Morocco',
  'NZL':'New Zealand','LUX':'Luxembourg','ISL':'Iceland',
  'EST':'Estonia','LVA':'Latvia','LTU':'Lithuania','MLT':'Malta',
  'CYP':'Cyprus','JOR':'Jordan','LBN':'Lebanon','KWT':'Kuwait',
  'QAT':'Qatar','BHR':'Bahrain','OMN':'Oman','PRI':'Puerto Rico',
  'CRI':'Costa Rica','PAN':'Panama','ECU':'Ecuador','URY':'Uruguay',
  'LKA':'Sri Lanka','NPL':'Nepal','KHM':'Cambodia','AZE':'Azerbaijan',
  'GEO':'Georgia','ARM':'Armenia','KAZ':'Kazakhstan','UZB':'Uzbekistan',
  'BLR':'Belarus','MDA':'Moldova',
};

// All 50 US states + DC + territories as full names → United States
const US_STATE_NAMES = new Set([
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware',
  'Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky',
  'Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi',
  'Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico',
  'New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania',
  'Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
  'Virginia','Washington','West Virginia','Wisconsin','Wyoming',
  'District of Columbia','Puerto Rico','Guam','American Samoa','Virgin Islands',
]);

// US state abbreviations
const US_STATE_ABBR = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC','PR','GU','AS','VI']);

// Canadian province abbreviations
const CA_PROVINCE_ABBR = new Set(['ON','QC','BC','AB','MB','SK','NS','NB','NL','PE','YT','NT','NU']);

// Known countries — we only return a value if it matches this list (or is mapped via aliases)
const COUNTRIES = new Set([
  'United States','United Kingdom','Germany','France','Switzerland','Japan','China','India',
  'Canada','Australia','Netherlands','Belgium','Sweden','Denmark','Norway','Finland',
  'Spain','Italy','Ireland','Austria','Poland','Hungary','Czech Republic','Slovakia',
  'Romania','Bulgaria','Greece','Portugal','Croatia','Serbia','Slovenia',
  'Singapore','South Korea','Taiwan','Hong Kong','Israel','Turkey','South Africa',
  'Brazil','Mexico','Argentina','Colombia','Chile','Peru','Costa Rica','Panama',
  'Guatemala','Ecuador','Uruguay','Paraguay','Bolivia','Venezuela','Dominican Republic',
  'Russia','Ukraine','Pakistan','Bangladesh','Philippines','Malaysia','Indonesia','Thailand','Vietnam',
  'Saudi Arabia','United Arab Emirates','Egypt','Kenya','Nigeria','Morocco',
  'New Zealand','Luxembourg','Iceland','Estonia','Latvia','Lithuania',
  'Malta','Cyprus','Albania','Bosnia and Herzegovina','North Macedonia','Montenegro',
  'Belarus','Moldova','Georgia','Armenia','Azerbaijan','Kazakhstan','Uzbekistan',
  'Jordan','Lebanon','Kuwait','Qatar','Bahrain','Oman','Iraq','Iran',
  'Puerto Rico','Sri Lanka','Nepal','Cambodia','Myanmar',
  'Slovenia','Croatia','Serbia','Slovakia','Czech Republic','Hungary','Romania','Bulgaria',
]);

// City → Country lookup for city-only location strings
// Covers pharma hubs and common ambiguous cities
const CITY_COUNTRY = {
  // ── United States ─────────────────────────────────────────────────
  'TARRYTOWN':'United States','SLEEPY HOLLOW':'United States',
  'BASKING RIDGE':'United States','PARSIPPANY':'United States',
  'BRIDGEWATER':'United States','BEDMINSTER':'United States',
  'East Hanover':'United States','Whippany':'United States',
  'Florham Park':'United States','Morris Plains':'United States',
  'North Chicago':'United States','Mettawa':'United States','Branchburg':'United States',
  'Thousand Oaks':'United States','Newbury Park':'United States',
  'Gaithersburg':'United States','Rockville':'United States','Bethesda':'United States',
  'Foster City':'United States','Santa Monica':'United States',
  'South San Francisco':'United States','Brisbane':'United States',
  'La Jolla':'United States','Carlsbad':'United States','Oceanside':'United States',
  'San Diego':'United States','San Francisco':'United States',
  'Cambridge':'United States',  // Cambridge MA is primary pharma hub; Cambridge UK handled by comma context
  'Waltham':'United States','Lexington':'United States','Bedford':'United States',
  'Watertown':'United States','Framingham':'United States','Marlborough':'United States',
  'Kenilworth':'United States','Rahway':'United States','Whitehouse Station':'United States',
  'Hopewell':'United States','Lawrenceville':'United States','Plainsboro':'United States',
  'Princeton':'United States','New Brunswick':'United States',
  'Wilmington':'United States','Newark':'United States','Dover':'United States',
  'Durham':'United States','Research Triangle Park':'United States','Mebane':'United States',
  'Durham NC':'United States','Chapel Hill':'United States','Cary':'United States',
  'Columbus':'United States','Cincinnati':'United States','Cleveland':'United States',
  'Pittsburgh':'United States','Philadelphia':'United States',
  'Chicago':'United States','Abbott Park':'United States',
  'Indianapolis':'United States','Lilly Corporate Center':'United States',
  'Salt Lake City':'United States','Boulder':'United States','Denver':'United States',
  'Seattle':'United States','Bothell':'United States','Redmond':'United States',
  'Portland':'United States','South Portland':'United States',
  'Nashville':'United States','Memphis':'United States','Atlanta':'United States',
  'Charlotte':'United States','Raleigh':'United States',
  'Tampa':'United States','Miami':'United States','Orlando':'United States',
  'Houston':'United States','Dallas':'United States','Austin':'United States',
  'Phoenix':'United States','Scottsdale':'United States','Tempe':'United States',
  'Minneapolis':'United States','St. Louis':'United States','Kansas City':'United States',
  'Honolulu':'United States','Anchorage':'United States',
  'Devens':'United States','Andover':'United States','Norwood':'United States',
  'New Haven':'United States','Groton':'United States','Stamford':'United States',
  'Sleepy Hollow':'United States','Tarrytown':'United States','Hawthorne':'United States',
  'Basking Ridge':'United States','Titusville':'United States','Spring House':'United States',
  // NJ Corporate / lab shorthand (Insmed style)
  'NJ Corporate Headquarters':'United States',
  'Research Development Lab - San Diego':'United States',
  'Research Development Lab - New Jersey':'United States',
  'Research Development Lab - Cambridge':'United States',
  // ── Canada ────────────────────────────────────────────────────────
  'Toronto':'Canada','Mississauga':'Canada','Ottawa':'Canada','Montreal':'Canada',
  'Vancouver':'Canada','Calgary':'Canada','Edmonton':'Canada','Laval':'Canada',
  'Kirkland':'Canada','Dorval':'Canada','Saint-Laurent':'Canada',
  // ── United Kingdom ────────────────────────────────────────────────
  'London':'United Kingdom','Uxbridge':'United Kingdom','Stockley Park':'United Kingdom',
  'Stevenage':'United Kingdom','Hertfordshire':'United Kingdom',
  'Macclesfield':'United Kingdom','Alderley Park':'United Kingdom',
  'Oxford':'United Kingdom','Abingdon':'United Kingdom',
  'Edinburgh':'United Kingdom','Glasgow':'United Kingdom','Manchester':'United Kingdom',
  'Birmingham':'United Kingdom','Bristol':'United Kingdom','Swindon':'United Kingdom',
  'Slough':'United Kingdom','Windsor':'United Kingdom','Maidenhead':'United Kingdom',
  'Sandwich':'United Kingdom','Walton Oaks':'United Kingdom','Surrey':'United Kingdom',
  'England':'United Kingdom','Scotland':'United Kingdom','Wales':'United Kingdom',
  // ── Ireland ───────────────────────────────────────────────────────
  'Dublin':'Ireland','Cork':'Ireland','Limerick':'Ireland','Galway':'Ireland',
  'Dún Laoghaire':'Ireland','Citywest':'Ireland','Little Island':'Ireland',
  // ── Switzerland ───────────────────────────────────────────────────
  'Basel':'Switzerland','Zurich':'Switzerland','Zug':'Switzerland',
  'Bern':'Switzerland','Geneva':'Switzerland','Lausanne':'Switzerland',
  'Rotkreuz':'Switzerland','Kaiseraugst':'Switzerland','Allschwil':'Switzerland',
  // ── Germany ───────────────────────────────────────────────────────
  'Frankfurt':'Germany','Munich':'Germany','Berlin':'Germany','Hamburg':'Germany',
  'Cologne':'Germany','Düsseldorf':'Germany','Stuttgart':'Germany',
  'Mannheim':'Germany','Ludwigshafen':'Germany','Leverkusen':'Germany',
  'Wuppertal':'Germany','Ingelheim':'Germany','Darmstadt':'Germany',
  'Marburg':'Germany','Biberach':'Germany','Ulm':'Germany',
  // ── France ────────────────────────────────────────────────────────
  'Paris':'France','Lyon':'France','Strasbourg':'France','Bordeaux':'France',
  'Toulouse':'France','Marseille':'France','Montpellier':'France',
  'Gentilly':'France','Vitry-sur-Seine':'France','Suresnes':'France',
  'Rueil-Malmaison':'France','Chilly-Mazarin':'France','Guildford':'France',
  // ── Netherlands ───────────────────────────────────────────────────
  'Amsterdam':'Netherlands','Leiden':'Netherlands','Utrecht':'Netherlands',
  'Rotterdam':'Netherlands','Breda':'Netherlands','Eindhoven':'Netherlands',
  'Hoofddorp':'Netherlands','Naarden':'Netherlands',
  // ── Belgium ───────────────────────────────────────────────────────
  'Brussels':'Belgium','Antwerp':'Belgium','Ghent':'Belgium','Mechelen':'Belgium',
  'Beerse':'Belgium','Janssen':'Belgium',
  // ── Sweden ────────────────────────────────────────────────────────
  'Stockholm':'Sweden','Gothenburg':'Sweden','Malmö':'Sweden','Södertälje':'Sweden',
  'Mölndal':'Sweden',
  // ── Denmark ───────────────────────────────────────────────────────
  'Copenhagen':'Denmark','Bagsværd':'Denmark','Kalundborg':'Denmark',
  // ── Norway ────────────────────────────────────────────────────────
  'Oslo':'Norway',
  // ── Finland ───────────────────────────────────────────────────────
  'Helsinki':'Finland','Espoo':'Finland','Turku':'Finland',
  // ── Spain ─────────────────────────────────────────────────────────
  'Madrid':'Spain','Barcelona':'Spain','Seville':'Spain','Valencia':'Spain',
  'Bilbao':'Spain','Alcobendas':'Spain','Tres Cantos':'Spain',
  // ── Italy ─────────────────────────────────────────────────────────
  'Milan':'Italy','Rome':'Italy','Turin':'Italy','Naples':'Italy',
  'Florence':'Italy','Bologna':'Italy','Pomezia':'Italy','Latina':'Italy',
  'Segrate':'Italy','Sesto San Giovanni':'Italy',
  // ── Austria ───────────────────────────────────────────────────────
  'Vienna':'Austria','Graz':'Austria','Linz':'Austria',
  // ── Poland ────────────────────────────────────────────────────────
  'Warsaw':'Poland','Krakow':'Poland','Wroclaw':'Poland','Lodz':'Poland',
  'Poznan':'Poland','Gdansk':'Poland',
  // ── Hungary ───────────────────────────────────────────────────────
  'Budapest':'Hungary',
  // ── Czech Republic ────────────────────────────────────────────────
  'Prague':'Czech Republic','Brno':'Czech Republic',
  // ── Romania ───────────────────────────────────────────────────────
  'Bucharest':'Romania','Cluj-Napoca':'Romania',
  // ── Greece ────────────────────────────────────────────────────────
  'Athens':'Greece','Thessaloniki':'Greece','Chortiatis':'Greece',
  // ── Portugal ──────────────────────────────────────────────────────
  'Lisbon':'Portugal','Porto':'Portugal',
  // ── Slovenia ──────────────────────────────────────────────────────
  'Ljubljana':'Slovenia','Mengeš':'Slovenia','Mengesh':'Slovenia',
  // ── Turkey ────────────────────────────────────────────────────────
  'Istanbul':'Turkey','İstanbul':'Turkey','Ankara':'Turkey','İstanbul Kurtköy':'Turkey',
  'Kurtköy':'Turkey',
  // ── Israel ────────────────────────────────────────────────────────
  'Tel Aviv':'Israel','Jerusalem':'Israel','Haifa':'Israel','Petah Tikva':'Israel',
  'Rehovot':'Israel','Ness Ziona':'Israel','Herzliya':'Israel',
  // ── India ─────────────────────────────────────────────────────────
  'Hyderabad':'India','Mumbai':'India','Bangalore':'India','Bengaluru':'India',
  'Chennai':'India','Pune':'India','New Delhi':'India','Delhi':'India',
  'Gurgaon':'India','Gurugram':'India','Noida':'India','Ahmedabad':'India',
  'Kolkata':'India','Chandigarh':'India',
  'Hyderabad (Office)':'India',
  // ── China ─────────────────────────────────────────────────────────
  'Shanghai':'China','Beijing':'China','Guangzhou':'China','Shenzhen':'China',
  'Chengdu':'China','Hangzhou':'China','Suzhou':'China','Nanjing':'China',
  'Tianjin':'China','Wuhan':'China','Zhengzhou':'China','Shangrao':'China',
  'Chongqing':'China','Qingdao':'China','Dalian':'China','Xiamen':'China',
  // ── Japan ─────────────────────────────────────────────────────────
  'Tokyo':'Japan','Osaka':'Japan','Kyoto':'Japan','Yokohama':'Japan',
  'Nagoya':'Japan','Kobe':'Japan','Fukuoka':'Japan',
  // ── South Korea ───────────────────────────────────────────────────
  'Seoul':'South Korea','Busan':'South Korea','Incheon':'South Korea',
  // ── Singapore ─────────────────────────────────────────────────────
  'Singapore':'Singapore',
  // ── Australia ─────────────────────────────────────────────────────
  'Sydney':'Australia','Melbourne':'Australia','Brisbane (AU)':'Australia',
  'Perth':'Australia','Adelaide':'Australia','Canberra':'Australia',
  'Mulgrave':'Australia','Macquarie Park':'Australia',
  // ── New Zealand ───────────────────────────────────────────────────
  'Auckland':'New Zealand','Wellington':'New Zealand','Christchurch':'New Zealand',
  // ── Malaysia ──────────────────────────────────────────────────────
  'Kuala Lumpur':'Malaysia','Petaling Jaya':'Malaysia','Selangor':'Malaysia',
  // ── Indonesia ─────────────────────────────────────────────────────
  'Jakarta':'Indonesia','Surabaya':'Indonesia','Bandung':'Indonesia',
  // ── Philippines ───────────────────────────────────────────────────
  'Manila':'Philippines','Taguig':'Philippines','Makati':'Philippines',
  // ── Thailand ──────────────────────────────────────────────────────
  'Bangkok':'Thailand','Chiang Mai':'Thailand',
  // ── Vietnam ───────────────────────────────────────────────────────
  'Ho Chi Minh City':'Vietnam','Hanoi':'Vietnam',
  // ── Taiwan ────────────────────────────────────────────────────────
  'Taipei':'Taiwan',
  // ── Hong Kong ─────────────────────────────────────────────────────
  'Hong Kong':'Hong Kong',
  // ── Brazil ────────────────────────────────────────────────────────
  'São Paulo':'Brazil','Sao Paulo':'Brazil','Rio de Janeiro':'Brazil',
  'Santo Amaro':'Brazil','Barueri':'Brazil','Campinas':'Brazil',
  // ── Mexico ────────────────────────────────────────────────────────
  'Mexico City':'Mexico','Guadalajara':'Mexico','Monterrey':'Mexico',
  'INSURGENTES':'Mexico',
  // ── Colombia ──────────────────────────────────────────────────────
  'Bogota':'Colombia','Bogotá':'Colombia','Medellín':'Colombia','Cali':'Colombia',
  // ── Argentina ─────────────────────────────────────────────────────
  'Buenos Aires':'Argentina','Córdoba':'Argentina','Rosario':'Argentina',
  // ── Chile ─────────────────────────────────────────────────────────
  'Santiago':'Chile',
  // ── Peru ──────────────────────────────────────────────────────────
  'Lima':'Peru',
  // ── Costa Rica ────────────────────────────────────────────────────
  'San Jose':'Costa Rica','Escazu':'Costa Rica','Grecia':'Costa Rica',
  // ── South Africa ──────────────────────────────────────────────────
  'Johannesburg':'South Africa','Cape Town':'South Africa','Durban':'South Africa',
  // ── Egypt ─────────────────────────────────────────────────────────
  'Cairo':'Egypt','Alexandria':'Egypt',
  // ── United Arab Emirates ──────────────────────────────────────────
  'Dubai':'United Arab Emirates','Abu Dhabi':'United Arab Emirates',
  // ── Saudi Arabia ──────────────────────────────────────────────────
  'Riyadh':'Saudi Arabia','Jeddah':'Saudi Arabia',
  // ── Russia ────────────────────────────────────────────────────────
  'Moscow':'Russia','Saint Petersburg':'Russia',
};

// ── Case-insensitive lookup maps (built once at load time) ───────────────────
const CITY_COUNTRY_LC    = Object.fromEntries(Object.entries(CITY_COUNTRY).map(([k,v])=>[k.toLowerCase(),v]));
const COUNTRY_ALIASES_LC = Object.fromEntries(Object.entries(COUNTRY_ALIASES).map(([k,v])=>[k.toLowerCase(),v]));
const COUNTRIES_LC       = new Map([...COUNTRIES].map(c=>[c.toLowerCase(),c]));
const STATE_NAMES_LC     = new Set([...US_STATE_NAMES].map(s=>s.toLowerCase()));
const CA_PROVINCE_LC     = new Set([...CA_PROVINCE_ABBR].map(s=>s.toLowerCase()));

function cityLookup(s) {
  const lc = s.toLowerCase();
  return CITY_COUNTRY[s] || CITY_COUNTRY_LC[lc] || '';
}

function resolveCountryToken(token) {
  if (!token) return '';
  const lc = token.toLowerCase();
  // Country aliases (any case: "US", "us", "PL", "pl", "United States of America"…)
  if (COUNTRY_ALIASES[token]) return COUNTRY_ALIASES[token];
  if (COUNTRY_ALIASES_LC[lc]) return COUNTRY_ALIASES_LC[lc];
  // Known country names ("Ireland", "IRELAND", "ireland"…)
  if (COUNTRIES.has(token)) return token;
  if (COUNTRIES_LC.has(lc)) return COUNTRIES_LC.get(lc);
  // US state abbreviations (uppercase canonical: NY, CA…)
  if (US_STATE_ABBR.has(token.toUpperCase())) return 'United States';
  // Canadian province abbreviations
  if (CA_PROVINCE_ABBR.has(token.toUpperCase()) || CA_PROVINCE_LC.has(lc)) return 'Canada';
  // US state full names ("New York", "NEW YORK", "new york"…)
  if (US_STATE_NAMES.has(token) || STATE_NAMES_LC.has(lc)) return 'United States';
  return '';
}

export function inferCountry(location) {
  if (!location) return '';
  // Normalize em-dash / en-dash to spaced hyphen
  let l = location.trim().replace(/\s*[–—]\s*/g, ' - ');
  if (!l) return '';

  // Remote
  if (/\bremote\b/i.test(l)) return 'Remote';

  // Field Based — catch "Field Non-Sales", "United States - Field", "Field - United States", etc.
  if (/field[- ]?based|field force|field medical|field sales|field rep|field non-?sales|home[- ]?based/i.test(l)) return 'Field Based';
  if (l.split(' - ').map(s => s.trim().toLowerCase()).some(s => s === 'field')) return 'Field Based';

  // Multiple / global
  if (/multiple|various|global|worldwide|all locations/i.test(l)) return 'Multiple';
  if (/^\d+\s+locations?$/i.test(l)) return 'Multiple';

  // Pattern: "XX: rest" — ISO code prefix (Eli Lilly: "US: Louisville CO Site 3")
  const colonMatch = l.match(/^([A-Za-z]{2,3}):\s/);
  if (colonMatch) {
    const r = resolveCountryToken(colonMatch[1].toUpperCase());
    if (r) return r;
  }

  // Pattern: "Something (COUNTRY)" — parenthetical country (Novartis: "Remote Position (USA)", "Field Force (Indonesia)")
  const parenMatch = l.match(/\(([^)]+)\)\s*$/);
  if (parenMatch) {
    const inner = parenMatch[1].trim();
    const r = resolveCountryToken(inner) || resolveCountryToken(inner.toUpperCase());
    if (r) return r;
  }

  // " - " separator — check FIRST then LAST segment
  // First = Workday standard (Pfizer: "United States - Kansas - McPherson", Merck: "USA - PA - Rahway")
  // Last  = BMS ("Princeton - NJ - US"), Moderna ("London - England"), Regeneron ("Remote - United States")
  if (l.includes(' - ')) {
    const segs = l.split(' - ').map(s => s.trim());
    const first = segs[0], last = segs[segs.length - 1];
    const rFirst = resolveCountryToken(first);
    if (rFirst) return rFirst;
    const rLast = resolveCountryToken(last);
    if (rLast) return rLast;
  }

  // ">" or leading "|" hierarchy (e.g. "United States of America > New Jersey > City")
  const hierSep = l.includes('>') ? '>' : l.startsWith('|') ? '|' : null;
  if (hierSep) {
    const first = l.split(hierSep)[0].trim();
    return resolveCountryToken(first);
  }

  // Comma-separated: "City, State, Country" — scan right to left
  // Also handles single-word country names: "Ireland", "Japan", "China"
  const parts = l.split(',').map(p => p.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const r = resolveCountryToken(parts[i]);
    if (r) return r;
  }

  // Bare hyphen: "Greece-Thessaloniki Chortiatis" — check first hyphen segment
  if (l.includes('-') && !l.includes(' - ')) {
    const firstSeg = l.split('-')[0].trim();
    const r = resolveCountryToken(firstSeg);
    if (r) return r;
  }

  // City lookup — case-insensitive, try full string, first comma segment, then stripped parentheticals
  const cityKey = parts.length ? parts[0] : l;
  if (cityLookup(l)) return cityLookup(l);
  if (cityLookup(cityKey)) return cityLookup(cityKey);
  // Strip trailing parenthetical: "Hyderabad (Office)" → "Hyderabad", "Paris Headquarter (PHARMA)" → "Paris Headquarter"
  const stripped = l.replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (stripped !== l) {
    if (cityLookup(stripped)) return cityLookup(stripped);
    // Also try first word of stripped: "Paris Headquarter" → "Paris"
    const firstWord = stripped.split(/\s+/)[0];
    if (cityLookup(firstWord)) return cityLookup(firstWord);
  }

  // Last resort: scan individual words for a state/province abbreviation
  const words = l.split(/[\s,\-]+/);
  for (const w of words) {
    if (US_STATE_ABBR.has(w)) return 'United States';
    if (CA_PROVINCE_ABBR.has(w)) return 'Canada';
  }

  return '';
}

function getFilteredRoles() {
  const q = (document.getElementById('r-search')?.value || '').toLowerCase(); 
  const areaFilter = document.getElementById('r-area')?.value || '';
  const funcFilter = document.getElementById('r-func')?.value || '';
  const co = document.getElementById('r-company')?.value || '';
  const country = document.getElementById('r-loc')?.value || '';
  const state   = document.getElementById('r-state')?.value || '';
  const level   = document.getElementById('r-level')?.value || '';
  return all_jobs.filter(r => {
    try {
      const area = r._area || inferArea(r.title || '', r.dept || '');
      const func = r._func || inferFunc(r.title || '', r.dept || '');
      const mQ = !q || (r.title||'').toLowerCase().includes(q) || (r.dept||'').toLowerCase().includes(q) || (r.location||'').toLowerCase().includes(q) || (r.company||'').toLowerCase().includes(q) || area.toLowerCase().includes(q);
      const mArea = !areaFilter || area === areaFilter;
      const mFunc = !funcFilter || func === funcFilter || FUNC_GROUP_MAP[func] === funcFilter;
      const rc = r._country || inferCountry(r.location || '');
      const mCountry = !country || (country === 'Other (unclassified)' ? !rc : rc === country);
      const rs = inferState(r.location || '');
      const mState = !state || (state === '__nostate__' ? (rc === 'United States' && !rs) : rs === state);
      const mLevel = !level || inferLevel(r.title || '') === level;
      return mQ && mArea && mFunc && (!co || r.company === co) && mCountry && mState && mLevel;
    } catch(e) { return false; }
  }).sort((a, b) => { try { return (b._dateMs||0) - (a._dateMs||0); } catch(e) { return 0; } });
}

function clearRoleFilters() {
  ['r-search', 'r-area', 'r-func', 'r-company', 'r-loc', 'r-state', 'r-level'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const stateEl = document.getElementById('r-state'); if (stateEl) stateEl.style.display = 'none';
  document.getElementById('r-clear-btn').style.display = 'none';
  renderRoles();
}

window.onCountryChange = function() {
  const country = document.getElementById('r-loc')?.value || '';
  const stateEl = document.getElementById('r-state');
  if (stateEl) {
    stateEl.style.display = country === 'United States' ? '' : 'none';
    stateEl.value = '';
  }
  renderRoles();
};

export function renderRoles() {
  const list = getFilteredRoles(); setPfizerFiltered(list); const container = document.getElementById('roles-container'); if (!container) return;
  const countEl = document.getElementById('r-count');
  const limit = 100;
  if (countEl) countEl.textContent = list.length > limit ? `Showing ${limit} of ${list.length} roles` : list.length + ' roles';
  const cb = document.getElementById('r-clear-btn'); if (cb) cb.style.display = (document.getElementById('r-search')?.value || document.getElementById('r-area')?.value || document.getElementById('r-func')?.value || document.getElementById('r-company')?.value || document.getElementById('r-dept')?.value || document.getElementById('r-loc')?.value || document.getElementById('r-level')?.value) ? 'inline-flex' : 'none';
  if (!list.length && all_jobs.length > 0) { container.innerHTML = '<div class="roles-empty">No roles match your filters</div>'; return; }
  if (!list.length) return;
  const cardArr = list.slice(0, limit).map(r => { try { return roleCardHTML(r); } catch(e) { return ''; } });
  const classificationNote = `<div class="role-card classification-inline-note">
    <div class="cin-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
    <div class="cin-body">
      <div class="cin-title">A note on job classification</div>
      <div class="cin-text">Job function and location data is parsed directly from company career pages, which are sometimes inconsistently formatted or missing key details. We're continuously improving accuracy — anomalies will decrease over time. Spotted something off? <a href="mailto:hello@bioboard.io" class="cin-link">Send us a note</a> — every suggestion helps.</div>
    </div>
  </div>`;
  if (cardArr.length > 1) cardArr.splice(1, 0, classificationNote);
  else if (cardArr.length === 1) cardArr.push(classificationNote);
  container.innerHTML = '<div class="roles-grid">' + cardArr.join('') + '</div>';
}

function roleCardHTML(r) {
  const area = r._area || inferArea(r.title, r.dept || '');
  const func = r._func || inferFunc(r.title, r.dept || '');
  const added = addedRoleSet.has(r.id); const safeR = JSON.stringify({ id: r.id, title: r.title, dept: r.dept || '', location: r.location || '', url: r.url, company: r.company }).replace(/"/g, '&quot;');
  return `<div class="role-card" onclick="window.open('${esc(r.url)}','_blank')">
    <div class="role-card-left">
      <div class="role-company" style="font-size:0.72rem;margin-bottom:2px">${esc(r.company)}</div>
      <div class="role-title">${esc(r.title)}</div>
      ${r.dept ? `<div class="role-dept">${esc(r.dept)}</div>` : ''}
      <div class="role-tags">
        ${area !== 'Diversified' ? `<span class="role-tag rt-area">${esc(area)}</span>` : ''}
        ${func !== 'Other' ? `<span class="role-tag rt-func">${esc(func)}</span>` : ''}
        ${r.location ? `<span class="role-tag rt-loc">📍 ${esc(r.location)}</span>` : ''}
        ${r.posted ? `<span class="role-tag rt-loc">${esc(r.posted)}</span>` : ''}
      </div>
    </div>
    <div class="role-card-right" onclick="event.stopPropagation()">
      <a class="btn-role-view" href="${esc(r.url)}" target="_blank" rel="noopener"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>View</a>
      ${added ?
      `<button class="btn-role-add added"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Added</button>` :
      `<button class="btn-role-add" onclick="addRoleToTracker(${safeR}, this, 'Sourced')"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Track (Sourced)</button>
         <button class="btn-role-add" onclick="addRoleToTracker(${safeR}, this, 'Applied')"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Track (Applied)</button>`
    }
    </div>
  </div>`;
}

function addRoleToTracker(r, btn, stage = 'Sourced') {
  if (addedRoleSet.has(r.id)) return; addedRoleSet.add(r.id); saveAddedRoles();
  if (!jobs.find(j => j.company === r.company && j.role === r.title)) {
    jobs.push({ id: uid(), company: r.company, role: r.title, url: r.url, area: inferArea(r.title, r.dept || ''), jobtype: 'Full-Time', level: inferLevel(r.title), func: inferFunc(r.title, r.dept || ''), stage: stage, priority: 'med', recruiter: '', notes: `Dept: ${r.dept || '—'}\nLocation: ${r.location || '—'}\nSource: ${r.company} career site (live fetch)`.trim(), date: todayStr(), interviews: [], activity: [{ text: `Added from ${r.company} Live Jobs`, time: new Date().toISOString() }] }); saveJobs(); renderTracker();
  }
  const parent = btn.parentElement;
  if (parent) {
    const buttons = parent.querySelectorAll('button');
    buttons.forEach(b => { if (b !== btn) b.remove(); });
  }
  btn.classList.add('added'); btn.innerHTML = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Added`; btn.onclick = null;
  document.getElementById('tracker-badge').textContent = jobs.length; updateTrackerStats(); showToast(`${r.company} role added`);
}

const AREA_CONDITIONS = {
  'Oncology': [
    'oncol','tumor','tumour','cancer','carcinoma','lymphoma','leukemia','leukaemia',
    'myeloma','melanoma','sarcoma','glioma','glioblastoma','lung cancer','breast cancer',
    'colorectal','bladder cancer','prostate cancer','ovarian cancer','cervical cancer',
    'renal cell','hepatocellular','pancreatic cancer','gastric cancer','esophageal',
    'head and neck cancer','thyroid cancer','endometrial','mesothelioma','neuroblastoma',
    'medulloblastoma','aml','cll','cml','all','nhl','hodgkin','mds','mpn',
    'checkpoint inhibitor','car-t','car t','immuno-oncol','io ',
  ],
  'Rare Disease': [
    'rare disease','rare disorder','orphan','spinal muscular atrophy','sma ',
    'duchenne','muscular dystrophy','phenylketonuria','pku','gaucher','fabry',
    'pompe','hunter syndrome','hurler','niemann-pick','wilson disease',
    'hemophilia','haemophilia','von willebrand','thalassemia','thalassaemia',
    'sickle cell','cystic fibrosis','friedreich','rett syndrome','angelman',
    'prader-willi','tuberous sclerosis','neurofibromatosis','amyloidosis','transthyretin','attr ',
    'hereditary angioedema','hae ','lysosomal','enzyme replacement',
  ],
  'Immunology': [
    'immun','autoimmun','rheumatoid arthritis','psoriasis','psoriatic','lupus','sle ',
    'ankylosing spondylitis','inflammatory bowel','crohn','ulcerative colitis',
    'multiple sclerosis',' ms ','atopic dermatitis','eczema','asthma','copd',
    'eosinophil','il-4','il-5','il-13','il-17','il-23','il-33','jak inhibitor',
    'biologic','biosimilar','transplant','graft','gvhd','allerg','hay fever',
    'uveitis','myasthenia gravis','sjögren','sjogren','vasculitis','scleroderma',
  ],
  'Neuroscience': [
    'neuro','cns ','central nervous','alzheimer','dementia','parkinson',
    'epilep','seizure','migraine','headache','multiple sclerosis',' ms ',
    'huntington','als ','amyotrophic','stroke','tia ','schizophrenia','bipolar',
    'depression','anxiety','adhd','autism','asd ','ocd ','ptsd','insomnia','sleep disorder',
    'narcolepsy','restless leg','neuropathic pain','spasticity','traumatic brain',
    'tbi ','spinal cord','rare neurolog','rare neuro',
  ],
  'Cardiovascular': [
    'cardio','heart failure','hypertension','atrial fibrillation','afib',
    'coronary artery','myocardial','heart attack','thrombosis','stroke',
    'dyslipidemia','hypercholesterol','ldl','hdl','lipid','atherosclerosis',
    'aortic','valve disease','cardiomyopathy','peripheral artery','pvd ',
    'venous thromboembolism','vte ','anticoagul','antithrombotic',
  ],
  'Vaccines': [
    'vaccin','immuniz','mrna vaccine','flu vaccine','influenza vaccine',
    'covid vaccine','rsv ','hpv vaccine','meningococcal','pneumococcal',
    'rotavirus','hepatitis vaccine','rabies','adjuvant',
  ],
  'Metabolic / Endocrine': [
    'metabol','endocrin','diabetes','insulin','obesity','weight loss','glp-1',
    'sglt2','thyroid','hyperthyroid','hypothyroid','adrenal','cushing',
    'acromegaly','growth hormone','pituitary','non-alcoholic steatohepatitis',
    'nash ','nafld','fatty liver','gout','hyperuricemia','osteoporosis','bone density',
  ],
  'Infectious Disease': [
    'infectious','infect','hiv ','aids ','hepatitis','hbv','hcv','tuberculosis',
    'malaria','dengue','zika','ebola','influenza','flu ','covid','sars','coronavirus',
    'antimicrobial','antibiotic','antifungal','antiviral','rsv ','cmv ',
    'pneumonia','sepsis','c. diff','clostridium','mrsa',
  ],
  'Ophthalmology': [
    'ophthal','retina','macular degeneration','amd ','diabetic retinopathy',
    'glaucoma','dry eye','wet amd','neovascular','intravitreal','ocular',
  ],
};

export function inferArea(title, dept) {
  const t = (title + ' ' + dept).toLowerCase();
  for (const [area, keywords] of Object.entries(AREA_CONDITIONS)) {
    if (keywords.some(k => t.includes(k))) return area;
  }
  return 'Diversified';
}
function inferLevel(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('vice president') || /\bvp\b/.test(t)) return 'VP';
  if (/\bhead of\b|\bhead,/.test(t) || t.includes('executive director')) return 'Head Of / Executive Director';
  if (t.includes('senior director')) return 'Senior Director';
  if (t.includes('associate director')) return 'Associate Director';
  if (t.includes('director')) return 'Director';
  if (t.includes('senior manager')) return 'Senior Manager';
  if (t.includes('manager')) return 'Manager';
  if (t.includes('associate')) return 'Associate';
  if (/\bsenior\b|\bsr\.?\b/.test(t)) return 'Senior';
  return 'Individual Contributor';
}

export const FUNC_GROUPS = [
  { group: 'Commercial Operations', items: ['Sales Force Effectiveness', 'Field Sales', 'Commercial Operations', 'CRM Administration (Veeva)', 'Incentive Compensation', 'Field Force Deployment', 'Call Planning', 'Targeting & Segmentation', 'Commercial Training', 'Other / Commercial Operations'] },
  { group: 'Marketing', items: ['Brand/Product Management', 'Omnichannel Marketing', 'Digital Marketing', 'Customer Experience', 'Marketing Operations', 'Campaign Management', 'Medical Education Marketing', 'HCP Marketing', 'Patient Marketing', 'Promotional Review (MLR)', 'Other / Marketing'] },
  { group: 'Market Access & Pricing', items: ['Payer Strategy', 'Reimbursement', 'HEOR', 'Formulary Access', 'Government Affairs', 'Contracting & Pricing', 'GPO/IDN Strategy', '340B', 'Access & Reimbursement', 'Other / Market Access & Pricing'] },
  { group: 'Commercial Analytics & Insights', items: ['Forecasting', 'Commercial Analytics', 'Market Research', 'Competitive Intelligence', 'Integrated Insights & Strategy', 'Business Intelligence', 'Data Science', 'Real-World Evidence (RWE)', 'Performance Analytics', 'Other / Commercial Analytics & Insights'] },
  { group: 'Medical Affairs', items: ['Medical Science Liaisons (MSLs)', 'Medical Communications', 'Medical Information', 'Publication Planning', 'Advisory Boards', 'Evidence Generation', 'Medical Education', 'Scientific Affairs', 'Medical Affairs', 'Other / Medical Affairs'] },
  { group: 'Clinical Development', items: ['Clinical Operations', 'Clinical Project Management', 'Clinical Data Management', 'Biostatistics', 'Clinical Pharmacology', 'Pharmacokinetics', 'Patient Recruitment', 'Other / Clinical Development'] },
  { group: 'Regulatory Affairs', items: ['Regulatory Strategy', 'Submissions', 'Labeling', 'CMC Regulatory', 'Regulatory Operations', 'International Regulatory', 'Pharmacovigilance/Drug Safety', 'Other / Regulatory Affairs'] },
  { group: 'Research & Discovery', items: ['Biology', 'Chemistry', 'Medicinal Chemistry', 'Translational Medicine', 'Bioinformatics', 'Computational Biology', 'Drug Discovery', 'Other / Research & Discovery'] },
  { group: 'Manufacturing & Supply Chain', items: ['Manufacturing Sciences', 'Quality Assurance', 'Quality Control', 'Validation', 'Supply Chain Planning', 'Logistics', 'Procurement', 'Technical Operations', 'Process Development', 'Other / Manufacturing & Supply Chain'] },
  { group: 'Finance', items: ['FP&A', 'Commercial Finance', 'Business Development Finance', 'Accounting', 'Treasury', 'Tax', 'Internal Audit', 'Other / Finance'] },
  { group: 'Business Development & Strategy', items: ['Corporate Strategy', 'Licensing & Acquisitions', 'Alliance Management', 'Portfolio Strategy', 'Pipeline Valuation', 'Corporate Development', 'Other / Business Development & Strategy'] },
  { group: 'IT & Digital', items: ['Commercial IT', 'Data Engineering', 'Enterprise Architecture', 'Digital Health', 'CRM/Veeva Administration', 'AI/ML', 'Cybersecurity', 'Other / IT & Digital'] },
  { group: 'HR & Talent', items: ['Talent Acquisition', 'HR Business Partners', 'Compensation & Benefits', 'Learning & Development', 'Organizational Effectiveness', 'Other / HR & Talent'] },
  { group: 'Legal & Compliance', items: ['Legal Counsel', 'Privacy', 'Compliance', 'Contracts', 'IP/Patents', 'Healthcare Law', 'Other / Legal & Compliance'] },
  { group: 'Patient Services & Access', items: ['Patient Support Programs', 'Hub Services', 'Specialty Pharmacy Relations', 'Patient Advocacy', 'Access & Reimbursement', 'Other / Patient Services & Access'] },
  { group: 'Corporate & General Management', items: ['Executive & Administrative Support', 'Real Estate & Facilities', 'Corporate Communications', 'Corporate Security', 'General Management', 'Health, Safety & Environment', 'Investor Relations', 'Project Management', 'Other / Corporate & General Management'] },
];

export const FUNC_GROUP_MAP = {};
FUNC_GROUPS.forEach(g => { FUNC_GROUP_MAP[g.group] = g.group; g.items.forEach(item => { FUNC_GROUP_MAP[item] = g.group; }); });

export function inferFunc(title, dept) {
  const t = (title + ' ' + dept).toLowerCase();

  // ── Animal Health / Veterinary — return Other so these can be excluded ────
  if (t.includes('animal health') || t.includes('vétérinaire') || t.includes('veterinaire') || t.includes('veterinary') || t.includes('volaille') || t.includes('livestock') || t.includes('poultry') || t.includes('zoetis') || t.includes('elanco')) return 'Other';

  // ── Sales (most common unclassified bucket) ──────────────────────────────
  if (t.includes('sales force effectiveness') || / sfe\b/.test(t)) return 'Sales Force Effectiveness';
  if (t.includes('customer facing effectiveness') || t.includes('customer-facing effectiveness')) return 'Sales Force Effectiveness';
  if (t.includes('ffe ') || t.includes('-ffe') || t.includes(' ffe') || t.includes('gtmc') || t.includes('field force excellence')) return 'Sales Force Effectiveness';
  if (t.includes('incentive compensation')) return 'Incentive Compensation';
  if (t.includes('field force')) return 'Field Force Deployment';
  if (t.includes('call planning')) return 'Call Planning';
  if (t.includes('targeting') && t.includes('segmentation')) return 'Targeting & Segmentation';
  if (t.includes('commercial training') || t.includes('销售培训') || t.includes('sales training manager') || t.includes('training manager') && t.includes('sales')) return 'Commercial Training';
  // Field Sales — broad net for rep/specialist/territory/account roles
  if (t.includes('pharmaceutical sales') || t.includes('pharma sales')) return 'Field Sales';
  if (t.includes('specialty sales') || t.includes('specialty care sales')) return 'Field Sales';
  if (t.includes('specialty rep') || t.includes('sales rep') || t.includes('sales representative')) return 'Field Sales';
  if (t.includes('territory manager') || t.includes('territory representative') || t.includes('territory account') || t.includes('territory business manager')) return 'Field Sales';
  if (t.includes('account specialist') || t.includes('account executive') || t.includes('account manager') || t.includes('account director')) return 'Field Sales';
  if (t.includes('health & science specialist') || t.includes('health and science specialist')) return 'Field Sales';
  if (t.includes('institutional specialist') || t.includes('hospital specialist')) return 'Field Sales';
  if (t.includes('therapeutic area specialist') || t.includes('therapeutic specialist')) return 'Field Sales';
  if (t.includes('oncology specialist') || t.includes('hematology specialist') || t.includes('immunology specialist')) return 'Field Sales';
  if (t.includes('prevention specialist') && (t.includes('hiv') || t.includes('pharma') || t.includes('sales'))) return 'Field Sales';
  if (t.includes('key account') || t.includes('hospital rep') || t.includes('field sales')) return 'Field Sales';
  if (t.includes('national sales') || t.includes('regional sales') || t.includes('sales leader')) return 'Field Sales';
  if (t.includes('sales specialist') || t.includes('sales consultant') || t.includes('sales associate')) return 'Field Sales';
  if (t.includes('district manager') || t.includes('area business director') || t.includes('area sales')) return 'Field Sales';
  if ((t.includes('regional director') || t.includes('area director')) && (t.includes('sales') || t.includes('commercial') || t.includes('oncology') || t.includes('neurology') || t.includes('immunology') || t.includes('cardio'))) return 'Field Sales';
  if (t.includes('product specialist') && (t.includes('vaccine') || t.includes('pharma') || t.includes('sales'))) return 'Field Sales';
  // German pharma rep
  if (t.includes('pharmaberater') || t.includes('pharma berater') || t.includes('außendienstmitarbeiter') || t.includes('pharmareferent')) return 'Field Sales';
  // Spanish/Portuguese/Italian/Asian sales rep titles
  if (t.includes('representante') || t.includes('representant') || t.includes('propagand')) return 'Field Sales';
  if (t.includes('biopharmaceutical rep') || t.includes('biopharma rep') || t.includes('health representative') || t.includes('district business manager')) return 'Field Sales';
  if (t.includes('delegad') || t.includes('pharmareferent') || t.includes('medical representative')) return 'Field Sales';
  if (t.includes('informatore scientifico') || t.includes('informador')) return 'Field Sales';
  if (t.includes('gestor') || t.includes('gestora')) return 'Field Sales';
  // MR / EMR (Medical Representative abbreviations used in Asia/EU/China)
  if (/\bemr\b/.test(t)) return 'Field Sales';
  if (/\bmr\b/.test(t) || /^mr-/.test(t)) return 'Field Sales';   // MR-RIN-杭州, MR-突破性..., etc.
  if (t.includes('medical representative') || t.includes('medical rep ')) return 'Field Sales';
  // Chinese medical rep titles
  if (t.includes('医药代表') || t.includes('医学代表')) return 'Field Sales';
  // Spanish sales manager titles
  if (t.includes('gerente de ventas') || t.includes('gerente comercial')) return 'Field Sales';
  if (t.includes('regional tumor lead') || t.includes('tumor lead') || t.includes('therapy advancement manager')) return 'Field Sales';
  // Portuguese/Spanish technical consultant in oncology/pharma
  if (t.includes('consultor técnico') || t.includes('consultor tecnico') || t.includes('consultora técnica')) return 'Field Sales';
  // Area Business Manager / Commercial Director
  if (t.includes('area business manager') || t.includes('commercial director')) return 'Field Sales';
  // MedTech field sales (surgical, cardiac, imaging)
  if (t.includes('advanced surgical consultant') || t.includes('surgical consultant')) return 'Field Sales';
  if ((t.includes('business manager') || t.includes('market development')) && (t.includes('cardiac') || t.includes('imaging') || t.includes('structural heart') || t.includes('asc ') || t.includes('medtech') || t.includes('electrophysiology'))) return 'Field Sales';
  if (t.includes('cell therapy account') || t.includes('accounts & customer engagement') || t.includes('cardiovascular accounts')) return 'Field Sales';
  // Regional Director without TA context → Field Sales (broad fallback, placed before other checks)
  if (t.includes('regional director') && !t.includes('regulatory') && !t.includes('clinical') && !t.includes('medical')) return 'Field Sales';
  // Chinese medical rep / sales titles (医学信息沟通 = medical info communication = field sales)
  if (t.includes('医学信息沟通') || t.includes('零售代表') || t.includes('辉瑞') && t.includes('代表')) return 'Field Sales';
  if (t.includes('retail rep') || t.includes('area rare') || t.includes('rare cardiac specialist') || /\barcs\b/.test(t)) return 'Field Sales';
  if (t.includes('area manager') && (t.includes('cvrm') || t.includes('oncol') || t.includes('cardio') || t.includes('immuno'))) return 'Field Sales';
  if (t.includes('global commercial lead') || t.includes('commercial lead') && (t.includes('als') || t.includes('director') || t.includes('head'))) return 'Field Sales';
  if (t.includes('therapy lead') && (t.includes('oncol') || t.includes('field') || t.includes('breast') || t.includes('hematol'))) return 'Field Sales';
  if (t.includes('senior product specialist') || t.includes('product specialist') && !t.includes('vaccine') && !t.includes('pharma')) return 'Field Sales';
  if (t.includes('thought leader liaison') || t.includes('tll ') || / tll\b/.test(t) || t.includes('field medical') || t.includes('medical scientific liaison') || t.includes('regional liaison director') || t.includes('radiopharmaceutical') && t.includes('liaison')) return 'Medical Science Liaisons (MSLs)';
  if (t.includes('market enablement') || t.includes('cbu operational') || t.includes('operational effectiveness') && t.includes('commercial')) return 'Commercial Operations';
  if (t.includes('sales') && (t.includes('manager') || t.includes('director') || t.includes('executive'))) return 'Field Sales';
  if (t.includes('field execution lead')) return 'Sales Force Effectiveness';

  // ── Commercial Analytics & Insights ─────────────────────────────────────
  if (t.includes('forecast')) return 'Forecasting';
  if (t.includes('market research')) return 'Market Research';
  if (t.includes('competitive intel')) return 'Competitive Intelligence';
  if (t.includes('power bi') || t.includes('visualization') || t.includes('visualisation') || t.includes('business intelligence')) return 'Business Intelligence';
  if (t.includes('data science') || t.includes('data scientist') || t.includes('decision science') || t.includes('data analyst') || t.includes('data support analyst')) return 'Data Science';
  if (t.includes('real-world') || t.includes('real world') || / rwe\b/.test(t) || / rwd\b/.test(t) || t.includes('real world data') || t.includes('observational research') || t.includes('observational study')) return 'Real-World Evidence (RWE)';
  if (t.includes('performance analytics')) return 'Performance Analytics';
  if (t.includes('integrated insights')) return 'Integrated Insights & Strategy';
  if (t.includes('domain enablement') || t.includes('discoverability')) return 'Business Intelligence';
  if (t.includes('insight') || t.includes('analytics') || t.includes('intelligence')) return 'Commercial Analytics';

  // ── Commercial Analytics & Insights (extra) ──────────────────────────────
  if (t.includes('epidemiolog')) return 'Real-World Evidence (RWE)';
  if (t.includes('heva') || t.includes('value & access') || t.includes('value and access') || t.includes('value assessment') || t.includes('value evidence') || t.includes('global value')) return 'HEOR';
  if (t.includes('business systems analyst') || t.includes('bus sys analyst') || t.includes('is bus sys')) return 'Business Intelligence';
  if (t.includes('data integration') || t.includes('data integrations')) return 'Data Engineering';

  // ── Market Access & Pricing ──────────────────────────────────────────────
  if (t.includes('heor') || t.includes('health economics') || t.includes('outcomes research')) return 'HEOR';
  if (t.includes('government affairs') || t.includes('community liaison') || t.includes('community relations') || t.includes('external affairs') || t.includes('stakeholder engagement') && t.includes('sponsorship') || t.includes('strategic communications') && !t.includes('medical') || t.includes('policy manager') || t.includes('public-private partnership') || t.includes('public private partnership') || t.includes('state affairs') || t.includes('political affairs')) return 'Government Affairs';
  if (t.includes('formulary')) return 'Formulary Access';
  if (t.includes('340b')) return '340B';
  if (t.includes('gpo') || t.includes('idn strategy')) return 'GPO/IDN Strategy';
  if (t.includes('contracting') || t.includes('contract pricing')) return 'Contracting & Pricing';
  if (t.includes('patient access') || t.includes('access lead')) return 'Access & Reimbursement';
  if (t.includes('market access') || t.includes('payer') || t.includes('reimburs') || t.includes('value and access') || t.includes('value & access') || t.includes('enterprise employer access') || / p&r\b/.test(t) || t.includes('pricing & reimbursement') || t.includes('pricing and reimbursement') || t.includes('business access manager')) return 'Payer Strategy';

  // ── Medical Affairs ───────────────────────────────────────────────────────
  if (t.includes('medical science liaison') || / msl\b/.test(t)) return 'Medical Science Liaisons (MSLs)';
  if (t.includes('scientific writer') || t.includes('medical writer') || t.includes('medical writing')) return 'Medical Communications';
  if (t.includes('speaker program') || t.includes('speakers program') || t.includes('speaker bureau')) return 'Medical Education';
  if (t.includes('expert engagement') || t.includes('kol ') || t.includes('key opinion leader')) return 'Advisory Boards';
  if (t.includes('disease area strategist') || t.includes('disease area partner') || t.includes('disease area expert')) return 'Medical Affairs';
  if (t.includes('medical communications') || t.includes('med comms')) return 'Medical Communications';
  if (t.includes('medical information') || t.includes('pharmaceutical information') || t.includes('pharmaceutical info')) return 'Medical Information';
  if (t.includes('publication')) return 'Publication Planning';
  if (t.includes('advisory board')) return 'Advisory Boards';
  if (t.includes('evidence generation')) return 'Evidence Generation';
  if (t.includes('scientific affairs')) return 'Scientific Affairs';
  if (t.includes('medical education marketing')) return 'Medical Education Marketing';
  if (t.includes('medical education') || t.includes('professional education')) return 'Medical Education';
  if (t.includes('medical director') || t.includes('medical officer') || t.includes('medical intern') || t.includes('medical advisor')) return 'Medical Affairs';
  if (t.includes('medical review') && !t.includes('promotional')) return 'Medical Affairs';
  if (t.includes('nurse educator') || t.includes('field nurse') || t.includes('duchenne nurse')) return 'Medical Education';
  if (t.includes('medical affairs')) return 'Medical Affairs';

  // ── Clinical Development ─────────────────────────────────────────────────
  if (t.includes('biostatistics') || t.includes('biostats') || t.includes('statistical') || (t.includes('modeling') && t.includes('simulation')) || t.includes('statistician') || t.includes('pharmacometrics') || t.includes('quantitative pharmacology') || t.includes('systems pharmacology')) return 'Biostatistics';
  if (t.includes('pharmacokinetics') || t.includes('pk/pd') || t.includes('dmpk') || t.includes('d-m-p-k')) return 'Pharmacokinetics';
  if (t.includes('clinical pharmacology')) return 'Clinical Pharmacology';
  if (t.includes('clinical data')) return 'Clinical Data Management';
  if (t.includes('patient recruitment') || t.includes('patient finding') || t.includes('patient enrollment')) return 'Patient Recruitment';
  if (t.includes('ecoa') || t.includes('eCOA') || t.includes('study delivery') || t.includes('centralized study') || t.includes('local study') || t.includes('centralized monitor') || t.includes('central monitor')) return 'Clinical Operations';
  if (t.includes('study start') || t.includes('site start') || t.includes('site activation') || /\bcra\b/.test(t) || t.includes('clinical research associate') || /\bcta\b/.test(t) || t.includes('clinical trial assistant') || t.includes('patient & site') || t.includes('site engagement')) return 'Clinical Operations';
  if (t.includes('trial delivery') || t.includes('trial manager') || t.includes('global trial') || t.includes('country study manager') || /\bctm\b/.test(t)) return 'Clinical Project Management';
  if (t.includes('essential document') || t.includes('trial associate') || t.includes('study coordinator')) return 'Clinical Operations';
  if (t.includes('biospecimen') || t.includes('bio-specimen')) return 'Clinical Operations';
  if (t.includes('study data') || t.includes('data deliver')) return 'Clinical Data Management';
  if (t.includes('clinical project') || t.includes('clinical program')) return 'Clinical Project Management';
  if (t.includes('clinical operations') || t.includes('clinical ops')) return 'Clinical Operations';
  if (t.includes('clinical')) return 'Clinical Operations';

  // ── Regulatory Affairs ───────────────────────────────────────────────────
  if (t.includes('pharmacovigilance') || t.includes('drug safety') || t.includes('patient safety') || /\bpv\b/.test(t) || t.includes('risk management') && t.includes('medical') || t.includes('local case intake') || t.includes('case intake') || t.includes('global safety officer') || t.includes('safety officer') || /\bdspv\b/.test(t) || t.includes('medical safety lead')) return 'Pharmacovigilance/Drug Safety';
  if (t.includes('ctr submission') || t.includes('submission specialist') || t.includes('submission lead')) return 'Submissions';
  if (t.includes('transparency reporting') || t.includes('global transparency')) return 'Compliance';
  if (t.includes('labeling')) return 'Labeling';
  if (t.includes('cmc regulatory') || t.includes('cmc reg')) return 'CMC Regulatory';
  if (t.includes('regulatory operations') || t.includes('reg ops')) return 'Regulatory Operations';
  if (t.includes('international regulatory')) return 'International Regulatory';
  if (t.includes('regulatory') || t.includes('réglementaire') || t.includes('reglementaire')) return 'Regulatory Strategy';

  // ── Commercial Operations ────────────────────────────────────────────────
  if (t.includes('commercial operations') || t.includes('commercial ops') || t.includes('awops') || /\bnpp\b/.test(t) && (t.includes('smm') || t.includes('bbu') || t.includes('cvrm'))) return 'Commercial Operations';
  if (t.includes('crm') || (t.includes('veeva') && !t.includes('veeva medical'))) return 'CRM Administration (Veeva)';

  // ── Marketing ────────────────────────────────────────────────────────────
  if (t.includes('omnichannel') || t.includes('omni-channel')) return 'Omnichannel Marketing';
  if (t.includes('digital marketing') || t.includes('web strategist')) return 'Digital Marketing';
  if (t.includes(' media ') && (t.includes('director') || t.includes('manager') || t.includes('associate director'))) return 'Campaign Management';
  if (t.includes('public affairs') || t.includes('corporate affairs') || t.includes('communications') && (t.includes('director') || t.includes('senior director') || t.includes('ceo'))) return 'Brand/Product Management';
  if (t.includes('customer experience')) return 'Customer Experience';
  if (t.includes('marketing operations')) return 'Marketing Operations';
  if (t.includes('hcp marketing') || (t.includes('hcp') && t.includes('senior manager'))) return 'HCP Marketing';
  if (t.includes('patient marketing')) return 'Patient Marketing';
  if (t.includes('promotional review') || / mlr\b/.test(t)) return 'Promotional Review (MLR)';
  if (t.includes('campaign') || t.includes('congress') && (t.includes('event') || t.includes('coordinator') || t.includes('manager')) || t.includes('events coordinator') || t.includes('event coordinator') || t.includes('content delivery manager')) return 'Campaign Management';
  if (t.includes('graphic designer') || t.includes('graphic design') || t.includes('visual designer') || t.includes('creative director')) return 'Brand/Product Management';
  if (t.includes('brand') || t.includes('product management') || t.includes('product manager')) return 'Brand/Product Management';
  if (t.includes('marketing')) return 'Brand/Product Management';

  // ── Research & Discovery ─────────────────────────────────────────────────
  if (t.includes('medicinal chemistry')) return 'Medicinal Chemistry';
  if (t.includes('translational') || t.includes('biomarker') || t.includes('companion diagnostic') || t.includes('precision medicine')) return 'Translational Medicine';
  if (t.includes('bioinformatics')) return 'Bioinformatics';
  if (t.includes('computational biology') || t.includes('computational')) return 'Computational Biology';
  if (t.includes('drug discovery') || t.includes('external innovation') || t.includes('small molecule') || t.includes('toxicolog')) return 'Drug Discovery';
  if (t.includes('molecular profiling') || t.includes('molecular biology')) return 'Translational Medicine';
  if (t.includes('post-doctoral') || t.includes('postdoctoral') || t.includes('post doctoral')) return 'Biology';
  if (t.includes('bioanalytical') || t.includes('bio-analytical') || t.includes('bioassay') || t.includes('bio-assay')) return 'Biology';
  if (t.includes('cell culture') || t.includes('cell therapy development')) return 'Biology';
  if (t.includes('scientist') && (t.includes('research') || t.includes('discovery') || t.includes('senior') || t.includes('principal'))) return 'Biology';
  if (t.includes('biology') || t.includes('biologist')) return 'Biology';
  if (t.includes('chemistry') || t.includes('chemist')) return 'Chemistry';

  // ── Manufacturing & Supply Chain ─────────────────────────────────────────
  if (t.includes('quality assurance') || /\bqa\b/.test(t) || /\bgqa\b/.test(t) || t.includes('quality documentation') || t.includes('quality associate') || t.includes('quality third parties') || t.includes('product complaint') || t.includes('quality manager') || t.includes('quality specialist')) return 'Quality Assurance';
  if (t.includes('quality control') || / qc\b/.test(t) || t.includes('quality inspector') || t.includes('hplc analyst') || t.includes('gerente de control de calidad')) return 'Quality Control';
  if (t.includes('validation')) return 'Validation';
  if (t.includes('supply chain') || t.includes('supply planning') || t.includes('transportation management') || t.includes('transport management') || t.includes('sap transportation') || t.includes('trade analyst') || t.includes('external planning lead')) return 'Supply Chain Planning';
  if (t.includes('logistics')) return 'Logistics';
  if (t.includes('procurement') || t.includes('category buyer') || t.includes('global buyer') || t.includes('strategic sourcing') || t.includes('supplier relationship') || t.includes('source to pay') || t.includes('s2p ')) return 'Procurement';
  if (t.includes('technical operations') || t.includes('tech ops')) return 'Technical Operations';
  if (t.includes('process development') || t.includes('analytical development') || t.includes('mbr designer') || t.includes('batch record') || t.includes('ctrs') || t.includes('business process architecture') || /\bmes\b/.test(t) && t.includes('architect') || t.includes('spray dried') || t.includes('spray-dried') || t.includes('dry products') || t.includes('drug product development') || t.includes('formulation development')) return 'Process Development';
  if (t.includes('process control') || t.includes('process automation') || t.includes('automation engineer')) return 'Technical Operations';
  if (t.includes('continuous improvement') || t.includes('facilities management') || t.includes('facility management')) return 'Technical Operations';
  if (t.includes('ehs') || t.includes('eh&s') || t.includes('environment health') || t.includes('environmental health') || t.includes('hard services') || t.includes('hard service') || t.includes('safety & environment') || t.includes('safety and environment')) return 'Technical Operations';
  if (t.includes('critical utilities') || t.includes('clean utility') || t.includes('occupational health') || t.includes('occupational safety') || /\bhse\b/.test(t)) return 'Technical Operations';
  if (t.includes('electrician') || t.includes('instrumentation') && t.includes('control') || t.includes('high voltage')) return 'Technical Operations';
  if (t.includes('pharmaceutical attendant') || t.includes('operador') || t.includes('operater')) return 'Manufacturing Sciences';
  if (t.includes('sterilization') || t.includes('sterilisation') || t.includes('sterility assurance')) return 'Manufacturing Sciences';
  if (t.includes('inspection management') || t.includes('inspection readiness')) return 'Quality Assurance';
  if (t.includes('mfg tech') || t.includes('shift lead') || t.includes('shift supervisor') || t.includes('préparateur') || t.includes('preparateur') || t.includes('assembler') || t.includes('monteur')) return 'Manufacturing Sciences';
  if (t.includes('ms&t') || t.includes('mst ') || t.includes('manufacturing science') || t.includes('msat') || t.includes('control room') || t.includes('c&q ') || (t.includes('commissioning') && t.includes('qualification'))) return 'Manufacturing Sciences';
  if (/\bts\/ms\b/.test(t) || /\bts ms\b/.test(t)) return 'Manufacturing Sciences';
  if (t.includes('sterile drug') || t.includes('drug product associate') || t.includes('sterile fill') || t.includes('drug substance') || t.includes('sterility steward')) return 'Manufacturing Sciences';
  if (t.includes('production associate') || t.includes('production operator') || t.includes('production technician')) return 'Manufacturing Sciences';
  // German/Austrian packaging/manufacturing titles
  if (t.includes('verpackung') || t.includes('techniker') && t.includes('fertigung')) return 'Manufacturing Sciences';
  if (t.includes('pilot plant') || t.includes('pilot-plant')) return 'Manufacturing Sciences';
  if (t.includes('pakiranje') || t.includes('mehanik') || t.includes('skladišče')) return 'Manufacturing Sciences';
  if (t.includes('packing') || t.includes('packaging') || t.includes('team leader') && t.includes('pack')) return 'Manufacturing Sciences';
  if (t.includes('production planner') || t.includes('materials management') || t.includes('material planning') || t.includes('demand planner') || t.includes('demand planning') || t.includes('planning & scheduling') || t.includes('planning and scheduling') || t.includes('planning systems') || t.includes('order management')) return 'Supply Chain Planning';
  if (t.includes('warehouse') || t.includes('distribution center') || t.includes('material handler') || t.includes('materials handler') || t.includes('customer fulfilment') || t.includes('customer fulfillment')) return 'Logistics';
  if (t.includes('manufactur')) return 'Manufacturing Sciences';
  if (t.includes('supply')) return 'Supply Chain Planning';

  // ── Finance ───────────────────────────────────────────────────────────────
  if (t.includes('fp&a') || t.includes('financial planning')) return 'FP&A';
  if (t.includes('commercial finance')) return 'Commercial Finance';
  if (t.includes('internal audit')) return 'Internal Audit';
  if (t.includes('treasury')) return 'Treasury';
  if (t.includes('business analyst') && t.includes('control')) return 'FP&A';
  if (t.includes('payroll') || t.includes('o2c') || t.includes('collections analyst')) return 'Accounting';
  if (t.includes('r2r') || t.includes('a2r') || t.includes('record to report') || t.includes('account to report') || t.includes('fair market value') || t.includes('fin. processes') || t.includes('financial processes')) return 'Accounting';
  if (t.includes('accounting') || t.includes('accountant')) return 'Accounting';
  if (t.includes('tax')) return 'Tax';
  if (t.includes('finance') || t.includes('pricing') || t.includes('finanzas') || t.includes('payment analyst') || t.includes('contas a pagar')) return 'FP&A';

  // ── Business Development & Strategy ──────────────────────────────────────
  if (t.includes('licensing') || t.includes('bd&l')) return 'Licensing & Acquisitions';
  if (t.includes('alliance management') || t.includes('vendor relationship') || t.includes('partnership lead') || t.includes('strategic partnership') || t.includes('resilience strategic')) return 'Alliance Management';
  if (t.includes('portfolio strategy') || t.includes('asset team lead') || t.includes('asset team leader') || t.includes('new product planning') || t.includes('new product introduction') || t.includes('portfolio manager') || t.includes('junior portfolio') || t.includes('po&t') || t.includes('po&amp;t') || t.includes('asset development')) return 'Portfolio Strategy';
  if (t.includes('pipeline valuation')) return 'Pipeline Valuation';
  if (t.includes('corporate development') || t.includes('search & evaluation') || t.includes('search and evaluation')) return 'Corporate Development';
  if (t.includes('investor relations') || t.includes('head of investor')) return 'Corporate Strategy';
  if (t.includes('advisory services') || t.includes('advisory service') || t.includes('strategic consultancy')) return 'Corporate Strategy';
  if (t.includes('corporate strategy') || t.includes('strategy')) return 'Corporate Strategy';
  if (t.includes('business development') || / bd\b/.test(t)) return 'Licensing & Acquisitions';

  // ── IT & Digital ──────────────────────────────────────────────────────────
  if (t.includes('data engineering') || t.includes('data engineer') || t.includes('data governance') || t.includes('data acquisition') || t.includes('master data management') || t.includes('cmdb') || t.includes('data steward')) return 'Data Engineering';
  if (t.includes('enterprise architect')) return 'Enterprise Architecture';  // catches 'architecture' AND 'architect'
  if (t.includes('digital health')) return 'Digital Health';
  if (t.includes('knowledge graph') || t.includes('data platform') || t.includes('ai platform') || t.includes('identity security') || t.includes('access management') || t.includes('workday') || t.includes('database design') || t.includes('data migration')) return 'Commercial IT';
  if (t.includes('machine learning') || t.includes('artificial intelligence') || t.includes('ai/ml') || t.includes('ai product') || t.includes('ai application') || t.includes('research ai') || t.includes('ai delivery') || t.includes('ai science') || t.includes('ai-enabled') || t.includes('ai enabled') || t.includes('ai innovation') || t.includes('ai architecture') || t.includes('ai native') || t.includes('ai-native') || / ai /.test(t) || /\bai,/.test(t)) return 'AI/ML';
  if (t.includes('cybersecurity') || t.includes('cyber security') || t.includes('cyber resilience') || t.includes('information security') || t.includes('product security') || t.includes('threat detection') || t.includes('cyber value') || t.includes('threat response') || t.includes('soc analyst') || t.includes('offensive security')) return 'Cybersecurity';
  if (t.includes('solutions architect') || t.includes('solution architect')) return 'Enterprise Architecture';
  if (t.includes('cloud') || t.includes('infrastructure') || t.includes('platform support') || t.includes('servicenow') || t.includes('business transformation') || t.includes('solutions support') || t.includes('operating system') || t.includes('technology leader') || t.includes('scrum master') || t.includes('anaplan') || t.includes('itot') || t.includes('it/ot')) return 'Commercial IT';
  if (t.includes('commercial it')) return 'Commercial IT';
  if (t.includes('veeva') || t.includes('crm/veeva')) return 'CRM/Veeva Administration';
  if (t.includes('digital') || t.includes('software') || t.includes('information technology') || t.includes('developer') || t.includes('engineer') && t.includes('application')) return 'Commercial IT';

  // ── HR & Talent ───────────────────────────────────────────────────────────
  if (t.includes('talent acquisition') || t.includes('recruiter') || t.includes('recruiting') || t.includes('talent community') || t.includes('talent management') || t.includes('recruitment experience')) return 'Talent Acquisition';
  if (t.includes('hr business partner') || t.includes('hrbp') || t.includes('people partner') || t.includes('people business partner') || t.includes('employer business') || t.includes('employment experience')) return 'HR Business Partners';
  if (t.includes('compensation') || t.includes('benefits') || t.includes('payroll')) return 'Compensation & Benefits';
  if (t.includes('learning') || t.includes('l&d') || t.includes('training system') || t.includes('gd training') || t.includes('leadership development') || /\btraining\b/.test(t) || t.includes('traineeprogramm') || t.includes('alternance') || t.includes('formation') && t.includes('relation')) return 'Learning & Development';
  if (t.includes('organizational effectiveness') || t.includes('reward lead') || t.includes('people experience') || t.includes('culture director') || t.includes('team effectiveness') || t.includes('culture &') || t.includes('culture and') || t.includes('people culture') || t.includes('change capabilities') || t.includes('change support') || t.includes('change management')) return 'Organizational Effectiveness';
  if (t.includes('human resources') || /\bhr\b/.test(t)) return 'HR Business Partners';

  // ── Legal & Compliance ────────────────────────────────────────────────────
  if (t.includes('privacy')) return 'Privacy';
  if (t.includes('third party risk') || t.includes('third-party risk')) return 'Compliance';
  if (t.includes('compliance')) return 'Compliance';
  if (t.includes('patent') || t.includes('intellectual property') || / ip\b/.test(t)) return 'IP/Patents';
  if (t.includes('healthcare law')) return 'Healthcare Law';
  if (t.includes('contracts') || t.includes('contract management')) return 'Contracts';
  if (t.includes('counsel') || t.includes('attorney') || t.includes('lawyer') || t.includes('litigation') || t.includes('legal') || t.includes('governance') || t.includes('securities law') || t.includes('healthcare law')) return 'Legal Counsel';

  // ── Patient Services & Access ─────────────────────────────────────────────
  if (t.includes('hub service') || t.includes('hub ')) return 'Hub Services';
  if (t.includes('specialty pharmacy') || t.includes('trade and pharmacy') || t.includes('pharmacy account') || t.includes('pharmacies et partenariat') || t.includes('coordinador nacional de farmacias') || t.includes('channel management') || t.includes('pharmacy support') || t.includes('pharmacy excellence') || t.includes('retail pharmacy') || t.includes('distributor partnership') || t.includes('pharmacy & distribution') || t.includes('pharmacy and distribution')) return 'Specialty Pharmacy Relations';
  if (t.includes('patient advocacy')) return 'Patient Advocacy';
  if (t.includes('case manager') || t.includes('case management')) return 'Patient Support Programs';
  if (t.includes('patient centricity') || t.includes('patient solutions') || t.includes('patient program') || t.includes('patient experience design') || t.includes('patient experience') || t.includes('market transformation') && t.includes('patient') || t.includes('psp coordinator') || t.includes('patient engagement partner') || t.includes('communications & patient') || t.includes('communications and patient')) return 'Patient Support Programs';
  if (t.includes('patient support') || t.includes('patient service')) return 'Patient Support Programs';

  // ── Corporate & General Management ───────────────────────────────────────
  if (t.includes('executive assistant') || t.includes('executive admin') || t.includes('administrative assistant') || t.includes('administrative coordinator') || t.includes('admin coordinator') || t.includes('office manager') || t.includes('office coordinator') || t.includes('secretar') || t.includes('shareholder services')) return 'Executive & Administrative Support';
  if (t.includes('real estate') || t.includes('facilities manager') || t.includes('facilities director') || t.includes('workplace') || t.includes('space planning') || t.includes('site services') || t.includes('hard services')) return 'Real Estate & Facilities';
  if (t.includes('corporate communications') || t.includes('internal communications') || t.includes('employee communications') || t.includes('public relations') || t.includes('corporate affairs') && !t.includes('government')) return 'Corporate Communications';
  if (t.includes('corporate security') || t.includes('physical security') || t.includes('site security') || t.includes('global security')) return 'Corporate Security';
  if (t.includes('health, safety') || t.includes('health and safety') || t.includes('environment, health') || t.includes('ehs manager') || t.includes('hse manager') || t.includes('hse director') || t.includes('hse lead')) return 'Health, Safety & Environment';
  if (t.includes('general manager') || t.includes('general management') || t.includes('country manager') || t.includes('country director') || t.includes('site director') || t.includes('site head') || t.includes('managing director') || t.includes('chief of staff')) return 'General Management';

  // ── Tier 1 broad fallbacks → existing categories ─────────────────────────
  if (t.includes('engineer') || t.includes('automation') || t.includes('technician') || t.includes('maintenance')) return 'Technical Operations';
  if (t.includes('operations') || t.includes('operation ') || t.includes('operative') || t.includes('operator')) return 'Technical Operations';
  if (t.includes('laboratory') || t.includes('lab assistant') || t.includes('lab technician')) return 'Quality Control';
  if (t.includes('scientist') || t.includes('researcher') || t.includes('research associate')) return 'Biology';
  if (t.includes('manager') && t.includes('medical')) return 'Medical Affairs';
  if (t.includes('program management') || t.includes('program manager') || t.includes('programme manager') || t.includes('project management') || t.includes('strategic enablement pmo') || t.includes('pmo') && t.includes('manager')) return 'Clinical Project Management';
  // Broad medical catch — any remaining "medical" title goes to Medical Affairs
  if (t.includes('medical') || t.includes('physician') || /\bmd\b/.test(t) || /\brn\b/.test(t)) return 'Medical Affairs';
  // Broad sales/commercial — director/manager with commercial TA context
  if ((t.includes('director') || t.includes('manager') || t.includes('lead')) && (t.includes('oncol') || t.includes('hematol') || t.includes('cardio') || t.includes('immuno') || t.includes('neuro') || t.includes('rare') || t.includes('respiratory') || t.includes('dermat'))) return 'Field Sales';
  // Broad research catch
  if (t.includes('research') || t.includes('science') || t.includes('biology') || t.includes('lab ') || /\blab\b/.test(t)) return 'Biology';
  // Broad analyst catch → Commercial Analytics
  if (t.includes('analyst') || t.includes('analysis')) return 'Commercial Analytics';
  // Broad coordinator/associate catch by context
  if ((t.includes('coordinator') || t.includes('associate') || t.includes('specialist') || t.includes('manager') || t.includes('director')) && t.includes('commercial')) return 'Commercial Operations';
  if ((t.includes('coordinator') || t.includes('specialist')) && (t.includes('quality') || t.includes('gmp'))) return 'Quality Assurance';
  if ((t.includes('coordinator') || t.includes('manager') || t.includes('associate')) && (t.includes('supply') || t.includes('logistics') || t.includes('warehouse'))) return 'Supply Chain Planning';
  if (t.includes('nurse') || t.includes('health care') || t.includes('healthcare') && t.includes('professional')) return 'Medical Affairs';

  // ── Tier 2: "Other / [Group]" — ordered most-specific first ─────────────
  // Legal (lawyer/attorney/counsel before any broad commercial catch)
  if (t.includes('patent') || t.includes('intellectual property') || t.includes('contract') || t.includes('compliance') || t.includes('privacy')) return 'Other / Legal & Compliance';
  // Finance (specific finance terms before broad business)
  if (t.includes('finance') || t.includes('financ') || t.includes('accounting') || t.includes('accountant') || t.includes('treasury') || t.includes('budget') || t.includes('audit') || t.includes('tax') || t.includes('fiscal') || t.includes('payroll') || t.includes('payment') || t.includes('invoice')) return 'Other / Finance';
  // HR (people/employee terms before commercial)
  if (/\bhr\b/.test(t) || t.includes('human resources') || t.includes('talent') || t.includes('recruit') || t.includes('employee') || t.includes('workforce') || t.includes('people ops') || t.includes('wellbeing') || t.includes('benefits') || t.includes('compensation') || t.includes('payroll')) return 'Other / HR & Talent';
  // IT & Digital (tech terms before data which could be analytics)
  if (t.includes('software') || t.includes('technology') || t.includes('infrastructure') || t.includes('cybersec') || t.includes('network') || /\bit\b/.test(t) || t.includes('system admin') || t.includes('helpdesk') || t.includes('erp') || t.includes('sap') && !t.includes('sap transportation')) return 'Other / IT & Digital';
  // Patient Services (patient before medical/clinical)
  if (t.includes('patient support') || t.includes('patient service') || t.includes('hub service') || t.includes('specialty pharmacy') || t.includes('patient advocacy') || t.includes('patient access')) return 'Other / Patient Services & Access';
  // Pharmacovigilance / Drug Safety (safety before regulatory)
  if (t.includes('safety') && (t.includes('drug') || t.includes('adverse') || t.includes('pharmacovigil') || t.includes('signal')) || t.includes('pharmacovigil')) return 'Other / Regulatory Affairs';
  // Regulatory Affairs
  if (t.includes('regulat') || t.includes('submission') || t.includes('labeling') || t.includes('dossier') || t.includes('cmc') || t.includes('réglementaire')) return 'Other / Regulatory Affairs';
  // Clinical Development
  if (t.includes('clinical') || t.includes('trial') || t.includes('protocol') || t.includes('investigator') || t.includes('site management') || t.includes('study start')) return 'Other / Clinical Development';
  // Medical Affairs
  if (t.includes('medical') || t.includes('physician') || t.includes('msl') || t.includes('medical science') || t.includes('medical affairs')) return 'Other / Medical Affairs';
  // Research & Discovery
  if (t.includes('research') || t.includes('biolog') || t.includes('chemistry') || t.includes('chemist') || t.includes('discover') || t.includes('lab ') || t.includes('laboratory') || t.includes('scientist') || t.includes('in vivo') || t.includes('in vitro')) return 'Other / Research & Discovery';
  // Manufacturing & Supply Chain
  if (t.includes('manufactur') || t.includes('quality') || t.includes('supply chain') || t.includes('logistics') || t.includes('production') || t.includes('plant') || t.includes('warehouse') || t.includes('materials') || t.includes('procurement') || t.includes('gmp')) return 'Other / Manufacturing & Supply Chain';
  // Market Access
  if (t.includes('market access') || t.includes('payer') || t.includes('reimburs') || t.includes('government affairs') || t.includes('formulary') || t.includes('health economics')) return 'Other / Market Access & Pricing';
  // Business Development & Strategy (strategy/corporate before general commercial)
  if (t.includes('strategy') || t.includes('business development') || t.includes('licensing') || t.includes('portfolio') || t.includes('alliance') || t.includes('mergers') || t.includes('acquisition') || t.includes('corporate development')) return 'Other / Business Development & Strategy';
  // Analytics & Insights
  if (t.includes('analyt') || t.includes('insight') || t.includes('intelligence') || t.includes('forecast') || t.includes('reporting') || t.includes('data science') || t.includes('data analyst')) return 'Other / Commercial Analytics & Insights';
  // Marketing
  if (t.includes('marketing') || t.includes('brand') || t.includes('campaign') || t.includes('content') || t.includes('communications') || t.includes('media') || t.includes('advertising')) return 'Other / Marketing';
  // Commercial Operations (broad sales/commercial catch)
  if (t.includes('sales') || t.includes('commercial') || t.includes('revenue') || t.includes('customer') || t.includes('account')) return 'Other / Commercial Operations';
  // Project Management
  if (t.includes('project manager') || t.includes('project management') || t.includes('program manager') || t.includes('program director') || t.includes('program team lead') || t.includes('program lead') || t.includes('launch excellence') || t.includes('pmo ') || t.includes('delivery lead') && !t.includes('data')) return 'Project Management';
  // Corporate & General Management (admin, facilities, intern, coordinator without other context)
  if (t.includes('admin') || t.includes('assistant') || t.includes('coordinator') || t.includes('facilities') || t.includes('real estate') || t.includes('intern') || t.includes('trainee') || t.includes('co-op') || t.includes('aprendiz') || t.includes('stagiair') || t.includes('pasante') || t.includes('jovem') || t.includes('junior') && !t.includes('portfolio')) return 'Other / Corporate & General Management';

  return 'Other';  // true last resort — genuinely unclassifiable
}
// ══════════════════════════════════════════
// NEWS PAGE
// ══════════════════════════════════════════
const TOPICS = ['Company News','Industry','Pipeline','Regulatory','M&A','Earnings'];
const TOPIC_LABELS = { 'Company News':'Company Press Releases', Industry:'Industry Headlines', Pipeline:'Pipeline & Approvals', Regulatory:'Regulatory & FDA', 'M&A':'M&A & Deals', Earnings:'Earnings & Finance' };
let newsLoaded = false;
let newsArticles = [];

const NEWS_COMPANY_MAP = [
  { label:'AbbVie',              terms:['abbvie'] },
  { label:'Alnylam',             terms:['alnylam'] },
  { label:'Amgen',               terms:['amgen'] },
  { label:'Argenx',              terms:['argenx'] },
  { label:'AstraZeneca',         terms:['astrazeneca','astra zeneca'] },
  { label:'Bayer',               terms:['bayer'] },
  { label:'Boehringer Ingelheim', terms:['boehringer ingelheim','boehringer-ingelheim','boehringer'] },
  { label:'Ipsen',               terms:['ipsen'] },
  { label:'Otsuka',             terms:['otsuka'] },
  { label:'Biogen',              terms:['biogen'] },
  { label:'BioNTech',            terms:['biontech'] },
  { label:'Bristol Myers Squibb',terms:['bristol myers squibb','bristol-myers','bms'] },
  { label:'Daiichi Sankyo',      terms:['daiichi sankyo','daiichi-sankyo'] },
  { label:'Eli Lilly',           terms:['eli lilly',' lilly ','lilly\'s'] },
  { label:'Gilead',              terms:['gilead'] },
  { label:'GSK',                 terms:[' gsk ','glaxosmithkline','gsk\'s'] },
  { label:'J&J / Janssen',       terms:['johnson & johnson','johnson and johnson','janssen','j&j'] },
  { label:'Merck',               terms:[' merck ',' msd ','merck\'s'] },
  { label:'Moderna',             terms:['moderna'] },
  { label:'Novo Nordisk',        terms:['novo nordisk','novonordisk'] },
  { label:'Novartis',            terms:['novartis'] },
  { label:'Pfizer',              terms:['pfizer'] },
  { label:'Regeneron',           terms:['regeneron'] },
  { label:'Roche / Genentech',   terms:['roche','genentech'] },
  { label:'Sanofi',              terms:['sanofi'] },
  { label:'Takeda',              terms:['takeda'] },
  { label:'Vertex',              terms:['vertex pharmaceuticals','vertex pharma'] },
];

const NEWS_TA_MAP = [
  { label:'Oncology',            terms:['oncol','cancer','tumor','tumour','leukemia','lymphoma','myeloma','carcinoma','solid tumor'] },
  { label:'Immunology',          terms:['autoimmune','rheumatoid','lupus','psoriasis','inflammatory bowel','crohn','ulcerative colitis','il-','jak inhibitor','immunolog'] },
  { label:'Rare Disease',        terms:['rare disease','orphan drug','cystic fibrosis',' sma ','duchenne','gaucher','hemophilia','rare genetic'] },
  { label:'Neuroscience',        terms:['alzheimer','parkinson','multiple sclerosis',' ms ','epilepsy','depression','schizophrenia','migraine','neurolog','dementia','cognitive'] },
  { label:'Cardiovascular',      terms:['cardiovascular','heart failure','atrial fibrill','hypertension','stroke','atheroscler','lipid-lowering','coronary'] },
  { label:'Infectious Disease',  terms:['infectious',' hiv ','hepatitis','covid','sars-cov','influenza',' flu ','rsv vaccine','antiviral','antibiotic','antimicrobial','vaccine'] },
  { label:'Metabolic / Obesity', terms:['diabetes','obesity','glp-1','weight loss','metabolic','nafld','nash','insulin','tirzepatide','semaglutide'] },
  { label:'Gene & Cell Therapy', terms:['gene therapy','cell therapy','car-t','car t','aav vector','crispr','mrna therapy','rna therapy','base editing'] },
  { label:'Respiratory',         terms:['respiratory','copd','asthma','pulmonary fibrosis','lung disease'] },
];

function tagArticle(a) {
  const text = (' ' + (a.title || '') + ' ' + (a.summary || '') + ' ').toLowerCase();
  // If article came from a company-specific feed, use that directly; otherwise keyword-match
  if (a.company) {
    a._cos = [a.company];
  } else {
    a._cos = NEWS_COMPANY_MAP.filter(c => c.terms.some(t => text.includes(t))).map(c => c.label);
  }
  a._tas = NEWS_TA_MAP.filter(t => t.terms.some(k => text.includes(k))).map(t => t.label);
  return a;
}

function renderNews() {
  const container = document.getElementById('news-container');
  if (!container) return;
  const coFilter = document.getElementById('news-filter-co')?.value || '';
  const taFilter = document.getElementById('news-filter-ta')?.value || '';

  let filtered = newsArticles;
  if (coFilter) filtered = filtered.filter(a => a._cos.includes(coFilter));
  if (taFilter) filtered = filtered.filter(a => a._tas.includes(taFilter));

  if (!filtered.length) {
    container.innerHTML = `<div class="fetch-empty"><div class="fetch-empty-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div><div class="fetch-empty-title">No articles match your filters</div><div class="fetch-empty-sub">Try clearing the filters to see all headlines.</div></div>`;
    return;
  }

  const byTopic = {};
  TOPICS.forEach(t => byTopic[t] = []);
  filtered.forEach(a => { if (byTopic[a.topic]) byTopic[a.topic].push(a); });

  const newsCardHTML = a => `
    <a class="news-card" href="${esc(a.url)}" target="_blank" rel="noopener">
      <div class="news-card-meta"><span class="news-source">${esc(a.source)}</span><span class="news-date">${esc(a.date)}</span></div>
      <div class="news-card-title">${esc(a.title)}</div>
      ${a.summary ? `<div class="news-card-summary">${esc(a.summary)}</div>` : ''}
    </a>`;

  container.innerHTML = TOPICS.filter(t => byTopic[t].length).map(t => {
    if (t === 'Company News') {
      // Group by company, show each company's releases as a named sub-section
      const byCompany = {};
      byTopic[t].forEach(a => {
        const co = a.company || (a._cos && a._cos[0]) || a.source || 'Other';
        if (!byCompany[co]) byCompany[co] = [];
        byCompany[co].push(a);
      });
      const companySections = Object.entries(byCompany)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([co, articles]) => `
          <div class="news-co-group">
            <div class="news-co-group-label">${esc(co)}</div>
            <div class="news-cards">${articles.slice(0, 4).map(newsCardHTML).join('')}</div>
          </div>`).join('');
      return `
        <div class="news-section">
          <div class="news-section-title">${esc(TOPIC_LABELS[t])}</div>
          ${companySections}
        </div>`;
    }
    return `
      <div class="news-section">
        <div class="news-section-title">${esc(TOPIC_LABELS[t])}</div>
        <div class="news-cards">${byTopic[t].slice(0, 8).map(newsCardHTML).join('')}
        </div>
      </div>`;
  }).join('');
}

function populateNewsFilters() {
  const coSel = document.getElementById('news-filter-co');
  const taSel = document.getElementById('news-filter-ta');
  if (!coSel || !taSel) return;

  // Only show companies/TAs that appear in at least one article
  const activeCos = new Set(newsArticles.flatMap(a => a._cos));
  const activeTas = new Set(newsArticles.flatMap(a => a._tas));

  coSel.innerHTML = '<option value="">All Companies</option>' +
    NEWS_COMPANY_MAP.filter(c => activeCos.has(c.label)).map(c => `<option value="${esc(c.label)}">${esc(c.label)}</option>`).join('');
  taSel.innerHTML = '<option value="">All Therapeutic Areas</option>' +
    NEWS_TA_MAP.filter(t => activeTas.has(t.label)).map(t => `<option value="${esc(t.label)}">${esc(t.label)}</option>`).join('');
  coSel.disabled = false;
  taSel.disabled = false;
}

async function preloadNews() {
  if (newsLoaded || newsArticles.length) return; // already loaded
  try {
    const res = await fetch('/.netlify/functions/news');
    if (!res.ok) return;
    const articles = await res.json();
    if (!articles.length) return;
    newsArticles = articles.map(tagArticle);
    // Re-render library cards now that news is available
    if (currentView === 'library') renderCompanyIntelligence();
  } catch { /* silent fail */ }
}

export async function loadNews() {
  if (newsLoaded) return;
  const container = document.getElementById('news-container');
  const statusEl = document.getElementById('news-status');
  const btn = document.getElementById('btn-news-refresh');
  if (!container) return;
  btn.disabled = true;
  btn.classList.add('spinning');
  statusEl.className = 'fetch-status loading';
  statusEl.textContent = 'Loading latest headlines…';
  container.innerHTML = skeletons(6);
  try {
    let articles;
    if (newsArticles.length) {
      articles = newsArticles;
    } else {
      const res = await fetch('/.netlify/functions/news');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      articles = await res.json();
      if (!articles.length) throw new Error('No articles returned');
      newsArticles = articles.map(tagArticle);
    }
    populateNewsFilters();
    renderNews();
    statusEl.className = 'fetch-status success';
    statusEl.textContent = `✓ ${articles.length} articles loaded · ${new Date().toLocaleTimeString()}`;
    newsLoaded = true;
  } catch(e) {
    statusEl.className = 'fetch-status error';
    statusEl.textContent = `✗ Failed to load news: ${e.message}`;
    container.innerHTML = '<div class="fetch-empty"><div class="fetch-empty-title">Could not load news</div><div class="fetch-empty-sub">Check your connection and try again.</div></div>';
  }
  btn.disabled = false;
  btn.classList.remove('spinning');
}

function exportRolesCSV() { const list = pfizer_filtered.length ? pfizer_filtered : all_jobs; if (!list.length) { showToast('No roles loaded — fetch first'); return; } const headers = ['Company', 'Title', 'Department', 'Location', 'Posted', 'URL']; const rows = list.map(r => [r.company, r.title, r.dept, r.location, r.posted, r.url].map(v => '"' + (String(v || '').replace(/"/g, '""')) + '"')); const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n'); const blob = new Blob([csv], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `pharma-jobs-${todayStr()}.csv`; a.click(); URL.revokeObjectURL(a.href); showToast(`Exported ${list.length} roles to CSV`); }
export function skeletons(n) { return Array(n).fill(0).map(() => `<div class="role-skeleton"><div class="skel-line" style="width:25%;height:10px;margin-bottom:6px"></div><div class="skel-line" style="width:60%;height:16px"></div><div class="skel-line" style="width:35%;height:11px;margin-top:10px"></div><div class="skel-line" style="width:45%;height:11px"></div></div>`).join(''); }

// ══════════════════════════════════════════
// INITIALIZE APP
// ══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Sort companies by star before anything renders
  FETCH_COMPANIES.sort((a, b) => {
    const aStar = starredCos.has(a.name) ? 1 : 0;
    const bStar = starredCos.has(b.name) ? 1 : 0;
    if (aStar !== bStar) return bStar - aStar;
    return a.name.localeCompare(b.name);
  });

  // Gate everything behind auth + subscription check
  initAuth(async () => {
    const cnt = document.getElementById('lib-count');
    if (cnt) cnt.textContent = FETCH_COMPANIES.length;
    const libBadge = document.getElementById('lib-badge');
    if (libBadge) libBadge.textContent = FETCH_COMPANIES.length;
    const liveCount = document.getElementById('live-roles-count');
    if (liveCount) liveCount.textContent = FETCH_COMPANIES.length;
    const liveBadge = document.getElementById('live-badge');
    if (liveBadge) liveBadge.textContent = 'Live';
    buildCompanyCheckboxes();

    // Load jobs: try cloud first, fall back to localStorage
    // If localStorage has data but cloud doesn't, migrate it up
    const cloudLoaded = await loadJobsFromCloud();
    if (!cloudLoaded) {
      loadJobs(); // localStorage fallback
      if (jobs.length > 0) saveJobsToCloud(); // migrate existing data to cloud
    }

    renderTracker();
    updateHomeCards();
    initCachedLibrary();

    // Show welcome toast after successful Stripe checkout redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      setTimeout(() => showToast('🎉 Subscription active — welcome to bioboard.io!'), 600);
      history.replaceState({}, '', window.location.pathname);
    }
  });
});

// ══════════════════════════════════════════
// COMMUNITY
// ══════════════════════════════════════════
function communityUser() {
  const u = getUser();
  if (!u) return null;
  const meta = u.user_metadata || {};
  return meta.full_name || meta.name || u.email.split('@')[0];
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return Math.floor(s/86400) + 'd ago';
}

async function submitWin(e) {
  e.preventDefault();
  const name = communityUser();
  if (!name) return;
  const company = document.getElementById('win-company').value.trim();
  const role    = document.getElementById('win-role').value.trim();
  const message = document.getElementById('win-message').value.trim();
  const btn = e.target.querySelector('button');
  btn.disabled = true; btn.textContent = 'Posting…';
  const { error } = await supabase.from('job_wins').insert({ user_id: getUser().id, display_name: name, company, role, message });
  if (error) { showToast('Error posting win'); btn.disabled = false; btn.textContent = '🎉 Post My Win'; return; }
  e.target.reset();
  btn.disabled = false; btn.textContent = '🎉 Post My Win';
  showToast('🎉 Win posted!');
  loadWins();
}

async function loadWins() {
  const container = document.getElementById('wins-container');
  if (!container) return;
  container.innerHTML = '<div class="community-loading">Loading…</div>';
  const { data, error } = await supabase.from('job_wins').select('*').order('created_at', { ascending: false }).limit(50);
  if (error || !data?.length) { container.innerHTML = '<div class="community-empty">No wins yet — be the first to post!</div>'; return; }
  container.innerHTML = data.map(w => `
    <div class="win-card">
      <div class="win-header">
        <div class="win-avatar">${w.display_name[0].toUpperCase()}</div>
        <div>
          <div class="win-name">${esc(w.display_name)}</div>
          <div class="win-meta">${esc(w.role)} · ${esc(w.company)}</div>
        </div>
        <div class="win-time">${timeAgo(w.created_at)}</div>
      </div>
      ${w.message ? `<div class="win-message">${esc(w.message)}</div>` : ''}
    </div>`).join('');
}

async function submitPost(e) {
  e.preventDefault();
  const name = communityUser();
  if (!name) return;
  const message  = document.getElementById('post-message').value.trim();
  const category = document.getElementById('post-category').value;
  const btn = e.target.querySelector('button');
  btn.disabled = true; btn.textContent = 'Posting…';
  const { error } = await supabase.from('community_posts').insert({ user_id: getUser().id, display_name: name, message, category });
  if (error) { showToast('Error posting'); btn.disabled = false; btn.textContent = 'Post'; return; }
  e.target.reset();
  btn.disabled = false; btn.textContent = 'Post';
  showToast('Post published!');
  loadPosts();
}

async function loadPosts() {
  const container = document.getElementById('posts-container');
  if (!container) return;
  container.innerHTML = '<div class="community-loading">Loading…</div>';
  const category = document.getElementById('post-category-filter')?.value || '';
  let query = supabase.from('community_posts').select('*').order('created_at', { ascending: false }).limit(100);
  if (category) query = query.eq('category', category);
  const { data, error } = await query;
  if (error || !data?.length) { container.innerHTML = '<div class="community-empty">No posts yet — start the conversation!</div>'; return; }
  container.innerHTML = data.map(p => `
    <div class="post-card">
      <div class="post-header">
        <div class="win-avatar">${p.display_name[0].toUpperCase()}</div>
        <div>
          <div class="win-name">${esc(p.display_name)}</div>
          <div class="win-meta">${esc(p.category)} · ${timeAgo(p.created_at)}</div>
        </div>
      </div>
      <div class="post-body">${esc(p.message)}</div>
    </div>`).join('');
}

// ══════════════════════════════════════════
// WINDOW MAPPINGS
// ══════════════════════════════════════════
window.switchView = switchView;
window.exportCSV = exportCSV;
window.openModal = openModal;
window.closeModal = closeModal;
window.clearSearchBar = clearSearchBar;
window.updateClearBtn = updateClearBtn;
window.renderTracker = renderTracker;
window.openPanel = openPanel;
window.closePanel = closePanel;
window.savePanel = savePanel;
window.addInterview = addInterview;
window.removeInterview = removeInterview;
window.editJob = editJob;
window.saveJob = saveJob;
window.deleteJob = deleteJob;
window.renderLibrary = renderLibrary;
window.renderCompanyIntelligence = renderCompanyIntelligence;
window.toggleStar = toggleStar;
window.setLibView = setLibView;
window.toggleCoSelect = toggleCoSelect;
window.selectAllCompanies = selectAllCompanies;
window.selectNoneCompanies = selectNoneCompanies;
window.fetchAllCompanyJobs = fetchAllCompanyJobs;
window.clearRoleFilters = clearRoleFilters;
window.renderRoles = renderRoles;
window.exportRolesCSV = exportRolesCSV;
window.addRoleToTracker = addRoleToTracker;
window.updateJobStage = updateJobStage;
window.forceRefreshBaseline = forceRefreshBaseline;
window.loadNews = () => { newsLoaded = false; loadNews(); };
window.submitWin  = submitWin;
window.submitPost = submitPost;
window.loadWins   = loadWins;
window.loadPosts  = loadPosts;
window.renderNews = renderNews;

window.tFilters = tFilters;
try { Object.defineProperty(window, 'panelJobId', { get: () => panelJobId, configurable: true }); } catch(e) {}