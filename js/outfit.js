/*!
 * Pip Survivors — the lemon's outfit in battle
 * Draws the equipped helmet, armour, boots and amulet on the lemon itself,
 * small enough that the battlefield stays clear. Rarer gear gets a trim in
 * its rarity colour.
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function () {
  "use strict";

  var PS = window.PS;
  var B = PS.B;
  var TAU = Math.PI * 2;

  /* main colour, dark colour, and for helmets which shape to draw */
  var LOOK = {
    cap: { c: "#8FAE65", d: "#5F8244", shape: "dome" },
    acorn: { c: "#A0703F", d: "#70492A", shape: "acorn" },
    crown: { c: "#F2B93B", d: "#B97F14", shape: "crown" },
    halo: { c: "#FFE08A", d: "#F2A31B", shape: "halo" },
    bark: { c: "#8B6B45", d: "#5A4229" },
    shell: { c: "#B9A98A", d: "#75664A" },
    sunpeel: { c: "#F2B93B", d: "#B97F14" },
    golden: { c: "#FFD166", d: "#E08A12" },
    mud: { c: "#7A5A3A", d: "#4E3823" },
    hopper: { c: "#7FB069", d: "#4E7A3A" },
    wind: { c: "#E3EEF9", d: "#6C8FB5" },
    pebble: { c: "#B5AFA6", d: "#6F6A62" },
    dew: { c: "#7FD4F5", d: "#3A9BD9" },
    heart: { c: "#5DB661", d: "#B97F14" }
  };

  function trim(item) {
    return item.r >= 1 ? PS.RARITY[item.r].color : null;
  }

  B.outfitOf = function () {
    var out = {};
    ["helmet", "armor", "boots", "amulet"].forEach(function (slot) {
      var item = PS.state.equipped(slot);
      if (item) out[slot] = { id: item.id, r: item.r };
    });
    return out;
  };

  function boots(ctx, p, y, t) {
    var item = p.outfit.boots;
    if (!item) return;
    var look = LOOK[item.id];
    for (var side = -1; side <= 1; side += 2) {
      var step = p.moving ? Math.sin(t * 14 + (side > 0 ? Math.PI : 0)) * 1.8 : 0;
      var fx = p.x + side * 6.5;
      var fy = y + 11.5 + step * 0.5;
      ctx.fillStyle = look.c;
      ctx.strokeStyle = trim(item) || look.d;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(fx + step * 0.4, fy, 5.6, 3.3, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      if (item.id === "wind") {
        ctx.fillStyle = "#FFFCF2";
        ctx.beginPath();
        ctx.ellipse(fx + side * 5, fy - 2, 3.5, 1.6, side * 0.6, 0, TAU);
        ctx.fill();
      }
    }
  }

  function armor(ctx, p, y) {
    var item = p.outfit.armor;
    if (!item) return;
    var look = LOOK[item.id];
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(p.x, y, 14, 12, 0, 0, TAU);
    ctx.clip();
    // a V-necked vest across the lower body
    ctx.beginPath();
    ctx.moveTo(p.x - 15, y + 0.5);
    ctx.lineTo(p.x - 4.5, y + 0.5);
    ctx.lineTo(p.x, y + 6);
    ctx.lineTo(p.x + 4.5, y + 0.5);
    ctx.lineTo(p.x + 15, y + 0.5);
    ctx.lineTo(p.x + 15, y + 14);
    ctx.lineTo(p.x - 15, y + 14);
    ctx.closePath();
    ctx.fillStyle = look.c;
    ctx.fill();
    ctx.strokeStyle = look.d;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(p.x - 9, y + 5);
    ctx.lineTo(p.x - 9, y + 13);
    ctx.moveTo(p.x + 9, y + 5);
    ctx.lineTo(p.x + 9, y + 13);
    ctx.moveTo(p.x, y + 9);
    ctx.lineTo(p.x, y + 14);
    ctx.stroke();
    var edge = trim(item);
    ctx.strokeStyle = edge || look.d;
    ctx.lineWidth = edge ? 2 : 1.2;
    ctx.beginPath();
    ctx.moveTo(p.x - 15, y + 0.5);
    ctx.lineTo(p.x - 4.5, y + 0.5);
    ctx.lineTo(p.x, y + 6);
    ctx.lineTo(p.x + 4.5, y + 0.5);
    ctx.lineTo(p.x + 15, y + 0.5);
    ctx.stroke();
    ctx.restore();
  }

  function amulet(ctx, p, y) {
    var item = p.outfit.amulet;
    if (!item) return;
    var look = LOOK[item.id];
    ctx.strokeStyle = "#6F654F";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x - 6, y + 1);
    ctx.quadraticCurveTo(p.x, y + 7, p.x + 6, y + 1);
    ctx.stroke();
    ctx.fillStyle = look.c;
    ctx.strokeStyle = trim(item) || look.d;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(p.x, y + 5.6, 2.6, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }

  function helmet(ctx, p, y, t) {
    var item = p.outfit.helmet;
    if (!item) return;
    var look = LOOK[item.id];
    var edge = trim(item);
    var x = p.x;
    ctx.fillStyle = look.c;
    ctx.strokeStyle = edge || look.d;
    ctx.lineWidth = edge ? 2 : 1.4;

    if (look.shape === "halo") {
      var bob = Math.sin(t * 3) * 1.2;
      ctx.globalAlpha *= 0.4;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(x, y - 17 + bob, 9, 3, 0, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha /= 0.4;
      ctx.strokeStyle = look.d;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.ellipse(x, y - 17 + bob, 9, 3, 0, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = look.c;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      return;
    }

    if (look.shape === "crown") {
      ctx.beginPath();
      ctx.moveTo(x - 8, y - 9);
      ctx.lineTo(x - 9, y - 19);
      ctx.lineTo(x - 4, y - 14.5);
      ctx.lineTo(x, y - 20);
      ctx.lineTo(x + 4, y - 14.5);
      ctx.lineTo(x + 9, y - 19);
      ctx.lineTo(x + 8, y - 9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#E5484D";
      ctx.beginPath();
      ctx.arc(x, y - 11.5, 1.4, 0, TAU);
      ctx.fill();
      return;
    }

    // a dome sitting on the top of the lemon
    ctx.beginPath();
    ctx.ellipse(x, y - 6.5, 13.4, 9.5, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (look.shape === "acorn") {
      ctx.strokeStyle = look.d;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 8, y - 11);
      ctx.lineTo(x - 4, y - 7);
      ctx.moveTo(x, y - 15);
      ctx.lineTo(x, y - 7);
      ctx.moveTo(x + 8, y - 11);
      ctx.lineTo(x + 4, y - 7);
      ctx.stroke();
      ctx.fillStyle = look.d;
      ctx.fillRect(x - 1.2, y - 19, 2.4, 4);
    }
  }

  /** part: "under" (behind the body), "body" (armour and amulet) or "head". */
  B.drawOutfit = function (ctx, p, y, part, t) {
    if (!p.outfit || p.flash > 0) return;
    if (part === "under") boots(ctx, p, y, t);
    else if (part === "body") {
      armor(ctx, p, y);
      amulet(ctx, p, y);
    } else helmet(ctx, p, y, t);
  };
})();
