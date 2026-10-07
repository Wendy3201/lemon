/*!
 * Pip Survivors — upgrades picked during a battle
 * The cards offered on every level-up, and the extra abilities some of them
 * switch on (orbiting peels, lightning, bombs, mist, fire trail, homing pips).
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function () {
  "use strict";

  var PS = window.PS;
  var B = PS.B;
  var P = PS.palette;
  var TAU = Math.PI * 2;
  var DOT = { dot: true };

  /* how often each kind of card turns up, and its colour */
  B.UP_TIERS = [
    { name: "Common", color: "#9AA1A9", weight: 100 },
    { name: "Rare", color: "#3F8FE4", weight: 50 },
    { name: "Epic", color: "#A45DE6", weight: 16 },
    { name: "Legendary", color: "#F2A31B", weight: 5 }
  ];

  function first(intro, later) {
    return function (level) { return level === 1 ? intro : later; };
  }
  function addFx(key, amount) {
    return function (p) { p.fx[key] = (p.fx[key] || 0) + amount; };
  }

  /* text and name may be functions of (level about to be taken, run) */
  var UPGRADES = (B.UPGRADES = [
    { id: "dmg", name: "Sharpen", tier: 0, max: 8, icon: "atk", text: "+20% damage",
      take: function (p) { p.mods.dmg += 0.2; } },
    { id: "haste", name: "Rapid Fire", tier: 0, max: 8, icon: "haste", text: "+14% attack speed",
      take: function (p) { p.mods.haste += 0.14; } },
    { id: "count", tier: 1, max: 3, icon: "count",
      name: function (level, R) { return R.weapon.countName; },
      text: function (level, R) { return R.weapon.countText; },
      take: function (p) { p.mods.count += 1; } },
    { id: "pierce", name: "Piercing", tier: 0, max: 3, icon: "pierce", text: "Shots pass through 1 more pest",
      needs: function (R) { return Boolean(R.weapon.pierces); },
      take: function (p) { p.mods.pierce += 1; } },
    { id: "area", name: "Big Squeeze", tier: 0, max: 5, icon: "area", text: "+18% attack size",
      take: function (p) { p.mods.area += 0.18; } },
    { id: "crit", name: "Keen Eye", tier: 0, max: 5, icon: "crit", text: "+8% crit chance",
      take: function (p) { p.mods.crit += 0.08; } },
    { id: "critDmg", name: "Sour Punch", tier: 0, max: 5, icon: "critDmg", text: "+35% crit damage",
      take: function (p) { p.mods.critDmg += 0.35; } },
    { id: "speed", name: "Sneakers", tier: 0, max: 5, icon: "speed", text: "+10% move speed",
      take: function (p) { p.mods.speed += 0.1; } },
    { id: "magnet", name: "Magnet", tier: 0, max: 4, icon: "magnet", text: "Pull in gems from 45% further away",
      take: function (p) { p.reach *= 1.45; } },
    { id: "hp", name: "Thick Rind", tier: 0, max: 6, icon: "hp", text: "+20% max health and a big heal",
      take: function (p) {
        p.maxHp += p.baseHp * 0.2;
        p.barrierMax = p.maxHp * (p.fx.barrier || 0);
        B.heal(p.maxHp * 0.3 + p.baseHp * 0.2);
      } },
    { id: "regen", name: "Regrowth", tier: 0, max: 4, icon: "regen", text: "Regenerate 0.5% of your health every second",
      take: function (p) { p.mods.regen += 0.005; } },
    { id: "armor", name: "Hard Shell", tier: 0, max: 5, icon: "armor", text: "Take 8% less damage",
      take: function (p) { p.mods.armor *= 0.92; } },

    { id: "orbit", name: "Orbit Peel", tier: 1, max: 5, icon: "orbit",
      text: first("A peel circles you and slices whatever it touches", "+1 peel circling you") },
    { id: "bolt", name: "Lightning Seed", tier: 1, max: 5, icon: "bolt",
      text: first("Lightning strikes a nearby pest every few seconds", "Lightning strikes harder and more often") },
    { id: "bomb", name: "Juice Bomb", tier: 1, max: 5, icon: "bomb",
      text: first("Lob a bomb into the thick of the swarm", "Bigger bombs, thrown more often") },
    { id: "mist", name: "Cold Mist", tier: 1, max: 5, icon: "mist",
      text: first("A chilly mist slows and hurts pests near you", "The mist spreads wider and bites harder") },
    { id: "trail", name: "Zest Trail", tier: 1, max: 5, icon: "trail",
      text: first("Leave burning zest behind you as you move", "The trail burns hotter") },
    { id: "burst", name: "Thorn Burst", tier: 1, max: 5, icon: "burst",
      text: first("Getting hurt blasts pests away from you", "The burst hits harder and recharges faster") },
    { id: "swarm", name: "Pip Swarm", tier: 1, max: 5, icon: "swarm",
      text: first("Homing pips chase down nearby pests", "+1 homing pip") },

    { id: "burn", name: "Burning Zest", tier: 2, max: 3, icon: "burn", text: "Your hits set pests on fire for 30% more damage per second",
      take: addFx("burn", 0.3) },
    { id: "chill", name: "Cold Press", tier: 2, max: 3, icon: "chill", text: "Your hits slow pests by 20% more",
      take: addFx("chill", 0.2) },
    { id: "shock", name: "Static Peel", tier: 2, max: 3, icon: "shock", text: "Pests you hit take 15% more damage for 3 seconds",
      take: addFx("shock", 0.15) },
    { id: "boom", name: "Pop!", tier: 2, max: 3, icon: "boom", text: "Pests explode when they die, for 40% more damage each time",
      take: addFx("boom", 0.4) },
    { id: "leech", name: "Vampire Zest", tier: 2, max: 3, icon: "leech", text: "Heal 0.3% of your health for every pest you squash",
      take: addFx("leech", 0.003) },

    { id: "revive", name: "Second Wind", tier: 3, max: 1, icon: "revive", text: "Come back to life once with half your health",
      take: function (p) { p.revives += 1; } },
    { id: "glass", name: "Glass Lemon", tier: 3, max: 1, icon: "glass", text: "+60% damage, but 25% less max health",
      take: function (p) {
        p.mods.dmg += 0.6;
        p.maxHp *= 0.75;
        p.hp = Math.min(p.hp, p.maxHp);
        p.barrierMax = p.maxHp * (p.fx.barrier || 0);
        p.barrier = Math.min(p.barrier, p.barrierMax);
      } },
    { id: "lucky", name: "Lucky Leaf", tier: 3, max: 1, icon: "luck", text: "+25% XP, better upgrade cards and 1 more reroll",
      take: function (p) {
        p.xpMul += 0.25;
        p.luck += 0.5;
        p.rerolls += 1;
      } },
    { id: "echo", name: "Echo", tier: 3, max: 1, icon: "echo", text: "Every attack repeats for 40% damage",
      take: addFx("echo", 0.4) },
    { id: "golden", name: "Golden Hour", tier: 3, max: 1, icon: "sun", text: "+25% damage, attack speed and attack size",
      take: function (p) {
        p.mods.dmg += 0.25;
        p.mods.haste += 0.25;
        p.mods.area += 0.25;
      } }
  ]);

  /* only offered once everything else is maxed out */
  var FILLERS = [
    { id: "juice", name: "Squeeze of Juice", tier: 0, max: Infinity, icon: "hp", text: "Heal 40% of your health",
      take: function (p) { B.heal(p.maxHp * 0.4); } },
    { id: "change", name: "Loose Change", tier: 0, max: Infinity, icon: "coin", text: "A handful of gold",
      take: function (p, level, R) { R.coins += R.coinValue * 12; } },
    { id: "edge", name: "Fine Edge", tier: 0, max: Infinity, icon: "atk", text: "+4% damage",
      take: function (p) { p.mods.dmg += 0.04; } }
  ];

  var BY_ID = {};
  UPGRADES.concat(FILLERS).forEach(function (up) { BY_ID[up.id] = up; });
  B.upgrade = function (id) { return BY_ID[id]; };

  function card(up, R) {
    var level = (R.p.up[up.id] || 0) + 1;
    return {
      id: up.id,
      tier: up.tier,
      icon: up.icon,
      level: level,
      max: up.max,
      name: typeof up.name === "function" ? up.name(level, R) : up.name,
      text: typeof up.text === "function" ? up.text(level, R) : up.text
    };
  }

  /** Three different cards to choose from. */
  B.rollChoices = function () {
    var R = B.run;
    var p = R.p;
    var pool = [];
    var weights = [];
    UPGRADES.forEach(function (up) {
      var have = p.up[up.id] || 0;
      if (have >= up.max || (up.needs && !up.needs(R))) return;
      var weight = B.UP_TIERS[up.tier].weight;
      if (up.tier >= 2) weight *= 1 + p.luck * 2;
      if (have && up.tier === 1) weight *= 1.6; // abilities you already have come round again
      pool.push(up);
      weights.push(weight);
    });

    var picks = [];
    while (picks.length < 3 && pool.length) {
      var chosen = PS.weighted(pool, weights);
      var index = pool.indexOf(chosen);
      pool.splice(index, 1);
      weights.splice(index, 1);
      picks.push(card(chosen, R));
    }
    for (var i = 0; picks.length < 3; i++) picks.push(card(FILLERS[i], R));
    return picks;
  };

  B.takeUpgrade = function (choice) {
    var R = B.run;
    var p = R.p;
    var up = BY_ID[choice.id];
    var level = (p.up[up.id] || 0) + 1;
    if (!p.up[up.id]) (p.order || (p.order = [])).push(up.id);
    p.up[up.id] = level;
    if (up.take) up.take(p, level, R);
    B.hud.build(R);
  };

  /* ----------------------------------------------------------- abilities */

  function chill(e, amount) {
    var slow = amount * (e.boss ? 0.5 : 1);
    e.chillAmt = e.chillT > 0 ? Math.max(e.chillAmt, slow) : slow;
    e.chillT = Math.max(e.chillT, 0.4);
  }

  B.updateAbilities = function (dt) {
    var R = B.run;
    var p = R.p;
    var up = p.up;
    var fx = p.fx;
    var T = p.timers;
    var base = B.dmg();
    var area = B.area();
    var enemies = R.enemies;
    var i;
    var e;
    var dx;
    var dy;
    var level;

    level = up.orbit || 0;
    if (level) {
      R.src = "orbit";
      for (i = 0; i < enemies.length; i++) {
        e = enemies[i];
        if (e.dead) continue;
        if (e.peelCd > 0) {
          e.peelCd -= dt;
          continue;
        }
        for (var j = 0; j < level; j++) {
          var a = p.spin + (j * TAU) / level;
          dx = p.x + Math.cos(a) * 58 - e.x;
          dy = p.y + Math.sin(a) * 58 - e.y;
          if (dx * dx + dy * dy < (e.r + 11) * (e.r + 11)) {
            B.hit(e, base * 0.55, null);
            e.peelCd = 0.3;
            break;
          }
        }
      }
    }

    // everything that works in a ring around the lemon ticks four times a second
    var mist = up.mist || 0;
    if (mist || fx.auraChill || fx.auraBurn) {
      T.aura = (T.aura || 0) - dt;
      if (T.aura <= 0) {
        T.aura = 0.25;
        var mistR = mist ? (84 + 12 * mist) * Math.sqrt(area) : 0;
        var gearR = 105;
        for (i = 0; i < enemies.length; i++) {
          e = enemies[i];
          if (e.dead) continue;
          dx = e.x - p.x;
          dy = e.y - p.y;
          var d2 = dx * dx + dy * dy;
          if (mist && d2 < (mistR + e.r) * (mistR + e.r)) {
            chill(e, 0.2 + 0.04 * mist);
            R.src = "mist";
            B.hit(e, base * (0.25 + 0.08 * mist) * 0.25, DOT);
          }
          if (d2 < (gearR + e.r) * (gearR + e.r)) {
            if (fx.auraChill) chill(e, fx.auraChill);
            R.src = "aura";
            if (fx.auraBurn) B.hit(e, base * fx.auraBurn * 0.25, DOT);
          }
        }
      }
    }

    level = up.bolt || 0;
    if (level) {
      R.src = "bolt";
      T.bolt = (T.bolt === undefined ? 1 : T.bolt) - dt;
      if (T.bolt <= 0) {
        T.bolt = Math.max(0.9, 2.6 - 0.35 * level);
        for (i = 0; i < Math.ceil(level / 2); i++) {
          e = B.randomNear(330);
          if (!e) break;
          R.fx.push({ type: "bolt", pts: [e.x + PS.rand(-30, 30), e.y - 260, e.x, e.y], t: 0, dur: 0.25, seed: Math.random() * 1000 });
          B.blast(e.x, e.y, 32 * area, base * (2 + 0.3 * level), { color: "#8EC5FF", quiet: true });
        }
      }
    }

    level = up.bomb || 0;
    if (level) {
      R.src = "bomb";
      T.bomb = (T.bomb === undefined ? 1.5 : T.bomb) - dt;
      if (T.bomb <= 0) {
        e = B.cluster(300, 80);
        if (e) {
          T.bomb = Math.max(1.4, 3.3 - 0.35 * level);
          lobBomb(e.x, e.y, (62 + 7 * level) * area, base * (2.4 + 0.4 * level));
        } else {
          T.bomb = 0.3;
        }
      }
    }

    level = (up.trail || 0) + (fx.trail ? 2 : 0);
    if (level && p.moving) {
      R.src = "trail";
      T.trail = (T.trail || 0) - dt;
      if (T.trail <= 0) {
        T.trail = 0.22;
        B.addZone({ type: "fire", x: p.x, y: p.y, r: 20, life: 2.4, dps: base * (0.45 + 0.15 * level) });
      }
    }

    level = up.swarm || 0;
    if (level) {
      R.src = "swarm";
      T.swarm = (T.swarm === undefined ? 1 : T.swarm) - dt;
      if (T.swarm <= 0) {
        T.swarm = 1.6;
        for (i = 0; i <= level; i++) {
          e = B.randomNear(300);
          if (!e) break;
          B.shoot({
            angle: Math.atan2(e.y - p.y, e.x - p.x) + PS.rand(-0.7, 0.7), speed: 300, range: 520, r: 4,
            dmg: base * 0.5, homing: 5, sprite: "pip", color: "#9BE08A", bounce: 0
          });
        }
      }
    }
  };

  function lobBomb(x, y, r, dmg) {
    var R = B.run;
    R.fx.push({ type: "lob", x0: R.p.x, y0: R.p.y, x1: x, y1: y, color: "#FFB84A", size: 6, t: 0, dur: 0.5 });
    B.later(0.5, function () { B.blast(x, y, r, dmg, { knock: 200, color: "#FFB84A" }); });
  }

  B.drawAbilities = function (ctx, R) {
    var p = R.p;
    var mist = p.up.mist || 0;
    if (mist) {
      ctx.globalAlpha = 0.1 + 0.03 * Math.sin(R.t * 3);
      ctx.fillStyle = "#9AD7FF";
      ctx.beginPath();
      ctx.arc(p.x, p.y, (84 + 12 * mist) * Math.sqrt(B.area()), 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (p.fx.auraChill || p.fx.auraBurn) {
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = p.fx.auraBurn ? "#F26B2A" : "#9AD7FF";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.lineDashOffset = -R.t * 30;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 105, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    var peels = p.up.orbit || 0;
    for (var i = 0; i < peels; i++) {
      var a = p.spin + (i * TAU) / peels;
      ctx.fillStyle = P.rind;
      ctx.beginPath();
      ctx.ellipse(p.x + Math.cos(a) * 58, p.y + Math.sin(a) * 58, 11, 6, a + Math.PI / 2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = P.bright;
      ctx.beginPath();
      ctx.ellipse(p.x + Math.cos(a) * 58, p.y + Math.sin(a) * 58, 7, 3, a + Math.PI / 2, 0, TAU);
      ctx.fill();
    }
  };
})();
