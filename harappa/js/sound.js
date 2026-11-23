/* Harappa Explorer — sound, all generated in the browser (no audio files): a slow drone with soft plucked notes,
   plus effects for footsteps, discoveries and time travel. Music and effects can each be switched off. */
(function () {
  'use strict';
  const H = window.H; if (!H || H.failed) return;
  const A = H.audio = { music: true, sfx: true, ready: false };
  try { const p = JSON.parse(localStorage.getItem('hx_audio') || 'null'); if (p) { A.music = p.music !== false; A.sfx = p.sfx !== false; } } catch (e) {}
  const save = function () { try { localStorage.setItem('hx_audio', JSON.stringify({ music: A.music, sfx: A.sfx })); } catch (e) {} };
  let ctx = null, musicBus, sfxBus, echo, noiseBuf, windGain, timer = 0, nextNote = 0, nextDrone = 0, step = 0, nextTap = 0, nextBird = 0;
  const f = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
  function init() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = A.music ? 0.5 : 0; musicBus.connect(comp);
    sfxBus = ctx.createGain(); sfxBus.gain.value = A.sfx ? 0.8 : 0; sfxBus.connect(comp);
    echo = ctx.createDelay(1.5); echo.delayTime.value = 0.52; const fb = ctx.createGain(); fb.gain.value = 0.38; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
    echo.connect(lp); lp.connect(fb); fb.connect(echo); lp.connect(musicBus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.03 * w) / 1.03; d[i] = last * 3 + w * 0.1; }
    // soft wind, louder among the ruins
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 420; wf.Q.value = 0.6;
    windGain = ctx.createGain(); windGain.gain.value = 0.0; src.connect(wf); wf.connect(windGain); windGain.connect(musicBus); src.start();
    A.ready = true; return true;
  }
  // a five-note scale (D, E, F#, A, B) keeps every random note pleasant
  const SCALE = [62, 64, 66, 69, 71, 74, 76, 78, 81];
  function pluck(m, t, vol) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = f(m); o2.frequency.value = f(m) * 2;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(2600, t); lp.frequency.exponentialRampToValueAtTime(500, t + 1.2);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + 2.2);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(musicBus); g.connect(echo); o.start(t); o2.start(t); o.stop(t + 2.3); o2.stop(t + 2.3);
  }
  function drone(t, dur) {
    [38, 45, 50].forEach(function (m, i) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = i === 2 ? 'triangle' : 'sine'; o.frequency.value = f(m); o.detune.value = (i - 1) * 5;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(i === 0 ? 0.11 : 0.05, t + 4); g.gain.setValueAtTime(i === 0 ? 0.11 : 0.05, t + dur - 3); g.gain.linearRampToValueAtTime(0, t + dur + 3);
      o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 3.2);
    });
  }
  function schedule() {
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime, past = H.era > 0.5;
    if (nextDrone < now + 1) { if (nextDrone < now) nextDrone = now + 0.1; drone(nextDrone, 14); nextDrone += 14; }
    if (nextNote < now) nextNote = now + 1;
    while (nextNote < now + 1.2) {
      step += Math.random() < 0.5 ? 1 : Math.random() < 0.5 ? -1 : 2; step = (step + SCALE.length * 4) % SCALE.length;
      pluck(SCALE[step] - (past ? 0 : 12), nextNote, past ? 0.07 : 0.045);
      if (past && Math.random() < 0.35) pluck(SCALE[(step + 2) % SCALE.length], nextNote + 0.26, 0.04);
      nextNote += past ? 0.9 + Math.random() * 1.5 : 2.2 + Math.random() * 3.2;
    }
    windGain.gain.setTargetAtTime(past ? 0.03 : 0.11, now, 1.5);
    // the living city has small everyday sounds: a craftsman tapping, birds
    if (past && A.sfx) {
      if (nextTap < now) nextTap = now + 2;
      while (nextTap < now + 1.2) { const n = 3 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) tone('triangle', 1250 + Math.random() * 300, 700, nextTap + i * 0.27, 0.07, 0.018); nextTap += 5 + Math.random() * 9; }
      if (nextBird < now) nextBird = now + 1;
      while (nextBird < now + 1.2) { const b = 2600 + Math.random() * 1400, n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) tone('sine', b, b * (1.15 + 0.2 * Math.random()), nextBird + i * 0.13, 0.09, 0.014); nextBird += 3 + Math.random() * 7; }
    }
  }
  function tone(type, f0, f1, t, dur, vol) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.05); }
  function noise(t, dur, vol, type, f0, f1, q) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q || 0.8; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.08, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); s.connect(fl); fl.connect(g); g.connect(sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.05); }
  const FX = {
    click: function (t) { tone('sine', 620, 880, t, 0.07, 0.11); },
    step: function (t) { noise(t, 0.1, 0.09, 'lowpass', 520, 180); },
    find: function (t) { [74, 78, 81, 86].forEach(function (m, i) { tone('sine', f(m), f(m), t + i * 0.08, 0.6, 0.13); }); },
    done: function (t) { [62, 66, 69, 74, 78].forEach(function (m, i) { tone('triangle', f(m), f(m), t + i * 0.12, 0.9, 0.14); }); },
    travel: function (t) { noise(t, 3.6, 0.3, 'bandpass', 200, 3200, 1.3); tone('sine', 110, 880, t, 3.2, 0.07); tone('sine', 880, 1320, t + 3.2, 0.6, 0.08); },
    open: function (t) { tone('sine', 520, 700, t, 0.09, 0.07); }
  };
  A.play = function (n) { if (!A.ready || !A.sfx || ctx.state !== 'running' || !FX[n]) return; try { FX[n](ctx.currentTime); } catch (e) {} };
  A.start = function () { if (!ctx && !init()) return; if (ctx.state === 'suspended') ctx.resume(); if (!timer) timer = setInterval(schedule, 400); };
  A.setMusic = function (on) { A.music = on; save(); if (A.ready) musicBus.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.4); };
  A.setSfx = function (on) { A.sfx = on; save(); if (A.ready) sfxBus.gain.setTargetAtTime(on ? 0.8 : 0, ctx.currentTime, 0.1); };
  document.addEventListener('visibilitychange', function () { if (!ctx) return; if (document.hidden) ctx.suspend(); else ctx.resume(); });
  H.sfx = function (n) { A.play(n); };
})();
