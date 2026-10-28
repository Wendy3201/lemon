/*!
 * Pip Survivors — things that happen during a battle
 * Breakable crates and jars turn up on the field; shoot them or bump into them
 * for a surprise (a heal, a shower of coins, a magnet, a bomb that clears the
 * screen, or a power-up). Power-ups last a few seconds: Frenzy (double attack
 * speed), Giant (bigger attacks), Swift (faster feet) and Star (nothing can
 * hurt you). Once or twice a chapter a golden pest appears and runs; catch it
 * before it escapes for a pile of coins and experience. Every minute or so a
 * shrine rises nearby: stand in its circle to wake it and choose a blessing.
 * (Elite pests and their traits live in enemies.js.)
 *
 * battle.js calls in here: B.events each tick, B.breakProp when a crate is
 * smashed, B.caughtGolden when the golden pest is squashed, B.collectSpecial
 * for the new pickups, and B.drawProp / B.drawPickup / B.drawBuffs to draw.
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function () {
  "use strict";

  var PS = window.PS;
  var B = PS.B;
  var TAU = Math.PI * 2;

  /* the power-ups: how long they last, and how they look */
  var POWERS = {
    frenzy: { name: "Frenzy", text: "Double attack speed", time: 8, color: "#E5484D" },
    giant: { name: "Giant", text: "Attacks half as big again", time: 8, color: "#F2A31B" },
    swift: { name: "Swift", text: "Much faster feet", time: 8, color: "#3F8FE4" },
    star: { name: "Star", text: "Nothing can hurt you", time: 5, color: "#C49BFF" }
  };
  B.POWERS = POWERS;
  var POWER_KEYS = Object.keys(POWERS);

  var MAX_CRATES = 4;

  function liveProps(R) {
    var n = 0;
    for (var i = 0; i < R.enemies.length; i++) if (R.enemies[i].prop && !R.enemies[i].dead) n++;
    return n;
  }

  /** A crate (or a jar, or a flower pot) somewhere on screen, not too close. */
  function spawnCrate(R) {
    var p = R.p;
    var view = B.view;
    var angle = Math.random() * TAU;
    var dist = PS.rand(170, Math.max(200, Math.min(view.w, view.h) * 0.42));
    var e = B.spawn("crate", p.x + Math.cos(angle) * dist, p.y + Math.sin(angle) * dist);
    e.prop = true;
    e.hp = e.maxHp = 1;
    e.speed = 0;
    e.hurt = 0;
    e.xp = 0;
    e.mass = 1e6;
    e.style = Math.floor(Math.random() * 3); // 0 crate, 1 jar, 2 flower pot
    R.fx.push({ type: "ring", x: e.x, y: e.y, r0: 6, r1: 34, color: "#FFE66D", width: 3, t: 0, dur: 0.35 });
    // for the first few battles, the first crate of each one says what it is for
    if (!R.crateTold && PS.state.get().stats.runs < 5) {
      R.crateTold = true;
      B.toast("A crate! Walk into it or hit it to break it open", 4);
    }
    return e;
  }

  /** A word over a smashed crate saying what came out, so the two connect. */
  function sayFound(R, e, words, color) {
    R.texts.push({ x: e.x, y: e.y - 24, str: words, color: color, size: 16, life: 1.3 });
  }

  /** The golden pest: quick, tough for its size, and running away from you. */
  function spawnGolden(R) {
    var p = R.p;
    var angle = Math.random() * TAU;
    var e = B.spawn("dart", p.x + Math.cos(angle) * 210, p.y + Math.sin(angle) * 210);
    e.golden = true;
    e.fill = "#F2C94C";
    e.r = 13;
    e.hp = e.maxHp = e.hp * 9;
    e.speed = 160;
    e.hurt = 0;
    e.xp = 0;
    e.escape = 15;
    PS.sfx.play("golden");
    B.toast("A golden pest! Catch it before it gets away!", 3.5);
    return e;
  }

  /* Shrines: every minute and a bit, a shrine rises somewhere near the lemon.
     Stand in its circle for SHRINE.charge seconds (stepping out drains it
     slowly) and it offers three blessings for the rest of the battle. Left
     alone for SHRINE.life seconds, it sinks back into the ground. */
  var SHRINE = { first: 40, every: [70, 95], life: 30, charge: 3, r: 72 };

  /** Seconds until the next shrine, and to wake one: a daily challenge's
   *  Shrine Day shortens both. */
  function shrineGap(R) {
    return PS.rand(SHRINE.every[0], SHRINE.every[1]) * ((R.twist && R.twist.shrine) || 1);
  }
  function shrineCharge(R) {
    return (R.twist && R.twist.shrineCharge) || SHRINE.charge;
  }

  function spawnShrine(R) {
    var p = R.p;
    var angle = Math.random() * TAU;
    var dist = PS.rand(330, 420);
    R.shrine = { x: p.x + Math.cos(angle) * dist, y: p.y + Math.sin(angle) * dist, r: SHRINE.r, charge: 0, life: SHRINE.life, t: 0 };
    R.fx.push({ type: "ring", x: R.shrine.x, y: R.shrine.y, r0: 10, r1: SHRINE.r, color: "#5FD3B0", width: 4, t: 0, dur: 0.5 });
    PS.sfx.play("shrine");
    if (!R.shrineTold) {
      R.shrineTold = true;
      B.toast("A shrine! Stand in its circle to wake it", 3.5);
    }
  }

  function updateShrine(R, dt) {
    var s = R.shrine;
    s.t += dt;
    s.life -= dt;
    // playing together, whichever lemon stands in the circle wakes it (and chooses)
    var list = R.players || [R.p];
    var inside = false;
    var waker = null;
    for (var i = 0; i < list.length; i++) {
      var q = list[i];
      if (q.down || q.gone) continue;
      var dx = q.x - s.x;
      var dy = q.y - s.y;
      if (dx * dx + dy * dy < s.r * s.r) {
        inside = true;
        waker = waker || q;
      }
    }
    s.inside = inside;
    var wake = shrineCharge(R);
    s.charge = inside ? s.charge + dt / wake : Math.max(0, s.charge - dt / (wake * 2));
    if (s.charge >= 1) {
      // awake: a burst of light, and the blessings to choose from
      R.shrine = null;
      R.shrineIn = shrineGap(R);
      R.fx.push({ type: "ring", x: s.x, y: s.y, r0: 20, r1: s.r * 2.2, color: "#5FD3B0", width: 8, t: 0, dur: 0.5 });
      R.fx.push({ type: "blast", x: s.x, y: s.y, r: s.r, color: "#C8F7E6", t: 0, dur: 0.4 });
      B.sparks(s.x, s.y, "#7FE3C4", 20, 180);
      PS.sfx.play("levelup");
      if (R.players && waker) {
        var blessings = B.ownAs(waker, function () { return B.rollBlessings(); });
        B.offerTo(waker, blessings, "shrine");
      } else {
        B.offer(B.rollBlessings(), "shrine");
      }
    } else if (s.life <= 0) {
      R.shrine = null;
      R.shrineIn = shrineGap(R) * 0.6;
      B.sparks(s.x, s.y, "#8D96A8", 10, 90);
    }
  }

  B.events = function (dt) {
    var R = B.run;
    if (R.phase !== "swarm" && R.phase !== "boss") return;
    if (R.duel) return; // a duel's ring has none of these
    if (R.shrine) updateShrine(R, dt);
    // the admin's "Stop spawning" keeps the field clear of these too
    if (B.anyCheat("noSpawn")) return;

    // a new shrine now and then, but not just before the boss
    if (!R.shrine && R.phase === "swarm") {
      if (R.shrineIn === undefined) R.shrineIn = SHRINE.first * ((R.twist && R.twist.shrine) || 1);
      R.shrineIn -= dt;
      if (R.shrineIn <= 0 && (R.mode === "swarm" || B.progress(R) < 0.92)) spawnShrine(R);
    }

    // crates: every so often, fewer while the boss is out
    if (R.crateIn === undefined) R.crateIn = 6;
    R.crateIn -= dt;
    if (R.crateIn <= 0) {
      R.crateIn = PS.rand(8, 13) * (R.phase === "boss" ? 1.6 : 1);
      if (liveProps(R) < MAX_CRATES) spawnCrate(R);
    }

    // the golden pest: twice in a chapter, or every 75 seconds in endless
    if (R.phase === "swarm") {
      if (R.mode === "swarm") {
        R.goldenClock = (R.goldenClock || 0) + dt;
        if (R.goldenClock >= 75) {
          R.goldenClock = 0;
          spawnGolden(R);
        }
      } else {
        if (!R.goldenAt) R.goldenAt = [0.4, 0.8]; // shares of the way to the boss
        if (R.goldenAt.length && B.progress(R) >= R.goldenAt[0]) {
          R.goldenAt.shift();
          spawnGolden(R);
        }
      }
    }

    // a golden pest that is not caught in time gets away
    for (var i = 0; i < R.enemies.length; i++) {
      var e = R.enemies[i];
      if (!e.golden || e.dead) continue;
      e.escape -= dt;
      if (e.escape <= 0) {
        e.dead = true;
        B.sparks(e.x, e.y, "#F2C94C", 16, 160);
        B.toast("The golden pest got away...", 2.5);
      }
    }
  };

  /** A crate was smashed: what was inside comes tumbling out. */
  B.breakProp = function (e) {
    var R = B.run;
    var wood = ["#A0703F", "#C98A5A", "#B9845A"][e.style || 0];
    B.sparks(e.x, e.y, wood, 12, 170);
    R.fx.push({ type: "blast", x: e.x, y: e.y, r: 26, color: "#FFE66D", t: 0, dur: 0.25 });
    PS.sfx.play("smash");
    var roll = Math.random();
    if (roll < 0.3) {
      var key = POWER_KEYS[Math.floor(Math.random() * POWER_KEYS.length)];
      B.drop("power", e.x, e.y, key);
      sayFound(R, e, POWERS[key].name + "! Grab it", POWERS[key].color);
    } else if (roll < 0.52) {
      B.drop("heal", e.x, e.y, 0.25);
      sayFound(R, e, "A heal!", "#9BE08A");
    } else if (roll < 0.72) {
      for (var i = 0; i < 10; i++) B.drop("coin", e.x, e.y, R.coinValue);
      sayFound(R, e, "Coins!", "#F2B93B");
    } else if (roll < 0.86) {
      B.drop("magnet", e.x, e.y, 0);
      sayFound(R, e, "A magnet!", "#FF8A80");
    } else {
      B.drop("bomb", e.x, e.y, 0);
      sayFound(R, e, "A bomb! Grab it", "#FFE66D");
    }
  };

  /** The golden pest was caught: coins and experience everywhere. */
  B.caughtGolden = function (e) {
    var R = B.run;
    var i;
    for (i = 0; i < 30; i++) B.drop("coin", e.x, e.y, R.coinValue);
    for (i = 0; i < 12; i++) B.drop("xp", e.x, e.y, Math.max(1, Math.round(R.p.need * 0.05)));
    R.fx.push({ type: "ring", x: e.x, y: e.y, r0: 10, r1: 140, color: "#F2C94C", width: 6, t: 0, dur: 0.5 });
    B.sparks(e.x, e.y, "#FFE66D", 30, 220);
    PS.sfx.play("reveal", 3);
    B.toast("You caught the golden pest!", 2.5);
  };

  /** Picking up a power-up or a bomb. */
  B.collectSpecial = function (d) {
    var R = B.run;
    var p = R.p;
    if (d.type === "power") {
      var power = POWERS[d.value];
      if (!power) return;
      p.buffs[d.value] = power.time;
      if (d.value === "star") p.invuln = Math.max(p.invuln, power.time);
      PS.sfx.play("power");
      B.text(p.x, p.y - 30, power.name + "!", power.color, 16);
      B.toast(power.name + ": " + power.text.toLowerCase() + " for " + power.time + " seconds", 2.2);
    } else if (d.type === "bomb") {
      // every pest on screen is squashed; bosses only feel the shake
      var view = B.view;
      var reach = Math.max(view.w, view.h) * 0.75;
      B.as("cratebomb", function () {
        R.enemies.slice().forEach(function (e) {
          if (e.dead || e.boss || e.prop) return;
          var dx = e.x - p.x;
          var dy = e.y - p.y;
          if (dx * dx + dy * dy < reach * reach) B.hit(e, e.hp + 1, { dot: true });
        });
      });
      R.ebullets.length = 0;
      R.fx.push({ type: "ring", x: p.x, y: p.y, r0: 20, r1: reach, color: "#FFE66D", width: 14, t: 0, dur: 0.6 });
      R.fx.push({ type: "blast", x: p.x, y: p.y, r: 120, color: "#FFF4B8", t: 0, dur: 0.4 });
      R.shake = Math.max(R.shake, 14);
      PS.sfx.play("boom", null, 0);
      B.toast("Boom! The screen is clear", 2);
    }
  };

  /* An admin's event reaching into a battle (ui.js plays the rest). Only the
     game that runs the battle acts (a friend's game shows what it does), and
     not in duels. Returns true if it did something. */
  B.ADMIN_EVENTS = ["heal", "nuke", "star", "surge", "horde", "golden", "coins", "gems"];
  B.adminEvent = function (kind) {
    var R = B.run;
    if (!R || R.mirror || R.duel || R.done || (R.phase !== "swarm" && R.phase !== "boss")) return false;
    var p = R.p;
    var lemons = (R.players || [p]).filter(function (q) { return !q.gone; });
    var i;
    if (kind === "heal") {
      lemons.forEach(function (q) {
        if (q.down) return;
        q.hp = q.maxHp;
        q.barrier = q.barrierMax;
        B.sparks(q.x, q.y, "#7BE495", 18, 140);
      });
      PS.sfx.play("heal");
    } else if (kind === "nuke") {
      // like a crate's bomb, but the whole field (bosses only feel the shake)
      B.as("cratebomb", function () {
        R.enemies.slice().forEach(function (e) {
          if (!e.dead && !e.boss && !e.prop && !e.proxyOf) B.hit(e, e.hp + 1, { dot: true });
        });
      });
      R.ebullets.length = 0;
      R.fx.push({ type: "ring", x: p.x, y: p.y, r0: 20, r1: Math.max(B.view.w, B.view.h), color: "#FFE66D", width: 16, t: 0, dur: 0.7 });
      R.fx.push({ type: "blast", x: p.x, y: p.y, r: 160, color: "#FFF4B8", t: 0, dur: 0.45 });
      R.shake = Math.max(R.shake, 16);
      PS.sfx.play("boom", null, 0);
    } else if (kind === "star" || kind === "surge") {
      // "star": nothing can hurt you; "surge": every power-up at once
      var keys = kind === "star" ? ["star"] : POWER_KEYS;
      lemons.forEach(function (q) {
        keys.forEach(function (k) { q.buffs[k] = Math.max(q.buffs[k] || 0, 10); });
        if (keys.indexOf("star") !== -1) q.invuln = Math.max(q.invuln, 10);
        B.text(q.x, q.y - 30, kind === "star" ? "Star!" : "Power surge!", kind === "star" ? "#C49BFF" : "#F2A31B", 16);
      });
      PS.sfx.play("power");
    } else if (kind === "horde") {
      // a ring of pests closing in from the edge of the screen
      var base = Math.random() * TAU;
      var kinds = ["grunt", "dart", "grunt", "brute"];
      for (i = 0; i < 40 && R.enemies.length < 600; i++) {
        var a = base + (i / 40) * TAU;
        B.spawn(kinds[i % kinds.length], p.x + Math.cos(a) * B.view.ring, p.y + Math.sin(a) * B.view.ring);
      }
      PS.sfx.play("boss");
    } else if (kind === "golden") {
      spawnGolden(R);
    } else if (kind === "coins" || kind === "gems") {
      // coins, or experience gems, scattered round every lemon
      lemons.forEach(function (q) {
        for (var j = 0; j < 30; j++) {
          var ang = Math.random() * TAU;
          var dist = PS.rand(30, 150);
          B.drop(kind === "coins" ? "coin" : "xp", q.x + Math.cos(ang) * dist, q.y + Math.sin(ang) * dist,
            kind === "coins" ? R.coinValue : Math.max(1, Math.round(p.need * 0.03)));
        }
      });
      PS.sfx.play(kind === "coins" ? "coin" : "gem");
    } else {
      return false;
    }
    return true;
  };

  /* ------------------------------------------------------------- drawing */

  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  /** A crate, a jar or a flower pot, with a little wobble now and then. */
  B.drawProp = function (ctx, e, R) {
    var x = e.x;
    var y = e.y;
    var wob = Math.sin(R.t * 3 + e.wob) * 0.05;
    // a glowing ring on the ground, so it stands out from the scenery
    var pulse = 0.5 + 0.5 * Math.sin(R.t * 5 + e.wob);
    ctx.fillStyle = "rgba(255,230,109," + (0.12 + 0.1 * pulse).toFixed(3) + ")";
    ctx.strokeStyle = "rgba(255,230,109," + (0.45 + 0.4 * pulse).toFixed(3) + ")";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y + 13, 21 + pulse * 3, 7.5 + pulse, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(wob);
    if (e.style === 1) {
      // a clay jar
      ctx.fillStyle = "#C98A5A";
      ctx.beginPath();
      ctx.ellipse(0, 3, 13, 12, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#A86E44";
      ctx.fillRect(-6, -13, 12, 6);
      ctx.fillStyle = "#E3B07C";
      ctx.fillRect(-8, -15, 16, 4);
      ctx.strokeStyle = "rgba(60,30,10,0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-11, 4);
      ctx.quadraticCurveTo(0, 9, 11, 4);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.beginPath();
      ctx.ellipse(-5, -2, 3, 5, -0.4, 0, TAU);
      ctx.fill();
    } else if (e.style === 2) {
      // a flower pot with a flower in it
      ctx.fillStyle = "#B9845A";
      ctx.beginPath();
      ctx.moveTo(-12, -4);
      ctx.lineTo(12, -4);
      ctx.lineTo(9, 14);
      ctx.lineTo(-9, 14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#D9A273";
      ctx.fillRect(-14, -8, 28, 6);
      ctx.strokeStyle = "#5D9A3F";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(0, -18);
      ctx.stroke();
      ctx.fillStyle = "#FFB4C8";
      for (var i = 0; i < 5; i++) circle(ctx, Math.cos(i * 1.26) * 4, -21 + Math.sin(i * 1.26) * 4, 3);
      ctx.fillStyle = "#F2B93B";
      circle(ctx, 0, -21, 2.2);
    } else {
      // a wooden crate
      ctx.fillStyle = "#A0703F";
      ctx.fillRect(-14, -14, 28, 28);
      ctx.strokeStyle = "#70492A";
      ctx.lineWidth = 3;
      ctx.strokeRect(-14, -14, 28, 28);
      ctx.beginPath();
      ctx.moveTo(-14, -14);
      ctx.lineTo(14, 14);
      ctx.moveTo(-14, 0);
      ctx.lineTo(14, 0);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(-12, -12, 24, 4);
    }
    ctx.restore();
    // a bouncing arrow above it: "this one, break it"
    var bounce = Math.abs(Math.sin(R.t * 4 + e.wob)) * 6;
    var ay = y - 34 - bounce;
    ctx.fillStyle = "#FFE66D";
    ctx.strokeStyle = "#3A2A10";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x - 4, ay - 8);
    ctx.lineTo(x + 4, ay - 8);
    ctx.lineTo(x + 4, ay - 1);
    ctx.lineTo(x + 9, ay - 1);
    ctx.lineTo(x, ay + 8);
    ctx.lineTo(x - 9, ay - 1);
    ctx.lineTo(x - 4, ay - 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  /** A shrine: a ring on the ground that fills while you stand in it, and a
   *  little stone with a glowing gem in the middle. */
  B.drawShrine = function (ctx, R) {
    var s = R.shrine;
    // it flickers in its last five seconds, so you know it is about to go
    var fading = s.life < 5 && Math.sin(R.t * 14) < -0.2;
    var rise = Math.min(1, s.t / 0.5);
    ctx.globalAlpha = (fading ? 0.45 : 1) * rise;
    ctx.fillStyle = s.inside ? "rgba(95,211,176,0.16)" : "rgba(95,211,176,0.08)";
    circle(ctx, s.x, s.y, s.r);
    ctx.strokeStyle = "rgba(127,227,196,0.6)";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -R.t * 18;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    if (s.charge > 0) {
      ctx.strokeStyle = "#5FD3B0";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, s.charge));
      ctx.stroke();
    }
    // the stone
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 13, 14, 4.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#5C6B8A";
    ctx.beginPath();
    ctx.moveTo(s.x - 11, s.y + 13);
    ctx.lineTo(s.x - 8, s.y - 12);
    ctx.lineTo(s.x + 8, s.y - 12);
    ctx.lineTo(s.x + 11, s.y + 13);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#8D96A8";
    ctx.fillRect(s.x - 8, s.y - 12, 6, 25);
    // the gem, brighter the more it is charged
    var bob = Math.sin(R.t * 3) * 2;
    var glow = 0.35 + 0.65 * s.charge;
    ctx.globalCompositeOperation = "lighter";
    var g = ctx.createRadialGradient(s.x, s.y - 22 + bob, 1, s.x, s.y - 22 + bob, 22);
    g.addColorStop(0, "rgba(127,227,196," + (0.6 * glow).toFixed(3) + ")");
    g.addColorStop(1, "rgba(127,227,196,0)");
    ctx.fillStyle = g;
    circle(ctx, s.x, s.y - 22 + bob, 22);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#7FE3C4";
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - 31 + bob);
    ctx.lineTo(s.x + 6, s.y - 22 + bob);
    ctx.lineTo(s.x, s.y - 13 + bob);
    ctx.lineTo(s.x - 6, s.y - 22 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#E6FFF6";
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - 29 + bob);
    ctx.lineTo(s.x + 3, s.y - 22 + bob);
    ctx.lineTo(s.x - 3, s.y - 22 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  /** The golden pest's shine, drawn under its body. */
  B.drawGoldenGlow = function (ctx, e, R) {
    var pulse = 0.6 + 0.4 * Math.sin(R.t * 8);
    ctx.globalCompositeOperation = "lighter";
    var g = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, e.r * 3);
    g.addColorStop(0, "rgba(255,220,90," + (0.5 * pulse).toFixed(3) + ")");
    g.addColorStop(1, "rgba(255,220,90,0)");
    ctx.fillStyle = g;
    circle(ctx, e.x, e.y, e.r * 3);
    ctx.globalCompositeOperation = "source-over";
    // a ring showing how long is left before it escapes
    ctx.strokeStyle = "#FFE66D";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r + 7, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, e.escape / 15));
    ctx.stroke();
  };

  /** A power-up or a bomb on the ground: bobbing, glowing, with its symbol. */
  B.drawPickup = function (ctx, d, R) {
    var bob = Math.sin(d.t * 4) * 2.5;
    var x = d.x;
    var y = d.y + bob;
    if (d.type === "bomb") {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(d.x, d.y + 10, 9, 3, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#2B2730";
      circle(ctx, x, y, 9);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      circle(ctx, x - 3, y - 3, 2.6);
      ctx.strokeStyle = "#A0703F";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 5, y - 7);
      ctx.quadraticCurveTo(x + 9, y - 13, x + 12, y - 11);
      ctx.stroke();
      ctx.fillStyle = Math.sin(d.t * 30) > 0 ? "#FFE66D" : "#F26B2A";
      circle(ctx, x + 12, y - 11, 2.6);
      return;
    }
    var power = POWERS[d.value] || POWERS.frenzy;
    ctx.globalCompositeOperation = "lighter";
    var g = ctx.createRadialGradient(x, y, 2, x, y, 20);
    g.addColorStop(0, B.rgba(power.color, 0.55));
    g.addColorStop(1, B.rgba(power.color, 0));
    ctx.fillStyle = g;
    circle(ctx, x, y, 20);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = power.color;
    circle(ctx, x, y, 10);
    ctx.strokeStyle = "#FFFCF2";
    ctx.fillStyle = "#FFFCF2";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    if (d.value === "frenzy") {
      // a lightning bolt
      ctx.moveTo(x + 2, y - 7);
      ctx.lineTo(x - 3, y + 1);
      ctx.lineTo(x + 2, y + 1);
      ctx.lineTo(x - 2, y + 7);
      ctx.stroke();
    } else if (d.value === "giant") {
      // arrows pointing outward
      ctx.moveTo(x - 6, y - 6);
      ctx.lineTo(x - 2, y - 2);
      ctx.moveTo(x + 6, y - 6);
      ctx.lineTo(x + 2, y - 2);
      ctx.moveTo(x - 6, y + 6);
      ctx.lineTo(x - 2, y + 2);
      ctx.moveTo(x + 6, y + 6);
      ctx.lineTo(x + 2, y + 2);
      ctx.stroke();
      circle(ctx, x, y, 2);
    } else if (d.value === "swift") {
      // two chevrons
      ctx.moveTo(x - 6, y - 5);
      ctx.lineTo(x - 1, y);
      ctx.lineTo(x - 6, y + 5);
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x + 5, y);
      ctx.lineTo(x, y + 5);
      ctx.stroke();
    } else {
      // a star
      for (var i = 0; i < 10; i++) {
        var a = -Math.PI / 2 + (i / 10) * TAU;
        var rr = i % 2 ? 2.8 : 6.5;
        if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
    }
  };

  /** Around the lemon while a power-up lasts: a ring in its colour, and for Star a rainbow. */
  B.drawBuffs = function (ctx, R) {
    var p = R.p;
    var ring = 0;
    for (var key in p.buffs) {
      if (!(p.buffs[key] > 0)) continue;
      var power = POWERS[key];
      if (!power) continue;
      var left = p.buffs[key];
      // blinks in its last two seconds, so you know it is running out
      if (left < 2 && Math.sin(R.t * 18) < 0) {
        ring++;
        continue;
      }
      ctx.strokeStyle = key === "star" ? "hsl(" + ((R.t * 360) % 360) + ",90%,70%)" : power.color;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 21 + ring * 5, R.t * 3 + ring, R.t * 3 + ring + TAU * 0.8);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ring++;
    }
  };
})();
