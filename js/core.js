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

  /* ------------------------------------------------------------ dev access */
  /* Unlocked once per browser tab by the developer password (the "?" on the
     construction page or in the footer). While unlocked, battles show a DEV
     button and the lobby's dev menu opens without asking again. */

  var KEY_DEV = "lemon:dev";
  var devOn = false;
  try { devOn = sessionStorage.getItem(KEY_DEV) === "1"; } catch (err) { /* blocked */ }

  PS.dev = {
    password: "howdidyoufindit",
    unlocked: devOn,
    // switches the battle looks at; they reset whenever a battle starts
    cheats: { god: false, oneHit: false, speed: 1 },
    unlock: function () {
      PS.dev.unlocked = true;
      try { sessionStorage.setItem(KEY_DEV, "1"); } catch (err) { /* blocked */ }
      PS.emit("dev");
    }
  };
})(window);
