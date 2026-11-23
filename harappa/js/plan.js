/* Harappa Explorer — the city plan.
   A compact Mohenjo-daro: the raised citadel in the west (Great Bath, great hall / "granary", pillared hall, college)
   and a district of the lower town in the east (street grid, courtyard houses, wells, drains), with the Indus beyond.
   Units: metres. x = east, z = south (so north is -z), y = up. Everything is generated from a fixed seed, so the city is the same every time.
   Each wall has a full height (the living city, about 2500 BCE) and a ruin height (what the excavators found). */
(function () {
  'use strict';
  let seed = 20261112;
  const rnd = function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const rr = function (a, b) { return a + (b - a) * rnd(); };
  const CY = 5;                       // height of the citadel platform above the plain
  const P = { CY: CY, walls: [], slabs: [], piers: [], wells: [], props: [], doors: [], steps: [], colliders: [], houses: [], spots: [], jars: [], baskets: [], hearths: [], cloths: [], querns: [], stalls: [], windows: [], fences: [] };
  P.citadel = { x0: -88, x1: 80, z0: -86, z1: 128 };
  P.ramps = [{ x0: 80, x1: 106, z0: -7, z1: 7, axis: 'x', hi: 80, lo: 106 }, { x0: -8, x1: 8, z0: 128, z1: 154, axis: 'z', hi: 128, lo: 154 }];
  P.town = { x0: 160, x1: 404, z0: -124, z1: 124 };
  P.river = { x0: 470 };
  P.bath = { x0: -3.5, x1: 3.5, z0: -6, z1: 6, depth: 2.43, stair: 2.7, water: 1.85 };

  // ---------- primitives
  // wall from (x1,z1) to (x2,z2): t thick, h high above y0; p = how much survives as a ruin (0..1), rh = exact ruin height
  function wall(x1, z1, x2, z2, o) {
    o = o || {};
    const w = { x1: x1, z1: z1, x2: x2, z2: z2, t: o.t || 0.7, h: o.h || 3.4, y0: o.y0 || 0, p: o.p == null ? 0.35 : o.p, rh: o.rh, solid: o.solid !== false, tone: o.tone || 0, pl: o.pl || 0 };
    P.walls.push(w); return w;
  }
  // a wall with door gaps: doors = [[distance from the start to the door centre, width]]; a lintel wall bridges each gap in the living city
  function wallD(x1, z1, x2, z2, o, doors) {
    const L = Math.hypot(x2 - x1, z2 - z1), ux = (x2 - x1) / L, uz = (z2 - z1) / L;
    doors = (doors || []).slice().sort(function (a, b) { return a[0] - b[0]; });
    let s = 0;
    doors.forEach(function (d) {
      const a = d[0] - d[1] / 2, b = d[0] + d[1] / 2;
      if (a - s > 0.05) wall(x1 + ux * s, z1 + uz * s, x1 + ux * a, z1 + uz * a, o);
      const dh = Math.min(2.05, (o.h || 3.4) - 0.4);
      if (o.open) { s = b; return; } // a plain gap (the ramps up to the citadel)
      wall(x1 + ux * a, z1 + uz * a, x1 + ux * b, z1 + uz * b, Object.assign({}, o, { y0: (o.y0 || 0) + dh, h: (o.h || 3.4) - dh, rh: 0, solid: false }));
      P.doors.push({ x: x1 + ux * d[0], z: z1 + uz * d[0], ux: ux, uz: uz, w: d[1], h: dh, y0: o.y0 || 0, t: o.t || 0.7, leaf: !!d[2] });
      s = b;
    });
    if (L - s > 0.05) wall(x1 + ux * s, z1 + uz * s, x2, z2, o);
  }
  function rect(x0, z0, x1, z1, o, doors) { // four walls; doors = {n:[[d,w]], s:..., e:..., w:...} measured from the west / north end
    doors = doors || {};
    wallD(x0, z0, x1, z0, o, doors.n); wallD(x0, z1, x1, z1, o, doors.s); wallD(x0, z0, x0, z1, o, doors.w); wallD(x1, z0, x1, z1, o, doors.e);
  }
  // flat box: mat = pave | street | yard | mud | roof | wood | field | dark | earth | water ; era = both | past | ruin
  function slab(x0, z0, x1, z1, y, th, mat, era) { P.slabs.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), y: y, th: th, mat: mat, era: era || 'both' }); }
  function pier(x, z, sx, sz, h, y0, p) { P.piers.push({ x: x, z: z, sx: sx, sz: sz, h: h, y0: y0 || 0, p: p == null ? 0.35 : p }); }
  function well(x, z, y0, r, publicWell) { P.wells.push({ x: x, z: z, y0: y0 || 0, r: r || 0.75, pub: !!publicWell }); }
  function prop(m, x, z, size, o) { o = o || {}; P.props.push({ m: m, x: x, z: z, y: o.y || 0, size: size, by: o.by || 'h', ry: o.ry == null ? rr(0, 6.28) : o.ry, era: o.era || 'past', sink: o.sink || 0 }); }
  function spot(id, x, z, y, title, now, then, o) { P.spots.push(Object.assign({ id: id, x: x, z: z, y: y, title: title, now: now, then: then }, o || {})); }

  // =====================================================================  CITADEL
  const C = P.citadel;
  // retaining walls of the great mud-brick platform (slightly inside the edge so the top slab overlaps them)
  rect(C.x0, C.z0, C.x1, C.z1, { t: 2.2, h: CY + 0.9, p: 0.5, tone: 0.3, open: true }, { e: [[86, 14]], s: [[88, 16]] });
  // the top of the platform, with a hole left for the sunken tank of the Great Bath
  slab(C.x0 + 1, C.z0 + 1, -4.2, C.z1 - 1, CY, CY, 'yard'); slab(4.2, C.z0 + 1, C.x1 - 1, C.z1 - 1, CY, CY, 'yard'); slab(-4.2, C.z0 + 1, 4.2, -6.7, CY, CY, 'yard'); slab(-4.2, 6.7, 4.2, C.z1 - 1, CY, CY, 'yard');
  // ramps up to the citadel
  P.ramps.forEach(function (r) { P.steps.push(r); });

  // ---- Great Bath (centre at 0,0): tank, paved court, colonnade, rooms, well
  const B = P.bath, by = CY;
  // tank floor and the court around it
  slab(B.x0, B.z0, B.x1, B.z1, by - B.depth, 0.4, 'pave');
  slab(-9.5, -12.5, B.x0, 12.5, by + 0.02, 0.3, 'pave'); slab(B.x1, -12.5, 9.5, 12.5, by + 0.02, 0.3, 'pave');
  slab(B.x0, -12.5, B.x1, B.z0, by + 0.02, 0.3, 'pave'); slab(B.x0, B.z1, B.x1, 12.5, by + 0.02, 0.3, 'pave');
  // tank lining walls (their tops are level with the court)
  wall(B.x0 - 0.35, B.z0, B.x0 - 0.35, B.z1, { t: 0.7, h: B.depth, y0: by - B.depth, p: 1, solid: false, tone: -0.2 });
  wall(B.x1 + 0.35, B.z0, B.x1 + 0.35, B.z1, { t: 0.7, h: B.depth, y0: by - B.depth, p: 1, solid: false, tone: -0.2 });
  wall(B.x0 - 0.7, B.z0 - 0.35, B.x1 + 0.7, B.z0 - 0.35, { t: 0.7, h: B.depth, y0: by - B.depth, p: 1, solid: false, tone: -0.2 });
  wall(B.x0 - 0.7, B.z1 + 0.35, B.x1 + 0.7, B.z1 + 0.35, { t: 0.7, h: B.depth, y0: by - B.depth, p: 1, solid: false, tone: -0.2 });
  // stairs at the north and south ends: 9 treads each
  for (let i = 0; i < 9; i++) {
    const d = (i + 1) * B.depth / 10, run = B.stair / 9;
    P.slabs.push({ x0: -1.6, x1: 1.6, z0: B.z0 + i * run, z1: B.z0 + (i + 1) * run, y: by - d, th: B.depth - d + 0.4, mat: 'pave', era: 'both' });
    P.slabs.push({ x0: -1.6, x1: 1.6, z0: B.z1 - (i + 1) * run, z1: B.z1 - i * run, y: by - d, th: B.depth - d + 0.4, mat: 'pave', era: 'both' });
  }
  // a low ledge runs across the pool at the foot of each stair
  slab(B.x0, B.z0 + B.stair, B.x1, B.z0 + B.stair + 1.0, by - B.depth + 0.3, 0.3, 'pave'); slab(B.x0, B.z1 - B.stair - 1.0, B.x1, B.z1 - B.stair, by - B.depth + 0.3, 0.3, 'pave');
  // water (living city only)
  slab(B.x0, B.z0, B.x1, B.z1, by - B.depth + B.water, 0.02, 'water', 'past');
  // colonnade piers around the court and the veranda roof they carried
  for (let i = 0; i < 9; i++) { const z = -11.2 + i * 2.8; pier(-8.6, z, 0.9, 0.9, 3.3, by, 0.45); pier(8.6, z, 0.9, 0.9, 3.3, by, 0.45); }
  [-6.1, -3.2, 3.2, 6.1].forEach(function (x) { pier(x, -11.2, 0.9, 0.9, 3.3, by, 0.45); pier(x, 11.2, 0.9, 0.9, 3.3, by, 0.45); }); // the way to the steps is left clear
  slab(-9.6, -12.4, -7.2, 12.4, by + 3.3, 0.35, 'roof', 'past'); slab(7.2, -12.4, 9.6, 12.4, by + 3.3, 0.35, 'roof', 'past');
  slab(-7.2, -12.4, 7.2, -10.0, by + 3.3, 0.35, 'roof', 'past'); slab(-7.2, 10.0, 7.2, 12.4, by + 3.3, 0.35, 'roof', 'past');
  // outer building: 33 m x 55 m, entrances on the south, rooms along the east side
  rect(-16.5, -27.5, 16.5, 27.5, { t: 1.2, h: 4.6, y0: by, p: 0.5 }, { s: [[11, 1.8], [22, 1.8]], n: [[16.5, 1.6]] });
  rect(-10.2, -13.2, 10.2, 13.2, { t: 0.8, h: 4.2, y0: by, p: 0.5 }, { s: [[10.2, 2.2]], n: [[10.2, 2.2]], e: [[8.62, 1.2], [17.78, 1.2]], w: [[13.2, 1.6]] }); // east doors lead into the rooms, one of which holds the well
  for (let i = 1; i < 6; i++) wallD(10.6, -27.5 + i * 9.17, 16.5, -27.5 + i * 9.17, { t: 0.6, h: 4.2, y0: by, p: 0.45 }, []);
  wallD(10.6, -27.5, 10.6, -13.6, { t: 0.6, h: 4.2, y0: by, p: 0.45 }, [[4.6, 1.1]]); wallD(10.6, 13.6, 10.6, 27.5, { t: 0.6, h: 4.2, y0: by, p: 0.45 }, [[9.3, 1.1]]);
  slab(10.6, -27.5, 16.5, 27.5, by + 4.2, 0.35, 'roof', 'past'); slab(-16.5, -27.5, -10.2, 27.5, by + 4.2, 0.35, 'roof', 'past');
  slab(-10.2, -27.5, 10.6, -13.2, by + 4.2, 0.35, 'roof', 'past'); slab(-10.2, 13.2, 10.6, 27.5, by + 4.2, 0.35, 'roof', 'past');
  well(13.5, -4.6, by, 0.8);

  // ---- Great hall, long called the "granary": 27 brick blocks in three rows with air channels between them
  const gx = -68, gz = -12;                                                      // footprint about 50 m east-west by 27 m north-south
  for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) {
    const x0 = gx + c * 5.55, z0 = gz + r * 9.0;
    rect(x0, z0, x0 + 4.75, z0 + 8.2, { t: 0.9, h: 1.6, y0: by, p: 0.8, tone: 0.15 });
    slab(x0, z0, x0 + 4.75, z0 + 8.2, by + 1.5, 1.5, 'pave');
  }
  slab(gx - 1, gz - 5.5, gx + 50, gz - 0.6, by + 1.2, 1.2, 'pave');           // loading platform on the north side
  for (let c = 0; c < 10; c++) for (let r = 0; r < 4; r++) P.piers.push({ x: gx - 0.4 + c * 5.55, z: gz - 0.4 + r * 9.0, sx: 0.36, sz: 0.36, h: 4.2, y0: by + 1.5, p: 0, wood: true });
  slab(gx - 1.2, gz - 1.2, gx + 50.4, gz + 27.4, by + 5.7, 0.4, 'roof', 'past');

  // ---- College: a long building with a court, north-east of the bath
  rect(24, -70, 50, 0, { t: 1.0, h: 6.6, y0: by, p: 0.4 }, { w: [[52, 1.8]], s: [[13, 1.6]] });
  rect(32, -40, 42, -30, { t: 0.7, h: 6.2, y0: by, p: 0.4 }, { w: [[5, 1.4]], e: [[5, 1.4]], n: [[5, 1.4]], s: [[5, 1.4]] }); // courtyard about 10 m square
  [-60, -50, -18, -9].forEach(function (z) { wallD(24, z, 50, z, { t: 0.6, h: 6.2, y0: by, p: 0.35 }, [[13, 1.2]]); });
  wallD(37, -70, 37, -50, { t: 0.6, h: 6.2, y0: by, p: 0.35 }, [[5, 1.1], [15, 1.1]]);
  slab(24, -70, 50, -40, by + 6.2, 0.35, 'roof', 'past'); slab(24, -30, 50, 0, by + 6.2, 0.35, 'roof', 'past'); slab(24, -40, 32, -30, by + 6.2, 0.35, 'roof', 'past'); slab(42, -40, 50, -30, by + 6.2, 0.35, 'roof', 'past');
  slab(32, -40, 42, -30, by + 0.02, 0.2, 'pave');

  // ---- Pillared hall in the south: about 27.5 m square with 20 brick piers in four rows of five
  const hx = -14, hz = 84;
  rect(hx, hz, hx + 27.5, hz + 27.5, { t: 1.1, h: 5, y0: by, p: 0.3 }, { n: [[13.75, 2.4]], e: [[13.75, 1.8]] });
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) pier(hx + 4.2 + c * 4.8, hz + 5 + r * 5.8, 1.5, 0.9, 4.6, by, 0.3);
  slab(hx, hz, hx + 27.5, hz + 27.5, by + 4.6, 0.4, 'roof', 'past');
  slab(hx + 0.5, hz + 0.5, hx + 27, hz + 27, by + 0.02, 0.2, 'pave');

  // ---- other citadel buildings (plans simplified)
  function block(x0, z0, x1, z1, h, doorsS) {
    rect(x0, z0, x1, z1, { t: 0.9, h: h, y0: by, p: rr(0.25, 0.5) }, { s: [[(x1 - x0) / 2, 1.5]] });
    const mx = (x0 + x1) / 2 + rr(-2, 2), mz = (z0 + z1) / 2 + rr(-2, 2);
    wallD(mx, z0, mx, z1, { t: 0.6, h: h - 0.4, y0: by, p: 0.3 }, [[(mz - z0) / 2, 1.1], [(mz - z0) + (z1 - mz) / 2, 1.1]]);
    wallD(x0, mz, x1, mz, { t: 0.6, h: h - 0.4, y0: by, p: 0.3 }, [[(mx - x0) / 2, 1.1]]);
    slab(x0, z0, x1, z1, by + h - 0.4, 0.35, 'roof', 'past');
  }
  block(-76, -80, -52, -56, 4.4); block(-44, -78, -22, -54, 4.4); block(-12, -80, 14, -52, 4.6);          // north of the bath
  block(-70, 46, -44, 70, 4.4); block(-38, 52, -18, 72, 4.2); block(-78, 84, -52, 110, 4.6); block(-44, 88, -24, 108, 4.2); block(22, 78, 44, 100, 4.4); block(50, 92, 72, 112, 4.2); // south
  // the place where the stupa stands today: what was here in 2500 BCE is unknown, so it is left as an open court
  P.stupa = { x: 56, z: 34, r: 8.5 };
  slab(42, 20, 70, 48, by + 0.02, 0.2, 'pave', 'past');

  // =====================================================================  LOWER TOWN
  const T = P.town, FIRST = 285, CENTRAL = 0;      // First Street runs north-south, Central Street east-west
  slab(T.x0 - 10, T.z0 - 10, T.x1 + 10, T.z1 + 10, 0.04, 0.2, 'street');
  P.streets = [{ name: 'First Street', x0: FIRST - 4.6, x1: FIRST + 4.6, z0: T.z0 - 10, z1: T.z1 + 10 }, { name: 'Central Street', x0: T.x0 - 10, x1: T.x1 + 10, z0: CENTRAL - 3.4, z1: CENTRAL + 3.4 }];
  // street drains: a brick-lined channel along the west side of First Street and the north side of Central Street
  P.drains = [{ x0: FIRST - 4.3, x1: FIRST - 3.75, z0: T.z0 - 8, z1: T.z1 + 8, axis: 'z' }, { x0: T.x0 - 8, x1: T.x1 + 8, z0: CENTRAL - 3.15, z1: CENTRAL - 2.6, axis: 'x' }];

  function house(x0, z0, x1, z1, side, idx) {
    const two = rnd() < 0.55, hG = 3.3, H = two ? 6.5 : hG, par = 0.5, o = { t: two ? 0.85 : 0.7, h: H + par, p: rr(0.28, 0.85), tone: rr(-0.25, 0.25), pl: rnd() < 0.4 ? 1 : 0 };
    const w = x1 - x0, d = z1 - z0, nx = w > 12.5 ? 3 : 2, nz = d > 12.5 ? 3 : 2;
    const xs = [x0], zs = [z0];
    for (let i = 1; i < nx; i++) xs.push(x0 + w * (i / nx) + rr(-0.6, 0.6)); xs.push(x1);
    for (let j = 1; j < nz; j++) zs.push(z0 + d * (j / nz) + rr(-0.6, 0.6)); zs.push(z1);
    // courtyard: the middle cell if there is one, otherwise a cell on the far side from the door
    const ci = nx === 3 ? 1 : (rnd() < 0.5 ? 0 : 1), cj = nz === 3 ? 1 : (side === 'n' ? nz - 1 : 0);
    const isC = function (i, j) { return i === ci && j === cj; };
    // entrance: a cell on the lane side that is not the courtyard
    let ei = 0; for (let i = 0; i < nx; i++) if (!isC(i, side === 'n' ? 0 : nz - 1)) { ei = i; if (rnd() < 0.5) break; }
    const ej = side === 'n' ? 0 : nz - 1, ex = (xs[ei] + xs[ei + 1]) / 2;
    const dn = side === 'n' ? [[ex - x0, 1.15, 1]] : [], ds = side === 's' ? [[ex - x0, 1.15, 1]] : [];
    rect(x0, z0, x1, z1, o, { n: dn, s: ds });
    // interior walls with doors so that every room can be reached from the courtyard
    const io = { t: 0.45, h: H - 0.1, p: o.p * 0.8, tone: o.tone, pl: o.pl };
    const adjC = function (i, j) { return (Math.abs(i - ci) + Math.abs(j - cj)) === 1; };
    const need = {};
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) if (!isC(i, j) && !adjC(i, j)) need[i + ',' + j] = 1;
    for (let i = 1; i < nx; i++) for (let j = 0; j < nz; j++) { // walls between cell (i-1,j) and (i,j)
      let door = isC(i - 1, j) || isC(i, j);
      if (!door && need[(i - 1) + ',' + j] && adjC(i, j)) { door = true; delete need[(i - 1) + ',' + j]; }
      if (!door && need[i + ',' + j] && adjC(i - 1, j)) { door = true; delete need[i + ',' + j]; }
      wallD(xs[i], zs[j], xs[i], zs[j + 1], io, door ? [[(zs[j + 1] - zs[j]) / 2, 1.0]] : []);
    }
    for (let j = 1; j < nz; j++) for (let i = 0; i < nx; i++) {
      let door = isC(i, j - 1) || isC(i, j);
      if (!door && need[i + ',' + (j - 1)] && adjC(i, j)) { door = true; delete need[i + ',' + (j - 1)]; }
      if (!door && need[i + ',' + j] && adjC(i, j - 1)) { door = true; delete need[i + ',' + j]; }
      wallD(xs[i], zs[j], xs[i + 1], zs[j], io, door ? [[(xs[i + 1] - xs[i]) / 2, 1.0]] : []);
    }
    // floors, ceilings, roofs
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      if (isC(i, j)) { slab(xs[i], zs[j], xs[i + 1], zs[j + 1], 0.07, 0.2, 'pave'); continue; }
      slab(xs[i], zs[j], xs[i + 1], zs[j + 1], 0.06, 0.2, 'mud');
      slab(xs[i] - 0.2, zs[j] - 0.2, xs[i + 1] + 0.2, zs[j + 1] + 0.2, hG, 0.3, 'roof', 'past');
      if (two) slab(xs[i] - 0.2, zs[j] - 0.2, xs[i + 1] + 0.2, zs[j + 1] + 0.2, H, 0.3, 'roof', 'past');
    }
    const cx = (xs[ci] + xs[ci + 1]) / 2, cz = (zs[cj] + zs[cj + 1]) / 2;
    const h = { x0: x0, z0: z0, x1: x1, z1: z1, cx: cx, cz: cz, ex: ex, ez: side === 'n' ? z0 : z1, two: two, side: side, idx: idx, c: [xs[ci], zs[cj], xs[ci + 1], zs[cj + 1]] };
    // a brick stair in the courtyard, a well in about one house in three, a bathing platform in most
    const sx = xs[ci] + 0.5, sz = zs[cj] + 0.5;
    for (let k = 0; k < 9; k++) P.slabs.push({ x0: sx + k * 0.3, x1: sx + (k + 1) * 0.3, z0: sz, z1: sz + 0.9, y: (k + 1) * 0.33, th: (k + 1) * 0.33, mat: 'pave', era: k < 3 ? 'both' : 'past' });
    if (rnd() < 0.36) { h.well = [xs[ei] + 1.5, (zs[ej] + zs[ej + 1]) / 2 + (side === 'n' ? 0.6 : -0.6)]; well(h.well[0], h.well[1], 0, 0.62); }
    if (rnd() < 0.7) { const bx = xs[ci + 1] - 1.9, bz = zs[cj + 1] - 1.9; slab(bx, bz, bx + 1.5, bz + 1.5, 0.2, 0.2, 'pave'); h.bath = [bx + 0.75, bz + 0.75]; }
    P.houses.push(h); return h;
  }
  // blocks between the streets, cut into rows of houses by narrow lanes
  const xBands = [[T.x0, FIRST - 4.6], [FIRST + 4.6, T.x1]], zBands = [[T.z0, CENTRAL - 3.4], [CENTRAL + 3.4, T.z1]];
  let hi = 0;
  xBands.forEach(function (xb) { zBands.forEach(function (zb) {
    let z = zb[0], row = 0;
    while (z < zb[1] - 9) {
      let dep = rr(13.5, 18); if (zb[1] - (z + dep) < 11) dep = zb[1] - z;
      const side = row % 2 === 0 ? 's' : 'n';
      let x = xb[0];
      while (x < xb[1] - 8) {
        let wd = rr(10.5, 17.5); if (xb[1] - (x + wd) < 9) wd = xb[1] - x;
        house(x, z, x + wd, z + dep, side, hi++);
        x += wd;
        if (rnd() < 0.22 && xb[1] - x > 12) x += 2.0; // a cross lane
      }
      z += dep; if (side === 's') z += 2.4; row++;   // the lane the doors open onto
    }
  }); });
  // ---------- daily life (living city only)
  P.houses.forEach(function (h, i) {
    const c = h.c, cw = c[2] - c[0], cd = c[3] - c[1];
    // storage jars and a basket in the corner of the courtyard furthest from the stair and the bathing floor
    const nj = 2 + Math.floor(rnd() * 3);
    for (let k = 0; k < nj; k++) P.jars.push({ x: c[2] - 0.7 - (k % 2) * 0.75 - rnd() * 0.15, z: c[1] + 0.7 + Math.floor(k / 2) * 0.8 + rnd() * 0.15, y: 0.07, s: rr(0.75, 1.25) });
    if (rnd() < 0.6) P.baskets.push({ x: c[2] - 2.3, z: c[1] + 0.75, y: 0.07, s: rr(0.8, 1.1) });
    if (rnd() < 0.5 && cw > 3.6 && cd > 3.6) P.hearths.push({ x: c[0] + 1.3, z: c[3] - 1.3, y: 0.07 });
    if (rnd() < 0.35 && cw > 4.2) P.querns.push({ x: c[0] + 2.7, z: c[3] - 0.9, y: 0.07, ry: rnd() * 3 });
    if (rnd() < 0.4 && cw > 5) P.cloths.push({ x0: c[0] + 2.4, x1: c[2] - 1.6, z: (c[1] + c[3]) / 2 + rr(-0.4, 0.4), y: 0.07, n: cw > 6.5 ? 3 : 2, col: Math.floor(rnd() * 3) });
    // a small high window on the lane side, and one for the upper floor
    const wz = h.side === 'n' ? h.z0 : h.z1, wx = h.ex + (h.ex - h.x0 > (h.x1 - h.x0) / 2 ? -2.6 : 2.6);
    if (wx > h.x0 + 1 && wx < h.x1 - 1) { P.windows.push({ x: wx, z: wz, y: 2.45, side: h.side }); if (h.two) P.windows.push({ x: wx, z: wz, y: 5.5, side: h.side }); }
    if (h.well) { P.jars.push({ x: h.well[0] + 1.05, z: h.well[1] + 0.5, y: 0.07, s: 0.9 }); }
  });
  // stalls with a reed-mat shade along the two main streets (their look is imagined; trade in the streets is not)
  [[-96, 0], [-64, 1], [-40, 2], [44, 0], [70, 1], [98, 2]].forEach(function (q) { P.stalls.push({ x: FIRST + 3.45, z: q[0], axis: 'z', kind: q[1] }); });
  [[196, 0], [246, 2], [322, 1], [372, 0]].forEach(function (q) { P.stalls.push({ x: q[0], z: CENTRAL + 2.35, axis: 'x', kind: q[1] }); });
  P.stalls.forEach(function (st) {
    for (let k = 0; k < 4; k++) { const a = -0.75 + k * 0.5; P.jars.push({ x: st.axis === 'z' ? st.x + 0.25 : st.x + a, z: st.axis === 'z' ? st.z + a : st.z + 0.25, y: 0.05, s: rr(0.6, 1.0) }); }
    P.baskets.push({ x: st.axis === 'z' ? st.x - 0.35 : st.x + 0.55, z: st.axis === 'z' ? st.z + 0.55 : st.z - 0.35, y: 0.05, s: 1 });
    P.baskets.push({ x: st.axis === 'z' ? st.x - 0.35 : st.x - 0.5, z: st.axis === 'z' ? st.z - 0.5 : st.z - 0.35, y: 0.05, s: 0.85 });
  });
  // public wells at street corners
  well(FIRST + 3.4, CENTRAL + 5.4, 0, 0.9, true); well(FIRST - 3.0, -70, 0, 0.9, true); well(FIRST + 3.2, 78, 0, 0.9, true);

  // =====================================================================  OUTSIDE THE CITY
  // potters' yard on the northern edge (kilns stood away from the houses), fields to the south, the river to the east
  P.kilns = [[352, -146], [360, -141]];
  P.fields = [{ x0: 180, x1: 250, z0: 150, z1: 205, crop: 'wheat_crop' }, { x0: 262, x1: 330, z0: 150, z1: 205, crop: 'cotton' }, { x0: 342, x1: 400, z0: 150, z1: 205, crop: 'wheat_crop' }];
  P.fields.forEach(function (f) { slab(f.x0, f.z0, f.x1, f.z1, 0.03, 0.2, 'field', 'past'); });
  P.cart = [{ x: FIRST + 1.2, z: 34, ry: 0 }, { x: 428, z: 6, ry: Math.PI / 2 }, { x: FIRST - 1.4, z: -74, ry: Math.PI }, { x: 226, z: 1.0, ry: Math.PI / 2 }, { x: 352, z: -0.8, ry: -Math.PI / 2 }];
  P.boats = [{ x: 492, z: -20, ry: 0.25 }, { x: 500, z: 46, ry: -0.2 }];

  // a sheep pen beside the town, more animals, and trees along Central Street
  P.fences.push({ x0: 414, z0: 20, x1: 430, z1: 38 });
  [[418, 26, 1.1], [421, 34, 2.9], [425.5, 24.5, 4.4], [427, 31, 0.3], [423, 28.5, 5.3]].forEach(function (q, i) { prop('sheep_deccani', q[0], q[1], 0.7 + (i % 3) * 0.04, { ry: q[2] }); });
  [[300, -102, 1.0], [198, 62, 2.2], [372, 96, 4.0], [286, 118, 0.2]].forEach(function (q) { prop('dog_indian_pariah', q[0], q[1], 0.55, { ry: q[2] }); });
  [[408, -60, 0.6], [411, -55, 2.2], [174, 136, 3.4]].forEach(function (q, i) { prop(i === 1 ? 'calf_zebu' : 'bullock_kankrej', q[0], q[1], i === 1 ? 0.9 : 1.5, { ry: q[2] }); });
  [[466, 30, 0.4], [463, 62, 2.6]].forEach(function (q) { prop('water_buffalo', q[0], q[1], 1.35, { ry: q[2] }); });
  [[190, 2.3], [262, -2.4], [334, 2.3], [388, -2.3]].forEach(function (q, i) { prop(i % 2 ? 'babul' : 'peepal', q[0], q[1], i % 2 ? 7 : 10); });
  for (let i = 0; i < 6; i++) prop('haystack', 404 + (i % 3) * 5.5 + rr(-1, 1), -40 + Math.floor(i / 3) * 7 + rr(-1, 1), rr(2, 2.8));
  for (let i = 0; i < 5; i++) prop('firewood_stack', 340 + i * 7 + rr(-1, 1), -152 + rr(-1.5, 1.5), rr(1.1, 1.6));
  // ---- library models
  // living city
  [[FIRST - 3.2, -40], [FIRST + 3.4, 60], [FIRST - 3.3, 104], [230, -1.5], [350, 1.6]].forEach(function (q, i) { prop(i % 2 ? 'babul' : 'peepal', q[0], q[1], i % 2 ? 7.5 : 11, { era: 'past' }); });
  [[120, -40], [128, 52], [140, -96], [435, -70], [440, 96], [150, 170], [420, 150], [120, 120], [-120, -40], [-130, 70], [100, -170], [250, -190], [60, 190], [-60, 185], [470, 190], [-150, 150], [30, -150], [-110, -130]].forEach(function (q, i) { prop(['babul', 'peepal', 'khejri'][i % 3], q[0], q[1], [7, 11, 6.5][i % 3]); });
  prop('peepal', 56, 34, 12, { y: CY, era: 'past' });
  prop('harappan_pottery', 348.5, -138.5, 1.5, { by: 'w', ry: 0.6 }); prop('harappan_pottery', 356, -136.5, 1.3, { by: 'w', ry: 2.2 }); prop('firewood_stack', 364, -147, 1.5, { ry: 0.3 }); prop('firewood_stack', 346.5, -147.5, 1.3, { ry: 1.3 });
  prop('harappan_pottery', FIRST + 3.5, -18, 1.3, { by: 'w', ry: 1.6 }); prop('grains_and_pulses_bowls', FIRST + 3.5, -14.6, 1.0, { by: 'w', ry: 0.4 }); prop('harappan_pottery', FIRST - 3.0, 22, 1.2, { by: 'w', ry: 4 });
  prop('haystack', 414, 20, 2.6); prop('haystack', 172, 142, 2.4);
  prop('water_buffalo', 462, -34, 1.35, { ry: 1.2 }); prop('water_buffalo', 458, -28, 1.3, { ry: 2.0 });
  prop('sheep_deccani', 420, 30, 0.75, { ry: 0.4 }); prop('sheep_deccani', 422.5, 32, 0.72, { ry: 2.4 }); prop('sheep_deccani', 418.4, 33.5, 0.7, { ry: 4.2 });
  prop('dog_indian_pariah', FIRST - 2, -8, 0.55, { ry: 2.6 }); prop('dog_indian_pariah', 236, 2, 0.55, { ry: 0.8 });
  prop('calf_zebu', 416, 24, 0.9, { ry: 3 }); prop('bullock_kankrej', 410, 27, 1.5, { ry: 5.2 });
  for (let i = 0; i < 16; i++) prop('reeds', 468 + rr(-3, 6), -150 + i * 20 + rr(-6, 6), rr(2.2, 3.2), { sink: 0.1 });
  for (let i = 0; i < 22; i++) prop('green_shrub', i < 10 ? rr(110, 150) : rr(-170, 540), i < 10 ? rr(-150, 150) : (i % 2 ? 1 : -1) * rr(135, 230), rr(1.0, 1.8));
  for (let i = 0; i < 12; i++) prop('grass_tuft', rr(108, 152), rr(-140, 140), rr(0.5, 0.9));
  // the ruins today
  [[120, -30], [132, 70], [145, -110], [430, -60], [445, 80], [300, 160], [200, -160], [520, 10], [560, -90], [540, 120], [-120, 20], [-110, -100]].forEach(function (q, i) { prop(['khejri', 'babul', 'dead_dry_tree', 'babul'][i % 4], q[0], q[1], [6, 6.5, 5, 7][i % 4], { era: 'ruin' }); });
  for (let i = 0; i < 14; i++) prop('mud_mound', rr(-130, 560), (i % 2 ? 1 : -1) * rr(150, 230), rr(2.5, 5), { by: 'w', era: 'ruin', sink: 0.12 });
  for (let i = 0; i < 12; i++) prop('loose_stones', rr(160, 400), rr(-120, 120), rr(1.2, 2.2), { by: 'w', era: 'ruin', sink: 0.05 });
  [[120, 10], [136, -62], [430, 18], [446, -100], [424, 110], [-112, 60]].forEach(function (q) { prop('harappan_brick_ruin', q[0], q[1], rr(7, 10), { by: 'w', era: 'ruin', sink: 0.06 }); });
  for (let i = 0; i < 14; i++) prop('green_shrub', rr(100, 520), (i % 2 ? 1 : -1) * rr(130, 200), rr(0.8, 1.4), { era: 'ruin' });

  window.HPLAN = P;
})();
