/*!
 * Pip Survivors — weapons in battle
 * How each weapon attacks, what its perks change, and how it is drawn in the
 * lemon's hands and in flight.
 *
 * Every weapon is { cd, range | reach(p), pierces?, countName, countText,
 * attack(aim, target, empowered, mult), tick?(dt), held(ctx, k) }:
 *   aim        angle towards the target
 *   empowered  true on every Nth attack once the Epic perk is unlocked
 *   mult       damage multiplier (below 1 for the echo of an attack)
 *   held       draws the weapon with +x pointing where the lemon aims;
 *              k runs 1 -> 0 over the fifth of a second after an attack
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function () {
  "use strict";

  var PS = window.PS;
  var B = PS.B;
  var P = PS.palette;
  var TAU = Math.PI * 2;
  var W = (B.WEAPONS = {});

  var SIDES = [0, Math.PI, Math.PI / 2, -Math.PI / 2];
  var FAN = [0, 1, -1, 2, -2, 3, -3, 4, -4];

  var WOOD = "#A0703F";
  var WOOD_DARK = "#70492A";
  var STEEL = "#CBD2DC";
  var STEEL_DARK = "#8D96A8";
  var GOLD = "#F2B93B";
  var ICE = "#7FD4F5";
  var FIRE = "#F26B2A";
  var VOID = "#B48CFF";

  /* ----------------------------------------------------------- the sling */

  function splinter(shot, e) {
    if (shot.split) return;
    shot.split = true;
    var base = Math.atan2(shot.vy, shot.vx);
    for (var i = -1; i <= 1; i++) {
      B.shoot({
        x: shot.x, y: shot.y, angle: base + i * 0.6 + PS.rand(-0.12, 0.12),
        speed: 360, range: 170, r: 3.5, dmg: shot.dmg * 0.4, sprite: "pip", bounce: 0
      }).seen.push(e);
    }
  }

  W.sling = {
    cd: 0.55, range: 380, pierces: true,
    countName: "Multishot", countText: "+1 pip with every shot",
    attack: function (aim, target, empowered, mult) {
      var p = B.run.p;
      var dmg = B.dmg() * mult;
      var size = Math.sqrt(B.area());
      var n = 1 + B.count();
      for (var i = 0; i < n; i++) {
        B.shoot({
          angle: aim + (i - (n - 1) / 2) * 0.16, speed: 400, range: 380, r: 5 * size,
          dmg: dmg, pierce: B.pierce(), sprite: "pip", onHit: p.fx.q ? splinter : null
        });
      }
      if (empowered) {
        B.shoot({ angle: aim, speed: 360, range: 460, r: 12 * size, dmg: dmg * 3, pierce: 999, sprite: "pip", color: P.pale, bounce: 0 });
      }
    },
    held: function (ctx, k) {
      ctx.strokeStyle = WOOD;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(8, 4);
      ctx.lineTo(15, 4);
      ctx.lineTo(21, -1);
      ctx.moveTo(15, 4);
      ctx.lineTo(21, 9);
      ctx.stroke();
      ctx.strokeStyle = WOOD_DARK;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(21, -1);
      ctx.lineTo(17 - k * 5, 4);
      ctx.lineTo(21, 9);
      ctx.stroke();
    }
  };

  /* -------------------------------------------------------------- blades */

  function drawBlade(ctx, k, length, width, blade, guard) {
    // swings through the arc as the attack plays out
    ctx.rotate((k - 0.5) * 2.1 * (k > 0 ? 1 : 0));
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(10, 2, 6, 3);
    ctx.fillStyle = guard;
    ctx.fillRect(15, -1.5, 3, 10);
    ctx.fillStyle = blade;
    ctx.beginPath();
    ctx.moveTo(18, 3.5 - width / 2);
    ctx.lineTo(18 + length - 5, 3.5 - width / 2);
    ctx.lineTo(18 + length, 3.5);
    ctx.lineTo(18 + length - 5, 3.5 + width / 2);
    ctx.lineTo(18, 3.5 + width / 2);
    ctx.closePath();
    ctx.fill();
  }

  W.blade = {
    cd: 0.65,
    reach: function (p) { return p.fx.wave ? 240 : 102 * B.area(); },
    countName: "Double slash", countText: "Slash in one more direction",
    attack: function (aim, target, empowered, mult) {
      var p = B.run.p;
      var area = B.area();
      var dmg = B.dmg() * 1.5 * mult;
      var opts = { knock: 300, color: P.white };
      var dirs = [];
      var i;
      if (empowered) {
        B.sweep(aim, Math.PI, 96 * area, dmg * 1.3, opts);
        dirs.push(aim);
      } else {
        for (i = 0; i <= B.count(); i++) {
          dirs.push(aim + SIDES[i % 4]);
          B.sweep(aim + SIDES[i % 4], 1.4, 96 * area, dmg, opts);
        }
      }
      if (p.fx.wave) {
        for (i = 0; i < dirs.length; i++) {
          B.shoot({ angle: dirs[i], speed: 380, range: 260, r: 20 * area, dmg: B.dmg() * 0.8 * mult, pierce: 999, sprite: "wave", color: P.pale, bounce: 0 });
        }
      }
    },
    held: function (ctx, k) { drawBlade(ctx, k, 20, 5, STEEL, GOLD); }
  };

  W.solstice = {
    cd: 0.8, range: 300,
    countName: "Double swing", countText: "Swing in one more direction",
    attack: function (aim, target, empowered, mult) {
      var p = B.run.p;
      var area = B.area();
      var dmg = B.dmg() * 1.7 * mult;
      var opts = { knock: 340, color: "#FFD166" };
      var big = p.fx.q && p.hp > p.maxHp * 0.7 ? 2 : 1;
      var dirs = [];
      var i;
      if (empowered) {
        B.sweep(aim, Math.PI, 100 * area, dmg * 1.3, opts);
        for (i = 0; i < 4; i++) dirs.push(aim + SIDES[i]);
      } else {
        for (i = 0; i <= B.count(); i++) {
          dirs.push(aim + SIDES[i % 4]);
          B.sweep(aim + SIDES[i % 4], 1.31, 100 * area, dmg, opts);
        }
      }
      for (i = 0; i < dirs.length; i++) {
        B.shoot({ angle: dirs[i], speed: 400, range: 320, r: 24 * area * big, dmg: B.dmg() * 0.9 * mult, pierce: 999, sprite: "wave", color: "#FFB84A", bounce: 0 });
      }
    },
    tick: function (dt) {
      var R = B.run;
      var p = R.p;
      if (!p.fx.sunflare) return;
      p.timers.flare = (p.timers.flare === undefined ? 6 : p.timers.flare) - dt;
      if (p.timers.flare > 0) return;
      p.timers.flare = 6;
      var dmg = B.dmg() * 1.5;
      var range = B.view.ring;
      for (var i = 0, n = R.enemies.length; i < n; i++) {
        var e = R.enemies[i];
        var dx = e.x - p.x;
        var dy = e.y - p.y;
        if (!e.dead && dx * dx + dy * dy < range * range) B.hit(e, dmg, null);
      }
      R.fx.push({ type: "ring", x: p.x, y: p.y, r0: 20, r1: range, color: "#FFD166", width: 10, t: 0, dur: 0.5 });
      R.shake = Math.max(R.shake, 5);
    },
    held: function (ctx, k) {
      drawBlade(ctx, k, 30, 8, "#FFE08A", "#F2A31B");
      ctx.fillStyle = "#FFF9E6";
      ctx.fillRect(20, 2.5, 22, 2);
    }
  };

  /* ---------------------------------------------------------------- bows */

  function bowAttack(cfg, aim, empowered, mult) {
    var n = 1 + B.count() + (empowered ? cfg.volley : 0);
    var gap = empowered ? 0.13 : 0.09;
    var dmg = B.dmg() * cfg.dmg * mult;
    for (var i = 0; i < n; i++) {
      B.shoot({
        angle: aim + (i - (n - 1) / 2) * gap, speed: cfg.speed, range: 560, r: 4.5,
        dmg: dmg, pierce: cfg.pierce + B.pierce(), sprite: "arrow", color: cfg.color
      });
    }
  }

  function drawBow(ctx, k, wood, stringColor) {
    ctx.strokeStyle = wood;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(9, 0, 12, -1.15, 1.15);
    ctx.stroke();
    var top = 9 + Math.cos(1.15) * 12;
    var pull = (1 - k) * 5;
    ctx.strokeStyle = stringColor;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(top, -Math.sin(1.15) * 12);
    ctx.lineTo(top - pull, 0);
    ctx.lineTo(top, Math.sin(1.15) * 12);
    ctx.stroke();
  }

  W.bow = {
    cd: 0.72, range: 560, pierces: true,
    countName: "Multishot", countText: "+1 arrow with every shot",
    attack: function (aim, target, empowered, mult) {
      bowAttack({ dmg: 1.35, speed: 640, pierce: 1, volley: 4, color: "#E9D8A6" }, aim, empowered, mult);
    },
    held: function (ctx, k) { drawBow(ctx, k, "#7A9A52", P.white); }
  };

  W.frost = {
    cd: 0.7, range: 560, pierces: true,
    countName: "Multishot", countText: "+1 arrow with every shot",
    attack: function (aim, target, empowered, mult) {
      bowAttack({ dmg: 1.3, speed: 620, pierce: 2, volley: 6, color: ICE }, aim, empowered, mult);
    },
    held: function (ctx, k) { drawBow(ctx, k, "#3A9BD9", "#DDF4FF"); }
  };

  /* -------------------------------------------------------------- staves */

  function meteor(shot) {
    var x = shot.x;
    var y = shot.y;
    var r = shot.blast * 1.5;
    var dmg = shot.blastDmg * 1.5;
    B.run.fx.push({ type: "ring", x: x, y: y, r0: r, r1: r * 0.3, color: "#9BE08A", width: 3, t: 0, dur: 0.4 });
    B.later(0.4, function () { B.blast(x, y, r, dmg, { color: "#C8F2B0" }); });
  }

  function drawStaff(ctx, k, shaft, orb, glow) {
    ctx.strokeStyle = shaft;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(4, 9);
    ctx.lineTo(22, 1);
    ctx.stroke();
    ctx.fillStyle = glow;
    ctx.globalAlpha = 0.35 + k * 0.5;
    ctx.beginPath();
    ctx.arc(24, 0, 8 + k * 3, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = orb;
    ctx.beginPath();
    ctx.arc(24, 0, 4.5, 0, TAU);
    ctx.fill();
  }

  W.staff = {
    cd: 0.95, range: 420,
    countName: "Extra orb", countText: "+1 orb with every cast",
    attack: function (aim, target, empowered, mult) {
      var p = B.run.p;
      var area = B.area();
      var n = 1 + B.count() + (empowered ? 2 : 0);
      for (var i = 0; i < n; i++) {
        B.shoot({
          angle: aim + (i - (n - 1) / 2) * 0.22, speed: 270, range: 420, r: 8, dmg: 0, sprite: "orb", color: "#9BE08A",
          blast: 52 * area, blastDmg: B.dmg() * 1.25 * mult, bounce: 0, onEnd: p.fx.q ? meteor : null
        });
      }
    },
    held: function (ctx, k) { drawStaff(ctx, k, WOOD, "#C8F2B0", "#9BE08A"); }
  };

  W.storm = {
    cd: 0.8, range: 360,
    countName: "Forked lightning", countText: "Lightning starts at one more pest",
    attack: function (aim, target, empowered, mult) {
      var R = B.run;
      var p = R.p;
      var area = B.area();
      var dmg = B.dmg() * 1.3 * mult;
      var hits = 4 + (p.fx.chain || 0);
      var used = [];
      var from = target;
      for (var i = 0; i <= B.count() && from; i++) {
        var before = used.length;
        used = B.chain(p.x, p.y, from, dmg, hits, 140 * area, used);
        // with nothing left to jump to, the spare charge goes back into the first pest
        var spare = hits - (used.length - before);
        if (spare > 0) B.hit(from, dmg * 0.4 * Math.min(2, spare), null);
        from = B.nearest(p.x, p.y, 360, used);
      }
      if (empowered) {
        var strike = function () {
          var e = B.randomNear(380);
          if (!e) return;
          R.fx.push({ type: "bolt", pts: [e.x + PS.rand(-30, 30), e.y - 260, e.x, e.y], t: 0, dur: 0.25, seed: Math.random() * 1000 });
          B.blast(e.x, e.y, 36 * area, B.dmg() * 1.5 * mult, { color: "#8EC5FF", quiet: true });
        };
        for (var k = 0; k < 6; k++) B.later(0.08 * k, strike);
      }
    },
    held: function (ctx, k) {
      drawStaff(ctx, k, "#5C6B8A", "#FFFDF0", "#8EC5FF");
      ctx.strokeStyle = "#FFE14A";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(26, -5);
      ctx.lineTo(22, 0);
      ctx.lineTo(26, 0);
      ctx.lineTo(22, 5);
      ctx.stroke();
    }
  };

  function castVortex(x, y, mult) {
    var p = B.run.p;
    var area = B.area();
    var base = B.dmg();
    var dx = x - p.x;
    var dy = y - p.y;
    B.shoot({
      angle: Math.atan2(dy, dx), speed: 320, range: Math.max(30, Math.sqrt(dx * dx + dy * dy)), r: 9,
      dmg: 0, pierce: 999, sprite: "void", bounce: 0,
      onEnd: function (shot) {
        B.addZone({
          type: "vortex", x: shot.x, y: shot.y, r: 95 * area, life: 1.3, pull: 120, tickDmg: base * 0.3 * mult, fed: 0,
          onEnd: function (zone) {
            B.blast(zone.x, zone.y, 110 * area, base * 2.2 * mult * (1 + 0.1 * zone.fed), { color: VOID, knock: 60 });
            if (!p.fx.shards) return;
            for (var k = 0; k < 10; k++) {
              B.shoot({ x: zone.x, y: zone.y, angle: (k / 10) * TAU, speed: 380, range: 240, r: 4.5, dmg: base * 0.6 * mult, pierce: 2, sprite: "shard", bounce: 0 });
            }
          }
        });
      }
    });
  }

  W.eclipse = {
    cd: 1.5, range: 400,
    countName: "Twin singularity", countText: "+1 black hole with every cast",
    attack: function (aim, target, empowered, mult) {
      var n = 1 + B.count() + (empowered ? 1 : 0);
      var used = [];
      for (var i = 0; i < n; i++) {
        var spot = B.cluster(400, 90, used) || target;
        used.push(spot);
        castVortex(spot.x, spot.y, mult);
      }
    },
    held: function (ctx, k) {
      drawStaff(ctx, k, "#4A3F6B", "#1B1630", VOID);
      ctx.strokeStyle = VOID;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(24, 0, 6.5, 0.6, 5.2);
      ctx.stroke();
    }
  };

  /* -------------------------------------------------------------- spears */

  function spearAttack(cfg, aim, empowered, mult) {
    var R = B.run;
    var p = R.p;
    var area = B.area();
    var length = cfg.len * area;
    var dmg = B.dmg() * cfg.dmg * mult;
    var n = 1 + B.count() + (empowered ? 2 : 0);
    var angles = [];
    var i;
    for (i = 0; i < n; i++) angles.push(aim + FAN[i % FAN.length] * 0.34);
    if (p.fx.back) {
      for (i = 0; i < n; i++) angles.push(angles[i] + Math.PI);
    }
    for (i = 0; i < angles.length; i++) {
      B.thrust(angles[i], length, cfg.width, dmg, { knock: 260, color: cfg.color });
      if (cfg.scorch && empowered) {
        for (var step = 1; step <= 3; step++) {
          B.addZone({
            type: "fire", x: p.x + Math.cos(angles[i]) * length * step * 0.3, y: p.y + Math.sin(angles[i]) * length * step * 0.3,
            r: 22, life: 2.5, dps: B.dmg() * 0.5
          });
        }
      }
    }
    if (p.fx.q && cfg.tip) {
      B.shoot({
        x: p.x + Math.cos(aim) * length * 0.8, y: p.y + Math.sin(aim) * length * 0.8,
        angle: aim, speed: 520, range: 300, r: 7, dmg: B.dmg() * mult, pierce: 999, sprite: "tip", color: STEEL, bounce: 0
      });
    }
    if (p.fx.q && cfg.breath) B.sweep(aim, 0.6, 150 * area, B.dmg() * 0.8 * mult, { color: FIRE });
  }

  function drawSpear(ctx, k, shaft, head) {
    var lunge = k * 12;
    ctx.strokeStyle = shaft;
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-6 + lunge, 6);
    ctx.lineTo(24 + lunge, 6);
    ctx.stroke();
    ctx.fillStyle = head;
    ctx.beginPath();
    ctx.moveTo(34 + lunge, 6);
    ctx.lineTo(24 + lunge, 2);
    ctx.lineTo(24 + lunge, 10);
    ctx.closePath();
    ctx.fill();
  }

  W.spear = {
    cd: 0.7,
    reach: function () { return 175 * B.area(); },
    countName: "Extra stab", countText: "Stab in one more direction",
    attack: function (aim, target, empowered, mult) {
      spearAttack({ len: 185, width: 40, dmg: 1.9, color: P.white, tip: true }, aim, empowered, mult);
    },
    held: function (ctx, k) { drawSpear(ctx, k, WOOD, STEEL); }
  };

  W.ember = {
    cd: 0.7,
    reach: function () { return 190 * B.area(); },
    countName: "Extra stab", countText: "Stab in one more direction",
    attack: function (aim, target, empowered, mult) {
      spearAttack({ len: 200, width: 42, dmg: 1.9, color: "#FFB15A", scorch: true, breath: true }, aim, empowered, mult);
    },
    held: function (ctx, k) { drawSpear(ctx, k, "#7A2E1E", FIRE); }
  };

  /* -------------------------------------------------------------- knives */

  function bonusKnife(shot, e, flags) {
    if (!(flags & 2)) return;
    var next = B.nearest(e.x, e.y, 200, [e]);
    if (!next) return;
    B.shoot({
      x: e.x, y: e.y, angle: Math.atan2(next.y - e.y, next.x - e.x),
      speed: 520, range: 220, r: 4, dmg: shot.dmg, sprite: "knife", color: STEEL
    }).seen.push(e);
  }

  function throwKnives(aim, n, gap, dmg, color, onHit) {
    var p = B.run.p;
    p.timers.hand = -(p.timers.hand || 1);
    var ox = -Math.sin(aim) * 6 * p.timers.hand;
    var oy = Math.cos(aim) * 6 * p.timers.hand;
    for (var i = 0; i < n; i++) {
      B.shoot({
        x: p.x + ox, y: p.y + oy, angle: aim + (i - (n - 1) / 2) * gap, speed: 530, range: 240, r: 4,
        dmg: dmg, pierce: B.pierce(), sprite: "knife", color: color, onHit: onHit || null
      });
    }
  }

  function drawKnives(ctx, k, blade) {
    var hand = B.run.p.timers.hand || 1;
    ctx.fillStyle = blade;
    for (var side = -1; side <= 1; side += 2) {
      // the hand that has just thrown is still stretched out
      var push = side === hand ? k * 6 : 0;
      ctx.beginPath();
      ctx.moveTo(22 + push, side * 8);
      ctx.lineTo(12 + push, side * 8 - 2.2);
      ctx.lineTo(12 + push, side * 8 + 2.2);
      ctx.closePath();
      ctx.fill();
    }
  }

  W.daggers = {
    cd: 0.26, range: 230, pierces: true,
    countName: "Extra knife", countText: "+1 knife with every throw",
    attack: function (aim, target, empowered, mult) {
      var p = B.run.p;
      var n = 2 + B.count() + (empowered ? 3 : 0);
      throwKnives(aim, n, empowered ? 0.22 : 0.1, B.dmg() * 0.36 * mult, STEEL, p.fx.critShot ? bonusKnife : null);
    },
    held: function (ctx, k) { drawKnives(ctx, k, STEEL); }
  };

  W.fangs = {
    cd: 0.32, range: 250, pierces: true,
    countName: "Extra fang", countText: "+1 knife with every throw",
    attack: function (aim, target, empowered, mult) {
      var p = B.run.p;
      var dmg = B.dmg() * 0.5 * mult;
      var n = 3 + B.count();
      var i;
      throwKnives(aim, n, 0.18, dmg, "#B9A6FF", null);
      if (empowered) {
        for (i = 0; i < 12; i++) {
          B.shoot({ angle: aim + (i / 12) * TAU, speed: 530, range: 240, r: 4, dmg: dmg, pierce: B.pierce(), sprite: "knife", color: "#B9A6FF" });
        }
      }
      if (p.fx.q) {
        var second = B.nearest(p.x, p.y, 250, [target]);
        var angle = second ? Math.atan2(second.y - p.y, second.x - p.x) : aim + Math.PI;
        throwKnives(angle, n, 0.18, dmg * 0.7, "#5B4B8A", null);
      }
    },
    held: function (ctx, k) { drawKnives(ctx, k, "#8E7BFF"); }
  };

  /* -------------------------------------------------------------- hammer */

  W.hammer = {
    cd: 1.2,
    reach: function () { return 84 * B.area(); },
    countName: "Aftershock", countText: "Every slam hits one more time",
    attack: function (aim, target, empowered, mult) {
      var p = B.run.p;
      var r = 92 * B.area();
      var dmg = B.dmg() * 1.9 * mult * (empowered ? 1.5 : 1);
      B.blast(p.x, p.y, r, dmg, { knock: 420, stun: empowered ? 1.2 : 0, color: P.pale, swat: true });
      var again = function () { B.blast(p.x, p.y, r, dmg * 0.7, { knock: 300, color: P.pale, swat: true }); };
      for (var i = 1; i <= B.count(); i++) B.later(0.18 * i, again);
      if (p.fx.ring2) {
        B.later(0.2, function () { B.blast(p.x, p.y, r * 1.6, dmg * 0.6, { knock: 300, color: P.rind }); });
      }
      if (p.fx.q) {
        B.addZone({ type: "fire", x: p.x, y: p.y, r: r * 0.9, life: 3, dps: B.dmg() * 0.8, color: "#8A6A3A", core: "#D9B36A" });
      }
    },
    held: function (ctx, k) {
      ctx.rotate(-0.9 + (1 - k) * 0.9);
      ctx.strokeStyle = WOOD;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(8, 5);
      ctx.lineTo(26, 5);
      ctx.stroke();
      ctx.fillStyle = STEEL_DARK;
      ctx.fillRect(22, -3, 10, 16);
      ctx.fillStyle = STEEL;
      ctx.fillRect(22, -3, 10, 4);
    }
  };

  /* ----------------------------------------------------------- boomerang */

  W.rang = {
    cd: 0.95, range: 300,
    countName: "Extra boomerang", countText: "+1 boomerang with every throw",
    attack: function (aim, target, empowered, mult) {
      var p = B.run.p;
      var area = B.area();
      var n = 1 + B.count() + (empowered ? 2 : 0);
      for (var i = 0; i < n; i++) {
        B.shoot({
          angle: aim + (i - (n - 1) / 2) * 0.32, speed: 430, range: 99999, r: 12 * Math.sqrt(area),
          dmg: B.dmg() * mult, pierce: 99999, sprite: "rang", color: P.rind, spin: 18, bounce: 0,
          rang: { out: true, gone: 0, dist: 250 * area, trips: p.fx.q ? 2 : 1 }
        });
      }
    },
    held: function (ctx, k) {
      if (k > 0.2) return; // it is out of the lemon's hands
      ctx.strokeStyle = P.rind;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(12, -3);
      ctx.lineTo(20, 5);
      ctx.lineTo(12, 13);
      ctx.stroke();
    }
  };

  /* ------------------------------------------------------- held + flying */

  Object.keys(W).forEach(function (id) {
    var draw = W[id].held;
    W[id].held = function (ctx, p) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.aim);
      draw(ctx, p.swing / 0.2);
      ctx.restore();
    };
  });

  B.drawShot = function (ctx, s) {
    var angle;
    switch (s.sprite) {
      case "arrow":
        angle = Math.atan2(s.vy, s.vx);
        var cx = Math.cos(angle);
        var cy = Math.sin(angle);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2.2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(s.x - cx * 13, s.y - cy * 13);
        ctx.lineTo(s.x + cx * 4, s.y + cy * 4);
        ctx.stroke();
        ctx.fillStyle = P.white;
        ctx.beginPath();
        ctx.moveTo(s.x + cx * 8, s.y + cy * 8);
        ctx.lineTo(s.x + cx * 1 - cy * 3.6, s.y + cy * 1 + cx * 3.6);
        ctx.lineTo(s.x + cx * 1 + cy * 3.6, s.y + cy * 1 - cx * 3.6);
        ctx.closePath();
        ctx.fill();
        break;
      case "knife":
      case "tip":
      case "shard":
        angle = Math.atan2(s.vy, s.vx);
        var kx = Math.cos(angle);
        var ky = Math.sin(angle);
        var len = s.sprite === "tip" ? 12 : 8;
        var wide = s.sprite === "tip" ? 5 : 3;
        ctx.fillStyle = s.sprite === "shard" ? VOID : s.color;
        ctx.beginPath();
        ctx.moveTo(s.x + kx * len, s.y + ky * len);
        ctx.lineTo(s.x - ky * wide, s.y + kx * wide);
        ctx.lineTo(s.x - kx * len * 0.7, s.y - ky * len * 0.7);
        ctx.lineTo(s.x + ky * wide, s.y - kx * wide);
        ctx.closePath();
        ctx.fill();
        break;
      case "orb":
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r + 5 + Math.sin(s.age * 20) * 1.5, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, TAU);
        ctx.fill();
        ctx.fillStyle = P.white;
        ctx.beginPath();
        ctx.arc(s.x - 2, s.y - 2, s.r * 0.35, 0, TAU);
        ctx.fill();
        break;
      case "void":
        ctx.fillStyle = "#1B1630";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = VOID;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r + 2, s.age * 9, s.age * 9 + 4.2);
        ctx.stroke();
        break;
      case "wave":
        // a crescent, bulging the way it travels
        angle = Math.atan2(s.vy, s.vx);
        ctx.globalAlpha = Math.min(1, s.life * 4);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = Math.max(3, s.r * 0.28);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(s.x - Math.cos(angle) * s.r, s.y - Math.sin(angle) * s.r, s.r * 1.25, angle - 0.85, angle + 0.85);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      case "rang":
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.r * 0.45;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(-s.r * 0.8, -s.r * 0.5);
        ctx.lineTo(s.r * 0.3, 0);
        ctx.lineTo(-s.r * 0.8, s.r * 0.5);
        ctx.stroke();
        ctx.restore();
        break;
      default:
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, TAU);
        ctx.fill();
        break;
    }
  };
})();
