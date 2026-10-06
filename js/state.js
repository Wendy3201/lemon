/*!
 * Pip Survivors — save file and rules
 * Everything the player owns and every rule for changing it: equipping,
 * levelling slots, forging, talents, chests, deals, quests, battle rewards
 * and the Power score. No DOM in here; the screens call these and redraw
 * when "change" fires.
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function () {
  "use strict";

  var PS = window.PS;
  var KEY = "lemon:pips:save";
  var VERSION = 1;

  var S = null; // the save
  var cache = null; // computed stats, dropped on every change

  /* ----------------------------------------------------------- save file */

  function fresh() {
    var save = {
      v: VERSION,
      seed: Math.floor(Math.random() * 2147483647),
      gold: PS.START.gold,
      gems: PS.START.gems,
      uid: 1,
      items: [],
      eq: {},
      lv: {},
      talents: {},
      best: 0, // highest chapter cleared
      chapter: 1, // chapter shown on the battle screen
      clears: {},
      shop: { freeAt: 0, day: "", dealBest: 1, bought: [], pityS: 0, pitySS: 0 },
      quests: {},
      stats: {
        kills: 0, runs: 0, wins: 0, forges: 0, chests: 0, upgrades: 0, talents: 0,
        bestLevel: 0, bestPower: 0, maxRarity: 0, grade: 0, time: 0, earned: 0
      }
    };
    PS.SLOTS.forEach(function (slot) {
      save.eq[slot.key] = 0;
      save.lv[slot.key] = 1;
    });
    PS.START.kit.forEach(function (id) {
      var item = { u: save.uid++, id: id, r: 0 };
      save.items.push(item);
      save.eq[PS.ITEMS[id].slot] = item.u;
    });
    return save;
  }

  function num(value, fallback, min, max) {
    if (typeof value !== "number" || !isFinite(value)) return fallback;
    return PS.clamp(value, min === undefined ? 0 : min, max === undefined ? Infinity : max);
  }

  /** Rebuild a save from whatever was in storage, keeping only what makes
   *  sense, so a half-written or hand-edited save cannot break the game. */
  function sanitise(raw) {
    var save = fresh();
    if (!raw || typeof raw !== "object" || raw.v !== VERSION) return save;

    save.seed = Math.floor(num(raw.seed, save.seed));
    save.gold = Math.floor(num(raw.gold, 0));
    save.gems = Math.floor(num(raw.gems, 0));
    save.best = Math.floor(num(raw.best, 0, 0, PS.BAL.CHAPTERS));
    save.chapter = Math.floor(num(raw.chapter, 1, 1, Math.min(PS.BAL.CHAPTERS, save.best + 1)));

    save.items = [];
    save.uid = 1;
    var seen = {};
    (Array.isArray(raw.items) ? raw.items : []).forEach(function (item) {
      if (!item || !PS.ITEMS[item.id]) return;
      var u = Math.floor(num(item.u, 0));
      if (!u || seen[u]) return;
      seen[u] = true;
      var clean = { u: u, id: item.id, r: Math.floor(num(item.r, 0, 0, PS.MAX_RARITY)) };
      if (item.n) clean.n = 1;
      save.items.push(clean);
      if (u >= save.uid) save.uid = u + 1;
    });

    PS.SLOTS.forEach(function (slot) {
      var u = raw.eq ? raw.eq[slot.key] : 0;
      var found = null;
      for (var i = 0; i < save.items.length; i++) {
        if (save.items[i].u === u && PS.ITEMS[save.items[i].id].slot === slot.key) found = save.items[i];
      }
      save.eq[slot.key] = found ? found.u : 0;
      save.lv[slot.key] = Math.floor(num(raw.lv ? raw.lv[slot.key] : 1, 1, 1, PS.RARITY[PS.MAX_RARITY].cap));
    });

    // the lemon always holds a weapon
    if (!save.eq.weapon) {
      var weapon = null;
      save.items.forEach(function (item) {
        if (PS.ITEMS[item.id].slot === "weapon" && (!weapon || item.r > weapon.r)) weapon = item;
      });
      if (!weapon) {
        weapon = { u: save.uid++, id: "sling", r: 0 };
        save.items.push(weapon);
      }
      save.eq.weapon = weapon.u;
    }

    PS.TALENTS.forEach(function (talent) {
      var level = Math.floor(num(raw.talents ? raw.talents[talent.id] : 0, 0, 0, talent.max));
      if (level) save.talents[talent.id] = level;
    });

    if (raw.clears && typeof raw.clears === "object") {
      Object.keys(raw.clears).forEach(function (key) {
        var n = Number(key);
        var entry = raw.clears[key];
        if (n >= 1 && n <= PS.BAL.CHAPTERS && entry && typeof entry === "object") {
          save.clears[n] = { n: Math.floor(num(entry.n, 0)), time: num(entry.time, 0), kills: Math.floor(num(entry.kills, 0)) };
        }
      });
    }

    var shop = raw.shop || {};
    save.shop.freeAt = num(shop.freeAt, 0);
    save.shop.day = typeof shop.day === "string" ? shop.day : "";
    save.shop.dealBest = Math.floor(num(shop.dealBest, 1, 1, PS.BAL.CHAPTERS));
    save.shop.bought = Array.isArray(shop.bought) ? shop.bought.map(Boolean) : [];
    save.shop.pityS = Math.floor(num(shop.pityS, 0));
    save.shop.pitySS = Math.floor(num(shop.pitySS, 0));

    PS.QUESTS.forEach(function (quest) {
      var claimed = Math.floor(num(raw.quests ? raw.quests[quest.id] : 0, 0, 0, quest.tiers.length));
      if (claimed) save.quests[quest.id] = claimed;
    });

    Object.keys(save.stats).forEach(function (key) {
      save.stats[key] = num(raw.stats ? raw.stats[key] : 0, 0);
    });
    return save;
  }

  function persist() {
    cache = null;
    PS.store.set(KEY, S);
  }

  /** The "best ever" figures the quests look at. */
  function refreshRecords() {
    cache = null;
    var stats = S.stats;
    S.items.forEach(function (item) {
      if (item.r > stats.maxRarity) stats.maxRarity = item.r;
      var grade = PS.ITEMS[item.id].grade;
      var rank = grade === "SS" ? 2 : grade === "S" ? 1 : 0;
      if (rank > stats.grade) stats.grade = rank;
    });
    var power = calc().power;
    if (power > stats.bestPower) stats.bestPower = power;
  }

  /** Call after every change: refresh the records, save, tell the screens. */
  function commit() {
    refreshRecords();
    PS.store.set(KEY, S);
    PS.emit("change");
  }

  function load() {
    S = sanitise(PS.store.get(KEY, null));
    refreshRecords();
    return S;
  }

  function reset() {
    S = fresh();
    commit();
  }

  /* --------------------------------------------------------------- items */

  function byUid(u) {
    for (var i = 0; i < S.items.length; i++) {
      if (S.items[i].u === u) return S.items[i];
    }
    return null;
  }

  function defOf(item) {
    return PS.ITEMS[item.id];
  }

  function equipped(slot) {
    return S.eq[slot] ? byUid(S.eq[slot]) : null;
  }

  function isEquipped(item) {
    return S.eq[defOf(item).slot] === item.u;
  }

  /** The level an item really gets: the slot's level, held back by the cap
   *  of the item's rarity. */
  function levelFor(item) {
    return Math.min(S.lv[defOf(item).slot], PS.RARITY[item.r].cap);
  }

  /** An item's main stat (attack or health) at a given rarity and level. */
  function mainStat(id, rarity, level) {
    var def = PS.ITEMS[id];
    return def.base * PS.GRADE[def.grade].mult * PS.RARITY[rarity].mult * PS.BAL.levelMult(level);
  }

  function add(id, rarity) {
    var item = { u: S.uid++, id: id, r: rarity, n: 1 };
    S.items.push(item);
    return item;
  }

  function remove(u) {
    for (var i = 0; i < S.items.length; i++) {
      if (S.items[i].u === u) {
        S.items.splice(i, 1);
        return;
      }
    }
  }

  /** Dev menu: delete an item. A worn weapon is replaced by another weapon, or a sling. */
  function take(u) {
    var item = byUid(u);
    if (!item) return false;
    var slot = defOf(item).slot;
    if (S.eq[slot] === u) S.eq[slot] = 0;
    remove(u);
    if (slot === "weapon" && !S.eq.weapon) {
      var spare = null;
      S.items.forEach(function (it) {
        if (!spare && defOf(it).slot === "weapon") spare = it;
      });
      if (!spare) spare = add("sling", 0);
      S.eq.weapon = spare.u;
    }
    commit();
    return true;
  }

  var GRADE_RANK = { A: 0, S: 1, SS: 2 };
  var SLOT_RANK = {};
  PS.SLOTS.forEach(function (slot, index) { SLOT_RANK[slot.key] = index; });

  /** Best first: rarity, then grade, then slot, then name. */
  function sorted(list) {
    return list.slice().sort(function (a, b) {
      var da = defOf(a);
      var db = defOf(b);
      return (
        b.r - a.r ||
        GRADE_RANK[db.grade] - GRADE_RANK[da.grade] ||
        SLOT_RANK[da.slot] - SLOT_RANK[db.slot] ||
        PS.ITEM_ORDER.indexOf(a.id) - PS.ITEM_ORDER.indexOf(b.id) ||
        a.u - b.u
      );
    });
  }

  function equip(u) {
    var item = byUid(u);
    if (!item) return false;
    S.eq[defOf(item).slot] = item.u;
    delete item.n;
    commit();
    return true;
  }

  function unequip(slot) {
    if (slot === "weapon" || !S.eq[slot]) return false;
    S.eq[slot] = 0;
    commit();
    return true;
  }

  function markSeen() {
    var changed = false;
    S.items.forEach(function (item) {
      if (item.n) {
        delete item.n;
        changed = true;
      }
    });
    if (changed) persist();
    return changed;
  }

  /* --------------------------------------------------------------- stats */

  function applyBlock(block, totals, fx) {
    var key;
    if (block.s) for (key in block.s) totals[key] = (totals[key] || 0) + block.s[key];
    if (block.fx) for (key in block.fx) fx[key] = (fx[key] || 0) + block.fx[key];
  }

  /** Total stats and Power. `swap` can replace what is in a slot
   *  ({ weapon: item }) to answer "what if I wore this instead?". */
  function compute(swap) {
    var hero = PS.BAL.HERO;
    var t = {
      atk: hero.atk, hp: hero.hp, atkPct: 0, hpPct: 0, crit: hero.crit, critDmg: hero.critDmg,
      haste: 0, speed: 0, armor: 0, regen: 0, magnet: 0, gold: 0, xp: 0, luck: 0, area: 0, bossDmg: 0
    };
    var fx = {};
    var bonus = 0;
    var weapon = "sling";

    PS.SLOTS.forEach(function (slot) {
      var item = swap && swap[slot.key] !== undefined ? swap[slot.key] : equipped(slot.key);
      if (!item) return;
      var def = defOf(item);
      if (slot.key === "weapon") weapon = def.id;
      t[slot.stat] += mainStat(item.id, item.r, Math.min(S.lv[slot.key], PS.RARITY[item.r].cap));
      if (def.innate) applyBlock(def.innate, t, fx);
      def.perks.forEach(function (perk) {
        if (item.r < perk.at) return;
        applyBlock(perk, t, fx);
        bonus += perk.pw;
      });
    });

    PS.TALENTS.forEach(function (talent) {
      var level = S.talents[talent.id] || 0;
      if (!level) return;
      if (talent.stat) t[talent.stat] += talent.per * level;
      if (talent.fx) {
        fx[talent.fx] = (fx[talent.fx] || 0) + talent.per * level;
        bonus += 0.05 * level;
      }
    });

    var out = {
      atk: t.atk * (1 + t.atkPct),
      hp: t.hp * (1 + t.hpPct),
      crit: Math.min(t.crit, 1),
      critDmg: t.critDmg,
      haste: t.haste,
      speed: t.speed,
      armor: Math.min(t.armor, PS.BAL.ARMOR_CAP),
      regen: t.regen,
      magnet: t.magnet,
      gold: t.gold,
      xp: t.xp,
      luck: t.luck,
      area: t.area,
      bossDmg: t.bossDmg,
      fx: fx,
      weapon: weapon
    };

    var dps = out.atk * (1 + out.haste) * (1 + out.crit * (out.critDmg - 1)) * (1 + 0.6 * out.area) * (1 + 0.5 * out.bossDmg);
    var ehp = (out.hp / (1 - out.armor)) * (1 + out.regen * 25) * (1 + 0.6 * out.speed);
    var extra = 1 + bonus + 0.15 * out.xp + 0.1 * out.luck + 0.05 * out.magnet;
    out.power = Math.round((dps * 20 + ehp * 2) * extra);
    return out;
  }

  function calc() {
    return cache || (cache = compute(null));
  }

  /** How much Power changes if this item goes into its slot. */
  function powerDelta(item) {
    var swap = {};
    swap[defOf(item).slot] = item;
    return compute(swap).power - calc().power;
  }

  /** Put the strongest thing owned into every slot. Returns how many changed. */
  function equipBest() {
    var changed = 0;
    PS.SLOTS.forEach(function (slot) {
      var best = equipped(slot.key);
      var bestPower = calc().power;
      S.items.forEach(function (item) {
        if (defOf(item).slot !== slot.key || isEquipped(item)) return;
        var swap = {};
        swap[slot.key] = item;
        var power = compute(swap).power;
        if (power > bestPower) {
          bestPower = power;
          best = item;
        }
      });
      if (best && S.eq[slot.key] !== best.u) {
        S.eq[slot.key] = best.u;
        delete best.n;
        cache = null;
        changed++;
      }
    });
    if (changed) commit();
    return changed;
  }

  /* -------------------------------------------------------- slot levels */

  /** { ok, cost, level, cap, reason } for buying the next level of a slot. */
  function upgradeInfo(slot) {
    var item = equipped(slot);
    var level = S.lv[slot];
    var cap = item ? PS.RARITY[item.r].cap : 0;
    var cost = PS.BAL.levelCost(level);
    var info = { level: level, cap: cap, cost: cost, ok: false, reason: "" };
    if (!item) info.reason = "Nothing equipped";
    else if (level >= PS.RARITY[PS.MAX_RARITY].cap) info.reason = "Max level";
    else if (level >= cap) info.reason = "Needs a higher rarity";
    else if (S.gold < cost) info.reason = "Not enough gold";
    else info.ok = true;
    return info;
  }

  /** Buy up to `times` levels for a slot. Returns how many were bought. */
  function upgrade(slot, times) {
    var bought = 0;
    for (var i = 0; i < (times || 1); i++) {
      var info = upgradeInfo(slot);
      if (!info.ok) break;
      S.gold -= info.cost;
      S.lv[slot]++;
      bought++;
    }
    if (bought) {
      S.stats.upgrades += bought;
      commit();
    }
    return bought;
  }

  /* --------------------------------------------------------------- forge */
  /* Three items of the same slot and rarity: the one you choose is kept and
     rises one rarity, the other two are used up. */

  function forgeMaterials(main) {
    if (!main || main.r >= PS.MAX_RARITY) return [];
    var slot = defOf(main).slot;
    var list = S.items.filter(function (item) {
      return item.u !== main.u && item.r === main.r && defOf(item).slot === slot && !isEquipped(item);
    });
    // offer ordinary gear first, so nobody melts down an S-grade by accident
    return list.sort(function (a, b) {
      return GRADE_RANK[defOf(a).grade] - GRADE_RANK[defOf(b).grade] || a.u - b.u;
    });
  }

  function canForge(main) {
    return forgeMaterials(main).length >= 2;
  }

  function forgeAvailable() {
    for (var i = 0; i < S.items.length; i++) {
      if (canForge(S.items[i])) return true;
    }
    return false;
  }

  function forge(mainU, matA, matB) {
    var main = byUid(mainU);
    var a = byUid(matA);
    var b = byUid(matB);
    if (!main || !a || !b || a === b) return null;
    var options = forgeMaterials(main);
    if (options.indexOf(a) === -1 || options.indexOf(b) === -1) return null;
    remove(a.u);
    remove(b.u);
    main.r++;
    delete main.n;
    S.stats.forges++;
    commit();
    return main;
  }

  /* -------------------------------------------------------------- talents */

  function talentInfo(id) {
    var talent = PS.TALENT[id];
    var level = S.talents[id] || 0;
    var maxed = level >= talent.max;
    var cost = maxed ? 0 : PS.talentCost(talent, level);
    return { talent: talent, level: level, maxed: maxed, cost: cost, ok: !maxed && S.gold >= cost };
  }

  function buyTalent(id) {
    var info = talentInfo(id);
    if (!info.ok) return false;
    S.gold -= info.cost;
    S.talents[id] = info.level + 1;
    S.stats.talents++;
    commit();
    return true;
  }

  /* ---------------------------------------------------------------- loot */

  function rollRarity(mu, rnd) {
    return PS.weighted([0, 1, 2, 3, 4, 5], PS.rarityWeights(mu), rnd ? rnd() : undefined);
  }

  /** Pick an item. opts: s / ss (grade chances), grade and slot (forced),
   *  minR (lowest rarity), rnd (random stream). */
  function rollItem(mu, opts) {
    opts = opts || {};
    var rnd = opts.rnd || Math.random;
    var grade = opts.grade;
    if (!grade) {
      var g = rnd();
      grade = g < (opts.ss || 0) ? "SS" : g < (opts.ss || 0) + (opts.s || 0) ? "S" : "A";
    }

    function slotsWith(wanted) {
      return PS.SLOTS.filter(function (slot) {
        return PS.POOL[slot.key][wanted] && (!opts.slot || slot.key === opts.slot);
      });
    }
    var slots = slotsWith(grade);
    if (!slots.length) {
      // not every slot has SS gear: step down a grade rather than fail
      grade = grade === "SS" ? "S" : "A";
      slots = slotsWith(grade);
    }
    var slot = PS.weighted(slots, slots.map(function (s) { return s.weight; }), rnd());
    var ids = PS.POOL[slot.key][grade];
    var id = ids[Math.floor(rnd() * ids.length)];
    var rarity = PS.clamp(Math.max(rollRarity(mu, rnd), opts.minR || 0), 0, PS.MAX_DROP_RARITY);
    return { id: id, r: rarity };
  }

  function frontier() {
    return Math.min(PS.BAL.CHAPTERS, S.best + 1);
  }

  /* ------------------------------------------------------------- battles */

  function chapterOpen(n) {
    return n >= 1 && n <= PS.BAL.CHAPTERS && n <= S.best + 1;
  }

  function selectChapter(n) {
    if (!chapterOpen(n) || S.chapter === n) return false;
    S.chapter = n;
    commit();
    return true;
  }

  /** Bank the result of a battle and return what was won, for the results
   *  screen. result: { chapter, won, time, kills, level, coins, boss }. */
  function finishRun(result) {
    var ch = PS.chapter(result.chapter);
    var stats = calc();
    var first = result.won && S.best < ch.n;
    var progress = result.won ? 1 : PS.clamp(result.time / ch.duration, 0, 1);

    var base = result.won ? ch.gold * (first ? 3 : 1) : ch.gold * 0.6 * progress;
    var gold = Math.round((base + (result.coins || 0)) * (1 + stats.gold));
    var gems = result.won ? (first ? PS.BAL.gemsFirst(ch.n) : PS.BAL.gemsRepeat) : 0;

    var mu = PS.BAL.lootMu(ch.n);
    var grade = {
      s: ch.n >= PS.DROP_GRADE.sFrom ? PS.DROP_GRADE.s : 0,
      ss: ch.n >= PS.DROP_GRADE.ssFrom ? PS.DROP_GRADE.ss : 0
    };
    var count = result.won ? 3 : result.boss ? 2 : progress >= 0.5 ? 1 : 0;
    var rolls = [];
    for (var i = 0; i < count; i++) rolls.push(rollItem(mu, grade));
    if (first) {
      rolls.push(rollItem(mu, grade));
      rolls.push(rollItem(mu + 1, grade));
      if (ch.milestone) rolls.push(rollItem(mu + 1, { grade: ch.milestone[0], slot: ch.milestone[1] }));
    }

    S.gold += gold;
    S.gems += gems;
    S.stats.earned += gold;
    S.stats.runs++;
    S.stats.kills += result.kills || 0;
    S.stats.time += result.time || 0;
    if ((result.level || 0) > S.stats.bestLevel) S.stats.bestLevel = result.level;

    var items = rolls.map(function (roll) { return add(roll.id, roll.r); });

    var unlocked = 0;
    if (result.won) {
      S.stats.wins++;
      var record = S.clears[ch.n] || (S.clears[ch.n] = { n: 0, time: 0, kills: 0 });
      record.n++;
      if (!record.time || result.time < record.time) record.time = result.time;
      if ((result.kills || 0) > record.kills) record.kills = result.kills;
      if (first) {
        S.best = ch.n;
        if (ch.n < PS.BAL.CHAPTERS) {
          unlocked = ch.n + 1;
          S.chapter = unlocked;
        }
      }
    }
    commit();

    return {
      chapter: ch.n, won: Boolean(result.won), first: first, gold: gold, gems: gems, items: items,
      unlocked: unlocked, progress: progress, time: result.time || 0, kills: result.kills || 0,
      level: result.level || 1, finished: result.won && ch.n === PS.BAL.CHAPTERS && first
    };
  }

  /* ---------------------------------------------------------------- shop */

  function chestCost(kind, count) {
    var cost = PS.CHESTS[kind].cost * count;
    return count >= PS.CHEST_BULK.count ? Math.round(cost * PS.CHEST_BULK.discount) : cost;
  }

  function openChest(kind, count) {
    var chest = PS.CHESTS[kind];
    var cost = chestCost(kind, count);
    if (!chest || S.gems < cost) return null;
    S.gems -= cost;

    var mu = PS.BAL.lootMu(frontier()) + chest.shift;
    var out = [];
    for (var i = 0; i < count; i++) {
      var forced = null;
      if (chest.pityS) {
        S.shop.pityS++;
        S.shop.pitySS++;
        if (S.shop.pitySS >= chest.pitySS) forced = "SS";
        else if (S.shop.pityS >= chest.pityS) forced = "S";
      }
      var roll = rollItem(mu, { s: chest.s, ss: chest.ss, grade: forced, minR: chest.minR });
      if (chest.pityS) {
        var grade = PS.ITEMS[roll.id].grade;
        if (grade === "SS") S.shop.pitySS = 0;
        if (grade !== "A") S.shop.pityS = 0;
      }
      out.push(add(roll.id, roll.r));
    }
    S.stats.chests += count;
    commit();
    return out;
  }

  function giftWait() {
    return Math.max(0, S.shop.freeAt - Date.now());
  }

  function claimGift() {
    if (giftWait() > 0) return null;
    var f = frontier();
    var gold = Math.round(PS.BAL.gold(f) * PS.GIFT.goldShare);
    var roll = rollItem(PS.BAL.lootMu(f), { s: PS.CHESTS.crate.s });
    S.shop.freeAt = Date.now() + PS.GIFT.every;
    S.gold += gold;
    S.gems += PS.GIFT.gems;
    var item = add(roll.id, roll.r);
    commit();
    return { gold: gold, gems: PS.GIFT.gems, items: [item] };
  }

  function today() {
    var d = new Date();
    function two(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate());
  }

  /** Today's four offers. They are worked out from the date, so they stay
   *  put all day and change at midnight. */
  function deals() {
    var day = today();
    if (S.shop.day !== day) {
      S.shop.day = day;
      S.shop.bought = [];
      S.shop.dealBest = frontier();
      persist();
    }
    var f = S.shop.dealBest;
    var rnd = PS.rng(PS.hash(S.seed + ":" + day));
    var centre = Math.max(0, Math.round(PS.BAL.lootMu(f)));
    var list = [];
    for (var i = 0; i < PS.DEAL_COUNT; i++) {
      var special = rnd() < 0.2;
      var steps = rnd() < 0.35 ? 2 : 1;
      var roll = rollItem(0, { grade: special ? "S" : "A", rnd: rnd });
      var rarity = PS.clamp(centre + steps, 0, PS.MAX_DROP_RARITY);
      var worth = Math.pow(3, steps - 1) * (special ? 2.5 : 1);
      var forGems = i >= 2;
      list.push({
        index: i,
        id: roll.id,
        r: rarity,
        cur: forGems ? "gems" : "gold",
        price: forGems ? Math.round((45 * worth) / 5) * 5 : Math.round(PS.BAL.gold(f) * 1.5 * worth),
        bought: Boolean(S.shop.bought[i])
      });
    }
    return list;
  }

  function buyDeal(index) {
    var deal = deals()[index];
    if (!deal || deal.bought || S[deal.cur] < deal.price) return null;
    S[deal.cur] -= deal.price;
    S.shop.bought[index] = true;
    var item = add(deal.id, deal.r);
    commit();
    return item;
  }

  function goldPack() {
    return { gems: PS.GOLD_PACK.gems, gold: Math.round(PS.BAL.gold(frontier()) * PS.GOLD_PACK.runs) };
  }

  function buyGold() {
    var pack = goldPack();
    if (S.gems < pack.gems) return 0;
    S.gems -= pack.gems;
    S.gold += pack.gold;
    commit();
    return pack.gold;
  }

  /* -------------------------------------------------------------- quests */

  function questInfo(quest) {
    var claimed = S.quests[quest.id] || 0;
    var done = claimed >= quest.tiers.length;
    var tier = done ? quest.tiers.length - 1 : claimed;
    var target = quest.tiers[tier];
    var value = quest.stat === "best" ? S.best : S.stats[quest.stat] || 0;
    var label = quest.labels ? quest.labels[tier] : PS.fmt(target);
    return {
      id: quest.id,
      name: quest.name,
      text: tier === 0 && quest.first ? quest.first : quest.text.replace("{n}", label),
      value: Math.min(value, target),
      target: target,
      gems: quest.gems[tier],
      tier: tier,
      tiers: quest.tiers.length,
      done: done,
      ready: !done && value >= target
    };
  }

  function quests() {
    return PS.QUESTS.map(questInfo);
  }

  function claimQuest(id) {
    var quest = null;
    PS.QUESTS.forEach(function (q) { if (q.id === id) quest = q; });
    if (!quest) return 0;
    var info = questInfo(quest);
    if (!info.ready) return 0;
    S.quests[id] = info.tier + 1;
    S.gems += info.gems;
    commit();
    return info.gems;
  }

  /* ------------------------------------------------------------- badges */

  /** Which tabs have something waiting. */
  function badges() {
    return {
      shop: giftWait() === 0,
      gear: forgeAvailable() || S.items.some(function (item) { return item.n; }),
      quests: quests().some(function (quest) { return quest.ready; })
    };
  }

  PS.state = {
    load: load,
    reset: reset,
    get: function () { return S; },
    calc: calc,
    compute: compute,
    powerDelta: powerDelta,
    // items
    item: byUid,
    def: defOf,
    equipped: equipped,
    isEquipped: isEquipped,
    levelFor: levelFor,
    mainStat: mainStat,
    sorted: sorted,
    equip: equip,
    unequip: unequip,
    equipBest: equipBest,
    markSeen: markSeen,
    // slot levels
    upgradeInfo: upgradeInfo,
    upgrade: upgrade,
    // forge
    forgeMaterials: forgeMaterials,
    canForge: canForge,
    forgeAvailable: forgeAvailable,
    forge: forge,
    // talents
    talentInfo: talentInfo,
    buyTalent: buyTalent,
    // battles
    chapterOpen: chapterOpen,
    selectChapter: selectChapter,
    finishRun: finishRun,
    frontier: frontier,
    // shop
    chestCost: chestCost,
    openChest: openChest,
    giftWait: giftWait,
    claimGift: claimGift,
    deals: deals,
    buyDeal: buyDeal,
    goldPack: goldPack,
    buyGold: buyGold,
    // quests
    quests: quests,
    claimQuest: claimQuest,
    badges: badges,
    // dev menu
    give: function (id, rarity) {
      var item = add(id, rarity);
      commit();
      return item;
    },
    take: take,
    // sets the amounts exactly (so they can be set back down too)
    setMoney: function (gold, gems) {
      S.gold = Math.floor(num(gold, 0, 0, 1e12));
      S.gems = Math.floor(num(gems, 0, 0, 1e12));
      commit();
    }
  };
})();
