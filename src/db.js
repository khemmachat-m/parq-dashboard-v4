// ═══════════════════════════════════════════════════════════════════
// INDEXEDDB  — key/value store for folder handle + metadata
// ═══════════════════════════════════════════════════════════════════
const DB_NAME    = 'parq-local-v2';
const DB_VERSION = 1;
const STORE      = 'kv';

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = e => e.target.result.createObjectStore(STORE);
    r.onsuccess       = e => res(e.target.result);
    r.onerror         = e => rej(e.target.error);
  });
}

export async function dbGet(key) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    r.onsuccess = e => res(e.target.result ?? null);
    r.onerror   = e => rej(e.target.error);
  });
}

export async function dbSet(key, val) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const r = db.transaction(STORE, 'readwrite').objectStore(STORE).put(val, key);
    r.onsuccess = () => res();
    r.onerror   = e  => rej(e.target.error);
  });
}
