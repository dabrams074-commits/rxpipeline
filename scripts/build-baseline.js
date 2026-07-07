#!/usr/bin/env node
// scripts/build-baseline.js
// Fetches all company jobs and writes public/jobs-baseline.json
// Run: node scripts/build-baseline.js
// Used by GitHub Actions to keep the baseline fresh (daily).

const fs   = require('fs');
const path = require('path');

const DELAY_MS  = 300;   // polite delay between companies
const LIMIT     = 20;    // Workday page size
const MAX_PAGES = 150;   // safety cap per company
const OUT_FILE  = path.join(__dirname, '..', 'public', 'jobs-baseline.json');
const META_FILE = path.join(__dirname, '..', 'public', 'jobs-baseline-meta.json');

const delay = ms => new Promise(r => setTimeout(r, ms));

// ── Company list — mirrors FETCH_COMPANIES in js/api.js ─────────────────────
// Jibe companies (GSK, Incyte) skipped — no public API
const COMPANIES = [
  // Large Pharma
  { name:'Pfizer',                  group:'Large Pharma',    ats:'Workday',        subdomain:'pfizer',                 tenant:'PfizerCareers',            wdNum:1 },
  { name:'Merck',                   group:'Large Pharma',    ats:'Workday',        subdomain:'msd',                    tenant:'SearchJobs',               wdNum:5 },
  // { name:'Eli Lilly', ... } — Blocked by Cloudflare bot protection on all server-side requests (same as Halozyme)

  { name:'AstraZeneca',             group:'Large Pharma',    ats:'Workday',        subdomain:'astrazeneca',            tenant:'Careers',                  wdNum:3 },
  { name:'Novartis',                group:'Large Pharma',    ats:'Workday',        subdomain:'novartis',               tenant:'Novartis_Careers',         wdNum:3 },
  { name:'Amgen',                   group:'Large Pharma',    ats:'Workday',        subdomain:'amgen',                  tenant:'Careers',                  wdNum:1 },
  { name:'Sanofi',                  group:'Large Pharma',    ats:'Workday',        subdomain:'sanofi',                 tenant:'SanofiCareers',            wdNum:3 },
  { name:'BMS',                     group:'Large Pharma',    ats:'Workday',        subdomain:'bristolmyerssquibb',     tenant:'BMS',                      wdNum:5 },
  { name:'Takeda',                  group:'Large Pharma',    ats:'Workday',        subdomain:'takeda',                 tenant:'External',                 wdNum:3 },
  { name:'AbbVie',                  group:'Large Pharma',    ats:'SmartRecruiters', tenant:'AbbVie' },
  { name:'J&J',                     group:'Large Pharma',    ats:'Workday',        subdomain:'jj',                     tenant:'JJ',                       wdNum:5 },
  { name:'Roche',                   group:'Large Pharma',    ats:'Workday',        subdomain:'roche',                  tenant:'roche-ext',                wdNum:3 },
  // Large Biotech, Specialty & Established Brands
  { name:'Ipsen',                   group:'Large Biotech',   ats:'Workday',        subdomain:'ipsen',                  tenant:'Ipsen_Careers',            wdNum:103 },
  { name:'Otsuka',                  group:'Large Biotech',   ats:'Workday',        subdomain:'vhr-otsuka',             tenant:'External',                 wdNum:1, cxsId:'vhr_otsuka' },
  { name:'Regeneron',               group:'Large Biotech',   ats:'Workday',        subdomain:'regeneron',              tenant:'careers',                  wdNum:1 },
  { name:'Biogen',                  group:'Large Biotech',   ats:'Workday',        subdomain:'biibhr',                 tenant:'external',                 wdNum:3 },
  { name:'Gilead',                  group:'Large Biotech',   ats:'Workday',        subdomain:'gilead',                 tenant:'gileadcareers',            wdNum:1 },
  { name:'Vertex',                  group:'Large Biotech',   ats:'Workday',        subdomain:'vrtx',                   tenant:'Vertex_Careers',           wdNum:501 },
  { name:'Moderna',                 group:'Large Biotech',   ats:'Workday',        subdomain:'modernatx',              tenant:'M_tx',                     wdNum:1 },
  { name:'United Therapeutics',     group:'Large Biotech',   ats:'Workday',        subdomain:'vhr-unither',            tenant:'External',                 wdNum:5, cxsId:'vhr_unither' },
  { name:'Jazz Pharmaceuticals',    group:'Large Biotech',   ats:'Workday',        subdomain:'vhr-jazz',               tenant:'JazzPharmaceuticals',      wdNum:1, cxsId:'vhr_jazz' },
  { name:'Viatris',                 group:'Large Biotech',   ats:'Workday',        subdomain:'viatris',                tenant:'External',                 wdNum:5 },
  // Biotech
  { name:'Alnylam',                 group:'Biotech',          ats:'Workday',        subdomain:'alnylam',                tenant:'Careers',                  wdNum:1 },
  { name:'Argenx',                  group:'Biotech',          ats:'Workday',        subdomain:'argenx',                 tenant:'External_Careers',         wdNum:3 },
  { name:'Ascendis',                group:'Biotech',          ats:'Workable',       tenant:'ascendis-pharma' },
  { name:'Sarepta',                 group:'Biotech',          ats:'Workday',        subdomain:'sarepta',                tenant:'sarepta_external',         wdNum:5 },
  { name:'Ultragenyx',              group:'Biotech',          ats:'Workday',        subdomain:'ultra',                  tenant:'ultra-careers',            wdNum:3 },
  { name:'Insmed',                  group:'Biotech',          ats:'Workday',        subdomain:'insmed',                 tenant:'external',                 wdNum:5 },
  { name:'Blueprint Medicines',     group:'Biotech',          ats:'Greenhouse',     tenant:'blueprintmedicines' },
  { name:'Cytokinetics',            group:'Biotech',          ats:'Workday',        subdomain:'cytokinetics',           tenant:'Cytokinetics',             wdNum:1 },
  { name:'Genmab',                  group:'Biotech',          ats:'Workday',        subdomain:'genmab',                 tenant:'Genmab_Careers_Site',      wdNum:3 },
  { name:'Illumina',                group:'Biotech',          ats:'Workday',        subdomain:'illumina',               tenant:'illumina-careers',         wdNum:1 },
  { name:'Madrigal',                group:'Biotech',          ats:'Workday',        subdomain:'madrigalpharma',         tenant:'Madrigal',                 wdNum:501 },
  { name:'Neurocrine',              group:'Biotech',          ats:'Workday',        subdomain:'neurocrine',             tenant:'Neurocrinecareers',        wdNum:5 },
  { name:'Natera',                  group:'Biotech',          ats:'Greenhouse',     tenant:'natera' },
  { name:'Protagonist',             group:'Biotech',          ats:'Greenhouse',     tenant:'protagonist' },
  { name:'Nuvalent',                group:'Biotech',          ats:'Greenhouse',     tenant:'nuvalent' },
  { name:'Disc Medicine',           group:'Biotech',          ats:'Greenhouse',     tenant:'discmedicine' },
  { name:'Iovance Biotherapeutics', group:'Biotech',          ats:'Greenhouse',     tenant:'iovancebiotherapeutics' },
  { name:'Acadia Pharmaceuticals',  group:'Biotech',          ats:'Greenhouse',     tenant:'acadiapharmaceuticals' },
  { name:'Exelixis',                group:'Biotech',          ats:'Workday',        subdomain:'exelixis',               tenant:'Exel',                     wdNum:1 },
  { name:'Verve Therapeutics',      group:'Biotech',          ats:'Greenhouse',     tenant:'verve' },
  { name:'Arvinas',                 group:'Biotech',          ats:'Greenhouse',     tenant:'arvinas' },
  { name:'Axsome Therapeutics',     group:'Biotech',          ats:'Greenhouse',     tenant:'axsometherapeutics' },
  { name:'Cogent Biosciences',      group:'Biotech',          ats:'Greenhouse',     tenant:'cogentbiosciences' },
  { name:'Apogee Therapeutics',     group:'Biotech',          ats:'Greenhouse',     tenant:'apogeetherapeutics' },
  { name:'Roivant Sciences',        group:'Biotech',          ats:'Greenhouse',     tenant:'roivantsciences' },
  { name:'Praxis Precision Medicines', group:'Biotech',       ats:'Greenhouse',     tenant:'praxis' },
  { name:'Replimune',               group:'Biotech',          ats:'Lever',          tenant:'replimune' },
  // CRO, Services & Medical Devices
  { name:'Becton Dickinson',        group:'Medical Devices',  ats:'Workday',        subdomain:'bdx',                    tenant:'EXTERNAL_CAREER_SITE_USA', wdNum:1 },
  { name:'IQVIA',                   group:'Medical Devices',  ats:'Workday',        subdomain:'iqvia',                  tenant:'IQVIA',                    wdNum:1 },
  { name:'Parexel',                 group:'Medical Devices',  ats:'Workday',        subdomain:'parexel',                tenant:'Parexel_External_Careers', wdNum:1 },
  { name:'Lonza',                   group:'Medical Devices',  ats:'Workday',        subdomain:'lonza',                  tenant:'Lonza_Careers',            wdNum:3 },
  { name:'Veracyte',                group:'Medical Devices',  ats:'Greenhouse',     tenant:'veracyte' },
  { name:'Dexcom',                  group:'Medical Devices',  ats:'Workday',        subdomain:'dexcom',                 tenant:'dexcom',                   wdNum:1 },
  { name:'Stryker',                 group:'Medical Devices',  ats:'Workday',        subdomain:'stryker',                tenant:'strykercareers',           wdNum:1 },
  { name:'Edwards Lifesciences',    group:'Medical Devices',  ats:'Workday',        subdomain:'edwards',                tenant:'edwardscareers',           wdNum:5 },
  { name:'Insulet',                 group:'Medical Devices',  ats:'Workday',        subdomain:'insulet',                tenant:'insuletcareers',           wdNum:5 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function locFromPath(p) {
  if (!p) return '';
  const m = p.match(/\/job\/([^\/]+)\//);
  if (!m) return '';
  const slug = m[1];
  if (/multiple|various|global|worldwide/i.test(slug)) return '';
  if (slug.includes('---')) return slug.split('---').map(s => s.replace(/-/g, ' ')).join(', ');
  return slug.replace(/--/g, ', ').replace(/-/g, ' ');
}

function normalizeWorkday(j, c) {
  const title = j.title || j.jobPostingTitle || '';
  const rawLocText = j.locationsText || '';
  const locText = /^\d+\s+locations?$/i.test(rawLocText.trim()) ? '' : rawLocText;
  const primaryLoc = typeof j.primaryLocation === 'string' ? j.primaryLocation : (j.primaryLocation?.descriptor || '');
  const firstLocArr = Array.isArray(j.locations) && j.locations.length ? (typeof j.locations[0] === 'string' ? j.locations[0] : j.locations[0]?.descriptor || '') : '';
  const pathLoc = locFromPath(j.externalPath || '');
  const loc = (locText || primaryLoc || firstLocArr || pathLoc || '').replace(/^\|+/, '').trim();
  const dept = (j.jobCategory || j.categories?.[0]?.value || '').trim();
  let posted = j.postedOn || '';
  if (posted && !posted.toLowerCase().includes('ago') && !posted.toLowerCase().includes('today')) {
    const d = new Date(posted);
    if (!isNaN(d)) posted = d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
  }
  const id = (j.bulletFields?.[1] || j.externalPath || String(Math.random())).replace(/\//g, '_');
  const exPath = j.externalPath || '';
  const url = exPath
    ? `https://${c.subdomain}.wd${c.wdNum}.myworkdayjobs.com/en-US/${c.tenant}${exPath}`
    : `https://${c.subdomain}.wd${c.wdNum}.myworkdayjobs.com/${c.tenant}`;
  return { id:`${c.name}_${id}`, company:c.name, title, dept, location:loc, posted, url };
}

// ── Fetchers ──────────────────────────────────────────────────────────────────
async function fetchWorkday(c) {
  const jobs = [];
  let offset = 0, total = null, pages = 0;
  const cxsId = c.cxsId || c.subdomain;
  const apiUrl = `https://${c.subdomain}.wd${c.wdNum}.myworkdayjobs.com/wday/cxs/${cxsId}/${c.tenant}/jobs`;
  while (pages++ < MAX_PAGES) {
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': `https://${c.subdomain}.wd${c.wdNum}.myworkdayjobs.com`,
          'Referer': `https://${c.subdomain}.wd${c.wdNum}.myworkdayjobs.com/${c.tenant}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: JSON.stringify({ limit: LIMIT, offset, searchText: '', appliedFacets: {} })
      });
      if (!res.ok) { console.warn(`  [${c.name}] HTTP ${res.status} at offset ${offset}`); break; }
      const data = await res.json();
      if (!data.jobPostings) break;
      if (total === null) total = data.total || data.jobPostings.length;
      jobs.push(...data.jobPostings.map(j => normalizeWorkday(j, c)));
      offset += LIMIT;
      process.stdout.write(`\r  [${c.name}] ${jobs.length}/${total}   `);
      if (data.jobPostings.length < LIMIT || offset >= total) break;
    } catch (e) { console.warn(`  [${c.name}] Error: ${e.message}`); break; }
    await delay(DELAY_MS);
  }
  console.log(`\r  [${c.name}] ✓ ${jobs.length} jobs`);
  return jobs;
}

async function fetchGreenhouse(c) {
  try {
    const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${c.tenant}/jobs?content=false`);
    if (!res.ok) { console.warn(`  [${c.name}] HTTP ${res.status}`); return []; }
    const data = await res.json();
    const jobs = (data.jobs || []).map(j => ({
      id: String(j.id),
      company: c.name,
      title: j.title || '',
      dept: j.departments?.[0]?.name || '',
      location: j.location?.name || '',
      posted: j.updated_at ? new Date(j.updated_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '',
      url: j.absolute_url || `https://boards.greenhouse.io/${c.tenant}`
    }));
    console.log(`  [${c.name}] ✓ ${jobs.length} jobs`);
    return jobs;
  } catch (e) { console.warn(`  [${c.name}] Error: ${e.message}`); return []; }
}

async function fetchLever(c) {
  try {
    const res = await fetch(`https://api.lever.co/v0/postings/${c.tenant}?mode=json`);
    if (!res.ok) { console.warn(`  [${c.name}] HTTP ${res.status}`); return []; }
    const data = await res.json();
    const jobs = (data || []).map(j => ({
      id: j.id || String(Math.random()),
      company: c.name,
      title: j.text || '',
      dept: j.categories?.team || '',
      location: j.categories?.location || '',
      posted: j.createdAt ? new Date(j.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '',
      url: j.hostedUrl || `https://jobs.lever.co/${c.tenant}`
    }));
    console.log(`  [${c.name}] ✓ ${jobs.length} jobs`);
    return jobs;
  } catch (e) { console.warn(`  [${c.name}] Error: ${e.message}`); return []; }
}

async function fetchWorkable(c) {
  try {
    const res = await fetch(`https://apply.workable.com/api/v3/accounts/${c.tenant}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '', location: [], department: [], worktype: [], remote: [] })
    });
    if (!res.ok) { console.warn(`  [${c.name}] HTTP ${res.status}`); return []; }
    const data = await res.json();
    const jobs = (data.results || []).map(j => ({
      id: j.shortcode || String(Math.random()),
      company: c.name,
      title: j.title || '',
      dept: j.department || '',
      location: [j.city, j.state, j.country].filter(Boolean).join(', '),
      posted: j.published_on ? new Date(j.published_on).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '',
      url: `https://apply.workable.com/${c.tenant}/j/${j.shortcode}/`
    }));
    console.log(`  [${c.name}] ✓ ${jobs.length} jobs`);
    return jobs;
  } catch (e) { console.warn(`  [${c.name}] Error: ${e.message}`); return []; }
}

async function fetchSmartRecruiters(c) {
  try {
    let jobs = [], offset = 0, limit = 100, total = null;
    while (true) {
      const res = await fetch(`https://api.smartrecruiters.com/v1/companies/${c.tenant}/postings?limit=${limit}&offset=${offset}`);
      if (!res.ok) { console.warn(`  [${c.name}] HTTP ${res.status}`); break; }
      const data = await res.json();
      if (total === null) total = data.totalFound || 0;
      const batch = (data.content || []).map(j => ({
        id: j.id || String(Math.random()),
        company: c.name,
        title: j.name || '',
        dept: j.department?.label || '',
        location: [j.location?.city, j.location?.region, j.location?.country].filter(Boolean).join(', '),
        posted: j.releasedDate ? new Date(j.releasedDate).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '',
        url: `https://jobs.smartrecruiters.com/${c.tenant}/${j.id}`
      }));
      jobs.push(...batch);
      offset += limit;
      process.stdout.write(`\r  [${c.name}] ${jobs.length}/${total}   `);
      if (batch.length < limit || offset >= total) break;
      await delay(DELAY_MS);
    }
    console.log(`\r  [${c.name}] ✓ ${jobs.length} jobs`);
    return jobs;
  } catch (e) { console.warn(`  [${c.name}] Error: ${e.message}`); return []; }
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n🔄 Building jobs-baseline.json — ${new Date().toISOString()}\n`);
  const allJobs = [];

  for (const c of COMPANIES) {
    try {
      let jobs = [];
      if      (c.ats === 'Workday')        jobs = await fetchWorkday(c);
      else if (c.ats === 'Greenhouse')     jobs = await fetchGreenhouse(c);
      else if (c.ats === 'Lever')          jobs = await fetchLever(c);
      else if (c.ats === 'Workable')       jobs = await fetchWorkable(c);
      else if (c.ats === 'SmartRecruiters') jobs = await fetchSmartRecruiters(c);
      else { console.log(`  [${c.name}] Skipping — ${c.ats} not supported`); continue; }
      allJobs.push(...jobs);
    } catch (e) {
      console.error(`  [${c.name}] Fatal: ${e.message}`);
    }
    await delay(DELAY_MS);
  }

  console.log(`\n✓ Total: ${allJobs.length} jobs`);

  // Deduplicate by URL
  const seen = new Set();
  const deduped = allJobs.filter(j => {
    if (!j.url || seen.has(j.url)) return false;
    seen.add(j.url);
    return true;
  });
  console.log(`✓ After dedup: ${deduped.length} jobs`);

  fs.writeFileSync(OUT_FILE, JSON.stringify(deduped, null, 2), 'utf8');
  console.log(`✓ Written to ${OUT_FILE}`);

  fs.writeFileSync(META_FILE, JSON.stringify({ generatedAt: new Date().toISOString() }), 'utf8');
  console.log(`✓ Written to ${META_FILE}\n`);
})();
