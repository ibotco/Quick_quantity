"""Walk every visible text element and report the ones whose text is hard to
read against whatever is painted behind it. Catches the leftovers that a
screenshot of one step would miss."""
import sys
from playwright.sync_api import sync_playwright

JS = r"""
() => {
  const parse = c => { const m = c.match(/[\d.]+/g); return m ? m.map(Number) : null; };
  const lum = ([r,g,b]) => { const f = v => { v/=255; return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); };
    return .2126*f(r) + .7152*f(g) + .0722*f(b); };
  const blend = (fg, bg) => { const a = fg[3] === undefined ? 1 : fg[3];
    return [fg[0]*a + bg[0]*(1-a), fg[1]*a + bg[1]*(1-a), fg[2]*a + bg[2]*(1-a)]; };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const hi = Math.max(l1,l2), lo = Math.min(l1,l2); return (hi+.05)/(lo+.05); };
  // average the colour stops out of a linear-gradient so a card painted with a
  // gradient is judged by roughly the colour it actually shows
  const gradAvg = img => {
    const cols = img.match(/rgba?\([^)]+\)/g); if (!cols) return null;
    let acc = [0,0,0], n = 0;
    for (const c of cols) { const p = parse(c); if (p) { acc[0]+=p[0]; acc[1]+=p[1]; acc[2]+=p[2]; n++; } }
    return n ? [acc[0]/n, acc[1]/n, acc[2]/n] : null;
  };
  const bgOf = el => {
    let n = el, layers = [], grad = false;
    while (n && n.nodeType === 1) {
      const s = getComputedStyle(n);
      const c = parse(s.backgroundColor);
      if (c && (c[3] === undefined ? 1 : c[3]) > .01) {
        if (c[3] === undefined || c[3] >= .999) { layers.push(c.slice(0,3)); break; }
        layers.push(c);
      } else if (s.backgroundImage && s.backgroundImage !== 'none') {
        const g = gradAvg(s.backgroundImage);
        if (g) { grad = true; layers.push(g); break; }
      }
      n = n.parentElement;
    }
    let base = [255,255,255];
    for (let i = layers.length - 1; i >= 0; i--) {
      const L = layers[i];
      base = L.length === 3 ? L : blend(L, base);
    }
    return { rgb: base, grad };
  };
  const path = el => { const bits = []; let n = el;
    while (n && n.nodeType === 1 && bits.length < 5) {
      let s = n.tagName.toLowerCase();
      if (n.id) s += '#' + n.id; else if (n.className && typeof n.className === 'string')
        s += '.' + n.className.trim().split(/\s+/).slice(0,2).join('.');
      bits.unshift(s); n = n.parentElement; }
    return bits.join(' > '); };
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let t;
  while ((t = walker.nextNode())) {
    const txt = t.nodeValue.trim(); if (!txt) continue;
    const el = t.parentElement; if (!el) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (el.closest('script,style,svg')) continue;
    const fg = parse(s.color); if (!fg) continue;
    const bg = bgOf(el);
    const cr = ratio(blend(fg, bg.rgb), bg.rgb);
    if (cr < 3.0) out.push({ cr: Math.round(cr*100)/100, text: txt.slice(0, 50), sel: path(el),
                             fg: s.color, bg: `rgb(${bg.rgb.map(Math.round)})`, grad: bg.grad });
  }
  return out;
}
"""

def run(page, theme):
    page.goto('file:///home/user/boq-app/index.html'); page.wait_for_timeout(700)
    page.evaluate("t => localStorage.setItem('plan2boq.theme', t)", theme)
    page.reload(); page.wait_for_timeout(1500)
    if page.query_selector('#lock'):
        page.fill('#lock-pin', '1234'); page.click('.lock-go'); page.wait_for_timeout(1600)
    if page.query_selector('#use-sample'):
        page.click('#use-sample'); page.wait_for_timeout(2500)
    seen = {}
    # the dialogs only exist once they are opened, so sweep them too
    def sweep(tag):
        for b in page.evaluate(JS):
            k = (b['sel'], b['fg'], b['bg'], b['text'][:24])
            e = seen.setdefault(k, {'n': 0, 'cr': b['cr'], 'grad': b['grad'], 'step': tag})
            e['n'] += 1; e['cr'] = min(e['cr'], b['cr'])

    page.click('#btn-settings'); page.wait_for_timeout(900)
    for tab in ('project', 'parties', 'structure', 'finishes', 'services', 'pricing', 'rates'):
        try:
            page.click(f'button.tab[data-tab="{tab}"]', timeout=3000); page.wait_for_timeout(500)
        except Exception:
            pass
        sweep('set:' + tab)
    page.click('#set-close'); page.wait_for_timeout(400)

    for step in '12345678':
        page.evaluate("s => { const b=[...document.querySelectorAll('[data-step]')].find(x=>x.dataset.step===s); if(b) b.click(); }", step)
        page.wait_for_timeout(1200)
        sweep(step)
        if step == '6':
            try:
                page.click('#btn-summary', timeout=3000); page.wait_for_timeout(900); sweep('summary')
                page.evaluate("() => document.querySelector('#side .side-x')?.click()"); page.wait_for_timeout(400)
            except Exception: pass
        if step == '8':
            try:
                page.click('#btn-new', timeout=3000); page.wait_for_timeout(700)
            except Exception: pass
    return seen

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for theme in ('dark', 'light'):
        ctx = b.new_context(viewport={'width': 1440, 'height': 1050})
        p = ctx.new_page()
        seen = run(p, theme)
        print(f"\n=== {theme.upper()} — {len(seen)} distinct low-contrast spots ===")
        for (sel, fg, bg, txt), e in sorted(seen.items(), key=lambda kv: kv[1]['cr']):
            print(f"  {e['cr']:>5}  x{e['n']:<3} step{e['step']} {sel[:66]:<66} {fg:>18} on {bg:<16} {'GRAD' if e['grad'] else '    '} {txt!r}")
        ctx.close()
    b.close()
