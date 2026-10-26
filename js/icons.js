/*!
 * Pip Survivors — artwork
 * Every icon in the game, drawn in code as small SVGs so nothing has to be
 * downloaded: interface glyphs (24 x 24, take the text colour unless they
 * are a coin or a gem) and gear, chests and bosses (48 x 48, full colour).
 *
 *   PS.icon("coin")        -> "<svg class='ico'>…</svg>"
 *   PS.itemIcon("bow")     -> "<svg class='art'>…</svg>"
 *   PS.art("crate")        -> "<svg class='art'>…</svg>"
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function () {
  "use strict";

  var PS = window.PS;

  /* ------------------------------------------------------------- helpers */

  function attrs(extra) {
    return extra ? " " + extra : "";
  }
  function fill(d, color, extra) {
    return '<path d="' + d + '" fill="' + (color || "currentColor") + '"' + attrs(extra) + "/>";
  }
  function line(d, color, width, extra) {
    return (
      '<path d="' + d + '" fill="none" stroke="' + (color || "currentColor") + '" stroke-width="' + (width || 2) +
      '" stroke-linecap="round" stroke-linejoin="round"' + attrs(extra) + "/>"
    );
  }
  function dot(cx, cy, r, color, extra) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + (color || "currentColor") + '"' + attrs(extra) + "/>";
  }
  function ring(cx, cy, r, color, width, extra) {
    return (
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + (color || "currentColor") +
      '" stroke-width="' + (width || 2) + '"' + attrs(extra) + "/>"
    );
  }
  function box(x, y, w, h, r, color, extra) {
    return (
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (r || 0) + '" fill="' +
      (color || "currentColor") + '"' + attrs(extra) + "/>"
    );
  }
  function oval(cx, cy, rx, ry, color, extra) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + (color || "currentColor") + '"' + attrs(extra) + "/>";
  }
  function poly(points, color, extra) {
    return '<polygon points="' + points + '" fill="' + (color || "currentColor") + '"' + attrs(extra) + "/>";
  }
  function group(transform, inner) {
    return '<g transform="' + transform + '">' + inner + "</g>";
  }
  function tilt(inner) {
    return group("rotate(45 24 24)", inner);
  }

  var C = {
    wood: "#A0703F", woodDark: "#70492A", steel: "#CBD2DC", steelLight: "#EEF2F7", steelDark: "#8D96A8",
    gold: "#F2B93B", goldDark: "#C98A1B", goldLight: "#FFE08A", leaf: "#8FAE65", leafDark: "#5F8244", leafLight: "#B9D694",
    lemon: "#F7D94C", rind: "#E0B93C", pale: "#FFF4B8", white: "#FFFCF2", ink: "#29261F",
    red: "#E5484D", fire: "#F26B2A", ember: "#FFD166", ice: "#7FD4F5", iceDark: "#3A9BD9", iceLight: "#DDF4FF",
    violet: "#8E7BFF", violetDark: "#3A2F52", void: "#1B1630", voidGlow: "#B48CFF", slate: "#5C6B8A"
  };

  var HEART = "M12 21C5.5 16 3 12.5 3 9.2 3 6.6 5 4.5 7.6 4.5c1.8 0 3.4 1 4.4 2.5 1-1.5 2.6-2.5 4.4-2.5C19 4.5 21 6.6 21 9.2c0 3.3-2.5 6.8-9 11.8z";
  var BOLT = "M13.5 2 5 13.2h5.2L9 22l10-12.4h-5.6z";
  var FLAME = "M12.4 2c.8 3.8 5.1 5.9 5.1 11a5.5 5.5 0 0 1-11 0c0-2.2 1-3.8 2.2-4.9 0 2 .8 3.1 1.9 3.3C10.3 8.3 10.2 5 12.4 2z";
  var SHIELD = "M12 2.5 20 5.5V11c0 5-3.4 8.8-8 10.8C7.4 19.8 4 16 4 11V5.5z";
  var DROP = "M12 3c3.8 4.8 6 8 6 11a6 6 0 0 1-12 0c0-3 2.2-6.2 6-11z";

  function star(cx, cy, outer, inner, points, turn) {
    var out = [];
    for (var i = 0; i < points * 2; i++) {
      var r = i % 2 ? inner : outer;
      var a = (i * Math.PI) / points + (turn || -Math.PI / 2);
      out.push((cx + Math.cos(a) * r).toFixed(1) + "," + (cy + Math.sin(a) * r).toFixed(1));
    }
    return out.join(" ");
  }

  function cog() {
    var teeth = "";
    for (var i = 0; i < 8; i++) teeth += '<rect x="10.3" y="1.5" width="3.4" height="5" rx="1" transform="rotate(' + i * 45 + ' 12 12)"/>';
    return '<g fill="currentColor">' + teeth + "</g>" + ring(12, 12, 5.2, null, 3.6);
  }

  function rays(cx, cy, from, to, count, width) {
    var d = "";
    for (var i = 0; i < count; i++) {
      var a = (i / count) * Math.PI * 2;
      d += "M" + (cx + Math.cos(a) * from).toFixed(1) + " " + (cy + Math.sin(a) * from).toFixed(1) +
        "L" + (cx + Math.cos(a) * to).toFixed(1) + " " + (cy + Math.sin(a) * to).toFixed(1);
    }
    return line(d, null, width || 2);
  }

  /* -------------------------------------------------------------- glyphs */

  var GLYPHS = {
    coin: dot(12, 12, 9.5, C.goldDark) + dot(12, 11.3, 8.8, C.gold) + ring(12, 11.3, 5.2, C.goldLight, 1.7),
    gem: poly("12,2.5 20.5,9 12,21.5 3.5,9", "#2E9BE6") + poly("12,2.5 20.5,9 3.5,9", "#9BDCFF") +
      poly("12,9 16.2,9 12,21.5 7.8,9", "#5FBDF5") + poly("8.2,5.4 12,2.5 12,9 7.8,9", "#D2F0FF"),
    power: fill(BOLT),
    bolt: fill(BOLT),
    atk: group("rotate(45 12 12)", fill("M12 1.5 14.3 4.5V15H9.7V4.5z") + box(6.5, 15, 11, 2.4, 1) + box(10.6, 17.4, 2.8, 4.2, 0.8)),
    hp: fill(HEART),
    crit: ring(12, 12, 7.5, null, 2) + line("M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5") + dot(12, 12, 1.8),
    critDmg: poly(star(12, 12, 10.5, 4.6, 8)),
    haste: line("M4 6l6 6-6 6M13 6l6 6-6 6", null, 2.6),
    speed: fill("M8 3h6v9.2l5.2 2.3A3 3 0 0 1 21 17.3V19H8z") + box(7, 20, 15, 2.2, 1) + line("M2 8h3M1.5 12h3.5M2.5 16h2.5", null, 1.8),
    armor: fill(SHIELD),
    regen: fill("M9.7 3.5h4.6v6.2h6.2v4.6h-6.2v6.2H9.7v-6.2H3.5V9.7h6.2z"),
    magnet: line("M6.5 8.6V12a5.5 5.5 0 0 0 11 0V8.6M6.5 2.6v3.6M17.5 2.6v3.6", null, 4.4, 'stroke-linecap="butt"'),
    xp: poly(star(12, 12.6, 10.5, 4.4, 5)),
    luck: dot(8.4, 8.4, 4.4) + dot(15.6, 8.4, 4.4) + dot(8.4, 15.6, 4.4) + dot(15.6, 15.6, 4.4) + line("M12 12l7 9", null, 2),
    area: ring(12, 12, 3.6, null, 2.2) + ring(12, 12, 9, null, 2, 'stroke-dasharray="3.5 3.5"'),
    count: dot(12, 6.8, 3.6) + dot(6.2, 16.4, 3.6) + dot(17.8, 16.4, 3.6),
    pierce: ring(9.5, 12, 5.5, null, 2) + line("M2 12h18M16 7.5l5 4.5-5 4.5", null, 2.2),
    orbit: ring(12, 12, 8, null, 1.6, 'stroke-dasharray="2.5 3"') + dot(12, 12, 3.2) + oval(19.2, 8.2, 3.8, 2.2, null, 'transform="rotate(-35 19.2 8.2)"'),
    bomb: dot(10.8, 14.4, 7.6) + line("M15.5 8.5l2.5-3", null, 2.2) + poly(star(19.6, 4.2, 3.4, 1.4, 4)),
    mist: line("M3 8c2.5-2.5 4.5 2.5 7 0s4.5-2.5 7 0 4 0 4 0M3 13c2.5-2.5 4.5 2.5 7 0s4.5-2.5 7 0 4 0 4 0M3 18c2.5-2.5 4.5 2.5 7 0s4.5-2.5 7 0 4 0 4 0", null, 2.2),
    trail: fill(FLAME, null, 'transform="translate(3.5 -1) scale(0.8)"') + line("M3 21.5h4M9.5 21.5h4M16 21.5h4.5", null, 2),
    burst: rays(12, 12, 4.5, 10.5, 8, 2.4) + dot(12, 12, 2.4),
    swarm: dot(17, 7, 3.4) + dot(8, 9.5, 2.6) + dot(13.5, 16.5, 3) + line("M12.5 4.5 9.5 3M4.2 7.8 2 7M9.5 14.8 6.8 13.8", null, 1.6),
    burn: fill(FLAME),
    chill: line("M12 2v20M3.3 7l17.4 10M20.7 7 3.3 17M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5", null, 2),
    shock: ring(12, 12, 9.5, null, 1.6, 'stroke-dasharray="3 3"') + fill(BOLT, null, 'transform="translate(2.4 2.4) scale(0.8)"'),
    boom: poly(star(12, 12, 11, 5.4, 9)),
    leech: fill(DROP),
    revive: fill(HEART + "M10.8 8.5h2.4v2.8H16v2.4h-2.8v2.8h-2.4v-2.8H8v-2.4h2.8z", null, 'fill-rule="evenodd"'),
    glass: line("M4 13.5a8 6.5 0 1 0 16 0a8 6.5 0 1 0-16 0M13 7l-2.5 4 3.5 2-2.5 4.5M12 7c0-3 2-4.5 4.5-4.5", null, 2),
    echo: dot(5, 12, 2.6) + line("M10 6.5a8 8 0 0 1 0 11M14.5 4a12 12 0 0 1 0 16M19 2a16 16 0 0 1 0 20", null, 2.2),
    sun: dot(12, 12, 4.6) + rays(12, 12, 7.2, 10.6, 8, 2.2),
    frostnova: ring(12, 12, 9.5, null, 1.6, 'stroke-dasharray="2 2.5"') + line("M12 6v12M6.8 9l10.4 6M17.2 9 6.8 15", null, 1.8),
    mine: rays(12, 13, 6.6, 10, 8, 1.8) + dot(12, 13, 5.6) + dot(12, 13, 1.8, "#E5484D"),
    sunbeam: dot(6.5, 17.5, 3.6) + line("M9.5 14.5 21 3", null, 3) + line("M10.5 19 20.5 9", null, 1.4, 'opacity="0.6"'),
    rain: oval(6.5, 9, 3, 3.6) + oval(16, 6.5, 3, 3.6) + oval(11.5, 17, 3, 3.6) + line("M6.5 2.5v2M16 0.5v1.5M11.5 10.5v2", null, 1.4),
    bee: oval(7.5, 8, 4.2, 2.6, null, 'opacity="0.55" transform="rotate(-30 7.5 8)"') + oval(16.5, 8, 4.2, 2.6, null, 'opacity="0.55" transform="rotate(30 16.5 8)"') +
      oval(12, 14, 6.6, 5.2) + box(9.2, 9.4, 1.7, 9.2, 0.8, "#fff", 'opacity="0.75"') + box(13.4, 9.4, 1.7, 9.2, 0.8, "#fff", 'opacity="0.75"'),
    vine: line("M3.5 20.5C9 19 6.5 12.5 11.5 11.5S17.5 6 14 3", null, 2.4) + oval(8, 13, 3, 1.7, null, 'transform="rotate(-30 8 13)"') +
      oval(16.5, 8.5, 3, 1.7, null, 'transform="rotate(40 16.5 8.5)"'),
    bubble: ring(12, 12, 8.5, null, 2) + oval(9, 8.5, 2.6, 1.4, null, 'transform="rotate(-35 9 8.5)"'),
    field: ring(12, 12, 9.5, null, 1.6, 'stroke-dasharray="3 3"') + line("M13 5.5 9.5 12H14.5L11 18.5", null, 2.2),
    dash: oval(15.5, 12, 6.2, 5.4) + line("M2.5 8h6.5M1.5 12h7M2.5 16h6.5", null, 2.2),
    startUp: line("M5 12.5l7-7 7 7M5 19.5l7-7 7 7", null, 2.8),
    skull: fill("M12 2.5c-5 0-8.5 3.4-8.5 7.8 0 2.7 1.3 4.8 3.3 6.1V19c0 .8.7 1.5 1.5 1.5h7.4c.8 0 1.5-.7 1.5-1.5v-2.6c2-1.3 3.3-3.4 3.3-6.1 0-4.4-3.5-7.8-8.5-7.8zM8.6 9a2.3 2.3 0 1 1 0 4.6A2.3 2.3 0 0 1 8.6 9zm6.8 0a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6zM11 16h2v2.5h-2z", null, 'fill-rule="evenodd"'),
    chart: box(3.5, 13, 4.6, 8, 1.2) + box(9.7, 8, 4.6, 13, 1.2) + box(15.9, 3, 4.6, 18, 1.2),
    gear: cog(),
    lock: box(5, 10.5, 14, 10.5, 2.4) + line("M8 10.5V7.5a4 4 0 0 1 8 0v3", null, 2.4),
    check: line("M4.5 12.5l5 5L19.5 6.5", null, 3),
    left: line("M15 4.5 7.5 12l7.5 7.5", null, 3),
    right: line("M9 4.5l7.5 7.5L9 19.5", null, 3),
    close: line("M5.5 5.5l13 13M18.5 5.5l-13 13", null, 2.8),
    plus: line("M12 4.5v15M4.5 12h15", null, 3),
    up: fill("M12 3.5l8 9h-4.8V21H8.8v-8.5H4z"),
    pause: box(6, 4.5, 4.2, 15, 1.2) + box(13.8, 4.5, 4.2, 15, 1.2),
    forge: fill("M3 9.5h13.5c0 2.8-2 4.3-4.5 4.8V17H15v3.5H6.5V17H9v-2.8c-3-.6-5.3-2.2-6-4.7z") + group("rotate(-35 17 6)", box(12.5, 3.2, 9, 5, 1) + box(16, 8.2, 2.2, 5.5, 0.6)),
    clock: ring(12, 12, 9, null, 2.2) + line("M12 6.5V12l3.8 2.3", null, 2.2),
    book: fill("M2.5 5.2c3.1-1.4 6.2-1.2 8.6.7V20c-2.4-1.6-5.5-1.8-8.6-.6zM21.5 5.2c-3.1-1.4-6.2-1.2-8.6.7V20c2.4-1.6 5.5-1.8 8.6-.6z"),
    gift: box(4, 11.6, 7, 9.4, 1.2) + box(13, 11.6, 7, 9.4, 1.2) + box(2.8, 6.8, 8.2, 3.6, 1) + box(13, 6.8, 8.2, 3.6, 1) +
      line("M12 6.5C9 6.5 7 5.5 7 4s2.5-2 5 2.5C14.5 2 17 2.5 17 4s-2 2.5-5 2.5", null, 1.8),
    /* the five tabs */
    tabShop: fill("M5 8h14l1.4 11.5A1.5 1.5 0 0 1 18.9 21H5.1a1.5 1.5 0 0 1-1.5-1.5z") + line("M8.5 10V7a3.5 3.5 0 0 1 7 0v3", null, 2.2),
    tabGear: fill("M12 3c-5 0-8.5 3.8-8.5 8.5V18h5.8v-5h5.4v5h5.8v-6.5C20.5 6.8 17 3 12 3zM10.9 4.4h2.2v6.2h-2.2z", null, 'fill-rule="evenodd"'),
    tabBattle: group("rotate(45 12 12)", fill("M12 0 14.2 3v11.5H9.8V3z") + box(6.8, 14.5, 10.4, 2.3, 1) + box(10.7, 16.8, 2.6, 4.6, 0.8)) +
      group("rotate(-45 12 12)", fill("M12 0 14.2 3v11.5H9.8V3z") + box(6.8, 14.5, 10.4, 2.3, 1) + box(10.7, 16.8, 2.6, 4.6, 0.8)),
    tabTalents: line("M12 21.5V11", null, 2.6) + fill("M12 12C7 12 4 9 3.5 4.5 8.5 4.5 11.5 7 12 12z") + fill("M12 15.5c0-4 2.5-6.5 8-7-.3 4.8-3 7-8 7z"),
    tabPets: dot(12, 16, 5.2) + dot(5.6, 10.6, 2.5) + dot(9.6, 5.6, 2.5) + dot(14.4, 5.6, 2.5) + dot(18.4, 10.6, 2.5),
    tabQuests: '<rect x="4.5" y="3" width="15" height="18" rx="2.6" fill="none" stroke="currentColor" stroke-width="2.2"/>' +
      line("M7.8 9l1.4 1.4L11.6 8M7.8 15l1.4 1.4 2.4-2.4M14 9.5h2.6M14 15.5h2.6", null, 1.8)
  };

  PS.icon = function (name, extraClass) {
    return (
      '<svg class="ico' + (extraClass ? " " + extraClass : "") + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      (GLYPHS[name] || GLYPHS.xp) + "</svg>"
    );
  };

  /* ---------------------------------------------------------------- gear */

  function sword(blade, bladeLight, guard, grip, wide) {
    var w = wide || 4.5;
    return tilt(
      poly("24,2 " + (24 + w) + ",8 " + (24 + w) + ",30 " + (24 - w) + ",30 " + (24 - w) + ",8", blade) +
      box(23, 7, 2, 22, 1, bladeLight) +
      box(13, 30, 22, 4.6, 2.3, guard) +
      box(21.5, 34.6, 5, 8, 1.2, grip) +
      dot(24, 44.4, 3, guard)
    );
  }

  function bow(limb, limbDark, cord, head) {
    return group("rotate(-45 24 24)",
      line("M15 5Q40 24 15 43", limbDark, 5.4) + line("M15 5Q40 24 15 43", limb, 3) +
      line("M15 5V43", cord, 1.4) +
      line("M7 24H35", C.wood, 2.4) + poly("35,19.5 44,24 35,28.5", head) +
      line("M7 24l-3-3.5M7 24l-3 3.5", cord, 1.8)
    );
  }

  function staff(shaft, head) {
    return tilt(box(22.4, 15, 3.2, 30, 1.4, shaft) + head);
  }

  function spear(shaft, head, wrap) {
    return tilt(box(22.7, 12, 2.6, 34, 1.2, shaft) + head + box(21.3, 14, 5.4, 3.2, 1, wrap));
  }

  function dagger(blade, bladeLight, guard, grip, turn) {
    return group("rotate(" + turn + " 24 27)",
      poly("24,5 27.5,11 27.5,26 20.5,26 20.5,11", blade) + box(23.2, 9, 1.6, 16, 0.8, bladeLight) +
      box(17.5, 26, 13, 3.2, 1.4, guard) + box(22, 29.2, 4, 8, 1, grip) + dot(24, 38.6, 2.3, guard)
    );
  }

  function fang(turn) {
    return group("rotate(" + turn + " 24 27)",
      fill("M24 4Q32 13 27.5 26H20.5Q23 14 24 4z", C.violet) + fill("M24 8Q27.5 15 25.5 25H23.5Q24.5 15 24 8z", "#C9BEFF") +
      box(17.5, 26, 13, 3.2, 1.4, C.violetDark) + box(22, 29.2, 4, 8, 1, "#5B4B8A") + dot(24, 38.6, 2.3, C.violetDark)
    );
  }

  var BOOT = "M15 6H29V25L39 30Q43 32 43 37V40H13V28Q13 26 15 24Z";

  function boot(body, cuff, sole, extra) {
    return fill(BOOT, body) + box(11.5, 39, 33, 4.4, 2, sole) + box(13.5, 5, 17, 5.6, 2.4, cuff) + (extra || "");
  }

  function ringArt(band, bandDark, top) {
    return ring(24, 29, 12, bandDark, 6.4) + ring(24, 29, 12, band, 4) + top;
  }

  function amulet(pendant) {
    return line("M9 5Q24 34 39 5", "#6F654F", 2.2) + pendant;
  }

  var SPADE = "M12 2C9 6.5 3.5 9.5 3.5 14a4.3 4.3 0 0 0 7.2 3.2L9.5 22h5l-1.2-4.8A4.3 4.3 0 0 0 20.5 14C20.5 9.5 15 6.5 12 2z";

  function playingCard(x, turn, pip) {
    return group("rotate(" + turn + " " + (x + 10.5) + " 30)",
      box(x, 9.5, 21, 29, 3.2, C.white, 'stroke="#C9BFA4" stroke-width="1.4"') + pip);
  }

  /* eight wedges, black and white in turn, under a pointer */
  function wheelArt() {
    var out = dot(24, 26, 20.5, C.goldDark) + dot(24, 26, 19, C.gold);
    for (var i = 0; i < 8; i++) {
      var a0 = ((i * 45 - 90) * Math.PI) / 180;
      var a1 = (((i + 1) * 45 - 90) * Math.PI) / 180;
      out += fill(
        "M24 26L" + (24 + 17 * Math.cos(a0)).toFixed(2) + " " + (26 + 17 * Math.sin(a0)).toFixed(2) +
        "A17 17 0 0 1 " + (24 + 17 * Math.cos(a1)).toFixed(2) + " " + (26 + 17 * Math.sin(a1)).toFixed(2) + "z",
        i % 2 ? C.white : C.ink);
    }
    return out + dot(24, 26, 4, C.gold) + dot(24, 26, 1.7, C.goldDark) +
      poly("18.5,2.5 29.5,2.5 24,11", C.red, 'stroke="' + C.white + '" stroke-width="1.3" stroke-linejoin="round"');
  }

  var VEST = "M14 8 20 12H28L34 8 41 15 36 21V41H12V21L7 15Z";
  var PLATE = "M11 10Q24 3 37 10L39 29Q24 46 9 29Z";
  var DOME = "M8 31Q8 11 24 11Q40 11 40 31Z";

  var ART = {
    sling:
      line("M24 29 14.5 13M24 29 33.5 13", C.woodDark, 6.4) + line("M24 29 14.5 13M24 29 33.5 13", C.wood, 4) +
      box(21.6, 27, 4.8, 18, 2.2, C.woodDark) + box(22.4, 28, 3.2, 16, 1.4, C.wood) +
      line("M14.5 12Q24 27 33.5 12", C.ink, 1.6) + oval(24, 19.6, 3.4, 2.9, C.lemon, 'stroke="' + C.rind + '" stroke-width="1"'),

    blade: sword(C.steel, C.steelLight, C.gold, C.woodDark),

    bow: bow(C.leaf, C.leafDark, C.white, C.steel) +
      group("rotate(-45 24 24)", poly("24.5,10 29,7.5 27,12.5", C.leafDark) + poly("24.5,38 29,40.5 27,35.5", C.leafDark)),

    staff: staff(C.wood,
      line("M19 17Q16 9 21.5 4M29 17Q32 9 26.5 4", C.woodDark, 2.4) +
      dot(24, 9.5, 6.6, "#6FBF5A") + dot(24, 9.5, 5, "#9BE08A") + dot(22.2, 7.6, 1.7, C.white) +
      oval(29.6, 23, 4.4, 2.2, C.leaf, 'transform="rotate(-40 29.6 23)"')),

    spear: spear(C.wood, poly("24,0 29.5,9.5 24,15 18.5,9.5", C.steel) + poly("24,2.5 26.5,9.5 24,13", C.steelLight), C.gold),

    daggers: dagger(C.steel, C.steelLight, C.gold, C.woodDark, -32) + dagger(C.steel, C.steelLight, C.gold, C.woodDark, 32),

    hammer: tilt(
      box(22, 15, 4, 30, 1.6, C.wood) + box(10, 3, 28, 15, 3.4, C.steelDark) + box(10, 3, 28, 5, 2.4, C.steel) +
      box(22, 3, 4, 15, 0, "#737C8E") + box(21.2, 19, 5.6, 3, 1, C.woodDark)),

    rang:
      line("M7 31 24 12 41 31", C.goldDark, 10.5) + line("M7 31 24 12 41 31", C.rind, 8) + line("M9.5 29 24 15 38.5 29", C.lemon, 2.6) +
      dot(24, 14.6, 1.2, C.goldDark),

    storm: staff(C.slate,
      poly("24,0 31.5,9.5 24,19 16.5,9.5", "#5FA8F2") + poly("24,2.5 28.5,9.5 24,16.5", "#BFE0FF") +
      line("M32 3 28.5 9H32.5L28 16", "#FFE14A", 2.2) + box(21.2, 19, 5.6, 3, 1, "#39445C")),

    frost: bow(C.ice, C.iceDark, C.iceLight, "#BDEBFF") +
      group("rotate(-45 24 24)", poly(star(27.5, 24, 5, 2, 6), C.white, 'opacity="0.9"')),

    ember: spear("#7A2E1E",
      poly("24,-1 30.5,8 27.2,7 29.5,13 24,17.5 18.5,13 20.8,7 17.5,8", C.fire) +
      poly("24,4.5 27,10.5 24,14.5 21,10.5", C.ember), "#3A1611"),

    fangs: fang(-32) + fang(32),

    solstice: tilt(
      poly("24,-1 31.5,7 30.5,30 17.5,30 16.5,7", "#F2A31B") + poly("24,1.5 29,7.5 28.5,29 19.5,29 19,7.5", C.goldLight) +
      box(23, 6, 2, 23, 1, C.white) + box(10, 29.5, 28, 5.4, 2.7, "#F2A31B") +
      dot(24, 32.2, 5.4, "#F2A31B") + dot(24, 32.2, 3.6, C.ember) +
      box(21.5, 36.5, 5, 7, 1.2, "#7A4A1E") + dot(24, 45, 2.9, "#F2A31B")),

    eclipse: staff("#4A3F6B",
      line("M14.5 15.5A10.5 10.5 0 1 1 33.5 15.5", C.voidGlow, 3) +
      dot(24, 10, 7, C.void) + ring(24, 10, 7, C.voidGlow, 1.5) + dot(21.6, 7.6, 1.6, C.voidGlow) + box(21.2, 21, 5.6, 3, 1, "#2B2444")),

    cap:
      fill(DOME, C.leaf) + fill("M24 11Q40 11 40 31H24Z", C.leafDark, 'opacity="0.35"') + box(5, 29.5, 38, 6, 3, C.leafDark) +
      line("M24 12V7", C.leafDark, 2.2) + oval(29, 6.4, 6.4, 3.2, C.leafLight, 'transform="rotate(-28 29 6.4)"'),

    acorn:
      box(22.3, 3, 3.4, 9, 1.4, C.woodDark) + fill(DOME, C.wood) +
      line("M12 20 36 20M9.5 26H38.5M16 14l16 0M17 13l-5 18M24 11.5V31M31 13l5 18", C.woodDark, 1.5, 'opacity="0.7"') +
      box(6, 29.5, 36, 6, 3, C.woodDark) + fill("M17 35.5h14v6.5a7 7 0 0 1-14 0z", "#E6D2A8"),

    crown:
      poly("7,31 6,12 14.5,22 19,8 24,22 29,8 33.5,22 42,12 41,31", C.gold) +
      poly("7,31 6,12 14.5,22 19,8 24,22 24,31", C.goldLight, 'opacity="0.45"') +
      box(6.5, 30, 35, 9, 2.6, C.goldDark) + box(6.5, 30, 35, 3.2, 1.6, C.gold) +
      dot(14, 35.6, 2.3, C.red) + dot(24, 35.6, 2.3, C.red) + dot(34, 35.6, 2.3, C.red) +
      line("M6 12l-2.5-3M19 8V3.5M29 8V3.5M42 12l2.5-3", C.leafDark, 2.4),

    halo:
      oval(24, 17, 17.5, 7.5, "none", 'stroke="' + C.pale + '" stroke-width="9" opacity="0.55"') +
      oval(24, 17, 17.5, 7.5, "none", 'stroke="' + C.gold + '" stroke-width="5"') +
      oval(24, 17, 17.5, 7.5, "none", 'stroke="' + C.goldLight + '" stroke-width="2"') +
      poly(star(9, 35, 5, 1.8, 4), C.gold) + poly(star(38, 34, 4, 1.5, 4), C.gold) + poly(star(24, 40, 6, 2.2, 4), C.goldLight),

    bark:
      fill(VEST, "#8B6B45") + fill("M24 12H28L34 8 41 15 36 21V41H24Z", "#6F5334", 'opacity="0.5"') +
      line("M17 20v17M22 14v25M27 16v23M32 21v16", "#5A4229", 1.6, 'opacity="0.8"') + line("M20 12Q24 17 28 12", "#5A4229", 2),

    shell:
      fill(PLATE, "#B9A98A") + fill("M24 6.7Q31 7 37 10L39 29Q32 37 24 41Z", "#9A8A6C", 'opacity="0.55"') +
      line("M24 24m-8 0a8 8 0 1 1 8 8a5 5 0 1 1-5-5a2.5 2.5 0 1 1 2.5 2.5", "#75664A", 2.2),

    sunpeel:
      fill(VEST, C.gold) + fill("M24 12H28L34 8 41 15 36 21V41H24Z", C.goldDark, 'opacity="0.4"') +
      line("M12 26 22 41M12 33 17.5 41M15 20 29 41M20 13 36 37M27 13 36 27M36 26 26 41M36 33 30.5 41M33 20 19 41M28 13 12 37", "#B97F14", 1.3, 'opacity="0.75"') +
      line("M20 12Q24 17 28 12", C.white, 2.2),

    golden:
      fill(PLATE, "#F2A31B") + fill("M12.5 11.5Q24 6 35.5 11.5L37.2 28Q24 42.5 10.8 28Z", C.ember) +
      fill("M24 7.2Q30 8 35.5 11.5L37.2 28Q31 36 24 39.5Z", C.gold, 'opacity="0.6"') +
      oval(24, 23.5, 7.5, 6, C.lemon, 'stroke="#F2A31B" stroke-width="1.8"') + oval(21.6, 21.6, 2.4, 1.5, C.white, 'opacity="0.8"') +
      dot(14.5, 13.6, 2, C.white) + dot(33.5, 13.6, 2, C.white),

    mud: boot("#7A5A3A", "#9B7A55", "#4E3823", dot(22, 31, 2.4, "#5E442A") + dot(33, 35, 1.8, "#5E442A") + dot(18, 18, 1.6, "#5E442A")),

    hopper: boot("#7FB069", "#B9D694", "#4E7A3A",
      line("M5 40l3-4 3 4 3-4", "#4E7A3A", 2) + line("M18 14h8M18 19h8", "#4E7A3A", 1.8, 'opacity="0.7"')),

    wind: boot("#E3EEF9", "#9AD7FF", "#6C8FB5",
      fill("M15 22Q1 20 3 6Q8 13 15 12Z", C.white, 'stroke="#9AD7FF" stroke-width="1.5"') +
      fill("M15 26Q4 27 3 17Q9 21 15 19Z", C.white, 'stroke="#9AD7FF" stroke-width="1.5"') + line("M33 33l5 2", "#9AD7FF", 2)),

    twig: ringArt(C.wood, C.woodDark,
      line("M14 21l3 3M31 21l3-3M19 39l-2 3", C.woodDark, 2) + dot(24, 12, 6.2, C.leafDark) + dot(24, 12, 4.4, C.leaf) + dot(22.6, 10.6, 1.4, C.leafLight)),

    signet: ringArt(C.gold, C.goldDark,
      oval(24, 14, 10, 7.6, C.goldDark) + oval(24, 13.4, 8.6, 6.2, C.gold) + oval(24, 13.4, 4.2, 3.2, C.lemon, 'stroke="' + C.goldDark + '" stroke-width="1"')),

    zest: ringArt(C.gold, C.goldDark,
      poly("24,2 33,11 24,22 15,11", "#F2A31B") + poly("24,2 33,11 15,11", C.pale) + poly("24,11 28.5,11 24,22 19.5,11", C.ember) +
      poly(star(37, 6, 4, 1.4, 4), C.white) + poly(star(11, 20, 3, 1.1, 4), C.white)),

    pebble: amulet(oval(24, 31, 10, 8, "#8F8A82") + oval(24, 30.2, 9, 7, "#B5AFA6") + oval(21, 27.6, 3.2, 1.8, C.white, 'opacity="0.7"')),

    dew: amulet(
      fill("M24 18C30.5 26.5 34 30.5 34 35a10 10 0 0 1-20 0c0-4.5 3.5-8.5 10-17z", C.iceDark) +
      fill("M24 20.5C29.5 27.5 32.3 31 32.3 35a8.3 8.3 0 0 1-16.6 0c0-4 2.8-7.5 8.3-14.5z", C.ice) +
      oval(20.6, 33, 2, 3.4, C.white, 'opacity="0.8" transform="rotate(20 20.6 33)"')),

    heart: amulet(
      group("translate(24 32) scale(1.15) translate(-12 -12.5)", fill(HEART, C.goldDark)) +
      group("translate(24 32) scale(0.9) translate(-12 -12.5)", fill(HEART, "#5DB661")) +
      oval(20.4, 29, 2.4, 1.6, C.white, 'opacity="0.75" transform="rotate(-30 20.4 29)"')),


    /* more weapons and gear */
    whip:
      line("M13 41Q3 25 19 19Q33 14 37 4", C.woodDark, 5.6) + line("M13 41Q3 25 19 19Q33 14 37 4", "#8FAE65", 3.4) +
      box(9, 39, 8, 7, 2, C.woodDark) + box(10, 40, 6, 5, 1.4, C.wood) + poly("37,2 41,7 35,8", C.goldDark),

    cannon:
      group("rotate(-30 24 26)",
        box(5, 18, 33, 13, 4, C.slate) + box(34, 15, 9, 19, 3, "#39445C") + box(6, 20, 31, 3.4, 1.4, "#8D96A8", 'opacity="0.7"') +
        dot(12, 33, 6.5, C.woodDark) + dot(12, 33, 3, C.wood)) +
      dot(40, 9, 2.4, "#FFB84A") + dot(44, 16, 1.8, "#FFB84A") + dot(37, 4, 1.6, "#FFB84A"),

    mace: tilt(
      box(22.4, 18, 3.2, 28, 1.4, C.wood) + dot(24, 12, 10, C.steelDark) + dot(24, 12, 7.6, C.steel) +
      poly("24,-4 27,3 21,3", C.steelDark) + poly("13,3 19,6 15,10", C.steelDark) + poly("35,3 29,6 33,10", C.steelDark) +
      poly("14,18 20,16 18,21", C.steelDark) + poly("34,18 28,16 30,21", C.steelDark) + dot(21, 9, 2.4, C.white, 'opacity="0.8"')),

    flask:
      box(19, 3, 10, 6, 1.6, C.wood) + fill("M19 9H29V16L37 32Q40 43 30 44H18Q8 43 11 32L19 16Z", "#DDF4FF", 'opacity="0.85"') +
      fill("M15.4 29Q24 33 32.6 29L36 34Q38 42 30 43H18Q10 42 12 34Z", "#6FBF5A") + oval(24, 29.5, 8.4, 2.4, "#9BE08A") +
      dot(20, 37, 2, "#C8F2B0") + dot(28, 39, 1.4, "#C8F2B0") + oval(18, 22, 1.8, 5, C.white, 'opacity="0.7" transform="rotate(14 18 22)"'),

    comet: staff("#5C4A3A",
      poly("24,0 30,8 24,20 18,8", "#FFB84A") + dot(24, 9, 6.5, "#FFD166") + dot(22.4, 7.4, 2, C.white) +
      line("M33 1 41 -2M35 7 44 5", "#FFB84A", 2.2, 'opacity="0.8"') + box(21.2, 19, 5.6, 3, 1, "#3A2A10")),

    hive:
      fill("M7 32Q9 15 25 12L40 7Q43 25 31 37Q18 46 7 32z", "#E0A93B") + fill("M40 7Q43 25 31 37Q36 22 40 7z", "#B97F14", 'opacity="0.6"') +
      line("M16 17Q15 31 25 38M24 13Q23 28 30 35", "#3A2A10", 2.4, 'opacity="0.8"') +
      oval(41, 14, 4.2, 8.4, "#3A2A10", 'transform="rotate(-18 41 14)"') + oval(41, 14, 2.2, 6, "#FFD166", 'transform="rotate(-18 41 14)"') +
      dot(9, 36, 3.2, "#3A2A10"),

    thornlash:
      line("M13 41Q3 25 19 19Q33 14 37 4", "#3A2F52", 5.8) + line("M13 41Q3 25 19 19Q33 14 37 4", C.violet, 3.6) +
      poly("11,28 5,26 10,32", C.violetDark) + poly("19,17 17,11 23,15", C.violetDark) + poly("30,13 31,7 35,11", C.violetDark) +
      box(9, 39, 8, 7, 2, "#3A2F52") + box(10, 40, 6, 5, 1.4, "#5B4B8A") + poly("37,1 42,7 35,8", "#C9BEFF"),

    nova:
      poly(star(24, 24, 21, 8, 10), "#F2A31B") + poly(star(24, 24, 17, 7, 10, 0.15), "#FFD166") +
      dot(24, 24, 9, C.white) + dot(24, 24, 6, "#FFF4B8") + dot(24, 24, 3, "#F2B93B"),

    geyser:
      box(10, 38, 28, 6, 3, C.slate) + box(15, 33, 18, 7, 2.4, "#8D96A8") +
      fill("M24 34C20 26 21 16 24 6C27 16 28 26 24 34z", "#7FD4F5") + fill("M24 30C22 24 22.6 17 24 10C25.4 17 26 24 24 30z", "#DDF4FF") +
      line("M20 24Q12 20 9 11M28 24Q36 20 39 11", "#7FD4F5", 3) +
      dot(9, 9, 2.4, "#DDF4FF") + dot(39, 9, 2.4, "#DDF4FF") + dot(15, 6, 1.8, "#DDF4FF") + dot(33, 5, 1.8, "#DDF4FF"),

    warden:
      fill(DOME, "#4E7A3A") + fill("M24 11Q40 11 40 31H24Z", "#3A5C2B", 'opacity="0.45"') + box(5, 29.5, 38, 6, 3, "#3A5C2B") +
      oval(14, 11, 7, 3.4, C.leafLight, 'transform="rotate(-35 14 11)"') + oval(24, 7, 7, 3.4, C.leaf, 'transform="rotate(-90 24 7)"') +
      oval(34, 11, 7, 3.4, C.leafLight, 'transform="rotate(35 34 11)"') + poly("24,19 27,24 24,29 21,24", C.gold),

    thornmail:
      fill(VEST, "#6B5A4A") + fill("M24 12H28L34 8 41 15 36 21V41H24Z", "#4A3B2E", 'opacity="0.45"') +
      poly("9,16 4,13 8,21", "#CBD2DC") + poly("39,16 44,13 40,21", "#CBD2DC") + poly("14,41 12,46 19,42", "#CBD2DC") +
      poly("34,41 36,46 29,42", "#CBD2DC") + poly("24,40 21,46 27,46", "#CBD2DC") +
      line("M17 20v17M24 14v25M31 20v17", "#2E241B", 1.6, 'opacity="0.75"') + line("M20 12Q24 17 28 12", C.steelLight, 2),

    gale: boot("#B7E1F2", "#E3F6FF", "#4FA0C8",
      fill("M15 22Q0 19 2 5Q8 12 15 11Z", C.white, 'stroke="#7FD4F5" stroke-width="1.5"') +
      fill("M15 27Q3 29 2 18Q8 22 15 20Z", C.white, 'stroke="#7FD4F5" stroke-width="1.5"') +
      line("M31 30l6 2M33 35l5 1", "#7FD4F5", 2)),

    rindring: ringArt("#E0B93C", "#B97F14",
      poly("24,4 31,12 24,20 17,12", "#F7D94C") + poly("24,4 31,12 17,12", C.pale) + poly(star(37, 6, 4, 1.4, 4), C.white)),

    locket: amulet(
      oval(24, 32, 10, 11, "#5C6B8A") + oval(24, 31.4, 8.6, 9.6, "#8D96A8") + oval(24, 31.4, 5.4, 6.4, "#DDF4FF") +
      poly(star(24, 31.4, 4.6, 1.6, 4), "#F2B93B") + oval(20.4, 26.4, 2, 1.4, C.white, 'opacity="0.8"')),

    firstwind: boot("#FFFCF2", "#FFE08A", "#C98A1B",
      fill("M15 22Q-1 19 1 3Q8 11 15 10Z", "#FFE08A", 'stroke="#F2B93B" stroke-width="1.5"') +
      fill("M15 27Q2 30 1 17Q8 22 15 20Z", "#FFE08A", 'stroke="#F2B93B" stroke-width="1.5"') +
      poly(star(30, 22, 5, 1.8, 4), C.gold) + line("M33 34l6 2", "#F2B93B", 2)),

    evering: ringArt(C.gold, C.goldDark,
      poly(star(24, 12, 11, 4.2, 8), "#F2A31B") + dot(24, 12, 5.2, C.white) + dot(24, 12, 3, "#7FD4F5") +
      poly(star(39, 5, 4.5, 1.6, 4), C.white) + poly(star(9, 21, 3.4, 1.2, 4), C.white)),

    firstseed: amulet(
      fill("M24 20C34 22 38 31 33 39C29 44 19 44 15 39C10 31 14 22 24 20z", "#F2B93B") +
      fill("M24 23C31 25 34 31 30.5 37C28 40.5 20 40.5 17.5 37C14 31 17 25 24 23z", "#8FAE65") +
      line("M24 24V40", "#5F8244", 1.8) + oval(20, 29, 2.6, 1.6, C.white, 'opacity="0.7" transform="rotate(-30 20 29)"') +
      poly(star(36, 16, 4.4, 1.5, 4), C.white) + poly(star(11, 24, 3.2, 1.1, 4), C.white)),

    /* shop art */
    crate:
      box(7, 17, 34, 25, 3, C.woodDark) + box(8.6, 18.6, 30.8, 21.8, 2, C.wood) +
      line("M9 26H39M9 33.5H39", C.woodDark, 1.6, 'opacity="0.7"') + box(5, 11, 38, 9, 3, "#8B5E34") + box(5, 11, 38, 3.4, 1.7, "#B4875A") +
      box(21.5, 11, 5, 31, 1, C.steelDark) + dot(24, 26, 3.4, C.steel) + dot(24, 26, 1.4, C.ink),

    gilded:
      box(7, 19, 34, 23, 3, C.goldDark) + box(8.6, 20.6, 30.8, 19.8, 2, C.gold) +
      fill("M5 22V17Q5 7 24 7Q43 7 43 17V22Z", C.goldDark) + fill("M7 20.5V17Q7 9 24 9Q41 9 41 17V20.5Z", C.lemon) +
      box(12, 9.5, 3.4, 32, 1, C.goldDark, 'opacity="0.75"') + box(32.6, 9.5, 3.4, 32, 1, C.goldDark, 'opacity="0.75"') +
      box(20, 18, 8, 9.5, 2, C.goldDark) + dot(24, 22.6, 2.5, C.red) +
      poly(star(40.5, 7, 5, 1.7, 4), C.white) + poly(star(8, 12, 3.2, 1.1, 4), C.white),

    // the Enchantment Chest: night-dark wood and a glowing rune
    runechest:
      box(7, 19, 34, 23, 3, "#241A40") + box(8.6, 20.6, 30.8, 19.8, 2, "#433580") +
      fill("M5 22V17Q5 7 24 7Q43 7 43 17V22Z", "#241A40") + fill("M7 20.5V17Q7 9 24 9Q41 9 41 17V20.5Z", "#6A55C9") +
      box(12, 9.5, 3.4, 32, 1, "#C9A9FF", 'opacity="0.5"') + box(32.6, 9.5, 3.4, 32, 1, "#C9A9FF", 'opacity="0.5"') +
      box(19.5, 17.5, 9, 10.5, 2, "#1B1433") + poly(star(24, 22.8, 3.8, 1.4, 4), "#C6A6FF") + dot(24, 22.8, 1.2, "#FFFFFF") +
      poly(star(40.5, 7, 5, 1.7, 4), "#E8D9FF") + poly(star(8, 12, 3.2, 1.1, 4), "#E8D9FF") + poly(star(39, 33, 2.4, 0.9, 4), "#E8D9FF"),

    // an Enchantment Key: old gold, with a violet stone that keeps its secret
    enchkey:
      ring(15, 24, 8.5, "#B98A2A", 5) + ring(15, 24, 8.5, "#EAC45E", 3) + dot(15, 24, 3.8, "#7B5CFF") + dot(14, 22.8, 1.3, "#D8CCFF") +
      box(22, 21.8, 21, 4.6, 2, "#B98A2A") + box(22, 21.8, 21, 3, 1.5, "#EAC45E") +
      box(34, 25.6, 3.6, 6.4, 1, "#B98A2A") + box(39, 25.6, 3.6, 4.6, 1, "#B98A2A") +
      poly(star(37, 12, 3.6, 1.3, 4), "#D8C8FF") + poly(star(9, 37, 2.6, 1, 4), "#D8C8FF"),

    gift:
      box(8, 20, 32, 22, 3, "#6E9150") + box(9.6, 21.6, 28.8, 18.8, 2, C.leaf) + box(5.5, 13.5, 37, 9, 2.6, "#6E9150") + box(5.5, 13.5, 37, 3.4, 1.7, C.leafLight) +
      box(21, 13.5, 6, 28.5, 1, C.gold) +
      fill("M24 13.5C17 13.5 12 11 12 7.5S18 3.5 24 13.5C30 3.5 36 4 36 7.5S31 13.5 24 13.5z", C.gold) + dot(24, 12.6, 2.6, C.goldDark),

    gold:
      oval(24, 37, 15, 5.5, C.goldDark) + oval(24, 35, 15, 5.5, C.gold) + oval(24, 30, 15, 5.5, C.goldDark) + oval(24, 28, 15, 5.5, C.gold) +
      oval(24, 23, 15, 5.5, C.goldDark) + oval(24, 21, 15, 5.5, C.gold) + oval(24, 21, 9.5, 3, "none", 'stroke="' + C.goldLight + '" stroke-width="1.6"') +
      poly(star(38, 11, 4.5, 1.6, 4), C.white),

    /* the casino in the Shop */
    cards:
      playingCard(6, -14, group("translate(8.1 15.1) scale(0.7)", fill(HEART, C.red))) +
      playingCard(20, 11, group("translate(22.1 15.6) scale(0.7)", fill(SPADE, C.ink))),

    wheel: wheelArt(),

    /* the hero and the bosses, for the menus */
    lemon:
      '<defs><radialGradient id="lemonShade" cx="34%" cy="30%" r="78%"><stop offset="0" stop-color="#FFF6B0"/>' +
      '<stop offset="0.5" stop-color="#F7D94C"/><stop offset="1" stop-color="#D9A81E"/></radialGradient></defs>' +
      poly("5,28 1.4,28.6 5.4,30.4", C.rind) + poly("43,28 46.6,28.6 42.6,30.4", C.rind) +
      '<ellipse cx="24" cy="28" rx="17.2" ry="14.2" fill="url(#lemonShade)" stroke="' + C.rind + '" stroke-width="2.2"/>' +
      oval(17.5, 21.5, 5.4, 2.8, C.white, 'opacity="0.7" transform="rotate(-24 17.5 21.5)"') +
      fill("M24 14c0-5 4-8 9-8-1 5-4 8-9 8z", C.leaf) + line("M25 12.4Q28.4 9 31.6 7.6", C.leafDark, 1.3) +
      oval(13.6, 31.6, 2.8, 1.8, "#F08A6A", 'opacity="0.45"') + oval(34.4, 31.6, 2.8, 1.8, "#F08A6A", 'opacity="0.45"') +
      dot(19.4, 27.4, 3.1, C.white) + dot(28.6, 27.4, 3.1, C.white) + dot(19.8, 27.8, 1.9, C.ink) + dot(29, 27.8, 1.9, C.ink) +
      dot(19.2, 27, 0.7, C.white) + dot(28.4, 27, 0.7, C.white) +
      line("M21.2 33.4Q24 36 26.8 33.4", C.ink, 1.6),

    queen:
      dot(24, 27, 15.5, "#7FB069") + line("M19 14Q13 8 15 3M29 14Q35 8 33 3", "#4E7A3A", 2.4) +
      dot(18.5, 25, 2.3, C.ink) + dot(29.5, 25, 2.3, C.ink) + line("M14.5 20 21 22.5M33.5 20 27 22.5", C.ink, 2) +
      poly("15,14 13.5,5 19,9.5 24,3 29,9.5 34.5,5 33,14", C.gold, 'stroke="' + C.goldDark + '" stroke-width="1"'),

    hornet:
      oval(11, 18, 9, 4.6, C.white, 'opacity="0.55" transform="rotate(-28 11 18)"') + oval(37, 18, 9, 4.6, C.white, 'opacity="0.55" transform="rotate(28 37 18)"') +
      dot(24, 27, 14.5, "#E0A93B") + fill("M10.8 31h26.4a14.5 14.5 0 0 1-1.9 4.5H12.7A14.5 14.5 0 0 1 10.8 31z", "#3A2A10") +
      poly("24,47 20.5,40.5 27.5,40.5", "#3A2A10") +
      dot(18.5, 24, 2.3, C.ink) + dot(29.5, 24, 2.3, C.ink) + line("M14.5 19 21 21.5M33.5 19 27 21.5", C.ink, 2) +
      poly("15,14 13.5,5 19,9.5 24,3 29,9.5 34.5,5 33,14", C.gold, 'stroke="' + C.goldDark + '" stroke-width="1"'),

    slug:
      oval(22, 34, 19, 10, "#9C8AC2") + dot(29, 27, 12, "#9C8AC2") + line("M24 18 21 7M34 18 37 7", "#9C8AC2", 4.4) +
      dot(21, 6, 4, C.white) + dot(37, 6, 4, C.white) + dot(21.6, 6.4, 1.9, C.ink) + dot(37.6, 6.4, 1.9, C.ink) +
      line("M24.5 32Q29 35 33.5 32", C.ink, 1.8) + poly("22,19 21,12.5 25,15.5 29,11 33,15.5 37,12.5 36,19", C.gold, 'stroke="' + C.goldDark + '" stroke-width="1"'),

    mould: (function () {
      var fuzz = "";
      for (var i = 0; i < 12; i++) {
        var a = (i / 12) * Math.PI * 2;
        fuzz += dot((24 + Math.cos(a) * 13.5).toFixed(1), (28 + Math.sin(a) * 13.5).toFixed(1), 4.4, "#6FA8A0");
      }
      return fuzz + dot(24, 28, 14, "#6FA8A0") + dot(17, 34, 2, "#4E7F78") + dot(31.5, 32, 1.6, "#4E7F78") +
        dot(18.5, 25, 2.3, C.ink) + dot(29.5, 25, 2.3, C.ink) + line("M14.5 20 21 22.5M33.5 20 27 22.5", C.ink, 2) +
        poly("15,15 13.5,6 19,10.5 24,4 29,10.5 34.5,6 33,15", C.gold, 'stroke="' + C.goldDark + '" stroke-width="1"');
    })()
  };

  /* The armory's weapons (armory.js): one picture per attack style in the
     element's colours, with a badge for the element in the corner. */
  var STYLE_ART = {
    bolt: function (c) {
      return group("rotate(-35 24 24)",
        box(4, 19, 30, 10, 3.4, c.dark) + box(30, 20.5, 15, 7, 2.4, c.main) + box(7, 20.5, 25, 2.6, 1.3, c.light, 'opacity="0.7"') +
        box(9, 27, 7, 13, 2.4, c.dark) + dot(45, 24, 3.2, c.glow));
    },
    spread: function (c) {
      return group("rotate(-30 24 26)",
        box(2, 20, 13, 11, 3.4, c.dark) + poly("13,20.5 30,19 41,11 41,40 30,32 13,30.5", c.main) +
        poly("13,20.5 30,19 41,11 41,17 30,23 13,24", c.light, 'opacity="0.55"') + box(39, 10, 4, 31, 2, c.dark)) +
        dot(39, 5, 2.2, c.glow) + dot(44, 10, 1.8, c.glow) + dot(34, 2.5, 1.5, c.glow);
    },
    burst: function (c) {
      return line("M6 14Q2 23 6 32M42 14Q46 23 42 32", c.glow, 2.4, 'opacity="0.8"') +
        line("M10.5 17Q8.5 23 10.5 29M37.5 17Q39.5 23 37.5 29", c.glow, 2, 'opacity="0.6"') +
        ring(24, 6, 3, c.dark, 2.4) +
        fill("M24 8C15 8 14.5 19 14 28L10 34H38L34 28C33.5 19 33 8 24 8z", c.main) +
        fill("M24 8C19 8 17.5 15 17 26L15 33H20C20.5 22 21 12 24 8z", c.light, 'opacity="0.5"') +
        box(9, 33, 30, 4, 2, c.dark) + dot(24, 40, 3.6, c.dark);
    },
    homing: function (c) {
      return fill("M7 32Q9 15 25 12L40 7Q43 25 31 37Q18 46 7 32z", c.main) + fill("M40 7Q43 25 31 37Q36 22 40 7z", c.dark, 'opacity="0.55"') +
        line("M16 17Q15 31 25 38", c.light, 2.4, 'opacity="0.7"') +
        oval(41, 14, 4.2, 8.4, c.dark, 'transform="rotate(-18 41 14)"') + oval(41, 14, 2.2, 6, c.glow, 'transform="rotate(-18 41 14)"') +
        dot(9, 36, 3.2, c.dark) + dot(33, 4, 1.8, c.glow) + dot(25.5, 3.4, 2.2, c.glow) + dot(18, 6, 2.6, c.light);
    },
    slash: function (c) {
      return tilt(fill("M21 1Q34 12 28.5 30H19.5Q26 16 21 1z", c.main) + fill("M22 4Q30 13 26 29H24Q26.5 15 22 4z", c.light, 'opacity="0.8"') +
        box(13, 30, 22, 4.6, 2.3, c.dark) + box(21.5, 34.6, 5, 8, 1.2, C.woodDark) + dot(24, 44.4, 3, c.dark));
    },
    thrust: function (c) {
      return spear(c.dark, poly("24,-1 30,10 24,17 18,10", c.main) + poly("24,2 26.8,10 24,14.5", c.light) +
        poly("18,10 14,6.5 17.5,13.5", c.main) + poly("30,10 34,6.5 30.5,13.5", c.main), c.main);
    },
    slam: function (c) {
      return tilt(box(22, 15, 4, 30, 1.6, C.wood) + box(9, 2, 30, 16, 3.6, c.dark) + box(9, 2, 30, 5.4, 2.6, c.main) +
        box(12, 9, 24, 2.4, 1.2, c.light, 'opacity="0.6"') + box(21.2, 19, 5.6, 3, 1, c.dark));
    },
    lob: function (c) {
      return line("M33 9Q38 1 43 5", c.glow, 1.6, 'stroke-dasharray="2 3"') + dot(43, 7, 3.6, c.dark) + dot(42.2, 6, 1.4, c.light) +
        group("rotate(28 22 30)", box(14, 9, 16, 26, 4, c.dark) + box(12, 7, 20, 6, 3, c.main) + box(16, 13, 3, 20, 1.5, c.light, 'opacity="0.5"')) +
        box(6, 35, 32, 8, 3.4, C.woodDark) + dot(13, 43, 3.4, C.wood) + dot(31, 43, 3.4, C.wood);
    },
    chain: function (c) {
      return staff(c.dark, dot(24, 9.5, 7.6, c.glow, 'opacity="0.35"') + dot(24, 9.5, 5.6, c.main) + dot(22.4, 7.8, 1.8, C.white) +
        box(21.2, 16, 5.6, 3, 1, c.dark)) +
        line("M24 1 20.5 6.5H24.5L21 12", c.light, 2.2) + line("M45 17 41.5 22H45L42 27", c.light, 1.8);
    },
    boomerang: function (c) {
      var teeth = "";
      for (var i = 0; i < 8; i++) teeth += poly("24,2 29,9.5 21.5,8.5", c.dark, 'transform="rotate(' + i * 45 + ' 24 24)"');
      return teeth + ring(24, 24, 12.5, c.dark, 9) + ring(24, 24, 12.5, c.main, 6.4) + ring(24, 24, 12.5, c.light, 1.6, 'opacity="0.8"');
    },
    zone: function (c) {
      return box(11, 37, 4, 8, 1.5, c.dark) + box(33, 37, 4, 8, 1.5, c.dark) +
        fill("M8 19H40Q41.5 39 24 41Q6.5 39 8 19z", c.dark) + fill("M10 21H24V40Q10 38 10 21z", c.main, 'opacity="0.35"') +
        box(5, 16, 38, 6, 3, c.main) + oval(24, 17.5, 15, 2.6, c.light) +
        dot(18, 12, 3, c.glow) + dot(27, 8, 2.2, c.glow) + dot(31, 13, 1.8, c.glow) + dot(22, 4, 1.5, c.glow);
    },
    beam: function (c) {
      return line("M8 42 31 15", c.dark, 4.6) + line("M8 42 31 15", c.main, 2.4) +
        dot(34, 12, 10, c.glow, 'opacity="0.3"') + poly(star(34, 12, 8.5, 3, 4), c.light) + dot(34, 12, 2.6, C.white) +
        line("M40 20 45 25M38 4 41 1M26 6 22 3", c.glow, 1.8, 'opacity="0.8"');
    }
  };

  function elementBadge(el, c) {
    if (el === "plain") return "";
    var inner;
    if (el === "frost") inner = line("M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9", c.light, 3);
    else if (el === "shadow") inner = fill("M15.5 2.5a9.5 9.5 0 1 0 6 16.5A10 10 0 0 1 15.5 2.5z", c.light);
    else if (el === "radiant") inner = poly(star(12, 12, 10.5, 4.2, 4), c.light);
    else if (el === "briar") inner = poly(star(12, 12, 11, 5.4, 7), c.light) + dot(12, 12, 3.4, c.dark);
    else inner = fill(el === "fire" ? FLAME : el === "shock" ? BOLT : DROP, c.light);
    return dot(39.5, 39.5, 8.4, C.white) + dot(39.5, 39.5, 7, c.dark) + group("translate(33.5 33.5) scale(0.5)", inner);
  }

  (PS.ARMORY || []).forEach(function (w) {
    ART[w.id] = group("translate(24 24) scale(0.92) translate(-24 -24)", STYLE_ART[w.arch](w.colors)) + elementBadge(w.el, w.colors);
  });

  /* short strokes round a circle, each turned by `twist`: the wraps of a coil */
  function spokes(cx, cy, r0, r1, n, color, width, twist) {
    var d = "";
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      d += "M" + (cx + Math.cos(a) * r0).toFixed(1) + " " + (cy + Math.sin(a) * r0).toFixed(1) +
        "L" + (cx + Math.cos(a + twist) * r1).toFixed(1) + " " + (cy + Math.sin(a + twist) * r1).toFixed(1);
    }
    return line(d, color, width);
  }

  /* a closed loop whose radius wobbles k times round: one strand of a twist */
  function wobble(cx, cy, r, amp, k, phase) {
    var d = "";
    for (var i = 0; i <= 72; i++) {
      var a = (i / 72) * Math.PI * 2;
      var rr = r + amp * Math.sin(k * a + phase);
      d += (i ? "L" : "M") + (cx + Math.cos(a) * rr).toFixed(1) + " " + (cy + Math.sin(a) * rr).toFixed(1);
    }
    return d + "Z";
  }

  function halfShade(d, c) {
    return fill(d, c.dark, 'opacity="0.35"');
  }

  /* The armory's rings, amulets, helmets, armour and boots: one picture per
     kind, in the theme's colours (main, light, dark, glow). */
  var KIND_ART = {
    // rings
    band: function (c) {
      return ring(24, 27, 13, c.dark, 8) + ring(24, 27, 13, c.main, 5.4) + line("M13.5 20A13 13 0 0 1 22 14.2", c.light, 2, 'opacity="0.85"') +
        dot(24, 14, 1.6, c.glow) + dot(24, 40, 1.6, c.glow);
    },
    signet: function (c) {
      return ringArt(c.main, c.dark, box(15, 5, 18, 14, 4, c.dark) + box(16.5, 6.5, 15, 11, 3, c.main) + poly(star(24, 12, 4.5, 2, 5), c.light));
    },
    loop: function (c) {
      return ring(19, 29, 10, c.dark, 6) + ring(19, 29, 10, c.main, 3.6) + ring(29, 23, 10, c.dark, 6) + ring(29, 23, 10, c.main, 3.6) +
        line("M21 21A10 10 0 0 1 27.5 13.2", c.light, 1.4) + dot(29, 13, 3, c.glow);
    },
    coil: function (c) {
      return ringArt(c.main, c.dark, "") + spokes(24, 29, 9.5, 14.5, 10, c.light, 1.6, 0.4) + dot(24, 14, 3.6, c.glow);
    },
    knot: function (c) {
      var knot = "M24 12C20 6 14 6 14 12S20 18 24 12 28 6 34 12 28 18 24 12z";
      return ringArt(c.main, c.dark, line(knot, c.dark, 4.6) + line(knot, c.light, 2.2));
    },
    hoop: function (c) {
      return ring(24, 21, 15, c.dark, 4) + ring(24, 21, 15, c.main, 2.4) + line("M15 33v5M24 36v6M33 33v5", c.dark, 1.4) +
        dot(15, 39.5, 2.8, c.glow) + dot(24, 43.5, 3, c.light) + dot(33, 39.5, 2.8, c.glow);
    },
    seal: function (c) {
      return ringArt(c.main, c.dark, box(14, 3, 20, 16, 2, c.dark) + box(16, 5, 16, 12, 1.5, c.main) + box(19, 8, 10, 6, 1, c.light, 'opacity="0.75"'));
    },
    twist: function (c) {
      return ring(24, 27, 12.5, c.dark, 8) + fill(wobble(24, 27, 12.5, 2.2, 7, 0), "none", 'stroke="' + c.main + '" stroke-width="2.6"') +
        fill(wobble(24, 27, 12.5, 2.2, 7, Math.PI), "none", 'stroke="' + c.light + '" stroke-width="2.6"');
    },
    ringlet: function (c) {
      return ringArt(c.main, c.dark, dot(17, 15.5, 3, c.glow) + dot(24, 13, 3.8, c.light) + dot(31, 15.5, 3, c.glow));
    },
    spiral: function (c) {
      return ringArt(c.main, c.dark, dot(24, 11, 9, c.dark) +
        line("M24 11a1.5 1.5 0 0 1 3 0a3 3 0 0 1-6 0a4.5 4.5 0 0 1 9 0a6 6 0 0 1-12 0", c.glow, 1.8));
    },
    clasp: function (c) {
      return ringArt(c.main, c.dark, box(12, 7, 11, 11, 3, c.main) + box(25, 7, 11, 11, 3, c.main) + box(20, 8.5, 8, 8, 1.6, c.dark) +
        dot(24, 12.5, 2, c.glow) + line("M14 10h6M28 10h6", c.light, 1.2, 'opacity="0.7"'));
    },
    bangle: function (c) {
      var studs = "";
      for (var i = 0; i < 6; i++) {
        var a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        studs += dot((24 + Math.cos(a) * 17).toFixed(1), (26 + Math.sin(a) * 13).toFixed(1), 2, c.glow);
      }
      return oval(24, 26, 17, 13, "none", 'stroke="' + c.dark + '" stroke-width="9"') + oval(24, 26, 17, 13, "none", 'stroke="' + c.main + '" stroke-width="6"') +
        studs + line("M9 22Q12 14 20 13", c.light, 1.6, 'opacity="0.8"');
    },

    // amulets
    pendant: function (c) {
      return amulet(group("translate(24 31) scale(1.3) translate(-12 -12)", fill(DROP, c.dark)) +
        group("translate(24 31.6) scale(1.05) translate(-12 -12)", fill(DROP, c.main)) + oval(20.8, 33, 1.8, 3, c.light, 'opacity="0.8"'));
    },
    charm: function (c) {
      return amulet(line("M24 34 28 45", c.dark, 2.2) + dot(19.5, 29.5, 5, c.main) + dot(28.5, 29.5, 5, c.main) + dot(19.5, 37.5, 5, c.main) +
        dot(28.5, 37.5, 5, c.main) + dot(24, 33.5, 3, c.dark) + dot(18, 28, 1.5, c.light) + dot(27, 28, 1.5, c.light));
    },
    locket: function (c) {
      return amulet(oval(24, 32, 9.5, 11, c.dark) + oval(24, 31.5, 8, 9.5, c.main) + line("M24 22.5v18", c.dark, 1.2, 'opacity="0.6"') +
        dot(30.5, 31.5, 1.6, c.glow) + oval(20.5, 27.5, 2, 3, c.light, 'opacity="0.7"'));
    },
    talisman: function (c) {
      return amulet(group("rotate(45 24 32)", box(16.5, 24.5, 15, 15, 2.4, c.dark) + box(18.5, 26.5, 11, 11, 1.6, c.main)) +
        line("M24 26v12M20.5 30 24 33.5 27.5 30", c.light, 1.8));
    },
    medallion: function (c) {
      return amulet(dot(24, 32, 10.5, c.dark) + dot(24, 32, 8.6, c.main) + poly(star(24, 32, 6.5, 2.7, 5), c.light) + ring(24, 32, 8.6, c.glow, 0.9));
    },
    amulet: function (c) {
      return amulet(fill("M11 32Q24 19 37 32Q24 45 11 32z", c.main) + line("M11 32Q24 19 37 32Q24 45 11 32z", c.dark, 1.8) +
        dot(24, 32, 5.2, c.dark) + dot(24, 32, 2.8, c.glow) + dot(22.6, 30.6, 1, "#FFFCF2"));
    },
    totem: function (c) {
      return amulet(poly("17,24 24,18 31,24", c.dark) + box(17.5, 23, 13, 20, 3, c.dark) + box(19, 24.5, 10, 17, 2, c.main) +
        dot(21.6, 30, 1.7, c.dark) + dot(26.4, 30, 1.7, c.dark) + box(21, 34, 6, 2.2, 1, c.dark) + box(19, 38, 10, 1.6, 0.8, c.light));
    },
    token: function (c) {
      return amulet(dot(24, 32, 10, c.dark) + dot(24, 32, 8.4, c.main) + ring(24, 32, 6, c.light, 1.2, 'opacity="0.8"') + dot(24, 32, 2.8, c.dark) +
        dot(18.5, 27.5, 1.4, c.glow));
    },
    choker: function (c) {
      return line("M7 9Q24 26 41 9", c.dark, 5.6) + line("M7 9Q24 26 41 9", c.main, 3.4) + dot(14, 15, 1.6, c.light) + dot(34, 15, 1.6, c.light) +
        poly("24,18 30,25 24,34 18,25", c.dark) + poly("24,20 28,25 24,31.5 20,25", c.glow) + poly("24,20 28,25 20,25", c.light);
    },
    torc: function (c) {
      return line("M13 12Q7 33 24 35Q41 33 35 12", c.dark, 6.4) + line("M13 12Q7 33 24 35Q41 33 35 12", c.main, 4) +
        line("M13 12Q7 33 24 35Q41 33 35 12", c.light, 1.2, 'stroke-dasharray="2 3" opacity="0.8"') + dot(13, 11, 4, c.glow) + dot(35, 11, 4, c.glow);
    },
    relic: function (c) {
      return amulet(poly("24,19 30.5,27 27.5,44 20.5,44 17.5,27", c.dark) + poly("24,21.5 28.5,27.5 26,42 22,42 19.5,27.5", c.main) +
        poly("24,21.5 28.5,27.5 24,42", c.light, 'opacity="0.5"'));
    },
    emblem: function (c) {
      return amulet(dot(24, 21, 1.8, c.dark) + group("translate(24 33) scale(1) translate(-12 -12)", fill(SHIELD, c.dark)) +
        group("translate(24 33) scale(0.78) translate(-12 -12)", fill(SHIELD, c.main)) + line("M24 26v13M19 31h10", c.light, 2));
    },

    // helmets
    cap: function (c) {
      return fill(DOME, c.main) + halfShade("M24 11Q40 11 40 31H24Z", c) + box(5, 29.5, 38, 6, 3, c.dark) + line("M24 12V7", c.dark, 2.2) +
        dot(24, 6, 2.8, c.glow);
    },
    helm: function (c) {
      return fill("M9 32Q9 9 24 9Q39 9 39 32Z", c.main) + halfShade("M24 9Q39 9 39 32H24Z", c) + box(7, 30, 34, 6, 2.5, c.dark) +
        box(22, 14, 4, 25, 1.5, c.dark) + dot(13, 33, 1.5, c.light) + dot(35, 33, 1.5, c.light) + line("M14 15Q18 11 22 11", c.light, 1.6, 'opacity="0.7"');
    },
    hood: function (c) {
      return fill("M24 4Q40 14 40 41H8Q8 14 24 4z", c.main) + halfShade("M24 4Q40 14 40 41H24z", c) + oval(24, 28, 9.5, 10.5, c.dark) +
        dot(20.5, 28, 1.7, c.glow) + dot(27.5, 28, 1.7, c.glow);
    },
    crown: function (c) {
      return poly("7,34 6,14 15,23 19,10 24,23 29,10 33,23 42,14 41,34", c.main) + poly("7,34 6,14 15,23 19,10 24,23 24,34", c.light, 'opacity="0.35"') +
        box(6.5, 32, 35, 8, 2.6, c.dark) + dot(15, 36, 2.2, c.glow) + dot(24, 36, 2.4, c.light) + dot(33, 36, 2.2, c.glow) +
        dot(6, 13, 2, c.light) + dot(19, 9, 2, c.light) + dot(29, 9, 2, c.light) + dot(42, 13, 2, c.light);
    },
    circlet: function (c) {
      return oval(24, 27, 17, 8, "none", 'stroke="' + c.dark + '" stroke-width="5"') + oval(24, 27, 17, 8, "none", 'stroke="' + c.main + '" stroke-width="2.8"') +
        poly("24,27 30,35 24,43 18,35", c.dark) + poly("24,29.5 28,35 24,40.5 20,35", c.glow) + poly("24,29.5 28,35 20,35", c.light, 'opacity="0.6"');
    },
    visor: function (c) {
      return line("M24 9V3", c.dark, 3.4) + fill("M8 34Q8 9 24 9Q40 9 40 34Z", c.main) + halfShade("M24 9Q40 9 40 34H24Z", c) +
        box(11, 19, 26, 7, 3.5, c.dark) + line("M14 22.5H34", c.glow, 1.6) + box(6, 32, 36, 6, 2.5, c.dark);
    },
    bonnet: function (c) {
      return fill("M7 30Q7 7 24 7Q41 7 41 30Q41 37 34 37H14Q7 37 7 30z", c.main) + oval(24, 28, 11, 8, c.dark, 'opacity="0.3"') +
        line("M7 22Q24 15 41 22", c.light, 1.6, 'opacity="0.7"') + line("M13 36Q11 42 7 45M35 36Q37 42 41 45", c.glow, 2.4) + dot(24, 38, 3, c.glow);
    },
    mask: function (c) {
      return fill("M8 13Q24 5 40 13Q41 30 24 43Q7 30 8 13z", c.main) + halfShade("M24 9Q32 9 40 13Q41 30 24 43z", c) +
        fill("M12 20Q17 15 21.5 20Q17 24.5 12 20z", c.dark) + fill("M26.5 20Q31 15 36 20Q31 24.5 26.5 20z", c.dark) +
        dot(17, 20, 1.3, c.glow) + dot(31, 20, 1.3, c.glow) + line("M17 31l2.3 3 2.3-3 2.4 3 2.3-3 2.4 3 2.3-3", c.dark, 1.6) + line("M24 8v7", c.light, 2);
    },
    bandana: function (c) {
      return fill("M5 23Q24 13 42 23V31Q24 22 5 31z", c.main) + dot(13, 24, 1.3, c.light) + dot(20, 21, 1.3, c.light) + dot(27, 21, 1.3, c.light) +
        dot(34, 23, 1.3, c.light) + fill("M40 25L47 19L45.5 31z", c.dark) + fill("M40 28L46.5 36L38.5 34z", c.dark) + dot(41, 27, 3.2, c.main);
    },
    beret: function (c) {
      return group("rotate(-12 24 26)", oval(24, 26, 19, 9.5, c.main) + oval(24, 31, 15, 4.5, c.dark) + box(22.5, 13, 3, 5, 1.4, c.dark) +
        oval(17, 22, 6, 2.4, c.light, 'opacity="0.5"')) + dot(33, 21, 2.2, c.glow);
    },
    tricorne: function (c) {
      return poly("3,30 13,13 24,19 35,13 45,30 24,37", c.main) + poly("3,30 24,37 45,30 24,31", c.dark) +
        line("M3 30 13 13 24 19 35 13 45 30", c.glow, 1.6) + dot(24, 25, 2.8, c.light) + dot(24, 25, 1.3, c.dark);
    },
    halo: function (c) {
      return oval(24, 17, 17.5, 7.5, "none", 'stroke="' + c.glow + '" stroke-width="9" opacity="0.45"') +
        oval(24, 17, 17.5, 7.5, "none", 'stroke="' + c.main + '" stroke-width="5"') + oval(24, 17, 17.5, 7.5, "none", 'stroke="' + c.light + '" stroke-width="2"') +
        poly(star(10, 35, 5, 1.8, 4), c.main) + poly(star(37, 34, 4, 1.5, 4), c.main) + poly(star(24, 40, 6, 2.2, 4), c.light);
    },

    // armour
    vest: function (c) {
      return fill(VEST, c.main) + halfShade("M24 12H28L34 8 41 15 36 21V41H24Z", c) + line("M20 12Q24 17 28 12", c.light, 2) +
        line("M24 17V41", c.dark, 1.2, 'opacity="0.6"') + dot(21, 24, 1.5, c.glow) + dot(21, 31, 1.5, c.glow);
    },
    plate: function (c) {
      return fill(PLATE, c.main) + halfShade("M24 6.7Q31 7 37 10L39 29Q32 37 24 41Z", c) + oval(19, 19, 4.5, 6, c.light, 'opacity="0.55"') +
        dot(14, 12.5, 1.6, c.glow) + dot(34, 12.5, 1.6, c.glow);
    },
    mail: function (c) {
      var links = "";
      for (var y = 17; y <= 37; y += 4.5) {
        for (var x = 15.5; x <= 33; x += 4.4) links += ring(x.toFixed(1), y.toFixed(1), 1.7, c.main, 1.2);
      }
      return fill(VEST, c.dark) + links + line("M20 12Q24 17 28 12", c.light, 2.2);
    },
    coat: function (c) {
      return fill("M14 6 20 9H28L34 6 41 13 37 19V44H11V19L7 13Z", c.main) + halfShade("M24 10H28L34 6 41 13 37 19V44H24Z", c) +
        poly("20,9 24,17 28,9", c.dark) + line("M24 16V44", c.dark, 1.6) +
        dot(27, 21, 1.5, c.glow) + dot(27, 28, 1.5, c.glow) + dot(27, 35, 1.5, c.glow);
    },
    cloak: function (c) {
      return fill("M16 6H32L41 42Q24 46 7 42Z", c.main) + halfShade("M24 6H32L41 42Q32 44.5 24 45Z", c) +
        line("M16 6Q24 12 32 6", c.dark, 2.4) + line("M19 14 14 40M29 14 34 40", c.light, 1.2, 'opacity="0.5"') + dot(24, 9.5, 3.6, c.glow);
    },
    tunic: function (c) {
      return fill("M14 8 20 11H28L34 8 41 15 36 20 37 42H11L12 20 7 15Z", c.main) + halfShade("M24 11H28L34 8 41 15 36 20 37 42H24Z", c) +
        box(11.5, 27, 25, 4.5, 1.5, c.dark) + box(22, 26.5, 4, 5.5, 1, c.glow) + line("M20 11L24 17L28 11", c.light, 2);
    },
    jerkin: function (c) {
      return fill(VEST, c.main) + halfShade("M24 12H28L34 8 41 15 36 21V41H24Z", c) + line("M24 13V41", c.dark, 1.2) +
        line("M21 16l6 4M27 16l-6 4M21 23l6 4M27 23l-6 4M21 30l6 4M27 30l-6 4", c.light, 1.4) + box(12, 36, 24, 3, 1, c.dark, 'opacity="0.6"');
    },
    cuirass: function (c) {
      return fill(PLATE, c.main) + halfShade("M24 6.7Q31 7 37 10L39 29Q32 37 24 41Z", c) + line("M24 8V40", c.light, 2, 'opacity="0.7"') +
        dot(12.5, 14, 1.4, c.dark) + dot(12.5, 21, 1.4, c.dark) + dot(35.5, 14, 1.4, c.dark) + dot(35.5, 21, 1.4, c.dark) +
        line("M14 28Q24 34 34 28", c.glow, 1.6);
    },
    robe: function (c) {
      return fill("M17 6H31L35 16 41 44H7L13 16Z", c.main) + halfShade("M24 6H31L35 16 41 44H24Z", c) +
        poly("15,14 19,14 36,41 31.5,43", c.glow, 'opacity="0.85"') + line("M17 6Q24 14 31 6", c.dark, 2.2);
    },
    poncho: function (c) {
      return poly("24,6 45,30 24,40 3,30", c.main) + poly("24,6 45,30 24,40", c.dark, 'opacity="0.3"') +
        line("M9 27 24 34 39 27", c.light, 2.4) + line("M13 22.5 24 28 35 22.5", c.glow, 2.2) + oval(24, 10, 4.5, 3, c.dark) +
        line("M8 33v4M14 36v4M20 38.5v4M28 38.5v4M34 36v4M40 33v4", c.dark, 1.4);
    },
    apron: function (c) {
      return line("M19 7Q12 3 10 10M29 7Q36 3 38 10", c.dark, 1.6) + box(19, 6, 10, 9, 2, c.main) + fill("M15 14H33V42Q24 45 15 42Z", c.main) +
        halfShade("M24 14H33V42Q29 43.5 24 44Z", c) + line("M15 20H7M33 20H41", c.dark, 1.8) + box(19, 27, 10, 8, 1.5, c.dark, 'opacity="0.45"') +
        line("M17 17l2.5 2.5M31 17l-2.5 2.5M18 39l2-2M30 39l-2-2", c.glow, 1.6);
    },
    mantle: function (c) {
      return fill("M5 21Q7 8 24 8Q41 8 43 21L38 31Q24 25 10 31Z", c.main) + halfShade("M24 8Q41 8 43 21L38 31Q31 28 24 27.6Z", c) +
        line("M10 31Q14 27 17 29.5M17 29.5Q21 26 24 27.6M24 27.6Q27 26 31 29.5M31 29.5Q34 27 38 31", c.light, 1.6, 'opacity="0.7"') +
        box(18, 9, 12, 5, 2.5, c.dark) + dot(24, 15.5, 2.6, c.glow);
    },

    // boots
    boots: function (c) {
      return boot(c.main, c.light, c.dark, line("M18 14h8M18 19h8", c.dark, 1.6, 'opacity="0.6"') + dot(37, 33, 1.6, c.glow));
    },
    greaves: function (c) {
      return boot(c.main, c.light, c.dark, box(14, 12, 16, 4, 1.5, c.dark, 'opacity="0.6"') + box(14, 19, 16, 4, 1.5, c.dark, 'opacity="0.6"') +
        dot(17, 14, 1, c.glow) + dot(27, 14, 1, c.glow) + dot(17, 21, 1, c.glow) + dot(27, 21, 1, c.glow));
    },
    sandals: function (c) {
      return fill(BOOT, c.light, 'opacity="0.2"') + box(10, 38, 34, 5, 2.5, c.dark) +
        line("M16 14H28M20 14V27M15 38 21 28M27 38 21 28M24 38 35 31M33 38 39 32", c.main, 3) + dot(21, 28, 2.4, c.glow);
    },
    clogs: function (c) {
      return fill("M8 26Q8 18 20 18H32Q42 18 43 30V36H8Z", c.main) + fill("M8 26Q8 21 14 21V26z", c.dark) + box(6, 35, 38, 7, 3, c.dark) +
        oval(25, 22.5, 7, 2.4, c.light, 'opacity="0.6"') + dot(36, 27, 2, c.glow);
    },
    slippers: function (c) {
      return fill("M6 31Q6 22 18 22H32Q43 22 43 32V36H6Z", c.main) + halfShade("M24 22H32Q43 22 43 32V36H24Z", c) + box(5, 35, 39, 4.5, 2.2, c.dark) +
        dot(33, 22.5, 5.2, c.light) + dot(33, 22.5, 3, c.glow);
    },
    striders: function (c) {
      return boot(c.main, c.light, c.dark, fill("M15 20Q2 18 3 6Q8 12 15 12Z", c.glow, 'opacity="0.9"') + fill("M15 25Q4 26 3 17Q9 21 15 19Z", c.light) +
        line("M32 33l6 2", c.light, 2));
    },
    treads: function (c) {
      return boot(c.main, c.light, c.dark, box(11, 40, 34, 4.6, 1.5, c.dark) + line("M14 44.5v2.5M19 44.5v2.5M24 44.5v2.5M29 44.5v2.5M34 44.5v2.5M39 44.5v2.5", c.dark, 2.4) +
        fill(FLAME, c.glow, 'transform="translate(6 30) scale(0.42)"'));
    },
    wraps: function (c) {
      return fill(BOOT, c.light) + line("M15 10H29M15 15H29M15 20H29M16 26 30 30M20 32 41 34", c.main, 2.6) + box(11.5, 39, 33, 4.4, 2, c.dark) +
        line("M29 8l4-4", c.main, 2);
    },
    sabatons: function (c) {
      return boot(c.main, c.light, c.dark, line("M15 12H29M15 18H29M15 24H29M22 28 27 37M30 30 33 38M36 32 38 39", c.dark, 1.6, 'opacity="0.7"') +
        dot(22, 9, 1.2, c.glow) + dot(22, 15, 1.2, c.glow) + dot(22, 21, 1.2, c.glow));
    },
    moccasins: function (c) {
      return fill("M7 31Q7 23 16 23H30Q42 23 43 33V36H7Z", c.main) + halfShade("M24 23H30Q42 23 43 33V36H24Z", c) +
        line("M12 27Q24 21 37 28", c.light, 1.4, 'stroke-dasharray="2 2"') + box(6, 35, 38, 4, 2, c.dark) +
        dot(17, 24.5, 1.6, c.glow) + dot(21, 23.8, 1.6, c.glow) + dot(25, 23.8, 1.6, c.glow);
    },
    stompers: function (c) {
      return fill("M12 4H31V24L41 28Q45 30 45 36V40H10V26Q10 24 12 22Z", c.main) + halfShade("M24 4H31V24L41 28Q45 30 45 36V40H24Z", c) +
        box(10, 3, 23, 6, 2.5, c.dark) + box(8, 38, 39, 8, 3, c.dark) + line("M15 12l9 4M15 17l9 4M24 12l-9 4M24 17l-9 4", c.light, 1.4) +
        poly("11,46 13,42 15,46", c.glow) + poly("26,46 28,42 30,46", c.glow) + poly("40,46 42,42 44,46", c.glow);
    },
    waders: function (c) {
      return fill("M15 1H29V25L39 30Q43 32 43 37V40H13V28Q13 26 15 24Z", c.main) + halfShade("M22 1H29V25L39 30Q43 32 43 37V40H22Z", c) +
        box(13, 1, 18, 5, 2, c.light) + box(11.5, 39, 33, 4.4, 2, c.dark) + line("M18 9V24", c.light, 1.4, 'opacity="0.5"') +
        dot(26, 3.5, 1.4, c.glow);
    }
  };

  (PS.GEAR || []).forEach(function (g) {
    ART[g.id] = group("translate(24 24) scale(0.92) translate(-24 -24)", KIND_ART[g.kind](g.colors)) + elementBadge(g.theme, g.colors);
  });

  /* A boss picture for a chapter: the body of its fighting kind in the
     chapter's own colours, with that chapter's pattern and extra part. */
  PS.bossArt = function (n) {
    var ch = PS.chapter(n);
    var L = ch.look;
    var kind = ch.boss;
    var cx = 24;
    var cy = 27;
    var behind = "";
    var front = "";
    var i;

    switch (L.feature) {
      case 0:
        behind = line("M17 16Q8 14 11 3", L.dark, 3.4) + line("M31 16Q40 14 37 3", L.dark, 3.4);
        break;
      case 1:
        for (i = 0; i < 10; i++) {
          var a = (i / 10) * Math.PI * 2;
          var pts = [-0.17, 0, 0.17].map(function (d, k) {
            var rr = k === 1 ? 20 : 14;
            return (cx + Math.cos(a + d) * rr).toFixed(1) + "," + (cy + Math.sin(a + d) * rr).toFixed(1);
          });
          behind += poly(pts.join(" "), L.dark);
        }
        break;
      case 2:
        behind = oval(8, 22, 7.5, 4, L.accent, 'opacity="0.6" transform="rotate(-30 8 22)"') +
          oval(40, 22, 7.5, 4, L.accent, 'opacity="0.6" transform="rotate(30 40 22)"');
        break;
      case 3:
        behind = line("M34 35Q46 38 44 26", L.dark, 3.2) + dot(44, 25, 3, L.dark);
        break;
      case 4:
        behind = line("M15 36 10 44M20.5 40 18 46.5M27.5 40 30 46.5M33 36 38 44", L.dark, 2.8);
        break;
      case 5:
        behind = line("M20 14 16 4M28 14 32 4", L.dark, 2) + dot(16, 4, 2.4, L.accent) + dot(32, 4, 2.4, L.accent);
        break;
      case 6:
        front += poly("24,14.5 27.4,19 24,23.5 20.6,19", L.accent, 'stroke="' + L.dark + '" stroke-width="1"');
        break;
      case 7:
        front += line("M12.5 23Q24 11 35.5 23", L.accent, 2.6) + line("M14.5 28Q24 18.5 33.5 28", L.accent, 2.4);
        break;
    }

    var pattern = "";
    switch (L.pattern) {
      case 1:
        pattern = box(8, 22, 32, 3, 0, L.dark, 'opacity="0.38"') + box(8, 29, 32, 3, 0, L.dark, 'opacity="0.38"');
        break;
      case 2:
        pattern = dot(18.5, 23.5, 2.3, L.dark, 'opacity="0.38"') + dot(30, 21.5, 1.9, L.dark, 'opacity="0.38"') +
          dot(24, 31, 2.5, L.dark, 'opacity="0.38"') + dot(31.5, 30, 1.7, L.dark, 'opacity="0.38"') + dot(16.5, 32, 1.6, L.dark, 'opacity="0.38"');
        break;
      case 3:
        pattern = oval(24, 37, 11, 7, L.accent, 'opacity="0.6"');
        break;
      case 4:
        pattern = line("M9 29 15 24 21 29 27 24 33 29 39 24", L.dark, 2.2, 'opacity="0.45"');
        break;
    }
    var clip = "bossclip" + n;
    var patterned = pattern
      ? '<clipPath id="' + clip + '"><circle cx="24" cy="27" r="14"/></clipPath><g clip-path="url(#' + clip + ')">' + pattern + "</g>"
      : "";

    var body;
    var face;
    var crown = poly("15,14 13.5,5 19,9.5 24,3 29,9.5 34.5,5 33,14", C.gold, 'stroke="' + C.goldDark + '" stroke-width="1"');
    var eyes = dot(18.5, 25, 3.4, C.white) + dot(29.5, 25, 3.4, C.white) + dot(19, 25.4, 2.1, C.ink) + dot(30, 25.4, 2.1, C.ink) +
      dot(18.4, 24.6, 0.8, C.white) + dot(29.4, 24.6, 0.8, C.white) + line("M13.5 19.6 21.5 22.8M34.5 19.6 26.5 22.8", C.ink, 2.2);
    if (kind === "queen") {
      body = dot(24, 27, 15.5, L.body) + line("M19 14Q13 8 15 3M29 14Q35 8 33 3", L.dark, 2.4);
      face = eyes + crown;
    } else if (kind === "hornet") {
      body = oval(11, 18, 9, 4.6, C.white, 'opacity="0.55" transform="rotate(-28 11 18)"') +
        oval(37, 18, 9, 4.6, C.white, 'opacity="0.55" transform="rotate(28 37 18)"') +
        dot(24, 27, 14.5, L.body) + fill("M10.8 31h26.4a14.5 14.5 0 0 1-1.9 4.5H12.7A14.5 14.5 0 0 1 10.8 31z", L.dark) +
        poly("24,47 20.5,40.5 27.5,40.5", L.dark);
      face = dot(18.5, 24, 3.4, C.white) + dot(29.5, 24, 3.4, C.white) + dot(19, 24.4, 2.1, C.ink) + dot(30, 24.4, 2.1, C.ink) +
        dot(18.4, 23.6, 0.8, C.white) + dot(29.4, 23.6, 0.8, C.white) + line("M13.5 18.6 21.5 21.8M34.5 18.6 26.5 21.8", C.ink, 2.2) + crown;
    } else if (kind === "slug") {
      body = oval(22, 34, 19, 10, L.body) + dot(29, 27, 12, L.body) + line("M24 18 21 7M34 18 37 7", L.body, 4.4) +
        dot(21, 6, 4, C.white) + dot(37, 6, 4, C.white);
      face = dot(21.6, 6.4, 1.9, C.ink) + dot(37.6, 6.4, 1.9, C.ink) + line("M24.5 32Q29 35 33.5 32", C.ink, 1.8) +
        poly("22,19 21,12.5 25,15.5 29,11 33,15.5 37,12.5 36,19", C.gold, 'stroke="' + C.goldDark + '" stroke-width="1"');
    } else if (kind === "beetle") {
      // six legs, a horn to one side, a shell split down the middle
      body = line("M11 25 4 22M10 31 3 32M12 37 6 42M37 25 44 22M38 31 45 32M36 37 42 42", L.dark, 2.6) +
        fill("M31 17Q37 9 44 8Q38 13 35.5 19Z", L.dark) +
        dot(24, 28, 14.5, L.body) + line("M24 16V42.5", L.dark, 1.8, 'opacity="0.6"') +
        oval(18, 30, 2.6, 6.4, C.white, 'opacity="0.18"') + oval(30, 30, 2.6, 6.4, C.white, 'opacity="0.18"');
      face = eyes + crown;
    } else if (kind === "spider") {
      // eight jointed legs, a round abdomen below, six red eyes and fangs
      body = line("M14 24 7 15 2 21M13 28 4 24 1 31M14 32 6 34 3 41M17 35 11 41 10 46M34 24 41 15 46 21M35 28 44 24 47 31M34 32 42 34 45 41M31 35 37 41 38 46", L.dark, 2) +
        dot(24, 38, 9.5, L.body) + poly("21,34.5 27,34.5 21,41.5 27,41.5", L.accent, 'opacity="0.8"') + dot(24, 26, 12.5, L.body);
      face = dot(19.5, 24, 2.3, "#E5484D") + dot(28.5, 24, 2.3, "#E5484D") + dot(21.6, 20.4, 1.6, "#E5484D") + dot(26.4, 20.4, 1.6, "#E5484D") +
        dot(16.8, 27.6, 1.4, "#E5484D") + dot(31.2, 27.6, 1.4, "#E5484D") + dot(19, 23.4, 0.7, C.white) + dot(28, 23.4, 0.7, C.white) +
        poly("20.5,31 22.2,36 23.4,31", "#2A1A14") + poly("27.5,31 25.8,36 24.6,31", "#2A1A14") + crown;
    } else if (kind === "worm") {
      // a segmented body curling away behind a round head with hooked jaws
      body = dot(8, 41, 5, L.dark) + dot(13, 38.5, 6.4, L.body) + dot(19, 36, 7.6, L.dark) +
        line("M18 38Q15 44 20 46M30 38Q33 44 28 46", "#2A1A14", 2.6) +
        dot(24, 27, 13.5, L.body) + line("M13 23Q24 17 35 23M14.5 31Q24 26 33.5 31", L.dark, 1.6, 'opacity="0.45"');
      face = eyes + crown;
    } else if (kind === "moth") {
      // four broad wings with eye-spots, a fuzzy body and feathery feelers
      body = oval(11, 21, 11, 8, L.accent, 'transform="rotate(-25 11 21)"') + oval(37, 21, 11, 8, L.accent, 'transform="rotate(25 37 21)"') +
        oval(12, 35, 7.5, 5, L.accent, 'opacity="0.9" transform="rotate(30 12 35)"') + oval(36, 35, 7.5, 5, L.accent, 'opacity="0.9" transform="rotate(-30 36 35)"') +
        dot(8.5, 19.5, 3.2, L.dark) + dot(39.5, 19.5, 3.2, L.dark) + dot(8.5, 19.5, 1.5, L.body) + dot(39.5, 19.5, 1.5, L.body) +
        line("M21 16Q17 8 12 5M27 16Q31 8 36 5M15 9.5 13.5 11M17.5 12 15.5 13.5M33 9.5 34.5 11M30.5 12 32.5 13.5", L.dark, 1.4) +
        dot(24, 27, 11.5, L.body);
      face = eyes + crown;
    } else if (kind === "fly") {
      // glassy wings, a striped body and two huge red eyes
      body = oval(11, 17, 10, 5, C.white, 'opacity="0.55" transform="rotate(-28 11 17)"') + oval(37, 17, 10, 5, C.white, 'opacity="0.55" transform="rotate(28 37 17)"') +
        dot(24, 28, 13.5, L.body) + line("M11.5 33H36.5M13.5 38H34.5", L.dark, 2.6, 'opacity="0.6"');
      face = oval(18, 24.5, 5.4, 6.2, "#C8453E") + oval(30, 24.5, 5.4, 6.2, "#C8453E") +
        dot(16.6, 22.4, 1.2, C.white, 'opacity="0.8"') + dot(28.6, 22.4, 1.2, C.white, 'opacity="0.8"') +
        dot(19, 26, 0.7, C.white, 'opacity="0.4"') + dot(31, 26, 0.7, C.white, 'opacity="0.4"') +
        line("M24 32V39", "#2A1A14", 1.8) + crown;
    } else {
      var fuzz = "";
      for (i = 0; i < 12; i++) {
        var b = (i / 12) * Math.PI * 2;
        fuzz += dot((24 + Math.cos(b) * 13.5).toFixed(1), (28 + Math.sin(b) * 13.5).toFixed(1), 4.4, L.body);
      }
      body = fuzz + dot(24, 28, 14, L.body) + dot(17, 34, 2, L.dark) + dot(31.5, 32, 1.6, L.dark);
      face = eyes + poly("15,15 13.5,6 19,10.5 24,4 29,10.5 34.5,6 33,15", C.gold, 'stroke="' + C.goldDark + '" stroke-width="1"');
    }
    // a lit side, a shaded edge and a glint, so the body is round
    var cyBody = kind === "mould" ? 28 : 27;
    var shade =
      '<defs><radialGradient id="bossShade' + n + '" cx="34%" cy="30%" r="80%"><stop offset="0" stop-color="#fff" stop-opacity="0.38"/>' +
      '<stop offset="0.55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.3"/></radialGradient></defs>' +
      '<circle cx="24" cy="' + cyBody + '" r="14.4" fill="url(#bossShade' + n + ')"/>' +
      oval(18, cyBody - 8, 4.6, 2.4, C.white, 'opacity="0.55" transform="rotate(-30 18 ' + (cyBody - 8) + ')"');
    return (
      '<svg class="art" viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
      behind + body + shade + patterned + front + face + "</svg>"
    );
  };

  /* ---------------------------------------------------------------- pets */

  /* a pair of eyes: white, a pupil and a glint */
  function pEyes(lx, ly, rx, ry, size) {
    var s = size || 3;
    return (
      dot(lx, ly, s, C.white) + dot(rx, ry, s, C.white) +
      dot(lx + 0.5, ly + 0.5, s * 0.62, C.ink) + dot(rx + 0.5, ry + 0.5, s * 0.62, C.ink) +
      dot(lx - 0.4, ly - 0.5, s * 0.22, C.white) + dot(rx - 0.4, ry - 0.5, s * 0.22, C.white)
    );
  }

  var PET_ART = {
    bumble:
      oval(11, 20, 9.5, 5.2, C.white, 'opacity="0.65" transform="rotate(-28 11 20)"') + oval(37, 20, 9.5, 5.2, C.white, 'opacity="0.65" transform="rotate(28 37 20)"') +
      line("M6 16 14 21M42 16 34 21", "#DDF4FF", 1, 'opacity="0.9"') +
      oval(24, 29, 13.5, 11.5, "#F2B93B") + oval(24, 25.5, 9, 5, "#FFE08A", 'opacity="0.7"') +
      line("M13 27Q24 32 35 27M14.5 33Q24 38 33.5 33", "#3A2A10", 3.6) + poly("24,46 20.5,39.5 27.5,39.5", "#3A2A10") +
      line("M19 18 15 9M29 18 33 9", "#3A2A10", 1.8) + dot(15, 8.4, 2.2, "#FFE14A") + dot(33, 8.4, 2.2, "#FFE14A") +
      box(13.5, 21, 21, 6.4, 3.2, "#2B3A55", 'opacity="0.9"') + oval(19, 24.2, 4.4, 2.8, "#7FD4F5") + oval(29, 24.2, 4.4, 2.8, "#7FD4F5") +
      oval(17.6, 23.4, 1.4, 0.9, C.white, 'opacity="0.9"') + oval(27.6, 23.4, 1.4, 0.9, C.white, 'opacity="0.9"') +
      line("M21 30Q24 32.4 27 30", C.ink, 1.5),
    ladybug:
      line("M9 33 4 39M15 36 12 43M33 36 36 43M39 33 44 39", C.ink, 2.2) +
      fill("M7 32Q7 9 24 9Q41 9 41 32Z", "#E5484D") + fill("M24 9Q41 9 41 32H24Z", "#B72C31", 'opacity="0.5"') +
      line("M24 9V32", C.ink, 2.2) + dot(15, 20, 3.4, C.ink) + dot(33, 20, 3.4, C.ink) + dot(19, 28, 2.6, C.ink) + dot(29, 28, 2.6, C.ink) +
      box(6, 31, 36, 4.4, 2.2, "#3A1113") + dot(24, 11.5, 6.8, C.ink) + dot(19.6, 10.4, 2.4, C.white) + dot(28.4, 10.4, 2.4, C.white) +
      dot(20, 10.8, 1.2, C.ink) + dot(28.8, 10.8, 1.2, C.ink) + line("M20 6 15 1M28 6 33 1", C.ink, 1.7) +
      poly("24,14 27,16.5 24,18.6 21,16.5", "#FFB1C0") + oval(17, 6, 3.6, 2.2, "#FFB1C0", 'transform="rotate(-25 17 6)"') +
      oval(31, 6, 3.6, 2.2, "#FFB1C0", 'transform="rotate(25 31 6)"') + oval(14, 14, 3.4, 1.8, C.white, 'opacity="0.55" transform="rotate(-35 14 14)"'),
    snail:
      oval(22, 37, 18, 6.2, "#E3D2B0") + oval(20, 35.5, 12, 3, "#F2E6CB", 'opacity="0.8"') +
      line("M9 34Q4 24 8 15M15 33Q12 22 16 14", "#E3D2B0", 3.6) + pEyes(8, 14.4, 16, 13.4, 2.8) +
      dot(29, 25, 12.5, "#8F7A55") + dot(29, 25, 10.6, "#B9A98A") +
      line("M29 25m-6.4 0a6.4 6.4 0 1 1 6.4 6.4a3.2 3.2 0 1 1-3.2-3.2", "#6F5F3E", 2.2) +
      poly("22,18 18,9 26,15", "#7FD4F5") + poly("30,14 29,4 35,13", "#9BE0FF") + poly("37,17 42,10 41,20", "#7FD4F5") +
      oval(24.6, 19, 3.2, 1.8, C.white, 'opacity="0.6" transform="rotate(-30 24.6 19)"') + line("M10 18Q12 20 14 18", C.ink, 1.3),
    ant:
      line("M13 31 9 40M20 32 19 42M30 30 31 41M36 28 41 37M16 28 10 35M26 28 27 38", "#3A2616", 2) +
      dot(11, 30, 6.8, "#4A3320") + dot(22.5, 28, 5.2, "#6F4A2A") + dot(36, 26, 8, "#4A3320") +
      oval(33.4, 22.6, 3.2, 1.8, "#8F6A44", 'opacity="0.8" transform="rotate(-30 33.4 22.6)"') +
      line("M38 18 42 9M42 21 47 13", "#3A2616", 1.8) + dot(42, 8.6, 1.8, "#3A2616") + dot(47, 12.4, 1.8, "#3A2616") +
      box(32.5, 22.4, 12, 5.6, 2.8, "#1B1630") + oval(36, 25.2, 3.4, 2.2, "#3A4A78") + oval(42, 25.2, 3.4, 2.2, "#3A4A78") +
      oval(35, 24.4, 1.2, 0.7, C.white, 'opacity="0.8"') + line("M36.5 30Q39 31.8 41.5 30", C.white, 1.4),
    moth:
      fill("M24 25Q5 6 2 22Q3 40 24 33Z", "#D8CDB4") + fill("M24 25Q43 6 46 22Q45 40 24 33Z", "#D8CDB4") +
      fill("M24 25Q13 15 8 23Q10 31 24 31Z", "#A99C7C", 'opacity="0.6"') + fill("M24 25Q35 15 40 23Q38 31 24 31Z", "#A99C7C", 'opacity="0.6"') +
      dot(12, 22, 3.8, "#6F654F") + dot(12, 22, 2.2, C.white) + dot(12, 22, 1, C.ink) +
      dot(36, 22, 3.8, "#6F654F") + dot(36, 22, 2.2, C.white) + dot(36, 22, 1, C.ink) +
      oval(24, 28, 4.6, 11, "#8F826A") + oval(24, 26, 3, 6, "#C9BEA6", 'opacity="0.8"') + dot(24, 17, 4.6, "#6F654F") +
      dot(22.2, 16.4, 1.5, C.white) + dot(25.8, 16.4, 1.5, C.white) + dot(22.4, 16.6, 0.8, C.ink) + dot(26, 16.6, 0.8, C.ink) +
      line("M22 13Q18 7 13 7M26 13Q30 7 35 7", "#6F654F", 1.6) + dot(12.6, 6.8, 1.4, "#FFE08A") + dot(35.4, 6.8, 1.4, "#FFE08A"),
    firefly:
      oval(10.5, 19, 9, 4.8, C.white, 'opacity="0.55" transform="rotate(-25 10.5 19)"') + oval(37.5, 19, 9, 4.8, C.white, 'opacity="0.55" transform="rotate(25 37.5 19)"') +
      dot(24, 36, 13, "#FFE14A", 'opacity="0.28"') + dot(24, 36, 9, "#FFE14A", 'opacity="0.5"') + dot(24, 36, 6.4, "#FFF08A") + dot(24, 36, 3.4, C.white) +
      oval(24, 24, 7.6, 10, "#4A3A2A") + oval(24, 21.5, 4.6, 5, "#6F5A3E", 'opacity="0.7"') + dot(24, 13.4, 5.6, "#3A2A1E") +
      pEyes(21.6, 12.8, 26.4, 12.8, 2.2) + line("M21.5 9 18 3M26.5 9 30 3", "#3A2A1E", 1.5) + dot(17.6, 2.6, 1.5, "#FFE14A") + dot(30.4, 2.6, 1.5, "#FFE14A") +
      poly(star(8, 36, 3.4, 1.2, 4), "#FFF08A") + poly(star(40, 33, 2.8, 1, 4), "#FFF08A"),
    cricket:
      line("M13 31 5 41 13 45M20 33 17 45", "#3E6B2E", 3) + line("M32 31 38 40", "#3E6B2E", 2.4) +
      oval(21, 27, 15, 8, "#7AD260") + oval(20, 24.4, 11, 3.6, "#A8E88E", 'opacity="0.7"') + dot(36, 24, 7, "#7AD260") +
      fill("M9 22Q21 14 33 24Q21 29 9 22z", "#4E8C38", 'opacity="0.65"') + line("M30 17 20 3M34 18 43 5", "#3E6B2E", 1.5) +
      dot(37.6, 22.4, 2.6, C.white) + dot(38.2, 22.6, 1.5, C.ink) + dot(37.4, 21.8, 0.6, C.white) +
      poly("30,18 44,22 42,15", "#E5484D") + line("M40 27Q42 29 44 27", C.ink, 1.3),
    beetle:
      line("M10 37 4 44M18 38 15 46M30 38 33 46M38 37 44 44", "#161F4A", 2.4) +
      fill("M7 33Q7 9 24 9Q41 9 41 33Z", "#5A72C8") + fill("M24 9Q41 9 41 33H24Z", "#33448A", 'opacity="0.55"') + line("M24 9V33", "#161F4A", 2) +
      line("M11 27Q24 22 37 27", "#161F4A", 1.6, 'opacity="0.7"') + oval(16, 17, 4.4, 2.2, C.white, 'opacity="0.6" transform="rotate(-30 16 17)"') +
      box(6, 32, 36, 4.4, 2.2, "#161F4A") + dot(24, 11, 5.6, "#161F4A") + pEyes(21.6, 10.4, 26.4, 10.4, 2) +
      poly("24,-1 28,8 20,8", "#B9C6FF") + poly("24,1 26.5,7.5 21.5,7.5", C.white, 'opacity="0.7"') +
      poly("24,18 27,21.5 24,25 21,21.5", "#FFD166", 'stroke="#161F4A" stroke-width="1"'),
    egg:
      oval(24, 27, 14.5, 18, "#F4EBD4", 'stroke="#C9BEA6" stroke-width="2"') + fill("M24 9Q39 11 38.5 29Q35 44 24 45Q30 30 24 9z", "#C9BEA6", 'opacity="0.35"') +
      oval(18.6, 18.4, 4.2, 6.6, C.white, 'opacity="0.75" transform="rotate(20 18.6 18.4)"') +
      dot(17, 32, 2.4, "#C9BEA6") + dot(30, 24, 2.2, "#C9BEA6") + dot(26, 36, 2.6, "#C9BEA6") + dot(31, 32, 1.5, "#C9BEA6") + dot(19, 26, 1.5, "#C9BEA6") +
      poly(star(37, 9, 4, 1.4, 4), "#FFE08A")
  };

  /** A pet's picture on a disc in its rarity's colour. `r` can be left out.
   *  Better rarities glow more: Uncommon a soft aura, Rare sparkles, Epic a
   *  halo as well. */
  PS.petArt = function (sp, r) {
    var ring = r === undefined ? "#CDBF9C" : PS.RARITY[r].color;
    var level = r === undefined || sp === "egg" ? 0 : r;
    var extra = "";
    if (level >= 1) extra += dot(24, 24, 24, ring, 'opacity="0.16"');
    if (level >= 2) {
      extra += poly(star(8, 11, 3.6, 1.2, 4), C.white) + poly(star(41, 14, 3, 1, 4), C.white) + poly(star(40, 39, 2.6, 0.9, 4), C.white);
    }
    var halo = level >= 3
      ? oval(24, 8.5, 10.5, 3, "none", 'stroke="#FFE08A" stroke-width="2.2"') + oval(24, 8.5, 10.5, 3, "none", 'stroke="' + ring + '" stroke-width="0.9" opacity="0.9"')
      : "";
    var gloss =
      sp === "egg"
        ? ""
        : '<defs><radialGradient id="petShade" cx="34%" cy="28%" r="85%"><stop offset="0" stop-color="#fff" stop-opacity="0.32"/>' +
          '<stop offset="0.55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.22"/></radialGradient></defs>' +
          '<circle cx="24" cy="26" r="15" fill="url(#petShade)"/>';
    return (
      '<svg class="art" viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
      dot(24, 24, 22, ring, 'opacity="0.2"') + extra + '<circle cx="24" cy="24" r="21.5" fill="none" stroke="' + ring + '" stroke-width="' + (level >= 2 ? 2.6 : 2) + '"/>' +
      (PET_ART[sp] || PET_ART.egg) + gloss + halo + "</svg>"
    );
  };

  PS.art = function (name, extraClass) {
    return (
      '<svg class="art' + (extraClass ? " " + extraClass : "") + '" viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
      (ART[name] || ART.lemon) + "</svg>"
    );
  };

  PS.itemIcon = function (id) {
    return PS.art(id);
  };
})();
