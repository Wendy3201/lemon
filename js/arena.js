/*!
 * Pip Survivors — the battlefield's look
 * Each of the ten zones gets its own ground: a pattern laid into the floor
 * (tiles, bricks, planks, furrows...), soft patches of light and shade, and
 * things scattered on it (flowers, mushrooms, crumbs, puddles, embers...).
 * Over the top go floating motes (pollen, dust, steam, embers, spores) that
 * drift at their own depth, a warm light around the lemon and a dark edge to
 * the screen. Pests get soft shadows so they sit on the ground.
 *
 * It is only looks. Low graphics quality leaves all of it out (battle.js then
 * draws the plain floor); medium leaves out the motes, the light and the
 * patches.
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function () {
  "use strict";

  var PS = window.PS;
  var B = PS.B;
  var TAU = Math.PI * 2;

  /* What each zone's ground is made of, in zone order (see PS.ZONES).
     pattern: what is laid in the floor. props: what is scattered on it,
     picked at random (a kind listed twice turns up twice as often).
     mote: what floats in the air. shade: how dark the screen edge is.
     glow: a coloured light that some floors give off. */
  var STYLES = [
    { pattern: null, props: ["tuft", "tuft", "flower", "flower", "leaf", "pebble", "apple"], mote: "pollen", motes: "255,240,170", shade: 0.42 },
    { pattern: "furrows", props: ["sprout", "sprout", "pebble", "tuft", "mushroom", "leaf"], mote: "pollen", motes: "255,226,170", shade: 0.42 },
    { pattern: "tiles", props: ["leaf", "leaf", "tuft", "puddle", "flower"], mote: "steam", motes: "205,255,240", shade: 0.4 },
    { pattern: "checker", props: ["crumb", "crumb", "pea", "spill"], mote: "dust", motes: "235,225,255", shade: 0.45 },
    { pattern: "bricks", props: ["pebble", "bottle", "cobweb", "crack"], mote: "dust", motes: "215,205,255", shade: 0.6 },
    { pattern: "planks", props: ["grain", "grain", "crumb", "pea", "spill"], mote: "dust", motes: "255,232,185", shade: 0.45 },
    { pattern: "planks", props: ["nail", "cobweb", "crack", "pebble"], mote: "dust", motes: "240,220,200", shade: 0.5 },
    { pattern: "tiles", props: ["puddle", "puddle", "grate", "pebble", "crack"], mote: "bubble", motes: "170,235,245", shade: 0.55 },
    { pattern: "cracks", props: ["ember", "ember", "crack", "pebble"], mote: "ember", motes: "255,150,80", shade: 0.5, glow: "255,110,50" },
    { pattern: null, props: ["spore", "spore", "root", "mushroom", "crack"], mote: "spore", motes: "220,150,255", shade: 0.55, glow: "190,90,230" }
  ];

  function hash(x, y) {
    var h = (Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }

  function style(R) {
    return STYLES[R.ch.zone] || STYLES[0];
  }

  /* ---------------------------------------------------- the floor pattern */

  function drawPattern(ctx, R, ox, oy, S) {
    var view = B.view;
    var w = view.w;
    var h = view.h;
    var x;
    var y;
    var size;
    ctx.save();
    if (S.pattern === "tiles" || S.pattern === "checker") {
      size = S.pattern === "tiles" ? 84 : 64;
      var sx = ((ox % size) + size) % size - size;
      var sy = ((oy % size) + size) % size - size;
      if (S.pattern === "checker") {
        // every other square a shade lighter, counted from the world's origin
        ctx.fillStyle = "rgba(255,255,255,0.03)";
        var col = Math.round((sx - ox) / size);
        var row0 = Math.round((sy - oy) / size);
        for (x = sx; x < w; x += size, col++) {
          var row = row0;
          for (y = sy; y < h; y += size, row++) {
            if ((col + row) & 1) ctx.fillRect(x, y, size, size);
          }
        }
      }
      ctx.strokeStyle = "rgba(0,0,0,0.22)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (x = sx; x < w; x += size) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (y = sy; y < h; y += size) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
      // a lit edge on every seam makes the tiles read as raised
      ctx.strokeStyle = "rgba(255,255,255,0.035)";
      ctx.beginPath();
      for (x = sx; x < w; x += size) {
        ctx.moveTo(x + 2, 0);
        ctx.lineTo(x + 2, h);
      }
      for (y = sy; y < h; y += size) {
        ctx.moveTo(0, y + 2);
        ctx.lineTo(w, y + 2);
      }
      ctx.stroke();
    } else if (S.pattern === "bricks" || S.pattern === "planks") {
      var tall = S.pattern === "bricks" ? 38 : 30;
      var long = S.pattern === "bricks" ? 76 : 180;
      var rowY = ((oy % tall) + tall) % tall - tall;
      var rowIndex = Math.floor((rowY - oy) / tall);
      ctx.strokeStyle = "rgba(0,0,0,0.26)";
      ctx.lineWidth = S.pattern === "bricks" ? 3 : 2;
      ctx.beginPath();
      for (y = rowY; y < h; y += tall, rowIndex++) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        // joints: bricks stagger every other row, planks wherever a plank ends
        var shift = S.pattern === "bricks" ? (rowIndex & 1) * (long / 2) : (hash(rowIndex, 7) % long);
        var jx = ((ox + shift) % long + long) % long - long;
        for (x = jx; x < w; x += long) {
          if (S.pattern === "planks" && hash(Math.floor((x - ox) / long), rowIndex) % 3 === 0) continue;
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + tall);
        }
      }
      ctx.stroke();
      if (S.pattern === "planks") {
        // wood grain: a faint line along each plank
        ctx.strokeStyle = "rgba(255,255,255,0.03)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (y = rowY; y < h; y += tall) {
          ctx.moveTo(0, y + tall * 0.55);
          ctx.lineTo(w, y + tall * 0.55);
        }
        ctx.stroke();
      }
    } else if (S.pattern === "furrows") {
      var gap = 52;
      var fy = ((oy % gap) + gap) % gap - gap;
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (y = fy; y < h + gap; y += gap) {
        for (x = -20; x <= w + 20; x += 20) {
          var wave = Math.sin((x - ox) * 0.03) * 3;
          if (x === -20) ctx.moveTo(x, y + wave);
          else ctx.lineTo(x, y + wave);
        }
      }
      ctx.stroke();
    } else if (S.pattern === "cracks") {
      // glowing seams in hot stone, fixed to the ground by a hash
      var cell = 160;
      var left = Math.floor(-ox / cell) - 1;
      var top = Math.floor(-oy / cell) - 1;
      var pulse = 0.55 + 0.45 * Math.sin(R.t * 2.2);
      for (var cx = left; cx <= left + Math.ceil(w / cell) + 1; cx++) {
        for (var cy = top; cy <= top + Math.ceil(h / cell) + 1; cy++) {
          var hh = hash(cx * 3 + 11, cy * 5 + 17);
          if (hh % 3) continue;
          var bx = cx * cell + ox + (hh >>> 3) % cell;
          var by = cy * cell + oy + (hh >>> 11) % cell;
          ctx.strokeStyle = "rgba(255," + (90 + (hh % 60)) + ",40," + (0.6 * pulse).toFixed(3) + ")";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          for (var k = 1; k <= 4; k++) ctx.lineTo(bx + k * 16 + ((hh >>> (k * 4)) % 14) - 7, by + ((hh >>> (k * 5)) % 30) - 15);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  /* ---------------------------------------------------- light and shade */

  function drawPatches(ctx, R, ox, oy, S) {
    var view = B.view;
    var cell = 320;
    var left = Math.floor(-ox / cell) - 1;
    var top = Math.floor(-oy / cell) - 1;
    var cols = Math.ceil(view.w / cell) + 2;
    var rows = Math.ceil(view.h / cell) + 2;
    var accent = R.zone.accent;
    for (var cx = left; cx <= left + cols; cx++) {
      for (var cy = top; cy <= top + rows; cy++) {
        var h = hash(cx + 911, cy - 377);
        var x = cx * cell + ox + (h >>> 4) % cell;
        var y = cy * cell + oy + (h >>> 12) % cell;
        var r = 120 + (h % 120);
        var light = h % 3 === 0;
        var g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, light ? B.rgba(accent, 0.14) : "rgba(0,0,0,0.22)");
        g.addColorStop(1, light ? B.rgba(accent, 0) : "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
  }

  /* ------------------------------------------------------------- props */

  function blob(ctx, x, y, rx, ry, angle) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, angle || 0, 0, TAU);
    ctx.fill();
  }

  /* Each draws one thing at (x, y). `h` is that spot's hash, for small
     differences in size, angle and colour; `Z` is the zone's colours. */
  var PROPS = {
    tuft: function (ctx, x, y, h, Z) {
      ctx.strokeStyle = B.tint(Z.accent, -0.2);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (var i = -2; i <= 2; i++) {
        var tall = 8 + ((h >>> (i + 3)) % 6);
        ctx.moveTo(x + i * 2.5, y);
        ctx.quadraticCurveTo(x + i * 3.5, y - tall * 0.6, x + i * 4.5, y - tall);
      }
      ctx.stroke();
    },
    flower: function (ctx, x, y, h) {
      var petals = ["#FFF4E0", "#FFB4C8", "#C8B4FF", "#FFE66D"][h % 4];
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      blob(ctx, x, y + 3, 6, 2);
      ctx.fillStyle = petals;
      for (var i = 0; i < 5; i++) {
        var a = (i / 5) * TAU + h;
        blob(ctx, x + Math.cos(a) * 3.2, y + Math.sin(a) * 3.2, 2.6, 2.6);
      }
      ctx.fillStyle = "#F2B93B";
      blob(ctx, x, y, 1.9, 1.9);
    },
    leaf: function (ctx, x, y, h, Z) {
      ctx.fillStyle = h % 2 ? B.tint(Z.accent, -0.25) : "#B7863F";
      blob(ctx, x, y, 8, 3.6, (h % 31) / 5);
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      var a = (h % 31) / 5;
      ctx.moveTo(x - Math.cos(a) * 7, y - Math.sin(a) * 7);
      ctx.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7);
      ctx.stroke();
    },
    pebble: function (ctx, x, y, h, Z) {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      blob(ctx, x + 1, y + 3, 8, 3);
      ctx.fillStyle = B.tint(Z.prop, 0.12 + (h % 3) * 0.06);
      blob(ctx, x, y, 7 + (h % 4), 5);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      blob(ctx, x - 2, y - 2, 3, 1.6);
    },
    apple: function (ctx, x, y) {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      blob(ctx, x, y + 6, 7, 2.4);
      ctx.fillStyle = "#C8453E";
      blob(ctx, x, y, 6.5, 6);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      blob(ctx, x - 2.5, y - 2.5, 2, 1.3);
      ctx.strokeStyle = "#5A3A1C";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x + 1.5, y - 9);
      ctx.stroke();
    },
    sprout: function (ctx, x, y, h, Z) {
      ctx.strokeStyle = B.tint(Z.accent, -0.1);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - 8);
      ctx.stroke();
      ctx.fillStyle = "#8FC46A";
      blob(ctx, x - 3.5, y - 9, 4, 2.2, -0.5);
      blob(ctx, x + 3.5, y - 9, 4, 2.2, 0.5);
    },
    mushroom: function (ctx, x, y, h) {
      var cap = ["#D9685A", "#E0C08A", "#B48CFF"][h % 3];
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      blob(ctx, x, y + 3, 7, 2.2);
      ctx.fillStyle = "#EFE4CC";
      ctx.fillRect(x - 2, y - 6, 4, 8);
      ctx.fillStyle = cap;
      ctx.beginPath();
      ctx.ellipse(x, y - 6, 7, 5, 0, Math.PI, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      blob(ctx, x - 3, y - 8, 1.2, 1.2);
      blob(ctx, x + 2, y - 9, 1, 1);
    },
    puddle: function (ctx, x, y, h, Z, R) {
      ctx.fillStyle = "rgba(120,190,220,0.14)";
      blob(ctx, x, y, 22 + (h % 12), 9 + (h % 5), (h % 7) / 10);
      ctx.strokeStyle = "rgba(200,240,255,0.18)";
      ctx.lineWidth = 1.2;
      // a ripple now and then
      var k = ((R.t + (h % 100) / 25) % 3) / 3;
      ctx.globalAlpha = 1 - k;
      ctx.beginPath();
      ctx.ellipse(x, y, 4 + k * 16, 2 + k * 6, 0, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },
    crumb: function (ctx, x, y, h) {
      ctx.fillStyle = h % 2 ? "#C79A5B" : "#E0C08A";
      for (var i = 0; i < 3; i++) blob(ctx, x + ((h >>> (i * 3)) % 12) - 6, y + ((h >>> (i * 4)) % 8) - 4, 2.2, 1.8);
    },
    pea: function (ctx, x, y) {
      ctx.fillStyle = "#7FB069";
      blob(ctx, x, y, 3.4, 3.4);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      blob(ctx, x - 1, y - 1, 1.1, 1.1);
    },
    spill: function (ctx, x, y, h) {
      ctx.fillStyle = ["rgba(255,240,200,0.10)", "rgba(200,60,60,0.12)", "rgba(240,200,90,0.12)"][h % 3];
      blob(ctx, x, y, 18, 10, (h % 9) / 3);
      blob(ctx, x + 12, y + 4, 7, 5);
    },
    grain: function (ctx, x, y, h) {
      ctx.fillStyle = "#E3B65B";
      for (var i = 0; i < 4; i++) blob(ctx, x + ((h >>> (i * 3)) % 14) - 7, y + ((h >>> (i * 5)) % 10) - 5, 2.6, 1.3, (h >>> i) % 3);
    },
    bottle: function (ctx, x, y, h) {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      blob(ctx, x, y + 4, 9, 3);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(((h % 20) / 10) - 1);
      ctx.fillStyle = h % 2 ? "rgba(110,170,110,0.55)" : "rgba(150,110,70,0.55)";
      ctx.fillRect(-9, -3.5, 13, 7);
      ctx.fillRect(4, -1.8, 5, 3.6);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(-7, -2.5, 9, 1.4);
      ctx.restore();
    },
    cobweb: function (ctx, x, y) {
      ctx.strokeStyle = "rgba(230,230,240,0.13)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var a = (i / 6) * TAU;
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * 18, y + Math.sin(a) * 18);
      }
      for (var ring = 6; ring <= 16; ring += 5) {
        ctx.moveTo(x + ring, y);
        for (var j = 1; j <= 6; j++) ctx.lineTo(x + Math.cos((j / 6) * TAU) * ring, y + Math.sin((j / 6) * TAU) * ring);
      }
      ctx.stroke();
    },
    crack: function (ctx, x, y, h) {
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x - 14, y + ((h >>> 2) % 8) - 4);
      ctx.lineTo(x - 4, y + ((h >>> 5) % 8) - 4);
      ctx.lineTo(x + 3, y + ((h >>> 8) % 10) - 5);
      ctx.lineTo(x + 14, y + ((h >>> 11) % 8) - 4);
      ctx.moveTo(x - 4, y);
      ctx.lineTo(x - 2, y + 9);
      ctx.stroke();
    },
    nail: function (ctx, x, y) {
      ctx.fillStyle = "rgba(200,200,210,0.35)";
      blob(ctx, x, y, 2, 2);
    },
    grate: function (ctx, x, y) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(x - 20, y - 14, 40, 28);
      ctx.strokeStyle = "rgba(160,190,200,0.35)";
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 20, y - 14, 40, 28);
      ctx.beginPath();
      for (var i = -12; i <= 12; i += 8) {
        ctx.moveTo(x + i, y - 14);
        ctx.lineTo(x + i, y + 14);
      }
      ctx.stroke();
    },
    ember: function (ctx, x, y, h, Z, R) {
      var flicker = 0.6 + 0.4 * Math.sin(R.t * (3 + (h % 5)) + h);
      ctx.fillStyle = "rgba(40,20,14,0.35)";
      blob(ctx, x, y, 7, 4.5);
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgba(255,120,50," + (0.3 * flicker).toFixed(3) + ")";
      blob(ctx, x, y, 16, 10);
      ctx.fillStyle = "rgba(255," + (110 + (h % 80)) + ",50," + (0.95 * flicker).toFixed(3) + ")";
      blob(ctx, x, y, 4.5, 3.2);
      ctx.fillStyle = "rgba(255,240,180," + (0.8 * flicker).toFixed(3) + ")";
      blob(ctx, x, y, 1.8, 1.2);
      ctx.globalCompositeOperation = "source-over";
    },
    spore: function (ctx, x, y, h, Z, R) {
      var pulse = 0.55 + 0.45 * Math.sin(R.t * 1.6 + h);
      ctx.fillStyle = "#4A2E5E";
      ctx.fillRect(x - 1.5, y - 7, 3, 8);
      ctx.fillStyle = "#8F5BC4";
      ctx.beginPath();
      ctx.ellipse(x, y - 7, 6, 4.5, 0, Math.PI, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgba(200,120,255," + (0.38 * pulse).toFixed(3) + ")";
      blob(ctx, x, y - 6, 13, 10);
      ctx.globalCompositeOperation = "source-over";
    },
    root: function (ctx, x, y, h) {
      ctx.strokeStyle = "rgba(70,40,80,0.7)";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - 22, y + ((h >>> 2) % 10) - 5);
      ctx.quadraticCurveTo(x, y - 10 + ((h >>> 6) % 20), x + 22, y + ((h >>> 9) % 10) - 5);
      ctx.stroke();
    }
  };

  function drawProps(ctx, R, ox, oy, S) {
    var view = B.view;
    var p = R.p;
    var cell = 90;
    var left = Math.floor((p.x - view.w / 2) / cell) - 1;
    var right = Math.floor((p.x + view.w / 2) / cell) + 1;
    var top = Math.floor((p.y - view.h / 2) / cell) - 1;
    var bottom = Math.floor((p.y + view.h / 2) / cell) + 1;
    var Z = R.zone;
    for (var cx = left; cx <= right; cx++) {
      for (var cy = top; cy <= bottom; cy++) {
        var h = hash(cx, cy);
        if (h % 7 > 3) continue; // about four cells in seven have something
        var x = cx * cell + ((h >>> 4) % cell) + ox;
        var y = cy * cell + ((h >>> 12) % cell) + oy;
        var kind = S.props[(h >>> 20) % S.props.length];
        // drawn at their own size, a little bigger or smaller each
        ctx.save();
        ctx.translate(x, y);
        var size = 1.25 + ((h >>> 26) % 4) * 0.12;
        ctx.scale(size, size);
        PROPS[kind](ctx, 0, 0, h, Z, R);
        ctx.restore();
      }
    }
  }

  /** The ground, under everything else. In screen space; (ox, oy) is where
   *  the world's origin is on screen. */
  B.drawArena = function (ctx, R, ox, oy) {
    var S = style(R);
    if (B.quality >= 2) drawPatches(ctx, R, ox, oy, S);
    drawPattern(ctx, R, ox, oy, S);
    drawProps(ctx, R, ox, oy, S);
  };

  /** Soft shadows under the pests (bosses draw their own), all in one fill. */
  B.drawShadows = function (ctx, R) {
    var view = B.view;
    var p = R.p;
    var halfW = view.w / 2 + 60;
    var halfH = view.h / 2 + 60;
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    for (var i = 0; i < R.enemies.length; i++) {
      var e = R.enemies[i];
      if (e.dead || e.boss || Math.abs(e.x - p.x) > halfW || Math.abs(e.y - p.y) > halfH) continue;
      var sy = e.y + e.r * 0.78;
      ctx.moveTo(e.x + e.r * 0.85, sy);
      ctx.ellipse(e.x, sy, e.r * 0.85, e.r * 0.3, 0, 0, TAU);
    }
    ctx.fill();
  };

  /* ------------------------------------------------------- over the top */

  var MOTES = 30;

  function drawMotes(ctx, R, ox, oy, S) {
    var view = B.view;
    var w = view.w + 40;
    var h = view.h + 40;
    var t = R.t;
    var kind = S.mote;
    var rgb = S.motes;
    if (kind === "ember") ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < MOTES; i++) {
      var hh = hash(i * 97 + 13, R.ch.zone * 31 + 7);
      var depth = 0.35 + ((hh >>> 3) % 60) / 100; // nearer motes drift past faster
      var vx = (((hh >>> 9) % 40) - 20) * 0.6;
      var vy = kind === "ember" || kind === "bubble" || kind === "steam" ? -14 - (hh % 20) : (((hh >>> 13) % 30) - 15) * 0.5;
      var x = (((hh % 1000) / 1000) * w + t * vx + ox * depth) % w;
      var y = ((((hh >>> 10) % 1000) / 1000) * h + t * vy + oy * depth) % h;
      if (x < 0) x += w;
      if (y < 0) y += h;
      x -= 20;
      y -= 20;
      var twinkle = 0.55 + 0.45 * Math.sin(t * (1 + (hh % 7) * 0.3) + hh);
      var size = (kind === "steam" ? 6 : kind === "bubble" ? 2.6 : 1.6) * depth * 1.6;
      var alpha = (kind === "steam" ? 0.06 : kind === "dust" ? 0.25 : 0.45) * twinkle;
      if (kind === "bubble") {
        ctx.strokeStyle = "rgba(" + rgb + "," + alpha.toFixed(3) + ")";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, TAU);
        ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(" + rgb + "," + alpha.toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(x, y, size, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  var shadeCache = { key: "", grad: null };

  /** Floating motes, the lemon's light and the dark screen edge. Screen space. */
  B.drawAtmosphere = function (ctx, R, ox, oy) {
    var view = B.view;
    var S = style(R);
    var cx = view.w / 2;
    var cy = view.h / 2;
    if (B.quality >= 2) {
      drawMotes(ctx, R, ox, oy, S);
      // a warm light around the lemon, and a coloured one in glowing zones
      ctx.globalCompositeOperation = "lighter";
      var light = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.min(view.w, view.h) * 0.55);
      light.addColorStop(0, "rgba(255,230,140,0.12)");
      light.addColorStop(1, "rgba(255,230,140,0)");
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, view.w, view.h);
      if (S.glow) {
        var glow = ctx.createLinearGradient(0, view.h, 0, view.h * 0.4);
        glow.addColorStop(0, "rgba(" + S.glow + ",0.10)");
        glow.addColorStop(1, "rgba(" + S.glow + ",0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, view.w, view.h);
      }
      ctx.globalCompositeOperation = "source-over";
    }
    // the dark edge: built once per screen size and zone
    var key = view.w + "x" + view.h + ":" + S.shade;
    if (shadeCache.key !== key) {
      var g = ctx.createRadialGradient(cx, cy, Math.min(view.w, view.h) * 0.38, cx, cy, Math.hypot(cx, cy) * 1.02);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0," + S.shade + ")");
      shadeCache.key = key;
      shadeCache.grad = g;
    }
    ctx.fillStyle = shadeCache.grad;
    ctx.fillRect(0, 0, view.w, view.h);
  };
})();
