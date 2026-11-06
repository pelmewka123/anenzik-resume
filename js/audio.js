/* =====================================================================
   ЗВУК: всё синтезируется на лету через Web Audio (никаких файлов)
   ===================================================================== */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const A = (G.audio = { on: true, music: true, intensity: 0 });
  let ctx, master, sfx, music, send, noiseBuf, timer = null, nextTime = 0, step = 0;

  A.init = function () {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = A.ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.85;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    comp.connect(master);
    master.connect(ctx.destination);
    sfx = ctx.createGain();
    sfx.gain.value = 0.75;
    sfx.connect(comp);
    music = ctx.createGain();
    music.gain.value = 0;
    music.connect(comp);
    // «эхо» для музыки
    send = ctx.createDelay(1.0);
    send.delayTime.value = 0.357;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    send.connect(lp); lp.connect(fb); fb.connect(send); lp.connect(music);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  };

  function osc(type, freq, t, dur, vol, dest, o = {}) {
    const n = ctx.createOscillator(), g = ctx.createGain();
    n.type = type;
    n.frequency.setValueAtTime(freq, t);
    if (o.to) n.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
    if (o.detune) n.detune.value = o.detune;
    const a = o.a || 0.006;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + 0.02));
    n.connect(g);
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter;
      f.frequency.value = o.f || 1000;
      f.Q.value = o.q || 0.8;
      g.connect(f);
      f.connect(dest);
      if (o.send) f.connect(send);
    } else {
      g.connect(dest);
      if (o.send) g.connect(send);
    }
    n.start(t);
    n.stop(t + dur + 0.1);
  }
  function noise(t, dur, vol, dest, type = 'bandpass', f = 1000, q = 1, fTo) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(f, t);
    if (fTo) fl.frequency.exponentialRampToValueAtTime(fTo, t + dur);
    fl.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.4);
    s.stop(t + dur + 0.1);
  }

  /* ---------- эффекты ---------- */
  const S = {
    click: (t) => osc('triangle', 620, t, 0.08, 0.14, sfx, { to: 940 }),
    hover: (t) => osc('sine', 1300, t, 0.04, 0.04, sfx),
    tick: (t) => osc('sine', 900, t, 0.05, 0.06, sfx),
    coin: (t) => {
      osc('square', 1318, t, 0.08, 0.06, sfx, { filter: 'lowpass', f: 4200 });
      osc('square', 1760, t + 0.07, 0.28, 0.06, sfx, { filter: 'lowpass', f: 4200 });
    },
    buy: (t) => {
      S.coin(t);
      osc('triangle', 523, t, 0.16, 0.12, sfx);
      osc('triangle', 784, t + 0.08, 0.25, 0.12, sfx);
    },
    achieve: (t) => {
      [523, 659, 784, 1047].forEach((f, i) => osc('triangle', f, t + i * 0.09, 0.5, 0.14, sfx));
      osc('sine', 2093, t + 0.36, 0.9, 0.05, sfx);
    },
    hit: (t) => {
      noise(t, 0.16, 0.45, sfx, 'bandpass', 1700, 0.8);
      osc('sine', 170, t, 0.2, 0.45, sfx, { to: 50 });
    },
    crit: (t) => {
      S.hit(t);
      noise(t + 0.02, 0.3, 0.3, sfx, 'highpass', 3000, 0.7);
      osc('sawtooth', 220, t, 0.28, 0.1, sfx, { to: 900, filter: 'lowpass', f: 3200 });
    },
    magic: (t) => {
      osc('sawtooth', 300, t, 0.5, 0.1, sfx, { to: 1800, filter: 'lowpass', f: 2600 });
      osc('sine', 900, t, 0.6, 0.08, sfx, { to: 2400 });
      noise(t, 0.4, 0.12, sfx, 'highpass', 4000, 1);
    },
    heal: (t) => [659, 784, 988, 1319].forEach((f, i) => osc('sine', f, t + i * 0.06, 0.6, 0.09, sfx)),
    explode: (t) => {
      noise(t, 1.8, 0.9, sfx, 'lowpass', 1400, 0.7, 50);
      osc('sine', 95, t, 1.3, 0.8, sfx, { to: 28 });
    },
    horn: (t) => {
      [146.8, 220, 293.7].forEach((f, i) => osc('sawtooth', f, t, 2.0, 0.08, sfx, { a: 0.3, filter: 'lowpass', f: 900, detune: (i - 1) * 7 }));
      osc('sawtooth', 293.7, t + 0.7, 1.8, 0.07, sfx, { a: 0.25, filter: 'lowpass', f: 1300 });
      osc('sawtooth', 440, t + 0.7, 1.8, 0.05, sfx, { a: 0.25, filter: 'lowpass', f: 1300 });
    },
    whoosh: (t) => noise(t, 2.4, 0.55, sfx, 'bandpass', 250, 1.4, 2800),
    whooshShort: (t) => noise(t, 0.9, 0.3, sfx, 'bandpass', 400, 1.2, 2000),
    land: (t) => {
      osc('sine', 75, t, 0.9, 0.7, sfx, { to: 32 });
      noise(t, 0.7, 0.4, sfx, 'lowpass', 600, 0.7, 80);
    },
    roar: (t) => {
      osc('sawtooth', 120, t, 1.3, 0.22, sfx, { to: 52, filter: 'lowpass', f: 700, a: 0.06 });
      osc('square', 85, t, 1.3, 0.1, sfx, { to: 40, filter: 'lowpass', f: 500 });
      noise(t, 1.1, 0.3, sfx, 'lowpass', 700, 1, 180);
    },
    hurt: (t) => {
      osc('sawtooth', 210, t, 0.3, 0.1, sfx, { to: 80, filter: 'lowpass', f: 1100 });
      noise(t, 0.25, 0.28, sfx, 'lowpass', 900, 1);
    },
    error: (t) => {
      osc('square', 220, t, 0.11, 0.06, sfx, { filter: 'lowpass', f: 1500 });
      osc('square', 165, t + 0.12, 0.2, 0.06, sfx, { filter: 'lowpass', f: 1500 });
    },
    zap: (t) => osc('sawtooth', 1500, t, 0.14, 0.025, sfx, { to: 300, filter: 'lowpass', f: 3000 }),
    found: (t) => [392, 523, 659, 784].forEach((f, i) => osc('triangle', f, t + i * 0.11, 0.7, 0.14, sfx)),
    victory: (t) => {
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => {
        osc('sawtooth', f, t + i * 0.15, 0.55, 0.06, sfx, { filter: 'lowpass', f: 2600 });
        osc('triangle', f / 2, t + i * 0.15, 0.55, 0.12, sfx);
      });
    },
  };
  A.play = function (name, delay = 0) {
    if (!ctx || !A.on || !S[name]) return;
    S[name](ctx.currentTime + delay);
  };

  /* ---------- фоновая музыка (своя композиция, ре минор) ---------- */
  const BPM = 84, BEAT = 60 / BPM;
  const PROG = [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55], [50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]];
  const ARP = [0, 1, 2, 1, 2, 1, 0, 2];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function pad(t, chord, dur) {
    chord.forEach((m) => {
      [-7, 7].forEach((dt) => osc('sawtooth', mtof(m), t, dur, 0.026, music, { a: 1.2, filter: 'lowpass', f: 900, detune: dt }));
    });
    osc('sine', mtof(chord[0] + 24), t, dur, 0.025, music, { a: 1.5, send: true });
  }
  function bass(t, m, dur) {
    osc('triangle', mtof(m), t, dur, 0.2, music, { a: 0.02 });
    osc('sine', mtof(m - 12), t, dur, 0.16, music, { a: 0.02 });
  }
  function pluck(t, m) { osc('triangle', mtof(m), t, BEAT * 0.9, 0.045, music, { send: true, filter: 'lowpass', f: 3000 }); }
  function taiko(t, v) {
    osc('sine', 95, t, 0.55, 0.42 * v, music, { to: 42 });
    noise(t, 0.25, 0.18 * v, music, 'lowpass', 500, 1);
  }
  function snare(t) { noise(t, 0.18, 0.12, music, 'bandpass', 2200, 0.7); }
  function hat(t, v) { noise(t, 0.05, 0.05 * v, music, 'highpass', 7000, 1); }

  function scheduleStep(t, st) {
    const chord = PROG[Math.floor(st / 16) % PROG.length];
    const inBar = st % 8, inChord = st % 16;
    if (inChord === 0) pad(t, chord, BEAT * 8 + 0.6);
    if (inBar === 0) bass(t, chord[0] - 12, BEAT * 1.9);
    if (inBar === 4) bass(t, chord[0] - 12, BEAT * 1.4);
    if (A.intensity > 0.5 && (inBar === 3 || inBar === 6)) bass(t, chord[0] - 12, BEAT * 0.4);
    pluck(t, chord[ARP[inBar]] + 12 + (inBar === 4 ? 12 : 0));
    if (inBar === 0) taiko(t, 1);
    if (inBar === 5 && st % 16 === 13) taiko(t, 0.6);
    if (A.intensity > 0.5) {
      if (inBar === 4) snare(t);
      if (inBar === 2 || inBar === 6) taiko(t, 0.7);
      hat(t, inBar % 2 ? 0.6 : 1);
    }
  }
  function scheduler() {
    while (nextTime < ctx.currentTime + 0.3) {
      scheduleStep(nextTime, step);
      nextTime += BEAT / 2;
      step++;
    }
  }
  A.startMusic = function () {
    if (!ctx || timer) return;
    nextTime = ctx.currentTime + 0.1;
    step = 0;
    timer = setInterval(scheduler, 60);
    const t = ctx.currentTime;
    music.gain.cancelScheduledValues(t);
    music.gain.setValueAtTime(music.gain.value, t);
    music.gain.linearRampToValueAtTime(A.music && A.on ? 0.6 : 0, t + 3);
  };
  A.setMusic = function (on) {
    A.music = on;
    if (!ctx) return;
    const t = ctx.currentTime;
    music.gain.cancelScheduledValues(t);
    music.gain.setValueAtTime(music.gain.value, t);
    music.gain.linearRampToValueAtTime(on && A.on ? 0.6 : 0, t + 0.8);
  };
  A.setOn = function (on) {
    A.on = on;
    if (!ctx) return;
    master.gain.setTargetAtTime(on ? 0.85 : 0, ctx.currentTime, 0.05);
    if (!on && 'speechSynthesis' in window) speechSynthesis.cancel();
  };
  A.setIntensity = (v) => (A.intensity = v);

  /* ---------- «диктор» через синтез речи браузера ---------- */
  let ruVoice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices();
    ruVoice = vs.find((v) => /^ru/i.test(v.lang) && /male|dmitr|pavel|юрий|мужск/i.test(v.name)) || vs.find((v) => /^ru/i.test(v.lang)) || null;
  }
  if ('speechSynthesis' in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }
  A.say = function (text) {
    if (!A.on || !ruVoice) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.voice = ruVoice;
      u.lang = ruVoice.lang;
      u.rate = 0.92;
      u.pitch = 0.5;
      u.volume = 1;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) { /* без диктора тоже можно жить */ }
  };
})();
