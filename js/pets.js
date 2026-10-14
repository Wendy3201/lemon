/*!
 * Pip Survivors — the pet in battle
 * The pet you brought follows the lemon, bobbing along beside it, and every
 * couple of seconds sends a homing pip at the nearest pest. Its damage grows
 * with its level and rarity; its stat bonus is already part of your Power.
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function () {
  "use strict";

  var PS = window.PS;
  var B = PS.B;
  var TAU = Math.PI * 2;

  /* where each pet hovers, relative to the lemon: behind a shoulder, behind
     the other, and above */
  var SPOTS = [[-26, -20], [26, -20], [0, -38]];

  function team(R) {
    if (!R.pets) {
      R.pets = PS.state.petTeam().map(function (owned, i) {
        return {
          sp: owned.sp, r: owned.r, lv: owned.lv, slot: i, x: R.p.x + SPOTS[i][0], y: R.p.y + SPOTS[i][1],
          cd: 1.2 + i * 0.4, bob: Math.random() * TAU, face: 1
        };
      });
    }
    return R.pets;
  }

  function tend(R, pet, dt) {
    var p = R.p;
    pet.bob += dt * 4;
    // hovers by the lemon's shoulder, easing along after it
    var wantX = p.x + SPOTS[pet.slot][0];
    var wantY = p.y + SPOTS[pet.slot][1] + Math.sin(pet.bob) * 3;
    var k = 1 - Math.exp(-6 * dt);
    pet.x += (wantX - pet.x) * k;
    pet.y += (wantY - pet.y) * k;
    pet.face = SPOTS[pet.slot][0] <= 0 ? 1 : -1;

    pet.cd -= dt;
    if (pet.cd > 0) return;
    var e = B.nearest(pet.x, pet.y, 320);
    if (!e) {
      pet.cd = 0.3;
      return;
    }
    pet.cd = Math.max(0.9, 2.3 - 0.045 * pet.lv);
    var mult = (0.25 + 0.015 * pet.lv) * PS.PET_RARITY[pet.r].mult;
    var angle = Math.atan2(e.y - pet.y, e.x - pet.x);
    // credited to this pet by name in the damage meter
    B.as("pet:" + pet.sp + ":" + pet.r, function () {
      B.shoot({
        x: pet.x, y: pet.y, angle: angle, speed: 360, range: 360, r: 3.6, dmg: B.dmg() * mult,
        homing: 4, sprite: "pip", color: PS.PET[pet.sp].color, bounce: 0
      });
    });
  }

  B.petUpdate = function (dt) {
    var R = B.run;
    var all = team(R);
    for (var i = 0; i < all.length; i++) tend(R, all[i], dt);
  };

  /* drawn from shaded shapes: a lit body, glossy eyes, the one thing that
     makes each kind what it is, and a glow that grows with its rarity. Its
     name floats just above it. */
  B.petDraw = function (ctx, R) {
    var all = R.pets || [];
    for (var i = 0; i < all.length; i++) drawPet(ctx, R, all[i]);
  };

  var AURA = ["", "rgba(93,182,97,", "rgba(63,143,228,", "rgba(164,93,230,"];

  function sparkle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.28, y - r * 0.28);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x + r * 0.28, y + r * 0.28);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r * 0.28, y + r * 0.28);
    ctx.lineTo(x - r, y);
    ctx.lineTo(x - r * 0.28, y - r * 0.28);
    ctx.closePath();
    ctx.fill();
  }

  function drawPet(ctx, R, pet) {
    var def = PS.PET[pet.sp];
    var x = pet.x;
    var y = pet.y;
    var f = pet.face;
    var t = R.t * 9 + pet.bob;
    ctx.save();

    // an aura that grows with rarity
    if (pet.r > 0) {
      var glow = ctx.createRadialGradient(x, y, 2, x, y, 22);
      glow.addColorStop(0, AURA[pet.r] + (0.28 + 0.08 * Math.sin(t * 0.7)) + ")");
      glow.addColorStop(1, AURA[pet.r] + "0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(x, y + 15, 8, 2.6, 0, 0, TAU);
    ctx.fill();

    // wings for the ones that fly
    if (pet.sp === "bumble" || pet.sp === "moth" || pet.sp === "firefly") {
      var flap = Math.sin(t * 2.4);
      var big = pet.sp === "moth";
      ctx.fillStyle = big ? "rgba(216,205,180,0.95)" : "rgba(255,252,242,0.62)";
      ctx.beginPath();
      ctx.ellipse(x - 8 * f * 0 - 8, y - 5, big ? 9 : 7.5, (big ? 5.4 : 3.6) + flap * 1.6, -0.5, 0, TAU);
      ctx.ellipse(x + 8, y - 5, big ? 9 : 7.5, (big ? 5.4 : 3.6) - flap * 1.6, 0.5, 0, TAU);
      ctx.fill();
      if (big) {
        ctx.fillStyle = "#6F654F";
        ctx.beginPath();
        ctx.arc(x - 9, y - 5, 1.7, 0, TAU);
        ctx.arc(x + 9, y - 5, 1.7, 0, TAU);
        ctx.fill();
      }
    }

    // legs for the ones that have them
    if (pet.sp === "ant" || pet.sp === "beetle" || pet.sp === "ladybug" || pet.sp === "cricket") {
      ctx.strokeStyle = pet.sp === "cricket" ? "#3E6B2E" : "#2A2018";
      ctx.lineWidth = 1.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (var l = -1; l <= 1; l += 2) {
        var step = Math.sin(t * 1.6 + l) * 1.6;
        ctx.moveTo(x + l * 4, y + 6);
        ctx.lineTo(x + l * 8, y + 12 + step);
        ctx.moveTo(x + l * 1, y + 7);
        ctx.lineTo(x + l * 3, y + 13 - step);
      }
      ctx.stroke();
    }

    // body
    ctx.fillStyle = def.color;
    if (pet.sp === "snail") {
      ctx.save();
      ctx.translate(x, y + 5);
      ctx.scale(1.6, 0.56);
      ctx.fillStyle = "#E3D2B0";
      B.ball(ctx, 0, 0, 7);
      ctx.restore();
      ctx.fillStyle = "#B9A98A";
      B.ball(ctx, x + f * 2, y - 2, 8);
      ctx.strokeStyle = "#6F5F3E";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x + f * 2, y - 2, 4.6, 0.5, 5.3);
      ctx.stroke();
    } else if (pet.sp === "ant") {
      ctx.fillStyle = "#4A3320";
      B.ball(ctx, x - f * 9, y + 3, 4.6);
      ctx.fillStyle = "#6F4A2A";
      B.ball(ctx, x - f * 2.4, y + 2, 3.8);
      ctx.fillStyle = "#4A3320";
      B.ball(ctx, x + f * 6, y - 1, 5.6);
    } else if (pet.sp === "moth") {
      ctx.fillStyle = "#8F826A";
      B.ball(ctx, x, y + 1, 7);
    } else {
      B.ball(ctx, x, y, 9.4);
    }

    // what makes it itself
    if (pet.sp === "bumble") {
      ctx.fillStyle = "#3A2A10";
      ctx.fillRect(x - 7.5, y - 1.6, 15, 2.6);
      ctx.fillRect(x - 6.5, y + 3.4, 13, 2.4);
      ctx.beginPath();
      ctx.moveTo(x - f * 9, y + 4);
      ctx.lineTo(x - f * 14, y + 6);
      ctx.lineTo(x - f * 9, y + 7);
      ctx.fill();
    } else if (pet.sp === "ladybug" || pet.sp === "beetle") {
      ctx.fillStyle = pet.sp === "ladybug" ? "#29261F" : "#161F4A";
      ctx.fillRect(x - 0.9, y - 9, 1.8, 16);
      if (pet.sp === "ladybug") {
        ctx.beginPath();
        ctx.arc(x - 4.5, y - 2, 2, 0, TAU);
        ctx.arc(x + 4.5, y + 2, 2, 0, TAU);
        ctx.arc(x + 3, y - 5, 1.5, 0, TAU);
        ctx.fill();
      } else {
        // the horn and a little jewel
        ctx.beginPath();
        ctx.moveTo(x - 2.4, y - 8);
        ctx.lineTo(x, y - 15);
        ctx.lineTo(x + 2.4, y - 8);
        ctx.fill();
        ctx.fillStyle = "#FFD166";
        ctx.beginPath();
        ctx.moveTo(x, y - 1);
        ctx.lineTo(x + 2.2, y + 1.4);
        ctx.lineTo(x, y + 3.8);
        ctx.lineTo(x - 2.2, y + 1.4);
        ctx.fill();
      }
    } else if (pet.sp === "firefly") {
      var pulse = 0.55 + 0.4 * Math.sin(t * 0.9);
      var tail = ctx.createRadialGradient(x, y + 9, 1, x, y + 9, 12);
      tail.addColorStop(0, "rgba(255,248,170," + pulse + ")");
      tail.addColorStop(1, "rgba(255,225,74,0)");
      ctx.fillStyle = tail;
      ctx.beginPath();
      ctx.arc(x, y + 9, 12, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#FFF08A";
      ctx.beginPath();
      ctx.arc(x, y + 9, 3.6, 0, TAU);
      ctx.fill();
    } else if (pet.sp === "cricket") {
      ctx.strokeStyle = "#4E8C38";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(x - 6, y + 4);
      ctx.lineTo(x - 12, y + 12);
      ctx.lineTo(x - 5, y + 15);
      ctx.stroke();
      ctx.fillStyle = "#E5484D";
      ctx.beginPath();
      ctx.moveTo(x - 7, y - 6);
      ctx.lineTo(x + 7, y - 6);
      ctx.lineTo(x + f * 11, y - 3);
      ctx.lineTo(x - 5, y - 2);
      ctx.fill();
    } else if (pet.sp === "snail") {
      ctx.fillStyle = "#7FD4F5";
      ctx.beginPath();
      ctx.moveTo(x + f * 2 - 3, y - 8);
      ctx.lineTo(x + f * 2 - 6, y - 15);
      ctx.lineTo(x + f * 2, y - 9);
      ctx.moveTo(x + f * 2 + 1, y - 9);
      ctx.lineTo(x + f * 2 + 3, y - 16);
      ctx.lineTo(x + f * 2 + 6, y - 8);
      ctx.fill();
    } else if (pet.sp === "ant") {
      // sunglasses, because it is cool
      ctx.fillStyle = "#1B1630";
      ctx.fillRect(x + f * 6 - 6, y - 4, 12, 4.6);
      ctx.fillStyle = "#3A4A78";
      ctx.fillRect(x + f * 6 - 5, y - 3.4, 4.4, 3.2);
      ctx.fillRect(x + f * 6 + 0.6, y - 3.4, 4.4, 3.2);
    }

    // eyes
    if (pet.sp !== "ant") {
      var ex = x + f * (pet.sp === "moth" ? 0 : 3);
      var ey = y - (pet.sp === "snail" ? 6 : 2.4);
      for (var s = -1; s <= 1; s += 2) {
        ctx.fillStyle = "#FFFCF2";
        ctx.beginPath();
        ctx.arc(ex + s * 2.6, ey, 2.5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#29261F";
        ctx.beginPath();
        ctx.arc(ex + s * 2.6 + f * 0.7, ey + 0.3, 1.4, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(ex + s * 2.6 + f * 0.7 - 0.5, ey - 0.4, 0.5, 0, TAU);
        ctx.fill();
      }
    }

    // sparkles drifting round the better ones
    if (pet.r >= 2) {
      ctx.fillStyle = pet.r >= 3 ? "#E3C2FF" : "#CFE4FF";
      for (var k = 0; k < (pet.r >= 3 ? 3 : 2); k++) {
        var a = t * 0.35 + (k * TAU) / (pet.r >= 3 ? 3 : 2);
        sparkle(ctx, x + Math.cos(a) * 15, y - 2 + Math.sin(a) * 11, 2.6 + Math.sin(t + k) * 0.6);
      }
    }
    // a halo over an Epic
    if (pet.r >= 3) {
      ctx.strokeStyle = "#FFE08A";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(x, y - 15 + Math.sin(t * 0.5) * 1, 7, 2.4, 0, 0, TAU);
      ctx.stroke();
    }

    // its name, small and outlined, just above it
    ctx.font = '800 9px "Nunito", system-ui, sans-serif';
    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(20,18,14,0.75)";
    ctx.fillStyle = pet.r > 0 ? PS.RARITY[pet.r].color : "#FFFCF2";
    var label = def.name + " " + pet.lv;
    ctx.strokeText(label, x, y - 22);
    ctx.fillText(label, x, y - 22);
    ctx.restore();
  }
})();
