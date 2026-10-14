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

  var PREFS = { volume: 1, shake: true, numbers: true, autopause: true };

  PS.VOLUMES = [{ name: "Low", gain: 0.25 }, { name: "Medium", gain: 0.5 }, { name: "High", gain: 0.85 }];

  PS.prefs = {
    get: function (name) {
      var value = PS.store.get("lemon:pref:" + name, PREFS[name]);
      if (name === "volume") return value === 0 || value === 1 || value === 2 ? value : PREFS.volume;
      return value !== false;
    },
    set: function (name, value) {
      PS.store.set("lemon:pref:" + name, value);
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

  PS.dev = {
    password: "3.1415925",
    adminPassword: "3.1415926",
    level: devLevel,
    unlocked: devLevel >= 1,
    admin: devLevel >= 2,
    // switches the battle looks at; they reset whenever a battle starts
    cheats: { god: false, oneHit: false, speed: 1 },
    // what the next battle starts with (set in the lobby dev menu's Battle section)
    startWith: { god: false, oneHit: false, speed: 1 },
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
      try { sessionStorage.removeItem(KEY_DEV); } catch (err) { /* blocked */ }
      PS.emit("dev");
    }
  };
})(window);
