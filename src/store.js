/* =====================================================================
   Quick Quantity — the storage guard
   Runs before anything else. A page opened inside a sandboxed frame (the
   preview pane of a chat or an editor) has no localStorage: every call
   throws SecurityError, and a page that reads it at start-up comes up
   blank. So the guard puts an in-memory store in its place — the app runs
   for the session, and says so, instead of failing silently.
   ===================================================================== */
(function (root) {
  'use strict';

  const FLAG = 'plan2boq.storage';

  function probe() {
    try {
      const k = '__p2b_probe__';
      root.localStorage.setItem(k, '1');
      const ok = root.localStorage.getItem(k) === '1';
      root.localStorage.removeItem(k);
      return ok ? 'ok' : 'blocked';
    } catch (e) { return 'blocked'; }
  }

  /* a Storage-shaped object that lasts as long as the tab does */
  function memory() {
    const data = Object.create(null);
    const api = {
      get length() { return Object.keys(data).length; },
      key: i => Object.keys(data)[i] == null ? null : Object.keys(data)[i],
      getItem: k => (k in data ? data[k] : null),
      setItem: (k, v) => { data[String(k)] = String(v); },
      removeItem: k => { delete data[String(k)]; },
      clear: () => { Object.keys(data).forEach(k => delete data[k]); }
    };
    return api;
  }

  const state = probe();
  let store = null;
  if (state === 'blocked') {
    store = memory();
    try {
      Object.defineProperty(root, 'localStorage', { configurable: true, get: () => store });
    } catch (e) {
      // a getter that cannot be replaced: hand the app the store it can use
      root.__p2bStorage = store;
    }
    // sessionStorage is blocked with it
    try {
      const ss = memory();
      Object.defineProperty(root, 'sessionStorage', { configurable: true, get: () => ss });
    } catch (e) { /* leave it */ }
  }

  root.Store = {
    state: state,                 // 'ok' | 'blocked'
    blocked: state === 'blocked',
    get: root.__p2bStorage || store
  };
})(typeof window !== 'undefined' ? window : globalThis);
