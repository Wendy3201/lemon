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

  /* ----------------------------------------------------- more weapons */

  function whipAttack(cfg, aim, empowered, mult) {
    var p = B.run.p;
    var area = B.area();
    var dmg = B.dmg() * cfg.dmg * mult;
    var reach = cfg.reach * area;
    var opts = { knock: 240, color: cfg.color };
    var dirs = [];
    var i;
    if (empowered) {
      B.blast(p.x, p.y, reach * 0.85, dmg * 1.2, { knock: 300, color: cfg.color, swat: true });
      dirs.push(aim);
    } else {
      for (i = 0; i <= B.count(); i++) {
        dirs.push(aim + SIDES[i % 4]);
        B.sweep(aim + SIDES[i % 4], 0.38, reach, dmg, opts);
      }
    }
    if (p.fx.q) {
      // the lash snaps back
      B.later(0.18, function () {
        for (var k = 0; k < dirs.length; k++) B.sweep(dirs[k] + 0.2, 0.45, reach, dmg * 0.6, opts);
      });
    }
  }

  function drawWhip(ctx, k, rope, tip) {
    ctx.strokeStyle = WOOD_DARK;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(6, 5);
    ctx.lineTo(13, 5);
    ctx.stroke();
    ctx.strokeStyle = rope;
    ctx.lineWidth = 2.2;
    var flick = k * 14;
    ctx.beginPath();
    ctx.moveTo(13, 5);
    ctx.quadraticCurveTo(24, -10 - flick * 0.4, 36 + flick, 2 - flick * 0.3);
    ctx.stroke();
    ctx.fillStyle = tip;
    ctx.beginPath();
    ctx.arc(36 + flick, 2 - flick * 0.3, 2.6, 0, TAU);
    ctx.fill();
  }

  W.whip = {
    cd: 0.7,
    reach: function () { return 165 * B.area(); },
    countName: "Extra lash", countText: "Lash in one more direction",
    attack: function (aim, target, empowered, mult) {
      whipAttack({ dmg: 1.7, reach: 160, color: "#B9D694" }, aim, empowered, mult);
    },
    held: function (ctx, k) { drawWhip(ctx, k, "#8FAE65", GOLD); }
  };

  W.thornlash = {
    cd: 0.62,
    reach: function () { return 185 * B.area(); },
    countName: "Extra lash", countText: "Lash in one more direction",
    attack: function (aim, target, empowered, mult) {
      whipAttack({ dmg: 1.9, reach: 180, color: "#C9BEFF" }, aim, empowered, mult);
    },
    held: function (ctx, k) { drawWhip(ctx, k, VOID, "#C9BEFF"); }
  };

  W.cannon = {
    cd: 0.85, range: 250, pierces: true,
    countName: "Extra pellets", countText: "+2 pellets with every shot",
    attack: function (aim, target, empowered, mult) {
      var p = B.run.p;
      var area = B.area();
      var dmg = B.dmg() * 0.65 * mult;
      var n = 5 + 2 * B.count();
      var burst = p.fx.q ? function (shot, e) {
        B.blast(e.x, e.y, 26 * area, shot.dmg * 0.6, { color: "#FFB84A", quiet: true });
      } : null;
      var i;
      for (i = 0; i < n; i++) {
        B.shoot({
          angle: aim + (i - (n - 1) / 2) * 0.13 + PS.rand(-0.04, 0.04), speed: 470, range: 230, r: 4.2 * Math.sqrt(area),
          dmg: dmg, pierce: B.pierce(), sprite: "pip", color: "#FFB84A", bounce: 0, onHit: burst
        });
      }
      if (empowered) {
        for (i = 0; i < 12; i++) {
          B.shoot({ angle: aim + (i / 12) * TAU, speed: 440, range: 210, r: 4, dmg: dmg, pierce: B.pierce(), sprite: "pip", color: "#FFD166", bounce: 0 });
        }
      }
    },
    held: function (ctx, k) {
      ctx.fillStyle = "#5C6B8A";
      ctx.fillRect(6 - k * 3, 0, 20, 8);
      ctx.fillStyle = "#39445C";
      ctx.fillRect(22 - k * 3, -2, 8, 12);
      ctx.fillStyle = WOOD_DARK;
      ctx.beginPath();
      ctx.arc(9 - k * 3, 10, 3.4, 0, TAU);
      ctx.fill();
    }
  };

  W.mace = {
    cd: 0.62,
    reach: function () { return 92 * B.area(); },
    countName: "Double spin", countText: "Every spin hits one more time",
    attack: function (aim, target, empowered, mult) {
      var p = B.run.p;
      var r = 80 * B.area() * (empowered ? 1.25 : 1);
      var dmg = B.dmg() * 1.35 * mult * (empowered ? 1.6 : 1);
      var opts = { knock: empowered ? 620 : 320, color: P.pale, swat: true };
      B.blast(p.x, p.y, r, dmg, opts);
      var again = function () { B.blast(p.x, p.y, r, dmg * 0.7, { knock: 220, color: P.pale, swat: true }); };
      for (var i = 1; i <= B.count(); i++) B.later(0.14 * i, again);
      if (p.fx.q && !(p.timers.maceZone > 0)) {
        p.timers.maceZone = 1.4;
        for (var k = 0; k < 6; k++) {
          var a = (k / 6) * TAU;
          B.addZone({ type: "fire", x: p.x + Math.cos(a) * r * 0.7, y: p.y + Math.sin(a) * r * 0.7, r: 20, life: 2.2, dps: B.dmg() * 0.5 });
        }
      }
    },
    tick: function (dt) {
      var t = B.run.p.timers;
      if (t.maceZone > 0) t.maceZone -= dt;
    },
    held: function (ctx, k) {
      ctx.rotate(-0.8 + (1 - k) * 0.8);
      ctx.strokeStyle = WOOD;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(8, 5);
      ctx.lineTo(24, 5);
      ctx.stroke();
      ctx.fillStyle = STEEL_DARK;
      ctx.beginPath();
      ctx.arc(28, 5, 7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = STEEL;
      ctx.beginPath();
      ctx.arc(26.5, 3.5, 3, 0, TAU);
      ctx.fill();
    }
  };

  /* a thrown thing's arc, then what it does where it lands */
  function lobTo(x, y, color, land) {
    var R = B.run;
    var p = R.p;
    R.fx.push({ type: "lob", x0: p.x, y0: p.y, x1: x, y1: y, color: color, size: 6, t: 0, dur: 0.5 });
    B.later(0.5, land);
  }

  W.flask = {
    cd: 1.0, range: 380,
    countName: "Extra flask", countText: "+1 flask with every throw",
    attack: function (aim, target, empowered, mult) {
      var p = B.run.p;
      var area = B.area();
      var q = p.fx.q;
      var n = 1 + B.count() + (empowered ? 2 : 0);
      var used = [];
      for (var i = 0; i < n; i++) {
        var spot = B.cluster(380, 80, used) || target;
        used.push(spot);
        (function (x, y) {
          lobTo(x, y, "#6FBF5A", function () {
            B.blast(x, y, 42 * area, B.dmg() * 1.0 * mult, { color: "#9BE08A", quiet: true });
            B.addZone({
              type: "fire", x: x, y: y, r: 46 * area, life: q ? 5.2 : 2.6, dps: B.dmg() * (q ? 1.0 : 0.7) * mult,
              color: "#6FBF5A", core: "#C8F2B0"
            });
          });
        })(spot.x, spot.y);
      }
    },
    held: function (ctx, k) {
      ctx.fillStyle = "rgba(221,244,255,0.9)";
      ctx.fillRect(10 + k * 6, 0, 9, 11);
      ctx.fillStyle = "#6FBF5A";
      ctx.fillRect(10 + k * 6, 5, 9, 6);
      ctx.fillStyle = WOOD;
      ctx.fillRect(12 + k * 6, -3, 5, 3);
    }
  };

  W.comet = {
    cd: 1.1, range: 420,
    countName: "Extra comet", countText: "+1 comet with every cast",
    attack: function (aim, target, empowered, mult) {
      var R = B.run;
      var p = R.p;
      var area = B.area();
      var n = 1 + B.count() + (empowered ? 2 : 0);
      var used = [];
      for (var i = 0; i < n; i++) {
        var spot = B.cluster(420, 90, used) || target;
        used.push(spot);
        (function (x, y) {
          var r = 56 * area;
          R.fx.push({ type: "ring", x: x, y: y, r0: r * 1.5, r1: r * 0.3, color: "#FFB84A", width: 3, t: 0, dur: 0.45 });
          B.later(0.45, function () {
            B.blast(x, y, r, B.dmg() * 2.2 * mult, { color: "#FFB84A", knock: 140 });
            R.shake = Math.max(R.shake, 3);
            if (p.fx.q) B.addZone({ type: "fire", x: x, y: y, r: r * 0.7, life: 3, dps: B.dmg() * 0.7 });
          });
        })(spot.x, spot.y);
      }
    },
    held: function (ctx, k) { drawStaff(ctx, k, "#5C4A3A", "#FFD166", "#FFB84A"); }
  };

  function splitPip(shot, e) {
    if (shot.split) return;
    shot.split = true;
    for (var i = 0; i < 2; i++) {
      B.shoot({
        x: shot.x, y: shot.y, angle: Math.random() * TAU, speed: 300, range: 300, r: 3.5, dmg: shot.dmg * 0.5,
        homing: 5, sprite: "pip", color: "#FFD166", bounce: 0
      }).seen.push(e);
    }
  }

  W.hive = {
    cd: 0.9, range: 380,
    countName: "Bigger swarm", countText: "+2 pips with every blast",
    attack: function (aim, target, empowered, mult) {
      var p = B.run.p;
      var n = 3 + 2 * B.count() + (empowered ? 7 : 0);
      for (var i = 0; i < n; i++) {
        B.shoot({
          angle: aim + PS.rand(-0.9, 0.9), speed: 300, range: 520, r: 4, dmg: B.dmg() * 0.55 * mult,
          homing: 6, pierce: B.pierce(), sprite: "pip", color: "#FFD166", bounce: 0, onHit: p.fx.q ? splitPip : null
        });
      }
    },
    held: function (ctx, k) {
      ctx.fillStyle = "#E0A93B";
      ctx.beginPath();
      ctx.moveTo(6, 4);
      ctx.lineTo(24 + k * 3, -3);
      ctx.lineTo(24 + k * 3, 13);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#3A2A10";
      ctx.fillRect(22 + k * 3, -4, 4, 18);
    }
  };

  W.nova = {
    cd: 1.3, reach: function () { return 150 * B.area(); },
    countName: "Echo burst", countText: "Every burst repeats once more",
    attack: function (aim, target, empowered, mult) {
      var R = B.run;
      var p = R.p;
      var area = B.area();
      var r = 110 * area * (empowered ? 1.7 : 1);
      var dmg = B.dmg() * 2.4 * mult;
      var burst = function (scale) {
        B.blast(p.x, p.y, r * scale, dmg * scale, { knock: 380, color: "#FFF4B8", swat: true });
        R.fx.push({ type: "ring", x: p.x, y: p.y, r0: 20, r1: r * scale, color: "#FFD166", width: 8, t: 0, dur: 0.45 });
      };
      burst(1);
      for (var i = 1; i <= B.count(); i++) B.later(0.22 * i, function () { burst(0.8); });
      if (p.fx.shards) {
        for (var k = 0; k < 8; k++) {
          B.shoot({ x: p.x, y: p.y, angle: (k / 8) * TAU, speed: 420, range: 280, r: 4.5, dmg: B.dmg() * 0.7 * mult, pierce: 2, sprite: "shard", bounce: 0 });
        }
      }
      if (p.fx.q) {
        for (var j = 0; j < 8; j++) {
          var a = (j / 8) * TAU;
          B.addZone({ type: "fire", x: p.x + Math.cos(a) * r * 0.75, y: p.y + Math.sin(a) * r * 0.75, r: 24, life: 3, dps: B.dmg() * 0.8 });
        }
      }
    },
    held: function (ctx, k) {
      ctx.fillStyle = "#FFD166";
      ctx.globalAlpha = 0.4 + k * 0.5;
      ctx.beginPath();
      ctx.arc(18, 4, 10 + k * 5, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#FFF9E6";
      ctx.beginPath();
      ctx.arc(18, 4, 5, 0, TAU);
      ctx.fill();
    }
  };

  W.geyser = {
    cd: 1.0, range: 340,
    countName: "More geysers", countText: "+2 geysers with every cast",
    attack: function (aim, target, empowered, mult) {
      var R = B.run;
      var p = R.p;
      var area = B.area();
      var n = 3 + 2 * B.count() + (empowered ? 3 : 0);
      var used = [];
      for (var i = 0; i < n; i++) {
        var e = B.nearest(p.x, p.y, 340, used);
        if (!e) break;
        used.push(e);
        (function (x, y) {
          R.fx.push({ type: "ring", x: x, y: y, r0: 40 * area, r1: 10, color: "#7FD4F5", width: 3, t: 0, dur: 0.35 });
          B.later(0.35, function () {
            B.blast(x, y, 44 * area, B.dmg() * 1.6 * mult, { knock: 260, color: "#DDF4FF" });
            if (p.fx.q) {
              B.later(0.3, function () { B.blast(x, y, 62 * area, B.dmg() * 2 * mult, { knock: 300, color: "#7FD4F5" }); });
            }
          });
        })(e.x, e.y);
      }
    },
    held: function (ctx, k) { drawStaff(ctx, k, "#3A5C7A", "#DDF4FF", "#7FD4F5"); }
  };

  /* ---------------------------------------------------------- the armory */
  /* The weapons made in armory.js: one attack and one held drawing per style,
     coloured by the element. The element's own effect (burning, chilling...)
     comes from the item, so every hit applies it without anything here. */

  var STYLE = {
    bolt: {
      cd: 0.5, range: 380, pierces: true,
      attack: function (c, aim, target, empowered, mult) {
        var size = Math.sqrt(B.area());
        var dmg = B.dmg() * 0.95 * mult;
        var n = 1 + B.count();
        for (var i = 0; i < n; i++) {
          B.shoot({ angle: aim + (i - (n - 1) / 2) * 0.15, speed: 460, range: 380, r: 4.5 * size, dmg: dmg, pierce: B.pierce(), sprite: "pip", color: c.main });
        }
        if (empowered) B.shoot({ angle: aim, speed: 400, range: 460, r: 11 * size, dmg: dmg * 3, pierce: 999, sprite: "pip", color: c.light, bounce: 0 });
      },
      held: function (ctx, k, c) {
        ctx.fillStyle = c.dark;
        ctx.fillRect(6 - k * 3, 2, 16, 7);
        ctx.fillRect(8 - k * 3, 8, 5, 7);
        ctx.fillStyle = c.main;
        ctx.fillRect(18 - k * 3, 3, 10, 5);
        ctx.fillStyle = c.glow;
        ctx.beginPath();
        ctx.arc(29 - k * 3, 5.5, 2.6 + k * 2, 0, TAU);
        ctx.fill();
      }
    },
    spread: {
      cd: 0.85, range: 250, pierces: true,
      attack: function (c, aim, target, empowered, mult) {
        var area = B.area();
        var dmg = B.dmg() * 0.62 * mult;
        var n = 5 + 2 * B.count();
        var i;
        for (i = 0; i < n; i++) {
          B.shoot({
            angle: aim + (i - (n - 1) / 2) * 0.13 + PS.rand(-0.04, 0.04), speed: 470, range: 230, r: 4.2 * Math.sqrt(area),
            dmg: dmg, pierce: B.pierce(), sprite: "pip", color: c.main, bounce: 0
          });
        }
        if (empowered) {
          for (i = 0; i < 12; i++) B.shoot({ angle: aim + (i / 12) * TAU, speed: 440, range: 210, r: 4, dmg: dmg, pierce: B.pierce(), sprite: "pip", color: c.light, bounce: 0 });
        }
      },
      held: function (ctx, k, c) {
        ctx.fillStyle = c.dark;
        ctx.fillRect(4 - k * 3, 2, 10, 8);
        ctx.fillStyle = c.main;
        ctx.beginPath();
        ctx.moveTo(12 - k * 3, 2);
        ctx.lineTo(30 - k * 3, -2);
        ctx.lineTo(30 - k * 3, 14);
        ctx.lineTo(12 - k * 3, 10);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = c.light;
        ctx.fillRect(28 - k * 3, -3, 3, 18);
      }
    },
    burst: {
      cd: 1.0, reach: function () { return 230 * B.area(); },
      attack: function (c, aim, target, empowered, mult) {
        var p = B.run.p;
        var area = Math.sqrt(B.area());
        var dmg = B.dmg() * 0.75 * mult;
        var n = 10 + 3 * B.count();
        var ringOut = function (turn) {
          for (var i = 0; i < n; i++) {
            B.shoot({ x: p.x, y: p.y, angle: aim + turn + (i / n) * TAU, speed: 380, range: 250 * area, r: 5 * area, dmg: dmg, pierce: B.pierce() + 1, sprite: "orb", color: c.main, bounce: 0 });
          }
        };
        ringOut(0);
        if (empowered) B.later(0.2, function () { ringOut(Math.PI / n); });
        B.run.fx.push({ type: "ring", x: p.x, y: p.y, r0: 10, r1: 40, color: c.glow, width: 4, t: 0, dur: 0.25 });
      },
      held: function (ctx, k, c) {
        ctx.fillStyle = c.main;
        ctx.beginPath();
        ctx.moveTo(8, 12);
        ctx.quadraticCurveTo(10, -6, 22, -2);
        ctx.quadraticCurveTo(28, 8, 26, 14);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = c.glow;
        ctx.globalAlpha = 0.3 + k * 0.6;
        ctx.beginPath();
        ctx.arc(18, 6, 12 + k * 6, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    },
    homing: {
      cd: 0.9, range: 380,
      attack: function (c, aim, target, empowered, mult) {
        var n = 3 + 2 * B.count() + (empowered ? 6 : 0);
        for (var i = 0; i < n; i++) {
          B.shoot({ angle: aim + PS.rand(-0.9, 0.9), speed: 320, range: 520, r: 4, dmg: B.dmg() * 0.58 * mult, homing: 6, pierce: B.pierce(), sprite: "pip", color: c.main, bounce: 0 });
        }
      },
      held: function (ctx, k, c) {
        ctx.fillStyle = c.main;
        ctx.beginPath();
        ctx.moveTo(6, 4);
        ctx.lineTo(24 + k * 3, -3);
        ctx.lineTo(24 + k * 3, 13);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = c.dark;
        ctx.fillRect(22 + k * 3, -4, 4, 18);
      }
    },
    slash: {
      cd: 0.62, reach: function () { return 105 * B.area(); },
      attack: function (c, aim, target, empowered, mult) {
        var area = B.area();
        var dmg = B.dmg() * 1.55 * mult;
        var opts = { knock: 260, color: c.light };
        if (empowered) {
          B.sweep(aim, Math.PI, 112 * area, dmg * 1.2, opts);
          return;
        }
        for (var i = 0; i <= B.count(); i++) B.sweep(aim + SIDES[i % 4], 1.15, 105 * area, dmg, opts);
      },
      held: function (ctx, k, c) { drawBlade(ctx, k, 26, 7, c.light, c.main); }
    },
    thrust: {
      cd: 0.7, reach: function () { return 180 * B.area(); },
      attack: function (c, aim, target, empowered, mult) {
        var area = B.area();
        var dmg = B.dmg() * 1.9 * mult;
        var dirs = [];
        for (var i = 0; i <= B.count(); i++) dirs.push(aim + SIDES[i % 4]);
        if (empowered) dirs.push(aim - 0.45, aim + 0.45);
        dirs.forEach(function (d) { B.thrust(d, 185 * area, 40, dmg, { color: c.light, knock: 200 }); });
      },
      held: function (ctx, k, c) { drawSpear(ctx, k, c.dark, c.main); }
    },
    slam: {
      cd: 1.15, reach: function () { return 84 * B.area(); },
      attack: function (c, aim, target, empowered, mult) {
        var p = B.run.p;
        var r = 92 * B.area();
        var dmg = B.dmg() * 1.85 * mult * (empowered ? 1.5 : 1);
        B.blast(p.x, p.y, r, dmg, { knock: 420, stun: empowered ? 1.2 : 0, color: c.light, swat: true });
        var again = function () { B.blast(p.x, p.y, r, dmg * 0.7, { knock: 300, color: c.main, swat: true }); };
        for (var i = 1; i <= B.count(); i++) B.later(0.18 * i, again);
      },
      held: function (ctx, k, c) {
        ctx.rotate(-0.9 + (1 - k) * 0.9);
        ctx.strokeStyle = WOOD;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(8, 5);
        ctx.lineTo(26, 5);
        ctx.stroke();
        ctx.fillStyle = c.dark;
        ctx.fillRect(21, -4, 12, 18);
        ctx.fillStyle = c.main;
        ctx.fillRect(21, -4, 12, 6);
      }
    },
    lob: {
      cd: 1.05, range: 400,
      attack: function (c, aim, target, empowered, mult) {
        var R = B.run;
        var area = B.area();
        var n = 1 + B.count() + (empowered ? 2 : 0);
        var used = [];
        for (var i = 0; i < n; i++) {
          var spot = B.cluster(400, 90, used) || target;
          used.push(spot);
          (function (x, y) {
            var r = 54 * area;
            R.fx.push({ type: "lob", x0: R.p.x, y0: R.p.y, x1: x, y1: y, color: c.dark, size: 7, t: 0, dur: 0.45 });
            R.fx.push({ type: "ring", x: x, y: y, r0: r * 1.4, r1: r * 0.3, color: c.main, width: 3, t: 0, dur: 0.45 });
            B.later(0.45, function () {
              B.blast(x, y, r, B.dmg() * 1.8 * mult, { color: c.main, knock: 160 });
              R.shake = Math.max(R.shake, 3);
            });
          })(spot.x, spot.y);
        }
      },
      held: function (ctx, k, c) {
        ctx.fillStyle = c.dark;
        ctx.beginPath();
        ctx.arc(16 + k * 4, 5, 7, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = WOOD;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(20 + k * 4, 0);
        ctx.quadraticCurveTo(24 + k * 4, -6, 27 + k * 4, -5);
        ctx.stroke();
        ctx.fillStyle = c.glow;
        ctx.beginPath();
        ctx.arc(27 + k * 4, -5, 2.2, 0, TAU);
        ctx.fill();
      }
    },
    chain: {
      cd: 0.85, range: 340,
      attack: function (c, aim, target, empowered, mult) {
        var p = B.run.p;
        var area = B.area();
        var chains = empowered ? 3 : 1;
        var used = [];
        for (var i = 0; i < chains; i++) {
          var first = i === 0 ? target : B.randomNear(340);
          if (!first) break;
          used = B.chain(p.x, p.y, first, B.dmg() * 1.25 * mult, 4 + 2 * B.count(), 150 * area, used);
        }
      },
      held: function (ctx, k, c) { drawStaff(ctx, k, c.dark, c.light, c.main); }
    },
    boomerang: {
      cd: 0.95, range: 300,
      attack: function (c, aim, target, empowered, mult) {
        var area = B.area();
        var n = 1 + B.count() + (empowered ? 2 : 0);
        for (var i = 0; i < n; i++) {
          B.shoot({
            angle: aim + (i - (n - 1) / 2) * 0.32, speed: 430, range: 99999, r: 12 * Math.sqrt(area),
            dmg: B.dmg() * mult, pierce: 99999, sprite: "chakram", color: c.main, spin: 18, bounce: 0,
            rang: { out: true, gone: 0, dist: 250 * area, trips: 1 }
          });
        }
      },
      held: function (ctx, k, c) {
        if (k > 0.2) return;
        ctx.strokeStyle = c.main;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(18, 5, 7, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = c.light;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    },
    zone: {
      cd: 1.0, range: 380,
      attack: function (c, aim, target, empowered, mult) {
        var area = B.area();
        var n = 1 + B.count() + (empowered ? 2 : 0);
        var used = [];
        for (var i = 0; i < n; i++) {
          var spot = B.cluster(380, 80, used) || target;
          used.push(spot);
          (function (x, y) {
            lobTo(x, y, c.main, function () {
              B.blast(x, y, 40 * area, B.dmg() * 0.9 * mult, { color: c.light, quiet: true });
              B.addZone({ type: "fire", x: x, y: y, r: 46 * area, life: 2.6, dps: B.dmg() * 0.75 * mult, color: c.main, core: c.light });
            });
          })(spot.x, spot.y);
        }
      },
      held: function (ctx, k, c) {
        ctx.fillStyle = c.dark;
        ctx.beginPath();
        ctx.moveTo(8 + k * 4, 2);
        ctx.lineTo(24 + k * 4, 2);
        ctx.lineTo(21 + k * 4, 13);
        ctx.lineTo(11 + k * 4, 13);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = c.main;
        ctx.fillRect(8 + k * 4, 0, 16, 4);
      }
    },
    beam: {
      cd: 0.75, reach: function () { return 300 * B.area(); },
      attack: function (c, aim, target, empowered, mult) {
        var R = B.run;
        var p = R.p;
        var len = 300 * B.area();
        var n = 1 + B.count();
        var dirs = [];
        var i;
        for (i = 0; i < n; i++) dirs.push(aim + (i - (n - 1) / 2) * 0.22);
        if (empowered) for (i = -2; i <= 2; i++) if (i) dirs.push(aim + i * 0.3);
        dirs.forEach(function (d) {
          B.thrust(d, len, 18, B.dmg() * 1.45 * mult, { color: c.light });
          R.fx.push({ type: "beam", x0: p.x, y0: p.y, x1: p.x + Math.cos(d) * len, y1: p.y + Math.sin(d) * len, width: 10, color: c.main, t: 0, dur: 0.22 });
        });
      },
      held: function (ctx, k, c) {
        ctx.strokeStyle = c.dark;
        ctx.lineWidth = 2.6;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(6, 7);
        ctx.lineTo(24, 2);
        ctx.stroke();
        ctx.fillStyle = c.glow;
        ctx.globalAlpha = 0.35 + k * 0.5;
        ctx.beginPath();
        ctx.arc(26, 1.5, 6 + k * 4, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = c.light;
        ctx.beginPath();
        ctx.arc(26, 1.5, 3, 0, TAU);
        ctx.fill();
      }
    }
  };

  (PS.ARMORY || []).forEach(function (w) {
    var style = STYLE[w.arch];
    var arch = PS.ARCH[w.arch];
    var c = w.colors;
    W[w.id] = {
      cd: style.cd, range: style.range, reach: style.reach, pierces: style.pierces,
      countName: arch.countName, countText: arch.countText,
      attack: function (aim, target, empowered, mult) { style.attack(c, aim, target, empowered, mult); },
      held: function (ctx, k) { style.held(ctx, k, c); }
    };
  });

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

  /* Behind each shot: a fading streak the way it came and, on high quality, a
     soft glow, both added as light so they brighten the dark floor. */
  function shotTrail(ctx, s) {
    var v = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    if (v < 80 || s.age < 0.02) return;
    var nx = s.vx / v;
    var ny = s.vy / v;
    var len = Math.min(52, v * 0.075, s.age * v) * (s.sprite === "rang" || s.sprite === "chakram" ? 0.6 : 1);
    var color = s.sprite === "shard" ? VOID : s.color;
    var tx = s.x - nx * len;
    var ty = s.y - ny * len;
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    if (B.quality >= 2) {
      var g = ctx.createLinearGradient(tx, ty, s.x, s.y);
      g.addColorStop(0, B.rgba(color, 0));
      g.addColorStop(1, B.rgba(color, 0.7));
      ctx.strokeStyle = g;
      ctx.globalAlpha = 1;
    } else {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.35;
    }
    ctx.lineWidth = Math.max(2, Math.min(9, s.r * 1.2));
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
    if (B.quality >= 2 && s.r < 30) {
      ctx.globalAlpha = 0.13;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.min(s.r * 1.7 + 3, 16), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  B.drawShot = function (ctx, s) {
    var angle;
    if (B.quality >= 1 && s.sprite !== "void" && s.sprite !== "wave") shotTrail(ctx, s);
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
      case "chakram":
        // a spinning ring with teeth
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = Math.max(2.5, s.r * 0.35);
        ctx.beginPath();
        ctx.arc(0, 0, s.r * 0.7, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = s.color;
        for (var tooth = 0; tooth < 6; tooth++) {
          var ta = (tooth / 6) * TAU;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ta) * s.r * 0.55, Math.sin(ta) * s.r * 0.55);
          ctx.lineTo(Math.cos(ta + 0.35) * s.r * 1.2, Math.sin(ta + 0.35) * s.r * 1.2);
          ctx.lineTo(Math.cos(ta + 0.75) * s.r * 0.6, Math.sin(ta + 0.75) * s.r * 0.6);
          ctx.closePath();
          ctx.fill();
        }
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
