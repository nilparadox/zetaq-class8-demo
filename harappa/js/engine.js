/* Harappa Explorer — engine: builds the city from the plan, renders it, and blends between the ruins (today)
   and the living city (about 2500 BCE). Every wall is stored at two heights; time travel morphs between them. */
(function () {
  'use strict';
  const THREE = window.THREE, P = window.HPLAN, CY = P.CY;
  const $ = function (id) { return document.getElementById(id); };
  const H = window.H = { era: 0, eraTarget: 0, P: P, ready: false, loading: 0, input: { keys: {}, mdx: 0, mdy: 0, sx: 0, sy: 0, run: 0 } };
  H.mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900) || /[?&#]mobile/.test(location.href);
  const canvas = $('gl');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !H.mobile, powerPreference: 'high-performance' }); }
  catch (e) { H.failed = true; $('fail').hidden = false; return; }
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.82;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  H.maxPR = Math.min(window.devicePixelRatio || 1, H.mobile ? 1.5 : 2); H.pr = H.maxPR; renderer.setPixelRatio(H.pr);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(70, 1, 0.12, 4000);
  H.renderer = renderer; H.scene = scene; H.camera = camera;
  function resize() {
    const w = $('app').clientWidth || window.innerWidth, h = $('app').clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 1 ? 82 : 68; camera.updateProjectionMatrix(); H.W = w; H.Hh = h;
  }
  window.addEventListener('resize', resize); resize();
  let prPending = false;
  H.setPixelRatio = function (pr) { pr = Math.max(0.6, Math.min(H.maxPR, pr)); if (Math.abs(pr - H.pr) < 0.01) return; H.pr = pr; prPending = true; };

  // ---------------------------------------------------------------- small maths
  const clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  const sstep = function (a, b, x) { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
  function hash2(x, z) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, z) { const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
    const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }

  // ---------------------------------------------------------------- textures (drawn in code)
  function canvasTex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = H.mobile ? 2 : 8; if (rep) t.repeat.set(rep, rep); return t; }
  function speckle(c, w, h, n, cols, a) { for (let i = 0; i < n; i++) { c.fillStyle = cols[i % cols.length]; c.globalAlpha = a * Math.random(); const s = 1 + Math.random() * 3; c.fillRect(Math.random() * w, Math.random() * h, s, s); } c.globalAlpha = 1; }
  // baked brick in the Harappan size ratio 1 : 2 : 4 (7 x 14 x 28 cm): one tile = four stretchers wide, eight courses high
  function brickDraw(base, mortar, flat) { return function (c, w, h) {
    c.fillStyle = mortar; c.fillRect(0, 0, w, h);
    const bh = h / 8, bw = w / 4;
    for (let r = 0; r < 8; r++) {
      const header = !flat && r % 2 === 1, n = header ? 8 : 4, ww = w / n, off = header ? 0 : (r % 4 === 0 ? 0 : ww / 2);
      for (let i = -1; i <= n; i++) {
        const k = 0.86 + 0.26 * Math.random(), g = 0.94 + 0.1 * Math.random();
        c.fillStyle = 'rgb(' + Math.round(base[0] * k) + ',' + Math.round(base[1] * k * g) + ',' + Math.round(base[2] * k * g) + ')';
        c.fillRect(i * ww + off + 1.5, r * bh + 1.5, ww - 3, bh - 3);
      }
    }
    speckle(c, w, h, 2600, ['#000', '#fff', '#5a3a22'], 0.07);
  }; }
  const TEX = {
    brick: canvasTex(512, 256, brickDraw([176, 104, 70], '#7f6a55')),
    bump: (function () { const t = canvasTex(512, 256, function (c, w, h) { c.fillStyle = '#404040'; c.fillRect(0, 0, w, h); const bh = h / 8; for (let r = 0; r < 8; r++) { const header = r % 2 === 1, n = header ? 8 : 4, ww = w / n, off = header ? 0 : (r % 4 === 0 ? 0 : ww / 2); for (let i = -1; i <= n; i++) { const v = 150 + Math.random() * 90; c.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; c.fillRect(i * ww + off + 2.5, r * bh + 2.5, ww - 5, bh - 5); } } }); t.encoding = THREE.LinearEncoding; return t; })(),
    pave: canvasTex(512, 512, function (c, w, h) { c.fillStyle = '#75604c'; c.fillRect(0, 0, w, h); const n = 8, s = w / n; for (let r = 0; r < n * 2; r++) for (let i = -1; i < n; i++) { const k = 0.82 + 0.3 * Math.random(); c.fillStyle = 'rgb(' + Math.round(168 * k) + ',' + Math.round(108 * k) + ',' + Math.round(78 * k) + ')'; c.fillRect(i * s + (r % 2 ? s / 2 : 0) + 1.5, r * s / 2 + 1.5, s - 3, s / 2 - 3); } speckle(c, w, h, 3000, ['#000', '#fff'], 0.06); }),
    earth: canvasTex(512, 512, function (c, w, h) { c.fillStyle = '#b89b72'; c.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { c.globalAlpha = 0.05 + 0.08 * Math.random(); c.fillStyle = ['#8f7450', '#d6bd94', '#a58a62', '#c9ae84'][i % 4]; const r = 12 + Math.random() * 60; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, r, 0, 6.3); c.fill(); } c.globalAlpha = 1; speckle(c, w, h, 9000, ['#6e5638', '#e6d3ae', '#8a7150'], 0.22); }),
    mud: canvasTex(512, 512, function (c, w, h) { c.fillStyle = '#c0a47c'; c.fillRect(0, 0, w, h); for (let i = 0; i < 180; i++) { c.globalAlpha = 0.05 + 0.06 * Math.random(); c.fillStyle = ['#a88b63', '#d4bc94', '#b79a72'][i % 3]; c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 70, 6 + Math.random() * 16, Math.random() * 3, 0, 6.3); c.fill(); } c.globalAlpha = 1; speckle(c, w, h, 5000, ['#8d7250', '#e2cfaa'], 0.16); }),
    wood: canvasTex(256, 256, function (c, w, h) { c.fillStyle = '#6b4a2e'; c.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { c.globalAlpha = 0.12 + 0.2 * Math.random(); c.fillStyle = ['#4f351f', '#86603c', '#3f2a18'][i % 3]; c.fillRect(0, Math.random() * h, w, 1 + Math.random() * 3); } c.globalAlpha = 1; }),
    field: canvasTex(256, 256, function (c, w, h) { c.fillStyle = '#7b5f3e'; c.fillRect(0, 0, w, h); for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#6a5033' : '#8b6d48'; c.fillRect(0, i * h / 16, w, h / 32); } speckle(c, w, h, 3000, ['#4d3a22', '#a58a60'], 0.2); })
  };
  const uT = { value: 0 };
  function std(o) { return new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.95, metalness: 0 }, o)); }
  const MAT = {
    brick: std({ map: TEX.brick, bumpMap: TEX.bump, bumpScale: 0.012, vertexColors: true, morphTargets: true }),
    pave: std({ map: TEX.pave, color: 0xe8ddd0 }), street: std({ map: TEX.earth, color: 0xe6dcc8 }), yard: std({ map: TEX.earth, color: 0xd9c7a6 }),
    mud: std({ map: TEX.mud, color: 0xe0d2b8 }), roof: std({ map: TEX.mud, color: 0xd6c2a0 }), wood: std({ map: TEX.wood, roughness: 0.85 }),
    field: std({ map: TEX.field }), dark: std({ color: 0x2c2620 }), earth: std({ map: TEX.earth, color: 0xcdb892 }),
    stone: std({ map: TEX.mud, color: 0x8f8b84 }),
    water: std({ color: 0x2c6a6e, roughness: 0.3, metalness: 0.0, transparent: true, opacity: 0.86 }), reed: std({ color: 0xc8b377, map: TEX.mud })
  };
  ['pave', 'street', 'yard', 'mud', 'field', 'dark'].forEach(function (k) { MAT[k].polygonOffset = true; MAT[k].polygonOffsetFactor = -1; MAT[k].polygonOffsetUnits = -6; });
  // walls: texture coordinates follow the real height (so bricks never stretch while a wall grows), and ruins are weathered and salt-crusted
  MAT.brick.onBeforeCompile = function (sh) {
    sh.uniforms.uT = uT;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aInfo;\nvarying vec3 vInfo;\nvarying float vHy;')
      .replace('#include <project_vertex>', 'vInfo = aInfo; vHy = transformed.y - aInfo.x;\n#ifdef USE_UV\n  vUv = abs(normal.y) > 0.5 ? transformed.xz * 0.893 : vec2(uv.x, transformed.y * 1.7857);\n#endif\n#include <project_vertex>');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uT;\nvarying vec3 vInfo;\nvarying float vHy;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n  { float ru = 1.0 - uT; float salt = (1.0 - smoothstep(0.05, 0.75, vHy)) * (0.25 + 0.75 * vInfo.y) + 0.06;\n    float g = dot(diffuseColor.rgb, vec3(0.3, 0.6, 0.1));\n    vec3 old = mix(diffuseColor.rgb, vec3(g * 1.12, g * 0.98, g * 0.8), 0.5) * vec3(0.92, 0.88, 0.82);\n    old = mix(old, vec3(0.78, 0.75, 0.70), salt * 0.8);\n    diffuseColor.rgb = mix(diffuseColor.rgb, old, ru);\n    float pl = vInfo.z * uT; // mud plaster over the brick on some houses\n    if (pl > 0.0) { float pn = dot(texture2D(map, vUv * 0.11).rgb, vec3(0.33)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.80, 0.69, 0.53) * (0.80 + 0.55 * pn), pl * 0.94); } }');
  };

  // ---------------------------------------------------------------- geometry accumulators
  function Geo(morph) { this.p = []; this.n = []; this.u = []; this.i = []; this.c = morph ? [] : null; this.m = morph ? [] : null; this.a = morph ? [] : null; this.count = 0; }
  // quad a-b-c-d (counter-clockwise seen from outside), normal n
  Geo.prototype.quad = function (a, b, c, d, n, ua, ub, uc, ud) {
    const k = this.count; this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]);
    for (let q = 0; q < 4; q++) this.n.push(n[0], n[1], n[2]);
    this.u.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1], ud[0], ud[1]);
    this.i.push(k, k + 1, k + 2, k, k + 2, k + 3); this.count += 4;
  };
  // axis-aligned or turned box; uv scale s (texture repeats per metre); bottom face optional
  Geo.prototype.box = function (cx, cy, cz, hx, hy, hz, yaw, s, bottom) {
    const co = Math.cos(yaw || 0), si = Math.sin(yaw || 0);
    const pt = function (x, y, z) { return [cx + x * co + z * si, cy + y, cz - x * si + z * co]; };
    const nv = function (x, z) { return [x * co + z * si, 0, -x * si + z * co]; };
    s = s || 0.5;
    const X = hx * 2 * s, Y = hy * 2 * s, Z = hz * 2 * s, ox = (cx + cz) * s, oy = cy * s;
    this.quad(pt(-hx, -hy, hz), pt(hx, -hy, hz), pt(hx, hy, hz), pt(-hx, hy, hz), nv(0, 1), [ox, oy], [ox + X, oy], [ox + X, oy + Y], [ox, oy + Y]);
    this.quad(pt(hx, -hy, -hz), pt(-hx, -hy, -hz), pt(-hx, hy, -hz), pt(hx, hy, -hz), nv(0, -1), [ox, oy], [ox + X, oy], [ox + X, oy + Y], [ox, oy + Y]);
    this.quad(pt(hx, -hy, hz), pt(hx, -hy, -hz), pt(hx, hy, -hz), pt(hx, hy, hz), nv(1, 0), [ox, oy], [ox + Z, oy], [ox + Z, oy + Y], [ox, oy + Y]);
    this.quad(pt(-hx, -hy, -hz), pt(-hx, -hy, hz), pt(-hx, hy, hz), pt(-hx, hy, -hz), nv(-1, 0), [ox, oy], [ox + Z, oy], [ox + Z, oy + Y], [ox, oy + Y]);
    const tx = cx * s, tz = cz * s;
    this.quad(pt(-hx, hy, hz), pt(hx, hy, hz), pt(hx, hy, -hz), pt(-hx, hy, -hz), [0, 1, 0], [tx - hx * s, tz + hz * s], [tx + hx * s, tz + hz * s], [tx + hx * s, tz - hz * s], [tx - hx * s, tz - hz * s]);
    if (bottom) this.quad(pt(-hx, -hy, -hz), pt(hx, -hy, -hz), pt(hx, -hy, hz), pt(-hx, -hy, hz), [0, -1, 0], [tx, tz], [tx + X, tz], [tx + X, tz + Z], [tx, tz + Z]);
  };
  Geo.prototype.mesh = function (mat, o) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    if (this.m) { g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.setAttribute('aInfo', new THREE.Float32BufferAttribute(this.a, 3)); g.morphAttributes.position = [new THREE.Float32BufferAttribute(this.m, 3)]; }
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.castShadow = !(o && o.noCast); m.userData.cast = m.castShadow; m.receiveShadow = true; m.frustumCulled = false; m.matrixAutoUpdate = false;
    return m;
  };

  // ---------------------------------------------------------------- walls (two heights each)
  const STEP = H.mobile ? 1.4 : 1.12;
  const wallGeo = new Geo(true);
  const colliders = []; // {x1,z1,x2,z2,t,y0,h, rh:Float32Array per column, n}
  function ruinHeight(w, x, z, j) {
    if (w.rh != null) return w.rh;
    if (w.p >= 0.99) return w.h;
    const big = vnoise(x * 0.03 + 11, z * 0.03 + 5), mid = vnoise(x * 0.2 + 3, z * 0.2 + 9), fine = hash2(x * 7.3 + j, z * 5.1 - j);
    let f = w.p * (0.3 + 1.4 * big) + (mid - 0.5) * 0.55 * w.p + (fine - 0.5) * 0.1;
    const cap = w.t > 1.5 ? w.h * 0.86 : Math.min(w.h, 4.4);
    let hgt = clamp(f * Math.min(w.h, 5.2), 0.1, cap);
    if (w.t > 1.5) hgt = Math.max(hgt, w.h * 0.3);
    return Math.round(hgt / 0.07) * 0.07;
  }
  function addWall(w, noCollide) {
    const L = Math.hypot(w.x2 - w.x1, w.z2 - w.z1); if (L < 0.02) return;
    const ux = (w.x2 - w.x1) / L, uz = (w.z2 - w.z1) / L, nx = -uz, nz = ux, ht = w.t / 2;
    const n = Math.max(1, Math.round(L / STEP)), rh = new Float32Array(n), g = wallGeo, uo = hash2(w.x1 * 3.1, w.z1 * 2.7) * 4;
    for (let j = 0; j < n; j++) { const s = (j + 0.5) / n * L; rh[j] = ruinHeight(w, w.x1 + ux * s, w.z1 + uz * s, j); }
    const tone = 1 + (w.tone || 0) * 0.14;
    for (let j = 0; j < n; j++) {
      const s0 = j / n * L, s1 = (j + 1) / n * L, y0 = w.y0, yf = w.y0 + w.h, yr = w.y0 + rh[j];
      const ax = w.x1 + ux * s0, az = w.z1 + uz * s0, bx = w.x1 + ux * s1, bz = w.z1 + uz * s1;
      const c = tone * (0.93 + 0.14 * hash2(ax * 9.1, az * 7.7)), rd = hash2(ax * 1.7 + 3, az * 2.9);
      const face = function (p0, p1, nrm, u0, u1) { // vertical face from p0 to p1 (bottom edge), rising to the wall top
        const k = g.count;
        g.p.push(p0[0], y0, p0[1], p1[0], y0, p1[1], p1[0], yf, p1[1], p0[0], yf, p0[1]);
        g.m.push(p0[0], y0, p0[1], p1[0], y0, p1[1], p1[0], yr, p1[1], p0[0], yr, p0[1]);
        for (let q = 0; q < 4; q++) { g.n.push(nrm[0], 0, nrm[1]); g.c.push(c, c, c); g.a.push(y0, rd, w.pl || 0); }
        g.u.push(u0, 0, u1, 0, u1, 1, u0, 1); g.i.push(k, k + 1, k + 2, k, k + 2, k + 3); g.count += 4;
      };
      const A0 = [ax + nx * ht, az + nz * ht], B0 = [bx + nx * ht, bz + nz * ht], A1 = [ax - nx * ht, az - nz * ht], B1 = [bx - nx * ht, bz - nz * ht];
      face(A0, B0, [nx, nz], (uo + s0) / 1.12, (uo + s1) / 1.12);
      face(B1, A1, [-nx, -nz], (uo + s1) / 1.12, (uo + s0) / 1.12);
      if (j === 0 || Math.abs(rh[j] - rh[j - 1]) > 0.01) face(A1, A0, [-ux, -uz], uo, uo + w.t / 1.12);
      if (j === n - 1 || Math.abs(rh[j] - rh[j + 1]) > 0.01) face(B0, B1, [ux, uz], uo, uo + w.t / 1.12);
      // top
      const k = g.count;
      g.p.push(A0[0], yf, A0[1], B0[0], yf, B0[1], B1[0], yf, B1[1], A1[0], yf, A1[1]);
      g.m.push(A0[0], yr, A0[1], B0[0], yr, B0[1], B1[0], yr, B1[1], A1[0], yr, A1[1]);
      for (let q = 0; q < 4; q++) { g.n.push(0, 1, 0); g.c.push(c * 1.04, c * 1.04, c * 1.04); g.a.push(y0, rd, w.pl || 0); }
      g.u.push(0, 0, 1, 0, 1, 1, 0, 1); g.i.push(k, k + 1, k + 2, k, k + 2, k + 3); g.count += 4;
      if (w.y0 > 0.5 && w.rh === 0) { // underside of a lintel
        const k2 = g.count;
        g.p.push(A1[0], y0, A1[1], B1[0], y0, B1[1], B0[0], y0, B0[1], A0[0], y0, A0[1]); g.m.push(A1[0], y0, A1[1], B1[0], y0, B1[1], B0[0], y0, B0[1], A0[0], y0, A0[1]);
        for (let q = 0; q < 4; q++) { g.n.push(0, -1, 0); g.c.push(c * 0.8, c * 0.8, c * 0.8); g.a.push(y0, rd, 0); }
        g.u.push(0, 0, 1, 0, 1, 1, 0, 1); g.i.push(k2, k2 + 1, k2 + 2, k2, k2 + 2, k2 + 3); g.count += 4;
      }
    }
    if (w.solid && !noCollide) colliders.push({ x1: w.x1, z1: w.z1, x2: w.x2, z2: w.z2, ux: ux, uz: uz, L: L, t: w.t, y0: w.y0, h: w.h, rh: rh, n: n });
  }
  P.walls.forEach(function (w) { addWall(w); });
  P.piers.forEach(function (q) { if (!q.wood) addWall({ x1: q.x, z1: q.z - q.sz / 2, x2: q.x, z2: q.z + q.sz / 2, t: q.sx, h: q.h, y0: q.y0, p: q.p, solid: true, tone: 0.1 }); });
  const circles = []; // round obstacles: wells
  P.wells.forEach(function (w, wi) {
    const N = 10, r = w.r + 0.16, ruin = w.pub ? 1.1 : 1.2 + 1.9 * hash2(wi * 13, wi * 7);
    for (let i = 0; i < N; i++) { const a0 = i / N * 6.2832, a1 = (i + 1) / N * 6.2832;
      addWall({ x1: w.x + Math.cos(a0) * r, z1: w.z + Math.sin(a0) * r, x2: w.x + Math.cos(a1) * r, z2: w.z + Math.sin(a1) * r, t: 0.3, h: 0.85, y0: w.y0, rh: ruin, solid: false, tone: -0.2 }, true); }
    circles.push({ x: w.x, z: w.z, r: w.r + 0.34 });
  });

  // ---------------------------------------------------------------- slabs, doors, drains, timber
  const buckets = {};
  const bucket = function (mat, era) { const k = mat + '|' + era; return buckets[k] || (buckets[k] = new Geo(false)); };
  const UVS = { pave: 0.5, street: 0.12, yard: 0.1, mud: 0.2, roof: 0.2, wood: 0.6, field: 0.25, dark: 1, earth: 0.08, water: 1, stone: 0.5, reed: 0.6 };
  P.slabs.forEach(function (s) {
    if (s.mat === 'water') return;
    bucket(s.mat, s.era).box((s.x0 + s.x1) / 2, s.y - s.th / 2, (s.z0 + s.z1) / 2, (s.x1 - s.x0) / 2, s.th / 2, (s.z1 - s.z0) / 2, 0, UVS[s.mat], s.y - s.th > 0.4);
  });
  // fallen bricks lying at the foot of the walls (ruins only)
  P.houses.forEach(function (h, i) {
    for (let k = 0; k < 2; k++) {
      const bx = h.x0 + 1 + hash2(i * 3 + k, 7) * (h.x1 - h.x0 - 2), bz = k ? h.z0 + 1.0 : h.z1 - 1.0;
      for (let q = 0; q < 7; q++) { const sz = 0.1 + 0.16 * hash2(i * 11 + q, k * 5 + 1); bucket('pave', 'ruin').box(bx + (hash2(q * 3 + i, k + 1) - 0.5) * 2.4, sz * 0.45, bz + (hash2(q * 7 + i, k + 9) - 0.5) * 1.3, sz * 1.7, sz * 0.5, sz * 0.85, hash2(q, i) * 3, 0.5); }
    }
  });
  // doors: a timber lintel over every doorway; street doors also get a frame and an open wooden leaf
  P.doors.forEach(function (d) {
    const yaw = Math.atan2(-d.uz, d.ux), g = bucket('wood', 'past');
    g.box(d.x, d.y0 + d.h + 0.02, d.z, d.w / 2 + 0.22, 0.09, d.t / 2 + 0.04, yaw, 0.6, true);
    if (d.leaf) {
      g.box(d.x - d.ux * (d.w / 2 - 0.05), d.y0 + d.h / 2, d.z - d.uz * (d.w / 2 - 0.05), 0.06, d.h / 2, d.t / 2 + 0.03, yaw, 0.6);
      g.box(d.x + d.ux * (d.w / 2 - 0.05), d.y0 + d.h / 2, d.z + d.uz * (d.w / 2 - 0.05), 0.06, d.h / 2, d.t / 2 + 0.03, yaw, 0.6);
      const hx = d.x - d.ux * d.w / 2, hz = d.z - d.uz * d.w / 2, a = yaw + 1.25, lw = d.w - 0.14;
      g.box(hx + Math.cos(a) * lw / 2, d.y0 + d.h / 2 - 0.03, hz - Math.sin(a) * lw / 2, lw / 2, d.h / 2 - 0.05, 0.03, a, 0.6);
    }
  });
  P.piers.forEach(function (q) { if (q.wood) bucket('wood', 'past').box(q.x, q.y0 + q.h / 2, q.z, q.sx / 2, q.h / 2, q.sz / 2, 0, 0.6); });
  // drains: a dark channel between two brick kerbs; in the living city it is covered with slabs, with a gap now and then for cleaning
  P.drains.forEach(function (d) {
    const len = d.axis === 'z' ? d.z1 - d.z0 : d.x1 - d.x0, wd = d.axis === 'z' ? d.x1 - d.x0 : d.z1 - d.z0;
    const add = function (g, a0, a1, o0, o1, y, th) { if (d.axis === 'z') g.box((d.x0 + o0 + d.x0 + o1) / 2, y - th / 2, (d.z0 + a0 + d.z0 + a1) / 2, (o1 - o0) / 2, th / 2, (a1 - a0) / 2, 0, 0.5); else g.box((d.x0 + a0 + d.x0 + a1) / 2, y - th / 2, (d.z0 + o0 + d.z0 + o1) / 2, (a1 - a0) / 2, th / 2, (o1 - o0) / 2, 0, 0.5); };
    add(bucket('dark', 'both'), 0, len, 0.12, wd - 0.12, 0.07, 0.06);
    add(bucket('pave', 'both'), 0, len, 0, 0.12, 0.13, 0.12); add(bucket('pave', 'both'), 0, len, wd - 0.12, wd, 0.13, 0.12);
    for (let a = 0, k = 0; a < len; a += 2.4, k++) if (k % 6 !== 4) add(bucket('pave', 'past'), a, Math.min(len, a + 2.36), 0.06, wd - 0.06, 0.15, 0.06);
  });

  // ---------------------------------------------------------------- daily life: the fixed pieces
  P.hearths.forEach(function (q) { // a ring of bricks around the ash
    for (let k = 0; k < 8; k++) { const a = k / 8 * 6.2832; bucket('pave', 'past').box(q.x + Math.cos(a) * 0.42, q.y + 0.06, q.z + Math.sin(a) * 0.42, 0.14, 0.06, 0.07, -a + 1.5708, 0.5); }
    bucket('dark', 'past').box(q.x, q.y + 0.025, q.z, 0.3, 0.025, 0.3, 0.6, 1);
  });
  P.querns.forEach(function (q) { bucket('stone', 'past').box(q.x, q.y + 0.07, q.z, 0.3, 0.07, 0.18, q.ry, 0.5); bucket('stone', 'past').box(q.x, q.y + 0.19, q.z, 0.08, 0.05, 0.2, q.ry, 0.5); });
  P.cloths.forEach(function (q) { [q.x0, q.x1].forEach(function (x) { bucket('wood', 'past').box(x, q.y + 0.95, q.z, 0.035, 0.95, 0.035, 0, 0.6); }); bucket('wood', 'past').box((q.x0 + q.x1) / 2, q.y + 1.86, q.z, (q.x1 - q.x0) / 2, 0.012, 0.012, 0, 0.6); });
  P.stalls.forEach(function (st) {
    const lx = st.axis === 'z' ? 0.8 : 1.2, lz = st.axis === 'z' ? 1.2 : 0.8;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) { bucket('wood', 'past').box(st.x + c[0] * lx, 1.1, st.z + c[1] * lz, 0.045, 1.1, 0.045, 0, 0.6); });
    bucket('reed', 'past').box(st.x, 2.24, st.z, lx + 0.28, 0.035, lz + 0.28, 0, 0.6, true);
    bucket('reed', 'past').box(st.x, 0.06, st.z, lx * 0.95, 0.012, lz * 0.95, 0, 0.6);
  });
  P.windows.forEach(function (wd) { // a small opening with a wooden grille
    const dz = wd.side === 'n' ? -1 : 1, z = wd.z + dz * 0.4, g = bucket('wood', 'past');
    bucket('dark', 'past').box(wd.x, wd.y, z, 0.3, 0.26, 0.06, 0, 1, true);
    g.box(wd.x, wd.y + 0.28, z + dz * 0.04, 0.36, 0.03, 0.05, 0, 0.6, true); g.box(wd.x, wd.y - 0.28, z + dz * 0.04, 0.36, 0.03, 0.05, 0, 0.6, true);
    for (let k = -1; k <= 1; k++) g.box(wd.x + k * 0.16, wd.y, z + dz * 0.045, 0.02, 0.26, 0.03, 0, 0.6, true);
  });
  P.fences.forEach(function (f) {
    const g = bucket('wood', 'past'), seg = function (ax, az, bx, bz) { const L = Math.hypot(bx - ax, bz - az), n = Math.round(L / 1.6), yaw = Math.atan2(-(bz - az), bx - ax); for (let i = 0; i <= n; i++) g.box(ax + (bx - ax) * i / n, 0.6, az + (bz - az) * i / n, 0.05, 0.6, 0.05, 0, 0.6); [0.45, 0.95].forEach(function (y) { g.box((ax + bx) / 2, y, (az + bz) / 2, L / 2, 0.03, 0.025, yaw, 0.6); }); };
    seg(f.x0, f.z0, f.x1, f.z0); seg(f.x1, f.z0, f.x1, f.z1); seg(f.x1, f.z1, f.x0, f.z1); seg(f.x0, f.z1, f.x0, f.z0 + 2.2);
  });

  // ---------------------------------------------------------------- scene objects
  const eraMeshes = { past: [], ruin: [] };
  function addMesh(m, era) { scene.add(m); if (era === 'past' || era === 'ruin') eraMeshes[era].push(m); return m; }
  const wallMesh = wallGeo.mesh(MAT.brick); wallMesh.morphTargetInfluences = [1]; scene.add(wallMesh);
  const eraMats = {};
  Object.keys(buckets).forEach(function (k) {
    const q = k.split('|'), mat = q[0], era = q[1]; let m = MAT[mat];
    if (era !== 'both') { m = eraMats[k] = MAT[mat].clone(); m.transparent = true; m.userData.era = era; }
    addMesh(buckets[k].mesh(m, { noCast: mat === 'street' || mat === 'yard' || mat === 'field' || mat === 'dark' }), era);
  });
  // ground
  const groundTex = TEX.earth.clone(); groundTex.needsUpdate = true; groundTex.repeat.set(220, 220);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), std({ map: groundTex, color: 0xd2bd98 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  // in 2500 BCE the city stood in a green river plain, not on bare dust: grass and scrub cover the ground outside the walls
  (function () {
    const tex = canvasTex(512, 512, function (c, w, h) { c.fillStyle = '#8f9a5a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 420; i++) { c.globalAlpha = 0.08 + 0.14 * Math.random(); c.fillStyle = ['#6f8442', '#a8a866', '#7d8f4c', '#b7a06c', '#5f7a3a'][i % 5]; const r = 8 + Math.random() * 46; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, r, 0, 6.3); c.fill(); } c.globalAlpha = 1; speckle(c, w, h, 12000, ['#4f6a2e', '#c2b47a', '#7f9450'], 0.3); }, 200);
    const mat = std({ map: tex, transparent: true, polygonOffset: true, polygonOffsetFactor: -0.5, polygonOffsetUnits: -2 }); mat.userData.era = 'past'; eraMats['grass'] = mat;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), mat); m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.receiveShadow = true; addMesh(m, 'past');
  })();
  // ramps up to the citadel
  (function () {
    const g = new Geo(false);
    P.ramps.forEach(function (r) {
      const s = 0.1;
      if (r.axis === 'x') {
        g.quad([r.hi, CY, r.z1], [r.lo, 0, r.z1], [r.lo, 0, r.z0], [r.hi, CY, r.z0], [0.2, 0.98, 0], [r.hi * s, r.z1 * s], [r.lo * s, r.z1 * s], [r.lo * s, r.z0 * s], [r.hi * s, r.z0 * s]);
        g.quad([r.hi, 0, r.z1], [r.lo, 0, r.z1], [r.lo, 0, r.z1], [r.hi, CY, r.z1], [0, 0, 1], [0, 0], [2, 0], [2, 0], [0, 1]);
        g.quad([r.lo, 0, r.z0], [r.hi, 0, r.z0], [r.hi, CY, r.z0], [r.lo, 0, r.z0], [0, 0, -1], [0, 0], [2, 0], [2, 1], [0, 0]);
      } else {
        const d = r.lo > r.hi ? 1 : -1;
        g.quad([r.x0, CY, r.hi], [r.x0, 0, r.lo], [r.x1, 0, r.lo], [r.x1, CY, r.hi], [0, 0.98, 0.2 * d], [r.x0 * s, r.hi * s], [r.x0 * s, r.lo * s], [r.x1 * s, r.lo * s], [r.x1 * s, r.hi * s]);
        g.quad([r.x1, 0, r.hi], [r.x1, 0, r.lo], [r.x1, 0, r.lo], [r.x1, CY, r.hi], [1, 0, 0], [0, 0], [2, 0], [2, 0], [0, 1]);
        g.quad([r.x0, 0, r.lo], [r.x0, 0, r.hi], [r.x0, CY, r.hi], [r.x0, 0, r.lo], [-1, 0, 0], [0, 0], [2, 0], [2, 1], [0, 0]);
      }
    });
    const m = g.mesh(MAT.yard); m.material = MAT.yard.clone(); m.material.side = THREE.DoubleSide; scene.add(m);
  })();
  // today the citadel is a mound: eroded earth slopes hide the lower part of the platform walls
  (function () {
    const g = new Geo(false), C = P.citadel, out = 20, top = CY * 0.62, s = 0.08;
    const side = function (ax, az, bx, bz, nx, nz) {
      const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 6);
      for (let i = 0; i < n; i++) {
        const x0 = ax + (bx - ax) * i / n, z0 = az + (bz - az) * i / n, x1 = ax + (bx - ax) * (i + 1) / n, z1 = az + (bz - az) * (i + 1) / n;
        const o0 = out * (0.7 + 0.6 * vnoise(x0 * 0.05, z0 * 0.05)), o1 = out * (0.7 + 0.6 * vnoise(x1 * 0.05, z1 * 0.05)), t0 = top * (0.75 + 0.5 * vnoise(x0 * 0.08 + 9, z0 * 0.08)), t1 = top * (0.75 + 0.5 * vnoise(x1 * 0.08 + 9, z1 * 0.08));
        g.quad([x1 + nx * o1, 0, z1 + nz * o1], [x0 + nx * o0, 0, z0 + nz * o0], [x0 - nx, t0, z0 - nz], [x1 - nx, t1, z1 - nz], [nx * 0.3, 0.95, nz * 0.3], [x0 * s, z0 * s], [x1 * s, z1 * s], [x1 * s, z1 * s + 1.4], [x0 * s, z0 * s + 1.4]);
      }
    };
    side(C.x0, C.z0, C.x1, C.z0, 0, -1); side(C.x1, C.z0, C.x1, C.z1, 1, 0); side(C.x1, C.z1, C.x0, C.z1, 0, 1); side(C.x0, C.z1, C.x0, C.z0, -1, 0);
    const mat = std({ map: groundTex, color: 0xc9b38c }); mat.transparent = true; mat.side = THREE.DoubleSide; mat.userData.era = 'ruin'; eraMats['skirt'] = mat;
    addMesh(g.mesh(mat, { noCast: true }), 'ruin');
  })();
  // the Buddhist stupa (built about 2,000 years after the city was abandoned): ruins only
  (function () {
    const S = P.stupa, g = new THREE.Group(), bm = std({ map: TEX.brick, color: 0xd8cbb8, transparent: true }); bm.userData.era = 'ruin'; eraMats['stupa'] = bm;
    const plat = new THREE.Mesh(new THREE.BoxGeometry(26, 2.2, 26), bm); plat.position.set(S.x, CY + 1.1, S.z); g.add(plat);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(S.r * 0.92, S.r, 5.4, 36), bm); drum.position.set(S.x, CY + 2.2 + 2.7, S.z); g.add(drum);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(S.r * 0.92, 28, 10, 0, 6.2832, 0, 1.1), bm); cap.scale.y = 0.32; cap.position.set(S.x, CY + 2.2 + 5.4 - 0.2, S.z); g.add(cap);
    for (let i = 0; i < 4; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(4, 0.36, 1.1), bm); st.position.set(S.x, CY + 0.2 + i * 0.44, S.z + 13.4 + (4 - i) * 0.55); g.add(st); }
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; const uv = o.geometry.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 14, uv.getY(k) * 6); } });
    addMesh(g, 'ruin'); H.stupaGroup = g;
    circles.push({ x: S.x, z: S.z, r: S.r + 0.3, era: 'ruin' });
  })();
  // water: the bath and the river
  const waterMeshes = [];
  P.slabs.forEach(function (s) { if (s.mat !== 'water') return; const m = new THREE.Mesh(new THREE.PlaneGeometry(s.x1 - s.x0, s.z1 - s.z0), MAT.water); m.rotation.x = -Math.PI / 2; m.position.set((s.x0 + s.x1) / 2, s.y, (s.z0 + s.z1) / 2); m.receiveShadow = true; scene.add(m); waterMeshes.push(m); });
  const river = new THREE.Mesh(new THREE.PlaneGeometry(1400, 3000), MAT.water); river.rotation.x = -Math.PI / 2; river.position.set(P.river.x0 + 700, 0.12, 0); scene.add(river); waterMeshes.push(river);
  const bank = new THREE.Mesh(new THREE.PlaneGeometry(14, 3000), std({ map: TEX.mud, color: 0x9c8562, transparent: true })); bank.rotation.x = -Math.PI / 2; bank.position.set(P.river.x0 - 5, 0.05, 0); bank.receiveShadow = true; bank.material.userData.era = 'past'; eraMats['bank'] = bank.material; addMesh(bank, 'past');

  // ---------------------------------------------------------------- things built in code: kilns, carts, boats
  const pastProps = [], ruinProps = [];
  function regProp(o, era) { o.userData.s0 = o.scale.clone(); (era === 'ruin' ? ruinProps : pastProps).push(o); scene.add(o); o.traverse(function (q) { if (q.isMesh) { q.castShadow = true; q.receiveShadow = true; } }); }
  P.kilns.forEach(function (k, i) {
    const g = new THREE.Group(), clay = std({ map: TEX.mud, color: 0xb98a62 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.5, 20, 12, 0, 6.2832, 0, 1.5708), clay); g.add(dome);
    const hole = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.3), MAT.dark); hole.position.set(0, 0.3, 1.42); g.add(hole);
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.3, 10), MAT.dark); vent.position.y = 1.5; g.add(vent);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.85, 0.3, 20), MAT.pave); base.position.y = 0.1; g.add(base);
    g.position.set(k[0], 0, k[1]); g.rotation.y = i * 1.3; regProp(g, 'past'); circles.push({ x: k[0], z: k[1], r: 1.9, era: 'past' });
  });
  function buildCart() {
    const g = new THREE.Group(), w = MAT.wood;
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 2.1), w); bed.position.y = 0.78; g.add(bed);
    [-1, 1].forEach(function (s) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.11, 22), w); wh.rotation.z = Math.PI / 2; wh.position.set(s * 0.82, 0.58, 0); g.add(wh);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.2, 10), MAT.dark); hub.rotation.z = Math.PI / 2; hub.position.set(s * 0.86, 0.58, 0); g.add(hub);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 2.1), w); rail.position.set(s * 0.62, 1.25, 0); g.add(rail);
      for (let i = 0; i < 4; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), w); st.position.set(s * 0.62, 1.03, -0.95 + i * 0.63); g.add(st); }
    });
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 8), w); axle.rotation.z = Math.PI / 2; axle.position.y = 0.58; g.add(axle);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 2.9), w); pole.position.set(0, 0.86, 2.4); pole.rotation.x = -0.06; g.add(pole);
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.1), w); yoke.position.set(0, 1.02, 3.75); g.add(yoke);
    return g;
  }
  P.cart.forEach(function (c) {
    const g = buildCart(); g.position.set(c.x, 0, c.z); g.rotation.y = c.ry; regProp(g, 'past'); circles.push({ x: c.x, z: c.z, r: 1.3, era: 'past' });
    const fx = Math.sin(c.ry), fz = Math.cos(c.ry);
    [-1, 1].forEach(function (s) { P.props.push({ m: 'bullock_kankrej', x: c.x + fx * 3.2 + fz * s * 0.55, z: c.z + fz * 3.2 - fx * s * 0.55, y: 0, size: 1.5, by: 'h', ry: c.ry, face: true, era: 'past', sink: 0 }); });
  });
  P.boats.forEach(function (b) {
    const g = new THREE.Group(), geo = new THREE.BoxGeometry(2.6, 0.9, 9.5, 2, 1, 8), pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const z = pos.getZ(i) / 4.75, k = 1 - 0.75 * Math.pow(Math.abs(z), 2.4), y = pos.getY(i); pos.setX(i, pos.getX(i) * k * (y < 0 ? 0.7 : 1)); pos.setY(i, y + 0.55 * Math.pow(Math.abs(z), 3)); }
    geo.computeVertexNormals();
    const hull = new THREE.Mesh(geo, MAT.wood); hull.position.y = 0.35; g.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.3, 2.4), MAT.reed); cabin.position.set(0, 1.4, -0.4); g.add(cabin);
    const croof = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 2.7), MAT.wood); croof.position.set(0, 2.1, -0.4); g.add(croof);
    [-0.5, 0.5].forEach(function (sx) { const oar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 4.2), MAT.wood); oar.position.set(sx, 1.3, -5.3); oar.rotation.x = 0.5; g.add(oar); const blade = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.9), MAT.wood); blade.position.set(sx, 0.4, -7.0); blade.rotation.x = 0.5; g.add(blade); });
    g.position.set(b.x, 0.05, b.z); g.rotation.y = b.ry; regProp(g, 'past');
  });

  // ---------------------------------------------------------------- daily life: jars, baskets, fires, smoke, drying cloth
  const life = { cloths: [], ember: null, smoke: null };
  (function () {
    const dm = new THREE.Object3D(), v2 = function (a) { return new THREE.Vector2(a[0], a[1]); };
    function instanced(geo, mat, list, key, fn, cast) {
      mat.transparent = true; mat.userData.era = 'past'; eraMats[key] = mat;
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach(function (q, i) { fn(q, i); dm.updateMatrix(); m.setMatrixAt(i, dm.matrix); });
      m.castShadow = cast !== false; m.userData.cast = m.castShadow; m.receiveShadow = true; m.frustumCulled = false; addMesh(m, 'past'); return m;
    }
    // storage jars: red-brown with bands painted in black
    const jarTex = canvasTex(64, 128, function (c, w, h) { c.fillStyle = '#b3613a'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a1a12'; c.fillRect(0, h * 0.27, w, 4); c.fillRect(0, h * 0.43, w, 4); c.lineWidth = 2; c.strokeStyle = '#2a1a12'; c.beginPath(); for (let x = 0; x <= w; x += 8) c.lineTo(x, h * (x % 16 ? 0.33 : 0.4)); c.stroke(); speckle(c, w, h, 300, ['#000', '#e8a070'], 0.12); });
    const jarGeo = new THREE.LatheGeometry([[0.001, 0], [0.16, 0], [0.3, 0.12], [0.36, 0.34], [0.33, 0.55], [0.2, 0.72], [0.14, 0.8], [0.19, 0.86], [0.17, 0.87], [0.12, 0.81]].map(v2), H.mobile ? 9 : 13);
    instanced(jarGeo, std({ map: jarTex, roughness: 0.8, side: THREE.DoubleSide }), P.jars, 'jars', function (q, i) { dm.position.set(q.x, q.y, q.z); dm.rotation.set(0, i * 1.7, 0); dm.scale.setScalar(q.s); });
    const bTex = canvasTex(64, 64, function (c, w, h) { c.fillStyle = '#b89a5e'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 6) { c.fillStyle = y % 12 ? '#9c7f48' : '#cfb478'; c.fillRect(0, y, w, 3); } for (let x = 0; x < w; x += 8) { c.fillStyle = 'rgba(70,50,20,.35)'; c.fillRect(x, 0, 2, h); } });
    const bGeo = new THREE.LatheGeometry([[0.001, 0], [0.26, 0], [0.4, 0.3], [0.43, 0.34], [0.39, 0.33], [0.26, 0.05], [0.001, 0.05]].map(v2), H.mobile ? 9 : 13);
    instanced(bGeo, std({ map: bTex, side: THREE.DoubleSide }), P.baskets, 'baskets', function (q, i) { dm.position.set(q.x, q.y, q.z); dm.rotation.set(0, i * 2.3, 0); dm.scale.setScalar(q.s); });
    // glowing embers in the hearths
    const eg = new THREE.CircleGeometry(0.2, 10); eg.rotateX(-Math.PI / 2);
    life.ember = instanced(eg, new THREE.MeshBasicMaterial({ color: 0xff7a2a }), P.hearths, 'ember', function (q) { dm.position.set(q.x, q.y + 0.06, q.z); dm.rotation.set(0, 0, 0); dm.scale.setScalar(1); }, false);
    // smoke from hearths and kilns
    const em = P.hearths.map(function (q) { return [q.x, q.y + 0.2, q.z, 3.6]; }).concat(P.kilns.map(function (k) { return [k[0], 1.7, k[1], 7.5]; }));
    const per = H.mobile ? 4 : 7, pos = [], inf = [];
    em.forEach(function (e, i) { for (let k = 0; k < per; k++) { pos.push(e[0], e[1], e[2]); inf.push(hash2(i * 7 + k, 3), 0.7 + 0.6 * hash2(i, k * 5 + 1), e[3]); } });
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute('aInf', new THREE.Float32BufferAttribute(inf, 3));
    const sm = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uFade: { value: 0 }, uPx: { value: 1 } }, transparent: true, depthWrite: false,
      vertexShader: 'attribute vec3 aInf; uniform float uTime; uniform float uPx; varying float vA;\nvoid main(){ float t = fract(uTime * 0.09 * aInf.y + aInf.x); vec3 p = position; p.y += t * aInf.z; p.x += (sin(t * 5.0 + aInf.x * 40.0) * 0.22 + 0.5) * t * aInf.z * 0.3; p.z += cos(t * 4.0 + aInf.x * 31.0) * 0.18 * t;\n  vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * (0.5 + 2.4 * t) * 420.0 / max(1.0, -mv.z); vA = sin(3.14159 * t) * (1.0 - 0.5 * t); }',
      fragmentShader: 'uniform float uFade; varying float vA;\nvoid main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d) * vA * 0.34 * uFade; gl_FragColor = vec4(vec3(0.83, 0.80, 0.76), a); }' });
    life.smoke = new THREE.Points(sg, sm); life.smoke.frustumCulled = false; life.smoke.renderOrder = 6; scene.add(life.smoke);
    // cloth drying on lines: undyed cotton and cloth dyed red with madder
    const cm = [0xe9dfc8, 0xa4442f, 0xcdb994].map(function (c, i) { const m = std({ color: c, map: TEX.mud, side: THREE.DoubleSide, roughness: 1 }); m.transparent = true; m.userData.era = 'past'; eraMats['cloth' + i] = m; return m; });
    const cg = new THREE.PlaneGeometry(0.95, 1.05); cg.translate(0, -0.55, 0);
    P.cloths.forEach(function (q, qi) { for (let k = 0; k < q.n; k++) { const g = new THREE.Group(), m = new THREE.Mesh(cg, cm[(q.col + k) % 3]); m.castShadow = true; m.userData.cast = true; g.add(m); g.position.set(q.x0 + (q.x1 - q.x0) * (k + 0.5) / q.n, q.y + 1.86, q.z); g.userData.ph = qi * 1.7 + k; addMesh(g, 'past'); life.cloths.push(g); } });
  })();

  // ---------------------------------------------------------------- library models
  const META = window.HMODELS || {};
  const FACE = { bullock_kankrej: -Math.PI / 2, calf_zebu: -Math.PI / 2, sheep_deccani: -Math.PI / 2, chicken_male_desi: -Math.PI / 2, water_buffalo: 0, dog_indian_pariah: 0 }; // turn so that the animal's nose points along +z before ry is applied
  function loadProps() {
    if (!THREE.GLTFLoader) return;
    const loader = new THREE.GLTFLoader(), byModel = {};
    P.props.forEach(function (q) { (byModel[q.m] = byModel[q.m] || []).push(q); });
    if (H.mobile) ['wheat_crop', 'cotton'].forEach(function (k) { if (byModel[k]) byModel[k] = byModel[k].filter(function (q, i) { return i % 2 === 0; }); });
    Object.keys(byModel).forEach(function (name) {
      const md = META[name]; if (!md) return;
      H.loading++;
      loader.load('models/' + name + '.json', function (gltf) { // glTF as JSON with its geometry embedded; the texture is an ordinary image beside it
        H.loading--;
        const src = gltf.scene, sz = [md.max[0] - md.min[0], md.max[1] - md.min[1], md.max[2] - md.min[2]];
        src.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) { o.material.roughness = 0.95; o.material.metalness = 0; if (md.alpha) { o.material.alphaTest = 0.5; o.material.transparent = false; } } } });
        byModel[name].forEach(function (q) {
          const o = src.clone(), k = q.size / (q.by === 'w' ? Math.max(sz[0], sz[2]) : sz[1]);
          const hold = new THREE.Group(); o.position.set(-(md.min[0] + md.max[0]) / 2, -md.min[1], -(md.min[2] + md.max[2]) / 2); if (FACE[name] != null) { const tw = new THREE.Group(); tw.rotation.y = FACE[name]; tw.add(o); hold.add(tw); } else hold.add(o);
          hold.scale.setScalar(k); hold.position.set(q.x, (q.y || 0) - (q.sink || 0) * q.size, q.z); hold.rotation.y = q.ry;
          regProp(hold, q.era); applyPropScale(hold, q.era);
        });
        shadowDirty = 2;
      }, undefined, function () { H.loading--; });
    });
  }
  // crops along the edges of the fields
  P.fields.forEach(function (f) { const n = Math.floor((f.x1 - f.x0) / 2.6); for (let r = 0; r < 2; r++) for (let i = 0; i < n; i++) P.props.push({ m: f.crop, x: f.x0 + 1.4 + i * 2.6 + hash2(i, r) * 0.6, z: f.z0 + 1.2 + r * 2.4, y: 0, size: f.crop === 'cotton' ? 1.2 : 1.05, by: 'h', ry: hash2(i * 3, r) * 6.28, era: 'past', sink: 0.04 }); });

  // ---------------------------------------------------------------- light, sky, fog
  const hemi = new THREE.HemisphereLight(0xfff4e0, 0x9c8562, 0.62); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.4); scene.add(sun); scene.add(sun.target);
  const SUN = new THREE.Vector3(0.52, 0.72, 0.46).normalize();
  sun.target.position.set(190, 0, 10); sun.position.copy(sun.target.position).addScaledVector(SUN, 700);
  sun.castShadow = true; sun.shadow.mapSize.set(H.mobile ? 2048 : 4096, H.mobile ? 2048 : 4096);
  const sc = sun.shadow.camera; sc.left = -430; sc.right = 430; sc.top = 330; sc.bottom = -330; sc.near = 50; sc.far = 1500; sc.updateProjectionMatrix();
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.35; sun.shadow.radius = 2.5;
  let shadowDirty = 2;
  scene.fog = new THREE.Fog(0xdccfb6, 150, 1500);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: SUN }, uGlow: { value: 0.5 } },
    vertexShader: 'varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0); gl_Position = p.xyww; }',
    fragmentShader: 'uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSun; uniform float uGlow; varying vec3 vD;\nvoid main(){ vec3 d = normalize(vD); float h = clamp(d.y, 0.0, 1.0); vec3 c = mix(uHor, uTop, pow(h, 0.55)); float s = max(dot(d, uSun), 0.0); c += vec3(1.0, 0.86, 0.62) * (pow(s, 600.0) * 3.0 + pow(s, 12.0) * 0.28 * uGlow); c = mix(c, uHor * 0.92, smoothstep(0.0, -0.12, d.y)); gl_FragColor = vec4(c, 1.0); }',
    side: THREE.BackSide, depthWrite: false, fog: false
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), skyMat); sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);
  const LOOK = { // [ruins today, living city]
    top: [new THREE.Color(0x86a9cf), new THREE.Color(0x4f8fd0)], hor: [new THREE.Color(0xe6dac4), new THREE.Color(0xf2dfbd)], fog: [new THREE.Color(0xd9cdb6), new THREE.Color(0xe9d8b6)],
    fogNear: [120, 260], fogFar: [1150, 2100], sunI: [2.1, 2.4], hemi: [0.78, 0.8], sunC: [new THREE.Color(0xfff6ea), new THREE.Color(0xffedcf)]
  };
  const tmpC = new THREE.Color();
  function applyPropScale(o, era) { const k = era === 'ruin' ? 1 - sstep(0.0, 0.5, H.era) : sstep(0.5, 1.0, H.era); o.visible = k > 0.002; if (o.visible) o.scale.copy(o.userData.s0).multiplyScalar(0.001 + 0.999 * k); }
  // t = 0: the ruins today; t = 1: the living city
  H.applyEra = function (t) {
    H.era = t; uT.value = sstep(0.05, 0.95, t);
    wallMesh.morphTargetInfluences[0] = 1 - sstep(0.05, 0.95, t);
    const pk = sstep(0.55, 1, t), rk = 1 - sstep(0, 0.45, t);
    Object.keys(eraMats).forEach(function (k) { const m = eraMats[k], o = m.userData.era === 'past' ? pk : rk; m.opacity = o; m.transparent = o < 0.999; m.depthWrite = o > 0.5; m.visible = o > 0.004; });
    eraMeshes.past.forEach(function (m) { m.visible = pk > 0.004; if (m.isMesh) m.castShadow = pk > 0.5 && m.userData.cast !== false; });
    eraMeshes.ruin.forEach(function (m) { m.visible = rk > 0.004; });
    MAT.water.opacity = 0.86 * pk; waterMeshes.forEach(function (m) { m.visible = pk > 0.004; });
    life.smoke.material.uniforms.uFade.value = pk; life.smoke.visible = pk > 0.004;
    ground.visible = pk < 0.999; // in the living city the grass plain covers it
    for (let i = 0; i < pastProps.length; i++) applyPropScale(pastProps[i], 'past');
    for (let i = 0; i < ruinProps.length; i++) applyPropScale(ruinProps[i], 'ruin');
    skyMat.uniforms.uTop.value.copy(LOOK.top[0]).lerp(LOOK.top[1], t); skyMat.uniforms.uHor.value.copy(LOOK.hor[0]).lerp(LOOK.hor[1], t);
    scene.fog.color.copy(LOOK.fog[0]).lerp(LOOK.fog[1], t); scene.fog.near = LOOK.fogNear[0] + (LOOK.fogNear[1] - LOOK.fogNear[0]) * t; scene.fog.far = LOOK.fogFar[0] + (LOOK.fogFar[1] - LOOK.fogFar[0]) * t;
    sun.intensity = LOOK.sunI[0] + (LOOK.sunI[1] - LOOK.sunI[0]) * t; sun.color.copy(LOOK.sunC[0]).lerp(LOOK.sunC[1], t); hemi.intensity = LOOK.hemi[0] + (LOOK.hemi[1] - LOOK.hemi[0]) * t;
    shadowDirty = Math.max(shadowDirty, 1);
  };

  // ---------------------------------------------------------------- where the ground is, and what blocks the way
  const B = P.bath, C = P.citadel;
  H.groundY = function (x, z) {
    if (x > C.x0 && x < C.x1 && z > C.z0 && z < C.z1) {
      if (x > B.x0 && x < B.x1 && z > B.z0 && z < B.z1) { // inside the tank
        let fl = CY - B.depth;
        if (Math.abs(x) < 1.6) { const dn = z - B.z0, ds = B.z1 - z; if (dn < B.stair) fl = CY - B.depth * (dn / B.stair); else if (ds < B.stair) fl = CY - B.depth * (ds / B.stair); }
        if (H.era > 0.5) fl = Math.max(fl, CY - B.depth + B.water - 1.2);
        return fl;
      }
      return CY;
    }
    for (let i = 0; i < P.ramps.length; i++) { const r = P.ramps[i]; if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) { const k = r.axis === 'x' ? (x - r.hi) / (r.lo - r.hi) : (z - r.hi) / (r.lo - r.hi); return CY * (1 - clamp(k, 0, 1)); } }
    return 0;
  };
  // invisible edges: the rim of the bath (enter by the stairs), the sides of the stairs, the edge of the citadel, the river bank
  const edges = [];
  const edge = function (x1, z1, x2, z2, era) { const L = Math.hypot(x2 - x1, z2 - z1); edges.push({ x1: x1, z1: z1, x2: x2, z2: z2, ux: (x2 - x1) / L, uz: (z2 - z1) / L, L: L, t: 0.3, era: era }); };
  edge(B.x0, B.z0, B.x0, B.z1); edge(B.x1, B.z0, B.x1, B.z1); edge(B.x0, B.z0, -1.6, B.z0); edge(1.6, B.z0, B.x1, B.z0); edge(B.x0, B.z1, -1.6, B.z1); edge(1.6, B.z1, B.x1, B.z1);
  edge(-1.6, B.z0, -1.6, B.z0 + B.stair); edge(1.6, B.z0, 1.6, B.z0 + B.stair); edge(-1.6, B.z1, -1.6, B.z1 - B.stair); edge(1.6, B.z1, 1.6, B.z1 - B.stair);
  P.ramps.forEach(function (r) { if (r.axis === 'x') { edge(r.x0, r.z0, r.x1, r.z0); edge(r.x0, r.z1, r.x1, r.z1); } else { edge(r.x0, r.z0, r.x0, r.z1); edge(r.x1, r.z0, r.x1, r.z1); } });
  // spatial grid for quick lookups
  const CELL = 12, grid = {};
  const gkey = function (i, j) { return i * 4096 + j; };
  function gridAdd(o, x1, z1, x2, z2, pad) { const i0 = Math.floor((Math.min(x1, x2) - pad) / CELL), i1 = Math.floor((Math.max(x1, x2) + pad) / CELL), j0 = Math.floor((Math.min(z1, z2) - pad) / CELL), j1 = Math.floor((Math.max(z1, z2) + pad) / CELL); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = gkey(i, j); (grid[k] = grid[k] || []).push(o); } }
  colliders.forEach(function (c) { gridAdd(c, c.x1, c.z1, c.x2, c.z2, c.t); }); edges.forEach(function (c) { c.edge = true; gridAdd(c, c.x1, c.z1, c.x2, c.z2, 1); });
  circles.forEach(function (c) { c.circle = true; gridAdd(c, c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r, 0.5); });
  // push a point of radius r (feet at height y) out of anything solid; returns nothing, edits pos {x, z}
  H.collide = function (pos, y, r) {
    const past = H.era > 0.5;
    for (let it = 0; it < 3; it++) {
      const list = grid[gkey(Math.floor(pos.x / CELL), Math.floor(pos.z / CELL))]; if (!list) return;
      for (let q = 0; q < list.length; q++) {
        const c = list[q];
        if (c.circle) { if (c.era && (c.era === 'past') !== past) continue; const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), m = c.r + r; if (d < m && d > 1e-5) { pos.x = c.x + dx / d * m; pos.z = c.z + dz / d * m; } continue; }
        const a = (pos.x - c.x1) * c.ux + (pos.z - c.z1) * c.uz, dd = -(pos.x - c.x1) * c.uz + (pos.z - c.z1) * c.ux; // along and across the wall
        const ex = a < 0 ? a : a > c.L ? a - c.L : 0, ey = Math.abs(dd) > c.t / 2 ? Math.abs(dd) - c.t / 2 : 0, d = Math.hypot(ex, ey);
        if (d >= r) continue;
        if (!c.edge) {
          const hgt = past ? c.h : c.rh[Math.min(c.n - 1, Math.max(0, Math.floor(a / c.L * c.n)))];
          if (c.y0 + hgt < y + 0.75 || c.y0 > y + 1.7) continue; // low enough to step over, or overhead
        }
        if (d > 1e-5) { const k = (r - d) / d, sy = dd < 0 ? -1 : 1; pos.x += (ex * c.ux - sy * ey * c.uz) * k; pos.z += (ex * c.uz + sy * ey * c.ux) * k; } // push straight out from the nearest point of the box
        else { const sy = dd < 0 ? -1 : 1, k = c.t / 2 + r - Math.abs(dd); pos.x += -c.uz * sy * k; pos.z += c.ux * sy * k; }
      }
    }
  };
  H.bounds = { x0: -190, x1: 560, z0: -260, z1: 270 };
  // is a walker of radius r blocked at (x, z)?
  function blockedAt(x, z, r, past) {
    const list = grid[gkey(Math.floor(x / CELL), Math.floor(z / CELL))]; if (!list) return false;
    const y = H.groundY(x, z);
    for (let q = 0; q < list.length; q++) {
      const c = list[q];
      if (c.circle) { if (c.era && (c.era === 'past') !== past) continue; if (Math.hypot(x - c.x, z - c.z) < c.r + r) return true; continue; }
      const a = (x - c.x1) * c.ux + (z - c.z1) * c.uz, dd = -(x - c.x1) * c.uz + (z - c.z1) * c.ux;
      const ex = a < 0 ? a : a > c.L ? a - c.L : 0, ey = Math.abs(dd) > c.t / 2 ? Math.abs(dd) - c.t / 2 : 0;
      if (ex * ex + ey * ey >= r * r) continue;
      if (!c.edge) { const hgt = past ? c.h : c.rh[Math.min(c.n - 1, Math.max(0, Math.floor(a / c.L * c.n)))]; if (c.y0 + hgt < y + 0.75 || c.y0 > y + 1.7) continue; }
      return true;
    }
    return false;
  }
  const NAV = { x0: -100, z0: -175, cs: 0.5, W: 1170, Hh: 800, grids: {} };
  function navGrid() {
    const past = H.era > 0.5, key = past ? 'p' : 'r'; if (NAV.grids[key]) return NAV.grids[key];
    const g = new Uint8Array(NAV.W * NAV.Hh);
    for (let j = 0; j < NAV.Hh; j++) { const z = NAV.z0 + (j + 0.5) * NAV.cs; for (let i = 0; i < NAV.W; i++) { const x = NAV.x0 + (i + 0.5) * NAV.cs; if ((past && x > P.river.x0 - 2.5) || blockedAt(x, z, 0.22, past)) g[j * NAV.W + i] = 1; } }
    return (NAV.grids[key] = g);
  }
  function freeNear(g, i, j) { if (!g[j * NAV.W + i]) return j * NAV.W + i; for (let r = 1; r < 16; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= NAV.W || b >= NAV.Hh) continue; if (!g[b * NAV.W + a]) return b * NAV.W + a; } return -1; }
  // shortest walkable route from (sx, sz) to (tx, tz): a list of [x, z] points about 1.5 m apart, or null
  H.findPath = function (sx, sz, tx, tz) {
    const g = navGrid(), W = NAV.W, Hh = NAV.Hh, N = W * Hh, cs = NAV.cs;
    const ci = function (x) { return clamp(Math.floor((x - NAV.x0) / cs), 0, W - 1); }, cj = function (z) { return clamp(Math.floor((z - NAV.z0) / cs), 0, Hh - 1); };
    const s = freeNear(g, ci(sx), cj(sz)), t = freeNear(g, ci(tx), cj(tz)); if (s < 0 || t < 0) return null;
    if (!NAV.gs) { NAV.gs = new Float32Array(N); NAV.par = new Int32Array(N); NAV.done = new Uint8Array(N); }
    const gs = NAV.gs, par = NAV.par, done = NAV.done; gs.fill(Infinity); done.fill(0);
    const ti = t % W, tj = (t - ti) / W, hf = [], hi = [];
    const push = function (f, i) { let k = hf.length; hf.push(f); hi.push(i); while (k > 0) { const p = (k - 1) >> 1; if (hf[p] <= f) break; hf[k] = hf[p]; hi[k] = hi[p]; k = p; } hf[k] = f; hi[k] = i; };
    const pop = function () { const top = hi[0], f = hf.pop(), i = hi.pop(), n = hf.length; if (n) { let k = 0; for (;;) { let c = 2 * k + 1; if (c >= n) break; if (c + 1 < n && hf[c + 1] < hf[c]) c++; if (hf[c] >= f) break; hf[k] = hf[c]; hi[k] = hi[c]; k = c; } hf[k] = f; hi[k] = i; } return top; };
    const heur = function (i, j) { const dx = Math.abs(i - ti), dz = Math.abs(j - tj); return (dx + dz) - 0.586 * Math.min(dx, dz); };
    gs[s] = 0; par[s] = -1; push(heur(s % W, (s - s % W) / W), s);
    let found = false, iter = 0;
    while (hf.length && iter++ < 1500000) {
      const cur = pop(); if (done[cur]) continue; done[cur] = 1; if (cur === t) { found = true; break; }
      const i = cur % W, j = (cur - i) / W, gc = gs[cur];
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= W || b >= Hh) continue;
        const n = b * W + a; if (g[n] || done[n]) continue;
        if (di && dj && (g[j * W + a] || g[b * W + i])) continue; // no cutting corners
        const ng = gc + (di && dj ? 1.4142 : 1);
        if (ng < gs[n]) { gs[n] = ng; par[n] = cur; push(ng + heur(a, b), n); }
      }
    }
    if (!found) return null;
    const cells = []; for (let c = t; c >= 0; c = par[c]) cells.push(c); cells.reverse();
    const out = []; for (let k = 0; k < cells.length; k += 3) { const c = cells[k], i = c % W; out.push([NAV.x0 + (i + 0.5) * cs, NAV.z0 + ((c - i) / W + 0.5) * cs]); }
    const lc = cells[cells.length - 1], li = lc % W; out.push([NAV.x0 + (li + 0.5) * cs, NAV.z0 + ((lc - li) / W + 0.5) * cs]);
    return out;
  };
  // the trail: glowing dots on the ground along the route
  const TRAILN = 44, tg = new THREE.CircleGeometry(0.26, 12); tg.rotateX(-Math.PI / 2);
  const trail = new THREE.InstancedMesh(tg, new THREE.MeshBasicMaterial({ color: 0xffc04a, transparent: true, opacity: 0.9, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -10 }), TRAILN);
  trail.frustumCulled = false; trail.renderOrder = 8; trail.visible = false; scene.add(trail);
  const tdm = new THREE.Object3D();
  // a tall beam of light over the place you are being guided to: it shows above the walls, so you always know which way to head
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 60, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffc04a, transparent: true, opacity: 0.3, depthWrite: false, depthTest: false, fog: false, side: THREE.DoubleSide }));
  beacon.visible = false; beacon.renderOrder = 9; scene.add(beacon);
  H.setTrail = function (pts, from, far) {
    if (!pts) { trail.visible = false; beacon.visible = false; return; }
    const last = pts[pts.length - 1]; beacon.position.set(last[0], H.groundY(last[0], last[1]) + 30, last[1]); beacon.visible = far !== false;
    let n = 0; for (let k = from; k < pts.length && n < TRAILN; k++, n++) { tdm.position.set(pts[k][0], H.groundY(pts[k][0], pts[k][1]) + 0.09, pts[k][1]); tdm.scale.setScalar(k === pts.length - 1 ? 2.2 : 1); tdm.updateMatrix(); trail.setMatrixAt(n, tdm.matrix); }
    trail.count = n; trail.instanceMatrix.needsUpdate = true; trail.visible = n > 0;
  };

  // ---------------------------------------------------------------- frame
  H.applyEra(0);
  H.loadProps = loadProps;
  H.render = function (time, dt) {
    if (prPending) { prPending = false; renderer.setPixelRatio(H.pr); renderer.setSize(H.W, H.Hh, false); }
    sky.scale.setScalar(3000);
    river.position.y = 0.12 + Math.sin(time * 0.6) * 0.015;
    if (H.era > 0.5) {
      life.smoke.material.uniforms.uTime.value = time; life.smoke.material.uniforms.uPx.value = H.pr * H.Hh / 760;
      life.ember.material.color.setRGB(1.0, 0.42 + 0.14 * Math.sin(time * 7.3) + 0.06 * Math.sin(time * 19.0), 0.14);
      for (let i = 0; i < life.cloths.length; i++) { const g = life.cloths[i]; g.rotation.x = Math.sin(time * 1.3 + g.userData.ph) * 0.12 + Math.sin(time * 2.9 + g.userData.ph * 2.0) * 0.04; }
    }
    if (trail.visible) trail.material.opacity = 0.7 + 0.25 * Math.sin(time * 4.0);
    if (shadowDirty > 0) { renderer.shadowMap.needsUpdate = true; shadowDirty--; }
    renderer.render(scene, camera);
  };
  H.shadowsDirty = function () { shadowDirty = 2; };
  H.stats = function () { return { walls: wallGeo.count, tris: renderer.info.render.triangles, calls: renderer.info.render.calls, colliders: colliders.length }; };
  H.ready = true;
})();
