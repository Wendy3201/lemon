/*!
 * Pip Survivors — game data
 * Rarities, grades, every piece of gear and its perks, talents, chapters,
 * quests, shop prices and the balance curves that tie them together.
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function () {
  "use strict";

  var PS = window.PS;

  /* ------------------------------------------------------------- rarities */
  /* `mult` scales an item's main stat, `cap` is the highest slot level an
     item of that rarity can use. Surpass and ??? never drop: they only come
     out of the forge. */

  PS.RARITY = [
    { key: "common", name: "Common", color: "#9AA1A9", mult: 1, cap: 10 },
    { key: "uncommon", name: "Uncommon", color: "#5DB661", mult: 1.4, cap: 20 },
    { key: "rare", name: "Rare", color: "#3F8FE4", mult: 2, cap: 30 },
    { key: "epic", name: "Epic", color: "#A45DE6", mult: 2.8, cap: 40 },
    { key: "legendary", name: "Legendary", color: "#F2A31B", mult: 4, cap: 50 },
    { key: "mythic", name: "Mythic", color: "#E5484D", mult: 5.6, cap: 60 },
    { key: "surpass", name: "Surpass", color: "#17B8C4", mult: 8, cap: 70 },
    { key: "unknown", name: "???", color: "#8E7BFF", mult: 12, cap: 80 }
  ];
  PS.MAX_RARITY = PS.RARITY.length - 1;
  PS.MAX_DROP_RARITY = 5;

  /* Grades are a property of the item itself: an S-grade bow is S-grade at
     every rarity. They raise the main stat and come with stronger perks. */
  PS.GRADE = {
    A: { key: "A", name: "", label: "", mult: 1 },
    S: { key: "S", name: "S", label: "S-grade", mult: 1.2 },
    SS: { key: "SS", name: "SS", label: "SS-grade", mult: 1.45 }
  };

  PS.SLOTS = [
    { key: "weapon", name: "Weapon", plural: "Weapons", stat: "atk", weight: 25 },
    { key: "ring", name: "Ring", plural: "Rings", stat: "atk", weight: 15 },
    { key: "amulet", name: "Amulet", plural: "Amulets", stat: "atk", weight: 15 },
    { key: "helmet", name: "Helmet", plural: "Helmets", stat: "hp", weight: 15 },
    { key: "armor", name: "Armour", plural: "Armour", stat: "hp", weight: 15 },
    { key: "boots", name: "Boots", plural: "Boots", stat: "hp", weight: 15 }
  ];
  PS.SLOT = {};
  PS.SLOTS.forEach(function (slot) { PS.SLOT[slot.key] = slot; });

  /* ---------------------------------------------------------------- stats */

  PS.STATS = {
    atk: { name: "Attack", phrase: "attack" },
    hp: { name: "Health", phrase: "health" },
    atkPct: { name: "Attack", phrase: "attack", pct: true },
    hpPct: { name: "Health", phrase: "health", pct: true },
    crit: { name: "Crit chance", phrase: "crit chance", pct: true },
    critDmg: { name: "Crit damage", phrase: "crit damage", pct: true },
    haste: { name: "Attack speed", phrase: "attack speed", pct: true },
    speed: { name: "Move speed", phrase: "move speed", pct: true },
    armor: { name: "Damage reduction", phrase: "damage reduction", pct: true },
    regen: { name: "Regeneration", phrase: "health regenerated per second", pct: true },
    magnet: { name: "Pickup range", phrase: "pickup range", pct: true },
    gold: { name: "Gold bonus", phrase: "gold", pct: true },
    xp: { name: "XP bonus", phrase: "XP", pct: true },
    luck: { name: "Luck", phrase: "luck", pct: true },
    area: { name: "Attack size", phrase: "attack size", pct: true },
    bossDmg: { name: "Boss damage", phrase: "damage to bosses and elites", pct: true }
  };

  /** "+5% crit chance and +10% attack" from a perk's stat block. */
  PS.statsText = function (stats) {
    var parts = [];
    Object.keys(stats).forEach(function (key) {
      var info = PS.STATS[key];
      if (!info) return;
      parts.push("+" + (info.pct ? PS.pct(stats[key]) : PS.fmtStat(stats[key])) + " " + info.phrase);
    });
    if (parts.length < 2) return parts.join("");
    return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
  };

  PS.perkText = function (perk) {
    return perk.text || PS.statsText(perk.s || {});
  };

  /* ---------------------------------------------------------------- items */
  /* Perks switch on when the item reaches the rarity in `at`:
       2 Rare · 3 Epic · 4 Legendary · 5 Mythic · 7 ???
     `s` adds plain stats, `fx` switches on behaviour in battle (numbers add
     up across everything equipped), `pw` is how much the perk is worth in the
     Power score when it is not a plain stat. */

  var ITEMS = (PS.ITEMS = {});
  PS.ITEM_ORDER = [];

  function P(at, text, s, fx, pw) {
    return { at: at, text: text, s: s || null, fx: fx || null, pw: pw === undefined ? (fx ? 0.06 : 0) : pw };
  }

  function def(id, slot, grade, name, base, blurb, innate, perks) {
    ITEMS[id] = {
      id: id, slot: slot, grade: grade, name: name, base: base,
      blurb: blurb, innate: innate, perks: perks
    };
    PS.ITEM_ORDER.push(id);
  }

  /* weapons — each one changes how the lemon attacks */

  def("sling", "weapon", "A", "Seed Sling", 10,
    "Flicks a pip at the nearest pest. Simple, quick and reliable.", null, [
      P(2, "Pips pass through 1 more pest", null, { pierce: 1 }, 0.05),
      P(3, "Every 4th shot is a giant pip: triple damage, and nothing stops it", null, { emp: 4 }, 0.1),
      P(4, null, { haste: 0.15 }),
      P(5, "+1 pip with every shot", null, { count: 1 }, 0.3),
      P(7, "Pips burst into 3 splinters when they hit", null, { q: 1 }, 0.3)
    ]);

  def("blade", "weapon", "A", "Rind Blade", 10,
    "A wide slash that hits every pest in front of you. Get close.", null, [
      P(2, null, { area: 0.2 }),
      P(3, "Every 3rd slash spins all the way round you", null, { emp: 3 }, 0.1),
      P(4, "Heal 0.4% of your health for every pest you squash", null, { leech: 0.004 }, 0.08),
      P(5, "Slashes throw a crescent wave that cuts through pests", null, { wave: 1 }, 0.3),
      P(7, "Every attack strikes twice", null, { echo: 0.6 }, 0.5)
    ]);

  def("bow", "weapon", "A", "Thorn Bow", 10,
    "Long range. Arrows go straight through one pest and into the next.",
    { s: { crit: 0.1 } }, [
      P(2, null, { crit: 0.1 }),
      P(3, "Every 4th shot is a volley of 5 arrows", null, { emp: 4 }, 0.1),
      P(4, null, { critDmg: 0.4 }),
      P(5, "+1 arrow with every shot", null, { count: 1 }, 0.3),
      P(7, "Arrows bounce on to 3 more pests", null, { ricochet: 3 }, 0.3)
    ]);

  def("staff", "weapon", "A", "Sprout Staff", 10,
    "Lobs slow orbs that burst and hurt everything close by.", null, [
      P(2, null, { area: 0.25 }),
      P(3, "Every 3rd cast throws 3 orbs", null, { emp: 3 }, 0.1),
      P(4, "Hits set pests on fire for 40% damage per second", null, { burn: 0.4 }, 0.1),
      P(5, "Pests explode when they die", null, { boom: 0.6 }, 0.15),
      P(7, "Every burst calls down a second, bigger one", null, { q: 1 }, 0.4)
    ]);

  def("spear", "weapon", "A", "Stem Spear", 10,
    "A long stab that skewers a whole row of pests at once.", null, [
      P(2, null, { area: 0.2 }),
      P(3, "Every 3rd stab fans out three ways", null, { emp: 3 }, 0.1),
      P(4, null, { bossDmg: 0.25 }),
      P(5, "Stabs strike behind you as well", null, { back: 1 }, 0.25),
      P(7, "The spear tip flies on through everything in its way", null, { q: 1 }, 0.3)
    ]);

  def("daggers", "weapon", "A", "Twin Zesters", 10,
    "Very fast knives with a short reach. They love a critical hit.",
    { s: { crit: 0.12 } }, [
      P(2, null, { haste: 0.12 }),
      P(3, "Every 6th throw is a fan of 5 knives", null, { emp: 6 }, 0.1),
      P(4, null, { critDmg: 0.4 }),
      P(5, "Critical hits throw a bonus knife", null, { critShot: 1 }, 0.2),
      P(7, "Kills build Frenzy: +4% attack speed each, up to +60%", null, { q: 1 }, 0.35)
    ]);

  def("hammer", "weapon", "A", "Nutcracker", 10,
    "Slams the ground. Everything standing near you gets flattened.", null, [
      P(2, null, { area: 0.2 }),
      P(3, "Every 3rd slam hits 50% harder and stuns", null, { emp: 3 }, 0.1),
      P(4, null, { hpPct: 0.2 }),
      P(5, "Slams send out a second, wider shockwave", null, { ring2: 1 }, 0.25),
      P(7, "Slams crack the ground and hurt pests that stand on it", null, { q: 1 }, 0.35)
    ]);

  def("rang", "weapon", "A", "Peel-a-rang", 10,
    "Flies out, turns round and comes back, hitting on both trips.", null, [
      P(2, null, { area: 0.2 }),
      P(3, "Every 3rd throw sends out three", null, { emp: 3 }, 0.1),
      P(4, null, { haste: 0.2 }),
      P(5, "+1 boomerang with every throw", null, { count: 1 }, 0.3),
      P(7, "Boomerangs fly out and back twice", null, { q: 1 }, 0.35)
    ]);

  def("storm", "weapon", "S", "Stormcaller", 10,
    "Lightning that jumps from pest to pest to pest.", null, [
      P(2, "Lightning jumps to 2 more pests", null, { chain: 2 }, 0.12),
      P(3, "Every 4th cast is a thunderstorm of 6 bolts", null, { emp: 4 }, 0.12),
      P(4, "Pests you hit take 25% more damage for 3 seconds", null, { shock: 0.25 }, 0.2),
      P(5, "Lightning forks at two pests at once", null, { count: 1 }, 0.35),
      P(7, "Shocked pests release lightning when they die", null, { q: 1 }, 0.4)
    ]);

  def("frost", "weapon", "S", "Frostbite", 10,
    "Icy arrows that go through two pests and slow whatever they touch.",
    { fx: { chill: 0.35 }, text: "Hits slow pests by 35%" }, [
      P(2, "+30% damage to slowed pests", null, { chillAmp: 0.3 }, 0.2),
      P(3, "Every 4th shot is a volley of 7 arrows", null, { emp: 4 }, 0.12),
      P(4, "Slowed pests shatter when they die and hurt everything nearby", null, { shatter: 0.8 }, 0.15),
      P(5, "+1 arrow with every shot, and arrows go through 1 more pest", null, { count: 1, pierce: 1 }, 0.35),
      P(7, "Hitting a slowed pest freezes it solid", null, { freeze: 1 }, 0.4)
    ]);

  def("ember", "weapon", "S", "Ember Lance", 10,
    "A burning stab. Whatever it touches keeps on burning.",
    { fx: { burn: 0.4 }, text: "Hits set pests on fire for 40% damage per second" }, [
      P(2, "Fire burns 50% hotter", null, { burnAmp: 0.5 }, 0.1),
      P(3, "Every 3rd stab fans out three ways and leaves the ground burning", null, { emp: 3 }, 0.14),
      P(4, "Burning pests explode when they die", null, { burnBoom: 0.7 }, 0.18),
      P(5, "Stabs strike behind you as well, and reach further", { area: 0.15 }, { back: 1 }, 0.25),
      P(7, "Every stab breathes a cone of fire", null, { q: 1 }, 0.4)
    ]);

  def("fangs", "weapon", "S", "Shadow Fangs", 10,
    "Throws three knives at a time. Finishes off anything that is nearly dead.",
    { s: { crit: 0.15 } }, [
      P(2, "Pests below 15% health are finished off (not bosses)", null, { execute: 0.15 }, 0.15),
      P(3, "Every 5th throw is a ring of 12 knives", null, { emp: 5 }, 0.12),
      P(4, null, { critDmg: 0.5, crit: 0.05 }),
      P(5, "Knives bounce on to another pest", null, { ricochet: 1 }, 0.25),
      P(7, "A shadow copies every throw at a second target", null, { q: 1 }, 0.45)
    ]);

  def("solstice", "weapon", "SS", "Solstice", 10,
    "A blade of sunlight. Every swing throws a wave of fire across the field.", null, [
      P(2, "Hits set pests on fire for 50% damage per second", null, { burn: 0.5 }, 0.12),
      P(3, "Every 3rd swing spins all the way round and throws 4 waves", null, { emp: 3 }, 0.15),
      P(4, "Finishes off pests below 12% health, and +20% damage to bosses and elites", { bossDmg: 0.2 }, { execute: 0.12 }, 0.12),
      P(5, "Every 6 seconds a sunflare scorches every pest in sight", null, { sunflare: 1 }, 0.3),
      P(7, "Above 70% health: +50% damage and waves twice the size", null, { q: 1 }, 0.5)
    ]);

  def("eclipse", "weapon", "SS", "Eclipse", 10,
    "Opens a black hole that drags pests in, grinds them down, then bursts.", null, [
      P(2, null, { area: 0.25 }),
      P(3, "Every 3rd cast opens a second black hole", null, { emp: 3 }, 0.15),
      P(4, "Pests you hit take 30% more damage for 3 seconds", null, { shock: 0.3 }, 0.25),
      P(5, "Black holes burst into 10 piercing shards", null, { shards: 1 }, 0.3),
      P(7, "Every pest that dies inside a black hole makes its burst 10% stronger", null, { q: 1 }, 0.5)
    ]);

  /* helmets */

  def("cap", "helmet", "A", "Leaf Cap", 40,
    "Light, leafy and good for learning fast.", null, [
      P(2, null, { xp: 0.06 }),
      P(3, null, { hpPct: 0.08 }),
      P(4, null, { regen: 0.003 }),
      P(5, null, { xp: 0.1, hpPct: 0.08 }),
      P(7, "Start every battle with a free upgrade", null, { startUp: 1 }, 0.2)
    ]);

  def("acorn", "helmet", "A", "Acorn Helm", 46,
    "A hard little hat for a soft little lemon.", null, [
      P(2, null, { armor: 0.04 }),
      P(3, null, { hpPct: 0.1 }),
      P(4, null, { armor: 0.06 }),
      P(5, "A shield soaks up damage worth 15% of your health, then grows back", null, { barrier: 0.15 }, 0.12),
      P(7, "Come back to life once per battle with half your health", null, { revive: 1 }, 0.25)
    ]);

  def("crown", "helmet", "S", "Crown of Thorns", 44,
    "Anything that gets close enough to bite you regrets it.", null, [
      P(2, "Pests touching you take 120% damage per second", null, { thorns: 1.2 }, 0.08),
      P(3, null, { hpPct: 0.12 }),
      P(4, null, { armor: 0.08 }),
      P(5, "Getting hurt sets off a burst of thorns around you", null, { thornBurst: 1 }, 0.15),
      P(7, "Thorns hit three times as hard, and squashing a pest heals you", null, { thorns: 2.4, leech: 0.003 }, 0.3)
    ]);

  def("halo", "helmet", "SS", "First Lemon's Halo", 46,
    "It glows. Nobody remembers who the First Lemon was, but it glows.", null, [
      P(2, null, { atkPct: 0.1, hpPct: 0.1 }),
      P(3, "Come back to life once per battle with half your health", null, { revive: 1 }, 0.25),
      P(4, "Pests near you burn for 40% damage per second", null, { auraBurn: 0.4 }, 0.12),
      P(5, null, { crit: 0.12, armor: 0.1 }),
      P(7, "One more life, and coming back scorches everything around you", null, { revive: 1, reviveNova: 1 }, 0.4)
    ]);

  /* armour */

  def("bark", "armor", "A", "Bark Vest", 60,
    "Rough, cheap and tougher than it looks.", null, [
      P(2, null, { armor: 0.04 }),
      P(3, null, { hpPct: 0.1 }),
      P(4, null, { regen: 0.003 }),
      P(5, null, { armor: 0.08 }),
      P(7, "A shield soaks up damage worth 25% of your health, then grows back", null, { barrier: 0.25 }, 0.2)
    ]);

  def("shell", "armor", "A", "Shell Plate", 68,
    "Borrowed from a snail who was not using it.", null, [
      P(2, null, { hpPct: 0.06 }),
      P(3, null, { armor: 0.06 }),
      P(4, null, { hpPct: 0.12 }),
      P(5, "Below 35% health you take 30% less damage", null, { lastStand: 0.3 }, 0.12),
      P(7, "Come back to life once per battle with half your health", null, { revive: 1 }, 0.25)
    ]);

  def("sunpeel", "armor", "S", "Sunpeel Mail", 66,
    "Woven from dried peel. Warm, bright and oddly hard to dent.", null, [
      P(2, null, { regen: 0.004 }),
      P(3, null, { hpPct: 0.15 }),
      P(4, "A shield soaks up damage worth 20% of your health, then grows back", null, { barrier: 0.2 }, 0.16),
      P(5, "When the shield breaks it blasts pests away from you", null, { barrierNova: 1 }, 0.12),
      P(7, null, { hpPct: 0.25, regen: 0.006 })
    ]);

  def("golden", "armor", "SS", "Golden Rind", 72,
    "The thickest skin in the grove.", null, [
      P(2, null, { armor: 0.08 }),
      P(3, "A shield soaks up damage worth 30% of your health, then grows back", null, { barrier: 0.3 }, 0.22),
      P(4, "Pests touching you take 150% damage per second", null, { thorns: 1.5 }, 0.1),
      P(5, null, { hpPct: 0.2, regen: 0.005 }),
      P(7, "You can never lose more than 15% of your health in one second", null, { dmgCap: 0.15 }, 0.5)
    ]);

  /* boots */

  def("mud", "boots", "A", "Mud Boots", 30,
    "Squelchy, but they get you there.", { s: { speed: 0.03 } }, [
      P(2, null, { speed: 0.05 }),
      P(3, null, { hpPct: 0.08 }),
      P(4, null, { speed: 0.06 }),
      P(5, null, { magnet: 0.3 }),
      P(7, "You leave a trail of burning zest behind you", null, { trail: 1 }, 0.2)
    ]);

  def("hopper", "boots", "A", "Hopper Greaves", 28,
    "Springy shin guards, grasshopper approved.", { s: { speed: 0.05 } }, [
      P(2, null, { magnet: 0.15 }),
      P(3, null, { speed: 0.06 }),
      P(4, null, { haste: 0.08 }),
      P(5, null, { speed: 0.08, hpPct: 0.1 }),
      P(7, null, { haste: 0.12, speed: 0.12 })
    ]);

  def("wind", "boots", "S", "Windrunners", 30,
    "You do not so much walk in these as get carried along.", { s: { speed: 0.08 } }, [
      P(2, null, { haste: 0.1 }),
      P(3, null, { magnet: 0.2, speed: 0.06 }),
      P(4, "Pests near you are slowed by 20%", null, { auraChill: 0.2 }, 0.1),
      P(5, null, { haste: 0.12, speed: 0.1 }),
      P(7, "+25% damage while you are moving", null, { movingDmg: 0.25 }, 0.25)
    ]);

  /* rings */

  def("twig", "ring", "A", "Twig Ring", 3.5,
    "A twist of twig. Lucky, apparently.", null, [
      P(2, null, { crit: 0.05 }),
      P(3, null, { atkPct: 0.08 }),
      P(4, null, { critDmg: 0.2 }),
      P(5, null, { crit: 0.06, atkPct: 0.1 }),
      P(7, null, { critDmg: 0.5 })
    ]);

  def("signet", "ring", "A", "Seed Signet", 3.5,
    "Stamped with a pip. Makes your hands quicker.", null, [
      P(2, null, { haste: 0.08 }),
      P(3, null, { atkPct: 0.08 }),
      P(4, null, { haste: 0.08 }),
      P(5, null, { atkPct: 0.12 }),
      P(7, "+1 shot or strike with every attack", null, { count: 1 }, 0.3)
    ]);

  def("zest", "ring", "S", "Ring of Zest", 3.5,
    "Smells sharp. Hits sharper.", null, [
      P(2, null, { crit: 0.08 }),
      P(3, null, { atkPct: 0.12 }),
      P(4, null, { critDmg: 0.3 }),
      P(5, null, { bossDmg: 0.25 }),
      P(7, "Every attack repeats for 35% damage", null, { echo: 0.35 }, 0.3)
    ]);

  /* amulets */

  def("pebble", "amulet", "A", "Pebble Charm", 3,
    "A smooth stone on a string. Coins seem to find you.", null, [
      P(2, null, { gold: 0.08 }),
      P(3, null, { atkPct: 0.06 }),
      P(4, null, { gold: 0.1, xp: 0.05 }),
      P(5, null, { atkPct: 0.1 }),
      P(7, null, { gold: 0.3 })
    ]);

  def("dew", "amulet", "A", "Dewdrop Pendant", 3,
    "One cold drop that never dries up.", null, [
      P(2, null, { regen: 0.002 }),
      P(3, null, { hpPct: 0.08 }),
      P(4, "Heal 0.3% of your health for every pest you squash", null, { leech: 0.003 }, 0.06),
      P(5, null, { atkPct: 0.1, hpPct: 0.1 }),
      P(7, "+1 reroll per battle and better upgrade cards", { luck: 0.15 }, { reroll: 1 }, 0.1)
    ]);

  def("heart", "amulet", "S", "Heart of the Grove", 3,
    "It beats slowly, like something very old and very patient.", null, [
      P(2, null, { xp: 0.1 }),
      P(3, null, { atkPct: 0.1, hpPct: 0.1 }),
      P(4, "Start every battle with a free upgrade", null, { startUp: 1 }, 0.2),
      P(5, "+1 reroll per battle and better upgrade cards", { luck: 0.2 }, { reroll: 1 }, 0.1),
      P(7, "Every level-up in battle heals you and adds 2% damage", null, { levelAtk: 0.02 }, 0.4)
    ]);

  /* quick lookups: PS.POOL[slot][grade] -> [item ids] */
  PS.POOL = {};
  PS.ITEM_ORDER.forEach(function (id) {
    var item = ITEMS[id];
    var bySlot = PS.POOL[item.slot] || (PS.POOL[item.slot] = {});
    (bySlot[item.grade] || (bySlot[item.grade] = [])).push(id);
  });

  /* -------------------------------------------------------------- talents */
  /* Bought with gold, kept forever. cost(level) = base * growth^level. */

  PS.TALENTS = [
    { id: "str", name: "Strength", icon: "atk", stat: "atkPct", per: 0.03, max: 30, base: 60, growth: 1.22 },
    { id: "vit", name: "Vitality", icon: "hp", stat: "hpPct", per: 0.03, max: 30, base: 60, growth: 1.22 },
    { id: "pre", name: "Precision", icon: "crit", stat: "crit", per: 0.01, max: 15, base: 100, growth: 1.49 },
    { id: "fer", name: "Ferocity", icon: "critDmg", stat: "critDmg", per: 0.05, max: 20, base: 70, growth: 1.35 },
    { id: "agi", name: "Agility", icon: "haste", stat: "haste", per: 0.015, max: 20, base: 70, growth: 1.35 },
    { id: "fle", name: "Fleet Foot", icon: "speed", stat: "speed", per: 0.01, max: 15, base: 100, growth: 1.49 },
    { id: "tou", name: "Thick Skin", icon: "armor", stat: "armor", per: 0.01, max: 20, base: 70, growth: 1.35 },
    { id: "rec", name: "Recovery", icon: "regen", stat: "regen", per: 0.0005, max: 10, base: 160, growth: 1.82,
      text: "Regenerate 0.05% more of your health every second" },
    { id: "for", name: "Fortune", icon: "coin", stat: "gold", per: 0.03, max: 20, base: 70, growth: 1.35 },
    { id: "wis", name: "Wisdom", icon: "xp", stat: "xp", per: 0.02, max: 15, base: 100, growth: 1.49 },
    { id: "mag", name: "Magnetism", icon: "magnet", stat: "magnet", per: 0.05, max: 10, base: 160, growth: 1.82 },
    { id: "hed", name: "Head Start", icon: "startUp", fx: "startUp", per: 1, max: 3, costs: [2500, 30000, 250000],
      text: "Start every battle with a free upgrade" }
  ];
  /* Ascension: max out every talent of the top tier and you can ascend, which
     opens the next tier. Each higher tier has the same talents again (their
     name ends in II or III) at a bigger bonus per level and a much bigger
     price, plus three talents that only exist from tier II up. */
  PS.TALENT_TIERS = 3;
  PS.TALENT_TIER_NAMES = ["Talents", "Ascended talents", "Transcended talents"];
  (function () {
    var base = PS.TALENTS.map(function (t) {
      t.tier = 1;
      return t;
    });
    var extras = [
      { id: "luk", name: "Lucky Star", icon: "luck", stat: "luck", per: 0.02, max: 15, base: 100, growth: 1.49 },
      { id: "wid", name: "Wide Swing", icon: "area", stat: "area", per: 0.02, max: 15, base: 100, growth: 1.49 },
      { id: "gsl", name: "Giant Slayer", icon: "boom", stat: "bossDmg", per: 0.03, max: 20, base: 70, growth: 1.35 }
    ];
    var rules = [null, { roman: "II", per: 1.5, cost: 60 }, { roman: "III", per: 2, cost: 600 }];
    var all = base.slice();
    for (var tier = 2; tier <= PS.TALENT_TIERS; tier++) {
      var rule = rules[tier - 1];
      base.concat(extras).forEach(function (t) {
        var copy = {};
        Object.keys(t).forEach(function (key) { copy[key] = t[key]; });
        copy.id = t.id + tier;
        copy.name = t.name + " " + rule.roman;
        copy.tier = tier;
        copy.per = t.per * rule.per;
        if (t.base) copy.base = t.base * rule.cost;
        if (t.costs) copy.costs = t.costs.slice(0, 2).map(function (c) { return c * rule.cost; });
        if (t.fx) copy.max = 2;
        if (t.id === "rec") {
          copy.text = "Regenerate " + String(Number((copy.per * 100).toFixed(3))) + "% more of your health every second";
        } else if (t.text) {
          copy.text = t.text;
        }
        all.push(copy);
      });
    }
    PS.TALENTS = all;
  })();
  PS.TALENT = {};
  PS.TALENTS.forEach(function (talent) { PS.TALENT[talent.id] = talent; });

  PS.talentCost = function (talent, level) {
    if (talent.costs) return talent.costs[level];
    return Math.round(talent.base * Math.pow(talent.growth, level));
  };

  /* -------------------------------------------------------------- balance */
  /* One entry per chapter. Pests in chapter c have HP_SCALE times the health
     and DMG_SCALE times the bite of chapter 1, and REC_POWER is the number
     shown as "recommended".

     These were fitted, not guessed. A simulated player went through the shop,
     forge and upgrades with what each chapter pays, and thousands of battles
     were played against the gear that player had on arrival:
       - DMG_SCALE follows how fast health and armour grow, so one bite costs
         about the same share of the health bar, and runs ahead of that from
         chapter 15, where shields, regeneration and second lives make a
         lemon tougher than its health bar says;
       - HP_SCALE was then raised until the lemon took the same steady beating
         in every chapter. It climbs faster than attack alone would suggest
         (about 1.6x a chapter) because perks and grades multiply attack;
       - chapters 19 and 20 sit above the fit on purpose: they are where
         Surpass and ??? gear is meant to be needed;
       - BOSS_SCALE is the boss's own health curve. A lemon's damage to one
         big target grows faster than its damage to a crowd, so bosses need
         more than HP_SCALE to last their half a minute. (Bosses also tire as
         a fight drags on, see B.hit, which keeps weak builds from stalling.)
     Gold grows 1.35x a chapter, the same slope as level and talent prices. */

  var FITTED_COUNT = 20; // the chapters the tables below were fitted for
  var CHAPTER_COUNT = 50;

  var HP_SCALE = [1, 1.5, 2.6, 4.2, 6.6, 10.5, 16.5, 26, 41, 64, 100, 158, 260, 420, 800, 1250, 2000, 3000, 3800, 4600];
  var DMG_SCALE = [0.85, 1.1, 1.4, 1.9, 2.6, 3.7, 5.2, 7.3, 10.3, 14.5, 20.5, 28.9, 42, 62, 100, 145, 205, 280, 370, 470];
  var BOSS_SCALE = [1, 1.9, 3.6, 5.5, 12, 20, 33, 52, 82, 128, 190, 280, 420, 620, 920, 1350, 1950, 2700, 3400, 4300];
  var REC_POWER = [500, 650, 1200, 2100, 3600, 5500, 8400, 12500, 17500, 26500, 41000, 66000, 105000, 160000, 240000, 330000, 460000, 600000, 900000, 1300000];

  /* Harder than the fitted curve: how much extra each number gets at chapter 20.
     Chapter 1 is left alone and the extra grows evenly chapter by chapter, so
     turn these up for a tougher game and down for a gentler one. */
  var HARDER = { hp: 0.5, dmg: 0.3, boss: 0.6, power: 0.45 };
  for (var i = 0; i < FITTED_COUNT; i++) {
    var ramp = i / (FITTED_COUNT - 1);
    HP_SCALE[i] *= 1 + HARDER.hp * ramp;
    DMG_SCALE[i] *= 1 + HARDER.dmg * ramp;
    BOSS_SCALE[i] *= 1 + HARDER.boss * ramp;
    REC_POWER[i] = Math.round((REC_POWER[i] * (1 + HARDER.power * ramp)) / 10) * 10;
  }

  /* Chapters 21 to 50 carry on from chapter 20: every number grows by this
     factor per chapter. They were tuned with simulated battles, so that the
     very best gear (SS-grade ??? at slot level 80, every talent) can only just
     finish the last chapters, and ordinary Surpass / ??? gear stalls well
     before them. Raise a number to make that stretch harder, lower to ease it. */
  var LATE = { hp: 1.09, dmg: 1.09, boss: 1.09, power: 1.066 };
  for (var j = FITTED_COUNT; j < CHAPTER_COUNT; j++) {
    HP_SCALE[j] = HP_SCALE[j - 1] * LATE.hp;
    DMG_SCALE[j] = DMG_SCALE[j - 1] * LATE.dmg;
    BOSS_SCALE[j] = BOSS_SCALE[j - 1] * LATE.boss;
    REC_POWER[j] = Math.round((REC_POWER[j - 1] * LATE.power) / 10) * 10;
  }

  PS.BAL = {
    CHAPTERS: CHAPTER_COUNT,
    HERO: { atk: 2, hp: 30, crit: 0.05, critDmg: 1.5 },
    LEVEL_GROWTH: 1.035,
    ARMOR_CAP: 0.6,
    hpScale: function (chapter) { return HP_SCALE[chapter - 1]; },
    dmgScale: function (chapter) { return DMG_SCALE[chapter - 1]; },
    bossScale: function (chapter) { return BOSS_SCALE[chapter - 1]; },
    recPower: function (chapter) { return REC_POWER[chapter - 1]; },
    // grows 35% a chapter up to chapter 20, then 8%: there is little left to buy by then
    gold: function (chapter) {
      var base = 450 * Math.pow(1.35, Math.min(chapter, FITTED_COUNT) - 1);
      return Math.round(base * Math.pow(1.08, Math.max(0, chapter - FITTED_COUNT)));
    },
    /** What one chest costs, in gems. Fixed: it does not change with your chapter. */
    chestPrice: function (kind) {
      return PS.CHESTS[kind].gems;
    },
    gemsFirst: function (chapter) { return 100 + 10 * chapter; },
    gemsRepeat: 5,
    duration: function (chapter) { return 180 + Math.min(chapter - 1, 4) * 30; },
    levelCost: function (level) { return Math.round(30 * Math.pow(1.09, level - 1)); },
    levelMult: function (level) { return Math.pow(PS.BAL.LEVEL_GROWTH, level - 1); },
    lootMu: function (chapter) { return 0.315 * (chapter - 1) - 0.5; }
  };

  /** Chances for Common..Mythic when loot is centred on rarity `mu`. */
  PS.rarityWeights = function (mu) {
    var weights = [];
    for (var r = 0; r <= PS.MAX_DROP_RARITY; r++) {
      var d = r - Math.min(mu, PS.MAX_DROP_RARITY);
      weights.push(Math.exp(-(d * d) / 0.98));
    }
    return weights;
  };

  /* ------------------------------------------------------------- chapters */

  PS.ZONES = [
    { name: "The Orchard", floor: "#28301F", dot: "rgba(203,226,160,0.10)", prop: "#3A4A2B", accent: "#8FAE65" },
    { name: "The Garden", floor: "#33281C", dot: "rgba(240,214,170,0.10)", prop: "#4A3A27", accent: "#C79A5B" },
    { name: "The Greenhouse", floor: "#1C302D", dot: "rgba(170,236,222,0.10)", prop: "#2A4742", accent: "#5FBFAE" },
    { name: "The Kitchen", floor: "#2B2733", dot: "rgba(226,214,255,0.09)", prop: "#3D3749", accent: "#A99BD9" },
    { name: "The Cellar", floor: "#1B1920", dot: "rgba(214,200,255,0.07)", prop: "#2C2836", accent: "#8F7BC4" },
    { name: "The Pantry", floor: "#2E2A1E", dot: "rgba(255,226,160,0.09)", prop: "#4A4228", accent: "#E3B65B" },
    { name: "The Attic", floor: "#2A2523", dot: "rgba(230,205,190,0.08)", prop: "#443A36", accent: "#C9A58D" },
    { name: "The Drains", floor: "#17262B", dot: "rgba(150,225,235,0.08)", prop: "#24404A", accent: "#4FB6C9" },
    { name: "The Furnace", floor: "#2E1C18", dot: "rgba(255,170,110,0.09)", prop: "#4B2B22", accent: "#F2784B" },
    { name: "The Rotten Core", floor: "#221A2C", dot: "rgba(225,160,255,0.08)", prop: "#38284A", accent: "#C46BE0" }
  ];
  /* chapters 1-20 are four to a zone; the rest are six to a zone */
  function zoneOf(c) {
    return c <= FITTED_COUNT ? Math.floor((c - 1) / 4) : 5 + Math.floor((c - FITTED_COUNT - 1) / 6);
  }

  var CHAPTER_NAMES = [
    "Windfall Row", "Tall Grass", "Mossy Roots", "The Old Stump",
    "Veg Patch", "Bean Poles", "Slug Alley", "Compost Heap",
    "Seed Trays", "Vine Wall", "Mist Room", "The Hothouse",
    "Counter Top", "Fruit Bowl", "The Sink", "Under the Fridge",
    "Cellar Stairs", "Jam Shelves", "Cider Press", "The Mould Throne",
    "Spice Rack", "Flour Bin", "Biscuit Tin", "Pickle Jars", "Honey Crock", "The Cold Larder",
    "Attic Stairs", "Dusty Trunks", "Cobweb Beams", "The Old Cradle", "Moth Loft", "Chimney Flue",
    "Drain Mouth", "Pipe Maze", "Sludge Run", "Rusty Grate", "Gutter Falls", "The Sump",
    "Coal Chute", "Boiler Room", "Cinder Lane", "Ember Pit", "Ash Hall", "The Furnace Heart",
    "Rot Roots", "Spore Garden", "Blight Tunnels", "The Gnarled Bough", "Pip Graveyard", "The Last Pip"
  ];
  var BOSS_KINDS = ["hornet", "queen", "slug", "mould"];
  var BOSS_NAMES = [
    "The Hornet", "Aphid Queen", "Slug Baron", "Stump Rot",
    "Weevil Rex", "Moth Matriarch", "Slug Duke", "Compost Horror",
    "Vine Ripper", "Whitefly Empress", "Mist Snail", "Hothouse Blight",
    "Fruit Fly Ace", "Ant Queen", "Drain Lurker", "Fridge Fuzz",
    "Jam Wasp", "Spider Mother", "Press Leech", "The Mould King",
    "Pantry Moth", "Flour Wraith", "Crumb King", "Brine Slug", "Honey Hornet Queen", "Frost Weevil",
    "Cobweb Warden", "Trunk Mimic", "Beam Spider", "Cradle Rot", "Moth Lord", "Soot Fiend",
    "Drain Eel", "Pipe Worm", "Sludge Mother", "Grate Crawler", "Gutter Gator", "Sump Tyrant",
    "Coal Beetle", "Boiler Brute", "Cinder Wasp", "Ember Slug", "Ash Queen", "Furnace Colossus",
    "Root Strangler", "Spore Mother", "Blight Rex", "The Gnarled One", "Pip Reaper", "The Rot Sovereign"
  ];
  /* the pest that turns up twice as often in each chapter */
  var FEATURED = [
    null, "spitter", "splitter", "brute", "charger", "dart", "bomber", "splitter", "spitter", "charger",
    "bomber", "brute", "dart", "spitter", "splitter", "bomber", "charger", "spitter", "brute", null,
    "splitter", "charger", "bomber", "spitter", "brute", "dart", "splitter", "charger", "bomber", "spitter",
    "brute", "dart", "splitter", "charger", "bomber", "spitter", "brute", "dart", "splitter", "charger",
    "bomber", "spitter", "brute", "dart", "splitter", "charger", "bomber", "spitter", "brute", "brute"
  ];
  /* first clear of a zone boss hands out a special item: [grade, slot or null] */
  var MILESTONES = {
    4: ["S", "weapon"], 8: ["S", null], 12: ["S", "weapon"], 16: ["SS", null], 20: ["SS", "weapon"],
    24: ["S", "weapon"], 28: ["SS", null], 32: ["S", null], 36: ["SS", "weapon"], 40: ["SS", null],
    44: ["SS", null], 48: ["SS", "weapon"], 50: ["SS", null]
  };

  /* Every boss looks different. The four kinds above decide how a boss fights;
     its look (colours, a pattern and an extra part) is worked out per chapter
     here and used by both the menu picture and the battle drawing. Chapters 1
     to 4 keep the original four. feature: 0 horns, 1 spikes, 2 wings, 3 tail,
     4 legs, 5 antennae, 6 gem, 7 plates. pattern: 0 none, 1 stripes, 2 spots,
     3 belly, 4 zigzag. */
  function hsl(h, s, l) {
    function channel(n) {
      var k = (n + h / 30) % 12;
      var a = s * Math.min(l, 1 - l);
      var v = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
      return ("0" + Math.round(v * 255).toString(16)).slice(-2);
    }
    return "#" + channel(0) + channel(8) + channel(4);
  }
  var ORIGINAL_LOOKS = {
    queen: { body: "#7FB069", dark: "#4E7A3A", accent: "#C3E3A8" },
    hornet: { body: "#E0A93B", dark: "#3A2A10", accent: "#F3D58C" },
    slug: { body: "#9C8AC2", dark: "#6E5E94", accent: "#D4C8EE" },
    mould: { body: "#6FA8A0", dark: "#4E7F78", accent: "#B5DCD6" }
  };
  function bossLook(n) {
    var kind = BOSS_KINDS[(n - 1) % 4];
    if (n <= 4) {
      var o = ORIGINAL_LOOKS[kind];
      return { body: o.body, dark: o.dark, accent: o.accent, pattern: 0, feature: -1 };
    }
    var hue = (n * 47 + 20) % 360;
    var sat = 0.45 + 0.1 * ((n * 7) % 4);
    var lit = 0.5 + 0.05 * ((n % 3) - 1);
    return {
      body: hsl(hue, sat, lit),
      dark: hsl(hue, sat, lit * 0.45),
      accent: hsl(hue, sat * 0.8, Math.min(0.9, lit + 0.26)),
      pattern: Math.floor(n / 8) % 5,
      feature: n % 8
    };
  }

  PS.CHAPTERS = [];
  for (var c = 1; c <= CHAPTER_COUNT; c++) {
    PS.CHAPTERS.push({
      look: bossLook(c),
      n: c,
      name: CHAPTER_NAMES[c - 1],
      zone: zoneOf(c),
      boss: BOSS_KINDS[(c - 1) % 4],
      bossName: BOSS_NAMES[c - 1],
      // boss attack patterns top out at the tier of chapter 17 to 20
      bossTier: Math.min(4, Math.floor((c - 1) / 4)),
      featured: FEATURED[c - 1],
      milestone: MILESTONES[c] || null,
      duration: PS.BAL.duration(c),
      hpScale: PS.BAL.hpScale(c),
      dmgScale: PS.BAL.dmgScale(c),
      bossScale: PS.BAL.bossScale(c),
      rec: PS.BAL.recPower(c),
      gold: PS.BAL.gold(c)
    });
  }

  PS.chapter = function (n) {
    return PS.CHAPTERS[PS.clamp(n, 1, CHAPTER_COUNT) - 1];
  };

  /* ----------------------------------------------------------------- shop */

  /* Chest odds never change, however far you have got: `odds` is the chance of
     Common, Uncommon, Rare, Epic, Legendary and Mythic, in that order. `special`
     is rolled first: that share of chests is a fixed grade at a fixed rarity
     (the Gilded Chest's 0.65% is an S-grade Uncommon), and the `odds` split the
     rest, so they add up to 1 minus `special.chance`. A chest never gives an
     SS-grade item; the Gilded Chest can drop an SS shard alongside its item
     (`shard` per chest), and SHARDS.needed of them are turned into one
     Uncommon SS-grade item at the shop. */
  PS.CHESTS = {
    crate: { key: "crate", name: "Seed Crate", gems: 10, odds: [0.79, 0.15, 0.06, 0, 0, 0], s: 0.005, ss: 0, shard: 0,
      text: "One piece of gear: mostly Common, sometimes Uncommon or Rare." },
    gilded: { key: "gilded", name: "Gilded Chest", gems: 40, odds: [0.6235, 0.25, 0.09, 0.03, 0, 0], s: 0, ss: 0, shard: 0.0002,
      special: { chance: 0.0065, grade: "S", rarity: 1 },
      text: "One piece of gear, up to Epic, with a small chance of an S-grade Uncommon and a tiny chance of an SS shard." }
  };
  PS.SHARDS = { needed: 6, rarity: 1 }; // 6 SS shards make one Uncommon SS-grade item
  /* What a piece of gear sells for: its rarity's price plus its grade's price, so
     a ??? SS-grade item sells for both added together. Below Mythic, and plain
     (A) grade, is worth nothing to the buyer. */
  PS.SELL = {
    rarity: { 5: 20000, 6: 60000, 7: 200000 },
    grade: { S: 10000, SS: 100000 }
  };
  PS.CHEST_BULK = { count: 10, big: 100, discount: 0.9 }; // 10 and 100 at once, both 10% off
  PS.DROP_GRADE = { s: 0.04, sFrom: 3, ss: 0.004, ssFrom: 10 };
  PS.GIFT = { every: 4 * 60 * 60 * 1000, gems: 10, goldShare: 0.25 };
  PS.GOLD_PACK = { gems: 50, runs: 2 };
  PS.DEAL_COUNT = 4;
  PS.START = { gems: 100, gold: 0, kit: ["sling", "cap", "bark"] };

  /* --------------------------------------------------------------- quests */
  /* Each line is a ladder: finish a rung, claim its gems, see the next one. */

  PS.QUESTS = [
    { id: "chapters", name: "Pest Control", stat: "best", text: "Clear chapter {n}",
      tiers: [1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 25, 30, 35, 40, 45, 50],
      gems: [40, 40, 50, 60, 70, 80, 100, 120, 140, 160, 200, 400, 250, 300, 350, 400, 500, 800] },
    { id: "kills", name: "Squasher", stat: "kills", text: "Squash {n} pests",
      tiers: [100, 500, 2000, 5000, 15000, 40000, 100000], gems: [30, 40, 60, 80, 100, 150, 250] },
    { id: "forge", name: "Blacksmith", stat: "forges", text: "Forge {n} times", first: "Forge an item",
      tiers: [1, 5, 15, 40, 100, 250], gems: [40, 50, 70, 100, 150, 250] },
    { id: "chests", name: "Treasure Hunter", stat: "chests", text: "Open {n} chests", first: "Open a chest",
      tiers: [1, 5, 20, 50, 100, 200], gems: [30, 50, 80, 120, 200, 300] },
    { id: "levels", name: "Tinkerer", stat: "upgrades", text: "Buy {n} gear levels",
      tiers: [5, 20, 60, 120, 200, 300, 400], gems: [30, 40, 60, 80, 100, 150, 200] },
    { id: "talents", name: "Student", stat: "talents", text: "Learn {n} talent levels",
      tiers: [3, 10, 30, 60, 100, 150, 200], gems: [30, 40, 60, 80, 100, 150, 200] },
    { id: "power", name: "Powerhouse", stat: "bestPower", text: "Reach {n} power",
      tiers: [1000, 2500, 6000, 15000, 40000, 100000, 250000], gems: [30, 50, 70, 100, 150, 200, 300] },
    { id: "rarity", name: "Collector", stat: "maxRarity", text: "Own {n} item",
      tiers: [2, 3, 4, 5, 6, 7], labels: ["a Rare", "an Epic", "a Legendary", "a Mythic", "a Surpass", "a ???"],
      gems: [30, 60, 100, 150, 250, 500] },
    { id: "grade", name: "Top Shelf", stat: "grade", text: "Own {n} item",
      tiers: [1, 2], labels: ["an S-grade", "an SS-grade"], gems: [100, 300] },
    { id: "runlevel", name: "Snowball", stat: "bestLevel", text: "Reach level {n} in one battle",
      tiers: [10, 15, 20, 25, 30], gems: [30, 50, 80, 120, 200] }
  ];
})();
