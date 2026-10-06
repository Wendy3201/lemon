/*!
 * Pip Survivors — sound effects
 * Every sound is made on the spot with the Web Audio API (oscillators and
 * filtered noise), so there are no audio files to download. Nothing plays
 * until the player's first click or key press, because browsers do not
 * allow sound before that.
 *
 *   PS.sfx.play("upgrade")        PS.sfx.play("reveal", rarity)
 *   PS.sfx.on()  PS.sfx.set(false)  PS.sfx.toggle()
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function () {
  "use strict";

  var PS = window.PS;
  var KEY = "lemon:sound";

  var ctx = null;
  var master = null;
  var noiseBuffer = null;
  var enabled = PS.store.get(KEY, true) !== false;
  var lastAt = {};

  /* the fastest each sound may repeat, in milliseconds: a swarm dying at once
     should be a texture, not a wall of noise */
  var GAP = { hit: 50, kill: 40, gem: 35, coin: 45, shoot: 90, boom: 100, hurt: 140, zap: 90 };

  /* a pentatonic ladder, so any run of notes sounds pleasant */
  var SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];

  function ensure() {
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      var squash = ctx.createDynamicsCompressor();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(squash);
      squash.connect(ctx.destination);
    } catch (err) {
      ctx = null;
    }
    return ctx;
  }

  // the first gesture is what lets sound start at all
  ["pointerdown", "keydown", "touchstart"].forEach(function (name) {
    window.addEventListener(name, ensure, { passive: true });
  });

  /* ------------------------------------------------------------- building */

  /** One note. opts: slide (end frequency), delay, vol, attack. */
  function tone(freq, dur, type, vol, opts) {
    opts = opts || {};
    var t = ctx.currentTime + (opts.delay || 0);
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t);
    if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + (opts.attack || 0.006));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** A burst of filtered noise. opts: filter, freq, sweep (end frequency), q, delay. */
  function noise(dur, vol, opts) {
    opts = opts || {};
    if (!noiseBuffer) {
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var data = noiseBuffer.getChannelData(0);
      for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    var t = ctx.currentTime + (opts.delay || 0);
    var src = ctx.createBufferSource();
    var filter = ctx.createBiquadFilter();
    var gain = ctx.createGain();
    src.buffer = noiseBuffer;
    filter.type = opts.filter || "bandpass";
    filter.frequency.setValueAtTime(opts.freq || 1500, t);
    if (opts.sweep) filter.frequency.exponentialRampToValueAtTime(opts.sweep, t + dur);
    filter.Q.value = opts.q || 1;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  /** Notes from the scale, one after another. */
  function run(steps, step, type, vol, from) {
    for (var i = 0; i < steps.length; i++) {
      tone(SCALE[steps[i]] * (from || 1), step * 2.2, type, vol, { delay: i * step });
    }
  }

  /* --------------------------------------------------------------- sounds */

  var SOUNDS = {
    click: function () { tone(680, 0.05, "triangle", 0.16, { slide: 520 }); },
    tab: function () { tone(420, 0.09, "sine", 0.2, { slide: 640 }); },
    start: function () {
      tone(196, 0.18, "square", 0.1);
      tone(294, 0.3, "triangle", 0.2, { delay: 0.08, slide: 440 });
      noise(0.25, 0.08, { filter: "highpass", freq: 2500, delay: 0.05 });
    },
    equip: function () {
      noise(0.04, 0.12, { filter: "bandpass", freq: 3000 });
      tone(392, 0.09, "square", 0.08);
      tone(587, 0.16, "triangle", 0.2, { delay: 0.07 });
    },
    upgrade: function () {
      run([0, 2, 3, 5], 0.06, "triangle", 0.17);
      tone(2093, 0.3, "sine", 0.09, { delay: 0.24 });
    },
    talent: function () {
      run([0, 1, 3, 4], 0.07, "triangle", 0.16, 0.7);
      tone(1568, 0.3, "sine", 0.08, { delay: 0.3 });
    },
    coin: function () {
      tone(1319, 0.07, "square", 0.08);
      tone(1760, 0.2, "square", 0.08, { delay: 0.07 });
    },
    gem: function () { tone(1150 + Math.random() * 350, 0.06, "sine", 0.07); },
    heal: function () {
      tone(660, 0.12, "sine", 0.13);
      tone(880, 0.18, "sine", 0.13, { delay: 0.08 });
    },
    forge: function () {
      // two hammer blows, then the metal rings
      for (var i = 0; i < 2; i++) {
        noise(0.09, 0.3, { filter: "bandpass", freq: 3200, delay: i * 0.2 });
        tone(210, 0.25, "square", 0.17, { delay: i * 0.2, slide: 170 });
        tone(1480, 0.4, "triangle", 0.06, { delay: i * 0.2 });
      }
      run([2, 4, 5, 7, 9], 0.07, "triangle", 0.16, 1);
    },
    chestOpen: function () {
      noise(0.7, 0.28, { filter: "lowpass", freq: 260, sweep: 120 });
      for (var i = 0; i < 6; i++) tone(120 + (i % 2) * 18, 0.1, "square", 0.07, { delay: i * 0.1 });
    },
    // rarer finds get a longer, brighter fanfare
    reveal: function (rarity) {
      var r = rarity || 0;
      var count = 3 + r;
      var notes = [];
      for (var i = 0; i < count; i++) notes.push(Math.min(9, i + (i > 4 ? 0 : 0)));
      run(notes, 0.075, "triangle", 0.17);
      if (r >= 3) tone(SCALE[9], 0.6, "sine", 0.1, { delay: count * 0.075 });
      if (r >= 4) {
        noise(0.5, 0.12, { filter: "highpass", freq: 5000, delay: count * 0.075 });
        tone(130, 0.7, "sine", 0.3, { delay: 0.05, slide: 60 });
      }
      if (r >= 6) run([5, 7, 9, 9], 0.09, "square", 0.07, 1);
    },
    deny: function () { tone(180, 0.14, "square", 0.1, { slide: 120 }); },

    // ----- in battle
    shoot: function () { noise(0.05, 0.035, { filter: "bandpass", freq: 2800 }); },
    hit: function () { noise(0.04, 0.05, { filter: "bandpass", freq: 1900 }); },
    kill: function () {
      tone(300, 0.08, "square", 0.05, { slide: 120 });
      noise(0.05, 0.05, { filter: "lowpass", freq: 900 });
    },
    hurt: function () {
      tone(120, 0.2, "sawtooth", 0.22, { slide: 60 });
      noise(0.14, 0.18, { filter: "lowpass", freq: 600 });
    },
    boom: function () {
      noise(0.35, 0.22, { filter: "lowpass", freq: 900, sweep: 80 });
      tone(75, 0.3, "sine", 0.25, { slide: 40 });
    },
    zap: function () {
      noise(0.12, 0.09, { filter: "highpass", freq: 3200 });
      tone(950, 0.1, "sawtooth", 0.06, { slide: 220 });
    },
    levelup: function () {
      run([2, 3, 5, 7], 0.065, "triangle", 0.2, 0.75);
      run([5, 7], 0.065, "square", 0.05, 0.75);
    },
    pick: function () {
      tone(660, 0.07, "triangle", 0.18);
      tone(990, 0.14, "triangle", 0.18, { delay: 0.06 });
    },
    boss: function () {
      tone(65, 1.0, "sawtooth", 0.24, { slide: 52 });
      tone(98, 1.0, "sawtooth", 0.14, { slide: 80 });
      noise(0.9, 0.2, { filter: "lowpass", freq: 300, sweep: 90 });
    },
    revive: function () {
      tone(220, 0.5, "triangle", 0.2, { slide: 880 });
      run([4, 5, 7], 0.08, "sine", 0.14, 1);
    },
    win: function () {
      run([0, 2, 3, 5, 7], 0.11, "triangle", 0.2, 1);
      tone(SCALE[7], 0.9, "triangle", 0.18, { delay: 0.55 });
      tone(SCALE[5], 0.9, "triangle", 0.14, { delay: 0.55 });
      tone(SCALE[3], 0.9, "triangle", 0.12, { delay: 0.55 });
    },
    lose: function () {
      var down = [392, 330, 262, 196];
      for (var i = 0; i < down.length; i++) tone(down[i], 0.4, "triangle", 0.2, { delay: i * 0.2 });
    }
  };

  /* ------------------------------------------------------------------- api */

  PS.sfx = {
    play: function (name, arg) {
      if (!ctx || !enabled) return;
      var make = SOUNDS[name];
      if (!make) return;
      var gap = GAP[name];
      if (gap) {
        var now = performance.now();
        if (now - (lastAt[name] || 0) < gap) return;
        lastAt[name] = now;
      }
      if (ctx.state === "suspended") ctx.resume();
      make(arg);
    },
    on: function () { return enabled; },
    set: function (value) {
      enabled = Boolean(value);
      PS.store.set(KEY, enabled);
      if (enabled) {
        ensure();
        PS.sfx.play("click");
      }
    },
    toggle: function () { PS.sfx.set(!enabled); return enabled; }
  };
})();
