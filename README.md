# 🍋 Pip Survivors

**A Lemon game.** You steer a lemon through swarms of garden pests. It attacks
by itself; you dodge, grab gems, and pick an upgrade every level. Between
battles you collect gear, forge it into rarer gear, open chests, learn talents
and watch your Power climb through 250 chapters in thirty zones.

Plain HTML, CSS and JavaScript. No build step, no framework, no dependencies,
no accounts, no tracking. It works offline once the folder is on your computer.

---

## Running it

**The quick way.** Double-click `index.html`. Everything works from `file://`,
including saving and accounts. Logging in needs an internet connection; without
one, the log-in screen offers **Play offline**.

**With a local web server** (handy for testing on a phone):

```bash
# Python 3
python -m http.server 8000

# or Node
npx serve .
```

Then open <http://localhost:8000>.

**Publishing it.** The folder is a static site, so it can go straight onto
GitHub Pages, Netlify or any web host. Nothing needs compiling.

**Updates reach open games by themselves.** Once a minute (and whenever the tab
comes back into view) a game served from a website checks whether any of its
files changed. If they have, it reloads itself as soon as that is safe: never
in the middle of a battle, and not while a pop-up is open. Anyone still running
a copy from before this check existed has to reload once by hand.

---

## How to play

The same guide is in the game: **Settings → How to play**, or the **New here? How to play** button under the Battle button. It folds out by topic (the basics, staying alive, crates and power-ups, the golden pest, combos, every boss with a tip, gear and the Forge, the Shop, pets, talents and quests, the daily challenge, and the endless swarm), and takes its numbers from the game, so it stays right when they change.

### In battle

- **Move** with WASD or the arrow keys, or hold the mouse button and the lemon
  heads for the pointer. On a touch screen, drag anywhere: a thumb-stick
  appears under your finger.
- **Attacking is automatic.** What the attack looks like depends on the weapon
  you have equipped.
- Squashed pests drop **gems**. Gems fill the bar across the top; every level
  you pick **one of three upgrades** (click a card, or press 1, 2 or 3). `R`
  rerolls the cards, once per battle unless your gear gives you more.
- Survive until the timer runs out and the **boss** arrives. Beat the boss to
  clear the chapter and open the next one. Each boss fights like the creature
  it is named after, and there are nine: the hornet (charges), the queen
  (rings of shots and grunts), the slug (lobbed slime and puddles), the mould
  (spirals of spores), the beetle (leaps and slams), the spider (beams and
  webs), the worm (burrows and bursts up under you), the moth (dust clouds and
  wing gusts) and the fly (vanishes and reappears with a burst). Which chapter
  has which is the `BOSS_KIND_OF` list in `js/data.js`. From chapter 40 on, **two bosses**
  arrive together (the chapter's own and the one before it, each with 65% of a
  lone boss's health), and both must fall. `PS.TWIN_BOSS` in `js/data.js` sets
  the chapter and the health share.
- `Esc` or `P` pauses. Losing still pays some gold, and gear too if you got
  halfway.
- The **damage meter** in the top-left ranks what is doing the damage (your
  weapon, each upgrade's ability, burning, death blasts, thorns) with each
  one's share of the total. The chart button, or `Tab`, shows or hides it.
- Squash pests quickly, one after another, to build a **combo**. It shows on
  the right once it reaches ten, and your best combo is on the results screen.
- When your health drops below 30% the edges of the screen glow red.
- **Crates, jars and flower pots** turn up on the field. Your attacks break
  them as they pass, or just walk into one. Inside: a heal, a shower of coins,
  a magnet, a **bomb** (squashes every pest on screen, never hurts a boss) or a
  **power-up**: Frenzy (double attack speed), Giant (attacks half as big
  again), Swift (much faster feet) or Star (nothing can hurt you). Power-ups
  last 5 to 8 seconds and show a countdown on the right.
- Twice a chapter (every 75 seconds in endless) a **golden pest** appears and
  runs. Your weapon goes for it first; catch it within 15 seconds for a pile of
  coins and experience, or it gets away. All of this is in `js/events.js`.
- **Dash** with Space or Shift (or the round button at the bottom right on a
  phone): a quick slide the way you are heading, safe from everything for a
  moment, back after about 3 seconds. The **Quick Feet** card makes it come
  back sooner. `B.DASH` in `js/battle.js` holds the numbers.
- Every minute or so a **shrine** rises nearby (a green arrow points to it).
  Stand in its circle for 3 seconds to wake it, then choose one of three
  **blessings** for the rest of the battle: Fury, Haste, the Grove, Stone,
  Wings, Stars or Plenty. Left alone for 30 seconds it sinks away again
  (`SHRINE` in `js/events.js`, the blessings in `js/upgrades.js`).
- **Elite pests** (the big ones with a gold ring) come twice a chapter. From
  chapter 3 on each has a **trait**, named over its head: **Swift** (much
  faster, less health), **Healer** (mends the pests around it every second),
  **Summoner** (calls in three pests every few seconds) or **Splitting**
  (breaks into two smaller copies when squashed). `TRAITS` in
  `js/enemies.js` holds the numbers.
- Max out an ability and its **awakening** turns up at your next level-up: a
  gold card that makes it work as if it were three levels past its max, under
  a new name (Orbit Peel becomes Peel Tempest, Frost Nova becomes Deep
  Freeze...).
- **Music** plays throughout: a calm tune at camp, a quick one in battle and a
  heavier one when the boss arrives. It is made in the browser like the sound
  effects (no audio files), starts with your first click, and can be switched
  off or turned down in Settings.

### Between battles

The menus sit in front of a little orchard (`js/scenery.js`): drifting
clouds, hills, swaying lemon trees and falling petals by day, the moon, stars
and fireflies at night. It stays still when Animations is set to Off.

| Tab | What it is for |
| --- | --- |
| **Battle** | Pick a chapter and fight. Shows your Power against the chapter's recommended Power. Once chapter 5 is cleared, the **daily challenge** opens below it: a chapter two short of your furthest with a twist that changes at midnight (Glass Cannon, Giants, Rush Hour, Shrine Day, Elite Hunt or Fast Learner). Winning it pays 80 gems and a free Gilded Chest once a day, on top of the chapter's normal pay. Once chapter 40 is cleared, **Endless swarm** opens too: no boss and no end, pests as tough as your furthest chapter, gold for every second you last, and your best time kept. |
| **Equipment** | Six slots: weapon, ring, amulet, helmet, armour, boots. Level slots up with gold, swap gear, and open the **Forge**. The **Collection** button shows every item in the game, slot by slot: the ones you have ever owned in colour, the rest as shadows. Finding 10, 25, 50, 100, 150, 200, 300, 400, 500 and all 612 pays gems (20 up to 1,000). |
| **Shop** | **Daily rewards** (a seven-day streak: gold, gems and free chests, with 100 gems and three Gilded Chests on day 7; miss a day and it starts again), a free gift every four hours, chests bought with gems (a fixed price: 10 for a Seed Crate, 40 for a Gilded Chest), four deals a day (never S-grade), and gold for gems. |
| **Pets** | Hatch pets from eggs bought with gems in the Shop (Common 70%, Uncommon 18%, Rare 9%, Epic 3%; never S or SS). You start with one team slot and can unlock a second (150 gems) and a third (400 gems); every pet in your team fights beside you and gives its stat bonus. Hatching a duplicate, or spending gold, levels it up. |
| **Talents** | Permanent bonuses bought with gold. Max every talent in a tier and you can **ascend**: tiers II to VI (Ascended, Transcended, Exalted, Divine and Eternal) repeat the talents at a bigger bonus and a much bigger price, and add Lucky Star, Wide Swing and Giant Slayer. Tiers IV to VI are priced for the gold chapters past 100 pay, and have no Head Start (it stops at tier III, seven free cards). |
| **Quests** | Ladders of goals that pay gems. |

**Power** is one number for how strong the lemon is: attack, health and
everything that multiplies them.

### Gear

Every item has a **rarity**. Rarer means a bigger main stat, a higher level
cap for its slot, and more of the item's perks switched on.

| Rarity | Main stat | Level cap | Perk unlocked |
| --- | --- | --- | --- |
| Common | ×1 | 10 | |
| Uncommon | ×1.4 | 20 | |
| Rare | ×2 | 30 | 1st |
| Epic | ×2.8 | 40 | 2nd |
| Legendary | ×4 | 50 | 3rd |
| Mythic | ×5.6 | 60 | 4th |
| Surpass | ×8 | 70 | |
| ??? | ×12 | 80 | a hidden 5th |
| Celestial | ×17 | 90 | |
| Cosmic | ×24 | 100 | |
| Infinity | ×34 | 110 | |

Chapter loot up to chapter 100, the free gift and the daily deals go up to
Legendary at most. Past chapter 100, loot goes up to Mythic, then Surpass from
chapter 151 and ??? from chapter 201. **Celestial, Cosmic and Infinity** (past
???) never drop: they only come out of the forge, and they are how a lemon gets
past the old ceiling of about 314M Power: a bigger main stat, and slot levels
up to 110 (levels past 80 cost 35% more each).

Some items are **S-grade** or **SS-grade**. The grade belongs to the item
itself (an S-grade bow is S-grade at every rarity): ×1.2 or ×1.45 on the main
stat, and stronger perks. They are rare: a Seed Crate has a 0.5% chance of an
S-grade. **Chests never hold an SS-grade item.** Chest odds are fixed for the
whole game: a Seed Crate is 79% Common, 15% Uncommon, 6% Rare; a Gilded Chest
is 62.35% Common, 25% Uncommon, 9% Rare, 3% Epic, and 0.65% of the time an
S-grade Uncommon. Neither chest gives Legendary or Mythic. A Gilded Chest also
has a 0.4% chance of an **SS shard**, and
6 shards craft one Uncommon SS-grade item in the Shop. Beating a chapter never
gives an SS-grade item by chance, but the boss of every fourth chapter drops an
S or SS item the first time you beat it.

**Levels belong to the slot, not the item**, so nothing is lost when you swap
gear. Each level is +3.5% of the item's main stat.

**The Forge** takes three items of the same slot and the same rarity. The one
you pick first is kept and rises one rarity; the other two are used up. To
forge an **S or SS-grade** item, the two used up must be of that same grade
(two S for an S, two SS for an SS); plain gear can still use any.

On 2026-10-26 everyone's gear past ??? (Celestial, Cosmic, Infinity) was set
back to ??? once: each save gets it the next time it loads, and the player is
told how many pieces changed. Slot levels were kept. It is `LOWER_ID` in
`js/state.js`; change it to do it again.

**Enchantments.** The Shop's **Enchantment Chest** (60 gems, or 10 for 540)
holds one **Enchantment Key**, and the key does not say what is in it. Press
**Enchant** on the Equipment screen to go to the **Enchanting Room**, a dark
room with its own music: pick any piece of gear (worn or in the bag), press
**Use a key**, and the key turns and shows its enchantment, which goes on that
gear. Each kind of gear has its own list, all of one rarity and all as likely
as each other on that gear:

| Gear | Enchantments |
| --- | --- |
| Weapon (14) | Sharpness (+12% attack), Vigour (+12% health), Keen Eye (+5% crit chance), Brutality (+30% crit damage), Quickness (+10% attack speed), Featherfoot (+8% move speed), Warding (+4% damage reduction), Mending (+0.3% health a second), Attraction (+25% pickup range), Greed (+15% gold), Insight (+15% XP), Fortune's Kiss (+10% luck), Expanse (+12% attack size), Giantbane (+20% boss damage) |
| Ring (15) | Focus, Cruelty, Swift Hands, Lucky Charm, Midas Touch, Scholar's Loop, Might, Twin Edge, Long Reach, Kingsbane, Life Drain (heal per pest squashed), Fortune and Glory, Lodestone, Tempo, Starlit: crit, attack speed, luck, gold and XP |
| Amulet (14) | Lifebloom, Renewal, Aegis (a shield of 6% of your health), Wisdom, Clover, Arcane Power, Spark, Talisman, Coin Charm, Magnetism, Clarity, Vampire's Kiss (heal per pest squashed), Titan's Pendant, Soulbound |
| Helmet (14) | Ironclad, Hardy, Clear Mind, Hawk Sight, Soothing, Halo (a 6% shield), Crowned, Stout, Four-Leaf, Battle Focus, Bold, Calm, Sage, Watchful: health, damage reduction, XP and sight, no crit |
| Armour (14) | Fortress, Bulwark, Regrowth, Shell (an 8% shield), Thorns (hit back when hit), Second Wind (one more get-up), Bloodplate (heal per pest squashed), Heavy Plate, Toughened, Gilded, Spiked, Warmth, Battle-Worn, Padded: toughness, no crit |
| Boots (15) | Swiftness, Windwalk, Gatherer, Lucky Steps, Pathfinder, Treasure Hunter, Evasion, Springheel, Stomp, Runner's High, Fleet, Hunter, Trailblazer, Steady, Pounce: speed, pickups, luck and XP |

The room shows the list for the gear picked. A piece of gear holds one
enchantment, and **stacking** buys it room for more, up to 4: under the gear
on the table are its four spaces, and the next locked one can be unlocked with
gems (500 for the 2nd, 1,500 for the 3rd, 4,000 for the 4th; that room is for
that piece only). A key fills an empty space first; on full gear it replaces
the one you pick (the last, unless you click another). The same enchantment
twice adds up. Enchantments count while the gear is worn, stay on it with its
bought room when it is forged up (gear melted down in a forge loses its own,
and Quick forge's "keep safe" never melts an enchanted piece or one with
bought room), and go with it in a trade (that needs the newer
`supabase/setup.sql`; an older server drops them). Saves from before stacking
keep their one enchantment. The lists are `PS.ENCHANT_POOLS` and the prices
`PS.ENCHANT_STACK` in `js/data.js`. Admins can add keys in the admin menu,
Money tab.

**Selling.** Open an item you are not wearing and press **Sell** (it asks once
more). Only valuable gear sells, and the two prices add up:

| Rarity | Gold | | Grade | Gold |
| --- | --- | --- | --- | --- |
| Mythic | 20,000 | | S | 10,000 |
| Surpass | 60,000 | | SS | 100,000 |
| ??? | 200,000 | | | |
| Celestial | 600,000 | | | |
| Cosmic | 2,000,000 | | | |
| Infinity | 6,000,000 | | | |

So a ??? SS-grade item sells for 300,000. Anything below Mythic that is also plain
grade is worth nothing to the buyer.

**Quick forge** does every forge that is possible in one press, including forges
that only become possible after an earlier one (27 Common items become one Epic).
The item you are wearing is the one that rises. A preview shows what you will end
up with first, and Epic and above, and S / SS-grade, items are kept safe unless
you untick the box.

### Weapons

| Weapon | Grade | How it attacks |
| --- | --- | --- |
| Seed Sling | | Flicks a pip at the nearest pest |
| Rind Blade | | A wide slash in front of you |
| Thorn Bow | | Long-range arrows that pass through a pest |
| Sprout Staff | | Slow orbs that burst |
| Stem Spear | | A long stab through a whole row |
| Twin Zesters | | Two fast knives at a time, short reach |
| Nutcracker | | Slams the ground around you |
| Peel-a-rang | | Flies out and comes back |
| Stormcaller | S | Lightning that jumps between pests |
| Frostbite | S | Icy arrows that slow |
| Ember Lance | S | A burning stab |
| Shadow Fangs | S | Three knives at a time |
| Solstice | SS | A huge swing that throws a wave of fire |
| Eclipse | SS | Opens a black hole |

Melee swings (blade, spear, hammer, Solstice) also knock enemy shots out of
the air.

**The armory** (`js/armory.js`) adds 84 more weapons, for 107 in all, and 96
more of every other slot (101 rings, 101 amulets, 101 helmets, 101 armour,
101 boots). Each
one pairs an attack style with an element, and its name says which: a
*Frost Mortar* lobs shells that slow, a *Cinder Sabre* slashes and sets pests
alight.

| Style | How it attacks | | Element | What its hits do |
| --- | --- | --- | --- | --- |
| Repeater | Quick bolts | | Orchard | Nothing extra; A grade |
| Blunderbuss | A spray of pellets | | Cinder | Burn |
| Bell | A ring of shots all round | | Frost | Slow |
| Seeker | Homing shots | | Volt | Pests take more damage for a while |
| Sabre | A wide slash | | Venom | Poison, and heal as pests fall |
| Pike | A long stab | | Shadow | Bigger attacks; always S grade |
| Maul | A ground slam | | Radiant | Crits; S or SS grade |
| Mortar | Shells into the crowd | | | |
| Chakram | Out and back | | | |
| Cauldron | A hurting puddle | | | |
| Rod | Chain lightning | | | |
| Wand | A beam through a line | | | |

Their perks follow the style (Rare and Legendary are stats, Epic is the
empowered attack, Mythic adds one more of whatever the weapon fires) and
the element (the hidden ??? perk).

The other gear is made the same way from a kind and a theme. There are twelve
kinds per slot: rings (Band, Signet, Loop, Coil, Knot, Hoop, Seal, Twist,
Ringlet, Spiral, Clasp, Bangle), amulets (Pendant, Charm, Locket, Talisman,
Medallion, Amulet, Totem, Token, Choker, Torc, Relic, Emblem), helmets (Cap,
Helm, Hood, Crown, Circlet, Visor, Bonnet, Mask, Bandana, Beret, Tricorne,
Halo), armour (Vest, Plate, Mail, Coat, Cloak, Tunic, Jerkin, Cuirass, Robe,
Poncho, Apron, Mantle) and boots (Boots, Greaves, Sandals, Clogs, Slippers,
Striders, Treads, Wraps, Sabatons, Moccasins, Stompers, Waders). The kind sets
the main stat and the perks from Rare to Mythic. The theme (the seven elements
plus **Briar**) sets what the piece always does and its ??? perk:

| Theme | Always | ??? perk |
| --- | --- | --- |
| Orchard | +5% XP | A free upgrade at the start of every battle |
| Cinder | Pests near you burn | Burning pests explode |
| Frost | Pests near you are slowed | +25% damage to slowed pests |
| Volt | Pests you hit take more damage | Pests explode when they die |
| Venom | Heal for every pest squashed | Finishes off pests below 6% |
| Shadow | +4% move speed | Every attack repeats for 20% |
| Radiant | Crit chance and crit damage | Boss damage and crit chance |
| Briar | Thorns | A burst of thorns when you get hurt |

The new rings, amulets, helmets, armour and boots go up to S grade, and S
pieces get 50% bigger numbers on their stat perks. None of them is SS: in
those slots SS stays with the five hand-made pieces, which are still the best
there are, so the most Power the game allows is the same 272M as before. A
chest's list folds out by slot, since it now holds hundreds of items.

### Abilities

Level-up cards include abilities that fight beside your weapon. Besides the
older ones, there are eight newer ones: **Frost Nova** (a chilling ring every few
seconds), **Seed Mines** (dropped as you go, burst when a pest steps near),
**Sunbeam** (a beam turning round you), **Lemon Rain** (lemons dropped on
pests), **Bee Buddies** (bees that circle and sting), **Vine Lash** (whips
the nearest pests), **Bubble Shield** (blocks one hit, then bursts) and
**Static Field** (zaps pests that come close and softens them up).

---

## What's in the folder

```text
lemon/
├── index.html        the page: top bar, tabs, and the battle layer
├── style.css         theme colours, layout, every screen
├── js/
│   ├── core.js       the PS namespace, safe storage, events, number formatting
│   ├── armory.js     the 84 weapons made from an attack style and an element,
│   │                 and the 480 other pieces made from a kind and a theme
│   ├── data.js       ALL the numbers: rarities, gear and perks, talents,
│   │                 chapters, quests, chest odds, prices, balance curves
│   ├── icons.js      every icon and item picture, drawn in code as SVG
│   ├── audio.js      every sound effect, made with the Web Audio API
│   ├── state.js      the save file and the rules: equip, level up, forge,
│   │                 chests, deals, quests, battle rewards, Power
│   ├── cloud.js      accounts (Supabase) and the leaderboard
│   ├── battle.js     the battle engine: movement, damage, pickups, drawing
│   ├── weapons.js    how each weapon attacks and looks
│   ├── enemies.js    pests, bosses, and who turns up when
│   ├── upgrades.js   the level-up cards and the abilities they add
│   ├── hud.js        health bar, timer, level-up cards, pause screen
│   ├── dev.js        the DEV / admin panel inside a battle (cheats, upgrades, spawning, stats)
│   ├── net.js        rooms on the server and the direct link between two games
│   ├── multi.js      the "Play with a friend" window, and starting a battle for two
│   ├── trade.js      the Trade window (the server holds both offers)
│   ├── invite.js     invites to a trade or a room, and the pop-up to join
│   └── ui.js         the menus: Battle, Equipment, Forge, Shop, Talents, Quests
├── supabase/setup.sql   the leaderboard table and its rules, run once in Supabase
├── assets/icons/lemon.svg
├── games/survivor/index.html   the old address; it forwards to index.html
├── CREDITS.md        fonts and third-party notes
├── LICENSE           MIT
└── README.md
```

---

## Changing the game

Most tweaks are one line in `js/data.js`.

- **A new piece of gear:** add a `def(...)` block with its slot, grade, name,
  base stat, description and five perks, then draw it in the `ART` table in
  `js/icons.js` under the same id. A perk is plain stats (`{ crit: 0.05 }`),
  or a switch the battle reads (`{ burn: 0.4 }`), or both. The switches that
  already work are listed by use in `battle.js`, `weapons.js` and
  `upgrades.js` (search for `fx.`).
- **A new weapon** also needs an entry in `js/weapons.js` saying how it
  attacks. Copy the closest existing one. Or add an element (or a style) to
  `js/armory.js`: a new element makes 12 weapons at once, each with a name,
  perks, a picture and a sound, and a new style needs its attack in the `STYLE`
  table in `js/weapons.js` and its picture in `STYLE_ART` in `js/icons.js`.
- **Prices, odds and rewards:** `PS.CHESTS`, `PS.GIFT`, `PS.DROP_GRADE`,
  `PS.TALENTS`, `PS.QUESTS` and `PS.BAL`.
- **Difficulty:** `HP_SCALE` and `DMG_SCALE` say how much tougher and harder
  hitting pests are in each chapter, `BOSS_SCALE` does the same for the boss's
  health, and `REC_POWER` is the number shown as "recommended". They were
  fitted by simulating thousands of battles against the gear a player
  naturally has by each chapter, so if you make gear or gold much more
  generous, raise them to match. Chapters 1 to 20 come straight from the fit
  and 21 to 50 climb by `LATE` per chapter, both as they always were (chapter
  50 recommends 12.8M). Chapters 51 to 100 keep climbing until chapter 100
  recommends `MAX_POWER`, 272M: a fully maxed lemon (every talent at the top
  tier, the best pets, the hand-made SS gear at ??? and slot level 80). The
  pests there grow by `END.pests` (7.8%) a chapter, tuned with simulated
  battles so that a fully maxed lemon only just beats chapter 100 and one a
  little short of max (205M) cannot. If gear or talents change what a maxed
  lemon reaches, change `MAX_POWER` to match.
- **Chapters 101 to 250** climb past that, through `CHECKS` in `js/data.js`:
  every 50 chapters, the build a lemon there is expected to have (chapter 150:
  Celestial gear at slot level 90 and talents to tier IV, 2.2B Power; 200:
  Cosmic, level 100, tier V, 16.3B; 250: Infinity, level 110, tier VI, 108B,
  everything maxed, which reaches about 120B), and how much tougher than
  chapter 100 its pests are. In between, every number grows by the same factor
  each chapter. The checkpoints were tuned with simulated battles so each
  build plays like a maxed lemon at chapter 100 (about six minutes, rarely
  below 80% health); one checkpoint behind, battles take about a third longer
  and the boss fight drags. A lemon with every defence the ??? perks give
  rarely loses outright at any chapter, so past 100, Power mostly decides how
  fast and how safe a battle is.
- **More chapters:** `CHAPTER_COUNT` in `js/data.js`, plus a name, a boss name,
  a boss kind and a featured pest for each new one in the lists below it.
  Chapters 51 to 250 are ten to a zone: from the Rooftops, the Pond, the Ice
  Box, the Thorn Wilds and the Golden Grove on to the Wild Meadow, the
  Hedgerow, the Old Woods, the Mushroom Ring, the Riverbank, the Marsh, the
  Rocky Hills, the Crystal Caves, the Lava Fields, the Storm Peaks, the Cloud
  Garden, the Night Orchard, the Moon Grove, the Starfield and the Heart of
  Citrus (their floors are in `js/arena.js`).
- **A new upgrade card:** add it to `UPGRADES` in `js/upgrades.js`.
- **The daily challenge:** `PS.CHALLENGE` in `js/data.js` sets when it opens,
  how far behind your best it is, its reward and the twists. A twist is a
  list of numbers (your damage, damage taken, speed, experience, the pests'
  size, health and speed, how often shrines and elites come), so a new one
  is one line. The day picks the twist, so everyone gets the same one.
- **Collection rewards:** `PS.BOOK` in `js/data.js`.
- **Admin access** is hidden on purpose. The admin password and the way in are only kept as scrambled check values (`LOCK` in `js/core.js`, `CODE` in `js/ui.js`), so reading the files does not give them away. To change the password, open the game, run `PS.dev.mix(PS.dev.mix("your new password"))` in the browser console and put what it prints into `LOCK`.
- **The admin menu in the lobby** has twelve sections down the left. *Overview* (every computed stat), *Gear* (give items, set each slot's level), *Owned* (change an item's rarity, wear it, remove it, clean out the bag), *Pets* (give any pet at any level, fill the team, open the slots), *Money*, *Shop* (open chests without paying, set the pity counters, set the gift timer), *Progress* (chapters and talents), *Quests* (complete or claim any quest, set the counters they read), *Chapters* (every chapter with Play and Clear to here), *Battle* (start any chapter or swarm mode with cheats and a built-up lemon), *Settings* and *Save*. Every change it makes is remembered: the **Undo** button at the top takes back the last one, and the Save section lists the last thirty so you can go back to any of them. The Save section also keeps named **snapshots** of the save in this browser and can download the save as a file or load one.
- **The DEV / admin panel in a battle** opens from the DEV button or the ` key. As admin it has six tabs: *Cheats* (godmode, one-hit kills, freeze the pests, stop spawning, vacuum, and multipliers for damage, attack speed, move speed, XP and game speed), *Upgrades* (search, filter by tier, take or max any card), *Player* (health, stat boosts, auto-levelling, swap weapon, build presets), *Spawn* (any pest, elites, the boss, a training dummy for reading damage per second, status effects on every pest, pickups), *Run* (skip the clock, set the boss's health, restart on any chapter) and *Stats* (a read-out of the whole run). The switches themselves are listed in `PS.dev` in `js/core.js`, so adding one there adds it to the lobby and the battle panel together.
- **The admin password** only works for the admin accounts (see Moderation below); for anyone else the hidden way in does nothing. It unlocks developer tools for that tab: a **DEV button in every
  battle** (godmode, one-hit kills, game speed, take or max any upgrade, level
  up, skip to the boss) and the tabbed admin menu in the lobby.
  The lobby menu can give or remove any item, set gold and
  gems to an exact figure, and start **Swarm mode**, an endless battle with no
  boss and a swarm that keeps growing, with pests as tough as the chapter you
  pick. It pays gold (3 times what a normal run of that chapter pays, scaled by how
  long you last) and keeps nothing else: no gear, progress or records.

---

## Accounts and the leaderboard

The game opens on a log-in screen. Players **sign up** with a name (3 to 16
letters, numbers or `_`) and a password, then **log in** with the same two.
There is no email, so a forgotten password cannot be reset; the owner can
delete the account in Supabase and the player signs up again.

**Change name** in the account window renames the player. The name is also
the login, so the game changes both (`pip_rename` in setup.sql, then the
account's address): they log in with the new name from then on, with the
same password. If the login cannot follow, the name goes back. Taken names,
and the names setup.sql makes admins (test, owner, test2, plus admin and
moderator), cannot be picked.

Once in, the **account button** at the top right opens the player's account
and the **leaderboard**. It ranks everyone by furthest chapter, Power, longest
endless swarm, pests squashed, daily challenges won, collection size or arena
duels won, and can
be filtered to players with progress **this week** or **today**, or searched by
name. Players on the same figure share a place.

**Ranks.** Every board has eight ranks: Unranked, Bronze, Silver, Gold,
Diamond, Platinum, Citrine and Zenith, each with its own emblem. Each row shows
the player's rank, the account window shows your rank on every board, and a
ladder under the filters shows what each rank takes and what is next. The
targets are the `ranks` lists in `BOARDS` in `js/cloud.js`. Chapter ranks are
chapters 1, 10, 40, 80, 130, 190 and 250, and Power ranks are the Power those
same chapters recommend.

A player's figures go up a few seconds after they change, and only ever go up:
playing on a second device cannot lower a best. They are checked against sane
limits, but they come from the player's browser, so a determined cheat can
still post a fake score. The owner can fix any row in Supabase's Table Editor.

**Setting it up** (once):

1. In Supabase, open **SQL Editor → New query**, paste all of
   [`supabase/setup.sql`](supabase/setup.sql) and press **Run**.
2. Open **Authentication → Sign In / Providers → Email** and switch
   **Confirm email** off, then save. (Names are turned into addresses that can
   never receive mail, so nobody could ever confirm one.)

The project address and its publishable key are at the top of `js/cloud.js`.
Both are meant to be public; the table's rules are what protect the data.
Never put the **secret** key anywhere in this folder.

**No connection?** The log-in screen offers **Play offline**, as whoever last
logged in on that device. Their progress goes up the next time they log in.

### Moderation

An account is an **admin** when its row in the `players` table has **admin**
ticked (Supabase → Table Editor → players). `setup.sql` ticks `test`,
`owner` and `test2`. Admins see buttons under every name on the leaderboard:

- **Ban**: asks for a message, then that player sees *"You have been banned
  by a moderator"* with the message, instead of the game. **Time out** does
  the same for 10 minutes, an hour, a day or a week.
- **Unban** lifts a ban or a timeout.
- **Give** sends any weapon or piece of gear at any rarity, or gold, or gems,
  with an optional message. It arrives the next time the player's game checks
  in (within a minute while they play) and pops up as a gift.
- **Admin abuse** (its own tab in the admin menu, for admin accounts; in a
  battle, the DEV button's panel has an **Abuse** tab with the same events,
  packs, countdown, Try it here, Fire for everyone and Stop):
  mischief for the players. Each button that sends something asks "Sure?"
  first, and none of it can be called back. One **Message** box at the top
  goes with the events, the gift or the rush.
  - **Events** play in every open game, with your message (or the event's
    own words) in a big announcement with the events' icons and a bar
    running down the time left. Tick **as many as you like** and they all
    play together:
    - *The screen*: Flip, Mirror, Shrink, Zoom, Spin, Earthquake, Jelly,
      Dizzy (blurry and swaying), Disco, Negative, Old film (black and
      white), Lights out and Shout (just your words).
    - *Falling and flying*: Confetti, Fireworks, Lemon rain, Gold rain, Gem
      rain, Snow, Hearts (floating up), a lemon Parade along the bottom, and
      a Jump scare.
    - *In battles*: Heal all, Nuke (clears every pest; bosses only shake),
      Untouchable (10 seconds of Star), Power surge (every power-up for 10
      seconds), Horde (40 pests close in) and Golden pest. They act on a
      battle that is on; anywhere else only the announcement shows. Gold
      rain and Gem rain also drop coins and experience gems in a battle.
      Duels are left alone, and in co-op the game running the battle does
      it for both lemons.
    - **Quick packs** tick a few that go well together (Party, Make it rain,
      Apocalypse, Troll, Blessing, Winter, Spooky).
    - **Seconds** (1 to 120) sets how long they last; left empty, they last as
      long as the longest one ticked. **Try it on my screen** plays them for
      you alone (the admin menu steps aside and comes back after). **Stop
      events for everyone** ends what is playing.
  - **Money rush**: battles pay more gold and gems for a while: pick ×1 to ×10
    for gold and for gems and how long (10 minutes up to a week, or any
    number of minutes). Chapter runs, endless (gold only) and duels all pay
    it; the results say "Money rush: ×2 gold · ×2 gems". Every open game gets a
    "MONEY RUSH!" announcement with gold and gems raining down, and a strip in
    the top bar (under the HUD in a battle) with the time left. A game opened
    during a rush shows the strip without the fanfare. **Stop the rush** ends
    it early for everyone.
  - **Free stuff**: pick **who** (everyone who isn't banned; everyone with the
    game open right now; or one random player, a lucky dip that tells you the
    winner) and **what** (an amount of gold or gems, with quick amounts from
    100 to 1M, or any weapon or gear at any rarity, with its picture). It
    arrives as a gift, so players who are offline get theirs the next time
    they open the game. **Fire the ticked events at the same moment** sends
    the gift and the events together, so the gift pops up in the middle of
    them.
  - Open games check every 10 seconds (yours plays at once, and a gift to
    yourself is picked up at once); one that has only just opened doesn't
    replay an old event, but a game opened or refreshed in the middle of one
    plays the rest of it (`pip_event` says how long ago it was fired, by the
    server's clock). Nothing in anyone's save changes, except what a
    battle event or a rush pays. Players with reduced motion on see just the
    announcement. The pictures sit above any open window. Server side:
    `pip_give_many`, `pip_set_event`, `pip_set_rush`, `pip_rush` and the
    `events` and `rush` tables in setup.sql. Event names are any short
    lowercase words, so a new event needs no change to setup.sql.
- **Show as...** makes the leaderboard show any number or text (up to 24
  characters, "noob" say) in place of one of a player's figures, for
  everyone. The real figure still decides the order; leaving the box empty
  shows it again. The same form sets the **place** shown on that board (the
  row moves to that spot) and the **rank badge** (Bronze to Zenith), each per
  board. (The `shown` column in setup.sql.)
- **My power and stats**, at the top of the admin menu's Overview, sets your
  own Power and any stat (attack, health, crit, speed and so on) by hand,
  over what your gear gives. They work in battles too, and the Power goes on
  the leaderboard. "Power shows as" puts text in place of the number on your
  own screens (top bar, Battle, Equipment, and what a friend sees when you
  join their room). Back to normal clears it all.
- **Removing things** happens in the **Inventory**, online or offline: every
  item (worn or in the bag) has a **Remove** button, and coins and gems have
  an amount box with **Remove** and **Remove all**. Gear that isn't listed
  can be picked under "Remove gear that isn't shown here". Each button asks
  "Sure?" first. The message box at the top is optional: with a message the
  player is told what was removed and sees the message; without one it just
  disappears and they are not told (nothing says a moderator did it either
  way). Their game does it the next time it checks in (within a minute while
  they play, or as soon as they next open the game). Gear in the bag goes
  before worn gear, and a lemon that loses its weapon picks up its best other
  one (or a sling). Removals still waiting for their game are listed with
  **Call off**. They are kept apart from gifts, so a game too old to know
  about them leaves them waiting.
- **Inventory** shows what the player owns: gold, gems, SS shards, Power, the
  gear they wear and their pet team. Their whole pet list and their **bag** are
  folded away and only drawn when opened, 120 items at a time, so a huge bag
  cannot freeze the admin's computer. Each game sends its inventory now and
  then while the player plays (at most every 30 seconds, only the best 3,000
  bag items, and the server refuses anything over 200 KB), and once more as
  the game closes or goes into the background. The server keeps the last copy,
  so it can be looked at while the player is offline (it says so). A player
  only shows up once they have opened the game since this was added. What
  arrives is checked before it is shown: unknown items are left out and counted.
- **Online or offline**: under each name admins see a green **Online** (with
  what they're doing: in the menus, in a battle, playing co-op, in a duel or
  trading) or **Offline · seen 3h ago**. Each signed-in game tells the server
  it is open about every 45 seconds and says when it closes; a game not heard
  from for 2 minutes counts as offline (a computer gone to sleep, say). Someone
  playing with **Play offline** shows as offline. The open board checks again
  every 30 seconds. Only admins can see any of this (`pip_presence` in
  setup.sql); everyone else's leaderboard looks as before.

Banned and timed-out players disappear from everyone else's leaderboard and
cannot post scores. A game checks for bans and gifts every 45 seconds, and a
ban ends a battle on the spot. All of this is checked by the server, so the
buttons do nothing for anyone who is not an admin. Admins cannot be banned.

**The banner** (the yellow strip above the top bar) is changed for every
player from the admin menu: **Settings → Banner**. Type the new text and press
**Show to everyone** (or Enter); **Hide the banner** takes it away, and **Use
the text in index.html** goes back to the text written in `index.html`, which
is also what shows until a banner has been set. Games pick up a new banner
when they open and within a minute while they play. The text is kept in the
`banner` table, which needs the newer `setup.sql` (run it again); until then
the buttons say the server needs an update. Up to 200 characters, plain text.

## Playing with a friend

**Play with a friend** (under Battle) opens rooms for two. Both need the game
open and the internet.

- **Invites, no codes**: the window lists the players who have the game open
  right now (amber means busy: in a battle, playing together or trading).
  Press **Co-op** or **Duel** next to a name, or type a name in, and the game
  makes the room and invites them. They get a pop-up at the top of their
  screen, "alice invites you to play co-op: chapter 3: Tall Grass" (or "...to
  an arena duel (equal)"), with **Join** and **No thanks**, for 2 minutes.
  Join takes them straight into the room. The window shows whether they are
  coming, said no thanks or didn't answer (with **Again**), and the room lists
  the players online so more can be asked.
- **The code still works**: make a room, and its six-letter code is shown to
  read out; the other player presses the same button and types it in.

- **Co-op**: both lemons in the room maker's chosen chapter. There are about
  60% more pests and the boss has 1.8 times the health. A lemon that drops goes
  down instead of losing; the other stands next to it for three seconds to help
  it up. The battle is lost only when both are down. Each player keeps their
  own gold and gear. A chapter past the guest's own progress pays like the
  guest's furthest chapter and opens nothing new for them.
- **Arena duel**: lemon against lemon in a walled ring, best of three rounds of
  up to 90 seconds (out of time, the one with more health left takes the round).
  **Equal** gives both lemons the same health and damage, so only weapons,
  perks and upgrades matter; **Full power** uses the real figures with hits
  between lemons cut down. A few weak pests wander in for XP. A win pays a
  chapter's gold and 5 gems and counts on the **Duels** leaderboard.

How it works: the room is a Supabase Realtime channel, used only to find each
other and swap a few handshake messages. The battle itself then goes directly
between the two browsers (WebRTC), so it does not use the project's monthly
Realtime allowance. Where the two cannot reach each other directly (some
school, office or phone networks), it falls back to going through the room,
which does use the allowance (about 10 messages a second per battle). The room
maker's game runs the battle and sends the other game what to show thirty
times a second on a direct link (about six through the room); the other game
moves its own lemon at once so it feels quick. The partner panel in the battle
shows the ping (the round trip between the two games, in milliseconds), in
amber above 120 and red above 250, and says "server" when the battle is going
through the room. Keep the room maker's game window open and in front: a browser slows
down a tab in the background, and the battle with it.

The Duels board needs the newer `supabase/setup.sql` (run it again); until
then everything else keeps working and the Duels board says so.

**The admin menu in co-op and the arena.** With the admin password, the DEV
button (or the ` key) works in battles together too. The battle does not stop
while it is open. Cheats work on your own lemon only (Freeze and Stop spawning
work on the whole battle), and game speed stays at 1× so both games keep
time. Restarting is not offered, and a duel has no clock, boss or win button.
If you made the room, everything works straight away. If you joined someone
else's room, your game sends what you press to theirs (which runs the
battle), and theirs first asks the server whether you really are on an admin
account (`pip_dev_token` and `pip_dev_check` in setup.sql). Until it says yes,
nothing you press does anything.

### Invites

The invited player sees the pop-up on any screen except a battle: one that
arrives during a battle waits until it is over (it lasts 2 minutes). While a
window of the game's own is open (the chat, settings, the admin menu), the
browser lets nothing outside it be clicked, so the pop-up says to close it
first. A game looks for invites every 4 seconds while it is in front. Joining a
room while a trade is going (or the other way round) asks to finish the first
one. Only signed-in players who aren't banned can see who is online or invite
anyone, and the list shows names only. Server side: the `invites` table and
`pip_online_players`, `pip_invite`, `pip_invites`, `pip_invite_answer` and
`pip_invite_state` in `supabase/setup.sql` (run it again).

## Chat

**Chat** (under Battle, next to Trade) is a public chat for everyone signed in.
The window fills the screen and shows the last 50 messages, refreshing every
few seconds while it is open. 200 characters, one message every 2 seconds, and
banned or timed-out players can't post. Messages show as plain text. Admins
can delete any message (the x on it), and admins' messages carry an "admin"
tag.

- **In a battle**, the **pause menu** shows the same chat: the newest messages
  and a box to write in, refreshing while you are paused (and not at all while
  you play). Typing in the box never steers the lemon or un-pauses the battle;
  Escape still does. Playing offline, it isn't shown.
- **@name** sends a message to one person (not case sensitive): a box pops up
  at the top right of their screen for a few seconds, in the menus **or in the
  middle of a battle**, and the message is lit up for them in the chat. The
  message itself stays in the public chat. Pressing someone's name in the chat
  starts a message to them.
- **@everyone** is an announcement: a big pulsing banner with a sound and the
  words "ANNOUNCEMENT", at the top right, for 14 seconds (click it to
  dismiss, except while a window is open). It shows on every screen, in
  battles too, **above** an open chat or menu, even to the admin who wrote it,
  and the tab title shouts if the game is in the background. It only works
  when an admin writes it (anyone else's is just text), and it needs the
  newer `supabase/setup.sql`: if it hasn't been run, the admin is told so
  when they send one.
- A game checks for new mentions every 4 seconds while it is in front.
  Messages older than when the game opened never pop up, and a small @name
  box isn't shown for what is already on screen in the open chat or for your
  own messages. Only the newest 300 messages are kept.
- **Fun**: each name gets its own colour; new messages pop in with a quiet
  sound; emoji buttons under the list; and commands: `/roll` (or `/roll 20`),
  `/flip` (a coin), `/shrug`, `/table`, and `/me waves` (an action line).

Server side: the `chat` table (with an `admin` mark so @everyone can be
trusted), `pip_say` and `pip_chat_delete` in `supabase/setup.sql`.

## Trading

**Trade** (under Battle, next to Play with a friend) swaps gear, pets, gold
and gems between two players. Both need an account and the game open. Press
**Trade** next to someone in the window's list of players online (or type
their name): the game makes the trade and they get a pop-up, "alice wants to
trade with you", with **Join**. A trade code still works too: make one, read
it out, and the other types it in.

- Each side picks from their bag (worn gear can't be traded) and pets, up to
  20 items and 6 pets, plus any gold and gems they have.
- **Changing either offer takes back both accepts**, and the other player's
  side lights up when it changes.
- When both press **Accept**, the trade **locks**: neither offer can change.
  **3 seconds later it goes through.** In those 3 seconds either player can
  press **Stop**, which unlocks it (nobody accepted), or leave.
- Then each game takes away what it gave and adds what it got. Pets are kept
  one per kind and rarity, so a pet you already have just takes the higher
  level (the trade window says so beforehand).

The server holds both offers (the `trades` table and the `pip_trade_*`
functions in setup.sql), not the players' games. So what you see when you
accept is exactly what you get: nobody can swap their offer at the last
moment, and nobody can keep their side and still get yours. An accept only
counts for the offers you were looking at. A trade that locked before someone
closed the game still goes through, and their game picks it up when it is next
opened. Each game remembers which trades it has done, so none is added twice.
(Saves are still kept in the browser, so someone who edits their own save
could put made-up items in a trade, just as they could give them to
themselves.) Trading needs the newer `supabase/setup.sql`.

## How saving works

Saves stay in this browser's `localStorage`; only the leaderboard figures above
are sent to the server. Each account on a device has its own save. The first
account to log in on a device takes over the save that was there before
accounts existed, so nobody loses progress.

| Key | What it holds |
| --- | --- |
| `lemon:pips:save:<account id>` | one account's whole save: gold, gems, gear, levels, talents, chapters, quests, the daily challenge and the collection |
| `lemon:pips:save` | the save from before accounts (until an account takes it over), or one played offline with no account |
| `lemon:cloud:last` | who last logged in on this device, for playing offline |
| `sb-…-auth-token` | the log-in session, kept by Supabase so the game opens straight into the menus next time |
| `lemon:theme` | `"light"` or `"dark"` |

Every read and write is wrapped in `try/catch`. In a private window, or when a
browser blocks site data, the game still plays; it just forgets its progress
when the tab closes, and says so in Settings.

To start again, use **Settings → Reset progress**.

---

## Browser support

Tested in current Chrome and Edge. It sticks to widely supported features
(canvas 2D, `localStorage`, `<dialog>`, CSS grid, custom properties,
`aspect-ratio`, `color-mix`), so current Firefox and Safari should behave the
same.

- **Fonts** come from Google Fonts. Offline, the page falls back to the system
  fonts and still looks right.
- **Phones and tablets:** the menus collapse to one column and the battle
  fills the screen in either orientation.
- **Reduced motion:** if your system asks for less animation, the menus stop
  moving and the battle stops shaking. Settings has an **Animations** switch
  (Auto, Always on, Off) if you want to override your device either way.
- **Sound:** short sound effects for the menus, upgrades, chests, the forge and
  battles, all made in the browser (no audio files). Nothing plays until your
  first click, and Settings has a Sound switch to turn it off.

---

## Credits and licences

The code and artwork are original and MIT licensed — see `LICENSE`. Fonts and
notes on inspiration are in `CREDITS.md`.


#note to self
git add .
git commit -m "Updated site content"
git push origin main

<img width="231" height="141" alt="image" src="https://github.com/user-attachments/assets/8d9ffbad-b7c2-416b-9b04-48fc4bc9dd7e" />

