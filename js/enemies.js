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
    bomber: { r: 11, hp: 18, speed: 100, hurt: 0, xp: 2, mass: 0.8, fill: "#E0C341", ai: "bomber" },
    // not a pest: a breakable crate (events.js), here so it can use B.spawn
    crate: { r: 15, hp: 1, speed: 0, hurt: 0, xp: 0, mass: 1e6, fill: "#A0703F" }
  });

  var BOSSES = {
    queen: { r: 46, hp: 1, speed: 44, fill: "#7FB069" },
    hornet: { r: 38, hp: 0.85, speed: 78, fill: "#E0A93B" },
    slug: { r: 50, hp: 1.25, speed: 34, fill: "#9C8AC2" },
    mould: { r: 48, hp: 1.1, speed: 26, fill: "#6FA8A0" },
    beetle: { r: 50, hp: 1.15, speed: 40, fill: "#7A6A4F" },
    spider: { r: 40, hp: 1, speed: 64, fill: "#5B4A6E" },
    worm: { r: 40, hp: 1.05, speed: 66, fill: "#B9845A" },
    moth: { r: 38, hp: 0.9, speed: 58, fill: "#C9BEA6" },
    fly: { r: 34, hp: 0.85, speed: 84, fill: "#4A5A3A" }
  };

  function blank(kind, x, y) {
    var R = B.run;
    return {
      id: R ? (R.uid = (R.uid || 0) + 1) : 0,
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
    // a daily challenge's twist on the pests (Giants, Rush Hour)
    var m = R.pestMul;
    if (m && kind !== "crate") {
      if (m.r) e.r *= m.r;
      if (m.hp) e.hp = e.maxHp = e.hp * m.hp;
      if (m.speed) e.speed *= m.speed;
      if (m.xp) e.xp *= m.xp;
    }
    R.enemies.push(e);
    return e;
  };

  /* Elite pests. From chapter TRAITS_FROM on (and always in the endless
     swarm) each elite also has one trait, shown as a tag over it:
     Swift (much faster, less health), Healer (heals the pests around it
     every second), Summoner (calls in three pests now and then) and
     Splitting (breaks into two smaller copies when squashed). */
  var TRAITS = {
    swift: { name: "Swift", color: "#3F8FE4", speed: 1.6, hp: 0.7 },
    healer: { name: "Healer", color: "#3DBE8B", every: 1, reach: 150, heal: 0.06 },
    summoner: { name: "Summoner", color: "#9B6AD9", every: 5, count: 3 },
    splitting: { name: "Splitting", color: "#4FB3A0", parts: 2, share: 0.3 }
  };
  var TRAITS_FROM = 3;
  B.ELITE_TRAITS = TRAITS;

  /** Turn a fresh pest into an elite. `trait`: a key of TRAITS, false for
   *  none, or left out to roll one when the chapter allows it. */
  B.eliteUp = function (e, trait) {
    var R = B.run;
    e.elite = true;
    e.r *= 1.55;
    e.hp = e.maxHp = e.hp * 4;
    e.hurt *= 1.5;
    e.xp *= 10;
    e.mass *= 3;
    if (trait === undefined && (R.mode === "swarm" || R.ch.n >= TRAITS_FROM)) {
      var keys = Object.keys(TRAITS);
      trait = keys[Math.floor(Math.random() * keys.length)];
    }
    if (!trait || !TRAITS[trait]) return e;
    var def = TRAITS[trait];
    e.trait = trait;
    e.traitT = def.every || 0;
    if (def.speed) e.speed *= def.speed;
    if (def.hp) e.hp = e.maxHp = e.maxHp * def.hp;
    if (trait === "splitting") e.onDeath = eliteSplit;
    return e;
  };

  function makeElite(kind) {
    return B.eliteUp(atRing(kind, Math.random() * TAU));
  }

  function eliteSplit(e) {
    var def = TRAITS.splitting;
    for (var i = 0; i < def.parts; i++) {
      var angle = e.wob + (i / def.parts) * TAU;
      var part = B.spawn(e.kind, e.x + Math.cos(angle) * e.r * 0.5, e.y + Math.sin(angle) * e.r * 0.5);
      part.r = e.r * 0.7;
      part.hp = part.maxHp = e.maxHp * def.share;
      part.hurt = e.hurt * 0.7;
      part.xp = Math.ceil(e.xp * 0.15);
      part.mass = e.mass * 0.5;
      part.kx = Math.cos(angle) * 220;
      part.ky = Math.sin(angle) * 220;
    }
    B.run.fx.push({ type: "ring", x: e.x, y: e.y, r0: e.r * 0.5, r1: e.r * 2.2, color: def.color, width: 4, t: 0, dur: 0.35 });
  }

  /** What a trait does each tick, before the elite moves. */
  function traitThink(e, dt) {
    var R = B.run;
    var def = TRAITS[e.trait];
    if (!def.every) return;
    e.traitT -= dt;
    if (e.traitT > 0) return;
    e.traitT = def.every;
    if (e.trait === "healer") {
      var healed = 0;
      for (var i = 0; i < R.enemies.length; i++) {
        var o = R.enemies[i];
        if (o.dead || o.prop || o.proxyOf || o.boss || o.golden || o.hp >= o.maxHp) continue;
        var dx = o.x - e.x;
        var dy = o.y - e.y;
        if (dx * dx + dy * dy > def.reach * def.reach) continue;
        o.hp = Math.min(o.maxHp, o.hp + o.maxHp * def.heal);
        healed++;
      }
      if (healed) R.fx.push({ type: "ring", x: e.x, y: e.y, r0: e.r, r1: def.reach, color: def.color, width: 3, t: 0, dur: 0.5 });
    } else if (e.trait === "summoner") {
      if (R.enemies.length > 260) return;
      for (var k = 0; k < def.count; k++) {
        var a = Math.random() * TAU;
        var called = B.spawn("grunt", e.x + Math.cos(a) * (e.r + 26), e.y + Math.sin(a) * (e.r + 26));
        called.kx = Math.cos(a) * 140;
        called.ky = Math.sin(a) * 140;
      }
      R.fx.push({ type: "ring", x: e.x, y: e.y, r0: e.r, r1: e.r + 40, color: def.color, width: 4, t: 0, dur: 0.4 });
    }
  }

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
    var c = ringCentre(R);
    return B.spawn(kind, c.x + Math.cos(angle) * B.view.ring, c.y + Math.sin(angle) * B.view.ring);
  }

  /** Where new pests close in from: the lemon, or (playing together) one of the lemons still standing. */
  function ringCentre(R) {
    if (!R.players) return R.p;
    var up = R.players.filter(function (q) { return !q.down && !q.gone; });
    return up.length ? up[Math.floor(Math.random() * up.length)] : R.p;
  }

  /* A duel: a handful of weak pests wander the ring, for a little XP. */
  function duelDirector(dt) {
    var R = B.run;
    if (R.duel.hold > 0) return;
    if (R.spawnIn > 0) return;
    R.spawnIn = 1.1;
    var pests = 0;
    for (var i = 0; i < R.enemies.length; i++) if (!R.enemies[i].dead && !R.enemies[i].proxyOf) pests++;
    if (pests >= 12) return;
    var a = Math.random() * TAU;
    var d = PS.rand(120, B.DUEL.r - 30);
    B.spawn(Math.random() < 0.7 ? "grunt" : "dart", Math.cos(a) * d, Math.sin(a) * d);
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

  /* The dev menu's endless mode: no boss, no end. The swarm thickens for the
     first four minutes and then simply keeps coming, with a ring of pests
     every twenty seconds and an elite every forty. */
  function swarmDirector(dt) {
    var R = B.run;
    var u = Math.min(1, R.t / 240);
    if (R.spawnIn <= 0) {
      if (R.enemies.length < 120 + 200 * u) {
        var pack = 2 + Math.floor(6 * u);
        var angle = Math.random() * TAU;
        while (pack--) atRing(pickKind(0.15 + 0.85 * u), angle + PS.rand(-0.6, 0.6));
      }
      R.spawnIn = PS.lerp(0.4, 0.06, u);
    }
    R.swarmClock = (R.swarmClock || 0) + dt;
    if (R.swarmClock >= 20) {
      R.swarmClock -= 20;
      R.swarmRings = (R.swarmRings || 0) + 1;
      var count = 24 + Math.min(24, R.swarmRings * 2);
      var start = Math.random() * TAU;
      for (var i = 0; i < count; i++) atRing(R.swarmRings % 2 ? "dart" : "grunt", start + (i / count) * TAU);
      if (R.swarmRings % 2 === 0) makeElite(Math.random() < 0.5 ? "charger" : "brute");
      B.toast("A ring of pests closes in!");
    }
  }

  B.director = function (dt) {
    var R = B.run;
    // the battle can be decided earlier in the same tick (the lemon's own
    // attack felling the boss): nothing more may spawn after that
    if (R.phase !== "swarm" && R.phase !== "boss") return;
    R.spawnIn -= dt;
    var noSpawn = B.anyCheat("noSpawn");
    if (R.duel) {
      if (!noSpawn) duelDirector(dt);
      return;
    }
    if (noSpawn) {
      // the admin's "stop spawning": only the boss still turns up on time
      R.spawnIn = Math.max(R.spawnIn, 0.5);
      if (R.mode !== "swarm" && R.phase === "swarm" && R.t >= R.dur) startBoss();
      return;
    }
    if (R.mode === "swarm") return swarmDirector(dt);

    if (R.phase === "boss") {
      if (R.spawnIn <= 0) {
        if (R.enemies.length < 22) atRing(pickKind(0.6), Math.random() * TAU);
        R.spawnIn = 1.6;
      }
      return;
    }

    // the swarm thickens the whole way through the chapter
    var u = Math.min(1, R.t / R.dur);
    var more = R.mpMul ? R.mpMul.pests : 1; // playing together: a thicker swarm
    if (R.spawnIn <= 0) {
      if (R.enemies.length < (80 + 60 * u + R.ch.n * 2) * more) {
        var pack = 1 + Math.floor(2.4 * u);
        var angle = Math.random() * TAU;
        while (pack--) atRing(pickKind(u), angle + PS.rand(-0.5, 0.5));
      }
      R.spawnIn = PS.lerp(0.8, 0.28, Math.pow(u, 0.8)) / more;
    }

    if (R.hordes.length && R.t >= R.hordes[0]) {
      R.hordes.shift();
      var count = Math.round((12 + Math.min(12, R.ch.n)) * (R.mpMul ? R.mpMul.horde : 1));
      var start = Math.random() * TAU;
      for (var i = 0; i < count; i++) atRing(u < 0.4 ? "grunt" : "dart", start + (i / count) * TAU);
      B.toast("A swarm closes in!");
    }

    if (R.elites.length && R.t >= R.elites[0]) {
      R.elites.shift();
      var elite = makeElite(R.ch.n >= 5 && Math.random() < 0.5 ? "charger" : "brute");
      B.toast(elite.trait ? "A " + TRAITS[elite.trait].name.toLowerCase() + " elite is hunting you" : "An elite pest is hunting you");
    }

    if (R.t >= R.dur) startBoss();
  };

  B.startBoss = startBoss; // the admin panel can call the boss in early
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

    // late chapters bring two bosses at once, from opposite sides, each a
    // little less tough than a lone one
    var from = PS.chapterBosses(R.ch.n);
    var share = from.length > 1 ? PS.TWIN_BOSS.hp : 1;
    var angle = Math.random() * TAU;
    R.bosses = from.map(function (src, index) {
      var kind = BOSSES[src.boss];
      var a = angle + index * Math.PI;
      var c = ringCentre(R);
      var e = blank(src.boss, c.x + Math.cos(a) * B.view.ring, c.y + Math.sin(a) * B.view.ring);
      e.boss = true;
      e.name = src.bossName;
      e.tier = src.bossTier;
      e.r = kind.r;
      e.look = src.look;
      e.fill = e.look ? e.look.body : kind.fill;
      // toughness always comes from the chapter being played
      e.hp = e.maxHp = 2250 * R.ch.bossScale * Math.pow(R.dur / 180, 1.3) * kind.hp * share * (R.mpMul ? R.mpMul.boss : 1);
      e.speed = kind.speed;
      e.hurt = 44 * R.ch.dmgScale;
      e.baseHurt = e.hurt; // some bosses stop hurting on touch while in the air or underground
      e.mass = 1e6;
      e.clock = 2.5 + index * 1.3; // out of step, so they do not attack in unison
      e.clock2 = 4 + index * 1.7;
      e.clock3 = 1.4 + index * 0.9; // a moment's grace before the aimed attacks start
      e.spin = 0;
      e.dashes = 0;
      e.age = 0;
      e.onDeath = bossDown;
      R.enemies.push(e);
      return e;
    });
    R.bosses.forEach(function (b) {
      R.fx.push({ type: "ring", x: b.x, y: b.y, r0: b.r, r1: b.r * 5, color: "#E5484D", width: 8, t: 0, dur: 0.8 });
      R.fx.push({ type: "ring", x: b.x, y: b.y, r0: b.r * 0.5, r1: b.r * 3.2, color: "#FFE66D", width: 4, t: 0, dur: 0.55 });
    });
    R.shake = Math.max(R.shake, 14);
    R.phase = "boss";
    R.reachedBoss = true;
    R.boss = R.bosses[0];
    R.spawnIn = 2;
    PS.sfx.play("boss");
    PS.music.play("boss");
    B.toast(R.bosses.length > 1 ? R.bosses[0].name + " and " + R.bosses[1].name + " have arrived!" : R.boss.name + " has arrived!");
  }

  /** A boss has fallen: the chapter is won once none are left. */
  function bossDown(e) {
    var R = B.run;
    var left = (R.bosses || []).filter(function (b) { return !b.dead; });
    if (!left.length) {
      B.win();
      return;
    }
    R.boss = left[0];
    B.toast(e.name + " is down! " + left[0].name + " is still out there");
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

    if (e.golden) {
      // runs from the lemon, zig-zagging
      var zig = Math.sin(R.t * 3.2 + e.wob) * 0.7;
      walk(e, -nx - ny * zig, -ny + nx * zig, e.speed * 0.8 * slow * dt);
      return;
    }

    if (e.trait) {
      traitThink(e, dt);
      if (e.dead) return;
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
        B.hurtIn(e.x, e.y, 72, 36 * scale);
      }
    }
  };

  /** The angle to shoot from (x, y) so a shot at `speed` meets the lemon where
   *  it is heading. `share` is how much of its movement to allow for: 1 is a
   *  perfect lead, 0 aims at where it is now. Bosses use part of a lead, so
   *  running in a straight line no longer dodges everything, but a turn does. */
  function aimAt(x, y, speed, share, delay) {
    var p = B.run.p;
    var dx = p.x - x;
    var dy = p.y - y;
    // `delay`: time before the attack even sets off (a dash's wind-up)
    var time = Math.sqrt(dx * dx + dy * dy) / speed + (delay || 0);
    var tx = p.x + (p.vx || 0) * time * share;
    var ty = p.y + (p.vy || 0) * time * share;
    return Math.atan2(ty - y, tx - x);
  }

  /* Boss attacks. The damage of every hit is as it always was; what makes a
     boss hard is how fast, how dense and how well aimed its attacks are.
     Below half health (`rage`) everything comes round sooner. */
  function bossThink(e, dt, nx, ny, d, slow, scale) {
    var R = B.run;
    var p = R.p;
    var rage = e.hp < e.maxHp * 0.5 ? 0.72 : 1;
    var angry = rage < 1;
    var i;
    var count;
    var angle;
    e.age += dt;
    e.clock -= dt;
    e.clock2 -= dt;
    e.clock3 -= dt;
    if (e.echoT > 0) e.echoT -= dt;

    if (NEW_KINDS[e.kind]) {
      NEW_KINDS[e.kind](e, dt, nx, ny, d, slow, scale, rage, angry);
      return;
    }

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
        // two rings, the second a beat behind and turned half a gap, so the
        // way through the first is blocked by the second: weave, do not just run
        e.clock2 = 3 * rage;
        e.ringCount = 14 + e.tier * 2;
        e.ringAngle = Math.random() * TAU;
        for (i = 0; i < e.ringCount; i++) enemyShot(e.x, e.y, e.ringAngle + (i / e.ringCount) * TAU, 150, 6, 14 * scale);
        e.echoT = 0.42;
      }
      if (e.echoT !== undefined && e.echoT <= 0 && e.ringCount) {
        for (i = 0; i < e.ringCount; i++) enemyShot(e.x, e.y, e.ringAngle + ((i + 0.5) / e.ringCount) * TAU, 150, 6, 14 * scale);
        e.ringCount = 0;
      }
      if (e.clock3 <= 0) {
        // between rings, a quick aimed spread
        e.clock3 = 2.7 * (angry ? 0.85 : 1);
        count = angry ? 4 : 3;
        angle = aimAt(e.x, e.y, 230, 0.7);
        for (i = 0; i < count; i++) enemyShot(e.x, e.y, angle + (i - (count - 1) / 2) * 0.13, 230, 6, 14 * scale);
      }
    } else if (e.kind === "hornet") {
      if (e.mode === 0) {
        walk(e, nx, ny, e.speed * slow * dt);
        if (e.clock <= 0) {
          e.dashes = 3 + Math.floor(e.tier / 2);
          dashAt(e, 0.55 * (angry ? 0.88 : 1));
        }
      } else if (e.mode === 1) {
        if (e.clock <= 0) {
          e.mode = 2;
          e.clock = 0.55;
          e.struck = false;
        }
      } else if (e.mode === 2) {
        walk(e, e.ax, e.ay, 600 * slow * dt);
        if (!e.struck && d < e.r + p.r) {
          e.struck = true;
          B.hurt(30 * scale);
        }
        if (e.clock <= 0) {
          if (--e.dashes > 0) {
            dashAt(e, 0.36 * (angry ? 0.88 : 1));
          } else {
            // worn out: a fan of stings aimed where you are going, then a
            // second fan when it is angry, then a short hover
            e.mode = 3;
            e.clock = 1.2 * rage;
            stingFan(e, scale, 0);
            if (angry) e.echoT = 0.28;
          }
        }
      } else {
        if (e.echoT !== undefined && e.echoT <= 0 && e.echoT > -1) {
          stingFan(e, scale, 2);
          e.echoT = -2;
        }
        if (e.clock <= 0) {
          e.mode = 0;
          e.clock = 1.7 * rage;
        }
      }
    } else if (e.kind === "slug") {
      walk(e, nx, ny, e.speed * slow * dt);
      if (e.clock3 <= 0) {
        // a thicker trail, so there is less safe ground behind it
        e.clock3 = 0.34;
        B.addZone({ type: "puddle", x: e.x, y: e.y, r: 30, life: 6, dps: 22 * scale, slow: 0.35, color: "#8A77B8" });
      }
      if (e.clock <= 0) {
        // lobs slime: one where you will be, one where you are, the rest
        // scattered around where you are heading. Step out of the red circles.
        e.clock = 3.6 * rage;
        count = 4 + e.tier;
        var warn = 0.8;
        var ahead = { x: p.x + (p.vx || 0) * warn * 0.85, y: p.y + (p.vy || 0) * warn * 0.85 };
        for (i = 0; i < count; i++) {
          if (i === 0) lobSlime(e, ahead.x, ahead.y, scale, warn);
          else if (i === 1) lobSlime(e, p.x, p.y, scale, warn);
          else lobSlime(e, ahead.x + PS.rand(-95, 95), ahead.y + PS.rand(-95, 95), scale, warn);
        }
      }
    } else {
      // mould: a faster spiral of spores (two, turning opposite ways, once it
      // is angry), aimed bursts, and now and then a litter of bombers
      walk(e, nx, ny, e.speed * slow * dt);
      e.spin += dt * (1.3 + 0.16 * e.tier);
      if (e.clock <= 0) {
        e.clock = 0.16 * rage;
        var arms = 2 + (e.tier >= 2 ? 1 : 0) + (e.tier >= 4 ? 1 : 0);
        for (i = 0; i < arms; i++) enemyShot(e.x, e.y, e.spin + (i / arms) * TAU, 140, 5, 12 * scale, "#9BD1C6");
        // the counter-spiral is thinner and fires every other time
        e.flip = !e.flip;
        if (angry && e.flip) {
          for (i = 0; i < 2; i++) enemyShot(e.x, e.y, -e.spin + i * Math.PI + 0.3, 120, 5, 12 * scale, "#C9E8E1");
        }
      }
      if (e.clock3 <= 0) {
        e.clock3 = 2.6 * rage;
        angle = aimAt(e.x, e.y, 180, 0.7);
        for (i = 0; i < 3; i++) enemyShot(e.x, e.y, angle + (i - 1) * 0.16, 180, 5, 12 * scale, "#9BD1C6");
      }
      if (e.clock2 <= 0) {
        e.clock2 = 5.5 * rage;
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

  /* ------------------------------------------------- the five newer bosses */
  /* Each has its own way of fighting. Their hits do the same damage as the
     older bosses' (shots 12 to 14, a slam 32, a beam 30, dust 22 a second, all
     times the chapter's scale); what sets them apart is how they come at you. */

  /** How close the lemon is to the line from (x0, y0) to (x1, y1). */
  function distToSegment(px, py, x0, y0, x1, y1) {
    var dx = x1 - x0;
    var dy = y1 - y0;
    var len = dx * dx + dy * dy || 1;
    var k = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / len));
    var cx = x0 + dx * k - px;
    var cy = y0 + dy * k - py;
    return Math.sqrt(cx * cx + cy * cy);
  }

  /** Where the lemon will be in `time` seconds if it keeps going, `share` of the way. */
  function ahead(time, share) {
    var p = B.run.p;
    return { x: p.x + (p.vx || 0) * time * share, y: p.y + (p.vy || 0) * time * share };
  }

  function ring(e, count, speed, dmg, color, offset) {
    var start = offset === undefined ? Math.random() * TAU : offset;
    for (var i = 0; i < count; i++) enemyShot(e.x, e.y, start + (i / count) * TAU, speed, 5, dmg, color);
  }

  function minions(e, kind, count) {
    var R = B.run;
    if (R.enemies.length >= 150) return;
    for (var i = 0; i < count; i++) {
      var a = (i / count) * TAU + Math.random();
      B.spawn(kind, e.x + Math.cos(a) * (e.r + 24), e.y + Math.sin(a) * (e.r + 24));
    }
  }

  var NEW_KINDS = {
    /* Beetle: plods after you, then crouches and leaps to where you are
       heading. It lands with a slam and a ring of shots. Angry, it leaps twice. */
    beetle: function (e, dt, nx, ny, d, slow, scale, rage, angry) {
      var R = B.run;
      var i;
      if (e.mode === 0) {
        walk(e, nx, ny, e.speed * slow * dt);
        if (e.clock3 <= 0) {
          // a flick of the horn: a short aimed spread
          e.clock3 = 2.6 * rage;
          var a = aimAt(e.x, e.y, 210, 0.6);
          for (i = -1; i <= 1; i++) enemyShot(e.x, e.y, a + i * 0.16, 210, 6, 14 * scale, "#C79A5B");
        }
        if (e.clock <= 0) {
          var spot = ahead(1.05, 0.75);
          var jx = spot.x - e.x;
          var jy = spot.y - e.y;
          var far = Math.sqrt(jx * jx + jy * jy) || 1;
          if (far > 430) {
            jx *= 430 / far;
            jy *= 430 / far;
          }
          e.jx0 = e.x;
          e.jy0 = e.y;
          e.jx1 = e.x + jx;
          e.jy1 = e.y + jy;
          e.mode = 1;
          e.clock = 0.4;
          B.addZone({ type: "warn", x: e.jx1, y: e.jy1, r: 82, life: 1.05 });
        }
      } else if (e.mode === 1) {
        // crouching, about to go
        if (e.clock <= 0) {
          e.mode = 2;
          e.clock = 0.65;
          e.hurt = 0; // it passes over you in the air
        }
      } else if (e.mode === 2) {
        var k = Math.max(0, Math.min(1, 1 - e.clock / 0.65));
        e.x = e.jx0 + (e.jx1 - e.jx0) * k;
        e.y = e.jy0 + (e.jy1 - e.jy0) * k;
        e.lift = Math.sin(k * Math.PI);
        if (e.clock <= 0) {
          e.lift = 0;
          e.hurt = e.baseHurt;
          B.hurtIn(e.x, e.y, 82, 32 * scale);
          R.fx.push({ type: "blast", x: e.x, y: e.y, r: 82, color: "#C79A5B", t: 0, dur: 0.35 });
          R.fx.push({ type: "ring", x: e.x, y: e.y, r0: 40, r1: 160, color: "#F2D49B", width: 6, t: 0, dur: 0.45 });
          R.shake = Math.max(R.shake, 9);
          PS.sfx.play("boom", null, 0);
          ring(e, 12 + e.tier * 2, 170, 14 * scale, "#C79A5B");
          e.mode = 3;
          e.clock = 0.7 * rage;
        }
      } else if (e.clock <= 0) {
        // back on its feet; angry, it goes straight up again once
        if (angry && !e.again) {
          e.again = true;
          e.mode = 0;
          e.clock = 0;
        } else {
          e.again = false;
          e.mode = 0;
          e.clock = 3.8 * rage;
        }
      }
    },

    /* Spider: keeps its distance and circles. It charges up beams along red
       lanes (three, five when angry) that fire all at once, spits webs that
       stick you in place, and now and then lets loose its spiderlings. */
    spider: function (e, dt, nx, ny, d, slow, scale, rage, angry) {
      var R = B.run;
      var p = R.p;
      var i;
      if (e.mode === 0) {
        if (d > 310) walk(e, nx, ny, e.speed * slow * dt);
        else if (d < 210) walk(e, -nx, -ny, e.speed * 0.8 * slow * dt);
        else walk(e, -ny * e.side, nx * e.side, e.speed * 0.75 * slow * dt);
        if (e.clock <= 0) {
          var spot = ahead(0.7, 0.8);
          var base = Math.atan2(spot.y - e.y, spot.x - e.x);
          var spread = angry ? [0, -0.3, 0.3, -0.6, 0.6] : [0, -0.32, 0.32];
          e.beams = spread.map(function (s) { return base + s; });
          e.bx = e.x;
          e.by = e.y;
          e.beams.forEach(function (a) {
            B.addZone({ type: "lane", x: e.bx, y: e.by, angle: a, len: 560, width: 36, life: 0.7 });
          });
          e.mode = 1;
          e.clock = 0.7;
        }
      } else if (e.clock <= 0) {
        // the beams go off together
        var hit = false;
        e.beams.forEach(function (a) {
          var x1 = e.bx + Math.cos(a) * 560;
          var y1 = e.by + Math.sin(a) * 560;
          if (!hit && distToSegment(p.x, p.y, e.bx, e.by, x1, y1) < 18 + p.r - 3) {
            hit = true;
            B.hurt(30 * scale);
          }
          R.fx.push({ type: "beam", x0: e.bx, y0: e.by, x1: x1, y1: y1, width: 18, color: "#DCE8FF", t: 0, dur: 0.32 });
        });
        PS.sfx.play("zap", null, 0);
        R.shake = Math.max(R.shake, 4);
        e.mode = 0;
        e.clock = 3.8 * rage;
        e.side = -e.side;
      }
      if (e.mode === 0 && !(e.echoT > 0)) {
        // venom spat while it circles (the timer starts unset, so this fires first time)
        e.echoT = 1.15 * rage;
        var va = aimAt(e.x, e.y, 225, 0.75);
        var venom = angry ? 2 : 1;
        for (i = -venom; i <= venom; i++) enemyShot(e.x, e.y, va + i * 0.14, 225, 5, 14 * scale, "#9BE08A");
      }
      if (e.clock2 <= 0) {
        // webs: one where you are heading, two either side of it
        e.clock2 = 3.4 * rage;
        var at = ahead(0.75, 0.8);
        for (i = 0; i < 3; i++) {
          var wx = at.x + (i ? (i === 1 ? -1 : 1) * 85 : 0);
          var wy = at.y + (i ? PS.rand(-40, 40) : 0);
          lobWeb(e, wx, wy);
        }
      }
      if (e.clock3 <= 0) {
        e.clock3 = 7 * rage;
        minions(e, "dart", 3 + Math.floor(e.tier / 2));
      }
    },

    /* Worm: chases you above ground, spitting aimed spreads, then burrows. The
       mound races after you under the ground, stops, and the worm bursts up
       where it stopped with a ring of shots. You can still hit the mound. */
    worm: function (e, dt, nx, ny, d, slow, scale, rage, angry) {
      var R = B.run;
      var p = R.p;
      if (e.mode === 0) {
        walk(e, nx, ny, e.speed * slow * dt);
        if (e.clock3 <= 0) {
          e.clock3 = 1.05 * rage;
          var a = aimAt(e.x, e.y, 230, 0.75);
          for (var i = -2; i <= 2; i++) enemyShot(e.x, e.y, a + i * 0.15, 230, 5, 14 * scale, "#B9845A");
        }
        if (e.clock <= 0) {
          e.mode = 1;
          e.clock = 0.45;
          e.hurt = 0;
        }
      } else if (e.mode === 1) {
        // digging in
        if (Math.random() < 0.5) B.sparks(e.x + PS.rand(-e.r, e.r), e.y + e.r * 0.5, "#7A5A38", 1, 120);
        if (e.clock <= 0) {
          e.mode = 2;
          e.under = true;
          e.clock = angry ? 1.2 : 1.6;
        }
      } else if (e.mode === 2) {
        // under the ground, heading for where you will be
        var spot = ahead(0.65, 0.85);
        var dx = spot.x - e.x;
        var dy = spot.y - e.y;
        var dd = Math.sqrt(dx * dx + dy * dy) || 1;
        walk(e, dx / dd, dy / dd, Math.min(dd, 250 * slow * dt));
        if (Math.random() < 0.35) B.sparks(e.x, e.y, "#7A5A38", 1, 70);
        if (e.clock <= 0) {
          e.mode = 3;
          e.clock = 0.6;
          B.addZone({ type: "warn", x: e.x, y: e.y, r: 70, life: 0.6 });
        }
      } else if (e.clock <= 0) {
        // bursts up
        e.under = false;
        e.hurt = e.baseHurt;
        B.hurtIn(e.x, e.y, 70, 32 * scale);
        R.fx.push({ type: "blast", x: e.x, y: e.y, r: 70, color: "#9C7448", t: 0, dur: 0.35 });
        B.sparks(e.x, e.y, "#7A5A38", 16, 200);
        R.shake = Math.max(R.shake, 7);
        PS.sfx.play("boom", null, 0);
        ring(e, 12 + e.tier * 2, 170, 14 * scale, "#B9845A");
        e.trail = [];
        e.mode = 0;
        e.clock = 3.1 * rage;
      }
      // the body follows the path the head took
      var trail = e.trail || (e.trail = []);
      var last = trail[0];
      if (!last || (last.x - e.x) * (last.x - e.x) + (last.y - e.y) * (last.y - e.y) > e.r * e.r * 0.36) {
        trail.unshift({ x: e.x, y: e.y });
        if (trail.length > 7) trail.pop();
      }
    },

    /* Moth: flutters around you at a distance, leaving clouds of stinging
       dust behind it, and beats its wings to send sweeping arcs of scales. */
    moth: function (e, dt, nx, ny, d, slow, scale, rage, angry) {
      var R = B.run;
      var i;
      var toward = d > 270 ? 1 : d < 190 ? -0.8 : 0.15;
      var weave = Math.sin(e.age * 1.7) * 0.95 * e.side;
      walk(e, nx * toward - ny * weave, ny * toward + nx * weave, e.speed * slow * dt);
      if (e.clock3 <= 0) {
        e.clock3 = angry ? 0.5 : 0.7;
        B.addZone({ type: "puddle", x: e.x, y: e.y, r: 38, life: 4.5, dps: 22 * scale, slow: 0.2, color: "#E8DCC0", dust: true });
      }
      if (e.clock <= 0) {
        e.clock = 3.4 * rage;
        e.gusts = angry ? 3 : 2;
        e.gustTurn = 0;
        e.echoT = 0;
      }
      if (e.gusts > 0 && e.echoT <= 0) {
        // an arc of scales, each gust swept a little further round
        var base = aimAt(e.x, e.y, 135, 0.5) + e.gustTurn;
        for (i = 0; i < 9; i++) enemyShot(e.x, e.y, base + (i - 4) * 0.17, 135, 5, 12 * scale, "#EDE3C8");
        e.gustTurn += 0.12 * e.side;
        e.gusts--;
        e.echoT = 0.3;
      }
      if (e.clock2 <= 0) {
        e.clock2 = 7.5 * rage;
        minions(e, "grunt", 2 + e.tier);
      }
    },

    /* Fly: zips round you in a circle, firing quick pairs, then vanishes and
       reappears somewhere else (a red circle shows where) with a burst of shots. */
    fly: function (e, dt, nx, ny, d, slow, scale, rage, angry) {
      var R = B.run;
      var p = R.p;
      var i;
      if (e.mode === 0) {
        var radial = (d - 210) / 120;
        walk(e, -ny * e.side + nx * radial, nx * e.side + ny * radial, e.speed * 1.4 * slow * dt);
        if (e.clock3 <= 0) {
          e.clock3 = 0.9;
          var a = aimAt(e.x, e.y, 240, 0.7);
          for (i = -1; i <= 1; i++) enemyShot(e.x, e.y, a + i * 0.1, 240, 5, 12 * scale, "#C8453E");
        }
        if (e.clock <= 0) {
          // pick where to reappear and show it
          var ang = Math.random() * TAU;
          var spot = ahead(0.55, 0.5);
          e.tx = spot.x + Math.cos(ang) * 200;
          e.ty = spot.y + Math.sin(ang) * 200;
          B.addZone({ type: "warn", x: e.tx, y: e.ty, r: 46, life: 0.55 });
          e.mode = 1;
          e.clock = 0.3;
          e.hurt = 0;
        }
      } else if (e.mode === 1) {
        e.fade = Math.max(0, e.clock / 0.3);
        if (e.clock <= 0) {
          e.x = e.tx;
          e.y = e.ty;
          e.mode = 2;
          e.clock = 0.25;
          R.fx.push({ type: "ring", x: e.x, y: e.y, r0: 10, r1: 90, color: "#C8453E", width: 4, t: 0, dur: 0.3 });
          ring(e, 10 + e.tier, 190, 12 * scale, "#C8453E");
          var at = aimAt(e.x, e.y, 240, 0.7);
          var spray = angry ? 2 : 1;
          for (i = -spray; i <= spray; i++) enemyShot(e.x, e.y, at + i * 0.12, 240, 5, 12 * scale, "#C8453E");
        }
      } else {
        e.fade = Math.min(1, 1 - e.clock / 0.25);
        if (e.clock <= 0) {
          e.fade = 1;
          e.hurt = e.baseHurt;
          e.mode = 0;
          e.clock = 2.6 * rage;
          e.side = Math.random() < 0.5 ? -1 : 1;
        }
      }
    }
  };

  /** The spider's web: thrown like the slug's slime, it lands as a patch that
   *  holds you nearly still but does not hurt. */
  function lobWeb(e, x, y) {
    var R = B.run;
    R.fx.push({ type: "lob", x0: e.x, y0: e.y, x1: x, y1: y, color: "#E8EEF5", size: 6, t: 0, dur: 0.7 });
    B.addZone({
      type: "warn", x: x, y: y, r: 56, life: 0.7,
      onEnd: function (zone) {
        B.addZone({ type: "puddle", x: zone.x, y: zone.y, r: 58, life: 5.5, dps: 0, slow: 0.55, color: "#E8EEF5", web: true });
      }
    });
  }

  /** The hornet's fan of stings, aimed where the lemon is heading. `fewer`
   *  thins it (the second fan when it is angry). */
  function stingFan(e, scale, fewer) {
    var count = 7 + e.tier - (fewer || 0);
    var base = aimAt(e.x, e.y, 240, 0.6);
    for (var i = 0; i < count; i++) enemyShot(e.x, e.y, base + (i - (count - 1) / 2) * 0.2, 240, 5, 14 * scale, "#F2B93B");
  }

  /** The hornet lines up a dash at where the lemon will be when it arrives. */
  function dashAt(e, time) {
    // the direction is fixed when the wind-up starts, so lead for the wind-up too
    var angle = aimAt(e.x, e.y, 600, 0.8, time);
    windUp(e, Math.cos(angle), Math.sin(angle), time);
  }

  function windUp(e, nx, ny, time) {
    e.mode = 1;
    e.clock = time;
    e.ax = nx;
    e.ay = ny;
    B.addZone({ type: "lane", x: e.x, y: e.y, angle: Math.atan2(ny, nx), len: 340, width: e.r * 1.7, life: time });
  }

  function lobSlime(e, x, y, scale, warn) {
    var R = B.run;
    var time = warn || 0.95;
    R.fx.push({ type: "lob", x0: e.x, y0: e.y, x1: x, y1: y, color: "#8A77B8", size: 8, t: 0, dur: time });
    B.addZone({
      type: "warn", x: x, y: y, r: 54, life: time,
      onEnd: function (zone) {
        R.fx.push({ type: "blast", x: zone.x, y: zone.y, r: zone.r, color: "#8A77B8", t: 0, dur: 0.3 });
        B.hurtIn(zone.x, zone.y, zone.r, 32 * scale);
        B.addZone({ type: "puddle", x: zone.x, y: zone.y, r: 44, life: 5, dps: 22 * scale, slow: 0.35, color: "#8A77B8" });
      }
    });
  }

  /* ---------------------------------------------------------------- draw */

  function eyes(ctx, x, y, r, lookX, lookY, angry) {
    var ex = r * 0.36;
    var ey = -r * 0.1;
    var er = Math.max(1.5, r * 0.17);
    var side;
    for (side = -1; side <= 1; side += 2) {
      ctx.fillStyle = "#FFFCF2";
      circle(ctx, x + side * ex, y + ey, er * 1.35);
      ctx.fillStyle = P.charcoal;
      circle(ctx, x + side * ex + lookX * 0.6, y + ey + lookY * 0.6, er * 0.85);
      if (er > 2) {
        ctx.fillStyle = "#FFFFFF";
        circle(ctx, x + side * ex + lookX * 0.6 - er * 0.28, y + ey + lookY * 0.6 - er * 0.3, er * 0.26);
      }
    }
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
      // drawn larger than the body that is hit, so it looms; nothing else about it changes
      ctx.globalAlpha = e.fade === undefined ? 1 : e.fade;
      if (!e.under) drawBossAura(ctx, e, R);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(BOSS_LOOK, BOSS_LOOK);
      ctx.translate(-x, -y);
      drawBoss(ctx, e, R, nx, ny, body);
      ctx.restore();
      ctx.globalAlpha = 1;
      return;
    }

    if (e.elite) {
      var trait = e.trait ? TRAITS[e.trait] : null;
      if (trait && e.trait === "healer") {
        // how far its healing reaches
        ctx.fillStyle = trait.color;
        ctx.globalAlpha = 0.07;
        circle(ctx, x, y, trait.reach);
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = "#F2B93B";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r + 4 + Math.sin(t * 5) * 1.2, 0, TAU);
      ctx.stroke();
      if (trait) {
        ctx.strokeStyle = trait.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(x, y, r + 9, t * 1.5, t * 1.5 + TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      }
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
        B.ball(ctx, x - nx * r * 2, y - ny * r * 2 + Math.sin(t * 7 + 1) * 1.5, r * 0.58);
        B.ball(ctx, x - nx * r * 1.1, y - ny * r * 1.1 + Math.sin(t * 7) * 1.5, r * 0.78);
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
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1 + 0.08 * Math.sin(t * 6), 1 - 0.08 * Math.sin(t * 6));
      B.ball(ctx, 0, 0, r);
      ctx.restore();
    } else {
      B.ball(ctx, x, y, r);
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
      if (e.trait) {
        // its trait, named over the health bar
        ctx.save();
        ctx.font = "800 11px 'Baloo 2', Nunito, sans-serif";
        ctx.textAlign = "center";
        ctx.lineJoin = "round";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(20,18,14,0.75)";
        ctx.strokeText(TRAITS[e.trait].name, x, y - r - 17);
        ctx.fillStyle = TRAITS[e.trait].color;
        ctx.fillText(TRAITS[e.trait].name, x, y - r - 17);
        ctx.restore();
      }
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

  /* The parts of a chapter's boss look that sit behind its body... */
  function lookBehind(ctx, L, x, y, r, t) {
    var i;
    var a;
    ctx.lineCap = "round";
    switch (L.feature) {
      case 0:
        ctx.strokeStyle = L.dark;
        ctx.lineWidth = Math.max(4, r * 0.16);
        for (i = -1; i <= 1; i += 2) {
          ctx.beginPath();
          ctx.moveTo(x + i * r * 0.45, y - r * 0.8);
          ctx.quadraticCurveTo(x + i * r * 1.1, y - r * 0.95, x + i * r * 0.88, y - r * 1.6);
          ctx.stroke();
        }
        break;
      case 1:
        ctx.fillStyle = L.dark;
        for (i = 0; i < 10; i++) {
          a = (i / 10) * TAU + t * 0.25;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a - 0.17) * r * 0.9, y + Math.sin(a - 0.17) * r * 0.9);
          ctx.lineTo(x + Math.cos(a) * r * 1.32, y + Math.sin(a) * r * 1.32);
          ctx.lineTo(x + Math.cos(a + 0.17) * r * 0.9, y + Math.sin(a + 0.17) * r * 0.9);
          ctx.closePath();
          ctx.fill();
        }
        break;
      case 2:
        ctx.fillStyle = L.accent;
        ctx.globalAlpha = 0.6;
        for (i = -1; i <= 1; i += 2) {
          ctx.beginPath();
          ctx.ellipse(x + i * r * 1.0, y - r * 0.2, r * 0.8, r * 0.38 + Math.sin(t * 6) * 2, i * (0.5 + Math.sin(t * 6) * 0.12), 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      case 3:
        ctx.strokeStyle = L.dark;
        ctx.lineWidth = Math.max(4, r * 0.13);
        ctx.beginPath();
        ctx.moveTo(x + r * 0.6, y + r * 0.5);
        ctx.quadraticCurveTo(x + r * 1.55, y + r * 0.75 + Math.sin(t * 3) * 4, x + r * 1.4, y - r * 0.15);
        ctx.stroke();
        ctx.fillStyle = L.dark;
        circle(ctx, x + r * 1.4, y - r * 0.2, r * 0.12);
        break;
      case 4:
        ctx.strokeStyle = L.dark;
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (i = 0; i < 3; i++) {
          var lift = Math.sin(t * 8 + i * 2) * 3;
          ctx.moveTo(x - r * (0.35 + i * 0.22), y + r * (0.75 - i * 0.1));
          ctx.lineTo(x - r * (0.65 + i * 0.35), y + r * (1.2 - i * 0.05) + lift);
          ctx.moveTo(x + r * (0.35 + i * 0.22), y + r * (0.75 - i * 0.1));
          ctx.lineTo(x + r * (0.65 + i * 0.35), y + r * (1.2 - i * 0.05) - lift);
        }
        ctx.stroke();
        break;
      case 5:
        ctx.strokeStyle = L.dark;
        ctx.lineWidth = 3;
        for (i = -1; i <= 1; i += 2) {
          var tipX = x + i * r * 0.7 + Math.sin(t * 3 + i) * 3;
          var tipY = y - r * 1.55;
          ctx.beginPath();
          ctx.moveTo(x + i * r * 0.3, y - r * 0.85);
          ctx.quadraticCurveTo(x + i * r * 0.55, y - r * 1.3, tipX, tipY);
          ctx.stroke();
          ctx.fillStyle = L.accent;
          circle(ctx, tipX, tipY, 5);
        }
        break;
    }
  }

  /* ...and the parts that sit on top of it: the pattern, then a gem or plates. */
  function lookFront(ctx, L, x, y, r, t) {
    var i;
    if (L.pattern) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r * 0.95, 0, TAU);
      ctx.clip();
      ctx.globalAlpha = 0.38;
      ctx.fillStyle = L.dark;
      if (L.pattern === 1) {
        ctx.fillRect(x - r, y - r * 0.1, r * 2, r * 0.2);
        ctx.fillRect(x - r, y + r * 0.35, r * 2, r * 0.2);
      } else if (L.pattern === 2) {
        circle(ctx, x - r * 0.4, y - r * 0.3, r * 0.15);
        circle(ctx, x + r * 0.35, y - r * 0.5, r * 0.12);
        circle(ctx, x, y + r * 0.35, r * 0.17);
        circle(ctx, x + r * 0.5, y + r * 0.25, r * 0.11);
        circle(ctx, x - r * 0.55, y + r * 0.4, r * 0.1);
      } else if (L.pattern === 3) {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = L.accent;
        ctx.beginPath();
        ctx.ellipse(x, y + r * 0.7, r * 0.8, r * 0.5, 0, 0, TAU);
        ctx.fill();
      } else {
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = L.dark;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (i = 0; i <= 6; i++) {
          var zx = x - r + (i * r * 2) / 6;
          var zy = y + r * 0.1 + (i % 2 ? -r * 0.18 : r * 0.18);
          if (i) ctx.lineTo(zx, zy);
          else ctx.moveTo(zx, zy);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    if (L.feature === 6) {
      ctx.fillStyle = L.accent;
      ctx.strokeStyle = L.dark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - r * 0.75);
      ctx.lineTo(x + r * 0.17, y - r * 0.5);
      ctx.lineTo(x, y - r * 0.25);
      ctx.lineTo(x - r * 0.17, y - r * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (L.feature === 7) {
      ctx.strokeStyle = L.accent;
      ctx.lineWidth = Math.max(3, r * 0.1);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(x, y + r * 0.05, r * 0.85, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y + r * 0.2, r * 0.62, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
    }
  }

  /* how much bigger a boss is drawn than its hitbox */
  var BOSS_LOOK = 1.35;

  /** Under a boss: a pulsing glow in its own colour (red once it is past half
   *  health and fighting harder), a ring of spikes turning slowly round it, and,
   *  when enraged, wisps of steam. */
  function drawBossAura(ctx, e, R) {
    var x = e.x;
    var y = e.y;
    var r = e.r * BOSS_LOOK;
    var t = R.t + e.wob;
    var rage = e.hp < e.maxHp * 0.5;
    var tone = rage ? "#E5484D" : (e.look && e.look.accent) || "#F2B93B";
    var pulse = 0.75 + 0.25 * Math.sin(t * (rage ? 7 : 3));
    var hi = B.quality === undefined || B.quality >= 1; // low quality skips the glow and steam

    if (hi) {
      ctx.globalCompositeOperation = "lighter";
      var glow = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.3);
      glow.addColorStop(0, B.rgba(tone, 0.32 * pulse));
      glow.addColorStop(1, B.rgba(tone, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.3, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }

    // a crown of spikes, turning, that points outward like a warning
    var spikes = 14;
    var turn = t * (rage ? 0.9 : 0.35);
    ctx.fillStyle = "rgba(20,14,12,0.55)";
    ctx.strokeStyle = B.rgba(tone, 0.75);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var i = 0; i < spikes; i++) {
      var a = turn + (i / spikes) * TAU;
      var inner = r * 1.08;
      var outer = r * (1.3 + (i % 2) * 0.12) + Math.sin(t * 4 + i) * 2;
      ctx.moveTo(x + Math.cos(a - 0.12) * inner, y + Math.sin(a - 0.12) * inner);
      ctx.lineTo(x + Math.cos(a) * outer, y + Math.sin(a) * outer);
      ctx.lineTo(x + Math.cos(a + 0.12) * inner, y + Math.sin(a + 0.12) * inner);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();

    // a dashed ring just outside the spikes, turning the other way
    ctx.strokeStyle = B.rgba(tone, 0.4 * pulse);
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 12]);
    ctx.lineDashOffset = -t * 30;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.55, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    if (rage && hi) {
      // steam rising off it
      for (var s = 0; s < 6; s++) {
        var k = ((t * 0.8 + s / 6) % 1);
        var sx = x + Math.sin(s * 2.1 + t) * r * 0.6;
        var sy = y - r * 0.6 - k * r * 1.3;
        ctx.fillStyle = "rgba(255,200,190," + (0.22 * (1 - k)).toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(sx, sy, 5 + k * 10, 0, TAU);
        ctx.fill();
      }
    }
  }

  /** A worm underground: a mound of earth that moves, with clods tumbling off it. */
  function drawMound(ctx, e, R, x, y, r) {
    var t = R.t;
    ctx.fillStyle = "#4A3420";
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.25, r * 0.95, r * 0.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#6E5032";
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.1, r * 0.75, r * 0.38, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#8C6A44";
    for (var i = 0; i < 8; i++) {
      var a = i * 0.8 + t * 4;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.25 + r * 0.05, 6, 4, a, 0, TAU);
      ctx.fill();
    }
    drawStatus(ctx, e, x, y, r);
  }

  function drawBoss(ctx, e, R, nx, ny, body) {
    var x = e.x;
    var y = e.y;
    var r = e.r;
    var t = R.t;
    var i;
    var angle;
    var dark = "rgba(41,38,31,0.35)";
    var L = e.look;
    var dk = L ? L.dark : "#4E7A3A";
    var dkHornet = L ? L.dark : "#3A2A10";

    // a beetle in mid-leap is drawn up off the ground; its shadow stays below
    var air = e.lift || 0;
    ctx.fillStyle = "rgba(0,0,0," + (0.25 - air * 0.1).toFixed(3) + ")";
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.85, r * 0.95 * (1 - air * 0.3), r * 0.28 * (1 - air * 0.3), 0, 0, TAU);
    ctx.fill();
    y -= air * 55;

    if (e.under) {
      drawMound(ctx, e, R, x, y, r);
      return;
    }

    if (L) lookBehind(ctx, L, x, y, r, t);

    if (e.kind === "queen") {
      // a fat abdomen behind, feelers on top
      ctx.fillStyle = body;
      B.ball(ctx, x - nx * r * 0.75, y - ny * r * 0.75, r * 0.85);
      B.ball(ctx, x, y, r);
      ctx.strokeStyle = dk;
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
      ctx.fillStyle = dkHornet;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * (r + 16), y + Math.sin(angle) * (r + 16));
      ctx.lineTo(x + Math.cos(angle + 0.32) * r * 0.95, y + Math.sin(angle + 0.32) * r * 0.95);
      ctx.lineTo(x + Math.cos(angle - 0.32) * r * 0.95, y + Math.sin(angle - 0.32) * r * 0.95);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = e.mode === 3 ? "#F3D58C" : body;
      B.ball(ctx, x, y, r);
      // stripes, kept inside the body
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.clip();
      ctx.fillStyle = dkHornet;
      ctx.fillRect(x - r, y + r * 0.18, r * 2, r * 0.24);
      ctx.fillRect(x - r, y + r * 0.6, r * 2, r * 0.24);
      ctx.restore();
    } else if (e.kind === "slug") {
      ctx.fillStyle = body;
      ctx.save();
      ctx.translate(x - nx * r * 0.5, y - ny * r * 0.5 + r * 0.15);
      ctx.rotate(Math.atan2(ny, nx));
      ctx.scale(1.25, 0.8);
      B.ball(ctx, 0, 0, r);
      ctx.restore();
      B.ball(ctx, x, y, r * 0.9);
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
    } else if (e.kind === "beetle") {
      // six legs that step in turn, a curved horn, and a hard shell in two halves
      ctx.strokeStyle = dk;
      ctx.lineWidth = Math.max(4, r * 0.12);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (i = 0; i < 3; i++) {
        for (var bs = -1; bs <= 1; bs += 2) {
          var step = Math.sin(t * 7 + i * 2.1 + (bs > 0 ? Math.PI : 0)) * r * 0.08 * (e.lift ? 0 : 1);
          var ly = y - r * 0.35 + i * r * 0.42;
          ctx.beginPath();
          ctx.moveTo(x + bs * r * 0.7, ly);
          ctx.lineTo(x + bs * r * 1.18, ly + r * 0.12 + step);
          ctx.lineTo(x + bs * r * 1.32, ly + r * 0.5 + step);
          ctx.stroke();
        }
      }
      ctx.fillStyle = dk;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.2, y - r * 0.72);
      ctx.quadraticCurveTo(x - r * 0.12, y - r * 1.5, x + r * 0.42, y - r * 1.62);
      ctx.quadraticCurveTo(x + r * 0.06, y - r * 1.2, x + r * 0.2, y - r * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = body;
      B.ball(ctx, x, y, r);
      ctx.strokeStyle = "rgba(20,14,10,0.45)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y - r * 0.5);
      ctx.lineTo(x, y + r * 0.96);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.beginPath();
      ctx.ellipse(x - r * 0.45, y + r * 0.18, r * 0.16, r * 0.42, 0.15, 0, TAU);
      ctx.ellipse(x + r * 0.45, y + r * 0.18, r * 0.16, r * 0.42, -0.15, 0, TAU);
      ctx.fill();
      ctx.fillStyle = dk;
      ctx.beginPath();
      ctx.ellipse(x, y - r * 0.5, r * 0.6, r * 0.34, 0, Math.PI, TAU);
      ctx.fill();
    } else if (e.kind === "spider") {
      // a round abdomen behind, eight jointed legs, a body with fangs and six red eyes
      ctx.fillStyle = body;
      B.ball(ctx, x - nx * r * 0.85, y - ny * r * 0.85 - r * 0.1, r * 0.95);
      if (L) {
        ctx.fillStyle = L.accent;
        ctx.beginPath();
        var hx = x - nx * r * 0.85;
        var hy = y - ny * r * 0.85 - r * 0.1;
        ctx.moveTo(hx - r * 0.18, hy - r * 0.3);
        ctx.lineTo(hx + r * 0.18, hy - r * 0.3);
        ctx.lineTo(hx - r * 0.18, hy + r * 0.3);
        ctx.lineTo(hx + r * 0.18, hy + r * 0.3);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = dk;
      ctx.lineWidth = Math.max(3, r * 0.09);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (var sideS = -1; sideS <= 1; sideS += 2) {
        for (i = 0; i < 4; i++) {
          var la = (sideS > 0 ? 0 : Math.PI) + sideS * (i - 1.5) * 0.42;
          var lift = Math.sin(t * 8 + i * 1.7 + (sideS > 0 ? 0 : 1.3)) * r * 0.1;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(la) * r * 0.55, y + Math.sin(la) * r * 0.45);
          ctx.lineTo(x + Math.cos(la) * r * 1.3, y + Math.sin(la) * r * 0.9 - r * 0.55 + lift);
          ctx.lineTo(x + Math.cos(la) * r * 1.85, y + Math.sin(la) * r * 1.35 + r * 0.25 + lift);
          ctx.stroke();
        }
      }
      ctx.fillStyle = body;
      B.ball(ctx, x, y, r * 0.82);
      ctx.fillStyle = "#2A1A14";
      ctx.beginPath();
      ctx.moveTo(x - r * 0.28, y + r * 0.45);
      ctx.lineTo(x - r * 0.16, y + r * 0.82);
      ctx.lineTo(x - r * 0.06, y + r * 0.48);
      ctx.moveTo(x + r * 0.28, y + r * 0.45);
      ctx.lineTo(x + r * 0.16, y + r * 0.82);
      ctx.lineTo(x + r * 0.06, y + r * 0.48);
      ctx.fill();
      var spiderEyes = [[-0.3, -0.12, 0.13], [0.3, -0.12, 0.13], [-0.14, -0.3, 0.09], [0.14, -0.3, 0.09], [-0.45, 0.06, 0.08], [0.45, 0.06, 0.08]];
      for (i = 0; i < spiderEyes.length; i++) {
        var se = spiderEyes[i];
        ctx.fillStyle = "#E5484D";
        circle(ctx, x + se[0] * r, y + se[1] * r, se[2] * r);
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        circle(ctx, x + se[0] * r - se[2] * r * 0.3, y + se[1] * r - se[2] * r * 0.3, se[2] * r * 0.35);
      }
    } else if (e.kind === "worm") {
      // segments along the path the head took, smaller toward the tail
      var trail = e.trail || [];
      for (i = trail.length - 1; i >= 0; i--) {
        var seg = trail[i];
        var sr = r * Math.max(0.35, 0.92 - i * 0.08);
        ctx.fillStyle = i % 2 ? e.fill : (L ? L.dark : e.fill); // only the head flashes when hit
        B.ball(ctx, seg.x, seg.y - (e.y - y), sr);
      }
      // two hooked jaws, toward you
      var jawA = Math.atan2(ny, nx);
      ctx.strokeStyle = "#2A1A14";
      ctx.lineWidth = Math.max(4, r * 0.13);
      ctx.lineCap = "round";
      for (var js = -1; js <= 1; js += 2) {
        var open = 0.5 + Math.sin(t * 6) * 0.15;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(jawA + js * 0.5) * r * 0.85, y + Math.sin(jawA + js * 0.5) * r * 0.85);
        ctx.quadraticCurveTo(
          x + Math.cos(jawA + js * open) * r * 1.45, y + Math.sin(jawA + js * open) * r * 1.45,
          x + Math.cos(jawA + js * 0.08) * r * 1.35, y + Math.sin(jawA + js * 0.08) * r * 1.35
        );
        ctx.stroke();
      }
      ctx.fillStyle = body;
      B.ball(ctx, x, y, r);
      ctx.strokeStyle = "rgba(20,14,10,0.3)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y + r * 0.3, r * 0.85, Math.PI * 1.15, Math.PI * 1.85);
      ctx.moveTo(x - r * 0.6, y + r * 0.62);
      ctx.arc(x, y + r * 0.62, r * 0.6, Math.PI, TAU);
      ctx.stroke();
    } else if (e.kind === "moth") {
      // four wings beating, eye-spots on the big ones, a fuzzy body, feathery feelers
      var beat = Math.sin(t * 9);
      for (var ms = -1; ms <= 1; ms += 2) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(ms, 1);
        ctx.fillStyle = L ? L.accent : "#E8DCC0";
        ctx.globalAlpha *= 0.92;
        ctx.beginPath();
        ctx.ellipse(r * 1.05, -r * 0.3, r * 1.05, r * (0.62 + 0.2 * beat), -0.35, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(r * 0.8, r * 0.5, r * 0.62, r * (0.4 + 0.08 * beat), 0.45, 0, TAU);
        ctx.fill();
        ctx.fillStyle = L ? L.dark : "#5A4A38";
        circle(ctx, r * 1.2, -r * 0.35, r * 0.24);
        ctx.fillStyle = body;
        circle(ctx, r * 1.2, -r * 0.35, r * 0.12);
        ctx.restore();
      }
      ctx.fillStyle = body;
      for (i = 0; i < 9; i++) {
        var fa = (i / 9) * TAU;
        B.ball(ctx, x + Math.cos(fa) * r * 0.62, y + Math.sin(fa) * r * 0.62, r * 0.24);
      }
      B.ball(ctx, x, y, r * 0.72);
      ctx.strokeStyle = dk;
      ctx.lineWidth = 2;
      for (var fs = -1; fs <= 1; fs += 2) {
        ctx.beginPath();
        ctx.moveTo(x + fs * r * 0.2, y - r * 0.6);
        ctx.quadraticCurveTo(x + fs * r * 0.45, y - r * 1.25, x + fs * r * 0.75, y - r * 1.4);
        for (var f = 0; f < 4; f++) {
          var fx0 = x + fs * r * (0.3 + f * 0.12);
          var fy0 = y - r * (0.9 + f * 0.13);
          ctx.moveTo(fx0, fy0);
          ctx.lineTo(fx0 + fs * r * 0.14, fy0 - r * 0.02);
        }
        ctx.stroke();
      }
    } else if (e.kind === "fly") {
      // buzzing glassy wings, a striped body and two huge red eyes
      var buzz = Math.sin(t * 60) * r * 0.08;
      ctx.fillStyle = "rgba(220,240,255,0.45)";
      ctx.beginPath();
      ctx.ellipse(x - r * 0.9, y - r * 0.55, r * 0.95, r * 0.38 + buzz, -0.55, 0, TAU);
      ctx.ellipse(x + r * 0.9, y - r * 0.55, r * 0.95, r * 0.38 - buzz, 0.55, 0, TAU);
      ctx.fill();
      ctx.fillStyle = body;
      B.ball(ctx, x, y, r);
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.clip();
      ctx.fillStyle = dk;
      ctx.globalAlpha *= 0.55;
      ctx.fillRect(x - r, y + r * 0.25, r * 2, r * 0.2);
      ctx.fillRect(x - r, y + r * 0.6, r * 2, r * 0.2);
      ctx.restore();
      for (var es = -1; es <= 1; es += 2) {
        ctx.fillStyle = "#C8453E";
        ctx.beginPath();
        ctx.ellipse(x + es * r * 0.42, y - r * 0.2, r * 0.38, r * 0.44, es * 0.2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.28)";
        for (var g = 0; g < 5; g++) circle(ctx, x + es * r * (0.3 + (g % 3) * 0.1), y - r * (0.38 - Math.floor(g / 3) * 0.18), r * 0.05);
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        circle(ctx, x + es * r * 0.32, y - r * 0.4, r * 0.09);
      }
      ctx.strokeStyle = "#2A1A14";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y + r * 0.15);
      ctx.lineTo(x, y + r * 0.55);
      ctx.stroke();
    } else {
      // mould: a fuzzy ball that slowly turns
      ctx.fillStyle = body;
      for (i = 0; i < 14; i++) {
        angle = (i / 14) * TAU + e.spin * 0.4;
        B.ball(ctx, x + Math.cos(angle) * r * 0.86, y + Math.sin(angle) * r * 0.86, r * 0.27 + Math.sin(t * 4 + i) * 1.5);
      }
      B.ball(ctx, x, y, r * 0.92);
      ctx.fillStyle = dark;
      circle(ctx, x - r * 0.45, y + r * 0.35, r * 0.13);
      circle(ctx, x + r * 0.5, y + r * 0.2, r * 0.1);
      circle(ctx, x + r * 0.1, y + r * 0.55, r * 0.08);
    }

    if (L) lookFront(ctx, L, x, y, r, t);

    if (e.kind !== "slug" && e.kind !== "spider" && e.kind !== "fly") eyes(ctx, x, y, r * 0.8, nx * r * 0.1, ny * r * 0.08, true);

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
    // jewels on the points, and a glint across the band
    var jewels = L ? [L.accent, "#E5484D", L.accent] : ["#7FD4F5", "#E5484D", "#7FD4F5"];
    var spots = [[-15, -15], [0, -18], [15, -15]];
    for (i = 0; i < 3; i++) {
      ctx.fillStyle = jewels[i];
      circle(ctx, x + spots[i][0], cy + spots[i][1] + 1, 2.4);
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      circle(ctx, x + spots[i][0] - 0.7, cy + spots[i][1] + 0.2, 0.8);
    }
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillRect(x - 10, cy - 4, 20, 1.6);

    drawStatus(ctx, e, x, y, r);
  }
})();
