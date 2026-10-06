# 🍋 Pip Survivors

**A Lemon game.** You steer a lemon through swarms of garden pests. It attacks
by itself; you dodge, grab gems, and pick an upgrade every level. Between
battles you collect gear, forge it into rarer gear, open chests, learn talents
and watch your Power climb through twenty chapters.

Plain HTML, CSS and JavaScript. No build step, no framework, no dependencies,
no accounts, no tracking. It works offline once the folder is on your computer.

---

## Running it

**The quick way.** Double-click `index.html`. Everything works from `file://`,
including saving.

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

---

## How to play

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
  clear the chapter and open the next one.
- `Esc` or `P` pauses. Losing still pays some gold, and gear too if you got
  halfway.

### Between battles

| Tab | What it is for |
| --- | --- |
| **Battle** | Pick a chapter and fight. Shows your Power against the chapter's recommended Power. |
| **Equipment** | Six slots: weapon, ring, amulet, helmet, armour, boots. Level slots up with gold, swap gear, and open the **Forge**. |
| **Shop** | A free gift every four hours, chests bought with gems, four deals that change each day, and gold for gems. |
| **Talents** | Permanent bonuses bought with gold. |
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

Surpass and ??? never drop. They only come out of the forge.

Some items are **S-grade** or **SS-grade**. The grade belongs to the item
itself (an S-grade bow is S-grade at every rarity): ×1.2 or ×1.45 on the main
stat, and stronger perks. Gilded Chests guarantee an S-grade within ten opens
and an SS-grade within forty, and the boss of every fourth chapter drops one
the first time you beat it.

**Levels belong to the slot, not the item**, so nothing is lost when you swap
gear. Each level is +3.5% of the item's main stat.

**The Forge** takes three items of the same slot and the same rarity. The one
you pick first is kept and rises one rarity; the other two are used up.

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

---

## What's in the folder

```text
lemon/
├── index.html        the page: top bar, tabs, and the battle layer
├── style.css         theme colours, layout, every screen
├── js/
│   ├── core.js       the PS namespace, safe storage, events, number formatting
│   ├── data.js       ALL the numbers: rarities, gear and perks, talents,
│   │                 chapters, quests, chest odds, prices, balance curves
│   ├── icons.js      every icon and item picture, drawn in code as SVG
│   ├── audio.js      every sound effect, made with the Web Audio API
│   ├── state.js      the save file and the rules: equip, level up, forge,
│   │                 chests, deals, quests, battle rewards, Power
│   ├── battle.js     the battle engine: movement, damage, pickups, drawing
│   ├── weapons.js    how each weapon attacks and looks
│   ├── enemies.js    pests, bosses, and who turns up when
│   ├── upgrades.js   the level-up cards and the abilities they add
│   ├── hud.js        health bar, timer, level-up cards, pause screen
│   └── ui.js         the menus: Battle, Equipment, Forge, Shop, Talents, Quests
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
  attacks. Copy the closest existing one.
- **Prices, odds and rewards:** `PS.CHESTS`, `PS.GIFT`, `PS.DROP_GRADE`,
  `PS.TALENTS`, `PS.QUESTS` and `PS.BAL`.
- **Difficulty:** `HP_SCALE` and `DMG_SCALE` say how much tougher and harder
  hitting pests are in each chapter, `BOSS_SCALE` does the same for the boss's
  health, and `REC_POWER` is the number shown as "recommended". They were
  fitted by simulating thousands of battles against the gear a player
  naturally has by each chapter, so if you make gear or gold much more
  generous, raise them to match.
- **A new upgrade card:** add it to `UPGRADES` in `js/upgrades.js`.
- **The password on the `?` button** is `SECRET_PASSWORD` in `js/ui.js`. It is
  checked in the browser, so anyone who reads the file can see it.

---

## How saving works

Everything is stored in this browser's `localStorage`. Nothing is uploaded.

| Key | What it holds |
| --- | --- |
| `lemon:pips:save` | the whole save: gold, gems, gear, levels, talents, chapters, quests |
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
