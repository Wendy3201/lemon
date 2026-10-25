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
     item of that rarity can use. Surpass and ??? only drop in the last
     stretch of chapters (see PS.dropCap); Celestial, Cosmic and Infinity only
     come out of the forge, and are what takes a lemon past ???: a higher
     main stat, and slot levels past 80. */

  PS.RARITY = [
    { key: "common", name: "Common", color: "#9AA1A9", mult: 1, cap: 10 },
    { key: "uncommon", name: "Uncommon", color: "#5DB661", mult: 1.4, cap: 20 },
    { key: "rare", name: "Rare", color: "#3F8FE4", mult: 2, cap: 30 },
    { key: "epic", name: "Epic", color: "#A45DE6", mult: 2.8, cap: 40 },
    { key: "legendary", name: "Legendary", color: "#F2A31B", mult: 4, cap: 50 },
    { key: "mythic", name: "Mythic", color: "#E5484D", mult: 5.6, cap: 60 },
    { key: "surpass", name: "Surpass", color: "#17B8C4", mult: 8, cap: 70 },
    { key: "unknown", name: "???", color: "#8E7BFF", mult: 12, cap: 80 },
    { key: "celestial", name: "Celestial", color: "#E9B949", mult: 17, cap: 90 },
    { key: "cosmic", name: "Cosmic", color: "#7B5CFF", mult: 24, cap: 100 },
    { key: "infinity", name: "Infinity", color: "#FF4D9D", mult: 34, cap: 110 }
  ];
  PS.MAX_RARITY = PS.RARITY.length - 1;
  PS.MAX_DROP_RARITY = 4; // Legendary: loot up to chapter 100, and deals, stop here; Mythic and up are forged
  PS.SECRET_RARITY = 7; // ???: its perks stay hidden until an item reaches it

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

  /* more weapons */

  def("whip", "weapon", "A", "Vine Whip", 10,
    "A long lash that cracks across a whole row of pests.", null, [
      P(2, null, { area: 0.2 }),
      P(3, "Every 3rd lash cracks in a full circle", null, { emp: 3 }, 0.1),
      P(4, null, { crit: 0.1, critDmg: 0.2 }),
      P(5, "+1 lash with every attack", null, { count: 1 }, 0.3),
      P(7, "Lashes snap back for 60% damage on the return", null, { q: 1 }, 0.35)
    ]);

  def("cannon", "weapon", "A", "Pit Cannon", 10,
    "Spits a burst of pellets. Cruel up close, weak far away.", null, [
      P(2, "Pellets pass through 1 more pest", null, { pierce: 1 }, 0.05),
      P(3, "Every 3rd blast fires a full ring of pellets", null, { emp: 3 }, 0.1),
      P(4, null, { atkPct: 0.1 }),
      P(5, "+2 pellets with every shot", null, { count: 1 }, 0.3),
      P(7, "Pellets explode where they hit", null, { q: 1 }, 0.35)
    ]);

  def("mace", "weapon", "A", "Pith Mace", 10,
    "Spins a ring of force around you, over and over. Nothing gets past it.", null, [
      P(2, null, { area: 0.2 }),
      P(3, "Every 3rd spin hits 60% harder and throws pests far back", null, { emp: 3 }, 0.1),
      P(4, null, { hpPct: 0.15 }),
      P(5, "Each spin hits twice", null, { count: 1 }, 0.3),
      P(7, "Spins leave a ring of burning zest on the ground", null, { q: 1 }, 0.35)
    ]);

  def("flask", "weapon", "A", "Acid Flask", 10,
    "Lobs a flask that bursts into a pool that eats at everything in it.", null, [
      P(2, null, { area: 0.25 }),
      P(3, "Every 3rd throw is three flasks at once", null, { emp: 3 }, 0.1),
      P(4, null, { haste: 0.15 }),
      P(5, "+1 flask with every throw", null, { count: 1 }, 0.3),
      P(7, "Pools last twice as long and burn 50% hotter", null, { q: 1 }, 0.35)
    ]);

  def("comet", "weapon", "S", "Comet Staff", 10,
    "Calls a comet down on the thickest part of the swarm.", null, [
      P(2, null, { area: 0.2 }),
      P(3, "Every 3rd cast calls down three comets", null, { emp: 3 }, 0.12),
      P(4, "Hits set pests on fire for 50% damage per second", null, { burn: 0.5 }, 0.12),
      P(5, "+1 comet with every cast", null, { count: 1 }, 0.35),
      P(7, "Every comet leaves a crater of fire", null, { q: 1 }, 0.4)
    ]);

  def("hive", "weapon", "S", "Hive Horn", 10,
    "Blows a swarm of homing pips that hunt pests down on their own.", null, [
      P(2, null, { haste: 0.1 }),
      P(3, "Every 4th blast is a swarm of 10 pips", null, { emp: 4 }, 0.12),
      P(4, null, { crit: 0.1, critDmg: 0.3 }),
      P(5, "+2 pips with every blast", null, { count: 1 }, 0.35),
      P(7, "Pips split in two when they hit a pest", null, { q: 1 }, 0.4)
    ]);

  def("thornlash", "weapon", "S", "Thornlash", 10,
    "A barbed whip. Pests it catches are softened up for everything else.",
    { fx: { shock: 0.15 }, text: "Pests you hit take 15% more damage for 3 seconds" }, [
      P(2, null, { area: 0.2 }),
      P(3, "Every 3rd lash cracks in a full circle", null, { emp: 3 }, 0.12),
      P(4, "Pests below 15% health are finished off (not bosses)", null, { execute: 0.15 }, 0.15),
      P(5, "+1 lash with every attack, and lashes reach further", { area: 0.15 }, { count: 1 }, 0.35),
      P(7, "Lashes snap back for 60% damage, and squashing a pest heals you", null, { q: 1, leech: 0.003 }, 0.45)
    ]);

  def("nova", "weapon", "SS", "Supernova", 10,
    "A heartbeat of light, then a ring of fire that sweeps everything away.", null, [
      P(2, null, { area: 0.25 }),
      P(3, "Every 3rd burst is almost twice as big", null, { emp: 3 }, 0.15),
      P(4, "Pests you hit take 30% more damage for 3 seconds", null, { shock: 0.3 }, 0.25),
      P(5, "Each burst throws 8 piercing shards", null, { shards: 1 }, 0.3),
      P(7, "Bursts leave a ring of fire that burns for 3 seconds", null, { q: 1 }, 0.5)
    ]);

  def("geyser", "weapon", "SS", "Lemonade Geyser", 10,
    "Erupts geysers under the pests nearest you and flings them skyward.", null, [
      P(2, null, { area: 0.25 }),
      P(3, "Every 3rd cast erupts under six more pests", null, { emp: 3 }, 0.15),
      P(4, "Hits slow pests by 35%", null, { chill: 0.35 }, 0.2),
      P(5, "+2 geysers with every cast", null, { count: 1 }, 0.3),
      P(7, "Every eruption is followed by a second, bigger one", null, { q: 1 }, 0.5)
    ]);

  /* The armory's rings, amulets, helmets, armour and boots (armory.js) share
     their perks across grades, so S pieces get bigger numbers on their stat
     perks instead: level with the hand-made S pieces, and never past the
     hand-made SS item of their slot, which stays the best there is. (Armory
     weapons keep their perks as they are; their grade shows in the main stat.) */
  var GEAR_GRADE = { A: 1, S: 1.5 };
  function graded(stats, grade) {
    if (!stats) return null;
    var out = {};
    for (var key in stats) out[key] = Math.round(stats[key] * GEAR_GRADE[grade] * 10000) / 10000;
    return out;
  }

  /* the armory: every attack style paired with every element (armory.js) */
  PS.ARMORY.forEach(function (w) {
    var arch = PS.ARCH[w.arch];
    var el = PS.ELEMENT[w.el];
    def(w.id, "weapon", w.grade, w.name, 10, (arch.blurb + " " + el.blurb).trim(), el.innate, [
      P(2, null, arch.perk2),
      P(3, arch.empText, null, { emp: arch.emp }, 0.1),
      P(4, null, arch.perk4),
      P(5, arch.countText, null, { count: 1 }, 0.3),
      P(7, el.top.text, el.top.s || null, el.top.fx, 0.4)
    ]);
  });

  /* more armour, boots, rings, amulets and helmets */

  def("warden", "helmet", "S", "Grove Warden's Hood", 44,
    "Woven from living leaves. The grove looks after whoever wears it.", null, [
      P(2, null, { hpPct: 0.1 }),
      P(3, "Pests near you are slowed by 20%", null, { auraChill: 0.2 }, 0.1),
      P(4, null, { armor: 0.08 }),
      P(5, "A shield soaks up damage worth 20% of your health, then grows back", null, { barrier: 0.2 }, 0.16),
      P(7, "Start every battle with two free upgrades", null, { startUp: 2 }, 0.35)
    ]);

  def("thornmail", "armor", "S", "Thornmail", 66,
    "Every plate has a point, and every point has an opinion.", null, [
      P(2, "Pests touching you take 100% damage per second", null, { thorns: 1.0 }, 0.08),
      P(3, null, { hpPct: 0.15 }),
      P(4, null, { armor: 0.1 }),
      P(5, "Below 35% health you take 30% less damage", null, { lastStand: 0.3 }, 0.12),
      P(7, "Getting hurt sets off a burst of thorns around you", null, { thornBurst: 1 }, 0.25)
    ]);

  def("gale", "boots", "S", "Gale Striders", 30,
    "They lean into the wind so you do not have to.", { s: { speed: 0.08 } }, [
      P(2, null, { speed: 0.08 }),
      P(3, null, { haste: 0.1 }),
      P(4, "You leave a trail of burning zest behind you", null, { trail: 1 }, 0.2),
      P(5, null, { magnet: 0.3, speed: 0.08 }),
      P(7, "+25% damage while you are moving", null, { movingDmg: 0.25 }, 0.25)
    ]);

  def("rindring", "ring", "S", "Ring of Rind", 3.5,
    "Cut from a single, very stubborn peel.", null, [
      P(2, null, { atkPct: 0.1 }),
      P(3, null, { haste: 0.1 }),
      P(4, null, { crit: 0.08 }),
      P(5, null, { atkPct: 0.12, critDmg: 0.3 }),
      P(7, "+1 shot or strike with every attack", null, { count: 1 }, 0.35)
    ]);

  def("locket", "amulet", "S", "Moonpip Locket", 3,
    "A pip that only shines at night. Open it and it hums.", null, [
      P(2, null, { gold: 0.12 }),
      P(3, null, { xp: 0.1, hpPct: 0.08 }),
      P(4, "Heal 0.3% of your health for every pest you squash", null, { leech: 0.003 }, 0.06),
      P(5, null, { atkPct: 0.12 }),
      P(7, "+1 reroll per battle and better upgrade cards", { luck: 0.2 }, { reroll: 1 }, 0.15)
    ]);

  def("firstwind", "boots", "SS", "Firstwind Greaves", 32,
    "Cut from the first breeze that ever crossed the orchard.", { s: { speed: 0.1 } }, [
      P(2, null, { speed: 0.1, haste: 0.08 }),
      P(3, "Pests near you are slowed by 30%", null, { auraChill: 0.3 }, 0.12),
      P(4, null, { magnet: 0.4, hpPct: 0.12 }),
      P(5, "+30% damage while you are moving", null, { movingDmg: 0.3 }, 0.3),
      P(7, "You can never lose more than 18% of your health in one second", null, { dmgCap: 0.18 }, 0.5)
    ]);

  def("evering", "ring", "SS", "Everlong Band", 3.5,
    "It has no beginning and, as far as anyone can tell, no end.", null, [
      P(2, null, { atkPct: 0.15 }),
      P(3, null, { crit: 0.1, critDmg: 0.4 }),
      P(4, "Every attack repeats for 30% damage", null, { echo: 0.3 }, 0.25),
      P(5, null, { atkPct: 0.2, haste: 0.1 }),
      P(7, "Every attack repeats for 50% damage and strikes one more time", null, { echo: 0.5, count: 1 }, 0.55)
    ]);

  def("firstseed", "amulet", "SS", "The First Seed", 3,
    "Every orchard there has ever been started as this.", null, [
      P(2, null, { atkPct: 0.12, hpPct: 0.12 }),
      P(3, "Start every battle with a free upgrade", null, { startUp: 1 }, 0.2),
      P(4, "Every level-up in battle heals you and adds 2% damage", null, { levelAtk: 0.02 }, 0.4),
      P(5, null, { xp: 0.15, gold: 0.2 }),
      P(7, "Come back to life once per battle, and every level-up adds 3% damage", null, { revive: 1, levelAtk: 0.03 }, 0.5)
    ]);

  /* the armory's rings, amulets, helmets, armour and boots: every kind of each
     with every theme (armory.js) */
  PS.GEAR.forEach(function (g) {
    var theme = PS.GEAR_THEME[g.theme];
    var perks = g.perks.map(function (perk, i) {
      var at = i + 2; // Rare, Epic, Legendary, Mythic
      return perk.fx ? P(at, perk.text, null, perk.fx, perk.pw) : P(at, null, graded(perk, g.grade));
    });
    var top = theme.top;
    perks.push(P(7, top.text, graded(top.s, g.grade), top.fx, top.fx ? (top.pw || 0.3) : 0));
    // an always-on effect keeps its numbers (they are in its words); always-on stats grow with the grade
    var innate = theme.innate.text ? theme.innate : { s: graded(theme.innate.s, g.grade) };
    def(g.id, g.slot, g.grade, g.name, g.base, (g.blurb + " " + theme.blurb).trim(), innate, perks);
  });

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
     name ends in II, III and so on, up to VI) at a bigger bonus per level and
     a much bigger price, plus three talents that only exist from tier II up.
     Tiers IV to VI are for chapters past 100, priced for the gold those pay. */
  PS.TALENT_TIERS = 6;
  PS.TALENT_TIER_NAMES = ["Talents", "Ascended talents", "Transcended talents", "Exalted talents", "Divine talents", "Eternal talents"];
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
    var rules = [null, { roman: "II", per: 1.5, cost: 60 }, { roman: "III", per: 2, cost: 600 },
      { roman: "IV", per: 2.5, cost: 30000 }, { roman: "V", per: 3, cost: 300000 }, { roman: "VI", per: 3.5, cost: 3000000 }];
    var all = base.slice();
    for (var tier = 2; tier <= PS.TALENT_TIERS; tier++) {
      var rule = rules[tier - 1];
      base.concat(extras).forEach(function (t) {
        if (t.fx && tier > 3) return; // Head Start stops at tier III: seven free cards are plenty to start a battle with
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
  var CHAPTER_COUNT = 250;
  var TUNED_COUNT = 50; // the late stretch below was tuned when the game ended at chapter 50
  var OLD_COUNT = 100; // where the game ended before chapters 101 to 250

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
     factor per chapter. They were tuned with simulated battles; raise a
     number to make that stretch harder, lower to ease it. */
  var LATE = { hp: 1.09, dmg: 1.09, boss: 1.09, power: 1.066 };
  for (var j = FITTED_COUNT; j < TUNED_COUNT; j++) {
    HP_SCALE[j] = HP_SCALE[j - 1] * LATE.hp;
    DMG_SCALE[j] = DMG_SCALE[j - 1] * LATE.dmg;
    BOSS_SCALE[j] = BOSS_SCALE[j - 1] * LATE.boss;
    REC_POWER[j] = Math.round((REC_POWER[j - 1] * LATE.power) / 10) * 10;
  }

  /* Chapters 51 to 100 keep climbing until chapter 100 asks for MAX_POWER:
     what was the most Power the game allowed before chapters 101 to 250 (every
     talent to tier III, the best pets, the hand-made SS gear at ??? and slot
     level 80). The recommended Power grows by the same factor every chapter to
     get there. The pests grow by END.pests a chapter, tuned with simulated
     battles so that a lemon maxed like that can only just beat chapter 100. */
  var MAX_POWER = 272000000;
  var END = {
    power: Math.pow(MAX_POWER / REC_POWER[TUNED_COUNT - 1], 1 / (OLD_COUNT - TUNED_COUNT)),
    pests: 1.078
  };
  for (var k = TUNED_COUNT; k < OLD_COUNT; k++) {
    var climb = k - TUNED_COUNT + 1;
    HP_SCALE[k] = HP_SCALE[TUNED_COUNT - 1] * Math.pow(END.pests, climb);
    DMG_SCALE[k] = DMG_SCALE[TUNED_COUNT - 1] * Math.pow(END.pests, climb);
    BOSS_SCALE[k] = BOSS_SCALE[TUNED_COUNT - 1] * Math.pow(END.pests, climb);
    REC_POWER[k] = Math.round((REC_POWER[TUNED_COUNT - 1] * Math.pow(END.power, climb)) / 10) * 10;
  }

  /* Chapters 101 to 250 go past the old ceiling: Celestial, Cosmic and
     Infinity gear (and slot levels to 110) and talent tiers IV to VI let a
     lemon keep growing. Every 50 chapters is a checkpoint with the build a
     lemon there is expected to have, the Power that build has, and how much
     tougher than chapter 100 the pests are: their health, their bite and the
     boss's health, fitted with simulated battles so that the build wins about
     as often as a lemon maxed for chapter 100 does there. Chapter 250 asks for
     everything: Infinity gear at slot level 110 and every talent to tier VI.
     Between checkpoints every number grows by the same factor each chapter. */
  var CHECKS = [
    { n: 150, power: 2210000000, hp: 8.0, dmg: 7.0, boss: 8.0 }, // Celestial gear at slot level 90, talents to tier IV
    { n: 200, power: 16250000000, hp: 56.9, dmg: 19.6, boss: 102 }, // Cosmic gear at slot level 100, talents to tier V
    { n: 250, power: 108400000000, hp: 362, dmg: 90, boss: 830 } // Infinity gear at slot level 110, talents to tier VI
  ];
  var last = { n: OLD_COUNT, power: REC_POWER[OLD_COUNT - 1], hp: 1, dmg: 1, boss: 1 };
  CHECKS.forEach(function (next) {
    for (var c2 = last.n + 1; c2 <= next.n; c2++) {
      var f = (c2 - last.n) / (next.n - last.n);
      var between = function (key) { return last[key] * Math.pow(next[key] / last[key], f); };
      HP_SCALE[c2 - 1] = HP_SCALE[OLD_COUNT - 1] * between("hp");
      DMG_SCALE[c2 - 1] = DMG_SCALE[OLD_COUNT - 1] * between("dmg");
      BOSS_SCALE[c2 - 1] = BOSS_SCALE[OLD_COUNT - 1] * between("boss");
      REC_POWER[c2 - 1] = Math.round(between("power") / 10) * 10;
    }
    last = next;
  });

  PS.BAL = {
    CHAPTERS: CHAPTER_COUNT,
    HERO: { atk: 2, hp: 30, crit: 0.05, critDmg: 1.5 },
    LEVEL_GROWTH: 1.035,
    ARMOR_CAP: 0.6,
    hpScale: function (chapter) { return HP_SCALE[chapter - 1]; },
    dmgScale: function (chapter) { return DMG_SCALE[chapter - 1]; },
    bossScale: function (chapter) { return BOSS_SCALE[chapter - 1]; },
    recPower: function (chapter) { return REC_POWER[chapter - 1]; },
    // grows 35% a chapter up to chapter 20, then 8% (there is little left to buy by then), then 5% after chapter 100
    gold: function (chapter) {
      var base = 450 * Math.pow(1.35, Math.min(chapter, FITTED_COUNT) - 1);
      base *= Math.pow(1.08, Math.max(0, Math.min(chapter, OLD_COUNT) - FITTED_COUNT));
      return Math.round(base * Math.pow(1.05, Math.max(0, chapter - OLD_COUNT)));
    },
    /** What one chest costs, in gems. Fixed: it does not change with your chapter. */
    chestPrice: function (kind) {
      return PS.CHESTS[kind].gems;
    },
    gemsFirst: function (chapter) { return 100 + 10 * chapter; },
    gemsRepeat: 5,
    duration: function (chapter) { return 180 + Math.min(chapter - 1, 4) * 30; },
    // slot levels past 80 (Celestial gear and up) cost 35% more each
    levelCost: function (level) { return Math.round(30 * Math.pow(1.09, Math.min(level, 80) - 1) * Math.pow(1.35, Math.max(0, level - 80))); },
    levelMult: function (level) { return Math.pow(PS.BAL.LEVEL_GROWTH, level - 1); },
    lootMu: function (chapter) { return 0.315 * (chapter - 1) - 0.5; }
  };

  /** The rarest gear a chapter's loot can be: Legendary up to chapter 100,
   *  then Mythic, Surpass from 151 and ??? from 201, so forging the rarities
   *  past ??? never needs thousands of Legendaries. */
  PS.dropCap = function (chapter) {
    return chapter <= OLD_COUNT ? PS.MAX_DROP_RARITY : chapter <= 150 ? 5 : chapter <= 200 ? 6 : 7;
  };

  /** Chances for Common up to `cap` (MAX_DROP_RARITY unless given) when loot is centred on rarity `mu`. */
  PS.rarityWeights = function (mu, cap) {
    var top = cap === undefined ? PS.MAX_DROP_RARITY : cap;
    var weights = [];
    for (var r = 0; r <= top; r++) {
      var d = r - Math.min(mu, top);
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
    { name: "The Rotten Core", floor: "#221A2C", dot: "rgba(225,160,255,0.08)", prop: "#38284A", accent: "#C46BE0" },
    { name: "The Rooftops", floor: "#24262E", dot: "rgba(200,210,235,0.08)", prop: "#363A47", accent: "#8E9BC4" },
    { name: "The Pond", floor: "#162D29", dot: "rgba(160,240,210,0.09)", prop: "#22443D", accent: "#5FC9A6" },
    { name: "The Ice Box", floor: "#1B2633", dot: "rgba(210,235,255,0.10)", prop: "#2B3B4E", accent: "#9BDCFF" },
    { name: "The Thorn Wilds", floor: "#2A1A20", dot: "rgba(255,180,205,0.08)", prop: "#432630", accent: "#E07A9C" },
    { name: "The Golden Grove", floor: "#2B2614", dot: "rgba(255,232,150,0.10)", prop: "#463D1E", accent: "#F2C94C" },
    // chapters 101 to 250: out past the First Tree, into the wide world and up to the stars
    { name: "The Wild Meadow", floor: "#2A3320", dot: "rgba(220,240,170,0.10)", prop: "#3D4A2C", accent: "#A8C94F" },
    { name: "The Hedgerow", floor: "#1F2B1C", dot: "rgba(190,230,160,0.09)", prop: "#2E4229", accent: "#6FAE5A" },
    { name: "The Old Woods", floor: "#1E241A", dot: "rgba(200,220,170,0.08)", prop: "#2F3A27", accent: "#8BA05E" },
    { name: "The Mushroom Ring", floor: "#2B1F26", dot: "rgba(255,200,230,0.09)", prop: "#432F3B", accent: "#E08AB8" },
    { name: "The Riverbank", floor: "#1A2A2E", dot: "rgba(170,225,240,0.09)", prop: "#27414A", accent: "#5FB3D9" },
    { name: "The Marsh", floor: "#1F2620", dot: "rgba(180,220,190,0.08)", prop: "#2E3B30", accent: "#7FA88A" },
    { name: "The Rocky Hills", floor: "#2A2826", dot: "rgba(230,220,210,0.08)", prop: "#403C38", accent: "#B8A48F" },
    { name: "The Crystal Caves", floor: "#1A1A2E", dot: "rgba(190,200,255,0.10)", prop: "#2A2B4A", accent: "#9FB4FF" },
    { name: "The Lava Fields", floor: "#2A1512", dot: "rgba(255,150,100,0.10)", prop: "#45211A", accent: "#FF6A3D" },
    { name: "The Storm Peaks", floor: "#1E2230", dot: "rgba(210,220,255,0.09)", prop: "#2E3448", accent: "#8FA8E0" },
    { name: "The Cloud Garden", floor: "#2A2E38", dot: "rgba(255,255,255,0.12)", prop: "#3E4454", accent: "#CFE3FF" },
    { name: "The Night Orchard", floor: "#141628", dot: "rgba(200,190,255,0.08)", prop: "#22264A", accent: "#7C83E8" },
    { name: "The Moon Grove", floor: "#22232A", dot: "rgba(235,235,245,0.10)", prop: "#363845", accent: "#D9DCE8" },
    { name: "The Starfield", floor: "#0F0E1E", dot: "rgba(255,240,200,0.12)", prop: "#1E1C3A", accent: "#FFD36E" },
    { name: "The Heart of Citrus", floor: "#2E2810", dot: "rgba(255,240,150,0.12)", prop: "#4A401A", accent: "#FFE14A" }
  ];
  /* chapters 1-20 are four to a zone, 21-50 six to a zone, and 51-250 ten */
  function zoneOf(c) {
    if (c <= FITTED_COUNT) return Math.floor((c - 1) / 4);
    if (c <= TUNED_COUNT) return 5 + Math.floor((c - FITTED_COUNT - 1) / 6);
    return 10 + Math.floor((c - TUNED_COUNT - 1) / 10);
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
    "Rot Roots", "Spore Garden", "Blight Tunnels", "The Gnarled Bough", "Pip Graveyard", "The Last Pip",
    "Gutter Ledge", "Slate Slopes", "Chimney Stacks", "Weather Vane", "Crow's Perch",
    "The Skylight", "Lead Flashing", "Aerial Mast", "Moss Tiles", "The Ridge Line",
    "Lily Pads", "Reed Beds", "Frogspawn Shallows", "Duckweed Mat", "The Muddy Bank",
    "Stepping Stones", "Dragonfly Reach", "Sunken Log", "Willow Roots", "The Deep End",
    "Frost Door", "Ice Tray", "Frozen Peas", "Freezer Burn", "Rime Shelves",
    "Snowdrift Drawer", "Icicle Hall", "Cold Store", "Permafrost", "The Frozen Heart",
    "Bramble Gate", "Nettle Path", "Rose Thicket", "Hawthorn Hedge", "Thistledown",
    "Blackberry Maze", "Gorse Hill", "Briar Hollow", "Spine Wood", "The Thorn Throne",
    "Sunlit Path", "Honey Meadow", "Amber Orchard", "Golden Boughs", "Pollen Haze",
    "Gilded Roots", "The Old Orchard", "Seed Vault", "Sun Temple", "The First Tree",
    "Through the Fence", "Buttercup Field", "Long Grass Sea", "Clover Hill", "Poppy Patch",
    "Dandelion Clocks", "Molehill Rise", "Cowslip Bank", "Harvest Mouse Run", "The Meadow Crown",
    "Hawthorn Gap", "Sloe Bushes", "Bird's Nest", "Hazel Tangle", "Wren's Hollow",
    "Ivy Wall", "Dormouse Den", "Elderflower Arch", "Bramble Underpass", "The Green Tunnel",
    "Bluebell Wood", "Fallen Oak", "Bracken Deep", "Badger Sett", "Owl Hollow",
    "Woodpecker Drum", "Fern Gully", "Lichen Stones", "Antler Glade", "The Ancient Oak",
    "Toadstool Path", "Puffball Patch", "Fairy Ring", "Ink Cap Corner", "Bracket Steps",
    "Glowcap Cave", "Morel Maze", "Truffle Burrow", "Spore Storm", "The Toadstool Throne",
    "Pebble Shore", "Kingfisher Bend", "Otter Slide", "Watercress Beds", "Mill Wheel",
    "Weir Falls", "Heron Shallows", "Rushing Rapids", "Sandbar Island", "The River Mouth",
    "Bog Edge", "Peat Cuttings", "Wisp Lights", "Cattail Forest", "Sinking Sands",
    "Mosquito Cloud", "Leech Pools", "Heron's Watch", "Fog Banks", "The Drowned Tree",
    "Scree Slope", "Goat Track", "Heather Moor", "Granite Tor", "Wind Gap",
    "Shepherd's Hut", "Slate Quarry", "Eagle Crag", "Boulder Run", "The High Cairn",
    "Cave Mouth", "Dripstone Hall", "Glow-worm Grotto", "Quartz Garden", "Echo Chamber",
    "Amethyst Vein", "Underground Lake", "Geode Hollow", "Crystal Bridge", "The Diamond Heart",
    "Ash Plains", "Basalt Steps", "Steam Vents", "Obsidian Ridge", "Magma Pools",
    "Cinder Cone", "Sulphur Springs", "Fire Fountain", "Smoke Wall", "The Burning Peak",
    "Thunder Path", "Hail Field", "Lightning Spire", "Gale Bridge", "Snow Line",
    "Cloudbreak", "Frozen Falls", "Raven's Ledge", "The Eye of the Storm", "The Storm Throne",
    "Rainbow Stair", "Cotton Hills", "Sky Orchard", "Floating Isles", "Mist Fountains",
    "Dew Terraces", "Sunbeam Bridge", "Wind Chimes", "Cloud Palace", "The Silver Lining",
    "Dusk Gate", "Firefly Lanes", "Owl Branches", "Moonlit Pond", "Shadow Rows",
    "Bat Roost", "Dream Blossoms", "Midnight Well", "Starlit Bough", "The Witching Hour",
    "Crater Rim", "Silver Dust", "Low Gravity Hop", "Moonstone Field", "Night Tide Pools",
    "Earthrise", "Pale Orchard", "Lunar Lake", "The Dark Side", "The Moon Tree",
    "Comet Trail", "Nebula Drift", "Asteroid Belt", "Star Nursery", "Constellation Path",
    "Solar Wind", "Galaxy Spiral", "Pulsar Beacon", "Supernova", "The Edge of Everything",
    "Seed of Stars", "Rind Cathedral", "Juice Falls", "Pith Labyrinth", "Zest Storm",
    "Peel Peaks", "Golden Segment", "The Sour Sea", "Lemon Light", "The Great Pip"
  ];
  /* Which creature each chapter's boss is, to match its name (Spider Mother is
     a spider, Pipe Worm a worm...), in an order where no two chapters in a row
     share one, and the paired bosses from chapter 40 on always differ. */
  var BOSS_KIND_OF = [
    "hornet", "queen", "slug", "mould", "beetle", "moth", "slug", "worm", "beetle", "moth",
    "slug", "mould", "fly", "queen", "worm", "mould", "hornet", "spider", "worm", "mould",
    "moth", "fly", "queen", "slug", "hornet", "beetle", "spider", "beetle", "spider", "mould",
    "moth", "fly", "slug", "worm", "queen", "spider", "beetle", "mould", "beetle", "mould",
    "hornet", "slug", "queen", "beetle", "worm", "mould", "beetle", "spider", "fly", "queen",
    "slug", "beetle", "moth", "hornet", "fly", "spider", "worm", "queen", "mould", "beetle",
    "worm", "hornet", "queen", "slug", "beetle", "spider", "fly", "mould", "moth", "worm",
    "hornet", "slug", "beetle", "mould", "spider", "moth", "fly", "queen", "worm", "beetle",
    "hornet", "spider", "queen", "beetle", "moth", "slug", "fly", "worm", "mould", "queen",
    "beetle", "hornet", "slug", "moth", "fly", "worm", "spider", "mould", "hornet", "queen",
    "beetle", "moth", "worm", "queen", "hornet", "fly", "slug", "spider", "mould", "moth",
    "hornet", "slug", "spider", "beetle", "moth", "queen", "worm", "fly", "mould", "beetle",
    "hornet", "beetle", "spider", "worm", "moth", "fly", "slug", "mould", "queen", "beetle",
    "slug", "mould", "moth", "fly", "beetle", "spider", "worm", "hornet", "queen", "mould",
    "beetle", "fly", "slug", "queen", "moth", "worm", "spider", "hornet", "mould", "worm",
    "beetle", "mould", "moth", "fly", "slug", "queen", "worm", "spider", "hornet", "beetle",
    "spider", "fly", "moth", "beetle", "hornet", "mould", "worm", "queen", "slug", "spider",
    "moth", "slug", "worm", "beetle", "fly", "spider", "hornet", "mould", "queen", "beetle",
    "moth", "slug", "fly", "spider", "worm", "hornet", "mould", "beetle", "queen", "worm",
    "beetle", "moth", "fly", "spider", "slug", "hornet", "mould", "worm", "queen", "beetle",
    "moth", "slug", "hornet", "spider", "fly", "worm", "beetle", "mould", "queen", "worm",
    "moth", "fly", "spider", "slug", "hornet", "beetle", "mould", "worm", "queen", "spider",
    "beetle", "moth", "fly", "slug", "worm", "hornet", "mould", "spider", "queen", "beetle",
    "fly", "moth", "beetle", "slug", "spider", "hornet", "worm", "mould", "queen", "worm",
    "beetle", "moth", "fly", "slug", "hornet", "spider", "worm", "mould", "queen", "beetle"
  ];
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
    "Root Strangler", "Spore Mother", "Blight Rex", "The Gnarled One", "Pip Reaper", "The Rot Sovereign",
    "Gutter Slug", "Slate Weevil", "Soot Moth", "Vane Hornet", "Carrion Fly",
    "Glass Spider", "Lead Worm", "Mast Queen", "Tile Moss", "Ridge Tyrant",
    "Lily Leech", "Reed Hornet", "Spawn Mother", "Duckweed Snail", "Mud Beetle",
    "Pond Skater", "Dragonfly Ace", "Log Rot", "Willow Moth", "The Deep Leech",
    "Frost Hornet", "Ice Slug", "Pea Weevil", "Freezer Mould", "Rime Spider",
    "Snow Moth", "Icicle Fly", "Cold Store Queen", "Permafrost Worm", "The Frozen Colossus",
    "Bramble Wasp", "Nettle Spider", "Rose Aphid Queen", "Hedge Beetle", "Thistle Moth",
    "Bramble Slug", "Gorse Fly", "Briar Worm", "Spine Mould", "The Thorn Queen",
    "Sun Beetle", "Honey Wasp", "Amber Slug", "Gilded Moth", "Pollen Fly",
    "Golden Worm", "Orchard Spider", "Vault Mould", "Temple Hornet", "The Last Pest",
    "Fence Post Beetle", "Buttercup Moth", "Meadow Worm", "Clover Aphid Queen", "Poppy Hornet",
    "Dandelion Fly", "Molehill Slug", "Cowslip Spider", "Hay Mould", "The Meadow Monarch",
    "Gap Hornet", "Sloe Slug", "Nest Spider", "Hazel Weevil", "Hollow Moth",
    "Ivy Aphid Queen", "Den Worm", "Elder Fly", "Underpass Mould", "The Hedge Colossus",
    "Bluebell Hornet", "Oak Borer", "Bracken Spider", "Sett Worm", "Owl Moth",
    "Drumming Fly", "Gully Slug", "Lichen Mould", "Glade Aphid Queen", "The Stag King",
    "Toadstool Slug", "Puffball Mould", "Ring Moth", "Ink Cap Fly", "Bracket Beetle",
    "Glowcap Spider", "Morel Worm", "Truffle Hornet", "Spore Queen", "The Mould Emperor",
    "Shore Beetle", "Kingfisher Fly", "Otter Slug", "Cress Aphid Queen", "Mill Moth",
    "Weir Worm", "Water Spider", "Rapids Hornet", "Sandbar Mould", "The River Serpent",
    "Bog Beetle", "Peat Mould", "Wisp Moth", "Cattail Fly", "Sinking Slug",
    "Mosquito Queen", "Leech Worm", "Marsh Spider", "Fog Hornet", "The Bog Colossus",
    "Scree Spider", "Track Fly", "Heather Moth", "Tor Beetle", "Gale Hornet",
    "Hut Mould", "Quarry Worm", "Crag Aphid Queen", "Boulder Slug", "The Cairn Spider",
    "Cave Moth", "Drip Slug", "Glow Worm", "Quartz Beetle", "Echo Fly",
    "Amethyst Spider", "Lake Hornet", "Geode Mould", "Crystal Aphid Queen", "The Crystal Colossus",
    "Ash Moth", "Basalt Slug", "Vent Fly", "Obsidian Spider", "Magma Worm",
    "Cinder Hornet", "Sulphur Mould", "Flame Beetle", "Smoke Aphid Queen", "The Lava Wyrm",
    "Thunder Beetle", "Hail Moth", "Spark Fly", "Gale Spider", "Snow Slug",
    "Cloud Hornet", "Falls Mould", "Ledge Worm", "Storm Aphid Queen", "The Thunder King",
    "Rainbow Moth", "Cotton Slug", "Sky Hornet", "Isle Spider", "Mist Fly",
    "Dew Worm", "Sunbeam Beetle", "Chime Mould", "Palace Aphid Queen", "The Sky Serpent",
    "Dusk Moth", "Lantern Fly", "Night Spider", "Moon Slug", "Shadow Hornet",
    "Roost Beetle", "Dream Mould", "Well Worm", "Star Aphid Queen", "The Night Mother",
    "Crater Beetle", "Dust Moth", "Hopping Fly", "Moonstone Slug", "Tide Worm",
    "Earthrise Hornet", "Pale Mould", "Lunar Spider", "Dark Aphid Queen", "The Moon Colossus",
    "Comet Fly", "Nebula Moth", "Asteroid Beetle", "Nursery Slug", "Star Spider",
    "Solar Hornet", "Spiral Worm", "Pulsar Mould", "Nova Aphid Queen", "The Star Eater",
    "Star Seed Beetle", "Rind Moth", "Juice Fly", "Pith Slug", "Zest Hornet",
    "Peel Spider", "Segment Worm", "Sour Mould", "The Pest Queen", "The Pest Emperor"
  ];
  /* the pest that turns up twice as often in each chapter */
  var FEATURED = [
    null, "spitter", "splitter", "brute", "charger", "dart", "bomber", "splitter", "spitter", "charger",
    "bomber", "brute", "dart", "spitter", "splitter", "bomber", "charger", "spitter", "brute", null,
    "splitter", "charger", "bomber", "spitter", "brute", "dart", "splitter", "charger", "bomber", "spitter",
    "brute", "dart", "splitter", "charger", "bomber", "spitter", "brute", "dart", "splitter", "charger",
    "bomber", "spitter", "brute", "dart", "splitter", "charger", "bomber", "spitter", "brute", "brute",
    "dart", "spitter", "charger", "splitter", "bomber", "brute", "dart", "charger", "spitter", "splitter",
    "bomber", "brute", "spitter", "dart", "charger", "splitter", "bomber", "brute", "dart", "spitter",
    "charger", "splitter", "brute", "bomber", "dart", "spitter", "charger", "splitter", "brute", "bomber",
    "spitter", "dart", "splitter", "charger", "brute", "bomber", "spitter", "dart", "splitter", "charger",
    "brute", "bomber", "dart", "spitter", "splitter", "charger", "brute", "bomber", "spitter", "brute"
  ];
  // chapters 101 to 250 go round the six in an order that never repeats one chapter to the next
  (function () {
    var round = ["splitter", "charger", "spitter", "bomber", "brute", "dart", "charger", "splitter", "brute", "spitter", "dart", "bomber"];
    for (var n = OLD_COUNT + 1; n <= CHAPTER_COUNT; n++) FEATURED.push(round[(n - OLD_COUNT - 1) % round.length]);
  })();
  /* first clear of a zone boss hands out a special item: [grade, slot or null] */
  var MILESTONES = {
    4: ["S", "weapon"], 8: ["S", null], 12: ["S", "weapon"], 16: ["SS", null], 20: ["SS", "weapon"],
    24: ["S", "weapon"], 28: ["SS", null], 32: ["S", null], 36: ["SS", "weapon"], 40: ["SS", null],
    44: ["SS", null], 48: ["SS", "weapon"], 50: ["SS", null],
    54: ["S", null], 58: ["S", "weapon"], 62: ["SS", null], 66: ["S", null], 70: ["SS", "weapon"],
    74: ["S", null], 78: ["SS", null], 82: ["S", "weapon"], 86: ["SS", null], 90: ["SS", "weapon"],
    94: ["SS", null], 98: ["SS", null], 100: ["SS", "weapon"]
  };
  // chapters 101 to 250: an S or SS item every fourth chapter, and an SS weapon at the end of every zone
  for (var mn = OLD_COUNT + 4; mn <= CHAPTER_COUNT; mn += 4) MILESTONES[mn] = [mn % 8 === 0 ? "SS" : "S", mn % 12 === 0 ? "weapon" : null];
  for (var mz = OLD_COUNT + 10; mz <= CHAPTER_COUNT; mz += 10) MILESTONES[mz] = ["SS", "weapon"];

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
    var kind = BOSS_KIND_OF[n - 1];
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
      boss: BOSS_KIND_OF[c - 1],
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
    gilded: { key: "gilded", name: "Gilded Chest", gems: 40, odds: [0.6235, 0.25, 0.09, 0.03, 0, 0], s: 0, ss: 0, shard: 0.004,
      special: { chance: 0.0065, grade: "S", rarity: 1 },
      text: "One piece of gear, up to Epic, with a small chance of an S-grade Uncommon and a tiny chance of an SS shard." }
  };
  PS.SHARDS = { needed: 6, rarity: 1 }; // 6 SS shards make one Uncommon SS-grade item
  /* What a piece of gear sells for: its rarity's price plus its grade's price, so
     a ??? SS-grade item sells for both added together. Below Mythic, and plain
     (A) grade, is worth nothing to the buyer. */
  PS.SELL = {
    rarity: { 5: 20000, 6: 60000, 7: 200000, 8: 600000, 9: 2000000, 10: 6000000 },
    grade: { S: 10000, SS: 100000 }
  };
  PS.CHEST_BULK = { count: 10, big: 100, discount: 0.9 }; // 10 and 100 at once, both 10% off
  PS.DROP_GRADE = { s: 0.04, sFrom: 3, ss: 0, ssFrom: 10 };
  /* Pets. A pet egg costs gems and hatches one pet: a species and a rarity.
     The rarities are Common, Uncommon, Rare and Epic, and there is no S or SS
     grade. Hatching a pet you already have levels it up; gold
     levels it up too. The pet you bring along fights next to you and gives its
     stat bonus. A pet's bonus is per * level * the rarity's multiplier. */
  PS.PET_SPECIES = [
    { id: "bumble", name: "Bumble", stat: "haste", per: 0.004, color: "#E0A93B", blurb: "A fuzzy little bee that makes you faster." },
    { id: "ladybug", name: "Ladybug", stat: "armor", per: 0.003, color: "#E5484D", blurb: "Hard shell, soft heart." },
    { id: "snail", name: "Snail", stat: "hpPct", per: 0.006, color: "#B9A98A", blurb: "Slow, steady and hard to hurt." },
    { id: "ant", name: "Ant", stat: "gold", per: 0.006, color: "#6F4A2A", blurb: "Finds coins nobody else saw." },
    { id: "moth", name: "Moth", stat: "xp", per: 0.005, color: "#C9BEA6", blurb: "Drawn to the glow of every gem." },
    { id: "firefly", name: "Firefly", stat: "crit", per: 0.002, color: "#FFE14A", blurb: "Lights up the weak spots." },
    { id: "cricket", name: "Cricket", stat: "speed", per: 0.003, color: "#6FBF5A", blurb: "Always one hop ahead." },
    { id: "beetle", name: "Beetle", stat: "atkPct", per: 0.006, color: "#4A5FA8", blurb: "Small, shiny and surprisingly strong." }
  ];
  PS.PET = {};
  PS.PET_SPECIES.forEach(function (sp) { PS.PET[sp.id] = sp; });
  // how many pets can come along: you start with one and unlock more with gems
  PS.PET_SLOTS = { start: 1, max: 3, costs: [0, 150, 400] };
  PS.PET_RARITY = [{ mult: 1, cap: 10 }, { mult: 1.5, cap: 20 }, { mult: 2.2, cap: 30 }, { mult: 3.2, cap: 40 }];
  // Common, Uncommon, Rare, Epic
  PS.EGG = { gems: 20, odds: [0.7, 0.18, 0.09, 0.03], bulk: { count: 10, discount: 0.9 } };
  PS.petBonus = function (sp, r, level) {
    return PS.PET[sp].per * level * PS.PET_RARITY[r].mult;
  };
  PS.petCost = function (r, level) {
    return Math.round(150 * Math.pow(1.15, level - 1) * (1 + 0.5 * r));
  };

  PS.GIFT = { every: 4 * 60 * 60 * 1000, gems: 10, goldShare: 0.25 };
  /* Daily rewards: one claim per calendar day. Claiming on the day after the
     last claim moves the streak on; missing a day starts it again at day 1.
     After day 7 it goes round again. `gold` is a share of what a battle at
     your furthest chapter pays; chests are opened for free. */
  PS.DAILY = [
    { gold: 0.5 },
    { gems: 20 },
    { chest: "crate", count: 3 },
    { gold: 1 },
    { gems: 40 },
    { chest: "gilded", count: 1 },
    { gems: 100, chest: "gilded", count: 3 }
  ];
  /* Endless swarm opens once this chapter is cleared. Its pests are as tough
     as the furthest chapter you have cleared. */
  PS.ENDLESS = { from: 40 };
  /* The daily challenge: once `from` is cleared, one chapter a day (`behind`
     chapters short of your furthest) with a twist that changes every day.
     Winning it pays `gems` and a free `chest` once a day, on top of the
     chapter's normal pay. A twist can set: dmg (your damage), hurt (damage
     you take), speed (your speed), xp (experience), pest (pests' size r,
     health hp, speed and xp), shrine (time between shrines), shrineCharge
     (seconds to wake one) and elites (seconds between elites). */
  PS.CHALLENGE = {
    from: 5, behind: 2, gems: 80, chest: "gilded",
    twists: [
      { id: "glass", name: "Glass Cannon", icon: "glass", text: "You hit twice as hard, and so do the pests.", dmg: 2, hurt: 2 },
      { id: "giants", name: "Giants", icon: "area", text: "Pests are bigger and much tougher, and drop twice the experience.", pest: { r: 1.3, hp: 1.6, xp: 2 } },
      { id: "rush", name: "Rush Hour", icon: "speed", text: "Pests are a third faster. You are a little faster too.", pest: { speed: 1.33 }, speed: 1.15 },
      { id: "shrines", name: "Shrine Day", icon: "sun", text: "Shrines rise twice as often and wake in 2 seconds.", shrine: 0.5, shrineCharge: 2 },
      { id: "elites", name: "Elite Hunt", icon: "skull", text: "An elite pest every 30 seconds.", elites: 30 },
      { id: "learner", name: "Fast Learner", icon: "xp", text: "Double experience, but pests hit 40% harder.", xp: 2, hurt: 1.4 }
    ]
  };
  /* The collection book: every different item you have ever owned counts
     once, even after it is forged away or sold. Each step pays its gems once;
     the last step is every item in the game. */
  PS.BOOK = [10, 25, 50, 100, 150, 200, 300, 400, 500, PS.ITEM_ORDER.length].map(function (at, i) {
    return { at: at, gems: [20, 30, 50, 80, 100, 120, 150, 200, 300, 1000][i] };
  });
  /* From this chapter on, two bosses arrive together: the chapter's own and
     the one from the chapter before. Each has `hp` of a lone boss's health. */
  PS.TWIN_BOSS = { from: 40, hp: 0.65 };
  /** The bosses a chapter ends with: its own, then (from TWIN_BOSS.from) the one before. */
  PS.chapterBosses = function (n) {
    var ch = PS.chapter(n);
    var list = [ch];
    if (ch.n >= PS.TWIN_BOSS.from && ch.n > 1) list.push(PS.chapter(ch.n - 1));
    return list;
  };
  PS.GOLD_PACK = { gems: 50, runs: 2 };
  PS.DEAL_COUNT = 4;
  PS.START = { gems: 100, gold: 0, kit: ["sling", "cap", "bark"] };

  /* --------------------------------------------------------------- quests */
  /* Each line is a ladder: finish a rung, claim its gems, see the next one. */

  PS.QUESTS = [
    { id: "chapters", name: "Pest Control", stat: "best", text: "Clear chapter {n}",
      tiers: [1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200, 225, 250],
      gems: [40, 40, 50, 60, 70, 80, 100, 120, 140, 160, 200, 400, 250, 300, 350, 400, 500, 800, 500, 600, 700, 800, 1500, 1000, 1200, 1400, 1600, 1800, 3000] },
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
      tiers: [1000, 2500, 6000, 15000, 40000, 100000, 250000, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11],
      gems: [30, 50, 70, 100, 150, 200, 300, 400, 500, 600, 800, 1000, 1500] },
    { id: "rarity", name: "Collector", stat: "maxRarity", text: "Own {n} item",
      tiers: [2, 3, 4, 5, 6, 7, 8, 9, 10], labels: ["a Rare", "an Epic", "a Legendary", "a Mythic", "a Surpass", "a ???", "a Celestial", "a Cosmic", "an Infinity"],
      gems: [30, 60, 100, 150, 250, 500, 800, 1200, 2000] },
    { id: "grade", name: "Top Shelf", stat: "grade", text: "Own {n} item",
      tiers: [1, 2], labels: ["an S-grade", "an SS-grade"], gems: [100, 300] },
    { id: "runlevel", name: "Snowball", stat: "bestLevel", text: "Reach level {n} in one battle",
      tiers: [10, 15, 20, 25, 30], gems: [30, 50, 80, 120, 200] }
  ];
})();
