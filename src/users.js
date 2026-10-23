/* =====================================================================
   Quick Quantity — the user module
   Who is using this copy of the app: accounts kept on the device, a PIN
   to open one, four roles with different rights, and an administrator
   screen to add, change, reset and remove users.

   Everything is local. An account is a device lock, not encryption: it
   keeps colleagues' bills apart on a shared machine, it does not make
   the file unreadable to someone who has the file.
   ===================================================================== */
(function (root) {
  'use strict';

  const DB = 'plan2boq_users';
  const VER = 1;
  const STORE = 'users';
  const LS = 'plan2boq.users';
  const SESSION = 'plan2boq.session';
  const LAST = 'plan2boq.user.last';

  /* ------------------------------------------------------------------ roles */
  const ROLES = {
    admin: {
      label: 'Administrator', short: 'Admin', blurb: 'Everything: every bill, the users, the settings.',
      edit: true, manageUsers: true, seeAll: true, newBill: true, deleteBills: true
    },
    qs: {
      label: 'Quantity surveyor', short: 'QS', blurb: 'Prepares bills: measuring, take-off, rates, exports.',
      edit: true, manageUsers: false, seeAll: false, newBill: true, deleteBills: true
    },
    contractor: {
      label: 'Contractor', short: 'Contractor', blurb: 'Prices and checks bills; can edit rates and export.',
      edit: true, manageUsers: false, seeAll: false, newBill: true, deleteBills: true
    },
    reviewer: {
      label: 'Reviewer', short: 'Reviewer', blurb: 'Read-only: opens any bill, prints and exports, changes nothing.',
      edit: false, manageUsers: false, seeAll: true, newBill: false, deleteBills: false
    }
  };
  const ROLE_ORDER = ['admin', 'qs', 'contractor', 'reviewer'];

  /* ------------------------------------------------ the account that ships
     A device with no accounts opens on a ready-made administrator so the
     app is usable the moment the file is opened: name "Administrator",
     PIN 1234. The lock screen says so until the PIN is changed, and the
     moment a second account is added (or this PIN changes) it is just an
     ordinary administrator like any other. */
  const DEFAULT_NAME = 'Administrator';
  const DEFAULT_PIN = '1234';

  /* ---------------------------------------------------------------- helpers */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const uid = () => 'u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  const now = () => new Date().toISOString();

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  const COLOURS = ['#2f6b52', '#3b6ea5', '#8a5a2b', '#7b3f61', '#4a5d23', '#8a4b2f', '#44536b', '#6b5b2f'];
  function colourFor(seed) {
    let h = 0;
    const s = String(seed || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return COLOURS[h % COLOURS.length];
  }

  /* -------------------------------------------------------------- sha-256 */
  /* A compact SHA-256. A 4–6 digit PIN with a salt is not encryption — it is
     a lock, and this is the honest version of one. */
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  const rrot = (x, n) => (x >>> n) | (x << (32 - n));

  function sha256(str) {
    const bytes = Array.from(new TextEncoder().encode(String(str)));
    const l = bytes.length;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    const bits = l * 8;
    bytes.push(0, 0, 0, 0, (bits >>> 24) & 255, (bits >>> 16) & 255, (bits >>> 8) & 255, bits & 255);
    const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const w = new Array(64);
    for (let off = 0; off < bytes.length; off += 64) {
      for (let t = 0; t < 16; t++) {
        const i = off + t * 4;
        w[t] = ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0;
      }
      for (let t = 16; t < 64; t++) {
        const s0 = (rrot(w[t - 15], 7) ^ rrot(w[t - 15], 18) ^ (w[t - 15] >>> 3)) >>> 0;
        const s1 = (rrot(w[t - 2], 17) ^ rrot(w[t - 2], 19) ^ (w[t - 2] >>> 10)) >>> 0;
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }
      let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (let t = 0; t < 64; t++) {
        const S1 = (rrot(e, 6) ^ rrot(e, 11) ^ rrot(e, 25)) >>> 0;
        const ch = ((e & f) ^ (~e & g)) >>> 0;
        const t1 = (hh + S1 + ch + K[t] + w[t]) >>> 0;
        const S0 = (rrot(a, 2) ^ rrot(a, 13) ^ rrot(a, 22)) >>> 0;
        const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
        const t2 = (S0 + maj) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
      h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
    }
    return h.map(x => ('00000000' + x.toString(16)).slice(-8)).join('');
  }

  function salt() {
    const a = new Uint8Array(12);
    try { (root.crypto || {}).getRandomValues(a); }
    catch (e) { for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 256) | 0; }
    return Array.from(a).map(x => ('0' + x.toString(16)).slice(-2)).join('');
  }
  const pinHash = (pin, s) => sha256(s + ':' + String(pin));

  /* ---------------------------------------------------------------- storage */
  let dbPromise = null;
  let backend = 'indexeddb';
  let mem = null;               // last resort when no storage at all

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!root.indexedDB) { reject(new Error('no indexeddb')); return; }
      let req;
      try { req = root.indexedDB.open(DB, VER); } catch (e) { reject(e); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('indexeddb error'));
      req.onblocked = () => reject(new Error('indexeddb blocked'));
    }).catch(err => { backend = 'localStorage'; dbPromise = null; throw err; });
    return dbPromise;
  }

  function tx(mode, fn) {
    return openDb().then(db => new Promise((resolve, reject) => {
      const t = db.transaction([STORE], mode);
      const box = { v: null };
      t.oncomplete = () => resolve(box.v);
      t.onerror = () => reject(t.error || new Error('failed'));
      t.onabort = () => reject(t.error || new Error('aborted'));
      fn(t, box);
    }));
  }

  function lsAll() {
    try { return JSON.parse(root.localStorage.getItem(LS) || '[]') || []; }
    catch (e) { return mem ? mem.slice() : []; }
  }
  function lsWrite(arr) {
    try { root.localStorage.setItem(LS, JSON.stringify(arr)); return true; }
    catch (e) { mem = arr.slice(); return false; }
  }

  async function readAll() {
    try {
      const rows = await tx('readonly', (t, box) => {
        t.objectStore(STORE).getAll().onsuccess = e => { box.v = e.target.result || []; };
      });
      return rows || [];
    } catch (e) { return lsAll(); }
  }

  async function writeOne(rec) {
    try {
      await tx('readwrite', t => { t.objectStore(STORE).put(rec); });
      return true;
    } catch (e) {
      const rows = lsAll().filter(r => r.id !== rec.id);
      rows.push(rec);
      backend = 'localStorage';
      return lsWrite(rows);
    }
  }

  async function removeOne(id) {
    try {
      await tx('readwrite', t => { t.objectStore(STORE).delete(id); });
      return true;
    } catch (e) { return lsWrite(lsAll().filter(r => r.id !== id)); }
  }

  /* ------------------------------------------------------------------ state */
  let opts = { toast: () => {}, onChange: () => {} };
  let me = null;               // the signed-in record, without its PIN
  let lockEl = null;

  const strip = u => {
    if (!u) return null;
    const o = Object.assign({}, u);
    delete o.pin;
    return o;
  };

  const api = {
    READY: false,
    ROLES, ROLE_ORDER,
    DEFAULT_PIN: DEFAULT_PIN, DEFAULT_NAME: DEFAULT_NAME,

    async boot(o) {
      opts = Object.assign(opts, o || {});
      api.READY = true;
      return api;
    },

    async all() {
      const rows = await readAll();
      return rows.slice().sort((a, b) => {
        const ra = ROLE_ORDER.indexOf(a.role), rb = ROLE_ORDER.indexOf(b.role);
        return (ra - rb) || String(a.name || '').localeCompare(String(b.name || ''));
      });
    },

    async count() { return (await readAll()).length; },

    role(id) { return ROLES[id] || ROLES.reviewer; },
    roleLabel(id) { return api.role(id).label; },

    current() { return me ? strip(me) : null; },
    currentId() { return me ? me.id : null; },

    can(what) {
      if (!me) return false;
      const r = api.role(me.role);
      if (what === 'edit') return !!r.edit;
      if (what === 'manageUsers') return !!r.manageUsers;
      if (what === 'seeAll') return !!r.seeAll;
      if (what === 'newBill') return !!r.newBill;
      if (what === 'deleteBills') return !!r.deleteBills;
      return false;
    },

    /* ------------------------------------------------ session + last user */
    needsSignIn() {
      try {
        const s = JSON.parse(sessionStorage.getItem(SESSION) || 'null');
        if (s && s.uid && s.at) return false;
      } catch (e) {}
      return true;
    },
    lastId() { try { return localStorage.getItem(LAST) || ''; } catch (e) { return ''; } },

    /* Create the shipped account if this device has nobody yet. Always
       safe to call: it does nothing when an account already exists. */
    async ensureDefault() {
      const rows = await readAll();
      if (rows.length) return { created: false };
      const s = salt();
      const rec = {
        id: 'u-default',
        name: DEFAULT_NAME,
        role: 'admin',
        firm: '', email: '', phone: '',
        initials: initials(DEFAULT_NAME),
        colour: colourFor(DEFAULT_NAME),
        pin: { algo: 'sha256', salt: s, hash: pinHash(DEFAULT_PIN, s) },
        createdAt: now(), lastSeenAt: null, active: true,
        isDefault: true, defaultPin: true
      };
      const ok = await writeOne(rec);
      if (!ok) return { created: false, error: 'This browser will not store an account' };
      return { created: true };
    },

    /* --------------------------------------------------------- create/edit */
    async create(input) {
      const name = String(input.name || '').trim();
      if (!name) throw new Error('A user needs a name');
      const pin = String(input.pin || '');
      if (!/^\d{4,6}$/.test(pin)) throw new Error('The PIN must be 4 to 6 digits');
      const rows = await readAll();
      if (rows.some(r => r.name.toLowerCase() === name.toLowerCase())) {
        throw new Error('There is already a user called ' + name);
      }
      if (!rows.length && input.role !== 'admin') throw new Error('The first user must be an administrator');
      const s = salt();
      const rec = {
        id: uid(), name: name,
        role: ROLES[input.role] ? input.role : 'qs',
        firm: String(input.firm || '').trim(),
        email: String(input.email || '').trim(),
        phone: String(input.phone || '').trim(),
        initials: initials(name), colour: colourFor(name),
        pin: { algo: 'sha256', salt: s, hash: pinHash(pin, s) },
        createdAt: now(), lastSeenAt: null, active: true
      };
      const ok = await writeOne(rec);
      if (!ok) throw new Error('This browser will not store another user');
      return strip(rec);
    },

    async update(id, patch) {
      const rows = await readAll();
      const rec = rows.find(r => r.id === id);
      if (!rec) throw new Error('No such user');
      const next = Object.assign({}, rec, {
        name: String((patch.name == null ? rec.name : patch.name)).trim() || rec.name,
        firm: patch.firm == null ? rec.firm : String(patch.firm).trim(),
        email: patch.email == null ? rec.email : String(patch.email).trim(),
        phone: patch.phone == null ? rec.phone : String(patch.phone).trim()
      });
      if (patch.role && ROLES[patch.role] && patch.role !== rec.role) {
        if (rec.role === 'admin' && patch.role !== 'admin' && adminCount(rows, rec.id) === 0) {
          throw new Error('An administrator must keep another administrator');
        }
        next.role = patch.role;
      }
      next.initials = initials(next.name);
      next.colour = colourFor(next.name);
      await writeOne(next);
      if (me && me.id === next.id) { me = next; opts.onChange && opts.onChange(); }
      return strip(next);
    },

    async setPin(id, pin) {
      if (!/^\d{4,6}$/.test(String(pin || ''))) throw new Error('The PIN must be 4 to 6 digits');
      const rows = await readAll();
      const rec = rows.find(r => r.id === id);
      if (!rec) throw new Error('No such user');
      const s = salt();
      rec.pin = { algo: 'sha256', salt: s, hash: pinHash(pin, s) };
      rec.defaultPin = false;
      await writeOne(rec);
      return true;
    },

    async verify(id, pin) {
      const rows = await readAll();
      const rec = rows.find(r => r.id === id);
      if (!rec || rec.active === false) return false;
      const p = rec.pin || {};
      if (!p.hash) return false;
      return pinHash(pin, p.salt) === p.hash;
    },

    async remove(id, how) {
      const rows = await readAll();
      const rec = rows.find(r => r.id === id);
      if (!rec) return { ok: false };
      if (me && me.id === id) throw new Error('You cannot delete the account you are signed in with');
      if (rec.role === 'admin' && adminCount(rows, id) === 0) {
        throw new Error('An administrator must keep another administrator');
      }
      await removeOne(id);
      // their bills: handed to the signed-in administrator, or deleted
      let moved = 0, deleted = 0;
      const bills = opts.bills;
      if (bills && how) {
        const list = await bills.list();
        for (const b of list) {
          if (b.ownerId !== id) continue;
          if (how === 'delete') { await bills.remove(b.id); deleted++; }
          else if (me) { await bills.patch(b.id, { ownerId: me.id, ownerName: me.name }); moved++; }
        }
      }
      return { ok: true, moved, deleted };
    },

    async touch(id) {
      const rows = await readAll();
      const rec = rows.find(r => r.id === id);
      if (!rec) return;
      rec.lastSeenAt = now();
      await writeOne(rec);
    },

    /* hand any bill saved before users existed to the administrator */
    async adoptOrphans() {
      if (!me || !opts.bills) return 0;
      let n = 0;
      const list = await opts.bills.list();
      for (const b of list) {
        if (!b.ownerId) { await opts.bills.patch(b.id, { ownerId: me.id, ownerName: me.name }); n++; }
      }
      return n;
    },

    /* ------------------------------------------------------------ sign in */
    async signIn(id, pin) {
      const ok = await api.verify(id, pin);
      if (!ok) return { ok: false };
      const rows = await readAll();
      const rec = rows.find(r => r.id === id);
      me = rec;
      await api.touch(id);
      try {
        sessionStorage.setItem(SESSION, JSON.stringify({ uid: id, at: now() }));
        localStorage.setItem(LAST, id);
      } catch (e) {}
      closeLock();
      if (lockEl) { lockEl.remove(); lockEl = null; }
      document.body.classList.remove('locked');
      opts.onChange && opts.onChange();
      return { ok: true, user: strip(rec) };
    },

    async resume() {
      try {
        const s = JSON.parse(sessionStorage.getItem(SESSION) || 'null');
        if (!s || !s.uid) return null;
        const rows = await readAll();
        const rec = rows.find(r => r.id === s.uid && r.active !== false);
        if (!rec) return null;
        me = rec;
        return strip(rec);
      } catch (e) { return null; }
    },

    signOut() {
      try { sessionStorage.removeItem(SESSION); } catch (e) {}
      me = null;
      closeLock();
      location.reload();
    },

    /* ------------------------------------------------------- lock screen */
    lock(onIn) {
      document.body.classList.add('locked');
      if (lockEl) lockEl.remove();
      lockEl = document.createElement('div');
      lockEl.id = 'lock';
      lockEl.className = 'lock';
      document.body.appendChild(lockEl);
      paintLock(onIn);
    },

    admin: (openAdd) => openAdmin(openAdd),
    profile: () => openProfile(),
    menu: anchor => openMenu(anchor)
  };

  function adminCount(rows, excludeId) {
    return rows.filter(r => r.role === 'admin' && r.id !== excludeId).length;
  }

  /* ------------------------------------------------------------ lock screen */
  let lockState = { mode: 'pick', userId: '', buffer: '', error: '', busy: false, tries: 0 };

  async function paintLock(onIn) {
    if (!lockEl) return;
    const users = (await readAll()).filter(u => u.active !== false);
    if (!users.length) { paintSetup(onIn); return; }
    const last = api.lastId();
    if (users.length === 1) {
      // one account on the device: straight to its PIN
      lockState.mode = 'pin';
      lockState.userId = users[0].id;
    } else if (lockState.mode === 'pin' && !lockState.userId) {
      lockState.mode = 'pick';
    }
    const user = users.find(u => u.id === lockState.userId) || null;

    if (lockState.mode === 'pick') {
      lockEl.innerHTML = `
        <div class="lock-card">
          ${lockBrand()}
          <h2 class="lock-q">Who is using Quick Quantity?</h2>
          <p class="lock-sub">Choose your account. Each account keeps its own bills on this device.</p>
          <div class="lock-users">
            ${users.map(u => `
              <button class="lock-user${u.id === last ? ' last' : ''}" data-lock-user="${esc(u.id)}">
                <span class="avatar big" style="background:${esc(u.colour)}">${esc(u.initials)}</span>
                <b>${esc(u.name)}</b>
                <span>${esc(ROLES[u.role] ? ROLES[u.role].label : u.role)}</span>
                ${u.defaultPin ? `<em>default · PIN ${esc(DEFAULT_PIN)}</em>` : (u.id === last ? '<em>last used</em>' : '')}
              </button>`).join('')}
          </div>
          <p class="lock-foot">${users.length === 1 ? 'One account on this device.' : users.length + ' accounts on this device.'}
            A forgotten PIN can be reset by an administrator.</p>
        </div>`;
      lockEl.querySelectorAll('[data-lock-user]').forEach(b => b.addEventListener('click', () => {
        lockState.userId = b.dataset.lockUser;
        lockState.mode = 'pin'; lockState.buffer = ''; lockState.error = ''; lockState.tries = 0;
        paintLock(onIn);
      }));
      focusFirst();
      return;
    }

    lockEl.innerHTML = `
      <div class="lock-card">
        ${lockBrand()}
        <button class="lock-switch" id="lock-switch">${users.length > 1 ? '← Not ' + esc(user ? user.name.split(' ')[0] : 'you') + '?' : ''}</button>
        <span class="avatar big" style="background:${esc(user.colour)};margin:6px auto 10px">${esc(user.initials)}</span>
        <h2 class="lock-q">${esc(user.name)}</h2>
        <p class="lock-sub">${esc(ROLES[user.role].label)}${user.defaultPin
          ? ' · the account this copy shipped with'
          : (user.firm ? ' · ' + esc(user.firm) : '')}</p>
        ${user.defaultPin ? `<p class="lock-default">Default account · the PIN is <b>${esc(DEFAULT_PIN)}</b> —
          change it in <i>My profile and PIN</i> and this note goes away.</p>` : ''}
        <form class="lock-form" id="lock-form" autocomplete="off">
          <label class="lock-label" for="lock-pin">Your PIN</label>
          <div class="pin-dots" id="pin-dots">${pinDots()}</div>
          <input id="lock-pin" class="pin-input" type="password" inputmode="numeric" pattern="[0-9]*"
                 maxlength="6" autocomplete="off" aria-label="PIN" value="${esc(lockState.buffer)}">
          <div class="keypad">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" class="key" data-key="${n}">${n}</button>`).join('')}
            <button type="button" class="key key-wide" data-key="clear">Clear</button>
            <button type="button" class="key" data-key="0">0</button>
            <button type="button" class="key" data-key="back" aria-label="Delete">⌫</button>
          </div>
          <p class="lock-err" id="lock-err">${esc(lockState.error)}</p>
          <button class="btn primary lock-go" type="button" data-lock-go${lockState.buffer.length < 4 ? ' disabled' : ''}>Open my bills</button>
        </form>
        <p class="lock-foot">A device lock, not encryption — it keeps each person's bills apart.</p>
      </div>`;

    const pin = lockEl.querySelector('#lock-pin');
    const go = lockEl.querySelector('.lock-go');
    const err = lockEl.querySelector('#lock-err');
    const dots = lockEl.querySelector('#pin-dots');
    const paint = () => {
      dots.innerHTML = pinDots();
      go.disabled = lockState.buffer.length < 4;
      err.textContent = lockState.error;
    };
    pin.addEventListener('input', () => {
      lockState.buffer = pin.value.replace(/\D/g, '').slice(0, 6);
      pin.value = lockState.buffer;
      lockState.error = '';
      paint();
    });
    pin.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    lockEl.querySelectorAll('[data-key]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.key;
      if (k === 'back') lockState.buffer = lockState.buffer.slice(0, -1);
      else if (k === 'clear') lockState.buffer = '';
      else if (lockState.buffer.length < 6) lockState.buffer += k;
      lockState.error = '';
      pin.value = lockState.buffer;
      paint();
      pin.focus();
    }));
    const sw = lockEl.querySelector('#lock-switch');
    if (sw) sw.addEventListener('click', () => {
      if (users.length < 2) return;
      lockState.mode = 'pick'; lockState.buffer = ''; lockState.error = '';
      paintLock(onIn);
    });
    /* the button opens the bills on its own: a page shown inside a sandboxed
       frame has no forms, and a submit handler never fires there */
    const form = lockEl.querySelector('#lock-form');
    if (form) form.addEventListener('submit', e => { e.preventDefault(); submit(); });
    const goBtn = lockEl.querySelector('[data-lock-go]');
    if (goBtn) goBtn.addEventListener('click', e => { e.preventDefault(); submit(); });

    async function submit() {
      if (lockState.busy || lockState.buffer.length < 4) return;
      lockState.busy = true;
      go.disabled = true;
      const res = await api.signIn(lockState.userId, lockState.buffer);
      lockState.busy = false;
      if (!res.ok) {
        lockState.error = 'That PIN is not right. Try again.';
        lockState.buffer = '';
        lockState.tries++;
        paint();
        pin.value = '';
        pin.focus();
        const card = lockEl.querySelector('.lock-card');
        card.classList.remove('shake');
        void card.offsetWidth;
        card.classList.add('shake');
        return;
      }
      lockState = { mode: 'pick', userId: '', buffer: '', error: '', busy: false, tries: 0 };
      if (onIn) onIn(res.user);
    }
    pin.focus();
  }

  function pinDots() {
    const n = lockState.buffer.length;
    return [0, 1, 2, 3, 4, 5].map(i =>
      `<span class="pin-dot${i < n ? ' on' : ''}${i >= 4 ? ' opt' : ''}"></span>`).join('');
  }

  function lockBrand() {
    return `<div class="lock-brand">
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="3.5" y="3.5" width="25" height="25" rx="3.5" stroke="currentColor" stroke-width="2"/>
        <path d="M3.5 13.5h25M13.5 13.5V28.5" stroke="currentColor" stroke-width="2"/>
        <path d="M8 8h3M21 8h3M8 18h3M17 18h3M17 23h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <div><b>Quick Quantity</b><span>Offline Bill of Quantities</span></div>
    </div>`;
  }

  /* a preview frame with no storage can open the app but cannot remember
     anyone; say so on the setup screen rather than after they have typed */
  function storageWorks() {
    try {
      const k = '__p2b_probe__';
      root.localStorage.setItem(k, '1');
      root.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  }

  /* first run: there is nobody yet, so this is the administrator's account */
  function paintSetup(onIn) {
    lockEl.innerHTML = `
      <div class="lock-card">
        ${lockBrand()}
        <h2 class="lock-q">Set up this device</h2>
        <p class="lock-sub">This copy of Quick Quantity has no accounts yet. The first account is the administrator —
          it can add the others, and it owns every bill already saved here.</p>
        <form class="lock-form" id="setup-form" autocomplete="off">
          <div class="field"><label for="su-name">Your name</label>
            <input id="su-name" type="text" placeholder="e.g. Kwame Mensah" maxlength="60" required></div>
          <div class="grid2" style="gap:10px">
            <div class="field"><label for="su-firm">Firm (optional)</label>
              <input id="su-firm" type="text" placeholder="Practice or company" maxlength="80"></div>
            <div class="field"><label for="su-email">Email (optional)</label>
              <input id="su-email" type="email" placeholder="you@example.com" maxlength="80"></div>
          </div>
          <div class="grid2" style="gap:10px">
            <div class="field"><label for="su-pin">Choose a PIN (4–6 digits)</label>
              <input id="su-pin" type="password" inputmode="numeric" maxlength="6" pattern="[0-9]*" autocomplete="new-password" required></div>
            <div class="field"><label for="su-pin2">Type it again</label>
              <input id="su-pin2" type="password" inputmode="numeric" maxlength="6" pattern="[0-9]*" autocomplete="new-password" required></div>
          </div>
          <p class="lock-err" id="su-err"></p>
          <button class="btn primary lock-go" type="button" data-setup-go>Create the administrator</button>
        </form>
        ${storageWorks() ? '' : `<p class="lock-foot" style="color:#8a5a2b">This window cannot store anything — a preview
          frame or a private window is blocking storage. The account will last for this visit only; open the downloaded
          file directly to keep accounts and bills.</p>`}
        <p class="lock-foot">Keep the PIN safe: without it this account cannot be opened on this device.</p>
      </div>`;
    const err = lockEl.querySelector('#su-err');
    const nameEl = lockEl.querySelector('#su-name');
    nameEl.focus();
    const setupGo = lockEl.querySelector('[data-setup-go]');
    const setupBtn = lockEl.querySelector('#setup-form');
    const doSetup = async e => {
      e.preventDefault();
      const name = nameEl.value.trim();
      const pin = lockEl.querySelector('#su-pin').value.trim();
      const pin2 = lockEl.querySelector('#su-pin2').value.trim();
      err.textContent = '';
      if (!name) { err.textContent = 'Type your name.'; nameEl.focus(); return; }
      if (!/^\d{4,6}$/.test(pin)) { err.textContent = 'The PIN must be 4 to 6 digits.'; return; }
      if (pin !== pin2) { err.textContent = 'The two PINs do not match.'; return; }
      try {
        const user = await api.create({
          name: name, role: 'admin', pin: pin,
          firm: lockEl.querySelector('#su-firm').value,
          email: lockEl.querySelector('#su-email').value
        });
        // the first administrator takes over anything saved before users
        await api.signIn(user.id, pin);
        if (onIn) onIn(api.current());
      } catch (ex) {
        err.textContent = ex.message || 'Could not create the account';
      }
    };
    if (setupBtn) setupBtn.addEventListener('submit', doSetup);
    if (setupGo) setupGo.addEventListener('click', doSetup);
  }

  function focusFirst() {
    const b = lockEl && lockEl.querySelector('.lock-user');
    if (b) b.focus();
  }

  function closeLock() {
    if (lockEl && lockEl.parentNode) lockEl.parentNode.removeChild(lockEl);
    lockEl = null;
    document.body.classList.remove('locked');
  }

  /* -------------------------------------------------------------- the menu */
  function openMenu(anchor) {
    const old = document.getElementById('user-menu');
    if (old) { old.remove(); return; }
    const u = api.current();
    if (!u) return;
    const r = api.role(u.role);
    const box = document.createElement('div');
    box.id = 'user-menu';
    box.className = 'user-menu';
    box.innerHTML = `
      <div class="um-head">
        <span class="avatar big" style="background:${esc(u.colour)}">${esc(u.initials)}</span>
        <div><b>${esc(u.name)}</b><span>${esc(r.label)}${u.firm ? ' · ' + esc(u.firm) : ''}</span></div>
      </div>
      <button class="um-item" data-um="profile">My profile and PIN</button>
      ${api.can('manageUsers') ? '<button class="um-item" data-um="adduser"><b>Add a user</b><span>Name, firm and a PIN</span></button>' : ''}
      ${api.can('manageUsers') ? '<button class="um-item" data-um="users">Manage users</button>' : ''}
      <button class="um-item" data-um="switch">Switch user</button>
      <button class="um-item danger" data-um="out">Sign out</button>`;
    document.body.appendChild(box);
    const rect = anchor ? anchor.getBoundingClientRect() : { left: innerWidth - 240, bottom: 60 };
    box.style.top = Math.round(rect.bottom + 8) + 'px';
    box.style.left = Math.round(Math.min(innerWidth - box.offsetWidth - 12, Math.max(12, rect.left - 160))) + 'px';
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-um]');
      if (!b) return;
      box.remove();
      const what = b.dataset.um;
      if (what === 'profile') openProfile();
      else if (what === 'users') openAdmin();
      else if (what === 'adduser') openAdmin(true);
      else if (what === 'switch') { api.signOut(); }
      else if (what === 'out') { api.signOut(); }
    });
    setTimeout(() => {
      const off = ev => {
        if (!box.contains(ev.target) && ev.target !== anchor) {
          box.remove();
          document.removeEventListener('mousedown', off, true);
        }
      };
      document.addEventListener('mousedown', off, true);
    }, 0);
  }

  /* ---------------------------------------------------------- the admin screen */
  const adminState = { tab: 'list', editId: '', adding: false, error: '', confirmId: '', how: 'move', resetId: '', newPin: '' };

  async function openAdmin(openAdd) {
    if (!api.can('manageUsers')) { opts.toast('Only an administrator can manage users'); return; }
    // a fresh screen every time: no half-finished edit, no old refusal
    adminState.adding = !!openAdd;
    adminState.editId = ''; adminState.confirmId = ''; adminState.resetId = ''; adminState.error = '';
    const old = document.getElementById('users-overlay');
    if (old) old.remove();
    const ov = document.createElement('div');
    ov.id = 'users-overlay';
    ov.className = 'overlay-modal';
    ov.innerHTML = `<div class="modal users-modal" role="dialog" aria-modal="true" aria-label="Users">
      <header class="modal-head">
        <div><h2>Users</h2>
          <p class="hint">Accounts on this device. Each keeps its own bills; a reviewer can only read.</p></div>
        <button class="icon-x" data-uz="close" aria-label="Close">✕</button>
      </header>
      <div class="modal-body" id="users-body"></div>
    </div>`;
    document.body.appendChild(ov);
    const onEsc = ev => { if (ev.key === 'Escape') close(); };
    document.addEventListener('keydown', onEsc);
    function close() { ov.remove(); document.removeEventListener('keydown', onEsc); }

    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.addEventListener('click', async e => {
      const t = e.target.closest('[data-uz]');
      if (!t) return;
      const act = t.dataset.uz, id = t.dataset.id || '';
      if (act === 'close') return close();
      if (act === 'add') { adminState.adding = true; adminState.error = ''; return paintNow(); }
      if (act === 'cancel-add') { adminState.adding = false; adminState.error = ''; return paintNow(); }
      if (act === 'edit') { adminState.editId = id; adminState.error = ''; return paintNow(); }
      if (act === 'cancel-edit') { adminState.editId = ''; adminState.error = ''; return paintNow(); }
      if (act === 'save-edit') return saveEdit(id);
      if (act === 'reset') { adminState.resetId = id; adminState.newPin = ''; return paintNow(); }
      if (act === 'cancel-reset') { adminState.resetId = ''; return paintNow(); }
      if (act === 'save-reset') return saveReset(id);
      if (act === 'ask-delete') { adminState.confirmId = id; adminState.how = 'move'; return paintNow(); }
      if (act === 'cancel-delete') { adminState.confirmId = ''; return paintNow(); }
      if (act === 'do-delete') return doDelete(id);
    });
    ov.addEventListener('change', e => {
      const sel = e.target.closest('select[data-id]');
      if (!sel) return;
      api.update(sel.dataset.id, { role: sel.value })
        .then(() => { opts.toast('Role changed to ' + api.role(sel.value).label); paintNow(); })
        .catch(ex => { opts.toast(ex.message); paintNow(); });
    });

    async function paintNow() {
      const users = await api.all();
      const bills = opts.bills ? await opts.bills.list().catch(() => []) : [];
      const byOwner = {};
      bills.forEach(b => { if (b.ownerId) byOwner[b.ownerId] = (byOwner[b.ownerId] || 0) + 1; });
      const meId = api.currentId();
      const body = ov.querySelector('#users-body');
      if (!body) return;
      body.innerHTML = `
        <div class="users-bar">
          <span class="hint">${users.length} account${users.length === 1 ? '' : 's'} · signed in as <b>${esc(api.current().name)}</b></span>
          <span style="flex:1"></span>
          <button class="btn sm primary" data-uz="add">Add a user</button>
        </div>
        ${adminState.adding ? addForm() : ''}
        ${adminState.error ? `<p class="form-err">${esc(adminState.error)}</p>` : ''}
        <div class="users-list">
          ${users.map(u => userRow(u, byOwner[u.id] || 0, meId)).join('')}
        </div>
        <div class="users-note">
          <b>What each role can do</b>
          <table class="role-table">
            ${ROLE_ORDER.map(k => `<tr><td><span class="role role-${k}">${esc(ROLES[k].short)}</span></td>
              <td>${esc(ROLES[k].blurb)}</td></tr>`).join('')}
          </table>
        </div>`;
      if (adminState.adding) wireAdd();
    }

    function userRow(u, count, meId) {
      const isMe = u.id === meId;
      if (adminState.editId === u.id) return editRow(u, count, isMe);
      return `<div class="user-row${isMe ? ' me' : ''}">
        <span class="avatar big" style="background:${esc(u.colour)}">${esc(u.initials)}</span>
        <div class="user-main">
          <div class="user-name">${esc(u.name)}${isMe ? ' <span class="tag">you</span>' : ''}</div>
          <div class="user-meta">${esc(u.firm || 'No firm')}${u.email ? ' · ' + esc(u.email) : ''}</div>
          <div class="user-meta">${count} bill${count === 1 ? '' : 's'} · ${u.lastSeenAt ? 'last signed in ' + when(u.lastSeenAt) : 'never signed in'}</div>
        </div>
        <div class="role-select">
          <select data-id="${esc(u.id)}" aria-label="Role of ${esc(u.name)}">
            ${ROLE_ORDER.map(k => `<option value="${k}"${k === u.role ? ' selected' : ''}>${esc(ROLES[k].short)}</option>`).join('')}
          </select>
        </div>
        <div class="user-actions">
          <button class="btn sm" data-uz="edit" data-id="${esc(u.id)}">Edit</button>
          <button class="btn sm" data-uz="reset" data-id="${esc(u.id)}">Reset PIN</button>
          <button class="btn sm danger-ghost" data-uz="ask-delete" data-id="${esc(u.id)}"${isMe ? ' disabled title="You cannot delete the account you are signed in with"' : ''}>Delete</button>
        </div>
        ${adminState.resetId === u.id ? resetForm(u) : ''}
        ${adminState.confirmId === u.id ? deleteForm(u, count) : ''}
      </div>`;
    }

    function editRow(u, count, isMe) {
      return `<div class="user-row editing">
        <span class="avatar big" style="background:${esc(u.colour)}">${esc(u.initials)}</span>
        <div class="user-main">
          <div class="grid2" style="gap:10px">
            <div class="field"><label>Name</label><input id="ue-name" type="text" value="${esc(u.name)}" maxlength="60"></div>
            <div class="field"><label>Firm</label><input id="ue-firm" type="text" value="${esc(u.firm || '')}" maxlength="80"></div>
            <div class="field"><label>Email</label><input id="ue-email" type="email" value="${esc(u.email || '')}" maxlength="80"></div>
            <div class="field"><label>Phone</label><input id="ue-phone" type="tel" value="${esc(u.phone || '')}" maxlength="30"></div>
          </div>
          <div class="row" style="margin-top:10px">
            <button class="btn sm primary" data-uz="save-edit" data-id="${esc(u.id)}">Save</button>
            <button class="btn sm" data-uz="cancel-edit">Cancel</button>
            <span class="hint">${count} bill${count === 1 ? '' : 's'} · the PIN is reset separately.</span>
          </div>
        </div>
      </div>`;
    }

    function resetForm(u) {
      return `<div class="user-sub">
        <b>Set a new PIN for ${esc(u.name)}</b>
        <div class="row" style="margin-top:6px">
          <input id="ur-pin" type="password" inputmode="numeric" maxlength="6" placeholder="4–6 digits" style="max-width:160px">
          <button class="btn sm primary" data-uz="save-reset" data-id="${esc(u.id)}">Set the PIN</button>
          <button class="btn sm" data-uz="cancel-reset">Cancel</button>
        </div>
        <p class="hint">The old PIN stops working at once. Nothing else about the account changes.</p>
      </div>`;
    }

    function deleteForm(u, count) {
      return `<div class="user-sub danger-zone">
        <b>Delete ${esc(u.name)}?</b>
        <p class="hint">${count ? 'They have <b>' + count + '</b> saved bill' + (count === 1 ? '' : 's') + ' on this device. What should happen to ' + (count === 1 ? 'it' : 'them') + '?' : 'They have no saved bills.'}</p>
        ${count ? `<label class="check-row"><input type="radio" name="del-how" value="move"${adminState.how === 'move' ? ' checked' : ''}> Keep the bills — hand them to me</label>
        <label class="check-row"><input type="radio" name="del-how" value="delete"${adminState.how === 'delete' ? ' checked' : ''}> Delete the bills with the account</label>` : ''}
        <div class="row" style="margin-top:8px">
          <button class="btn sm danger" data-uz="do-delete" data-id="${esc(u.id)}">Delete the account</button>
          <button class="btn sm" data-uz="cancel-delete">Keep it</button>
        </div>
      </div>`;
    }

    function addForm() {
      return `<div class="user-sub add-form">
        <b>Add a user</b>
        <div class="grid2" style="gap:10px;margin-top:8px">
          <div class="field"><label>Name</label><input id="ua-name" type="text" placeholder="e.g. Adjoa Owusu" maxlength="60"></div>
          <div class="field"><label>Firm</label><input id="ua-firm" type="text" maxlength="80"></div>
          <div class="field"><label>Email</label><input id="ua-email" type="email" maxlength="80"></div>
          <div class="field"><label>Role</label>
            <select id="ua-role">${ROLE_ORDER.map(k => `<option value="${k}"${k === 'qs' ? ' selected' : ''}>${esc(ROLES[k].label)}</option>`).join('')}</select></div>
          <div class="field"><label>PIN (4–6 digits)</label><input id="ua-pin" type="password" inputmode="numeric" maxlength="6"></div>
          <div class="field"><label>Type the PIN again</label><input id="ua-pin2" type="password" inputmode="numeric" maxlength="6"></div>
        </div>
        <div class="row" style="margin-top:10px">
          <button class="btn sm primary" data-uz="save-add">Create the account</button>
          <button class="btn sm" data-uz="cancel-add">Cancel</button>
        </div>
        <p class="hint">Tell them the PIN in person. They can change it in My profile once they are in.</p>
      </div>`;
    }

    function wireAdd() {
      const btn = ov.querySelector('[data-uz="save-add"]');
      if (!btn) return;
      btn.addEventListener('click', async () => {
        const g = id => { const el = ov.querySelector('#' + id); return el ? el.value : ''; };
        const pin = g('ua-pin'), pin2 = g('ua-pin2');
        adminState.error = '';
        if (pin !== pin2) { adminState.error = 'The two PINs do not match.'; return paintNow(); }
        try {
          const made = await api.create({ name: g('ua-name'), firm: g('ua-firm'), email: g('ua-email'), role: g('ua-role'), pin: pin });
          adminState.adding = false;
          opts.toast('Account created — ' + made.name);
          paintNow();
        } catch (ex) { adminState.error = ex.message; paintNow(); }
      });
    }

    async function saveEdit(id) {
      const g = k => { const el = ov.querySelector('#ue-' + k); return el ? el.value : ''; };
      try {
        await api.update(id, { name: g('name'), firm: g('firm'), email: g('email'), phone: g('phone') });
        adminState.editId = '';
        opts.toast('Account updated');
      } catch (ex) { adminState.error = ex.message; }
      paintNow();
    }

    async function saveReset(id) {
      const el = ov.querySelector('#ur-pin');
      try {
        await api.setPin(id, el ? el.value.trim() : '');
        adminState.resetId = '';
        opts.toast('The new PIN is set');
      } catch (ex) { adminState.error = ex.message; }
      paintNow();
    }

    async function doDelete(id) {
      const how = (ov.querySelector('input[name="del-how"]:checked') || {}).value || 'move';
      try {
        const res = await api.remove(id, how);
        adminState.confirmId = '';
        opts.toast(res.deleted ? 'Account and bills deleted'
          : (res.moved ? 'Account deleted — ' + res.moved + ' bill(s) handed to you' : 'Account deleted'));
        paintNow();
      } catch (ex) { adminState.error = ex.message; paintNow(); }
    }

    await paintNow();
  }

  /* -------------------------------------------------------------- my profile */
  function openProfile() {
    const u = api.current();
    if (!u) return;
    const old = document.getElementById('profile-overlay');
    if (old) old.remove();
    const ov = document.createElement('div');
    ov.id = 'profile-overlay';
    ov.className = 'overlay-modal';
    ov.innerHTML = `<div class="modal profile-modal" role="dialog" aria-modal="true" aria-label="My profile">
      <header class="modal-head">
        <div><h2>My profile</h2><p class="hint">Your details, carried onto the bills you prepare.</p></div>
        <button class="icon-x" data-pz="close" aria-label="Close">✕</button>
      </header>
      <div class="modal-body">
        <div class="profile-head">
          <span class="avatar big" style="background:${esc(u.colour)}">${esc(u.initials)}</span>
          <div><b>${esc(u.name)}</b><br><span class="hint">${esc(api.role(u.role).label)}${u.firm ? ' · ' + esc(u.firm) : ''}</span></div>
        </div>
        <div class="grid2" style="gap:10px;margin-top:12px">
          <div class="field"><label>Name</label><input id="pf-name" type="text" value="${esc(u.name)}" maxlength="60"></div>
          <div class="field"><label>Firm</label><input id="pf-firm" type="text" value="${esc(u.firm || '')}" maxlength="80"></div>
          <div class="field"><label>Email</label><input id="pf-email" type="email" value="${esc(u.email || '')}" maxlength="80"></div>
          <div class="field"><label>Phone</label><input id="pf-phone" type="tel" value="${esc(u.phone || '')}" maxlength="30"></div>
        </div>
        <div class="role-line"><span class="role role-${u.role}">${esc(ROLES[u.role].short)}</span>
          <span class="hint">${esc(api.role(u.role).blurb)}</span></div>
        <hr class="rule">
        <h4 class="pf-h">Change the PIN</h4>
        ${u.defaultPin ? `<p class="lock-default" style="margin:0 0 8px">This is the default account — its PIN is
          <b>${esc(DEFAULT_PIN)}</b>. Set your own and the note disappears from the sign-in screen.</p>` : ''}
        <div class="grid3" style="gap:10px">
          <div class="field"><label>Current PIN</label><input id="pf-old" type="password" inputmode="numeric" maxlength="6" autocomplete="off"></div>
          <div class="field"><label>New PIN</label><input id="pf-new" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></div>
          <div class="field"><label>New PIN again</label><input id="pf-new2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></div>
        </div>
        <p class="form-err" id="pf-err"></p>
      </div>
      <footer class="modal-foot">
        <button class="btn" data-pz="close">Close</button>
        <button class="btn primary" data-pz="save">Save</button>
      </footer>
    </div>`;
    document.body.appendChild(ov);
    const err = ov.querySelector('#pf-err');
    const close = () => { ov.remove(); document.removeEventListener('keydown', esc); };
    const esc2 = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', esc2);
    ov.addEventListener('click', async e => {
      if (e.target === ov || e.target.closest('[data-pz="close"]')) return close();
      if (!e.target.closest('[data-pz="save"]')) return;
      const g = id => ov.querySelector('#' + id).value;
      err.textContent = '';
      const oldPin = g('pf-old'), nw = g('pf-new'), nw2 = g('pf-new2');
      try {
        if (oldPin || nw || nw2) {
          if (!oldPin) { err.textContent = 'Type your current PIN to change it.'; return; }
          if (!(await api.verify(u.id, oldPin))) { err.textContent = 'The current PIN is not right.'; return; }
          if (!/^\d{4,6}$/.test(nw)) { err.textContent = 'The new PIN must be 4 to 6 digits.'; return; }
          if (nw !== nw2) { err.textContent = 'The two new PINs do not match.'; return; }
          await api.setPin(u.id, nw);
        }
        await api.update(u.id, { name: g('pf-name'), firm: g('pf-firm'), email: g('pf-email'), phone: g('pf-phone') });
        opts.toast('Profile saved');
        close();
      } catch (ex) { err.textContent = ex.message; }
    });
  }

  function when(iso) {
    try {
      const d = new Date(iso), diff = (Date.now() - d.getTime()) / 1000;
      if (diff < 60) return 'just now';
      if (diff < 3600) return Math.round(diff / 60) + ' min ago';
      if (diff < 86400) return Math.round(diff / 3600) + ' h ago';
      if (diff < 604800) return Math.round(diff / 86400) + ' d ago';
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) { return ''; }
  }

  api.hash = sha256;   // for the tests: a known-answer check
  api.initials = initials;
  root.Users = api;
})(typeof window !== 'undefined' ? window : globalThis);
