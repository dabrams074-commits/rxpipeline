export const STAGES = ['Sourced', 'Applied', 'Interviewing', 'Offer', 'Rejected'];
export let jobs = [];
export let editId = null;
export let tFilters = { area:'', type:'', level:'', func:'' };
export let panelJobId = null;

export let cachedLiveJobs = [];
export let lastFetchTime = null;

export function saveJobs(){ try{ localStorage.setItem('rxp-jobs', JSON.stringify(jobs)); }catch(e){} }
export function loadJobs(){
  try{
    const d = localStorage.getItem('rxp-jobs');
    if(d && JSON.parse(d).length > 0){
      jobs = JSON.parse(d);
    } else {
      jobs = []; // True blank slate for production!
      saveJobs();
    }
  } catch(e){ jobs = []; }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('rx-pipeline-db', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('library')) {
        db.createObjectStore('library');
      }
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