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
    startUp: line("M5 12.5l7-7 7 7M5 19.5l7-7 7 7", null, 2.8),
    skull: fill("M12 2.5c-5 0-8.5 3.4-8.5 7.8 0 2.7 1.3 4.8 3.3 6.1V19c0 .8.7 1.5 1.5 1.5h7.4c.8 0 1.5-.7 1.5-1.5v-2.6c2-1.3 3.3-3.4 3.3-6.1 0-4.4-3.5-7.8-8.5-7.8zM8.6 9a2.3 2.3 0 1 1 0 4.6A2.3 2.3 0 0 1 8.6 9zm6.8 0a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6zM11 16h2v2.5h-2z", null, 'fill-rule="evenodd"'),
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
    gift: box(4, 11.6, 7, 9.4, 1.2) + box(13, 11.6, 7, 9.4, 1.2) + box(2.8, 6.8, 8.2, 3.6, 1) + box(13, 6.8, 8.2, 3.6, 1) +
      line("M12 6.5C9 6.5 7 5.5 7 4s2.5-2 5 2.5C14.5 2 17 2.5 17 4s-2 2.5-5 2.5", null, 1.8),
    /* the five tabs */
    tabShop: fill("M5 8h14l1.4 11.5A1.5 1.5 0 0 1 18.9 21H5.1a1.5 1.5 0 0 1-1.5-1.5z") + line("M8.5 10V7a3.5 3.5 0 0 1 7 0v3", null, 2.2),
    tabGear: fill("M12 3c-5 0-8.5 3.8-8.5 8.5V18h5.8v-5h5.4v5h5.8v-6.5C20.5 6.8 17 3 12 3zM10.9 4.4h2.2v6.2h-2.2z", null, 'fill-rule="evenodd"'),
    tabBattle: group("rotate(45 12 12)", fill("M12 0 14.2 3v11.5H9.8V3z") + box(6.8, 14.5, 10.4, 2.3, 1) + box(10.7, 16.8, 2.6, 4.6, 0.8)) +
      group("rotate(-45 12 12)", fill("M12 0 14.2 3v11.5H9.8V3z") + box(6.8, 14.5, 10.4, 2.3, 1) + box(10.7, 16.8, 2.6, 4.6, 0.8)),
    tabTalents: line("M12 21.5V11", null, 2.6) + fill("M12 12C7 12 4 9 3.5 4.5 8.5 4.5 11.5 7 12 12z") + fill("M12 15.5c0-4 2.5-6.5 8-7-.3 4.8-3 7-8 7z"),
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

    gift:
      box(8, 20, 32, 22, 3, "#6E9150") + box(9.6, 21.6, 28.8, 18.8, 2, C.leaf) + box(5.5, 13.5, 37, 9, 2.6, "#6E9150") + box(5.5, 13.5, 37, 3.4, 1.7, C.leafLight) +
      box(21, 13.5, 6, 28.5, 1, C.gold) +
      fill("M24 13.5C17 13.5 12 11 12 7.5S18 3.5 24 13.5C30 3.5 36 4 36 7.5S31 13.5 24 13.5z", C.gold) + dot(24, 12.6, 2.6, C.goldDark),

    gold:
      oval(24, 37, 15, 5.5, C.goldDark) + oval(24, 35, 15, 5.5, C.gold) + oval(24, 30, 15, 5.5, C.goldDark) + oval(24, 28, 15, 5.5, C.gold) +
      oval(24, 23, 15, 5.5, C.goldDark) + oval(24, 21, 15, 5.5, C.gold) + oval(24, 21, 9.5, 3, "none", 'stroke="' + C.goldLight + '" stroke-width="1.6"') +
      poly(star(38, 11, 4.5, 1.6, 4), C.white),

    /* the hero and the bosses, for the menus */
    lemon:
      oval(24, 28, 17, 14, C.lemon, 'stroke="' + C.rind + '" stroke-width="2.4"') + oval(18, 22.6, 5, 3, C.pale, 'opacity="0.85"') +
      fill("M24 14c0-5 4-8 9-8-1 5-4 8-9 8z", C.leaf) + dot(19.5, 28, 2.1, C.ink) + dot(28.5, 28, 2.1, C.ink) +
      line("M21 33.5Q24 35.5 27 33.5", C.ink, 1.6),

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
