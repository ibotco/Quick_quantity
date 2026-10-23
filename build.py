#!/usr/bin/env python3
"""Build the single-file offline app: inlines CSS, JS and the sample plan."""
import base64, json, pathlib, re, shutil

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"

def read(p):
    return (SRC / p).read_text(encoding="utf-8")

storejs = read("store.js")
css = read("app.css")
roofjs = read("roof.js")
engine = read("engine.js")
analyser = read("analyser.js")
drainagejs = read("drainage.js")
zipjs = read("zip.js")
xlsx = read("xlsx.js")
docx = read("docx.js")
pdfjs = read("pdf.js")
gen = read("gen.js")
settings = read("settings.js")
pdfimport = read("pdfimport.js")
liveprices = read("liveprices.js")
ratebuild = read("ratebuild.js")
materialsjs = read("materials.js")
labourjs = read("labour.js")
costbreakjs = read("costbreak.js")
cataloguejs = read("catalogue.js")
matdbjs = read("matdb.js")
matuijs = read("matui.js")
bbsjs = read("bbs.js")
bbsuijs = read("bbsui.js")
structjs = read("struct.js")
structuijs = read("structui.js")
digitaljs = read("digital.js")
library = read("library.js")
usersjs = read("users.js")
selectjs = read("select.js")
pdflib = (SRC / "vendor" / "pdf.min.js").read_text(encoding="utf-8")
pdfworker = (SRC / "vendor" / "pdf.worker.min.js").read_text(encoding="utf-8")
ui = read("ui.js")

sample = base64.b64encode((ROOT / "sample_plan.jpg").read_bytes()).decode("ascii")
sample_js = f'const SAMPLE_PLAN = "data:image/jpeg;base64,{sample}";'

html = read("index.template.html")
html = html.replace("/*__STORE__*/", storejs)
html = html.replace("/*__CSS__*/", css)
html = html.replace("/*__PDFWORKER__*/",
                    "window.__PDF_WORKER_SRC = " + json.dumps(pdfworker) + ";")
html = html.replace("/*__PDFLIB__*/", pdflib)
html = html.replace("/*__PDFIMPORT__*/", pdfimport)
html = html.replace("/*__ROOF__*/", roofjs)
html = html.replace("/*__DRAINAGE__*/", drainagejs)
html = html.replace("/*__ENGINE__*/", engine)
html = html.replace("/*__ANALYSER__*/", analyser)
html = html.replace("/*__ZIP__*/", zipjs)
html = html.replace("/*__XLSX__*/", xlsx)
html = html.replace("/*__DOCX__*/", docx)
html = html.replace("/*__PDF__*/", pdfjs)
html = html.replace("/*__SAMPLE__*/", sample_js)
html = html.replace("/*__GEN__*/", gen)
html = html.replace("/*__SELECT__*/", selectjs)
html = html.replace("/*__SETTINGS__*/", settings)
html = html.replace("/*__LIVEPRICES__*/", liveprices)
html = html.replace("/*__RATEBUILD__*/", ratebuild)
html = html.replace("/*__CATALOGUE__*/", cataloguejs)
html = html.replace("/*__MATDB__*/", matdbjs)
html = html.replace("/*__MATUI__*/", matuijs)
html = html.replace("/*__BBS__*/", bbsjs)
html = html.replace("/*__BBSUI__*/", bbsuijs)
html = html.replace("/*__STRUCT__*/", structjs)
html = html.replace("/*__STRUCTUI__*/", structuijs)
html = html.replace("/*__DIGITAL__*/", digitaljs)
html = html.replace("/*__MATERIALS__*/", materialsjs)
html = html.replace("/*__LABOUR__*/", labourjs)
html = html.replace("/*__COSTBREAK__*/", costbreakjs)
html = html.replace("/*__LIBRARY__*/", library)
html = html.replace("/*__USERS__*/", usersjs)
html = html.replace("/*__UI__*/", ui)

(ROOT / "index.html").write_text(html, encoding="utf-8")
print(f"index.html written — {len(html)/1024:.0f} KB")

# --- service worker + manifest (used when the folder is served over http)
manifest = {
    "name": "Quick Quantity — Offline Bill of Quantities",
    "short_name": "Quick Quantity",
    "description": "Generate a priced Bill of Quantities from a picture of a building plan. Works fully offline.",
    "start_url": "./index.html",
    "display": "standalone",
    "background_color": "#f4f6f4",
    "theme_color": "#1f4e3d",
    "icons": [
        {"src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
        {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}
    ]
}
import json
(ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

sw = """/* Quick Quantity service worker — cache-first, works offline */
const CACHE = 'plan2boq-v79';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
"""
(ROOT / "sw.js").write_text(sw, encoding="utf-8")
print("manifest.json, sw.js written")
