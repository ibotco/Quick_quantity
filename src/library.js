/* =====================================================================
   Quick Quantity — saved bills
   A small client-side database of the bills this app has generated.
   IndexedDB is used when the browser allows it (served page, installed
   app); a localStorage store takes over when it does not (some browsers
   block IndexedDB for file:// pages). Either way the bills stay on this
   device and can be re-opened, exported or printed offline.
   ===================================================================== */
(function (root) {
  'use strict';

  const DB_NAME = 'plan2boq';
  const DB_VER = 1;
  const META = 'bills';        // one small record per bill: name, totals, date
  const FILES = 'snapshots';   // the project itself, so the bill can be re-opened
  const LS_KEY = 'plan2boq.library';

  let dbPromise = null;
  let backend = 'indexeddb';
  let blocked = false;          // storage is unusable (sandboxed frame, private mode)
  let askedToPersist = false;   // ask once for the browser not to evict the bills

  /* ------------------------------------------------------------- indexeddb */
  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!root.indexedDB) { reject(new Error('no indexeddb')); return; }
      let req;
      try { req = root.indexedDB.open(DB_NAME, DB_VER); }
      catch (e) { reject(e); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(META)) {
          const s = db.createObjectStore(META, { keyPath: 'id' });
          s.createIndex('updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains(FILES)) {
          db.createObjectStore(FILES, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('indexeddb error'));
      req.onblocked = () => reject(new Error('indexeddb blocked'));
    }).catch(err => {
      backend = 'localStorage';
      dbPromise = null;
      throw err;
    });
    return dbPromise;
  }

  // run one transaction; fn fills box.value before the transaction commits
  function txRun(stores, mode, fn) {
    return openDb().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      const box = { value: null };
      tx.oncomplete = () => resolve(box.value);
      tx.onerror = () => reject(tx.error || new Error('transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
      fn(tx, box);
    }));
  }

  const sorted = list => list.slice().sort((a, b) =>
    String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));

  /* --------------------------------------------------- localStorage store */
  function lsAll() {
    try { return JSON.parse(root.localStorage.getItem(LS_KEY) || '[]') || []; }
    catch (e) { blocked = true; return []; }
  }
  function lsWrite(arr) {
    try { root.localStorage.setItem(LS_KEY, JSON.stringify(arr)); return true; }
    catch (e) { blocked = true; return false; }   // quota or no storage at all
  }

  /* ------------------------------------------------------------------ api */
  async function list() {
    try {
      const rows = await txRun([META], 'readonly', (tx, box) => {
        tx.objectStore(META).getAll().onsuccess = e => { box.value = e.target.result || []; };
      });
      return sorted(rows || []);
    } catch (e) {
      return sorted(lsAll().map(r => r.meta).filter(Boolean));
    }
  }

  async function get(id) {
    const rec = { meta: null, snapshot: null };
    try {
      await txRun([META, FILES], 'readonly', (tx, box) => {
        box.value = rec;
        tx.objectStore(META).get(id).onsuccess = e => { rec.meta = e.target.result || null; };
        tx.objectStore(FILES).get(id).onsuccess = e => {
          rec.snapshot = e.target.result ? e.target.result.snapshot : null;
        };
      });
      return rec;
    } catch (e) {
      const row = lsAll().find(r => r.id === id);
      return row ? { meta: row.meta, snapshot: row.snapshot } : { meta: null, snapshot: null };
    }
  }

  async function put(record) {
    const meta = record.meta, snapshot = record.snapshot;
    if (!meta || !meta.id) throw new Error('a saved bill needs an id');
    try {
      await txRun([META, FILES], 'readwrite', tx => {
        tx.objectStore(META).put(meta);
        tx.objectStore(FILES).put({ id: meta.id, snapshot: snapshot });
      });
      // keep the archive out of "evictable" storage where the browser allows it
      if (!askedToPersist && root.navigator && root.navigator.storage && root.navigator.storage.persist) {
        askedToPersist = true;
        try { root.navigator.storage.persist().catch(() => {}); } catch (e) {}
      }
      return { ok: true, backend: 'indexeddb' };
    } catch (e) {
      const rows = lsAll().filter(r => r.id !== meta.id);
      rows.push({ id: meta.id, meta, snapshot });
      const ok = lsWrite(rows);
      backend = 'localStorage';
      return { ok, backend: 'localStorage', full: !ok, blocked: blocked && !ok };
    }
  }

  /* change a bill's record without touching the saved project */
  async function patch(id, changes) {
    const rec = await get(id);
    if (!rec.meta) return false;
    const meta = Object.assign({}, rec.meta, changes || {});
    const res = await put({ meta: meta, snapshot: rec.snapshot });
    return res.ok;
  }

  async function remove(id) {
    try {
      await txRun([META, FILES], 'readwrite', tx => {
        tx.objectStore(META).delete(id);
        tx.objectStore(FILES).delete(id);
      });
      return true;
    } catch (e) {
      return lsWrite(lsAll().filter(r => r.id !== id));
    }
  }

  async function clear() {
    try {
      await txRun([META, FILES], 'readwrite', tx => {
        tx.objectStore(META).clear();
        tx.objectStore(FILES).clear();
      });
      return true;
    } catch (e) {
      return lsWrite([]);
    }
  }

  /* whole library as one file: the plans, the quantities, the rates */
  async function exportAll() {
    const metas = await list();
    const records = [];
    for (const m of metas) {
      const rec = await get(m.id);
      if (rec.meta) records.push({ meta: rec.meta, snapshot: rec.snapshot });
    }
    return {
      app: 'Quick Quantity', kind: 'library', version: 1,
      exportedAt: new Date().toISOString(), records
    };
  }

  /* merge a backup back in; records with the same id are replaced */
  async function importAll(obj) {
    const records = obj && Array.isArray(obj.records) ? obj.records : [];
    let added = 0, replaced = 0;
    const existing = new Set((await list()).map(m => m.id));
    for (const r of records) {
      if (!r || !r.meta || !r.meta.id || !r.snapshot) continue;
      const res = await put({ meta: r.meta, snapshot: r.snapshot });
      if (!res.ok) throw new Error('storage full');
      if (existing.has(r.meta.id)) replaced++; else { added++; existing.add(r.meta.id); }
    }
    return { added, replaced, total: records.length };
  }

  async function estimate() {
    try {
      if (!root.navigator.storage || !root.navigator.storage.estimate) return null;
      const e = await root.navigator.storage.estimate();
      return { usage: e.usage || 0, quota: e.quota || 0 };
    } catch (err) { return null; }
  }

  const uid = () => 'bq-' + Date.now().toString(36) + '-' +
    Math.random().toString(36).slice(2, 7);

  root.Library = {
    list, get, put, patch, remove, clear, exportAll, importAll, estimate, uid,
    backend: () => backend,
    blocked: () => blocked
  };
})(typeof window !== 'undefined' ? window : globalThis);
