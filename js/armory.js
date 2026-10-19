/*!
 * Pip Survivors — the armory
 * Most of the game's weapons are made here from two parts: an attack style
 * (how it fights: bolts, a shotgun spray, a ring of shots, homing seekers, a
 * slash, a stab, a ground slam, lobbed shells, chain lightning, a boomerang,
 * a burning brew, a beam) and an element (what its hits do: burn, chill,
 * shock, poison, reach further, find weak spots, or nothing extra). Every
 * pairing is its own weapon with its own name, colours, grade and perks:
 * 12 styles x 7 elements = 84 weapons, on top of the 23 made by hand.
 * The other five slots are filled the same way further down (96 each).
 *
 * This file is only the description. data.js turns each one into an item,
 * weapons.js into an attack, icons.js into a picture, audio.js into a sound.
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function () {
  "use strict";

  var PS = window.PS;

  /* The attack styles. `emp` is how often the Epic perk's empowered attack
     comes round; perk2 and perk4 are the plain stats at Rare and Legendary. */
  PS.ARCH = {
    bolt: {
      noun: "Repeater", sound: "pew", emp: 4,
      blurb: "Fires quick bolts at the nearest pest.",
      empText: "Every 4th shot is a giant bolt: triple damage, and nothing stops it",
      countName: "Multishot", countText: "+1 bolt with every shot",
      perk2: { haste: 0.12 }, perk4: { crit: 0.08 }
    },
    spread: {
      noun: "Blunderbuss", sound: "heavy", emp: 4,
      blurb: "Blasts a spray of pellets. Deadly up close.",
      empText: "Every 4th blast fires all the way round you",
      countName: "Extra pellets", countText: "+2 pellets with every blast",
      perk2: { area: 0.2 }, perk4: { critDmg: 0.35 }
    },
    burst: {
      noun: "Bell", sound: "magic", emp: 3,
      blurb: "Rings out a circle of shots in every direction.",
      empText: "Every 3rd ring is followed by a second one",
      countName: "Fuller ring", countText: "+3 shots in every ring",
      perk2: { area: 0.2 }, perk4: { haste: 0.12 }
    },
    homing: {
      noun: "Seeker", sound: "magic", emp: 4,
      blurb: "Sends out shots that hunt pests down by themselves.",
      empText: "Every 4th volley sends six more",
      countName: "Bigger volley", countText: "+2 shots with every volley",
      perk2: { haste: 0.12 }, perk4: { crit: 0.08 }
    },
    slash: {
      noun: "Sabre", sound: "swish", emp: 3,
      blurb: "A wide slash in front of you. Get close.",
      empText: "Every 3rd slash spins all the way round you",
      countName: "Double slash", countText: "Slash in one more direction",
      perk2: { area: 0.2 }, perk4: { hpPct: 0.15 }
    },
    thrust: {
      noun: "Pike", sound: "swish", emp: 3,
      blurb: "A long stab that runs through a whole row of pests.",
      empText: "Every 3rd stab fans out three ways",
      countName: "Extra stab", countText: "Stab in one more direction",
      perk2: { area: 0.2 }, perk4: { bossDmg: 0.25 }
    },
    slam: {
      noun: "Maul", sound: "heavy", emp: 3,
      blurb: "Slams the ground and flattens everything near you.",
      empText: "Every 3rd slam hits 50% harder and stuns",
      countName: "Aftershock", countText: "Every slam hits one more time",
      perk2: { area: 0.2 }, perk4: { hpPct: 0.2 }
    },
    lob: {
      noun: "Mortar", sound: "flick", emp: 3,
      blurb: "Lobs shells into the thickest crowd. They burst where they land.",
      empText: "Every 3rd lob throws two more shells",
      countName: "Extra shell", countText: "+1 shell with every lob",
      perk2: { area: 0.25 }, perk4: { bossDmg: 0.2 }
    },
    chain: {
      noun: "Rod", sound: "magic", emp: 4,
      blurb: "Lightning that jumps from pest to pest.",
      empText: "Every 4th cast sends out three chains",
      countName: "Longer chain", countText: "Lightning jumps to 2 more pests",
      perk2: { haste: 0.12 }, perk4: { crit: 0.08 }
    },
    boomerang: {
      noun: "Chakram", sound: "flick", emp: 3,
      blurb: "Thrown out and back, hitting on both trips.",
      empText: "Every 3rd throw sends out three",
      countName: "Extra chakram", countText: "+1 chakram with every throw",
      perk2: { area: 0.2 }, perk4: { hpPct: 0.15 }
    },
    zone: {
      noun: "Cauldron", sound: "flick", emp: 3,
      blurb: "Throws a brew that leaves a hurting puddle where it lands.",
      empText: "Every 3rd throw splashes two more",
      countName: "Extra splash", countText: "+1 splash with every throw",
      perk2: { area: 0.25 }, perk4: { hpPct: 0.15 }
    },
    beam: {
      noun: "Wand", sound: "magic", emp: 4,
      blurb: "Fires a beam straight through everything in a line.",
      empText: "Every 4th cast fires a fan of five beams",
      countName: "Extra beam", countText: "+1 beam with every cast",
      perk2: { area: 0.2 }, perk4: { critDmg: 0.35 }
    }
  };

  /* The elements: a name, colours (main, light, dark, glow), what every hit
     does (`innate`), and the ??? perk at the top. */
  PS.ELEMENT = {
    plain: {
      adj: "Orchard", blurb: "",
      colors: { main: "#C79A5B", light: "#F2D49B", dark: "#70492A", glow: "#FFE66D" },
      innate: null,
      top: { text: "Every attack strikes again at half strength", fx: { echo: 0.5 } }
    },
    fire: {
      adj: "Cinder", blurb: "Its hits set pests alight.",
      colors: { main: "#F26B2A", light: "#FFD166", dark: "#7A2E1E", glow: "#FF8A3D" },
      innate: { fx: { burn: 0.3 }, text: "Hits set pests on fire for 30% damage per second" },
      top: { text: "Burning pests explode when they die", fx: { burnBoom: 0.7 } }
    },
    frost: {
      adj: "Frost", blurb: "Its hits slow pests down.",
      colors: { main: "#7FD4F5", light: "#DDF4FF", dark: "#3A9BD9", glow: "#BFE0FF" },
      innate: { fx: { chill: 0.3 }, text: "Hits slow pests by 30%" },
      top: { text: "Hitting a slowed pest freezes it solid", fx: { freeze: 1 } }
    },
    shock: {
      adj: "Volt", blurb: "Pests it hits take more damage for a while.",
      colors: { main: "#5FA8F2", light: "#FFE14A", dark: "#2E4A7A", glow: "#8EC5FF" },
      innate: { fx: { shock: 0.2 }, text: "Pests you hit take 20% more damage for 3 seconds" },
      top: { text: "Pests explode when they die", fx: { boom: 0.6 } }
    },
    venom: {
      adj: "Venom", blurb: "Its poison heals you as pests fall.",
      colors: { main: "#6FBF5A", light: "#C8F2B0", dark: "#2E5A2A", glow: "#9BE08A" },
      innate: { fx: { burn: 0.2, leech: 0.003 }, text: "Poisons pests for 20% damage per second, and heals you a little for every pest squashed" },
      top: { text: "Finishes off pests below 12% health (not bosses)", fx: { execute: 0.12 } }
    },
    shadow: {
      adj: "Shadow", blurb: "Its attacks reach further.",
      colors: { main: "#8E7BFF", light: "#C9BEFF", dark: "#2B2444", glow: "#B48CFF" },
      innate: { s: { area: 0.2 } },
      top: { text: "Every attack strikes again at 60% strength", fx: { echo: 0.6 } }
    },
    radiant: {
      adj: "Radiant", blurb: "It finds the weak spots.",
      colors: { main: "#F2B93B", light: "#FFF4B8", dark: "#C98A1B", glow: "#FFE66D" },
      innate: { s: { crit: 0.05, critDmg: 0.15 } },
      top: { text: "Finishes off pests below 10% health, and +8% damage to bosses and elites", s: { bossDmg: 0.08 }, fx: { execute: 0.1 } }
    }
  };

  /* every style with every element. Plain ones are A grade, shadow ones S,
     radiant ones S or SS, and the rest a mix of A and S. */
  var STYLES = Object.keys(PS.ARCH);
  var ELEMENTS = Object.keys(PS.ELEMENT);
  PS.ARMORY = [];
  PS.ARMORY_BY_ID = {};
  ELEMENTS.forEach(function (el, ei) {
    STYLES.forEach(function (arch, ai) {
      var grade;
      if (el === "plain") grade = "A";
      else if (el === "shadow") grade = "S";
      else if (el === "radiant") grade = ai % 3 === 0 ? "SS" : "S";
      else grade = (ai + ei) % 3 === 0 ? "S" : "A";
      var w = {
        id: arch + "_" + el,
        name: PS.ELEMENT[el].adj + " " + PS.ARCH[arch].noun,
        grade: grade,
        arch: arch,
        el: el,
        colors: PS.ELEMENT[el].colors
      };
      PS.ARMORY.push(w);
      PS.ARMORY_BY_ID[w.id] = w;
    });
  });

  /* ------------------------------------------------- the rest of the gear */
  /* Rings, amulets, helmets, armour and boots are made the same way: a kind
     (what it is: a Band, a Visor, Sandals...) with a theme. The kind gives
     the main stat and the perks from Rare to Mythic; the theme gives the name,
     the colours, what it always does, and the hidden ??? perk.
     12 kinds x 8 themes = 96 more of each, on top of the 5 made by hand. */

  /* The themes are the weapon elements plus Briar. `innate` is always on. */
  PS.GEAR_THEME = {
    plain: {
      blurb: "", innate: { s: { xp: 0.05 } },
      top: { text: "Start every battle with a free upgrade", fx: { startUp: 1 }, pw: 0.2 }
    },
    fire: {
      blurb: "Warm to the touch.",
      innate: { fx: { auraBurn: 0.15 }, text: "Pests near you burn for 15% damage per second" },
      top: { text: "Burning pests explode when they die", fx: { burnBoom: 0.5 } }
    },
    frost: {
      blurb: "Cold enough to slow anything nearby.",
      innate: { fx: { auraChill: 0.1 }, text: "Pests near you are slowed by 10%" },
      top: { text: "+25% damage to slowed pests", fx: { chillAmp: 0.25 } }
    },
    shock: {
      blurb: "It crackles when you touch it.",
      innate: { fx: { shock: 0.08 }, text: "Pests you hit take 8% more damage for 3 seconds" },
      top: { text: "Pests explode when they die", fx: { boom: 0.4 } }
    },
    venom: {
      blurb: "It smells faintly of poison.",
      innate: { fx: { leech: 0.002 }, text: "Heal 0.2% of your health for every pest you squash" },
      top: { text: "Finishes off pests below 6% health (not bosses)", fx: { execute: 0.06 } }
    },
    shadow: {
      blurb: "Hard to see, and easy to move in.",
      innate: { s: { speed: 0.04 } },
      top: { text: "Every attack repeats for 20% damage", fx: { echo: 0.2 } }
    },
    radiant: {
      blurb: "It finds the weak spots.",
      innate: { s: { crit: 0.02, critDmg: 0.06 } },
      top: { text: null, s: { bossDmg: 0.1, crit: 0.02 } }
    },
    briar: {
      adj: "Briar", blurb: "Covered in thorns.",
      colors: { main: "#C2577A", light: "#F2B6C8", dark: "#5A2438", glow: "#FF8FB1" },
      innate: { fx: { thorns: 0.5 }, text: "Pests touching you take 50% damage per second" },
      top: { text: "Getting hurt sets off a burst of thorns around you", fx: { thornBurst: 1 } }
    }
  };
  Object.keys(PS.GEAR_THEME).forEach(function (key) {
    var theme = PS.GEAR_THEME[key];
    var el = PS.ELEMENT[key];
    if (el) {
      theme.adj = el.adj;
      theme.colors = el.colors;
    }
  });

  /* A perk that does something rather than adding stats: [text, fx, worth]. */
  function does(text, fx, pw) {
    return { text: text, fx: fx, pw: pw };
  }

  /* The kinds, slot by slot: [id, noun, main stat, blurb, Rare, Epic, Legendary, Mythic].
     A perk is a block of stats, or a does(...). */
  PS.GEAR_KINDS = {
    ring: [
      ["band", "Band", 3.5, "A plain band that steadies your aim.", { atkPct: 0.06 }, { crit: 0.05 }, { atkPct: 0.08 }, { atkPct: 0.08, crit: 0.05 }],
      ["signet", "Signet", 3.5, "Stamped with a seal. Makes your hands quicker.", { haste: 0.06 }, { atkPct: 0.06 }, { haste: 0.08 }, { haste: 0.08, atkPct: 0.08 }],
      ["loop", "Loop", 3.5, "Two rings in one, and twice the bite.", { critDmg: 0.15 }, { crit: 0.04 }, { critDmg: 0.2 }, { crit: 0.05, critDmg: 0.25 }],
      ["coil", "Coil", 3.5, "Winds round your finger and makes every swing wider.", { area: 0.08 }, { atkPct: 0.06 }, { area: 0.1 }, { area: 0.1, haste: 0.06 }],
      ["knot", "Knot", 3.5, "Tied tight for the big fights.", { bossDmg: 0.1 }, { atkPct: 0.06 }, { bossDmg: 0.15 }, { bossDmg: 0.15, critDmg: 0.2 }],
      ["hoop", "Hoop", 3.5, "Little charms hang off it. Some of them are lucky.", { luck: 0.1 }, { xp: 0.08 }, { atkPct: 0.08 }, { luck: 0.15, atkPct: 0.08 }],
      ["seal", "Seal", 3.5, "A square face that drinks in what you squash.", { atkPct: 0.05 },
        does("Heal 0.2% of your health for every pest you squash", { leech: 0.002 }, 0.05), { hpPct: 0.08 }, { atkPct: 0.1, hpPct: 0.08 }],
      ["twist", "Twist", 3.5, "Two strands that never quite let go.", { crit: 0.04 }, { haste: 0.06 },
        does("Every attack repeats for 15% damage", { echo: 0.15 }, 0.15), { atkPct: 0.1 }],
      ["ringlet", "Ringlet", 3.5, "A light little ring for a lemon on the move.", { speed: 0.04 }, { atkPct: 0.06 },
        does("+12% damage while you are moving", { movingDmg: 0.12 }, 0.12), { atkPct: 0.08, speed: 0.05 }],
      ["spiral", "Spiral", 3.5, "Follow the spiral in and it never ends.", { haste: 0.05 }, { critDmg: 0.2 },
        does("Pests you hit take 10% more damage for 3 seconds", { shock: 0.1 }, 0.1), { haste: 0.08, crit: 0.05 }],
      ["clasp", "Clasp", 3.5, "Two hands holding on. Coins stick to it.", { gold: 0.08 }, { atkPct: 0.06 }, { gold: 0.12 }, { atkPct: 0.1, gold: 0.1 }],
      ["bangle", "Bangle", 3.5, "Heavy, wide and a little bit proud of itself.", { xp: 0.06 }, { atkPct: 0.06 },
        does("Every level-up in battle heals you and adds 1% damage", { levelAtk: 0.01 }, 0.2), { atkPct: 0.1, xp: 0.08 }]
    ],
    amulet: [
      ["pendant", "Pendant", 3, "A drop of something on a fine chain.", { atkPct: 0.05 }, { hpPct: 0.06 }, { atkPct: 0.08 }, { atkPct: 0.08, hpPct: 0.08 }],
      ["charm", "Charm", 3, "A four-leaf something. Luck follows it about.", { gold: 0.08 }, { luck: 0.1 }, { gold: 0.12 }, { gold: 0.15, atkPct: 0.06 }],
      ["locket", "Locket", 3, "Open it and there is a tiny picture of a lemon.", { xp: 0.08 }, { atkPct: 0.06 }, { xp: 0.1 }, { xp: 0.1, hpPct: 0.08 }],
      ["talisman", "Talisman", 3, "Carved with a rune for mending.", { regen: 0.002 }, { hpPct: 0.06 },
        does("Heal 0.3% of your health for every pest you squash", { leech: 0.003 }, 0.06), { atkPct: 0.08, regen: 0.003 }],
      ["medallion", "Medallion", 3, "Won for beating something big. Wants to do it again.", { bossDmg: 0.1 }, { atkPct: 0.06 }, { crit: 0.05 }, { bossDmg: 0.15, atkPct: 0.08 }],
      ["amulet", "Amulet", 3, "An eye that watches the upgrade cards for you.", { luck: 0.08 }, { atkPct: 0.06 },
        does("+1 reroll per battle", { reroll: 1 }, 0.1), { luck: 0.12, atkPct: 0.08 }],
      ["totem", "Totem", 3, "A little carved face that is always ready to start.", { hpPct: 0.06 }, { atkPct: 0.06 }, { armor: 0.04 },
        does("Start every battle with a free upgrade", { startUp: 1 }, 0.2)],
      ["token", "Token", 3, "A coin with a hole in it. Gems roll towards it.", { magnet: 0.15 }, { xp: 0.06 }, { magnet: 0.2 }, { xp: 0.08, atkPct: 0.08 }],
      ["choker", "Choker", 3, "Snug at the throat, with one sharp stone.", { crit: 0.04 }, { critDmg: 0.15 }, { atkPct: 0.08 }, { crit: 0.05, critDmg: 0.2 }],
      ["torc", "Torc", 3, "An open ring of twisted metal. Hurry up, it says.", { haste: 0.05 }, { atkPct: 0.06 }, { haste: 0.06 }, { haste: 0.08, hpPct: 0.08 }],
      ["relic", "Relic", 3, "A splinter of something old that still keeps you safe.", { hpPct: 0.06 }, { armor: 0.03 },
        does("A shield soaks up damage worth 10% of your health, then grows back", { barrier: 0.1 }, 0.1), { atkPct: 0.08, hpPct: 0.08 }],
      ["emblem", "Emblem", 3, "A crest that makes everything you swing a size bigger.", { area: 0.08 }, { atkPct: 0.06 }, { area: 0.1 }, { area: 0.1, atkPct: 0.08 }]
    ],
    helmet: [
      ["cap", "Cap", 40, "A soft cap for learning fast.", { xp: 0.06 }, { hpPct: 0.06 }, { regen: 0.002 }, { xp: 0.08, hpPct: 0.08 }],
      ["helm", "Helm", 46, "Round, heavy and very hard to dent.", { armor: 0.03 }, { hpPct: 0.08 }, { armor: 0.04 }, { armor: 0.05, hpPct: 0.08 }],
      ["hood", "Hood", 42, "Pull it up and slip through the swarm.", { speed: 0.04 }, { hpPct: 0.06 }, { crit: 0.04 }, { speed: 0.05, hpPct: 0.08 }],
      ["crown", "Crown", 44, "Heavy is the head, and hard is the hit.", { atkPct: 0.05 }, { hpPct: 0.06 }, { bossDmg: 0.1 }, { atkPct: 0.08, hpPct: 0.08 }],
      ["circlet", "Circlet", 40, "A thin band with one bright stone at the brow.", { crit: 0.04 }, { hpPct: 0.06 }, { critDmg: 0.15 }, { crit: 0.05, hpPct: 0.08 }],
      ["visor", "Visor", 46, "Shut the slit and dig in.", { armor: 0.03 }, { hpPct: 0.06 },
        does("Below 35% health you take 15% less damage", { lastStand: 0.15 }, 0.08), { armor: 0.05, hpPct: 0.08 }],
      ["bonnet", "Bonnet", 42, "Tied under the chin. Very good for getting better.", { regen: 0.002 }, { hpPct: 0.06 }, { regen: 0.003 }, { regen: 0.003, hpPct: 0.1 }],
      ["mask", "Mask", 44, "A scary face. Pests that get close find out it bites.", { hpPct: 0.05 },
        does("Pests touching you take 40% damage per second", { thorns: 0.4 }, 0.06), { armor: 0.04 }, { hpPct: 0.1, armor: 0.03 }],
      ["bandana", "Bandana", 40, "Knotted at the back, tails flying.", { haste: 0.05 }, { hpPct: 0.06 }, { haste: 0.06 }, { haste: 0.06, hpPct: 0.08 }],
      ["beret", "Beret", 40, "Worn at an angle by lemons who feel lucky.", { luck: 0.1 }, { hpPct: 0.06 }, { xp: 0.08 }, { luck: 0.1, hpPct: 0.08 }],
      ["tricorne", "Tricorne", 42, "Three corners, all of them pointing at treasure.", { gold: 0.08 }, { hpPct: 0.06 }, { gold: 0.1 }, { gold: 0.12, hpPct: 0.08 }],
      ["halo", "Halo", 44, "A ring of light that keeps watch over you.", { hpPct: 0.06 }, { regen: 0.002 },
        does("A shield soaks up damage worth 10% of your health, then grows back", { barrier: 0.1 }, 0.1), { hpPct: 0.12 }]
    ],
    armor: [
      ["vest", "Vest", 60, "Light, simple and better than nothing.", { armor: 0.03 }, { hpPct: 0.08 }, { regen: 0.002 }, { armor: 0.05, hpPct: 0.08 }],
      ["plate", "Plate", 72, "One big piece of something very hard.", { armor: 0.04 }, { hpPct: 0.08 }, { armor: 0.05 }, { armor: 0.06, hpPct: 0.1 }],
      ["mail", "Mail", 68, "Thousands of little rings, all holding hands.", { hpPct: 0.06 }, { armor: 0.04 }, { hpPct: 0.1 }, { hpPct: 0.1, armor: 0.04 }],
      ["coat", "Coat", 64, "Long, warm, and good for getting over things.", { regen: 0.002 }, { hpPct: 0.08 }, { regen: 0.003 }, { regen: 0.004, hpPct: 0.08 }],
      ["cloak", "Cloak", 60, "It flaps behind you as you run.", { speed: 0.04 }, { hpPct: 0.06 }, { speed: 0.05 }, { speed: 0.05, hpPct: 0.1 }],
      ["tunic", "Tunic", 62, "Plain cloth, but you learn a lot in it.", { xp: 0.06 }, { hpPct: 0.08 }, { xp: 0.08 }, { xp: 0.08, hpPct: 0.1 }],
      ["jerkin", "Jerkin", 64, "Laced leather with room to swing.", { atkPct: 0.04 }, { hpPct: 0.08 }, { armor: 0.04 }, { atkPct: 0.06, hpPct: 0.1 }],
      ["cuirass", "Cuirass", 70, "Shaped to the lemon, riveted at the sides.", { armor: 0.04 }, { hpPct: 0.08 },
        does("Below 35% health you take 20% less damage", { lastStand: 0.2 }, 0.1), { armor: 0.06, hpPct: 0.1 }],
      ["robe", "Robe", 62, "Its threads remember how to keep you whole.", { hpPct: 0.06 }, { regen: 0.002 },
        does("A shield soaks up damage worth 12% of your health, then grows back", { barrier: 0.12 }, 0.12), { hpPct: 0.12 }],
      ["poncho", "Poncho", 60, "Wide enough to catch every coin and gem.", { magnet: 0.15 }, { hpPct: 0.08 }, { gold: 0.1 }, { hpPct: 0.1, magnet: 0.2 }],
      ["apron", "Apron", 66, "Stuck all over with pins. Pests learn quickly.", { hpPct: 0.06 },
        does("Pests touching you take 50% damage per second", { thorns: 0.5 }, 0.06), { armor: 0.04 }, { hpPct: 0.12, armor: 0.03 }],
      ["mantle", "Mantle", 66, "Broad shoulders for a small lemon.", { hpPct: 0.06 }, { armor: 0.03 }, { hpPct: 0.08 }, { hpPct: 0.1, regen: 0.003 }]
    ],
    boots: [
      ["boots", "Boots", 30, "Good, honest boots.", { speed: 0.04 }, { hpPct: 0.06 }, { speed: 0.05 }, { speed: 0.05, hpPct: 0.08 }],
      ["greaves", "Greaves", 32, "Plated shins for walking through the swarm.", { armor: 0.03 }, { speed: 0.04 }, { hpPct: 0.08 }, { armor: 0.04, speed: 0.05 }],
      ["sandals", "Sandals", 28, "Hardly there at all, and very quick.", { speed: 0.04 }, { haste: 0.05 }, { speed: 0.04 }, { haste: 0.06, speed: 0.05 }],
      ["clogs", "Clogs", 30, "Chunky soles that scoop up everything you walk past.", { magnet: 0.15 }, { hpPct: 0.06 }, { magnet: 0.2 }, { speed: 0.05, magnet: 0.2 }],
      ["slippers", "Slippers", 28, "Comfy. You pay attention better in comfy shoes.", { xp: 0.06 }, { speed: 0.04 }, { xp: 0.08 }, { xp: 0.08, speed: 0.05 }],
      ["striders", "Striders", 30, "Long steps for a lemon that never stops.", { speed: 0.05 }, { haste: 0.04 },
        does("+12% damage while you are moving", { movingDmg: 0.12 }, 0.12), { speed: 0.06, haste: 0.05 }],
      ["treads", "Treads", 30, "Deep grooves that leave a sting in your footprints.", { speed: 0.04 }, { hpPct: 0.06 },
        does("You leave a trail of burning zest behind you", { trail: 1 }, 0.2), { speed: 0.05, hpPct: 0.08 }],
      ["wraps", "Wraps", 28, "Bandaged feet that heal as they walk.", { regen: 0.002 }, { speed: 0.04 }, { regen: 0.002 }, { regen: 0.003, speed: 0.05 }],
      ["sabatons", "Sabatons", 32, "Armoured toes, one plate at a time.", { armor: 0.03 }, { hpPct: 0.06 }, { armor: 0.04 }, { armor: 0.05, speed: 0.04 }],
      ["moccasins", "Moccasins", 28, "Soft and quiet. Coins never hear you coming.", { luck: 0.08 }, { speed: 0.04 }, { gold: 0.08 }, { luck: 0.1, speed: 0.05 }],
      ["stompers", "Stompers", 32, "Every step shakes the floor and slows the swarm.", { hpPct: 0.05 }, { speed: 0.04 },
        does("Pests near you are slowed by 10%", { auraChill: 0.1 }, 0.06), { hpPct: 0.08, speed: 0.05 }],
      ["waders", "Waders", 30, "Tall boots for wading in where it hurts.", { speed: 0.04 }, { crit: 0.03 }, { critDmg: 0.12 }, { speed: 0.05, crit: 0.04 }]
    ]
  };

  /* every kind with every theme. Orchard is A grade, Shadow and Radiant S, and
     the rest a mix of A and S. None of them is SS: in these slots SS belongs
     to the hand-made pieces, which stay the best there is. */
  PS.GEAR = [];
  PS.GEAR_BY_ID = {};
  var THEMES = Object.keys(PS.GEAR_THEME);
  Object.keys(PS.GEAR_KINDS).forEach(function (slot) {
    THEMES.forEach(function (theme, ti) {
      PS.GEAR_KINDS[slot].forEach(function (k, ki) {
        var grade;
        if (theme === "plain") grade = "A";
        else if (theme === "shadow" || theme === "radiant") grade = "S";
        else grade = (ki + ti) % 3 === 0 ? "S" : "A";
        var g = {
          id: k[0] + "_" + theme,
          slot: slot,
          kind: k[0],
          theme: theme,
          name: PS.GEAR_THEME[theme].adj + " " + k[1],
          grade: grade,
          base: k[2],
          blurb: k[3],
          perks: k.slice(4, 8),
          colors: PS.GEAR_THEME[theme].colors
        };
        PS.GEAR.push(g);
        PS.GEAR_BY_ID[g.id] = g;
      });
    });
  });
})();
