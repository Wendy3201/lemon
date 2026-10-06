/*!
 * Pip Survivors — battle HUD
 * The bars and counters over the battle, the level-up cards and the pause
 * panel. Plain DOM on top of the canvas, so text stays sharp at any size.
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function () {
  "use strict";

  var PS = window.PS;
  var B = PS.B;

  var el = {};
  var shown = {}; // what is on screen now, so the DOM is only touched on a change
  var openedAt = 0;
  var quitArmed = false;

  var MARKUP =
    '<div class="hud">' +
      '<div class="hud__xp"><i></i></div>' +
      '<div class="hud__top">' +
        '<button class="hud__btn" type="button" data-hud="pause" aria-label="Pause">' + PS.icon("pause") + "</button>" +
        '<div class="hud__hp" role="img" aria-label="Health"><i class="hud__hp-fill"></i><i class="hud__hp-shield"></i><span></span></div>' +
        '<span class="hud__pill hud__lvl"></span>' +
        '<span class="hud__gap"></span>' +
        '<span class="hud__pill hud__time"></span>' +
        '<span class="hud__pill hud__kills"></span>' +
        '<span class="hud__pill hud__coins"></span>' +
      '</div>' +
      '<div class="hud__boss" hidden><span></span><div><i></i></div></div>' +
      '<div class="hud__toast" role="status" aria-live="polite"></div>' +
      '<div class="hud__build"></div>' +
    '</div>' +
    '<div class="sheet" data-panel="choose" hidden>' +
      '<div class="choose">' +
        '<p class="choose__title"></p>' +
        '<div class="choose__cards"></div>' +
        '<button class="btn btn--sm choose__reroll" type="button" data-hud="reroll"></button>' +
      '</div>' +
    '</div>' +
    '<div class="sheet" data-panel="pause" hidden>' +
      '<div class="panel pausebox">' +
        '<h2>Paused</h2>' +
        '<p class="pausebox__where"></p>' +
        '<div class="pausebox__build"></div>' +
        '<div class="pausebox__actions">' +
          '<button class="btn" type="button" data-hud="quit">Give up</button>' +
          '<button class="btn btn--primary" type="button" data-hud="resume">Keep going</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  function setText(key, node, text) {
    if (shown[key] === text) return;
    shown[key] = text;
    node.textContent = text;
  }

  function setWidth(key, node, fraction) {
    var width = (PS.clamp(fraction, 0, 1) * 100).toFixed(1) + "%";
    if (shown[key] === width) return;
    shown[key] = width;
    node.style.width = width;
  }

  function setHtml(key, node, signature, html) {
    if (shown[key] === signature) return;
    shown[key] = signature;
    node.innerHTML = html;
  }

  function buildMarkup(R, withNames) {
    var p = R.p;
    return (p.order || []).map(function (id) {
      var up = B.upgrade(id);
      var level = p.up[id];
      var name = typeof up.name === "function" ? up.name(level, R) : up.name;
      return (
        '<span class="chip" style="--tier:' + B.UP_TIERS[up.tier].color + '" title="' + PS.esc(name) + '">' +
        PS.icon(up.icon) + (withNames ? "<em>" + PS.esc(name) + "</em>" : "") +
        (up.max > 1 ? "<b>" + level + "</b>" : "") + "</span>"
      );
    }).join("");
  }

  function onClick(e) {
    var pick = e.target.closest("[data-pick]");
    if (pick) {
      // a moment's grace, so a click meant for the battle cannot choose a card
      if (performance.now() - openedAt > 250) B.choose(Number(pick.getAttribute("data-pick")));
      return;
    }
    var control = e.target.closest("[data-hud]");
    if (!control) return;
    var action = control.getAttribute("data-hud");
    if (action === "pause") B.pause();
    else if (action === "resume") B.resume();
    else if (action === "reroll") B.reroll();
    else if (action === "quit") {
      if (quitArmed) {
        B.giveUp();
      } else {
        quitArmed = true;
        control.textContent = "Really give up?";
      }
    }
  }

  B.hud = {
    mount: function (root) {
      root.insertAdjacentHTML("beforeend", MARKUP);
      el.hud = root.querySelector(".hud");
      el.xp = root.querySelector(".hud__xp i");
      el.hpFill = root.querySelector(".hud__hp-fill");
      el.hpShield = root.querySelector(".hud__hp-shield");
      el.hpText = root.querySelector(".hud__hp span");
      el.lvl = root.querySelector(".hud__lvl");
      el.time = root.querySelector(".hud__time");
      el.kills = root.querySelector(".hud__kills");
      el.coins = root.querySelector(".hud__coins");
      el.boss = root.querySelector(".hud__boss");
      el.bossName = root.querySelector(".hud__boss span");
      el.bossFill = root.querySelector(".hud__boss i");
      el.toast = root.querySelector(".hud__toast");
      el.build = root.querySelector(".hud__build");
      el.choose = root.querySelector('[data-panel="choose"]');
      el.chooseTitle = root.querySelector(".choose__title");
      el.cards = root.querySelector(".choose__cards");
      el.reroll = root.querySelector(".choose__reroll");
      el.pause = root.querySelector('[data-panel="pause"]');
      el.pauseWhere = root.querySelector(".pausebox__where");
      el.pauseBuild = root.querySelector(".pausebox__build");
      el.quit = root.querySelector('[data-hud="quit"]');
      el.kills.innerHTML = PS.icon("skull") + "<b></b>";
      el.coins.innerHTML = PS.icon("coin") + "<b></b>";
      el.killsText = el.kills.querySelector("b");
      el.coinsText = el.coins.querySelector("b");
      root.addEventListener("click", onClick);
    },

    begin: function (R) {
      shown = {};
      el.hud.hidden = false;
      el.choose.hidden = true;
      el.pause.hidden = true;
      el.boss.hidden = true;
      el.toast.classList.remove("is-on");
      el.build.innerHTML = "";
      B.hud.update(R);
    },

    update: function (R) {
      var p = R.p;
      var hp = Math.max(0, p.hp) / p.maxHp;
      setWidth("hp", el.hpFill, hp);
      setWidth("shield", el.hpShield, p.barrierMax ? p.barrier / p.maxHp : 0);
      if (shown.low !== hp < 0.3) {
        shown.low = hp < 0.3;
        el.hpFill.classList.toggle("is-low", shown.low);
      }
      setText("hpText", el.hpText, PS.fmt(Math.ceil(Math.max(0, p.hp))) + " / " + PS.fmt(Math.round(p.maxHp)));
      setWidth("xp", el.xp, p.xp / p.need);
      setText("lvl", el.lvl, "Lv " + p.level);
      setText("time", el.time, R.phase === "swarm" ? PS.clock(Math.ceil(R.dur - R.t)) : "BOSS");
      setText("kills", el.killsText, PS.fmt(R.kills));
      setText("coins", el.coinsText, PS.fmt(R.coins));

      var boss = R.boss && !R.boss.dead ? R.boss : null;
      if (shown.boss !== Boolean(boss)) {
        shown.boss = Boolean(boss);
        el.boss.hidden = !boss;
        if (boss) el.bossName.textContent = boss.name;
      }
      if (boss) setWidth("bossHp", el.bossFill, boss.hp / boss.maxHp);

      var toast = R.toastT > 0 ? R.toast : "";
      if (shown.toast !== toast) {
        shown.toast = toast;
        if (toast) el.toast.textContent = toast;
        el.toast.classList.toggle("is-on", Boolean(toast));
      }
    },

    build: function (R) {
      el.build.innerHTML = buildMarkup(R, false);
    },

    choices: function (R) {
      var open = Boolean(R.choices);
      el.choose.hidden = !open;
      if (!open) return;
      openedAt = performance.now();
      var p = R.p;
      el.chooseTitle.textContent = R.t < 0.5 && p.level === 1 ? "A head start! Pick an upgrade" : "Level " + p.level + "! Pick an upgrade";
      el.cards.innerHTML = R.choices.map(function (choice, index) {
        var tier = B.UP_TIERS[choice.tier];
        var progress = choice.max === 1 || choice.max === Infinity ? "" : choice.level === 1 ? "New" : "Level " + (choice.level - 1) + " → " + choice.level;
        return (
          '<button class="upcard" type="button" data-pick="' + index + '" style="--tier:' + tier.color + '">' +
            '<span class="upcard__key" aria-hidden="true">' + (index + 1) + "</span>" +
            '<span class="upcard__icon">' + PS.icon(choice.icon) + "</span>" +
            '<span class="upcard__tier">' + tier.name + "</span>" +
            '<strong class="upcard__name">' + PS.esc(choice.name) + "</strong>" +
            '<span class="upcard__text">' + PS.esc(choice.text) + "</span>" +
            '<span class="upcard__level">' + progress + "</span>" +
          "</button>"
        );
      }).join("");
      el.reroll.hidden = p.rerolls <= 0;
      el.reroll.textContent = "Reroll · " + p.rerolls + " left";
    },

    paused: function (R) {
      el.pause.hidden = !R.paused;
      if (!R.paused) return;
      quitArmed = false;
      el.quit.textContent = "Give up";
      el.pauseWhere.textContent = "Chapter " + R.ch.n + " · " + R.ch.name + " · " + PS.clock(R.t);
      var build = buildMarkup(R, true);
      el.pauseBuild.innerHTML = build || '<p class="pausebox__empty">No upgrades yet. Grab gems to level up.</p>';
    },

    hide: function () {
      el.hud.hidden = true;
      el.choose.hidden = true;
      el.pause.hidden = true;
    }
  };
})();
