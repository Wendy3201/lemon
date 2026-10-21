# 🍋 Pip Survivors

**A Lemon game.** You steer a lemon through swarms of garden pests. It attacks
by itself; you dodge, grab gems, and pick an upgrade every level. Between
battles you collect gear, forge it into rarer gear, open chests, learn talents
and watch your Power climb through a hundred chapters in fifteen zones.

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
| **Talents** | Permanent bonuses bought with gold. Max every talent in a tier and you can **ascend**: tier II and tier III repeat the talents at a bigger bonus and a much bigger price, and add Lucky Star, Wide Swing and Giant Slayer. |
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

Chapter loot, the free gift and the daily deals go up to Legendary at most.
Mythic, Surpass and ??? never drop: they only come out of the forge.

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
you pick first is kept and rises one rarity; the other two are used up.

**Selling.** Open an item you are not wearing and press **Sell** (it asks once
more). Only valuable gear sells, and the two prices add up:

| Rarity | Gold | | Grade | Gold |
| --- | --- | --- | --- | --- |
| Mythic | 20,000 | | S | 10,000 |
| Surpass | 60,000 | | SS | 100,000 |
| ??? | 200,000 | | | |

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
- **More chapters:** `CHAPTER_COUNT` in `js/data.js`, plus a name, a boss name,
  a boss kind and a featured pest for each new one in the lists below it.
  Chapters 51 to 100 are ten to a zone: the Rooftops, the Pond, the Ice Box,
  the Thorn Wilds and the Golden Grove (their floors are in `js/arena.js`).
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

Once in, the **account button** at the top right opens the player's account
and the **leaderboard**. It ranks everyone by furthest chapter, Power, longest
endless swarm, pests squashed, daily challenges won or collection size, and can
be filtered to players with progress **this week** or **today**, or searched by
name. Players on the same figure share a place.

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
ticked (Supabase → Table Editor → players). `setup.sql` ticks `test` and
`owner`. Admins see buttons under every name on the leaderboard:

- **Ban**: asks for a message, then that player sees *"You have been banned
  by a moderator"* with the message, instead of the game. **Time out** does
  the same for 10 minutes, an hour, a day or a week.
- **Unban** lifts a ban or a timeout.
- **Give** sends any weapon or piece of gear at any rarity, or gold, or gems,
  with an optional message. It arrives the next time the player's game checks
  in (within a minute while they play) and pops up as a gift.

Banned and timed-out players disappear from everyone else's leaderboard and
cannot post scores. A game checks for bans and gifts every 45 seconds, and a
ban ends a battle on the spot. All of this is checked by the server, so the
buttons do nothing for anyone who is not an admin. Admins cannot be banned.

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

