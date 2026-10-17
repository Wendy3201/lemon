/*!
 * Pip Survivors — core helpers
 * The PS namespace, guarded storage, a tiny event bus, maths and formatting.
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function (global) {
  "use strict";

  var PS = global.PS || (global.PS = {});

  /* -------------------------------------------------------------- storage */
  /* Every read and write is guarded: private windows and blocked site data
     must not break the game, it just forgets its progress when the tab closes. */

  var storageWorks = (function () {
    try {
      var probe = "__lemon_probe__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      return true;
    } catch (err) {
      return false;
    }
  })();

  PS.store = {
    available: storageWorks,
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (err) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (err) {
        return false;
      }
    }
  };

  /* --------------------------------------------------------------- events */

  var listeners = Object.create(null);

  PS.on = function (name, fn) {
    (listeners[name] || (listeners[name] = [])).push(fn);
  };

  PS.emit = function (name, a, b) {
    var list = listeners[name];
    if (!list) return;
    for (var i = 0; i < list.length; i++) list[i](a, b);
  };

  /* ---------------------------------------------------------------- maths */

  PS.clamp = function (value, min, max) {
    return value < min ? min : value > max ? max : value;
  };
  PS.lerp = function (a, b, t) {
    return a + (b - a) * t;
  };
  PS.rand = function (min, max) {
    return min + Math.random() * (max - min);
  };

  /** Pick one entry by weight. `weights` lines up with `list`; `roll` is 0..1. */
  PS.weighted = function (list, weights, roll) {
    var total = 0;
    var i;
    for (i = 0; i < weights.length; i++) total += weights[i];
    var at = (roll === undefined ? Math.random() : roll) * total;
    for (i = 0; i < list.length; i++) {
      at -= weights[i];
      if (at < 0) return list[i];
    }
    return list[list.length - 1];
  };

  /** Smallest signed turn from angle a to angle b, in -PI..PI. */
  PS.angleDiff = function (a, b) {
    var d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  };

  /** A repeatable random stream (mulberry32), for things like the daily deals. */
  PS.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  PS.hash = function (text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  /* ----------------------------------------------------------- formatting */

  function group(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  /** 1234 -> "1,234", 12345 -> "12.3K", 1234567 -> "1.23M". Always rounds
   *  down, so a price never looks affordable when it is not. */
  PS.fmt = function (value) {
    var n = Math.floor(value + 1e-9);
    if (n < 0) return "-" + PS.fmt(-n);
    if (n < 10000) return group(n);
    var units = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
    for (var i = 0; i < units.length; i++) {
      if (n >= units[i][0]) {
        var scaled = n / units[i][0];
        var digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
        var factor = Math.pow(10, digits);
        return (Math.floor(scaled * factor + 1e-9) / factor).toFixed(digits) + units[i][1];
      }
    }
    return group(n);
  };

  /** A stat that can be small: one decimal below 100, whole numbers above. */
  PS.fmtStat = function (value) {
    if (value >= 100) return PS.fmt(Math.round(value));
    var rounded = Math.round(value * 10) / 10;
    return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
  };

  /** 0.125 -> "12.5%", 0.1 -> "10%", 0.0005 -> "0.05%". */
  PS.pct = function (fraction) {
    var places = Math.abs(fraction) < 0.01 ? 100 : 10;
    return String(Math.round(fraction * 100 * places) / places) + "%";
  };

  PS.clock = function (seconds) {
    var total = Math.max(0, Math.floor(seconds));
    var rest = total % 60;
    return Math.floor(total / 60) + ":" + (rest < 10 ? "0" : "") + rest;
  };

  /** "3h 12m", "4m 05s", "12s" — for the free gift countdown. */
  PS.countdown = function (ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var r = s % 60;
    if (h) return h + "h " + (m < 10 ? "0" : "") + m + "m";
    if (m) return m + "m " + (r < 10 ? "0" : "") + r + "s";
    return r + "s";
  };

  PS.esc = function (text) {
    return String(text).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  };

  /* ---------------------------------------------------------------- theme */

  PS.palette = {
    lemon: "#F7D94C",
    bright: "#FFE66D",
    pale: "#FFF4B8",
    cream: "#FFF9E6",
    white: "#FFFCF2",
    charcoal: "#29261F",
    brown: "#6F654F",
    green: "#8FAE65",
    rind: "#E0B93C"
  };

  /** "auto" follows the device, "on" always animates, "off" never does. */
  PS.motionMode = function () {
    var mode = PS.store.get("lemon:motion", "auto");
    return mode === "on" || mode === "off" ? mode : "auto";
  };

  PS.reducedMotion = function () {
    var mode = PS.motionMode();
    if (mode !== "auto") return mode === "off";
    return Boolean(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);
  };

  /* ---------------------------------------------------------- preferences */
  /* Small switches from the Settings pop-up. Each is saved on its own. */

  /* true / false switches, and numbers (vol 0 to 100, quality 0 to 2, fps 0 for
     no limit or 30 / 60). `volume` is the old three-step volume: it is only read
     to carry an earlier choice over to `vol`. */
  var PREFS = {
    volume: 1, vol: 55, quality: 2, fps: 0,
    shake: true, numbers: true, autopause: true,
    combatSfx: true, menuSfx: true, showFps: false, blur: true
  };
  var RANGES = { vol: [0, 100], quality: [0, 2], fps: [0, 60] };

  PS.VOLUMES = [{ name: "Low", gain: 0.25 }, { name: "Medium", gain: 0.5 }, { name: "High", gain: 0.85 }];
  /* what each old volume step becomes on the 0 to 100 scale */
  PS.VOLUME_STEPS = [28, 55, 94];

  var prefCache = {}; // read many times a second in battle, so only storage is slow

  function readPref(name) {
    var fallback = PREFS[name];
    if (name === "vol") {
      var old = PS.store.get("lemon:pref:volume", null);
      if (old === 0 || old === 1 || old === 2) fallback = PS.VOLUME_STEPS[old];
    }
    var value = PS.store.get("lemon:pref:" + name, fallback);
    if (RANGES[name]) {
      return typeof value === "number" && isFinite(value) ? PS.clamp(Math.round(value), RANGES[name][0], RANGES[name][1]) : fallback;
    }
    if (name === "volume") return value === 0 || value === 1 || value === 2 ? value : PREFS.volume;
    return value !== false;
  }

  PS.prefs = {
    get: function (name) {
      if (!(name in prefCache)) prefCache[name] = readPref(name);
      return prefCache[name];
    },
    set: function (name, value) {
      PS.store.set("lemon:pref:" + name, value);
      delete prefCache[name];
    },
    /** The master gain for sound, from the 0 to 100 volume. */
    gain: function () {
      return (PS.prefs.get("vol") / 100) * 0.9;
    },
    /** Every setting from the Settings pop-up back to how it came. */
    reset: function () {
      Object.keys(PREFS).forEach(function (name) {
        if (name === "volume") return;
        PS.prefs.set(name, PREFS[name]);
      });
    }
  };

  /* ------------------------------------------------------------ dev access */
  /* Unlocked once per browser tab by the developer password (the "?" on the
     construction page or in the footer). While unlocked, battles show a DEV
     button and the lobby's dev menu opens without asking again. */

  /* Two levels. The dev password (level 1) opens the battle tools: the Battle
     section of the lobby dev menu and the DEV panel inside a battle. The admin
     password (level 2) opens everything, and it can only be asked for after
     the secret key code (see ui.js) has been typed. */
  var KEY_DEV = "lemon:dev";
  var devLevel = 0;
  try { devLevel = Number(sessionStorage.getItem(KEY_DEV)) || 0; } catch (err) { /* blocked */ }
  if (devLevel !== 1 && devLevel !== 2) devLevel = 0;

  /* The switches a battle can run with. Both the DEV panel inside a battle and
     the lobby's "start the next battle with" card are drawn from these lists, so
     a new cheat only has to be added here (and in the engine that reads it).
     `admin` ones are only offered with the admin password. A multiplier row
     shows `values`, and `more` as well for the admin. */
  var TOGGLES = [
    { key: "god", label: "Godmode", hint: "Nothing can hurt you" },
    { key: "oneHit", label: "One-hit kills", hint: "Every hit kills, bosses too" },
    { key: "freeze", label: "Freeze the pests", hint: "They stand still and never attack", admin: true },
    { key: "noSpawn", label: "Stop spawning", hint: "No new pests, hordes or elites", admin: true },
    { key: "vacuum", label: "Vacuum", hint: "Every gem and coin flies to you", admin: true }
  ];
  var MULTS = [
    { key: "speed", label: "Game speed", values: [0.5, 1, 2, 4], more: [8] },
    { key: "dmgMul", label: "Damage", values: [1], more: [2, 5, 10, 100, 1000], admin: true },
    { key: "hasteMul", label: "Attack speed", values: [1], more: [2, 4, 8], admin: true },
    { key: "moveMul", label: "Move speed", values: [1], more: [1.5, 2, 3], admin: true },
    { key: "xpMul", label: "Experience gained", values: [1], more: [2, 5, 10, 50], admin: true }
  ];
  function cheatDefaults() {
    var out = {};
    TOGGLES.forEach(function (t) { out[t.key] = false; });
    MULTS.forEach(function (m) { out[m.key] = 1; });
    return out;
  }
  /* the admin can also start a battle already levelled up, or with every upgrade taken */
  function buildDefaults() {
    return { levels: 0, maxAll: false };
  }

  PS.dev = {
    password: "3.1415925",
    adminPassword: "3.1415926",
    level: devLevel,
    unlocked: devLevel >= 1,
    admin: devLevel >= 2,
    TOGGLES: TOGGLES,
    MULTS: MULTS,
    // switches the battle looks at; they reset whenever a battle starts
    cheats: cheatDefaults(),
    // what the next battle starts with (set in the lobby dev menu's Battle section)
    startWith: cheatDefaults(),
    startBuild: buildDefaults(),
    /** level 1 (dev) or 2 (admin); never lowers a level that is already open */
    unlock: function (level) {
      level = level === 2 ? 2 : 1;
      if (level < PS.dev.level) return;
      PS.dev.level = level;
      PS.dev.unlocked = true;
      PS.dev.admin = level >= 2;
      try { sessionStorage.setItem(KEY_DEV, String(level)); } catch (err) { /* blocked */ }
      PS.emit("dev");
    },
    lock: function () {
      PS.dev.level = 0;
      PS.dev.unlocked = false;
      PS.dev.admin = false;
      // nothing the admin switched on may carry over into ordinary play
      PS.dev.cheats = cheatDefaults();
      PS.dev.startWith = cheatDefaults();
      PS.dev.startBuild = buildDefaults();
      try { sessionStorage.removeItem(KEY_DEV); } catch (err) { /* blocked */ }
      PS.emit("dev");
    }
  };
})(window);
