/*!
 * Pip Survivors — sound effects
 * Every sound is made on the spot with the Web Audio API (oscillators and
 * filtered noise), so there are no audio files to download. Nothing plays
 * until the player's first click or key press, because browsers do not
 * allow sound before that.
 *
 *   PS.sfx.play("upgrade")        PS.sfx.play("reveal", rarity)
 *   PS.sfx.play("hit", crit, pan) pan runs from -1 (left) to 1 (right)
 *   PS.sfx.on()  PS.sfx.set(false)  PS.sfx.toggle()
 *
 * The chain: each sound gets its own little bus (a gain, then a stereo pan),
 * which feeds the master volume and, for sounds that want space, a send into
 * a short generated reverb. Everything then goes through a gentle low-pass
 * (to take the fizz off) and a compressor (so a swarm dying at once stays a
 * texture instead of a wall of noise). Every play is nudged a few percent in
 * pitch, so repeated sounds do not sound like a machine gun.
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function () {
  "use strict";

  var PS = window.PS;
  var KEY = "lemon:sound";

  var ctx = null;
  var master = null;
  var reverbIn = null;
  var mixIn = null; // the shared low-pass and compressor, which the music also plays into
  var noiseBuffer = null;
  var enabled = PS.store.get(KEY, true) !== false;
  var lastAt = {};

  // while a sound is being built: where its parts plug in, its pitch nudge,
  // and when its last part ends (so its bus can be let go afterwards)
  var bus = null;
  var pitch = 1;
  var busEnd = 0;

  /* the fastest each sound may repeat, in milliseconds */
  var GAP = { hit: 45, kill: 38, gem: 34, coin: 45, shoot: 85, boom: 90, hurt: 140, zap: 80 };

  /* a pentatonic ladder, so any run of notes sounds pleasant */
  var SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093, 2349.32];

  /* how each weapon sounds when it goes off */
  var FAMILY = {
    sling: "pew", bow: "twang", frost: "twang", cannon: "heavy",
    blade: "swish", solstice: "swish", spear: "swish", ember: "swish", whip: "swish", thornlash: "swish",
    daggers: "flick", fangs: "flick", rang: "flick", flask: "flick",
    hammer: "heavy", mace: "heavy",
    staff: "magic", storm: "magic", eclipse: "magic", comet: "magic", nova: "magic", geyser: "magic", hive: "magic"
  };

  /* gems picked up in quick succession climb the scale */
  var gemChain = 0;
  var gemAt = 0;

  /** A short stereo room: noise that dies away, a little brighter on one side. */
  function impulse(seconds, decay) {
    var length = Math.floor(ctx.sampleRate * seconds);
    var buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var data = buffer.getChannelData(ch);
      for (var i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
    return buffer;
  }

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
      squash.threshold.value = -16;
      squash.knee.value = 12;
      squash.ratio.value = 4;
      squash.attack.value = 0.003;
      squash.release.value = 0.25;
      var warm = ctx.createBiquadFilter();
      warm.type = "lowpass";
      warm.frequency.value = 9500;
      warm.Q.value = 0.5;
      master = ctx.createGain();
      master.gain.value = PS.prefs.gain();
      master.connect(warm);
      warm.connect(squash);
      mixIn = warm;
      squash.connect(ctx.destination);

      var room = ctx.createConvolver();
      room.buffer = impulse(1.7, 3.2);
      reverbIn = ctx.createGain();
      reverbIn.gain.value = 0.9;
      reverbIn.connect(room);
      room.connect(master);
    } catch (err) {
      ctx = null;
    }
    if (ctx) PS.emit("audio:ready");
    return ctx;
  }

  // the first gesture is what lets sound start at all
  ["pointerdown", "keydown", "touchstart"].forEach(function (name) {
    window.addEventListener(name, ensure, { passive: true });
  });

  /* ------------------------------------------------------------- building */

  /** A bus for one sound: placed left or right, with some of it sent to the room. */
  function openBus(pan, wet) {
    var input = ctx.createGain();
    var nodes = [input];
    var out = input;
    if (pan && ctx.createStereoPanner) {
      var panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan)) * 0.75;
      out.connect(panner);
      out = panner;
      nodes.push(panner);
    }
    out.connect(master);
    if (wet) {
      var send = ctx.createGain();
      send.gain.value = wet;
      out.connect(send);
      send.connect(reverbIn);
      nodes.push(send);
    }
    bus = input;
    busEnd = ctx.currentTime;
    return nodes;
  }

  /** One note. opts: slide (end frequency), delay, attack, filter (low-pass Hz),
   *  vib ([rate, depth in Hz]), steady (no pitch nudge). */
  function tone(freq, dur, type, vol, opts) {
    opts = opts || {};
    var bend = opts.steady ? 1 : pitch;
    var t = ctx.currentTime + (opts.delay || 0);
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq * bend, t);
    if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide * bend), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + (opts.attack || 0.006));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var head = osc;
    if (opts.filter) {
      var lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = opts.filter;
      osc.connect(lp);
      head = lp;
    }
    if (opts.vib) {
      var lfo = ctx.createOscillator();
      var depth = ctx.createGain();
      lfo.frequency.value = opts.vib[0];
      depth.gain.value = opts.vib[1];
      lfo.connect(depth);
      depth.connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    head.connect(gain);
    gain.connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    busEnd = Math.max(busEnd, t + dur + 0.05);
  }

  /** A burst of filtered noise. opts: filter, freq, sweep (end frequency), q, delay, attack. */
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
    src.playbackRate.value = pitch;
    filter.type = opts.filter || "bandpass";
    filter.frequency.setValueAtTime((opts.freq || 1500) * pitch, t);
    if (opts.sweep) filter.frequency.exponentialRampToValueAtTime(opts.sweep * pitch, t + dur);
    filter.Q.value = opts.q || 1;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + (opts.attack || 0.004));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
    busEnd = Math.max(busEnd, t + dur + 0.05);
  }

  /** Notes from the scale, one after another. */
  function run(steps, step, type, vol, from) {
    for (var i = 0; i < steps.length; i++) {
      tone(SCALE[Math.min(SCALE.length - 1, steps[i])] * (from || 1), step * 2.4, type, vol, { delay: i * step });
    }
  }

  /** A bell: a pure note with a quieter, inharmonic overtone, like struck metal. */
  function bell(freq, dur, vol, delay) {
    tone(freq, dur, "sine", vol, { delay: delay || 0 });
    tone(freq * 2.76, dur * 0.5, "sine", vol * 0.28, { delay: delay || 0 });
    tone(freq * 5.4, dur * 0.25, "sine", vol * 0.1, { delay: delay || 0 });
  }

  /** Three notes held together. */
  function chord(freqs, dur, type, vol, delay) {
    freqs.forEach(function (f, i) {
      tone(f, dur, type, vol, { delay: (delay || 0) + i * 0.012, attack: 0.02 });
    });
  }

  /* --------------------------------------------------------------- sounds */
  /* [how much goes to the room, the sound]. The room is what makes the big
     moments (level up, a rare find, the boss) feel big. */

  var SOUNDS = {
    // ----- menus
    click: [0, function () {
      tone(1250, 0.035, "sine", 0.11, { slide: 650 });
      noise(0.018, 0.04, { filter: "highpass", freq: 5000 });
    }],
    tab: [0.05, function () {
      tone(480, 0.09, "sine", 0.15, { slide: 860 });
      tone(960, 0.06, "sine", 0.035, { delay: 0.025 });
    }],
    deny: [0, function () {
      tone(240, 0.08, "square", 0.06, { slide: 170, filter: 1300 });
      tone(170, 0.13, "square", 0.06, { delay: 0.075, slide: 115, filter: 1100 });
    }],
    start: [0.3, function () {
      noise(0.4, 0.09, { filter: "bandpass", freq: 300, sweep: 3600, q: 0.8 });
      tone(196, 0.5, "triangle", 0.14, { delay: 0.12 });
      tone(294, 0.5, "triangle", 0.12, { delay: 0.18 });
      tone(392, 0.6, "triangle", 0.12, { delay: 0.24 });
      tone(784, 0.4, "sine", 0.05, { delay: 0.3 });
    }],
    equip: [0.12, function () {
      tone(170, 0.09, "sine", 0.16, { slide: 110 });
      noise(0.03, 0.1, { filter: "highpass", freq: 3500 });
      bell(1760, 0.22, 0.07, 0.03);
    }],
    upgrade: [0.28, function () {
      run([0, 2, 4, 5, 7], 0.055, "triangle", 0.15);
      bell(2093, 0.5, 0.07, 0.28);
      noise(0.3, 0.03, { filter: "highpass", freq: 6000, delay: 0.25 });
    }],
    talent: [0.3, function () {
      run([0, 1, 3, 4, 6], 0.065, "triangle", 0.14, 0.7);
      bell(1568, 0.6, 0.06, 0.33);
    }],
    coin: [0.15, function () {
      bell(1319, 0.14, 0.07);
      bell(1760, 0.3, 0.07, 0.065);
    }],
    gem: [0.12, function () {
      var now = performance.now();
      gemChain = now - gemAt < 380 ? Math.min(gemChain + 1, SCALE.length - 1) : 0;
      gemAt = now;
      var f = SCALE[gemChain] * 1.5;
      tone(f, 0.09, "sine", 0.065, { steady: true });
      tone(f * 2, 0.05, "triangle", 0.015, { steady: true });
    }],
    heal: [0.25, function () {
      tone(523, 0.3, "sine", 0.1, { attack: 0.04, vib: [6, 6] });
      tone(659, 0.32, "sine", 0.09, { delay: 0.07, attack: 0.04, vib: [6, 6] });
      tone(784, 0.36, "sine", 0.08, { delay: 0.14, attack: 0.04, vib: [6, 6] });
    }],
    forge: [0.35, function () {
      // two hammer blows on the anvil, then the new piece rings out
      for (var i = 0; i < 2; i++) {
        noise(0.08, 0.28, { filter: "bandpass", freq: 3400, q: 2, delay: i * 0.21 });
        tone(200, 0.2, "square", 0.12, { delay: i * 0.21, slide: 150, filter: 1200 });
        bell(1480, 0.45, 0.05, i * 0.21);
      }
      run([2, 4, 5, 7, 9], 0.07, "triangle", 0.14, 1);
      bell(2349, 0.7, 0.06, 0.5);
    }],
    chestOpen: [0.2, function () {
      // a creaking lid over a low rumble, then the latch gives
      tone(110, 0.55, "sawtooth", 0.06, { slide: 160, filter: 700, vib: [11, 9] });
      noise(0.6, 0.22, { filter: "lowpass", freq: 260, sweep: 110 });
      noise(0.04, 0.15, { filter: "bandpass", freq: 2600, delay: 0.55 });
      tone(330, 0.08, "square", 0.05, { delay: 0.55, filter: 1500 });
    }],
    // rarer finds get a longer, brighter fanfare; the rarest a choir and a boom
    reveal: [0.4, function (rarity) {
      var r = rarity || 0;
      var count = 3 + r;
      var notes = [];
      for (var i = 0; i < count; i++) notes.push(i);
      run(notes, 0.07, "triangle", 0.15);
      var end = count * 0.07;
      bell(SCALE[Math.min(SCALE.length - 1, count + 1)], 0.6 + r * 0.1, 0.07, end);
      if (r >= 3) noise(0.6, 0.05, { filter: "highpass", freq: 6000, delay: end });
      if (r >= 4) {
        tone(120, 0.9, "sine", 0.28, { delay: 0.04, slide: 50 });
        chord([523.25, 659.25, 783.99], 1.2, "sine", 0.05, end);
      }
      if (r >= 6) {
        // a shimmering choir: slightly detuned pairs
        chord([1046.5, 1318.51, 1567.98], 1.6, "sine", 0.035, end + 0.1);
        chord([1049, 1322, 1572], 1.6, "sine", 0.035, end + 0.1);
      }
    }],

    // ----- in battle
    shoot: [0, function (weapon) {
      switch (FAMILY[weapon] || "pew") {
        case "twang":
          tone(340, 0.12, "triangle", 0.05, { slide: 300 });
          noise(0.03, 0.03, { filter: "highpass", freq: 3200 });
          break;
        case "swish":
          noise(0.13, 0.06, { filter: "bandpass", freq: 500, sweep: 3800, q: 1.3, attack: 0.02 });
          break;
        case "flick":
          noise(0.05, 0.035, { filter: "bandpass", freq: 4200, q: 1.5 });
          tone(1500, 0.04, "triangle", 0.018, { slide: 900 });
          break;
        case "heavy":
          tone(115, 0.13, "sine", 0.12, { slide: 60 });
          noise(0.09, 0.05, { filter: "lowpass", freq: 900 });
          break;
        case "magic":
          tone(880, 0.13, "sine", 0.035, { slide: 1400, vib: [18, 30] });
          tone(1760, 0.08, "sine", 0.014, { delay: 0.02 });
          break;
        default:
          noise(0.045, 0.035, { filter: "bandpass", freq: 2600 });
          tone(950, 0.06, "square", 0.018, { slide: 420, filter: 2600 });
      }
    }],
    hit: [0, function (crit) {
      tone(230, 0.05, "sine", 0.055, { slide: 120 });
      noise(0.03, 0.04, { filter: "bandpass", freq: 1800 });
      if (crit) {
        tone(2500, 0.13, "sine", 0.045);
        tone(3750, 0.07, "sine", 0.018);
      }
    }],
    kill: [0, function (combo) {
      // a squishy pop that climbs a little as a combo builds
      var up = 1 + Math.min(combo || 0, 50) * 0.012;
      noise(0.07, 0.06, { filter: "lowpass", freq: 1500, sweep: 320 });
      tone(400 * up, 0.08, "sine", 0.06, { slide: 160 * up });
    }],
    hurt: [0.08, function () {
      tone(70, 0.22, "sine", 0.22, { slide: 45 });
      tone(150, 0.2, "sawtooth", 0.12, { slide: 75, filter: 900 });
      noise(0.13, 0.15, { filter: "lowpass", freq: 700 });
    }],
    boom: [0.25, function () {
      tone(95, 0.45, "sine", 0.3, { slide: 36 });
      noise(0.5, 0.24, { filter: "lowpass", freq: 1300, sweep: 110 });
      noise(0.25, 0.05, { filter: "highpass", freq: 3200, delay: 0.04 });
    }],
    zap: [0.12, function () {
      noise(0.14, 0.08, { filter: "highpass", freq: 3600 });
      tone(1150, 0.1, "sawtooth", 0.035, { slide: 210, filter: 4200 });
      tone(1700, 0.06, "square", 0.016, { delay: 0.03, filter: 5000 });
    }],
    levelup: [0.35, function () {
      run([2, 4, 5, 7, 9], 0.055, "triangle", 0.17, 0.75);
      bell(1568, 0.5, 0.06, 0.28);
      noise(0.35, 0.03, { filter: "highpass", freq: 6500, delay: 0.25 });
    }],
    pick: [0.2, function () {
      tone(660, 0.07, "triangle", 0.16);
      tone(990, 0.16, "triangle", 0.16, { delay: 0.06 });
      bell(1980, 0.25, 0.04, 0.1);
    }],
    boss: [0.45, function () {
      // a low brass swell, two drum hits and a rumble
      tone(55, 1.4, "sawtooth", 0.2, { slide: 49, filter: 600, attack: 0.15 });
      tone(82.4, 1.4, "sawtooth", 0.13, { slide: 73, filter: 700, attack: 0.15 });
      tone(110, 1.2, "square", 0.05, { filter: 500, attack: 0.2 });
      for (var i = 0; i < 2; i++) {
        tone(80, 0.35, "sine", 0.3, { delay: i * 0.32, slide: 40 });
        noise(0.12, 0.12, { filter: "lowpass", freq: 600, delay: i * 0.32 });
      }
      noise(1.2, 0.16, { filter: "lowpass", freq: 260, sweep: 80 });
    }],
    revive: [0.45, function () {
      tone(220, 0.55, "triangle", 0.16, { slide: 880 });
      noise(0.5, 0.05, { filter: "bandpass", freq: 600, sweep: 5000, q: 0.7 });
      chord([659.25, 830.61, 987.77], 0.9, "sine", 0.06, 0.45);
    }],
    win: [0.45, function () {
      run([0, 2, 4, 5, 7], 0.1, "triangle", 0.18, 1);
      chord([SCALE[7], SCALE[5], SCALE[3]], 1.2, "triangle", 0.11, 0.52);
      chord([SCALE[7] / 2, SCALE[5] / 2], 1.2, "sine", 0.08, 0.52);
      bell(SCALE[9], 1, 0.06, 0.6);
    }],
    lose: [0.4, function () {
      var down = [392, 349.23, 311.13, 261.63];
      for (var i = 0; i < down.length; i++) tone(down[i], 0.5, "triangle", 0.16, { delay: i * 0.22, filter: 1800 });
      tone(130.81, 1.2, "sine", 0.12, { delay: 0.66, attack: 0.05 });
    }]
  };

  /* ------------------------------------------------------------------- api */

  /* the two groups Settings can switch off on their own */
  var COMBAT = { shoot: 1, hit: 1, kill: 1, boom: 1, zap: 1 };
  var MENU = { click: 1, tab: 1, deny: 1 };

  /* For the music (music.js): the context once it exists, where to plug in,
     and the reverb send. */
  PS.audio = {
    get: function () { return ctx; },
    out: function () { return mixIn; },
    room: function () { return reverbIn; }
  };

  PS.sfx = {
    /** `arg` is passed to the sound (a rarity, a weapon, a crit, a combo);
     *  `pan` places it left or right, -1 to 1. */
    play: function (name, arg, pan) {
      if (!ctx || !enabled) return;
      var entry = SOUNDS[name];
      if (!entry) return;
      if (COMBAT[name] && !PS.prefs.get("combatSfx")) return;
      if (MENU[name] && !PS.prefs.get("menuSfx")) return;
      var gap = GAP[name];
      if (gap) {
        var now = performance.now();
        if (now - (lastAt[name] || 0) < gap) return;
        lastAt[name] = now;
      }
      if (ctx.state === "suspended") ctx.resume();
      try {
        var nodes = openBus(pan, entry[0]);
        pitch = 1 + (Math.random() - 0.5) * 0.07;
        entry[1](arg);
        // let the bus go once its last note is over (the room keeps its own tail)
        var life = Math.max(0.1, busEnd - ctx.currentTime) + 0.1;
        setTimeout(function () {
          nodes.forEach(function (node) { node.disconnect(); });
        }, life * 1000);
      } catch (err) {
        // a sound that cannot be built is simply not heard; kept for debugging
        PS.sfx.lastError = name + ": " + err.message;
      }
      bus = null;
      pitch = 1;
    },
    on: function () { return enabled; },
    /** Apply the volume chosen in Settings. */
    refreshVolume: function () {
      if (master) master.gain.value = PS.prefs.gain();
    },
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
