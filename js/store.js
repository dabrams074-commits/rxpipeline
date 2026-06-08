import { supabase } from './auth.js';

export const STAGES = ['Sourced', 'Applied', 'Interviewing', 'Offer', 'Rejected'];
export let jobs = [];
export let editId = null;
export let tFilters = { area:'', type:'', level:'', func:'' };
export let panelJobId = null;

export let cachedLiveJobs = [];
export let lastFetchTime = null;

// ── localStorage (fast cache) ────────────────────────────────────────────────
export function saveJobs() {
  try { localStorage.setItem('rxp-jobs', JSON.stringify(jobs)); } catch(e) {}
  // Debounce cloud saves — wait 1.5s after last change before writing to Supabase
  clearTimeout(_cloudSaveTimer);
  _cloudSaveTimer = setTimeout(saveJobsToCloud, 1500);
}

export function loadJobs() {
  try {
    const d = localStorage.getItem('rxp-jobs');
    jobs = (d && JSON.parse(d).length > 0) ? JSON.parse(d) : [];
  } catch(e) { jobs = []; }
}

// ── Supabase cloud sync ──────────────────────────────────────────────────────
let _cloudSaveTimer = null;

export async function saveJobsToCloud() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_data').upsert(
      { user_id: user.id, jobs, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  } catch(e) { /* silent fail — localStorage still has the data */ }
}

export async function loadJobsFromCloud() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data, error } = await supabase
      .from('user_data')
      .select('jobs')
      .eq('user_id', user.id)
      .single();
    if (error || !data) return false;
    if (Array.isArray(data.jobs)) {
      jobs = data.jobs;
      try { localStorage.setItem('rxp-jobs', JSON.stringify(jobs)); } catch(e) {}
      return true;
    }
    return false;
  } catch(e) { return false; }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('rx-pipeline-db', 3);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      // Delete old store on upgrade so stale cached data is cleared
      if (db.objectStoreNames.contains('library')) {
        db.deleteObjectStore('library');
      }
      db.createObjectStore('library');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCachedJobs(jobsArray) {
  try {
    const db = await openDB();
    const tx = db.transaction('library', 'readwrite');
    const store = tx.objectStore('library');
    store.put(jobsArray, 'jobs');
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        const now = new Date().toISOString();
        localStorage.setItem('rxp-fetch-time', now);
        cachedLiveJobs = jobsArray;
        lastFetchTime = now;
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('Failed to save to IndexedDB:', e);
  }
}

export async function loadCachedJobs() {
  try {
    const db = await openDB();
    const tx = db.transaction('library', 'readonly');
    const store = tx.objectStore('library');
    const request = store.get('jobs');
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const d = request.result;
        const t = localStorage.getItem('rxp-fetch-time');
        if (d && d.length > 0) {
          cachedLiveJobs = d;
          lastFetchTime = t;
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Failed to load from IndexedDB:', e);
  }
}

export function setJobs(newJobs) { jobs = newJobs; }
export function setEditId(id) { editId = id; }
export function setPanelJobId(id) { panelJobId = id; }
export function resetTFilters() {
  tFilters.area = '';
  tFilters.type = '';
  tFilters.level = '';
  tFilters.func = '';
}