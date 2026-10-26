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

  /* Performance settings, read once when a battle starts (Settings can only be
     opened between battles). gfx is 0 low, 1 medium, 2 high. */
  var gfx = 2;
  var frameGap = 0; // least milliseconds between drawn frames; 0 means no limit
  var fpsEl = null;
  var fpsFrames = 0;
  var fpsSince = 0;
  var SPARK_CAP = [70, 150, 260];
  B.quality = 2;

  /* the colour of each weapon's muzzle flash; anything not listed flashes lemon */
  var FLASH = {
    frost: "#9BDCFF", storm: "#8EC5FF", ember: "#FF8A3D", eclipse: "#B48CFF", solstice: "#FFD166",
    comet: "#FFB84A", nova: "#FFE66D", geyser: "#7FE3F0", flask: "#9BE08A", fangs: "#E5484D",
    thornlash: "#8FAE65", hive: "#F2B93B", staff: "#C9A6FF"
  };
  (PS.ARMORY || []).forEach(function (w) { FLASH[w.id] = w.colors.glow; });

  /** "#rrggbb" and an opacity as an rgba() string, for gradients that fade out. */
  function rgba(hex, a) {
    if (typeof hex !== "string" || hex.charAt(0) !== "#" || hex.length !== 7) return "rgba(255,230,109," + a + ")";
    var n = parseInt(hex.slice(1), 16);
    return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }
  B.rgba = rgba;
  var SPARK_SCALE = [0.35, 0.7, 1];
  var TEXT_CAP = [10, 24, 40];
  var DPR_CAP = [1, 1.5, 2];

  function applyPrefs() {
    gfx = PS.prefs.get("quality");
    B.quality = gfx; // weapons.js reads it to decide on trails and glow
    var cap = PS.prefs.get("fps");
    frameGap = cap ? 1000 / cap : 0;
    if (fpsEl) {
      fpsEl.hidden = !PS.prefs.get("showFps");
      fpsFrames = 0;
      fpsSince = 0;
    }
  }

  B.run = null;
  B.autopilot = null; // tests can steer with function (run) -> { x, y }

  /* -------------------------------------------------------------- set-up */

  function makePlayer(stats) {
    var fx = {};
    for (var key in stats.fx) fx[key] = stats.fx[key];
    return {
      x: 0, y: 0, r: 13, vx: 0, vy: 0,
      atk: stats.atk, maxHp: stats.hp, hp: stats.hp, baseHp: stats.hp,
      crit: stats.crit, critDmg: stats.critDmg, haste: stats.haste,
      moveSpeed: 150 * (1 + stats.speed), armor: stats.armor, regen: stats.regen,
      reach: 46 * (1 + stats.magnet), xpMul: 1 + stats.xp, luck: stats.luck,
      area: 1 + stats.area, bossDmg: stats.bossDmg,
      fx: fx, // behaviour switches from gear; upgrades add to this copy
      up: {}, // level of each upgrade taken this battle
      mods: { dmg: 1, haste: 0, count: 0, pierce: 0, area: 0, crit: 0, critDmg: 0, speed: 1, armor: 1, regen: 0, dash: 1 },
      level: 1, xp: 0, need: xpNeeded(1),
      aim: 0, moving: false, cd: 0.5, shots: 0, swing: 0,
      flash: 0, spin: 0, invuln: 0, sinceHit: 99, burstCd: 0,
      barrierMax: stats.hp * (fx.barrier || 0), barrier: stats.hp * (fx.barrier || 0),
      revives: fx.revive || 0, rerolls: 1 + (fx.reroll || 0),
      frenzy: 0, frenzyT: 0, lvlAtk: 0, slow: 0,
      buffs: {}, // power-ups picked up in battle: seconds left of each (events.js)
      dashCd: 0, dashT: 0, dashX: 1, dashY: 0, faceX: 1, faceY: 0, // the dash: see B.dash
      awake: {}, // abilities awakened this battle (upgrades.js)
      timers: {},
      // each lemon's own weapon, level-ups and once-a-second windows, so a
      // second lemon (playing together) keeps its own
      weaponId: stats.weapon, weapon: B.WEAPONS ? B.WEAPONS[stats.weapon] : null,
      pending: 0, choices: null, choiceKind: null,
      hurtWindow: 0, leeched: 0, windowT: 0,
      down: false, reviveT: 0, // playing together: knocked out, and help getting up
      remote: false, input: null, ack: 0, name: "",
      // the dev menu's cheats for this lemon: null means this game's own (PS.dev.cheats);
      // the other player's lemon gets its own, which only their admin account can switch on
      cheats: null
    };
  }

  function cheatsOf(q) {
    return (q && q.cheats) || PS.dev.cheats;
  }

  /** Cheats that change the whole battle (frozen pests, no spawning): on if any lemon has them on. */
  function anyCheat(key) {
    if (!R || !R.players) return Boolean(PS.dev.cheats[key]);
    for (var i = 0; i < R.players.length; i++) {
      if (!R.players[i].gone && cheatsOf(R.players[i])[key]) return true;
    }
    return false;
  }
  B.anyCheat = anyCheat;

  /** Every cheat off, for the other player's lemon until their game says otherwise. */
  function noCheats() {
    var out = {};
    for (var key in PS.dev.cheats) out[key] = typeof PS.dev.cheats[key] === "number" ? 1 : false;
    return out;
  }

  /** The other player's cheats as their game sent them: only known switches, sensible values. */
  function cleanCheats(raw) {
    var out = noCheats();
    if (!raw || typeof raw !== "object") return out;
    PS.dev.TOGGLES.forEach(function (t) { out[t.key] = raw[t.key] === true; });
    PS.dev.MULTS.forEach(function (m) {
      var v = Number(raw[m.key]);
      var allowed = m.values.concat(m.more || []);
      out[m.key] = m.key !== "speed" && allowed.indexOf(v) !== -1 ? v : 1;
    });
    return out;
  }

  B.mount = function (root) {
    canvas = document.createElement("canvas");
    canvas.className = "battle__canvas";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Battle");
    root.appendChild(canvas);
    ctx = canvas.getContext("2d");
    B.hud.mount(root);
    fpsEl = document.createElement("div");
    fpsEl.className = "hud__fps";
    fpsEl.hidden = true;
    fpsEl.setAttribute("aria-hidden", "true");
    root.appendChild(fpsEl);
    if (B.devPanel) B.devPanel.mount(root);
    bindInput();
    window.addEventListener("resize", resize);
  };

  /** mode "swarm" is the endless swarm: no boss, gold only. `twistId` is a
   *  daily challenge twist (PS.CHALLENGE.twists). */
  B.start = function (chapterNumber, mode, twistId, mp) {
    var ch = PS.chapter(chapterNumber);
    var stats = PS.state.calc();
    var p = makePlayer(stats);
    p.outfit = B.outfitOf();
    p.weaponId = stats.weapon;
    p.weapon = B.WEAPONS[stats.weapon];
    p.name = (mp && mp.name) || "You";
    calm = PS.reducedMotion() || !PS.prefs.get("shake");
    applyPrefs();
    var cheats = PS.dev.cheats;
    if (mp) {
      // playing together: cheats start off; an admin can switch them on for their own lemon
      for (var off in cheats) cheats[off] = typeof cheats[off] === "number" ? 1 : false;
    } else {
      for (var key in PS.dev.startWith) cheats[key] = PS.dev.startWith[key];
    }
    R = B.run = {
      ch: ch, zone: PS.ZONES[ch.zone], weaponId: stats.weapon, weapon: B.WEAPONS[stats.weapon],
      src: stats.weapon, dmgBy: {}, mode: mode === "swarm" ? "swarm" : "normal",
      t: 0, dur: ch.duration, phase: "swarm", over: 0, done: false,
      p: p,
      enemies: [], shots: [], zones: [], ebullets: [], drops: [], sparks: [], texts: [], fx: [], timers: [], splats: [],
      kills: 0, combo: 0, comboT: 0, bestCombo: 0, coins: 0, dealt: 0, coinValue: Math.max(1, Math.round(ch.gold * 0.005)),
      spawnIn: 0.6,
      elites: [ch.duration * 0.35, ch.duration * 0.7],
      hordes: [ch.duration * 0.25, ch.duration * 0.5, ch.duration * 0.75],
      boss: null, reachedBoss: false,
      paused: false, choices: null, pending: p.fx.startUp || 0,
      shake: 0, procs: 0, leeched: 0, hurtWindow: 0, windowT: 0, toast: "", toastT: 0,
      twist: null, hurtMul: 1, pestMul: null,
      mp: null, players: null, ally: null, partner: null, duel: null, mpMul: null, uid: 0
    };
    PS.CHALLENGE.twists.forEach(function (tw) { if (tw.id === twistId) applyTwist(tw); });
    if (mp) startTogether(mp);
    keys = Object.create(null);
    stick.on = false;
    resize();
    B.hud.begin(R);
    if (PS.dev.admin && B.devStartBuild && !R.mp) B.devStartBuild(PS.dev.startBuild);
    if (!PS.state.get().stats.runs) B.toast("Move with WASD or drag. The lemon attacks by itself.", 6);
    if (R.pending) openChoices();
    if (R.ally && R.ally.pending) openAllyChoices();
    cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(frame);
    return R;
  };

  /** A daily challenge's twist: see PS.CHALLENGE in data.js for what each number does. */
  function applyTwist(tw) {
    var p = R.p;
    R.twist = tw;
    if (tw.dmg) p.mods.dmg *= tw.dmg;
    if (tw.speed) p.moveSpeed *= tw.speed;
    if (tw.xp) p.xpMul *= tw.xp;
    R.hurtMul = tw.hurt || 1;
    R.pestMul = tw.pest || null;
    if (tw.elites) {
      R.elites = [];
      for (var t = tw.elites; t < R.dur - 5; t += tw.elites) R.elites.push(t);
    }
  }

  /** Tear the run down once the results have been read. */
  B.stop = function () {
    cancelAnimationFrame(raf);
    raf = 0;
    R = B.run = null;
  };

  /* ------------------------------------------------------- shaded bodies */
  /* Everything with a round body is drawn with a lit side, a shaded rim and a
     glint, so the pests, the bosses and the lemon read as little solid things
     instead of flat discs. `tint` lightens (amount > 0) or darkens (< 0) a
     #rrggbb colour. */

  B.tint = function (hex, amount) {
    var n = parseInt(hex.slice(1), 16);
    var out = [n >> 16, (n >> 8) & 255, n & 255].map(function (c) {
      var v = amount > 0 ? c + (255 - c) * amount : c * (1 + amount);
      return Math.max(0, Math.min(255, Math.round(v)));
    });
    return "rgb(" + out[0] + "," + out[1] + "," + out[2] + ")";
  };

  /** A lit ball in the current fill colour. Other fill styles are drawn flat. */
  B.ball = function (ctx, x, y, r) {
    var c = ctx.fillStyle;
    // low quality draws flat discs: a gradient per body is the costly part
    if (gfx === 0 || typeof c !== "string" || c.charAt(0) !== "#" || c.length !== 7) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    var g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r * 1.05);
    g.addColorStop(0, B.tint(c, 0.42));
    g.addColorStop(0.5, c);
    g.addColorStop(1, B.tint(c, -0.34));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (r > 6) {
      ctx.strokeStyle = B.tint(c, -0.55);
      ctx.globalAlpha *= 0.55;
      ctx.lineWidth = Math.max(1, r * 0.07);
      ctx.stroke();
      ctx.globalAlpha /= 0.55;
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath();
      ctx.ellipse(x - r * 0.36, y - r * 0.44, r * 0.26, r * 0.14, -0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = c;
  };

  function resize() {
    if (!canvas) return;
    var cw = canvas.clientWidth || window.innerWidth;
    var ch = canvas.clientHeight || window.innerHeight;
    if (!cw || !ch) return;
    // the short side of the screen always shows about the same amount of field
    var s = Math.min(cw, ch) / (cw >= ch ? 500 : 430);
    var dpr = Math.min(DPR_CAP[gfx], window.devicePixelRatio || 1);
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
    // the frame-rate limit: skip this frame and let the time add up for the next
    // (a couple of milliseconds of slack, so a 60 limit still gets every 60 Hz frame)
    if (frameGap && now - last < frameGap - 2.5) return;
    // a frame's timestamp can be older than the moment a card was picked
    // or the game resumed, so the step is never allowed to run backwards
    var dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    if (!R) return;
    if (fpsEl && !fpsEl.hidden) {
      fpsFrames++;
      if (!fpsSince) fpsSince = now;
      if (now - fpsSince >= 500) {
        fpsEl.textContent = Math.round((fpsFrames * 1000) / (now - fpsSince)) + " FPS";
        fpsFrames = 0;
        fpsSince = now;
      }
    }
    if (R.mirror) {
      // the second player: the other game runs the battle, this one shows it
      stepMirror(dt);
      draw();
      B.hud.update(R);
      return;
    }
    // playing together, the battle always runs at normal speed: the other game keeps time with it
    var speed = R.mp ? 1 : PS.dev.cheats.speed;
    if (speed < 1) {
      B.step(dt * speed);
    } else {
      for (var n = 0; n < speed; n++) B.step(dt);
    }
    if (R && R.mp) sendSnapshot(now);
    if (!R) return;
    draw();
    B.hud.update(R);
  }

  B.frame = function (now) { frame(now); }; // tests drive frames by hand where the browser will not

  /** One tick of the simulation. Does nothing while paused or choosing. */
  B.step = function (dt) {
    if (!R || R.mirror) return;
    // playing together, a pause (or the dev menu) only shows the panel: the other player plays on
    if ((R.paused && !R.mp) || R.choices || (R.ally && R.ally.choices) || R.done || (R.devOpen && !R.mp)) return;
    if (R.phase === "won" || R.phase === "lost") {
      R.over -= dt;
      updateDrops(dt, R.phase === "won");
      updateFx(dt);
      sweep();
      if (R.over <= 0) finish();
      return;
    }
    if (R.duel && R.duel.hold > 0) {
      // between rounds of a duel
      R.duel.hold -= dt;
      updateFx(dt);
      if (R.duel.hold <= 0) nextRound();
      return;
    }
    R.t += dt;
    R.procs = 0;
    if (R.comboT > 0) {
      R.comboT -= dt;
      if (R.comboT <= 0) R.combo = 0;
    }
    R.src = R.weaponId;
    if (R.players) {
      for (var i = 0; i < R.players.length; i++) {
        var q = R.players[i];
        own(q);
        if (q.down) tendDowned(q, dt);
        else updatePlayer(dt);
      }
      own(R.players[0]);
      if (R.duel) duelTick(dt);
    } else {
      updatePlayer(dt);
    }
    if (B.petUpdate) B.petUpdate(dt);
    B.director(dt);
    if (B.events) B.events(dt);
    updateEnemies(dt);
    updateShots(dt);
    updateZones(dt);
    updateEnemyShots(dt);
    eachLiving(function () { B.updateAbilities(dt); });
    runTimers(dt);
    R.src = R.weaponId;
    updateDrops(dt, false);
    updateFx(dt);
    sweep();
    // no cards once the battle has been decided
    if (R.phase === "swarm" || R.phase === "boss") {
      if (R.p.xp >= R.p.need) levelUp();
      if (R.ally && !R.ally.down && R.ally.xp >= R.ally.need) allyLevelUp();
    }
  };

  /* ----------------------------------------------------- two lemons */
  /* Playing together, the battle has more than one lemon. Almost everything
     in the engine reads "the lemon" from R.p, so each lemon takes its turn as
     R.p: its movement and attacks, the pests closest to it, its shots, its
     pickups. `own` makes a lemon the one in charge; `ownAs` does something as
     that lemon and hands back. The first lemon is always this game's own. */

  function own(q) {
    R.p = q;
    R.weaponId = q.weaponId;
    R.weapon = q.weapon;
  }

  B.ownAs = function (q, fn) {
    if (!R || !q || q === R.p) return fn();
    var before = R.p;
    own(q);
    var result = fn();
    own(before);
    return result;
  };

  /** Run fn once as each lemon still standing (or once, playing alone). */
  function eachLiving(fn) {
    if (!R.players) return fn();
    var first = R.players[0];
    for (var i = 0; i < R.players.length; i++) {
      if (R.players[i].down) continue;
      own(R.players[i]);
      fn();
    }
    own(first);
  }

  /** The lemon still standing nearest a point (any lemon, if all are down). */
  function nearestPlayer(x, y) {
    if (!R.players) return R.p;
    var best = null;
    var bestD = Infinity;
    for (var i = 0; i < R.players.length; i++) {
      var q = R.players[i];
      if (q.down || q.gone) continue;
      var dx = q.x - x;
      var dy = q.y - y;
      var d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = q;
      }
    }
    return best || R.players[0];
  }
  B.nearestPlayer = function (x, y) { return R ? nearestPlayer(x, y) : null; };

  /** Hurt every lemon standing inside a circle (a boss's slam, a burst of slime). */
  B.hurtIn = function (x, y, r, amount) {
    var list = R.players || [R.p];
    for (var i = 0; i < list.length; i++) {
      var q = list[i];
      if (q.down || q.gone) continue;
      var dx = q.x - x;
      var dy = q.y - y;
      var reach = r + q.r - 4;
      if (dx * dx + dy * dy < reach * reach) B.ownAs(q, function () { B.hurt(amount); });
    }
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
    R.timers.push({ t: delay, fn: fn, src: R.src, owner: R.p });
  };

  function runTimers(dt) {
    var first = R.p;
    for (var i = R.timers.length - 1; i >= 0; i--) {
      var timer = R.timers[i];
      timer.t -= dt;
      if (timer.t <= 0) {
        R.timers.splice(i, 1);
        if (R.players && timer.owner && timer.owner !== R.p) own(timer.owner);
        R.src = timer.src;
        timer.fn();
        if (R.p !== first) own(first);
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
    var d = p.atk * p.mods.dmg * (1 + p.lvlAtk) * cheatsOf(p).dmgMul;
    if (p.fx.movingDmg && p.moving) d *= 1 + p.fx.movingDmg;
    if (R.weaponId === "solstice" && p.fx.q && p.hp > p.maxHp * 0.7) d *= 1.5;
    return d;
  };
  B.area = function () { return (R.p.area + R.p.mods.area) * (R.p.buffs.giant > 0 ? 1.5 : 1); };
  B.count = function () { return (R.p.fx.count || 0) + R.p.mods.count; };
  B.pierce = function () { return (R.p.fx.pierce || 0) + R.p.mods.pierce; };
  B.cooldown = function (base) {
    var p = R.p;
    return base / ((1 + p.haste + p.mods.haste + p.frenzy * 0.04) * cheatsOf(p).hasteMul * (p.buffs.frenzy > 0 ? 2 : 1));
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
    // a duel: the other lemon comes first whenever it is in reach
    if (R.duel && p.foe && !p.foe.down && !p.foe.gone) {
      var fx0 = p.foe.x - p.x;
      var fy0 = p.foe.y - p.y;
      if (fx0 * fx0 + fy0 * fy0 < (range + 13) * (range + 13)) return p.foe.proxy;
    }
    var near = B.nearest(p.x, p.y, range);
    if (!near || near.boss || near.elite || near.golden) return near;
    var dx = near.x - p.x;
    var dy = near.y - p.y;
    if (Math.sqrt(dx * dx + dy * dy) - near.r < 60) return near;
    var big = null;
    var bigD = range * range;
    for (var i = 0; i < R.enemies.length; i++) {
      var e = R.enemies[i];
      if (e.dead || !(e.boss || e.elite || e.golden)) continue;
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
  B.xpNeeded = xpNeeded;

  function steering() {
    var mx = 0;
    var my = 0;
    var mag = 1;
    if (R && R.p.remote) {
      // the other player's lemon, steered by what their game sends
      var inp = R.p.input;
      if (!inp) return null;
      var len0 = Math.sqrt(inp.x * inp.x + inp.y * inp.y);
      if (len0 < 0.05) return null;
      return { x: inp.x / len0, y: inp.y / len0, mag: Math.min(1, len0) };
    }
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
      p.faceX = move.x;
      p.faceY = move.y;
    }
    // how fast and which way the lemon is going: bosses aim ahead of it
    p.vx = 0;
    p.vy = 0;
    p.dashCd = Math.max(0, p.dashCd - dt);
    if (p.dashT > 0) {
      // mid-dash: a straight, quick slide, leaving ghosts behind
      var dashSpeed = B.DASH.dist / B.DASH.time;
      var slide = Math.min(dt, p.dashT);
      p.dashT -= dt;
      p.vx = p.dashX * dashSpeed;
      p.vy = p.dashY * dashSpeed;
      p.x += p.vx * slide;
      p.y += p.vy * slide;
      p.moving = true;
      if (gfx >= 1 && R.fx.length < 180) R.fx.push({ type: "ghost", x: p.x, y: p.y, t: 0, dur: 0.28 });
    } else if (move) {
      var speed = p.moveSpeed * p.mods.speed * move.mag * (1 - p.slow) * cheatsOf(p).moveMul * (p.buffs.swift > 0 ? 1.45 : 1);
      p.vx = move.x * speed;
      p.vy = move.y * speed;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    p.slow = 0;
    for (var buff in p.buffs) if (p.buffs[buff] > 0) p.buffs[buff] -= dt;
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
    p.windowT += dt;
    if (p.windowT >= 1) {
      p.windowT = 0;
      p.hurtWindow = 0;
      p.leeched = 0;
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
    PS.sfx.play("shoot", R.weaponId);
    p.swing = 0.2;
    var empowered = p.fx.emp > 0 && p.shots % p.fx.emp === 0;
    R.weapon.attack(p.aim, target, empowered, 1);
    if (gfx >= 1 && R.fx.length < 180) {
      R.fx.push({
        type: "flash", x: p.x + Math.cos(p.aim) * 20, y: p.y + Math.sin(p.aim) * 20, angle: p.aim,
        color: FLASH[R.weaponId] || "#FFE66D", big: empowered, t: 0, dur: empowered ? 0.16 : 0.1
      });
    }
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
    if (p.invuln > 0 || cheatsOf(p).god || R.phase === "won" || R.phase === "lost") return;
    if (p.bubble) {
      // the bubble shield takes the hit and bursts, pushing pests away
      p.bubble = false;
      p.invuln = Math.max(p.invuln, 0.6);
      B.as("bubble", function () { B.blast(p.x, p.y, 90, B.dmg() * (1 + 0.3 * (p.up.bubble || 1)), { knock: 520, color: "#BFE0FF" }); });
      return;
    }
    var dmg = amount * R.hurtMul * (1 - p.armor) * p.mods.armor;
    if (p.fx.lastStand && p.hp < p.maxHp * 0.35) dmg *= 1 - p.fx.lastStand;
    if (p.fx.dmgCap) {
      var room = p.maxHp * p.fx.dmgCap - p.hurtWindow;
      if (room <= 0) return;
      if (dmg > room) dmg = room;
      p.hurtWindow += dmg;
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
      } else if (R.players && R.players.length > 1) {
        p.hp = 0;
        if (R.duel) duelRoundOver(p);
        else knockedDown(p);
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

  /* The dash: a quick slide the way the lemon is heading (or facing), with a
     moment where nothing can hurt it. Space, Shift or the Dash button. */
  B.DASH = { cd: 3.2, time: 0.16, dist: 150, safe: 0.3 };
  B.dashCooldown = function () { return B.DASH.cd * R.p.mods.dash; };
  B.dash = function () {
    if (R && R.mirror) return mirrorDash();
    if (!R || (R.paused && !R.mp) || R.choices || R.devOpen || R.done) return false;
    if (R.phase !== "swarm" && R.phase !== "boss") return false;
    var p = R.p;
    if (p.dashCd > 0 || p.dashT > 0) return false;
    var move = steering();
    p.dashX = move ? move.x : p.faceX;
    p.dashY = move ? move.y : p.faceY;
    p.dashT = B.DASH.time;
    p.dashCd = B.dashCooldown();
    p.invuln = Math.max(p.invuln, B.DASH.safe);
    R.fx.push({ type: "ring", x: p.x, y: p.y, r0: 8, r1: 34, color: "#FFF4B8", width: 4, t: 0, dur: 0.25 });
    PS.sfx.play("dash");
    return true;
  };

  /** Cards that are not a level-up (a shrine's blessings): shown the same way. */
  B.offer = function (choices, kind) {
    R.choices = choices;
    R.choiceKind = kind;
    stick.on = false;
    B.hud.choices(R);
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
    R.choiceKind = "level";
    R.choices = B.rollChoices();
    PS.sfx.play("levelup");
    stick.on = false;
    B.hud.choices(R);
  }

  /* The second player's level-ups: their cards are rolled here, as their
     lemon, and sent to their game; the battle waits while they choose. */
  function allyLevelUp() {
    var a = R.ally;
    while (a.xp >= a.need) {
      a.xp -= a.need;
      a.level++;
      a.need = xpNeeded(a.level);
      a.pending++;
      if (a.fx.levelAtk) {
        a.lvlAtk += a.fx.levelAtk;
        a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.1);
      }
    }
    if (!a.choices) openAllyChoices();
  }

  function openAllyChoices() {
    var a = R.ally;
    a.pending--;
    B.ownAs(a, function () {
      a.choiceKind = "level";
      a.choices = B.rollChoices();
    });
    sendCards();
  }

  function sendCards() {
    var a = R.ally;
    if (!a || !a.choices) return;
    mpSend("cards", { list: a.choices, kind: a.choiceKind, level: a.level, rerolls: a.rerolls, t: R.t }, true);
  }

  /** Cards for one lemon: this game's own are shown here, the other's are sent. */
  B.offerTo = function (q, choices, kind) {
    if (!R.ally || q !== R.ally) return B.offer(choices, kind);
    q.choices = choices;
    q.choiceKind = kind;
    sendCards();
  };

  function allyPick(index) {
    var a = R.ally;
    if (!a || !a.choices || !a.choices[index]) return;
    var choice = a.choices[index];
    B.ownAs(a, function () { B.takeUpgrade(choice); });
    a.choices = null;
    B.hud.build(R); // takeUpgrade drew the other lemon's chips; put this one's back
    last = performance.now();
    if (a.pending > 0) openAllyChoices();
    else mpSend("cards", { list: null }, true);
  }

  function allyReroll() {
    var a = R.ally;
    if (!a || !a.choices || a.rerolls <= 0) return;
    a.rerolls--;
    B.ownAs(a, function () { a.choices = a.choiceKind === "shrine" ? B.rollBlessings() : B.rollChoices(); });
    sendCards();
  }

  B.choose = function (index) {
    if (R && R.mirror) return mirrorPick(index);
    if (!R || !R.choices || !R.choices[index]) return;
    PS.sfx.play("pick");
    B.takeUpgrade(R.choices[index]);
    R.choices = null;
    if (R.pending > 0) openChoices();
    else B.hud.choices(R);
    last = performance.now();
  };

  /** The dev menu took an upgrade by hand: that counts as the level-up pick. */
  B.devResolve = function () {
    if (!R || !R.choices) return;
    R.choices = null;
    if (R.pending > 0) openChoices();
    else B.hud.choices(R);
    last = performance.now();
  };

  B.reroll = function () {
    if (R && R.mirror) return mirrorReroll();
    if (!R || !R.choices || R.p.rerolls <= 0) return;
    R.p.rerolls--;
    R.choices = R.choiceKind === "shrine" ? B.rollBlessings() : B.rollChoices();
    B.hud.choices(R);
  };

  B.pause = function () {
    if (!R || R.paused || R.done || R.phase === "won" || R.phase === "lost") return;
    R.paused = true;
    stick.on = false;
    if (!R.mp) PS.music.duck(true);
    B.hud.paused(R);
  };

  B.resume = function () {
    if (!R || !R.paused) return;
    R.paused = false;
    last = performance.now();
    PS.music.duck(false);
    B.hud.paused(R);
  };

  /** Walk away from a battle: it counts as a loss at the time reached. */
  B.giveUp = function () {
    if (!R || R.done) return;
    if (R.mirror) return mirrorLeave();
    R.paused = false;
    PS.music.duck(false);
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
    if (R.duel) {
      var won = R.phase === "won";
      mpSend("end", { won: !won, wins: [R.duel.wins[1], R.duel.wins[0]], forfeit: Boolean(R.duel.forfeit) }, true);
      result = PS.state.finishDuel(won);
      result.wins = R.duel.wins.slice();
      result.foe = R.ally ? R.ally.name : R.duel.foeName;
      result.forfeit = Boolean(R.duel.forfeit);
      result.dealt = R.dealt;
      PS.emit("battle:end", result);
      return;
    }
    if (R.mp && R.ally) {
      // the other player's game banks its own share
      mpSend("end", {
        won: R.phase === "won", time: R.t, kills: R.kills, level: R.ally.level, coins: R.coins,
        boss: R.reachedBoss, combo: R.bestCombo, chapter: R.ch.n
      }, true);
    }
    if (R.mode === "swarm") {
      // endless: gold and the endless record only, no gear or progress
      var before = PS.state.get().endless.best;
      var rush = PS.state.rushNow();
      result = {
        rush: rush && rush.gold > 1 ? { gold: rush.gold, gems: 1 } : null, // endless pays gold only
        swarm: true, chapter: R.ch.n, won: false, time: R.t, kills: R.kills, level: R.p.level, items: [], gems: 0, unlocked: 0,
        gold: PS.state.paySwarm(R.ch.n, R.t, R.coins, { kills: R.kills, combo: R.bestCombo }),
        best: Math.max(before, R.t), newBest: R.t > before && R.t >= 10
      };
    } else {
      result = PS.state.finishRun({
        chapter: R.ch.n,
        won: R.phase === "won",
        time: R.t,
        kills: R.kills,
        level: R.p.level,
        coins: R.coins,
        boss: R.reachedBoss,
        combo: R.bestCombo,
        twist: R.twist ? R.twist.id : null
      });
    }
    result.dealt = R.dealt;
    result.combo = R.bestCombo;
    if (R.mp) {
      result.together = true;
      result.partner = R.mp.partnerName || "";
    }
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
      if (e.dead || e.prop || e.proxyOf === R.p || (ignore && ignore.indexOf(e) !== -1)) continue;
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
      if (e.dead || e.prop || e.proxyOf === R.p || (ignore && ignore.indexOf(e) !== -1)) continue;
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
      if (!e.dead && !e.prop && e.proxyOf !== R.p && dx * dx + dy * dy < range * range) return e;
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

  /** Where a point is, left to right of the lemon, for placing its sound (-1 to 1). */
  function panOf(x) {
    return Math.max(-1, Math.min(1, (x - R.p.x) / (view.w / 2)));
  }

  /** Damage one pest. Returns 0 if nothing happened, otherwise bit flags:
   *  1 hit · 2 critical · 4 killed.
   *  opts: dot (no crit, no number, no status) · knock + sx/sy (push away
   *  from a point, default the lemon) · stun (seconds). */
  B.hit = function (e, amount, opts) {
    if (e.dead || !(amount > 0)) return 0;
    if (e.proxyOf) return duelHit(e, amount, opts);
    var p = R.p;
    var fx = p.fx;
    var dot = opts && opts.dot;
    var dmg = cheatsOf(p).oneHit ? Math.max(amount, e.hp) : amount;
    var flags = 1;
    if (!dot && Math.random() < p.crit + p.mods.crit) {
      dmg *= p.critDmg + p.mods.critDmg;
      flags |= 2;
      // a little star where a critical lands
      if (gfx >= 1 && R.fx.length < 180) R.fx.push({ type: "crit", x: e.x, y: e.y - e.r * 0.3, spin: Math.random() * TAU, t: 0, dur: 0.2 });
    }
    if (e.shockT > 0) dmg *= 1 + e.shockAmp;
    if (fx.chillAmp && e.chillT > 0) dmg *= 1 + fx.chillAmp;
    if (p.bossDmg && (e.boss || e.elite)) dmg *= 1 + p.bossDmg;
    // a boss tires: the longer the fight drags on, the more each hit hurts it,
    // so a weak build gets a long fight rather than an endless one
    if (e.boss) dmg *= 1 + (e.age / 25) * (e.age / 25);
    // what really came off the pest: the meter, "damage dealt" and the results all count this
    var done = Math.min(dmg, Math.max(0, e.hp));
    R.dmgBy[R.src] = (R.dmgBy[R.src] || 0) + done;
    e.hp -= dmg;
    R.dealt += done;
    if (!dot) {
      // the hits as they float up, for the admin panel's average and biggest hit
      R.hitSum = (R.hitSum || 0) + dmg;
      R.hitN = (R.hitN || 0) + 1;
      if (dmg > (R.bestHit || 0)) R.bestHit = dmg;
    }

    if (!dot) {
      PS.sfx.play("hit", Boolean(flags & 2), panOf(e.x));
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
      if (R.texts.length < TEXT_CAP[gfx] && PS.prefs.get("numbers")) {
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
    if (e.prop) {
      // a crate, smashed: it opens instead of counting as a kill
      if (B.breakProp) B.breakProp(e);
      return;
    }
    R.kills++;
    // squash pests within a couple of seconds of each other to build a combo
    R.combo++;
    R.comboT = 2.2;
    if (R.combo > R.bestCombo) R.bestCombo = R.combo;
    PS.sfx.play("kill", R.combo, panOf(e.x));
    dropLoot(e);
    burstSparks(e.x, e.y, e.fill, e.boss ? 40 : e.elite ? 14 : 5, e.boss ? 220 : 90);
    if (e.golden && B.caughtGolden) B.caughtGolden(e);
    // a splat left on the ground, fading
    if (gfx >= 1) {
      R.splats.push({ x: e.x, y: e.y, r: e.r * (e.boss ? 1.6 : 1.25), color: e.fill, t: 0, seed: Math.random() * 6 });
      if (R.splats.length > 60) R.splats.shift();
    }

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
      var heal = Math.min(p.maxHp * fx.leech, p.maxHp * 0.03 - p.leeched);
      if (heal > 0) {
        p.leeched += heal;
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
      PS.sfx.play("boom", null, panOf(x));
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
    R.fx.push({ type: "arc", angle: aim, half: half, r: reach, color: (opts && opts.color) || "#FFFCF2", t: 0, dur: 0.22, ox: p.x, oy: p.y, own: p });
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
    R.fx.push({ type: "stab", angle: aim, len: length, width: width, color: (opts && opts.color) || "#FFFCF2", t: 0, dur: 0.2, ox: p.x, oy: p.y, own: p });
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
    if (points.length > 2) PS.sfx.play("zap", null, panOf(points[points.length - 2]));
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
      owner: R.p,
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
    var first = R.p;
    var p = R.p;
    var enemies = R.enemies;
    for (var i = R.shots.length - 1; i >= 0; i--) {
      var s = R.shots[i];
      if (R.players && s.owner && s.owner !== R.p) {
        // a shot hits with its own lemon's crits and effects, and a boomerang goes home to it
        own(s.owner);
        p = R.p;
      }
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
        // in a duel, a shot starts inside its own lemon's stand-in: it must fly through it
        if (e.dead || e.proxyOf === p || s.seen.indexOf(e) !== -1) continue;
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
      if (R.p !== first) {
        own(first);
        p = R.p;
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
    zone.owner = R.p;
    R.zones.push(zone);
    return zone;
  };

  function updateZones(dt) {
    var first = R.p;
    var p = R.p;
    var enemies = R.enemies;
    for (var i = R.zones.length - 1; i >= 0; i--) {
      var z = R.zones[i];
      if (R.p !== first) own(first);
      if (R.players && z.owner && z.owner !== R.p && z.type !== "puddle" && z.type !== "warn" && z.type !== "lane") own(z.owner);
      p = R.p;
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
        // slime on the ground: every lemon standing in it
        var standing = R.players || [p];
        for (j = 0; j < standing.length; j++) {
          var q = standing[j];
          if (q.down || q.gone) continue;
          dx = q.x - z.x;
          dy = q.y - z.y;
          if (dx * dx + dy * dy < z.r * z.r) {
            B.ownAs(q, function () { B.hurt(z.dps * dt); });
            q.slow = Math.max(q.slow, z.slow || 0);
          }
        }
      } else if (z.type === "warn") {
        // nothing until it lands
      }

      if (z.t >= z.life) {
        R.zones.splice(i, 1);
        if (z.onEnd) z.onEnd(z);
      }
    }
    if (R.p !== first) own(first);
    R.src = R.weaponId;
  }

  function updateEnemyShots(dt) {
    var list = R.players || [R.p];
    for (var i = R.ebullets.length - 1; i >= 0; i--) {
      var b = R.ebullets[i];
      // a hit can set off a burst that fells the boss, which clears every shot
      if (!b) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      for (var k = 0; k < list.length && b.life > 0; k++) {
        var q = list[k];
        if (q.down || q.gone) continue;
        var dx = q.x - b.x;
        var dy = q.y - b.y;
        var reach = b.r + q.r - 3;
        if (dx * dx + dy * dy < reach * reach) {
          B.ownAs(q, function () { B.hurt(b.dmg); });
          b.life = 0;
        }
      }
      if (b.life <= 0 && R.ebullets[i] === b) R.ebullets.splice(i, 1);
    }
  }

  /* -------------------------------------------------------------- pests */

  function updateEnemies(dt) {
    var first = R.p;
    var p = R.p;
    var list = R.enemies;
    var thorns = p.fx.thorns ? B.dmg() * p.fx.thorns * dt : 0;
    var far = view.ring + 330;
    var decay = Math.exp(-7 * dt);
    var frozen = anyCheat("freeze");
    var many = R.players && R.players.length > 1;

    for (var i = 0, n = list.length; i < n; i++) {
      var e = list[i];
      if (e.dead || e.proxyOf) continue;
      if (many) {
        // each pest goes after the lemon nearest to it
        var target = nearestPlayer(e.x, e.y);
        if (target !== R.p) {
          own(target);
          p = R.p;
          thorns = p.fx.thorns ? B.dmg() * p.fx.thorns * dt : 0;
        }
      }
      var dx = p.x - e.x;
      var dy = p.y - e.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;

      if (d > far && !e.boss) {
        if (e.prop) {
          // a crate left far behind just goes
          e.dead = true;
          continue;
        }
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
      } else if (!frozen) {
        B.think(e, dt, dx, dy, d);
        if (e.dead) continue;
      }

      if (d < e.r + p.r) {
        if (e.prop) {
          // bumping into a crate breaks it open
          B.hit(e, e.hp + 1, DOT);
          continue;
        }
        if (e.hurt) B.hurt(e.hurt * dt);
        if (thorns) B.as("thorns", function () { B.hit(e, thorns, DOT); });
        if (e.dead) continue;
      }

      // keep the swarm from stacking into a single dot
      for (var j = i + 1; j < n; j++) {
        if (list[j].proxyOf) continue;
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
    if (R.p !== first) own(first);
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
      p.xp += d.value * p.xpMul * cheatsOf(p).xpMul;
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
    } else if (d.type === "power" || d.type === "bomb") {
      if (B.collectSpecial) B.collectSpecial(d);
    }
  }

  function updateDrops(dt, hoover) {
    var first = R.p;
    var p = R.p;
    var list = R.drops;
    // the vacuum cheat pulls everything to the lemon that has it on
    var vacuum = null;
    if (R.players) {
      for (var v = 0; v < R.players.length && !vacuum; v++) {
        var q = R.players[v];
        if (!q.down && !q.gone && cheatsOf(q).vacuum) vacuum = q;
      }
    } else if (PS.dev.cheats.vacuum) {
      vacuum = R.p;
    }
    hoover = hoover || Boolean(vacuum);
    for (var i = list.length - 1; i >= 0; i--) {
      var d = list[i];
      if (R.players) {
        // each gem, coin or pickup heads for (and goes to) the lemon nearest it
        var taker = vacuum || nearestPlayer(d.x, d.y);
        if (taker !== R.p) own(taker);
        p = R.p;
      }
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
    if (R.p !== first) own(first);
    // never lose experience to the cap: the oldest gems just get banked
    while (list.length > 320) collect(list.shift());
  }

  /* ----------------------------------------------------------- particles */

  function burstSparks(x, y, fill, count, speed) {
    if (R.sparks.length > SPARK_CAP[gfx]) return;
    count = Math.max(1, Math.round(count * SPARK_SCALE[gfx]));
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
    for (i = R.splats.length - 1; i >= 0; i--) {
      R.splats[i].t += dt;
      if (R.splats[i].t > 4) R.splats.splice(i, 1);
    }
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

  /* ---------------------------------------------------- playing together */
  /* Two games, one battle. The game that made the room (the host) runs the
     whole battle with both lemons in it; the other (the guest) shows what the
     host sends it a dozen or so times a second, moves its own lemon straight
     away so it feels quick, and sends back where it is steering. multi.js
     sets B.mpHooks.send to carry messages between the two. */

  B.mpHooks = { send: null };

  function mpSend(type, data, sure) {
    if (R && R.mp && B.mpHooks.send) B.mpHooks.send(type, data, sure);
  }

  /** A word for each player: what this game shows, and what the other one does. */
  function mpToast(here, there, seconds) {
    B.toast(here, seconds);
    if (R.mp) {
      R.gToast = there;
      R.gToastUntil = R.t + (seconds || 2.6);
    }
  }

  function num(v, fallback) {
    v = Number(v);
    return isFinite(v) ? v : fallback;
  }

  /** The other player's lemon, built from what their game says it brings. */
  function lemonFrom(load) {
    var raw = load && load.stats ? load.stats : {};
    var stats = {
      atk: Math.max(1, num(raw.atk, 2)), hp: Math.max(1, num(raw.hp, 30)), crit: num(raw.crit, 0.05), critDmg: num(raw.critDmg, 1.5),
      haste: num(raw.haste, 0), speed: num(raw.speed, 0), armor: Math.min(PS.BAL.ARMOR_CAP || 0.6, num(raw.armor, 0)), regen: num(raw.regen, 0),
      magnet: num(raw.magnet, 0), xp: num(raw.xp, 0), luck: num(raw.luck, 0), area: num(raw.area, 0), bossDmg: num(raw.bossDmg, 0),
      fx: raw.fx && typeof raw.fx === "object" ? raw.fx : {}, weapon: B.WEAPONS[raw.weapon] ? raw.weapon : "sling"
    };
    var q = makePlayer(stats);
    q.weaponId = stats.weapon;
    q.weapon = B.WEAPONS[stats.weapon];
    q.outfit = load && load.outfit && typeof load.outfit === "object" ? load.outfit : {};
    q.name = String((load && load.name) || "Friend").slice(0, 16);
    q.petTeam = (load && Array.isArray(load.pets) ? load.pets : []).filter(function (pet) {
      return pet && PS.PET[pet.sp] && PS.PET_RARITY[pet.r];
    }).slice(0, 3).map(function (pet) {
      return { sp: pet.sp, r: pet.r, lv: Math.max(1, Math.min(PS.PET_RARITY[pet.r].cap, Math.round(num(pet.lv, 1)))) };
    });
    return q;
  }

  /** Set a battle up for two: this game's lemon and the other player's. */
  function startTogether(mp) {
    var host = R.p;
    var a = lemonFrom(mp.ally);
    a.remote = true;
    a.input = { x: 0, y: 0 };
    a.pending = a.fx.startUp || 0;
    a.cheats = noCheats(); // the other player's own, switched on only once the server says they are an admin
    R.mp = {
      kind: mp.kind, host: true, partnerName: a.name, rate: mp.relay ? 160 : 33, sentAt: 0, link: mp.relay ? "room" : "direct", ping: 0,
      allyAdmin: false
    };
    host.x = -40;
    a.x = 40;
    R.players = [host, a];
    R.ally = a;
    R.partner = a;
    if (mp.kind === "duel") setupDuel(mp);
    else R.mpMul = { pests: 1.6, boss: 1.8, horde: 1.5 };
  }

  /* A lemon that is down waits for the other to come and stand by it. */
  var HELP_REACH = 48;
  var HELP_TIME = 3;

  function tendDowned(q, dt) {
    q.vx = q.vy = 0;
    q.moving = false;
    q.flash = Math.max(0, q.flash - dt);
    var helped = false;
    for (var i = 0; i < R.players.length; i++) {
      var o = R.players[i];
      if (o === q || o.down || o.gone) continue;
      var dx = o.x - q.x;
      var dy = o.y - q.y;
      if (dx * dx + dy * dy < HELP_REACH * HELP_REACH) helped = true;
    }
    q.reviveT = helped ? q.reviveT + dt : Math.max(0, q.reviveT - dt * 0.5);
    if (q.reviveT >= HELP_TIME) {
      q.down = false;
      q.reviveT = 0;
      q.hp = q.maxHp * 0.4;
      q.invuln = 2;
      R.fx.push({ type: "ring", x: q.x, y: q.y, r0: 10, r1: 70, color: "#9BE08A", width: 6, t: 0, dur: 0.5 });
      PS.sfx.play("revive");
      mpToast(q === R.players[0] ? "Back on your feet!" : q.name + " is back up!", q === R.players[0] ? R.players[0].name + " is back up!" : "Back on your feet!");
    }
  }

  function knockedDown(q) {
    q.down = true;
    q.reviveT = 0;
    q.dashT = 0;
    q.choices = q === R.players[0] ? q.choices : null;
    burstSparks(q.x, q.y, P.lemon, 14, 130);
    PS.sfx.play("hurt");
    var up = R.players.filter(function (o) { return !o.down && !o.gone; });
    if (!up.length) {
      R.phase = "lost";
      PS.sfx.play("lose");
      R.over = 1.4;
      return;
    }
    var me = q === R.players[0];
    mpToast(me ? "You're down! Your friend can help you up" : q.name + " is down! Stand next to them to help them up",
      me ? q.name + " is down! Stand next to them to help them up" : "You're down! Your friend can help you up", 3.5);
  }

  /* -------------------------------------------------------- the duel */
  /* Two lemons in a walled ring, best of three rounds. Equal makes both
     lemons as strong as each other, so only weapons, perks and upgrades
     differ; Full power uses the real figures, with the damage between lemons
     cut down so a round still lasts. A few weak pests wander in for XP. */
  var DUEL = { r: 420, round: 90, hold: 2.6, atk: 40, hp: 2400, cap: 0.12, full: 0.35 };
  B.DUEL = DUEL;

  function setupDuel(mp) {
    R.duel = { mode: mp.duelMode === "full" ? "full" : "equal", round: 1, wins: [0, 0], roundT: 0, hold: 0, foeName: R.ally.name, forfeit: false };
    R.dur = Infinity;
    var both = R.players;
    if (R.duel.mode === "equal") {
      both.forEach(function (q) {
        q.atk = DUEL.atk;
        q.maxHp = q.hp = q.baseHp = DUEL.hp;
        q.barrierMax = q.barrier = q.maxHp * (q.fx.barrier || 0);
      });
    }
    both[0].foe = both[1];
    both[1].foe = both[0];
    both.forEach(function (q) {
      q.revives = Math.min(q.revives, 1);
      q.startRevives = q.revives;
      q.proxy = {
        kind: "lemon", proxyOf: q, id: ++R.uid, x: q.x, y: q.y, r: 13, hp: 1, maxHp: 1, mass: 1e6, dead: false,
        speed: 0, hurt: 0, xp: 0, flash: 0, kx: 0, ky: 0, stun: 0, chillT: 0, chillAmt: 0, burnT: 0, burnDps: 0,
        shockT: 0, shockAmp: 0, freezeCd: 0, mode: 0, clock: 0, wob: 0
      };
      R.enemies.push(q.proxy);
    });
    placeForRound();
  }

  function placeForRound() {
    var both = R.players;
    both.forEach(function (q, i) {
      q.x = i === 0 ? -170 : 170;
      q.y = 0;
      q.hp = q.maxHp;
      q.barrier = q.barrierMax;
      q.invuln = 1.2;
      q.down = false;
      q.dashT = 0;
      q.buffs = {};
      q.revives = q.startRevives || 0;
    });
    R.shots.length = 0;
    R.ebullets.length = 0;
    R.zones.length = 0;
    R.timers.length = 0;
    syncProxies();
  }

  function syncProxies() {
    for (var i = 0; i < R.players.length; i++) {
      var q = R.players[i];
      if (!q.proxy) continue;
      q.proxy.x = q.x;
      q.proxy.y = q.y;
      q.proxy.dead = false;
    }
  }

  function duelTick(dt) {
    // the ring's wall keeps both lemons in
    for (var i = 0; i < R.players.length; i++) {
      var q = R.players[i];
      var d = Math.sqrt(q.x * q.x + q.y * q.y);
      var room = DUEL.r - q.r;
      if (d > room) {
        q.x *= room / d;
        q.y *= room / d;
      }
    }
    syncProxies();
    R.duel.roundT += dt;
    if (R.duel.roundT >= DUEL.round) {
      // out of time: the lemon with more health left takes the round
      var a = R.players[0];
      var b = R.players[1];
      duelRoundOver(a.hp / a.maxHp < b.hp / b.maxHp ? a : b);
    }
  }

  /** A hit on the other lemon. Works like a hit on a pest, then hurts that lemon. */
  function duelHit(e, amount, opts) {
    var target = e.proxyOf;
    var p = R.p;
    if (!R.duel || target === p || target.down || target.gone || R.duel.hold > 0 || R.phase !== "swarm") return 0;
    var dot = opts && opts.dot;
    var dmg = amount;
    var flags = 1;
    if (!dot && Math.random() < p.crit + p.mods.crit) {
      dmg *= p.critDmg + p.mods.critDmg;
      flags |= 2;
    }
    if (R.duel.mode === "full") dmg *= DUEL.full;
    dmg = Math.min(dmg, target.maxHp * DUEL.cap);
    var before = Math.max(0, target.hp) + target.barrier;
    B.ownAs(target, function () { B.hurt(dmg); });
    var done = Math.max(0, before - (Math.max(0, target.hp) + target.barrier));
    if (!(done > 0)) return 0;
    R.dmgBy[R.src] = (R.dmgBy[R.src] || 0) + done;
    R.dealt += done;
    if (!dot && R.texts.length < TEXT_CAP[gfx] && PS.prefs.get("numbers")) {
      B.text(target.x, target.y - 22, PS.fmt(Math.max(1, Math.round(done))), flags & 2 ? "#FFE66D" : "#FF9A8A", flags & 2 ? 15 : 12);
    }
    return flags;
  }

  function duelRoundOver(loser) {
    var d = R.duel;
    if (d.hold > 0 || R.phase !== "swarm") return;
    var wi = R.players.indexOf(loser) === 0 ? 1 : 0;
    var winner = R.players[wi];
    d.wins[wi]++;
    loser.hp = Math.max(0, loser.hp);
    burstSparks(loser.x, loser.y, P.lemon, 18, 150);
    R.shake = Math.max(R.shake, 8);
    var hostWon = wi === 0;
    if (d.wins[wi] >= 2) {
      R.phase = hostWon ? "won" : "lost";
      PS.sfx.play(hostWon ? "win" : "lose");
      R.over = 2.4;
      mpToast(hostWon ? "You win the duel!" : winner.name + " wins the duel!", hostWon ? winner.name + " wins the duel!" : "You win the duel!", 3);
      return;
    }
    d.hold = DUEL.hold;
    PS.sfx.play("boss");
    var score = d.wins[0] + " – " + d.wins[1];
    mpToast((hostWon ? "You take round " : winner.name + " takes round ") + d.round + " · " + score,
      (hostWon ? winner.name + " takes round " : "You take round ") + d.round + " · " + d.wins[1] + " – " + d.wins[0], d.hold);
  }

  function nextRound() {
    R.duel.round++;
    R.duel.roundT = 0;
    placeForRound();
    mpToast("Round " + R.duel.round + "!", "Round " + R.duel.round + "!", 1.6);
  }

  /* ------------------------------------------ the host: what it sends */

  function r1(v) { return Math.round(v * 10) / 10; }
  function r2(v) { return Math.round(v * 100) / 100; }

  function lemonState(q) {
    var buffs = {};
    for (var key in q.buffs) if (q.buffs[key] > 0) buffs[key] = r1(q.buffs[key]);
    var speed = q.moveSpeed * q.mods.speed * (1 - q.slow) * cheatsOf(q).moveMul * (q.buffs.swift > 0 ? 1.45 : 1);
    return {
      x: r1(q.x), y: r1(q.y), hp: Math.round(q.hp), mh: Math.round(q.maxHp), ba: Math.round(q.barrier), bm: Math.round(q.barrierMax),
      lv: q.level, xp: r1(q.xp), nd: q.need, am: r2(q.aim), mv: q.moving ? 1 : 0, fl: r2(q.flash), iv: r2(q.invuln), sw: r2(q.swing),
      dT: r2(q.dashT), dX: r2(q.dashX), dY: r2(q.dashY), dc: r2(q.dashCd), dcf: r2(B.DASH.cd * q.mods.dash),
      bu: buffs, up: q.up, od: q.order || [], ar: r2(q.area + q.mods.area), sp: Math.round(speed),
      fa: [q.fx.auraChill || 0, q.fx.auraBurn || 0], bb: q.bubble ? 1 : 0, bam: r2(q.beamAngle || 0), hd: (q.timers && q.timers.hand) || 0,
      dn: q.down ? 1 : 0, gn: q.gone ? 1 : 0, rv: r2(q.reviveT), rr: q.rerolls, wid: q.weaponId,
      mi: (q.mines || []).map(function (m) { return [r1(m.x), r1(m.y), r1(m.t)]; })
    };
  }

  var ENEMY_KEYS = ["kind", "r", "fill", "flash", "mode", "clock", "wob", "elite", "trait", "boss", "spin", "ax", "ay", "fade",
    "under", "lift", "golden", "prop", "style", "name", "tier", "chillT", "burnT", "shockT", "stun", "escape"];

  function enemyState(e) {
    var o = { i: e.id, x: r1(e.x), y: r1(e.y) };
    for (var k = 0; k < ENEMY_KEYS.length; k++) {
      var key = ENEMY_KEYS[k];
      var v = e[key];
      if (v === undefined || v === null || v === 0 || v === false || v === "") continue;
      o[key] = typeof v === "number" ? r2(v) : v;
    }
    if (e.boss || e.elite || e.golden) {
      o.hp = Math.round(e.hp);
      o.mh = Math.round(e.maxHp);
    }
    if (e.boss && e.look) o.look = e.look;
    if (e.trail && e.trail.length) o.trail = e.trail.map(function (t) { return t && typeof t === "object" ? { x: r1(t.x), y: r1(t.y) } : t; });
    return o;
  }

  function sendSnapshot(now) {
    var M = R.mp;
    if (!M || !M.host || R.done || !R.ally || R.ally.gone) return;
    if (now - M.sentAt < M.rate) return;
    M.sentAt = now;
    var g = R.ally;
    var far = 900 * 900;
    function near(x, y) {
      var dx = x - g.x;
      var dy = y - g.y;
      return dx * dx + dy * dy < far;
    }
    var i;
    var snap = {
      t: r2(R.t), ph: R.phase, k: R.kills, co: R.coins, cb: R.combo, cbt: r2(R.comboT),
      me: lemonState(g), pa: lemonState(R.players[0]), ack: g.ack,
      to: R.gToastUntil > R.t ? R.gToast : R.toast, toT: r1(R.gToastUntil > R.t ? R.gToastUntil - R.t : R.toastT),
      wt: R.choices ? R.players[0].name + " is picking an upgrade..." : "",
      e: [], s: [], z: [], b: [], d: [], fx: [], tx: [], pt: [], bs: null, bo: R.boss ? R.boss.id : 0
    };
    for (i = 0; i < R.enemies.length && snap.e.length < 240; i++) {
      var e = R.enemies[i];
      if (e.dead || e.proxyOf || (!e.boss && !near(e.x, e.y))) continue;
      snap.e.push(enemyState(e));
    }
    if (R.bosses) snap.bs = R.bosses.map(function (b) { return b.dead ? -b.id : b.id; });
    for (i = 0; i < R.shots.length && snap.s.length < 170; i++) {
      var sh = R.shots[i];
      if (!near(sh.x, sh.y)) continue;
      snap.s.push([r1(sh.x), r1(sh.y), Math.round(sh.vx), Math.round(sh.vy), r1(sh.r), sh.sprite, sh.color, r2(sh.age), r2(sh.life), r2(sh.rot), r1(sh.spin)]);
    }
    for (i = 0; i < R.zones.length; i++) {
      var z = R.zones[i];
      if (!near(z.x, z.y)) continue;
      snap.z.push({ type: z.type, x: r1(z.x), y: r1(z.y), r: r1(z.r), t: r2(z.t), life: r2(z.life), color: z.color, core: z.core,
        angle: z.angle, len: z.len, width: z.width, web: z.web, dust: z.dust });
    }
    for (i = 0; i < R.ebullets.length && snap.b.length < 140; i++) {
      var b = R.ebullets[i];
      if (!near(b.x, b.y)) continue;
      snap.b.push([r1(b.x), r1(b.y), Math.round(b.vx), Math.round(b.vy), r1(b.r), b.color]);
    }
    for (i = 0; i < R.drops.length && snap.d.length < 220; i++) {
      var d = R.drops[i];
      if (!near(d.x, d.y)) continue;
      snap.d.push([d.type, r1(d.x), r1(d.y), d.value, r1(d.t)]);
    }
    for (i = 0; i < R.fx.length && snap.fx.length < 70; i++) {
      var f = R.fx[i];
      if (f.sent) continue;
      f.sent = true;
      var fxx = f.x !== undefined ? f.x : f.ox !== undefined ? f.ox : f.x0;
      var fxy = f.y !== undefined ? f.y : f.oy !== undefined ? f.oy : f.y0;
      if (fxx !== undefined && !near(fxx, fxy)) continue;
      var copy = {};
      for (var key in f) if (key !== "own" && key !== "sent") copy[key] = f[key];
      if (f.own) copy.own = R.players.indexOf(f.own);
      snap.fx.push(copy);
    }
    for (i = 0; i < R.texts.length && snap.tx.length < 24; i++) {
      var t = R.texts[i];
      if (t.sent) continue;
      t.sent = true;
      if (near(t.x, t.y)) snap.tx.push([r1(t.x), r1(t.y), t.str, t.color, t.size, r2(t.life)]);
    }
    var pets = R.pets || [];
    for (i = 0; i < pets.length; i++) {
      var pet = pets[i];
      snap.pt.push([pet.sp, pet.r, pet.lv, r1(pet.x), r1(pet.y), pet.face, r2(pet.bob), R.players.indexOf(pet.owner)]);
    }
    if (R.shrine) snap.sr = { x: r1(R.shrine.x), y: r1(R.shrine.y), r: R.shrine.r, charge: r2(R.shrine.charge), life: r1(R.shrine.life), t: r2(R.shrine.t), inside: R.shrine.inside };
    if (R.duel) snap.du = { r: R.duel.round, w: [R.duel.wins[1], R.duel.wins[0]], t: r1(R.duel.roundT), h: r1(R.duel.hold), m: R.duel.mode };
    mpSend("s", snap, false);
  }

  /* ------------------------------------------ the host: what it hears */

  /** Where the other player is steering. */
  B.mpInput = function (m) {
    if (!R || R.mirror || !R.ally || !m) return;
    var x = PS.clamp(num(m.x, 0), -1, 1);
    var y = PS.clamp(num(m.y, 0), -1, 1);
    R.ally.input = { x: x, y: y };
    R.ally.ack = Math.max(R.ally.ack, Math.round(num(m.q, 0)));
  };
  B.mpDash = function () {
    if (!R || R.mirror || !R.ally || R.ally.down) return;
    B.ownAs(R.ally, function () { B.dash(); });
  };
  B.mpPick = function (m) {
    if (R && !R.mirror) allyPick(Math.round(num(m && m.i, -1)));
  };
  B.mpReroll = function () {
    if (R && !R.mirror) allyReroll();
  };
  B.mpCardsAgain = function () {
    if (R && !R.mirror) sendCards();
  };
  /** How the two games are linked: directly, or through the server (sends less often). */
  B.mpSetLink = function (link) {
    if (!R || !R.mp) return;
    // directly: thirty updates a second; through the server it allows only about ten
    R.mp.link = link;
    R.mp.rate = link === "direct" ? 33 : 160;
    R.mp.inGap = link === "direct" ? 0.033 : 0.1;
  };
  /** The round trip between the two games, in milliseconds (shown in the HUD). */
  B.mpSetPing = function (ms) {
    if (R && R.mp) R.mp.ping = ms;
  };

  /* The other player's dev menu. Their game sends what they press; this game
     runs it on their lemon, but only once the server has said (multi.js asks)
     that they play on an admin account. */
  B.mpAllyAdmin = function (ok) {
    if (!R || R.mirror || !R.mp || !R.ally) return;
    R.mp.allyAdmin = Boolean(ok);
    if (!ok) R.ally.cheats = noCheats();
    mpSend("devok", { ok: Boolean(ok) }, true);
  };
  B.mpDevCheats = function (m) {
    if (!R || R.mirror || !R.ally || !R.mp || !R.mp.allyAdmin) return;
    R.ally.cheats = cleanCheats(m && m.cheats);
  };
  B.mpDev = function (m) {
    if (!R || R.mirror || !R.ally || !R.mp || !m || !B.devPanel) return;
    var note = R.mp.allyAdmin ? B.devPanel.runFor(R.ally, m) : "This game could not confirm your admin account, so it did nothing.";
    if (note) mpSend("devnote", { note: String(note).slice(0, 200) }, true);
  };
  /** Sending from this game's own dev menu, playing together as the guest. */
  B.mpDevSend = function (type, data) {
    mpSend(type, data, true);
  };
  /** The dev menu's "Pick" for the other player's lemon: it counts as their card choice. */
  B.devResolveAlly = function () {
    var a = R && R.ally;
    if (!a || !a.choices) return;
    a.choices = null;
    if (a.pending > 0) openAllyChoices();
    else mpSend("cards", { list: null }, true);
  };

  /** The other player has gone (closed the game, or lost the connection). */
  B.mpPartnerLeft = function () {
    if (!R || !R.mp || R.done) return;
    if (R.mirror) {
      mirrorEnd({ won: false, left: true });
      return;
    }
    var a = R.ally;
    if (!a || a.gone) return;
    a.gone = true;
    a.down = true;
    a.choices = null;
    if (R.pets) R.pets = R.pets.filter(function (pet) { return pet.owner !== a; });
    if (R.duel) {
      // walking out of a duel hands it to the one who stayed
      R.duel.forfeit = true;
      if (a.proxy) a.proxy.dead = true;
      if (R.phase === "swarm") {
        R.phase = "won";
        R.over = 1.2;
        PS.sfx.play("win");
      }
      B.toast(a.name + " left the duel. You win!", 3);
      return;
    }
    B.toast(a.name + " left. Keep going on your own!", 3.5);
  };

  /* ------------------------------------------ the guest: showing the battle */

  /** The guest's side of a battle together. `info`: what the host sent at the start. */
  B.startGuest = function (info) {
    var ch = PS.chapter(info.chapter);
    calm = PS.reducedMotion() || !PS.prefs.get("shake");
    applyPrefs();
    var cheats = PS.dev.cheats;
    for (var off in cheats) cheats[off] = typeof cheats[off] === "number" ? 1 : false;
    var stats = PS.state.calc();
    var me = makePlayer(stats);
    me.outfit = B.outfitOf();
    me.weaponId = stats.weapon;
    me.weapon = B.WEAPONS[stats.weapon];
    me.name = info.myName || "You";
    me.x = 40;
    me.speedNow = me.moveSpeed;
    var pa = lemonFrom(info.host);
    pa.x = -40;
    if (info.kind === "duel") {
      me.x = 170;
      pa.x = -170;
    }
    me.tx = me.x;
    me.ty = me.y;
    pa.tx = pa.x;
    pa.ty = pa.y;
    R = B.run = {
      mirror: true, ch: ch, zone: PS.ZONES[ch.zone], weaponId: me.weaponId, weapon: me.weapon, src: me.weaponId, dmgBy: {},
      mode: info.kind === "duel" ? "duel" : "normal",
      t: 0, dur: info.kind === "duel" ? Infinity : ch.duration, phase: "swarm", over: 0, done: false,
      p: me, partner: pa, players: [me, pa], ally: null,
      enemies: [], shots: [], zones: [], ebullets: [], drops: [], sparks: [], texts: [], fx: [], timers: [], splats: [],
      kills: 0, combo: 0, comboT: 0, bestCombo: 0, coins: 0, dealt: 0,
      boss: null, bosses: null, reachedBoss: false, paused: false, choices: null, choiceKind: null,
      shake: 0, procs: 0, toast: "", toastT: 0, twist: null, hurtMul: 1, pestMul: null, pets: [], shrine: null,
      mp: {
        kind: info.kind, host: false, partnerName: pa.name, seq: 0, sendT: 0, hist: [], lastSnap: performance.now(), byId: {}, petsBy: {}, lastToast: "",
        link: info.link || "room", inGap: info.link === "direct" ? 0.033 : 0.1, ping: 0,
        devOk: null // whether the host's game takes this player's dev menu: null until it says
      },
      duel: info.kind === "duel" ? { mode: info.duelMode === "full" ? "full" : "equal", round: 1, wins: [0, 0], roundT: 0, hold: 0 } : null,
      waitText: "", uid: 0
    };
    keys = Object.create(null);
    stick.on = false;
    resize();
    B.hud.begin(R);
    cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(frame);
    return R;
  };

  /** Moving the guest's own lemon at once, sending where it steers, and
   *  easing everything else towards where the host last said it was. */
  function stepMirror(dt) {
    var M = R.mp;
    var me = R.p;
    var playing = (R.phase === "swarm" || R.phase === "boss") && !R.done;
    if (playing) R.t += dt;
    var free = playing && !me.down && !me.gone && !R.choices && !(R.duel && R.duel.hold > 0) && !R.waitText;
    var move = free ? steering() : null;
    me.moving = Boolean(move) || me.dashT > 0;
    if (me.dashT > 0 && free) {
      var dashSpeed = B.DASH.dist / B.DASH.time;
      var slide = Math.min(dt, me.dashT);
      me.dashT -= dt;
      me.x += me.dashX * dashSpeed * slide;
      me.y += me.dashY * dashSpeed * slide;
      if (gfx >= 1 && R.fx.length < 180) R.fx.push({ type: "ghost", x: me.x, y: me.y, t: 0, dur: 0.28 });
    } else if (move) {
      var speed = (me.speedNow || me.moveSpeed) * move.mag;
      me.x += move.x * speed * dt;
      me.y += move.y * speed * dt;
      me.faceX = move.x;
      me.faceY = move.y;
    }
    if (R.duel) {
      var d0 = Math.sqrt(me.x * me.x + me.y * me.y);
      if (d0 > DUEL.r - me.r) {
        me.x *= (DUEL.r - me.r) / d0;
        me.y *= (DUEL.r - me.r) / d0;
      }
    }
    me.dashCd = Math.max(0, me.dashCd - dt);
    me.flash = Math.max(0, me.flash - dt);
    me.swing = Math.max(0, me.swing - dt);
    me.spin += dt * 3.2;
    // where this lemon is steering: thirty times a second directly, ten through the server
    M.sendT += dt;
    if (M.sendT >= (M.inGap || 0.05)) {
      M.sendT = 0;
      M.seq++;
      mpSend("in", { q: M.seq, x: move ? r2(move.x * move.mag) : 0, y: move ? r2(move.y * move.mag) : 0 }, false);
      M.hist.push({ q: M.seq, x: me.x, y: me.y });
      if (M.hist.length > 80) M.hist.shift();
    }

    // quick to catch up, so what is shown lags as little as possible
    var k = 1 - Math.exp(-22 * dt);
    var i;
    for (i = 0; i < R.enemies.length; i++) {
      var e = R.enemies[i];
      e.x += (e.tx - e.x) * k;
      e.y += (e.ty - e.y) * k;
      e.flash = Math.max(0, e.flash - dt);
    }
    var pa = R.partner;
    pa.x += (pa.tx - pa.x) * k;
    pa.y += (pa.ty - pa.y) * k;
    pa.flash = Math.max(0, pa.flash - dt);
    pa.swing = Math.max(0, pa.swing - dt);
    pa.spin += dt * 3.2;
    for (i = 0; i < R.pets.length; i++) {
      var pet = R.pets[i];
      pet.x += (pet.tx - pet.x) * k;
      pet.y += (pet.ty - pet.y) * k;
      pet.bob += dt * 4;
    }
    for (i = 0; i < R.shots.length; i++) {
      var sh = R.shots[i];
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      sh.age += dt;
      sh.rot += sh.spin * dt;
    }
    for (i = 0; i < R.ebullets.length; i++) {
      R.ebullets[i].x += R.ebullets[i].vx * dt;
      R.ebullets[i].y += R.ebullets[i].vy * dt;
    }
    for (i = 0; i < R.drops.length; i++) R.drops[i].t += dt;
    for (i = 0; i < R.zones.length; i++) R.zones[i].t += dt;
    if (R.shrine) R.shrine.t += dt;
    updateFx(dt);
    // no word from the host for a long while: it has gone
    if (!R.done && performance.now() - M.lastSnap > 10000) mirrorEnd({ won: false, left: true });
  }

  function takeLemon(q, d, mine) {
    if (!d) return;
    if (!mine) {
      q.tx = d.x;
      q.ty = d.y;
      if (Math.abs(q.tx - q.x) > 300 || Math.abs(q.ty - q.y) > 300) {
        q.x = q.tx;
        q.y = q.ty;
      }
      q.aim = d.am;
      q.moving = Boolean(d.mv);
      q.dashT = d.dT;
      q.swing = Math.max(q.swing, d.sw);
    }
    if (mine && d.lv > q.level && q.level > 0) PS.sfx.play("gem");
    q.hp = d.hp;
    q.maxHp = d.mh;
    q.barrier = d.ba;
    q.barrierMax = d.bm;
    q.level = d.lv;
    q.xp = d.xp;
    q.need = d.nd;
    if (d.fl > q.flash) q.flash = d.fl;
    q.invuln = d.iv;
    q.buffs = d.bu || {};
    q.area = d.ar;
    q.mods.area = 0;
    q.mods.dash = d.dcf / B.DASH.cd;
    q.speedNow = d.sp;
    q.fx.auraChill = d.fa ? d.fa[0] : 0;
    q.fx.auraBurn = d.fa ? d.fa[1] : 0;
    q.bubble = Boolean(d.bb);
    q.beamAngle = d.bam;
    q.timers.hand = d.hd;
    q.down = Boolean(d.dn);
    q.gone = Boolean(d.gn);
    q.reviveT = d.rv;
    q.rerolls = d.rr;
    q.mines = (d.mi || []).map(function (m) { return { x: m[0], y: m[1], t: m[2] }; });
    if (d.wid && d.wid !== q.weaponId && B.WEAPONS[d.wid]) {
      q.weaponId = d.wid;
      q.weapon = B.WEAPONS[d.wid];
      if (q === R.p) {
        R.weaponId = d.wid;
        R.weapon = q.weapon;
      }
    }
    var sig = JSON.stringify(d.od) + JSON.stringify(d.up);
    q.up = d.up || {};
    q.order = d.od || [];
    if (mine && sig !== q.upSig) {
      q.upSig = sig;
      B.hud.build(R);
    }
  }

  var BLANK_ENEMY = {
    kind: "grunt", r: 10, fill: "#8FAE65", flash: 0, mode: 0, clock: 1, wob: 0, elite: false, trait: null, boss: false, spin: 0,
    ax: 0, ay: 0, fade: 0, under: false, lift: 0, golden: false, prop: false, style: 0, name: "", tier: 0,
    chillT: 0, burnT: 0, shockT: 0, stun: 0, hp: 1, maxHp: 1, dead: false, kx: 0, ky: 0, chillAmt: 0, burnDps: 0, shockAmp: 0, freezeCd: 0
  };

  /** A snapshot from the host: the whole battle, as far as this lemon can see it. */
  B.mirrorSnapshot = function (s) {
    if (!R || !R.mirror || R.done || !s) return;
    var M = R.mp;
    M.lastSnap = performance.now();
    var before = R.phase;
    R.t = s.t;
    R.phase = s.ph;
    R.kills = s.k;
    R.coins = s.co;
    R.combo = s.cb;
    R.comboT = s.cbt;
    if (R.combo > R.bestCombo) R.bestCombo = R.combo;
    if (s.to && s.to !== M.lastToast && s.toT > 0) {
      R.toast = s.to;
      R.toastT = s.toT;
    }
    M.lastToast = s.to;
    R.waitText = s.wt || "";
    if (s.ph === "boss" && before !== "boss") {
      PS.sfx.play("boss");
      PS.music.play("boss");
      R.reachedBoss = true;
      R.shake = Math.max(R.shake, 14);
    }
    if (s.ph === "won" && before !== "won") PS.sfx.play("win");
    if (s.ph === "lost" && before !== "lost") PS.sfx.play("lose");
    if (R.duel && s.du) {
      R.duel.round = s.du.r;
      R.duel.wins = s.du.w;
      R.duel.roundT = s.du.t;
      R.duel.hold = s.du.h;
    }

    // this lemon: where the host has it, compared with where it was when the
    // host last heard from it, and the difference put right gently
    var me = R.p;
    takeLemon(me, s.me, true);
    var seen = null;
    while (M.hist.length && M.hist[0].q <= s.ack) seen = M.hist.shift();
    if (seen) {
      var ex = s.me.x - seen.x;
      var ey = s.me.y - seen.y;
      if (ex * ex + ey * ey > 140 * 140 || me.down) {
        me.x = s.me.x;
        me.y = s.me.y;
        M.hist.length = 0;
      } else {
        me.x += ex * 0.35;
        me.y += ey * 0.35;
        for (var h = 0; h < M.hist.length; h++) {
          M.hist[h].x += ex * 0.35;
          M.hist[h].y += ey * 0.35;
        }
      }
    } else if (me.down || Math.abs(s.me.x - me.x) > 160 || Math.abs(s.me.y - me.y) > 160) {
      me.x = s.me.x;
      me.y = s.me.y;
    }
    takeLemon(R.partner, s.pa, false);

    // the pests: kept by number, so each one eases from where it was
    var byId = M.byId;
    var fresh = {};
    var list = [];
    var i;
    for (i = 0; i < s.e.length; i++) {
      var d = s.e[i];
      var e = byId[d.i];
      if (!e) {
        e = {};
        for (var key in BLANK_ENEMY) e[key] = BLANK_ENEMY[key];
        e.x = d.x;
        e.y = d.y;
        e.id = d.i;
        e.wob = Math.random() * TAU;
      }
      for (var k2 in BLANK_ENEMY) {
        if (k2 === "dead" || k2 === "x" || k2 === "y") continue;
        if (d[k2] !== undefined) e[k2] = d[k2];
        else if (k2 !== "wob" && k2 !== "hp" && k2 !== "maxHp" && k2 !== "kx" && k2 !== "ky") e[k2] = BLANK_ENEMY[k2];
      }
      if (d.hp !== undefined) {
        e.hp = d.hp;
        e.maxHp = d.mh;
      }
      if (d.look) e.look = d.look;
      e.trail = d.trail || null;
      e.tx = d.x;
      e.ty = d.y;
      fresh[d.i] = e;
      list.push(e);
    }
    // whatever is gone and was close by was squashed: a little burst
    for (var id in byId) {
      if (fresh[id]) continue;
      var gone = byId[id];
      var dx = gone.x - me.x;
      var dy = gone.y - me.y;
      if (!gone.prop && dx * dx + dy * dy < 520 * 520) {
        burstSparks(gone.x, gone.y, gone.fill, gone.boss ? 40 : gone.elite ? 14 : 5, gone.boss ? 220 : 90);
        if (gfx >= 1) {
          R.splats.push({ x: gone.x, y: gone.y, r: gone.r * (gone.boss ? 1.6 : 1.25), color: gone.fill, t: 0, seed: Math.random() * 6 });
          if (R.splats.length > 60) R.splats.shift();
        }
        PS.sfx.play("kill", R.combo, Math.max(-1, Math.min(1, dx / (view.w / 2))));
      }
    }
    M.byId = fresh;
    R.enemies = list;
    if (s.bs) {
      R.bosses = s.bs.map(function (bid) {
        var b = fresh[Math.abs(bid)];
        return b || { dead: true, hp: 0, maxHp: 1, name: "" };
      }).map(function (b, n) {
        if (s.bs[n] < 0) b.dead = true;
        return b;
      });
    } else {
      R.bosses = null;
    }
    R.boss = s.bo ? fresh[s.bo] || null : null;

    R.shots = s.s.map(function (a) {
      return { x: a[0], y: a[1], vx: a[2], vy: a[3], r: a[4], sprite: a[5], color: a[6], age: a[7], life: a[8], rot: a[9], spin: a[10], seen: [] };
    });
    R.zones = s.z;
    R.ebullets = s.b.map(function (a) { return { x: a[0], y: a[1], vx: a[2], vy: a[3], r: a[4], color: a[5] }; });
    R.drops = s.d.map(function (a) { return { type: a[0], x: a[1], y: a[2], value: a[3], t: a[4], vx: 0, vy: 0 }; });
    for (i = 0; i < s.fx.length; i++) {
      var f = s.fx[i];
      if (f.own !== undefined) f.own = f.own === 1 ? R.p : f.own === 0 ? R.partner : null;
      if (R.fx.length < 220) R.fx.push(f);
    }
    for (i = 0; i < s.tx.length; i++) {
      var t = s.tx[i];
      if (R.texts.length < 40) R.texts.push({ x: t[0], y: t[1], str: t[2], color: t[3], size: t[4], life: t[5] });
    }
    // pets: each one keeps its place and eases along
    var petsBy = {};
    R.pets = s.pt.map(function (a) {
      var key = a[7] + ":" + a[0] + ":" + a[1];
      var pet = M.petsBy[key] || { x: a[3], y: a[4], bob: a[6] };
      pet.sp = a[0];
      pet.r = a[1];
      pet.lv = a[2];
      pet.tx = a[3];
      pet.ty = a[4];
      pet.face = a[5];
      pet.owner = a[7] === 1 ? R.p : R.partner;
      petsBy[key] = pet;
      return pet;
    });
    M.petsBy = petsBy;
    R.shrine = s.sr || null;
  };

  /** Cards from the host for this lemon to choose from (or null: the cards are done). */
  B.mirrorCards = function (m) {
    if (!R || !R.mirror || R.done || !m) return;
    if (!m.list) {
      R.choices = null;
      B.hud.choices(R);
      return;
    }
    R.choices = m.list;
    R.choiceKind = m.kind || "level";
    if (m.level) R.p.level = m.level;
    if (m.rerolls !== undefined) R.p.rerolls = m.rerolls;
    stick.on = false;
    PS.sfx.play("levelup");
    B.hud.choices(R);
  };

  /** The host's game says whether it will take this player's dev menu (an admin account, checked by the server). */
  B.mirrorDevOk = function (m) {
    if (!R || !R.mirror || !R.mp) return;
    R.mp.devOk = Boolean(m && m.ok);
    if (B.devPanel) B.devPanel.refresh();
  };
  /** What the host's game did with something pressed in this player's dev menu. */
  B.mirrorDevNote = function (m) {
    if (!R || !R.mirror || !m || !B.devPanel) return;
    B.devPanel.say(String(m.note || "").slice(0, 200));
  };

  function mirrorPick(index) {
    if (!R.choices || !R.choices[index]) return;
    PS.sfx.play("pick");
    mpSend("pick", { i: index }, true);
    R.choices = null;
    B.hud.choices(R);
  }

  function mirrorReroll() {
    if (!R.choices || R.p.rerolls <= 0) return;
    mpSend("reroll", {}, true);
  }

  function mirrorDash() {
    var me = R.p;
    if (R.done || me.down || me.dashCd > 0 || me.dashT > 0 || R.choices) return false;
    if (R.phase !== "swarm" && R.phase !== "boss") return false;
    var move = steering();
    me.dashX = move ? move.x : me.faceX;
    me.dashY = move ? move.y : me.faceY;
    me.dashT = B.DASH.time;
    me.dashCd = B.DASH.cd * (me.mods.dash || 1);
    R.fx.push({ type: "ring", x: me.x, y: me.y, r0: 8, r1: 34, color: "#FFF4B8", width: 4, t: 0, dur: 0.25 });
    PS.sfx.play("dash");
    mpSend("dash", {}, true);
    return true;
  }

  function mirrorLeave() {
    mpSend("bye", {}, true);
    mirrorEnd({ won: false, left: false, quit: true });
  }

  /** The battle is over for the guest: bank this player's share and show the results. */
  function mirrorEnd(m) {
    if (!R || R.done) return;
    R.done = true;
    R.paused = false;
    R.choices = null;
    B.hud.paused(R);
    B.hud.choices(R);
    var result;
    if (R.duel) {
      var won = Boolean(m.won) || Boolean(m.left);
      result = PS.state.finishDuel(won);
      result.wins = m.wins || R.duel.wins.slice();
      result.foe = R.partner.name;
      result.forfeit = Boolean(m.left);
      result.dealt = 0;
      PS.emit("battle:end", result);
      return;
    }
    var S = PS.state.get();
    var chapter = R.ch.n;
    // a chapter this player has not reached yet pays as their own furthest one,
    // and does not open chapters for them
    var reach = chapter <= S.best + 1;
    result = PS.state.finishRun({
      chapter: reach ? chapter : Math.min(chapter, PS.state.frontier()),
      won: Boolean(m.won),
      time: m.time !== undefined ? m.time : R.t,
      kills: m.kills !== undefined ? m.kills : R.kills,
      level: m.level || R.p.level,
      coins: m.coins !== undefined ? m.coins : R.coins,
      boss: m.boss !== undefined ? m.boss : R.reachedBoss,
      combo: m.combo || R.bestCombo,
      noProgress: !reach
    });
    result.dealt = 0;
    result.combo = m.combo || R.bestCombo;
    result.together = true;
    result.partner = R.partner.name;
    result.assist = !reach;
    result.left = Boolean(m.left);
    PS.emit("battle:end", result);
  }

  /** The host's word that the battle is over (with this player's share). */
  B.mirrorEnd = function (m) {
    if (R && R.mirror) mirrorEnd(m || { won: false });
  };

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
        ctx.globalAlpha = (z.web ? 0.18 : z.dust ? 0.32 : 0.5) * fade;
        ctx.fillStyle = z.color || "#7FB069";
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r, 0, TAU);
        ctx.fill();
        if (z.web) {
          // spokes and rings of thread
          ctx.globalAlpha = 0.7 * fade;
          ctx.strokeStyle = z.color;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          for (var spoke = 0; spoke < 8; spoke++) {
            var sa = (spoke / 8) * TAU;
            ctx.moveTo(z.x, z.y);
            ctx.lineTo(z.x + Math.cos(sa) * z.r, z.y + Math.sin(sa) * z.r);
          }
          for (var ringR = z.r * 0.3; ringR < z.r; ringR += z.r * 0.23) {
            for (var rs = 0; rs <= 8; rs++) {
              var ra = (rs / 8) * TAU;
              if (rs) ctx.lineTo(z.x + Math.cos(ra) * ringR, z.y + Math.sin(ra) * ringR);
              else ctx.moveTo(z.x + Math.cos(ra) * ringR, z.y + Math.sin(ra) * ringR);
            }
          }
          ctx.stroke();
        } else if (z.dust) {
          // a few motes swirling in the cloud
          ctx.globalAlpha = 0.5 * fade;
          ctx.fillStyle = "#FFF6E0";
          for (var m = 0; m < 5; m++) {
            var ma = R.t * 1.5 + m * 1.26;
            ctx.beginPath();
            ctx.arc(z.x + Math.cos(ma) * z.r * 0.55, z.y + Math.sin(ma * 1.3) * z.r * 0.4, 1.8, 0, TAU);
            ctx.fill();
          }
        }
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
      } else if (d.type === "power" || d.type === "bomb") {
        if (B.drawPickup) B.drawPickup(ctx, d, R);
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

    if (R.phase === "lost" && !R.players) return;
    if (p.gone) return;
    if (p.down) return drawDowned(p);

    if (p.invuln > 0) ctx.globalAlpha = 0.55 + 0.35 * Math.sin(R.t * 30);
    B.drawOutfit(ctx, p, y, "under", R.t);
    // the lemon is a little squashed and stretched as it moves
    var squash = p.moving ? Math.sin(R.t * 14) * 0.05 : Math.sin(R.t * 3) * 0.02;
    ctx.save();
    ctx.translate(p.x, y);
    ctx.scale((14 / 12) * (1 + squash), 1 - squash);
    ctx.fillStyle = p.flash > 0 ? P.white : P.lemon;
    B.ball(ctx, 0, 0, 12);
    ctx.strokeStyle = P.rind;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, TAU);
    ctx.stroke();
    ctx.restore();
    // the pointed tips a lemon has
    ctx.fillStyle = p.flash > 0 ? P.white : P.rind;
    ctx.beginPath();
    ctx.moveTo(p.x - 14.5, y - 1.5);
    ctx.lineTo(p.x - 18, y);
    ctx.lineTo(p.x - 14.5, y + 1.5);
    ctx.closePath();
    ctx.moveTo(p.x + 14.5, y - 1.5);
    ctx.lineTo(p.x + 18, y);
    ctx.lineTo(p.x + 14.5, y + 1.5);
    ctx.closePath();
    ctx.fill();
    B.drawOutfit(ctx, p, y, "body", R.t);
    B.drawOutfit(ctx, p, y, "head", R.t);
    // a leaf with a vein
    ctx.save();
    ctx.translate(p.x + 5, y - 12);
    ctx.rotate(-0.6);
    ctx.fillStyle = P.green;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6.4, 3.2, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#5F8244";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(5, 0);
    ctx.stroke();
    ctx.restore();

    // cheeks, and eyes that follow whatever the lemon is aiming at
    ctx.fillStyle = "rgba(240,120,90,0.35)";
    ctx.beginPath();
    ctx.ellipse(p.x - 8.2, y + 3, 2.6, 1.6, 0, 0, TAU);
    ctx.ellipse(p.x + 8.2, y + 3, 2.6, 1.6, 0, 0, TAU);
    ctx.fill();
    var ex = Math.cos(p.aim) * 1.6;
    var ey = Math.sin(p.aim) * 1.2;
    for (var side = -1; side <= 1; side += 2) {
      ctx.fillStyle = "#FFFCF2";
      ctx.beginPath();
      ctx.arc(p.x + side * 4.6, y - 1.5, 3.1, 0, TAU);
      ctx.fill();
      ctx.fillStyle = P.charcoal;
      ctx.beginPath();
      ctx.arc(p.x + side * 4.6 + ex, y - 1.5 + ey, 1.8, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(p.x + side * 4.6 + ex - 0.6, y - 2.2 + ey, 0.6, 0, TAU);
      ctx.fill();
    }
    // a small smile, an "oh" when it has just been hit
    ctx.strokeStyle = P.charcoal;
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    if (p.flash > 0) {
      ctx.arc(p.x, y + 5, 1.3, 0, TAU);
    } else {
      ctx.arc(p.x, y + 3, 2.6, 0.25, Math.PI - 0.25);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    (p.weapon || R.weapon).held(ctx, p, R);

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

  /** A lemon that is down: flat and grey, with a ring that fills while it is helped up. */
  function drawDowned(p) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "#B9B29E";
    ctx.strokeStyle = "#8D8670";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 4, 15, 8, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = P.charcoal;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (var side = -1; side <= 1; side += 2) {
      ctx.moveTo(p.x + side * 5 - 2, p.y + 1);
      ctx.lineTo(p.x + side * 5 + 2, p.y + 5);
      ctx.moveTo(p.x + side * 5 + 2, p.y + 1);
      ctx.lineTo(p.x + side * 5 - 2, p.y + 5);
    }
    ctx.stroke();
    ctx.restore();
    var k = Math.min(1, (p.reviveT || 0) / HELP_TIME);
    ctx.strokeStyle = "rgba(255,252,242,0.35)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, HELP_REACH, 0, TAU);
    ctx.stroke();
    if (k > 0) {
      ctx.strokeStyle = "#9BE08A";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, HELP_REACH, -Math.PI / 2, -Math.PI / 2 + k * TAU);
      ctx.stroke();
    }
  }

  /** The other player's name over their lemon. */
  function drawName(q) {
    ctx.font = "800 11px " + FONT;
    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(20,18,14,0.8)";
    ctx.fillStyle = R.duel ? "#FF9A8A" : "#9FD8FF";
    var label = q.down ? q.name + " · down" : q.name;
    ctx.strokeText(label, q.x, q.y - 30);
    ctx.fillText(label, q.x, q.y - 30);
  }

  /** Every lemon: the others first, then this game's own on top. */
  function drawLemons() {
    var me = R.p;
    if (R.players) {
      for (var i = 0; i < R.players.length; i++) {
        var q = R.players[i];
        if (q === me || q.gone) continue;
        own(q);
        if (!q.down) B.drawAbilities(ctx, R);
        drawPlayer();
        if (!q.down && B.drawBuffs) B.drawBuffs(ctx, R);
        drawName(q);
      }
      own(me);
    }
    if (!me.down) B.drawAbilities(ctx, R);
    drawPlayer();
    if (!me.down && B.drawBuffs) B.drawBuffs(ctx, R);
  }

  /** The duel's ring: a glowing wall, and the ground outside it in shade. */
  function drawRing() {
    var r = DUEL.r;
    ctx.save();
    ctx.fillStyle = "rgba(10,8,6,0.45)";
    ctx.beginPath();
    ctx.rect(-r * 4, -r * 4, r * 8, r * 8);
    ctx.arc(0, 0, r, 0, TAU, true);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,214,102,0.35)";
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = "#FFE08A";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  function drawFx() {
    var p = R.p;
    for (var i = 0; i < R.fx.length; i++) {
      var f = R.fx[i];
      var k = f.t / f.dur;
      // a swing or stab is drawn round the lemon that made it
      var ax0 = f.own ? f.own.x : f.ox !== undefined ? f.ox : p.x;
      var ay0 = f.own ? f.own.y : f.oy !== undefined ? f.oy : p.y;
      if (f.type === "ghost") {
        // the lemon's afterimage, left behind by a dash
        ctx.globalAlpha = 0.32 * (1 - k);
        ctx.fillStyle = P.lemon;
        ctx.beginPath();
        ctx.ellipse(f.x, f.y, p.r * 1.1, p.r, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        continue;
      }
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
        if (gfx >= 1) {
          ctx.globalCompositeOperation = "lighter";
          if (k < 0.4) {
            ctx.globalAlpha = 0.7 * (1 - k / 0.4);
            ctx.fillStyle = "#FFF6D0";
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.r * 0.35 * (0.6 + k), 0, TAU);
            ctx.fill();
          }
          ctx.globalAlpha = 0.35 * (1 - k);
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r * (0.7 + 0.3 * k), 0, TAU);
          ctx.stroke();
          ctx.globalCompositeOperation = "source-over";
        }
      } else if (f.type === "arc") {
        ctx.globalAlpha = 0.75 * (1 - k);
        ctx.strokeStyle = f.color;
        ctx.lineCap = "round";
        ctx.lineWidth = 9 * (1 - k) + 2;
        ctx.beginPath();
        if (f.half >= Math.PI) {
          ctx.arc(ax0, ay0, f.r * 0.86, 0, TAU);
        } else {
          // the blade sweeps across the arc as the effect plays
          var from = f.angle - f.half;
          ctx.arc(ax0, ay0, f.r * 0.86, from, from + f.half * 2 * Math.min(1, k * 2.2 + 0.25));
        }
        ctx.stroke();
        if (gfx >= 1) {
          // a soft glow under the swing and a thin white-hot edge on it
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = 0.3 * (1 - k);
          ctx.lineWidth = 22 * (1 - k) + 4;
          ctx.stroke();
          ctx.globalAlpha = 0.85 * (1 - k);
          ctx.strokeStyle = "#FFFDF0";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.globalCompositeOperation = "source-over";
        }
        ctx.globalAlpha = 0.16 * (1 - k);
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.moveTo(ax0, ay0);
        ctx.arc(ax0, ay0, f.r, f.angle - f.half, f.angle + f.half);
        ctx.closePath();
        ctx.fill();
      } else if (f.type === "stab") {
        var reach = f.len * Math.min(1, k * 3 + 0.35);
        ctx.globalAlpha = 0.8 * (1 - k);
        ctx.strokeStyle = f.color;
        ctx.lineCap = "round";
        ctx.lineWidth = Math.max(2, f.width * 0.45 * (1 - k));
        ctx.beginPath();
        ctx.moveTo(ax0 + Math.cos(f.angle) * 14, ay0 + Math.sin(f.angle) * 14);
        ctx.lineTo(ax0 + Math.cos(f.angle) * reach, ay0 + Math.sin(f.angle) * reach);
        ctx.stroke();
        if (gfx >= 1) {
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = 0.3 * (1 - k);
          ctx.lineWidth = Math.max(6, f.width * (1 - k));
          ctx.stroke();
          ctx.globalAlpha = 0.9 * (1 - k);
          ctx.strokeStyle = "#FFFDF0";
          ctx.lineWidth = 1.6;
          ctx.stroke();
          ctx.globalCompositeOperation = "source-over";
        }
      } else if (f.type === "bolt") {
        ctx.globalAlpha = 1 - k;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        for (var pass = gfx >= 1 ? -1 : 0; pass < 2; pass++) {
          ctx.globalCompositeOperation = pass < 0 ? "lighter" : "source-over";
          ctx.globalAlpha = pass < 0 ? 0.35 * (1 - k) : 1 - k;
          ctx.strokeStyle = pass > 0 ? "#FFFDF0" : "#8EC5FF";
          ctx.lineWidth = pass > 0 ? 1.6 : pass < 0 ? 14 : 5;
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
        ctx.globalCompositeOperation = "source-over";
      } else if (f.type === "ring") {
        ctx.globalAlpha = 0.8 * (1 - k);
        ctx.strokeStyle = f.color;
        ctx.lineWidth = f.width || 4;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r0 + (f.r1 - f.r0) * k, 0, TAU);
        ctx.stroke();
      } else if (f.type === "beam") {
        // a spider's beam: a glow along the line and a white-hot core
        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";
        ctx.globalAlpha = 0.45 * (1 - k);
        ctx.strokeStyle = f.color;
        ctx.lineWidth = f.width * 2.4;
        ctx.beginPath();
        ctx.moveTo(f.x0, f.y0);
        ctx.lineTo(f.x1, f.y1);
        ctx.stroke();
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = f.width * 0.5;
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
      } else if (f.type === "flash") {
        // a short star of light where the weapon goes off
        var size = (f.big ? 22 : 13) * (1 - k * 0.5);
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.9 * (1 - k);
        var glow = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, size * 1.6);
        glow.addColorStop(0, "rgba(255,253,240,0.95)");
        glow.addColorStop(0.35, rgba(f.color, 0.75));
        glow.addColorStop(1, rgba(f.color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(f.x, f.y, size * 1.6, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = rgba(f.color, 0.9);
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        for (var ray = -1; ray <= 1; ray++) {
          var ra = f.angle + ray * 0.5;
          ctx.moveTo(f.x + Math.cos(ra) * size * 0.4, f.y + Math.sin(ra) * size * 0.4);
          ctx.lineTo(f.x + Math.cos(ra) * size * (ray ? 1.2 : 1.9), f.y + Math.sin(ra) * size * (ray ? 1.2 : 1.9));
        }
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
      } else if (f.type === "crit") {
        // a four-pointed gold star that pops and spins
        var cs = 5 + 13 * Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5);
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = "#FFE66D";
        ctx.beginPath();
        for (var pt = 0; pt < 8; pt++) {
          var pa = f.spin + k * 2 + (pt / 8) * TAU;
          var pr = pt % 2 ? cs * 0.28 : cs;
          if (pt) ctx.lineTo(f.x + Math.cos(pa) * pr, f.y + Math.sin(pa) * pr);
          else ctx.moveTo(f.x + Math.cos(pa) * pr, f.y + Math.sin(pa) * pr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
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
  /** One pest (or crate) on the field. A pest that has just been hit squashes
   *  for a moment; the golden pest shines. */
  function drawOne(e) {
    if (e.proxyOf) return; // a duel's stand-in: the lemon itself is drawn instead
    if (e.prop && B.drawProp) {
      B.drawProp(ctx, e, R);
      return;
    }
    if (e.golden && B.drawGoldenGlow) B.drawGoldenGlow(ctx, e, R);
    if (e.flash > 0 && !e.boss && gfx >= 1) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.scale(1.14, 0.86);
      ctx.translate(-e.x, -e.y);
      B.drawEnemy(ctx, e, R);
      ctx.restore();
    } else {
      B.drawEnemy(ctx, e, R);
    }
  }

  /** Splats where pests were squashed: a blob and a few drops, fading out. */
  function drawSplats() {
    for (var i = 0; i < R.splats.length; i++) {
      var s = R.splats[i];
      ctx.globalAlpha = 0.32 * (1 - s.t / 4);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + s.r * 0.3, s.r, s.r * 0.55, s.seed, 0, TAU);
      ctx.fill();
      for (var k = 0; k < 4; k++) {
        var a = s.seed + k * 1.7;
        ctx.beginPath();
        ctx.arc(s.x + Math.cos(a) * s.r * 1.4, s.y + s.r * 0.3 + Math.sin(a) * s.r * 0.8, s.r * 0.18, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawPointers() {
    var p = R.p;
    var list = R.enemies;
    // a shrine waiting somewhere off screen gets an arrow too
    if (R.shrine) list = list.concat([{ x: R.shrine.x, y: R.shrine.y, shrine: true }]);
    // and so does the other player, when out of sight
    if (R.players) {
      for (var pi = 0; pi < R.players.length; pi++) {
        var other = R.players[pi];
        if (other !== p && !other.gone) list = list.concat([{ x: other.x, y: other.y, friend: true }]);
      }
    }
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.proxyOf) continue;
      if (!e.boss && !e.elite && !e.golden && !e.shrine && !e.friend) continue;
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
      ctx.fillStyle = e.friend ? (R.duel ? "#FF9A8A" : "#7FC4FF") : e.boss ? "#E5484D" : e.golden ? "#FFE66D" : e.shrine ? "#5FD3B0" : "#F2B93B";
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
    // each zone's own ground (arena.js); low quality keeps the plain dotted floor
    if (gfx >= 1 && B.drawArena) B.drawArena(ctx, R, ox, oy);
    else drawFloor(ox, oy);

    ctx.save();
    ctx.translate(ox, oy);
    if (R.duel) drawRing();
    drawZones();
    drawSplats();
    drawDrops();
    if (R.shrine && B.drawShrine) B.drawShrine(ctx, R);
    if (gfx >= 1 && B.drawShadows) B.drawShadows(ctx, R);

    var halfW = view.w / 2 + 70;
    var halfH = view.h / 2 + 70;
    var i;
    for (i = 0; i < R.enemies.length; i++) {
      var e = R.enemies[i];
      if (Math.abs(e.x - p.x) < halfW + e.r && Math.abs(e.y - p.y) < halfH + e.r) drawOne(e);
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
    drawLemons();
    if (B.petDraw) B.petDraw(ctx, R);
    drawFx();

    if (gfx >= 1) ctx.globalCompositeOperation = "lighter";
    for (i = 0; i < R.sparks.length; i++) {
      var spark = R.sparks[i];
      var life = Math.max(0, spark.life / spark.max);
      ctx.globalAlpha = life;
      ctx.fillStyle = spark.fill;
      if (gfx >= 1) {
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, 0.8 + 2.4 * life, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillRect(spark.x - 2, spark.y - 2, 4, 4);
      }
    }
    ctx.globalCompositeOperation = "source-over";
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

    // motes, the lemon's light and the dark screen edge go over the world
    if (gfx >= 1 && B.drawAtmosphere) B.drawAtmosphere(ctx, R, ox, oy);
    drawPointers();
    drawStick();
    drawDanger();
  }

  /** Red edges when health is low, stronger the lower it gets (a slow pulse
   *  unless motion is turned down). */
  function drawDanger() {
    var p = R.p;
    var left = Math.max(0, p.hp) / p.maxHp;
    if (left >= 0.3 || R.phase === "won" || p.down) return;
    var k = Math.min(1, (0.3 - left) / 0.3 + 0.25);
    var pulse = calm ? 1 : 0.78 + 0.22 * Math.sin(R.t * 6);
    var cx = view.w / 2;
    var cy = view.h / 2;
    var g = ctx.createRadialGradient(cx, cy, Math.min(view.w, view.h) * 0.32, cx, cy, Math.max(view.w, view.h) * 0.72);
    g.addColorStop(0, "rgba(229,72,77,0)");
    g.addColorStop(1, "rgba(229,72,77," + (0.5 * k * pulse).toFixed(3) + ")");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, view.w, view.h);
  }
  B.draw = draw;

  /* --------------------------------------------------------------- input */

  var MOVE_CODES = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1, KeyW: 1, KeyA: 1, KeyS: 1, KeyD: 1 };

  function bindInput() {
    window.addEventListener("keydown", function (e) {
      if (!R || R.done) return;
      // typing in a box (the chat in the pause menu, the dev menu's fields) is not steering
      var typing = e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (typing && e.key !== "Escape") return;
      // the backtick key opens and closes the DEV panel (when it is unlocked;
      // playing together, only with the admin password)
      if (e.key === "`" && PS.dev.unlocked && B.devPanel && (!R.mp || PS.dev.admin)) {
        if (R.devOpen) B.devPanel.close();
        else B.devPanel.open();
        e.preventDefault();
        return;
      }
      if (R.devOpen) {
        if (e.key === "Escape") B.devPanel.close();
        return;
      }
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
      if ((e.code === "Space" || e.code === "ShiftLeft" || e.code === "ShiftRight") && !R.choices && !R.paused) {
        e.preventDefault();
        if (!e.repeat) B.dash();
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
      if (PS.prefs.get("autopause")) B.pause();
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && PS.prefs.get("autopause")) B.pause();
    });

    function at(e) {
      var rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    canvas.addEventListener("pointerdown", function (e) {
      if (!R || R.choices || R.paused || R.devOpen) return;
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
