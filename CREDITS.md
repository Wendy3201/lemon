# Credits and licences

## Pip Survivors itself

All of the code, artwork and game design in this folder was written for this
project. That includes the page (`index.html`, `style.css`), everything under
`js/`, the lemon icon in `assets/icons/`, and every picture in the game: the
gear, chests, bosses and interface icons are drawn with code in
`js/icons.js`, and the battle is drawn on a canvas in `js/battle.js`,
`js/weapons.js`, `js/enemies.js` and `js/upgrades.js`.

Licence: MIT — see [`LICENSE`](LICENSE). You may use, change and share it, as
long as the copyright notice and licence text stay with it.

### About the ideas it borrows

Pip Survivors mixes two well-worn kinds of game: the "survivor" auto-shooter,
where you only steer and choose upgrades, and the mobile gear-collecting RPG,
with rarities, grades, merging three items into a better one, chests and a
power score. Those are general ideas that many games share, and game *rules*
are not owned by anyone. Names, artwork, sounds and code are. So this project
uses:

- its own code, written from scratch;
- its own artwork, drawn in the lemon palette;
- its own names for every weapon, item, pest, boss and chapter.

Nothing here is copied from, or is a port of, any commercial game.

## Fonts

Loaded from Google Fonts, used under the
[SIL Open Font License 1.1](https://scripts.sil.org/OFL):

| Font | Used for | Designers |
| --- | --- | --- |
| Baloo 2 | Headings, big numbers, the battle text | Ek Type |
| Nunito | Body text and buttons | Vernon Adams, Cyreal, Jacques Le Bailly |
| JetBrains Mono | Labels and small captions | JetBrains |

The font files are not copied into this project; the page links to Google
Fonts and falls back to your system fonts when offline.

## Sounds

Every sound effect is made in the browser by js/audio.js from oscillators and
filtered noise, so there are no audio files and nothing to credit. They are off
until the first click and can be turned off in Settings.

## Adding third-party work later

If you add a sound, font or image that someone else made:

1. Check its licence first, and make sure it allows redistribution and
   modification. Most open-source licences do (MIT, Apache-2.0, CC0,
   CC-BY, CC-BY-SA, GPL); "all rights reserved" and most commercial game assets
   do not.
2. Keep their licence file in the project, next to the work it covers.
3. Leave any copyright headers in the source files exactly as they are.
4. Add a row to this file: what it is, who made it, where it came from, and
   which licence it uses.
5. Do not describe someone else's work as original work.
