/* =====================================================================
   SEARCHABLE SELECT
   Every <option> field in the app (Building type, Country, finishes,
   the scale, the sheet role …) is a native <select> underneath — so the
   value, the change handlers and the saved project all keep working —
   with a searchable list drawn on top, in the style of the reference:
   a search box with a magnifier, the current choice pinned first and
   highlighted, then the other choices, filtered as you type.
   ===================================================================== */
(function (root) {
  'use strict';

  let open = null;          // { pop, wrap, btn, sel, sync, input, list, rows, active }

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const MAG = '<svg class="ssel-mag" width="17" height="17" viewBox="0 0 20 20" aria-hidden="true">' +
    '<circle cx="8.6" cy="8.6" r="5.4" fill="none" stroke="currentColor" stroke-width="1.7"/>' +
    '<path d="M12.8 12.8 L17 17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>' +
    '</svg>';

  /* ---------------------------------------------------------- enhance one */
  function ensure(sel) {
    if (sel.dataset.plain === '1') return;              // a dense table cell keeps the native list
    if (sel.dataset.sselReady || sel.disabled || sel.options.length < 2) return;
    if (sel.closest('.ssel')) return;
    sel.dataset.sselReady = '1';

    const wrap = document.createElement('span');
    wrap.className = 'ssel';
    // a field that was given a width keeps it: the wrapper takes the style
    // over before the select is hidden underneath it
    if (sel.style && sel.style.maxWidth) {
      wrap.style.maxWidth = sel.style.maxWidth;
      wrap.style.display = 'inline-block';
      wrap.style.verticalAlign = 'middle';
    }
    if (sel.style && sel.style.width) wrap.style.width = sel.style.width;
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    sel.classList.add('ssel-native');
    sel.setAttribute('tabindex', '-1');
    sel.setAttribute('aria-hidden', 'true');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ssel-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="ssel-txt"></span><span class="ssel-caret" aria-hidden="true">▾</span>';
    wrap.appendChild(btn);

    const sync = () => {
      const o = sel.options[sel.selectedIndex];
      const txt = o ? o.text : '';
      btn.querySelector('.ssel-txt').textContent = txt;
      btn.title = txt;
      if (sel.id) btn.id = sel.id + '-ssel';
    };
    sync();

    btn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      if (open && open.sel === sel) { close(); return; }
      show(wrap, btn, sel, sync);
    });
    btn.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); show(wrap, btn, sel, sync); return;
      }
      // typing on the closed field opens the list already filtered — the same
      // thing the search box does once it is open
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (open && open.sel === sel) {                 // already open: keep typing
          open.input.focus();
          open.input.value += e.key;
          open.input.dispatchEvent(new Event('input'));
          return;
        }
        show(wrap, btn, sel, sync);
        if (open && open.sel === sel) {
          open.input.focus();                           // take the rest of the word
          open.input.value = e.key;
          open.input.dispatchEvent(new Event('input'));
        }
      }
    });
    sel.addEventListener('change', sync);
    const form = sel.closest('form');
    if (form) form.addEventListener('reset', () => setTimeout(sync, 0));
  }

  /* ------------------------------------------------------------- the pop */
  function show(wrap, btn, sel, sync) {
    close();
    const all = Array.from(sel.options).map((o, i) => ({ i, v: o.value, t: o.text, d: !!o.disabled }));
    const cur = sel.selectedIndex;
    const curT = cur >= 0 && all[cur] ? all[cur].t : '';

    const short = curT.length > 24 ? curT.slice(0, 23).replace(/[\s,;/-]+$/, '') + '…' : curT;
    const pop = document.createElement('div');
    pop.className = 'ssel-pop';
    pop.innerHTML =
      '<div class="ssel-search"><input type="text" class="ssel-input" autocomplete="off" ' +
        'spellcheck="false" role="combobox" aria-expanded="true" aria-autocomplete="list" ' +
        'placeholder="' + esc(short ? 'Search… ' + short : 'Search…') + '">' + MAG + '</div>' +
      '<div class="ssel-list" role="listbox"></div>';
    document.body.appendChild(pop);

    const input = pop.querySelector('.ssel-input');
    const list = pop.querySelector('.ssel-list');

    const st = { pop, wrap, btn, sel, sync, input, list, rows: [], active: -1, cur, all, curT };
    open = st;

    const rect = btn.getBoundingClientRect();
    // a compact list, like the reference: never wider than the field, never
    // a full-width bar just because the field is wide
    const w = Math.max(240, Math.min(rect.width, 360));
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const up = below < 220 && above > below;
    const maxH = Math.max(160, Math.min(360, up ? above : below) - 58);
    pop.style.width = w + 'px';
    pop.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - w - 8)) + 'px';
    pop.style.top = (up ? Math.max(8, rect.top - Math.min(360, above) - 8) : rect.bottom + 4) + 'px';
    pop.style.maxHeight = (maxH + 56) + 'px';
    list.style.maxHeight = maxH + 'px';

    render('');

    input.addEventListener('input', () => render(input.value));
    input.addEventListener('keydown', onKey);
    pop.addEventListener('keydown', onKey);
    pop.addEventListener('mousedown', e => e.stopPropagation());

    document.addEventListener('pointerdown', onDoc, true);
    window.addEventListener('resize', close, true);
    window.addEventListener('scroll', onScroll, true);

    setTimeout(() => input.focus(), 0);
  }

  function render(q) {
    const st = open; if (!st) return;
    const query = String(q || '').trim().toLowerCase();
    const hits = st.all.filter(o => !o.d && (!query || o.t.toLowerCase().indexOf(query) >= 0));

    // the current choice is pinned first and highlighted, as in the reference
    const curHit = !query && st.cur >= 0 ? st.all[st.cur] : null;
    const rows = [];
    if (curHit) rows.push(curHit);
    hits.forEach(o => { if (!curHit || o.i !== curHit.i) rows.push(o); });

    st.list.innerHTML = rows.length
      ? rows.map(o => '<div class="ssel-row' + (o.i === st.cur ? ' sel' : '') + '" role="option" ' +
          'aria-selected="' + (o.i === st.cur ? 'true' : 'false') + '" data-i="' + o.i + '">' + esc(o.t) + '</div>').join('')
      : '<div class="ssel-empty">No match for “' + esc(q) + '”</div>';

    st.rows = Array.prototype.slice.call(st.list.querySelectorAll('.ssel-row'));
    st.rows.forEach(row => {
      const i = +row.dataset.i;
      row.addEventListener('mouseenter', () => setActive(st.rows.indexOf(row)));
      row.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); pick(i); });
    });
    st.active = -1;
    setActive(st.rows.length ? 0 : -1);
  }

  function setActive(n) {
    const st = open; if (!st) return;
    st.rows.forEach((r, i) => r.classList.toggle('active', i === n));
    st.active = n;
    const r = st.rows[n];
    if (r && r.scrollIntoView) r.scrollIntoView({ block: 'nearest' });
  }

  function onKey(e) {
    const st = open; if (!st) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); st.btn.focus(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); setActive(Math.min(st.rows.length - 1, st.active + 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); setActive(Math.max(0, st.active - 1)); return; }
    if (e.key === 'Home') { e.preventDefault(); e.stopPropagation(); setActive(0); return; }
    if (e.key === 'End') { e.preventDefault(); e.stopPropagation(); setActive(st.rows.length - 1); return; }
    if (e.key === 'Enter') {
      e.preventDefault(); e.stopPropagation();
      if (st.active >= 0 && st.rows[st.active]) pick(+st.rows[st.active].dataset.i);
      return;
    }
    if (e.key === 'Tab') close();
  }

  function pick(i) {
    const st = open; if (!st) return;
    const sel = st.sel;
    sel.value = st.all[i] ? st.all[i].v : sel.value;
    st.sync();
    close();
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    st.btn.focus();
  }

  function onScroll(e) {
    const st = open; if (!st) return;
    if (st.pop && e.target && st.pop.contains(e.target)) return;   // the list's own scroll
    close();
  }

  function onDoc(e) {
    const st = open; if (!st) return;
    if (st.pop.contains(e.target) || st.wrap.contains(e.target)) return;
    close();
  }

  function close() {
    const st = open; if (!st) return;
    open = null;
    document.removeEventListener('pointerdown', onDoc, true);
    window.removeEventListener('resize', close, true);
    window.removeEventListener('scroll', onScroll, true);
    if (st.btn) st.btn.setAttribute('aria-expanded', 'false');
    if (st.pop && st.pop.parentNode) st.pop.parentNode.removeChild(st.pop);
  }

  /* ------------------------------------------------------------ public API */
  function enhance(host) {
    if (!host) return;
    Array.prototype.slice.call(host.querySelectorAll('select')).forEach(ensure);
  }

  root.SearchSelect = { enhance, close, isOpen: () => !!open };
})(typeof window !== 'undefined' ? window : globalThis);
