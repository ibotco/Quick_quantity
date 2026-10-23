#!/usr/bin/env python3
"""Serve Plan2BOQ for the preview pane.

    python3 serve.py [port]

Binds 0.0.0.0 so the preview proxy can reach it, serves this folder, and
sends no-store for the HTML so a rebuild of index.html is picked up at once
instead of coming back out of the browser or service-worker cache.
"""
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        path = self.path.split("?")[0]
        if path in ("", "/", "/index.html", "/sw.js", "/manifest.json"):
            # a fresh build has to win over anything cached
            self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s  %s\n" % (self.log_date_time_string(), fmt % args))


def main():
    if not os.path.exists(os.path.join(ROOT, "index.html")):
        sys.exit("index.html is missing — run:  python3 build.py")
    handler = partial(Handler, directory=ROOT)
    with ThreadingHTTPServer(("0.0.0.0", PORT), handler) as httpd:
        print("Plan2BOQ on http://0.0.0.0:%d  (serving %s)" % (PORT, ROOT), flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
