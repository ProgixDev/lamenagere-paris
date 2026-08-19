# Configurateur cuisine 3D — handoff

Context for picking this up cold. Written 2026-08-14, at commit `89f17f6`.

---

## What it is

A 3D kitchen configurator inside the LA MÉNAGÈRE PARIS Expo app. It sits as one
step in the existing `configure` flow, just before the recap, and renders the
customer's kitchen from the answers they have already given.

**The load-bearing decision: there are no 3D models.** Every cabinet, appliance,
worktop, handle and tap is generated as parametric geometry in three.js from
millimetre dimensions.

Why this, and not GLBs:

- Cabinets come in 40/45/60/80/120 cm. Scaling one mesh to hit those widths
  fattens the 18 mm door panel and the poignée along with it. Generated geometry
  keeps panel thickness constant at any width.
- The customer's own measurements drive the geometry — a 95 cm worktop really is
  95 cm, and the carcass takes up the difference.
- Zero assets: no CDN, no cache, no app weight, works offline.
- A whole-kitchen model was tried and rejected (see "Rejected" below).

The only downloaded thing is three.js itself, bundled into the page at build
time. Nothing is fetched at runtime.

---

## Layout

```
lib/kitchen3d/
  types.ts          215  scene + config types, ilotFootprint()
  catalog.ts        248  19 modules at standard French dimensions
  scene.ts          432  buildScene(config) — pure, no three.js
  edit.ts           234  move / add / remove / swap / moveIlot — authoritative rules
  derive.ts         133  config blocks + answers  ->  KitchenConfig
  selection.ts       70  scene -> ConfigSelectionEntry (rides to cart + order)
  renderer-html.ts 1271  the whole three.js page, as one template literal
  three-bundle.ts   GEN  three + OrbitControls + RoomEnvironment (685 KB)

components/product/Kitchen3D.tsx   182  WebView host, injects the scene
app/(main)/configure/[id].tsx     1475  the flow; the studio lives here as a Modal
app/(main)/kitchen3d.tsx           257  standalone bench at route /kitchen3d
lib/configure-steps.ts             159  step order, visibleFields, hidden heights

scripts/build-three-bundle.mjs      npm run build:three
scripts/check-renderer-literal.mjs  npm run check:renderer   <- run after editing the renderer

server/src/modules/orders/orders.service.ts     sanitizeLayout()
server/src/modules/orders/sanitize-layout.spec.ts   176 lines, 22 specs
super_admin/src/components/OrderConfigView.tsx  606  the back-office plan
```

---

## Data flow

```
config blocks (Supabase, admin-managed)
   + the customer's answers (configState)
        |
        v  derive.ts  kitchenConfigFrom()
   KitchenConfig      { shapeKey, run1Cm.., roomLengthCm, colours, rotation }
        |
        v  scene.ts   buildScene()          <- pure, testable without a GPU
   KitchenScene       { room, runs[], ilot, decor, materials, geometry }
        |
        +--> Kitchen3D.tsx --> WebView --> renderer-html.ts   (what the customer sees)
        |
        +--> selection.ts --> ConfigSelectionEntry --> cart --> order
                                                          |
                                                          v
                                          sanitizeLayout() --> OrderConfigView (admin plan)
```

`buildScene` is pure and holds every layout rule. The renderer only draws. That
split is why the geometry is testable in Node with no browser, and why the
renderer could be replaced without touching the rules.

---

## Rules that hold the thing together

**A run is one-dimensional *inside itself*.** Cabinets sit side by side along
the run; the only question is whether they fit. No constraint solver — a move is
a clamp between two neighbours. This is what keeps `moveModule` a few dozen lines
and not a CAD engine.

**A run stands where the customer put it.** Each one carries `x`, `z` and its own
`rotationQuarters`, exactly as the island always has, and can be dragged anywhere
in the room. `Run.wall` survives only as the label on the devis and as the seed
`seedPlacement()` starts from — it is *not* a position. Anything that infers
space from a wall name is now wrong; that is what killed the old `moveIlot`
bounds, which reserved a strip along whichever walls "had" runs.

**Overlaps are flagged, not prevented.** `markOverlaps()` runs after every edit
and sets `overlaps` on each run and the island. Rearranging a U passes through a
dozen impossible states on the way to a good one, so refusing the drag reads as a
broken kitchen; the renderer outlines the offenders in red instead, and the flag
rides through to the order. This is the "afficher une alerte visuelle" half of
the brief's clause, chosen over the "empêcher" half.

**The kitchen is still laid out in its own frame and rotated as one piece.**
`rotationQuarters` (0-3, clockwise) turns the whole group; runs hold their
positions in that frame, and `roomToKitchen` / `kitchenToRoom` convert at the
edges — a drag arrives in the room's frame and has to be un-turned before it
means anything to a run. Consequences that bite:
- on an odd quarter the room's width and depth swap roles for the layout, so the
  minimum room size swaps with them (`canonWidth`/`canonDepth`), and so do the
  clamps in `moveRun`
- the island lives in the *room's* frame, so `markOverlaps` converts it inwards
  rather than converting three runs outwards
- `Wall` includes `"front"` — a run is never seeded there, but a turned kitchen
  can physically stand there

**Two nested groups per run in the renderer.** The outer one carries the
placement and the quarter turn; the inner one holds the cabinets at their
authored offsets, shifted back by half the footprint. That is what makes a run
pivot about its own centre instead of swinging round its corner — and it leaves
the inner local x still meaning "distance along the run", which every module
builder and the whole module-drag path depend on.

**Selection drills down; there is no mode.** One tap takes the whole side, a
second tap inside it takes the single cabinet, and tapping a different side
backs out to that side. Only cabinets are ever raycast — a run has no surface of
its own, and putting the pivots in `pickables` too cannot work, because the run
encloses its cabinets so the walk up to the nearest tagged ancestor always stops
at the cabinet. What the tap *means* is decided after the hit, from what is
already selected (`runOfKey`). This replaced a two-button mode toggle, which was
built first and rejected: the client wanted moving a side and moving its items to
be one flow, not two tools.

**Furnishing is scenery, and stays scenery.** `placeDecor()` grid-searches the
free floor for a table, chairs, a rug, a pendant and a picture. None of it is
pickable, none of it reaches `ConfiguredLayout`, and the shot only widens for it
up to `SCENERY_ROOM` (1.2x) — past that the dining set runs off the edge rather
than shrinking the cabinets, which are what is actually being sold. A frame is
built *inside* its wall's group so the wall-culling hides both together, and on
the wall's +z face — hung at -z it sits behind the plaster, invisible from every
angle and indistinguishable from not being drawn.

**The room is not the runs.** Wall measurements say how much cabinetry there is,
not how big the space is. `roomLengthCm`/`roomWidthCm` are separate inputs
(held in configure-screen state; no config block collects them). Default
5.00 x 4.00 m, never smaller than the kitchen standing in it. Conflating the two
made every render look cramped.

**A U's third arm attaches to the end of the back run**, not the far wall. Once
the room can be wider than the kitchen those are different places, and pinning it
to the wall leaves the arm stranded metres away — the U stops reading as a U.

**A return run anchors at its corner**, not stretched to fill its wall.

**Heights are fixed and hidden.** Ceiling 210 cm, worktop 90 cm — filtered out of
`visibleFields` so they vanish from every screen at once, but still seeded into
`configState`, because per-m² pricing bills `(sum of runs) x hauteur`. Changing
the ceiling changes what customers are charged.

**Cabinets fit whatever ceiling they are given.** The upstand above the worktop
closes first, then the cupboard shrinks — the order a real fitter works in.

---

## Traps that cost real time

**1. `renderer-html.ts` is one template literal.** A backtick anywhere inside it
— including in a comment — silently ends the string. Hit three times. Guarded now:
`npm run check:renderer`. Run it after editing that file.

**2. A material must not carry both `color` and `map`.** three multiplies them,
so the customer's hex gets applied twice (squared in linear space). `#9B6B43`
came out at a third of its brightness. It looked *exactly* like a lighting bug
and cost several rounds of tuning lights before an isolation probe ruled them
out. Textured materials take `color: 0xffffff`.

**3. `Box3.setFromObject` refreshes descendants but not ancestors.** The camera
framing collects cabinet corners before `root` joins the scene, so without an
explicit `root.updateMatrixWorld(true)` the rotated runs are measured unrotated
at the origin, and the shot frames a kitchen that is not there.

**4. `moveModule` bounds must come from where the cabinet *is*, not where it is
being dragged to.** Deriving them from the target position drops a neighbour you
have landed on out of the bounds entirely, and the cabinet parks straight through
it. The old overlap test never caught this because it only ever dragged to the
extremes.

**5. Test fixtures lie about drag bugs.** Three separate "drag is broken" reports
were the fixture: a wall unit on a run that travels into the screen, a run packed
to exactly its own length, an island too wide to move on one axis. Zero movement
was correct every time. Check whether the thing *can* move before believing a
failure.

**7. `sanitizeLayout`'s number clamp rejects negatives.** Run and island
positions are measured from the middle of the kitchen, so half of every valid
coordinate is below zero. Routed through `num()` they come back null and the
arrangement silently collapses into one corner by the time it reaches the
workshop. Positions use `signed()`. There is a spec for this.

**8. Puppeteer's `evaluateOnNewDocument` does not run for `setContent`.** Every
probe the harness installs that way is simply absent, and a poll that waits on
one fails open — so a screenshot looks fine and proves nothing. Write the page
to a file and `goto` it.

**6. Isolate before tuning.** See trap 2. The harness can inject probes
(`window.__env`, `window.__amb`, `window.__dist`) to change one variable at a
time in a live page.

---

## Testing

No browser is needed for the rules. `buildScene`/`edit.ts` are pure, so the logic
suites are plain Node scripts run through esbuild:

```
hidden-check  room-check  rotate-check  swap-check
edit-check    derive-check  ilot-check  ilot-move-check
```

`derive-check` runs against the **real production config blocks** copied out of
Supabase — that is what caught the trailing spaces in labels
(`"Couleur plan de travail "`) and the untagged worktop-height field.

For the renderer, headless Chrome via `puppeteer-core` against the installed
Chrome, with SwiftShader. It renders, screenshots, and drives synthetic pointer
events to test dragging. Note: SwiftShader is slow and frame-rate-variable —
tests must poll until the camera settles, never wait a fixed duration.

Server: 77 jest specs, 22 of them on `sanitizeLayout`.

---

## Current state

Shipped in commit `89f17f6` (local; **not pushed**). Android APK built from it.
TestFlight build 18 is older — it predates the studio.

Working: the guided flow with a 3D step, a preview that opens a full-screen
studio, move mode (drag along a run, drag-to-swap, remove, add from the library),
island drag + pivot, kitchen rotation, room sizing on the canvas, 19 modules
including glazed/LED doors and a gazinière,
reflections and procedurally tinted materials, and the back-office plan.

### Open

- **The server is not deployed.** `sanitizeLayout` re-attaches the layout to the
  order snapshot the way `PRODUCT_COLOR_BLOCK_ID` does — without it,
  `priceConfiguration` drops any entry with no real block behind it. Until it
  ships, layouts reach the cart but not the order, and the admin card is empty.
- **Pricing basis changed.** Ceiling fixed at 210 cm alters `(runs) x hauteur`.
  If customers were entering 250, this is ~16% cheaper. Client's call.
- **The module catalogue is hardcoded** in `catalog.ts`. Every field maps 1:1
  onto `ConfigBlockItem`, so moving it to an admin-managed block is a
  data-source swap, not a rewrite — `widthMm`/`depthMm`/`heightMm`/`slot` are the
  columns to add.
- **Never verified on real hardware** until the APK above. Touch handling through
  the WebView is the least-tested part.

### Rejected, with reasons

- **A downloaded kitchen model** (314 MB FBX). Its 742 textures pointed at the
  author's own drive and were missing, but the real objection is architectural: a
  fixed mesh cannot resize to the customer's walls, recolour to their choice, or
  gain a cabinet. It would turn a configurator back into a photograph. Individual
  props (tap, chair) are still worth sourcing.
- **In-scene drag gizmos.** A floor grip for resizing the room was built and
  rejected as bad UX. Controls belong as fixed buttons overlaid on the canvas,
  like the zoom pill.
- **Customer-facing per-module pricing.** The brief asks for it; the line is
  still priced by gamme and surface, and the module total rides along as a
  workshop reference only. Switching would change how every kitchen is billed.
