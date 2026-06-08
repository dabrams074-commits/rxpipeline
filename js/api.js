import { esc, showToast, skeletons, buildFilters, renderRoles, inferArea, inferFunc, inferCountry, parsePostedDate } from './main.js';
import { saveCachedJobs, loadCachedJobs, cachedLiveJobs, lastFetchTime } from './store.js';

export function sanitizeData(array) {
  if (!Array.isArray(array)) return array;
  return array.map(j => {
    const job = {
      id: j.id || j.ID || String(Math.random()),
      company: j.company || j.Company || '',
      title: j.title || j.Title || '',
      dept: j.dept || j.Department || j.Dept || '',
      location: j.location || j.Location || '',
      posted: j.posted || j.Posted || '',
      url: j.url || j.URL || j.Url || ''
    };
    return stamp(job);
  });
}

export const delay = ms => new Promise(res => setTimeout(res, ms));

// Parse location from Workday URL path slug.
// Triple-dash format: "United-States---New-York---New-York-City" → "United States, New York, New York City"
// Double-dash format: "Cambridge--Massachusetts" → "Cambridge, Massachusetts"
function _locFromPath(path) {
  if (!path) return '';
  const m = path.match(/\/job\/([^\/]+)\//);
  if (!m) return '';
  const slug = m[1];
  if (/multiple|various|global|worldwide/i.test(slug)) return '';
  if (slug.includes('---')) {
    // Triple-dash separates country/state/city; single dash = space within a word
    return slug.split('---').map(p => p.replace(/-/g, ' ')).join(', ');
  }
  // Double-dash separates city from state; single dash = space
  return slug.replace(/--/g, ', ').replace(/-/g, ' ');
}

function stamp(job) {
  // If location is vague ("5 Locations", "Multiple Locations", "Various", "Global"), try URL
  if (/^\d+\s+locations?$|multiple|various|global|worldwide|all locations/i.test((job.location || '').trim()) && job.url) {
    try {
      const pathname = new URL(job.url).pathname;
      const extracted = _locFromPath(pathname);
      if (extracted) job.location = extracted;
    } catch {}
  }
  job._area = inferArea(job.title, job.dept || '');
  job._func = inferFunc(job.title, job.dept || '');
  job._country = inferCountry(job.location || '');
  job._dateMs = parsePostedDate(job.posted);
  return job;
}

export const FETCH_COMPANIES = [
  // ── Large Pharma ──
  { name:'Pfizer',                  group:'Large Pharma',    ats:'Workday',   subdomain:'pfizer',                 tenant:'PfizerCareers',          wdNum:1 },
  { name:'Merck',                   group:'Large Pharma',    ats:'Workday',   subdomain:'msd',                    tenant:'SearchJobs',              wdNum:5 },
  { name:'Eli Lilly',               group:'Large Pharma',    ats:'Workday',   subdomain:'lilly',                  tenant:'LLY',                     wdNum:5 },
  { name:'AstraZeneca',             group:'Large Pharma',    ats:'Workday',   subdomain:'astrazeneca',            tenant:'Careers',                 wdNum:3 },
  { name:'Novartis',                group:'Large Pharma',    ats:'Workday',   subdomain:'novartis',               tenant:'Novartis_Careers',        wdNum:3 },
  { name:'GSK',                     group:'Large Pharma',    ats:'Jibe',      subdomain:'',                       tenant:'gsk',                     wdNum:0 },
  { name:'Amgen',                   group:'Large Pharma',    ats:'Workday',   subdomain:'amgen',                  tenant:'Careers',                 wdNum:1 },
  { name:'Sanofi',                  group:'Large Pharma',    ats:'Workday',   subdomain:'sanofi',                 tenant:'SanofiCareers',           wdNum:3 },
  { name:'BMS',                     group:'Large Pharma',    ats:'Workday',   subdomain:'bristolmyerssquibb',     tenant:'BMS',                     wdNum:5 },
  { name:'Takeda',                  group:'Large Pharma',    ats:'Workday',   subdomain:'takeda',                 tenant:'External',                wdNum:3 },
  { name:'AbbVie',                  group:'Large Pharma',    ats:'SmartRecruiters', subdomain:'', tenant:'AbbVie',               wdNum:0 },
  { name:'J&J',                     group:'Large Pharma',    ats:'Workday',   subdomain:'jj',                     tenant:'JJ',                      wdNum:5 },
  { name:'Roche',                   group:'Large Pharma',    ats:'Workday',   subdomain:'roche',                  tenant:'roche-ext',               wdNum:3 },
  // ── Large Biotech, Specialty & Established Brands ──
  { name:'Ipsen',                   group:'Large Biotech, Specialty & Established Brands', ats:'Workday',  subdomain:'ipsen',      tenant:'Ipsen_Careers', wdNum:103 },
  { name:'Otsuka',                  group:'Large Biotech, Specialty & Established Brands', ats:'Workday',  subdomain:'vhr-otsuka', tenant:'External',      wdNum:1, cxsId:'vhr_otsuka' },
  { name:'Regeneron',               group:'Large Biotech, Specialty & Established Brands', ats:'Workday',  subdomain:'regeneron',             tenant:'careers',                 wdNum:1 },
  { name:'Biogen',                  group:'Large Biotech, Specialty & Established Brands', ats:'Workday',  subdomain:'biibhr',                tenant:'external',                wdNum:3 },
  { name:'Gilead',                  group:'Large Biotech, Specialty & Established Brands', ats:'Workday',  subdomain:'gilead',                tenant:'gileadcareers',           wdNum:1 },
  { name:'Vertex',                  group:'Large Biotech, Specialty & Established Brands', ats:'Workday',  subdomain:'vrtx',                  tenant:'Vertex_Careers',          wdNum:501 },
  { name:'Moderna',                 group:'Large Biotech, Specialty & Established Brands', ats:'Workday',  subdomain:'modernatx',             tenant:'M_tx',                    wdNum:1 },
  { name:'United Therapeutics',     group:'Large Biotech, Specialty & Established Brands', ats:'Workday',  subdomain:'vhr-unither',           tenant:'External',                wdNum:5, cxsId:'vhr_unither' },
  { name:'Jazz Pharmaceuticals',    group:'Large Biotech, Specialty & Established Brands', ats:'Workday',  subdomain:'vhr-jazz',              tenant:'JazzPharmaceuticals',     wdNum:1, cxsId:'vhr_jazz' },
  { name:'Incyte',                  group:'Large Biotech, Specialty & Established Brands', ats:'Jibe',     subdomain:'',                      tenant:'incyte',                  wdNum:0 },
  // ── Biotech ──
  { name:'Alnylam',                 group:'Biotech',          ats:'Workday',  subdomain:'alnylam',               tenant:'Careers',                 wdNum:1 },
  { name:'Argenx',                  group:'Biotech',          ats:'Workday',  subdomain:'argenx',                tenant:'External_Careers',        wdNum:3 },
  { name:'Ascendis',                group:'Biotech',          ats:'Workable', subdomain:'',                      tenant:'ascendis-pharma',         wdNum:0 },
  { name:'Sarepta',                 group:'Biotech',          ats:'Workday',  subdomain:'sarepta',               tenant:'sarepta_external',        wdNum:5 },
  { name:'Ultragenyx',              group:'Biotech',          ats:'Workday',  subdomain:'ultra',                 tenant:'ultra-careers',           wdNum:3 },
  { name:'Insmed',                  group:'Biotech',          ats:'Workday',  subdomain:'insmed',                tenant:'external',                wdNum:5 },
  { name:'Blueprint Medicines',     group:'Biotech',          ats:'Greenhouse', subdomain:'', tenant:'blueprintmedicines', wdNum:0 },
  { name:'Cytokinetics',            group:'Biotech',          ats:'Workday',  subdomain:'cytokinetics',          tenant:'Cytokinetics',            wdNum:1 },
  { name:'Genmab',                  group:'Biotech',          ats:'Workday',  subdomain:'genmab',                tenant:'Genmab_Careers_Site',     wdNum:3 },
  { name:'Illumina',                group:'Biotech',          ats:'Workday',  subdomain:'illumina',              tenant:'illumina-careers',        wdNum:1 },
  { name:'Madrigal',                group:'Biotech',          ats:'Workday',  subdomain:'madrigalpharma',        tenant:'Madrigal',                wdNum:501 },
  { name:'Neurocrine',              group:'Biotech',          ats:'Workday',  subdomain:'neurocrine',            tenant:'Neurocrinecareers',       wdNum:5 },
  { name:'Natera',                  group:'Biotech',          ats:'Greenhouse', subdomain:'', tenant:'natera',   wdNum:0 },
  { name:'Protagonist',             group:'Biotech',          ats:'Greenhouse', subdomain:'', tenant:'protagonist', wdNum:0 },
  { name:'Nuvalent',                group:'Biotech',          ats:'Greenhouse', subdomain:'', tenant:'nuvalent', wdNum:0 },
  { name:'Disc Medicine',           group:'Biotech',          ats:'Greenhouse', subdomain:'', tenant:'discmedicine',           wdNum:0 },
  { name:'Iovance Biotherapeutics', group:'Biotech',          ats:'Greenhouse', subdomain:'', tenant:'iovancebiotherapeutics',    wdNum:0 },
  { name:'Viatris',                 group:'Large Biotech, Specialty & Established Brands', ats:'Workday', subdomain:'viatris', tenant:'External', wdNum:5 },
  // ── Biotech (additional) ──
  { name:'Acadia Pharmaceuticals',  group:'Biotech',          ats:'Greenhouse', subdomain:'', tenant:'acadiapharmaceuticals',  wdNum:0 },
  { name:'Exelixis',                group:'Biotech',          ats:'Workday',  subdomain:'exelixis',      tenant:'Exel',                    wdNum:1 },
  // { name:'Halozyme', group:'Biotech', ats:'Workday', subdomain:'halozyme', tenant:'halozymecareers', wdNum:1 }, // Blocked by Workday bot protection
  // ── CRO, Services & Medical Devices ──
  { name:'Becton Dickinson',        group:'CRO, Services & Medical Devices',   ats:'Workday',   subdomain:'bdx',                    tenant:'EXTERNAL_CAREER_SITE_USA', wdNum:1 },
  { name:'IQVIA',                   group:'CRO, Services & Medical Devices',   ats:'Workday',  subdomain:'iqvia',                 tenant:'IQVIA',                   wdNum:1 },
  { name:'Parexel',                 group:'CRO, Services & Medical Devices',   ats:'Workday',  subdomain:'parexel',               tenant:'Parexel_External_Careers', wdNum:1 },
  { name:'Lonza',                   group:'CRO, Services & Medical Devices',   ats:'Workday',  subdomain:'lonza',                 tenant:'Lonza_Careers',           wdNum:3 },
];

export let all_jobs = []; 
export let pfizer_filtered = [];
export let addedRoleSet = new Set(JSON.parse(localStorage.getItem('rxp-added-roles')||'[]'));
export let selectedCompanies = new Set(['Pfizer','Merck','Eli Lilly','Regeneron','Biogen','Gilead','Vertex','BMS']);

export function setPfizerFiltered(list) { pfizer_filtered = list; }
export function setAllJobs(list) { all_jobs = list; }

export function saveAddedRoles(){ try{ localStorage.setItem('rxp-added-roles', JSON.stringify([...addedRoleSet])); }catch(e){} }

export function buildCompanyCheckboxes(){
  const groups = [...new Set(FETCH_COMPANIES.map(c => c.group))];
  document.getElementById('company-checkboxes').innerHTML = groups.map(group => {
    const companies = FETCH_COMPANIES.filter(c => c.group === group);
    return `<div class="co-group-header">${esc(group)}</div>` +
      companies.map(c => `
        <div class="co-check-item ${selectedCompanies.has(c.name)?'selected':''}" id="cc-${c.name.replace(/[\s&/]/g,'-')}" onclick="toggleCoSelect('${c.name.replace(/'/g,"\\'")}',this)">
          <div class="co-check-box">${selectedCompanies.has(c.name)?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0d0f14" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>':''}</div>
          <div style="flex:1;min-width:0"><div class="co-check-name">${esc(c.name)}</div><div class="co-check-ats">${esc(c.ats)}</div></div>
          <div class="co-check-status" id="cs-${c.name.replace(/[\s&/]/g,'-')}"></div>
        </div>`).join('');
  }).join('');
}

export function toggleCoSelect(name, el){
  if(selectedCompanies.has(name)){ selectedCompanies.delete(name); el.classList.remove('selected'); el.querySelector('.co-check-box').innerHTML='';
  } else { selectedCompanies.add(name); el.classList.add('selected'); el.querySelector('.co-check-box').innerHTML='<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0d0f14" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'; }
  renderRoles();
}
export function selectAllCompanies(){ FETCH_COMPANIES.forEach(c=>{ selectedCompanies.add(c.name); const el = document.getElementById('cc-'+c.name.replace(/[\s&/]/g,'-')); if(el){ el.classList.add('selected'); el.querySelector('.co-check-box').innerHTML='<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0d0f14" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'; } }); renderRoles(); }
export function selectNoneCompanies(){ selectedCompanies.clear(); FETCH_COMPANIES.forEach(c=>{ const el = document.getElementById('cc-'+c.name.replace(/[\s&/]/g,'-')); if(el){ el.classList.remove('selected'); el.querySelector('.co-check-box').innerHTML=''; } }); renderRoles(); }

export async function fetchAllCompanyJobs(){
  const selected = FETCH_COMPANIES.filter(c=>selectedCompanies.has(c.name));
  if(!selected.length){ showToast('Select at least one company'); return; }
  const btn = document.getElementById('btn-fetch'); const statusEl = document.getElementById('fetch-status');
  const container = document.getElementById('roles-container'); const progressDiv = document.getElementById('fetch-progress');
  btn.disabled=true; btn.classList.add('spinning'); statusEl.className='fetch-status loading'; statusEl.textContent=`Fetching politely from ${selected.length} companies…`;
  container.innerHTML=skeletons(8); progressDiv.style.display='block'; all_jobs = [];

  let filtersBuilt = false;
  const liveRefresh = setInterval(() => {
    const n = all_jobs.length;
    if (n > 0) {
      statusEl.textContent = `Loading… ${n} jobs so far`;
      const sbRoles = document.getElementById('sb-roles');
      if (sbRoles) sbRoles.textContent = n;
      if (!filtersBuilt) { buildFilters(); renderRoles(); filtersBuilt = true; }
    }
  }, 1000);

  document.getElementById('progress-list').innerHTML = selected.map(c=>`
    <div class="progress-item" id="pi-${c.name.replace(/\s/g,'-')}">
      <div class="progress-label">${esc(c.name)}</div><div class="progress-bar-wrap"><div class="progress-bar-fill" id="pb-${c.name.replace(/\s/g,'-')}" style="width:0%"></div></div><div class="progress-count" id="pc-${c.name.replace(/\s/g,'-')}">—</div>
    </div>`).join('');

  let activeQueues = selected.map(c => ({
    company: c,
    offset: 0,
    total: null,
    done: false,
    key: c.name.replace(/\s/g,'-'),
    coStatusEl: document.getElementById('cs-'+c.name.replace(/\s/g,'-')),
    coCheckEl: document.getElementById('cc-'+c.name.replace(/\s/g,'-')),
    jobCount: 0
  }));

  activeQueues.forEach(q => {
    if(q.coStatusEl) q.coStatusEl.textContent = 'fetching...';
    if(q.coCheckEl) q.coCheckEl.classList.add('loading');
  });

  async function fetchQueue(q, index) {
    await delay(index * 200);
    let pages = 0;
    while(!q.done) {
      if (++pages > 150) { q.done = true; break; }
      try {
        if (q.company.ats === 'Workday') {
          const LIMIT = 20;
          const res = await fetch('/.netlify/functions/wd', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ subdomain: q.company.subdomain, wdNum: q.company.wdNum, tenant: q.company.tenant, cxsId: q.company.cxsId || null, limit: LIMIT, offset: q.offset, searchText:'', appliedFacets: {} }) });
          if(!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if(!data.jobPostings) throw new Error('No jobPostings');

          if(q.total === null) {
            q.total = data.total || data.jobPostings.length;
          }

          const jobs = data.jobPostings.map(j => normalizeJob(j, q.company));
          all_jobs = all_jobs.concat(jobs);
          q.jobCount += jobs.length;
          q.offset += LIMIT;

          setPBar(q.key, q.jobCount, q.total);

          if (data.jobPostings.length < LIMIT || q.offset >= q.total) {
            q.done = true;
          }
        } else if (q.company.ats === 'Jibe') {
          const LIMIT = 500;
          const res = await fetch(`/api/jibe/${q.company.tenant}?keywords=&lang=en-us&from=${q.offset}&num=${LIMIT}`);
          if(!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (q.total === null) q.total = data.totalCount || data.count || 0;
          const jobsArr = data.jobs || [];
          const fallbackUrl = q.company.tenant === 'gsk' ? 'https://jobs.gsk.com/en-gb/jobs' : `https://careers.${q.company.tenant}.com/jobs`;
          const jobs = jobsArr.map(j => {
            const d = j.data || j;
            const id = d.req_id || d.slug || String(Math.random());
            const posted = d.posted_date ? new Date(d.posted_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '';
            const loc = [d.city, d.state, d.country].filter(Boolean).join(', ');
            return stamp({ id: `${q.company.tenant}_${id}`, company: q.company.name, title: d.title||'', dept: (d.categories||[])[0]?.name||'', location: loc, posted, url: d.apply_url||d.canonical_url||fallbackUrl });
          });
          all_jobs = all_jobs.concat(jobs);
          q.jobCount += jobs.length;
          q.offset += jobs.length;
          setPBar(q.key, q.jobCount, q.total || q.jobCount);
          if(jobs.length < LIMIT || q.jobCount >= (q.total || 9999)) q.done = true;
        } else if (q.company.ats === 'SmartRecruiters') {
          const LIMIT = 100;
          const res = await fetch(`/api/smartrecruiters/${q.company.tenant}?limit=${LIMIT}&offset=${q.offset}`);
          if(!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if(q.total === null) q.total = data.totalFound || 0;
          const jobs = (data.content||[]).map(j=>stamp({ id: j.id||String(Math.random()), company: q.company.name, title: j.name||'', dept: j.department?.label||'', location: [j.location?.city, j.location?.country].filter(Boolean).join(', '), posted: j.releasedDate ? new Date(j.releasedDate).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '', url: j.id ? `https://jobs.smartrecruiters.com/${q.company.tenant}/${j.id}` : `https://jobs.smartrecruiters.com/${q.company.tenant}` }));
          all_jobs = all_jobs.concat(jobs);
          q.jobCount += jobs.length;
          q.offset += LIMIT;
          setPBar(q.key, q.jobCount, q.total);
          if(jobs.length < LIMIT || q.offset >= q.total) q.done = true;
        } else {
          let jobs = [];
          if (q.company.ats === 'Greenhouse') {
            const res = await fetch(`/api/greenhouse/${q.company.tenant}`); if(!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            jobs = (data.jobs||[]).map(j=>stamp({ id: String(j.id), company: q.company.name, title: j.title||'', dept: j.departments?.[0]?.name||'', location: j.location?.name||'', posted: j.updated_at ? new Date(j.updated_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '', url: j.absolute_url||`https://boards.greenhouse.io/${q.company.tenant}` }));
          } else if (q.company.ats === 'Workable') {
            const res = await fetch(`/api/workable/${q.company.tenant}`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ query: '' }) }); if(!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            jobs = (data.results||[]).map(j=>stamp({ id: j.shortcode||String(Math.random()), company: q.company.name, title: j.title||'', dept: j.department||'', location: [j.city, j.state, j.country].filter(Boolean).join(', '), posted: j.published_on ? new Date(j.published_on).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '', url: `https://apply.workable.com/${q.company.tenant}/j/${j.shortcode}/` }));
          }
          all_jobs = all_jobs.concat(jobs);
          q.jobCount += jobs.length;
          setPBar(q.key, q.jobCount, q.jobCount);
          q.done = true;
        }

        if (q.done) {
          if(q.coCheckEl) { q.coCheckEl.classList.remove('loading'); q.coCheckEl.classList.add('done'); }
          if(q.coStatusEl) q.coStatusEl.textContent = `${q.jobCount} / ${q.total || q.jobCount} loaded`;
        }

      } catch(e) {
        console.error(`Failed fetching ${q.company.name}:`, e);
        if(q.coCheckEl) { 
          q.coCheckEl.classList.remove('loading'); 
          if (q.jobCount === 0) q.coCheckEl.classList.add('error');
          else q.coCheckEl.classList.add('done');
        }
        const text = `${q.jobCount} / ${q.total || '?'} loaded`;
        if(q.coStatusEl) q.coStatusEl.textContent = text; 
        const pcEl = document.getElementById('pc-'+q.key);
        if(pcEl) pcEl.textContent = text;
        q.done = true;
      }
      
      await delay(250);
    }
  }

  await Promise.all(activeQueues.map((q, index) => fetchQueue(q, index)));

  clearInterval(liveRefresh);

  const successCount = activeQueues.filter(q => q.jobCount > 0).length;
  const count = all_jobs.length; 
  statusEl.className = count>0 ? 'fetch-status success' : 'fetch-status error';
  statusEl.textContent = count>0 ? `✓ ${count} jobs loaded from ${successCount} companies · ${new Date().toLocaleTimeString()}` : '✗ Fetch failed. Ensure _redirects file is active on your host.';

  if(count>0){ 
    buildFilters(); renderRoles(); 
    document.getElementById('sb-roles').textContent = count; 
    document.getElementById('live-roles-count').textContent = count; 
    document.getElementById('roles-footer').style.display='flex';
    await saveCachedJobs(all_jobs);
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="fetch-icon"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg> Refresh Live Jobs`;
  } else { 
    container.innerHTML = `<div class="fetch-empty"><div class="fetch-empty-title">Fetch failed</div><div class="fetch-empty-sub">Check the browser console or your API proxies.</div></div>`; 
  }
  btn.disabled=false; btn.classList.remove('spinning'); setTimeout(()=>{ progressDiv.style.display='none'; }, 3000);
}

export function setPBar(key, done, total){ const pct = total>0 ? Math.round((done/total)*100) : 100; const pb = document.getElementById('pb-'+key); const pc = document.getElementById('pc-'+key); if(pb) pb.style.width=pct+'%'; if(pc) pc.textContent = total>0 ? `${done}/${total}` : done+' jobs'; }

export function normalizeJob(j, c){
  const title = j.title||j.jobPostingTitle||'';
  // When Workday returns "5 Locations" as locationsText, use primaryLocation instead
  const rawLocText = j.locationsText || '';
  const locText = /^\d+\s+locations?$/i.test(rawLocText.trim()) ? '' : rawLocText;
  // primaryLocation may be a string or an object with a descriptor property
  const primaryLoc = typeof j.primaryLocation === 'string'
    ? j.primaryLocation
    : (j.primaryLocation?.descriptor || '');
  // locations[] array fallback — take first entry's descriptor
  const firstLocArr = Array.isArray(j.locations) && j.locations.length
    ? (typeof j.locations[0] === 'string' ? j.locations[0] : j.locations[0]?.descriptor || '')
    : '';
  // Last resort: parse city/state from the URL path slug
  const pathLoc = _locFromPath(j.externalPath || '');
  const loc = (locText || primaryLoc || firstLocArr || pathLoc || '').replace(/^\|+/,'').trim(); const dept = (j.jobCategory||j.categories?.[0]?.value||'').trim();
  let posted = j.postedOn || ''; if (posted && !posted.toLowerCase().includes('ago') && !posted.toLowerCase().includes('today')) { const d = new Date(posted); if(!isNaN(d)) posted = d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }
  const id = (j.bulletFields?.[1]||j.externalPath||String(Math.random())).replace(/\//g,'_'); const path = j.externalPath||'';
  let url = '';
  if (c.ats === 'Workday') {
    url = path ? `https://${c.subdomain}.wd${c.wdNum}.myworkdayjobs.com/en-US/${c.tenant}${path}` : `https://${c.subdomain}.wd${c.wdNum}.myworkdayjobs.com/${c.tenant}`;
  } else {
    url = j.absolute_url || path || `https://careers.${c.name.toLowerCase().replace(/\s/g,'')}.com`;
  }
  return stamp({ id:`${c.name}_${id}`, company: c.name, title, dept, location:loc, posted, url });
}

export async function forceRefreshBaseline() {
  showToast('Syncing...');
  try {
    const res = await fetch('./jobs-baseline.json');
    if (res.ok) {
      let data = await res.json();
      data = sanitizeData(data);
      all_jobs = data;
      await saveCachedJobs(data);
      buildFilters();
      renderRoles();
      const count = all_jobs.length;
      document.getElementById('sb-roles').textContent = count; 
      document.getElementById('live-roles-count').textContent = count; 
      document.getElementById('roles-footer').style.display='flex';
      const rCount = document.getElementById('r-count');
      if (rCount) rCount.textContent = count + ' roles';
      const statusEl = document.getElementById('fetch-status');
      if (statusEl) {
        statusEl.className = 'fetch-status success';
        statusEl.textContent = `✓ ${count} roles loaded`;
      }
    }
  } catch(e) {
    console.error('Force refresh failed:', e);
  }
}

// Set to true once baseline data is loaded but animation hasn't run yet
export let baselineAnimationPending = false;

export async function initCachedLibrary() {
  // ── 1. Load data silently in the background ───────────────────────────────
  await loadCachedJobs();
  let jobs = cachedLiveJobs && cachedLiveJobs.length >= 1000 ? sanitizeData(cachedLiveJobs) : null;

  if (!jobs || jobs.length === 0) {
    try {
      const res = await fetch('./jobs-baseline.json');
      if (res.ok) {
        jobs = sanitizeData(await res.json());
        await saveCachedJobs(jobs);
      }
    } catch (e) { console.error('Baseline load failed:', e); }
  }

  if (!jobs || jobs.length === 0) {
    const statusEl = document.getElementById('fetch-status');
    if (statusEl) { statusEl.className = 'fetch-status error'; statusEl.textContent = '✗ Could not load jobs. Try Refresh Live Jobs.'; }
    return;
  }

  all_jobs = jobs;

  // Update home badge immediately (visible on home tab)
  const homeRolesBadge = document.getElementById('home-roles-badge');
  if (homeRolesBadge) homeRolesBadge.textContent = jobs.length.toLocaleString() + ' roles loaded';
  const liveBadge = document.getElementById('live-badge');
  if (liveBadge) liveBadge.textContent = jobs.length;

  // ── 2. If Live Roles tab is already active, animate now; otherwise defer ──
  const liveRolesActive = document.getElementById('view-liveroles')?.classList.contains('active');
  if (liveRolesActive) {
    await playBaselineAnimation();
  } else {
    baselineAnimationPending = true;
  }
}

export async function playBaselineAnimation() {
  baselineAnimationPending = false;
  const total       = all_jobs.length;
  const container   = document.getElementById('roles-container');
  const statusEl    = document.getElementById('fetch-status');
  const progressDiv = document.getElementById('fetch-progress');
  const progressList = document.getElementById('progress-list');

  // Show skeletons while animating
  if (container) container.innerHTML = skeletons(8);
  if (statusEl) { statusEl.className = 'fetch-status loading'; statusEl.textContent = `Loading… 0 jobs`; }

  // ── Build per-company counts from loaded data ─────────────────────────────
  const companyCounts = {};
  for (const job of all_jobs) {
    companyCounts[job.company] = (companyCounts[job.company] || 0) + 1;
  }
  const companies = Object.entries(companyCounts)
    .sort((a, b) => b[1] - a[1]); // sort by count descending

  // Render per-company progress rows (all at 0% to start)
  if (progressDiv && progressList) {
    progressDiv.style.display = 'block';
    progressList.innerHTML = companies.map(([name, count]) => {
      const key = name.replace(/[\s&/]/g, '-');
      return `
        <div class="progress-item" id="pi-${key}">
          <div class="progress-label">${name}</div>
          <div class="progress-bar-wrap"><div class="progress-bar-fill" id="pb-${key}" style="width:0%"></div></div>
          <div class="progress-count" id="pc-${key}">0 / ${count}</div>
        </div>`;
    }).join('');
  }

  // ── Animate all bars filling up over 2–5 s ────────────────────────────────
  const duration =
    total < 4000  ? 2000 :
    total < 7000  ? 3000 :
    total < 10000 ? 4000 : 5000;

  const start = Date.now();
  await new Promise(resolve => {
    const tick = () => {
      const pct   = Math.min(1, (Date.now() - start) / duration);
      const shown = Math.round(pct * total);

      // Update status bar count
      if (statusEl) statusEl.textContent = `Loading… ${shown.toLocaleString()} jobs`;

      // Update each company bar
      for (const [name, count] of companies) {
        const key   = name.replace(/[\s&/]/g, '-');
        const pb    = document.getElementById('pb-' + key);
        const pc    = document.getElementById('pc-' + key);
        const done  = Math.round(pct * count);
        if (pb) pb.style.width = Math.round(pct * 100) + '%';
        if (pc) pc.textContent = `${done.toLocaleString()} / ${count.toLocaleString()}`;
      }

      if (pct >= 1) { resolve(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  // ── Render real results ───────────────────────────────────────────────────
  buildFilters();
  renderRoles();

  if (statusEl) { statusEl.className = 'fetch-status success'; statusEl.textContent = `✓ ${total.toLocaleString()} roles loaded`; }
  const sbRoles = document.getElementById('sb-roles');
  if (sbRoles) sbRoles.textContent = total;
  const liveCount = document.getElementById('live-roles-count');
  if (liveCount) liveCount.textContent = total;
  const footer = document.getElementById('roles-footer');
  if (footer) footer.style.display = 'flex';
  const rCount = document.getElementById('r-count');
  if (rCount) rCount.textContent = total.toLocaleString() + ' roles';
  const btn = document.getElementById('btn-fetch');
  if (btn) {
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg> Refresh Live Jobs`;
  }

  // Keep bars visible for 8 seconds so user can read them, then hide
  setTimeout(() => { if (progressDiv) progressDiv.style.display = 'none'; }, 8000);
}