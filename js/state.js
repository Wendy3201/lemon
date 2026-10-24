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
  var BASE_KEY = "lemon:pips:save";
  var KEY = BASE_KEY; // each account on this device has its own: BASE_KEY + ":" + account id
  var VERSION = 1;
  var TRADES_KEPT = 200; // how many finished trade ids the save remembers

  var S = null; // the save
  var cache = null; // computed stats, dropped on every change

  /* ----------------------------------------------------------- save file */

  function fresh() {
    var save = {
      v: VERSION,
      seed: Math.floor(Math.random() * 2147483647),
      gold: PS.START.gold,
      gems: PS.START.gems,
      shards: 0, // SS shards from Gilded Chests
      ascend: 0, // how many times the talents have been ascended
      pets: [], // { u, sp, r, lv }
      petSlots: PS.PET_SLOTS.start, // how many pets can come along
      petTeam: [], // uids of the pets that do
      petUid: 1,
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
      daily: { last: "", streak: 0 }, // the day of the last daily claim, and which day of 7 it was
      endless: { best: 0, ch: 0, kills: 0 }, // the longest endless swarm survived
      challenge: { won: "", count: 0 }, // the day the daily challenge was last won, and how many in all
      found: {}, // every item id ever owned, for the collection book
      book: 0, // how many collection steps have been claimed
      traded: [], // ids of the trades already put into this save, so none is done twice
      boost: null, // admin menu: { power, label, stats: { atk: 5000, ... } } set by hand, over what gear gives
      stats: {
        kills: 0, runs: 0, wins: 0, forges: 0, chests: 0, upgrades: 0, talents: 0,
        bestLevel: 0, bestPower: 0, maxRarity: 0, grade: 0, time: 0, earned: 0, eggs: 0, bestCombo: 0, duels: 0, duelsPlayed: 0,
        trades: 0
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
      save.found[id] = 1;
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
    save.shards = Math.floor(num(raw.shards, 0));
    save.ascend = Math.floor(num(raw.ascend, 0, 0, PS.TALENT_TIERS - 1));
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

    save.pets = [];
    var petSeen = {};
    (Array.isArray(raw.pets) ? raw.pets : []).forEach(function (pet) {
      if (!pet || !PS.PET[pet.sp]) return;
      var r = Math.floor(num(pet.r, 0, 0, PS.PET_RARITY.length - 1));
      var u = Math.floor(num(pet.u, 0));
      if (!u || petSeen[u]) return;
      petSeen[u] = true;
      save.pets.push({ u: u, sp: pet.sp, r: r, lv: Math.floor(num(pet.lv, 1, 1, PS.PET_RARITY[r].cap)) });
      if (u >= save.petUid) save.petUid = u + 1;
    });
    save.petSlots = Math.floor(num(raw.petSlots, PS.PET_SLOTS.start, PS.PET_SLOTS.start, PS.PET_SLOTS.max));
    // older saves kept a single pet in petEq
    var team = Array.isArray(raw.petTeam) ? raw.petTeam : raw.petEq ? [raw.petEq] : [];
    team.forEach(function (u) {
      if (petSeen[u] && save.petTeam.indexOf(u) === -1 && save.petTeam.length < save.petSlots) save.petTeam.push(u);
    });

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

    var daily = raw.daily || {};
    save.daily.last = typeof daily.last === "string" ? daily.last : "";
    save.daily.streak = Math.floor(num(daily.streak, 0, 0, PS.DAILY.length));
    var endless = raw.endless || {};
    save.endless.best = num(endless.best, 0, 0, 1e7);
    save.endless.ch = Math.floor(num(endless.ch, 0, 0, PS.BAL.CHAPTERS));
    save.endless.kills = Math.floor(num(endless.kills, 0, 0, 1e9));
    var challenge = raw.challenge || {};
    save.challenge.won = typeof challenge.won === "string" ? challenge.won : "";
    save.challenge.count = Math.floor(num(challenge.count, 0, 0, 1e6));

    // older saves never kept this list: whatever they own now counts as found
    if (raw.found && typeof raw.found === "object") {
      Object.keys(raw.found).forEach(function (id) { if (PS.ITEMS[id]) save.found[id] = 1; });
    }
    save.items.forEach(function (item) { save.found[item.id] = 1; });
    save.book = Math.floor(num(raw.book, 0, 0, PS.BOOK.length));
    save.boost = cleanBoost(raw.boost);
    save.traded = (Array.isArray(raw.traded) ? raw.traded : []).filter(function (id) {
      return typeof id === "number" && isFinite(id);
    }).slice(-TRADES_KEPT);

    PS.QUESTS.forEach(function (quest) {
      var claimed = Math.floor(num(raw.quests ? raw.quests[quest.id] : 0, 0, 0, quest.tiers.length));
      if (claimed) save.quests[quest.id] = claimed;
    });

    Object.keys(save.stats).forEach(function (key) {
      save.stats[key] = num(raw.stats ? raw.stats[key] : 0, 0);
    });
    return save;
  }

  /* The stats the admin menu can set by hand. Percentages are kept as fractions (0.25 = 25%). */
  var BOOST_STATS = ["atk", "hp", "crit", "critDmg", "haste", "speed", "armor", "regen", "magnet", "gold", "xp", "luck", "area", "bossDmg"];

  /** A boost as stored: only real numbers, a short label, or null when nothing is set. */
  function cleanBoost(raw) {
    if (!raw || typeof raw !== "object") return null;
    var out = { power: null, label: "", stats: {} };
    var any = false;
    if (typeof raw.power === "number" && isFinite(raw.power) && raw.power >= 0) {
      out.power = Math.min(Math.floor(raw.power), 1e15);
      any = true;
    }
    if (typeof raw.label === "string" && raw.label.trim()) {
      out.label = raw.label.trim().slice(0, 20);
      any = true;
    }
    BOOST_STATS.forEach(function (key) {
      var v = raw.stats ? raw.stats[key] : undefined;
      if (typeof v === "number" && isFinite(v) && v >= 0) {
        out.stats[key] = Math.min(v, 1e15);
        any = true;
      }
    });
    return any ? out : null;
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

  /* One-time wipe. Every browser that has not seen this WIPE_ID yet starts from
     a fresh save the first time it loads the game, then remembers that it has
     been wiped. To wipe everyone again, change WIPE_ID to anything new. */
  var WIPE_ID = "2026-10-13";
  var KEY_WIPE = "lemon:wipe";
  var KEY_NOTICE = "lemon:wipe-notice"; // set until the player has seen the message once

  /** Load the save of `owner` (an account id), or the one from before accounts.
   *  The first account to sign in on a device takes over that older save. */
  function load(owner) {
    KEY = owner ? BASE_KEY + ":" + owner : BASE_KEY;
    if (owner && PS.store.get(KEY, null) === null && PS.store.get(BASE_KEY, null) !== null) {
      PS.store.set(KEY, PS.store.get(BASE_KEY, null));
      PS.store.remove(BASE_KEY);
    }
    if (PS.store.get(KEY_WIPE, null) !== WIPE_ID) {
      // only someone who actually had a save is told it was reset
      if (PS.store.get(KEY, null)) PS.store.set(KEY_NOTICE, true);
      PS.store.set(KEY_WIPE, WIPE_ID);
      S = fresh();
      PS.store.set(KEY, S);
    } else {
      S = sanitise(PS.store.get(KEY, null));
    }
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
    S.found[id] = 1;
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

    // the pet that is along for the ride
    S.petTeam.forEach(function (u) {
      var along = petByUid(u);
      if (along) t[PS.PET[along.sp].stat] += PS.petBonus(along.sp, along.r, along.lv);
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

    // the admin menu's stats set by hand win over what the gear gives
    var boost = S.boost;
    if (boost) {
      for (var key in boost.stats) out[key] = boost.stats[key];
      out.crit = Math.min(out.crit, 1);
      out.armor = Math.min(out.armor, 0.95); // never quite untouchable: that is what godmode is for
      out.critDmg = Math.max(out.critDmg, 1);
    }

    var dps = out.atk * (1 + out.haste) * (1 + out.crit * (out.critDmg - 1)) * (1 + 0.6 * out.area) * (1 + 0.5 * out.bossDmg);
    var ehp = (out.hp / (1 - out.armor)) * (1 + out.regen * 25) * (1 + 0.6 * out.speed);
    var extra = 1 + bonus + 0.15 * out.xp + 0.1 * out.luck + 0.05 * out.magnet;
    out.power = Math.round((dps * 20 + ehp * 2) * extra);
    if (boost && boost.power !== null) out.power = boost.power;
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

  /* ---- quick forge: every forge that can be made, in one go.
     Works low rarity to high, so an item made Uncommon can go on into an Uncommon
     forge in the same pass. In each group of the same slot and rarity, the worn
     item is the one that rises (otherwise the best one), and the cheapest ones are
     used up. With `keep`, Epic or rarer and S / SS-grade items are never used up. */

  function quickPlan(keep) {
    var items = S.items.map(function (item) {
      var def = defOf(item);
      return { u: item.u, id: item.id, r: item.r, slot: def.slot, rank: GRADE_RANK[def.grade], base: def.base, eq: isEquipped(item), gone: false, made: false };
    });
    function valuable(it) { return it.r >= 3 || it.rank > 0; }
    function worth(it) { return it.rank * 1000 + it.base; }
    var steps = [];
    var usedUp = [];

    for (var r = 0; r < PS.MAX_RARITY; r++) {
      PS.SLOTS.forEach(function (slot) {
        for (;;) {
          var group = items.filter(function (it) { return !it.gone && it.r === r && it.slot === slot.key; });
          if (group.length < 3) return;
          var main = group.filter(function (it) { return it.eq; })[0] ||
            group.slice().sort(function (a, b) { return worth(b) - worth(a); })[0];
          var pool = group.filter(function (it) { return it !== main && !it.eq && !(keep && valuable(it)); })
            .sort(function (a, b) { return worth(a) - worth(b); });
          if (pool.length < 2) return;
          steps.push({ main: main.u, mats: [pool[0].u, pool[1].u], from: r });
          [pool[0], pool[1]].forEach(function (it) {
            it.gone = true;
            usedUp.push(it);
          });
          main.r++;
          main.made = true;
        }
      });
    }

    var made = items.filter(function (it) { return it.made && !it.gone; })
      .sort(function (a, b) { return b.r - a.r || b.rank - a.rank; })
      .map(function (it) { return { id: it.id, r: it.r, u: it.u }; });
    return {
      steps: steps,
      used: usedUp.length,
      valuableUsed: usedUp.filter(valuable).map(function (it) { return { id: it.id, r: it.r }; }),
      made: made
    };
  }

  function quickForge(keep) {
    var plan = quickPlan(keep);
    if (!plan.steps.length) return plan;
    plan.steps.forEach(function (step) {
      remove(step.mats[0]);
      remove(step.mats[1]);
      byUid(step.main).r++;
    });
    S.stats.forges += plan.steps.length;
    commit();
    return plan;
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
    var locked = talent.tier > S.ascend + 1;
    var cost = maxed ? 0 : PS.talentCost(talent, level);
    return { talent: talent, level: level, maxed: maxed, locked: locked, cost: cost, ok: !maxed && !locked && S.gold >= cost };
  }

  /** The talents that can be bought right now: every tier up to the current one. */
  function unlockedTalents() {
    return PS.TALENTS.filter(function (talent) { return talent.tier <= S.ascend + 1; });
  }

  /** Where the player is on the ladder of tiers, and whether they can step up. */
  function ascendInfo() {
    var tier = S.ascend + 1;
    var inTier = PS.TALENTS.filter(function (talent) { return talent.tier === tier; });
    var maxed = inTier.filter(function (talent) { return (S.talents[talent.id] || 0) >= talent.max; }).length;
    var top = tier >= PS.TALENT_TIERS;
    var unlocks = top ? 0 : PS.TALENTS.filter(function (talent) { return talent.tier === tier + 1; }).length;
    return { tier: tier, maxed: maxed, total: inTier.length, top: top, unlocks: unlocks, can: !top && maxed === inTier.length };
  }

  /** Step up to the next tier of talents. Returns the new tier, or 0. */
  function ascend() {
    if (!ascendInfo().can) return 0;
    S.ascend++;
    commit();
    return S.ascend + 1;
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

  /* ---------------------------------------------------------------- pets */

  function eggCost(count) {
    var cost = PS.EGG.gems * count;
    return count >= PS.EGG.bulk.count ? Math.round(cost * PS.EGG.bulk.discount) : cost;
  }

  function petByUid(u) {
    for (var i = 0; i < S.pets.length; i++) if (S.pets[i].u === u) return S.pets[i];
    return null;
  }

  function hatchOne() {
    var sp = PS.PET_SPECIES[Math.floor(Math.random() * PS.PET_SPECIES.length)].id;
    var r = PS.weighted(PS.EGG.odds.map(function (x, i) { return i; }), PS.EGG.odds);
    var have = null;
    S.pets.forEach(function (pet) { if (pet.sp === sp && pet.r === r) have = pet; });
    S.stats.eggs++;
    if (!have) {
      var pet = { u: S.petUid++, sp: sp, r: r, lv: 1 };
      S.pets.push(pet);
      if (S.petTeam.length < S.petSlots) S.petTeam.push(pet.u);
      return { pet: pet, status: "new" };
    }
    if (have.lv < PS.PET_RARITY[r].cap) {
      have.lv++;
      return { pet: have, status: "level" };
    }
    // a pet that is already at the top turns the egg into gold
    var gold = 200 * (r + 1);
    S.gold += gold;
    return { pet: have, status: "max", gold: gold };
  }

  /** Buy and hatch eggs. Returns a list of { pet, status } or null. */
  function hatch(count) {
    var cost = eggCost(count);
    if (S.gems < cost) return null;
    S.gems -= cost;
    var out = [];
    for (var i = 0; i < count; i++) out.push(hatchOne());
    commit();
    return out;
  }

  function petInfo(u) {
    var pet = petByUid(u);
    if (!pet) return null;
    var cap = PS.PET_RARITY[pet.r].cap;
    var maxed = pet.lv >= cap;
    var cost = maxed ? 0 : PS.petCost(pet.r, pet.lv);
    return {
      pet: pet, def: PS.PET[pet.sp], cap: cap, maxed: maxed, cost: cost, ok: !maxed && S.gold >= cost,
      bonus: PS.petBonus(pet.sp, pet.r, pet.lv), equipped: S.petTeam.indexOf(pet.u) !== -1
    };
  }

  function levelPet(u) {
    var info = petInfo(u);
    if (!info || !info.ok) return false;
    S.gold -= info.cost;
    info.pet.lv++;
    commit();
    return true;
  }

  /** Bring a pet along, or send it home if it is already out. False if the team is full. */
  function togglePet(u) {
    if (!petByUid(u)) return false;
    var at = S.petTeam.indexOf(u);
    if (at !== -1) {
      S.petTeam.splice(at, 1);
    } else {
      if (S.petTeam.length >= S.petSlots) return false;
      S.petTeam.push(u);
    }
    commit();
    return true;
  }

  /** What the next team slot costs in gems, or 0 once all of them are open. */
  function petSlotCost() {
    return S.petSlots >= PS.PET_SLOTS.max ? 0 : PS.PET_SLOTS.costs[S.petSlots];
  }

  function buyPetSlot() {
    var cost = petSlotCost();
    if (!cost || S.gems < cost) return false;
    S.gems -= cost;
    S.petSlots++;
    commit();
    return true;
  }

  /* ---------------------------------------------------------------- loot */

  function rollRarity(mu, rnd) {
    var weights = PS.rarityWeights(mu);
    return PS.weighted(weights.map(function (w, r) { return r; }), weights, rnd ? rnd() : undefined);
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
    // fixed odds (chests) ignore how far the player has got
    var rarity = opts.odds
      ? PS.weighted([0, 1, 2, 3, 4, 5], opts.odds, rnd())
      : PS.clamp(Math.max(rollRarity(mu, rnd), opts.minR || 0), 0, PS.MAX_DROP_RARITY);
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

  /* A money rush an admin started: battles pay `gold` and `gems` times as much
     until `until` (this game's clock). Not saved; the game asks the server. */
  var rush = null;

  function setRush(r) {
    var x = function (n) { return Math.max(1, Math.min(10, Number(n) || 1)); };
    rush = r && r.until > Date.now() && (x(r.gold) > 1 || x(r.gems) > 1)
      ? { gold: x(r.gold), gems: x(r.gems), until: r.until, message: String(r.message || "") }
      : null;
  }

  /** The rush going on now, or null. */
  function rushNow() {
    if (rush && rush.until <= Date.now()) rush = null;
    return rush;
  }

  /** What a battle paid, with the rush on top: { gold, gems, rush: { gold, gems } or null }. */
  function withRush(gold, gems) {
    var r = rushNow();
    if (!r) return { gold: gold, gems: gems, rush: null };
    return { gold: Math.round(gold * r.gold), gems: Math.round(gems * r.gems), rush: { gold: r.gold, gems: r.gems } };
  }

  /** Bank the result of a battle and return what was won, for the results
   *  screen. result: { chapter, won, time, kills, level, coins, boss }. */
  function finishRun(result) {
    var ch = PS.chapter(result.chapter);
    var stats = calc();
    // noProgress: a win alongside a friend in a chapter this player has not
    // reached yet pays, but does not open chapters
    var first = result.won && S.best < ch.n && !result.noProgress;
    var progress = result.won ? 1 : PS.clamp(result.time / ch.duration, 0, 1);

    var base = result.won ? ch.gold * (first ? 3 : 1) : ch.gold * 0.6 * progress;
    var paid = withRush(Math.round((base + (result.coins || 0)) * (1 + stats.gold)), result.won ? (first ? PS.BAL.gemsFirst(ch.n) : PS.BAL.gemsRepeat) : 0);
    var gold = paid.gold;
    var gems = paid.gems;

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
    if ((result.combo || 0) > S.stats.bestCombo) S.stats.bestCombo = result.combo;

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

    // today's challenge, won for the first time today: its bonus on top
    var challenge = null;
    if (result.won && result.twist) {
      var info = challengeInfo();
      if (info.open && !info.done && info.twist.id === result.twist) {
        S.challenge.won = today();
        S.challenge.count++;
        S.gems += PS.CHALLENGE.gems;
        challenge = { gems: PS.CHALLENGE.gems, items: [] };
      }
    }
    commit();
    if (challenge) challenge.items = openChest(PS.CHALLENGE.chest, 1, true) || [];

    return {
      chapter: ch.n, won: Boolean(result.won), first: first, gold: gold, gems: gems, items: items,
      unlocked: unlocked, progress: progress, time: result.time || 0, kills: result.kills || 0,
      level: result.level || 1, finished: result.won && ch.n === PS.BAL.CHAPTERS && first,
      twist: result.twist || null, challenge: challenge, rush: paid.rush
    };
  }

  /** A duel with a friend is over: a win pays a chapter's gold and some gems,
   *  a loss a little gold. Wins count for the leaderboard. */
  function finishDuel(won) {
    var paid = withRush(Math.round(PS.BAL.gold(frontier()) * (won ? 1 : 0.3)), won ? 5 : 0);
    var gold = paid.gold;
    var gems = paid.gems;
    S.gold += gold;
    S.gems += gems;
    S.stats.earned += gold;
    S.stats.duelsPlayed++;
    if (won) S.stats.duels++;
    commit();
    return { duel: true, won: Boolean(won), gold: gold, gems: gems, duels: S.stats.duels, rush: paid.rush };
  }

  /** The days since 1970 of a "2026-10-17" date, so each day has its own twist. */
  function dayNumber(day) {
    var parts = day.split("-");
    return Math.round(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) / 86400000);
  }

  /** Today's challenge: { open, chapter, twist, done (won today), count }. */
  function challengeInfo() {
    var list = PS.CHALLENGE.twists;
    var day = today();
    return {
      open: S.best >= PS.CHALLENGE.from,
      chapter: Math.max(1, S.best - PS.CHALLENGE.behind),
      twist: list[dayNumber(day) % list.length],
      done: S.challenge.won === day,
      count: S.challenge.count
    };
  }

  /* ----------------------------------------------------- collection book */

  /** { found, total, bySlot: { weapon: { found, total } }, next (the next
   *  step, or null), ready (steps reached but not claimed), gems (they pay) }. */
  function bookInfo() {
    var found = 0;
    var bySlot = {};
    PS.SLOTS.forEach(function (slot) { bySlot[slot.key] = { found: 0, total: 0 }; });
    PS.ITEM_ORDER.forEach(function (id) {
      var tally = bySlot[PS.ITEMS[id].slot];
      tally.total++;
      if (S.found[id]) {
        tally.found++;
        found++;
      }
    });
    var ready = 0;
    var gems = 0;
    for (var i = S.book; i < PS.BOOK.length && found >= PS.BOOK[i].at; i++) {
      ready++;
      gems += PS.BOOK[i].gems;
    }
    return { found: found, total: PS.ITEM_ORDER.length, bySlot: bySlot, next: PS.BOOK[S.book] || null, ready: ready, gems: gems };
  }

  /** Claim every collection step reached. Returns the gems, or 0. */
  function claimBook() {
    var info = bookInfo();
    if (!info.ready) return 0;
    S.book += info.ready;
    S.gems += info.gems;
    commit();
    return info.gems;
  }

  /* Endless swarm pays gold only: 3 times what a normal chapter run pays, in
     proportion to how long you lasted (lasting a chapter's length earns 3
     chapter-clears), and the coins you picked up. */
  var SWARM_PAY = 3;

  /** Gold for selling an item: its rarity's price plus its grade's price. */
  function sellValue(item) {
    return (PS.SELL.rarity[item.r] || 0) + (PS.SELL.grade[defOf(item).grade] || 0);
  }

  /** Sell an item that is not being worn. Returns the gold, or 0 if it cannot be sold. */
  function sell(u) {
    var item = byUid(u);
    if (!item || isEquipped(item)) return 0;
    var value = sellValue(item);
    if (!value) return 0;
    remove(u);
    S.gold += value;
    commit();
    return value;
  }

  /** Pay out an endless swarm and keep its record. `extra`: { kills, combo }. */
  function paySwarm(chapter, time, coins, extra) {
    extra = extra || {};
    var ch = PS.chapter(chapter);
    var base = ch.gold * Math.max(0, time) / ch.duration + (coins || 0);
    var gold = withRush(Math.round(base * SWARM_PAY * (1 + calc().gold)), 0).gold;
    S.gold += gold;
    S.stats.earned += gold;
    if ((extra.combo || 0) > S.stats.bestCombo) S.stats.bestCombo = extra.combo;
    if (time > S.endless.best) {
      S.endless.best = time;
      S.endless.ch = chapter;
      S.endless.kills = extra.kills || 0;
    }
    commit();
    return gold;
  }

  /** Endless swarm: open, and how tough its pests are (the furthest chapter cleared). */
  function endlessInfo() {
    return {
      open: S.best >= PS.ENDLESS.from,
      chapter: Math.max(1, Math.min(PS.BAL.CHAPTERS, S.best)),
      best: S.endless.best,
      bestCh: S.endless.ch,
      bestKills: S.endless.kills
    };
  }

  /* ---------------------------------------------------------------- shop */

  function chestCost(kind, count) {
    var cost = PS.BAL.chestPrice(kind) * count;
    return count >= PS.CHEST_BULK.count ? Math.round(cost * PS.CHEST_BULK.discount) : cost;
  }

  /** `free` is for the dev menu: it opens the chests without taking the gems. */
  function openChest(kind, count, free) {
    var chest = PS.CHESTS[kind];
    var cost = chestCost(kind, count);
    if (!chest || (!free && S.gems < cost)) return null;
    if (!free) S.gems -= cost;

    var out = [];
    var shards = 0;
    for (var i = 0; i < count; i++) {
      if (chest.shard && Math.random() < chest.shard) shards++;
      var forced = null;
      if (chest.pityS) {
        S.shop.pityS++;
        S.shop.pitySS++;
        if (S.shop.pitySS >= chest.pitySS) forced = "SS";
        else if (S.shop.pityS >= chest.pityS) forced = "S";
      }
      var roll;
      if (chest.special && Math.random() < chest.special.chance) {
        // the chest's fixed prize: a set grade at a set rarity
        roll = rollItem(0, { grade: chest.special.grade, odds: chest.odds });
        roll.r = chest.special.rarity;
      } else {
        roll = rollItem(0, { s: chest.s, ss: chest.ss, grade: forced, odds: chest.odds });
      }
      if (chest.pityS) {
        var grade = PS.ITEMS[roll.id].grade;
        if (grade === "SS") S.shop.pitySS = 0;
        if (grade !== "A") S.shop.pityS = 0;
      }
      out.push(add(roll.id, roll.r));
    }
    S.shards += shards;
    S.stats.chests += count;
    commit();
    out.shards = shards;
    return out;
  }

  /** Dev menu: open `count` chests on paper. Uses the real odds and pity rules but
   *  changes nothing in the save and gives nothing. Returns the tallies. */
  function simulateChests(kind, count) {
    var chest = PS.CHESTS[kind];
    if (!chest) return null;
    var pityS = S.shop.pityS;
    var pitySS = S.shop.pitySS;
    var out = { kind: kind, count: count, rarity: [], S: 0, SS: 0, shards: 0 };
    for (var i = 0; i < count; i++) {
      if (chest.shard && Math.random() < chest.shard) out.shards++;
      var forced = null;
      if (chest.pityS) {
        pityS++;
        pitySS++;
        if (pitySS >= chest.pitySS) forced = "SS";
        else if (pityS >= chest.pityS) forced = "S";
      }
      var roll;
      if (chest.special && Math.random() < chest.special.chance) {
        roll = rollItem(0, { grade: chest.special.grade, odds: chest.odds });
        roll.r = chest.special.rarity;
      } else {
        roll = rollItem(0, { s: chest.s, ss: chest.ss, grade: forced, odds: chest.odds });
      }
      var grade = PS.ITEMS[roll.id].grade;
      if (chest.pityS) {
        if (grade === "SS") pitySS = 0;
        if (grade !== "A") pityS = 0;
      }
      out.rarity[roll.r] = (out.rarity[roll.r] || 0) + 1;
      if (grade === "S") out.S++;
      if (grade === "SS") out.SS++;
    }
    return out;
  }

  /** Turn SHARDS.needed SS shards into one Uncommon SS-grade item. */
  function craftShards() {
    if (S.shards < PS.SHARDS.needed) return null;
    S.shards -= PS.SHARDS.needed;
    var roll = rollItem(0, { grade: "SS", odds: [0, 1, 0, 0, 0, 0] });
    var item = add(roll.id, PS.SHARDS.rarity);
    commit();
    return item;
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

  /** The local calendar day as "2026-10-17"; `offset` days from today. */
  function today(offset) {
    var now = new Date();
    var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (offset || 0));
    function two(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate());
  }

  /* -------------------------------------------------------- daily rewards */

  /** { ready, day (1 to 7: the one to claim now, or the one claimed today),
   *  rewards: [{ gold, gems, chest, count }] with gold worked out }. */
  function dailyInfo() {
    var day;
    var ready;
    if (S.daily.last === today()) {
      ready = false;
      day = S.daily.streak || 1;
    } else {
      ready = true;
      day = S.daily.last === today(-1) ? (S.daily.streak % PS.DAILY.length) + 1 : 1;
    }
    var goldBase = PS.BAL.gold(frontier());
    return {
      ready: ready,
      day: day,
      rewards: PS.DAILY.map(function (r) {
        return { gold: r.gold ? Math.round(goldBase * r.gold) : 0, gems: r.gems || 0, chest: r.chest || null, count: r.count || 0 };
      })
    };
  }

  /** Claim today's reward. Returns { day, gold, gems, items, shards } or null. */
  function claimDaily() {
    var info = dailyInfo();
    if (!info.ready) return null;
    var reward = info.rewards[info.day - 1];
    S.gold += reward.gold;
    S.gems += reward.gems;
    S.stats.earned += reward.gold;
    S.daily.last = today();
    S.daily.streak = info.day;
    var items = [];
    var shards = 0;
    if (reward.chest) {
      // openChest saves, so the streak above goes in with it
      items = openChest(reward.chest, reward.count, true) || [];
      shards = items.shards || 0;
    } else {
      commit();
    }
    return { day: info.day, gold: reward.gold, gems: reward.gems, items: items, shards: shards };
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
      rnd(); // kept so the day's other rolls stay as they were; deals are never S-grade
      var special = false;
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

  /* -------------------------------------------------------------- casino */
  /* A bet leaves the gold the moment it is placed, so reloading the page
     mid-hand cannot take it back. */

  /** Take a bet out of the gold. Returns the save it was taken from (to pay
   *  any winnings into the same one), or null when there is not enough. */
  function stake(amount) {
    amount = Math.floor(amount);
    if (!(amount >= 1) || amount > S.gold) return null;
    S.gold -= amount;
    commit();
    return S;
  }

  function payout(save, amount) {
    amount = Math.floor(amount);
    if (save !== S || !(amount > 0)) return; // logged out, or a save loaded, since the bet
    S.gold += amount;
    commit();
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

  /* ------------------------------------------------- dev menu (admin) tools */

  function raiseQuestStat(quest, target) {
    if (quest.stat === "best") S.best = Math.max(S.best, Math.min(PS.BAL.CHAPTERS, target));
    else S.stats[quest.stat] = Math.max(S.stats[quest.stat] || 0, target);
  }

  function questById(id) {
    var found = null;
    PS.QUESTS.forEach(function (quest) { if (quest.id === id) found = quest; });
    return found;
  }

  /** Make a quest's current rung ready to claim by raising the number it counts. */
  function devCompleteQuest(id) {
    var quest = questById(id);
    if (!quest) return false;
    var info = questInfo(quest);
    if (info.done) return false;
    raiseQuestStat(quest, info.target);
    commit();
    return true;
  }

  /** Finish and claim every rung of every quest. Returns the gems paid. */
  function devFinishQuests() {
    var gems = 0;
    PS.QUESTS.forEach(function (quest) {
      for (;;) {
        var info = questInfo(quest);
        if (info.done) break;
        raiseQuestStat(quest, info.target);
        S.quests[quest.id] = info.tier + 1;
        gems += info.gems;
      }
    });
    S.gems += gems;
    commit();
    return gems;
  }

  /** One pet handed over directly. The game keeps one pet per species and rarity,
   *  so giving a pet you have just raises its level. */
  function devGivePet(sp, rarity, level) {
    if (!PS.PET[sp]) return null;
    var r = Math.floor(num(rarity, 0, 0, PS.PET_RARITY.length - 1));
    var lv = Math.floor(num(level, 1, 1, PS.PET_RARITY[r].cap));
    var have = null;
    S.pets.forEach(function (pet) { if (pet.sp === sp && pet.r === r) have = pet; });
    if (have) {
      have.lv = Math.max(have.lv, lv);
    } else {
      have = { u: S.petUid++, sp: sp, r: r, lv: lv };
      S.pets.push(have);
      if (S.petTeam.length < S.petSlots) S.petTeam.push(have.u);
    }
    commit();
    return have;
  }

  function devRemovePet(u) {
    var at = -1;
    S.pets.forEach(function (pet, i) { if (pet.u === u) at = i; });
    if (at === -1) return false;
    S.pets.splice(at, 1);
    var onTeam = S.petTeam.indexOf(u);
    if (onTeam !== -1) S.petTeam.splice(onTeam, 1);
    commit();
    return true;
  }

  /** Fill the team with the strongest pets (rarest, then highest level). */
  function devFillTeam() {
    var best = S.pets.slice().sort(function (a, b) { return b.r - a.r || b.lv - a.lv; });
    S.petTeam = best.slice(0, S.petSlots).map(function (pet) { return pet.u; });
    commit();
  }

  /** Remove every item that is not worn and is below a rarity. Returns how many went. */
  function devCleanBag(belowRarity) {
    var doomed = S.items.filter(function (item) { return !isEquipped(item) && item.r < belowRarity; });
    doomed.forEach(function (item) { remove(item.u); });
    if (doomed.length) commit();
    return doomed.length;
  }

  /* ------------------------------------------------------------- trading */

  /** What this player can put in a trade: gear that is not being worn, and every pet. */
  function tradeable() {
    return {
      items: sorted(S.items.filter(function (item) { return !isEquipped(item); })),
      pets: S.pets.slice().sort(function (a, b) { return b.r - a.r || b.lv - a.lv; })
    };
  }

  /** One of this save's items that matches what an offer said: the very one, or else the same kind. */
  function offeredItem(x) {
    var item = byUid(x.u);
    if (item && item.id === x.id && item.r === x.r && !isEquipped(item)) return item;
    for (var i = 0; i < S.items.length; i++) {
      var it = S.items[i];
      if (it.id === x.id && it.r === x.r && !isEquipped(it)) return it;
    }
    return null;
  }

  function offeredPet(x) {
    var pet = petByUid(x.u);
    if (pet && pet.sp === x.sp && pet.r === x.r) return pet;
    for (var i = 0; i < S.pets.length; i++) if (S.pets[i].sp === x.sp && S.pets[i].r === x.r) return S.pets[i];
    return null;
  }

  /** A finished trade (`id` from the server): take away what this player gave
   *  and add what they got. A trade already in the save is not done again
   *  (returns null). Pets are kept one per kind and rarity, so a pet you
   *  already have just takes the higher of the two levels. */
  function applyTrade(id, give, get) {
    if (typeof id !== "number" || S.traded.indexOf(id) !== -1) return null;
    give = give || {};
    get = get || {};
    var out = { items: [], pets: [], gold: 0, gems: 0, skipped: 0 };
    (Array.isArray(give.items) ? give.items : []).forEach(function (x) {
      var item = x && offeredItem(x);
      if (item) remove(item.u);
    });
    (Array.isArray(give.pets) ? give.pets : []).forEach(function (x) {
      var pet = x && offeredPet(x);
      if (!pet) return;
      S.pets.splice(S.pets.indexOf(pet), 1);
      var onTeam = S.petTeam.indexOf(pet.u);
      if (onTeam !== -1) S.petTeam.splice(onTeam, 1);
    });
    S.gold = Math.max(0, S.gold - Math.floor(num(give.gold, 0, 0, 1e12)));
    S.gems = Math.max(0, S.gems - Math.floor(num(give.gems, 0, 0, 1e12)));

    (Array.isArray(get.items) ? get.items : []).forEach(function (x) {
      if (!x || !PS.ITEMS[x.id]) {
        out.skipped++;
        return;
      }
      out.items.push(add(x.id, Math.floor(num(x.r, 0, 0, PS.MAX_RARITY))));
    });
    (Array.isArray(get.pets) ? get.pets : []).forEach(function (x) {
      if (!x || !PS.PET[x.sp] || !PS.PET_RARITY[x.r]) {
        out.skipped++;
        return;
      }
      var lv = Math.floor(num(x.lv, 1, 1, PS.PET_RARITY[x.r].cap));
      var have = null;
      S.pets.forEach(function (pet) { if (pet.sp === x.sp && pet.r === x.r) have = pet; });
      if (have) {
        var before = have.lv;
        have.lv = Math.max(have.lv, lv);
        out.pets.push({ pet: have, status: have.lv > before ? "level" : "same" });
        return;
      }
      var pet = { u: S.petUid++, sp: x.sp, r: x.r, lv: lv };
      S.pets.push(pet);
      if (S.petTeam.length < S.petSlots) S.petTeam.push(pet.u);
      out.pets.push({ pet: pet, status: "new" });
    });
    out.gold = Math.floor(num(get.gold, 0, 0, 1e12));
    out.gems = Math.floor(num(get.gems, 0, 0, 1e12));
    S.gold += out.gold;
    S.gems += out.gems;
    S.traded.push(id);
    if (S.traded.length > TRADES_KEPT) S.traded.splice(0, S.traded.length - TRADES_KEPT);
    S.stats.trades += 1;
    commit();
    return out;
  }

  /* ------------------------------------------------- taken away by an admin */

  /** Something an admin is taking away: { kind: "gold"|"gems"|"item", item,
   *  rarity, amount } where amount 0 means all of it (every copy of an item).
   *  Items in the bag go first, then worn ones; a lemon that loses its weapon
   *  picks up another (or a sling). Returns how much was really taken. */
  function applyTake(t) {
    if (!t || typeof t !== "object") return 0;
    var amount = Math.floor(num(Number(t.amount), 0, 0, 1e12));
    var taken = 0;
    if (t.kind === "gold" || t.kind === "gems") {
      var have = S[t.kind];
      taken = amount ? Math.min(have, amount) : have;
      S[t.kind] = have - taken;
    } else if (t.kind === "item" && PS.ITEMS[t.item]) {
      var r = Math.floor(num(Number(t.rarity), 0, 0, PS.MAX_RARITY));
      var matches = S.items.filter(function (item) { return item.id === t.item && item.r === r; });
      matches.sort(function (a, b) { return (isEquipped(a) ? 1 : 0) - (isEquipped(b) ? 1 : 0); });
      if (amount) matches = matches.slice(0, amount);
      matches.forEach(function (item) {
        var slot = defOf(item).slot;
        if (S.eq[slot] === item.u) S.eq[slot] = 0;
        remove(item.u);
        taken++;
      });
      if (!S.eq.weapon) {
        var spare = null;
        S.items.forEach(function (it) {
          if (defOf(it).slot === "weapon" && (!spare || it.r > spare.r)) spare = it;
        });
        S.eq.weapon = (spare || add("sling", 0)).u;
      }
    }
    if (taken) commit();
    return taken;
  }

  /* ------------------------------------------------------------- badges */

  /** Which tabs have something waiting. */
  function badges() {
    return {
      shop: giftWait() === 0 || dailyInfo().ready,
      gear: forgeAvailable() || S.items.some(function (item) { return item.n; }) || bookInfo().ready > 0,
      quests: quests().some(function (quest) { return quest.ready; }),
      talents: ascendInfo().can
    };
  }

  PS.state = {
    load: load,
    reset: reset,
    /** True once, right after a save was wiped: show the message, then it is gone for good. */
    takeWipeNotice: function () {
      if (PS.store.get(KEY_NOTICE, false) !== true) return false;
      PS.store.set(KEY_NOTICE, false);
      return true;
    },
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
    quickPlan: quickPlan,
    quickForge: quickForge,
    // talents
    talentInfo: talentInfo,
    unlockedTalents: unlockedTalents,
    ascendInfo: ascendInfo,
    ascend: ascend,
    buyTalent: buyTalent,
    // battles
    chapterOpen: chapterOpen,
    selectChapter: selectChapter,
    finishRun: finishRun,
    finishDuel: finishDuel,
    frontier: frontier,
    setRush: setRush,
    rushNow: rushNow,
    // shop
    chestCost: chestCost,
    openChest: openChest,
    eggCost: eggCost,
    hatch: hatch,
    petInfo: petInfo,
    levelPet: levelPet,
    togglePet: togglePet,
    petSlotCost: petSlotCost,
    buyPetSlot: buyPetSlot,
    petTeam: function () {
      return S.petTeam.map(petByUid).filter(Boolean);
    },
    craftShards: craftShards,
    giftWait: giftWait,
    claimGift: claimGift,
    deals: deals,
    buyDeal: buyDeal,
    goldPack: goldPack,
    buyGold: buyGold,
    stake: stake,
    payout: payout,
    // quests
    quests: quests,
    claimQuest: claimQuest,
    paySwarm: paySwarm,
    endlessInfo: endlessInfo,
    challengeInfo: challengeInfo,
    bookInfo: bookInfo,
    claimBook: claimBook,
    dailyInfo: dailyInfo,
    claimDaily: claimDaily,
    sellValue: sellValue,
    sell: sell,
    badges: badges,
    // trading
    tradeable: tradeable,
    applyTrade: applyTrade,
    traded: function (id) { return S.traded.indexOf(id) !== -1; },
    applyTake: applyTake,
    // admin menu: Power and stats set by hand, and text shown in place of Power
    BOOST_STATS: BOOST_STATS,
    boost: function () { return S.boost; },
    setBoost: function (raw) {
      S.boost = cleanBoost(raw);
      commit();
    },
    /** Text to show instead of the Power number, or "". */
    powerText: function () { return S.boost && S.boost.label ? S.boost.label : ""; },
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
    },
    /** Highest chapter cleared, set directly (0 locks everything but chapter 1). */
    devSetBest: function (n) {
      S.best = Math.floor(num(n, 0, 0, PS.BAL.CHAPTERS));
      S.chapter = Math.min(S.chapter, Math.min(PS.BAL.CHAPTERS, S.best + 1));
      commit();
    },
    /** Hatch eggs without paying for them. */
    devHatch: function (count) {
      var out = [];
      for (var i = 0; i < count; i++) out.push(hatchOne());
      commit();
      return out;
    },
    devAddShards: function (n) {
      S.shards += n;
      commit();
    },
    devSetShards: function (n) {
      S.shards = Math.floor(num(n, 0, 0, 1e9));
      commit();
    },
    devSetChapter: function (n) {
      S.chapter = Math.floor(num(n, 1, 1, PS.BAL.CHAPTERS));
      commit();
    },
    devResetTalents: function () {
      S.talents = {};
      S.ascend = 0;
      commit();
    },
    /** Step up a tier without having to max the last one first. */
    devAscend: function () {
      S.ascend = Math.min(PS.TALENT_TIERS - 1, S.ascend + 1);
      commit();
    },
    /** Claim every quest rung that is ready, until none are. Returns the gems paid. */
    devClaimQuests: function () {
      var total = 0;
      var again = true;
      while (again) {
        again = false;
        quests().forEach(function (quest) {
          if (quest.ready) {
            total += claimQuest(quest.id);
            again = true;
          }
        });
      }
      return total;
    },
    devMaxTalents: function () {
      unlockedTalents().forEach(function (talent) { S.talents[talent.id] = talent.max; });
      commit();
    },
    /** Every slot's level up to what its worn item's rarity allows. */
    devMaxSlots: function () {
      PS.SLOTS.forEach(function (slot) {
        var item = equipped(slot.key);
        if (item) S.lv[slot.key] = Math.max(S.lv[slot.key], PS.RARITY[item.r].cap);
      });
      commit();
    },
    /** Free gift ready now and today's deals back on the shelf. */
    devRefreshShop: function () {
      S.shop.freeAt = 0;
      S.shop.bought = [];
      commit();
    },
    /** The free gift comes due this many seconds from now (0 = ready). */
    devSetGiftWait: function (seconds) {
      S.shop.freeAt = seconds > 0 ? Date.now() + Math.floor(num(seconds, 0, 0, 1e7)) * 1000 : 0;
      commit();
    },
    /** Open chests without paying. Returns the items, like a real open. */
    devSimulateChests: simulateChests,
    devOpenChest: function (kind, count) {
      return openChest(kind, count, true);
    },
    /** How many chests since the last S-grade and SS-grade (the pity counters). */
    devSetPity: function (s, ss) {
      S.shop.pityS = Math.floor(num(s, 0, 0, 1e6));
      S.shop.pitySS = Math.floor(num(ss, 0, 0, 1e6));
      commit();
    },
    devSetRarity: function (u, rarity) {
      var item = byUid(u);
      if (!item) return false;
      item.r = Math.floor(num(rarity, 0, 0, PS.MAX_RARITY));
      commit();
      return true;
    },
    devSetSlotLevel: function (slot, level) {
      if (!(slot in S.lv)) return false;
      S.lv[slot] = Math.floor(num(level, 1, 1, PS.RARITY[PS.MAX_RARITY].cap));
      commit();
      return true;
    },
    /** Set the lifetime counters the quests and records read. */
    devSetStats: function (values) {
      Object.keys(S.stats).forEach(function (key) {
        if (values && values[key] !== undefined) S.stats[key] = Math.floor(num(values[key], 0, 0, 1e12));
      });
      commit();
    },
    devCompleteQuest: devCompleteQuest,
    devFinishQuests: devFinishQuests,
    devGivePet: devGivePet,
    devGiveAllPets: function () {
      PS.PET_SPECIES.forEach(function (sp) {
        PS.PET_RARITY.forEach(function (def, r) {
          var have = null;
          S.pets.forEach(function (pet) { if (pet.sp === sp.id && pet.r === r) have = pet; });
          if (have) {
            have.lv = def.cap;
          } else {
            have = { u: S.petUid++, sp: sp.id, r: r, lv: def.cap };
            S.pets.push(have);
            if (S.petTeam.length < S.petSlots) S.petTeam.push(have.u);
          }
        });
      });
      commit();
    },
    devRemovePet: devRemovePet,
    devFillTeam: devFillTeam,
    devSetPetLevel: function (u, level) {
      var pet = petByUid(u);
      if (!pet) return false;
      pet.lv = Math.floor(num(level, 1, 1, PS.PET_RARITY[pet.r].cap));
      commit();
      return true;
    },
    devMaxPets: function () {
      S.pets.forEach(function (pet) { pet.lv = PS.PET_RARITY[pet.r].cap; });
      commit();
    },
    devSetPetSlots: function (n) {
      S.petSlots = Math.floor(num(n, PS.PET_SLOTS.start, PS.PET_SLOTS.start, PS.PET_SLOTS.max));
      S.petTeam = S.petTeam.slice(0, S.petSlots);
      commit();
    },
    devCleanBag: devCleanBag,
    exportSave: function () { return JSON.stringify(S); },
    importSave: function (text) {
      var raw;
      try { raw = JSON.parse(text); } catch (err) { return false; }
      if (!raw || typeof raw !== "object" || raw.v !== VERSION) return false;
      S = sanitise(raw);
      commit();
      return true;
    }
  };
})();
