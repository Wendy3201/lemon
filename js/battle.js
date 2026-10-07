/*!
 * Pip Survivors — battle engine
 * One run through a chapter: the lemon, its attacks, the swarm, pickups,
 * damage, levelling and drawing. Weapons, pests, upgrades and the on-screen
 * HUD live in their own files and plug into PS.B.
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function () {
  "use strict";

  var PS = window.PS;
  var B = (PS.B = {});
  var P = PS.palette;
  var TAU = Math.PI * 2;
  var DOT = { dot: true };
  var FONT = "'Baloo 2', Nunito, sans-serif";

  var canvas = null;
  var ctx = null;
  var view = (B.view = { w: 640, h: 440, cw: 640, ch: 440, scale: 1, ring: 430 });
  var R = null; // the current run, also reachable as B.run
  var raf = 0;
  var last = 0;
  var keys = Object.create(null);
  var stick = { on: false, touch: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  var calm = false; // reduced motion: no screen shake

  B.run = null;
  B.autopilot = null; // tests can steer with function (run) -> { x, y }

  /* -------------------------------------------------------------- set-up */

  function makePlayer(stats) {
    var fx = {};
    for (var key in stats.fx) fx[key] = stats.fx[key];
    return {
      x: 0, y: 0, r: 13,
      atk: stats.atk, maxHp: stats.hp, hp: stats.hp, baseHp: stats.hp,
      crit: stats.crit, critDmg: stats.critDmg, haste: stats.haste,
      moveSpeed: 150 * (1 + stats.speed), armor: stats.armor, regen: stats.regen,
      reach: 46 * (1 + stats.magnet), xpMul: 1 + stats.xp, luck: stats.luck,
      area: 1 + stats.area, bossDmg: stats.bossDmg,
      fx: fx, // behaviour switches from gear; upgrades add to this copy
      up: {}, // level of each upgrade taken this battle
      mods: { dmg: 1, haste: 0, count: 0, pierce: 0, area: 0, crit: 0, critDmg: 0, speed: 1, armor: 1, regen: 0 },
      level: 1, xp: 0, need: xpNeeded(1),
      aim: 0, moving: false, cd: 0.5, shots: 0, swing: 0,
      flash: 0, spin: 0, invuln: 0, sinceHit: 99, burstCd: 0,
      barrierMax: stats.hp * (fx.barrier || 0), barrier: stats.hp * (fx.barrier || 0),
      revives: fx.revive || 0, rerolls: 1 + (fx.reroll || 0),
      frenzy: 0, frenzyT: 0, lvlAtk: 0, slow: 0,
      timers: {}
    };
  }

  B.mount = function (root) {
    canvas = document.createElement("canvas");
    canvas.className = "battle__canvas";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Battle");
    root.appendChild(canvas);
    ctx = canvas.getContext("2d");
    B.hud.mount(root);
    bindInput();
    window.addEventListener("resize", resize);
  };

  /** mode "swarm" is the dev menu's endless sandbox: no boss, nothing is saved. */
  B.start = function (chapterNumber, mode) {
    var ch = PS.chapter(chapterNumber);
    var stats = PS.state.calc();
    var p = makePlayer(stats);
    p.outfit = B.outfitOf();
    calm = PS.reducedMotion();
    R = B.run = {
      ch: ch, zone: PS.ZONES[ch.zone], weaponId: stats.weapon, weapon: B.WEAPONS[stats.weapon],
      src: stats.weapon, dmgBy: {}, mode: mode === "swarm" ? "swarm" : "normal",
      t: 0, dur: ch.duration, phase: "swarm", over: 0, done: false,
      p: p,
      enemies: [], shots: [], zones: [], ebullets: [], drops: [], sparks: [], texts: [], fx: [], timers: [],
      kills: 0, coins: 0, dealt: 0, coinValue: Math.max(1, Math.round(ch.gold * 0.005)),
      spawnIn: 0.6,
      elites: [ch.duration * 0.35, ch.duration * 0.7],
      hordes: [ch.duration * 0.25, ch.duration * 0.5, ch.duration * 0.75],
      boss: null, reachedBoss: false,
      paused: false, choices: null, pending: p.fx.startUp || 0,
      shake: 0, procs: 0, leeched: 0, hurtWindow: 0, windowT: 0, toast: "", toastT: 0
    };
    keys = Object.create(null);
    stick.on = false;
    resize();
    B.hud.begin(R);
    if (!PS.state.get().stats.runs) B.toast("Move with WASD or drag. The lemon attacks by itself.", 6);
    if (R.pending) openChoices();
    cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(frame);
    return R;
  };

  /** Tear the run down once the results have been read. */
  B.stop = function () {
    cancelAnimationFrame(raf);
    raf = 0;
    R = B.run = null;
  };

  function resize() {
    if (!canvas) return;
    var cw = canvas.clientWidth || window.innerWidth;
    var ch = canvas.clientHeight || window.innerHeight;
    if (!cw || !ch) return;
    // the short side of the screen always shows about the same amount of field
    var s = Math.min(cw, ch) / (cw >= ch ? 500 : 430);
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    view.cw = cw;
    view.ch = ch;
    view.w = cw / s;
    view.h = ch / s;
    view.scale = s * dpr;
    view.css = s;
    view.ring = Math.sqrt(view.w * view.w + view.h * view.h) / 2 + 40;
  }

  /* ---------------------------------------------------------------- loop */

  function frame(now) {
    raf = requestAnimationFrame(frame);
    // a frame's timestamp can be older than the moment a card was picked
    // or the game resumed, so the step is never allowed to run backwards
    var dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    if (!R) return;
    B.step(dt);
    draw();
    B.hud.update(R);
  }

  /** One tick of the simulation. Does nothing while paused or choosing. */
  B.step = function (dt) {
    if (!R || R.paused || R.choices || R.done) return;
    if (R.phase === "won" || R.phase === "lost") {
      R.over -= dt;
      updateDrops(dt, R.phase === "won");
      updateFx(dt);
      sweep();
      if (R.over <= 0) finish();
      return;
    }
    R.t += dt;
    R.procs = 0;
    R.src = R.weaponId;
    updatePlayer(dt);
    B.director(dt);
    updateEnemies(dt);
    updateShots(dt);
    updateZones(dt);
    updateEnemyShots(dt);
    B.updateAbilities(dt);
    runTimers(dt);
    R.src = R.weaponId;
    updateDrops(dt, false);
    updateFx(dt);
    sweep();
    // no cards once the battle has been decided
    if ((R.phase === "swarm" || R.phase === "boss") && R.p.xp >= R.p.need) levelUp();
  };

  /* Every point of damage is credited to a source (the weapon, an upgrade,
     burning...) for the damage meter. R.src is the source in force right now;
     anything that acts later (shots, zones, timers) remembers it. */
  B.as = function (src, fn) {
    var before = R.src;
    R.src = src;
    var result = fn();
    R.src = before;
    return result;
  };

  B.later = function (delay, fn) {
    R.timers.push({ t: delay, fn: fn, src: R.src });
  };

  function runTimers(dt) {
    for (var i = R.timers.length - 1; i >= 0; i--) {
      var timer = R.timers[i];
      timer.t -= dt;
      if (timer.t <= 0) {
        R.timers.splice(i, 1);
        R.src = timer.src;
        timer.fn();
      }
    }
  }

  function sweep() {
    var list = R.enemies;
    var keep = 0;
    for (var i = 0; i < list.length; i++) {
      if (!list[i].dead) list[keep++] = list[i];
    }
    list.length = keep;
  }

  /* -------------------------------------------------------------- player */

  /** Damage of one plain hit, before a weapon's own multiplier. */
  B.dmg = function () {
    var p = R.p;
    var d = p.atk * p.mods.dmg * (1 + p.lvlAtk);
    if (p.fx.movingDmg && p.moving) d *= 1 + p.fx.movingDmg;
    if (R.weaponId === "solstice" && p.fx.q && p.hp > p.maxHp * 0.7) d *= 1.5;
    return d;
  };
  B.area = function () { return R.p.area + R.p.mods.area; };
  B.count = function () { return (R.p.fx.count || 0) + R.p.mods.count; };
  B.pierce = function () { return (R.p.fx.pierce || 0) + R.p.mods.pierce; };
  B.cooldown = function (base) {
    var p = R.p;
    return base / (1 + p.haste + p.mods.haste + p.frenzy * 0.04);
  };

  /** How close a pest has to be before the weapon bothers to attack. */
  function weaponRange() {
    return R.weapon.reach ? R.weapon.reach(R.p) : R.weapon.range;
  }

  /** What the weapon aims at: the nearest pest, except that a boss or elite
   *  in range comes first unless something is about to bite. */
  function pickTarget() {
    var p = R.p;
    var range = weaponRange();
    var near = B.nearest(p.x, p.y, range);
    if (!near || near.boss || near.elite) return near;
    var dx = near.x - p.x;
    var dy = near.y - p.y;
    if (Math.sqrt(dx * dx + dy * dy) - near.r < 60) return near;
    var big = null;
    var bigD = range * range;
    for (var i = 0; i < R.enemies.length; i++) {
      var e = R.enemies[i];
      if (e.dead || !(e.boss || e.elite)) continue;
      dx = e.x - p.x;
      dy = e.y - p.y;
      var d = dx * dx + dy * dy - e.r * e.r;
      if (d < bigD) {
        bigD = d;
        big = e;
      }
    }
    return big || near;
  }

  /** Experience to climb out of `level`: quick at first, then a real climb. */
  function xpNeeded(level) {
    return Math.round(4 + 2.2 * level + 0.62 * level * level);
  }

  function steering() {
    var mx = 0;
    var my = 0;
    var mag = 1;
    if (keys.ArrowLeft || keys.KeyA) mx -= 1;
    if (keys.ArrowRight || keys.KeyD) mx += 1;
    if (keys.ArrowUp || keys.KeyW) my -= 1;
    if (keys.ArrowDown || keys.KeyS) my += 1;
    if (!mx && !my && stick.on) {
      if (stick.touch) {
        // floating thumb-stick: push away from where the finger landed
        mx = stick.x - stick.ox;
        my = stick.y - stick.oy;
        var pull = Math.sqrt(mx * mx + my * my);
        if (pull < 8) mx = my = 0;
        else mag = Math.min(1, pull / 44);
      } else {
        // mouse: head for the held pointer
        mx = stick.x - view.cw / 2;
        my = stick.y - view.ch / 2;
        if (mx * mx + my * my < 196) mx = my = 0;
      }
    }
    if (B.autopilot) {
      var want = B.autopilot(R);
      mx = want.x;
      my = want.y;
      mag = 1;
    }
    var len = Math.sqrt(mx * mx + my * my);
    return len ? { x: mx / len, y: my / len, mag: mag } : null;
  }

  function updatePlayer(dt) {
    var p = R.p;
    var move = steering();
    p.moving = Boolean(move);
    if (move) {
      var speed = p.moveSpeed * p.mods.speed * move.mag * (1 - p.slow);
      p.x += move.x * speed * dt;
      p.y += move.y * speed * dt;
    }
    p.slow = 0;
    p.flash = Math.max(0, p.flash - dt);
    p.swing = Math.max(0, p.swing - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.burstCd = Math.max(0, p.burstCd - dt);
    p.spin += dt * 3.2;
    p.sinceHit += dt;

    var regen = p.regen + p.mods.regen;
    if (regen && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * regen * dt);
    if (p.barrierMax && p.sinceHit > 6 && p.barrier < p.barrierMax) {
      p.barrier = Math.min(p.barrierMax, p.barrier + p.barrierMax * dt);
    }
    if (p.frenzy) {
      p.frenzyT -= dt;
      if (p.frenzyT <= 0) p.frenzy = 0;
    }
    R.windowT += dt;
    if (R.windowT >= 1) {
      R.windowT = 0;
      R.hurtWindow = 0;
      R.leeched = 0;
    }

    p.cd -= dt;
    if (p.cd <= 0) {
      var target = pickTarget();
      if (target) {
        attack(target);
        p.cd = B.cooldown(R.weapon.cd);
      } else {
        p.cd = 0.1;
      }
    }
    if (R.weapon.tick) R.weapon.tick(dt);
  }

  function attack(target) {
    var p = R.p;
    p.aim = Math.atan2(target.y - p.y, target.x - p.x);
    p.shots++;
    PS.sfx.play("shoot");
    p.swing = 0.2;
    var empowered = p.fx.emp > 0 && p.shots % p.fx.emp === 0;
    R.weapon.attack(p.aim, target, empowered, 1);
    if (p.fx.echo) {
      B.later(0.16, function () {
        var again = pickTarget();
        if (again) R.weapon.attack(Math.atan2(again.y - p.y, again.x - p.x), again, false, Math.min(1, p.fx.echo));
      });
    }
  }

  /** Hurt the lemon. `amount` is raw damage; armour and shields come off here. */
  B.hurt = function (amount) {
    var p = R.p;
    if (p.invuln > 0 || R.phase === "won" || R.phase === "lost") return;
    var dmg = amount * (1 - p.armor) * p.mods.armor;
    if (p.fx.lastStand && p.hp < p.maxHp * 0.35) dmg *= 1 - p.fx.lastStand;
    if (p.fx.dmgCap) {
      var room = p.maxHp * p.fx.dmgCap - R.hurtWindow;
      if (room <= 0) return;
      if (dmg > room) dmg = room;
      R.hurtWindow += dmg;
    }
    p.sinceHit = 0;
    if (p.barrier > 0) {
      var soaked = Math.min(p.barrier, dmg);
      p.barrier -= soaked;
      dmg -= soaked;
      if (p.barrier <= 0 && p.fx.barrierNova) {
        B.as("gear", function () { B.blast(p.x, p.y, 120 * B.area(), B.dmg() * 2.5, { knock: 450, color: "#FFE66D" }); });
      }
    }
    if (dmg <= 0) return;
    p.hp -= dmg;
    p.flash = 0.1;
    PS.sfx.play("hurt");

    var burst = (p.up.burst || 0) + (p.fx.thornBurst ? 2 : 0);
    if (burst && p.burstCd <= 0) {
      p.burstCd = Math.max(1.5, 4.2 - 0.45 * burst);
      B.as("burst", function () { B.blast(p.x, p.y, 100 * B.area(), B.dmg() * (1.6 + 0.45 * burst), { knock: 420, color: "#8FAE65" }); });
    }

    if (p.hp <= 0) {
      if (p.revives > 0) {
        p.revives--;
        p.hp = p.maxHp * 0.5;
        p.invuln = 2;
        B.as("gear", function () { B.blast(p.x, p.y, 150, p.fx.reviveNova ? B.dmg() * 8 : 0, { knock: 600, color: "#FFF4B8" }); });
        PS.sfx.play("revive");
        B.text(p.x, p.y - 26, "Second wind!", "#FFE66D", 16);
        B.toast("Back on your feet!");
      } else {
        p.hp = 0;
        R.phase = "lost";
        PS.sfx.play("lose");
        R.over = 1.1;
        burstSparks(p.x, p.y, P.lemon, 18, 150);
      }
    }
  };

  B.heal = function (amount) {
    var p = R.p;
    p.hp = Math.min(p.maxHp, p.hp + amount);
  };

  function levelUp() {
    var p = R.p;
    while (p.xp >= p.need) {
      p.xp -= p.need;
      p.level++;
      p.need = xpNeeded(p.level);
      R.pending++;
      if (p.fx.levelAtk) {
        p.lvlAtk += p.fx.levelAtk;
        B.heal(p.maxHp * 0.1);
      }
    }
    if (!R.choices) openChoices();
  }

  function openChoices() {
    R.pending--;
    R.choices = B.rollChoices();
    PS.sfx.play("levelup");
    stick.on = false;
    B.hud.choices(R);
  }

  B.choose = function (index) {
    if (!R || !R.choices || !R.choices[index]) return;
    PS.sfx.play("pick");
    B.takeUpgrade(R.choices[index]);
    R.choices = null;
    if (R.pending > 0) openChoices();
    else B.hud.choices(R);
    last = performance.now();
  };

  B.reroll = function () {
    if (!R || !R.choices || R.p.rerolls <= 0) return;
    R.p.rerolls--;
    R.choices = B.rollChoices();
    B.hud.choices(R);
  };

  B.pause = function () {
    if (!R || R.paused || R.done || R.phase === "won" || R.phase === "lost") return;
    R.paused = true;
    stick.on = false;
    B.hud.paused(R);
  };

  B.resume = function () {
    if (!R || !R.paused) return;
    R.paused = false;
    last = performance.now();
    B.hud.paused(R);
  };

  /** Walk away from a battle: it counts as a loss at the time reached. */
  B.giveUp = function () {
    if (!R || R.done) return;
    R.paused = false;
    R.choices = null;
    B.hud.paused(R);
    B.hud.choices(R);
    R.phase = "lost";
    R.over = 0;
    finish();
  };

  function finish() {
    if (R.done) return;
    R.done = true;
    var result;
    if (R.mode === "swarm") {
      // a sandbox run: gold only, no gear, no progress, no records
      result = {
        swarm: true, chapter: R.ch.n, won: false, time: R.t, kills: R.kills, level: R.p.level, items: [], gems: 0, unlocked: 0,
        gold: PS.state.paySwarm(R.ch.n, R.t, R.coins)
      };
    } else {
      result = PS.state.finishRun({
        chapter: R.ch.n,
        won: R.phase === "won",
        time: R.t,
        kills: R.kills,
        level: R.p.level,
        coins: R.coins,
        boss: R.reachedBoss
      });
    }
    result.dealt = R.dealt;
    PS.emit("battle:end", result);
  }

  B.win = function () {
    if (R.phase === "won" || R.phase === "lost") return;
    R.phase = "won";
    PS.sfx.play("win");
    R.over = 1.6;
    R.ebullets.length = 0;
    for (var i = 0; i < R.enemies.length; i++) {
      var e = R.enemies[i];
      if (!e.dead) {
        e.dead = true;
        burstSparks(e.x, e.y, e.fill, 4, 90);
      }
    }
  };

  /* ------------------------------------------------------------- targets */

  /** Closest living pest to a point, optionally ignoring a list. */
  B.nearest = function (x, y, maxDist, ignore) {
    var best = null;
    var bestD = maxDist * maxDist;
    var list = R.enemies;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.dead || (ignore && ignore.indexOf(e) !== -1)) continue;
      var dx = e.x - x;
      var dy = e.y - y;
      var d = dx * dx + dy * dy - e.r * e.r;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  };

  /** A pest in range that has plenty of friends around it: where to drop
   *  something that hits an area. */
  B.cluster = function (range, spread, ignore) {
    var p = R.p;
    var list = R.enemies;
    var best = null;
    var bestN = -1;
    var tries = Math.min(10, list.length);
    for (var t = 0; t < tries; t++) {
      var e = list[Math.floor(Math.random() * list.length)];
      if (e.dead || (ignore && ignore.indexOf(e) !== -1)) continue;
      var dx = e.x - p.x;
      var dy = e.y - p.y;
      if (dx * dx + dy * dy > range * range) continue;
      var n = e.boss ? 6 : 0;
      for (var i = 0; i < list.length; i++) {
        var ox = list[i].x - e.x;
        var oy = list[i].y - e.y;
        if (ox * ox + oy * oy < spread * spread) n++;
      }
      if (n > bestN) {
        bestN = n;
        best = e;
      }
    }
    return best || B.nearest(p.x, p.y, range, ignore);
  };

  B.randomNear = function (range) {
    var p = R.p;
    var list = R.enemies;
    for (var t = 0; t < 8 && list.length; t++) {
      var e = list[Math.floor(Math.random() * list.length)];
      var dx = e.x - p.x;
      var dy = e.y - p.y;
      if (!e.dead && dx * dx + dy * dy < range * range) return e;
    }
    return B.nearest(p.x, p.y, range);
  };

  /* -------------------------------------------------------------- damage */

  function applyStatus(e, fx) {
    if (fx.burn) {
      var dps = B.dmg() * fx.burn * (1 + (fx.burnAmp || 0));
      if (dps > e.burnDps || e.burnT <= 0) e.burnDps = dps;
      e.burnT = 3;
    }
    if (fx.chill) {
      if (fx.freeze && e.chillT > 0 && !e.boss && e.freezeCd <= 0) {
        e.stun = Math.max(e.stun, 1);
        e.freezeCd = 4;
      }
      e.chillT = 2.5;
      e.chillAmt = Math.min(0.7, fx.chill) * (e.boss ? 0.5 : 1);
    }
    if (fx.shock) {
      e.shockT = 3;
      e.shockAmp = fx.shock;
    }
  }

  /** Damage one pest. Returns 0 if nothing happened, otherwise bit flags:
   *  1 hit · 2 critical · 4 killed.
   *  opts: dot (no crit, no number, no status) · knock + sx/sy (push away
   *  from a point, default the lemon) · stun (seconds). */
  B.hit = function (e, amount, opts) {
    if (e.dead || !(amount > 0)) return 0;
    var p = R.p;
    var fx = p.fx;
    var dot = opts && opts.dot;
    var dmg = amount;
    var flags = 1;
    if (!dot && Math.random() < p.crit + p.mods.crit) {
      dmg *= p.critDmg + p.mods.critDmg;
      flags |= 2;
    }
    if (e.shockT > 0) dmg *= 1 + e.shockAmp;
    if (fx.chillAmp && e.chillT > 0) dmg *= 1 + fx.chillAmp;
    if (p.bossDmg && (e.boss || e.elite)) dmg *= 1 + p.bossDmg;
    // a boss tires: the longer the fight drags on, the more each hit hurts it,
    // so a weak build gets a long fight rather than an endless one
    if (e.boss) dmg *= 1 + (e.age / 25) * (e.age / 25);
    var done = Math.min(dmg, Math.max(0, e.hp));
    R.dmgBy[R.src] = (R.dmgBy[R.src] || 0) + done;
    e.hp -= dmg;
    R.dealt += dmg;

    if (!dot) {
      PS.sfx.play("hit");
      e.flash = 0.09;
      applyStatus(e, fx);
      if (opts && opts.knock && !e.boss) {
        var sx = opts.sx === undefined ? p.x : opts.sx;
        var sy = opts.sy === undefined ? p.y : opts.sy;
        var kx = e.x - sx;
        var ky = e.y - sy;
        var kd = Math.sqrt(kx * kx + ky * ky) || 1;
        e.kx += (kx / kd) * opts.knock / e.mass;
        e.ky += (ky / kd) * opts.knock / e.mass;
      }
      if (opts && opts.stun && !e.boss) e.stun = Math.max(e.stun, opts.stun);
      if (R.texts.length < 40) {
        B.text(e.x, e.y - e.r, PS.fmt(Math.max(1, Math.round(dmg))), flags & 2 ? "#FFE66D" : "#FFFCF2", flags & 2 ? 15 : 11);
      }
    }
    if (fx.execute && !e.boss && !e.elite && e.hp > 0 && e.hp < e.maxHp * Math.min(0.3, fx.execute)) e.hp = 0;
    if (e.hp <= 0) {
      kill(e);
      flags |= 4;
    }
    return flags;
  };

  function kill(e) {
    var p = R.p;
    var fx = p.fx;
    e.dead = true;
    R.kills++;
    PS.sfx.play("kill");
    dropLoot(e);
    burstSparks(e.x, e.y, e.fill, e.boss ? 40 : e.elite ? 14 : 5, e.boss ? 220 : 90);

    // on-death effects go off a beat later, so chain reactions read as chains
    if (R.procs < 14) {
      var x = e.x;
      var y = e.y;
      var base = B.dmg();
      var area = B.area();
      if (fx.boom) {
        R.procs++;
        B.as("boom", function () { B.later(0.07, function () { B.blast(x, y, 52 * area, base * fx.boom, { color: "#F7D94C", quiet: true }); }); });
      }
      if (fx.burnBoom && e.burnT > 0) {
        R.procs++;
        B.as("boom", function () { B.later(0.07, function () { B.blast(x, y, 58 * area, base * fx.burnBoom, { color: "#F26B2A", quiet: true }); }); });
      }
      if (fx.shatter && e.chillT > 0) {
        R.procs++;
        B.as("boom", function () { B.later(0.07, function () { B.blast(x, y, 60 * area, base * fx.shatter, { color: "#7FD4F5", quiet: true }); }); });
      }
      if (R.weaponId === "storm" && fx.q && e.shockT > 0) {
        R.procs++;
        B.as(R.weaponId, function () { B.later(0.07, function () { B.chain(x, y, null, base * 0.6, 3, 140 * area); }); });
      }
    }
    if (fx.leech) {
      var heal = Math.min(p.maxHp * fx.leech, p.maxHp * 0.03 - R.leeched);
      if (heal > 0) {
        R.leeched += heal;
        B.heal(heal);
      }
    }
    if (R.weaponId === "daggers" && fx.q) {
      p.frenzy = Math.min(15, p.frenzy + 1);
      p.frenzyT = 4;
    }
    if (R.weaponId === "eclipse" && fx.q && !e.boss) {
      for (var i = 0; i < R.zones.length; i++) {
        var zone = R.zones[i];
        if (zone.type !== "vortex") continue;
        var dx = e.x - zone.x;
        var dy = e.y - zone.y;
        if (dx * dx + dy * dy < zone.r * zone.r * 1.6) zone.fed = Math.min(20, zone.fed + 1);
      }
    }
    if (e.onDeath) e.onDeath(e);
  }

  /** Melee swings knock enemy shots out of the air. `inside(dx, dy)` says
   *  whether a point, relative to the lemon, is within the swing. */
  function swat(inside) {
    var p = R.p;
    for (var i = R.ebullets.length - 1; i >= 0; i--) {
      var b = R.ebullets[i];
      if (!inside(b.x - p.x, b.y - p.y)) continue;
      burstSparks(b.x, b.y, b.color || "#E5484D", 3, 70);
      R.ebullets.splice(i, 1);
    }
  }

  /** Hit everything inside a circle. opts: knock, stun, color, quiet, swat. */
  B.blast = function (x, y, r, dmg, opts) {
    opts = opts || {};
    var hitOpts = opts.knock || opts.stun ? { knock: opts.knock, sx: x, sy: y, stun: opts.stun } : null;
    var list = R.enemies;
    var count = 0;
    for (var i = 0, n = list.length; i < n; i++) {
      var e = list[i];
      if (e.dead) continue;
      var dx = e.x - x;
      var dy = e.y - y;
      var reach = r + e.r;
      if (dx * dx + dy * dy < reach * reach && B.hit(e, dmg, hitOpts)) count++;
    }
    if (opts.swat) swat(function (bx, by) { return bx * bx + by * by < r * r; });
    R.fx.push({ type: "blast", x: x, y: y, r: r, color: opts.color || "#FFE66D", t: 0, dur: 0.3 });
    if (!opts.quiet) {
      R.shake = Math.max(R.shake, Math.min(7, r / 28));
      PS.sfx.play("boom");
    }
    return count;
  };

  /** A melee arc centred on the lemon. half = half the arc in radians. */
  B.sweep = function (aim, half, reach, dmg, opts) {
    var p = R.p;
    var list = R.enemies;
    var count = 0;
    for (var i = 0, n = list.length; i < n; i++) {
      var e = list[i];
      if (e.dead) continue;
      var dx = e.x - p.x;
      var dy = e.y - p.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > reach + e.r) continue;
      if (half < Math.PI && d > e.r) {
        var off = Math.abs(PS.angleDiff(aim, Math.atan2(dy, dx)));
        if (off > half + Math.asin(Math.min(1, e.r / d))) continue;
      }
      if (B.hit(e, dmg, opts)) count++;
    }
    swat(function (bx, by) {
      return bx * bx + by * by < reach * reach && (half >= Math.PI || Math.abs(PS.angleDiff(aim, Math.atan2(by, bx))) < half);
    });
    R.fx.push({ type: "arc", angle: aim, half: half, r: reach, color: (opts && opts.color) || "#FFFCF2", t: 0, dur: 0.22 });
    return count;
  };

  /** A straight stab out from the lemon. */
  B.thrust = function (aim, length, width, dmg, opts) {
    var p = R.p;
    var cos = Math.cos(aim);
    var sin = Math.sin(aim);
    var list = R.enemies;
    var count = 0;
    for (var i = 0, n = list.length; i < n; i++) {
      var e = list[i];
      if (e.dead) continue;
      var dx = e.x - p.x;
      var dy = e.y - p.y;
      var along = dx * cos + dy * sin;
      var across = dy * cos - dx * sin;
      if (along > -e.r && along < length + e.r && Math.abs(across) < width / 2 + e.r && B.hit(e, dmg, opts)) count++;
    }
    swat(function (bx, by) {
      var along = bx * cos + by * sin;
      return along > 0 && along < length && Math.abs(by * cos - bx * sin) < width / 2 + 5;
    });
    R.fx.push({ type: "stab", angle: aim, len: length, width: width, color: (opts && opts.color) || "#FFFCF2", t: 0, dur: 0.2 });
    return count;
  };

  /** Lightning that hops between pests. `first` may be null to start with
   *  whatever is nearest to (x, y). */
  B.chain = function (x, y, first, dmg, hits, range, ignore) {
    var seen = ignore ? ignore.slice() : [];
    var points = [x, y];
    var target = first || B.nearest(x, y, range, seen);
    var power = dmg;
    while (target && hits-- > 0) {
      seen.push(target);
      points.push(target.x, target.y);
      B.hit(target, power, null);
      power *= 0.88;
      target = B.nearest(target.x, target.y, range, seen);
    }
    if (points.length > 2) PS.sfx.play("zap");
    if (points.length > 2) R.fx.push({ type: "bolt", pts: points, t: 0, dur: 0.22, seed: Math.random() * 1000 });
    return seen;
  };

  /** Launch a projectile. See updateShots for what the fields do. */
  B.shoot = function (o) {
    var p = R.p;
    var shot = {
      x: o.x === undefined ? p.x : o.x,
      y: o.y === undefined ? p.y : o.y,
      vx: Math.cos(o.angle) * o.speed,
      vy: Math.sin(o.angle) * o.speed,
      speed: o.speed,
      r: o.r || 5,
      life: o.range / o.speed,
      age: 0,
      dmg: o.dmg,
      pierce: o.pierce || 0,
      bounce: o.bounce === undefined ? p.fx.ricochet || 0 : o.bounce,
      seen: [],
      sprite: o.sprite || "pip",
      color: o.color || P.bright,
      knock: o.knock || 0,
      blast: o.blast || 0,
      blastDmg: o.blastDmg || 0,
      homing: o.homing || 0,
      rang: o.rang || null,
      onHit: o.onHit || null,
      onEnd: o.onEnd || null,
      src: R.src,
      spin: o.spin || 0,
      rot: 0
    };
    R.shots.push(shot);
    return shot;
  };

  function turnToward(shot, tx, ty) {
    var dx = tx - shot.x;
    var dy = ty - shot.y;
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    shot.vx = (dx / d) * shot.speed;
    shot.vy = (dy / d) * shot.speed;
  }

  function updateShots(dt) {
    var p = R.p;
    var enemies = R.enemies;
    for (var i = R.shots.length - 1; i >= 0; i--) {
      var s = R.shots[i];
      R.src = s.src;
      var spent = false;

      if (s.rang) {
        // boomerang: out for a set distance, then home to the lemon
        var rang = s.rang;
        if (rang.out) {
          rang.gone += s.speed * dt;
          if (rang.gone >= rang.dist) {
            rang.out = false;
            s.seen.length = 0;
          }
        } else {
          turnToward(s, p.x, p.y);
          var bx = p.x - s.x;
          var by = p.y - s.y;
          if (bx * bx + by * by < 18 * 18) {
            if (rang.trips > 1) {
              rang.trips--;
              rang.out = true;
              rang.gone = 0;
              s.seen.length = 0;
              var next = B.nearest(p.x, p.y, 420);
              var angle = next ? Math.atan2(next.y - p.y, next.x - p.x) : Math.random() * TAU;
              s.vx = Math.cos(angle) * s.speed;
              s.vy = Math.sin(angle) * s.speed;
            } else {
              spent = true;
            }
          }
        }
        s.life = 1;
      } else if (s.homing) {
        var prey = B.nearest(s.x, s.y, 260, s.seen);
        if (prey) {
          var want = Math.atan2(prey.y - s.y, prey.x - s.x);
          var now = Math.atan2(s.vy, s.vx);
          var turned = now + PS.clamp(PS.angleDiff(now, want), -s.homing * dt, s.homing * dt);
          s.vx = Math.cos(turned) * s.speed;
          s.vy = Math.sin(turned) * s.speed;
        }
      }

      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      s.age += dt;
      s.rot += s.spin * dt;
      if (s.life <= 0) spent = true;

      for (var j = 0, n = enemies.length; j < n && !spent; j++) {
        var e = enemies[j];
        if (e.dead || s.seen.indexOf(e) !== -1) continue;
        var dx = e.x - s.x;
        var dy = e.y - s.y;
        var reach = e.r + s.r;
        if (dx * dx + dy * dy >= reach * reach) continue;

        s.seen.push(e);
        var flags = B.hit(e, s.dmg, s.knock ? { knock: s.knock, sx: s.x - s.vx, sy: s.y - s.vy } : null);
        if (s.onHit) s.onHit(s, e, flags);
        if (s.blast) {
          spent = true;
        } else if (s.pierce-- <= 0) {
          var onward = s.bounce > 0 ? B.nearest(s.x, s.y, 240, s.seen) : null;
          if (onward) {
            s.bounce--;
            s.pierce = 0;
            turnToward(s, onward.x, onward.y);
            s.life = Math.max(s.life, 0.6);
          } else {
            spent = true;
          }
        }
      }

      if (spent) {
        if (s.blast) B.blast(s.x, s.y, s.blast, s.blastDmg, { color: s.color });
        if (s.onEnd) s.onEnd(s);
        R.shots.splice(i, 1);
      }
    }
    R.src = R.weaponId;
  }

  /* --------------------------------------------------------------- zones */
  /* Things that sit on the ground for a while: fire, black holes, slime,
     and the warning circles before a boss attack lands. */

  B.addZone = function (zone) {
    zone.t = 0;
    zone.acc = 0;
    zone.src = R.src;
    R.zones.push(zone);
    return zone;
  };

  function updateZones(dt) {
    var p = R.p;
    var enemies = R.enemies;
    for (var i = R.zones.length - 1; i >= 0; i--) {
      var z = R.zones[i];
      R.src = z.src || R.weaponId;
      z.t += dt;
      z.acc += dt;
      var dx;
      var dy;
      var j;
      var e;

      if (z.type === "fire") {
        if (z.acc >= 0.25) {
          z.acc -= 0.25;
          for (j = 0; j < enemies.length; j++) {
            e = enemies[j];
            dx = e.x - z.x;
            dy = e.y - z.y;
            if (!e.dead && dx * dx + dy * dy < (z.r + e.r) * (z.r + e.r)) B.hit(e, z.dps * 0.25, DOT);
          }
        }
      } else if (z.type === "vortex") {
        var tick = z.acc >= 0.25;
        if (tick) z.acc -= 0.25;
        for (j = 0; j < enemies.length; j++) {
          e = enemies[j];
          if (e.dead) continue;
          dx = z.x - e.x;
          dy = z.y - e.y;
          var d = Math.sqrt(dx * dx + dy * dy) || 1;
          if (d > z.r * 1.3 + e.r) continue;
          if (!e.boss && d > 6) {
            var pull = (z.pull / e.mass) * dt;
            e.x += (dx / d) * Math.min(pull, d);
            e.y += (dy / d) * Math.min(pull, d);
          }
          if (tick && d < z.r + e.r) B.hit(e, z.tickDmg, null);
        }
      } else if (z.type === "puddle") {
        dx = p.x - z.x;
        dy = p.y - z.y;
        if (dx * dx + dy * dy < z.r * z.r) {
          B.hurt(z.dps * dt);
          p.slow = Math.max(p.slow, z.slow || 0);
        }
      } else if (z.type === "warn") {
        // nothing until it lands
      }

      if (z.t >= z.life) {
        R.zones.splice(i, 1);
        if (z.onEnd) z.onEnd(z);
      }
    }
    R.src = R.weaponId;
  }

  function updateEnemyShots(dt) {
    var p = R.p;
    for (var i = R.ebullets.length - 1; i >= 0; i--) {
      var b = R.ebullets[i];
      // a hit can set off a burst that fells the boss, which clears every shot
      if (!b) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      var dx = p.x - b.x;
      var dy = p.y - b.y;
      var reach = b.r + p.r - 3;
      if (dx * dx + dy * dy < reach * reach) {
        B.hurt(b.dmg);
        b.life = 0;
      }
      if (b.life <= 0) R.ebullets.splice(i, 1);
    }
  }

  /* -------------------------------------------------------------- pests */

  function updateEnemies(dt) {
    var p = R.p;
    var list = R.enemies;
    var thorns = p.fx.thorns ? B.dmg() * p.fx.thorns * dt : 0;
    var far = view.ring + 330;
    var decay = Math.exp(-7 * dt);

    for (var i = 0, n = list.length; i < n; i++) {
      var e = list[i];
      if (e.dead) continue;
      var dx = p.x - e.x;
      var dy = p.y - e.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;

      if (d > far && !e.boss) {
        // left far behind: bring it back round to the edge of the screen
        var angle = Math.random() * TAU;
        e.x = p.x + Math.cos(angle) * view.ring;
        e.y = p.y + Math.sin(angle) * view.ring;
        continue;
      }

      e.flash = Math.max(0, e.flash - dt);
      e.freezeCd = Math.max(0, e.freezeCd - dt);
      if (e.chillT > 0) e.chillT -= dt;
      if (e.shockT > 0) e.shockT -= dt;
      if (e.burnT > 0) {
        e.burnT -= dt;
        B.as("burn", function () { B.hit(e, e.burnDps * dt, DOT); });
        if (e.dead) continue;
      }

      if (e.kx || e.ky) {
        e.x += e.kx * dt;
        e.y += e.ky * dt;
        e.kx *= decay;
        e.ky *= decay;
        if (Math.abs(e.kx) + Math.abs(e.ky) < 4) e.kx = e.ky = 0;
      }

      if (e.stun > 0) {
        e.stun -= dt;
      } else {
        B.think(e, dt, dx, dy, d);
        if (e.dead) continue;
      }

      if (d < e.r + p.r) {
        if (e.hurt) B.hurt(e.hurt * dt);
        if (thorns) B.as("thorns", function () { B.hit(e, thorns, DOT); });
        if (e.dead) continue;
      }

      // keep the swarm from stacking into a single dot
      for (var j = i + 1; j < n; j++) {
        var other = list[j];
        var sx = other.x - e.x;
        var sy = other.y - e.y;
        var min = e.r + other.r;
        if (sx > min || sx < -min || sy > min || sy < -min) continue;
        var s2 = sx * sx + sy * sy;
        if (s2 < min * min && s2 > 0) {
          var s = Math.sqrt(s2);
          var share = other.mass / (e.mass + other.mass);
          var push = (min - s) / s;
          e.x -= sx * push * share;
          e.y -= sy * push * share;
          other.x += sx * push * (1 - share);
          other.y += sy * push * (1 - share);
        }
      }
    }
  }

  /* -------------------------------------------------------------- drops */

  function drop(type, x, y, value) {
    var angle = Math.random() * TAU;
    var push = type === "xp" ? PS.rand(0, 40) : PS.rand(40, 110);
    R.drops.push({ type: type, x: x, y: y, value: value, vx: Math.cos(angle) * push, vy: Math.sin(angle) * push, t: 0, pull: false });
  }
  B.drop = drop;

  function dropLoot(e) {
    var i;
    if (e.boss) {
      for (i = 0; i < 24; i++) drop("coin", e.x, e.y, R.coinValue);
      return;
    }
    if (e.elite) {
      for (i = 0; i < 8; i++) drop("xp", e.x, e.y, Math.ceil(e.xp / 8));
      for (i = 0; i < 6; i++) drop("coin", e.x, e.y, R.coinValue);
      drop("heal", e.x, e.y, 0.2);
      drop("magnet", e.x, e.y, 0);
      return;
    }
    if (e.xp) drop("xp", e.x, e.y, e.xp);
    if (Math.random() < 0.08) drop("coin", e.x, e.y, R.coinValue);
    if (Math.random() < 0.012) drop("heal", e.x, e.y, 0.12);
  }

  function collect(d) {
    var p = R.p;
    if (d.type === "xp") {
      p.xp += d.value * p.xpMul;
      PS.sfx.play("gem");
    } else if (d.type === "coin") {
      R.coins += d.value;
      PS.sfx.play("coin");
    } else if (d.type === "heal") {
      PS.sfx.play("heal");
      B.heal(p.maxHp * d.value);
      B.text(p.x, p.y - 24, "+" + PS.fmt(Math.round(p.maxHp * d.value)), "#9BE08A", 13);
    } else if (d.type === "magnet") {
      for (var i = 0; i < R.drops.length; i++) R.drops[i].pull = true;
    }
  }

  function updateDrops(dt, hoover) {
    var p = R.p;
    var list = R.drops;
    for (var i = list.length - 1; i >= 0; i--) {
      var d = list[i];
      d.t += dt;
      if (d.vx || d.vy) {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.vx *= 0.9;
        d.vy *= 0.9;
        if (Math.abs(d.vx) + Math.abs(d.vy) < 3) d.vx = d.vy = 0;
      }
      var dx = p.x - d.x;
      var dy = p.y - d.y;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d.pull || hoover || dist < p.reach) {
        var speed = d.pull || hoover ? 620 : 340;
        d.x += (dx / dist) * Math.min(speed * dt, dist);
        d.y += (dy / dist) * Math.min(speed * dt, dist);
      }
      if (dist < 16) {
        collect(d);
        list.splice(i, 1);
      }
    }
    // never lose experience to the cap: the oldest gems just get banked
    while (list.length > 320) collect(list.shift());
  }

  /* ----------------------------------------------------------- particles */

  function burstSparks(x, y, fill, count, speed) {
    if (R.sparks.length > 260) return;
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * TAU;
      var v = speed * PS.rand(0.4, 1);
      R.sparks.push({ x: x, y: y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, life: 0.38, max: 0.38, fill: fill });
    }
  }
  B.sparks = burstSparks;

  B.text = function (x, y, str, color, size) {
    R.texts.push({ x: x + PS.rand(-6, 6), y: y, str: str, color: color, size: size || 12, life: 0.6 });
  };

  B.toast = function (message, seconds) {
    R.toast = message;
    R.toastT = seconds || 2.6;
  };

  function updateFx(dt) {
    var i;
    for (i = R.sparks.length - 1; i >= 0; i--) {
      var s = R.sparks[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0) R.sparks.splice(i, 1);
    }
    for (i = R.texts.length - 1; i >= 0; i--) {
      var text = R.texts[i];
      text.y -= 34 * dt;
      text.life -= dt;
      if (text.life <= 0) R.texts.splice(i, 1);
    }
    for (i = R.fx.length - 1; i >= 0; i--) {
      R.fx[i].t += dt;
      if (R.fx[i].t >= R.fx[i].dur) R.fx.splice(i, 1);
    }
    R.shake *= Math.exp(-9 * dt);
    if (R.toastT > 0) R.toastT -= dt;
  }

  /* ---------------------------------------------------------------- draw */

  function hashCell(cx, cy) {
    var h = (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return h;
  }

  function drawFloor(ox, oy) {
    var zone = R.zone;
    var p = R.p;
    ctx.fillStyle = zone.dot;
    var startX = ((ox % 40) + 40) % 40;
    var startY = ((oy % 40) + 40) % 40;
    for (var gx = startX; gx < view.w; gx += 40) {
      for (var gy = startY; gy < view.h; gy += 40) ctx.fillRect(gx - 1.5, gy - 1.5, 3, 3);
    }

    // scattered tufts, pebbles and leaves, fixed to the ground by a hash
    var cell = 110;
    var left = Math.floor((p.x - view.w / 2) / cell) - 1;
    var right = Math.floor((p.x + view.w / 2) / cell) + 1;
    var top = Math.floor((p.y - view.h / 2) / cell) - 1;
    var bottom = Math.floor((p.y + view.h / 2) / cell) + 1;
    ctx.fillStyle = zone.prop;
    ctx.strokeStyle = zone.prop;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    for (var cx = left; cx <= right; cx++) {
      for (var cy = top; cy <= bottom; cy++) {
        var h = hashCell(cx, cy);
        if (h % 5 > 1) continue;
        var x = cx * cell + ((h >>> 4) % cell) + ox;
        var y = cy * cell + ((h >>> 12) % cell) + oy;
        var kind = (h >>> 20) % 3;
        if (kind === 0) {
          ctx.beginPath();
          ctx.moveTo(x - 5, y);
          ctx.lineTo(x - 8, y - 9);
          ctx.moveTo(x, y);
          ctx.lineTo(x, y - 12);
          ctx.moveTo(x + 5, y);
          ctx.lineTo(x + 8, y - 9);
          ctx.stroke();
        } else if (kind === 1) {
          ctx.beginPath();
          ctx.ellipse(x, y, 9, 6, 0, 0, TAU);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.ellipse(x, y, 11, 4.5, ((h >>> 8) % 31) / 10, 0, TAU);
          ctx.fill();
        }
      }
    }
  }

  function drawZones() {
    for (var i = 0; i < R.zones.length; i++) {
      var z = R.zones[i];
      var fade = Math.min(1, (z.life - z.t) / 0.4, z.t / 0.15 + 0.3);
      if (z.type === "fire") {
        ctx.globalAlpha = 0.28 * fade;
        ctx.fillStyle = z.color || "#F26B2A";
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.5 * fade;
        ctx.fillStyle = z.core || "#FFD166";
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r * (0.45 + 0.12 * Math.sin(R.t * 9 + i)), 0, TAU);
        ctx.fill();
      } else if (z.type === "vortex") {
        ctx.globalAlpha = 0.5 * fade;
        ctx.fillStyle = "#1B1630";
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.85 * fade;
        ctx.strokeStyle = "#B48CFF";
        ctx.lineWidth = 2.5;
        for (var arm = 0; arm < 3; arm++) {
          var a0 = -R.t * 5 + (arm * TAU) / 3;
          ctx.beginPath();
          ctx.arc(z.x, z.y, z.r * (0.35 + arm * 0.22), a0, a0 + 2.1);
          ctx.stroke();
        }
        ctx.fillStyle = "#07050D";
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r * 0.2, 0, TAU);
        ctx.fill();
      } else if (z.type === "puddle") {
        ctx.globalAlpha = 0.5 * fade;
        ctx.fillStyle = z.color || "#7FB069";
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r, 0, TAU);
        ctx.fill();
      } else if (z.type === "warn") {
        var k = z.t / z.life;
        ctx.globalAlpha = 0.2 + 0.25 * k;
        ctx.fillStyle = "#E5484D";
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r * k, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = "#E5484D";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r, 0, TAU);
        ctx.stroke();
      } else if (z.type === "lane") {
        // the line a charging boss is about to run down
        ctx.globalAlpha = 0.18 + 0.3 * (z.t / z.life);
        ctx.strokeStyle = "#E5484D";
        ctx.lineWidth = z.width;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(z.x, z.y);
        ctx.lineTo(z.x + Math.cos(z.angle) * z.len, z.y + Math.sin(z.angle) * z.len);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawDrops() {
    var p = R.p;
    var halfW = view.w / 2 + 20;
    var halfH = view.h / 2 + 20;
    for (var i = 0; i < R.drops.length; i++) {
      var d = R.drops[i];
      if (Math.abs(d.x - p.x) > halfW || Math.abs(d.y - p.y) > halfH) continue;
      if (d.type === "xp") {
        var size = d.value > 3 ? 7 : d.value > 1 ? 5.5 : 4;
        ctx.fillStyle = d.value > 3 ? "#9BE08A" : P.pale;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y - size);
        ctx.lineTo(d.x + size, d.y);
        ctx.lineTo(d.x, d.y + size);
        ctx.lineTo(d.x - size, d.y);
        ctx.closePath();
        ctx.fill();
      } else if (d.type === "coin") {
        ctx.fillStyle = "#F2B93B";
        ctx.strokeStyle = "#B97F14";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, 5.5 * Math.abs(Math.cos(d.t * 5)) + 1.2, 6, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
      } else if (d.type === "heal") {
        // a slice of lemon
        ctx.fillStyle = P.bright;
        ctx.strokeStyle = P.rind;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(d.x, d.y + 3, 9, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = P.white;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y + 2);
        ctx.lineTo(d.x, d.y - 5);
        ctx.moveTo(d.x, d.y + 2);
        ctx.lineTo(d.x - 5, d.y - 2);
        ctx.moveTo(d.x, d.y + 2);
        ctx.lineTo(d.x + 5, d.y - 2);
        ctx.stroke();
      } else {
        // magnet
        ctx.strokeStyle = "#E5484D";
        ctx.lineWidth = 4;
        ctx.lineCap = "butt";
        ctx.beginPath();
        ctx.arc(d.x, d.y - 1, 6, Math.PI, 0);
        ctx.lineTo(d.x + 6, d.y + 6);
        ctx.moveTo(d.x - 6, d.y - 1);
        ctx.lineTo(d.x - 6, d.y + 6);
        ctx.stroke();
        ctx.fillStyle = P.white;
        ctx.fillRect(d.x - 8, d.y + 4, 4, 3);
        ctx.fillRect(d.x + 4, d.y + 4, 4, 3);
      }
    }
  }

  function drawPlayer() {
    var p = R.p;
    var bob = p.moving ? Math.sin(R.t * 14) * 1.2 : 0;
    var y = p.y + bob;

    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 12, 13, 4.5, 0, 0, TAU);
    ctx.fill();

    if (R.phase === "lost") return;

    if (p.invuln > 0) ctx.globalAlpha = 0.55 + 0.35 * Math.sin(R.t * 30);
    B.drawOutfit(ctx, p, y, "under", R.t);
    ctx.fillStyle = p.flash > 0 ? P.white : P.lemon;
    ctx.strokeStyle = P.rind;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(p.x, y, 14, 12, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    B.drawOutfit(ctx, p, y, "body", R.t);
    B.drawOutfit(ctx, p, y, "head", R.t);
    ctx.fillStyle = P.green;
    ctx.beginPath();
    ctx.ellipse(p.x + 5, y - 12, 6, 3, -0.6, 0, TAU);
    ctx.fill();

    // eyes follow whatever the lemon is aiming at
    var ex = Math.cos(p.aim) * 2.4;
    var ey = Math.sin(p.aim) * 1.8;
    ctx.fillStyle = P.charcoal;
    ctx.beginPath();
    ctx.arc(p.x - 4.5 + ex, y - 1 + ey, 1.9, 0, TAU);
    ctx.arc(p.x + 4.5 + ex, y - 1 + ey, 1.9, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    R.weapon.held(ctx, p, R);

    if (p.barrier > 0) {
      ctx.globalAlpha = 0.25 + 0.45 * (p.barrier / p.barrierMax);
      ctx.strokeStyle = "#9AD7FF";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, y, 21, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawFx() {
    var p = R.p;
    for (var i = 0; i < R.fx.length; i++) {
      var f = R.fx[i];
      var k = f.t / f.dur;
      if (f.type === "blast") {
        ctx.globalAlpha = 0.45 * (1 - k);
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (0.55 + 0.45 * k), 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.9 * (1 - k);
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (0.7 + 0.3 * k), 0, TAU);
        ctx.stroke();
      } else if (f.type === "arc") {
        ctx.globalAlpha = 0.75 * (1 - k);
        ctx.strokeStyle = f.color;
        ctx.lineCap = "round";
        ctx.lineWidth = 9 * (1 - k) + 2;
        ctx.beginPath();
        if (f.half >= Math.PI) {
          ctx.arc(p.x, p.y, f.r * 0.86, 0, TAU);
        } else {
          // the blade sweeps across the arc as the effect plays
          var from = f.angle - f.half;
          ctx.arc(p.x, p.y, f.r * 0.86, from, from + f.half * 2 * Math.min(1, k * 2.2 + 0.25));
        }
        ctx.stroke();
        ctx.globalAlpha = 0.16 * (1 - k);
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.arc(p.x, p.y, f.r, f.angle - f.half, f.angle + f.half);
        ctx.closePath();
        ctx.fill();
      } else if (f.type === "stab") {
        var reach = f.len * Math.min(1, k * 3 + 0.35);
        ctx.globalAlpha = 0.8 * (1 - k);
        ctx.strokeStyle = f.color;
        ctx.lineCap = "round";
        ctx.lineWidth = Math.max(2, f.width * 0.45 * (1 - k));
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(f.angle) * 14, p.y + Math.sin(f.angle) * 14);
        ctx.lineTo(p.x + Math.cos(f.angle) * reach, p.y + Math.sin(f.angle) * reach);
        ctx.stroke();
      } else if (f.type === "bolt") {
        ctx.globalAlpha = 1 - k;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        for (var pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass ? "#FFFDF0" : "#8EC5FF";
          ctx.lineWidth = pass ? 1.6 : 5;
          ctx.beginPath();
          ctx.moveTo(f.pts[0], f.pts[1]);
          for (var q = 2; q < f.pts.length; q += 2) {
            var ax = f.pts[q - 2];
            var ay = f.pts[q - 1];
            var bx = f.pts[q];
            var by = f.pts[q + 1];
            var hop = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay)) || 1;
            // a kink every 26 pixels or so, in the same place for the life of the bolt
            var kinks = Math.max(2, Math.floor(hop / 26));
            for (var kink = 1; kink < kinks; kink++) {
              var t = kink / kinks;
              var noise = Math.sin(f.seed * 12.9898 + q * 78.233 + kink * 37.719) * 43758.5453;
              var off = (noise - Math.floor(noise) - 0.5) * 20;
              ctx.lineTo(ax + (bx - ax) * t - ((by - ay) / hop) * off, ay + (by - ay) * t + ((bx - ax) / hop) * off);
            }
            ctx.lineTo(bx, by);
          }
          ctx.stroke();
        }
      } else if (f.type === "ring") {
        ctx.globalAlpha = 0.8 * (1 - k);
        ctx.strokeStyle = f.color;
        ctx.lineWidth = f.width || 4;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r0 + (f.r1 - f.r0) * k, 0, TAU);
        ctx.stroke();
      } else if (f.type === "lob") {
        // something thrown in an arc from one spot to another
        var lx = f.x0 + (f.x1 - f.x0) * k;
        var ly = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * 46;
        ctx.globalAlpha = 1;
        ctx.fillStyle = f.color;
        ctx.strokeStyle = P.charcoal;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(lx, ly, f.size || 6, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Arrows at the screen edge pointing at a boss or elite that is out of sight. */
  function drawPointers() {
    var p = R.p;
    for (var i = 0; i < R.enemies.length; i++) {
      var e = R.enemies[i];
      if (!e.boss && !e.elite) continue;
      var dx = e.x - p.x;
      var dy = e.y - p.y;
      if (Math.abs(dx) < view.w / 2 - 10 && Math.abs(dy) < view.h / 2 - 10) continue;
      var angle = Math.atan2(dy, dx);
      var edge = Math.min((view.w / 2 - 22) / Math.abs(Math.cos(angle) || 1e-6), (view.h / 2 - 22) / Math.abs(Math.sin(angle) || 1e-6));
      var x = view.w / 2 + Math.cos(angle) * edge;
      var y = view.h / 2 + Math.sin(angle) * edge;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = e.boss ? "#E5484D" : "#F2B93B";
      ctx.strokeStyle = P.charcoal;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-7, -8);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-7, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawStick() {
    if (!stick.on || !stick.touch) return;
    var s = 1 / view.css;
    var dx = stick.x - stick.ox;
    var dy = stick.y - stick.oy;
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    var k = Math.min(1, 44 / d);
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = P.white;
    ctx.beginPath();
    ctx.arc(stick.ox * s, stick.oy * s, 44 * s, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc((stick.ox + dx * k) * s, (stick.oy + dy * k) * s, 20 * s, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function draw() {
    var p = R.p;
    var s = view.scale;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.fillStyle = R.zone.floor;
    ctx.fillRect(0, 0, view.w, view.h);

    var shakeX = 0;
    var shakeY = 0;
    if (R.shake > 0.3 && !calm) {
      shakeX = (Math.random() - 0.5) * R.shake * 2;
      shakeY = (Math.random() - 0.5) * R.shake * 2;
    }
    var ox = view.w / 2 - p.x + shakeX;
    var oy = view.h / 2 - p.y + shakeY;
    drawFloor(ox, oy);

    ctx.save();
    ctx.translate(ox, oy);
    drawZones();
    drawDrops();

    var halfW = view.w / 2 + 70;
    var halfH = view.h / 2 + 70;
    var i;
    for (i = 0; i < R.enemies.length; i++) {
      var e = R.enemies[i];
      if (Math.abs(e.x - p.x) < halfW + e.r && Math.abs(e.y - p.y) < halfH + e.r) B.drawEnemy(ctx, e, R);
    }

    for (i = 0; i < R.ebullets.length; i++) {
      var b = R.ebullets[i];
      ctx.fillStyle = b.color || "#E5484D";
      ctx.strokeStyle = "#3A1113";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.3, 0, TAU);
      ctx.fill();
    }

    for (i = 0; i < R.shots.length; i++) B.drawShot(ctx, R.shots[i], R);
    B.drawAbilities(ctx, R);
    drawPlayer();
    drawFx();

    for (i = 0; i < R.sparks.length; i++) {
      var spark = R.sparks[i];
      ctx.globalAlpha = Math.max(0, spark.life / spark.max);
      ctx.fillStyle = spark.fill;
      ctx.fillRect(spark.x - 2, spark.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    for (i = 0; i < R.texts.length; i++) {
      var text = R.texts[i];
      ctx.globalAlpha = Math.min(1, text.life / 0.25);
      ctx.font = "800 " + text.size + "px " + FONT;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(20,18,14,0.75)";
      ctx.strokeText(text.str, text.x, text.y);
      ctx.fillStyle = text.color;
      ctx.fillText(text.str, text.x, text.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    drawPointers();
    drawStick();
  }
  B.draw = draw;

  /* --------------------------------------------------------------- input */

  var MOVE_CODES = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1, KeyW: 1, KeyA: 1, KeyS: 1, KeyD: 1 };

  function bindInput() {
    window.addEventListener("keydown", function (e) {
      if (!R || R.done) return;
      if (e.key === "Tab") {
        e.preventDefault();
        B.hud.toggleMeter();
        return;
      }
      if (MOVE_CODES[e.code]) {
        keys[e.code] = true;
        e.preventDefault();
        return;
      }
      if (R.choices) {
        if (e.key === "1" || e.key === "2" || e.key === "3") B.choose(Number(e.key) - 1);
        else if (e.key === "r" || e.key === "R") B.reroll();
        return;
      }
      if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        if (R.paused) B.resume();
        else B.pause();
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", function (e) {
      if (MOVE_CODES[e.code]) keys[e.code] = false;
    });
    window.addEventListener("blur", function () {
      keys = Object.create(null);
      stick.on = false;
      B.pause();
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) B.pause();
    });

    function at(e) {
      var rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    canvas.addEventListener("pointerdown", function (e) {
      if (!R || R.choices || R.paused) return;
      e.preventDefault();
      var pos = at(e);
      stick.on = true;
      stick.touch = e.pointerType !== "mouse";
      stick.id = e.pointerId;
      stick.ox = stick.x = pos.x;
      stick.oy = stick.y = pos.y;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!stick.on || e.pointerId !== stick.id) return;
      var pos = at(e);
      stick.x = pos.x;
      stick.y = pos.y;
    });
    function release(e) {
      if (e.pointerId === stick.id) stick.on = false;
    }
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  }
})();
