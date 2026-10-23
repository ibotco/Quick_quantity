/* =====================================================================
   LIVE PRICES — optional online price refresh.
   Two sources, tried in this order:
     1. a JSON price feed (a URL the user supplies: their QS firm, a
        supplier list, an intranet file). Schema:
        { "source": "…", "date": "2026-10-01",
          "rates": { "block": 8.5, "rebar": 14.2, … } }
     2. a currency index: USD -> GHS from exchangerate-api.com, applied
        to the built-in rates at a 65% import pass-through, so a weaker
        cedi lifts the material rates without inventing new ones.
   Nothing about the project, the drawing or the quantities is sent.
   ===================================================================== */
(function (root) {
  'use strict';

  const FX_URL = 'https://open.er-api.com/v6/latest/USD';
  const TIMEOUT = 12000;
  const AI_TIMEOUT = 45000;
  const PASS_THROUGH = 0.65;      // share of a rate that tracks imported cost

  async function postJson(url, body, headers, timeout) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => ctrl && ctrl.abort(), timeout || AI_TIMEOUT);
    try {
      const res = await fetch(url, {
        method: 'POST',
        signal: ctrl ? ctrl.signal : undefined,
        cache: 'no-store',
        headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
        body: JSON.stringify(body)
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = 'HTTP ' + res.status;
        try { const j = JSON.parse(text); msg = (j.error && (j.error.message || j.error)) || msg; } catch (e) {}
        throw new Error(String(msg).slice(0, 180));
      }
      return text ? JSON.parse(text) : {};
    } finally {
      clearTimeout(timer);
    }
  }

  async function getJson(url) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => ctrl && ctrl.abort(), TIMEOUT);
    try {
      const res = await fetch(url, {
        signal: ctrl ? ctrl.signal : undefined,
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function currency() {
    const d = await getJson(FX_URL);
    const ghs = d && d.rates && Number(d.rates.GHS);
    if (!ghs || !isFinite(ghs)) throw new Error('The service did not return a cedi rate');
    return {
      usdGhs: ghs,
      date: d.time_last_update_utc || new Date().toISOString(),
      source: 'exchangerate-api.com'
    };
  }

  /* The same number on any past date: the rate card is dated, so the cedi's
     move since that date is the honest measure of how stale it is. */
  const HIST_URL = d => 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@' + d + '/v1/currencies/usd.json';
  async function currencyOn(date) {
    const d = await getJson(HIST_URL(date === 'latest' ? 'latest' : date));
    const ghs = d && d.usd && Number(d.usd.ghs);
    if (!ghs || !isFinite(ghs)) throw new Error('No cedi rate for ' + date);
    return { usdGhs: ghs, date: d.date || date, source: 'currency-api' };
  }

  async function feed(url) {
    const d = await getJson(url);
    if (!d || typeof d !== 'object' || !d.rates || typeof d.rates !== 'object') {
      throw new Error('That URL is not a price feed');
    }
    const rates = {};
    Object.keys(d.rates).forEach(k => {
      const v = Number(d.rates[k]);
      if (isFinite(v) && v > 0) rates[k] = v;
    });
    if (!Object.keys(rates).length) throw new Error('The feed has no usable rates');
    return {
      rates: rates,
      source: String(d.source || d.name || url),
      date: String(d.date || d.updated || new Date().toISOString().slice(0, 10))
    };
  }


  /* ------------------------------------------------------------------
     AI PRICE LOOKUP
     The app has no server, so it talks to a model API directly with a
     key the user supplies. Nothing but the rate list is sent.
     ------------------------------------------------------------------ */
  function prompt(params, keys, current) {
    const c = root.GenEngine ? root.GenEngine.currency(params.country) : { code: 'GHS', label: 'Ghana Cedi' };
    const today = new Date().toISOString().slice(0, 10);
    const list = keys.map(k => '  ' + k + ': ' + current[k]).join('\n');
    return 'You are a quantity surveyor pricing building works in ' + (params.country || 'Ghana') + '.\n'
      + 'Give me the current market unit rates, in ' + c.label + ' (' + c.code + '), for the rate keys below.\n'
      + 'These are unit rates used in a Bill of Quantities: blockwork, plaster, render and paint are per square metre; '
      + 'concrete per cubic metre; reinforcement per kilogram; formwork per square metre; most others are item or unit rates.\n'
      + 'Current rates in the app, for reference:\n' + list + '\n\n'
      + 'Return ONLY a JSON object, no prose and no code fences, in exactly this shape:\n'
      + '{"source":"<where these prices come from>","date":"' + today + '","currency":"' + c.code + '",'
      + '"rates":{"block":0,"rebar":0}}\n'
      + 'Rules: include every key listed; numbers only (no symbols, no thousands separators); '
      + 'realistic current prices for ' + (params.country || 'Ghana') + ' in ' + c.code + '; '
      + 'if you are unsure about a key, keep its current value.';
  }

  function parseJson(text) {
    let s = String(text || '').trim();
    s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('The model did not return JSON');
    return JSON.parse(s.slice(a, b + 1));
  }

  async function aiRates(params, keys, current) {
    const key = String(params.aiKey || '').trim();
    if (!key) throw new Error('No AI key configured');
    const provider = params.aiProvider || 'gemini';
    const body = prompt(params, keys, current);
    let text = '';

    if (provider === 'gemini') {
      const model = params.aiModel || 'gemini-2.0-flash';
      const d = await postJson(
        'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) +
          ':generateContent?key=' + encodeURIComponent(key),
        { contents: [{ parts: [{ text: body }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }
      );
      const c = d.candidates && d.candidates[0];
      text = c && c.content && c.content.parts ? c.content.parts.map(p => p.text || '').join('') : '';
    } else if (provider === 'anthropic') {
      const model = params.aiModel || 'claude-sonnet-4-5-20250929';
      const d = await postJson('https://api.anthropic.com/v1/messages',
        { model: model, max_tokens: 3000, messages: [{ role: 'user', content: body }] },
        { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' });
      text = (d.content || []).map(p => p.text || '').join('');
    } else {
      const base = String(params.aiBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
      const model = params.aiModel || 'gpt-4o-mini';
      const d = await postJson(base + '/chat/completions',
        { model: model, temperature: 0.2, response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: body }] },
        { Authorization: 'Bearer ' + key });
      text = d.choices && d.choices[0] && d.choices[0].message ? d.choices[0].message.content : '';
    }

    const j = parseJson(text);
    const rates = {};
    Object.keys(j.rates || {}).forEach(k => {
      const v = Number(j.rates[k]);
      if (keys.indexOf(k) >= 0 && isFinite(v) && v > 0) rates[k] = Math.round(v * 100) / 100;
    });
    const n = Object.keys(rates).length;
    if (n < 5) throw new Error('The model returned too few usable rates');
    return {
      rates: rates,
      source: String(j.source || provider),
      date: String(j.date || new Date().toISOString().slice(0, 10)),
      currency: String(j.currency || ''),
      count: n
    };
  }

  /**
   * Work out what an update would do, without touching the bill.
   * Returns { mode, factor, rates, source, date, usdGhs, basis, note }
   */
  async function plan(params, rateKeys, currentRates) {
    const p = params || {};

    if (p.aiKey && rateKeys && rateKeys.length) {
      const a = await aiRates(p, rateKeys, currentRates || {});
      return {
        mode: 'ai',
        factor: 1,
        rates: a.rates,
        source: a.source,
        date: a.date,
        currency: a.currency,
        count: a.count,
        note: 'AI price check — ' + a.source + ' (' + a.date + '), ' + (p.country || 'Ghana')
      };
    }

    if (p.ratesFeedUrl) {
      const f = await feed(p.ratesFeedUrl);
      return {
        mode: 'feed',
        factor: 1,
        rates: f.rates,
        source: f.source,
        date: f.date,
        note: 'Rates updated from ' + f.source + ' (' + f.date + ')'
      };
    }

    const c = await currency();
    let basis = Number(p.fxBasis) || 0;
    let basisDate = String(p.ratesBasisDate || '').trim();
    // no basis stored yet: take it from the day the rates were compiled
    if (!basis && /^\d{4}-\d{2}-\d{2}$/.test(basisDate)) {
      try {
        const b = await currencyOn(basisDate);
        basis = b.usdGhs;
      } catch (e) { /* no history for that date — fall through to baseline */ }
    }
    if (!basis) {
      return {
        mode: 'fx-baseline',
        factor: 1,
        rates: {},
        source: c.source,
        date: c.date,
        usdGhs: c.usdGhs,
        basis: c.usdGhs,
        basisDate: basisDate || String(c.date).slice(0, 10),
        note: 'Baseline set: US$1 = GH¢' + c.usdGhs.toFixed(2) + ' on ' + fmtDate(c.date)
      };
    }
    const move = c.usdGhs / basis - 1;
    const factor = Math.max(0.5, Math.min(2, 1 + move * PASS_THROUGH));
    const pct = (factor - 1) * 100;
    return {
      mode: 'fx',
      factor: factor,
      rates: {},
      source: c.source,
      date: c.date,
      usdGhs: c.usdGhs,
      basis: basis,
      basisDate: basisDate,
      note: Math.abs(pct) < 0.05
        ? 'Prices confirmed current — US$1 = GH¢' + c.usdGhs.toFixed(2) + ' (' + fmtDate(c.date) + ')'
        : 'Prices indexed ' + (pct > 0 ? '+' : '') + pct.toFixed(1) + '% — US$1 = GH¢' + c.usdGhs.toFixed(2)
          + ' on ' + fmtDate(c.date) + ' against GH¢' + basis.toFixed(2)
          + (basisDate ? ' on ' + fmtDate(basisDate) : '')
    };
  }

  function fmtDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  root.LivePrices = {
    currency,
    feed,
    plan,
    aiRates,
    fmtDate,
    passThrough: PASS_THROUGH,
    online: () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)
  };
})(typeof window !== 'undefined' ? window : globalThis);
