/* Harappa Explorer — walking, time travel, discoveries, notebook, places, main loop. */
(function () {
  'use strict';
  const H = window.H; if (!H || H.failed) return;
  const THREE = window.THREE, P = H.P, CY = P.CY, input = H.input;
  const $ = function (id) { return document.getElementById(id); };
  const app = $('app'), canvas = $('gl');
  const sfx = function (n) { if (H.sfx) H.sfx(n); };
  let started = false;

  // ---------- icons
  const IC = {
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.500 2"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>',
    book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="6.500" cy="18" r="2.500"/><circle cx="16.500" cy="16" r="2.500"/>',
    sound: '<path d="M4 10v4h4l5 4V6L8 10H4zM16 9a4 4 0 0 1 0 6M18.500 6.500a8 8 0 0 1 0 11"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.7.4-1 .9-1 1.700M12 17v.01"/>',
    star: '<path d="M12 3l2.700 5.600 6.100.8-4.500 4.200 1.200 6-5.500-3-5.500 3 1.200-6L3.200 9.400l6.100-.8z"/>',
    run: '<path d="M13 4.500a1.500 1.500 0 1 0 0-.01M7 21l3-6 3 2v4M10 15l1-5 4 2 3-1M11 10l-4 1-1 3"/>',
    play: '<path d="M7 4v16l13-8z"/>',
    way: '<circle cx="12" cy="12" r="9"/><path d="M15.500 8.500l-2 5-5 2 2-5z"/>'
  };
  const icon = function (n) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + IC[n] + '</svg>'; };

  // ---------- the discoveries. "now" is what you see in the ruins; "then" is the living city about 2500 BCE.
  const FIRST = 285;
  function nearestHouse(x, z, test) { let best = null, bd = 1e9; P.houses.forEach(function (h) { if (test && !test(h)) return; const d = Math.hypot(h.cx - x, h.cz - z); if (d < bd) { bd = d; best = h; } }); return best; }
  const hCourt = nearestHouse(312, 22, function (h) { return h.two; }), hWell = nearestHouse(262, -28, function (h) { return h.well; }), hBath = nearestHouse(318, -46, function (h) { return h.bath; });
  const hBead = nearestHouse(338, -78), hSeal = nearestHouse(236, 34), hGirl = nearestHouse(350, 74), hKing = nearestHouse(224, -72);
  P.props.push({ m: 'beads_bangles_weights', x: hBead.cx + 0.8, z: hBead.cz + 0.6, y: 0.08, size: 1.0, by: 'w', ry: 0.4, era: 'past', sink: 0 });
  P.props.push({ m: 'harappan_seals', x: hSeal.cx + 0.6, z: hSeal.cz - 0.5, y: 0.08, size: 0.75, by: 'h', ry: 2.2, era: 'past', sink: 0 });
  P.houses.forEach(function (h, i) { if (i % 23 === 5) P.props.push({ m: 'harappan_pottery', x: h.cx - 1.2, z: h.cz - 0.9, y: 0.08, size: 1.1, by: 'w', ry: i, era: 'past', sink: 0 }); });
  const SPOTS = [
    { id: 'bath', x: 0, z: 9.2, y: CY, title: 'The Great Bath',
      now: 'A brick tank 12 m long, 7 m wide and 2.4 m deep, with steps at both ends. It was dug out in 1925–26. Walk down the steps!',
      then: 'The bricks fit tightly and a layer of natural tar behind them keeps the water in. People probably bathed here on special days. Nobody knows for sure.' },
    { id: 'bathwell', x: 12.2, z: -4.6, y: CY, title: 'The well beside the bath',
      now: 'A deep brick well in a small room. It probably supplied at least some of the water for the Great Bath.',
      then: 'Water was probably lifted from this well and poured into the tank. Used water ran out through a big drain in one corner.' },
    { id: 'granary', x: -43, z: -19.2, y: CY, title: 'The great hall ("granary")',
      now: '27 solid brick blocks in three rows, with air channels between them. Early diggers called it a granary, but no grain was ever found here.',
      then: 'A large wooden hall probably stood on these blocks. What it was used for is still a mystery, so the wooden building you see is a careful guess.' },
    { id: 'hall', x: -0.2, z: 81, y: CY, title: 'The pillared hall',
      now: 'Rows of thick brick stumps are all that is left of a big hall about 27 m square.',
      then: '20 brick pillars in four rows held up the roof. It may have been a meeting place for the people who ran the city.' },
    { id: 'stupa', x: 56, z: 50.5, y: CY, title: 'The stupa mound',
      now: 'Most archaeologists think this round brick mound is a Buddhist stupa, built around 2,000 years after the Harappan city was abandoned, on top of its ruins.',
      then: 'Nobody knows what stood on this spot in Harappan times: the later stupa covers it. So it is shown here as an open court.' },
    { id: 'college', x: 21.4, z: -18, y: CY, title: 'The long building',
      now: 'A very large building, about 70 m long, with many rooms around a courtyard. It is often called the "College".',
      then: 'Important people may have lived or worked here. Harappan cities have no palaces or grand temples that we can recognise.' },
    { id: 'platform', x: 121, z: 0, y: 0, title: 'The citadel mound',
      now: 'The western part of the city stands on a huge platform of mud brick. Rain and wind have worn its sides into a mound.',
      then: 'Builders raised this whole area on a giant platform of mud brick, probably to keep it safe from floods. The biggest public buildings are up here.' },
    { id: 'found', x: 72, z: 6, y: CY, title: 'How the city was found', then: null,
      now: 'In 1922 the archaeologist R. D. Banerji began digging at the Buddhist stupa and realised that a far older city lay underneath. The modern name, Mohenjo-daro, means "Mound of the Dead". Nobody knows what its own people called it.' },
    { id: 'street', x: FIRST, z: 22, y: 0, title: 'First Street',
      now: 'The main street runs almost exactly north to south and is about 9 m wide. Side streets meet it at right angles.',
      then: 'The main streets run north to south and east to west, so the city was clearly planned, though it is not a perfect grid. Carts could pass each other easily on this street.' },
    { id: 'drain', x: FIRST - 4.0, z: -34, y: 0, title: 'The street drain',
      now: 'A brick-lined drain runs along the street. Waste water from most houses flowed into drains like this one.',
      then: 'The drains are covered with bricks or stone slabs. Some covers can be lifted so the drain can be cleaned. Few ancient cities had anything like it.' },
    { id: 'house', x: hCourt.cx + 1.5, z: hCourt.cz + 1.2, y: 0, title: 'A courtyard house',
      now: 'Rooms were arranged around an open courtyard. Thick walls and the remains of stairs show that many houses had an upper floor.',
      then: 'Family life happens in the courtyard: cooking, weaving, play. Doors open onto side lanes, not the main street, and there are few windows facing the street.' },
    { id: 'well', x: hWell.well[0] + 1.3, z: hWell.well[1], y: 0, title: 'A private well',
      now: 'Wells stand up like chimneys because the diggers removed the earth around them. The city had an estimated 700 wells.',
      then: 'Many houses have their own well, lined with wedge-shaped bricks so the ring holds firm. Others share a well in the street.' },
    { id: 'bathroom', x: hBath.bath[0] - 1.2, z: hBath.bath[1], y: 0, title: 'A bathing platform',
      now: 'A square of tightly laid bricks with a raised edge: a bathing floor. Most houses had one.',
      then: 'Water runs off the sloping floor, through a hole in the wall and into the street drain.' },
    { id: 'bricks', x: FIRST + 4.3, z: -58, y: 0, title: 'Bricks of one size',
      now: 'The city is built of baked bricks. Look closely: salt from the ground is slowly crumbling them. Salt, floods and heavy rain are the biggest dangers to the ruins today.',
      then: 'Almost every brick has the same proportions, 1 : 2 : 4. House bricks are about 7 × 14 × 28 cm. The same ratio was used in Harappan cities hundreds of kilometres apart.' },
    { id: 'kiln', x: 354, z: -139, y: 0, title: 'The potters', now: null,
      then: 'Potters shape jars on a wheel and bake them in kilns like these. Fine Harappan pots are red with designs painted in black. Smoky, fiery work like this was usually kept away from the main houses, though some kilns have been found inside the town too.' },
    { id: 'beads', x: hBead.cx, z: hBead.cz - 0.6, y: 0, title: 'The bead makers', now: null,
      then: 'Craftspeople here drill and polish beads of carnelian, a red stone. Making one long bead could take several days. Harappan beads have been found as far away as Mesopotamia (modern Iraq).' },
    { id: 'seals', x: hSeal.cx - 0.6, z: hSeal.cz + 0.4, y: 0, title: 'The seal cutters', now: null,
      then: 'Seals are small squares of soft stone, about 2–3 cm across (shown much bigger here), carved with an animal and a line of writing. The one-horned "unicorn" is the most common animal. Nobody has yet been able to read the script.' },
    { id: 'weights', x: FIRST + 2.4, z: -14.6, y: 0, title: 'Weights and trade', now: null,
      then: 'Traders weigh goods with small stone cubes. The smaller weights double each time: 1, 2, 4, 8, 16, 32, 64. The same system of weights was used in every Harappan city.' },
    { id: 'cart', x: FIRST - 0.6, z: 35, y: 0, title: 'An ox cart', now: null,
      then: 'Carts with solid wooden wheels are pulled by humped zebu oxen. We know their shape from little clay toy carts found in the houses.' },
    { id: 'river', x: 460, z: 6, y: 0, title: 'The river',
      now: 'The river Indus has shifted its course many times. Today it flows about 3 km to the east of the ruins.',
      then: 'Flat-bottomed boats with a small cabin carry goods on the river. A carving found in the city shows a boat like this. We are not sure exactly where the river ran then: it has moved many times and may have flowed on the other side of the city.' },
    { id: 'fields', x: 296, z: 147, y: 0, title: 'The fields', now: null,
      then: 'Farmers grow wheat, barley, peas and sesame. They also grow cotton: some of the oldest cotton cloth in the world was found in this city. (Wheat is a winter crop and cotton a summer crop. Here you see both at once.)' },
    { id: 'girl', x: hGirl.cx + 0.8, z: hGirl.cz, y: 0, title: 'The Dancing Girl',
      now: 'In 1926 a bronze figure only 10.5 cm tall was found in the lower town. Known as the "Dancing Girl", it is now in the National Museum in New Delhi.',
      then: 'Metal workers cast small figures in bronze using wax models, a method called lost-wax casting. The Dancing Girl was made this way about 4,000 to 4,500 years ago.' },
    { id: 'king', x: hKing.cx + 0.8, z: hKing.cz, y: 0, title: 'The "Priest-King"',
      now: 'A stone figure of a bearded man, 17.5 cm tall, was found in the lower town. People call it the "Priest-King", but nobody knows who he really was. It is in the National Museum of Pakistan in Karachi.',
      then: 'His robe has a three-leaf pattern and he wears a band around his head. He was carved near the end of the city’s life. We do not know if Harappan cities had kings, priests or councils.' },
    { id: 'end', x: 132, z: 58, y: 0, title: 'What happened to the city?', then: null,
      now: 'The great city grew up around 2600 BCE (people lived here even earlier). By about 1900 BCE it was slowly being abandoned. Shifting rivers, weaker monsoon rains and fading trade may all have played a part. Nobody is certain.' }
  ];
  H.spots = SPOTS;

  // ---------- saved progress
  function loadJ(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function saveJ(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  let S = loadJ('hx_save_v1') || {}; if (!S.seen) S.seen = {}; if (S.trips == null) S.trips = 0;
  const save = function () { saveJ('hx_save_v1', S); };
  const TOTAL = SPOTS.reduce(function (n, s) { return n + (s.now ? 1 : 0) + (s.then ? 1 : 0); }, 0);
  const seenCount = function () { return Object.keys(S.seen).length; };
  const RANKS = [[0, 'Visitor'], [4, 'Junior Explorer'], [12, 'Site Explorer'], [24, 'Archaeologist'], [TOTAL, 'Master Archaeologist']];
  function rank() { let r = RANKS[0][1]; const n = seenCount(); RANKS.forEach(function (q) { if (n >= q[0]) r = q[1]; }); return r; }

  // ---------- messages
  let toastTimer = 0;
  H.say = function (msg, ms) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, ms || 3500); };
  function overlayOpen() { return !$('places').hidden || !$('help').hidden || !$('notes').hidden || !$('start').hidden; }
  function closeOverlays() { let any = false; ['places', 'help', 'notes'].forEach(function (id) { if (!$(id).hidden) { $(id).hidden = true; any = true; } }); if (!$('menu').hidden) { $('menu').hidden = true; any = true; } if (!$('card').hidden) { $('card').hidden = true; any = true; } if (any) canvas.focus(); return any; }
  function openOverlay(id) { closeOverlays(); input.keys = {}; resetStick(); $(id).hidden = false; }

  // ---------- player
  const pl = H.player = { x: 126, z: 0, y: 0, yaw: Math.PI / 2, pitch: 0.06, bob: 0, speed: 0, stepPh: 0 };
  const key = function (c) { return input.keys[c] ? 1 : 0; };
  const tmp = { x: 0, z: 0 };
  function walk(dt) {
    const fwd = key('KeyW') + key('ArrowUp') - key('KeyS') - key('ArrowDown') - input.sy, turn = key('ArrowLeft') + key('KeyA') - key('ArrowRight') - key('KeyD') - input.sx;
    pl.yaw += turn * 1.7 * dt - input.mdx * 0.0032;
    pl.pitch = Math.max(-1.2, Math.min(1.2, pl.pitch - input.mdy * 0.0032));
    input.mdx = 0; input.mdy = 0;
    const run = key('ShiftLeft') || key('ShiftRight') || input.run, mag = Math.min(1, Math.abs(fwd)), spd = (run ? 11 : 6) * mag * (fwd < 0 ? 0.6 : 1);
    if (travel) { pl.speed = 0; return; }
    const sx = -Math.sin(pl.yaw), sz = -Math.cos(pl.yaw), d = spd * dt * Math.sign(fwd || 1);
    // move in small steps so thin walls cannot be skipped
    const n = Math.max(1, Math.ceil(Math.abs(d) / 0.25));
    for (let i = 0; i < n; i++) { tmp.x = pl.x + sx * d / n; tmp.z = pl.z + sz * d / n; H.collide(tmp, pl.y, 0.36); pl.x = tmp.x; pl.z = tmp.z; }
    pl.x = Math.max(H.bounds.x0, Math.min(H.bounds.x1, pl.x)); pl.z = Math.max(H.bounds.z0, Math.min(H.bounds.z1, pl.z));
    if (H.era > 0.5 && pl.x > P.river.x0 - 2) pl.x = P.river.x0 - 2; // the river bank
    const gy = H.groundY(pl.x, pl.z);
    pl.y += (gy - pl.y) * Math.min(1, dt * (gy > pl.y ? 14 : 9));
    pl.speed = spd;
    if (mag > 0.05) { pl.stepPh += dt * (run ? 13 : 8.5); const st = Math.floor(pl.stepPh / Math.PI); if (st !== pl.lastStep) { pl.lastStep = st; sfx('step'); } }
    pl.bob += ((mag > 0.05 ? 1 : 0) - pl.bob) * Math.min(1, dt * 8);
  }
  let freeCam = null;
  function placeCamera() {
    const c = H.camera;
    if (freeCam) { c.position.set(freeCam[0], freeCam[1], freeCam[2]); c.rotation.order = 'YXZ'; c.rotation.set(freeCam[4], freeCam[3], 0); return; }
    c.position.set(pl.x, pl.y + 1.62 + Math.sin(pl.stepPh * 2) * 0.035 * pl.bob, pl.z);
    c.rotation.order = 'YXZ'; c.rotation.set(pl.pitch, pl.yaw, 0);
  }
  H.goto = function (x, z, yaw, pitch) { pl.x = x; pl.z = z; pl.y = H.groundY(x, z); if (yaw != null) pl.yaw = yaw; pl.pitch = pitch == null ? 0 : pitch; tmp.x = pl.x; tmp.z = pl.z; H.collide(tmp, pl.y, 0.36); pl.x = tmp.x; pl.z = tmp.z; };

  // ---------- time travel
  let travel = null;
  const YEAR_NOW = new Date().getFullYear();
  function yearText(t) { const y = Math.round(YEAR_NOW + (-2500 - YEAR_NOW) * t); return y > 0 ? y + ' CE' : (-y) + ' BCE'; }
  H.travel = function () {
    if (travel || !started) return;
    travel = { t: 0, T: 4.2, from: H.era < 0.5 ? 0 : 1 }; travel.to = 1 - travel.from; H.setTrail(null);
    sfx('travel'); $('year').hidden = false; $('card').hidden = true; S.trips++; save(); actSig = '';
  };
  function stepTravel(dt) {
    if (!travel) return;
    travel.t += dt; const u = Math.min(1, travel.t / travel.T), e = u * u * (3 - 2 * u), t = travel.from + (travel.to - travel.from) * e;
    H.applyEra(t);
    $('year-n').textContent = yearText(t);
    H.camera.fov = (H.W / H.Hh < 1 ? 82 : 68) + 16 * Math.sin(Math.PI * u); H.camera.updateProjectionMatrix();
    if (u >= 1) {
      H.applyEra(travel.to); travel = null; H.camera.fov = H.W / H.Hh < 1 ? 82 : 68; H.camera.updateProjectionMatrix();
      for (let i = 0; i < 4; i++) { tmp.x = pl.x; tmp.z = pl.z; H.collide(tmp, pl.y, 0.36); pl.x = tmp.x; pl.z = tmp.z; }
      H.shadowsDirty(); setTimeout(function () { $('year').hidden = true; }, 1400); actSig = ''; updateHUD();
      if (guide) { const sp = guide.spot; stopGuide(); if (sp[eraKey()]) setTimeout(function () { startGuide(sp); }, 1800); }
      H.say(H.era > 0.5 ? 'You are in the living city, about 2500 BCE. Look around!' : 'Back to today. These are the ruins that archaeologists uncovered.', 5000);
    }
  }

  // ---------- discoveries
  function eraKey() { return H.era > 0.5 ? 'then' : 'now'; }
  function nearestSpot() { const k = eraKey(); let best = null, bd = 1e9; SPOTS.forEach(function (s) { if (!s[k] || Math.abs(s.y - pl.y) > 3) return; const d = Math.hypot(s.x - pl.x, s.z - pl.z); if (d < bd) { bd = d; best = s; } }); return best ? { s: best, d: bd } : null; }
  function lookAt(s) {
    const k = eraKey(), id = s.id + ':' + k, isNew = !S.seen[id];
    if (isNew) { const r0 = rank(); S.seen[id] = 1; save(); sfx(seenCount() === TOTAL ? 'done' : 'find'); const r1 = rank(); if (r1 !== r0) setTimeout(function () { H.say('★ New rank: ' + r1 + '!', 5000); sfx('done'); }, 900); }
    else sfx('open');
    const other = k === 'now' ? 'then' : 'now';
    $('card').innerHTML = '<div class="eyebrow">' + (k === 'now' ? 'Today · the ruins' : 'About 2500 BCE · the living city') + (isNew ? ' · new discovery' : '') + '</div><h3>' + s.title + '</h3><p>' + s[k] + '</p>' +
      (s[other] ? '<p class="note">' + (S.seen[s.id + ':' + other] ? 'You have also seen this place ' + (other === 'now' ? 'as a ruin.' : 'in the living city.') : 'Time travel to see this place ' + (other === 'now' ? 'as it looks today.' : 'as it was 4,500 years ago.')) + '</p>' : '') +
      '<div class="row"><button class="btn" id="card-x" type="button">Close</button>' + (s[other] ? '<button class="btn primary" id="card-t" type="button">' + icon('clock') + 'Time travel</button>' : '') + '</div>';
    $('card').hidden = false;
    $('card-x').addEventListener('click', function () { $('card').hidden = true; canvas.focus(); });
    const ct = $('card-t'); if (ct) ct.addEventListener('click', function () { $('card').hidden = true; H.travel(); });
    refreshProgress();
  }
  function refreshProgress() { $('st-prog').innerHTML = '<b>' + rank() + '</b> · ' + seenCount() + ' of ' + TOTAL + ' discoveries'; }

  // ---------- markers above the discoveries
  const marks = SPOTS.map(function (s) { const el = document.createElement('div'); el.className = 'mk'; el.hidden = true; el.innerHTML = '<span></span>'; $('markers').appendChild(el); return el; });
  const v3 = new THREE.Vector3();
  function updateMarkers() {
    const k = eraKey(), show = started && !overlayOpen() && !travel;
    for (let i = 0; i < SPOTS.length; i++) {
      const s = SPOTS[i], el = marks[i]; let vis = false;
      if (show && s[k]) {
        const d = Math.hypot(s.x - pl.x, s.z - pl.z);
        if (d < 90) {
          v3.set(s.x, s.y + 2.3, s.z).project(H.camera);
          if (v3.z < 1 && v3.z > -1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05) {
            el.style.transform = 'translate(' + ((v3.x * 0.5 + 0.5) * H.W).toFixed(1) + 'px,' + ((-v3.y * 0.5 + 0.5) * H.Hh).toFixed(1) + 'px)';
            const done = !!S.seen[s.id + ':' + k], txt = (d < 28 ? s.title : '') + (done ? ' ✓' : '');
            if (el.firstChild.textContent !== txt) el.firstChild.textContent = txt;
            el.classList.toggle('done', done); el.classList.toggle('near', d < 6); vis = true;
          }
        }
      }
      if (el.hidden === vis) el.hidden = !vis;
    }
  }

  // ---------- showing the way: a trail of dots on the ground leads to a discovery
  let guide = null;
  function unseenNearest() { const k = eraKey(); let best = null, bd = 1e9; SPOTS.forEach(function (s) { if (!s[k] || S.seen[s.id + ':' + k]) return; const d = Math.hypot(s.x - pl.x, s.z - pl.z); if (d < bd) { bd = d; best = s; } }); return best; }
  function startGuide(spot) {
    if (!spot) { H.say('You have found everything in this time. Try time travel!', 4500); return; }
    H.say('Finding the way to ' + spot.title + '…', 2500);
    setTimeout(function () {
      const p = H.findPath(pl.x, pl.z, spot.x, spot.z);
      if (!p) { guide = null; H.setTrail(null); H.say('I cannot find a way there from here. Try Places to jump closer.', 4500); refreshGuide(); return; }
      guide = { spot: spot, path: p, idx: 0, clock: 0 }; H.setTrail(p, 0, Math.hypot(spot.x - pl.x, spot.z - pl.z) > 14); sfx('open'); H.say('Follow the glowing dots to ' + spot.title + '.', 4000); refreshGuide(); actSig = '';
    }, 40);
  }
  function stopGuide() { guide = null; H.setTrail(null); refreshGuide(); actSig = ''; }
  function refreshGuide() {
    const el = $('guide'); if (!guide) { el.hidden = true; return; }
    const d = Math.hypot(guide.spot.x - pl.x, guide.spot.z - pl.z);
    el.hidden = false; el.innerHTML = icon('way') + '<span>' + guide.spot.title + ' · ' + Math.round(d) + ' m</span><b>✕</b>';
  }
  function stepGuide(dt) {
    if (!guide || travel) return;
    guide.clock += dt; if (guide.clock < 0.25) return; guide.clock = 0;
    const p = guide.path; let bi = guide.idx, bd = 1e9;
    for (let k = Math.max(0, guide.idx - 4); k < Math.min(p.length, guide.idx + 16); k++) { const d = Math.hypot(p[k][0] - pl.x, p[k][1] - pl.z); if (d < bd) { bd = d; bi = k; } }
    const ds = Math.hypot(guide.spot.x - pl.x, guide.spot.z - pl.z);
    guide.idx = bi; H.setTrail(p, Math.min(p.length - 1, bi + 1), ds > 14);
    if (ds < 4.5) { const t = guide.spot.title; stopGuide(); H.say('You are here: ' + t + '. Press Look closer!', 4000); sfx('find'); return; }
    if (bd > 7) { const sp = guide.spot; guide = null; startGuide(sp); return; } // wandered off: work out a new route
    refreshGuide();
  }
  $('guide').addEventListener('click', function () { sfx('click'); stopGuide(); });

  // ---------- maps: a small one in the corner and a big one in Places
  const MAP = { x0: -110, z0: -205, x1: 525, z1: 235, k: 2, base: {} };
  function baseMap() {
    const past = H.era > 0.5, key = past ? 'p' : 'r'; if (MAP.base[key]) return MAP.base[key];
    const c = document.createElement('canvas'), k = MAP.k; c.width = (MAP.x1 - MAP.x0) * k; c.height = (MAP.z1 - MAP.z0) * k;
    const g = c.getContext('2d'), X = function (x) { return (x - MAP.x0) * k; }, Z = function (z) { return (z - MAP.z0) * k; };
    g.fillStyle = past ? '#9fa868' : '#cfbb94'; g.fillRect(0, 0, c.width, c.height);
    if (past) { g.fillStyle = '#5b93a0'; g.fillRect(X(P.river.x0), 0, c.width, c.height); g.fillStyle = '#8a7a52'; P.fields.forEach(function (f) { g.fillRect(X(f.x0), Z(f.z0), (f.x1 - f.x0) * k, (f.z1 - f.z0) * k); }); }
    const C = P.citadel, T = P.town; g.fillStyle = past ? '#d9c39a' : '#c4ad84'; g.fillRect(X(C.x0), Z(C.z0), (C.x1 - C.x0) * k, (C.z1 - C.z0) * k);
    P.ramps.forEach(function (r) { g.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * k, (r.z1 - r.z0) * k); });
    g.fillStyle = past ? '#e2cfa6' : '#d8c6a0'; g.fillRect(X(T.x0 - 10), Z(T.z0 - 10), (T.x1 - T.x0 + 20) * k, (T.z1 - T.z0 + 20) * k);
    g.fillStyle = past ? '#c9b48a' : '#cdb991'; P.houses.forEach(function (h) { g.fillRect(X(h.x0), Z(h.z0), (h.x1 - h.x0) * k, (h.z1 - h.z0) * k); });
    g.fillStyle = past ? '#e8d9b4' : '#dccaa4'; P.houses.forEach(function (h) { g.fillRect(X(h.c[0]), Z(h.c[1]), (h.c[2] - h.c[0]) * k, (h.c[3] - h.c[1]) * k); });
    const B = P.bath; g.fillStyle = past ? '#4f8f99' : '#a58e6c'; g.fillRect(X(B.x0), Z(B.z0), (B.x1 - B.x0) * k, (B.z1 - B.z0) * k);
    g.strokeStyle = past ? '#8a4a2e' : '#8d7458'; g.lineCap = 'butt';
    P.walls.forEach(function (w) { if (w.y0 > 6 || (w.rh === 0)) return; g.lineWidth = Math.max(1, w.t * k); g.beginPath(); g.moveTo(X(w.x1), Z(w.z1)); g.lineTo(X(w.x2), Z(w.z2)); g.stroke(); });
    if (!past) { g.fillStyle = '#a5805e'; g.beginPath(); g.arc(X(P.stupa.x), Z(P.stupa.z), P.stupa.r * k, 0, 6.3); g.fill(); }
    return (MAP.base[key] = c);
  }
  function drawSpots(g, toX, toZ, size) {
    const k = eraKey();
    SPOTS.forEach(function (s) { if (!s[k]) return; const x = toX(s.x), y = toZ(s.z), done = S.seen[s.id + ':' + k]; g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillStyle = done ? '#9be08a' : '#ffb648'; g.strokeStyle = '#2a1802'; g.lineWidth = 1.5; g.fillRect(-size / 2, -size / 2, size, size); g.strokeRect(-size / 2, -size / 2, size, size); g.restore(); });
  }
  function drawMe(g, x, y, s) { g.save(); g.translate(x, y); g.rotate(-pl.yaw); g.fillStyle = '#fff'; g.strokeStyle = '#14100c'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.7, s * 0.8); g.lineTo(0, s * 0.35); g.lineTo(-s * 0.7, s * 0.8); g.closePath(); g.fill(); g.stroke(); g.restore(); }
  function drawPath(g, toX, toZ, wdt) { if (!guide) return; const p = guide.path; g.strokeStyle = '#ffb648'; g.lineWidth = wdt; g.lineJoin = 'round'; g.setLineDash([wdt * 1.5, wdt * 1.5]); g.beginPath(); for (let i = guide.idx; i < p.length; i++) { const x = toX(p[i][0]), y = toZ(p[i][1]); if (i === guide.idx) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); g.setLineDash([]); }
  const mini = $('mini'), mctx = mini.getContext('2d');
  function drawMini() {
    const size = mini.clientWidth, dpr = Math.min(2, window.devicePixelRatio || 1); if (!size) return;
    if (mini.width !== Math.round(size * dpr)) { mini.width = mini.height = Math.round(size * dpr); }
    const g = mctx, R = 62, sc = size / (2 * R), base = baseMap(), k = MAP.k; // R metres from the centre to the edge
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, size, size);
    g.save(); g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 1, 0, 6.3); g.clip();
    g.fillStyle = H.era > 0.5 ? '#9fa868' : '#cfbb94'; g.fillRect(0, 0, size, size);
    g.drawImage(base, (pl.x - R - MAP.x0) * k, (pl.z - R - MAP.z0) * k, 2 * R * k, 2 * R * k, 0, 0, size, size);
    const toX = function (x) { return (x - pl.x + R) * sc; }, toZ = function (z) { return (z - pl.z + R) * sc; };
    drawPath(g, toX, toZ, 3); drawSpots(g, toX, toZ, 8); drawMe(g, size / 2, size / 2, 8);
    g.restore();
    g.strokeStyle = 'rgba(240,214,170,.7)'; g.lineWidth = 2; g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 1, 0, 6.3); g.stroke();
    g.fillStyle = '#f8efdf'; g.font = '800 11px Nunito, sans-serif'; g.textAlign = 'center'; g.fillText('N', size / 2, 13);
  }
  // the big map (inside Places): tap a diamond to be shown the way there
  const big = $('bigmap'), bctx = big.getContext('2d'); let bigT = null;
  function drawBig() {
    const w = big.clientWidth, dpr = Math.min(2, window.devicePixelRatio || 1); if (!w) return;
    const h = Math.round(w * (MAP.z1 - MAP.z0) / (MAP.x1 - MAP.x0)); big.style.height = h + 'px';
    if (big.width !== Math.round(w * dpr) || big.height !== Math.round(h * dpr)) { big.width = Math.round(w * dpr); big.height = Math.round(h * dpr); }
    const g = bctx, sc = w / (MAP.x1 - MAP.x0); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.drawImage(baseMap(), 0, 0, w, h);
    const toX = function (x) { return (x - MAP.x0) * sc; }, toZ = function (z) { return (z - MAP.z0) * sc; };
    bigT = { toX: toX, toZ: toZ };
    drawPath(g, toX, toZ, 3); drawSpots(g, toX, toZ, 11); drawMe(g, toX(pl.x), toZ(pl.z), 10);
    g.fillStyle = '#14100c'; g.font = '800 12px Nunito, sans-serif'; g.textAlign = 'left';
    [['Citadel', -80, -92], ['Lower town', 165, -140], ['First Street', FIRST + 6, 132]].forEach(function (q) { g.fillText(q[0], toX(q[1]), toZ(q[2])); });
  }
  big.addEventListener('click', function (e) {
    if (!bigT) return; const r = big.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, k = eraKey();
    let best = null, bd = 26; SPOTS.forEach(function (s) { if (!s[k]) return; const d = Math.hypot(bigT.toX(s.x) - x, bigT.toZ(s.z) - y); if (d < bd) { bd = d; best = s; } });
    if (best) { closeOverlays(); startGuide(best); }
  });
  mini.addEventListener('click', function () { sfx('click'); openOverlay('places'); drawBig(); });

  // ---------- big buttons
  const ACT = {
    travel: { label: 'Time travel', icon: 'clock', key: 'T', fn: function () { H.travel(); } },
    look: { label: 'Look closer', icon: 'eye', key: 'E', fn: function () { const n = nearestSpot(); if (n && n.d < 6) lookAt(n.s); } },
    way: { label: 'Show the way', icon: 'way', key: 'G', fn: function () { if (guide) stopGuide(); else startGuide(unseenNearest()); } },
    run: { label: 'Run', icon: 'run', hold: 'run' }
  };
  let actSig = '';
  function updateActions() {
    const touch = app.classList.contains('touch'), n = nearestSpot(), near = n && n.d < 6 && !travel, top = [], hold = [];
    let primary = 'travel';
    if (near) { top.push('look'); if (!S.seen[n.s.id + ':' + eraKey()]) primary = 'look'; }
    if (!travel) { top.push('way'); top.push('travel'); }
    if (touch) hold.push('run');
    const tl = H.era > 0.5 ? 'Back to today' : 'Time travel';
    const sig = top.join(',') + '|' + primary + '|' + tl + '|' + touch + '|' + (near ? n.s.id : '') + '|' + (guide ? 1 : 0);
    if (sig === actSig) return; actSig = sig;
    const btn = function (id) { const a = ACT[id], lab = id === 'travel' ? tl : id === 'way' && guide ? 'Stop guiding' : a.label; if (a.hold) return '<button type="button" class="act round" data-hold="' + a.hold + '">' + icon(a.icon) + lab + '</button>'; return '<button type="button" class="act' + (id === primary ? ' primary' : '') + '" data-act="' + id + '">' + icon(a.icon) + lab + (a.key && !touch ? '<kbd>' + a.key + '</kbd>' : '') + '</button>'; };
    const ordered = top.filter(function (i) { return i !== primary; }); if (top.indexOf(primary) >= 0) ordered.push(primary);
    $('actions').innerHTML = '<div class="rowa">' + ordered.map(btn).join('') + '</div>' + (hold.length ? '<div class="rowa">' + hold.map(btn).join('') + '</div>' : '');
  }
  $('actions').addEventListener('click', function (e) { const t = e.target.closest('[data-act]'); if (!t) return; sfx('click'); ACT[t.getAttribute('data-act')].fn(); t.blur(); canvas.focus(); });
  function holdEvt(e, on) { const t = e.target.closest && e.target.closest('[data-hold]'); if (!t) return; e.preventDefault(); input[t.getAttribute('data-hold')] = on ? 1 : 0; t.classList.toggle('held', on); if (on && t.setPointerCapture) try { t.setPointerCapture(e.pointerId); } catch (err) {} }
  $('actions').addEventListener('pointerdown', function (e) { holdEvt(e, true); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) { $('actions').addEventListener(n, function (e) { holdEvt(e, false); }); });
  $('actions').addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // ---------- where am I
  const AREAS = [
    [function (x, z) { return Math.abs(x) < 17 && Math.abs(z) < 28; }, 'The Great Bath'], [function (x, z) { return x > -70 && x < -17 && z > -19 && z < 16.5; }, 'The great hall'],
    [function (x, z) { return x > -15 && x < 14 && z > 83 && z < 112; }, 'The pillared hall'], [function (x, z) { return x > 23 && x < 51 && z > -71 && z < 1; }, 'The long building'],
    [function (x, z) { const C = P.citadel; return x > C.x0 && x < C.x1 && z > C.z0 && z < C.z1; }, 'The citadel'],
    [function (x, z) { return Math.abs(x - FIRST) < 5 && Math.abs(z) < 135; }, 'First Street'], [function (x, z) { const T = P.town; return x > T.x0 - 6 && x < T.x1 + 6 && z > T.z0 - 6 && z < T.z1 + 6; }, 'The lower town'],
    [function (x, z) { return x > 440; }, 'By the river'], [function (x, z) { return z > 140 && x > 170 && x < 410; }, 'The fields'], [function (x, z) { return z < -128 && x > 335 && x < 375; }, 'The potters’ yard']
  ];
  function updateHUD() {
    let name = 'The plain';
    for (let i = 0; i < AREAS.length; i++) if (AREAS[i][0](pl.x, pl.z)) { name = AREAS[i][1]; break; }
    const past = H.era > 0.5;
    if (past && name === 'The plain') name = 'Outside the city';
    $('st-body').textContent = name;
    $('st-sub').textContent = travel ? 'Travelling through time…' : past ? 'Mohenjo-daro · about 2500 BCE' : 'Mohenjo-daro · today (ruins)';
    updateActions();
  }

  // ---------- places (jump to a landmark)
  const PLACES = [
    ['The Great Bath', 'Citadel', 0, 12.2, 0, -0.2], ['The great hall ("granary")', 'Citadel', -43, -23.5, Math.PI, -0.05], ['The pillared hall', 'Citadel', -0.2, 76.5, Math.PI, 0],
    ['The stupa mound', 'Citadel', 56, 55.5, 0, 0.12], ['The foot of the citadel', 'Between citadel and town', 126, 0, Math.PI / 2, 0.06],
    ['First Street', 'Lower town', FIRST, 27, 0, 0], ['A courtyard house', 'Lower town', hCourt.ex, hCourt.ez + (hCourt.side === 'n' ? -1.6 : 1.6), hCourt.side === 'n' ? Math.PI : 0, 0],
    ['The potters’ yard', 'North edge of town', 354, -134, 0, -0.05], ['The fields', 'South of town', 296, 143, Math.PI, 0], ['The river bank', 'East of town', 456, 6, -Math.PI / 2, 0]
  ];
  $('places-body').innerHTML = PLACES.map(function (p, i) { return '<button type="button" class="pl" data-i="' + i + '"><b>' + p[0] + '</b><span>' + p[1] + '</span></button>'; }).join('');
  $('places-body').addEventListener('click', function (e) { const t = e.target.closest('.pl'); if (!t) return; const p = PLACES[+t.getAttribute('data-i')]; closeOverlays(); sfx('open'); fade(function () { H.goto(p[2], p[3], p[4], p[5]); }); });
  function fade(fn) { const f = $('fade'); f.style.opacity = 1; setTimeout(function () { fn(); f.style.opacity = 0; }, 230); }

  // ---------- notebook
  function fillNotes() {
    $('notes-title').textContent = rank();
    let h = '<div class="xp"><i><u style="width:' + Math.round(seenCount() / TOTAL * 100) + '%"></u></i><span>' + seenCount() + ' of ' + TOTAL + ' discoveries</span></div>';
    h += '<p class="note">Each place can be discovered twice: once in the ruins and once in the living city. Use time travel to compare them.</p><div class="dl">';
    SPOTS.forEach(function (s) {
      const a = S.seen[s.id + ':now'], b = S.seen[s.id + ':then'];
      h += '<div class="d' + (a || b ? ' got' : '') + '"><h4>' + (a || b ? s.title : '? ? ?') + '</h4>' +
        (s.now ? '<p><em class="' + (a ? 'on' : '') + '">Today</em>' + (a ? s.now : 'Not found yet.') + '</p>' : '') + (s.then ? '<p><em class="' + (b ? 'on' : '') + '">2500 BCE</em>' + (b ? s.then : 'Not found yet.') + '</p>' : '') + '</div>';
    });
    h += '</div><div style="margin-top:14px"><button class="btn" id="notes-clear" type="button">Start again</button></div>';
    $('notes-body').innerHTML = h;
    let armed = false; $('notes-clear').addEventListener('click', function (e) { if (!armed) { armed = true; e.currentTarget.textContent = 'Tap again to erase your discoveries'; return; } S = { seen: {}, trips: 0 }; save(); refreshProgress(); fillNotes(); });
  }

  // ---------- input
  window.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const c = e.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(c) >= 0) e.preventDefault();
    if (!started) { if ((c === 'Enter' || c === 'Space') && !$('start-btn').disabled) begin(); return; }
    if (c === 'Escape') { closeOverlays(); return; }
    if (e.repeat) return;
    if (c === 'KeyM') { if ($('places').hidden) { openOverlay('places'); drawBig(); } else closeOverlays(); return; }
    if (c === 'KeyB' || c === 'KeyN') { if ($('notes').hidden) { openOverlay('notes'); fillNotes(); } else closeOverlays(); return; }
    if (c === 'KeyH') return $('help').hidden ? openOverlay('help') : closeOverlays();
    if (overlayOpen()) return;
    input.keys[c] = true;
    if (c === 'KeyT') H.travel();
    else if (c === 'KeyG') ACT.way.fn();
    else if (c === 'KeyE' || c === 'Enter') { if (!$('card').hidden) $('card').hidden = true; else ACT.look.fn(); }
  });
  window.addEventListener('keyup', function (e) { input.keys[e.code] = false; });
  window.addEventListener('blur', function () { input.keys = {}; input.run = 0; resetStick(); });
  function markTouch() { if (!app.classList.contains('touch')) { app.classList.add('touch'); actSig = ''; } }
  if (H.mobile || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)) markTouch();
  let lookId = null, lx = 0, ly = 0;
  canvas.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch') markTouch(); if (!started || lookId !== null) return; lookId = e.pointerId; lx = e.clientX; ly = e.clientY; canvas.focus(); if (!$('menu').hidden) $('menu').hidden = true; try { canvas.setPointerCapture(e.pointerId); } catch (err) {} });
  canvas.addEventListener('pointermove', function (e) { if (e.pointerId !== lookId) return; const k = e.pointerType === 'touch' ? 1.5 : 1; input.mdx += (e.clientX - lx) * k; input.mdy += (e.clientY - ly) * k; lx = e.clientX; ly = e.clientY; });
  ['pointerup', 'pointercancel'].forEach(function (n) { canvas.addEventListener(n, function (e) { if (e.pointerId === lookId) lookId = null; }); });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  const stick = $('stick'), knob = stick.querySelector('i'); let stickId = null;
  function resetStick() { stickId = null; input.sx = 0; input.sy = 0; knob.style.transform = ''; }
  function stickMove(e) { const r = stick.getBoundingClientRect(), R = r.width / 2; let dx = (e.clientX - (r.left + R)) / (R * 0.72), dy = (e.clientY - (r.top + R)) / (R * 0.72); const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } const dz = function (v) { return Math.abs(v) < 0.14 ? 0 : v; }; input.sx = dz(dx); input.sy = dz(dy); knob.style.transform = 'translate(' + (dx * R * 0.6).toFixed(1) + 'px,' + (dy * R * 0.6).toFixed(1) + 'px)'; }
  stick.addEventListener('pointerdown', function (e) { e.preventDefault(); markTouch(); stickId = e.pointerId; try { stick.setPointerCapture(e.pointerId); } catch (err) {} stickMove(e); });
  stick.addEventListener('pointermove', function (e) { if (e.pointerId === stickId) stickMove(e); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) { stick.addEventListener(n, function (e) { if (e.pointerId === stickId) resetStick(); }); });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

  function click(id, fn) { $(id).addEventListener('click', function (e) { sfx('click'); fn(e); if (e.currentTarget.blur) e.currentTarget.blur(); if (!overlayOpen()) canvas.focus(); }); }
  $('b-places').innerHTML = icon('map') + '<span>Places</span>'; $('b-notes').innerHTML = icon('book') + '<span>Notebook</span>'; $('b-more').innerHTML = icon('menu') + '<span>More</span>';
  click('b-places', function () { if ($('places').hidden) { openOverlay('places'); drawBig(); } else closeOverlays(); });
  click('b-notes', function () { if ($('notes').hidden) { openOverlay('notes'); fillNotes(); } else closeOverlays(); });
  click('b-more', function () { const m = $('menu'); m.hidden = !m.hidden; if (!m.hidden) fillMenu(); });
  click('places-close', closeOverlays); click('notes-close', closeOverlays); click('help-close', closeOverlays);
  click('m-music', function () { if (H.audio) { H.audio.start(); H.audio.setMusic(!H.audio.music); } fillMenu(); });
  click('m-sound', function () { if (H.audio) { H.audio.start(); H.audio.setSfx(!H.audio.sfx); } fillMenu(); });
  click('m-help', function () { openOverlay('help'); });
  const fsEl = document.documentElement, canFS = !!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen);
  click('m-full', function () { $('menu').hidden = true; try { if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else { const p = (fsEl.requestFullscreen || fsEl.webkitRequestFullscreen).call(fsEl); if (p && p.catch) p.catch(function () {}); } } catch (e) {} });
  function fillMenu() {
    $('m-music').innerHTML = icon('music') + (H.audio && H.audio.music ? 'Music: on' : 'Music: off'); $('m-sound').innerHTML = icon('sound') + (H.audio && H.audio.sfx ? 'Sound effects: on' : 'Sound effects: off');
    $('m-full').innerHTML = icon('full') + 'Full screen'; $('m-full').hidden = !canFS; $('m-help').innerHTML = icon('help') + 'How to play';
  }
  click('start-btn', begin);

  // ---------- start
  $('s1').insertAdjacentHTML('afterbegin', icon('eye')); $('s2').insertAdjacentHTML('afterbegin', icon('clock')); $('s3').insertAdjacentHTML('afterbegin', icon('star'));
  H.loadProps();
  const bootT = performance.now();
  (function check() {
    if ((H.frames > 6 && H.loading === 0) || performance.now() - bootT > 25000) { const b = $('start-btn'); b.disabled = false; b.innerHTML = icon('play') + 'Start exploring'; $('load').hidden = true; if (location.hash.indexOf('play') >= 0) begin(); return; }
    setTimeout(check, 200);
  })();
  $('start-note').textContent = app.classList.contains('touch') ? 'Left stick to walk, drag the screen to look around, big buttons on the right.' : 'Arrow keys or W A S D to walk, drag with the mouse to look, T to time travel.';
  function begin() {
    if (started) return; started = true; $('start').hidden = true; $('hud').hidden = false; canvas.focus();
    if (H.audio) H.audio.start(); fillMenu(); refreshProgress(); updateHUD();
    H.say('These are the ruins of Mohenjo-daro today. Press Time travel to see the city 4,500 years ago!', 9000);
  }
  H.begin = begin;
  H.debug = { view: function (x, y, z, yaw, pitch) { freeCam = x == null ? null : [x, y, z, yaw || 0, pitch || 0]; }, fps: function () { const f0 = H.frames, t0 = performance.now(); return new Promise(function (r) { setTimeout(function () { r(Math.round((H.frames - f0) / ((performance.now() - t0) / 1000))); }, 2000); }); }, era: function (t) { H.applyEra(t); H.shadowsDirty(); actSig = ''; }, save: function () { return S; } };

  // ---------- main loop
  let last = performance.now(), slow = 0, err = false, avg = 1 / 60, prClock = 0, upOK = 0, prLock = 0, lastUp = -1e9;
  H.frames = 0;
  function frame(now) {
    requestAnimationFrame(frame); if (err) return;
    let dt = (now - last) / 1000; last = now; if (!(dt > 0)) dt = 0.001; if (dt > 0.1) dt = 0.1;
    try {
      if (started && !overlayOpen()) walk(dt); else { input.mdx = 0; input.mdy = 0; }
      stepTravel(dt); stepGuide(dt); placeCamera();
      H.render(now / 1000, dt);
      updateMarkers();
      slow += dt; if (slow > 0.15 && started) { slow = 0; updateHUD(); if (!overlayOpen()) drawMini(); }
      avg += (dt - avg) * 0.08; prClock += dt;
      if (prClock > 0.6 && document.visibilityState !== 'hidden' && !travel) {
        prClock = 0;
        if (avg > 1 / 43) { H.setPixelRatio(H.pr * (avg > 1 / 26 ? 0.75 : 0.88)); upOK = 0; prLock = now + (now - lastUp < 20000 ? 120000 : 30000); }
        else if (avg < 1 / 57 && H.pr < H.maxPR && now > prLock) { if (++upOK >= 10) { upOK = 0; lastUp = now; H.setPixelRatio(H.pr * 1.1); } } else upOK = 0;
      }
      H.frames++;
    } catch (e) { err = true; H.error = String(e && e.stack || e); console.error(e); const f = $('fail'); f.hidden = false; f.textContent = 'Oops, the game hit an error and stopped: ' + (e && e.message || e); }
  }
  requestAnimationFrame(frame);
})();
