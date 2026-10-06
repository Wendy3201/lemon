/*!
 * Pip Survivors — pests
 * Every kind of pest, how they move and attack, the four boss patterns,
 * who turns up when, and how they are drawn.
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function () {
  "use strict";

  var PS = window.PS;
  var B = PS.B;
  var P = PS.palette;
  var TAU = Math.PI * 2;

  /* hp and hurt are for chapter 1; every chapter multiplies both. hurt is
     damage per second while touching the lemon. */
  var KINDS = (B.KINDS = {
    grunt: { r: 12, hp: 11, speed: 62, hurt: 26, xp: 1, mass: 1, fill: "#8FAE65" },
    dart: { r: 9, hp: 9, speed: 112, hurt: 21, xp: 1, mass: 0.7, fill: "#D98B3A" },
    brute: { r: 21, hp: 105, speed: 42, hurt: 44, xp: 5, mass: 3, fill: "#B9A98A" },
    spitter: { r: 13, hp: 28, speed: 56, hurt: 18, xp: 2, mass: 1, fill: "#B38AD9", ai: "spitter" },
    splitter: { r: 17, hp: 52, speed: 50, hurt: 30, xp: 3, mass: 1.6, fill: "#6FC2B0", split: 3 },
    mini: { r: 8, hp: 8, speed: 98, hurt: 16, xp: 1, mass: 0.5, fill: "#8AD9C8" },
    charger: { r: 15, hp: 58, speed: 66, hurt: 34, xp: 4, mass: 2, fill: "#D9685A", ai: "charger" },
    bomber: { r: 11, hp: 18, speed: 100, hurt: 0, xp: 2, mass: 0.8, fill: "#E0C341", ai: "bomber" }
  });

  var BOSSES = {
    queen: { r: 46, hp: 1, speed: 44, fill: "#7FB069" },
    hornet: { r: 38, hp: 0.85, speed: 78, fill: "#E0A93B" },
    slug: { r: 50, hp: 1.25, speed: 34, fill: "#9C8AC2" },
    mould: { r: 48, hp: 1.1, speed: 26, fill: "#6FA8A0" }
  };

  function blank(kind, x, y) {
    return {
      kind: kind, x: x, y: y, r: 10, fill: "#fff", hp: 1, maxHp: 1, speed: 0, hurt: 0, xp: 0, mass: 1, ai: null,
      flash: 0, kx: 0, ky: 0, stun: 0, chillT: 0, chillAmt: 0, burnT: 0, burnDps: 0, shockT: 0, shockAmp: 0, freezeCd: 0,
      mode: 0, clock: PS.rand(0.6, 2.4), clock2: 0, clock3: 0, ax: 0, ay: 0, side: Math.random() < 0.5 ? -1 : 1,
      wob: Math.random() * TAU, struck: false, peelCd: 0, elite: false, boss: false, dead: false, onDeath: null
    };
  }

  B.spawn = function (kind, x, y) {
    var R = B.run;
    var def = KINDS[kind];
    var e = blank(kind, x, y);
    // pests toughen up as the chapter goes on; the boss's helpers do not
    var age = R.phase === "boss" ? 0 : R.t;
    e.r = def.r;
    e.fill = def.fill;
    e.hp = e.maxHp = def.hp * R.ch.hpScale * (1 + age / 90);
    e.speed = def.speed * PS.rand(0.92, 1.08);
    e.hurt = def.hurt * R.ch.dmgScale * (1 + age / 400);
    e.xp = def.xp;
    e.mass = def.mass;
    e.ai = def.ai || null;
    if (def.split) e.onDeath = splitUp;
    R.enemies.push(e);
    return e;
  };

  function splitUp(e) {
    var count = KINDS[e.kind].split;
    for (var i = 0; i < count; i++) {
      var angle = (i / count) * TAU + e.wob;
      var mini = B.spawn("mini", e.x + Math.cos(angle) * 10, e.y + Math.sin(angle) * 10);
      mini.kx = Math.cos(angle) * 160;
      mini.ky = Math.sin(angle) * 160;
    }
  }

  function atRing(kind, angle) {
    var R = B.run;
    return B.spawn(kind, R.p.x + Math.cos(angle) * B.view.ring, R.p.y + Math.sin(angle) * B.view.ring);
  }

  function enemyShot(x, y, angle, speed, r, dmg, color) {
    B.run.ebullets.push({ x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: r, dmg: dmg, life: 4.2, color: color });
  }

  /* ------------------------------------------------------------ director */

  function pickKind(u) {
    var ch = B.run.ch;
    var kinds = ["grunt"];
    var weights = [1 - 0.4 * u];
    function offer(kind, weight, fromChapter, fromU) {
      var featured = ch.featured === kind;
      if (ch.n < fromChapter || u < (featured ? 0.08 : fromU)) return;
      kinds.push(kind);
      weights.push(featured ? weight * 2.2 : weight);
    }
    offer("dart", 0.15 + 0.35 * u, 1, 0.12);
    offer("brute", 0.05 + 0.12 * u, 1, 0.3);
    offer("spitter", 0.08 + 0.1 * u, 2, 0.18);
    offer("splitter", 0.06 + 0.08 * u, 3, 0.22);
    offer("charger", 0.05 + 0.08 * u, 5, 0.28);
    offer("bomber", 0.05 + 0.08 * u, 7, 0.33);
    return PS.weighted(kinds, weights);
  }

  B.director = function (dt) {
    var R = B.run;
    // the battle can be decided earlier in the same tick (the lemon's own
    // attack felling the boss): nothing more may spawn after that
    if (R.phase !== "swarm" && R.phase !== "boss") return;
    R.spawnIn -= dt;

    if (R.phase === "boss") {
      if (R.spawnIn <= 0) {
        if (R.enemies.length < 22) atRing(pickKind(0.6), Math.random() * TAU);
        R.spawnIn = 1.6;
      }
      return;
    }

    // the swarm thickens the whole way through the chapter
    var u = Math.min(1, R.t / R.dur);
    if (R.spawnIn <= 0) {
      if (R.enemies.length < 80 + 60 * u + R.ch.n * 2) {
        var pack = 1 + Math.floor(2.4 * u);
        var angle = Math.random() * TAU;
        while (pack--) atRing(pickKind(u), angle + PS.rand(-0.5, 0.5));
      }
      R.spawnIn = PS.lerp(0.8, 0.28, Math.pow(u, 0.8));
    }

    if (R.hordes.length && R.t >= R.hordes[0]) {
      R.hordes.shift();
      var count = 12 + Math.min(12, R.ch.n);
      var start = Math.random() * TAU;
      for (var i = 0; i < count; i++) atRing(u < 0.4 ? "grunt" : "dart", start + (i / count) * TAU);
      B.toast("A swarm closes in!");
    }

    if (R.elites.length && R.t >= R.elites[0]) {
      R.elites.shift();
      var elite = atRing(R.ch.n >= 5 && Math.random() < 0.5 ? "charger" : "brute", Math.random() * TAU);
      elite.elite = true;
      elite.r *= 1.55;
      elite.hp = elite.maxHp = elite.hp * 4;
      elite.hurt *= 1.5;
      elite.xp *= 10;
      elite.mass *= 3;
      B.toast("An elite pest is hunting you");
    }

    if (R.t >= R.dur) startBoss();
  };

  function startBoss() {
    var R = B.run;
    var def = BOSSES[R.ch.boss];
    var i;

    // the swarm scatters when the boss turns up, leaving its gems behind
    for (i = 0; i < R.enemies.length; i++) {
      var pest = R.enemies[i];
      if (pest.dead || pest.elite) continue;
      pest.dead = true;
      B.sparks(pest.x, pest.y, pest.fill, 3, 80);
      if (pest.xp) B.drop("xp", pest.x, pest.y, pest.xp);
    }
    for (i = 0; i < R.drops.length; i++) R.drops[i].pull = true;
    R.ebullets.length = 0;

    var angle = Math.random() * TAU;
    var e = blank(R.ch.boss, R.p.x + Math.cos(angle) * B.view.ring, R.p.y + Math.sin(angle) * B.view.ring);
    e.boss = true;
    e.name = R.ch.bossName;
    e.tier = R.ch.bossTier;
    e.r = def.r;
    e.fill = def.fill;
    e.hp = e.maxHp = 2250 * R.ch.bossScale * Math.pow(R.dur / 180, 1.3) * def.hp;
    e.speed = def.speed;
    e.hurt = 44 * R.ch.dmgScale;
    e.mass = 1e6;
    e.clock = 2.5;
    e.clock2 = 4;
    e.spin = 0;
    e.dashes = 0;
    e.age = 0;
    e.onDeath = function () { B.win(); };
    R.phase = "boss";
    R.reachedBoss = true;
    R.boss = e;
    R.spawnIn = 2;
    R.enemies.push(e);
    PS.sfx.play("boss");
    B.toast(e.name + " has arrived!");
  }

  /* ------------------------------------------------------------------ ai */

  function walk(e, nx, ny, step) {
    e.x += nx * step;
    e.y += ny * step;
  }

  /** Move and act. (dx, dy) points at the lemon, d is the distance. */
  B.think = function (e, dt, dx, dy, d) {
    var R = B.run;
    var slow = e.chillT > 0 ? 1 - e.chillAmt : 1;
    var nx = dx / d;
    var ny = dy / d;
    var scale = R.ch.dmgScale;

    if (e.boss) {
      bossThink(e, dt, nx, ny, d, slow, scale);
      return;
    }

    if (!e.ai) {
      walk(e, nx, ny, e.speed * slow * dt);
      return;
    }

    e.clock -= dt;
    if (e.ai === "spitter") {
      // hangs back at spitting distance and circles
      if (d > 230) walk(e, nx, ny, e.speed * slow * dt);
      else if (d < 160) walk(e, -nx, -ny, e.speed * 0.6 * slow * dt);
      else walk(e, -ny * e.side, nx * e.side, e.speed * 0.5 * slow * dt);
      if (e.clock <= 0) {
        if (d < 430) {
          enemyShot(e.x, e.y, Math.atan2(dy, dx), 150, 5, 16 * scale);
          e.clock = PS.rand(2.2, 3.2);
        } else {
          e.clock = 0.5;
        }
      }
    } else if (e.ai === "charger") {
      if (e.mode === 0) {
        walk(e, nx, ny, e.speed * slow * dt);
        if (d < 250 && e.clock <= 0) {
          e.mode = 1;
          e.clock = 0.6;
        }
      } else if (e.mode === 1) {
        // winding up: it keeps turning to face you until it goes
        e.ax = nx;
        e.ay = ny;
        if (e.clock <= 0) {
          e.mode = 2;
          e.clock = 0.55;
          e.struck = false;
        }
      } else if (e.mode === 2) {
        walk(e, e.ax, e.ay, 430 * slow * dt);
        if (!e.struck && d < e.r + R.p.r + 2) {
          e.struck = true;
          B.hurt(26 * scale);
        }
        if (e.clock <= 0) {
          e.mode = 3;
          e.clock = 0.9;
        }
      } else if (e.clock <= 0) {
        e.mode = 0;
        e.clock = PS.rand(1, 2.4);
      }
    } else if (e.ai === "bomber") {
      if (e.mode === 0) {
        walk(e, nx, ny, e.speed * slow * dt);
        if (d < 48) {
          e.mode = 1;
          e.clock = 0.65;
        }
      } else if (e.clock <= 0) {
        // goes off by itself: no experience for letting it
        e.dead = true;
        R.fx.push({ type: "blast", x: e.x, y: e.y, r: 68, color: "#E5484D", t: 0, dur: 0.3 });
        R.shake = Math.max(R.shake, 5);
        if (d < 68 + R.p.r) B.hurt(36 * scale);
      }
    }
  };

  function bossThink(e, dt, nx, ny, d, slow, scale) {
    var R = B.run;
    var p = R.p;
    var rage = e.hp < e.maxHp * 0.5 ? 0.72 : 1;
    var i;
    var count;
    var angle;
    e.age += dt;
    e.clock -= dt;
    e.clock2 -= dt;

    if (e.kind === "queen") {
      walk(e, nx, ny, e.speed * slow * dt);
      if (e.clock <= 0) {
        // a ring of grunts hatches around her
        e.clock = 6 * rage;
        count = 4 + e.tier * 2;
        if (R.enemies.length < 150) {
          for (i = 0; i < count; i++) {
            angle = (i / count) * TAU;
            B.spawn("grunt", e.x + Math.cos(angle) * (e.r + 26), e.y + Math.sin(angle) * (e.r + 26));
          }
        }
        R.fx.push({ type: "ring", x: e.x, y: e.y, r0: e.r, r1: e.r + 46, color: "#C8E6A0", t: 0, dur: 0.4 });
      }
      if (e.clock2 <= 0) {
        e.clock2 = 3.6 * rage;
        count = 10 + e.tier * 2;
        angle = Math.random() * TAU;
        for (i = 0; i < count; i++) enemyShot(e.x, e.y, angle + (i / count) * TAU, 125, 6, 14 * scale);
      }
    } else if (e.kind === "hornet") {
      if (e.mode === 0) {
        walk(e, nx, ny, e.speed * slow * dt);
        if (e.clock <= 0) {
          e.dashes = 2 + Math.floor(e.tier / 2);
          windUp(e, nx, ny, 0.7 * rage);
        }
      } else if (e.mode === 1) {
        if (e.clock <= 0) {
          e.mode = 2;
          e.clock = 0.6;
          e.struck = false;
        }
      } else if (e.mode === 2) {
        walk(e, e.ax, e.ay, 540 * slow * dt);
        if (!e.struck && d < e.r + p.r) {
          e.struck = true;
          B.hurt(30 * scale);
        }
        if (e.clock <= 0) {
          if (--e.dashes > 0) {
            windUp(e, nx, ny, 0.42 * rage);
          } else {
            // worn out: fires a fan of stings, then hovers for a moment
            e.mode = 3;
            e.clock = 1.6 * rage;
            var base = Math.atan2(ny, nx);
            count = 5 + e.tier;
            for (i = 0; i < count; i++) enemyShot(e.x, e.y, base + (i - (count - 1) / 2) * 0.22, 190, 5, 14 * scale, "#F2B93B");
          }
        }
      } else if (e.clock <= 0) {
        e.mode = 0;
        e.clock = 2.2 * rage;
      }
    } else if (e.kind === "slug") {
      walk(e, nx, ny, e.speed * slow * dt);
      e.clock3 -= dt;
      if (e.clock3 <= 0) {
        e.clock3 = 0.45;
        B.addZone({ type: "puddle", x: e.x, y: e.y, r: 30, life: 6, dps: 22 * scale, slow: 0.35, color: "#8A77B8" });
      }
      if (e.clock <= 0) {
        // lobs slime where you are standing: step out of the red circles
        e.clock = 4.6 * rage;
        count = 3 + e.tier;
        for (i = 0; i < count; i++) lobSlime(e, p.x + (i ? PS.rand(-100, 100) : 0), p.y + (i ? PS.rand(-100, 100) : 0), scale);
      }
    } else {
      // mould: a slow spiral of spores, and now and then a litter of bombers
      walk(e, nx, ny, e.speed * slow * dt);
      e.spin += dt * (1.1 + 0.15 * e.tier);
      if (e.clock <= 0) {
        e.clock = 0.16 * rage;
        var arms = 2 + (e.tier >= 2 ? 1 : 0) + (e.tier >= 4 ? 1 : 0);
        for (i = 0; i < arms; i++) enemyShot(e.x, e.y, e.spin + (i / arms) * TAU, 118, 5, 12 * scale, "#9BD1C6");
      }
      if (e.clock2 <= 0) {
        e.clock2 = 7 * rage;
        count = 3 + e.tier;
        if (R.enemies.length < 150) {
          for (i = 0; i < count; i++) {
            angle = (i / count) * TAU;
            B.spawn("bomber", e.x + Math.cos(angle) * (e.r + 20), e.y + Math.sin(angle) * (e.r + 20));
          }
        }
      }
    }
  }

  function windUp(e, nx, ny, time) {
    e.mode = 1;
    e.clock = time;
    e.ax = nx;
    e.ay = ny;
    B.addZone({ type: "lane", x: e.x, y: e.y, angle: Math.atan2(ny, nx), len: 340, width: e.r * 1.7, life: time });
  }

  function lobSlime(e, x, y, scale) {
    var R = B.run;
    R.fx.push({ type: "lob", x0: e.x, y0: e.y, x1: x, y1: y, color: "#8A77B8", size: 8, t: 0, dur: 0.95 });
    B.addZone({
      type: "warn", x: x, y: y, r: 54, life: 0.95,
      onEnd: function (zone) {
        var p = R.p;
        var dx = p.x - zone.x;
        var dy = p.y - zone.y;
        R.fx.push({ type: "blast", x: zone.x, y: zone.y, r: zone.r, color: "#8A77B8", t: 0, dur: 0.3 });
        if (dx * dx + dy * dy < (zone.r + p.r - 4) * (zone.r + p.r - 4)) B.hurt(32 * scale);
        B.addZone({ type: "puddle", x: zone.x, y: zone.y, r: 44, life: 5, dps: 22 * scale, slow: 0.35, color: "#8A77B8" });
      }
    });
  }

  /* ---------------------------------------------------------------- draw */

  function eyes(ctx, x, y, r, lookX, lookY, angry) {
    var ex = r * 0.36;
    var ey = -r * 0.1;
    var er = Math.max(1.4, r * 0.16);
    ctx.fillStyle = P.charcoal;
    ctx.beginPath();
    ctx.arc(x - ex + lookX, y + ey + lookY, er, 0, TAU);
    ctx.arc(x + ex + lookX, y + ey + lookY, er, 0, TAU);
    ctx.fill();
    if (angry) {
      ctx.strokeStyle = P.charcoal;
      ctx.lineWidth = Math.max(1.5, r * 0.09);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - ex - er * 1.4 + lookX, y + ey - er * 2 + lookY);
      ctx.lineTo(x - ex + er * 1.2 + lookX, y + ey - er * 1.1 + lookY);
      ctx.moveTo(x + ex + er * 1.4 + lookX, y + ey - er * 2 + lookY);
      ctx.lineTo(x + ex - er * 1.2 + lookX, y + ey - er * 1.1 + lookY);
      ctx.stroke();
    }
  }

  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  B.drawEnemy = function (ctx, e, R) {
    var p = R.p;
    var x = e.x;
    var y = e.y;
    var r = e.r;
    var dx = p.x - x;
    var dy = p.y - y;
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = dx / d;
    var ny = dy / d;
    var body = e.flash > 0 ? P.white : e.fill;
    var t = R.t + e.wob;
    var i;
    var angle;

    if (e.boss) {
      drawBoss(ctx, e, R, nx, ny, body);
      return;
    }

    if (e.elite) {
      ctx.strokeStyle = "#F2B93B";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r + 4 + Math.sin(t * 5) * 1.2, 0, TAU);
      ctx.stroke();
    }

    switch (e.kind) {
      case "dart":
        // wings
        ctx.fillStyle = "rgba(255,252,242,0.55)";
        var flap = 0.5 + 0.5 * Math.sin(t * 40);
        ctx.beginPath();
        ctx.ellipse(x - r * 0.9, y - r * 0.5, r * 0.9, r * 0.35 + flap * 2, -0.5, 0, TAU);
        ctx.ellipse(x + r * 0.9, y - r * 0.5, r * 0.9, r * 0.35 + flap * 2, 0.5, 0, TAU);
        ctx.fill();
        break;
      case "spitter":
        // two body segments trailing behind
        ctx.fillStyle = body;
        circle(ctx, x - nx * r * 1.1, y - ny * r * 1.1 + Math.sin(t * 7) * 1.5, r * 0.78);
        circle(ctx, x - nx * r * 2, y - ny * r * 2 + Math.sin(t * 7 + 1) * 1.5, r * 0.58);
        break;
      case "charger":
        // pincers out in front
        ctx.strokeStyle = e.mode === 1 ? "#FFB4A8" : "#8E3A30";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        angle = Math.atan2(e.mode >= 1 && e.mode <= 2 ? e.ay : ny, e.mode >= 1 && e.mode <= 2 ? e.ax : nx);
        for (i = -1; i <= 1; i += 2) {
          ctx.beginPath();
          ctx.arc(x + Math.cos(angle) * r * 0.9, y + Math.sin(angle) * r * 0.9, r * 0.7, angle + i * 0.25, angle + i * 1.5, i < 0);
          ctx.stroke();
        }
        if (e.mode === 1) {
          x += Math.sin(R.t * 60) * 1.5;
          body = e.flash > 0 ? P.white : "#F08A7A";
        }
        break;
      case "bomber":
        if (e.mode === 1) {
          var pulse = 0.5 + 0.5 * Math.sin(R.t * 40);
          r *= 1 + (0.65 - Math.max(0, e.clock)) * 0.5;
          body = pulse > 0.5 ? "#FFFCF2" : "#E5484D";
          ctx.strokeStyle = "rgba(229,72,77,0.6)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 68, 0, TAU);
          ctx.stroke();
        }
        break;
      default:
        break;
    }

    ctx.fillStyle = body;
    if (e.kind === "splitter" || e.kind === "mini") {
      // jelly wobble
      ctx.beginPath();
      ctx.ellipse(x, y, r * (1 + 0.08 * Math.sin(t * 6)), r * (1 - 0.08 * Math.sin(t * 6)), 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      circle(ctx, x - r * 0.35, y - r * 0.4, r * 0.22);
    } else {
      circle(ctx, x, y, r);
    }

    if (e.kind === "grunt") {
      ctx.strokeStyle = "#5F8244";
      ctx.lineWidth = 1.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - r * 0.3, y - r * 0.85);
      ctx.lineTo(x - r * 0.6, y - r * 1.5);
      ctx.moveTo(x + r * 0.3, y - r * 0.85);
      ctx.lineTo(x + r * 0.6, y - r * 1.5);
      ctx.stroke();
    } else if (e.kind === "brute") {
      // a shell with a seam down the middle
      ctx.strokeStyle = "rgba(41,38,31,0.3)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r - 2.5, 0, TAU);
      ctx.moveTo(x, y + r * 0.25);
      ctx.lineTo(x, y + r - 2);
      ctx.stroke();
    } else if (e.kind === "bomber" && e.mode === 0) {
      ctx.strokeStyle = "#8C6A12";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.75, y + r * 0.45);
      ctx.lineTo(x + r * 0.75, y + r * 0.45);
      ctx.stroke();
    } else if (e.kind === "spitter" && e.clock < 0.4) {
      // mouth opens just before it spits
      ctx.fillStyle = "#E5484D";
      circle(ctx, x + nx * r * 0.2, y + r * 0.42, r * 0.26);
    }

    eyes(ctx, x, y, r, nx * r * 0.12, ny * r * 0.1, e.kind === "brute" || e.kind === "charger" || e.elite);
    drawStatus(ctx, e, x, y, r);

    if (e.elite) {
      ctx.fillStyle = "rgba(20,18,14,0.6)";
      ctx.fillRect(x - r, y - r - 12, r * 2, 4);
      ctx.fillStyle = "#F2B93B";
      ctx.fillRect(x - r, y - r - 12, r * 2 * Math.max(0, e.hp / e.maxHp), 4);
    }
  };

  function drawStatus(ctx, e, x, y, r) {
    if (e.stun > 0 && e.chillT > 0) {
      // frozen solid
      ctx.fillStyle = "rgba(160,225,255,0.6)";
      circle(ctx, x, y, r + 1.5);
    } else if (e.chillT > 0) {
      ctx.fillStyle = "rgba(127,212,245,0.38)";
      circle(ctx, x, y, r);
    }
    if (e.burnT > 0) {
      ctx.strokeStyle = "rgba(242,107,42,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r + 1.5, 0, TAU);
      ctx.stroke();
    }
    if (e.shockT > 0) {
      ctx.strokeStyle = "rgba(255,230,109,0.95)";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.arc(x, y, r + 4, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawBoss(ctx, e, R, nx, ny, body) {
    var x = e.x;
    var y = e.y;
    var r = e.r;
    var t = R.t;
    var i;
    var angle;
    var dark = "rgba(41,38,31,0.35)";

    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.85, r * 0.95, r * 0.28, 0, 0, TAU);
    ctx.fill();

    if (e.kind === "queen") {
      // a fat abdomen behind, feelers on top
      ctx.fillStyle = body;
      circle(ctx, x - nx * r * 0.75, y - ny * r * 0.75, r * 0.85);
      circle(ctx, x, y, r);
      ctx.strokeStyle = "#4E7A3A";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - r * 0.3, y - r * 0.85);
      ctx.quadraticCurveTo(x - r * 0.9, y - r * 1.5, x - r * 0.75 + Math.sin(t * 3) * 3, y - r * 1.75);
      ctx.moveTo(x + r * 0.3, y - r * 0.85);
      ctx.quadraticCurveTo(x + r * 0.9, y - r * 1.5, x + r * 0.75 + Math.sin(t * 3 + 1) * 3, y - r * 1.75);
      ctx.stroke();
    } else if (e.kind === "hornet") {
      angle = Math.atan2(e.mode === 1 || e.mode === 2 ? e.ay : ny, e.mode === 1 || e.mode === 2 ? e.ax : nx);
      var flap = Math.sin(t * 50) * 5;
      ctx.fillStyle = "rgba(255,252,242,0.5)";
      ctx.beginPath();
      ctx.ellipse(x - r * 0.95, y - r * 0.55, r * 0.95, r * 0.4 + flap * 0.4, -0.5, 0, TAU);
      ctx.ellipse(x + r * 0.95, y - r * 0.55, r * 0.95, r * 0.4 - flap * 0.4, 0.5, 0, TAU);
      ctx.fill();
      // stinger points the way it will go
      ctx.fillStyle = "#3A2A10";
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * (r + 16), y + Math.sin(angle) * (r + 16));
      ctx.lineTo(x + Math.cos(angle + 0.32) * r * 0.95, y + Math.sin(angle + 0.32) * r * 0.95);
      ctx.lineTo(x + Math.cos(angle - 0.32) * r * 0.95, y + Math.sin(angle - 0.32) * r * 0.95);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = e.mode === 3 ? "#F3D58C" : body;
      circle(ctx, x, y, r);
      // stripes, kept inside the body
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.clip();
      ctx.fillStyle = "#3A2A10";
      ctx.fillRect(x - r, y + r * 0.18, r * 2, r * 0.24);
      ctx.fillRect(x - r, y + r * 0.6, r * 2, r * 0.24);
      ctx.restore();
    } else if (e.kind === "slug") {
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(x - nx * r * 0.5, y - ny * r * 0.5 + r * 0.15, r * 1.25, r * 0.8, Math.atan2(ny, nx), 0, TAU);
      ctx.fill();
      circle(ctx, x, y, r * 0.9);
      // eye stalks
      ctx.strokeStyle = body;
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      for (i = -1; i <= 1; i += 2) {
        ctx.beginPath();
        ctx.moveTo(x + i * r * 0.35, y - r * 0.7);
        ctx.lineTo(x + i * r * 0.5 + Math.sin(t * 2 + i) * 3, y - r * 1.35);
        ctx.stroke();
        ctx.fillStyle = P.white;
        circle(ctx, x + i * r * 0.5 + Math.sin(t * 2 + i) * 3, y - r * 1.4, 6);
        ctx.fillStyle = P.charcoal;
        circle(ctx, x + i * r * 0.5 + Math.sin(t * 2 + i) * 3 + nx * 2, y - r * 1.4 + ny * 2, 3);
      }
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      circle(ctx, x - r * 0.3, y - r * 0.35, r * 0.2);
    } else {
      // mould: a fuzzy ball that slowly turns
      ctx.fillStyle = body;
      for (i = 0; i < 14; i++) {
        angle = (i / 14) * TAU + e.spin * 0.4;
        circle(ctx, x + Math.cos(angle) * r * 0.86, y + Math.sin(angle) * r * 0.86, r * 0.27 + Math.sin(t * 4 + i) * 1.5);
      }
      circle(ctx, x, y, r * 0.92);
      ctx.fillStyle = dark;
      circle(ctx, x - r * 0.45, y + r * 0.35, r * 0.13);
      circle(ctx, x + r * 0.5, y + r * 0.2, r * 0.1);
      circle(ctx, x + r * 0.1, y + r * 0.55, r * 0.08);
    }

    if (e.kind !== "slug") eyes(ctx, x, y, r * 0.8, nx * r * 0.1, ny * r * 0.08, true);

    // a crown, because it is the boss
    var cy = y - r * (e.kind === "queen" || e.kind === "slug" ? 0.78 : 0.95);
    ctx.fillStyle = "#F2B93B";
    ctx.strokeStyle = "#B97F14";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 13, cy);
    ctx.lineTo(x - 15, cy - 15);
    ctx.lineTo(x - 7, cy - 8);
    ctx.lineTo(x, cy - 18);
    ctx.lineTo(x + 7, cy - 8);
    ctx.lineTo(x + 15, cy - 15);
    ctx.lineTo(x + 13, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    drawStatus(ctx, e, x, y, r);
  }
})();
