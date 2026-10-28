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
      // three groups: the lemon (level and health) on the left, the clock in the middle,
      // the counters and buttons on the right
      '<div class="hud__top">' +
        '<div class="hud__me">' +
          '<span class="hud__lvl" role="img" aria-label="Level"><small>Lv</small><b></b></span>' +
          '<div class="hud__hp" role="img" aria-label="Health"><span class="hud__hp-track">' +
            '<i class="hud__hp-lag"></i><i class="hud__hp-fill"></i><i class="hud__hp-shield"></i>' +
            '<span class="hud__heart" aria-hidden="true">' + PS.icon("hp") + '</span><span class="hud__hp-text"></span>' +
          "</span></div>" +
        "</div>" +
        // the plate: pests squashed of the ones before the boss (with a bar along its foot), or a clock
        '<span class="hud__time"><span class="hud__goal-ico" aria-hidden="true">' + PS.icon("skull") + "</span><b></b><small></small></span>" +
        '<div class="hud__side">' +
          '<span class="hud__pill hud__kills"></span>' +
          '<span class="hud__pill hud__coins"></span>' +
          '<button class="hud__btn hud__btn--dev" type="button" data-hud="dev" aria-label="Dev menu" title="Dev menu (`)" hidden>DEV</button>' +
          '<button class="hud__btn" type="button" data-hud="meter" aria-label="Damage meter" aria-pressed="true" title="Damage meter (Tab)">' + PS.icon("chart") + "</button>" +
          '<button class="hud__btn" type="button" data-hud="pause" aria-label="Pause" title="Pause (Esc)">' + PS.icon("pause") + "</button>" +
        "</div>" +
      '</div>' +
      '<div class="hud__meter" aria-label="Damage by source" hidden></div>' +
      // playing together: the other lemon's health, a duel's score, and a word while someone waits
      '<div class="hud__mate" hidden><b></b><div class="hud__mate-hp"><i></i></div><small></small></div>' +
      '<div class="hud__score" hidden></div>' +
      '<div class="hud__wait" role="status" hidden></div>' +
      '<div class="hud__boss" hidden><p>' + PS.icon("skull") + '<span></span></p><div class="hud__boss-bar"><i class="hud__boss-lag"></i><i class="hud__boss-fill"></i></div></div>' +
      '<div class="hud__toast" role="status" aria-live="polite"></div>' +
      '<div class="hud__combo" hidden aria-hidden="true"><b></b><span>combo</span></div>' +
      '<div class="hud__buffs" aria-live="polite"></div>' +
      '<div class="hud__build"></div>' +
      '<button class="hud__dash" type="button" data-hud="dash" aria-label="Dash (Space)" title="Dash (Space or Shift)">' +
        PS.icon("dash") + "<small>Space</small></button>" +
    '</div>' +
    '<div class="sheet" data-panel="choose" hidden>' +
      '<div class="choose">' +
        '<p class="choose__title"></p>' +
        '<div class="choose__cards"></div>' +
        '<button class="btn btn--sm choose__reroll" type="button" data-hud="reroll"></button>' +
        '<button class="btn btn--sm choose__dev" type="button" data-hud="dev" hidden>DEV: pick any upgrade</button>' +
      '</div>' +
    '</div>' +
    '<div class="sheet" data-panel="pause" hidden>' +
      '<div class="panel pausebox">' +
        '<h2>Paused</h2>' +
        '<p class="pausebox__where"></p>' +
        '<div class="pausebox__stats"></div>' +
        '<div class="pausebox__build"></div>' +
        '<div class="pausebox__chat" hidden></div>' +
        '<div class="pausebox__actions">' +
          '<button class="btn" type="button" data-hud="dev" hidden>DEV</button>' +
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

  /* the pets that came along, named, in their rarity's colour */
  function petChips() {
    return PS.state.petTeam().map(function (pet) {
      var def = PS.PET[pet.sp];
      return (
        '<span class="chip chip--pet" style="--tier:' + PS.RARITY[pet.r].color + '" title="' + PS.esc(def.name) + ' (pet)">' +
        PS.petArt(pet.sp, pet.r) + "<em>" + PS.esc(def.name) + "</em><b>" + pet.lv + "</b></span>"
      );
    }).join("");
  }

  function buildMarkup(R, withNames) {
    var p = R.p;
    return petChips() + (p.order || []).map(function (id) {
      var up = B.upgrade(id);
      var level = p.up[id];
      var awake = p.awake && p.awake[id];
      var name = awake ? B.awakenedName(id) : typeof up.name === "function" ? up.name(level, R) : up.name;
      return (
        '<span class="chip' + (awake ? " chip--awake" : "") + '" style="--tier:' + (awake ? B.SPECIAL_TIERS.awaken.color : B.tierInfo(up.tier).color) + '" title="' + PS.esc(name) + '">' +
        PS.icon(up.icon) + (withNames ? "<em>" + PS.esc(name) + "</em>" : "") +
        (awake ? "<b>★</b>" : up.max > 1 ? "<b>" + level + "</b>" : "") + "</span>"
      );
    }).join("");
  }

  /* ------------------------------------------------------- damage meter */
  /* Who is doing the damage: the weapon, each upgrade's ability, burning,
     death explosions and thorns, ranked, with each one's share of the total. */

  var SOURCES = {
    orbit: ["Orbit Peel", "orbit", "#E0B93C"],
    bolt: ["Lightning Seed", "bolt", "#8EC5FF"],
    bomb: ["Juice Bomb", "bomb", "#FFB84A"],
    mist: ["Cold Mist", "mist", "#9AD7FF"],
    trail: ["Zest Trail", "trail", "#F26B2A"],
    burst: ["Thorn Burst", "burst", "#8FAE65"],
    swarm: ["Pip Swarm", "swarm", "#9BE08A"],
    pet: ["Your pet", "swarm", "#FFD166"],
    burn: ["Burning", "burn", "#F26B2A"],
    boom: ["Death blasts", "boom", "#F7D94C"],
    thorns: ["Thorns", "armor", "#8FAE65"],
    aura: ["Gear aura", "sun", "#FFD166"],
    gear: ["Gear blasts", "revive", "#FFE66D"],
    cratebomb: ["Crate bomb", "bomb", "#E5484D"],
    frostnova: ["Frost Nova", "frostnova", "#9BDCFF"],
    mines: ["Seed Mines", "mine", "#C79A5B"],
    sunbeam: ["Sunbeam", "sunbeam", "#FFD166"],
    rain: ["Lemon Rain", "rain", "#F7D94C"],
    bees: ["Bee Buddies", "bee", "#F2B93B"],
    lash: ["Vine Lash", "vine", "#8FC46A"],
    bubble: ["Bubble burst", "bubble", "#BFE0FF"],
    field: ["Static Field", "field", "#FFE14A"]
  };
  var MAX_ROWS = 7;
  var meterOpen = false;

  function share(fraction) {
    return fraction < 0.1 ? (fraction * 100).toFixed(1) + "%" : Math.round(fraction * 100) + "%";
  }

  /** The ranked list as markup. Returns "" until something has been hit. */
  function meterRows(R) {
    var rows = [];
    var total = 0;
    Object.keys(R.dmgBy).forEach(function (key) {
      var dmg = R.dmgBy[key];
      if (!(dmg > 0)) return;
      total += dmg;
      var petKey = key.indexOf("pet:") === 0 ? key.split(":") : null;
      if (petKey && PS.PET[petKey[1]]) {
        // a pet is listed by its own name
        rows.push({
          name: PS.PET[petKey[1]].name, icon: PS.petArt(petKey[1], Number(petKey[2])),
          color: PS.RARITY[Number(petKey[2])].color, dmg: dmg
        });
      } else if (key === R.weaponId) {
        rows.push({ name: PS.ITEMS[key].name, icon: PS.itemIcon(key), color: "#F7D94C", dmg: dmg, weapon: true });
      } else {
        var s = SOURCES[key] || [key, "xp", "#CDBF9C"];
        var awake = R.p.awake && R.p.awake[key];
        rows.push({ name: awake ? B.awakenedName(key) : s[0], icon: PS.icon(s[1]), color: awake ? "#FFD54A" : s[2], dmg: dmg });
      }
    });
    if (!rows.length) return "";
    rows.sort(function (a, b) { return b.dmg - a.dmg; });
    if (rows.length > MAX_ROWS) {
      var rest = rows.splice(MAX_ROWS - 1);
      var sum = rest.reduce(function (acc, r) { return acc + r.dmg; }, 0);
      rows.push({ name: "Others (" + rest.length + ")", icon: PS.icon("count"), color: "#9AA1A9", dmg: sum });
    }
    var top = rows[0].dmg;
    var seconds = Math.max(1, R.t);
    return (
      '<div class="meter__head"><b>Damage</b><span>' + PS.fmt(total) + " · " + PS.fmt(total / seconds) + "/s</span></div>" +
      rows.map(function (r) {
        return (
          '<div class="meter__row' + (r.weapon ? " is-weapon" : "") + '" style="--w:' + ((r.dmg / top) * 100).toFixed(1) + "%;--c:" + r.color + '">' +
            '<span class="meter__ico">' + r.icon + "</span>" +
            '<span class="meter__name">' + PS.esc(r.name) + "</span>" +
            '<span class="meter__num">' + PS.fmt(r.dmg) + "</span>" +
            '<span class="meter__pct">' + share(r.dmg / total) + "</span>" +
          "</div>"
        );
      }).join("")
    );
  }

  function applyMeter() {
    el.meter.hidden = !meterOpen;
    el.hud.classList.toggle("has-meter", meterOpen);
    el.meterBtn.setAttribute("aria-pressed", String(meterOpen));
    shown.meter = null;
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
    else if (action === "meter") B.hud.toggleMeter();
    else if (action === "reroll") B.reroll();
    else if (action === "dash") B.dash();
    else if (action === "dev") B.devPanel.open();
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
      el.meter = root.querySelector(".hud__meter");
      el.meterBtn = root.querySelector('[data-hud="meter"]');
      el.xp = root.querySelector(".hud__xp i");
      el.me = root.querySelector(".hud__me");
      el.hpFill = root.querySelector(".hud__hp-fill");
      el.hpLag = root.querySelector(".hud__hp-lag");
      el.hpShield = root.querySelector(".hud__hp-shield");
      el.hpText = root.querySelector(".hud__hp-text");
      el.lvl = root.querySelector(".hud__lvl");
      el.lvlNum = el.lvl.querySelector("b");
      el.time = root.querySelector(".hud__time");
      el.timeText = el.time.querySelector("b");
      el.timeGoal = el.time.querySelector("small");
      el.kills = root.querySelector(".hud__kills");
      el.coins = root.querySelector(".hud__coins");
      el.boss = root.querySelector(".hud__boss");
      el.bossName = root.querySelector(".hud__boss span");
      el.bossFill = root.querySelector(".hud__boss-fill");
      el.bossLag = root.querySelector(".hud__boss-lag");
      el.toast = root.querySelector(".hud__toast");
      el.combo = root.querySelector(".hud__combo");
      el.buffs = root.querySelector(".hud__buffs");
      el.comboText = el.combo.querySelector("b");
      el.build = root.querySelector(".hud__build");
      el.choose = root.querySelector('[data-panel="choose"]');
      el.chooseTitle = root.querySelector(".choose__title");
      el.cards = root.querySelector(".choose__cards");
      el.reroll = root.querySelector(".choose__reroll");
      el.pause = root.querySelector('[data-panel="pause"]');
      el.pauseWhere = root.querySelector(".pausebox__where");
      el.pauseStats = root.querySelector(".pausebox__stats");
      el.pauseBuild = root.querySelector(".pausebox__build");
      el.pauseChat = root.querySelector(".pausebox__chat");
      el.quit = root.querySelector('[data-hud="quit"]');
      el.dash = root.querySelector(".hud__dash");
      el.mate = root.querySelector(".hud__mate");
      el.mateName = el.mate.querySelector("b");
      el.mateHp = el.mate.querySelector(".hud__mate-hp i");
      el.mateNote = el.mate.querySelector("small");
      el.score = root.querySelector(".hud__score");
      el.wait = root.querySelector(".hud__wait");
      el.kills.innerHTML = PS.icon("skull") + "<b></b>";
      el.coins.innerHTML = PS.icon("coin") + "<b></b>";
      el.killsText = el.kills.querySelector("b");
      el.coinsText = el.coins.querySelector("b");
      root.addEventListener("click", onClick);
    },

    begin: function (R) {
      shown = {};
      meterOpen = PS.store.get("lemon:meter", window.innerWidth >= 900) === true;
      applyMeter();
      var devButtons = el.hud.parentNode.querySelectorAll('[data-hud="dev"]');
      // playing together, only the admin password brings the dev menu along
      for (var i = 0; i < devButtons.length; i++) devButtons[i].hidden = !PS.dev.unlocked || (Boolean(R.mp) && !PS.dev.admin);
      el.hud.hidden = false;
      el.choose.hidden = true;
      el.pause.hidden = true;
      el.boss.hidden = true;
      el.toast.classList.remove("is-on");
      el.build.innerHTML = "";
      B.hud.build(R);
      B.hud.update(R);
    },

    update: function (R) {
      var p = R.p;
      var hp = Math.max(0, p.hp) / p.maxHp;
      setWidth("hp", el.hpFill, hp);
      setWidth("hpLag", el.hpLag, hp); // follows a moment later, so a hit shows what it took
      setWidth("shield", el.hpShield, p.barrierMax ? p.barrier / p.maxHp : 0);
      if (shown.low !== hp < 0.3) {
        shown.low = hp < 0.3;
        el.hpFill.classList.toggle("is-low", shown.low);
        el.me.classList.toggle("is-low", shown.low);
      }
      // health rounds up (1 hp left is not 0), but never past the rounded maximum
      var maxShown = Math.round(p.maxHp);
      setText("hpText", el.hpText, PS.fmt(Math.min(maxShown, Math.ceil(Math.max(0, p.hp)))) + " / " + PS.fmt(maxShown));
      setWidth("xp", el.xp, p.xp / p.need);
      if (shown.lvl !== p.level) {
        // the badge gives a little hop on a level up (not when the battle starts)
        var up = shown.lvl !== undefined && p.level > shown.lvl;
        shown.lvl = p.level;
        el.lvlNum.textContent = p.level;
        el.lvl.setAttribute("aria-label", "Level " + p.level);
        if (up) {
          el.lvl.classList.remove("is-up");
          void el.lvl.offsetWidth;
          el.lvl.classList.add("is-up");
        }
      }
      // a chapter counts the pests squashed toward the boss; endless and duels keep a clock
      var counting = !R.duel && R.mode !== "swarm" && R.phase === "swarm" && R.goal > 0;
      var goal = Math.max(1, B.goalNow(R)); // shrinks once the boss grows impatient
      if (shown.counting !== counting) {
        shown.counting = counting;
        el.hud.classList.toggle("is-counting", counting);
        el.time.setAttribute("aria-label", counting ? "Pests squashed before the boss" : "Time");
      }
      setText("time", el.timeText, R.duel ? "Round " + R.duel.round + " · " + PS.clock(Math.ceil(Math.max(0, B.DUEL.round - R.duel.roundT)))
        : R.mode === "swarm" ? PS.clock(R.t) : counting ? PS.fmt(Math.min(R.kills, goal)) : R.phase === "swarm" ? "" : "BOSS");
      setText("timeGoal", el.timeGoal, counting ? " / " + PS.fmt(goal) : "");
      var prog = counting ? Math.floor((Math.min(R.kills, goal) / goal) * 200) / 200 : 0;
      if (shown.prog !== prog) {
        shown.prog = prog;
        el.time.style.setProperty("--prog", prog);
      }
      // the plate turns red for the boss, and warm with the last few pests before it
      var clockMood = R.duel || R.mode === "swarm" ? "" : R.phase !== "swarm" ? "boss" : R.impatient || goal - R.kills <= Math.max(10, goal * 0.05) ? "soon" : "";
      if (shown.clockMood !== clockMood) {
        shown.clockMood = clockMood;
        el.time.setAttribute("data-mood", clockMood);
      }
      B.hud.together(R);
      setText("kills", el.killsText, PS.fmt(R.kills));
      setText("coins", el.coinsText, PS.fmt(R.coins));

      // the dash button fills back up as the dash recharges
      var dashLeft = p.dashCd > 0 ? Math.ceil((p.dashCd / B.dashCooldown()) * 40) / 40 : 0;
      if (shown.dash !== dashLeft) {
        shown.dash = dashLeft;
        el.dash.style.setProperty("--left", dashLeft);
        el.dash.classList.toggle("is-ready", !dashLeft);
      }

      // power-ups running, with the seconds left on each
      var buffHtml = "";
      var buffSig = "";
      if (B.POWERS) {
        Object.keys(R.p.buffs).forEach(function (key) {
          var left = R.p.buffs[key];
          if (!(left > 0) || !B.POWERS[key]) return;
          var power = B.POWERS[key];
          var secs = Math.ceil(left);
          buffSig += key + secs;
          buffHtml += '<span class="buff' + (left < 2 ? " is-ending" : "") + '" style="--c:' + power.color + '"><b>' + power.name + "</b><i>" + secs + "s</i></span>";
        });
      }
      setHtml("buffs", el.buffs, buffSig, buffHtml);

      // the combo shows from ten squashes in a row, and grows a little with it
      var combo = R.combo >= 10 && R.comboT > 0 ? R.combo : 0;
      if (shown.comboOn !== Boolean(combo)) {
        shown.comboOn = Boolean(combo);
        el.combo.hidden = !combo;
      }
      if (combo) {
        setText("combo", el.comboText, "×" + combo);
        var tier = combo >= 100 ? 3 : combo >= 50 ? 2 : combo >= 25 ? 1 : 0;
        if (shown.comboTier !== tier) {
          shown.comboTier = tier;
          el.combo.setAttribute("data-tier", tier);
        }
      }

      if (meterOpen) {
        var tick = Math.floor(R.t * 4);
        if (shown.meterTick !== tick) {
          shown.meterTick = tick;
          var html = meterRows(R) || '<div class="meter__head"><b>Damage</b><span>nothing yet</span></div>';
          setHtml("meter", el.meter, html, html);
        }
      }

      // one bar for every boss on the field: their names, and their health added up
      var bosses = R.bosses || (R.boss ? [R.boss] : []);
      var alive = bosses.filter(function (b) { return !b.dead; });
      if (shown.boss !== Boolean(alive.length)) {
        shown.boss = Boolean(alive.length);
        el.boss.hidden = !alive.length;
      }
      if (alive.length) {
        setText("bossName", el.bossName, alive.map(function (b) { return b.name; }).join(" & "));
        var hpLeft = 0;
        var hpAll = 0;
        bosses.forEach(function (b) {
          hpAll += b.maxHp;
          if (!b.dead) hpLeft += Math.max(0, b.hp);
        });
        setWidth("bossHp", el.bossFill, hpAll ? hpLeft / hpAll : 0);
        setWidth("bossLag", el.bossLag, hpAll ? hpLeft / hpAll : 0);
      }

      var toast = R.toastT > 0 ? R.toast : "";
      if (shown.toast !== toast) {
        shown.toast = toast;
        if (toast) el.toast.textContent = toast;
        el.toast.classList.toggle("is-on", Boolean(toast));
      }
    },

    /** Playing together: the other lemon's health bar, a duel's score, and what everyone is waiting for. */
    together: function (R) {
      var mate = R.mp ? R.partner : null;
      if (shown.mateOn !== Boolean(mate)) {
        shown.mateOn = Boolean(mate);
        el.mate.hidden = !mate;
        el.hud.classList.toggle("has-mate", Boolean(mate));
        el.score.hidden = !(mate && R.duel);
      }
      if (mate) {
        setText("mateName", el.mateName, mate.name);
        setWidth("mateHp", el.mateHp, mate.gone || mate.down ? 0 : Math.max(0, mate.hp) / mate.maxHp);
        var ms = R.mp.ping || 0;
        var lag = ms ? ms + " ms" + (R.mp.link === "direct" ? "" : " · server") : R.mp.link === "direct" ? "" : "via server";
        setText("mateNote", el.mateNote, mate.gone ? "left" : mate.down ? (R.duel ? "" : "down! go help") : "Lv " + mate.level + (lag ? " · " + lag : ""));
        var slow = ms > 250 ? 2 : ms > 120 ? 1 : 0;
        if (shown.mateSlow !== slow) {
          shown.mateSlow = slow;
          el.mate.setAttribute("data-lag", slow);
        }
        if (shown.mateDown !== Boolean(mate.down || mate.gone)) {
          shown.mateDown = Boolean(mate.down || mate.gone);
          el.mate.classList.toggle("is-down", shown.mateDown);
        }
        if (R.duel) {
          // wins[0] is always this game's own lemon
          setText("score", el.score, "You " + R.duel.wins[0] + " – " + R.duel.wins[1] + " " + mate.name);
        }
      }
      var wait = "";
      if (R.p.down && !R.duel) wait = "You're down! Your friend can help you up by standing next to you";
      else if (R.mirror) wait = R.waitText || "";
      else if (R.ally && R.ally.choices) wait = R.ally.name + " is picking an upgrade...";
      if (shown.wait !== wait) {
        shown.wait = wait;
        el.wait.textContent = wait;
        el.wait.hidden = !wait;
      }
    },

    toggleMeter: function () {
      meterOpen = !meterOpen;
      PS.store.set("lemon:meter", meterOpen);
      applyMeter();
      if (B.run) B.hud.update(B.run);
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
      el.chooseTitle.textContent = R.choiceKind === "shrine" ? "The shrine wakes! Choose a blessing for the rest of the battle"
        : R.t < 0.5 && p.level === 1 ? "A head start! Pick an upgrade" : "Level " + p.level + "! Pick an upgrade";
      el.cards.innerHTML = R.choices.map(function (choice, index) {
        var tier = B.tierInfo(choice.tier);
        var progress = choice.max === 1 || choice.max === Infinity ? "" : choice.level === 1 ? "New" : "Level " + (choice.level - 1) + " → " + choice.level;
        // one pip a level: the ones it has, and the one this card adds
        var pips = "";
        if (choice.max > 1 && choice.max <= 10) {
          for (var k = 1; k <= choice.max; k++) pips += "<i" + (k < choice.level ? ' class="is-had"' : k === choice.level ? ' class="is-new"' : "") + "></i>";
          pips = '<span class="upcard__pips" aria-hidden="true">' + pips + "</span>";
        }
        return (
          '<button class="upcard' + (choice.tier === "awaken" ? " upcard--awaken" : choice.tier === 3 ? " upcard--legend" : "") + '" type="button" data-pick="' + index + '" style="--tier:' + tier.color + '">' +
            '<span class="upcard__key" aria-hidden="true">' + (index + 1) + "</span>" +
            '<span class="upcard__icon">' + PS.icon(choice.icon) + "</span>" +
            '<span class="upcard__tier">' + tier.name + "</span>" +
            '<strong class="upcard__name">' + PS.esc(choice.name) + "</strong>" +
            '<span class="upcard__text">' + PS.esc(choice.text) + "</span>" +
            '<span class="upcard__level">' + pips + progress + "</span>" +
          "</button>"
        );
      }).join("");
      el.reroll.hidden = p.rerolls <= 0;
      el.reroll.textContent = "Reroll · " + p.rerolls + " left";
    },

    paused: function (R) {
      el.pause.hidden = !R.paused;
      // the public chat, in the pause menu (ui.js draws it)
      if (PS.chatPanel) PS.chatPanel.show(el.pauseChat, Boolean(R.paused));
      if (!R.paused) return;
      quitArmed = false;
      el.quit.textContent = "Give up";
      el.pauseWhere.textContent = (R.twist ? "Daily challenge: " + R.twist.name + " · " : "") + "Chapter " + R.ch.n + " · " + R.ch.name;
      el.pauseStats.innerHTML = [
        ["clock", "Time", PS.clock(R.t)],
        ["xp", "Level", R.p.level],
        ["skull", "Squashed", PS.fmt(R.kills)],
        ["coin", "Coins", PS.fmt(R.coins)]
      ].map(function (s) {
        return '<span class="pausebox__stat">' + PS.icon(s[0]) + "<small>" + s[1] + "</small><b>" + s[2] + "</b></span>";
      }).join("");
      var build = buildMarkup(R, true);
      el.pauseBuild.innerHTML = build || '<p class="pausebox__empty">No upgrades yet. Grab gems to level up.</p>';
    },

    hide: function () {
      el.hud.hidden = true;
      el.choose.hidden = true;
      el.pause.hidden = true;
      if (PS.chatPanel) PS.chatPanel.show(el.pauseChat, false);
    }
  };
})();
