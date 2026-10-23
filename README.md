# Quick Quantity — Offline Bill of Quantities generator

Turn a **picture or PDF of a floor plan** — or a **room schedule plus sections and elevations** — into a
**priced Bill of Quantities** measured and priced to Ghanaian practice. Houses, offices, shops,
clinics, **churches** or school blocks. Single file, no server, no internet, no installation.

**File to use: `index.html`** (about 2 MB — copy it to any phone, tablet or laptop).

---

## Quick start

1. Double-click **`index.html`** — it opens in Chrome, Edge, Firefox or Safari.
2. On the first page choose **what you are building** (house, office/shop, clinic, school), then
   upload a photo, scan or exported image of the plan — **JPG, PNG, WEBP or PDF** — or press
   **PS 1 sample** to try it. **Upload the whole set** — choose several files at once and each is
   read by its name and filed in its own card beneath the box: site plan, floor plans, elevations,
   sections, foundation, framing, roof, the schedules and the services layouts (see *The drawing
   set* and *More than one plan*). For a multi-page PDF, pick the page with the floor plan;
   switching pages lets you read a different floor, section or elevation.
3. Set the scale. If the sheet prints one (`SCALE 1:100`) the app uses it; otherwise choose
   *I will set it* and give the paper size and ratio, type one known dimension (e.g. `18600` mm),
   press **Measure the reference span (2 clicks)**, or leave *Scale not shown* and the app will say
   plainly that it is assuming the standard size.
4. The room names on the sheet are read automatically into the room schedule. On **Building model**,
   edit the rooms, door and window counts, and (optionally) upload
   a **section or elevation** so the heights, roof pitch and foundation depth come from the drawing.
   In **Settings → Parties** fill in the Client, Contractor and Consultant — they print on the bill.
5. **Take off the quantities and the rates.** The take-off sheet lists every measured quantity and every
   rate, section by section — preliminaries, substructure, superstructure, finishes, services and external
   works — with the checks that catch a plan read wrongly: openings against wall, rooms against the
   footprint, blocks to the square metre, concrete and steel per cubic metre. Type over a quantity in the
   *Corrected* column or over a *Rate*, and the bill, the exports and the saved record all follow
   (see *The measurement / take-off sheet*).
6. Press through to the **Bill of Quantities**. Edit any rate inline. If you have a connection,
   press **Update prices** to refresh the rates (see below). The bill is kept automatically in
   **Saved bills**, so you can export or print it again later (see *Saved bills — the bill database*).
7. **Download PDF, Word or Excel**, export CSV, or **Save** the project file to continue later.

All three documents — **PDF (`.pdf`)**, **Word (`.docx`)** and **Excel (`.xlsx`)** — are generated
inside the browser itself. Real files, no server, no libraries downloaded, no internet.

Everything runs on the device. The uploaded image is never sent anywhere.

---

## What it measures

### First, which building is this?

The app reads the **words on the sheet** — the room names — before it measures anything, and decides
what kind of building it is looking at. The bill, its descriptions, quantities and rates are then those
of the identified building, not of a default school block.

| Read as | Words it looks for on the drawing | Model that is loaded |
|---|---|---|
| **Educational block** | classroom, class room, head master, staff room, library, laboratory, assembly, pupils, kindergarten | Ghana school block — rooms on a verandah, office wing, WC |
| **Domestic house** | bedroom, living room, sitting room, dining, kitchen, bathroom, laundry, garage, porch, balcony | domestic room schedule: bedrooms, living, wet and dry rooms |
| **Commercial building** | office, reception, conference, boardroom, shop, retail, showroom, warehouse, banking hall, server room, open plan | commercial room schedule: lettable floor, offices, store, washrooms |
| **Health facility** | ward, clinic, consulting, treatment, dispensary, theatre, pharmacy, triage, maternity | clinic room schedule: consulting rooms, ward, treatment, washrooms |
| **Place of worship** | nave, sanctuary, altar, vestry, pew, chapel, minaret, pulpit, choir | church schedule: auditorium, sanctuary, vestry, offices |

A type is only claimed when **at least two different words** of that family appear, so one stray
"Store" does not turn an office into a house. The floor-plan sheet is read first; if it holds no text the
whole set is searched. The reading appears at the top of step 2 — *Building identified from the drawing —
Domestic house — bedroom, living room, dining, kitchen* — with a **Change** selector that loads another
model on the spot. When the sheets show more than one floor plan, the identified model takes its
**storey count from the sheets**, so a single-storey shop is not priced from the two-storey office.

What the result looks like, per square metre of gross floor area:

| Identified as | Typical bill |
|---|---|
| Domestic — 3-bedroom bungalow | GH¢ 701,204.53 · 127 m² · 5,534/m² |
| Domestic — 4-bedroom two-storey | GH¢ 1,320,259.30 · 284 m² · 4,657/m² |
| Commercial — two-storey office/shop | GH¢ 2,246,249.45 · 432 m² · 5,200/m² |
| Commercial — single-storey shop | GH¢ 776,241.69 · 150 m² · 5,175/m² |
| Health — CHPS compound | GH¢ 777,812.22 · 139 m² · 5,612/m² |
| Religious — church auditorium | GH¢ 1,509,688.57 · 360 m² · 4,194/m² |
| Educational — GES block (PS 1) | GH¢ 808,290.44 · 148 m² · 5,450/m² |

Every one of them now carries both the **manhole works** and the **drainage works** — fifteen bills
for the domestic, health and school templates, sixteen where mechanical services are also specified.

### And the rooms, named as they are on the plan

The same text layer names the rooms. On upload the app reads every label on the measured sheet —
*BEDROOM 1*, *MASTER BEDROOM*, *LIVING/DINING*, *KITCHEN 3.6 x 3.0*, *HEAD MASTER'S OFFICE* — skips the
titles, notes and dimension strings, and builds the **room schedule** from them: the names exactly as
printed, each one given a type (bedroom, living, kitchen, bath, store, office, classroom, ward …) and
listed in the order they sit on the plan.

| Printed on the sheet | Room in the schedule | Type | Size used |
|---|---|---|---|
| `BEDROOM 1` | BEDROOM 1 | bedroom | typical 3.60 × 3.20 m |
| `KITCHEN 3.0 x 2.7` | KITCHEN | kitchen | 3.00 × 2.70 m — from the label |
| `HEAD MASTER'S OFFICE` | HEAD MASTER'S OFFICE | office | typical 3.40 × 3.00 m |
| `CLASS ROOM 2` | CLASS ROOM 2 | classroom | typical 6.00 × 5.40 m |

Where the label carries its own size that size is used; otherwise the app enters a typical size for
that kind of room, marks it *typical* in the list on step 2, and you change it on **Building model**.

**One sheet, not the whole file.** The schedule is read from the **sheet the app is measuring** — the floor
plan it detected and opened. A set that carries a ground floor, a first floor and a furniture layout of the
same floor holds three copies of the same bedroom; reading every page would list it three times and
measure three times the walls, which is exactly what a wall-counting app must not do. The building model
is a *typical floor*: `Storeys` says how many times it repeats (see *Structure & roof* → Storeys).

A sheet can also draw **two floor plans**, the ground floor above the first floor on the same page. The
app reads the floor titles printed on the sheet, groups every room label under the plan it belongs to,
and takes **one plan's rooms** — the ground floor by default. A second selector, *This sheet draws 2 floor
plans*, switches the schedule to the upper plan, and the count that reaches the bill changes with it.
Sixty rooms for a house that has twelve is not a reading error to be worked around; it is five plans
added together, and it is what this split prevents. A project saved by an older build with the floors
already merged is re-read from its sheet when it is opened, so the duplicate rooms disappear without
being retyped.

When the file holds more than one floor plan, step 2 shows a **Read the rooms from** selector listing each
plan with the number of rooms on it — *Sheet 1 — GROUND FLOOR PLAN (5 rooms)*, *Sheet 5 — FIRST FLOOR
PLAN (3 rooms)*. Switching reads that sheet and rebuilds the schedule and the bill; the sheet you last
chose is remembered with the project. Rooms read from an upper plan are marked *upper*, and when the
model has more than one storey the panel says the schedule is repeated on each floor.

The schedule drives the floor and wall finishes, skirting, tiling, ceiling, lights, sockets and sanitary
fittings, so the bill is measured from the rooms the drawing actually shows. Rooms that the building type
does not normally have (a store in a house, a shop in an office) are kept, and the type list on the room
schedule grows to hold them.

A scanned drawing has no text layer, so nothing can be read — the schedule is then whatever you type
or load.

**Load a typical room layout** at the top of the schedule replaces **the rooms only**: the building's
size, storeys, openings, services and rates stay exactly as they are, so a stock layout can be tried
against an uploaded drawing. It asks first when the schedule already has rooms, and it says when the
layout belongs to a two-storey building. Whatever the schedule ends up holding, the panel compares the
net room area with the floor area and warns when the rooms cannot fit inside the walls — or leave half
the building unfurnished — instead of quietly mis-measuring.

### One control: the building type

The **Change** dropdown under *2 · Read the drawing and set the scale* is the switch every other list in the
app reads from. Changing it there does not just relabel the card — it re-cuts, on the spot:

- **Standard plan library** (Building model) — that type's typical layouts come first, and the other types
  stay reachable under *Other building types* at the foot of the list, so a layout loaded by mistake is still
  fixable without changing the type back first.
- **Load a typical room layout** (Room schedule) — the list is the plans of the chosen type only, so a school
  block is never offered an office layout.
- **Room types** in the schedule — a commercial building is offered office, shop, reception, store, corridor,
  staircase…; a school is offered classroom and verandah. A type the drawing itself brought in is kept.
- **Measurement template** (Settings → Project) — a school block is measured with the GES template and
  everything else with the general one. The menu shows the template that applies and keeps the other visible
  but shut, labelled *— not used for this building type*, so the rule is explained rather than hidden. The
  searchable menu will not offer the shut one either.
- **The bill itself** — the pricing model, room list and typical specification.

A short message confirms the change when it is made — *Commercial building — 2 typical layouts, the
measurement template and the room types now follow it* — so the effect is not left to be discovered three
steps later.

### The rooms the drawing prints

The room names on the sheet are read into the schedule the moment the plan is read, and the
**Rooms read from the drawing** card on *Read & scale* repeats them back — the sheet they came from,
the number of rooms, and each room with its size and whether that size was printed on the plan or is
a typical figure. Where the set has more than one floor plan, **Read the rooms from** picks the sheet,
and where one sheet draws two plans, a second picker chooses which of them to read — one plan's rooms,
never two added together.

The card shows what was read even when the picture itself is not on screen — a project saved by a
browser that ran out of room for the image keeps its rooms, its building type and its sheet list, and
the step says which picture is missing rather than going blank. If a sheet prints room names but its
title block was not recognised as a floor plan, the names are still read rather than lost.

### Doors and windows — read from the drawing, and counted properly

Drawings carry their openings as tags — `D1`, `D2`, `W1`, `SD3` — and the sizes in a door and window
schedule, usually on the same sheet or the one beside it. On upload the app reads both and builds the
schedule itself:

| Printed on the drawing | What the app takes |
|---|---|
| `D1  Hardwood panel door  900 x 2100 mm  3 No.` | ref D1, 0.9 × 2.1 m, **3** to price |
| `W1  Aluminium sliding window  1200 x 1200  4 No.` | ref W1, 1.2 × 1.2 m, 4 to price |
| `D2  Flush door  0.9 x 2.1` | metres are read as metres |
| `W2  Louvre  60 x 60` | centimetres are read as centimetres (0.6 × 0.6 m) |
| `W3  1,200 x 1,200` / `W4  1200 1200` | thousands separators and two-column schedules |
| tags only on the plan, sizes in the schedule | the size comes from the schedule row with the same ref |
| `D01` on the plan, `D1` in the schedule | the same door |

The description may sit between the ref and its size — the reader stays inside the row and never borrows
the size printed above or below. Where the schedule prints a quantity (`3 No.`, `Nos`, `Nr`) that number
wins; where it does not, the app counts how often the tag is drawn on the floor plans. A tag with no
size anywhere is dropped rather than guessed at, and the app needs at least two openings before it
replaces the standard schedule — otherwise it says so and leaves your rows alone.

**Every opening is a hole in the wall.** Doors and windows are both deducted from the blockwork of the
wall they sit in — an external door was previously priced but not deducted, which overstated the
blockwork of every house with a front door. Lintels take **150 mm bearing each side**, so the length
priced is `(width + 0.30) × number`, not the clear opening. Gloss paint to joinery is measured at
**2.3 × the area of the doors and windows**, not a flat allowance.

The **Doors & windows** card on *Building model* shows what was read, the wall area being deducted and
where the figures came from, with the sheet numbers. Every row can be typed over: the number to price,
and whether it sits in an **external** or **internal** wall — that is what decides which blockwork the
opening is taken out of. Two buttons put it back: **Read from the drawing** reads the sheets again
after you upload another PDF, and **Standard schedule** restores the door and window list the building
type came with. A new drawing that prints no schedule at all resets to the standard list instead of
keeping the last drawing's doors. When the openings come to more than 45 % of the wall area, the card
warns — that is usually a schedule table on the same sheet as the plan being counted twice.

### School template (PS 1 school block)

For the Ghanaian basic-school block typology — rooms opening onto a verandah, with an
office wing (Head Master's Office, WC, verandah):

| Group | Measured |
|---|---|
| Substructure | trench excavation, blinding, strip footing concrete, foundation walls, backfill, hardcore, DPM, oversite, termite treatment |
| Frame | columns, ring beam, lintels, reinforcement (kg), formwork |
| Walling | 150 mm sandcrete blockwork net of openings, verandah balustrade |
| Roofing | trusses, purlins, sheeting (at pitch), ridge, fascia, barge boards |
| Ceiling | PVC or plasterboard by gross floor area, cornice, hatches |
| Joinery | doors and windows scheduled by size, type and count |
| Finishes | screed, terrazzo or tiles, skirting, plaster, external render, wall tiling |
| Painting | internal, external, gloss |
| Services | lighting points, sockets, distribution board, earthing; WC, basin, tank, septic tank |
| External | apron, steps, drainage channel, levelling |
| Drainage | the run to the tank, its trench, bed and backfill, the chambers on it (see below) |

Quantities flow into **15 bills**, with an editable rate column, contingency, grand total and
amount in words.

### General engine (any domestic or commercial building)

Driven by the **room schedule**, the **storey data** and the **sections/elevations**:

| Bill | Contents (general building) |
|---|---|
| 1 | Preliminaries — site clearance, site office, water and power, supervision, PPE, insurance; brought to a set % of the measured works |
| 2 | Substructure — excavations, blinding, strip or raft foundation, foundation reinforcement, foundation walls, backfill, hardcore, DPM, oversite, termite treatment |
| 3 | RC frame — columns, beams, suspended slabs, staircase, lintels, reinforcement by element, formwork |
| 4 | Walling — external and internal blockwork net of openings, parapets, balustrades |
| 5 | Roofing — trusses, purlins, sheeting at pitch (or flat roof screed/waterproofing), ridge, fascia, barge, sundries |
| 6 | Ceiling — PVC, plasterboard or POP, cornice, access hatches |
| 7 | Doors, windows and ironmongery — from the schedules and the room types |
| 8 | Floor finishes — screed plus terrazzo, tiles, wood or screed-only by room type |
| 9 | Wall finishes — plaster, external render or cladding, tiling to bathrooms and kitchen splashback |
| 10 | Painting — internal emulsion, external, gloss |
| 11 | Electrical — DB, sub-main, lighting and socket points counted from the room schedule, wiring, earthing, security lights |
| 12 | Plumbing — WC, basins, sink, showers, soil and water pipework, storage tank and septic tank |
| 13 | Mechanical — only when HVAC or fire services are switched on |
| 14 | External works — apron, steps, drainage, levelling, landscaping, boundary wall and gate (optional) |

Quantities are multiplied by measured-work rates, then **overheads and profit** are added; the
grand total adds contingency and (optionally) VAT. The bill is reported at **gross floor area**
(outside face × storeys) with the net internal area shown beside it.

---

## Settings menu

The **Settings** button in the header opens a seven-tab dialog:

| Tab | What you set |
|---|---|
| **Project** | building type, measurement template, project name, location, **country**, region for rates, drawing reference, wastage, contingency, VAT |
| **Parties** | **Client** (name, address), **Contractor** (name, address, class/registration), **Consultant / Quantity Surveyor**, tender reference, date of bill, contract period, prepared by |
| **Structure & roof** | overall width and depth, storeys, floor-to-floor, floor-to-ceiling, plinth, foundation depth and type, roof type, pitch, overhang, parapet |
| **Finishes** | floor finish for dry rooms and for wet areas (terrazzo, ceramic, porcelain, granite, timber, laminate, vinyl, epoxy, carpet, screed), ceiling (PVC, plasterboard, POP, mineral-fibre T-grid, fibre cement, timber, none), wall and external finish, window type |
| **Services** | electrical, plumbing, HVAC, solar, fire, generator, borehole, boundary wall and gate |
| **Pricing** | overheads and profit %, preliminaries %, wastage %, price feed URL, rates compiled on, cedi basis, AI provider / key / model |
| **Rate build-up** | the build-ups generated from the drawing, the 16 market prices behind them, the overheads on each trade, and the rate finally adopted in the bill |

Changing the **building type** loads the matching typical layout (geometry, rooms, doors, windows),
so the geometry and the schedule stay consistent; any field you edited yourself is kept on top.
Every number remains editable afterwards.

Every list of choices — building type, measurement template, country, region, foundation, wall and
roof type, floor and ceiling finish, window type, the room type on each schedule row, which floor plan
the rooms are read from, the scale and paper size on the drawing step, the role of each sheet — opens
as a **searchable list**, the same control everywhere:

* a search box with a magnifier at the top, holding the current choice as its hint;
* the current choice pinned first and highlighted dark, then every other option, filtered as you type;
* a compact panel the width of the field (never a full-width bar), opening downwards, and upwards when
  there is no room below;
* **type a letter on the closed field** and the list opens already filtered — `ken` finds Kenya;
* arrow keys and Home/End move, Enter chooses, Esc closes, clicking away closes.

The keyboard and a screen reader both work, and underneath it is still a native `<select>` — so the
value, the change handlers, the saved project and the print fallback are exactly as before.

### Rate build-up and price analysis

**Settings → Rate build-up** is generated from the drawing. Every priced item the measurement produces
becomes a build-up — nothing is hard-coded and nothing has to be added by hand — grouped by rate,
largest value first:

| Bill | Item | Quantity | Amount | Rate → computed |
|---|---|---|---|---|
| 4 | 150 mm sandcrete block walls | 236.96 m² | GH¢ 46,207.20 | 195.00 → **201.64** (+3.4 %) |
| 5 | Aluminium long-span roofing sheets | 240.05 m² | GH¢ 40,328.40 | 168.00 → **189.39** (+12.7 %) |
| 3 | High-yield reinforcement, cut, bent and fixed | 2,941 kg | GH¢ 39,703.50 | 13.50 → **11.96** (−11.4 %) |
| 8 | 25 mm terrazzo floor finish | 108 m² | GH¢ 25,380.00 | 235.00 → **197.01** (−16.2 %) |

The PS 1 school block produces **71 priced rates** covering the whole measured value
(GH¢ 759,163.43); a three-bedroom house produces a different list, because the list is the bill, and a
two-storey house or a church produces a longer one — every rate that the building actually uses.

**Where the numbers come from.** A price book of **135 market prices and hire rates**, grouped into
sixteen sections: cement, sand and aggregate; blocks and masonry; steel and reinforcement; timber and
boards; roofing; waterproofing and ground treatment; ceilings; floor and wall finishes; paint; doors
and windows; plumbing and drainage; electrical; mechanical, fire and energy; external works; **plant
and equipment** (excavator, backhoe, tipper, roller, plate compactor, mixer, poker vibrator, concrete
pump, crane, hoist, scaffolding, dewatering pump, welding set, site generator, survey) and labour.
Every price is editable in place, and every price is used by name, so a change to the price of cement
flows into every concrete, blockwork, plaster and screed build-up at once.

Sixty recipes turn those prices into rates — the whole of the structural and finishes work, plus
ceilings (PVC, plasterboard, POP, mineral-fibre T-grid, fibre cement, timber), floor finishes
(terrazzo, ceramic, porcelain, granite, timber, laminate, vinyl, carpet, epoxy), roofing, truss
fabrication, waterproofing, boundary walls, cladding, damp-proofing, termite treatment and the site
clearance — and the earthworks plant (excavator, tipper, compactor, pump) is priced from the plant
database rather than as a lump allowance. On a four-bedroom two-storey house that is **34 of 62 rates
built from first principles, carrying 72 % of the measured value**; on the church, 35 of 70 (66 %).
Each card shows the material and labour lines with quantity × unit rate, then sub-total → overheads
and profit → computed cost → **rate in bill**, exactly like a price-analysis sheet. Against the
reference sheet the block wall builds to 186.70 + 8 % = **201.64**, terrazzo 200.45 + 10 % = **220.50**
and a plasterboard ceiling 120.60 + 8 % = **130.25** against an issued GH¢125.

**Proprietary items** — doors, windows, sanitary fittings, electrical points, the septic tank, solar and
generator packages — have no material recipe a drawing can supply, so their issued rate is split into
*materials and components* (supply) and *labour and plant* (fix), with overheads and profit on top —
but the price book still carries the components (WC suite, basin, cable coils, conduit, distribution
board, air-conditioner, panels, batteries, inverter) so a rate can be rebuilt by hand. The split is calibrated so it
reproduces the rate already in the bill; overwrite either amount with a quotation and the computed
cost follows.

**Editing.** Type over a market price and every card that uses it re-computes; change an overheads
percentage; change the rate in the bill. **Adopt computed** copies one computed cost into the bill,
**Adopt every computed rate** does the lot, **Use bill rates** puts back exactly the rates the bill
carried before any adoption, and **Reset build-ups** returns the inputs to the Q4 2026 Accra defaults.
The summary line at the top shows what adopting everything would do to the bill — for PS 1,
−GH¢ 21,785.02 (−2.87 %) — so nothing changes by surprise. The bill, the summary and the amount in
words follow immediately.

**Show** switches between the 20 principal items (the ones carrying most of the money) and every item
in the bill. Build-ups you adopt are marked *adopted* and stay visible in either view.

The build-up lives in the project file (`rb` in the saved JSON) and survives a reload; **Reset rates**
on the bill page clears it along with the other rates. Prices pulled in by *Update prices online*
change the **bill rates**, never the market-price table, so a feed refresh cannot quietly overwrite your
analysis — press *Adopt* again when you are ready. Changing the drawing, the building type or any
measured dimension re-generates the list against the new quantities; your edited prices, overheads and
adoptions are kept.

### Country and currency

**Settings → Project → Country** sets where the prices come from and which currency the bill is
printed in — Ghana (GH¢, Cedis/Pesewas) by default, and Nigeria, Kenya, South Africa, Côte d'Ivoire,
Togo, Benin, Burkina Faso, Senegal, Cameroon, Liberia, Sierra Leone, The Gambia, the UK, the US,
Canada or the UAE. Switching country changes the symbol on the bill, the column headers, the
amount in words (*“… Naira and Sixty Kobo Only”*) and the PDF, Word and Excel documents. The
measurement method stays the Ghana Standard Method, which is what the quantities are built on.

The built-in rate card is Ghanaian, so another country is **not** a silent relabel of cedis: the bill
and every export carry the note *“Ghana rate card (Greater Accra, Q4 2026) shown in NGN — not localised
for Nigeria. Use a price feed or an AI price check, or edit the rates.”* Run **Update prices online**
with an AI key or a feed priced in that country's money and the note is replaced by what actually
happened. The cedi index only runs for Ghana — indexing a Ghanaian card abroad would mis-price it.

### Parties and the cover page

The **Parties** tab holds the names that make a bill a contract document: client, contractor and
consultant, plus the tender reference, bill date, contract period and the surveyor who prepared it.
They appear:

* in a strip above the bill on screen (with **Edit particulars**),
* in the printed bill's letterhead,
* on the PDF, Word and Excel cover pages,
* and in the three-way **signature block** — Client / Consultant / Contractor — at the end of the bill.

### Sections and elevations

A section or an elevation is a sheet of the set: it goes in the **Sections** or **Elevations**
card on **Upload plan**, and the app finds its **level lines** (ground, plinth, floor, ceiling,
eaves, ridge, foundation) from it. Where the section prints its levels they are used as printed;
a scaled guess is labelled as such and never passed off as a printed level.

The heights themselves are confirmed on **Building model**, and in **Settings → Structure**:
plinth, floor to floor, floor to ceiling, foundation depth and eaves height (leave eaves at 0 and
it is calculated as plinth + storeys × floor height). Those figures drive the wall heights, gable,
roof area, foundation quantities and the "Basis of the bill" page.

### The roof plan

A roof plan is a sheet of its own, and it is the only sheet that can say three things about the roof:
its **pitch**, the **covering** named in its title block, and the **roof outline** the eaves follow.
Upload it on **Upload plan**, in card 7 of the drawing set — **+ Add the roof plan** in the card's
heading takes a picture or a PDF page, and a file can also be dropped anywhere on the card. A PDF
sheet is found among its pages by its text. Once a plan is on file the button reads
**+ Replace the roof plan**, and the card shows the sheet, its name and its size. The card is not
repeated on **Read & scale**: that step is the drawing, its scale and the rooms.

- The **pitch** is read from the sheet: `PITCH 22 DEGREES`, `ROOF PITCH 22°`, `SLOPE 1:…`.
- The **covering** is read from the title block — long-span aluminium, stone-coated tiles, asbestos,
  polycarbonate, shingles. The bill prices long-span aluminium; if the plan names tiles the panel says
  so, so the rate can be changed deliberately rather than silently.
- The **roof outline** is measured between the outermost strong lines on the sheet, at the roof sheet's
  own scale — the `1:100` printed on it. A picture without a printed scale asks for one dimension
  (the overall roof width); type it and the outline is measured from it. The floor plan's scale is
  never borrowed, because two sheets of one set are not always printed at the same scale.
- The **eaves overhang** is taken from the drawing where it says it (`EAVES OVERHANG 0.60 m`);
  otherwise, if the measured roof is between 0.2 m and 1.2 m wider than the building each side,
  from that difference.
- **Use the roof plan** writes the pitch, the roof type and the overhang into the building model and
  records the outline against the bill. The roofing description then reads *laid to 22 degree pitch*,
  the sheet area follows `roof plan ÷ cos(pitch)`, and the PDF carries
  *Roof · Pitched at 22°, eaves overhang 0.60 m; the roof plan measures 218.40 m² at pitch*.
- Nothing is applied until you press the button, and a roof plan whose width disagrees with the
  building model says so — *the roof is 22.50 m wide and the building model 18.60 m* — instead of
  quietly changing the bill.
- **Roof type and settings** sit under the drop zone, in the same field style as *Sections &
  elevations*. The type is chosen from four: **gabled** (two slopes to a ridge), **hipped** (four
  slopes, no gable ends), **mono-pitch** (one slope to a high wall) and **flat** (roof slab and
  parapet). Each type arrives with the figures that suit it — gable and hip at 22°, mono-pitch at 10°,
  flat with no pitch — and the panel then shows **only the fields that type needs**: every type asks
  for the **eaves overhang**; gabled, hipped and cross-hipped roofs ask for the **pitch** and which way
  the **ridge runs** (along the length or across the width); a mono-pitch asks for the **high side** —
  the wall it rises to — instead of a ridge; a flat roof asks for the **parapet height** and which
  sides the **parapet runs** on, and no pitch at all. Every pitched type also takes the members'
  spacing — **trusses (or rafters) at centres** and **purlins at centres**, 1,200 mm and 900 mm unless
  the drawing says otherwise, e.g. 1,500 mm rafters with 600 mm purlins. Each of those is the user's to set, so the model can be
  made to match the roof plan in hand. A pitch or overhang typed for one type is remembered for that
  type, so switching back brings it back. Under the fields a line reads out what the choice makes of
  the plan, e.g. *Hipped · 10.95 m ridge along the length · 19.09 m of hips · eaves 57.30 m · rise
  1.79 m · covering 243.29 m²*.
- **The `cross-hipped` type** is for a roof that turns a corner — wings, more than one ridge, hips at
  every corner and a valley where the wings meet. Its hip and valley lines are worked out from the
  plan (twice the span over the cosine of the pitch, and two valleys at the same length), but the
  drawing knows better: three boxes take **the ridge, the hip lines and the valley lines the drawing
  shows**, and an emptied box goes back to the worked-out figure.
- **What the type changes in the bill**: the covering area (plan ÷ cos pitch, or the plan itself for a
  flat roof), the trusses or rafters (at the spacing chosen, along the ridge, none for a flat roof),
  the purlins (covering ÷ the purlin spacing), the **ridge** capping (a gable's runs the full length, a
  hipped roof's is shortened by the span), the **hip capping** in place of barges, the **valley
  flashing** at the re-entrant angles of a cross-hipped roof, the **fascia** to the eaves line, the
  **barge boards** to the verges, and for a flat roof the **screed to falls** and the **parapet
  wall**. The building
  components, the take-off, the bill, the exports and the saved record all follow, and each line stays
  editable.
- A roof plan that names its type (`HIPPED ROOF`, `MONO PITCH`, `GABLE`, `FLAT ROOF`, `PARAPET`) hands
  that type to **Use the roof plan**; nothing changes until the button is pressed.

A **flat** roof plan is understood as well: `FLAT ROOF`, `PARAPET`, `ROOF SLAB` switch the general
engine to a roof slab and parapet. The GES school block is priced with a pitched, trussed roof, so a
flat plan against that template is reported and left alone.

Without a roof plan the roof is measured from the floor plan exactly as before: footprint plus the
eaves overhang, divided by the cosine of the pitch in Settings.

### Room schedule

The **Building model** page lists every room with type, length, width and number, and totals the
net internal area. Each room type carries its own assumptions — lights, sockets, floor finish,
wet area, doors and windows — so the finishes, electrical and plumbing bills follow the schedule.
The **Finishes** panel on the same step picks the floor (dry rooms and wet areas separately) and the
ceiling; each choice carries its own description and rate into the bill, and the rate stays editable.
as you edit it. Rooms can be added or deleted, and a typical layout can be loaded from the
dropdown (or from the building-type buttons on the first page).

### Building components — the schedule behind the take-off

Below the room schedule, **Building components** writes the building model out line by line: the
element, its **size and how that size was arrived at**, the **wall** it belongs to, the count, the
quantity, the rate, the amount and the **bill it is priced into**. Every element the model measures
appears — clearing, excavation, concrete, blockwork, the frame, the roof, the finishes, the drainage.

- **The size boxes and the counts are the model's own dimensions.** Retype a length, thickness,
  height or a number and the model re-measures from it; the take-off sheet, the bill, the exports
  and every total follow.
- **Every quantity and every rate on a row can be typed over.** A retyped quantity is kept as a
  take-off correction: the row turns amber, the take-off sheet shows the same figure marked, and
  **↺** on either puts the measured figure back. A rate typed here re-prices the bill and wins.
- **IN WALL** says where the work sits — *external*, *internal*, or *both walls* for walling,
  blockwork, plaster, render and paint. On a **door or window** the cell is a dropdown: switch it and
  the opening moves from the external wall to the internal one, changing the wall areas, the
  blockwork and the plaster, exactly as if it had been changed in the Doors & windows schedule
  underneath — the two are the same field, so they always agree.
- **Search** narrows the list by component name, by size or by the bill it is priced into, and the
  count beside the box says how many rows of how many are showing.
- A component measured with others says so under its quantity rather than hiding it, and the
  **Prices into** chip links the row to the bill that carries it, so a figure in the bill can always
  be traced back to the element that measured it.

---

## Manholes and drainage, on the Plumbing Layout card

The run and the chambers are settled **before** the building model is taken off, on the
**Plumbing Layout** card of the drawing set on **Upload plan** — in a block of its own headed
**MANHOLE WORKS AND DRAINAGE**, under the card's settings. Nothing of it sits on *Read & scale*:
that step is the drawing, its scale and the rooms.

| On the card | What it is |
|---|---|
| **Run to the tank (m)** | the foul run out of the building, read as half the outer perimeter plus 8 m — 39.4 m on the sample school |
| **Chambers on the run (No.)** | one at the building, one every 15 m, one at the tank — 4 on that run |
| **Pipe into the tank (m)** | the 160 mm length from the last chamber into the septic tank — 6 m |

Beneath them the block says what the three figures come to: the two bills added together to the
cent, with the chambers, the trench and the chamber excavation that figure is made of. Every row
behind it — the trench, the sand bed, the backfill, the test, then the chambers with their
excavation, blinding, base, walling, render, benching, backfill and cover, and the pipe into the
tank — is priced at the rates the bill carries, and follows the run.

**Typing over a figure re-measures everything measured off it.** Change the run from 39.4 to 80 m
and the chambers go from four to seven — a chamber every 15 m — and their excavation, bases,
walling, render and benching are re-measured for seven, while the trench, bed, backfill and test
re-measure for 80 m. Change the chamber count on its own (say to six on a 39.4 m run) and the
per-chamber rows follow the count while the trench stays with the run.

**Tracing the route.** *Measure the route on the plan* arms the trace and takes you to
**Read & scale**, where the drawing is: click each corner of the drain from the building to the
tank, the route is drawn in blue over the plan, and the strip over it — *Tracing the route to the
tank*, counting the points as they are clicked — carries **Finish the route**. Finish scales the
length off the drawing and brings you back to the card. That length replaces the rule, the run
reads **traced on the plan**, and the chambers are re-ruled for it. **Back to the run the plan
gives** returns to the measured figures.

**Take these into the take-off** writes the run, the chamber count and the tank pipe onto the
take-off sheet as corrections. On *Take-off* the corrected row carries the measured figure beside
it and the rows measured off it are tagged **follows the run**, each showing the figure it is
billed at. From there the quantities flow into **Bills 14 and 15**, the Material Schedule, the
Labour Schedule, the Cost Breakdown and every export.

Everything on the card is kept with the project: reopen the saved bill or reload the page and the
run, the chamber count and the route are as you left them.

## The steps, named on hover

Ten steps run down the side of the page. Each answers a hover — and a keyboard focus, for anyone
working without a mouse — with its own name and what it does: *Building model · Rooms, openings,
spec*. The tooltip is drawn the way Bootstrap draws one: near-black, white text at .875rem, a
.375rem corner, a small arrow, a .15s fade and .9 opacity, and it never takes the pointer from the
step under it. It is drawn by the app itself rather than loaded from a CDN, so it works offline like
everything else.

- On a wide screen the tooltip sits to the **right** of the step, level with it; on a phone, where
  the steps are a bar of dots with their names hidden, it hangs **under** the dot — and the dots in
  the second row are named too.
- It is kept inside the window: a step at the edge of a narrow screen gets a tooltip nudged in, with
  the arrow still aimed at the middle of the button.
- **Escape**, a click, a scroll or the pointer moving away puts it away; a click on a step still
  moves the step.

## The drawing set — eleven cards on the upload step

Step 1 opens with one box that takes **as many files as the set has**, and beneath it **eleven
cards**, in the order a set is bound:

| # | Card | What goes in it |
|---|---|---|
| 1 | **Site Plan** | boundaries, levels, the tank, the ground the drain crosses |
| 2 | **Floor Plans** | ground floor, first floor — the plan the bill is measured from |
| 3 | **Elevations** | front, rear and side elevations, the roof line and external finishes |
| 4 | **Sections** | the levels: foundation depth, floor level, eaves and ridge |
| 5 | **Foundation Plan** | footings, column bases, the substructure |
| 6 | **Structural Framing Plan** | columns, beams, slabs and their reinforcement |
| 7 | **Roof Plan** | outline, pitch and covering, read into the roofing bill |
| 8 | **Door & Window Schedule** | marks, sizes and counts of every opening |
| 9 | **Finishes Schedule** | floor, wall and ceiling finishes, room by room |
| 10 | **Electrical Layout** | points, fittings, the distribution board and sub-main |
| 11 | **Plumbing Layout** | sanitary fittings, water and soil runs, the tank |

**A search sits on top of the set.** The field above *The drawing set* takes the name of a card —
*roof plan*, *floor plan*, *plumbing layout* — and the eleven narrow as it is typed, so the one
wanted is the only one left on the page. It answers to the words a sheet carries as well as the
name: *drainage* and *manhole* find Plumbing Layout, *facade* finds Elevations, *window* finds the
Door & Window Schedule, *schedule* leaves both schedules. The line beside the field says how many
are left — and when exactly one is, **Enter** opens that card's own file picker, so the sheet goes
straight into the card it was typed for. The **×** or **Show all 11** puts the set back; leaving the
step does too, so Upload plan always opens whole.

**Generate the readings.** One button, on the search line at the head of *The drawing set* — the
**Generate the readings** button sits beside the field, not at the foot of the page — reads the whole
set at once and puts what it finds where it belongs:

| From | Into the card |
|---|---|
| the **floor plans** | the rooms read off the sheet, the width and depth the drawing measures (only where the rooms fill it), the number of storeys, the wall lines |
| the **sections** | the foundation depth, the hardcore and the oversite, the level lines the heights in the bill come from |
| the **elevations** | the plinth, the eaves height, how the outside of the wall is finished |
| the **foundation plan** | the trench width and the height of the foundation wall |
| the **structural framing plan** | the column sizes and grid, the ring beam, the lintel depth and its bearing |
| the **door and window schedule** | the sizes and counts of every opening, straight into the schedule |
| the **finishes schedule** | the floor, the ceiling, the height of the tiling to the WC walls |
| the **electrical layout** | the light points and sockets per room, the bulkheads, the generator, the solar |
| the **plumbing layout** | the WC count, the septic tank, the borehole, and the drain: the run, the chambers and the two bills it produces |
| the **roof plan** | the pitch, the covering and the eaves overhang |

Press **Generate the readings** and every reader runs over every sheet on file — the PDF text layer,
the drawing itself, the schedules — the settings on the cards are written, the button itself says
*Reading the set…* while it works, and **Read & scale** opens on the drawing. A card read with
nothing to change says *the model already agrees with the sheet*; a card with nothing on file is left
exactly as it was. Nothing is written from a sheet the app cannot read, and a second press reads the
same figures rather than moving them again.

The card at the foot of the set, **What the reading found**, is the tally: every place in the set,
what came off which sheet, and how many figures were read. Before the first press it is *What the
reading will read* and says what is on file, sheet by sheet. The button stays on the search line
while the set is filtered, so a reading can be run without clearing the search first; the tally —
being no card of the eleven — steps aside with them and comes back with **Show all 11**.

**A file lands in its own card.** The name says what it is — `front-elevation.pdf` goes to
Elevations, `foundation-plan.png` to Foundation Plan, `door-and-window-schedule.pdf` to the door
and window schedule — and for a PDF the text of the sheet is read as well. Each file is shown in
its card with its thumbnail, what it was read as, and an **As** menu; change that menu and the
drawing moves to the other card.

Each card also carries **+ Add …**, which opens its own file picker, so a sheet can be dropped
straight where it belongs without going through the box above. The card says whether it holds
anything (*1 drawing* / *empty*).

The **floor plan is the one measured** — the ground floor when the set has one — whatever order
the files arrive in; never a schedule or a layout that happens to sort first. **Read & scale**
draws the plan marked *measured*, and any floor plan can be measured instead from its row.

Two cards do more than hold a file:

- a drawing filed under **Sections** or **Elevations** is read for its level lines, so the heights
  in the bill come from it;
- the **Roof Plan** card reads the roof's outline, pitch and covering and carries them into the
  roofing bill; a roof file dropped in the set box goes straight there.

### One card, every floor

The **Floor Plans** card holds a building's whole vertical set — ground floor, first floor, second
floor, and on up to the seventh. Each drawing is given a **floor**, and the floor is the thing the
card is organised by:

- **The floor comes from the file name** the first time: `ground-floor-plan.pdf` is the ground
  floor, `first-floor-plan.pdf` the first, `second-floor`, `3rd floor`, `upper floor`, `GF` and `FF`
  all read as what they say. A name that says nothing takes the lowest floor still free, so a set
  of four sheets dropped in at once lands Ground / First / Second / Third without being sorted by
  hand. A PDF that holds two floors in one file gives **one drawing per page**: measure page 2 and
  it joins the card as the first floor, page number and all.
- **The floor is on the row** — a tag beside the name and a **Floor** menu under it. Change the menu
  and the drawing moves to that storey. A floor holds one drawing: if the storey is already taken,
  the two swap rather than share it, and the card says so.
- **The card filters by floor.** A chip per storey across the top — *All floors 4 · Ground floor 1 ·
  First floor 1 · Second floor 1 · Third floor 1* — shows one floor's sheet at a time. The filter is
  kept with the bill, so a project reopens on the floor it was left on, and if the floor on show
  loses its only drawing the card goes back to all of them rather than looking empty.
- **Measure this floor** on a filtered row makes that storey the drawing Read & scale works on;
  each floor keeps its own scale.
- On **Read & scale** the plan switcher names the floors in the order they are built — *Ground
  floor · First floor · Second floor* — instead of the file names, with any elevations or sections
  after them.

The **As** menu on a floor row reads *Floor plan* — the storey is the Floor menu's business, not a
second kind of floor plan. A sheet dropped in the Floor Plans card whose name plainly belongs to
another card (an elevation, a section, a schedule) files itself there instead, as it does in the
box above.

A project saved before floors existed is given them once when it is opened: a ground floor and an
upper floor, read from their names.

### The settings on each card

A drawing does not only say *what* is built, it says *how much* — the apron is 1.2 m wide on the
site plan, the footings are 600 mm on the foundation plan, the columns sit 3.5 m apart on the
framing plan. So **each card carries its own settings block**, drawn like **ROOF TYPE AND
SETTINGS**: a small heading and a two-column grid of labelled fields, one per figure the sheet
gives the bill. Type a new figure and the bill is re-measured and re-priced at once, the totals in
the header follow, and the card is redrawn with the figure kept. Nothing needs a second screen.

| Card | What it sets |
|---|---|
| **Site Plan** | apron width round the building, boundary wall and gate in or out of the bill, site clearance as a multiple of the footprint |
| **Floor Plans** | wall thickness, wall height, storeys *(general)*, floor to floor *(general)*, classrooms *(PS 1)*, head teacher's office *(PS 1)* |
| **Elevations** | plinth above ground *(general)*, eaves height *(general)*, external wall finish *(general)*, height to eaves and verandah balustrade *(PS 1)* |
| **Sections** | foundation depth, hardcore bed (mm), oversite concrete (mm) |
| **Foundation Plan** | strip or raft *(general)*, footing width and thickness, trench width *(PS 1)*, foundation wall height *(PS 1)* |
| **Structural Framing Plan** | columns *(PS 1)*, column width and depth, ring beam depth *(PS 1)*, lintel depth, lintel bearing each side, column grid *(general)*, trusses *(PS 1)* |
| **Roof Plan** | already there — **ROOF TYPE AND SETTINGS**: type, pitch, overhang, ridge, trusses and purlins at centres |
| **Door & Window Schedule** | ironmongery priced as one item or a set per door, gloss paint to joinery — both faces, one face or not painted |
| **Finishes Schedule** | main floor finish, wet room floor, ceiling, height of tiling to the WC walls *(PS 1)* |
| **Electrical Layout** | light points and sockets per classroom *(PS 1)*, electrical installation, generator, solar, air conditioning, fire alarm *(general)*, external bulkhead lights |
| **Plumbing Layout** | WC and its fittings and the number of suites *(PS 1)*, plumbing installation, borehole *(general)*, septic tank and soakaway in or out of the bill |

A field appears **only on the template that prices it**, so a card never carries a switch that does
nothing: the PS 1 block shows classrooms and trusses, a domestic or commercial building shows
storeys and the column grid. Both templates keep the roof card's own block, which is why it is
left out of the list above.

The **Plumbing Layout** card carries a second block, **MANHOLE WORKS AND DRAINAGE**, under its own
settings: the **run to the septic tank**, the **chambers on the run** and the **pipe into the
tank** — the figures Bills 14 and 15 are measured from. The block shows what those three figures
come to (the two bills' total, the trench and the chamber excavation), and it has the two things
the card needs: **Measure the route on the plan**, which takes you to *Read & scale* with the trace
armed so the route can be clicked along the drawing, and **Take these into the take-off**, which
writes the run and the chamber count into the take-off sheet so the trench, bed, backfill, testing
and every chamber row follow them into the bill. Change the run and the chambers re-rule themselves
(one at the building, one every 15 m, one at the tank). The three figures are the whole of it: the block prices what they
produce, and nothing of the reading is repeated on *Read & scale*.

A figure the sheet gives in **millimetres** — the hardcore, the oversite, the column and lintel
sizes — is typed in millimetres and kept in metres inside the model, so the label and the field
agree with the drawing rather than with the spreadsheet.

The settings drove a handful of new figures into the bills, all of them off the drawings:
**lintel bearing each side** (150 mm by default, taken once per opening), the **number of external
bulkhead lights**, the **boundary wall and gate** (60 m of wall and one gate, priced only when the
site plan shows them), **site clearance as a multiple of the footprint**, **light points and
sockets per classroom**, the **number of WC suites**, the **septic tank in or out**, **ironmongery
as one item or a set per door**, **gloss paint on one face of the joinery or both**, the **column
grid** on a general building, and the **column and lintel sizes** the framing plan draws for it.

## More than one plan

A building is rarely one sheet. **Upload plan** takes several files at once — select them all in
the browser, or drop a handful on the box — and every one of them joins the set of plans for the
project.

| Plan | Read as | Used for |
|---|---|---|
| `ground-floor.png` | Ground floor | the plan *Read & scale* measures, the digital take-off, the rooms |
| `first-floor.png` | Upper floor | another floor of the same building — two of them offer the storey count |
| `foundation-plan.png` | Foundation | the foundation and substructure |
| `roof-plan.png` | Roof plan | the roof outline and pitch |
| `site-plan.png` | Site plan | the site layout — the drain route can be traced on it |

The role is guessed from the file name and can be changed in the row's **As** menu.

**One plan is the one being measured.** It is marked *measured* in the list, and on *Read & scale*
a row of buttons lets you switch to another; **Measure this** in the list does the same. The
drawing, the wall detection, the scale, the drain trace and the digital take-off all follow the
chosen plan. **Switching the drawing never changes the bill** — the building is measured once, from
the model the plans produced.

**Every plan keeps its own scale.** Set the ground floor to 1:200 and the first floor to 1:50;
come back to the ground floor and it is at 1:200 again, because a site plan at 1:500 is not the
floor plan at 1:100. Each plan also remembers its own reference span and paper size.

**Taking a plan away** is the **✕** in its row. Remove the one being measured and the next in the
list takes over; remove the last one and the plan and its reading are cleared.

The whole set is kept with the project: close the app, reopen the saved bill, and every plan is
there with its role, its scale and its picture. If the browser runs out of room it lets go of the
pictures of the plans that are not being measured first, and says so — the reading and the bill
are never dropped for a picture.

## How the picture is read — and what it can't do

The browser:
1. converts the image to greyscale and thresholds it (Otsu),
2. finds the ink bounding box,
3. scans row and column ink-density profiles to locate **long straight runs** — walls,
4. separates **thick** lines (walls) from **hair-lines** (dimension lines),
5. clusters the gaps between walls to estimate the number of **bays**, and
6. uses one user-confirmed dimension to convert pixels to metres.

PDF plans are rasterised in the browser by an embedded copy of **pdf.js** (Apache-2.0, © Mozilla),
including its worker — nothing is downloaded at run time. Vector drawings come out at print
resolution (up to 2300 px on the long side).

### Setting the scale

Every quantity is only as good as the scale. The **Scale** control on *Read & scale* offers four
sources, and the screen always says which one is in force:

| Source | When to use it | What the app does |
|---|---|---|
| **Printed on the drawing** | a PDF whose title block says `SCALE 1:100` | reads the ratio and the page size (A4/A3), so 1 mm of paper is 100 mm of building |
| **I will set it — paper size and ratio** | a scan, or a PDF with no scale, that you know was plotted at A3 1:100 | the same arithmetic from the paper you choose |
| **Known dimension on the plan** | the drawing prints one dimension you trust | that dimension is matched to the reference span detected on the drawing |
| **Scale not shown — assume the standard size** | nothing is known | the plan is taken as the standard building wide, and every screen says so |

The panel shows what the plan then measures (for example `19.76 × 11.29 m`) and the resolution in
mm per pixel. Where the scale is real, the building takes the measured size — but only when the room
schedule agrees with it to within 25%. When the drawing and the rooms disagree, the bill keeps the
room sizes, says what the plan measured, and leaves **Apply the measured size** for you to decide.

### One PDF, many sheets

A consultant normally issues **one file** holding the ground floor plan, the foundation plan, sections,
elevations, the roof plan and details. Drop that file in and the app reads the text layer of every page,
works out what each sheet is from its title block, and shows the set before anything is measured:

| Sheet | Drawing | Read as | Used for the bill |
|---|---|---|---|
| 1 | ground floor plan | Floor plan | **measured** |
| 2 | FOUNDATION PLAN | Foundation plan | — |
| 3 | SECTION A-A | Section | level lines |
| 4 | FRONT ELEVATION | Elevation | — |
| 5 | FIRST FLOOR PLAN | Floor plan | — |

- The **floor plan** is the sheet measured for the bill. If the title blocks are misread — or a scanned
  PDF has no text layer at all — change *Read as* on any row and press *Measure* on the sheet you want priced.
- The floor plan named in *Read as* is measured for the quantities, and **every floor plan in the set**
  adds its rooms to the schedule. The rest of the sheets are read for the numbers a plan cannot show.
- The **foundation plan** is read for the substructure: `Strip foundations 600 x 200 mm` becomes strip
  footings 600 mm wide and 200 mm thick, `FOUNDATION DEPTH 1.20 m` becomes the excavation depth, and
  *raft*, *pad* or *pile* switch the foundation type. Every figure is shown against the sheet.
- **Sections** set the heights the plan cannot show: `GROUND FLOOR LEVEL +0.45` is the plinth,
  `CEILING +2.70` the floor-to-ceiling height, `EAVES +3.20` the eaves and `RIDGE +4.40` the ridge.
  The figures appear against the sheet and in *Sections & elevations*; a figure you type there wins
  from then on, and the sheet is only read again when you change its role.
- Sections in the same file are also rasterised and read for their **level lines** (shown on the reading
  page). Where the sheet prints levels, those figures are shown, measured above the lowest line; where it
  does not, the lines are scaled from the sheet's own scale (`SCALE 1:100`, one point of paper 0.3528 mm).
- Two floor plans mean an upper floor. The general engine then sets **storeys** from the set; the GES
  school template stays a single-storey standard block and says so, rather than quietly doubling it.

The floor plan supplies the quantities; the other sheets supply the substructure and the heights, so the
bill is measured and priced from the whole set rather than from one sheet.

What it cannot do: **read the dimension text** (that needs an OCR model, which is not available
offline in a plain HTML file). So the app asks you to confirm one dimension, then measures
everything else from the line-work. That is the honest workflow — and it is why the reference
span can be typed or measured with two clicks.

Best results: a straight-on picture, the whole plan in frame, good contrast, and at least one
dimension line annotated on the drawing. For a building the reader cannot interpret, the room
schedule and the Settings figures give a complete bill without any picture at all.

---

## Files

| File | Purpose |
|---|---|
| `index.html` | **The app** — self-contained, works offline |
| `manifest.json`, `sw.js`, `icon-*.png` | Install as a phone/desktop app when the folder is served (e.g. `python3 -m http.server`) |
| `sample_plan.jpg` | The PS 1 school-block plan used by the sample button |
| `build.py` | Rebuilds `index.html` from `src/` after edits |
| `src/engine.js` | School measurement + pricing engine (pure functions, no DOM) |
| `src/gen.js` | General building engine — houses, offices, shops, clinics (14 bills) |
| `src/settings.js` | Settings dialog, building presets, sections/elevations panel, room schedule |
| `src/analyser.js` | Image / line-work reader |
| `src/pdfimport.js` | PDF → bitmap import (embedded pdf.js renderer, handles multi-page files) |
| `src/vendor/pdf*.js` | Bundled pdf.js 3.11.174 library and worker (Apache-2.0, © Mozilla) |
| `src/zip.js` | Minimal ZIP writer (used for the Office exports) |
| `src/docx.js` | Word document generator — cover, preambles, bills, summary |
| `src/xlsx.js` | Excel generator — priced bill sheet + summary & basis sheet |
| `src/pdf.js` | PDF generator — hand-written PDF with Helvetica metrics and pagination |
| `src/library.js` | Saved-bills database — IndexedDB store with a localStorage fallback |
| `src/catalogue.js` | The shipped catalogue — 757 materials, generated from `MATERIALS.pdf` |
| `tools/gen_catalogue.py` | The generator: reads the PDF, adds unit/specification/rate by rule, writes `src/catalogue.js` |
| `src/matdb.js` | The materials database — localStorage store, search, groups, import/export |
| `src/bbs.js` | The bar bending schedule — shapes and cut lengths, weights, totals, the starter from the bill |
| `src/bbsui.js` | The bending schedule screens — list, input form, by diameter and by member, the A4 print sheet |
| `src/struct.js` | The structural check — column and beam design to BS 8110, the bars it asks for, 12 m rod packing |
| `src/structui.js` | The structural check screen — the form, the results, the rods to buy, Generate the rods |
| `src/matui.js` | The database screens — list form, input/edit form, groups, import & export |
| `src/users.js` | Accounts, roles and the sign-in gate (IndexedDB) |
| `src/store.js` | The storage guard — an in-memory store when the browser gives the page none (sandboxed frames) |
| `src/ui.js`, `src/app.css` | Interface |
| `test_ui.py`, `test_matdb.py`, `test_bbs.py`, `test_struct.py`, `test_embed.py` | Headless browser tests — screenshots and assertions; `test_embed.py` runs the app the way a preview pane does |

Rebuild after editing the source:

```bash
python3 build.py     # writes index.html
python3 test_ui.py   # optional: runs the app in headless Chromium
```

---

## Standard plan library

Seven starting points, on the first page and in the room-schedule dropdown:

| Plan | Size | Bills |
|---|---|---|
| 3-bedroom bungalow (Accra standard) | 13.2 × 9.6 m, 1 storey, 127 m² | 14 |
| 4-bedroom two-storey house with garage | 13.5 × 10.5 m, 2 storeys, 284 m² | 14 |
| Two-storey office / shop building | 18 × 12 m, 2 storeys, 432 m² | 14 |
| Single-storey shop / clinic shell | 15 × 10 m, 150 m² | 14 |
| CHPS compound / clinic | 16.5 × 8.4 m, 139 m² | 14 |
| **Church** — auditorium, sanctuary, vestry, choir room, offices | 24 × 15 m, 360 m², 5.3 m walls, 25° roof | 15 |
| 3-room GES block (PS 1) | 18.6 × 12.75 m, 148.32 m² | 13 |

The school block also offers the GES layout variants (2-unit, 3-unit with or without office,
6-unit, KG) on its own model page.

## The building summary

From **Building model** onwards the figures behind the bill — gross floor area, net internal area,
footprint, overall size, roof area, blockwork, blocks, concrete, then the sub-total, contingency, grand
total and rate per square metre — sit in a **Building summary** sheet opened from the **Summary** button in
the header. It is closed until that button is pressed, and it lies over the page rather than taking a column
from it, with a dimmed backdrop: close it with the **✕**, by clicking outside it, or with Escape. The app
remembers whether you left it open or closed.

Because it no longer reserves a column, **every step's cards run the width of the window** — the same
content width the Digital Take-off sheet has had all along. On a 1,280 px screen the cards went from 736 px
to 988 px (the take-off is 1,012 px, its workspace being flush to the window edge instead of sitting in a
card gutter). On a phone the summary opens as the same modal as before.

### The dropdowns in the material forms

The **Group** and **Unit** menus in the *+ Add a material* form on the schedule, and in
*Materials database → New material / Edit*, are cut from the same book as everything else on the material side
— and that book is ordered by the building type under *Read the drawing and set the scale*:

- **The groups this building's bill actually spends on come first**, in the order its own schedule shows them
  (a school block opens on Blocks & masonry, Cement, Sand & aggregate, Roofing…). Every other group follows
  under the heading *Other groups — not used by this building*, so nothing is hidden or lost.
- **The units follow the same rule** — the units in use (No., bag, m³, m², t, m …) first, the rest after. A
  religious building pulls Ceilings and drums up with it; a school block does not.
- **The database form's groups are the database's own** (CEMENTS, TILES, PLUMBING WORKS, CABINETS AND WOODEN
  SHELVES …), and the ones that feed a shelf this building buys from are put first. It is a pick-list now rather
  than a free-text box with a datalist, so a group cannot be misspelt into existence — but the menu ends in
  **+ A new group…**, which opens a box to name it, so a genuinely new heading is still made in the form.

Change the building type and every one of these lists is rebuilt the next time it is opened.

## The material schedule

The **Material Schedule** is a step of its own — **step 7**, between the **Bill of Quantities** and the **Labour Schedule** — with its own page in the step menu, reached with the menu, the bill's **Continue to the Material Schedule →** button or the schedule's **← Back to the bill** button.
The schedule is worked out from the bill, so it never has to be kept up to date by hand: every priced item is
multiplied by the materials its rate is built from — the bags of cement and cubic metres of sand and aggregate
in the concrete, the blocks in the walls, the steel in the members, the tiles, pipe, cable and paint — and the
same material is added up across every bill that uses it.

**It is tied to the bill and says so.** The page opens with a strip that walks the money from the bill to the
sheet: the **bill subtotal** and the number of bills and items it is made of, the part of it **carried by
materials**, the part that is **labour, plant and preliminaries**, and the **material schedule** itself. The two
material figures are compared and the strip says **✓ ties to the bill** (what is left over is the cent rounding
of the individual lines) or, once a line has been changed by hand, how far off the bill the sheet now is and in
which direction. Every line's *N bill items* chip opens the trace underneath: the **bill**, the **item number**
as the bill prints it, the **bill description**, the **bill quantity**, the **item amount** and the **material
carried** by that item, largest first — so the bags of cement can be followed back to the walls, the oversite and
each column. Items priced as labour and plant only — site clearance, trench and pit excavation, backfilling —
are named under the strip with the money they carry, rather than silently dropped.

The sheet carries the nine columns a store is run from:

| Column | What it shows |
|---|---|
| **Material code** | CEM-01, AGG-03, BLK-02, STL-01 … fixed for the price-book materials; MAN-01 … for materials added by hand; PRO-01 … for the supply line of an assessed item |
| **Material name** | the material, with a count of the bill items behind the figure |
| **Category** | Cement · Sand & aggregate · Blocks & masonry · Steel · Timber · Roofing · Waterproofing · Ceilings · Finishes · Doors & windows · Plumbing · Electrical · Mechanical & fire · External works · Proprietary supply · Other materials |
| **Unit of measure** | bag, m³, No., m, kg, drum, sheet … |
| **Quantity required** | the quantity the bill calls for, added up over the bills |
| **Unit rate** | the price from the rate build-up, which the price list in Settings drives |
| **Total cost** | quantity × unit rate |
| **Supplier** | optional, typed against the material |
| **Remarks** | optional — a recipe's own note (*mortar*, *blocks, 9.7 per m2 (450 x 225 block, 10 mm joints, 5% waste)*) shows in grey until a remark is typed over it |

Four figures sit above the sheet: **material types** (and how many categories they fall into), **total
quantity** (with the number of units it is measured in), **total material cost** (and its share of the bill's
subtotal) and **materials with low stock** — shown as *no inventory linked to this project*, because the app
keeps no stock records; the panel is ready for a store system to fill in.

- **Search, filter and sort.** The search box takes a code, a material, a supplier or a remark ("cement" finds
  the cement and not the reinforcement); the category list narrows the sheet to one shelf; the sort list groups
  by category or orders by name, code, quantity or cost. The totals at the foot follow whatever is showing.
- **Edit, add and remove.** Every line has a ✎ to change its quantity, rate, supplier or remark — a change is
  marked *edited* and left alone when the bill moves again — and a ✕ to take a redundant material off the
  schedule, with **Restore removed material(s)** and **Clear every material change** at the foot of the sheet.
  **+ Add a material** puts something the bill does not produce (safety helmets, a hire item) beside the rest.
- **Exports.** **Excel** builds the workbook; **PDF** and **Print** both give the same thing: an **A4 list**, one
  material to a line, with the nine columns — code, material, category, unit, quantity, rate, total, supplier and
  remarks — banded by category with a subtotal on each band, the column headings repeated at the top of every
  page, `Page n of N` at the foot of the PDF, a green **total material cost** bar, the **bill reconciliation**
  (subtotal, carried by materials, labour and plant, schedule total) and a short note on where the quantities and
  prices come from. The Excel workbook carries the same reconciliation under its summary line. Print follows the screen: search, filter and sort included, and says so
  (*Showing 2 of 55 materials — search "cement"*). Both are priced in the project's currency and dated.
- The step remembers itself with the project, so a bill opens on the page it was left on. **← Back to the bill**
  and **Continue to export →** sit at the foot of the sheet.

## The labour schedule

The **Labour Schedule** is the other half of the materials sheet: **step 8**, between the **Material Schedule**
and **Export**. It answers the question a site asks before a single bag of cement is ordered — *who has to be
there, for how long, and what does that cost?* Like the material schedule it is **read out of the priced bill**
and never typed: the rate build-up already says how much of each trade a unit of work takes (a mason for 0.16
day per square metre of wall, a labourer for 0.05), the bill says how many units there are, and the rate card
says what a day of that trade costs. Change a quantity, a rate or a day rate and the days, the hours, the money
and the crew all move with it.

**Days and cost by trade.** One line for every trade the rates call for — *Masons · Carpenters / joiners ·
Steel fixers · Roofers · Plumbers · Electricians · Tilers · Painters · Glaziers · Labourers · Foremen /
supervisors · Plant operators* — with the work it does underneath its name, and seven figures across:

| Column | What it shows |
|---|---|
| **Man-days** | the quantity of each bill item × the time the rate build-up allows for a unit, added up over the bills |
| **Hours** | man-days × 8, because a Ghanaian site day is eight hours |
| **Day rate** | the rate the rate build-up carries for that trade — 200 for a mason, 120 for a labourer, 250 for a plant operator |
| **Labour cost** | man-days × day rate |
| **Items** | how many priced bill lines carry that trade |
| **Crew** | the man-days divided by the working days in the programme — so a trade needed for two days reads as *0.0* of a man, not as a man |
| **Share** | the trade's part of the days on the job, as a bar and a percentage |

Press a trade — its name or its + — and the lines its days are made of open underneath: bill, item, quantity,
man-days, day rate and cost for each one, totalled at the foot. That is the same trace the material schedule
gives, so a mason's 214 days can always be pointed back at the walls, the oversite and the columns.

**The crew and the programme.** The four figures above the table are the **trades on the job**, the **man-days**
(with the hours they come to), the **labour cost** (with the average cost of a man-day) and the **crew on site**
over the programme. The programme is a list — 4, 6, 8, 10, 13, 16, 20, 26, 39 or 52 weeks, 13 by default — and it
sets the crew only, never the days: the days come from the bill. The crew is the honest average, so 214 days over
13 weeks reads *3.3 masons* and 2 days of plant reads *0.0*: a trade needed for a week is shared, or brought in
for that week, and the schedule says so rather than pretending the job needs a full-time operator. The programme
is remembered with the project.

**Assessed labour is money, not days.** Doors, fittings, services and the like are priced as an assessment, and
their rate carries a labour-and-plant share. That share names no trade and no time, so the schedule does not
divide it by a day rate to invent days nobody measured: it is reported apart, in its own panel, with the number
of rates it sits inside and a list of the items. The panel then adds the two up — **labour value carried by the
bill** = measured labour + assessed labour — which is the figure that reconciles with the bill rather than the
measured days alone.

**The same labour, bill by bill.** A second table breaks the same days down the way the bill is written: one row
per bill, the trades it uses with their days against each, the man-days, the labour cost and the assessed money.
It is the view a foreman works to — the roofers and carpenters arrive for the roofing bill — and the totals tie
to the table above.

- **Excel** builds a workbook of both tables with the notes; **PDF** and **Print** give an **A4 sheet**: the
  project header, the four figures, the trade table with its total bar, the assessed-labour note, the bill-by-bill
  table totalled, the note on where the figures come from, and signature lines. Both are priced in the project's
  currency and dated.
- **When the bill carries no labour** — every line priced as a supply, or nothing measured yet — the page says so
  and offers the two ways back: the bill, or the take-off sheet.
- **← Back to the material schedule** and **Continue to the Cost Breakdown →** sit at the foot of the sheet, and
  *Go to upload* below them like every other step.

## The cost breakdown

The **Cost Breakdown** is **step 9**, between the **Labour Schedule** and **Export**, and it asks the question
that sits under all the others: *of the money the contract is for, how much goes on what?* It does not add a
single new figure — it reads the priced bill apart. Every rate in the build-up is made of materials, labour,
plant, sundries and an overheads-and-profit uplift; the bill says how much of each rate each item uses and how
many items there are. Multiplying those shares by the money the bill charges gives the six heads, and the heads
add up to the contract sum **to the cent**.

**The six heads.**

| Head | Where the money comes from |
|---|---|
| **Materials and components** | the materials each rate's recipe lists, plus the supply share of every assessed rate |
| **Labour** | the trades and days in the rate build-up, plus the fix share of every assessed rate |
| **Plant and equipment** | the plant inputs a rate hires — mixer, vibrator, compactor, hoist, excavator, water |
| **Sundries and fixings** | scaffolding, tools, nails, screws, sealant, binding wire — the small cash lumps a rate carries |
| **Overheads and profit** | the percentage uplift each rate carries for site overheads, head office and profit |
| **Contingency** | the allowance added on top of the bills at the percentage set on the bill — not part of any rate |

**The top of the page.** One stacked bar of the whole contract sum with the six shares under it, the contract sum
on the right and what it comes to **a square metre of floor area** beneath it — 148.32 m² in the sample, so
GH¢ 5,332.83/m². Then four cards: materials, labour, plant-and-sundries, and overheads-profit-and-contingency,
each with its share of the sum and its money per square metre.

**Where the money goes** is the head table: the six heads in order, what each one covers in a line of plain
words, the amount, its share of the sum, its money a square metre, and a share bar. **Every bill, broken down**
is the same money the way the bill is written: one row per bill with its amount, its share of the sum, its money
a square metre and a small bar of its own mix — so a roof that is mostly materials and a wall that is mostly
labour can be seen at a glance. The two tables tie: the columns total the heads, the rows total the bills, and
the foot of the head table is the contract sum.

**Nothing is guessed.** An *assessed* rate names no recipe — a door, a fitting, a service installed — so its
supply and fix shares are reported as materials and labour and not broken down further. A rate with **no
build-up at all** (a lump sum typed by hand) is treated differently: the money is counted, but the split is not
invented, so it is named in the note as unclassified and carried under overheads and profit until the rate is
given a build-up. On the sample bill nothing is unclassified.

**The figure that differs, and why.** The Labour Schedule prices the measured days at the day rates in the rate
card; this page follows the money the bill actually charges. Where the billed rates sit away from their
build-ups the two differ — GH¢ 204,615.96 against GH¢ 206,939.66 on the sample — and the page says so in its own
note rather than quietly re-making one of them, because it is the bill's money that has to add up to the
contract sum.

- **Excel** builds a workbook — the head table, the bill-by-bill table with all five parts of every bill, the
  totals row and the note. **PDF** and **Print** give one **A4 sheet**: the project header, the four figures,
  the stacked bar and its key, the head table, the bill-by-bill table and signature lines. Both are priced in
  the project's currency and dated.
- **When the bill carries no money** the page says so and offers the two ways back: the bill, or the take-off
  sheet.
- **On paper it is one A4 sheet.** The screen layout is a phone layout below 760 px; that layout is scoped to
  screens, so a narrow print — a wide margin, a small page — still prints the tables rather than the phone cards.
- **← Back to the labour schedule** and **Continue to export →** sit at the foot of the sheet, and *Go to
  upload* below them like every other step.

## Manhole works and drainage works

Bills **14 and 15** of the school template (15 and 16 of the general one) are the chambers on the
foul run and the run itself. They sit after the external works and are taken off from the building
the same way everything else is — nothing is typed to make them appear.

**Where the figures come from.** The plan gives the building, not the site — and the run is set on
the **Plumbing Layout** card, before the bill exists, where it can be typed over or traced along
the plan (see the chapter above). The rule is that the run out of the building is **half the frame perimeter** — the average distance from the middle of the
building to its face — **plus 8 m** to clear the building to the tank. A chamber sits at the
building, **one every 15 m** of the run, and one at the tank, so a 39.40 m run reads as four
chambers. Every figure is a line on the take-off sheet: correct the run and the trench, the bed,
the backfill, the test and the chambers all follow it, because they are all measured off the same
length.

**A manhole is measured like a small building** — 600 × 600 mm clear inside, 225 mm walls,
1.20 m deep, with 150 mm working space round it:

| Bill 14 · Manhole works | |
|---|---|
| Excavate for manholes | 1.35 × 1.35 × 1.40 m each, trimmed and carted away |
| Blinding | 50 mm grade 15 under the base |
| Base | 150 mm reinforced concrete, 1:2:4 |
| Walls | 225 mm sandcrete blocks in 1:4 mortar, fair face inside |
| Render | 15 mm of 1:3 cement and sand, steel float |
| Benching | concrete channel and benching to the invert, laid to falls |
| Cover | heavy duty cast iron cover and frame, 600 × 600 mm, bedded and sealed |
| Backfill | selected material in 150 mm layers, compacted |

**Every measured element is a line on the building model.** The components schedule writes all
fourteen out — the chambers, their blinding, bases, walls, render, benching and backfill, the run,
its trench, bed and backfill, the pipe into the tank and the test — each pointing at the bill row
that prices it and carrying that row's figure, so the model and the bill can never drift apart.

**A drain is measured as a trench.** 0.45 m wide, 0.90 m deep, with a 100 mm sand bed under the
pipe; the backfill is the trench less the bed and less the volume the pipe displaces, which is the
figure a site actually has to cart in.

| Bill 15 · Drainage works | |
|---|---|
| Excavate trench | 0.45 × 0.90 m over the run, trimmed to falls |
| Bedding | 100 mm sand, levelled and compacted to the fall |
| 110 mm uPVC | the foul run, laid to falls, with couplings, bends and junctions |
| 160 mm uPVC | the last chamber into the tank |
| Backfill | trench less bedding and pipe, in layers, made good |
| Testing | flushing, ball tests and making good |

**Every one of the fourteen rates is built, not assessed.** The recipes are in the rate build-up
like the concrete and the blockwork: the excavation hires an excavator and a tipper by the day, the
concrete reads its mix, the chamber walls read a block count per square metre, the pipe reads a
length of pipe per metre and a lump of fittings. Change the mix in a description — *1:2:4* to
*1:3:6* — and the base prices down; type over the depth and the excavation follows. Nothing is a
round number typed to look plausible: each rate is the market prices in the card, added up.

**They travel with the plumbing.** A foul drain needs a sanitary installation to drain, so in the
general template the two bills appear with *svcPlumbing* and go with it; the school template always
carries its plumbing, so it always carries its drainage.

## The structural check — columns, beams and the rods they need

The **Structural check** sits beside the **Bending schedule** on the bill (and inside the schedule itself), and
it does the two things that come before a cutting list: it checks the column and the beam against the load the
plan puts on them, and then it works out how many rods of steel the frame takes.

**The form.** Open **step 6 · Bill of Quantities → Structural check**. Nothing starts blank — the figures the plan
already gives are filled in: the number of columns the engine counted, the number of beams from the frame
perimeter ÷ span, the span from the longest room side, a beam depth of span/10, and the column's axial load at
8 kN/m² over its tributary share of the gross floor area (plus its own weight). Every figure can be typed over:

| The frame | |
|---|---|
| Storeys · floor height | the height a column bar has to reach |
| Concrete fcu · steel fy | 25 N/mm² and 460 N/mm² to BS 8110, change for a different mix or grade |
| Cover | 25 mm to a protected internal column, 40 mm for a beam against the ground |

| Columns | | Beams | |
|---|---|---|---|
| Number of columns | from the bill | Number of beams | from the frame |
| Width b · depth h | 225 × 225 mm | Span | from the rooms |
| Design load N | kN, axial | Width b · depth h | 225 × 450 mm |
| Main bar Ø · link Ø | the sizes it may choose from | Design load w | kN/m, already factored |
| | | Bottom bar Ø · top bar Ø · link Ø | |

**What it checks** — the arithmetic is BS 8110, short column and singly reinforced beam, written out on screen so
it can be followed:

- **Column** — `As req = max(0.4 % Ac, (N − 0.4 fcu Ac) / 0.75 fy)`; capacity `0.4 fcu Ac + 0.75 fy As prop`;
  slenderness `le/h` against the short-column limit of 15; steel between 0.4 % and 6 % of the section; links at
  the lesser of 12 × main bar, the smaller section side and 300 mm.
- **Beam** — moment `wL²/8`, `K = M / (fcu b d²)` against `K' = 0.156`, lever arm `z`, `As = M / 0.87 fy z` against
  the 0.13 % minimum; shear stress `v = V / bd` against the concrete's `vc` and a link spacing of
  `0.87 fy Asv / ((v − vc) b)` capped at 0.75d and 300 mm; span/depth against 20.

Each card ends in **passes**, **passes, with a note** or **does not pass**, with the reason: a shallow beam reads
*the section is too shallow for the moment (K 0.400 > 0.156) — deepen the beam or add compression steel*; an
overloaded column reads *the steel is over 6 % of the section — enlarge the column*. **Generate the rods** is
disabled while the design does not pass.

On the sample plan the check gives:

- **Column** 225 × 225, N = 304 kN — **4T16** (804 mm², 1.60 % of the section) with **Y8 @ 190 c/c**, capacity
  784 kN, 39 % used, le/h 10.0.
- **Beam** 225 × 450 over 4.5 m, w = 38.4 kN/m — 97.2 kNm and 86.4 kN shear, K 0.103, **4T16 bottom, 3T12 top**
  (804 mm²) and **Y8 @ 300 c/c** links (v 0.94 against vc 0.60 N/mm²).

**Generate the rods** turns those two designs into five bar marks — C1 column main bars (4T16 × 4 columns, height
plus a 40Ø lap), C2 column links, B1 beam bottom bars, B2 beam top bars and B3 beam links — and writes them
straight onto the **bending schedule**, which opens on them. Column and beam lines already on the schedule are
replaced (with a confirm); foundation, slab, lintel and fabric lines are left alone. On the sample that is
**540 bars, 1,280 m, 1,240.2 kg**.

**The rods to buy.** Under the bar marks the check cuts the bars from **12 m stock** — first fit, longest first,
the way a yard cuts — and gives, for each diameter, the bars, the length, the weight, the **number of 12 m rods**
and the offcut. On the sample: **Y8 384 bars → 41 rods · Y12 60 → 30 · Y16 96 → 46, 117 rods in all**, 124.4 m
of offcut. Nothing is invented per bar: the rod count is the packing of the actual cut lengths on the schedule.

**Reviewers** see the check and the numbers, with **Generate the rods** disabled. The design is saved with the
bill, so the schedule made from it is still there when the bill is opened again. No network is needed; the check
runs on the device.

## The bar bending schedule

The bill prices reinforcement as so many kilograms at a rate. The **Bending schedule** is the cutting list
behind that kilogram: every bar mark, its member, diameter, shape, number of bars, cut length and weight, added
up by diameter and by member, and reconciled with the reinforcement item the bill is carrying.

Open it from the bill: **step 6 · Bill of Quantities → Bending schedule**, in the tools row above the bill.
It is a dialog over the bill, not another step, because it belongs to the page it changes.

**Start from the bill.** An empty schedule offers **Start from the bill (2,958 kg)**: the app reads the
concrete in the bill, divides the steel over the members by volume at roughly 100 kg/m³ (70 % main bars, 30 %
links), gives each member a main bar and a link line, draws the length from the member's own size and number of
bars, and lands 11 bar marks, 1,540 bars, 3,174 m and **2,951.46 kg against the bill's 2,958 kg — −6.54 kg
(−0.22 %)**. The oversite is A142 fabric by area and is kept out of the kg/m³ split, so the fabric line reads
166 m² × 2.22 kg/m² = 368.5 kg rather than being treated as bars.

**The marks.** Every line carries a mark prefixed by its member — F, CB, C, B, S, ST, L, W — a location, a bar
type (deformed bar, mild steel, fabric), a diameter, a shape, its dimensions, the number per member, the number
of members, an optional lap and a note. Changing a mark changes the schedule, the reconciliation and every
export.

| Shape | Dimensions | Cut length |
|---|---|---|
| Straight | a | a |
| L — one bend | a, b | a + b − 2d |
| U — two bends | a, b, c | a + b + c − 4d |
| Z — two bends | a, b, c | a + b + c − 4d |
| Link / stirrup, 135° hooks | a (width), b (depth) | 2 × (a + b) + 20d |
| Cranked bar, 45° | a, h | a + 0.83h |
| Hooks both ends | a | a + 18d |
| Circular link | a (diameter) | π(a − d) + 20d |
| Fabric / mesh | area, kg/m² | area × kg/m² |

Weight per metre is **d²/162.28** — Y6 0.222, Y8 0.394, Y10 0.616, Y12 0.887, Y16 1.578, Y20 2.465 kg/m.
Fabric: A98 1.54, A142 2.22, A193 3.02, A252 3.95, A393 6.16, A475 7.46, A565 8.88 kg/m².

A Y8 link 175 × 400 × 30 per member over 4 members cuts **1,310 mm**, weighs **62.0 kg**, and the form says so
as it is typed: *2 × (a + b) + 20d → cut 1,310 mm · 120 bars × 1,310 mm = 157.20 m · 0.394 kg/m = 62.0 kg*.
A mark typed by hand is kept when the shape changes — the suggestion never overwrites it.

**The screen.** Six figures across the top — bar marks, bars, total length, steel, what the bill carries, and
the difference in kg and per cent (green when it agrees, amber within 5 %, red beyond). The table is banded by
member, in the order the work is built: Foundation · Column bases · Columns · Beams · Slab · Staircase ·
Lintels · Walls · Other, with each band's weight. Search takes a mark, a member, a location or a note; the
member list narrows the sheet; the sort list gives *by member* (the schedule order, banded), *by bar mark*
(flat), *by diameter* and *heaviest first*. Every row has ✎ to change it, ⧉ to duplicate it and ✕ to delete it
with a **Delete? Yes / No** in the row. Two small tables at the foot add the steel **by diameter** (marks, bars,
length, kg, share) and **by member**.

**Use this schedule for the bill.** The reconciliation card says what the bill prices and how far the schedule
is from it; **Use this schedule for the bill** spreads the schedule's weight over the bill's reinforcement
items in proportion to what each already carries, marks them edited, and re-prices the bill — in the sample the
2,958 kg item becomes **3,034 kg**, and the card then reads *the schedule agrees with it*.

**Excel, PDF and print.** **Excel** builds a real `.xlsx` — Mark · Member · Description · Bar · Shape · No. per
member · Members · Bars · Cut · Length · Weight, banded by member with a subtotal on each band, a total steel
row, the by-diameter table and the reconciliation note. **PDF** is an A4 portrait cutting list with a green
head, three figure boxes, the same banded table, the by-diameter table and the reconciliation paragraph, with
`Page n of N` at the foot. **Print** builds the same A4 sheet from the screen and prints only it. All three are
dated and carry the project's name; the workbook is `Bar_bending_schedule_<project>.xlsx`, the PDF the same
name with `.pdf`.

**Reviewers.** A user whose role cannot edit — and anyone opening a saved bill read-only — sees the same
schedule with a `read-only` chip: no add, duplicate, delete or adopt, only the ✎ to open a mark and read it.

The schedule is saved with the bill, so it comes back on the page it was left on, and it needs no network.

## The materials database

The app carries a catalogue of **757 materials**, read off the project materials schedule (M.1 cements to
M.21 pre-mix concrete — the schedule has no M.13). Every line keeps the schedule's own **code** and **name**,
its **group** and sub-group, a **unit**, an indicative **rate** (736 of the 757 are priced; the rest open with
*no rate* for you to fill in) and a **specification line** that carries what the schedule printed beside the
name: sizes, grades, standards and references — *Ref: A142, 2.22 kg/m²*, *8.78 kg/roll*, *29 pc/pack*,
*CEM II/B-L, 50 kg bag*. It opens from **step 7 → Materials database**, beside *+ Add a material*.

| Where | What it does |
|---|---|
| **Materials** | the list form — search, group and unit filters, six sorts, 20 to a page, a tick box on every row |
| **New material / Edit** | the input form — code, name, group, sub-group, unit, rate, supplier, description, notes |
| **Groups** | the group manager — add, rename, remove |
| **Import & export** | Excel, CSV, print, and a CSV/TSV import with three merge modes |

**The list form.** The search box takes a code, a name, a word from the specification, a supplier or a note;
the group list narrows it to one shelf (each group shows its count); the unit list to bags, m², No. …; the sort
list orders by group-then-code (the schedule's own M.1, M.2 … order), code, name, rate, *unpriced first* or
*recently changed*. The footer counts what is showing and pages through it. A row can be opened with a click or
the ✎, duplicated with ⧉ — the quickest way to add the same product in another size — and deleted with ✕ behind
a *Delete? Yes / No*.

**Ticking rows** brings up a bulk bar: **Move** them to another group, **Export these** to a workbook, **Delete**
them, or **Clear** the selection.

**The input form.** Code, material name, group, sub-group, unit, rate in the project's currency, supplier,
description and notes. Group, sub-group, unit, supplier and code fields suggest what the database already
holds and still take anything new — typing a group that does not exist creates it. **Enter** saves; *Save and
add another* keeps the group, unit and supplier for the next line. Saving a change never re-prices a bill that
was already made from the old figure.

**Groups.** Add a group; rename one (its materials move with it); remove one — its materials move to the group
you choose, nothing is deleted. Two groups cannot share a name.

**Import.** A supplier's price list, a schedule of rates or a spreadsheet of your own: CSV or tab-separated
text with a first line naming the columns — `Code, Name, Group, Unit, Rate, Supplier, Description, Notes` (any
order, and *price*, *category*, *specification*, *remarks* are understood). Choose a file or paste the cells
straight out of Excel. The rows are read into the box first so you can see them, then:
*update a material with the same code and name, add the rest* · *add everything as new lines* · *replace the
whole database*.

**Export and print.** **Export Excel** writes a real `.xlsx` with a column for every field, banded by group —
the same file reads straight back in through the importer. **Export CSV** gives the same rows for any other
system. **Print / PDF the list** builds an A4 list, one material to a line with its specification, banded by
group. All three export the **whole database** by default and offer the filtered rows (*Excel, filtered*) when
a search or group filter is on. **Restore the shipped materials** brings back any line you have deleted and
keeps your edits; **Empty the database** returns it to the shipped 757.

**Where the database answers the app.**

- *Material schedule → + Add a material →* the name field suggests every material in the database, and
  **From the database** opens the list as a picker: choose a line and its code, name, group, unit, rate,
  supplier and remark are filled in — only the quantity is left to type.
- *Settings → Rates →* **Prices from the database** takes 41 of the market prices the rate build-up uses
  (cement, sand, aggregate, blocks, rods, mesh, timber, sheets, tiles, paint, doors, glass, sanitary ware,
  paving, kerb) from the catalogue line that answers each one, converting units where they differ (a rod is
  kept per kg, the bill wants the tonne; binding wire is kept per 8.78 kg roll).

**Where it is kept.** In the browser's `localStorage` under `plan2boq.matdb` — about 230 KB for the 757 shipped
lines — with an internal id for every record (`matdb:<code>#<n>`), because the schedule's codes are not unique
(M.12.1.57 appears twice). A seed version lets a later build add new lines without touching the ones you have
edited. Nothing leaves the device: no server, no account, and the file works from `file://`.

**Roles.** Reading, searching, printing and exporting the database is open to everyone signed in. Adding,
changing, duplicating, deleting, importing, restoring and emptying are **edit** actions: a reviewer sees the
same list with a *read-only* badge, no *New material* button, no ⧉ or ✕, and the form's fields disabled.

## The description is the specification

A take-off description is written the way the Ghana Standard Method of Measurement writes it, and the words
in it are the specification — so the app reads them and builds the rate to suit. Change a description in place
and the rate on that row is re-priced before the bill is drawn:

| The description says | What the rate does |
|---|---|
| a **mix** — `1:2:4`, `1:3:6`, `1:1.5:3`, `1:4`, `1:3` | concrete takes 7 bags of cement to `1:2:4` and 6 to `1:3:6`, so the cement, sand and chippings per m³ are reset; mortar in a coat, a screed or a block wall follows the same rule |
| a **thickness** — `12 mm thick`, `average 60 mm`, `225 mm thick sandcrete block walls` | plaster, render, screed and terrazzo materials move in proportion to the thickness; a wall thickness selects the block it is built from (100, 150, 225, 300 mm) and its mortar |
| a **depth** — `depth not exceeding 3.00 m` | trench and pit excavation gain digging time and plant in proportion to the depth |

- The row shows the change: a pale-blue **rate from description** tag and a line under the description —
  *12 mm → 18 mm · materials 1.500 × · 1:4 → 1:3*, *150 mm → 225 mm blocks (225 mm)*, *1.50 m → 3.00 m deep ·
  digging and labour 1.23 ×*.
- A **rate typed on the row always wins**: type one and the rate stays exactly as typed, whatever the
  description says. Put the description back and the original rate returns.
- The build-up in **Settings → Rate build-up** shows the same specification and the quantities it produced, so
  the analysis and the bill never disagree (`1:3:6 → 1:2:4 · cement 6.00 → 7.00 bags per m³ …`).
- Only the words that carry a specification are read, and the default descriptions the app writes already
  match their recipes — measure the PS 1 sample and nothing moves until a description is edited.

## The digital take-off — measuring straight off the drawing

**Step 3 · Digital Take-off** turns the plan on screen into measured quantities. It is a drawing board laid
over the picture: the scale arrives from step 1, and every mark is measured against it, so a line says
`4.32 m` because the drawing says so, not because a figure was typed.

| Group | What it measures | Tools |
|---|---|---|
| **Linear** | walls, beams, fencing, pipes, cables, roads | **Line** (two clicks), **Polyline** (click along the run, then **Enter** or a double-click) |
| **Area** | floor finishes, roofing, painting, tiling, landscaping | **Polygon** — it closes itself and reads the enclosed area *and* the perimeter |
| **Count** | doors, windows, light fittings, power outlets, columns, toilets | **Point** — one click per item, the count moves as you go; **Find repeats…** drags a box round one symbol and marks the others it recognises |
| **Volume** | concrete, excavation, fill materials, asphalt | **Box** — drag the footprint, type the depth in millimetres; the depth can be changed later without redrawing |

**Waste factors** belong to the area groups: floor finishes open at +5 %, laid to waste, and the `+5%` in the
*Waste / depth* column is editable per mark. A volume mark can be marked **cut** or **fill**, and the sheet
totals them apart (`12.40 cut · 3.10 fill m³`) — the same box is never both.

**Scales.** The step opens on the scale the picture was read at. Below it, **Architectural**, **Engineering**,
**Metric** and **Custom** each add a scale for a sheet — 1:50 on A3, 1:100 on A1, and so on — and all of them
stay live: every mark remembers the scale it was drawn at, and a scale can be applied to the whole sheet with
**Re-measure every mark at the selected scale**. The surest route is **Measure a known length (2 clicks)**:
click the two ends of a dimension you know, type the real length in millimetres, and the mm-per-pixel figure
is worked back from it.

**A sheet to work on.** This step is a workspace, not a page: the card fills everything beside the step rail,
edge to edge, from under the header to the bottom of the window — on a 1,440 px screen the plan is about
1,130 px across, roughly twice what the old side panel left. The scale controls sit beneath it as a flat
strip, with the running totals in a row of chips between the two. The summary is a sheet opened from the header,
laid over the page, so nothing eats the drawing. **Fit** puts the whole sheet in
the window, height and width together, for the times you need to see all of it at once.

**Moving about the sheet.** A sheet read at 1:50 is drawn much bigger than the space it is shown in, so the
drawing moves: click **✥ Pan** (or press **H**) and drag, hold **Space** with any tool in hand, or drag with
the middle mouse button. **Ctrl + wheel** (⌘ on a Mac) zooms about the pointer — the wall you are looking at
stays under it instead of sliding off the corner — and **Fit** returns to the whole sheet. The corner you
panned to is remembered when the step redraws and when the file is opened again. With the hand on, the tool
bar says so and the drawing stays still until you put the hand away.

**From drawing to bill.** Each category is offered against the bill items measured in the same unit, with the
closest wording picked first — a floor area lands on the screed or the floor finish, a door count on the door
schedule. The list beside each quantity lets you change the item; an unmatched category stays unticked, with
*— pick the bill item —* waiting rather than a guess. **Send to the bill** writes the quantity onto the chosen
item and re-prices the whole bill at once; the rate and the description are left as they were.

Marks are kept with the saved file, so a reload, a close and a return all come back to the same sheet.

## The measurement / take-off sheet

Step 5 sits between **Building model** and the **Bill of Quantities**, so the quantities and the rates can
be checked and put right before the bill is issued. The sheet is grouped into the seven work sections a bill
is measured in, in the order it prints:

| Section | What it holds |
|---|---|
| **Preliminaries and General Items** | site clearance, site establishment, supervision, insurance — and the balancing item that keeps preliminaries at the percentage set in Settings |
| **Substructure** | excavation, blinding, foundations, damp-proofing, hardcore, oversite, termite treatment |
| **Superstructure** | frame, floors and staircase, walling, roofing, ceiling, doors, windows and ironmongery |
| **Finishes** | floor finishes, wall finishes, painting and decoration |
| **Services** | electrical installation, plumbing and sanitary installation |
| **External Works** | apron, steps, drainage channel, levelling, landscaping, boundary and gate |
| **Drainage** | Bill 14, the chambers on the run, and Bill 15, the run itself — set on the Plumbing Layout card |

Every section shows its own bill count, item count, corrected count and total; every bill folds open to its
items (**Expand all** / **Collapse all** above the list).

Each row carries the description, the unit, **the quantity the model measured**, an empty **Corrected**
box, the **Rate** and the amount. Both figures are editable, in every section:

- Type a quantity where the drawing says otherwise — the row turns amber and is marked *qty*, and the
  amount, the bill, the preliminaries balancing item, contingency, VAT and the grand total are worked out
  again at once. The balancing item keeps preliminaries at the percentage of the measured works, wherever
  the correction is made.
- Type a rate where the market or a quotation says otherwise — the row is marked *rate* and the amount
  follows. There is one rate per item: a rate typed on the take-off shows on the bill page, and a rate
  typed on the bill page replaces the take-off correction.
- **Rewrite a description or change a unit** in the row itself: click the wording and type (Enter finishes
  the edit), or pick a unit from the list beside it. The bill, the Excel, Word and PDF exports and the saved
  record print the new wording and the new unit; the row is marked *description* / *unit*.
- A row that has been changed — quantity, rate, description or unit — carries a small **↺** at its end that
  puts it back to what the model measured. **Clear every correction** above the sheet puts every row back at
  once.
- Rows the model works out for itself — the preliminaries balancing item — are marked *calculated* and are
  left alone.
- A row measured **off another row** — the trench, bed, backfill and test follow the drain run; every
  chamber row follows the chamber count — is tagged *follows the run* and shows the figure it is billed at,
  with the model's own measurement beside it. Type over one of those figures and it stops following: the
  figure you typed is the one that stays.

Items can also be **added and removed** on the sheet, in any section:

- **+ Add an item to this bill** at the foot of every bill opens a short form — description, unit, quantity
  and rate. The item is written into that bill, marked *added*, and priced there like any other; its
  quantity and rate stay editable, and it can be taken off again with its ✕. An addition to any bill
  re-balances the preliminaries in the same way a correction does.
- The **description field fills itself from the database**: it opens a list of the descriptions the app
  already knows — every measured item, bill by bill, and the whole price book (materials, labour, plant) —
  drawn above the bill so nothing can hide it. Type to narrow it, **↑ ↓** and **Enter** (or a click) to take
  one, **▾** in the field to open the list again, **Esc** to close it. A pick fills the description, the unit
  and, for a measured item, the rate; the wording stays a text field, so it can be reworded before the item
  is added.
- The **✕** at the end of a row takes that item off the bill. Nothing is lost at once: the bill's foot then
  offers **Restore removed item(s)**, and **Clear every correction** is not needed for it. Items the model
  works out for itself (the preliminaries balancing line) have no ✕.
- The figures above the sheet count what has changed: *corrected*, *added* and *removed*.

**Rows can be moved.** Take the ⣿ grip at the start of a row and drag it: the row follows the pointer and
drops where it is let go, at the nearest row boundary, so item 6 becomes item 3 in one move. The numbers
(01, 02, …) are renumbered in the order the rows now stand, and that order is what the Bill of Quantities,
the Excel, Word and PDF exports and the saved record print. Dragging never touches a quantity, a rate or a
total — only the position. The grip also works from the keyboard: Tab to it and press ↑ or ↓ to move the
row one place, one press at a time. The calculated preliminaries line has no grip and always stays last in
its bill.

**Continue to the Bill of Quantities** carries every correction, addition and removal into the priced bill,
the Excel, Word and PDF exports and the saved record; the bill page marks the rows *take-off* so the two
always agree. **Clear every correction** puts the measured quantities and the built-in rates back.

Above the table, seven checks read the building as a whole:

| Check | What it catches |
|---|---|
| Openings taken out of the walls | door and window area against the gross wall — a double count, or a schedule left out |
| Rooms inside the building | the room schedule against the footprint × storeys — rooms missing, or sizes wrong |
| Blocks per m² of wall | a 450 × 225 mm block with 10 mm joints takes 9.25 to the square metre, 9.7 with the wastage — the block count against the wall area |
| Concrete per m² of floor | foundations, columns, beams, lintels and slabs against the floor area |
| Reinforcement per m³ of concrete | steel against concrete for a framed building |
| Roof covers the building | sheeting area against the footprint, allowing for the eaves and the pitch |
| Items measuring zero | rows that price at nothing because nothing was measured for them |

A check that passes is green; one worth a look is amber, with a line saying what to look at. The sheet
prints as it stands (Ctrl+P on the step), every bill unfolded, headed with the project name — a
measurement sheet to file with the bill.

## Exports

| Export | What you get |
|---|---|
| **PDF (.pdf)** | A finished A4 PDF written from scratch in the browser: cover with client/contractor/consultant particulars, preambles, accommodation schedule, basis of quantities, all priced bills with repeated table headers, summary, grand total in words and signature blocks |
| **Word (.docx)** | Editable: cover, particulars, preambles, accommodation schedule, basis of quantities, all priced bills, summary and signature blocks, A4 with running header/footer and page fields |
| **Excel (.xlsx)** | Two sheets — *Bill of Quantities* (styled, with totals) and *Summary and Basis* (areas, blockwork, concrete, reinforcement, cost/m²). Exported from the **Export** step, or from **Export final BoQ as Excel** beside the grand total on the bill page |
| **CSV** | Flat item list for any spreadsheet |
| **Saved bills** | Every generated bill is kept in the browser's database; re-open, export or print it later from the header — see *Saved bills* below |
| **Project (.json)** | Re-open later with the plan image, sections and every edit intact |
| **Print** | Browser print dialogue, if you prefer paper |

All exports carry the same figures — the grand total, contingency and amount in words always agree. The
Excel file is named after the project (`BOQ_<project>.xlsx`) and is written entirely on the device, so it
opens in Excel, LibreOffice or Google Sheets with no macros and nothing to enable.

## Saved bills — the bill database

Every bill the app generates is written to a small database **on this device**, so it can be opened,
exported or printed again later, in this session or months from now, still with no connection.

Open **Saved bills** in the header (the badge counts what is stored). Bills are saved automatically,
about a second after the bill settles — you do not have to press anything. **Save this bill** inside the
window stores a copy at once. Each record keeps the plan picture, the scale, the room schedule, every
price and every rate you edited, so re-opening it reproduces the same figures, not today's rates.

| In the window | What it does |
|---|---|
| **Open** | Loads the bill back into steps 1–6 to carry on editing |
| **Excel · Word · PDF** | Writes that bill's export straight from the database — the open project is not touched |
| **Print** | Opens the bill and sends it to the printer |
| **Rename** | Renames the record (and the project name inside it) |
| **Duplicate** | A new record from the same plan and rates, for a variation or a second issue |
| **Delete** | Asks first, in the row: *Delete this bill* or *Keep it* — then the record and its plan are gone |
| **Delete selected** | Ticks on the rows (or **Select all**), then **Delete selected (n)** — one confirmation for the whole set: *Delete 3 saved bills?* / *Keep them* |
| **Delete all** | Empties the library in one confirmed step; the bill on screen stays open but stops being tracked |
| **Back up all** | One JSON file holding every saved bill, plan images included |
| **Restore** | Merges a backup back in; records with the same id are replaced, others are added |

Search filters by name, building or country; the list sorts by newest, oldest, highest value or name.
The list also appears on step 1 (the four most recent, each with a ✕ to delete it) and on the export page.

**Where it is kept.** IndexedDB — the browser's own database — with a localStorage fallback for
browsers that block IndexedDB on `file://` pages. Nothing is uploaded. The window shows which store is
in use and how much space the bills take. If the browser refuses storage altogether (a sandboxed
preview frame, for instance) the app says so once and keeps working; download the file and open it
directly to keep a history. Deleting site data in the browser deletes the library, which is what
**Back up all** is for — keep the JSON with the project files.

A bill that is deleted while it is open — on its own, in a selection, or with **Delete all** — stays on screen but is no
longer tracked, so it cannot reappear a moment later; **Save this bill** puts it back. Deleting asks
first and says what will go: the plan picture, the quantities, the rates and the figures.

## The foot of every step

Step 1 is where the plan lives, and a bill is often started from a sheet that turns up later, or re-read
because the scale was wrong. So every step from 2 to 8 ends with a plain bar: **Go to upload**, and a line
saying what going back does not cost — *Everything you have typed stays: the rooms, the take-off, the rates
and the bill.*

Step 2 carries the same button inline when there is no plan to read — there it sits on its own line, a
clear 16 px above the building-type card, rather than butted against it. The numbered steps do not need it:
step 1 is a click away in the sidebar.

It is a move, not a reset. Pressing it lands on step 1 with the project exactly as it was; upload a better
sheet, re-set the scale, and the same rooms, corrections, rates and prices are still there when you walk
forward again. It is not printed — the bar carries `no-print`, so a bill or a schedule leaves it out.

## Light and dark

The header has a switch beside **Settings** — a sun and a moon. Press it and the whole app turns over:
the carbon-dark screen for measuring at night, the paper-white one for a bright room. The label says what the
press will do, not what you are in (*Dark* while you are in the light), and the icon matches.

Until you choose, the app follows the computer: if the operating system is set to dark, Quick Quantity opens
dark, and it keeps following the system if the system changes while the app is open. The moment you press the
switch your choice wins and is remembered — `plan2boq.theme` in this browser's storage, per device, not in the
bill. Clearing site data, or opening the file in a different browser, starts the app on the system's setting
again.

What it does not change:

- **Paper.** Printing, **PDF**, **Word** and **Excel** come out black on white whatever the screen is: a dark
  screen prints a white bill. The print stylesheet forces the light palette for the duration of the print.
- **The drawing.** The plan, the take-off canvas and the measured sheet stay white — a drawing is paper, and
  dimension lines read badly on charcoal.
- **The figures.** Nothing in the measurement, the rates, the bill or the material schedule moves.

Every screen and dialog was checked in both: all ten steps, the sign-in screen, Settings (every tab), the
summary panel, the saved-bills list and the selects — text keeps its contrast against whatever it sits on.
`tools/contrast.py` walks every visible piece of text on every step in both themes and reports anything below
a 3:1 contrast ratio, so a future change that forgets a colour is caught rather than shipped.

## Opened in a preview pane — and what that means

A page shown inside a sandboxed frame (the preview pane of a chat window or an editor) is given no
`localStorage`: every read throws `SecurityError`, and a page that asks for it at start-up comes up blank, or
comes up refusing the PIN. `src/store.js` runs before anything else, finds out, and puts a tab-long in-memory
store in its place, so the whole app still runs — every step, every figure, the take-off sheet's corrections,
the bill, the exports. What it cannot do is keep any of it after a reload, so the app says so once in a plain
note at the foot of the window — *Preview mode — this window gives the app no storage…* — and carries on.

The sign-in button and the first-run button are plain buttons wired to their own handlers, not submits, because
a sandboxed frame blocks form submission too; the keypad and Enter work either way.

To keep your work, open `index.html` from the download in a browser of its own (or serve the folder) — there it
is the normal app, with storage, saved bills and the service worker.

## Users — accounts, roles and the sign-in gate

Quick Quantity opens on a **sign-in screen**. A copy that has never been opened carries one account already
made — **Administrator, PIN `1234`** — so the app is usable the moment the file is opened; the sign-in
screen says so, and says it until that PIN is changed. From there everyone who uses this copy signs in
with their own account. Everything is on the device — no server, no email, no password reset over the
internet.

**The account this copy ships with.** *Administrator* is an ordinary administrator in every other way:
it owns every bill saved before accounts existed, it can add the other accounts, and it can be renamed,
given a new PIN, demoted once a second administrator exists, or deleted like any other account. Its one
peculiarity is the flag that puts the amber note on the sign-in screen: **change the PIN in *My profile
and PIN* and the note disappears** — from then on it is just the account you made your own.

| Role | What it can do |
|---|---|
| **Administrator** | Everything: every bill on the device, the users screen, all settings. |
| **QS (quantity surveyor)** | Measures, takes off, edits rates, exports — the bills it prepares. |
| **Contractor** | Prices and checks bills; edits rates and exports its own. |
| **Reviewer** | Read-only: opens any bill, prints and exports, changes nothing. |

**Where it lives.** The chip at the top right shows who is signed in (initials and first name).
It opens the user menu: *My profile and PIN*, *Manage users* (administrators only), *Switch user*,
*Sign out*. **Manage users** lists every account with its role, how many bills it owns and when it
last signed in, and offers *Add a user*, *Edit*, *Reset PIN* and *Delete*.

- **Adding a user** takes a name, firm, email, role and a 4–6 digit PIN. Two users cannot share a
  name. The PIN is stored as a salted SHA-256 hash, never as the digits.

**In the app.** The user chip at the top right opens the menu, and the second item is **Add a user** —
the name, firm, email, role and PIN form, straight away, with no hunting through a list first. It opens
the Users screen with the form already expanded; the same form is behind *Manage users → Add a user*.
Only an administrator sees either.

**Nothing is created from the sign-in screen.** The sign-in screen only lets somebody in; accounts are
made **inside the app**, by an administrator, from the user chip → *Add a user* (or *Manage users*).
The sign-in screen carries no *Add a user* button — somebody standing at a locked device cannot make
themselves an account, which is the point of the lock.
- **Reset PIN** is how a forgotten PIN is dealt with: an administrator sets a new one and the old
  one stops working at once. It is the only way back in — which is what "offline" means.
- **Delete** asks what should happen to the account's bills: hand them to the signed-in
  administrator, or delete them with the account. You cannot delete the account you are signed in
  with, and the last administrator cannot be removed or demoted.
- **My profile** edits your own name, firm, email and phone, and changes your own PIN (the current
  one is required).

**What a name and a PIN buy.** The account decides whose bills are on the shelf: a QS or a
contractor sees the bills it made, while an administrator and a reviewer see every bill on the
device, with its owner's name on each row. The **working bill** is kept separately per account, so
two people can be mid-bill on the same machine without overwriting each other.

**The bill carries the user.** The person signed in is stamped on the bill as *Prepared by
&lang;name&rang; · &lang;firm&rang; — &lang;role&rang;*, and their firm becomes the consultant on the
project particulars when that field is empty. It appears in the PDF and Word particulars.

**A reviewer's screen.** The read-only banner sits above every step, the model fields, rates,
quantities and take-off rows are disabled, and the editing buttons are switched off. Every one of
those controls is also guarded where it acts, so a disabled attribute is a courtesy, not the
security. Saved bills open, print and export as normal; delete and rename are hidden.

**If the note is still there.** Nobody has set a PIN of their own yet. Use the default PIN to get in,
then *My profile and PIN* — or, if the wrong person set it up, delete the account from *Manage users*
once another administrator exists.

**Sessions.** Signing in lasts for the browser tab; a reload keeps you in, a new tab starts locked
and asks for the PIN. *Switch user* and *Sign out* return to the lock screen. The last account used
is remembered so the PIN pad is one tap away.

**Honest limits.** This is a device lock, not encryption: it separates colleagues on a shared
machine and keeps each person's shelf tidy. It does not make the file unreadable to somebody who
has the file and developer tools, and it is not a substitute for a server-side system when several
people must collaborate over a network. Bills saved **before** accounts existed are handed to the
first administrator, who can move or delete them from the users screen.

## Current prices (optional online update)

The app is offline-first, but when a connection is available the **Update prices** button in the
header (also on the bill page, on the export page, and in **Settings → Pricing**) refreshes the rates
for the **country set on the Project tab** (Ghana by default). It never sends the drawing, the rooms
or the quantities. Three sources, tried in this order:

**1. AI price lookup (one click).** If an AI key is configured, the app asks a model — Gemini,
Claude or any OpenAI-compatible endpoint — for today's market rates in that country and applies
them. No feed to maintain, no URL to find. The model gets the list of rate names and current
values with the country and currency; it returns a JSON rate table which is validated (numbers
only, known keys, at least five rates) before anything is applied. The key is stored only in this
browser. Gemini keys are free at aistudio.google.com and work from a web page; Anthropic works from
the browser with its direct-access header; OpenAI keys are normally blocked for browser calls, so
use a local OpenAI-compatible server (Ollama, LM Studio) or your own proxy.

**2. A price feed (no key needed).** Put a URL in *Settings → Pricing → Price feed URL*. The app
fetches that JSON and applies the rates it contains:

```json
{
  "source": "Ampofo & Partners — Accra market survey",
  "date": "2026-10-01",
  "rates": { "block": 205.5, "rebar": 15.2, "roofSheet": 182 }
}
```

Only the keys in `rates` are changed, and only keys this bill uses — everything else keeps its
current value. Use **Download rate template** in the same tab to get a ready-made file with all
64 rate keys at their present values; fill in your own prices, host it anywhere (a web server, an
intranet share, a GitHub raw URL), and point the app at it.

**3. A currency index (no key, no feed, Ghana only).** With neither, the app fetches the USD → GHS
rate from exchangerate-api.com and indexes the built-in rates by **65% of the cedi's movement** — the
imported share of materials. The basis is the cedi on the day the rate card was compiled (*Settings →
Pricing → Rates compiled on*, 1 October 2026 by default), looked up from the same free currency
service; the `Cedi basis` field overrides it. The index is cumulative: the prices on the bill are
always *card × index*, so pressing the button twice does not apply the movement twice. The note on
the bill says exactly what happened, for example
*“Prices indexed -0.4% — US$1 = GH¢11.65 on 19 Oct 2026 against GH¢11.72 on 1 Oct 2026”*. The basis is
the cedi on the day the card was compiled — **Settings → Pricing → Rates compiled on**, 1 October 2026
by default — looked up from the same free service, so the first click already gives a real adjustment
rather than merely recording a baseline. The index is cumulative (prices = card × index), so pressing
the button twice does not apply the same movement twice.

Offline, the button says so and changes nothing. **Reset rates to Q4 2026 market** returns every
rate to the issued card, clears the index and any adopted build-ups (see *Rate build-up and price
analysis* above).

### The record of where the rates came from

Step 5, **Where the prices come from**, is the evidence page that goes with a tender. It names the
source (built-in card, price feed with its URL, AI check with its model, or cedi index), the country
and currency, the date the card was compiled, the index applied and how many priced rates the bill
carries. The same note is printed on the bill, on the PDF and Word cover pages, on the Excel summary
sheet, and the Excel workbook adds a third sheet, **Rates**, listing every priced item in the bill
with its unit, rate and amount in one place for a rate audit.

Only the rate request leaves the device — never the drawing, the rooms or the quantities.

## Rates

Q4 2026 Greater Accra market rates are built in (cement ≈ GH¢101/50 kg bag, 6-inch block ≈ GH¢8,
reinforcement ≈ GH¢9,800/t, aluminium long-span ≈ GH¢168/m², skilled daily rate ≈ GH¢200).
Press **Reset rates to Q4 2026 market** on the bill page at any time, or type over any rate —
totals, the summary and the amount in words all follow.

Rates are indicative. Verify against current supplier quotations before issuing a tender.
