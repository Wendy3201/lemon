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
  /* cards that are not level-up cards: a shrine's blessings, and awakenings */
  B.SPECIAL_TIERS = {
    blessing: { name: "Blessing", color: "#5FD3B0" },
    awaken: { name: "Awakening", color: "#FFD54A" }
  };
  B.tierInfo = function (tier) { return B.UP_TIERS[tier] || B.SPECIAL_TIERS[tier] || B.UP_TIERS[0]; };

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
    { id: "dash", name: "Quick Feet", tier: 0, max: 3, icon: "dash", text: "Your dash comes back 25% sooner",
      take: function (p) { p.mods.dash *= 0.75; } },
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
    { id: "frostnova", name: "Frost Nova", tier: 1, max: 5, icon: "frostnova",
      text: first("Every few seconds a ring of frost bursts out, chilling and hurting pests", "The nova comes sooner, reaches further and hits harder") },
    { id: "mines", name: "Seed Mines", tier: 1, max: 5, icon: "mine",
      text: first("Drop seed mines as you go; they burst when a pest steps close", "More mines, laid faster, with bigger bursts") },
    { id: "sunbeam", name: "Sunbeam", tier: 1, max: 5, icon: "sunbeam",
      text: first("A beam of sunlight turns round you, burning what it sweeps", "The beam grows longer and hotter (two beams from level 3)") },
    { id: "rain", name: "Lemon Rain", tier: 1, max: 5, icon: "rain",
      text: first("Lemons drop from the sky onto pests near you", "More lemons, more often, landing harder") },
    { id: "bees", name: "Bee Buddies", tier: 1, max: 5, icon: "bee",
      text: first("A bee circles you and stings nearby pests", "+1 bee") },
    { id: "lash", name: "Vine Lash", tier: 1, max: 5, icon: "vine",
      text: first("A vine whips the nearest pests every couple of seconds", "The vine lashes one more pest, harder and more often") },
    { id: "bubble", name: "Bubble Shield", tier: 1, max: 4, icon: "bubble",
      text: first("A bubble forms that blocks one hit, then bursts and pushes pests away", "The bubble comes back sooner and bursts harder") },
    { id: "field", name: "Static Field", tier: 1, max: 5, icon: "field",
      text: first("Pests that come close get zapped and take more damage for a while", "The field grows and zaps more pests at once") },

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

  /* A shrine's gifts (events.js): three of these to choose from, each for the
     rest of the battle. Taking the same one again stacks. */
  var BLESSINGS = (B.BLESSINGS = [
    { id: "bFury", name: "Blessing of Fury", tier: "blessing", max: 3, icon: "atk", text: "+30% damage",
      take: function (p) { p.mods.dmg += 0.3; } },
    { id: "bHaste", name: "Blessing of Haste", tier: "blessing", max: 3, icon: "haste", text: "+25% attack speed",
      take: function (p) { p.mods.haste += 0.25; } },
    { id: "bGrove", name: "Blessing of the Grove", tier: "blessing", max: 3, icon: "hp", text: "+25% max health, and heal to full",
      take: function (p) {
        p.maxHp += p.baseHp * 0.25;
        p.barrierMax = p.maxHp * (p.fx.barrier || 0);
        p.hp = p.maxHp;
      } },
    { id: "bStone", name: "Blessing of Stone", tier: "blessing", max: 3, icon: "armor", text: "Take 15% less damage",
      take: function (p) { p.mods.armor *= 0.85; } },
    { id: "bWings", name: "Blessing of Wings", tier: "blessing", max: 3, icon: "dash", text: "+15% move speed, and your dash comes back twice as fast",
      take: function (p) {
        p.mods.speed += 0.15;
        p.mods.dash *= 0.5;
      } },
    { id: "bStars", name: "Blessing of Stars", tier: "blessing", max: 3, icon: "crit", text: "+12% crit chance and +40% crit damage",
      take: function (p) {
        p.mods.crit += 0.12;
        p.mods.critDmg += 0.4;
      } },
    { id: "bPlenty", name: "Blessing of Plenty", tier: "blessing", max: 3, icon: "coin", text: "+40% XP and +40% coins",
      take: function (p, level, R) {
        p.xpMul += 0.4;
        R.coinValue = Math.max(R.coinValue + 1, Math.round(R.coinValue * 1.4));
      } }
  ]);

  /* Max out an ability and its awakening can turn up: one card that makes it
     work as if it were AWAKEN_LEVELS past its max. */
  var AWAKEN_LEVELS = 3;
  var AWAKENED = {
    orbit: "Peel Tempest", bolt: "Thunderseed", bomb: "Juice Storm", mist: "Blizzard", trail: "Wildfire Trail",
    burst: "Bramble Burst", swarm: "Pip Legion", frostnova: "Deep Freeze", mines: "Minefield", sunbeam: "Solar Flare",
    rain: "Lemon Downpour", bees: "The Whole Hive", lash: "Thorn Whip", bubble: "Bubble Fortress", field: "Storm Field"
  };
  B.awakenedName = function (id) { return AWAKENED[id]; };
  var AWAKENINGS = UPGRADES.filter(function (up) { return AWAKENED[up.id]; }).map(function (up) {
    return {
      id: "awake_" + up.id, of: up.id, awaken: true, name: AWAKENED[up.id], tier: "awaken", max: 1, icon: up.icon,
      text: "Awakens " + up.name + ": it works as if it were " + AWAKEN_LEVELS + " levels past its max",
      take: function (p) {
        p.awake[up.id] = true;
        p.up[up.id] = up.max + AWAKEN_LEVELS;
      }
    };
  });

  var BY_ID = {};
  UPGRADES.concat(FILLERS, BLESSINGS, AWAKENINGS).forEach(function (up) { BY_ID[up.id] = up; });
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
    // a maxed ability always has its awakening on offer, first, until it is taken
    var ready = AWAKENINGS.filter(function (a) { return p.up[a.of] >= BY_ID[a.of].max && !p.awake[a.of]; });
    if (ready.length) picks[0] = card(ready[Math.floor(Math.random() * ready.length)], R);
    return picks;
  };

  /** Three different blessings for a shrine. */
  B.rollBlessings = function () {
    var R = B.run;
    var pool = BLESSINGS.filter(function (b) { return (R.p.up[b.id] || 0) < b.max; });
    var picks = [];
    while (picks.length < 3 && pool.length) picks.push(card(pool.splice(Math.floor(Math.random() * pool.length), 1)[0], R));
    for (var i = 0; picks.length < 3; i++) picks.push(card(FILLERS[i], R));
    return picks;
  };

  B.takeUpgrade = function (choice) {
    var R = B.run;
    var p = R.p;
    var up = BY_ID[choice.id];
    if (up.awaken) {
      // shown on the ability's own chip, not as a chip of its own
      p.up[up.id] = 1;
      up.take(p, 1, R);
      B.hud.build(R);
      R.fx.push({ type: "ring", x: p.x, y: p.y, r0: 20, r1: 190, color: "#FFD54A", width: 10, t: 0, dur: 0.6 });
      R.fx.push({ type: "blast", x: p.x, y: p.y, r: 80, color: "#FFF4B8", t: 0, dur: 0.4 });
      PS.sfx.play("awaken");
      B.toast(BY_ID[up.of].name + " awakens: " + up.name + "!", 2.5);
      return;
    }
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
            if (fx.auraChill) chill(e, Math.min(0.7, fx.auraChill)); // stacked gear never stops pests dead
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

    /* ----- the newer abilities ----- */

    level = up.frostnova || 0;
    if (level) {
      T.nova = (T.nova === undefined ? 1.5 : T.nova) - dt;
      if (T.nova <= 0) {
        T.nova = Math.max(2.2, 5 - 0.5 * level);
        var novaR = (95 + 12 * level) * area;
        R.src = "frostnova";
        for (i = 0; i < enemies.length; i++) {
          e = enemies[i];
          if (e.dead || e.prop) continue;
          dx = e.x - p.x;
          dy = e.y - p.y;
          if (dx * dx + dy * dy < (novaR + e.r) * (novaR + e.r)) {
            chill(e, 0.5);
            e.chillT = Math.max(e.chillT, 2.5);
            B.hit(e, base * (1.2 + 0.3 * level), null);
          }
        }
        R.fx.push({ type: "ring", x: p.x, y: p.y, r0: 16, r1: novaR, color: "#9BDCFF", width: 9, t: 0, dur: 0.45 });
        R.fx.push({ type: "blast", x: p.x, y: p.y, r: novaR * 0.5, color: "#DDF4FF", t: 0, dur: 0.3 });
      }
    }

    level = up.mines || 0;
    if (level) {
      var mines = p.mines || (p.mines = []); // each lemon its own
      T.mine = (T.mine === undefined ? 0.8 : T.mine) - dt;
      if (T.mine <= 0 && mines.length < 4 + level) {
        T.mine = Math.max(1, 2.4 - 0.25 * level);
        mines.push({ x: p.x, y: p.y, t: 0 });
      }
      R.src = "mines";
      for (var mi = mines.length - 1; mi >= 0; mi--) {
        var mine = mines[mi];
        mine.t += dt;
        if (mine.t < 0.6) continue; // arming
        var trip = B.nearest(mine.x, mine.y, 26);
        if (trip || mine.t > 20) {
          mines.splice(mi, 1);
          if (trip) B.blast(mine.x, mine.y, (55 + 6 * level) * area, base * (2 + 0.35 * level), { color: "#C79A5B", knock: 200 });
        }
      }
    }

    level = up.sunbeam || 0;
    if (level) {
      // turns round the lemon like a lighthouse; from level 3 there are two
      p.beamAngle = (p.beamAngle || 0) + dt * 1.6;
      T.beam = (T.beam || 0) - dt;
      if (T.beam <= 0) {
        T.beam = 0.15;
        var beamLen = (150 + 20 * level) * Math.sqrt(area);
        var beams = level >= 3 ? 2 : 1;
        R.src = "sunbeam";
        for (var bi = 0; bi < beams; bi++) {
          var ba = p.beamAngle + bi * Math.PI;
          var bx = Math.cos(ba);
          var by = Math.sin(ba);
          for (i = 0; i < enemies.length; i++) {
            e = enemies[i];
            if (e.dead || e.prop) continue;
            dx = e.x - p.x;
            dy = e.y - p.y;
            var along = dx * bx + dy * by;
            if (along < 0 || along > beamLen + e.r) continue;
            var across = Math.abs(dx * by - dy * bx);
            if (across < 14 + e.r) B.hit(e, base * (0.35 + 0.08 * level), DOT);
          }
        }
      }
    }

    level = up.rain || 0;
    if (level) {
      T.rain = (T.rain === undefined ? 2 : T.rain) - dt;
      if (T.rain <= 0) {
        T.rain = Math.max(1.6, 4 - 0.35 * level);
        var drops = 2 + level;
        var taken = [];
        for (i = 0; i < drops; i++) {
          e = B.nearest(p.x + PS.rand(-260, 260), p.y + PS.rand(-200, 200), 360, taken);
          if (!e) break;
          taken.push(e);
          (function (x, y) {
            R.fx.push({ type: "lob", x0: x + 30, y0: y - 320, x1: x, y1: y, color: "#F7D94C", size: 8, t: 0, dur: 0.5 });
            R.fx.push({ type: "ring", x: x, y: y, r0: 44 * area, r1: 8, color: "#F7D94C", width: 2, t: 0, dur: 0.5 });
            B.as("rain", function () {
              B.later(0.5, function () {
                B.blast(x, y, 42 * area, base * (1.6 + 0.25 * level), { color: "#FFE66D", knock: 160, quiet: true });
              });
            });
          })(e.x, e.y);
        }
      }
    }

    level = up.bees || 0;
    if (level) {
      // bees circle the lemon and each one stings now and then
      T.bees = (T.bees === undefined ? 0.6 : T.bees) - dt;
      if (T.bees <= 0) {
        T.bees = 0.8;
        R.src = "bees";
        for (i = 0; i < level; i++) {
          var beeA = p.spin * 1.3 + (i / level) * TAU;
          var sx = p.x + Math.cos(beeA) * 36;
          var sy = p.y + Math.sin(beeA) * 36;
          e = B.nearest(sx, sy, 300);
          if (!e) break;
          B.shoot({
            x: sx, y: sy, angle: Math.atan2(e.y - sy, e.x - sx), speed: 380, range: 340, r: 3.5,
            dmg: base * 0.45, homing: 5, sprite: "knife", color: "#F2B93B", bounce: 0
          });
        }
      }
    }

    level = up.lash || 0;
    if (level) {
      T.lash = (T.lash === undefined ? 1 : T.lash) - dt;
      if (T.lash <= 0) {
        T.lash = Math.max(0.9, 2.2 - 0.25 * level);
        var hitList = [];
        R.src = "lash";
        for (i = 0; i < 2 + level; i++) {
          e = B.nearest(p.x, p.y, 220, hitList);
          if (!e) break;
          hitList.push(e);
          R.fx.push({ type: "beam", x0: p.x, y0: p.y, x1: e.x, y1: e.y, width: 6, color: "#8FC46A", t: 0, dur: 0.22 });
          B.hit(e, base * (1.2 + 0.2 * level), { knock: 260 });
        }
      }
    }

    level = up.bubble || 0;
    if (level && !p.bubble) {
      T.bubble = (T.bubble === undefined ? 2 : T.bubble) - dt;
      if (T.bubble <= 0) {
        T.bubble = Math.max(6, 14 - 1.6 * level);
        p.bubble = true;
        R.fx.push({ type: "ring", x: p.x, y: p.y, r0: 30, r1: 22, color: "#BFE0FF", width: 3, t: 0, dur: 0.3 });
      }
    }

    level = up.field || 0;
    if (level) {
      T.field = (T.field || 0) - dt;
      if (T.field <= 0) {
        T.field = 0.5;
        var fieldR = (70 + 10 * level) * Math.sqrt(area);
        var zapped = 0;
        R.src = "field";
        for (i = 0; i < enemies.length && zapped < level + 1; i++) {
          e = enemies[i];
          if (e.dead || e.prop) continue;
          dx = e.x - p.x;
          dy = e.y - p.y;
          if (dx * dx + dy * dy > (fieldR + e.r) * (fieldR + e.r)) continue;
          zapped++;
          e.shockT = 3;
          e.shockAmp = Math.max(e.shockAmp, 0.15);
          R.fx.push({ type: "bolt", pts: [p.x, p.y, e.x, e.y], t: 0, dur: 0.18, seed: Math.random() * 1000 });
          B.hit(e, base * (0.7 + 0.15 * level), DOT);
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
    // seed mines lying in wait, blinking once they are armed
    if (p.mines) {
      for (var m = 0; m < p.mines.length; m++) {
        var mine = p.mines[m];
        ctx.fillStyle = "#8C6A44";
        ctx.beginPath();
        ctx.ellipse(mine.x, mine.y, 7, 5, 0.4, 0, TAU);
        ctx.fill();
        ctx.fillStyle = mine.t < 0.6 ? "#9AA1A9" : Math.sin(R.t * 10 + m) > 0 ? "#E5484D" : "#7A2E1E";
        ctx.beginPath();
        ctx.arc(mine.x, mine.y - 1, 2, 0, TAU);
        ctx.fill();
      }
    }
    // the sunbeam: a glowing line turning round the lemon
    var beamLv = p.up.sunbeam || 0;
    if (beamLv) {
      var beamLen = (150 + 20 * beamLv) * Math.sqrt(B.area());
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      for (var bi = 0; bi < (beamLv >= 3 ? 2 : 1); bi++) {
        var ba = (p.beamAngle || 0) + bi * Math.PI;
        ctx.strokeStyle = "rgba(255,214,102,0.28)";
        ctx.lineWidth = 22;
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(ba) * 16, p.y + Math.sin(ba) * 16);
        ctx.lineTo(p.x + Math.cos(ba) * beamLen, p.y + Math.sin(ba) * beamLen);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,248,214,0.85)";
        ctx.lineWidth = 5;
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    }
    // the static field: a faint crackling circle
    var fieldLv = p.up.field || 0;
    if (fieldLv) {
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(R.t * 9);
      ctx.strokeStyle = "#FFE14A";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 7]);
      ctx.lineDashOffset = R.t * 40;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (70 + 10 * fieldLv) * Math.sqrt(B.area()), 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      ctx.globalAlpha = 1;
    }
    // bee buddies, circling
    var bees = p.up.bees || 0;
    for (var bb = 0; bb < bees; bb++) {
      var beeA = p.spin * 1.3 + (bb / bees) * TAU;
      var bx = p.x + Math.cos(beeA) * 36;
      var by = p.y + Math.sin(beeA) * 36 + Math.sin(R.t * 12 + bb) * 2;
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.beginPath();
      ctx.ellipse(bx - 3, by - 4, 3.5, 2 + Math.sin(R.t * 50) * 0.8, -0.5, 0, TAU);
      ctx.ellipse(bx + 3, by - 4, 3.5, 2 - Math.sin(R.t * 50) * 0.8, 0.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#F2B93B";
      ctx.beginPath();
      ctx.ellipse(bx, by, 5, 4, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#3A2A10";
      ctx.fillRect(bx - 1.5, by - 4, 1.6, 8);
      ctx.fillRect(bx + 1.6, by - 3.5, 1.4, 7);
    }
    // the bubble shield, waiting for a hit
    if (p.bubble) {
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = "#BFE0FF";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 24, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = "#DDF4FF";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.ellipse(p.x - 9, p.y - 11, 5, 2.4, -0.6, 0, TAU);
      ctx.fill();
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
