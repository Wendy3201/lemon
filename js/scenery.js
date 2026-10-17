/*!
 * Pip Survivors — the menu backdrop
 * A little orchard behind the menus: a sun (or the moon and stars at night),
 * clouds drifting past, two rows of hills, lemon trees that sway, and petals
 * (or fireflies at night) floating down. It is plain markup and inline SVG;
 * style.css does the colours and the movement, and stops the movement when
 * animations are turned off.
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function () {
  "use strict";

  var PS = window.PS;

  /* where the trees stand along the bottom: left %, size, which hill row */
  var TREES = [
    { x: 3, s: 1.15, row: "near" }, { x: 15, s: 0.8, row: "far" }, { x: 24, s: 0.95, row: "near" },
    { x: 37, s: 0.7, row: "far" }, { x: 63, s: 0.75, row: "far" }, { x: 74, s: 1.05, row: "near" },
    { x: 86, s: 0.8, row: "far" }, { x: 93, s: 1.2, row: "near" }
  ];

  function cloud() {
    return (
      '<svg viewBox="0 0 200 80"><path d="M30 64c-16 0-24-11-20-22s15-14 24-10c3-14 15-24 31-22 12 1 21 9 24 19 7-9 21-12 31-5 9 6 11 15 9 22 14-1 25 7 25 18H30z"/></svg>'
    );
  }

  function tree(seed) {
    // a few lemons dotted in the canopy, in slightly different places per tree
    var lemons = "";
    var spots = [[34, 34], [62, 30], [48, 50], [26, 54], [70, 52], [52, 22]];
    for (var i = 0; i < 4; i++) {
      var s = spots[(seed + i * 2) % spots.length];
      lemons += '<ellipse class="tree__fruit" cx="' + s[0] + '" cy="' + s[1] + '" rx="4.2" ry="3.4"/>';
    }
    return (
      '<svg viewBox="0 0 100 120">' +
        '<path class="tree__trunk" d="M45 118c2-18 1-34-4-52l9 0c3 16 4 34 6 52z"/>' +
        '<g class="tree__crown">' +
          '<circle cx="50" cy="40" r="30"/><circle cx="28" cy="50" r="20"/><circle cx="72" cy="48" r="21"/>' +
          '<circle cx="40" cy="22" r="18"/><circle cx="62" cy="24" r="17"/>' +
        "</g>" +
        '<circle class="tree__shine" cx="40" cy="26" r="9"/>' +
        lemons +
      "</svg>"
    );
  }

  function build() {
    var floaters = "";
    for (var i = 0; i < 12; i++) {
      // spread across the width, each with its own speed, sway and start
      floaters +=
        '<i style="--x:' + ((i * 37 + 7) % 100) + "%;--d:" + (14 + (i * 7) % 12) + "s;--w:" + (6 + (i * 5) % 9) + "vw;--delay:-" + ((i * 3.7) % 20).toFixed(1) + 's"></i>';
    }
    // far trees stand on the far hills, near ones in front of the near hills
    function row(name) {
      return TREES.map(function (t, i) {
        if (t.row !== name) return "";
        return '<div class="tree tree--' + t.row + '" style="left:' + t.x + "%;--s:" + t.s + ";--sway:" + (5 + (i % 4)) + 's">' + tree(i) + "</div>";
      }).join("");
    }
    return (
      '<div class="scenery__sky">' +
        '<div class="scenery__sun"></div>' +
        '<div class="scenery__stars"></div>' +
        '<div class="scenery__cloud scenery__cloud--1">' + cloud() + "</div>" +
        '<div class="scenery__cloud scenery__cloud--2">' + cloud() + "</div>" +
        '<div class="scenery__cloud scenery__cloud--3">' + cloud() + "</div>" +
      "</div>" +
      '<svg class="scenery__hills scenery__hills--far" viewBox="0 0 1200 220" preserveAspectRatio="none">' +
        '<path d="M0 120C120 70 240 60 360 90s240 60 360 20 260-80 480-40V220H0z"/></svg>' +
      '<div class="scenery__trees">' + row("far") + "</div>" +
      '<svg class="scenery__hills scenery__hills--near" viewBox="0 0 1200 220" preserveAspectRatio="none">' +
        '<path d="M0 150c160-50 300-60 460-30s300 50 450 10 220-40 290-30V220H0z"/></svg>' +
      '<div class="scenery__trees">' + row("near") + "</div>" +
      '<div class="scenery__float">' + floaters + "</div>"
    );
  }

  PS.scenery = {
    mount: function () {
      if (document.querySelector(".scenery")) return;
      var el = document.createElement("div");
      el.className = "scenery";
      el.setAttribute("aria-hidden", "true");
      el.innerHTML = build();
      document.body.insertBefore(el, document.body.firstChild);
    }
  };
})();
