#!/usr/bin/env python3
"""Build src/catalogue.js from the M.1.0–M.21.0 materials schedule (MATERIALS.pdf).

The schedule is a coding document: codes, names, groups and a few package sizes.
Everything a materials database needs beyond that — a unit of measure, a
specification line, an indicative rate — is added here by rule, so the result is
reproducible and reviewable rather than hand-typed.
"""
import json, re, sys, pathlib
import pymupdf

def g1(pat, text, default=''):
    m = re.search(pat, text)
    return m.group(1) if m else default

PDF = pathlib.Path('/home/user/uploads/MATERIALS.pdf')
OUT = pathlib.Path('/home/user/boq-app/src/catalogue.js')

CODE = re.compile(r'^M\.(\d+)(?:\.(\d+))?(?:\.(\d+))?$')

def parse():
    doc = pymupdf.open(PDF)
    lines = []
    for page in doc:
        for ln in page.get_text().split('\n'):
            ln = ln.strip()
            if ln:
                lines.append(ln)
    items, cat, sub, i, n = [], '', '', 0, 0
    while i < len(lines):
        ln = lines[i]
        if ln == 'M.0.0':            # the sheet's own title, not a group
            i += 2
            continue
        m = CODE.match(ln)
        if m:
            a = [int(x) for x in m.groups() if x is not None]
            if len(a) >= 2 and a[1] == 0:          # M.3.0.0 REINFORCEMENT
                cat = lines[i + 1].rstrip(':').strip()
                sub = ''
                i += 2
                continue
            if len(a) == 3 and a[2] == 0:          # M.3.1.0 MILD STEEL RODS
                sub = lines[i + 1].strip()
                i += 2
                continue
            j = i + 1
            parts = []
            while j < len(lines) and not CODE.match(lines[j]):
                parts.append(lines[j])
                j += 1
            n += 1
            items.append({'code': ln, 'cat': cat, 'sub': sub, 'parts': parts,
                          'orig': 'M.%d.%d' % (a[0], a[1])})
            i = j
            continue
        i += 1
    # a two-part code that other codes hang from is a section heading, not a material
    codes = set(i['code'] for i in items)
    out = []
    sub_carry = {}
    for it in items:
        deeper = any(c.startswith(it['code'] + '.') for c in codes)
        if deeper:
            sub_carry[it['code']] = clean_name_later(it['parts'])
            continue
        out.append(it)
    for it in out:
        for head, name in sub_carry.items():
            if it['code'].startswith(head + '.') and (not it['sub'] or it['sub'] == it.get('sub')):
                it['sub'] = name
    return out

def clean_name_later(parts):
    return ' '.join(parts).strip().rstrip(':')

# ---------------------------------------------------------------- the names
CLIPPED = [
    (r'\s-\s20mm\s+agg(re|r)?$', ' - 20mm aggregate'),
    (r'\s\+ PVC Bac$', ' + PVC Back'),
    (r'\s+$', ''),
]
FIX = [
    ('1200m x 2400mm', '1200 x 2400mm'),
    ('220mm thick x 90mm x 230mm', '220mm thick, 90 x 230mm'),
    ('Condcrete', 'Concrete'),
    ('  hardwood', ' hardwood'),
    ('Bladelouvre', 'Blade louvre'),
    ('Intalian', 'Italian'),
    ('Ficial', 'Facial'),
    ('Selt taping', 'Self tapping'),
    ('Egde Board', 'Edge Board'),
    ('FDT', 'FDT'),
]

def clean_name(parts):
    name = ' '.join(parts).strip()
    name = re.sub(r'\s+', ' ', name)
    for pat, rep in CLIPPED:
        name = re.sub(pat, rep, name, flags=re.I)
    for a, b in FIX:
        name = name.replace(a, b)
    name = name.rstrip(':').strip()
    # a package size is not part of the name — it belongs in the description
    name = re.sub(r'\s*/\s*\d+\s*(pc|pcs|pack|box|packs|boxes)\s*$', '', name, flags=re.I)
    name = re.sub(r'^(.*?);\s*Ref:\s*(.*)$', r'\1; Ref \2', name)
    return name

PACK = re.compile(r'(\d+(?:\.\d+)?\s*(?:kg|g|m|mm|cm|m2|m²|m3|m³|L|litres?|roll|pack|pcs?|pc|no|bag|sheet|ton|yard)\b[^,;)]*)', re.I)

def pack_of(parts):
    if len(parts) > 1:
        return parts[1].strip()
    m = re.search(r'/\s*(\d+\s*(?:pc|pcs|pack|box|packs|boxes))\s*$', ' '.join(parts), re.I)
    return m.group(1) if m else ''

# ---------------------------------------------------------------- units
def unit_for(code, cat, name, sub):
    n = name.lower()
    if cat == 'CEMENTS':
        return 'bag'
    if cat == 'AGGREGATES':
        return 'm3'
    if cat == 'REINFORCEMENT':
        if 'brc mesh' in n: return 'm2'
        if 'binding wire' in n: return 'roll'
        return 'kg'
    if cat == 'BLOCKS & EARTH BRICKS':
        if 'wall ties' in n or 'shear' in n: return 'No.'
        if 'cavity closers' in n: return 'm'
        if 'insulation board' in n: return 'm2'
        return 'No.'
    if cat == 'CONCRETE PRODUCTS':
        if 'kerb' in n: return 'm'
        if 'pipe' in n: return 'm'
        if 'slab' in n: return 'No.'
        return 'm2'                     # paving blocks and pavement tiles
    if cat == 'TIMBER':
        if 'plywood' in n or 'wawa board' in n: return 'sheet'
        if n.startswith('solignum') or 'mould oil' in n: return 'L'
        if 'slat' in n: return 'm2'
        return 'm'
    if cat == 'ROOFING':
        if 'ridge' in n or 'capping' in n or 'gutter' in n or 'facia' in n or 'fascia' in n:
            return 'm'
        if 'tiles' in n or 'shingle' in n or 'sheet' in n or 'stonecoat' in n or 'duratile' in n \
           or 'roma' in n or 'dbs' in n or 'raincoat' in n or 'domod' in n or 'polycarbonate' in n:
            return 'm2' if ('x' in n or 'mm' in n) else 'm2'
        if 'nails' in n or 'screws' in n: return 'kg'
        if 'trusses' in n: return 'No.'
        if 'sealant' in n or 'granules' in n: return 'kg'
        if 'vent' in n: return 'No.'
        return 'm2'
    if cat == 'CEILING':
        if 'plasterboard' in n or 'cement board' in n or 'tiles' in n or 'panels' in n \
           or 'insulation' in n or 'mineral wool' in n or 'acoustic' in n: return 'm2'
        if 'screws' in n or 'hanger wire' in n or 'nails' in n: return 'kg'
        if 'tape' in n: return 'roll'
        if 'powder' in n or 'compound' in n or 'cement' in n: return 'bag'
        if 'plug' in n: return 'pack'
        if 'anchor bolt' in n or 'grille' in n: return 'No.'
        if 'fibre' in n or 'soap' in n or 'oil' in n: return 'kg' if 'fibre' in n else 'No.'
        return 'm'                      # channels, studs, tracks, tees, angles, cornice
    if cat == 'DOORS AND FRAMES':
        if 'frame' in n: return 'No.'
        if 'screws' in n: return 'kg'
        if 'hinge' in n: return 'pair'
        if 'veneer' in n: return 'm2'
        return 'No.'
    if cat == 'GLAZING AND PANELS':
        if 'glass' in n and 'block' not in n and 'balustrade' not in n: return 'm2'
        if 'curtain wall' in n or 'composite' in n or 'panel' in n or 'netting' in n or 'fiber net' in n: return 'm2'
        if 'rubber' in n or 'brush' in n or 'profile' in n or 'beading' in n or 'channel' in n or 'division' in n: return 'm'
        if 'silicone' in n or 'foam' in n or 'spray' in n: return 'No.'
        return 'No.'
    if cat == 'METAL WORKS':
        if 'mesh' in n or 'plate' in n or 'sheet' in n: return 'sheet'
        if 'pipe' in n or 'bar' in n or 'post' in n and 'cap' not in n: return 'm'
        if 'gates' in n or 'gate ' in n or 'shutter' in n: return 'No.'
        if 'burglar' in n or 'balustrade' in n or 'chain link' in n: return 'm2' if 'burglar' in n or 'balustrade' in n else 'roll'
        if 'wire' in n: return 'roll'
        if 'cap' in n or 'hinge' in n or 'latch' in n or 'bolt' in n: return 'No.'
        return 'm'
    if cat == 'PLUMBING WORKS':
        return 'No.'
    if cat == 'TILES':
        if 'adhesive' in n or 'cement' in n: return 'bag'
        if 'grout' in n: return 'kg'
        if 'spacer' in n or 'u-pins' in n: return 'pack'
        if 'skirting' in n or 'strip' in n or 'bar' in n: return 'm'
        if 'door bar' in n: return 'No.'
        return 'm2'
    if cat == 'PAINTS':
        if 'putty' in n or 'graffiato' in n or 'filler' in n or 'body filer' in n: return 'kg'
        if 'application' in n: return 'm2'
        return 'L'
    if cat == 'TERRAZZO':
        if 'chippings' in n or 'oxalic' in n or 'powder' in n: return 'kg'
        if 'disc' in n: return 'No.'
        if 'polish' in n or 'detergent' in n: return 'L'
        if 'strip' in n: return 'm'
        return 'No.'
    if cat == 'WATERPROOFING, DAMP-PROOF MEMBRANES AND TREATMENTS':
        if 'membrane' in n or 'felt' in n or 'underlay' in n: return 'm2'
        if 'tape' in n: return 'roll'
        if 'waterstop' in n or 'waterbar' in n: return 'm'
        if 'screed' in n: return 'bag'
        if 'bonding agent' in n or 'latex' in n: return 'kg'
        if 'termite' in n: return 'L'
        return 'kg'
    if cat == 'EXTERNAL & ROAD WORKS':
        if 'grass' in n: return 'm2'
        if 'bitumen' in n: return 'L' if 'm.c' in n.lower() else 'kg'
        return 'No.'
    if cat == 'CABINETS AND WOODEN SHELVES':
        if 'board' in n or 'panel' in n: return 'sheet'
        if 'hinge' in n or 'handle' in n or 'leg' in n or 'wardrobe' in n or 'vanity' in n: return 'No.'
        if 'screws' in n: return 'box'
        if 'glue' in n: return 'L'
        if 'cutting' in n: return 'm'
        return 'm'
    if cat == 'MISCELLANEOUS':
        if 'gauze' in n: return 'm2'
        if 'nails' in n: return 'kg'
        if 'sand paper' in n or 'paper' in n: return 'sheet'
        if 'tape' in n: return 'roll'
        if 'polystrene' in n: return 'sheet'
        if 'pipe' in n: return 'm'
        if 'vent cap' in n or 'tee' in n or 'panel' in n: return 'No.'
        if 'liquid nail' in n: return 'tube'
        if 'cullamix' in n: return 'bag'
        if 'granite' in n: return 'm2'
        if 'rubble' in n: return 'm3'
        return 'No.'
    if cat == 'PRE-MIX CONCRETE':
        return 'm3'
    return 'No.'

# ------------------------------------------------------------- descriptions
USE = {
    'CEMENTS': 'for concrete, mortar, plaster and screeds',
    'AGGREGATES': 'delivered to site, clean and graded',
    'REINFORCEMENT': 'cut, bent and fixed to the engineer\'s details',
    'BLOCKS & EARTH BRICKS': 'laid in cement mortar, including cutting at openings',
    'CONCRETE PRODUCTS': 'laid and bedded as specified',
    'TIMBER': 'wrought, framed and fixed; moisture content as specified',
    'ROOFING': 'fixed with the manufacturer\'s fastenings, side laps to the fall',
    'CEILING': 'fixed to the grid or framing, joints taped and skimmed',
    'DOORS AND FRAMES': 'hung and fixed complete with ironmongery',
    'GLAZING AND PANELS': 'glazed, gasketed and sealed to the manufacturer\'s detail',
    'METAL WORKS': 'fabricated, galvanized and fixed; welds dressed and painted',
    'PLUMBING WORKS': 'supplied and installed complete with fittings and connections',
    'TILES': 'laid on the prepared bedding or adhesive, joints filled and cleaned off',
    'PAINTS': 'applied by brush or roller in the number of coats specified',
    'TERRAZZO': 'mixed and laid to the approved sample, ground and polished',
    'WATERPROOFING, DAMP-PROOF MEMBRANES AND TREATMENTS': 'applied to the prepared, dry surface in the coats specified',
    'EXTERNAL & ROAD WORKS': 'supplied, laid and consolidated',
    'CABINETS AND WOODEN SHELVES': 'manufactured and fixed to the approved detail',
    'MISCELLANEOUS': 'supplied as specified',
    'PRE-MIX CONCRETE': 'supplied ready-mixed, placed, compacted and cured',
}
CLASS = {
    'CEMENTS': {
        '32.5R': 'Portland-limestone cement, strength class 32.5R (CEM II/B-L), 50 kg bag',
        '42.5R': 'Portland cement, strength class 42.5R (CEM I), 50 kg bag',
        '52.5R': 'Portland cement, strength class 52.5R (CEM I), 50 kg bag',
    },
}

GLAZE_OVR = [
            ('silicone', 'Silicone sealant, 300 ml cartridge, to all joints and beads'),
            ('abro', 'Spray adhesive, 400 ml can, for panels and trims'),
            ('self cut screw', 'Self-drilling screws, pack, for the frame fixings'),
            ('installation screw', 'Installation screws, pack, for the frame fixings'),
            ('fitting screw', 'Fitting screws, pack, for the ironmongery'),
            ('nylon plug', 'Nylon plugs with screws, pack of 100'),
            ('plugs', 'Plugs, pack, with screws, for the frame fixings'),
            ('revit pin', 'Revit pin / rivet, for the frame joints'),
            ('foam', 'Expanding foam filler, 750 ml can, to the frame gaps'),
            ('mild steel decorative screen', 'Mild steel decorative screen panel, powder coated, fixed in the opening'),
            ('raise access floor tiles', 'Raised access floor tile, 600 × 600 mm, in the panel system'),
            ('stringers', 'Stringer with screws, for the raised access floor'),
            ('pedestal', 'Access floor pedestal, adjustable, under the panel corners'),
            ('perimeter channel', 'Perimeter channel, aluminium, fixed at the wall junction'),
            ('panel reinforcing', 'Panel reinforcing plate, behind the panel joints'),
            ('panel anchors', 'Panel anchor, stainless, at the panel edges'),
            ('expansion strips', 'Expansion strip, closed cell, at the panel joints'),
        ]

def describe(name, cat, sub, unit, pack):
    n = name.lower()
    d = ''
    if cat == 'GLAZING AND PANELS':
        for k, v in GLAZE_OVR:
            if k in n:
                d = v
                break
    if d:
        return d + (' · ' + pack if pack else '')
    if cat == 'CEMENTS':
        for k, v in CLASS.get(cat, {}).items():
            if k in name:
                d = v
                break
        if 'white' in n:
            d = 'White Portland cement, 25 kg bag, for fair-faced work and terrazzo'
    elif cat == 'AGGREGATES':
        if 'boulder' in n: d = 'Boulders 40–600 mm, for hardcore and rubble filling'
        elif '38/40' in n: d = 'Coarse aggregate, 38/40 mm graded, for mass and blinding concrete'
        elif '19/20' in n: d = 'Coarse aggregate, 19/20 mm graded, for structural concrete'
        elif '16mm' in n: d = 'Coarse aggregate, 16 mm single size, for concrete and precast work'
        elif '6 - 10' in n: d = 'Coarse aggregate, 6–10 mm chippings, for thin sections and toppings'
        elif 'hand-broken' in n: d = 'Hand-broken aggregate, 10–40 mm, for blinding and fill'
        elif 'rough' in n: d = 'Coarse (rough) sand, washed, for concrete and mortar'
        elif 'fine' in n: d = 'Fine (smooth) plaster sand, sieved, for plaster and screeds'
        elif 'quarry dust' in n: d = 'Quarry dust, for block making and bedding'
        elif 'laterite' in n: d = 'Laterite, for filling and hardstanding'
        elif 'gravel' in n: d = 'Gravel, pit-run, for drainage and fill'
        elif 'black soil' in n: d = 'Black soil, for nursery and landscaping'
        elif 'pebbles' in n: d = 'Sea pebbles, washed, for decorative work'
        d = (d + '; ' if d else '') + 'delivered by the cubic metre'
    elif cat == 'REINFORCEMENT':
        m = re.search(r'(\d+(?:\.\d+)?)\s*mm', name)
        dia = m.group(1) if m else ''
        if 'brc mesh' in n:
            kg = re.search(r'([\d.]+)\s*kg/m2', name)
            d = 'Fabric reinforcement to BS 4483, %s%s sheet area weight; laps as specified' % (
                name.split('Ref')[1].split(',')[0].strip() + ', ' if 'Ref' in name else '',
                kg.group(1) + ' kg/m²' if kg else '')
        elif 'binding wire' in n:
            d = 'Annealed steel binding wire, 1.6 mm, %s' % (pack or '8.78 kg roll')
        else:
            wt = {'6': '0.222', '8': '0.395', '10': '0.616', '11': '0.746', '12': '0.888', '14': '1.21',
                  '16': '1.58', '18': '2.00', '20': '2.47', '25': '3.85', '32': '6.31'}.get(dia, '')
            kind = 'High-yield deformed' if 'tensile' in n else 'Mild steel'
            d = '%s reinforcement bar, %s mm diameter, 12 m stock length%s; cut, bent and fixed to the bar schedule' % (
                kind, dia, ' (%s kg/m)' % wt if wt else '')
    elif cat == 'BLOCKS & EARTH BRICKS':
        if 'block' in n and ('mm solid' in n or 'mm hollow' in n):
            t = g1(r'(\d+)\s*mm', name)
            solid = 'solid' in n
            mat = 'Concrete/quarry dust' if 'concrete' in n else 'Sandcrete'
            d = '%s %s block, %s mm thick, nominal 450 × %s × 225 mm, laid in cement mortar' % (
                mat, 'solid' if solid else 'hollow', t, t)
        elif 'design block' in n:
            d = 'Design block, 75 mm thick, 200 × 450 mm face, for non-loadbearing panels'
        elif 'hydraform' in n:
            d = 'Hydraform interlocking brick, 220 mm thick, 90 × 230 mm module, dry-stacked'
        elif 'compressed earth' in n:
            d = 'Interlocking compressed earth brick, 150 mm thick, 90 × 300 mm module'
        elif 'facing brick slice' in n:
            d = 'Facing brick slice / terracotta, %s, for external cladding' % g1(r'(\d+\s*x\s*\d+\s*x\s*\d+mm)', name)
        elif 'facing brick' in n:
            d = 'Facing brick / terracotta floor tile, 200 × 200 × 40 mm'
        elif 'wall ties' in n:
            d = 'Cavity wall ties, galvanised, at 450 × 900 mm centres'
        elif 'shear' in n:
            d = 'Shear / debonding ties at movement joints'
        elif 'closer' in n:
            d = '50 mm cavity closer, PVC, at openings'
        elif 'insulation' in n:
            d = '50 mm cavity insulation board, closed cell'
    elif cat == 'CONCRETE PRODUCTS':
        if 'paving' in n:
            d = 'Precast concrete paving block, %s, laid on a sand bed' % name.split(' rectangular')[0].split(' [')[0]
        elif 'pavement tiles' in n:
            d = 'Precast concrete / terracotta pavement tile, 400 × 400 × 10 mm'
        elif 'slab' in n:
            m = re.search(r'([\d]+\s*mm\s*x\s*\d+\s*mm\s*x\s*\d+\s*mm)', name)
            d = 'Precast concrete slab, %s' % (m.group(1) if m else '')
        elif 'column cap' in n:
            d = 'Precast concrete column cap, to the engineer\'s detail'
        elif 'kerb' in n:
            m = re.search(r'\(([^)]+)\)', name)
            d = 'Precast concrete kerb, %s, on a concrete bed and haunch' % (m.group(1) if m else '')
        elif 'pipe' in n:
            d = 'Precast concrete pipe, %s, laid in a trench to the falls shown' % name.split(' precast')[0].strip()
    elif cat == 'TIMBER':
        m = re.search(r'(\d+)\s*x\s*(\d+)\s*mm', name)
        if 'plywood' in n:
            t = re.search(r'(\d+(?:\.\d+)?mm)', name)
            d = '%s plywood, 1220 × 2440 mm sheet' % (t.group(1) if t else '')
        elif 'wawa' in n:
            d = 'Wawa board, 25 × 300 mm, 1 × 12 ft, for shelving and partitions'
        elif n.startswith('solignum'):
            d = 'Solignum / creosote wood preservative, brushed on all embedded and exposed timber'
        elif 'mould oil' in n:
            d = 'Mould oil, applied to formwork before each pour'
        elif m:
            a, b = int(m.group(1)), int(m.group(2))
            vol = a * b / 1e6
            d = 'Sawn %stimber, %d × %d mm, %s, wrought and fixed' % (
                'preservative treated ' if 'treated' in n else ('softwood ' if 'soft' in n else 'hardwood '),
                a, b, '%.3f m³ per metre run' % vol)
        elif 'skirting' in n or 'cornice' in n:
            d = 'Red hardwood skirting / cornice, %s, plugged and screwed' % name.split(' (')[0]
        elif 'battens' in n:
            d = 'Hardwood battens, %s, for framing and grounds' % name.split(' (')[0]
        elif 'bead' in n or 'stopper' in n or 'architrave' in n:
            d = '%s, fixed with panel pins' % name.split(' (')[0]
        elif 'fascia' in n:
            d = 'Wrought hardwood fascia / barge board, 25 × 250 mm, primed on all faces'
        elif 'slat' in n:
            d = 'Tongued and grooved hardwood slats, 12 × 96 mm, for ceiling and wall lining'
    elif cat == 'ROOFING':
        if 'roofing sheet' in n or 'roofing sheets' in n or 'roofing sheet' in n:
            thick = g1(r'([\d.]+\s*mm)', name)
            cover = g1(r'(\d{3,4}\s*mm)\s*[xX]', name, '875 mm')
            prof = 'IBR' if 'ibr' in n else ('corrugated' if 'corrugat' in n else 'profiled')
            head = (thick + ' ' if thick else '') + prof
            d = '%s roofing sheet, %s cover width, fixed with drive screws and washers at every second crest' % (head, cover)
        elif 'polycarbonate' in n:
            d = 'Corrugated polycarbonate rooflight sheet, 0.8 mm, matching the roof profile'
        elif 'ridge' in n or 'capping' in n:
            d = 'Ridge / hip capping, %s, fixed with the matching fastenings' % (g1(r'([\d.]+mm[^,]*)', name) if re.search(r'([\d.]+mm[^,]*)', name) else '')
        elif 'nails' in n:
            d = 'Roofing nails, umbrella head, galvanised'
        elif 'screws' in n:
            d = 'Roofing screws with EPDM washers, self-drilling'
        elif 'tiles' in n:
            d = 'Interlocking roof tile, 410 × 330 × 25 mm, at 12–14 tiles per m²'
        elif 'shingle' in n:
            d = 'Mineral-surfaced roofing shingle, laid to the manufacturer\'s pattern'
        elif 'stone' in n and 'coated' in n:
            d = 'Stone-coated metal roof tile, 400 × 1400 mm, laid to the manufacturer\'s pattern'
        elif 'gutter' in n:
            d = 'Aluminium P-P gutter, 0.45 mm, fixed on brackets at 600 mm centres'
        elif 'facia' in n or 'fascia' in n:
            d = 'Fascia board, 250 mm, fixed over the rafter ends'
        elif 'truss' in n:
            d = 'Roof truss, engineered and supplied to the roof layout'
        elif 'vent' in n:
            d = 'Roof vent, matching the covering'
    elif cat == 'CEILING':
        if 'plasterboard' in n:
            d = 'Gypsum plasterboard, %s, 1200 × 2400 mm, screwed at 200 mm centres' % (g1(r'([\d.]+mm)', name) if re.search(r'([\d.]+mm)', name) else '')
        elif 'cement board' in n:
            d = 'Fibre cement board, %s, 1200 × 2400 mm, in wet areas' % name.split(' x')[0]
        elif 'screws' in n or 'nails' in n:
            d = 'Self-drilling plasterboard screws, coarse thread'
        elif 'tape' in n:
            d = 'Fibre mesh jointing tape, 48 mm × 90 m'
        elif 'powder' in n:
            d = 'Skimming powder, 25 kg bag'
        elif 'compound' in n:
            d = 'Joint compound, ready mixed'
        elif 'mineral wool' in n:
            d = 'Mineral wool insulation, %s, between the ceiling and the roof' % name.split(' Mineral')[0]
        elif 'tiles' in n and 'grille' not in n:
            d = 'Ceiling tile, %s, laid in the exposed grid' % (g1(r'([\d ]+x[\d ]+x[\d ]+mm)', name) if re.search(r'([\d ]+x[\d ]+x[\d ]+mm)', name) else '')
        elif 'grid' in n or 'channel' in n or 'stud' in n or 'track' in n or 'angle' in n or 'tee' in n:
            d = 'Galvanised ceiling grid / partition section, %s, fixed at the spacing shown' % name.split(' /')[0]
        elif 'plastic t and g' in n:
            d = 'PVC tongued and grooved ceiling strip, 5800 mm, fixed to timber battens'
        elif 'cornice' in n:
            d = 'Gypsum board cornice, 100 mm, at the wall/ceiling junction'
        elif 'grille' in n:
            d = 'Ceiling grille with insect screen, fixed in the ceiling'
    elif cat == 'DOORS AND FRAMES':
        if 'door' in n:
            size = re.search(r'size\s*([\d]+\s*x\s*[\d]+\s*mm)', name)
            d = 'Flush / panelled door, %s thick, %s, hung on 100 mm brass butt hinges' % (
                g1(r'(\d+mm) (?:Single|Double)', name) if re.search(r'(\d+mm) (?:Single|Double)', name) else '44 mm',
                size.group(1) if size else '')
        elif 'frame' in n:
            m = re.search(r'([\d ]+x[\d ]+mm)', name)
            d = 'Door frame, %s hardwood, with stops and architrave' % (m.group(1) if m else '')
        elif 'lock' in n:
            d = 'Mortice lock, 3-lever, with matching furniture'
        elif 'closer' in n:
            d = 'Door closer, %s, adjusted on commissioning' % ('overhead hydraulic' if 'hydraulic' in n else 'slide channel')
        elif 'hinge' in n:
            d = 'Brass butt hinges, 100 mm, one and a half pairs per leaf'
        elif 'barrel bolt' in n:
            d = 'Barrel bolt, 150 mm, brass'
        elif 'screws' in n:
            d = 'Steel wood screws, 1½ inch'
        elif 'veneer' in n:
            d = 'Wall nut veneer, 0.6 mm, laid and polished'
    elif cat == 'GLAZING AND PANELS':
        if 'glass block' in n:
            m = re.search(r'(\d+\s*x\s*\d+\s*x\s*\d+\s*mm)', name)
            d = 'Glass block, %s, laid in the approved pattern with spacers' % (m.group(1) if m else '')
        elif 'thick glass' in n:
            m = re.search(r'(\d+mm)', name)
            d = '%s clear float glass, glazed with rubber and beads' % (m.group(1) if m else '')
        elif 'louvre blade' in n:
            d = '5 mm plain glass louvre blade, 150 mm wide, in an aluminium carrier'
        elif 'carrier' in n:
            m = re.search(r'\(([^)]+)\)', name)
            d = 'Louvre carrier, %s, with screws' % (m.group(1) if m else '')
        elif 'curtain wall' in n:
            d = '%s curtain walling, aluminium framed, structurally glazed' % name.split(' Curtain')[0]
        elif 'composite' in n:
            d = 'Aluminium composite (Alucobond) panel, %s, on an aluminium sub-frame' % name.split(' Aluminium')[0]
        elif 'balustrade' in n:
            d = 'Glass balustrade, toughened, with a stainless handrail'
        elif sub and sub not in ('Glazing', 'Louvre Blades & Carriers'):
            SYS = {
                'Glazing Windows: Accessories': ('aluminium window', 'window'),
                'Framed Glazing Doors: Accessories': ('aluminium framed door', 'door'),
                'Frameless Glazing Doors: Accessories': ('aluminium frameless door', 'door'),
                'Curtain Walling & Glass Wall Partitioning': ('curtain wall', 'curtain wall'),
                'Screens, Panels & Balustrades': ('screen / panel', 'screen or balustrade'),
                'Glass Block Walling': ('glass block wall', 'glass block wall'),
            }
            adj, what = SYS.get(sub, ('aluminium window', 'assembly'))
            d = '%s profile / fitting — %s — supplied in 6 m stock or as a set, fixed as part of the %s' % (
                adj, name, what)
        elif 'rubber' in n:
            d = 'Glazing rubber / gasket, %s, to the system' % name
    elif cat == 'METAL WORKS':
        if 'burglar' in n:
            d = 'Burglar-proof metal frame, %s, galvanized and fixed' % ('collapsible' if 'collapsible' in n else 'fixed')
        elif 'balustrade' in n:
            d = 'Stainless steel balustrade, 10 mm bars, %s 1050 mm high' % ('not less than' if 'not less' in n else 'less than')
        elif 'gate' in n:
            d = 'Prefabricated metal gate, %s, hung on galvanized posts' % (g1(r'size ([^,]+)', name) if re.search(r'size ([^,]+)', name) else '')
        elif 'shutter' in n:
            d = 'Roller shutter door, galvanized, with lock and guide channels'
        elif 'chain link' in n:
            d = 'Chain link fencing, 4.0 mm wire, 1.8 m × 15 m roll%s' % (' PVC coated' if 'pvc' in n else '')
        elif 'pipe' in n:
            m = re.search(r'([\d ]+mm diameter[^,]*)', name)
            d = 'Galvanized steel pipe, %s, for framing and railings' % (m.group(1) if m else name)
        elif 'angle bar' in n:
            m = re.search(r'([\d ]+x[\d ]+mm)', name)
            d = 'Galvanized angle bar, %s' % (m.group(1) if m else name)
        elif 'mesh' in n or 'plate' in n:
            d = 'Galvanized mesh / plate, %s' % name
        elif 'wire' in n:
            d = 'Galvanized wire, %s, for fencing' % name
    elif cat == 'PLUMBING WORKS':
        fam = [
            ('water closet (p-trap)', 'WC suite with P-trap pan, close-coupled cistern, seat and cover; connector to the soil pipe'),
            ('water closet (s-trap)', 'WC suite with S-trap pan, close-coupled cistern, seat and cover; connector to the soil pipe'),
            ('closed couple', 'Close-coupled WC suite, dual-flush cistern, seat and cover'),
            ('disabled wc', 'Disabled WC set, 700 mm high pan, grab rails and cistern'),
            ('wall-hung wc', 'Wall-hung WC pan with concealed cistern and seat'),
            ('squat wc', 'Squatting WC pan, set in the floor screed'),
            ('floor standing wc', 'Floor-standing WC suite with cistern and seat'),
            ('grab rail', 'Stainless grab rail, 600 × 95 mm, fixed to the wall with heavy-duty anchors'),
            ('grab bar', 'Stainless grab bar, 32 mm diameter, with snap flanges'),
            ('concealed cistern', 'Concealed cistern with dual-flush valve, built into the duct'),
            ('actuator', 'Flush actuator plate, dual flush, on the tiled face'),
            ('wash hand basin', 'Wash-hand basin with pedestal, waste, trap and tap holes; connector to the waste'),
            ('stone basin', 'Custom stone basin, worked and sealed, on a stone console'),
            ('hand shower set with mixer', 'Hand shower set with mixer tap, hose and bracket'),
            ('hand shower set', 'Hand shower set, hose and bracket, on the mixer'),
            ('concealed shower', 'Concealed shower valve with overhead and hand shower'),
            ('shower cubicle', 'Shower cubicle with tray, enclosure and door'),
            ('shower cabinet', 'Shower cabinet in translucent glass with handle at 2 m'),
            ('pillar tap', 'Self-closing pillar tap, chrome, on the basin'),
            ('push tap', 'Push-button tap, chrome'),
            ('3/4 inch tap', '3/4 inch brass tap, on the service line'),
            ('1/2 inch tap', '1/2 inch brass tap, on the service line'),
            ('motion sensor faucet', 'Motion-sensor basin faucet with control box and battery backup'),
            ('undercounter basin', 'Undercounter basin with waste and trap, set under the worktop'),
            ('urinal bowl', 'Urinal bowl with spreader, waste and flush connection'),
            ('urinal partition', 'Urinal privacy partition, fixed between bowls'),
            ('kitchen sink', 'Stainless steel kitchen sink with drainer, waste and trap'),
            ("cleaners' sink", "Cleaners' sink with a high back and grid, on a bracket"),
            ('belfast sink', 'Belfast sink, glazed fireclay, with waste and trap'),
            ('lab sink', 'Laboratory sink, acid-resisting, with waste and trap'),
            ('utility sink', 'Stainless steel utility sink with stand and waste'),
            ('bath tub', 'Bath tub, acrylic, with waste, overflow and tap holes'),
            ('shower tray', 'Shower tray with waste and trap, set on a mortar bed'),
            ('water heater', 'Electric water heater with safety valve, supplied and connected'),
            ('mirror', 'Plate glass mirror, polished edges, fixed with mirror adhesive'),
            ('soap dish', 'Soap dish, chrome, on the wall'),
            ('toilet roll holder', 'Toilet roll holder, chrome'),
            ('toilet brush', 'Toilet brush and holder'),
            ('towel rail', 'Towel rail, chrome, fixed to the wall'),
            ('towel ring', 'Towel ring, chrome'),
            ('robe hook', 'Stainless steel robe hook'),
            ('soap dispenser', 'Liquid soap dispenser, 500 ml'),
            ('paper towel', 'Paper towel dispenser, stainless'),
            ('sanitizer', 'Hand-sensor sanitizer dispenser'),
            ('waste bin', 'Waste bin, stainless, with lid'),
            ('floor drain', 'Floor drain with grating, set to the floor fall'),
            ('stop cock', 'Brass stop cock with wheel head, on the incoming main'),
            ('polytank', 'Polytank water storage tank, complete with lid, inlet, outlet and ball valve'),
            ('passenger lift', 'Passenger lift, machine-room-less, complete with car, doors, controller and installation'),
            ('service lift', 'Service lift, complete with car, doors, controller and installation'),
            ('avr', '30 kVA automatic voltage regulator with backup UPS for the lift supply'),
        ]
        for k, v in fam:
            if k in n:
                d = v
                break
        if not d or d == name:
            d = 'Sanitary fitting supplied and installed complete with connections'
    elif cat == 'TILES':
        if 'carpet tiles' in n or 'vinyl' in n:
            d = 'Carpet / vinyl tile, laid on a screeded bed with the approved adhesive'
        elif 'astroturf' in n or 'grass' in n:
            d = 'Artificial grass, %s, laid on a consolidated sand bed' % name.split(' Artificial')[0]
        elif 'adhesive' in n or 'cement' in n:
            d = 'Tile adhesive, 25 kg bag, notched trowel application'
        elif 'grout' in n:
            d = 'Tile grout, to the approved colour'
        elif 'spacer' in n:
            d = 'Tile spacers, 100 per pack'
        elif 'skirting' in n:
            d = 'PVC skirting board, 100 mm, fixed at the wall base'
        else:
            dims = g1(r'([\d ]+x[\d ]+x[\d ]+mm)', name)
            if 'porcelain' in n:
                kind = 'Polished porcelain' if 'polished' in n else 'Porcelain'
            elif 'wall' in n:
                kind = 'Glazed ceramic wall tile'
            elif 'floor' in n:
                kind = 'Ceramic floor tile'
            elif 'terracotta' in n:
                kind = 'Terracotta clay'
            else:
                kind = 'Ceramic tile'
            d = '%s, %s, laid with 3 mm joints on the prepared bedding' % (kind, dims)
    elif cat == 'PAINTS':
        fam = [
            ('smoothover', 'Pre-paint smoothing compound, 25 kg bag, for filling and levelling'),
            ('skimming', 'Skimming putty, 25 kg bag, applied with a trowel and sanded'),
            ('putty', 'Putty / filler, 25 kg bag, for stopping and levelling'),
            ('primer', 'Primer, 20 litre drum, one coat on the prepared surface'),
            ('emulsion', 'Emulsion paint, 20 litre drum, two coats with a roller'),
            ('anti-bacteria', 'Anti-bacterial washable emulsion, 20 litre drum, for walls and ceilings'),
            ('fire', 'Fire-retardant paint, 20 litre drum, to the specified class'),
            ('anti-dust', 'Anti-dust floor paint, 20 litre drum, two coats'),
            ('waterproofer', 'Waterproofing paint, 20 litre drum, for wet areas and roofs'),
            ('graffiato', 'Graffiato texture finish, 25 kg bag, sprayed and scraped'),
            ('sealer', 'Sealer, 20 litre drum, on the prepared substrate'),
            ('gloss', 'Gloss oil paint, 4 litre tin, one coat on primer'),
            ('wood primer', 'Wood primer, 20 litre drum, on all joinery'),
            ('red oxide', 'Galvanized iron primer / red oxide, 20 litre drum, on metalwork'),
            ('lacquer', 'Polyurethane lacquer, 20 litre drum, sprayed on joinery'),
            ('thinner', 'Thinners, 20 litre drum, for cleaning and thinning'),
            ('hardener', 'Hardener, 4 litre tin, mixed to the manufacturer\'s ratio'),
            ('sanding sealer', 'Sanding sealer, 20 litre drum, on wood before lacquer'),
            ('wood', 'Wood stain / filler, 4 litre tin, to the approved shade'),
            ('epoxy', 'Epoxy coating, 20 litre kit, applied by roller or trowel'),
            ('polyurethane', 'Polyurethane top coat, 20 litre kit, on the epoxy base'),
        ]
        for k, v in fam:
            if k in n:
                d = v
                break
        if not d or d == name:
            d = 'Paint / coating, supplied in the manufacturer\'s pack'
    elif cat == 'TERRAZZO':
        d = 'Terrazzo material / abrasive, to the approved sample'
    elif cat == 'WATERPROOFING, DAMP-PROOF MEMBRANES AND TREATMENTS':
        if 'membrane' in n:
            m = re.search(r'(\d+\s*microns?[^,;]*)', name)
            d = 'Damp-proof membrane, %s, lapped 150 mm and taped' % (m.group(1) if m else '')
        elif 'felt' in n:
            d = 'Bitumen roofing felt, 2-ply, laid with laps'
        d = (d + '; ' if d else '') + 'applied to the prepared surface'
    elif cat == 'EXTERNAL & ROAD WORKS':
        if 'grass' in n:
            d = 'Grass, supplied and laid as turf'
        elif 'tree' in n:
            d = 'Tree, supplied and planted with a watering collar'
        elif 'flower' in n:
            d = 'Flower / shrub, supplied and planted'
        else:
            d = 'Bitumen binder, supplied in drums'
    elif cat == 'CABINETS AND WOODEN SHELVES':
        if 'board' in n or 'panel' in n:
            d = 'Laminated board, 18 mm, 1220 × 2440 mm sheet, edged and fixed'
        elif 'worktop' in n or 'top' in n:
            d = 'Worktop, 8 ft length, cut and fitted'
        elif 'wardrobe' in n:
            d = 'Fitted wardrobe, manufactured to the approved detail'
    elif cat == 'MISCELLANEOUS':
        if 'nails' in n:
            d = 'Wire / concrete nails, supplied by weight'
        elif 'gauze' in n:
            d = 'Mosquito-proof gauze, fixed to frames'
        elif 'polystrene' in n:
            d = 'Expanded polystyrene sheet, 2000 × 1200 mm'
        elif 'pipe' in n:
            m = re.search(r'(\d+mm)', name)
            d = 'PVC pipe, %s, for plumbing and drainage' % (m.group(1) if m else '')
    elif cat == 'PRE-MIX CONCRETE':
        m = re.search(r'(C\d+/\d+)', name)
        ratio = re.search(r'\[([^\]]+)\]', name)
        d = 'Ready-mixed concrete %s%s, supplied by the cubic metre, placed and cured' % (
            m.group(1) if m else '', ' (%s)' % ratio.group(1) if ratio else '')
    if not d:
        for k, v in FAM.get(cat, []):
            if k in n:
                d = v
                break
    if not d:
        d = GENERIC.get(cat, 'Material')
        d = '%s — %s — supplied per %s and fixed complete' % (d, name, unit or 'item')
    if pack:
        d = d + ' · ' + pack
    return d

# --------------------------------------------------- family fallbacks
FAM = {
    'CEILING': [
        ('acoustic slat', 'Acoustic slat wood ceiling / wall panel, 2400 × 400 × 21 mm, on battens'),
        ('soundstop', 'Acoustic absorption panel, 50 mm, laid behind the ceiling'),
        ('hanger wire', 'Galvanised ceiling tile hanger wire, 12 gauge, at 1200 mm centres'),
        ('anchor bolt', 'Expansion anchor bolt, M6, for the ceiling hangers'),
        ('p. o. p. cement', 'Plaster of Paris (P.O.P.) cement, 40 kg bag, for the ceiling'),
        ('fibre', 'Chopped fibre reinforcement, mixed into the P.O.P.'),
        ('key soap', 'Key soap, used as a retarder in the P.O.P. mix'),
        ('frytol', 'Frytol oil, used to release the P.O.P. moulds'),
        ('corner mould', 'PVC T & G corner mould, fixed at the ceiling perimeter'),
    ],
    'METAL WORKS': [
        ('flat bar', 'Galvanised flat bar, 50 × 5 mm, for frames and railings'),
        ('round bar', 'Galvanised round bar, 12 mm diameter, for grilles and railings'),
        ('round post', 'Galvanised round post, 60 mm diameter, set in concrete'),
        ('round support', 'Galvanised round support, 60 mm, on the post'),
        ('post cap', 'PVC post cap, push-fit on the post head'),
        ('square post', 'Galvanised square hollow section post, set in concrete'),
        ('bolt hinge', 'Bolt hinge, 14 cm, galvanised, on the gate leaf'),
        ('bolt latch', 'Bolt latch, 14 cm, galvanised, on the gate leaf'),
        ('bolt & nut', 'Bolt and nut, 14 cm, galvanised'),
    ],
    'CABINETS AND WOODEN SHELVES': [
        ('hydraulic hinge', 'Hydraulic concealed cabinet hinge, 35 mm cup, with mounting plate'),
        ('handle', 'Cabinet handle, aluminium, 128 mm centres'),
        ('self tapping', 'Self-tapping screws, box of 500'),
        ('skirting', 'Cabinet skirting / plinth, 100 mm, at the floor'),
        ('leg', 'Adjustable cabinet leg / stand, 100 mm'),
        ('cabinet work', 'Cabinet carcass work, 18 mm board, edged and assembled'),
        ('edging', 'PVC edging tape, iron-on, to all exposed board edges'),
        ('wood glue', 'Wood glue (PVA), 4 litre bottle'),
    ],
    'MISCELLANEOUS': [
        ('sand paper', 'Abrasive paper sheet, 230 × 280 mm, for rubbing down'),
        ('plain paper', 'Plain masking paper, sheet, for protection'),
        ('masking tape', 'Masking tape, 50 mm × 50 m roll'),
        ('steraphone', 'Steraphone acoustic panel, 150 × 50 × 2000 mm, fixed to the wall'),
        ('liquid nail', 'Liquid nail adhesive, 300 ml cartridge, with applicator'),
        ('cullamix', 'Cullamix Tyrolean render, 25 kg bag, sprayed to the approved texture'),
        ('granite', 'Facing granite / slate, 200 × 50 × 30 mm, bedded and pointed'),
        ('stone rubble', 'Stone rubble, 50 mm, for filling and drainage'),
        ('vent cap', 'PVC vent cap, 100 mm diameter, on the vent pipe'),
        ('pvc tee', 'PVC tee, 100 mm diameter, solvent welded'),
    ],
    'ROOFING': [
        ('sealant', 'Roof tile sealant / mastic, applied under the laps'),
        ('granules', 'Granules / stone chippings, broadcast on the tile coating'),
        ('metro roma', 'Metro Roma stone-coated metal roof tile, 0.40 mm, laid to the manufacturer\'s detail'),
        ('stonecoat', 'Stone-coated metal roof tile, 0.50 mm × 1700 mm cover, fixed with screws at every pan'),
        ('raincoat', 'Raincoat long-span roofing system, profiled sheets with matching accessories'),
        ('domod', 'Domod roofing system, profiled sheets with matching accessories'),
        ('dbs', 'DBS roofing sheet, profiled, fixed with drive screws and washers'),
    ],
    'BLOCKS & EARTH BRICKS': [
        ('concrete blocks', 'Solid concrete block, 450 × 450 × 150 mm, for filling and piers'),
        ('brick', 'Clay / earth brick, laid in cement mortar'),
    ],
    'GLAZING AND PANELS': [
        ('accessor', ''),
    ],
}

GENERIC = {
    'CEMENTS': 'Cementitious material',
    'AGGREGATES': 'Aggregate',
    'REINFORCEMENT': 'Steel reinforcement',
    'BLOCKS & EARTH BRICKS': 'Masonry unit',
    'CONCRETE PRODUCTS': 'Precast concrete product',
    'TIMBER': 'Timber / board',
    'ROOFING': 'Roofing material',
    'CEILING': 'Ceiling component',
    'DOORS AND FRAMES': 'Door / ironmongery',
    'GLAZING AND PANELS': 'Aluminium profile / glazing component',
    'METAL WORKS': 'Metalwork',
    'PLUMBING WORKS': 'Sanitary / plumbing fitting',
    'TILES': 'Tile / tiling accessory',
    'PAINTS': 'Paint / coating',
    'TERRAZZO': 'Terrazzo component',
    'WATERPROOFING, DAMP-PROOF MEMBRANES AND TREATMENTS': 'Waterproofing material',
    'EXTERNAL & ROAD WORKS': 'External works material',
    'CABINETS AND WOODEN SHELVES': 'Joinery component',
    'MISCELLANEOUS': 'Builder\'s sundry',
    'PRE-MIX CONCRETE': 'Ready-mixed concrete',
}

# ------------------------------------------------------------------ rates
# indicative Q4 2026 Greater Accra rates, consistent with the app's price book
ROD = 8.80          # GHS per kg of reinforcement
def rate_for(code, cat, name, unit):
    n = name.lower()
    def has(*w): return any(x in n for x in w)
    if cat == 'CEMENTS':
        if '32.5' in name: return 101
        if '42.5' in name: return 112
        if '52.5' in name: return 128
        if 'white' in n: return 175
    if cat == 'AGGREGATES':
        table = [('boulder', 160), ('38/40', 290), ('19/20', 300), ('16mm', 310), ('6 - 10', 300),
                 ('hand-broken', 260), ('rough', 210), ('fine', 240), ('quarry dust', 180),
                 ('laterite', 130), ('gravel', 240), ('black soil', 90), ('pebbles', 280)]
        for k, v in table:
            if k in n: return v
    if cat == 'REINFORCEMENT':
        if 'binding wire' in n: return 95
        if 'brc' in n or 'mesh' in n:
            kg = re.search(r'([\d.]+)\s*kg/m2', name)
            if kg: return round(float(kg.group(1)) * ROD * 1.12, 2)
            return 22
        return ROD + (0.4 if 'tensile' in n else 0)
    if cat == 'BLOCKS & EARTH BRICKS':
        hollow = 3.60
        if 'solid' in n or 'hollow' in n:
            t = {'100': 7.0, '125': 7.5, '150': 8.0, '200': 9.5, '225': 11.0}.get(
                (g1(r'(\d+)mm', name, '0') if re.search(r'(\d+)mm', name) else ''), 8.0)
            r = t if 'hollow' in n else round(t * 1.28, 2)
            if 'concrete' in n: r += 0.5
            return round(r, 2)
        if 'design block' in n: return 6.0
        if 'hydraform' in n: return 9.5
        if 'compressed earth' in n: return 7.5
        if 'facing brick slice' in n: return 12.0 if '230 x 40' in n else 9.5
        if 'facing brick' in n: return 8.0
        if 'wall ties' in n: return 1.2
        if 'shear' in n: return 1.6
        if 'closer' in n: return 12.0
        if 'insulation' in n: return 45.0
    if cat == 'CONCRETE PRODUCTS':
        if 'kerb' in n:
            d = re.search(r'\((\d+)\s*x', name)
            return {'50': 34, '75': 44, '100': 52, '125': 60, '150': 68}.get(d.group(1) if d else '', 52)
        if 'pipe' in n:
            d = re.search(r'(\d+)mm', name)
            return {'300': 120, '450': 190, '600': 270, '900': 430, '1000': 500, '1200': 640,
                    '1500': 880, '1800': 1150}.get(d.group(1) if d else '', 200)
        if 'paving' in n:
            if '80mm' in n or '80' in n: return 68
            return 55
        if 'pavement tile' in n: return 62
        if 'slab' in n:
            return {'450': 22, '600 x 600': 28, '600 x 900': 36, '600 x 1200': 45}.get(name.split('mm')[0].strip(), 30)
        if 'column cap' in n: return 48
    if cat == 'TIMBER':
        if 'plywood' in n:
            return {'10mm': 260, '12mm': 300, '6mm': 200}.get(g1(r'(\d+mm)', name), 260)
        if 'wawa' in n: return 95
        if n.startswith('solignum') or 'creosote' in n: return 45
        if 'mould oil' in n: return 38
        m = re.search(r'(\d+)\s*x\s*(\d+)\s*mm', name)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            vol = a * b / 1e6
            base = 4100 if 'soft' in n else 4800
            if 'treated' in n: base = 5600
            return round(vol * base, 2)
        if 'slat' in n: return 120
        if 'skirting' in n or 'cornice' in n: return round(int(g1(r'(\d+)mm', name, '0')) / 1000 * 100, 2) if re.search(r'(\d+)mm', name) else 22
        if 'battens' in n: return 12
        if 'architrave' in n: return 18
        if 'bead' in n or 'stopper' in n: return 8
        if 'fascia' in n: return 62
    if cat == 'ROOFING':
        prof = [('0.60mm', 155), ('0.50mm', 132), ('0.45mm', 120), ('0.40mm', 108), ('0.35mm', 96), ('0.35m', 96), ('0.30mm', 88)]
        if 'roofing sheet' in n or 'duratile' in n or 'roma tile' in n or 'stone coated sheet' in n or 'stonecoat' in n:
            for k, v in prof:
                if k in n: return v
            if 'ib r' in n or 'ibr' in n: return 125
            if 'polycarbonate' in n: return 185
            return 120
        if 'ridge' in n or 'capping' in n: return 55
        if 'nails' in n or 'screws' in n: return 60
        if 'gutter' in n: return 95
        if 'facia' in n or 'fascia' in n: return 65
        if 'tiles' in n: return 12 if 'concrete' in n else 14
        if 'shingle' in n and 'cap' not in n and 'lip' not in n and 'nail' not in n and 'vent' not in n: return 145
        if 'trusses' in n: return 220
        if 'vent' in n: return 180
        if 'sealant' in n: return 65
        if 'granules' in n: return 12
    if cat == 'CEILING':
        if 'plasterboard' in n:
            t = re.search(r'([\d.]+mm)', name)
            base = {'12.5mm': 175, '12mm': 205, '9mm': 140, '10mm': 215, '8mm': 185, '6mm': 155}
            return base.get(t.group(1) if t else '', 170)
        if 'cement board' in n: return 215
        if 'screws' in n or 'hanger wire' in n or 'nails' in n: return 48
        if 'tape' in n: return 38
        if 'powder' in n or 'compound' in n: return 62
        if 'mineral wool' in n: return 65 if '100mm' in n else (55 if '75mm' in n else 45)
        if 'tiles' in n and 'grille' not in n: return 18 if 'mineral fibre' in n else 16
        if 'acoustic' in n: return 120
        if 'grid' in n or 'channel' in n or 'stud' in n or 'track' in n: return 26
        if 'cornice' in n: return 28
        if 'plastic t and g' in n: return 55 if '10mm' in n else 42
        if 'grille' in n: return 95
        if 'plug' in n: return 28
        if 'anchor' in n: return 1.5
        if 'pop cement' in n or 'p. o. p' in n: return 78
    if cat == 'DOORS AND FRAMES':
        if 'frame' in n: return 140
        if 'door' in n:
            if 'security' in n: return 3200
            if 'fire' in n: return 3800
            if 'soundproof' in n: return 4500
            if 'bulletproof' in n: return 12000
            if 'turkish' in n: return 2600
            if 'double' in n:
                return {'1200': 1900, '1300': 2100, '1500': 2400}.get((g1(r'size (\d+)', name) if re.search(r'size (\d+)', name) else ''), 2000)
            if 'paneled' in n: return 1450
            if 'flush' in n: return 1150
        if 'lock' in n: return 240
        if 'closer' in n: return 380 if 'hydraulic' in n else 320
        if 'hinge' in n: return 45
        if 'barrel bolt' in n: return 40
        if 'screws' in n: return 32
        if 'veneer' in n: return 68
    if cat == 'GLAZING AND PANELS':
        if 'glass block' in n: return 34 if '100mm' in n else 28
        if 'thick glass' in n and 'block' not in n:
            return {'5mm': 145, '6mm': 165, '8mm': 210, '10mm': 260, '12mm': 310}.get(g1(r'(\d+mm)', name), 180)
        if 'louvre blade' in n: return 85
        if 'carrier' in n:
            b = re.search(r'(\d+)-Blade', name)
            return 110 + (int(b.group(1)) * 22 if b else 60)
        if 'curtain wall' in n: return 480 if 'single' in n else 720
        if 'composite' in n: return 320 if '3mm' in n else 420
        if 'balustrade' in n: return 1250
        if 'rubber' in n or 'brush' in n or 'profile' in n: return 18
        if 'silicone' in n or 'foam' in n or 'spray' in n: return 48
        if 'netting' in n: return 22
        return 45
    if cat == 'METAL WORKS':
        if 'mesh' in n or 'plate' in n:
            return {'1mm': 420, '3mm': 780, '2.5mm': 240, '3.6mm': 320}.get(g1(r'(\d+(?:\.\d+)?mm)', name) if re.search(r'(\d+(?:\.\d+)?mm)', name) else '', 300)
        if 'pipe' in n:
            d = re.search(r'(\d+)mm', name)
            return {'25': 85, '50': 165, '75': 240}.get(d.group(1) if d else '', 120)
        if 'square pipe' in n:
            s = re.search(r'(\d+)\s*x', name)
            return {'25': 75, '38': 105, '50': 140}.get(s.group(1) if s else '', 110)
        if 'angle bar' in n:
            s = re.search(r'(\d+)\s*x', name)
            return {'100': 220, '80': 175, '70': 150, '60': 130, '50': 105}.get(s.group(1) if s else '', 120)
        if 'flat bar' in n: return 65
        if 'round bar' in n: return 25
        if 'burglar' in n: return 380
        if 'balustrade' in n: return 1250
        if 'gate' in n:
            return 9500 if '3600' in n else (4200 if '2.0m' in n or '1200' in n else 3200)
        if 'shutter' in n: return 750
        if 'chain link' in n: return 1450
        if 'post' in n and 'cap' not in n: return 165
        if 'cap' in n: return 25
        if 'wire' in n: return 320
        if 'hinge' in n or 'latch' in n or 'bolt' in n: return 45
    if cat == 'PLUMBING WORKS':
        table = [
            ('passenger lift', 180000), ('service lift', 150000), ('avr', 18000),
            ('water closet (p-trap)', 950), ('water closet (s-trap)', 950), ('closed couple', 1200),
            ('disabled wc', 2400), ('wall-hung wc', 1800), ('squat wc', 650), ('floor standing wc', 1100),
            ('grab rail', 320), ('grab bar', 260), ('concealed cistern', 1450), ('actuator', 420),
            ('wash hand basin', 780), ('stone basin', 2200), ('hand shower set with mixer', 720),
            ('hand shower set', 380), ('concealed shower', 1650), ('shower cubicle', 2800),
            ('shower cabinet', 3200), ('self closing pillar tap', 180), ('push tap', 220),
            ('3/4 inch tap', 95), ('1/2 inch tap', 75), ('motion sensor faucet', 1850),
            ('undercounter basin', 880), ('urinal bowl', 950), ('urinal partition', 720),
            ('double bowl - double drain', 1850), ('double bowl - single drain', 1450),
            ('single bowl', 950), ("cleaners' sink", 1200), ('belfast sink', 1600), ('lab sink', 2100),
            ('utility sink', 1350), ('bath tub (1700', 3800), ('bath tub (1500', 3200),
            ('shower tray, size 1200', 1850), ('shower tray, size 900', 1250), ('shower tray, size 760', 950),
            ('15l water heater', 1450), ('30l under counter', 2200), ('30l wall hung', 2400),
            ('50l water heater', 3200), ('80l water heater', 4500),
            ('2000mm x500mm', 850), ('1000mm x500mm', 450), ('800mm x450mm', 380),
            ('soap dish', 85), ('toilet roll holder', 110), ('toilet brush', 95), ('towel rail', 260),
            ('towel ring', 140), ('robe hook', 65), ('soap dispenser', 320), ('paper towel', 420),
            ('sanitizer', 1250), ('waste bin', 180),
            ('metalic floor drain', 120), ('plastic floor drain', 85),
            ('32mm brass stop cock', 120), ('40mm brass stop cock', 160), ('50mm brass stop cock', 220),
            ('63mm brass stop cock', 320),
            ('polytank; rambo 2000', 3200), ('polytank; rambo 1000', 1850), ('polytank; rambo 850', 1650),
            ('polytank; rambo 700', 1450), ('polytank; rambo 600', 1300), ('polytank; rambo 500', 1150),
            ('polytank; rambo 450', 1050), ('polytank; rambo 400', 950), ('polytank; rambo 300', 780),
            ('polytank; rambo 250', 680), ('polytank; rambo 100', 320),
            ('polytank; hippo 400', 850), ('polytank; hippo 300', 720), ('polytank; hippo 200', 560),
            ('polytank; hippo 100', 380),
        ]
        for k, v in table:
            if k in n: return v
    if cat == 'TILES':
        if 'wall tile' in n or 'wall tiles' in n:
            return 135 if ('300 x 600' in name or '300 x 450' in name) else 110
        if 'porcelain' in n: return 165 if 'polished' in n else 145
        if 'ceramic floor' in n: return 110
        if 'terracotta clay' in n: return 95
        if 'carpet tiles' in n: return 95
        if 'vinyl' in n: return 120 if '2mm' in n else (140 if '3mm' in n else (185 if '6mm' in n else 220))
        if 'astro' in n or 'grass' in n:
            return {'20mm': 150, '30mm': 180, '40mm': 210, '50mm': 240}.get(g1(r'(\d+mm)', name), 180)
        if 'adhesive' in n or 'cement' in n: return 68
        if 'grout' in n: return 42
        if 'spacer' in n or 'u-pins' in n: return 25
        if 'skirting' in n: return 35
        if 'strip' in n: return 30
        if 'door bar' in n: return 65
    if cat == 'PAINTS':
        table = [('fire', 120), ('anti-bacteria', 78), ('anti-dust', 95), ('waterproofer', 110),
                 ('epoxy top', 190), ('epoxy middle', 175), ('epoxy base', 165), ('epoxy primer', 160),
                 ('epoxy scratch', 160), ('polyurethane', 185), ('lacquer', 85), ('hardener', 65),
                 ('thinner', 28), ('gloss', 62), ('emulsion', 42), ('primer', 45), ('putty', 55),
                 ('sealer', 55), ('stain', 60), ('graffiato', 55), ('wall guard', 85), ('smoothover', 78),
                 ('skimming', 52), ('body filer', 65)]
        for k, v in table:
            if k in n: return v
        if 'application' in n: return 18
        return 50
    if cat == 'TERRAZZO':
        if 'chippings' in n: return 1.15
        if 'disc' in n: return 45
        if 'polish' in n: return 65
        if 'oxalic' in n: return 45
        if 'strip' in n: return 35
        if 'detergent' in n: return 25
        if 'sponge' in n: return 8
        if 'sacks' in n: return 5
    if cat == 'WATERPROOFING, DAMP-PROOF MEMBRANES AND TREATMENTS':
        if 'membrane' in n:
            return {'250': 12, '300': 14, '500': 20, '600': 24}.get(g1(r'(\d+)\s*micro', name) if re.search(r'(\d+)\s*micro', name) else '', 16)
        if 'felt' in n: return 28
        if 'tape' in n: return 65
        if 'waterstop' in n or 'waterbar' in n: return 85
        if 'screed' in n: return 68
        if 'latex' in n or 'bonding' in n: return 48
        if 'termite' in n: return 120
        return 62
    if cat == 'EXTERNAL & ROAD WORKS':
        if 'grass' in n: return 12
        if 'flower' in n: return 25
        if 'tree' in n: return 180
        if 'm.c.2' in n or 'm.c' in n: return 26
        return 32
    if cat == 'CABINETS AND WOODEN SHELVES':
        table = [('laminated board', 620), ('higloss', 780), ('back', 380), ('hole', 420),
                 ('edge board', 65), ('hinge', 85), ('handle', 45), ('screws', 35), ('skirting', 55),
                 ('leg', 45), ('work top', 1850), ('worktop', 1850), ('cabinet work', 1200),
                 ('cutting', 45), ('edging', 35), ('glue', 55), ('wardrobe', 2800), ('vanaity', 3200)]
        for k, v in table:
            if k in n: return v
    if cat == 'MISCELLANEOUS':
        if 'gauze' in n: return 45
        if 'nails' in n: return 32
        if 'sand paper' in n: return 6
        if 'plain paper' in n: return 3
        if 'masking tape' in n: return 18
        if 'polystrene' in n: return 65 if '25mm' in n else 95
        if 'pipe' in n:
            return 12 if '20mm' in n else 45
        if 'vent cap' in n: return 35
        if 'tee' in n: return 55
        if 'liquid nail' in n: return 45
        if 'cullamix' in n: return 85
        if 'granite' in n: return 120
        if 'rubble' in n: return 240
        if 'steraphone' in n: return 380
    if cat == 'PRE-MIX CONCRETE':
        m = re.search(r'C(\d+)/', name)
        base = {'10': 1150, '15': 1280, '20': 1420, '25': 1560, '30': 1700, '35': 1820, '40': 1950, '45': 2080}
        return base.get(m.group(1) if m else '', 1400)
    return None

def main():
    items = parse()
    out = []
    for it in items:
        name = clean_name(it['parts'])
        unit = unit_for(it['code'], it['cat'], name, it['sub'])
        pack = pack_of(it['parts'])
        desc = describe(name, it['cat'], it['sub'], unit, pack)
        rate = rate_for(it['code'], it['cat'], name, unit)
        out.append({
            'code': it['code'], 'name': name, 'cat': it['cat'], 'sub': it['sub'],
            'unit': unit, 'rate': rate, 'desc': desc,
        })
    cats = []
    for it in out:
        if it['cat'] and it['cat'] not in cats:
            cats.append(it['cat'])
    # the code of each group, for the list's headings
    group_code = {}
    for it in out:
        parts = it['code'].split('.')
        group_code.setdefault(it['cat'], 'M.%s.0' % parts[1])
    js = []
    js.append('/* =====================================================================')
    js.append('   MATERIALS CATALOGUE — %d materials, M.1.0 to M.21.0' % len(out))
    js.append('   Built from the project materials schedule (MATERIALS.pdf) by')
    js.append('   tools/gen_catalogue.py: codes and names are the schedule\'s own; the')
    js.append('   unit, the specification line and the indicative rate are added by')
    js.append('   rule so the database opens with something useful in every column.')
    js.append('   Rates are Q4 2026 Greater Accra market prices, editable in the app.')
    js.append('   ===================================================================== */')
    js.append('(function (root) {')
    js.append("  'use strict';")
    js.append('  const CATS = %s;' % json.dumps(cats, ensure_ascii=False))
    js.append('  const GROUP = %s;' % json.dumps(group_code, ensure_ascii=False))
    js.append('  // code, name, group, sub-group, unit, rate, description')
    js.append('  const ROWS = [')
    for it in out:
        js.append('  [%s,%s,%s,%s,%s,%s,%s],' % (
            json.dumps(it['code']), json.dumps(it['name'], ensure_ascii=False),
            json.dumps(it['cat'], ensure_ascii=False), json.dumps(it['sub'] or '', ensure_ascii=False),
            json.dumps(it['unit']), json.dumps(it['rate'] if it['rate'] is not None else None),
            json.dumps(it['desc'], ensure_ascii=False)))
    js.append('  ];')
    js.append('  root.Catalogue = { CATS: CATS, GROUP: GROUP, ROWS: ROWS };')
    js.append("})(typeof window !== 'undefined' ? window : globalThis);")
    OUT.write_text('\n'.join(js) + '\n', encoding='utf-8')
    priced = sum(1 for i in out if i['rate'] is not None)
    print('wrote %s: %d materials, %d priced, %d groups' % (OUT, len(out), priced, len(cats)))
    from collections import Counter
    for c in cats:
        n = sum(1 for i in out if i['cat'] == c)
        p = sum(1 for i in out if i['cat'] == c and i['rate'] is not None)
        print('  %-58s %3d  (%d priced)' % (c, n, p))

if __name__ == '__main__':
    main()
