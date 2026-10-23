#!/usr/bin/env python3
"""Write a small multi-sheet PDF drawing set for the tests.

No third-party library: a PDF of text and rules, one page per sheet, the way a
title block reads. Used by test_generate.py to prove the reader takes figures
off a real set — the text is what pdf.js hands the app.
"""
import sys

PAGES = [
    ("GROUND FLOOR PLAN", ["SCALE 1:100", "BEDROOM 1", "BEDROOM 2", "LIVING/DINING",
                           "KITCHEN", "BATH ROOM", "VERANDAH"], 1200),
    ("SECTION A-A", ["SCALE 1:50", "FOUNDATION DEPTH 1.4m", "CEILING LEVEL 2.80 m",
                     "EAVES LEVEL 3.40 m", "RIDGE LEVEL 4.80 m", "HARDCORE 200 mm",
                     "OVERSITE CONCRETE 75 mm"], 600),
    ("FOUNDATION PLAN", ["SCALE 1:50", "STRIP FOOTING 600 x 225 mm", "TRENCH 0.7m",
                         "FOUNDATION WALL HEIGHT 0.9m"], 900),
    ("SITE PLAN", ["SCALE 1:500", "APRON 1.5m WIDE ROUND THE BUILDING",
                   "BOUNDARY WALL WITH ONE GATE"], 500),
    ("FRONT ELEVATION", ["SCALE 1:50", "PLINTH 0.45m", "EAVES HEIGHT 3.40m",
                         "CEMENT RENDER TO EXTERNAL WALLS"], 600),
    ("DOOR AND WINDOW SCHEDULE", ["D1 900 x 2100", "D2 800 x 2100", "D3 750 x 2100",
                                  "W1 1200 x 1200", "W2 1500 x 1200", "W3 600 x 600"], 700),
    ("FINISHES SCHEDULE", ["TERRAZZO TO LIVING AND BEDROOMS", "TILES TO TOILET AND BATH",
                           "POP CEILING", "TILES 1.5m HIGH TO WC WALLS"], 800),
    ("ELECTRICAL LAYOUT", ["LIGHT POINTS 4 PER ROOM", "SOCKETS 3 PER ROOM",
                           "BULKHEAD 6", "GENERATOR AND SOLAR PV"], 900),
    ("PLUMBING LAYOUT", ["WC 2", "SEPTIC TANK AND SOAKAWAY", "BOREHOLE"], 700),
]


def esc(t):
    return t.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")


def build(path):
    objs = []          # (number, body)
    n_pages = len(PAGES)
    kids = " ".join("%d 0 R" % (3 + 2 * i) for i in range(n_pages))
    objs.append((1, "<< /Type /Catalog /Pages 2 0 R >>"))
    objs.append((2, "<< /Type /Pages /Kids [%s] /Count %d >>" % (kids, n_pages)))
    font_no = 3 + 2 * n_pages
    for i, (title, lines, _w) in enumerate(PAGES, start=0):
        page_no = 3 + 2 * i
        cont_no = page_no + 1
        # the page is A3 landscape in points
        w, h = 1190, 842
        ops = ["0.4 w"]
        # no sheet border: the outline the app measures has to be the building
        ops += ["BT /F1 26 Tf 60 %d Td (%s) Tj ET" % (h - 100, esc(title)),
                "BT /F1 13 Tf 60 %d Td (%s) Tj ET" % (h - 132, esc(sheet_note(title)))]
        y = h - 200
        for ln in lines:
            ops.append("BT /F1 15 Tf 70 %d Td (%s) Tj ET" % (y, esc(ln)))
            y -= 44
        # the building, drawn at the sheet's own scale (1:100 on A3): a 12 m
        # front is 120 mm of paper, about 340 points on the rendered sheet
        x0, y0, x1, y1 = 200, 120, 540, 375
        ops.append("%d %d %d %d re S" % (x0, y0, x1 - x0, y1 - y0))
        for k in range(1, 4):                       # internal partitions
            ops.append("%d %d m %d %d l S" % (x0 + k * 85, y0, x0 + k * 85, y1))
        for k in range(1, 3):
            ops.append("%d %d m %d %d l S" % (x0, y0 + k * 85, x1, y0 + k * 85))
        stream = "\n".join(ops)
        objs.append((page_no, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %d %d] "
                               "/Contents %d 0 R /Resources << /Font << /F1 %d 0 R >> >> >>"
                     % (w, h, cont_no, font_no)))
        objs.append((cont_no, "<< /Length %d >>\nstream\n%s\nendstream" % (len(stream), stream)))
    objs.append((font_no, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"))

    objs.sort()
    out = "%PDF-1.4\n"
    offsets = {}
    for no, body in objs:
        offsets[no] = len(out.encode("latin-1"))
        out += "%d 0 obj\n%s\nendobj\n" % (no, body)
    xref = len(out.encode("latin-1"))
    size = max(offsets) + 1
    out += "xref\n0 %d\n0000000000 65535 f \n" % size
    for no in range(1, size):
        off = offsets.get(no, 0)
        out += "%010d 00000 n \n" % off
    out += "trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (size, xref)
    with open(path, "wb") as fh:
        fh.write(out.encode("latin-1"))
    return path


def sheet_note(title):
    return {
        "GROUND FLOOR PLAN": "PROPOSED 3-BEDROOM HOUSE",
        "SECTION A-A": "SECTION THROUGH THE BUILDING",
        "FOUNDATION PLAN": "FOUNDATION AND FOOTINGS",
        "SITE PLAN": "SITE AND SETTING OUT",
        "FRONT ELEVATION": "FRONT ELEVATION",
        "DOOR AND WINDOW SCHEDULE": "JOINERY SCHEDULE",
        "FINISHES SCHEDULE": "FINISHES AND CEILING",
        "ELECTRICAL LAYOUT": "POWER AND LIGHTING",
        "PLUMBING LAYOUT": "SANITARY AND WATER",
    }.get(title, "")


if __name__ == "__main__":
    print(build(sys.argv[1] if len(sys.argv) > 1 else "drawing_set.pdf"))
