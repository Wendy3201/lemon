/*!
 * Pip Survivors — dev panel for battles
 * The DEV button in a battle opens this: cheats (godmode, one-hit kills, game
 * speed), taking any upgrade by hand, and run controls. Only shown once the
 * developer password has been entered (see PS.dev in core.js). The battle
 * stands still while the panel is open.
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function () {
  "use strict";

  var PS = window.PS;
  var B = PS.B;

  var TABS = [["cheats", "Cheats"], ["upgrades", "Upgrades"], ["run", "Run"]];
  var SPEEDS = [0.5, 1, 2, 4];

  var el = null;
  var tab = "cheats";

  function run() {
    return B.run;
  }

  function toggle(key, label, hint) {
    var on = PS.dev.cheats[key];
    return (
      '<button class="devbox__toggle' + (on ? " is-on" : "") + '" type="button" data-dev="toggle" data-key="' + key + '" aria-pressed="' + on + '">' +
        "<b>" + label + "</b><span>" + hint + "</span><i>" + (on ? "ON" : "OFF") + "</i>" +
      "</button>"
    );
  }

  function action(name, label, extra) {
    return '<button class="btn btn--sm" type="button" data-dev="' + name + '"' + (extra || "") + ">" + label + "</button>";
  }

  function cheatsTab(R) {
    return (
      '<div class="devbox__toggles">' +
        toggle("god", "Godmode", "Nothing can hurt you") +
        toggle("oneHit", "One-hit kills", "Every hit kills, bosses too") +
      "</div>" +
      '<p class="devbox__label">Game speed</p>' +
      '<div class="devbox__row">' + SPEEDS.map(function (s) {
        return '<button class="btn btn--sm' + (PS.dev.cheats.speed === s ? " btn--primary" : "") + '" type="button" data-dev="speed" data-value="' + s + '">' + s + "×</button>";
      }).join("") + "</div>" +
      '<p class="devbox__label">You</p>' +
      '<div class="devbox__row">' +
        action("heal", "Heal fully") +
        action("revive", "+1 Second Wind") +
        action("rerolls", "+10 rerolls") +
      "</div>" +
      '<p class="devbox__label">Levels <small>(currently ' + R.p.level + ")</small></p>" +
      '<div class="devbox__row">' +
        action("levels", "+1 level", ' data-value="1"') +
        action("levels", "+5", ' data-value="5"') +
        action("levels", "+10", ' data-value="10"') +
      "</div>"
    );
  }

  function upgradesTab(R) {
    var choosing = Boolean(R.choices);
    var rows = B.UPGRADES.map(function (up) {
      var have = R.p.up[up.id] || 0;
      var full = have >= up.max;
      var name = typeof up.name === "function" ? up.name(have + 1, R) : up.name;
      var text = typeof up.text === "function" ? up.text(have + 1, R) : up.text;
      return (
        '<li class="devup' + (full ? " is-full" : "") + '" style="--tier:' + B.UP_TIERS[up.tier].color + '">' +
          '<span class="devup__icon">' + PS.icon(up.icon) + "</span>" +
          '<span class="devup__body"><b>' + PS.esc(name) + ' <em>' + have + "/" + up.max + "</em></b><small>" + PS.esc(text) + "</small></span>" +
          '<button class="btn btn--sm" type="button" data-dev="up" data-id="' + up.id + '"' + (full ? " disabled" : "") + ">" + (choosing ? "Pick" : "+1") + "</button>" +
          '<button class="btn btn--sm" type="button" data-dev="up-max" data-id="' + up.id + '"' + (full ? " disabled" : "") + ">Max</button>" +
        "</li>"
      );
    }).join("");
    return (
      '<div class="devbox__row">' + action("up-all", "Max every upgrade") + "</div>" +
      '<p class="hint">' + (choosing
        ? "Level-up cards are open: Pick takes that upgrade and counts as your choice. Max does not use up the level-up."
        : "Take any upgrade for free. Max every upgrade leaves out Glass Lemon, which makes you weaker.") + "</p>" +
      '<ul class="devbox__ups">' + rows + "</ul>"
    );
  }

  function runTab(R) {
    var normal = R.mode !== "swarm";
    return (
      '<div class="devbox__row">' +
        action("kill-all", "Kill every pest") +
        action("coins", "+100 coins") +
        (normal && R.phase === "swarm" ? action("boss", "Skip to the boss") : "") +
      "</div>" +
      '<div class="devbox__row">' +
        action("win", "Win this battle") +
        action("lose", "End as a loss") +
      "</div>" +
      '<p class="hint">Chapter ' + R.ch.n + " · " + PS.esc(R.ch.name) + " · " + PS.clock(R.t) + " · " + R.kills + " kills" +
        (normal ? "" : " · swarm mode") + "</p>"
    );
  }

  function render() {
    var R = run();
    if (!el || !R) return;
    var body = tab === "upgrades" ? upgradesTab(R) : tab === "run" ? runTab(R) : cheatsTab(R);
    var scroll = el.querySelector(".devbox__body");
    var top = scroll ? scroll.scrollTop : 0;
    el.innerHTML =
      '<div class="panel devbox">' +
        '<div class="devbox__head"><h2>Dev menu</h2>' +
          '<button class="btn btn--primary btn--sm" type="button" data-dev="close">Back to the battle</button></div>' +
        '<div class="devbox__tabs" role="tablist">' + TABS.map(function (t) {
          return '<button class="devbox__tab' + (tab === t[0] ? " is-active" : "") + '" type="button" role="tab" aria-selected="' + (tab === t[0]) + '" data-dev="tab" data-value="' + t[0] + '">' + t[1] + "</button>";
        }).join("") + "</div>" +
        '<div class="devbox__body">' + body + "</div>" +
      "</div>";
    el.querySelector(".devbox__body").scrollTop = top;
  }

  function takeUpgrade(id, toMax) {
    var R = run();
    var up = B.upgrade(id);
    var have = R.p.up[id] || 0;
    var times = toMax ? up.max - have : 1;
    for (var i = 0; i < times && (R.p.up[id] || 0) < up.max; i++) B.takeUpgrade({ id: id });
    if (!toMax) B.devResolve();
  }

  var ACTIONS = {
    close: function () { B.devPanel.close(); },
    tab: function (R, node) { tab = node.getAttribute("data-value"); },
    toggle: function (R, node) {
      var key = node.getAttribute("data-key");
      PS.dev.cheats[key] = !PS.dev.cheats[key];
    },
    speed: function (R, node) { PS.dev.cheats.speed = Number(node.getAttribute("data-value")); },
    heal: function (R) {
      R.p.hp = R.p.maxHp;
      R.p.barrier = R.p.barrierMax;
    },
    revive: function (R) { R.p.revives += 1; },
    rerolls: function (R) { R.p.rerolls += 10; },
    levels: function (R, node) {
      // enough experience for N levels in a row; the cards come up once the panel is closed
      var p = R.p;
      var n = Number(node.getAttribute("data-value"));
      var need = p.need - p.xp;
      for (var k = 1; k < n; k++) need += B.xpNeeded(p.level + k);
      p.xp += need;
    },
    up: function (R, node) { takeUpgrade(node.getAttribute("data-id"), false); },
    "up-max": function (R, node) { takeUpgrade(node.getAttribute("data-id"), true); },
    "up-all": function (R) {
      B.UPGRADES.forEach(function (up) {
        if (up.id === "glass" || (up.needs && !up.needs(R))) return;
        takeUpgrade(up.id, true);
      });
    },
    "kill-all": function (R) {
      R.enemies.slice().forEach(function (e) {
        if (!e.dead && !e.boss) B.hit(e, e.hp + 1, { dot: true });
      });
    },
    coins: function (R) { R.coins += R.coinValue * 100; },
    boss: function (R) { R.t = R.dur; },
    win: function () {
      B.devPanel.close();
      B.win();
    },
    lose: function () {
      B.devPanel.close();
      B.giveUp();
    }
  };

  function onClick(e) {
    var node = e.target.closest("[data-dev]");
    if (!node || node.disabled || !run()) return;
    var name = node.getAttribute("data-dev");
    var fn = ACTIONS[name];
    if (!fn) return;
    PS.sfx.play("click");
    fn(run(), node);
    if (run() && run().devOpen) render();
  }

  B.devPanel = {
    mount: function (root) {
      el = document.createElement("div");
      el.className = "sheet devsheet";
      el.hidden = true;
      root.appendChild(el);
      el.addEventListener("click", onClick);
    },
    open: function () {
      var R = run();
      if (!R || R.done || !PS.dev.unlocked) return;
      R.devOpen = true;
      el.hidden = false;
      render();
    },
    close: function () {
      var R = run();
      if (R) R.devOpen = false;
      if (el) el.hidden = true;
    }
  };

  /* a finished or abandoned battle must not leave the panel hanging around */
  PS.on("battle:end", function () { B.devPanel.close(); });
})();
