import {
  STAGES, jobs, editId, tFilters, panelJobId,
  saveJobs, loadJobs, loadJobsFromCloud, saveJobsToCloud,
  setJobs, setEditId, setPanelJobId, resetTFilters
} from './store.js';

import { initAuth, signInWithGoogle, signOut, startCheckout, manageSubscription } from './auth.js';
window.rxSignInWithGoogle      = signInWithGoogle;
window.rxSignOut               = signOut;
window.rxStartCheckout         = startCheckout;
window.rxManageSubscription    = manageSubscription;

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
  ['home', 'tracker', 'library', 'liveroles', 'news'].forEach(id => {
    document.getElementById('view-' + id).classList.toggle('active', v === id);
  });
  ['tracker', 'library', 'liveroles', 'news'].forEach(id => {
    const el = document.getElementById('tab-' + id);
    if (el) el.classList.toggle('active', v === id);
  });
  const btn = document.getElementById('header-action');
  btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Role';
  btn.onclick = openModal;
  if (v === 'library') { renderLibrary(); preloadNews(); }
  if (v === 'tracker') renderTracker();
  if (v === 'home') updateHomeCards();
  if (v === 'news') loadNews();
}

function updateHomeCards() {
  const trackerBadge = document.getElementById('home-tracker-badge');
  if (trackerBadge) trackerBadge.textContent = jobs.length + (jobs.length === 1 ? ' role tracked' : ' roles tracked');
  const libBadge = document.getElementById('home-lib-badge');
  if (libBadge) libBadge.textContent = FETCH_COMPANIES.length + ' companies';
  const rolesBadge = document.getElementById('home-roles-badge');
  if (rolesBadge) rolesBadge.textContent = all_jobs.length > 0 ? all_jobs.length + ' roles loaded' : 'Fetch to load';
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
  a.download = `rxpipeline-${todayStr()}.csv`;
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
// ══════════════════════════════════════════
export function buildFilters() {
  const companies = [...new Set(all_jobs.map(j => j.company).filter(Boolean))].sort();
  const countries = [...new Set(all_jobs.map(j => {
    if (!j.location) return null;
    const parts = j.location.split(',');
    return parts[parts.length - 1].trim();
  }).filter(Boolean))].sort();
  const presentFuncs = new Set(all_jobs.map(j => inferFunc(j.title, j.dept || '')).filter(Boolean));
  const funcOptgroups = FUNC_GROUPS
    .filter(g => g.items.some(i => presentFuncs.has(i)) || presentFuncs.has(g.group))
    .map(g => {
      const presentItems = g.items.filter(i => presentFuncs.has(i));
      return `<optgroup label="${esc(g.group)}"><option value="${esc(g.group)}">— All ${esc(g.group)} —</option>${presentItems.map(i => `<option value="${esc(i)}">${esc(i)}</option>`).join('')}</optgroup>`;
    }).join('');
  document.getElementById('r-company').innerHTML = '<option value="">All Companies</option>' + companies.map(d => `<option>${esc(d)}</option>`).join('');
  document.getElementById('r-func').innerHTML = '<option value="">All Functions</option>' + funcOptgroups + '<option value="Other">Other / Unclassified</option>';
  document.getElementById('r-loc').innerHTML = '<option value="">All Countries</option>' + countries.map(c => `<option>${esc(c)}</option>`).join('');
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

function getFilteredRoles() {
  const q = (document.getElementById('r-search')?.value || '').toLowerCase(); 
  const areaFilter = document.getElementById('r-area')?.value || '';
  const funcFilter = document.getElementById('r-func')?.value || '';
  const co = document.getElementById('r-company')?.value || '';
  const country = document.getElementById('r-loc')?.value || '';
  return all_jobs.filter(r => {
    try {
      const area = r._area || inferArea(r.title || '', r.dept || '');
      const func = r._func || inferFunc(r.title || '', r.dept || '');
      const mQ = !q || (r.title||'').toLowerCase().includes(q) || (r.dept||'').toLowerCase().includes(q) || (r.location||'').toLowerCase().includes(q) || (r.company||'').toLowerCase().includes(q) || area.toLowerCase().includes(q);
      const mArea = !areaFilter || area === areaFilter;
      const mFunc = !funcFilter || func === funcFilter || FUNC_GROUP_MAP[func] === funcFilter;
      const mCountry = !country || (r.location || '').split(',').pop().trim() === country;
      return mQ && mArea && mFunc && (!co || r.company === co) && mCountry;
    } catch(e) { return false; }
  }).sort((a, b) => { try { return (b._dateMs||0) - (a._dateMs||0); } catch(e) { return 0; } });
}

function clearRoleFilters() { ['r-search', 'r-area', 'r-func', 'r-company', 'r-loc'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); document.getElementById('r-clear-btn').style.display = 'none'; renderRoles(); }

export function renderRoles() {
  const list = getFilteredRoles(); setPfizerFiltered(list); const container = document.getElementById('roles-container'); if (!container) return;
  const countEl = document.getElementById('r-count');
  const limit = 100;
  if (countEl) countEl.textContent = list.length > limit ? `Showing ${limit} of ${list.length} roles` : list.length + ' roles';
  const cb = document.getElementById('r-clear-btn'); if (cb) cb.style.display = (document.getElementById('r-search')?.value || document.getElementById('r-area')?.value || document.getElementById('r-func')?.value || document.getElementById('r-company')?.value || document.getElementById('r-dept')?.value || document.getElementById('r-loc')?.value) ? 'inline-flex' : 'none';
  if (!list.length && all_jobs.length > 0) { container.innerHTML = '<div class="roles-empty">No roles match your filters</div>'; return; }
  if (!list.length) return;
  const cards = list.slice(0, limit).map(r => { try { return roleCardHTML(r); } catch(e) { return ''; } }).join('');
  container.innerHTML = '<div class="roles-grid">' + cards + '</div>';
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

export function inferArea(title, dept) { const t = (title + ' ' + dept).toLowerCase(); if (t.includes('oncol')) return 'Oncology'; if (t.includes('rare')) return 'Rare Disease'; if (t.includes('immun') || t.includes('autoimmun')) return 'Immunology'; if (t.includes('neuro') || t.includes('cns')) return 'Neuroscience'; if (t.includes('cardio') || t.includes('heart')) return 'Cardiovascular'; if (t.includes('vaccin')) return 'Vaccines'; if (t.includes('metabol') || t.includes('endocrin')) return 'Metabolic / Endocrine'; if (t.includes('infectious')) return 'Infectious Disease'; if (t.includes('ophthal')) return 'Ophthalmology'; return 'Diversified'; }
function inferLevel(title) { const t = title.toLowerCase(); if (t.includes('chief') || t.includes('cso') || t.includes('coo')) return 'C-Suite'; if (t.includes('executive vice') || t.includes('evp') || t.includes('senior vice') || t.includes('svp')) return 'SVP / EVP'; if (t.includes('vice president') || t.includes(' vp ') || t.startsWith('vp ')) return 'VP'; if (t.includes('senior director')) return 'Senior Director'; if (t.includes('director')) return 'Director'; if (t.includes('senior manager')) return 'Senior Manager'; if (t.includes('manager')) return 'Manager'; if (t.includes('associate director')) return 'Associate Director'; if (t.includes('associate')) return 'Associate'; return 'Other'; }

export const FUNC_GROUPS = [
  { group: 'Commercial Operations', items: ['Sales Force Effectiveness', 'Field Sales', 'Commercial Operations', 'CRM Administration (Veeva)', 'Incentive Compensation', 'Field Force Deployment', 'Call Planning', 'Targeting & Segmentation', 'Commercial Training'] },
  { group: 'Marketing', items: ['Brand/Product Management', 'Omnichannel Marketing', 'Digital Marketing', 'Customer Experience', 'Marketing Operations', 'Campaign Management', 'Medical Education Marketing', 'HCP Marketing', 'Patient Marketing', 'Promotional Review (MLR)'] },
  { group: 'Market Access & Pricing', items: ['Payer Strategy', 'Reimbursement', 'HEOR', 'Formulary Access', 'Government Affairs', 'Contracting & Pricing', 'GPO/IDN Strategy', '340B', 'Access & Reimbursement'] },
  { group: 'Commercial Analytics & Insights', items: ['Forecasting', 'Commercial Analytics', 'Market Research', 'Competitive Intelligence', 'Integrated Insights & Strategy', 'Business Intelligence', 'Data Science', 'Real-World Evidence (RWE)', 'Performance Analytics'] },
  { group: 'Medical Affairs', items: ['Medical Science Liaisons (MSLs)', 'Medical Communications', 'Medical Information', 'Publication Planning', 'Advisory Boards', 'Evidence Generation', 'Medical Education', 'Scientific Affairs'] },
  { group: 'Clinical Development', items: ['Clinical Operations', 'Clinical Project Management', 'Clinical Data Management', 'Biostatistics', 'Clinical Pharmacology', 'Pharmacokinetics', 'Patient Recruitment'] },
  { group: 'Regulatory Affairs', items: ['Regulatory Strategy', 'Submissions', 'Labeling', 'CMC Regulatory', 'Regulatory Operations', 'International Regulatory', 'Pharmacovigilance/Drug Safety'] },
  { group: 'Research & Discovery', items: ['Biology', 'Chemistry', 'Medicinal Chemistry', 'Translational Medicine', 'Bioinformatics', 'Computational Biology', 'Drug Discovery'] },
  { group: 'Manufacturing & Supply Chain', items: ['Manufacturing Sciences', 'Quality Assurance', 'Quality Control', 'Validation', 'Supply Chain Planning', 'Logistics', 'Procurement', 'Technical Operations', 'Process Development'] },
  { group: 'Finance', items: ['FP&A', 'Commercial Finance', 'Business Development Finance', 'Accounting', 'Treasury', 'Tax', 'Internal Audit'] },
  { group: 'Business Development & Strategy', items: ['Corporate Strategy', 'Licensing & Acquisitions', 'Alliance Management', 'Portfolio Strategy', 'Pipeline Valuation', 'Corporate Development'] },
  { group: 'IT & Digital', items: ['Commercial IT', 'Data Engineering', 'Enterprise Architecture', 'Digital Health', 'CRM/Veeva Administration', 'AI/ML', 'Cybersecurity'] },
  { group: 'HR & Talent', items: ['Talent Acquisition', 'HR Business Partners', 'Compensation & Benefits', 'Learning & Development', 'Organizational Effectiveness'] },
  { group: 'Legal & Compliance', items: ['Legal Counsel', 'Privacy', 'Compliance', 'Contracts', 'IP/Patents', 'Healthcare Law'] },
  { group: 'Patient Services & Access', items: ['Patient Support Programs', 'Hub Services', 'Specialty Pharmacy Relations', 'Patient Advocacy', 'Access & Reimbursement'] },
];

export const FUNC_GROUP_MAP = {};
FUNC_GROUPS.forEach(g => { FUNC_GROUP_MAP[g.group] = g.group; g.items.forEach(item => { FUNC_GROUP_MAP[item] = g.group; }); });

export function inferFunc(title, dept) {
  const t = (title + ' ' + dept).toLowerCase();

  // ── Sales (most common unclassified bucket) ──────────────────────────────
  if (t.includes('sales force effectiveness') || / sfe\b/.test(t)) return 'Sales Force Effectiveness';
  if (t.includes('customer facing effectiveness') || t.includes('customer-facing effectiveness')) return 'Sales Force Effectiveness';
  if (t.includes('incentive compensation')) return 'Incentive Compensation';
  if (t.includes('field force')) return 'Field Force Deployment';
  if (t.includes('call planning')) return 'Call Planning';
  if (t.includes('targeting') && t.includes('segmentation')) return 'Targeting & Segmentation';
  if (t.includes('commercial training')) return 'Commercial Training';
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
  // Spanish/Portuguese/Italian/Asian sales rep titles
  if (t.includes('representante') || t.includes('representant') || t.includes('propagand')) return 'Field Sales';
  if (t.includes('informatore scientifico') || t.includes('informador')) return 'Field Sales';
  if (t.includes('gestor') || t.includes('gestora')) return 'Field Sales';
  // MR / EMR (Medical Representative abbreviations used in Asia/EU)
  if (/\bemr\b/.test(t) || /\bmr\b/.test(t) && (t.includes('derm') || t.includes('oncol') || t.includes('gi') || t.includes('medical rep'))) return 'Field Sales';
  if (t.includes('medical representative') || t.includes('medical rep ')) return 'Field Sales';
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
  if (t.includes('thought leader liaison') || t.includes('tll ') || / tll\b/.test(t) || t.includes('field medical')) return 'Medical Science Liaisons (MSLs)';
  if (t.includes('market enablement') || t.includes('cbu operational') || t.includes('operational effectiveness') && t.includes('commercial')) return 'Commercial Operations';
  if (t.includes('sales') && (t.includes('manager') || t.includes('director') || t.includes('executive'))) return 'Field Sales';

  // ── Commercial Analytics & Insights ─────────────────────────────────────
  if (t.includes('forecast')) return 'Forecasting';
  if (t.includes('market research')) return 'Market Research';
  if (t.includes('competitive intel')) return 'Competitive Intelligence';
  if (t.includes('power bi') || t.includes('visualization') || t.includes('visualisation') || t.includes('business intelligence')) return 'Business Intelligence';
  if (t.includes('data science') || t.includes('data scientist')) return 'Data Science';
  if (t.includes('real-world') || t.includes('real world') || / rwe\b/.test(t) || / rwd\b/.test(t) || t.includes('real world data') || t.includes('observational research') || t.includes('observational study')) return 'Real-World Evidence (RWE)';
  if (t.includes('performance analytics')) return 'Performance Analytics';
  if (t.includes('integrated insights')) return 'Integrated Insights & Strategy';
  if (t.includes('domain enablement') || t.includes('discoverability')) return 'Business Intelligence';
  if (t.includes('insight') || t.includes('analytics') || t.includes('intelligence')) return 'Commercial Analytics';

  // ── Commercial Analytics & Insights (extra) ──────────────────────────────
  if (t.includes('epidemiolog')) return 'Real-World Evidence (RWE)';
  if (t.includes('heva') || t.includes('value & access') || t.includes('value and access')) return 'HEOR';
  if (t.includes('business systems analyst') || t.includes('bus sys analyst') || t.includes('is bus sys')) return 'Business Intelligence';
  if (t.includes('data integration') || t.includes('data integrations')) return 'Data Engineering';

  // ── Market Access & Pricing ──────────────────────────────────────────────
  if (t.includes('heor') || t.includes('health economics') || t.includes('outcomes research')) return 'HEOR';
  if (t.includes('government affairs') || t.includes('community liaison') || t.includes('community relations') || t.includes('external affairs') || t.includes('stakeholder engagement') && t.includes('sponsorship') || t.includes('strategic communications') && !t.includes('medical')) return 'Government Affairs';
  if (t.includes('formulary')) return 'Formulary Access';
  if (t.includes('340b')) return '340B';
  if (t.includes('gpo') || t.includes('idn strategy')) return 'GPO/IDN Strategy';
  if (t.includes('contracting') || t.includes('contract pricing')) return 'Contracting & Pricing';
  if (t.includes('patient access') || t.includes('access lead')) return 'Access & Reimbursement';
  if (t.includes('market access') || t.includes('payer') || t.includes('reimburs') || t.includes('value and access') || t.includes('value & access') || t.includes('enterprise employer access')) return 'Payer Strategy';

  // ── Medical Affairs ───────────────────────────────────────────────────────
  if (t.includes('medical science liaison') || / msl\b/.test(t)) return 'Medical Science Liaisons (MSLs)';
  if (t.includes('medical communications') || t.includes('med comms')) return 'Medical Communications';
  if (t.includes('medical information')) return 'Medical Information';
  if (t.includes('publication')) return 'Publication Planning';
  if (t.includes('advisory board')) return 'Advisory Boards';
  if (t.includes('evidence generation')) return 'Evidence Generation';
  if (t.includes('scientific affairs')) return 'Scientific Affairs';
  if (t.includes('medical education marketing')) return 'Medical Education Marketing';
  if (t.includes('medical education')) return 'Medical Education';
  if (t.includes('medical director') || t.includes('medical officer') || t.includes('medical intern') || t.includes('medical advisor')) return 'Medical Affairs';
  if (t.includes('medical review') && !t.includes('promotional')) return 'Medical Affairs';
  if (t.includes('nurse educator') || t.includes('field nurse') || t.includes('duchenne nurse')) return 'Medical Education';
  if (t.includes('medical affairs')) return 'Medical Affairs';

  // ── Clinical Development ─────────────────────────────────────────────────
  if (t.includes('biostatistics') || t.includes('biostats') || t.includes('statistical') || (t.includes('modeling') && t.includes('simulation')) || t.includes('statistician')) return 'Biostatistics';
  if (t.includes('pharmacokinetics') || t.includes('pk/pd') || t.includes('dmpk') || t.includes('d-m-p-k')) return 'Pharmacokinetics';
  if (t.includes('clinical pharmacology')) return 'Clinical Pharmacology';
  if (t.includes('clinical data')) return 'Clinical Data Management';
  if (t.includes('patient recruitment') || t.includes('patient finding') || t.includes('patient enrollment')) return 'Patient Recruitment';
  if (t.includes('study start') || t.includes('site activation') || /\bcra\b/.test(t) || t.includes('clinical research associate')) return 'Clinical Operations';
  if (t.includes('trial delivery') || t.includes('trial manager') || t.includes('global trial') || t.includes('country study manager')) return 'Clinical Project Management';
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
  if (t.includes('regulatory')) return 'Regulatory Strategy';

  // ── Commercial Operations ────────────────────────────────────────────────
  if (t.includes('commercial operations') || t.includes('commercial ops')) return 'Commercial Operations';
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
  if (t.includes('campaign') || t.includes('congress') && (t.includes('event') || t.includes('coordinator') || t.includes('manager')) || t.includes('events coordinator') || t.includes('event coordinator')) return 'Campaign Management';
  if (t.includes('brand') || t.includes('product management') || t.includes('product manager')) return 'Brand/Product Management';
  if (t.includes('marketing')) return 'Brand/Product Management';

  // ── Research & Discovery ─────────────────────────────────────────────────
  if (t.includes('medicinal chemistry')) return 'Medicinal Chemistry';
  if (t.includes('translational') || t.includes('biomarker') || t.includes('companion diagnostic')) return 'Translational Medicine';
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
  if (t.includes('quality assurance') || / qa\b/.test(t) || /\bgqa\b/.test(t) || t.includes('quality documentation') || t.includes('quality associate') || t.includes('quality third parties') || t.includes('product complaint')) return 'Quality Assurance';
  if (t.includes('quality control') || / qc\b/.test(t) || t.includes('quality inspector') || t.includes('hplc analyst') || t.includes('gerente de control de calidad')) return 'Quality Control';
  if (t.includes('validation')) return 'Validation';
  if (t.includes('supply chain') || t.includes('supply planning') || t.includes('transportation management') || t.includes('transport management') || t.includes('sap transportation')) return 'Supply Chain Planning';
  if (t.includes('logistics')) return 'Logistics';
  if (t.includes('procurement') || t.includes('category buyer') || t.includes('global buyer')) return 'Procurement';
  if (t.includes('technical operations') || t.includes('tech ops')) return 'Technical Operations';
  if (t.includes('process development')) return 'Process Development';
  if (t.includes('process control') || t.includes('process automation') || t.includes('automation engineer')) return 'Technical Operations';
  if (t.includes('continuous improvement') || t.includes('facilities management') || t.includes('facility management')) return 'Technical Operations';
  if (t.includes('ehs') || t.includes('eh&s') || t.includes('environment health') || t.includes('environmental health') || t.includes('hard services') || t.includes('hard service')) return 'Technical Operations';
  if (t.includes('critical utilities') || t.includes('clean utility') || t.includes('occupational health') || t.includes('hse') && (t.includes('senior') || t.includes('global') || t.includes('principal') || t.includes('director') || t.includes('associate'))) return 'Technical Operations';
  if (t.includes('electrician') || t.includes('instrumentation') && t.includes('control') || t.includes('high voltage')) return 'Technical Operations';
  if (t.includes('pharmaceutical attendant') || t.includes('operador') || t.includes('operater')) return 'Manufacturing Sciences';
  if (t.includes('sterilization') || t.includes('sterilisation')) return 'Manufacturing Sciences';
  if (t.includes('ms&t') || t.includes('mst ') || t.includes('manufacturing science')) return 'Manufacturing Sciences';
  if (/\bts\/ms\b/.test(t) || /\bts ms\b/.test(t)) return 'Manufacturing Sciences';
  if (t.includes('sterile drug') || t.includes('drug product associate') || t.includes('sterile fill') || t.includes('drug substance') || t.includes('sterility steward')) return 'Manufacturing Sciences';
  if (t.includes('production associate') || t.includes('production operator') || t.includes('production technician')) return 'Manufacturing Sciences';
  // German/Austrian packaging/manufacturing titles
  if (t.includes('verpackung') || t.includes('techniker') && t.includes('fertigung')) return 'Manufacturing Sciences';
  if (t.includes('pilot plant') || t.includes('pilot-plant')) return 'Manufacturing Sciences';
  if (t.includes('pakiranje') || t.includes('mehanik') || t.includes('skladišče')) return 'Manufacturing Sciences';
  if (t.includes('packing') || t.includes('packaging') || t.includes('team leader') && t.includes('pack')) return 'Manufacturing Sciences';
  if (t.includes('production planner') || t.includes('materials management') || t.includes('material planning')) return 'Supply Chain Planning';
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
  if (t.includes('accounting') || t.includes('accountant')) return 'Accounting';
  if (t.includes('tax')) return 'Tax';
  if (t.includes('finance') || t.includes('pricing')) return 'FP&A';

  // ── Business Development & Strategy ──────────────────────────────────────
  if (t.includes('licensing') || t.includes('bd&l')) return 'Licensing & Acquisitions';
  if (t.includes('alliance management')) return 'Alliance Management';
  if (t.includes('portfolio strategy') || t.includes('asset team lead') || t.includes('asset team leader') || t.includes('new product planning') || t.includes('new product introduction')) return 'Portfolio Strategy';
  if (t.includes('pipeline valuation')) return 'Pipeline Valuation';
  if (t.includes('corporate development')) return 'Corporate Development';
  if (t.includes('investor relations') || t.includes('head of investor')) return 'Corporate Strategy';
  if (t.includes('corporate strategy') || t.includes('strategy')) return 'Corporate Strategy';
  if (t.includes('business development') || / bd\b/.test(t)) return 'Licensing & Acquisitions';

  // ── IT & Digital ──────────────────────────────────────────────────────────
  if (t.includes('data engineering') || t.includes('data engineer') || t.includes('data governance') || t.includes('data acquisition') || t.includes('master data management') || t.includes('cmdb')) return 'Data Engineering';
  if (t.includes('enterprise architecture')) return 'Enterprise Architecture';
  if (t.includes('digital health')) return 'Digital Health';
  if (t.includes('machine learning') || t.includes('artificial intelligence') || t.includes('ai/ml') || t.includes('ai product') || t.includes('ai application') || t.includes('research ai') || t.includes('ai delivery') || t.includes('ai science') || t.includes('ai-enabled') || t.includes('ai enabled')) return 'AI/ML';
  if (t.includes('cybersecurity') || t.includes('cyber security') || t.includes('cyber resilience') || t.includes('information security') || t.includes('product security')) return 'Cybersecurity';
  if (t.includes('solutions architect') || t.includes('solution architect')) return 'Enterprise Architecture';
  if (t.includes('cloud') || t.includes('infrastructure') || t.includes('platform support') || t.includes('servicenow')) return 'Commercial IT';
  if (t.includes('commercial it')) return 'Commercial IT';
  if (t.includes('veeva') || t.includes('crm/veeva')) return 'CRM/Veeva Administration';
  if (t.includes('digital') || t.includes('software') || t.includes('information technology') || t.includes('developer') || t.includes('engineer') && t.includes('application')) return 'Commercial IT';

  // ── HR & Talent ───────────────────────────────────────────────────────────
  if (t.includes('talent acquisition') || t.includes('recruiter') || t.includes('recruiting') || t.includes('talent community') || t.includes('talent management') || t.includes('recruitment experience')) return 'Talent Acquisition';
  if (t.includes('hr business partner') || t.includes('hrbp') || t.includes('people partner') || t.includes('people business partner')) return 'HR Business Partners';
  if (t.includes('compensation') || t.includes('benefits') || t.includes('payroll')) return 'Compensation & Benefits';
  if (t.includes('learning') || t.includes('l&d') || t.includes('training system') || t.includes('gd training')) return 'Learning & Development';
  if (t.includes('organizational effectiveness')) return 'Organizational Effectiveness';
  if (t.includes('human resources') || / hr\b/.test(t)) return 'HR Business Partners';

  // ── Legal & Compliance ────────────────────────────────────────────────────
  if (t.includes('privacy')) return 'Privacy';
  if (t.includes('third party risk') || t.includes('third-party risk')) return 'Compliance';
  if (t.includes('compliance')) return 'Compliance';
  if (t.includes('patent') || t.includes('intellectual property') || / ip\b/.test(t)) return 'IP/Patents';
  if (t.includes('healthcare law')) return 'Healthcare Law';
  if (t.includes('contracts') || t.includes('contract management')) return 'Contracts';
  if (t.includes('legal')) return 'Legal Counsel';

  // ── Patient Services & Access ─────────────────────────────────────────────
  if (t.includes('hub service') || t.includes('hub ')) return 'Hub Services';
  if (t.includes('specialty pharmacy') || t.includes('trade and pharmacy') || t.includes('pharmacy account') || t.includes('pharmacies et partenariat') || t.includes('coordinador nacional de farmacias') || t.includes('channel management')) return 'Specialty Pharmacy Relations';
  if (t.includes('patient advocacy')) return 'Patient Advocacy';
  if (t.includes('case manager') || t.includes('case management')) return 'Patient Support Programs';
  if (t.includes('patient centricity') || t.includes('patient solutions') || t.includes('patient program') || t.includes('patient experience design') || t.includes('patient experience') || t.includes('market transformation') && t.includes('patient')) return 'Patient Support Programs';
  if (t.includes('patient support') || t.includes('patient service')) return 'Patient Support Programs';

  // ── Broad fallbacks ───────────────────────────────────────────────────────
  if (t.includes('engineer') || t.includes('automation') || t.includes('technician') || t.includes('maintenance')) return 'Technical Operations';
  if (t.includes('operations') || t.includes('operation ') || t.includes('operative') || t.includes('operator')) return 'Technical Operations';
  if (t.includes('laboratory') || t.includes('lab assistant') || t.includes('lab technician')) return 'Quality Control';
  if (t.includes('scientist') || t.includes('researcher') || t.includes('research associate')) return 'Biology';
  if (t.includes('manager') && t.includes('medical')) return 'Medical Affairs';
  if (t.includes('program management') || t.includes('program manager') || t.includes('programme manager') || t.includes('strategic enablement pmo') || t.includes('pmo') && t.includes('manager')) return 'Clinical Project Management';

  return 'Other';
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
      setTimeout(() => showToast('🎉 Subscription active — welcome to Rx Pipeline!'), 600);
      history.replaceState({}, '', window.location.pathname);
    }
  });
});

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
window.renderNews = renderNews;

window.tFilters = tFilters;
try { Object.defineProperty(window, 'panelJobId', { get: () => panelJobId, configurable: true }); } catch(e) {}