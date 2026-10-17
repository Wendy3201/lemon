/*!
 * Pip Survivors — music
 * Three songs, written as patterns and played by a small synthesiser made
 * with the Web Audio API, so there are no music files either:
 *
 *   camp    the menus: slow and warm, soft keys over a lazy beat
 *   battle  a battle: quick and bright, driving bass and arpeggios
 *   boss    the boss: dark and heavy, in a minor key with brass stabs
 *
 *   PS.music.play("battle")   switches song (a short cross-fade)
 *   PS.music.duck(true)       quieter while the game is paused
 *
 * Each song is four chords that loop. Every four bars is a "section", and the
 * sections go round intro, full, full with the melody changed, breakdown, so
 * a few minutes in it still sounds like it is going somewhere. The melody is
 * made up as it plays, from the chord's notes, by a seeded random walk, so
 * each section's tune is the same every time it comes round.
 *
 * Notes are scheduled a little ahead of time on the audio clock (a lookahead
 * timer), which keeps the beat steady even when a frame takes long.
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function () {
  "use strict";

  var PS = window.PS;

  var ctx = null;
  var bus = null; // everything the music plays goes into this, for volume and fades
  var room = null; // the music's own reverb
  var noiseBuf = null;

  var want = null; // the song asked for
  var song = null; // the song playing
  var timer = 0;
  var nextAt = 0; // audio-clock time of the next 16th note
  var step = 0; // 16th notes since the song started
  var ducked = false;
  var hidden = false;

  var AHEAD = 0.14; // seconds of music scheduled ahead of the clock
  var TICK = 30; // milliseconds between scheduler runs

  function hz(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /* -------------------------------------------------------- instruments */
  /* Each takes the audio-clock time to play at. `out` is where it plugs in:
     the dry bus, with some of the pretty parts also sent to the room. */

  function env(gain, t, peak, attack, hold, release) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    gain.gain.setValueAtTime(Math.max(0.0002, peak), t + attack + hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    return t + attack + hold + release;
  }

  function voice(t, freq, type, peak, attack, hold, release, opts) {
    opts = opts || {};
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (opts.detune) osc.detune.value = opts.detune;
    if (opts.slide) osc.frequency.exponentialRampToValueAtTime(opts.slide, t + attack + hold + release);
    var head = osc;
    if (opts.cutoff) {
      var lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.value = opts.q || 0.8;
      lp.frequency.setValueAtTime(opts.cutoff, t);
      // a filter that closes as the note dies: the "pluck" of a synth
      if (opts.closeTo) lp.frequency.exponentialRampToValueAtTime(opts.closeTo, t + attack + hold + release);
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
      lfo.stop(t + attack + hold + release + 0.05);
    }
    head.connect(gain);
    gain.connect(bus);
    if (opts.wet) {
      var send = ctx.createGain();
      send.gain.value = opts.wet;
      gain.connect(send);
      send.connect(room);
    }
    var end = env(gain, t, peak, attack, hold, release);
    osc.start(t);
    osc.stop(end + 0.05);
  }

  function hit(t, dur, peak, filter, freq, opts) {
    opts = opts || {};
    var src = ctx.createBufferSource();
    var f = ctx.createBiquadFilter();
    var gain = ctx.createGain();
    src.buffer = noiseBuf;
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = opts.q || 0.9;
    src.connect(f);
    f.connect(gain);
    gain.connect(bus);
    if (opts.wet) {
      var send = ctx.createGain();
      send.gain.value = opts.wet;
      gain.connect(send);
      send.connect(room);
    }
    env(gain, t, peak, 0.002, 0, dur);
    src.start(t, Math.random() * 0.8);
    src.stop(t + dur + 0.05);
  }

  var INST = {
    kick: function (t, v) { voice(t, 150, "sine", 0.9 * v, 0.002, 0.02, 0.28, { slide: 42 }); },
    soft: function (t, v) { voice(t, 110, "sine", 0.5 * v, 0.004, 0.01, 0.22, { slide: 50 }); },
    snare: function (t, v) {
      hit(t, 0.16, 0.32 * v, "bandpass", 1900, { wet: 0.25 });
      voice(t, 200, "triangle", 0.22 * v, 0.002, 0, 0.09, { slide: 140 });
    },
    clap: function (t, v) {
      for (var i = 0; i < 3; i++) hit(t + i * 0.012, 0.09 + i * 0.03, 0.2 * v, "bandpass", 1300, { wet: 0.3 });
    },
    rim: function (t, v) { voice(t, 1700, "triangle", 0.09 * v, 0.001, 0, 0.04); },
    hat: function (t, v) { hit(t, 0.035, 0.11 * v, "highpass", 7500); },
    open: function (t, v) { hit(t, 0.16, 0.09 * v, "highpass", 6800); },
    tom: function (t, v, midi) { voice(t, hz(midi || 45), "sine", 0.5 * v, 0.003, 0.02, 0.3, { slide: hz((midi || 45) - 7) }); },
    bass: function (t, v, midi, len) {
      voice(t, hz(midi), "sawtooth", 0.2 * v, 0.006, len * 0.5, len * 0.5 + 0.05, { cutoff: 900, closeTo: 220, q: 2 });
      voice(t, hz(midi - 12), "sine", 0.22 * v, 0.006, len * 0.6, 0.08);
    },
    softBass: function (t, v, midi, len) { voice(t, hz(midi), "triangle", 0.26 * v, 0.02, len * 0.6, 0.2, { cutoff: 700 }); },
    pad: function (t, v, chord, len) {
      chord.forEach(function (midi, i) {
        voice(t, hz(midi), "triangle", 0.045 * v, 0.35, len - 0.35, 0.6, { cutoff: 1500, detune: i % 2 ? 6 : -6, wet: 0.5 });
      });
    },
    keys: function (t, v, midi, len) {
      voice(t, hz(midi), "sine", 0.1 * v, 0.004, 0.02, Math.max(0.25, len), { wet: 0.45 });
      voice(t, hz(midi + 12), "sine", 0.018 * v, 0.003, 0, 0.18, { wet: 0.45 });
    },
    pluck: function (t, v, midi) { voice(t, hz(midi), "square", 0.045 * v, 0.003, 0, 0.16, { cutoff: 3200, closeTo: 600, wet: 0.25 }); },
    lead: function (t, v, midi, len) {
      voice(t, hz(midi), "square", 0.05 * v, 0.01, len * 0.7, 0.12, { cutoff: 2600, vib: [5.5, 4], wet: 0.35 });
      voice(t, hz(midi), "sawtooth", 0.025 * v, 0.01, len * 0.7, 0.12, { cutoff: 1800, detune: 9, wet: 0.35 });
    },
    flute: function (t, v, midi, len) { voice(t, hz(midi), "sine", 0.07 * v, 0.04, len * 0.6, 0.25, { vib: [5, 5], wet: 0.5 }); },
    stab: function (t, v, chord) {
      chord.forEach(function (midi, i) {
        voice(t, hz(midi), "sawtooth", 0.05 * v, 0.006, 0.05, 0.22, { cutoff: 2400, closeTo: 500, detune: i ? 5 : -5, wet: 0.3 });
      });
    }
  };

  /* ---------------------------------------------------------------- songs */
  /* Patterns are 16 characters, one per 16th note of a bar: "x" plays, "o"
     plays quieter, "." rests. Chords are MIDI note numbers. */

  var SONGS = {
    camp: {
      bpm: 84, swing: 0.16, master: 0.9,
      // Fmaj7 - Em7 - Dm7 - Cmaj7, in C
      chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],
      scale: [0, 2, 4, 5, 7, 9, 11], root: 60,
      drums: { soft: "x.......x.x.....", rim: "....x.......x...", hat: "x.o.x.o.x.o.x.oo" },
      bass: "softBass", bassRhythm: "x.......x...x...",
      chordPart: "pad", arp: "keys", arpRhythm: "x..x..x.x..x..x.", arpOctave: 12,
      lead: "flute", leadRhythm: "x.....x...x.....", leadOctave: 12
    },
    battle: {
      bpm: 128, swing: 0, master: 0.8,
      // Am - F - C - G
      chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
      scale: [0, 2, 3, 5, 7, 8, 10], root: 57,
      drums: { kick: "x...x...x...x...", snare: "....x.......x...", hat: "o.x.o.x.o.x.o.xx", open: "..............x." },
      bass: "bass", bassRhythm: "x.xxx.xxx.xxx.xx",
      chordPart: "pad", arp: "pluck", arpRhythm: "xxxxxxxxxxxxxxxx", arpOctave: 12,
      lead: "lead", leadRhythm: "x..x..x.x...x.x.", leadOctave: 12
    },
    boss: {
      bpm: 142, swing: 0, master: 0.85,
      // Dm - Bb - Gm - A (the A major lifts it back into the loop)
      chords: [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]],
      scale: [0, 2, 3, 5, 7, 8, 11], root: 62,
      drums: { kick: "x..x..x.x..x..x.", clap: "....x.......x...", hat: "xoxoxoxoxoxoxoxo", tom: "............x.xx" },
      bass: "bass", bassRhythm: "xxxxxxxxxxxxxxxx",
      chordPart: "stab", stabRhythm: "x..x..x...x..x..", arp: "pluck", arpRhythm: "x.x.x.x.x.x.x.x.", arpOctave: 24,
      lead: "lead", leadRhythm: "x...x.x.x...x...", leadOctave: 12
    }
  };

  /* a tiny seeded random, so a section's tune is the same each time round */
  function seeded(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /** The nearest note of the song's scale at or above `midi`. */
  function inScale(S, midi) {
    for (var up = 0; up < 12; up++) {
      var n = midi + up;
      if (S.scale.indexOf(((n - S.root) % 12 + 12) % 12) !== -1) return n;
    }
    return midi;
  }

  /** The melody for one bar: on strong beats a chord note, between them a
   *  step or two along the scale from the last note. */
  function melody(S, bar, phrase) {
    var rnd = seeded(phrase * 977 + bar * 131 + S.bpm);
    var chord = S.chords[bar % S.chords.length];
    var notes = {};
    var last = chord[1] + S.leadOctave;
    for (var i = 0; i < 16; i++) {
      if (S.leadRhythm.charAt(i) !== "x") continue;
      if (i % 4 === 0) {
        last = chord[Math.floor(rnd() * chord.length)] + S.leadOctave + (rnd() < 0.3 ? 12 : 0);
      } else {
        var degree = Math.floor(rnd() * 5) - 2;
        last = inScale(S, last + degree * 2);
      }
      notes[i] = last;
    }
    return notes;
  }

  /* ------------------------------------------------------------ the player */

  function stepLength(S) {
    return 60 / S.bpm / 4;
  }

  /** Play every part due on one 16th note. */
  function playStep(S, t) {
    var len = stepLength(S);
    var inBar = step % 16;
    var bar = Math.floor(step / 16);
    var chord = S.chords[bar % S.chords.length];
    var section = Math.floor(bar / 4) % 4; // 0 intro, 1 full, 2 full + new tune, 3 breakdown
    var phrase = Math.floor(bar / 16) * 2 + (section === 2 ? 1 : 0);
    // swing pushes every other 16th a touch late, for a laid-back feel
    if (S.swing && inBar % 2) t += len * S.swing;

    // drums: only the hats for the intro's first two bars, no kick in the breakdown
    var heavy = { kick: 1, soft: 1, snare: 1, clap: 1, tom: 1 };
    Object.keys(S.drums).forEach(function (name) {
      var mark = S.drums[name].charAt(inBar);
      if (mark === ".") return;
      if (section === 0 && bar % 4 < 2 && heavy[name]) return;
      if (section === 3 && (name === "kick" || name === "soft")) return;
      INST[name](t, mark === "x" ? 1 : 0.55, name === "tom" ? 45 - (inBar % 4) * 3 : undefined);
    });
    // a snare fill on the last beat of every fourth bar
    if (section !== 3 && bar % 4 === 3 && inBar >= 12 && S.drums.snare && inBar % 2 === 0) INST.snare(t, 0.6);

    // bass on the chord's root
    if (S.bassRhythm.charAt(inBar) === "x" && section !== 0) {
      var root = chord[0] - 12 + (inBar % 8 === 6 && S === SONGS.battle ? 12 : 0);
      INST[S.bass](t, 1, root, len * 1.6);
    }

    // the chord: held pads once a bar, or rhythmic stabs
    if (S.chordPart === "pad" && inBar === 0) INST.pad(t, 1, chord, len * 16);
    if (S.chordPart === "stab" && S.stabRhythm.charAt(inBar) === "x") INST.stab(t, 1, chord.map(function (n) { return n + 12; }));

    // arpeggio: up and down the chord
    if (S.arpRhythm.charAt(inBar) === "x" && section !== 3) {
      var order = [0, 1, 2, 1];
      var note = chord[order[(inBar >> (S.arpRhythm === "xxxxxxxxxxxxxxxx" ? 0 : 1)) % order.length] % chord.length] + S.arpOctave;
      INST[S.arp](t, section === 0 ? 0.6 : 1, note, len * 2);
    }

    // melody: from the first full section on
    if (section === 1 || section === 2 || (section === 3 && S === SONGS.camp)) {
      var line = melody(S, bar, phrase);
      if (line[inBar] !== undefined) {
        var hold = 1;
        while (inBar + hold < 16 && S.leadRhythm.charAt(inBar + hold) === ".") hold++;
        INST[S.lead](t, 1, line[inBar], len * Math.min(hold, 4));
      }
    }
  }

  function schedule() {
    if (!song || !ctx) return;
    var S = SONGS[song];
    var on = PS.prefs.get("music");
    while (nextAt < ctx.currentTime + AHEAD) {
      // switched off in Settings: keep time, play nothing
      if (on) playStep(S, nextAt);
      nextAt += stepLength(S);
      step++;
    }
  }

  function level() {
    if (!PS.prefs.get("music") || hidden || !song) return 0.0001;
    var v = (PS.prefs.get("musicVol") / 100) * 0.55 * SONGS[song].master;
    return Math.max(0.0001, ducked ? v * 0.35 : v);
  }

  /** Glide the music's volume to where it should be. */
  function fadeTo(value, seconds) {
    if (!bus) return;
    var now = ctx.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), now);
    bus.gain.exponentialRampToValueAtTime(Math.max(0.0001, value), now + seconds);
  }

  function build() {
    if (ctx) return true;
    ctx = PS.audio && PS.audio.get();
    if (!ctx || !PS.audio.out()) {
      ctx = null;
      return false;
    }
    bus = ctx.createGain();
    bus.gain.value = 0.0001;
    bus.connect(PS.audio.out());
    room = ctx.createConvolver();
    var length = Math.floor(ctx.sampleRate * 2.2);
    var buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var data = buffer.getChannelData(ch);
      for (var i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.6);
    }
    room.buffer = buffer;
    var wet = ctx.createGain();
    wet.gain.value = 0.55;
    room.connect(wet);
    wet.connect(bus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var n = noiseBuf.getChannelData(0);
    for (var j = 0; j < n.length; j++) n[j] = Math.random() * 2 - 1;
    return true;
  }

  /** Start (or switch to) the song asked for, once sound is allowed at all. */
  function start() {
    if (!want || !build()) return;
    if (song === want && timer) return;
    var switching = Boolean(song && song !== want);
    var begin = function () {
      song = want;
      step = 0;
      nextAt = ctx.currentTime + 0.08;
      clearInterval(timer);
      timer = setInterval(schedule, TICK);
      schedule();
      fadeTo(level(), switching ? 0.8 : 1.6);
    };
    if (switching) {
      // fade the old song out, then bring the new one in
      fadeTo(0.0001, 0.45);
      clearInterval(timer);
      timer = 0;
      setTimeout(function () {
        if (want) begin();
      }, 480);
    } else {
      begin();
    }
  }

  PS.music = {
    SONGS: Object.keys(SONGS),
    /** "camp", "battle", "boss", or null for silence. */
    play: function (name) {
      if (name && !SONGS[name]) return;
      if (name === want && (song === name || !ctx)) return;
      want = name;
      if (!name) {
        fadeTo(0.0001, 0.6);
        setTimeout(function () {
          if (!want) {
            clearInterval(timer);
            timer = 0;
            song = null;
          }
        }, 650);
        return;
      }
      start();
    },
    /** Quieter while paused. */
    duck: function (on) {
      ducked = Boolean(on);
      if (song) fadeTo(level(), 0.3);
    },
    /** Settings changed (on/off or volume). */
    refresh: function () {
      if (song) fadeTo(level(), 0.15);
    },
    playing: function () { return song; },
    /** For testing: skip ahead to a bar, to hear later sections without waiting. */
    jumpTo: function (bar) { step = Math.max(0, Math.floor(bar)) * 16; }
  };

  // sound may only start after a click or key press
  PS.on("audio:ready", start);

  // a hidden tab slows timers right down, which would stutter the beat: go quiet instead
  document.addEventListener("visibilitychange", function () {
    hidden = document.hidden;
    if (!ctx || !song) return;
    if (hidden) {
      fadeTo(0.0001, 0.2);
      clearInterval(timer);
      timer = 0;
    } else {
      nextAt = ctx.currentTime + 0.08;
      clearInterval(timer);
      timer = setInterval(schedule, TICK);
      fadeTo(level(), 0.8);
    }
  });
})();
