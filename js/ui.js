/*!
 * Pip Survivors — menus
 * Everything outside a battle: the top bar and tabs, the Battle, Equipment
 * (with the Forge inside it), Shop, Talents and Quests screens, the pop-ups,
 * and the results screen after a battle. Screens are rebuilt from the save
 * whenever it changes; clicks are routed by their data-act attribute.
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function () {
  "use strict";

  var PS = window.PS;
  var st = PS.state;
  var esc = PS.esc;
  var fmt = PS.fmt;

  var KEY_THEME = "lemon:theme";

  var el = {};
  var view = {
    tab: "battle",
    filter: "all",
    forge: null, // { main: uid, mats: [uid, uid] } while the forge is open
    dev: { id: "sling", r: 0, psp: "bumble", pr: 0, plv: 1, clean: 2, slot: "all" }, // the dev menu's pickers
    devTab: "gear", // which tab of the dev menu is showing
    devSim: null, // the admin menu's last chest simulation
    devHistory: [], // the admin menu's undo list: { label, save, at }, oldest first
    entering: true, // the next render should play the screen's entrance animation
    slide: 0, // -1 / 1 while the chapter title slides in from a side
    modal: null, // { type, ... } while a pop-up is open
    results: null,
    gate: null, // { mode: "login" | "signup", name, error, down, checking, busy } while the log-in screen shows
    // the leaderboard: filters, rows, banned players (for admins), an admin's open form
    board: { by: "chapter", span: "all", q: "", rows: null, banned: [], showBanned: false, error: "", mod: null, presence: null, presenceAt: 0 },
    giftsWaiting: null, // gifts from a moderator, shown as soon as the menus are free
    takenWaiting: null, // what a moderator took away, shown the same way
    banner: null, // the banner as the server last gave it: { text, at }; text null means the one in index.html
    // the Shop's casino: the bet in the box (null until one is typed), the blackjack hand, the wheel
    casino: { bet: null, bj: null, bw: { pick: "black", angle: 0, spinning: null, last: null, history: [] } }
  };
  var logoArmedUntil = 0;
  var toastTimer = 0;
  var tickTimer = 0;

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  /* ------------------------------------------------------------- pieces */

  function rarityOf(item) {
    return PS.RARITY[item.r];
  }

  function fullName(item) {
    return rarityOf(item).name + " " + st.def(item).name;
  }

  function gradeTag(def) {
    return def.grade === "A" ? "" : '<span class="tile__grade g-' + def.grade + '">' + def.grade + "</span>";
  }

  /** A square picture of an item on its rarity colour. `item` only needs
   *  { id, r }, so previews can use it too. opts: act, cls, mark, plain. */
  function tile(item, opts) {
    opts = opts || {};
    var def = PS.ITEMS[item.id];
    var tag = opts.plain ? "span" : "button";
    return (
      "<" + tag + ' class="tile r' + item.r + (def.grade !== "A" ? " gr-" + def.grade : "") + (opts.cls ? " " + opts.cls : "") + '"' +
      (opts.plain ? "" : ' type="button"') +
      (opts.act ? ' data-act="' + opts.act + '" data-u="' + (item.u || 0) + '" data-key="' + opts.act + (item.u || 0) + '"' : "") +
      (opts.disabled ? " disabled" : "") +
      ' title="' + esc(PS.RARITY[item.r].name + " " + def.name) + '">' +
      '<span class="tile__art">' + PS.itemIcon(item.id) + "</span>" + gradeTag(def) +
      (opts.mark ? '<span class="tile__mark">' + opts.mark + "</span>" : "") +
      "</" + tag + ">"
    );
  }

  function price(currency, amount) {
    return '<span class="price">' + PS.icon(currency === "gems" ? "gem" : "coin") + "<b>" + fmt(amount) + "</b></span>";
  }

  function rarityName(r) {
    return '<span class="rname r' + r + '">' + PS.RARITY[r].name + "</span>";
  }

  function statText(key, value) {
    if (key === "atk" || key === "hp") return fmt(Math.round(value));
    if (key === "regen") return PS.pct(value) + "/s";
    return PS.pct(value);
  }

  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove("is-on"); }, 2400);
  }

  /* --------------------------------------------------------------- shell */

  /* The three numbers in the top bar count up (or down) to their new value
     and the pill bumps when it grows. */
  var counters = {};

  function countTo(key, node, icon, target) {
    var c = counters[key];
    if (!c) {
      node.innerHTML = PS.icon(icon) + "<b></b>";
      c = counters[key] = { node: node, text: node.querySelector("b"), shown: target, from: target, to: target, t0: 0, raf: 0 };
      c.text.textContent = fmt(target);
      return;
    }
    if (c.to === target) return;
    var growing = target > c.to;
    c.from = c.shown;
    c.to = target;
    if (PS.reducedMotion()) {
      c.shown = target;
      c.text.textContent = fmt(target);
    } else {
      c.t0 = performance.now();
      cancelAnimationFrame(c.raf);
      (function step(now) {
        var k = Math.min(1, (now - c.t0) / (growing ? 650 : 350));
        var eased = 1 - Math.pow(1 - k, 3);
        c.shown = c.from + (c.to - c.from) * eased;
        c.text.textContent = fmt(Math.round(c.shown));
        if (k < 1) c.raf = requestAnimationFrame(step);
      })(c.t0);
    }
    if (growing) {
      c.node.classList.remove("is-bump");
      void c.node.offsetWidth;
      c.node.classList.add("is-bump");
    }
  }

  /** Power as this player's screens show it: the admin menu's text if one is set. */
  function powerShown(n) {
    var text = st.powerText();
    return text ? esc(text) : fmt(n);
  }

  function renderTop() {
    var S = st.get();
    var text = st.powerText();
    if (text) {
      counters.power = null; // the number counts again from scratch once the text goes
      el.power.innerHTML = PS.icon("power") + "<b>" + esc(text) + "</b>";
    } else {
      countTo("power", el.power, "power", st.calc().power);
    }
    countTo("gold", el.gold, "coin", S.gold);
    countTo("gems", el.gems, "gem", S.gems);
  }

  /** Play a one-shot animation class on an element, then take it off again. */
  function pulse(node, name, ms) {
    if (!node) return;
    node.classList.remove(name);
    void node.offsetWidth;
    node.classList.add(name);
    setTimeout(function () { node.classList.remove(name); }, ms || 700);
  }

  /** A small "+1 Lv" that floats up out of an element. */
  function floater(node, text) {
    if (!node || PS.reducedMotion()) return;
    var f = document.createElement("span");
    f.className = "floater";
    f.textContent = text;
    node.appendChild(f);
    setTimeout(function () { f.remove(); }, 900);
  }

  function renderTabs() {
    var badges = st.badges();
    var buttons = el.tabbar.querySelectorAll("[data-tab]");
    for (var i = 0; i < buttons.length; i++) {
      var tab = buttons[i].getAttribute("data-tab");
      var active = tab === view.tab;
      buttons[i].classList.toggle("is-active", active);
      if (active) buttons[i].setAttribute("aria-current", "page");
      else buttons[i].removeAttribute("aria-current");
      buttons[i].classList.toggle("has-badge", Boolean(badges[tab]));
    }
  }

  var SCREENS = {};
  var enteringTimer = 0;

  /** Number the children of every block on the screen, so the entrance
   *  animation can ripple through them one after another. The class comes
   *  off again afterwards so ongoing animations (glows, wiggles) carry on. */
  function stagger() {
    var groups = el.screen.querySelectorAll("section, .chapter, .gear__hero, .bag, .slots, .chests, .deals, .talentgrid, .facts");
    Array.prototype.forEach.call(groups, function (group) {
      Array.prototype.forEach.call(group.children, function (child, i) {
        child.style.setProperty("--i", Math.min(i, 14));
      });
    });
    clearTimeout(enteringTimer);
    enteringTimer = setTimeout(function () { el.screen.classList.remove("is-entering"); }, 1100);
  }

  function render() {
    var focused = document.activeElement && document.activeElement.getAttribute ? document.activeElement.getAttribute("data-key") : null;
    renderTop();
    renderTabs();
    el.screen.className = "screen screen--" + view.tab + (view.entering ? " is-entering" : "");
    el.screen.innerHTML = SCREENS[view.tab]();
    if (view.entering) stagger();
    view.entering = false;
    if (view.modal) renderModal();
    if (focused) {
      var again = document.querySelector('[data-key="' + focused + '"]');
      if (again && !again.disabled) again.focus();
    }
  }

  function go(tab) {
    if (view.tab === "gear" && tab !== "gear") {
      view.forge = null;
      st.markSeen();
    }
    view.tab = tab;
    view.entering = true;
    render();
    el.screen.scrollTop = 0;
  }

  /* ------------------------------------------------------- battle screen */

  function lootPreview(chapter) {
    var weights = PS.rarityWeights(PS.BAL.lootMu(chapter));
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var out = "";
    weights.forEach(function (w, r) {
      if (w / total >= 0.08) out += rarityName(r);
    });
    return out;
  }

  /** The Endless swarm card under the chapter: locked until PS.ENDLESS.from is cleared. */
  function endlessCard() {
    var info = st.endlessInfo();
    if (!info.open) {
      return (
        '<div class="panel endless is-locked">' +
          '<div class="endless__art">' + PS.icon("lock") + "</div>" +
          '<div class="endless__body"><h3>Endless swarm</h3><p>Clear chapter ' + PS.ENDLESS.from + " to unlock a battle that never ends.</p></div>" +
        "</div>"
      );
    }
    return (
      '<div class="panel endless">' +
        '<div class="endless__art">' + PS.icon("skull") + "</div>" +
        '<div class="endless__body"><h3>Endless swarm</h3>' +
          "<p>No boss, no end: the swarm just keeps growing. Pests are as tough as chapter " + info.chapter + ". Pays gold for every second you last.</p>" +
          '<p class="endless__best">' + PS.icon("clock") + (info.best ? "Best " + PS.clock(info.best) + " · chapter " + info.bestCh + " · " + fmt(info.bestKills) + " squashed" : "No record yet") + "</p>" +
        "</div>" +
        '<button class="btn btn--primary" type="button" data-act="endless" data-key="endless">Play</button>' +
      "</div>"
    );
  }

  /** Today's challenge, between the chapter and the Endless swarm card. */
  function challengeCard() {
    var info = st.challengeInfo();
    if (!info.open) {
      return (
        '<div class="panel endless endless--challenge is-locked">' +
          '<div class="endless__art">' + PS.icon("lock") + "</div>" +
          '<div class="endless__body"><h3>Daily challenge</h3><p>Clear chapter ' + PS.CHALLENGE.from + " to unlock a new challenge every day.</p></div>" +
        "</div>"
      );
    }
    var tw = info.twist;
    var reward = info.done
      ? '<p class="endless__best">' + PS.icon("check") + "<span>Won today · a new one in " + '<span data-countdown="midnight">' + PS.countdown(untilMidnight()) + "</span></span></p>"
      : '<p class="endless__best">' + PS.icon("gift") + "<span>Win it for " + price("gems", PS.CHALLENGE.gems) + " and a " + esc(PS.CHESTS[PS.CHALLENGE.chest].name) + "</span></p>";
    return (
      '<div class="panel endless endless--challenge' + (info.done ? " is-done" : "") + '">' +
        '<div class="endless__art">' + PS.icon(tw.icon) + "</div>" +
        '<div class="endless__body"><p class="kicker">Daily challenge · chapter ' + info.chapter + "</p>" +
          "<h3>" + esc(tw.name) + "</h3>" +
          "<p>" + esc(tw.text) + "</p>" +
          reward +
        "</div>" +
        '<button class="btn' + (info.done ? "" : " btn--primary") + '" type="button" data-act="challenge" data-key="challenge">' + (info.done ? "Play again" : "Play") + "</button>" +
      "</div>"
    );
  }

  SCREENS.battle = function () {
    var S = st.get();
    var ch = PS.chapter(S.chapter);
    var zone = PS.ZONES[ch.zone];
    var stats = st.calc();
    var ratio = stats.power / ch.rec;
    var verdict = ratio >= 1 ? ["good", "You are ready"] : ratio >= 0.7 ? ["warn", "This will be tough"] : ["bad", "Far too strong for you yet"];
    var record = S.clears[ch.n];
    var cleared = S.best >= ch.n;
    var first = !cleared;
    var weapon = st.equipped("weapon");
    var slide = view.slide;
    view.slide = 0;

    return (
      '<section class="home">' +
        '<div class="panel chapter" style="--zone:' + zone.accent + ";--floor:" + zone.floor + '">' +
          '<div class="chapter__head">' +
            '<button class="btn btn--icon" type="button" data-act="chapter" data-dir="-1" data-key="ch-prev" aria-label="Previous chapter"' + (ch.n <= 1 ? " disabled" : "") + ">" + PS.icon("left") + "</button>" +
            '<div class="chapter__title' + (slide ? " slide-" + (slide > 0 ? "right" : "left") : "") + '">' +
              '<p class="kicker">Chapter ' + ch.n + " of " + PS.BAL.CHAPTERS + " · " + esc(zone.name) + "</p>" +
              "<h1>" + esc(ch.name) + "</h1>" +
            "</div>" +
            '<button class="btn btn--icon" type="button" data-act="chapter" data-dir="1" data-key="ch-next" aria-label="Next chapter"' + (st.chapterOpen(ch.n + 1) ? "" : " disabled") + ">" + PS.icon(st.chapterOpen(ch.n + 1) || ch.n >= PS.BAL.CHAPTERS ? "right" : "lock") + "</button>" +
          "</div>" +

          '<div class="stage">' +
            '<span class="stage__motes" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>' +
            '<span class="stage__spark" aria-hidden="true">' + PS.icon("boom") + "</span>" +
            '<div class="stage__side">' +
              '<div class="stage__hero">' + PS.art("lemon") + (weapon ? '<span class="stage__weapon">' + PS.itemIcon(weapon.id) + "</span>" : "") + "</div>" +
              '<span class="stage__label">You' + '<b class="power">' + PS.icon("power") + powerShown(stats.power) + "</b></span>" +
            "</div>" +
            '<span class="stage__vs" aria-hidden="true">VS</span>' +
            '<div class="stage__side">' +
              '<div class="stage__boss">' + PS.bossArt(ch.n) + "</div>" +
              '<span class="stage__label">' + esc(ch.bossName) + '<b class="power power--' + verdict[0] + '">' + PS.icon("power") + fmt(ch.rec) + "</b></span>" +
            "</div>" +
          "</div>" +

          '<p class="verdict verdict--' + verdict[0] + '">' + verdict[1] + " · recommended power " + fmt(ch.rec) + "</p>" +

          '<dl class="facts">' +
            "<div><dt>Length</dt><dd>" + PS.clock(ch.duration) + (PS.chapterBosses(ch.n).length > 1 ? " then two bosses: " + esc(PS.chapterBosses(ch.n).map(function (c) { return c.bossName; }).join(" & ")) : " then the boss") + "</dd></div>" +
            "<div><dt>" + (first ? "First clear" : "Reward") + "</dt><dd>" + price("gold", ch.gold * (first ? 3 : 1)) + (first ? price("gems", PS.BAL.gemsFirst(ch.n)) : "") + "</dd></div>" +
            "<div><dt>Gear drops</dt><dd>" + (first ? (ch.milestone ? "6" : "5") : "3") + ' × <span class="rlist">' + lootPreview(ch.n) + (first && ch.milestone ? '<span class="rname g-' + ch.milestone[0] + '">' + ch.milestone[0] + "-grade</span>" : "") + "</span></dd></div>" +
            "<div><dt>Best</dt><dd>" + (record && record.n ? PS.clock(record.time) + " · cleared " + record.n + (record.n === 1 ? " time" : " times") : "Not cleared yet") + "</dd></div>" +
          "</dl>" +

          '<button class="btn btn--primary btn--xl" type="button" data-act="fight" data-key="fight">' + PS.icon("tabBattle") + "Battle</button>" +
          '<div class="home__social">' +
            '<button class="btn home__together" type="button" data-act="together" data-key="together">' + PS.icon("atk") + "Play with a friend</button>" +
            '<button class="btn home__trade" type="button" data-act="trade" data-key="trade">' + PS.icon("gift") + "Trade</button>" +
            '<button class="btn home__chat" type="button" data-act="chat" data-key="chat">' + PS.icon("info") + "Chat</button>" +
          "</div>" +
          '<p class="hint">Move with WASD or the arrow keys, or drag on the screen. Your lemon attacks by itself.</p>' +
          '<button class="btn btn--sm home__guide" type="button" data-act="howto" data-key="howto">' + PS.icon("info") + "New here? How to play</button>" +
        "</div>" +
        challengeCard() +
        endlessCard() +
        '<footer class="foot"><span>Your progress is saved in this browser.</span>' +
          '<button class="foot__secret" type="button" data-act="secret" aria-label="Locked area">?</button></footer>' +
      "</section>"
    );
  };

  /* ---------------------------------------------------- equipment screen */

  var SHOWN_STATS = ["atk", "hp", "crit", "critDmg", "haste", "speed", "armor", "regen", "area", "bossDmg", "magnet", "xp", "gold", "luck"];
  var STAT_ICONS = { atk: "atk", hp: "hp", crit: "crit", critDmg: "critDmg", haste: "haste", speed: "speed", armor: "armor", regen: "regen", area: "area", bossDmg: "skull", magnet: "magnet", xp: "xp", gold: "coin", luck: "luck" };

  function statChips(stats) {
    return SHOWN_STATS.map(function (key, index) {
      var value = stats[key];
      if (index > 3 && !value) return "";
      var label = PS.STATS[key].name;
      return '<span class="chipstat" title="' + label + '">' + PS.icon(STAT_ICONS[key]) + "<em>" + label + "</em><b>" + statText(key, value) + "</b></span>";
    }).join("");
  }

  function slotCard(slot) {
    var item = st.equipped(slot.key);
    var S = st.get();
    var info = st.upgradeInfo(slot.key);
    if (!item) {
      return (
        '<div class="slot slot--empty" data-slot="' + slot.key + '">' +
          '<span class="tile tile--empty">' + PS.icon(slot.stat === "atk" ? "atk" : "armor") + "</span>" +
          '<div class="slot__text"><strong>' + slot.name + "</strong><span>Nothing equipped</span></div>" +
        "</div>"
      );
    }
    var cap = PS.RARITY[item.r].cap;
    var level = Math.min(S.lv[slot.key], cap);
    var atCap = S.lv[slot.key] >= cap;
    return (
      '<div class="slot" data-slot="' + slot.key + '">' +
        tile(item, { act: "item" }) +
        '<div class="slot__text">' +
          '<strong class="rname r' + item.r + '">' + esc(st.def(item).name) + "</strong>" +
          "<span>" + PS.STATS[slot.stat].name + " " + PS.fmtStat(st.mainStat(item.id, item.r, level)) + " · Lv " + level + "/" + cap + "</span>" +
        "</div>" +
        '<button class="btn btn--sm slot__up" type="button" data-act="upgrade" data-slot="' + slot.key + '" data-key="up-' + slot.key + '"' + (info.ok ? "" : " disabled") +
          ' title="' + (info.ok ? "Level up this slot" : info.reason) + '">' +
          (atCap ? (cap >= PS.RARITY[PS.MAX_RARITY].cap ? "Max" : "Forge to go on") : PS.icon("up") + price("gold", info.cost)) +
        "</button>" +
      "</div>"
    );
  }

  function bagItems() {
    var S = st.get();
    return st.sorted(S.items.filter(function (item) {
      return view.filter === "all" || st.def(item).slot === view.filter;
    }));
  }

  function filterBar() {
    var options = [["all", "All"]].concat(PS.SLOTS.map(function (slot) { return [slot.key, slot.plural]; }));
    return '<div class="filters" role="group" aria-label="Show">' + options.map(function (option) {
      return '<button class="filter" type="button" data-act="filter" data-filter="' + option[0] + '" data-key="f-' + option[0] + '" aria-pressed="' + (view.filter === option[0]) + '">' + option[1] + "</button>";
    }).join("") + "</div>";
  }

  SCREENS.gear = function () {
    if (view.forge) return forgeScreen();
    var S = st.get();
    var stats = st.calc();
    var items = bagItems();
    var canForge = st.forgeAvailable();

    return (
      '<section class="gear">' +
        '<div class="panel gear__hero">' +
          '<div class="gear__me">' +
            '<div class="gear__lemon">' + PS.art("lemon") + "</div>" +
            '<div><p class="kicker">Power</p><p class="bigpower">' + PS.icon("power") + powerShown(stats.power) + "</p></div>" +
            '<div class="gear__buttons">' +
              '<button class="btn btn--sm" type="button" data-act="equip-best" data-key="equip-best">Equip best</button>' +
              '<button class="btn btn--sm' + (st.bookInfo().ready ? " has-badge" : "") + '" type="button" data-act="book" data-key="book">' + PS.icon("book") + "Collection</button>" +
              '<button class="btn btn--sm" type="button" data-act="forge-quick" data-key="forge-quick">' + PS.icon("bolt") + "Quick forge</button>" +
              '<button class="btn btn--sm btn--primary' + (canForge ? " has-badge" : "") + '" type="button" data-act="forge-open" data-key="forge-open">' + PS.icon("forge") + "Forge</button>" +
            "</div>" +
          "</div>" +
          '<div class="chipstats">' + statChips(stats) + "</div>" +
          '<div class="slots">' + PS.SLOTS.map(slotCard).join("") + "</div>" +
          '<p class="hint">Levels belong to the slot, so they stay when you swap gear. A rarer item lets the slot go higher.</p>' +
        "</div>" +
        '<div class="panel gear__bag">' +
          '<div class="panel__head"><h2>Bag</h2><span class="count">' + S.items.length + (S.items.length === 1 ? " item" : " items") + "</span></div>" +
          filterBar() +
          (items.length
            ? '<div class="bag">' + items.map(function (item) {
                return tile(item, { act: "item", cls: (st.isEquipped(item) ? "is-eq" : "") + (item.n ? " is-new" : ""), mark: st.isEquipped(item) ? PS.icon("check") : item.n ? "new" : "" });
              }).join("") + "</div>"
            : '<p class="empty">Nothing of that kind yet. Win battles or open chests to find some.</p>') +
        "</div>" +
      "</section>"
    );
  };

  /* --------------------------------------------------------------- forge */

  /** Which of the two items about to be used up are worth a second thought:
   *  Epic or rarer, or S / SS grade. */
  function costlyMats(forge) {
    return forge.mats.map(function (u) { return st.item(u); }).filter(function (item) {
      return item && (item.r >= 3 || st.def(item).grade !== "A");
    });
  }

  /** The exact combination a confirmation was given for: pick other items
   *  and it has to be given again. */
  function forgeKey(forge) {
    return forge.main + ":" + forge.mats.join(",");
  }

  function forgeScreen() {
    var forge = view.forge;
    var main = forge.main ? st.item(forge.main) : null;
    if (forge.main && !main) {
      forge.main = 0;
      forge.mats = [];
    }
    var options = main ? st.forgeMaterials(main) : [];
    forge.mats = forge.mats.filter(function (u) {
      return options.some(function (item) { return item.u === u; });
    });
    var mats = forge.mats.map(function (u) { return st.item(u); });
    var ready = main && mats.length === 2;
    var costly = costlyMats(forge);
    var armed = costly.length > 0 && forge.armedFor === forgeKey(forge);
    var maxed = main && main.r >= PS.MAX_RARITY;

    function benchSlot(item, act, label) {
      return item ? tile(item, { act: act }) : '<span class="tile tile--empty tile--ask"><i>' + label + "</i></span>";
    }

    var result = "";
    if (main && !maxed) {
      var next = { id: main.id, r: main.r + 1, u: main.u };
      var def = st.def(main);
      var unlocked = def.perks.filter(function (perk) { return perk.at === next.r; })[0];
      var swap = {};
      swap[def.slot] = next;
      var gain = st.isEquipped(main) ? st.compute(swap).power - st.calc().power : 0;
      result =
        '<div class="forge__gain">' +
          "<p>" + rarityName(main.r) + " " + PS.icon("right") + " " + rarityName(next.r) + "</p>" +
          "<p>Level cap " + PS.RARITY[main.r].cap + " " + PS.icon("right") + " " + PS.RARITY[next.r].cap + (gain ? " · Power +" + fmt(gain) : "") + "</p>" +
          (unlocked ? '<p class="forge__perk">New perk: ' + esc(next.r === PS.MAX_RARITY ? "? ? ?" : PS.perkText(unlocked)) + "</p>" : "") +
        "</div>";
    }

    var S = st.get();
    var list;
    var note;
    if (!main) {
      list = st.sorted(S.items);
      note = "Pick the item you want to make better.";
    } else if (maxed) {
      list = [];
      note = "This one is already ???. There is nothing above that.";
    } else {
      list = options;
      note = options.length >= 2 ? "Now pick two to melt down. They must be the same slot and rarity." : "You need two more " + PS.RARITY[main.r].name + " " + PS.SLOT[st.def(main).slot].plural.toLowerCase() + " to forge this.";
    }

    return (
      '<section class="gear gear--forge">' +
        '<div class="panel forge">' +
          '<div class="panel__head">' +
            '<button class="btn btn--sm" type="button" data-act="forge-close" data-key="forge-close">' + PS.icon("left") + "Equipment</button>" +
            "<h2>Forge</h2>" +
          "</div>" +
          '<p class="forge__rule">Three items of the same slot and rarity go in. The first one comes out a rarity higher; the other two are used up.</p>' +
          '<div class="bench">' +
            '<div class="bench__in">' +
              benchSlot(main, "forge-clear", "Item") + '<span class="bench__sign">+</span>' +
              benchSlot(mats[0], "forge-unmat", "1") + '<span class="bench__sign">+</span>' +
              benchSlot(mats[1], "forge-unmat", "2") +
            "</div>" +
            '<span class="bench__arrow">' + PS.icon("right") + "</span>" +
            '<div class="bench__out">' + (main && !maxed ? tile({ id: main.id, r: main.r + 1 }, { plain: true, cls: "tile--result" + (ready ? " is-ready" : "") }) : '<span class="tile tile--empty tile--ask"><i>?</i></span>') + "</div>" +
          "</div>" +
          result +
          (costly.length
            ? '<div class="forge__warn" role="alert"><strong>' + PS.icon("lock") + " These will be destroyed for good:</strong>" +
              costly.map(function (m) {
                var d = st.def(m);
                return '<span class="rname r' + m.r + '">' + esc(fullName(m)) + (d.grade !== "A" ? " (" + d.grade + "-grade)" : "") + "</span>";
              }).join("") + "</div>"
            : "") +
          '<div class="forge__actions">' +
            '<button class="btn btn--sm" type="button" data-act="forge-quick" data-key="forge-quick-2">' + PS.icon("bolt") + "Quick forge</button>" +
            '<button class="btn btn--sm" type="button" data-act="forge-auto" data-key="forge-auto"' + (main && options.length >= 2 && mats.length < 2 ? "" : " disabled") + ">Auto-fill</button>" +
            '<button class="btn btn--primary" type="button" data-act="forge-go" data-key="forge-go"' + (ready ? "" : " disabled") + (armed ? ' data-armed="1"' : "") + ">" + PS.icon("forge") + (armed ? "Yes, melt them down" : costly.length ? "Forge…" : "Forge") + "</button>" +
          "</div>" +
        "</div>" +
        '<div class="panel gear__bag">' +
          '<p class="forge__note">' + note + "</p>" +
          '<div class="bag">' + list.map(function (item) {
            if (!main) {
              var possible = st.canForge(item);
              return tile(item, { act: "forge-main", cls: (possible ? "is-ready" : "is-dim") + (st.isEquipped(item) ? " is-eq" : ""), mark: st.isEquipped(item) ? PS.icon("check") : "" });
            }
            var picked = forge.mats.indexOf(item.u) !== -1;
            return tile(item, { act: "forge-mat", cls: picked ? "is-picked" : "", mark: picked ? PS.icon("check") : "" });
          }).join("") + "</div>" +
        "</div>" +
      "</section>"
    );
  }

  /* ---------------------------------------------------------------- shop */

  /** "0.65%", "3%", "62.35%": as many decimals as the number needs, at most two. */
  function pctText(share) {
    return String(Number((share * 100).toFixed(2))) + "%";
  }

  function oddsChips(chest) {
    var out = "";
    chest.odds.forEach(function (share, r) {
      if (share > 0) out += '<span class="odds r' + r + '">' + PS.RARITY[r].name + " " + pctText(share) + "</span>";
    });
    if (chest.special) {
      out += '<span class="odds g-' + chest.special.grade + '">' + chest.special.grade + "-grade " + PS.RARITY[chest.special.rarity].name + " " + pctText(chest.special.chance) + "</span>";
    }
    if (chest.s) out += '<span class="odds g-S">S-grade ' + pctText(chest.s) + "</span>";
    if (chest.shard) out += '<span class="odds g-SS">SS shard ' + pctText(chest.shard) + "</span>";
    return out;
  }

  function chestCard(kind) {
    var chest = PS.CHESTS[kind];
    var S = st.get();
    var one = st.chestCost(kind, 1);
    var ten = st.chestCost(kind, PS.CHEST_BULK.count);
    var hundred = st.chestCost(kind, PS.CHEST_BULK.big);
    var pity = "";
    if (chest.pityS) {
      pity = '<p class="pity">S-grade guaranteed within ' + (chest.pityS - S.shop.pityS) + " · SS-grade within " + (chest.pitySS - S.shop.pitySS) + "</p>";
    }
    return (
      '<div class="panel chest chest--' + kind + '">' +
        '<button class="chest__info" type="button" data-act="chest-info" data-kind="' + kind + '" data-key="info-' + kind + '" aria-label="What can the ' + esc(chest.name) + ' hold?" title="What can it hold?">?</button>' +
        '<div class="chest__art">' + PS.art(kind) + "</div>" +
        '<div class="chest__body">' +
          "<h3>" + chest.name + "</h3>" +
          "<p>" + chest.text + "</p>" +
          '<div class="oddsrow">' + oddsChips(chest) + "</div>" + pity +
          '<div class="chest__buy">' +
            '<button class="btn btn--primary" type="button" data-act="chest" data-kind="' + kind + '" data-count="1" data-key="chest-' + kind + '-1"' + (S.gems >= one ? "" : " disabled") + ">Open " + price("gems", one) + "</button>" +
            '<button class="btn" type="button" data-act="chest" data-kind="' + kind + '" data-count="' + PS.CHEST_BULK.count + '" data-key="chest-' + kind + '-10"' + (S.gems >= ten ? "" : " disabled") + ">Open " + PS.CHEST_BULK.count + " " + price("gems", ten) + "</button>" +
            '<button class="btn" type="button" data-act="chest" data-kind="' + kind + '" data-count="' + PS.CHEST_BULK.big + '" data-key="chest-' + kind + '-100"' + (S.gems >= hundred ? "" : " disabled") + ">Open " + PS.CHEST_BULK.big + " " + price("gems", hundred) + "</button>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function eggCard() {
    var S = st.get();
    var one = st.eggCost(1);
    var many = st.eggCost(PS.EGG.bulk.count);
    var odds = PS.EGG.odds.map(function (share, r) {
      return '<span class="odds r' + r + '">' + PS.RARITY[r].name + " " + pctText(share) + "</span>";
    }).join("");
    return (
      '<div class="panel chest chest--egg">' +
        '<div class="chest__art">' + PS.petArt("egg") + "</div>" +
        '<div class="chest__body">' +
          "<h3>Pet egg</h3>" +
          "<p>Hatches a pet that fights beside you. Hatching one you already have levels it up.</p>" +
          '<div class="oddsrow">' + odds + "</div>" +
          '<div class="chest__buy">' +
            '<button class="btn btn--primary" type="button" data-act="egg" data-count="1" data-key="egg-1"' + (S.gems >= one ? "" : " disabled") + ">Hatch " + price("gems", one) + "</button>" +
            '<button class="btn" type="button" data-act="egg" data-count="' + PS.EGG.bulk.count + '" data-key="egg-10"' + (S.gems >= many ? "" : " disabled") + ">Hatch " + PS.EGG.bulk.count + " " + price("gems", many) + "</button>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function untilMidnight() {
    var now = new Date();
    var next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return next - now;
  }

  /** One reward in words, short enough for a calendar cell. */
  function dailyText(r) {
    var parts = [];
    if (r.gems) parts.push(price("gems", r.gems));
    if (r.gold) parts.push(price("gold", r.gold));
    if (r.chest) parts.push('<span class="daily__chest">' + r.count + " × " + esc(PS.CHESTS[r.chest].name) + "</span>");
    return parts.join("");
  }

  function dailyCard() {
    var info = st.dailyInfo();
    var cells = info.rewards.map(function (r, i) {
      var n = i + 1;
      // days before today's are done; today's is either waiting or just claimed
      var state = n < info.day || (n === info.day && !info.ready) ? "is-done" : n === info.day ? "is-today" : "";
      return (
        '<li class="daily__day ' + state + (n === PS.DAILY.length ? " is-big" : "") + '">' +
          "<b>Day " + n + "</b>" +
          '<span class="daily__art">' + (state === "is-done" ? PS.icon("check") : PS.icon(r.chest ? "gift" : r.gems ? "gem" : "coin")) + "</span>" +
          '<span class="daily__what">' + dailyText(r) + "</span>" +
        "</li>"
      );
    }).join("");
    return (
      '<div class="panel daily' + (info.ready ? " is-ready" : "") + '">' +
        '<div class="daily__head"><div><h3>Daily rewards</h3><p>' +
          (info.ready
            ? "Day " + info.day + " is waiting. Come back every day to reach the big one on day " + PS.DAILY.length + "."
            : "Claimed for today. Day " + ((info.day % PS.DAILY.length) + 1) + ' opens in <b data-countdown="deals">' + PS.countdown(untilMidnight()) + "</b>. Miss a day and it starts again.") +
          "</p></div>" +
          (info.ready ? '<button class="btn btn--primary" type="button" data-act="daily" data-key="daily">Claim day ' + info.day + "</button>" : "") +
        "</div>" +
        '<ol class="daily__days">' + cells + "</ol>" +
      "</div>"
    );
  }

  SCREENS.shop = function () {
    var S = st.get();
    var wait = st.giftWait();
    var pack = st.goldPack();
    var deals = st.deals();

    return (
      '<section class="shop">' +
        '<div class="panel gift' + (wait ? "" : " is-ready") + '">' +
          '<div class="gift__art">' + PS.art("gift") + "</div>" +
          '<div class="gift__body"><h3>Free gift</h3><p>A piece of gear, some gold and ' + PS.GIFT.gems + " gems, every four hours.</p></div>" +
          (wait
            ? '<span class="gift__wait">' + PS.icon("clock") + '<b data-countdown="gift">' + PS.countdown(wait) + "</b></span>"
            : '<button class="btn btn--primary" type="button" data-act="gift" data-key="gift">Claim</button>') +
        "</div>" +

        dailyCard() +

        '<h2 class="section">Chests</h2>' +
        '<div class="chests">' + chestCard("crate") + chestCard("gilded") + "</div>" +
        '<p class="hint">Chests cost gems. The odds and the price never change, however far you get. A chest never holds an SS-grade item itself.</p>' +
        '<div class="panel gift shards' + (S.shards >= PS.SHARDS.needed ? " is-ready" : "") + '">' +
          '<div class="gift__art">' + PS.art("gold") + "</div>" +
          '<div class="gift__body"><h3>SS shards <span class="count">' + S.shards + "/" + PS.SHARDS.needed + "</span></h3>" +
            "<p>Gather " + PS.SHARDS.needed + " from Gilded Chests to craft one " + PS.RARITY[PS.SHARDS.rarity].name + " SS-grade item.</p>" +
            '<div class="bar"><i style="width:' + Math.min(100, (S.shards / PS.SHARDS.needed) * 100) + '%"></i></div></div>' +
          '<button class="btn btn--primary" type="button" data-act="craft" data-key="craft"' + (S.shards >= PS.SHARDS.needed ? "" : " disabled") + ">Craft</button>" +
        "</div>" +

        '<h2 class="section">Pet eggs</h2>' +
        eggCard() +

        '<h2 class="section">Today\'s deals <small>' + PS.icon("clock") + '<span data-countdown="deals">' + PS.countdown(untilMidnight()) + "</span></small></h2>" +
        '<div class="deals">' + deals.map(function (deal) {
          var def = PS.ITEMS[deal.id];
          var afford = S[deal.cur] >= deal.price;
          return (
            '<div class="panel deal' + (deal.bought ? " is-sold" : "") + '">' +
              tile(deal, { plain: true }) +
              '<strong class="rname r' + deal.r + '">' + esc(def.name) + "</strong>" +
              "<span>" + PS.RARITY[deal.r].name + " " + PS.SLOT[def.slot].name.toLowerCase() + "</span>" +
              (deal.bought
                ? '<span class="deal__sold">Sold</span>'
                : '<button class="btn btn--sm' + (afford ? " btn--primary" : "") + '" type="button" data-act="deal" data-index="' + deal.index + '" data-key="deal-' + deal.index + '"' + (afford ? "" : " disabled") + ">" + price(deal.cur, deal.price) + "</button>") +
            "</div>"
          );
        }).join("") + "</div>" +

        '<h2 class="section">Gold</h2>' +
        '<div class="panel gift">' +
          '<div class="gift__art">' + PS.art("gold") + "</div>" +
          '<div class="gift__body"><h3>Sack of gold</h3><p>' + fmt(pack.gold) + " gold, about two battles' worth.</p></div>" +
          '<button class="btn btn--primary" type="button" data-act="gold" data-key="gold"' + (S.gems >= pack.gems ? "" : " disabled") + ">" + price("gems", pack.gems) + "</button>" +
        "</div>" +

        '<h2 class="section">Casino</h2>' +
        '<div class="chests">' +
          casinoCard("blackjack", "cards", "Blackjack", "Beat the dealer to 21 without going over. Blackjack pays 3 to 2.") +
          casinoCard("spinner", "wheel", "Black &amp; White", "Pick black or white and spin. A 50-50 shot at doubling your bet.") +
        "</div>" +
        '<p class="hint">Played for gold. Your bet leaves your gold when the cards are dealt or the wheel spins, and any winnings come straight back.</p>' +
      "</section>"
    );
  };

  /* -------------------------------------------------------------- casino */

  var SUITS = [["♠", "spades", false], ["♥", "hearts", true], ["♦", "diamonds", true], ["♣", "clubs", false]];
  var RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  var RANK_NAMES = ["Ace", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Jack", "Queen", "King"];
  var WHEEL = { wedges: 16, turns: 6, ms: 4200 };
  var BET_CHIPS = [[0.1, "10%"], [0.25, "25%"], [0.5, "50%"], [1, "All in"]];

  function casinoCard(game, art, title, text) {
    return (
      '<div class="panel gift">' +
        '<div class="gift__art">' + PS.art(art) + "</div>" +
        '<div class="gift__body"><h3>' + title + "</h3><p>" + text + "</p></div>" +
        '<button class="btn btn--primary" type="button" data-act="casino" data-game="' + game + '" data-key="casino-' + game + '">Play</button>' +
      "</div>"
    );
  }

  /** The bet in the box: a tenth of your gold until you type or pick one. */
  function betNow() {
    var c = view.casino;
    if (c.bet === null) c.bet = Math.max(1, Math.floor(st.get().gold / 10));
    return c.bet;
  }

  /** True when the bet can be placed; otherwise says why. */
  function betOk(bet) {
    var gold = st.get().gold;
    if (!(bet >= 1)) toast("Bet at least 1 gold");
    else if (bet > gold) toast("You only have " + fmt(gold) + " gold");
    else return true;
    PS.sfx.play("deny");
    return false;
  }

  function betBox(locked) {
    var gold = st.get().gold;
    var off = locked || gold < 1 ? " disabled" : "";
    return (
      '<div class="bet">' +
        '<label class="bet__field">' + PS.icon("coin") + '<span class="visually-hidden">Bet</span>' +
          '<input id="cas-bet" type="number" inputmode="numeric" min="1" max="' + gold + '" step="1" value="' + betNow() + '"' + off + " /></label>" +
        '<div class="bet__chips" role="group" aria-label="Bet part of your gold">' + BET_CHIPS.map(function (chip) {
          return '<button class="btn btn--sm" type="button" data-act="bet" data-share="' + chip[0] + '" data-key="bet-' + chip[0] + '"' + off + ">" + chip[1] + "</button>";
        }).join("") + "</div>" +
      "</div>" +
      '<p class="bet__have">' + (gold < 1 ? "You have no gold to bet. Win some in a battle first." : "You have " + price("gold", gold)) + "</p>"
    );
  }

  /** Redraw a casino pop-up if it is the one open, keeping the focus on its
   *  buttons. Winnings are paid first, which redraws everything through
   *  "change" (a second redraw would cut short the newest card sliding in). */
  function paintCasino(type, owner, winnings) {
    var open = view.modal && view.modal.type === type;
    var focused = document.activeElement && document.activeElement.getAttribute ? document.activeElement.getAttribute("data-key") : null;
    if (winnings && owner === st.get()) st.payout(owner, winnings);
    else if (open) renderModal();
    if (!open) return;
    var again = focused ? el.modal.querySelector('[data-key="' + focused + '"]') : null;
    if (!again || again.disabled) again = el.modal.querySelector(".casino .btn--primary:not(:disabled)");
    if (again) again.focus();
  }

  /* --- blackjack */

  function newDeck() {
    var deck = [];
    for (var s = 0; s < 4; s++) for (var r = 0; r < 13; r++) deck.push({ r: r, s: s });
    for (var i = deck.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = deck[i];
      deck[i] = deck[j];
      deck[j] = t;
    }
    return deck;
  }

  /** A hand's best total, and whether an ace in it still counts as 11. */
  function handValue(cards) {
    var total = 0;
    var aces = 0;
    cards.forEach(function (c) {
      total += c.r === 0 ? 11 : Math.min(10, c.r + 1);
      if (c.r === 0) aces++;
    });
    while (total > 21 && aces) {
      total -= 10;
      aces--;
    }
    return { total: total, soft: aces > 0 };
  }

  function isBlackjack(cards) {
    return cards.length === 2 && handValue(cards).total === 21;
  }

  function handLabel(cards) {
    if (isBlackjack(cards)) return "Blackjack";
    var v = handValue(cards);
    if (v.total > 21) return v.total + " · bust";
    return (v.soft ? "Soft " : "") + v.total;
  }

  /** One hand of cards. Cards past `seen` were just dealt and slide in. */
  function cardRow(cards, seen, holeDown) {
    return cards.map(function (card, i) {
      var fresh = i >= seen ? " is-new" : "";
      if (holeDown && i === 1) return '<span class="pcard pcard--back' + fresh + '" role="img" aria-label="Face-down card"></span>';
      var suit = SUITS[card.s];
      return (
        '<span class="pcard' + (suit[2] ? " pcard--red" : "") + fresh + '" role="img" aria-label="' + RANK_NAMES[card.r] + " of " + suit[1] + '">' +
          "<b>" + RANKS[card.r] + "</b><i>" + suit[0] + "</i>" +
        "</span>"
      );
    }).join("");
  }

  var BJ_RESULTS = {
    blackjack: ["good", "Blackjack!"],
    win: ["good", "You beat the dealer!"],
    dealerbust: ["good", "The dealer busts!"],
    push: ["even", "Push."],
    bust: ["bad", "Bust!"],
    dealerbj: ["bad", "The dealer has blackjack."],
    lose: ["bad", "The dealer wins."]
  };

  function blackjackModal() {
    var bj = view.casino.bj;
    if (bj && bj.owner !== st.get()) bj = view.casino.bj = null; // someone else has logged in since
    var gold = st.get().gold;
    var live = bj && bj.phase !== "done";
    var holeDown = bj && bj.phase === "play";
    var table = "";
    if (bj) {
      var dealerShown = holeDown ? [bj.dealer[0]] : bj.dealer;
      var seenD = holeDown || bj.holeUp ? bj.seenD : Math.min(bj.seenD, 1); // the hole card turning over counts as new
      table =
        '<div class="felt">' +
          '<div class="felt__hand"><p class="felt__who">Dealer <b>' + handLabel(dealerShown) + "</b></p>" +
            '<div class="felt__cards">' + cardRow(bj.dealer, seenD, holeDown) + "</div></div>" +
          '<div class="felt__hand"><p class="felt__who">You <b>' + handLabel(bj.player) + "</b>" +
            '<span class="felt__bet">' + price("gold", bj.bet) + (bj.doubled ? " doubled" : "") + "</span></p>" +
            '<div class="felt__cards">' + cardRow(bj.player, bj.seenP, false) + "</div></div>" +
        "</div>";
      bj.seenP = bj.player.length;
      bj.seenD = bj.dealer.length;
      if (!holeDown) bj.holeUp = true;
    }
    var result = "";
    if (bj && bj.phase === "done") {
      var r = BJ_RESULTS[bj.result];
      var net = bj.back - bj.bet;
      result =
        '<p class="casino__result casino__result--' + r[0] + '" role="status">' + r[1] + " " +
          (net > 0 ? "You win " + price("gold", net) : net < 0 ? "You lose " + price("gold", -net) : "Your bet comes back.") + "</p>";
    }
    var controls;
    if (live) {
      var canDouble = bj.phase === "play" && bj.player.length === 2 && gold >= bj.bet;
      controls =
        '<div class="modal__actions casino__play">' +
          '<button class="btn" type="button" data-act="bj-double" data-key="bj-double"' + (canDouble ? "" : " disabled") + ">Double " + price("gold", bj.bet) + "</button>" +
          '<button class="btn" type="button" data-act="bj-stand" data-key="bj-stand"' + (bj.phase === "play" ? "" : " disabled") + ">Stand</button>" +
          '<button class="btn btn--primary" type="button" data-act="bj-hit" data-key="bj-hit"' + (bj.phase === "play" ? " autofocus" : " disabled") + ">Hit</button>" +
        "</div>" +
        (bj.phase === "dealer" ? '<p class="hint">The dealer draws to 17…</p>' : "");
    } else {
      controls =
        betBox(false) +
        '<div class="modal__actions"><button class="btn btn--primary" type="button" data-act="bj-deal" data-key="bj-deal"' + (gold < 1 ? " disabled" : "") + ">" +
          (bj ? "Deal again" : "Deal") + "</button></div>";
    }
    return (
      '<div class="casino">' +
        '<button class="modal__close" type="button" data-act="close" aria-label="Close">' + PS.icon("close") + "</button>" +
        '<h2 id="modal-title">Blackjack</h2>' +
        '<p class="casino__rules">Get closer to 21 than the dealer without going over. Picture cards count 10, an ace 1 or 11. The dealer draws to 17. Blackjack pays 3 to 2.</p>' +
        table + result + controls +
      "</div>"
    );
  }

  function bjDeal() {
    var bet = betNow();
    if (!betOk(bet)) return;
    var owner = st.stake(bet);
    if (!owner) return;
    var deck = newDeck();
    var bj = view.casino.bj = { deck: deck, player: [], dealer: [], bet: bet, owner: owner, phase: "play", seenP: 0, seenD: 0, holeUp: false };
    bj.player.push(deck.pop());
    bj.dealer.push(deck.pop());
    bj.player.push(deck.pop());
    bj.dealer.push(deck.pop());
    PS.sfx.play("click");
    if (isBlackjack(bj.player) || isBlackjack(bj.dealer)) bjSettle();
    else paintCasino("blackjack");
  }

  function bjHit() {
    var bj = view.casino.bj;
    if (!bj || bj.phase !== "play") return;
    bj.player.push(bj.deck.pop());
    var total = handValue(bj.player).total;
    if (total > 21) bjSettle();
    else if (total === 21) bjDealer();
    else paintCasino("blackjack");
  }

  function bjDouble() {
    var bj = view.casino.bj;
    if (!bj || bj.phase !== "play" || bj.player.length !== 2) return;
    if (st.get().gold < bj.bet) return;
    st.stake(bj.bet);
    bj.bet *= 2;
    bj.doubled = true;
    bj.player.push(bj.deck.pop());
    if (handValue(bj.player).total > 21) bjSettle();
    else bjDealer();
  }

  /** Turn the hole card over, then draw a card at a time until 17 or more. */
  function bjDealer() {
    var bj = view.casino.bj;
    bj.phase = "dealer";
    paintCasino("blackjack");
    var wait = PS.reducedMotion() ? 250 : 650;
    (function step() {
      setTimeout(function () {
        if (view.casino.bj !== bj) return;
        if (handValue(bj.dealer).total >= 17) {
          bjSettle();
          return;
        }
        bj.dealer.push(bj.deck.pop());
        PS.sfx.play("click");
        paintCasino("blackjack");
        step();
      }, wait);
    })();
  }

  function bjSettle() {
    var bj = view.casino.bj;
    var p = handValue(bj.player).total;
    var d = handValue(bj.dealer).total;
    var pBJ = isBlackjack(bj.player);
    var dBJ = isBlackjack(bj.dealer);
    var result;
    var back = 0;
    if (p > 21) result = "bust";
    else if (pBJ && dBJ) { result = "push"; back = bj.bet; }
    else if (pBJ) { result = "blackjack"; back = bj.bet + Math.floor(bj.bet * 1.5); }
    else if (dBJ) result = "dealerbj";
    else if (d > 21) { result = "dealerbust"; back = bj.bet * 2; }
    else if (p > d) { result = "win"; back = bj.bet * 2; }
    else if (p === d) { result = "push"; back = bj.bet; }
    else result = "lose";
    bj.phase = "done";
    bj.result = result;
    bj.back = back;
    PS.sfx.play(result === "blackjack" ? "win" : back > bj.bet ? "coin" : back ? "click" : "deny");
    paintCasino("blackjack", bj.owner, back);
  }

  /* --- black & white */

  function spinnerModal() {
    var bw = view.casino.bw;
    var gold = st.get().gold;
    var spinning = Boolean(bw.spinning);
    var pick = spinning ? bw.spinning.pick : bw.pick;
    var last = bw.last;
    var result = last
      ? '<p class="casino__result casino__result--' + (last.won ? "good" : "bad") + '" role="status">' +
          "It landed on " + last.land + ". " + (last.won ? "You win " + price("gold", last.bet) : "You lose " + price("gold", last.bet)) + "</p>"
      : spinning
        ? '<p class="casino__result" role="status">Spinning for ' + price("gold", bw.spinning.bet) + " on " + bw.spinning.pick + "…</p>"
        : "";
    var history = bw.history.length
      ? '<div class="spin__history" aria-label="Last spins">' + bw.history.map(function (c) {
          return '<i class="spin__dot spin__dot--' + c + '" title="' + c + '"></i>';
        }).join("") + "</div>"
      : "";
    return (
      '<div class="casino">' +
        '<button class="modal__close" type="button" data-act="close" aria-label="Close">' + PS.icon("close") + "</button>" +
        '<h2 id="modal-title">Black &amp; White</h2>' +
        '<p class="casino__rules">Half the wheel is black and half is white. Pick a colour and spin: if it stops on yours, your bet comes back doubled.</p>' +
        '<div class="spin">' +
          '<span class="spin__pointer" aria-hidden="true"></span>' +
          '<div class="spin__wheel" style="transform:rotate(' + bw.angle + 'deg)" aria-hidden="true"><span class="spin__hub"></span></div>' +
        "</div>" +
        history + result +
        '<div class="spin__picks" role="group" aria-label="Your colour">' +
          ["black", "white"].map(function (c) {
            return '<button class="spin__pick spin__pick--' + c + (pick === c ? " is-on" : "") + '" type="button" data-act="bw-pick" data-pick="' + c + '" data-key="bw-' + c + '" aria-pressed="' + (pick === c) + '"' + (spinning ? " disabled" : "") + ">" +
              (c === "black" ? "Black" : "White") + "</button>";
          }).join("") +
        "</div>" +
        betBox(spinning) +
        '<div class="modal__actions"><button class="btn btn--primary" type="button" data-act="bw-spin" data-key="bw-spin"' + (spinning || gold < 1 ? " disabled" : "") + ">Spin</button></div>" +
      "</div>"
    );
  }

  function bwSpin() {
    var bw = view.casino.bw;
    if (bw.spinning) return;
    var bet = betNow();
    if (!betOk(bet)) return;
    var owner = st.stake(bet);
    if (!owner) return;
    var land = Math.random() < 0.5 ? "black" : "white";
    // wedge 0 (black) starts under the pointer; every other one is white
    var wedge = Math.floor(Math.random() * (WHEEL.wedges / 2)) * 2 + (land === "white" ? 1 : 0);
    var size = 360 / WHEEL.wedges;
    var at = (wedge + 0.15 + Math.random() * 0.7) * size; // never right on a line
    var target = bw.angle - (bw.angle % 360) + 360 * WHEEL.turns + ((360 - at) % 360);
    var spin = bw.spinning = { bet: bet, pick: bw.pick, land: land, owner: owner };
    bw.last = null;
    paintCasino("spinner");
    bw.angle = target;
    var quick = PS.reducedMotion();
    var wheel = $(".spin__wheel");
    if (wheel) {
      void wheel.offsetWidth; // start from where it was drawn
      if (!quick) wheel.classList.add("is-spinning");
      wheel.style.transform = "rotate(" + target + "deg)";
    }
    PS.sfx.play("click");
    setTimeout(function () { bwLand(spin); }, quick ? 400 : WHEEL.ms);
  }

  function bwLand(spin) {
    var bw = view.casino.bw;
    if (bw.spinning !== spin) return;
    bw.spinning = null;
    var won = spin.land === spin.pick;
    bw.last = { land: spin.land, bet: spin.bet, won: won };
    bw.history.unshift(spin.land);
    if (bw.history.length > 12) bw.history.length = 12;
    PS.sfx.play(won ? "coin" : "deny");
    paintCasino("spinner", spin.owner, won ? spin.bet * 2 : 0);
  }

  /* ------------------------------------------------------------- talents */

  function talentCard(talent) {
    var info = st.talentInfo(talent.id);
    var now;
    var each;
    if (talent.stat) {
      each = talent.text || "+" + PS.pct(talent.per) + " " + PS.STATS[talent.stat].phrase + " a level";
      now = info.level ? "Now +" + PS.pct(talent.per * info.level) + (talent.stat === "regen" ? " a second" : "") : "Not learned yet";
    } else {
      each = talent.text;
      now = info.level ? "Now " + info.level + (info.level === 1 ? " free upgrade" : " free upgrades") : "Not learned yet";
    }
    return (
      '<div class="panel talent' + (info.maxed ? " is-max" : "") + '">' +
        '<span class="talent__icon">' + PS.icon(talent.icon) + "</span>" +
        '<div class="talent__body">' +
          "<h3>" + talent.name + ' <span class="count">' + info.level + "/" + talent.max + "</span></h3>" +
          "<p>" + each + "</p>" +
          '<p class="talent__now">' + now + "</p>" +
          '<div class="bar"><i style="width:' + (info.level / talent.max) * 100 + '%"></i></div>' +
        "</div>" +
        (info.maxed
          ? '<span class="talent__done">' + PS.icon("check") + "Max</span>"
          : '<button class="btn btn--sm' + (info.ok ? " btn--primary" : "") + '" type="button" data-act="talent" data-id="' + talent.id + '" data-key="talent-' + talent.id + '"' + (info.ok ? "" : " disabled") + ">" + price("gold", info.cost) + "</button>") +
      "</div>"
    );
  }

  var TIER_NUMERALS = ["I", "II", "III", "IV", "V"];

  SCREENS.talents = function () {
    var asc = st.ascendInfo();
    var banner;
    if (asc.can) {
      banner =
        '<div class="panel ascend is-ready">' +
          '<div class="ascend__art">' + PS.icon("up") + "</div>" +
          '<div class="ascend__body"><h3>Every talent is maxed!</h3>' +
            "<p>Ascend to unlock " + asc.unlocks + " stronger talents in tier " + TIER_NUMERALS[asc.tier] + ". Everything you have learned stays.</p></div>" +
          '<button class="btn btn--primary" type="button" data-act="ascend" data-key="ascend">Ascend</button>' +
        "</div>";
    } else if (asc.top) {
      banner =
        '<div class="panel ascend"><div class="ascend__art">' + PS.icon("check") + "</div>" +
          '<div class="ascend__body"><h3>Top tier</h3><p>' + (asc.maxed === asc.total ? "Every talent in the game is maxed." : "Max every talent below. There is nothing above this tier.") + "</p></div>" +
          '<span class="count">' + asc.maxed + "/" + asc.total + "</span></div>";
    } else {
      banner =
        '<div class="panel ascend"><div class="ascend__art">' + PS.icon("up") + "</div>" +
          '<div class="ascend__body"><h3>Ascend</h3><p>Max every talent in this tier to unlock tier ' + TIER_NUMERALS[asc.tier] +
            " with " + asc.unlocks + " stronger talents.</p>" +
            '<div class="bar"><i style="width:' + (asc.maxed / asc.total) * 100 + '%"></i></div></div>' +
          '<span class="count">' + asc.maxed + "/" + asc.total + "</span></div>";
    }
    var out = '<section class="talents">' +
      '<p class="lead">Talents are bought with gold and kept for good. They work in every battle, whatever you are wearing.</p>' + banner;
    // the newest tier first, so what was just unlocked is at the top
    for (var tier = asc.tier; tier >= 1; tier--) {
      out +=
        '<h2 class="section">Tier ' + TIER_NUMERALS[tier - 1] + " <small>" + PS.TALENT_TIER_NAMES[tier - 1] + "</small></h2>" +
        '<div class="talentgrid">' + PS.TALENTS.filter(function (t) { return t.tier === tier; }).map(talentCard).join("") + "</div>";
    }
    return out + "</section>";
  };

  /* ---------------------------------------------------------------- pets */

  function petBonusText(sp, r, level) {
    var def = PS.PET[sp];
    return "+" + PS.pct(PS.petBonus(sp, r, level)) + " " + PS.STATS[def.stat].phrase;
  }

  function petCard(pet) {
    var info = st.petInfo(pet.u);
    var def = info.def;
    return (
      '<div class="panel pet' + (info.equipped ? " is-eq" : "") + '">' +
        '<div class="pet__art">' + PS.petArt(pet.sp, pet.r) + "</div>" +
        '<div class="pet__body">' +
          "<h3>" + def.name + ' <span class="rname r' + pet.r + '">' + PS.RARITY[pet.r].name + "</span></h3>" +
          '<p class="pet__lv">Level ' + pet.lv + " / " + info.cap + "</p>" +
          "<p>" + petBonusText(pet.sp, pet.r, pet.lv) + "</p>" +
          '<div class="bar"><i style="width:' + (pet.lv / info.cap) * 100 + '%"></i></div>' +
        "</div>" +
        '<div class="pet__acts">' +
          (info.equipped
            ? '<button class="btn btn--sm" type="button" data-act="pet-equip" data-u="' + pet.u + '" data-key="pet-eq-' + pet.u + '">With you</button>'
            : '<button class="btn btn--sm btn--primary" type="button" data-act="pet-equip" data-u="' + pet.u + '" data-key="pet-eq-' + pet.u + '">Bring</button>') +
          (info.maxed
            ? '<span class="talent__done">' + PS.icon("check") + "Max</span>"
            : '<button class="btn btn--sm' + (info.ok ? "" : "") + '" type="button" data-act="pet-level" data-u="' + pet.u + '" data-key="pet-lv-' + pet.u + '"' + (info.ok ? "" : " disabled") + ">" + PS.icon("up") + price("gold", info.cost) + "</button>") +
        "</div>" +
      "</div>"
    );
  }

  SCREENS.pets = function () {
    var S = st.get();
    var pets = S.pets.slice().sort(function (a, b) { return b.r - a.r || b.lv - a.lv || (a.sp < b.sp ? -1 : 1); });
    var total = PS.PET_SPECIES.length * PS.PET_RARITY.length;
    var crew = st.petTeam();
    var lead;
    var nextCost = st.petSlotCost();
    var slots = "";
    for (var i = 0; i < PS.PET_SLOTS.max; i++) {
      var member = crew[i];
      if (member) {
        slots += '<div class="petslot is-full">' + PS.petArt(member.sp, member.r) + "<b>" + PS.PET[member.sp].name + " · Lv " + member.lv + "</b><span>" +
          petBonusText(member.sp, member.r, member.lv) + "</span></div>";
      } else if (i < S.petSlots) {
        slots += '<div class="petslot is-empty">' + PS.petArt("egg") + "<b>Empty</b><span>Bring a pet from below</span></div>";
      } else {
        var next = i === S.petSlots;
        slots += '<div class="petslot is-locked">' + PS.icon("lock") + "<b>Slot " + (i + 1) + "</b>" +
          (next
            ? '<button class="btn btn--sm btn--primary" type="button" data-act="pet-slot" data-key="pet-slot"' + (S.gems >= nextCost ? "" : " disabled") + ">Unlock " + price("gems", nextCost) + "</button>"
            : "<span>Unlock the one before first</span>") +
          "</div>";
      }
    }
    if (S.pets.length) {
      lead =
        '<div class="panel petteam">' +
          '<p class="kicker">Your team · ' + crew.length + " of " + S.petSlots + " out" + (S.petSlots < PS.PET_SLOTS.max ? "" : " · all slots open") + "</p>" +
          '<div class="petslots">' + slots + "</div>" +
          '<p class="hint">Each pet in your team fights beside you and adds its bonus. More slots can be unlocked with gems, up to ' + PS.PET_SLOTS.max + ".</p>" +
        "</div>";
    } else {
      lead =
        '<div class="panel pethero">' +
          '<div class="pethero__art">' + PS.petArt("egg") + "</div>" +
          '<div class="pethero__body"><p class="kicker">No pet yet</p><h2>Hatch your first pet</h2>' +
            "<p>Pet eggs are in the Shop and cost gems. A pet fights beside you and gives you a bonus.</p>" +
            '<button class="btn btn--primary btn--sm" type="button" data-act="tab" data-tab="shop" data-key="pet-shop">Go to the Shop</button></div>' +
        "</div>";
    }
    var found = PS.PET_SPECIES.map(function (sp) {
      var have = S.pets.filter(function (pet) { return pet.sp === sp.id; }).length;
      return '<span class="chip pet__tag' + (have ? " is-have" : "") + '">' + PS.petArt(sp.id, have ? undefined : undefined) + "<em>" + sp.name + "</em><b>" + have + "</b></span>";
    }).join("");
    return (
      '<section class="pets">' +
        lead +
        '<h2 class="section">Your pets <small>' + S.pets.length + " of " + total + " found</small></h2>" +
        (pets.length
          ? '<div class="petgrid">' + pets.map(petCard).join("") + "</div>"
          : '<p class="empty">Nothing hatched yet. Buy an egg in the Shop.</p>') +
        '<h2 class="section">The family</h2>' +
        '<div class="pettags">' + found + "</div>" +
        '<p class="hint">Hatching a pet you already have levels it up. Gold levels a pet up too. Commons reach level 10, Uncommons 20, Rares 30 and Epics 40. Pets are never S or SS grade.</p>' +
      "</section>"
    );
  };

  /* -------------------------------------------------------------- quests */

  SCREENS.quests = function () {
    var list = st.quests();
    // things to claim first, finished ladders last
    list.sort(function (a, b) { return (b.ready ? 1 : 0) - (a.ready ? 1 : 0) || (a.done ? 1 : 0) - (b.done ? 1 : 0); });
    return (
      '<section class="quests">' +
        '<p class="lead">Finish a goal, claim the gems, and the next one appears.</p>' +
        list.map(function (quest) {
          return (
            '<div class="panel quest' + (quest.ready ? " is-ready" : "") + (quest.done ? " is-done" : "") + '">' +
              '<div class="quest__body">' +
                "<h3>" + quest.name + ' <span class="count">' + (quest.done ? quest.tiers : quest.tier) + "/" + quest.tiers + "</span></h3>" +
                "<p>" + (quest.done ? "All done." : esc(quest.text)) + "</p>" +
                (quest.done ? "" : '<div class="bar"><i style="width:' + Math.min(100, (quest.value / quest.target) * 100) + '%"></i></div>' +
                  '<span class="quest__num">' + fmt(quest.value) + " / " + fmt(quest.target) + "</span>") +
              "</div>" +
              (quest.done
                ? '<span class="talent__done">' + PS.icon("check") + "</span>"
                : '<button class="btn btn--sm' + (quest.ready ? " btn--primary" : "") + '" type="button" data-act="quest" data-id="' + quest.id + '" data-key="quest-' + quest.id + '"' + (quest.ready ? "" : " disabled") + ">" + price("gems", quest.gems) + "</button>") +
            "</div>"
          );
        }).join("") +
      "</section>"
    );
  };

  /* -------------------------------------------------------------- pop-ups */

  function openModal(modal) {
    view.modal = modal;
    renderModal();
    if (!el.modal.open) el.modal.showModal();
    bumpNotes(); // a pop-up still showing stays above the window just opened
  }

  function closeModal() {
    view.modal = null;
    if (el.modal.open) el.modal.close();
  }

  function perkList(item) {
    var def = st.def(item);
    var out = "";
    if (def.innate) {
      out += '<li class="perk is-on"><span class="perk__when">Always</span><span>' + esc(def.innate.text || PS.statsText(def.innate.s || {})) + "</span></li>";
    }
    def.perks.forEach(function (perk) {
      var on = item.r >= perk.at;
      var secret = perk.at === PS.MAX_RARITY && !on;
      out +=
        '<li class="perk' + (on ? " is-on" : "") + '">' +
          '<span class="perk__when rname r' + perk.at + '">' + PS.RARITY[perk.at].name + (on ? "" : PS.icon("lock")) + "</span>" +
          "<span>" + (secret ? "? ? ?" : esc(PS.perkText(perk))) + "</span>" +
        "</li>";
    });
    return out;
  }

  function itemModal(u, modal) {
    var item = st.item(u);
    if (!item) return null;
    var def = st.def(item);
    var slot = PS.SLOT[def.slot];
    var S = st.get();
    var worn = st.isEquipped(item);
    var level = st.levelFor(item);
    var cap = PS.RARITY[item.r].cap;
    var delta = worn ? 0 : st.powerDelta(item);
    var info = st.upgradeInfo(def.slot);
    var grade = PS.GRADE[def.grade].label;
    var value = st.sellValue(item);

    return (
      '<div class="itemsheet r' + item.r + '">' +
        '<button class="modal__close" type="button" data-act="close" aria-label="Close">' + PS.icon("close") + "</button>" +
        '<div class="itemsheet__head">' +
          tile(item, { plain: true, cls: "tile--big" }) +
          "<div>" +
            '<h2 id="modal-title" class="rname r' + item.r + '">' + esc(def.name) + "</h2>" +
            '<p class="itemsheet__kind">' + rarityName(item.r) + " " + slot.name.toLowerCase() + (grade ? ' · <span class="rname g-' + def.grade + '">' + grade + "</span>" : "") + (worn ? " · equipped" : "") + "</p>" +
            '<p class="itemsheet__stat">' + PS.icon(slot.stat === "atk" ? "atk" : "hp") + "<b>" + PS.fmtStat(st.mainStat(item.id, item.r, level)) + "</b> " + PS.STATS[slot.stat].phrase +
              ' <span class="count">Lv ' + level + "/" + cap + "</span></p>" +
            (delta ? '<p class="delta delta--' + (delta > 0 ? "up" : "down") + '">' + PS.icon("power") + (delta > 0 ? "+" : "−") + fmt(Math.abs(delta)) + " power if you equip it</p>" : "") +
          "</div>" +
        "</div>" +
        '<p class="itemsheet__blurb">' + esc(def.blurb) + "</p>" +
        '<ul class="perks">' + perkList(item) + "</ul>" +
        '<div class="itemsheet__actions">' +
          (worn
            ? '<button class="btn btn--sm" type="button" data-act="upgrade" data-slot="' + def.slot + '" data-key="m-up" autofocus' + (info.ok ? "" : " disabled") + ">" + PS.icon("up") + "Level up " + (info.level >= cap ? "" : price("gold", info.cost)) + "</button>" +
              '<button class="btn btn--sm" type="button" data-act="upgrade-max" data-slot="' + def.slot + '" data-key="m-max"' + (info.ok ? "" : " disabled") + ">Max</button>" +
              (def.slot === "weapon" ? "" : '<button class="btn btn--sm" type="button" data-act="unequip" data-slot="' + def.slot + '">Take off</button>')
            : '<button class="btn btn--primary" type="button" data-act="equip" data-u="' + item.u + '" data-key="m-equip" autofocus>Equip</button>') +
          (item.r < PS.MAX_RARITY ? '<button class="btn btn--sm" type="button" data-act="forge-this" data-u="' + item.u + '">' + PS.icon("forge") + "Forge</button>" : "") +
          (value && !worn
            ? '<button class="btn btn--sm' + (modal.sellArmed ? " btn--danger" : "") + '" type="button" data-act="sell" data-u="' + item.u + '" data-key="m-sell"' + (modal.sellArmed ? ' data-armed="1"' : "") + ">" +
              (modal.sellArmed ? "Yes, sell it " : "Sell ") + price("gold", value) + "</button>"
            : "") +
        "</div>" +
        (value && worn ? '<p class="hint">Worth ' + fmt(value) + " gold. Take it off to sell it.</p>" : "") +
        (worn && !info.ok && info.reason ? '<p class="hint">' + (info.reason === "Needs a higher rarity" ? "This slot is at the level cap for " + PS.RARITY[item.r].name + " gear. Forge the item to raise it." : info.reason + ".") + "</p>" : "") +
      "</div>"
    );
  }

  function lootModal(modal) {
    var best = 0;
    modal.items.forEach(function (item) { if (item.r > best) best = item.r; });
    // a big batch is a ranked, compact grid with a tally, not a hundred captions
    var many = modal.items.length > 12;
    var shown = many ? st.sorted(modal.items) : modal.items;
    var tally = "";
    if (many) {
      var counts = {};
      var graded = { S: 0, SS: 0 };
      modal.items.forEach(function (item) {
        counts[item.r] = (counts[item.r] || 0) + 1;
        var g = st.def(item).grade;
        if (g !== "A") graded[g]++;
      });
      for (var r = PS.MAX_RARITY; r >= 0; r--) {
        if (counts[r]) tally += '<span class="rname r' + r + '">' + counts[r] + " " + PS.RARITY[r].name + "</span>";
      }
      if (graded.SS) tally += '<span class="rname g-SS">' + graded.SS + " SS-grade</span>";
      if (graded.S) tally += '<span class="rname g-S">' + graded.S + " S-grade</span>";
      tally = '<p class="loot__tally">' + tally + "</p>";
    }
    return (
      '<div class="loot' + (modal.art ? " loot--reveal" : "") + (many ? " loot--many" : "") + '">' +
        (modal.art ? '<div class="loot__flash r' + best + '"></div><div class="loot__box">' + PS.art(modal.art) + "</div>" : "") +
        '<h2 id="modal-title">' + esc(modal.title) + "</h2>" +
        (modal.gold || modal.gems ? '<p class="loot__money">' + (modal.gold ? price("gold", modal.gold) : "") + (modal.gems ? price("gems", modal.gems) : "") + "</p>" : "") +
        (modal.shards ? '<p class="loot__tally"><span class="rname g-SS">+' + modal.shards + " SS shard" + (modal.shards === 1 ? "" : "s") + "!</span></p>" : "") +
        tally +
        '<div class="loot__items">' + shown.map(function (item, index) {
          var def = st.def(item);
          return (
            '<div class="loot__item" style="--i:' + Math.min(index, 24) + '">' + tile(item, { plain: true, cls: "tile--pop" }) +
              '<strong class="rname r' + item.r + '">' + esc(def.name) + "</strong>" +
              "<span>" + PS.RARITY[item.r].name + (def.grade !== "A" ? ' <b class="rname g-' + def.grade + '">' + def.grade + "</b>" : "") + "</span>" +
            "</div>"
          );
        }).join("") + "</div>" +
        '<div class="modal__actions">' +
          (modal.again ? '<button class="btn" type="button" data-act="chest" data-kind="' + modal.again.kind + '" data-count="' + modal.again.count + '"' + (st.get().gems >= st.chestCost(modal.again.kind, modal.again.count) ? "" : " disabled") + ">Open again " + price("gems", st.chestCost(modal.again.kind, modal.again.count)) + "</button>" : "") +
          '<button class="btn btn--primary" type="button" data-act="close" data-key="m-ok" autofocus>Nice</button>' +
        "</div>" +
      "</div>"
    );
  }

  /* ---------------------------------------------------------- how to play */
  /* The guide in Settings: one fold-out section per topic, with the game's own
     numbers filled in, so it stays right if the numbers change. Which sections
     are open is remembered while the game is open. */

  var GUIDE_OPEN = { basics: true };

  /* one line of advice for each kind of boss, in the order they first appear */
  var BOSS_TIPS = {
    hornet: "Charges along a red lane. Step to the side of the lane, not back along it.",
    queen: "Sends out two rings of shots, the second filling the gaps of the first. Weave through, and keep clear of the grunts she hatches.",
    slug: "Lobs slime at red circles: step out of them. Its trail and the slime leave puddles that hurt and slow you.",
    mould: "Spins out a spiral of spores. Move the same way it turns and the gaps stay open longer.",
    beetle: "Crouches, then leaps to the red circle and slams down with a ring of shots. Get out of the circle.",
    spider: "Red lanes are beams about to fire. White webs hold you nearly still: do not get stuck in one when the beams go off.",
    worm: "Burrows, and a mound of earth chases you. When it stops, a red circle shows where it bursts up.",
    moth: "Leaves clouds of stinging dust and beats its wings to send arcs of scales. Do not fight inside its dust.",
    fly: "Vanishes and reappears at the red circle with a burst of shots in every direction. Watch for the circle."
  };

  function guideSection(id, title, icon, body) {
    return (
      '<details class="guide__part" data-guide="' + id + '"' + (GUIDE_OPEN[id] ? " open" : "") + ">" +
        "<summary>" + PS.icon(icon) + "<span>" + title + "</span></summary>" +
        '<div class="guide__body">' + body + "</div>" +
      "</details>"
    );
  }

  function powerBadge(key) {
    var power = PS.B.POWERS[key];
    var glyph = { frenzy: "bolt", giant: "area", swift: "haste" }[key];
    var inner = glyph
      ? PS.icon(glyph)
      : '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><polygon fill="currentColor" points="12,2 14.9,8.6 22,9.3 16.6,14 18.2,21 12,17.3 5.8,21 7.4,14 2,9.3 9.1,8.6"/></svg>';
    return '<span class="guide__badge" style="--c:' + power.color + '">' + inner + "</span>";
  }

  function howToPlay() {
    var powers = PS.B && PS.B.POWERS ? PS.B.POWERS : {};
    var powerRows = Object.keys(powers).map(function (key) {
      var power = powers[key];
      return "<li>" + powerBadge(key) + "<span><b>" + power.name + "</b> " + esc(power.text.toLowerCase()) + " for " + power.time + " seconds.</span></li>";
    }).join("");

    // the first chapter each kind of boss turns up in, for its picture
    var firstOf = {};
    var order = [];
    for (var n = 1; n <= PS.BAL.CHAPTERS; n++) {
      var kind = PS.chapter(n).boss;
      if (!firstOf[kind]) {
        firstOf[kind] = n;
        order.push(kind);
      }
    }
    var bosses = order.map(function (kind) {
      var n = firstOf[kind];
      return (
        '<li class="guide__boss"><span class="guide__art">' + PS.bossArt(n) + "</span>" +
        "<span><b>" + kind.charAt(0).toUpperCase() + kind.slice(1) + "</b> <small>from chapter " + n + ", " + esc(PS.chapter(n).bossName) + "</small><br>" + BOSS_TIPS[kind] + "</span></li>"
      );
    }).join("");

    var rarities = PS.RARITY.map(function (r, i) { return rarityName(i); }).join(" ");
    var giftHours = Math.round(PS.GIFT.every / 3600000);

    return (
      '<div class="guide" id="guide">' +
        guideSection("basics", "The basics", "tabBattle",
          '<ul class="howto">' +
            "<li><b>Move</b> with WASD or the arrow keys, hold the mouse button down, or drag on a touch screen.</li>" +
            "<li><b>Your lemon attacks by itself</b>, aiming at the nearest pest. Bosses, elites and the golden pest come first.</li>" +
            "<li>Squashed pests drop <b>gems</b>. They fill the bar at the top; every time it fills you <b>level up</b> and pick one of three upgrades (click a card, or press 1, 2 or 3). <b>R</b> rerolls the cards.</li>" +
            "<li>Last until the <b>timer</b> runs out and the <b>boss</b> arrives. Beat it to clear the chapter and open the next one.</li>" +
            "<li><b>Esc</b> or <b>P</b> pauses. <b>Tab</b> shows or hides the damage meter, which says what is doing your damage.</li>" +
          "</ul>") +
        guideSection("alive", "Staying alive", "hp",
          '<ul class="howto">' +
            "<li>When your health falls below 30% the edges of the screen glow red.</li>" +
            "<li><b>Lemon slices</b> heal you. Pests drop them now and then; <b>elites</b> (the big ones with a gold ring) always do, along with a magnet that pulls in every gem.</li>" +
            "<li>From chapter 3 on, every elite has a <b>trait</b>, named over its head: <b>Swift</b> ones are fast but fragile, <b>Healers</b> mend the pests around them (squash those first), <b>Summoners</b> call in more pests, and <b>Splitting</b> ones break in two when squashed.</li>" +
            "<li>Keep moving. Standing still is how the swarm surrounds you.</li>" +
            "<li>Upgrades like <b>Thick Rind</b>, <b>Regrowth</b>, <b>Hard Shell</b> and <b>Second Wind</b> keep you going when the battle gets busy.</li>" +
          "</ul>") +
        guideSection("powerups", "Crates and power-ups", "gift",
          "<p>Crates, clay jars and flower pots turn up on the field every few seconds. You can spot them by the <b>glowing ring</b> under them and the <b>yellow arrow</b> bouncing above. <b>Walk into one, or let your attacks hit it</b>, to break it open. A word pops up saying what was inside:</p>" +
          '<ul class="howto">' +
            "<li><b>A power-up</b> (about a third of the time): a glowing orb. Walk over it to use it.</li>" +
            "<li><b>A lemon slice</b> (a heal), <b>a shower of coins</b>, or <b>a magnet</b>.</li>" +
            "<li><b>A bomb</b>: pick it up and every pest on screen is squashed. It never hurts a boss.</li>" +
          "</ul>" +
          '<p class="guide__sub">The power-ups</p><ul class="guide__list">' + powerRows + "</ul>" +
          "<p>A power-up shows its time left on the right of the screen and a ring around your lemon, and blinks when it is about to run out.</p>") +
        guideSection("golden", "The golden pest", "coin",
          "<p>Twice a chapter (and every 75 seconds in the endless swarm) a <b>golden pest</b> appears and runs away from you. An arrow at the edge of the screen points to it, and a ring around it counts down 15 seconds.</p>" +
          "<p>Your weapon goes for it first. Catch it and it bursts into a pile of coins and experience; let it go and it is gone.</p>") +
        guideSection("moves", "Dash, shrines and awakenings", "dash",
          '<ul class="howto">' +
            "<li><b>Dash</b> with <b>Space</b> or <b>Shift</b>, or the round button at the bottom right on a phone: a quick slide the way you are heading, and nothing can hurt you for a moment. It comes back after about " + Math.round(PS.B.DASH.cd) + " seconds; the button fills up as it does. <b>Quick Feet</b> cards make it come back sooner.</li>" +
            "<li>Every minute or so a <b>shrine</b> rises nearby, and a green arrow points to it. Stand in its circle for 3 seconds (stepping out drains it) and it offers <b>three blessings</b> to choose from, each lasting the rest of the battle. Leave it for 30 seconds and it sinks back into the ground.</li>" +
            "<li>Max out an ability and its <b>awakening</b> turns up at your next level-up: a gold card that makes it work as if it were three levels past its max. Orbit Peel becomes Peel Tempest, Frost Nova becomes Deep Freeze, and so on.</li>" +
          "</ul>") +
        guideSection("combo", "Combos", "bolt",
          "<p>Squash pests one after another, no more than about two seconds apart, to build a <b>combo</b>. It shows on the right once it reaches ×10 and changes colour at ×25, ×50 and ×100. Your best combo is on the results screen.</p>") +
        guideSection("bosses", "The bosses", "skull",
          "<p>Every boss fights like the creature it is named after. Red circles and red lanes always show where an attack is about to land. Below half health a boss glows red and attacks faster. From chapter " + PS.TWIN_BOSS.from + " on, <b>two bosses</b> come at once, and both must fall.</p>" +
          '<ul class="guide__list">' + bosses + "</ul>") +
        guideSection("gear", "Gear and the Forge", "tabGear",
          '<ul class="howto">' +
            "<li>You wear six pieces of gear: a weapon, a ring, an amulet, a helmet, armour and boots. Your weapon decides how you attack.</li>" +
            "<li>There are " + PS.ITEM_ORDER.filter(function (id) { return PS.ITEMS[id].slot === "weapon"; }).length + " weapons and " +
              PS.ITEM_ORDER.filter(function (id) { return PS.ITEMS[id].slot !== "weapon"; }).length + " other pieces of gear to find. Most names are two words: the second says what it is (a <b>Mortar</b> lobs shells, a <b>Chakram</b> flies out and back, a <b>Visor</b> is a helmet), the first what it adds (<b>Cinder</b> burns, <b>Frost</b> slows, <b>Volt</b> softens pests up, <b>Venom</b> poisons and heals you, <b>Shadow</b> is quick and reaches far, <b>Radiant</b> finds weak spots, <b>Briar</b> is covered in thorns).</li>" +
            '<li>Rarities, from the bottom: <span class="rlist">' + rarities + "</span>. Rarer gear is stronger and unlocks more of its perks.</li>" +
            "<li>Battles drop gear up to " + rarityName(PS.MAX_DROP_RARITY) + ". Anything rarer comes from the <b>Forge</b>: put in three items of the same slot and rarity, and the one you keep goes up a rarity. <b>Quick forge</b> does every forge it can at once.</li>" +
            "<li>Spend gold to <b>level up</b> each slot. An item's rarity caps how high its slot's level counts.</li>" +
            "<li>Some items are <b>S</b> or <b>SS grade</b>: stronger at every rarity.</li>" +
            "<li>The <b>Collection</b> button on the Equipment screen keeps every different item you have ever owned. Find more of them for gems: the first reward comes at " + PS.BOOK[0].at + " items.</li>" +
            "<li><b>Power</b> sums up how strong you are. Each chapter shows a recommended Power; below it, the chapter will be tough.</li>" +
          "</ul>") +
        guideSection("shop", "The Shop", "tabShop",
          '<ul class="howto">' +
            "<li><b>Daily rewards</b>: claim once a day for " + PS.DAILY.length + " days in a row; the last day is the biggest. Miss a day and it starts again.</li>" +
            "<li>A <b>free gift</b> every " + giftHours + " hours.</li>" +
            "<li><b>Chests</b> cost gems: a Seed Crate is " + PS.CHESTS.crate.gems + ", a Gilded Chest " + PS.CHESTS.gilded.gems + ". A Gilded Chest can also hold an <b>SS shard</b>; " + PS.SHARDS.needed + " shards make an SS-grade item.</li>" +
            "<li>Four <b>deals</b> a day, and a sack of gold for gems.</li>" +
          "</ul>") +
        guideSection("more", "Pets, talents and quests", "tabPets",
          '<ul class="howto">' +
            "<li><b>Pets</b> hatch from eggs bought with gems. Pets on your team fight beside you and add a bonus; hatching one you have, or spending gold, levels it up.</li>" +
            "<li><b>Talents</b> are bonuses bought with gold that last for good. Max a whole tier to <b>ascend</b> and unlock stronger ones.</li>" +
            "<li><b>Quests</b> are goals that pay gems: clear chapters, squash pests, forge, open chests and more.</li>" +
          "</ul>") +
        guideSection("challenge", "The daily challenge", "gift",
          "<p>Clear chapter " + PS.CHALLENGE.from + " to unlock the <b>daily challenge</b> on the Battle screen: a chapter " + PS.CHALLENGE.behind + " short of your furthest, with a twist that changes every day at midnight. Win it for " + PS.CHALLENGE.gems + " gems and a free " + PS.CHESTS[PS.CHALLENGE.chest].name + " (once a day; you can play again for the chapter's normal pay).</p>" +
          '<ul class="guide__list">' + PS.CHALLENGE.twists.map(function (tw) {
            return '<li><span class="guide__badge" style="--c:#E58A2A">' + PS.icon(tw.icon) + "</span><span><b>" + esc(tw.name) + "</b> " + esc(tw.text) + "</span></li>";
          }).join("") + "</ul>") +
        guideSection("endless", "Endless swarm", "clock",
          "<p>Clear chapter " + PS.ENDLESS.from + " to unlock the <b>endless swarm</b>, under the chapter on the Battle screen. There is no boss and no end: the swarm keeps growing and you are paid gold for every second you last. Your best time is kept.</p>") +
      "</div>"
    );
  }

  /* one row of the Settings pop-up: a name, a small line under it, and a control */
  function settingsToggle(name, hint, control) {
    return '<div class="settings__row"><span>' + name + "<small>" + hint + "</small></span>" + control + "</div>";
  }

  function settingsPref(name, label, hint) {
    return settingsToggle(label, hint, '<button class="btn btn--sm" type="button" data-act="pref" data-pref="' + name + '" data-key="pref-' + name + '">' + (PS.prefs.get(name) ? "On" : "Off") + "</button>");
  }

  /* settings that step through a short list when pressed */
  var CYCLES = {
    quality: [[0, "Low"], [1, "Medium"], [2, "High"]],
    fps: [[0, "No limit"], [60, "60 FPS"], [30, "30 FPS"]]
  };

  function settingsCycle(name, label, hint) {
    var now = PS.prefs.get(name);
    var pick = CYCLES[name].filter(function (o) { return o[0] === now; })[0] || CYCLES[name][0];
    return settingsToggle(label, hint, '<button class="btn btn--sm" type="button" data-act="cycle" data-pref="' + name + '" data-key="cycle-' + name + '">' + pick[1] + "</button>");
  }

  /** The glass blur switch is a page-wide attribute, so it is applied here and at start-up. */
  function applyBlur() {
    if (PS.prefs.get("blur")) document.documentElement.removeAttribute("data-blur");
    else document.documentElement.setAttribute("data-blur", "off");
  }

  function settingsModal(modal) {
    var S = st.get();
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    var minutes = Math.round(S.stats.time / 60);
    return (
      '<div class="settings">' +
        '<button class="modal__close" type="button" data-act="close" aria-label="Close">' + PS.icon("close") + "</button>" +
        '<h2 id="modal-title">Settings</h2>' +
        "<h3>Sound</h3>" +
        settingsToggle("Sound effects", "Switches every sound on or off", '<button class="btn btn--sm" type="button" data-act="sound" data-key="sound">' + (PS.sfx.on() ? "On" : "Off") + "</button>") +
        settingsToggle("Volume", '<span id="set-vol-label">' + PS.prefs.get("vol") + "%</span>",
          '<input class="settings__range" id="set-vol" type="range" min="0" max="100" step="5" value="' + PS.prefs.get("vol") + '" aria-label="Volume" />') +
        settingsPref("combatSfx", "Battle sounds", "Shots, hits, pests squashed and explosions") +
        settingsPref("music", "Music", "A tune for camp, for battles and for the boss") +
        settingsToggle("Music volume", '<span id="set-music-label">' + PS.prefs.get("musicVol") + "%</span>",
          '<input class="settings__range" id="set-music" type="range" min="0" max="100" step="5" value="' + PS.prefs.get("musicVol") + '" aria-label="Music volume" />') +
        settingsPref("menuSfx", "Menu sounds", "Button clicks and tab changes") +
        "<h3>Performance</h3>" +
        settingsCycle("quality", "Graphics quality", "Low draws flat pests and fewer sparks, for slow devices") +
        settingsCycle("fps", "Frame rate limit", "A lower limit saves battery and heat") +
        settingsPref("showFps", "Show frame rate", "A small counter in the corner of a battle") +
        settingsPref("blur", "Glass blur", "The frosted look behind menus; switch off if menus feel slow") +
        '<div class="settings__row"><span>Animations<small>Menu and button movement</small></span>' +
          '<button class="btn btn--sm" type="button" data-act="motion" data-key="motion">' + { auto: "Auto (follow device)", on: "Always on", off: "Off" }[PS.motionMode()] + "</button></div>" +
        "<h3>Gameplay</h3>" +
        settingsPref("shake", "Screen shake", "Shake when things blow up") +
        settingsPref("numbers", "Damage numbers", "Floating hit numbers") +
        settingsPref("autopause", "Pause when you leave the tab", "So a battle waits while you are away") +
        '<div class="settings__row"><span>Colours<small>Day or night</small></span>' +
          '<button class="btn btn--sm" type="button" data-act="theme" data-key="theme">' + (dark ? "Switch to day" : "Switch to night") + "</button></div>" +
        '<div class="settings__row"><span>Put the settings back as they came</span>' +
          '<button class="btn btn--sm" type="button" data-act="prefs-reset" data-key="prefs-reset">Restore defaults</button></div>' +
        "<h3>How to play</h3>" +
        howToPlay() +
        "<h3>Your record</h3>" +
        '<dl class="facts facts--tight">' +
          "<div><dt>Battles</dt><dd>" + fmt(S.stats.runs) + " · " + fmt(S.stats.wins) + " won</dd></div>" +
          "<div><dt>Pests squashed</dt><dd>" + fmt(S.stats.kills) + "</dd></div>" +
          "<div><dt>Time in battle</dt><dd>" + (minutes >= 60 ? Math.floor(minutes / 60) + "h " + (minutes % 60) + "m" : minutes + " min") + "</dd></div>" +
          "<div><dt>Best power</dt><dd>" + fmt(S.stats.bestPower) + "</dd></div>" +
          "<div><dt>Gold earned</dt><dd>" + fmt(S.stats.earned) + "</dd></div>" +
          "<div><dt>Forged</dt><dd>" + fmt(S.stats.forges) + (S.stats.forges === 1 ? " time" : " times") + "</dd></div>" +
        "</dl>" +
        '<div class="settings__row settings__danger"><span>Start again from nothing</span>' +
          '<button class="btn btn--sm btn--danger" type="button" data-act="reset" data-key="reset">' + (modal.armed ? "Yes, wipe everything" : "Reset progress") + "</button></div>" +
        (PS.store.available ? "" : '<p class="hint">This browser is blocking saved data, so progress will be lost when the tab closes.</p>') +
      "</div>"
    );
  }

  function secretModal(modal) {
    return (
      '<form class="secret" data-form="secret">' +
        '<h2 id="modal-title">' + (modal.open ? "Unlocked" : modal.admin ? "Admin password" : "Password") + "</h2>" +
        (modal.open
          ? "<p>Nothing in here yet.</p>"
          : '<label class="visually-hidden" for="secret-input">Password</label>' +
            '<input class="secret__input" id="secret-input" type="password" autocomplete="off" spellcheck="false" />' +
            '<p class="secret__error" role="alert">' + (modal.wrong ? "Wrong password." : "") + "</p>") +
        '<div class="modal__actions">' +
          '<button class="btn btn--sm" type="button" data-act="close">Close</button>' +
          (modal.open ? "" : '<button class="btn btn--sm btn--primary" type="submit">Unlock</button>') +
        "</div>" +
      "</form>"
    );
  }

  /* ------------------------------------------------------------- dev menu */
  /* A list of sections down the left and the chosen one on the right. Every
     section has its numbers at the top, then the switches and setters.

     The admin menu also keeps an undo list: before any action named in
     DEV_UNDO changes the save, a snapshot of the save is taken, and the Undo
     button (or the Save section's history) puts it back. */

  var DEV_TABS = [
    ["overview", "Overview", "info"],
    ["gear", "Gear", "tabGear"],
    ["owned", "Owned", "tabShop"],
    ["pets", "Pets", "tabPets"],
    ["money", "Money", "coin"],
    ["shop", "Shop", "gift"],
    ["progress", "Progress", "tabTalents"],
    ["quests", "Quests", "tabQuests"],
    ["chapters", "Chapters", "chart"],
    ["battle", "Battle", "tabBattle"],
    ["settings", "Settings", "gear"],
    ["save", "Save", "forge"]
  ];

  /* every action that changes the save, and what the undo list calls it */
  var DEV_UNDO = {
    "dev-give": "Gave an item", "dev-give-bag": "Gave an item to the bag", "dev-give-all": "Gave one of every item",
    "dev-set": "Gave a full set", "dev-remove": "Removed an item", "dev-max-slots": "Maxed the slot levels",
    "dev-slot-levels": "Set the slot levels", "dev-equip-best": "Wore the best gear", "dev-owned-rarity": "Changed an item's rarity",
    "dev-equip": "Wore an item", "dev-clean": "Cleaned out the bag",
    "dev-pet-give": "Gave a pet", "dev-pet-all": "Gave every pet", "dev-pet-team": "Moved a pet", "dev-pet-up": "Levelled a pet",
    "dev-pet-max": "Maxed a pet", "dev-pet-remove": "Removed a pet", "dev-pets-max": "Maxed every pet",
    "dev-pets-fill": "Filled the pet team", "dev-pet-slots": "Set the pet slots",
    "dev-boost": "Set my power and stats", "dev-boost-clear": "Put my stats back to normal",
    "dev-add": "Added gold or gems", "dev-money": "Set gold and gems", "dev-shards": "Added SS shards", "dev-shards-set": "Set SS shards",
    "dev-eggs": "Hatched free eggs", "dev-shop": "Restocked the shop", "dev-gift-wait": "Set the gift timer",
    "dev-chest": "Opened free chests", "dev-pity": "Set the pity counters",
    "dev-best": "Set the chapters cleared", "dev-unlock": "Opened every chapter", "dev-lockall": "Locked the chapters",
    "dev-chapter": "Moved the Battle screen", "dev-clear-to": "Cleared up to a chapter",
    "dev-max-talents": "Maxed the talents", "dev-ascend": "Ascended a tier", "dev-reset-talents": "Forgot the talents",
    "dev-claim-quests": "Claimed ready quests", "dev-quest-done": "Completed a quest", "dev-quest-claim": "Claimed a quest",
    "dev-quests-all": "Finished every quest", "dev-stats-set": "Set the counters",
    "dev-snap-load": "Loaded a snapshot", "dev-file-load": "Loaded a save file", "dev-import": "Loaded a pasted save",
    "dev-reset": "Reset the save"
  };
  var HISTORY_MAX = 30;
  var KEY_SNAPS = "lemon:dev:snapshots";

  var STAT_NAMES = {
    kills: "Pests squashed", runs: "Battles", wins: "Wins", forges: "Forges", chests: "Chests opened",
    upgrades: "Gear levels bought", talents: "Talent levels", bestLevel: "Best battle level", bestPower: "Best Power",
    maxRarity: "Best rarity owned (number)", grade: "Best grade owned (0 A, 1 S, 2 SS)", time: "Seconds played",
    earned: "Gold earned", eggs: "Eggs hatched"
  };

  function devSnapshot(label) {
    var list = view.devHistory;
    list.push({ label: label, save: st.exportSave(), at: Date.now() });
    if (list.length > HISTORY_MAX) list.shift();
  }

  function devClock(at) {
    var d = new Date(at);
    function two(n) { return (n < 10 ? "0" : "") + n; }
    return two(d.getHours()) + ":" + two(d.getMinutes()) + ":" + two(d.getSeconds());
  }

  function devSnaps() {
    var list = PS.store.get(KEY_SNAPS, []);
    return Array.isArray(list) ? list.filter(function (s) { return s && typeof s.save === "string"; }) : [];
  }

  function devButton(act, label, attrs, cls) {
    return '<button class="btn btn--sm' + (cls ? " " + cls : "") + '" type="button" data-act="' + act + '"' + (attrs || "") + ">" + label + "</button>";
  }

  /** A card with a title; `info` is an array of [label, value] shown first. */
  function devCard(title, body, info) {
    var facts = "";
    if (info && info.length) {
      facts = '<dl class="facts facts--tight devfacts">' + info.map(function (row) {
        return "<div><dt>" + row[0] + "</dt><dd>" + row[1] + "</dd></div>";
      }).join("") + "</dl>";
    }
    return '<section class="devcard"><h3>' + title + "</h3>" + facts + body + "</section>";
  }

  /** A big on/off switch. `act` runs when it is clicked. */
  function devToggle(act, attrs, label, hint, on) {
    return (
      '<button class="devbox__toggle' + (on ? " is-on" : "") + '" type="button" data-act="' + act + '"' + (attrs || "") + ' aria-pressed="' + Boolean(on) + '">' +
        "<b>" + label + "</b><span>" + hint + "</span><i>" + (on ? "ON" : "OFF") + "</i>" +
      "</button>"
    );
  }

  function devRow(inner) {
    return '<div class="dev__grant">' + inner + "</div>";
  }

  function devNumber(id, label, value, min, max) {
    return '<label>' + label + '<input id="' + id + '" type="number" min="' + min + '"' + (max ? ' max="' + max + '"' : "") + ' step="1" value="' + value + '" /></label>';
  }

  /** A drop-down. `options` is a list of [value, text]. */
  function devSelect(id, label, options, current) {
    return '<label>' + label + '<select id="' + id + '">' + options.map(function (o) {
      return '<option value="' + o[0] + '"' + (String(o[0]) === String(current) ? " selected" : "") + ">" + esc(o[1]) + "</option>";
    }).join("") + "</select></label>";
  }

  function rarityOptions(count) {
    return PS.RARITY.slice(0, count).map(function (r, i) { return [i, r.name]; });
  }

  /* The admin menu's "set my power and stats": [key, label, shown as a percentage] */
  var BOOST_FIELDS = [
    ["atk", "Attack", false], ["hp", "Health", false], ["crit", "Crit chance %", true], ["critDmg", "Crit damage ×", false],
    ["haste", "Attack speed +%", true], ["speed", "Move speed +%", true], ["armor", "Damage blocked % (max 95)", true],
    ["regen", "Regen % a second", true], ["magnet", "Pickup reach +%", true], ["gold", "Gold +%", true], ["xp", "XP +%", true],
    ["luck", "Luck", false], ["area", "Attack size +%", true], ["bossDmg", "Boss damage +%", true]
  ];

  function devBoost(calc) {
    var b = st.boost() || { power: null, label: "", stats: {} };
    function box(id, label, value, type) {
      return "<label>" + label + '<input id="' + id + '" type="' + (type || "number") + '" min="0" step="any"' + (type === "text" ? ' maxlength="20"' : "") +
        ' value="' + esc(value === null || value === undefined ? "" : String(value)) + '" placeholder="normal" /></label>';
    }
    var boxes = BOOST_FIELDS.map(function (f) {
      var v = b.stats[f[0]];
      return box("dev-b-" + f[0], f[1], v === undefined ? "" : f[2] ? Math.round(v * 10000) / 100 : v);
    }).join("");
    return devCard("My power and stats",
      '<p class="hint">Set any of these by hand (empty = what your gear gives). They work in battles too, and your Power goes on the leaderboard. ' +
        "\"Power shows as\" puts any text in place of the number on your own screens: the top bar, Battle and Equipment. " +
        "To change what the leaderboard shows for anyone (you too), use Show as... under their name.</p>" +
      '<div class="dev__give dev__give--grid">' +
        box("dev-b-power", "Power", b.power) +
        box("dev-b-label", "Power shows as", b.label, "text") +
        boxes +
      "</div>" +
      devRow(devButton("dev-boost", "Use these", "", "btn--primary") + devButton("dev-boost-clear", "Back to normal")),
      [["Power now", fmt(calc.power) + (st.powerText() ? " (shows as “" + esc(st.powerText()) + "”)" : "")],
        ["Set by hand", Object.keys(b.stats).length + (b.power !== null ? 1 : 0) + (b.label ? 1 : 0)]]
    );
  }

  function devOverview(S, calc) {
    var minutes = Math.round(S.stats.time / 60);
    var open = st.unlockedTalents();
    var maxed = open.filter(function (t) { return (S.talents[t.id] || 0) >= t.max; }).length;
    var ready = st.quests().filter(function (q) { return q.ready; }).length;
    var bytes = JSON.stringify(S).length;
    return (
      devBoost(calc) +
      devCard("Save", "", [
        ["Power", fmt(calc.power)],
        ["Gold", fmt(S.gold)],
        ["Gems", fmt(S.gems)],
        ["SS shards", S.shards + "/" + PS.SHARDS.needed],
        ["Chapters cleared", S.best + " / " + PS.BAL.CHAPTERS],
        ["Items owned", S.items.length],
        ["Pets owned", S.pets.length],
        ["Talents maxed", maxed + " / " + open.length],
        ["Talent tier", st.ascendInfo().tier + " of " + PS.TALENT_TIERS],
        ["Quests ready", ready]
      ]) +
      devCard("Computed stats", "", [
        ["Weapon", esc(PS.ITEMS[calc.weapon].name)],
        ["Attack", fmt(calc.atk)],
        ["Health", fmt(calc.hp)],
        ["Crit chance", PS.pct(calc.crit)],
        ["Crit damage", PS.pct(calc.critDmg)],
        ["Attack speed", "+" + PS.pct(calc.haste)],
        ["Move speed", "+" + PS.pct(calc.speed)],
        ["Damage reduction", PS.pct(calc.armor)],
        ["Regeneration", PS.pct(calc.regen) + " a second"],
        ["Pickup range", "+" + PS.pct(calc.magnet)],
        ["Gold bonus", "+" + PS.pct(calc.gold)],
        ["XP bonus", "+" + PS.pct(calc.xp)],
        ["Luck", "+" + PS.pct(calc.luck)],
        ["Attack size", "+" + PS.pct(calc.area)],
        ["Boss damage", "+" + PS.pct(calc.bossDmg)]
      ]) +
      devCard("Record", "", [
        ["Battles", fmt(S.stats.runs)],
        ["Wins", fmt(S.stats.wins)],
        ["Pests squashed", fmt(S.stats.kills)],
        ["Time played", minutes >= 60 ? Math.floor(minutes / 60) + "h " + (minutes % 60) + "m" : minutes + " min"],
        ["Best level", fmt(S.stats.bestLevel)],
        ["Gold earned", fmt(S.stats.earned)],
        ["Forges", fmt(S.stats.forges)],
        ["Chests opened", fmt(S.stats.chests)]
      ]) +
      devCard("This browser", "", [
        ["Save size", (bytes / 1024).toFixed(1) + " KB"],
        ["Saving works", PS.store.available ? "yes" : "no"],
        ["Dev tools", PS.dev.admin ? "admin" : PS.dev.unlocked ? "dev" : "locked"],
        ["Theme", document.documentElement.getAttribute("data-theme") === "dark" ? "night" : "day"],
        ["Free gift", st.giftWait() ? PS.countdown(st.giftWait()) : "ready"]
      ])
    );
  }

  function devGear(S, d, calc) {
    var picks = PS.SLOTS.map(function (slot) {
      var list = PS.ITEM_ORDER.filter(function (id) { return PS.ITEMS[id].slot === slot.key; });
      return '<optgroup label="' + slot.plural + '">' + list.map(function (id) {
        var def = PS.ITEMS[id];
        return '<option value="' + id + '"' + (id === d.id ? " selected" : "") + ">" + esc(def.name) + " (" + def.grade + ")</option>";
      }).join("") + "</optgroup>";
    }).join("");
    var rarities = PS.RARITY.map(function (r, i) {
      return '<option value="' + i + '"' + (i === d.r ? " selected" : "") + ">" + r.name + "</option>";
    }).join("");
    var worn = PS.SLOTS.map(function (slot) {
      var item = st.equipped(slot.key);
      return [slot.name, item ? esc(PS.RARITY[item.r].name + " " + st.def(item).name) + " · Lv " + S.lv[slot.key] : "nothing"];
    });
    var maxLevel = PS.RARITY[PS.MAX_RARITY].cap;
    return (
      devCard("Wearing", "", worn.concat([["Power", fmt(calc.power)]])) +
      devCard("Give an item",
        '<div class="dev__give">' +
          '<label>Item<select id="dev-id">' + picks + "</select></label>" +
          '<label>Rarity<select id="dev-rarity">' + rarities + "</select></label>" +
          devNumber("dev-count", "How many", d.count || 1, 1, 100) +
        "</div>" +
        devRow(
          devButton("dev-give", "Give and equip", "", "btn--primary") +
          devButton("dev-give-bag", "Give to the bag only")
        )
      ) +
      devCard("Bulk",
        devRow(
          devButton("dev-set", "Full set of basics at this rarity") +
          devButton("dev-give-all", "One of every item at this rarity") +
          devButton("dev-equip-best", "Wear the best of what I own")
        ) + '<p class="hint">Rarity comes from the picker above.</p>'
      ) +
      devCard("Slot levels",
        '<div class="dev__give">' + PS.SLOTS.map(function (slot) {
          return devNumber("dev-lv-" + slot.key, slot.name, S.lv[slot.key], 1, maxLevel);
        }).join("") + "</div>" +
        devRow(
          devButton("dev-slot-levels", "Set these levels", "", "btn--primary") +
          devButton("dev-max-slots", "Max every slot's level")
        ) +
        '<p class="hint">A slot only shows its level up to what the worn item\'s rarity allows. The highest level is ' + maxLevel + ".</p>"
      )
    );
  }

  function devMoney(S) {
    var pack = st.goldPack();
    return (
      devCard("Balance", "", [
        ["Gold", fmt(S.gold)],
        ["Gems", fmt(S.gems)],
        ["SS shards", S.shards + "/" + PS.SHARDS.needed],
        ["Gold pack", fmt(pack.gold) + " for " + pack.gems + " gems"]
      ]) +
      devCard("Set exactly",
        '<div class="dev__give">' +
          devNumber("dev-gold", "Gold", S.gold, 0) +
          devNumber("dev-gems", "Gems", S.gems, 0) +
          devButton("dev-money", "Set") +
        "</div>"
      ) +
      devCard("Add",
        devRow(
          devButton("dev-add", "+10K gold", ' data-gold="10000" data-gems="0"') +
          devButton("dev-add", "+1M gold", ' data-gold="1000000" data-gems="0"') +
          devButton("dev-add", "+1B gold", ' data-gold="1000000000" data-gems="0"') +
          devButton("dev-add", "+1T gold", ' data-gold="1000000000000" data-gems="0"')
        ) +
        devRow(
          devButton("dev-add", "+100 gems", ' data-gold="0" data-gems="100"') +
          devButton("dev-add", "+1K gems", ' data-gold="0" data-gems="1000"') +
          devButton("dev-add", "+100K gems", ' data-gold="0" data-gems="100000"') +
          devButton("dev-add", "+10M gems", ' data-gold="0" data-gems="10000000"')
        )
      ) +
      devCard("SS shards",
        '<div class="dev__give">' + devNumber("dev-shards", "SS shards", S.shards, 0) + devButton("dev-shards-set", "Set") + "</div>" +
        devRow(devButton("dev-shards", "+" + PS.SHARDS.needed + " shards"))
      )
    );
  }

  /** The tallies from the last chest simulation, as a list of facts. */
  function devSimResult() {
    var sim = view.devSim;
    if (!sim) return "";
    function share(n) { return fmt(n) + " (" + (Math.round((n / sim.count) * 10000) / 100) + "%)"; }
    var rows = [];
    for (var r = 0; r < PS.RARITY.length; r++) {
      if (sim.rarity[r]) rows.push([PS.RARITY[r].name, share(sim.rarity[r])]);
    }
    rows.push(["S-grade items", share(sim.S)], ["SS-grade items", share(sim.SS)], ["SS shards", fmt(sim.shards) + " (" + Math.floor(sim.shards / PS.SHARDS.needed) + " items' worth)"]);
    return '<p class="devbox__label">' + esc(PS.CHESTS[sim.kind].name) + " × " + fmt(sim.count) + "</p>" +
      '<dl class="facts facts--tight devfacts">' + rows.map(function (row) {
        return "<div><dt>" + row[0] + "</dt><dd>" + row[1] + "</dd></div>";
      }).join("") + "</dl>";
  }

  function devShop(S) {
    var wait = st.giftWait();
    var deals = st.deals();
    var dealRows = deals.map(function (deal) {
      return (
        '<li class="dev__row"><span class="rname r' + deal.r + '">' + esc(PS.RARITY[deal.r].name + " " + PS.ITEMS[deal.id].name) + "</span>" +
        "<span>" + fmt(deal.price) + " " + deal.cur + (deal.bought ? " · bought" : "") + "</span></li>"
      );
    }).join("");
    function chestRow(kind) {
      var chest = PS.CHESTS[kind];
      return '<div class="devbox__label">' + esc(chest.name) + "</div>" + devRow([1, 10, 100].map(function (n) {
        return devButton("dev-chest", "Open ×" + n, ' data-kind="' + kind + '" data-count="' + n + '"');
      }).join(""));
    }
    return (
      devCard("Free chests",
        chestRow("crate") + chestRow("gilded") +
        '<p class="hint">Opens them without taking gems, with the real odds and the pity counters. The results show as a message, so this menu stays open.</p>',
        [["Chests opened", fmt(S.stats.chests)], ["Since the last S-grade", S.shop.pityS], ["Since the last SS-grade", S.shop.pitySS]]
      ) +
      devCard("Simulate 1000 chests",
        devRow(Object.keys(PS.CHESTS).map(function (kind) {
          return devButton("dev-sim", esc(PS.CHESTS[kind].name) + " ×1000", ' data-kind="' + kind + '"');
        }).join("")) +
        devSimResult() +
        '<p class="hint">Opens them on paper with the real odds. You get no gear, and nothing in your save changes.</p>'
      ) +
      devCard("Pity counters",
        '<div class="dev__give">' +
          devNumber("dev-pity-s", "Since S-grade", S.shop.pityS, 0) +
          devNumber("dev-pity-ss", "Since SS-grade", S.shop.pitySS, 0) +
          devButton("dev-pity", "Set") +
        "</div>"
      ) +
      devCard("Free gift and deals",
        devRow(
          devButton("dev-shop", "Gift ready now, deals restocked") +
          devButton("dev-gift-wait", "Gift in 10 seconds", ' data-seconds="10"') +
          devButton("dev-gift-wait", "Gift in an hour", ' data-seconds="3600"')
        ),
        [["Free gift", wait ? PS.countdown(wait) : "ready"], ["Deals bought today", S.shop.bought.filter(Boolean).length + " of " + PS.DEAL_COUNT]]
      ) +
      devCard("Today's deals", '<ul class="dev__list">' + dealRows + "</ul>")
    );
  }

  function devProgress(S) {
    var open = st.unlockedTalents();
    var asc = st.ascendInfo();
    var maxed = open.filter(function (t) { return (S.talents[t.id] || 0) >= t.max; }).length;
    var learned = PS.TALENTS.reduce(function (n, t) { return n + (S.talents[t.id] || 0); }, 0);
    return (
      devCard("Chapters",
        '<div class="dev__give">' +
          devNumber("dev-best", "Chapters cleared", S.best, 0, PS.BAL.CHAPTERS) +
          devButton("dev-best", "Set") +
        "</div>" +
        '<div class="dev__give">' +
          devNumber("dev-chapter", "Chapter on the Battle screen", S.chapter, 1, PS.BAL.CHAPTERS) +
          devButton("dev-chapter", "Set") +
        "</div>" +
        devRow(
          devButton("dev-unlock", "Unlock every chapter") +
          devButton("dev-lockall", "Lock them all again", "", "btn--danger")
        ),
        [["Cleared", S.best + " / " + PS.BAL.CHAPTERS], ["Showing", "chapter " + S.chapter], ["Open up to", "chapter " + Math.min(PS.BAL.CHAPTERS, S.best + 1)]]
      ) +
      devCard("Talents",
        devRow(
          devButton("dev-max-talents", "Max every unlocked talent") +
          devButton("dev-ascend", "Ascend a tier now", asc.top ? " disabled" : "") +
          devButton("dev-reset-talents", "Forget all talents", "", "btn--danger")
        ),
        [["Tier", asc.tier + " of " + PS.TALENT_TIERS], ["Maxed", maxed + " / " + open.length], ["Levels learned", learned]]
      )
    );
  }

  function devQuests(S) {
    var quests = st.quests();
    var ready = quests.filter(function (q) { return q.ready; }).length;
    var finished = quests.filter(function (q) { return q.done; }).length;
    var rows = quests.map(function (q) {
      var state = q.done ? "all done" : q.ready ? "ready to claim" : fmt(q.value) + " / " + fmt(q.target);
      return (
        '<li class="dev__row"><span class="dev__name">' + esc(q.name) + "<small>" + esc(q.text) + "</small></span>" +
        "<span>Rung " + (q.done ? q.tiers : q.tier + 1) + " of " + q.tiers + " · " + state + "</span>" +
        '<span class="dev__acts">' +
          (q.done ? "" : q.ready
            ? devButton("dev-quest-claim", "Claim " + q.gems, ' data-id="' + q.id + '"', "btn--primary")
            : devButton("dev-quest-done", "Complete", ' data-id="' + q.id + '"')) +
        "</span></li>"
      );
    }).join("");
    var counters = Object.keys(S.stats).map(function (key) {
      return devNumber("dev-stat-" + key, STAT_NAMES[key] || key, Math.floor(S.stats[key]), 0);
    }).join("");
    return (
      devCard("Quests",
        devRow(
          devButton("dev-claim-quests", "Claim everything that is ready") +
          devButton("dev-quests-all", "Finish and claim every quest", "", "btn--primary")
        ) + '<ul class="dev__list">' + rows + "</ul>",
        [["Ready to claim", ready], ["Ladders finished", finished + " / " + quests.length]]
      ) +
      devCard("Counters",
        '<p class="hint">The numbers the quests and the record read. Setting them is how to test a quest at its limit.</p>' +
        '<div class="dev__give dev__give--grid">' + counters + "</div>" +
        devRow(devButton("dev-stats-set", "Set these counters", "", "btn--primary"))
      )
    );
  }

  function devChapters(S) {
    var rows = "";
    for (var n = 1; n <= PS.BAL.CHAPTERS; n++) {
      var ch = PS.chapter(n);
      var rec = S.clears[n];
      var state = n <= S.best ? "cleared" : n === S.best + 1 ? "open" : "locked";
      rows +=
        '<li class="dev__row dev__row--chapter is-' + state + '"><b class="dev__no">' + n + "</b>" +
        '<span class="dev__name">' + esc(ch.name) + "<small>" + esc(PS.ZONES[ch.zone].name) + " · " + esc(ch.bossName) + " · " + PS.clock(ch.duration) + " · Power " + fmt(ch.rec) + "</small></span>" +
        "<span>" + state + (rec ? " · best " + PS.clock(rec.time) + " · " + rec.n + "×" : "") + "</span>" +
        '<span class="dev__acts">' +
          devButton("dev-play", "Play", ' data-n="' + n + '"') +
          devButton("dev-clear-to", n === S.best ? "Cleared" : "Clear to here", ' data-n="' + n + '"' + (n === S.best ? " disabled" : "")) +
        "</span></li>";
    }
    return devCard("Every chapter", '<ul class="dev__list dev__list--tall">' + rows + "</ul>" +
      '<p class="hint">Play starts the chapter even if it is locked: a win is saved like any other. Clear to here marks it, and every chapter before it, as cleared.</p>',
      [["Cleared", S.best + " / " + PS.BAL.CHAPTERS], ["Your Power", fmt(st.calc().power)]]);
  }

  function devBattle(S) {
    var sw = PS.dev.startWith;
    var admin = PS.dev.admin;
    var ch = PS.chapter(S.chapter);
    var rec = S.clears[S.chapter];
    var build = PS.dev.startBuild;
    var toggles = PS.dev.TOGGLES.filter(function (t) { return admin || !t.admin; });
    var mults = PS.dev.MULTS.filter(function (m) { return admin || !m.admin; });
    var multRows = mults.map(function (m) {
      var values = m.values.concat(admin && m.more ? m.more : []);
      return '<p class="devbox__label">' + m.label + "</p>" + devRow(values.map(function (v) {
        return '<button class="btn btn--sm' + (sw[m.key] === v ? " btn--primary" : "") + '" type="button" data-act="dev-start-mult" data-key="' + m.key + '" data-value="' + v + '">' + v + "×</button>";
      }).join(""));
    }).join("");
    var buildCard = admin
      ? devCard("Start the next battle built up",
          '<p class="devbox__label">Levels to start with</p>' +
          devRow([0, 5, 10, 25, 50, 100].map(function (v) {
            return '<button class="btn btn--sm' + (build.levels === v ? " btn--primary" : "") + '" type="button" data-act="dev-start-levels" data-value="' + v + '">' + (v ? "+" + v : "None") + "</button>";
          }).join("")) +
          '<div class="devbox__toggles">' + devToggle("dev-start-maxall", "", "Every upgrade maxed", "Takes the whole upgrade list at the start", build.maxAll) + "</div>" +
          '<p class="hint">Levels come with a random upgrade each, picked for you. Applies to the next battle you start from anywhere.</p>'
        )
      : "";
    return (
      devCard("Chapter " + ch.n + ": " + esc(ch.name),
        '<div class="dev__give">' +
          devNumber("dev-start-ch", "Chapter", S.chapter, 1, PS.BAL.CHAPTERS) +
          devButton("dev-start", "Start it, even if locked", "", "btn--primary") +
        "</div>" +
        '<p class="hint">A normal battle: a win here is saved like any other.</p>',
        [
          ["Zone", esc(PS.ZONES[ch.zone].name)],
          ["Length", PS.clock(ch.duration)],
          ["Boss", esc(ch.bossName)],
          ["Recommended", fmt(ch.rec)],
          ["Gold", fmt(ch.gold)],
          ["Pest health ×", ch.hpScale.toFixed(2)],
          ["Pest damage ×", ch.dmgScale.toFixed(2)],
          ["Boss ×", ch.bossScale.toFixed(2)],
          ["Best clear", rec ? PS.clock(rec.time) : "none"]
        ]
      ) +
      devCard("Swarm mode",
        '<div class="dev__give">' +
          devNumber("dev-swarm-ch", "Pests as tough as chapter", S.chapter, 1, PS.BAL.CHAPTERS) +
          devButton("dev-swarm", "Start swarm mode", "", "btn--primary") +
        "</div>" +
        '<p class="hint">Endless, no boss. Pays 3× the usual gold for the chapter you pick and keeps nothing else.</p>'
      ) +
      devCard("Start the next battle with",
        '<div class="devbox__toggles">' + toggles.map(function (t) {
          return devToggle("dev-start-toggle", ' data-key="' + t.key + '"', t.label, t.hint, sw[t.key]);
        }).join("") + "</div>" +
        multRows +
        (admin ? devRow(devButton("dev-start-reset", "Switch all of these off")) : "") +
        '<p class="hint">Inside any battle the DEV button (or the ` key) changes these live' + (admin ? " and has a lot more" : "") + ".</p>"
      ) +
      buildCard +
      (admin ? "" : devCard("Done?", devRow(devButton("dev-lock", "Lock the dev menu again"))))
    );
  }

  function devOwned(S, d) {
    var counts = [];
    S.items.forEach(function (item) { counts[item.r] = (counts[item.r] || 0) + 1; });
    var grades = { S: 0, SS: 0 };
    S.items.forEach(function (item) {
      var g = st.def(item).grade;
      if (g !== "A") grades[g]++;
    });
    var info = [["Items", S.items.length], ["S-grade", grades.S], ["SS-grade", grades.SS]];
    counts.forEach(function (n, r) { if (n) info.push([PS.RARITY[r].name, n]); });
    var slot = d.slot || "all";
    var shown = st.sorted(S.items).filter(function (item) { return slot === "all" || st.def(item).slot === slot; });
    var owned = shown.map(function (item) {
      var worn = st.isEquipped(item);
      var def = st.def(item);
      // worn gear is only taken off, never deleted, so nothing can be lost by accident
      return (
        '<li class="dev__row"><span class="rname r' + item.r + '">' + esc(def.name) + "</span>" +
        "<span>" + PS.RARITY[item.r].name + (def.grade !== "A" ? " · " + def.grade : "") + (worn ? " · equipped" : "") + "</span>" +
        '<span class="dev__acts">' +
          devButton("dev-owned-rarity", "−", ' data-u="' + item.u + '" data-dir="-1" aria-label="One rarity lower"' + (item.r <= 0 ? " disabled" : "")) +
          devButton("dev-owned-rarity", "+", ' data-u="' + item.u + '" data-dir="1" aria-label="One rarity higher"' + (item.r >= PS.MAX_RARITY ? " disabled" : "")) +
          (worn ? "" : devButton("dev-equip", "Wear", ' data-u="' + item.u + '"')) +
          (worn
            ? (def.slot === "weapon" ? "" : devButton("unequip", "Take off", ' data-slot="' + def.slot + '"'))
            : devButton("dev-remove", "Remove", ' data-u="' + item.u + '"')) +
        "</span></li>"
      );
    }).join("");
    var slotOptions = [["all", "Everything"]].concat(PS.SLOTS.map(function (s) { return [s.key, s.plural]; }));
    return (
      devCard("Clean out the bag",
        '<div class="dev__give">' +
          devSelect("dev-clean-r", "Remove unworn items below", rarityOptions(PS.MAX_RARITY + 1), d.clean === undefined ? 2 : d.clean) +
          devButton("dev-clean", "Remove them", "", "btn--danger") +
        "</div>" +
        '<p class="hint">Worn gear is never touched.</p>'
      ) +
      devCard("Everything you own",
        '<div class="dev__give">' + devSelect("dev-owned-filter", "Show", slotOptions, slot) + "</div>" +
        '<ul class="dev__list">' + (owned || '<li class="dev__row">Nothing here.</li>') + "</ul>",
        info
      )
    );
  }

  function devPets(S, d) {
    var species = PS.PET_SPECIES.map(function (sp) { return [sp.id, sp.name + " (" + PS.STATS[sp.stat].name + ")"]; });
    var rarities = PS.PET_RARITY.map(function (def, i) { return [i, PS.RARITY[i].name + " (up to Lv " + def.cap + ")"]; });
    var cap = PS.PET_RARITY[d.pr || 0].cap;
    var total = PS.PET_SPECIES.length * PS.PET_RARITY.length;
    var owned = S.pets.slice().sort(function (a, b) { return b.r - a.r || b.lv - a.lv || (a.sp < b.sp ? -1 : 1); }).map(function (pet) {
      var inf = st.petInfo(pet.u);
      return (
        '<li class="dev__row"><span class="dev__pet">' + PS.petArt(pet.sp, pet.r) + "</span>" +
        '<span class="rname r' + pet.r + '">' + esc(inf.def.name) + "</span>" +
        "<span>" + PS.RARITY[pet.r].name + " · Lv " + pet.lv + "/" + inf.cap + " · " + petBonusText(pet.sp, pet.r, pet.lv) + (inf.equipped ? " · with you" : "") + "</span>" +
        '<span class="dev__acts">' +
          devButton("dev-pet-team", inf.equipped ? "Send home" : "Bring", ' data-u="' + pet.u + '"') +
          devButton("dev-pet-up", "+1", ' data-u="' + pet.u + '"' + (inf.maxed ? " disabled" : "")) +
          devButton("dev-pet-max", "Max", ' data-u="' + pet.u + '"' + (inf.maxed ? " disabled" : "")) +
          devButton("dev-pet-remove", "Remove", ' data-u="' + pet.u + '"', "btn--danger") +
        "</span></li>"
      );
    }).join("");
    return (
      devCard("Your team",
        devRow(
          devButton("dev-pet-slots", "Open every slot", ' data-n="' + PS.PET_SLOTS.max + '"') +
          devButton("dev-pet-slots", "Back to one slot", ' data-n="' + PS.PET_SLOTS.start + '"') +
          devButton("dev-pets-fill", "Fill the team with my best") +
          devButton("dev-pets-max", "Max every pet's level")
        ),
        [["Team slots", S.petSlots + " of " + PS.PET_SLOTS.max], ["With you", S.petTeam.length], ["Pets owned", S.pets.length + " of " + total], ["Eggs hatched", fmt(S.stats.eggs)]]
      ) +
      devCard("Give a pet",
        '<div class="dev__give">' +
          devSelect("dev-psp", "Species", species, d.psp || "bumble") +
          devSelect("dev-pr", "Rarity", rarities, d.pr || 0) +
          devNumber("dev-plv", "Level", d.plv || 1, 1, cap) +
        "</div>" +
        devRow(
          devButton("dev-pet-give", "Give it", "", "btn--primary") +
          devButton("dev-pet-all", "Every species at every rarity, max level")
        ) +
        '<p class="hint">The game keeps one pet per species and rarity, so giving one you already have raises its level.</p>'
      ) +
      devCard("Everything you have", '<ul class="dev__list">' + (owned || '<li class="dev__row">No pets yet.</li>') + "</ul>")
    );
  }

  function devSettings() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    function pref(name, label, hint) {
      return devToggle("pref", ' data-pref="' + name + '"', label, hint, PS.prefs.get(name));
    }
    return (
      devCard("Switches",
        '<div class="devbox__toggles">' +
          devToggle("sound", "", "Sound effects", "All game sounds", PS.sfx.on()) +
          devToggle("theme", "", "Night colours", "Dark theme", dark) +
          pref("shake", "Screen shake", "Shake when things blow up") +
          pref("numbers", "Damage numbers", "Floating hit numbers") +
          pref("autopause", "Auto-pause", "Pause when you leave the tab") +
        "</div>" +
        '<p class="devbox__label">Volume</p>' +
        devRow(PS.VOLUMES.map(function (v, i) {
          return '<button class="btn btn--sm' + (PS.prefs.get("vol") === PS.VOLUME_STEPS[i] ? " btn--primary" : "") + '" type="button" data-act="dev-volume" data-value="' + i + '">' + v.name + "</button>";
        }).join(""))
      ) +
      devBanner() +
      devAbuse() +
      devCard("Messages",
        devRow(
          devButton("dev-notice", "Show the data-reset notice") +
          devButton("dev-lock", "Lock the dev menu again")
        )
      )
    );
  }

  /** The banner above the top bar, for every player. Admin accounts only (the server checks too). */
  function devBanner() {
    if (!PS.dev.admin || !PS.cloud.isAdmin()) return "";
    var b = view.banner;
    var live = b && typeof b.text === "string" ? b.text : null;
    var draft = typeof view.dev.banner === "string" ? view.dev.banner : live !== null ? live : builtInBanner;
    var note = view.dev.bannerNote;
    return devCard("Banner",
      '<p class="hint">The strip of text above the top bar. Every player sees it, within a minute while they play or straight away when they open the game. Leave it empty to hide it.</p>' +
      '<p class="status devbanner" id="dev-banner-preview" aria-hidden="true">' + esc(draft) + "</p>" +
      '<div class="dev__give devbanner__field"><label>Text<input id="dev-banner" type="text" maxlength="200" value="' + esc(draft) + '" autocomplete="off" /></label></div>' +
      devRow(
        devButton("dev-banner-save", "Show to everyone", "", "btn--primary") +
        devButton("dev-banner-hide", "Hide the banner") +
        devButton("dev-banner-reset", "Use the text in index.html")
      ) +
      (note ? '<p class="hint devbanner__note" role="status">' + esc(note) + "</p>" : ""),
      [
        ["Showing now", live === null ? "the text in index.html" : live === "" ? "nothing (hidden)" : "the text set here"],
        ["Last changed", b && b.at ? whenText(new Date(b.at).getTime()) : "not from here yet"]
      ]
    );
  }

  function devSave(modal, S) {
    var snaps = devSnaps();
    var snapRows = snaps.map(function (snap, i) {
      return (
        '<li class="dev__row"><span class="dev__name">' + esc(snap.name || "Snapshot") + "<small>" + new Date(snap.at).toLocaleString() + " · " + (snap.save.length / 1024).toFixed(1) + " KB</small></span>" +
        '<span class="dev__acts">' +
          devButton("dev-snap-load", "Load", ' data-i="' + i + '"') +
          devButton("dev-snap-delete", "Delete", ' data-i="' + i + '"', "btn--danger") +
        "</span></li>"
      );
    }).join("");
    var history = view.devHistory.map(function (entry, i) {
      return (
        '<li class="dev__row"><span class="dev__name">' + esc(entry.label) + "<small>" + devClock(entry.at) + "</small></span>" +
        '<span class="dev__acts">' + devButton("dev-restore", "Go back to before this", ' data-i="' + i + '"') + "</span></li>"
      );
    }).reverse().join("");
    return (
      (PS.dev.admin
        ? devCard("Undo list",
            '<p class="hint">Every change made from this menu is remembered (the last ' + HISTORY_MAX + "), so it can be taken back. The list is gone when the page is closed.</p>" +
            '<ul class="dev__list">' + (history || '<li class="dev__row">Nothing changed yet.</li>') + "</ul>",
            [["Steps remembered", view.devHistory.length]]
          ) +
          devCard("Snapshots",
            '<div class="dev__give">' +
              '<label>Name<input id="dev-snap-name" type="text" maxlength="40" placeholder="Before the boss test" autocomplete="off" /></label>' +
              devButton("dev-snap-save", "Save a snapshot", "", "btn--primary") +
            "</div>" +
            '<ul class="dev__list">' + (snapRows || '<li class="dev__row">No snapshots yet.</li>') + "</ul>" +
            '<p class="hint">Named copies of the save, kept in this browser. Loading one can be undone.</p>'
          )
        : "") +
      devCard("Backup",
        '<p class="hint">Copy the save to keep a backup or move it to another browser, or paste one in and load it.</p>' +
        '<textarea class="dev__save" id="dev-save" rows="6" spellcheck="false" aria-label="Save data">' + esc(modal.exported || "") + "</textarea>" +
        devRow(
          devButton("dev-export", "Show my save") +
          devButton("dev-copy", "Copy it") +
          devButton("dev-import", "Load this save", "", "btn--danger")
        ),
        [["Size", (JSON.stringify(S).length / 1024).toFixed(1) + " KB"]]
      ) +
      (PS.dev.admin
        ? devCard("Save file",
            devRow(devButton("dev-download", "Download the save as a file")) +
            '<div class="dev__give"><label>Load a save file<input id="dev-file" type="file" accept=".json,.txt,application/json,text/plain" /></label></div>'
          )
        : "") +
      devCard("Start again",
        devRow(devButton("dev-reset", modal.resetArmed ? "Yes, wipe this save" : "Reset this save", "", "btn--danger")) +
        '<p class="hint">Only this browser\'s save. Everything goes back to a new game.' + (PS.dev.admin ? " This can be undone from the undo list." : "") + "</p>"
      )
    );
  }

  function devMenu(modal) {
    var S = st.get();
    var tab = view.devTab;
    var calc = st.calc();
    var admin = PS.dev.admin;
    var tabs = admin ? DEV_TABS : DEV_TABS.filter(function (t) { return t[0] === "battle"; });
    if (!tabs.some(function (t) { return t[0] === tab; })) tab = view.devTab = tabs[0][0];
    var body = tab === "gear" ? devGear(S, view.dev, calc)
      : tab === "money" ? devMoney(S)
      : tab === "shop" ? devShop(S)
      : tab === "progress" ? devProgress(S)
      : tab === "quests" ? devQuests(S)
      : tab === "chapters" ? devChapters(S)
      : tab === "battle" ? devBattle(S)
      : tab === "owned" ? devOwned(S, view.dev)
      : tab === "pets" ? devPets(S, view.dev)
      : tab === "settings" ? devSettings()
      : tab === "save" ? devSave(modal, S)
      : devOverview(S, calc);
    var last = view.devHistory[view.devHistory.length - 1];
    return (
      '<div class="dev devshell">' +
        '<button class="modal__close" type="button" data-act="close" aria-label="Close">' + PS.icon("close") + "</button>" +
        '<div class="devshell__head"><h2 id="modal-title">' + (admin ? "Admin menu" : "Dev menu") + "</h2>" +
          (admin ? devButton("dev-undo", "Undo" + (last ? '<span class="devshell__what"> · ' + esc(last.label) + "</span>" : ""), (last ? ' title="Undo: ' + esc(last.label) + '"' : " disabled")) : "") + "</div>" +
        '<p class="hint">For testing. Changes only touch this browser\'s save.</p>' +
        '<div class="devshell__main' + (tabs.length === 1 ? " devshell__main--solo" : "") + '">' +
          (tabs.length === 1 ? "" : '<nav class="devnav" role="tablist" aria-label="Dev menu sections">' + tabs.map(function (t) {
            return '<button class="devnav__item' + (tab === t[0] ? " is-active" : "") + '" type="button" role="tab" aria-selected="' + (tab === t[0]) + '" data-act="dev-tab" data-tab-name="' + t[0] + '">' +
              PS.icon(t[2]) + "<span>" + t[1] + "</span></button>";
          }).join("") + "</nav>") +
          '<div class="devpane">' + body + "</div>" +
        "</div>" +
      "</div>"
    );
  }

  /** What a chest can hold: every item it can roll, weapons first. */
  /* Which slots are unfolded in a chest's list ("A:weapon" and so on). */
  var CHEST_OPEN = { "A:weapon": true };

  function chestList(grade, slotKey, rarity) {
    var ids = (PS.POOL[slotKey] || {})[grade] || [];
    return ids.map(function (id) {
      var def = PS.ITEMS[id];
      return (
        '<li class="chestinfo__item">' + tile({ id: id, r: rarity }, { plain: true, cls: "tile--mini" }) +
          '<span class="chestinfo__text"><strong>' + esc(def.name) + "</strong><small>" + esc(def.blurb) + "</small></span>" +
        "</li>"
      );
    }).join("");
  }

  function chestInfoModal(modal) {
    var chest = PS.CHESTS[modal.kind];
    if (!chest) return null;
    // the rarities this chest can roll, and which one is being shown
    var open = [];
    chest.odds.forEach(function (share, r) { if (share > 0) open.push(r); });
    var shown = open.indexOf(modal.r) !== -1 ? modal.r : open[0];
    // one folding part per slot; a part's list is only drawn once it is opened
    function section(grade, note, rarity) {
      var rows = "";
      PS.SLOTS.forEach(function (slot) {
        var ids = (PS.POOL[slot.key] || {})[grade] || [];
        if (!ids.length) return;
        var key = grade + ":" + slot.key;
        rows +=
          '<details class="chestinfo__part" data-chestpart="' + key + '" data-r="' + rarity + '"' + (CHEST_OPEN[key] ? " open" : "") + ">" +
            '<summary class="chestinfo__slot">' + slot.plural + " <small>" + ids.length + "</small></summary>" +
            '<ul class="chestinfo__list">' + (CHEST_OPEN[key] ? chestList(grade, slot.key, rarity) : "") + "</ul>" +
          "</details>";
      });
      return note + rows;
    }
    var rarities = chest.odds.map(function (share, r) { return share > 0 ? PS.RARITY[r].name : null; }).filter(Boolean);
    var rare = chest.special || chest.s;
    var out =
      '<div class="chestinfo">' +
        '<button class="modal__close" type="button" data-act="close" aria-label="Close">' + PS.icon("close") + "</button>" +
        '<h2 id="modal-title">' + esc(chest.name) + "</h2>" +
        '<p class="hint">One piece of gear per chest, ' + rarities[0] + " to " + rarities[rarities.length - 1] + ". The odds are on the chest.</p>" +
        '<div class="chestinfo__tabs" role="tablist">' + open.map(function (r) {
          return '<button class="chestinfo__tab r' + r + (r === shown ? " is-active" : "") + '" type="button" role="tab" aria-selected="' + (r === shown) + '" data-act="chestinfo-r" data-r="' + r + '">' +
            PS.RARITY[r].name + "<small>" + pctText(chest.odds[r]) + "</small></button>";
        }).join("") + "</div>" +
        '<h3>Everyday gear <span class="rname r' + shown + '">' + PS.RARITY[shown].name + "</span></h3>" + section("A", "", shown);
    if (rare) {
      out += "<h3>S-grade gear" + (chest.special ? ", " + PS.RARITY[chest.special.rarity].name + " only, " + pctText(chest.special.chance) : "") + "</h3>" +
        '<p class="hint">Stronger versions with better perks.</p>' + section("S", "", chest.special ? chest.special.rarity : shown);
    }
    out += '<p class="hint">' + (chest.shard ? "It can also drop an SS shard, " + pctText(chest.shard) + " of the time. " : "") +
      "Chests never hold an SS-grade item.</p>" +
      '<div class="modal__actions"><button class="btn btn--primary" type="button" data-act="close" data-key="m-ok">Got it</button></div>' +
      "</div>";
    return out;
  }

  /** The line over the collection grid: what the tapped item is. */
  function bookCaption(id) {
    var def = id ? PS.ITEMS[id] : null;
    if (!def) return "Tap an item to see what it is.";
    if (st.get().found[id]) {
      return "<b>" + esc(def.name) + "</b>" + (def.grade !== "A" ? ' <b class="rname g-' + def.grade + '">' + def.grade + "</b>" : "") + " · " + esc(def.blurb);
    }
    return "<b>Not found yet.</b> " + (def.grade === "SS" ? "SS-grade gear comes from SS shards and the bosses of every fourth chapter." : "It can turn up in battles and chests.");
  }

  /** The collection book: every item in the game, one slot at a time. Found
   *  ones show in colour, the rest as shadows. */
  function bookModal(modal) {
    var info = st.bookInfo();
    var found = st.get().found;
    var slot = PS.SLOTS.filter(function (s) { return s.key === modal.slot; })[0] || PS.SLOTS[0];
    var ids = PS.ITEM_ORDER.filter(function (id) { return PS.ITEMS[id].slot === slot.key; });
    var next = info.next;
    var from = st.get().book ? PS.BOOK[st.get().book - 1].at : 0;
    var share = next ? PS.clamp((info.found - from) / (next.at - from), 0, 1) : 1;
    return (
      '<div class="book">' +
        '<button class="modal__close" type="button" data-act="close" aria-label="Close">' + PS.icon("close") + "</button>" +
        '<h2 id="modal-title">Collection</h2>' +
        '<p class="hint">Every different piece of gear you have ever owned counts, even after it is forged away or sold.</p>' +
        '<div class="book__progress">' +
          '<p class="book__count"><b>' + fmt(info.found) + "</b> of " + fmt(info.total) + " found</p>" +
          '<div class="book__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(share * 100) + '"><i style="width:' + (share * 100).toFixed(1) + '%"></i></div>' +
          (info.ready
            ? '<button class="btn btn--primary btn--sm" type="button" data-act="book-claim" data-key="book-claim">Claim ' + price("gems", info.gems) + "</button>"
            : next
              ? '<p class="book__next">Next reward at ' + fmt(next.at) + " found: " + price("gems", next.gems) + "</p>"
              : '<p class="book__next">' + PS.icon("check") + "Every item found. That is all of them!</p>") +
        "</div>" +
        '<div class="chestinfo__tabs book__tabs" role="tablist">' + PS.SLOTS.map(function (s) {
          var tally = info.bySlot[s.key];
          var on = s.key === slot.key;
          return '<button class="chestinfo__tab' + (on ? " is-active" : "") + '" type="button" role="tab" aria-selected="' + on + '" data-act="book-slot" data-slot="' + s.key + '">' +
            s.plural + "<small>" + tally.found + "/" + tally.total + "</small></button>";
        }).join("") + "</div>" +
        '<p class="book__caption" aria-live="polite">' + bookCaption(modal.pick) + "</p>" +
        '<div class="book__grid">' + ids.map(function (id) {
          var def = PS.ITEMS[id];
          var have = Boolean(found[id]);
          return '<button class="tile r0 tile--mini' + (have ? (def.grade !== "A" ? " gr-" + def.grade : "") : " book__unseen") + (modal.pick === id ? " is-picked" : "") +
            '" type="button" data-act="book-pick" data-id="' + id + '" title="' + (have ? esc(def.name) : "Not found yet") + '" aria-label="' + (have ? esc(def.name) : "Not found yet") + '">' +
            '<span class="tile__art">' + PS.itemIcon(id) + "</span>" + (have ? gradeTag(def) : "") + "</button>";
        }).join("") + "</div>" +
        '<div class="modal__actions"><button class="btn btn--primary" type="button" data-act="close" data-key="m-ok">Done</button></div>' +
      "</div>"
    );
  }

  function hatchModal(modal) {
    var list = modal.results;
    var many = list.length > 6;
    return (
      '<div class="loot loot--reveal' + (many ? " loot--many" : "") + '">' +
        '<div class="loot__box">' + PS.petArt("egg") + "</div>" +
        '<h2 id="modal-title">' + (list.length === 1 ? "A pet hatched!" : list.length + " eggs hatched!") + "</h2>" +
        '<div class="loot__items">' + list.map(function (res, index) {
          var def = PS.PET[res.pet.sp];
          var note = res.status === "new" ? "New!" : res.status === "level" ? "Level " + res.pet.lv : "Max · +" + fmt(res.gold) + " gold";
          return (
            '<div class="loot__item" style="--i:' + Math.min(index, 24) + '">' +
              '<span class="tile tile--pop pet__tile">' + PS.petArt(res.pet.sp, res.pet.r) + "</span>" +
              '<strong class="rname r' + res.pet.r + '">' + def.name + "</strong>" +
              "<span>" + PS.RARITY[res.pet.r].name + " · " + note + "</span>" +
            "</div>"
          );
        }).join("") + "</div>" +
        '<div class="modal__actions">' +
          '<button class="btn btn--primary" type="button" data-act="close" data-key="m-ok" autofocus>Nice</button>' +
        "</div>" +
      "</div>"
    );
  }

  function wompModal() {
    return (
      '<div class="notice womp">' +
        '<div class="womp__art">' + PS.art("lemon") + "</div>" +
        '<h2 id="modal-title">womp womp</h2>' +
        "<p>That was the dev password. All your data has been reset.</p>" +
        '<div class="modal__actions"><button class="btn btn--primary" type="button" data-act="close" data-key="m-ok" autofocus>OK</button></div>' +
      "</div>"
    );
  }

  function noticeModal() {
    return (
      '<div class="notice">' +
        '<h2 id="modal-title">Your data was reset</h2>' +
        "<p>All your data has been reset because of a bug inside the game. Sorry about that! Everyone starts fresh, so you can play through again.</p>" +
        '<div class="modal__actions"><button class="btn btn--primary" type="button" data-act="close" data-key="m-ok" autofocus>OK</button></div>' +
      "</div>"
    );
  }

  function quickModal(modal) {
    var plan = st.quickPlan(modal.keep);
    var counts = {};
    plan.steps.forEach(function (step) { counts[step.from] = (counts[step.from] || 0) + 1; });
    var rows = "";
    for (var r = 0; r < PS.MAX_RARITY; r++) {
      if (counts[r]) rows += "<li>" + rarityName(r) + " " + PS.icon("right") + " " + rarityName(r + 1) + "<b>× " + counts[r] + "</b></li>";
    }
    var risky = !modal.keep && plan.valuableUsed.length;
    var melted = {};
    plan.valuableUsed.forEach(function (it) {
      var grade = PS.ITEMS[it.id].grade;
      var label = (grade !== "A" ? grade + "-grade " : "") + PS.RARITY[it.r].name;
      melted[label] = (melted[label] || 0) + 1;
    });
    return (
      '<div class="quick">' +
        '<button class="modal__close" type="button" data-act="close" aria-label="Close">' + PS.icon("close") + "</button>" +
        '<h2 id="modal-title">Quick forge</h2>' +
        (plan.steps.length
          ? '<p class="quick__sum"><b>' + plan.steps.length + (plan.steps.length === 1 ? " forge" : " forges") + "</b> in one go, using up <b>" + plan.used + "</b> items.</p>" +
            '<ul class="quick__steps">' + rows + "</ul>" +
            '<p class="quick__label">You will end up with</p>' +
            '<div class="quick__made">' + plan.made.slice(0, 8).map(function (it) { return tile(it, { plain: true, cls: "tile--mini" }); }).join("") +
              (plan.made.length > 8 ? '<span class="count">+' + (plan.made.length - 8) + " more</span>" : "") + "</div>"
          : '<p class="quick__sum">Nothing to forge yet. A forge needs three items of the same slot and rarity. The one you are wearing can be the one that goes up, but is never used up.</p>' +
            (modal.keep ? '<p class="hint">Some forges may be waiting on gear that is being kept safe. Untick the box to include it.</p>' : "")) +
        '<label class="quick__keep"><input type="checkbox" id="quick-keep"' + (modal.keep ? " checked" : "") + " /> Keep Epic and above, and S / SS-grade, safe (never used up)</label>" +
        (risky
          ? '<div class="forge__warn" role="alert"><strong>' + PS.icon("lock") + " These will be destroyed for good:</strong>" +
            Object.keys(melted).map(function (label) { return "<span>" + melted[label] + " × " + esc(label) + "</span>"; }).join("") + "</div>"
          : "") +
        '<div class="modal__actions">' +
          '<button class="btn btn--sm" type="button" data-act="close">Cancel</button>' +
          '<button class="btn ' + (risky ? "btn--danger" : "btn--primary") + '" type="button" data-act="quick-go" data-key="quick-go"' + (plan.steps.length ? "" : " disabled") + ">" + PS.icon("forge") + (risky ? "Melt them down and forge all" : "Forge all") + "</button>" +
        "</div>" +
      "</div>"
    );
  }

  function renderModal() {
    var modal = view.modal;
    var html = null;
    if (modal.type === "item") html = itemModal(modal.u, modal);
    else if (modal.type === "loot") html = lootModal(modal);
    else if (modal.type === "settings") html = settingsModal(modal);
    else if (modal.type === "secret") html = modal.open ? devMenu(modal) : secretModal(modal);
    else if (modal.type === "quick") html = quickModal(modal);
    else if (modal.type === "notice") html = noticeModal();
    else if (modal.type === "womp") html = wompModal();
    else if (modal.type === "hatch") html = hatchModal(modal);
    else if (modal.type === "chestinfo") html = chestInfoModal(modal);
    else if (modal.type === "book") html = bookModal(modal);
    else if (modal.type === "account") html = accountModal();
    else if (modal.type === "gift") html = giftModal(modal);
    else if (modal.type === "taken") html = takenModal(modal);
    else if (modal.type === "chat") html = chatModal();
    else if (modal.type === "blackjack") html = blackjackModal();
    else if (modal.type === "spinner") html = spinnerModal();
    if (html === null) {
      closeModal();
      return;
    }
    el.modal.className = "modal modal--" + modal.type;
    el.modal.innerHTML = html;
  }

  /* --------------------------------------------------------- rank emblems */
  /* Each rank's emblem is drawn once, as an SVG symbol with its gradients,
     and every badge on the page points at it with <use>. */

  function starPoints(cx, cy, outer, inner, points, turn) {
    var out = [];
    for (var i = 0; i < points * 2; i++) {
      var r = i % 2 ? inner : outer;
      var a = (i * Math.PI) / points + (turn === undefined ? -Math.PI / 2 : turn);
      out.push((cx + Math.cos(a) * r).toFixed(2) + "," + (cy + Math.sin(a) * r).toFixed(2));
    }
    return out.join(" ");
  }

  function gradient(id, stops) {
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="0.35" y2="1">' +
      stops.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"/>'; }).join("") +
      "</linearGradient>";
  }

  function tierDefs() {
    var shield = "M16 2.5 27 6.5v8.6c0 6.6-4.4 11.6-11 14.4C9.4 26.7 5 21.7 5 15.1V6.5z";
    var shine = '<path d="M16 4.6 25 7.9v4.3C20 10.8 12 11.4 7 14.4V7.9z" fill="#fff" opacity=".3"/>';
    var chevron = function (y, color) {
      return '<path d="M10.8 ' + y + ' 16 ' + (y + 3.6) + 'l5.2-3.6" fill="none" stroke="' + color + '" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>';
    };
    var gem = "9,5 23,5 29.5,12.5 16,29 2.5,12.5";
    var hex = "16,2.5 27.5,9 27.5,23 16,29.5 4.5,23 4.5,9";
    var oct = "11.6,6 20.4,6 27,12.6 27,21.4 20.4,28 11.6,28 5,21.4 5,12.6";
    var octIn = "13.2,10.4 18.8,10.4 22.6,14.2 22.6,19.8 18.8,23.6 13.2,23.6 9.4,19.8 9.4,14.2";
    return (
      '<svg class="tierdefs" width="0" height="0" aria-hidden="true" focusable="false"><defs>' +
        gradient("tg-unranked", [[0, "#f3f5f8"], [1, "#b4bcc8"]]) +
        gradient("tg-bronze", [[0, "#ffd9b3"], [0.45, "#d98b4e"], [1, "#8a4519"]]) +
        gradient("tg-silver", [[0, "#ffffff"], [0.45, "#c6cfdc"], [1, "#78849a"]]) +
        gradient("tg-gold", [[0, "#fff6b8"], [0.45, "#f6c437"], [1, "#b57606"]]) +
        gradient("tg-diamond", [[0, "#effcff"], [0.45, "#72d8f6"], [1, "#1b7fbf"]]) +
        gradient("tg-platinum", [[0, "#ffffff"], [0.4, "#ddd8f5"], [1, "#857bc2"]]) +
        gradient("tg-citrine", [[0, "#fffbd2"], [0.4, "#ffd83a"], [1, "#e07f00"]]) +
        gradient("tg-zray", [[0, "#fff4b0"], [1, "#ff9f1a"]]) +
        '<radialGradient id="tg-zcore" cx="0.4" cy="0.35" r="0.75">' +
          '<stop offset="0" stop-color="#ffd2f2"/><stop offset="0.45" stop-color="#b56cff"/><stop offset="1" stop-color="#4c22c4"/>' +
        "</radialGradient>" +

        '<symbol id="tier-unranked" viewBox="0 0 32 32">' +
          '<circle cx="16" cy="16" r="11.5" fill="url(#tg-unranked)" stroke="#8d96a8" stroke-width="1.4" stroke-dasharray="3 2.2"/>' +
          '<path d="M11.5 16h9" stroke="#7a8496" stroke-width="2.4" stroke-linecap="round"/>' +
        "</symbol>" +

        '<symbol id="tier-bronze" viewBox="0 0 32 32">' +
          '<path d="' + shield + '" fill="url(#tg-bronze)" stroke="#6b3410" stroke-width="1.4" stroke-linejoin="round"/>' + shine +
          chevron(14.2, "#fff1e0") +
        "</symbol>" +

        '<symbol id="tier-silver" viewBox="0 0 32 32">' +
          '<path d="' + shield + '" fill="url(#tg-silver)" stroke="#4d586a" stroke-width="1.4" stroke-linejoin="round"/>' + shine +
          chevron(11.6, "#ffffff") + chevron(16.6, "#ffffff") +
        "</symbol>" +

        '<symbol id="tier-gold" viewBox="0 0 32 32">' +
          '<path d="' + shield + '" fill="url(#tg-gold)" stroke="#8a5600" stroke-width="1.4" stroke-linejoin="round"/>' + shine +
          '<polygon points="' + starPoints(16, 15.8, 6.4, 2.8, 5) + '" fill="#fffbe0" stroke="#b57606" stroke-width=".9" stroke-linejoin="round"/>' +
        "</symbol>" +

        '<symbol id="tier-diamond" viewBox="0 0 32 32">' +
          '<polygon points="' + gem + '" fill="url(#tg-diamond)" stroke="#0d5c8a" stroke-width="1.3" stroke-linejoin="round"/>' +
          '<polygon points="9,5 16,5 12,12.5 2.5,12.5" fill="#fff" opacity=".45"/>' +
          '<path d="M2.5 12.5h27M9 5l3 7.5L16 29M23 5l-3 7.5L16 29M12 12.5 16 5l4 7.5" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width=".9" stroke-linejoin="round"/>' +
        "</symbol>" +

        '<symbol id="tier-platinum" viewBox="0 0 32 32">' +
          '<polygon points="' + hex + '" fill="url(#tg-platinum)" stroke="#463f86" stroke-width="1.4" stroke-linejoin="round"/>' +
          '<polygon points="16,6 24,10.5 24,21.5 16,26 8,21.5 8,10.5" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".9"/>' +
          '<polygon points="' + starPoints(16, 16, 7.4, 2.2, 4) + '" fill="#ffffff" stroke="#6a60b2" stroke-width=".8" stroke-linejoin="round"/>' +
        "</symbol>" +

        '<symbol id="tier-citrine" viewBox="0 0 32 32">' +
          '<polygon points="' + oct + '" fill="url(#tg-citrine)" stroke="#8a4f00" stroke-width="1.3" stroke-linejoin="round"/>' +
          '<polygon points="' + octIn + '" fill="#fff6a6" fill-opacity=".55" stroke="#fff" stroke-opacity=".8" stroke-width=".8"/>' +
          '<path d="M11.6 6l1.6 4.4M20.4 6l-1.6 4.4M27 12.6l-4.4 1.6M27 21.4l-4.4-1.6M20.4 28l-1.6-4.4M11.6 28l1.6-4.4M5 21.4l4.4-1.6M5 12.6l4.4 1.6" stroke="#fff" stroke-opacity=".6" stroke-width=".8"/>' +
          '<path d="M16.2 6c.6-2.6 3.2-4 5.8-3.4-.9 2.5-3.3 3.8-5.8 3.4z" fill="#8fae65" stroke="#5f8244" stroke-width=".7"/>' +
          '<polygon points="' + starPoints(24.5, 9, 2.6, 0.7, 4) + '" fill="#fff"/>' +
        "</symbol>" +

        '<symbol id="tier-zenith" viewBox="0 0 32 32">' +
          '<polygon points="' + starPoints(16, 16, 15.2, 10.4, 12) + '" fill="url(#tg-zray)" stroke="#b06a00" stroke-width=".7" stroke-linejoin="round"/>' +
          '<circle cx="16" cy="16" r="9.2" fill="url(#tg-zcore)" stroke="#fff3b8" stroke-width="1.2"/>' +
          '<path d="M11 19.6 10.2 13l3.5 2.5L16 10.6l2.3 4.9 3.5-2.5-.8 6.6z" fill="#fff6cf" stroke="#c98a1b" stroke-width=".8" stroke-linejoin="round"/>' +
          '<path d="M11.2 21.2h9.6" stroke="#fff6cf" stroke-width="1.5" stroke-linecap="round"/>' +
        "</symbol>" +
      "</defs></svg>"
    );
  }

  /** A rank's emblem, with its name for screen readers and on hover. */
  function tierBadge(tier, cls) {
    var t = PS.cloud.TIERS[tier];
    return '<span class="tier tier--' + t.key + (cls ? " " + cls : "") + '" role="img" aria-label="' + t.name + '" title="' + t.name + '">' +
      '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><use href="#tier-' + t.key + '"/></svg></span>';
  }

  /** Your figure on a board. Chapter, Power and Collection are this save as it
   *  is now; the others are the best of this device and what the server holds,
   *  since those never go down. */
  function myFigure(key) {
    var here = PS.cloud.figures()[key] || 0;
    if (PS.cloud.isCurrent(key)) return here;
    var mine = myRow();
    var held = PS.cloud.held();
    return Math.max(here, mine ? mine[key] || 0 : 0, held ? held[key] || 0 : 0);
  }

  /** The rank a row shows on a board: the one an admin picked ("tier:power"), or the real one. */
  function shownTier(row, key, value) {
    var pick = row && row.shown && typeof row.shown === "object" ? row.shown["tier:" + key] : null;
    for (var i = 0; pick && i < PS.cloud.TIERS.length; i++) if (PS.cloud.TIERS[i].key === pick) return i;
    return PS.cloud.tierOf(key, value);
  }

  /** The place an admin picked for a row on a board ("place:power"), or 0. */
  function shownPlace(row, key) {
    var pick = row && row.shown && typeof row.shown === "object" ? Math.floor(Number(row.shown["place:" + key])) : 0;
    return pick >= 1 && pick <= 100000 ? pick : 0;
  }

  /** The rows in the order shown: rows given a place move there and show that number. */
  function placed(rows, key) {
    var moved = [];
    var rest = [];
    rows.forEach(function (row) {
      var at = shownPlace(row, key);
      if (at) {
        var copy = {};
        for (var k in row) copy[k] = row[k];
        copy.rank = at;
        moved.push(copy);
      } else {
        rest.push(row);
      }
    });
    moved.sort(function (a, b) { return a.rank - b.rank; });
    moved.forEach(function (row) { rest.splice(Math.min(row.rank - 1, rest.length), 0, row); });
    return rest;
  }

  /** Your rank on every board, at the top of the account window; a tap shows that board. */
  function myRanks() {
    return PS.cloud.BOARDS.map(function (def) {
      var tier = shownTier(myRow(), def.key, myFigure(def.key));
      return (
        '<button class="ranks__cell' + (def.key === view.board.by ? " is-on" : "") + '" type="button" data-act="board-by" data-by="' + def.key + '" title="' + esc(def.text) + '">' +
          tierBadge(tier, "tier--lg") +
          "<b>" + PS.cloud.TIERS[tier].name + "</b>" +
          "<small>" + esc(def.name) + "</small>" +
        "</button>"
      );
    }).join("");
  }

  /** The ladder for the board on show: every rank and what it takes, yours lit up. */
  function ladder() {
    var def = PS.cloud.boardOf(view.board.by);
    var value = myFigure(def.key);
    var tier = shownTier(myRow(), def.key, value);
    var steps = PS.cloud.TIERS.slice(1).map(function (t, i) {
      return (
        '<li class="ladder__step' + (i + 1 <= tier ? " is-got" : "") + (i + 1 === tier ? " is-now" : "") + '">' +
          tierBadge(i + 1) + "<b>" + t.name + "</b><small>" + esc(PS.cloud.short(def.key, def.ranks[i])) + "</small>" +
        "</li>"
      );
    }).join("");
    var next = tier < def.ranks.length
      ? "Next rank: <b>" + PS.cloud.TIERS[tier + 1].name + "</b> at " + esc(PS.cloud.show(def.key, def.ranks[tier]))
      : "You have the top rank here. Nothing above Zenith!";
    return '<ol class="ladder">' + steps + '</ol><p class="ladder__next">' + next + "</p>";
  }

  /* ------------------------------------------ accounts and the leaderboard */

  var BOARD_SHOW = 100; // rows drawn at once; search finds the rest

  /** A round badge with the first letter of a name, in that name's own colour. */
  function avatar(name, cls) {
    var text = String(name || "?");
    return '<span class="avatar' + (cls ? " " + cls : "") + '" style="--hue:' + (PS.hash(text.toLowerCase()) % 360) + '" aria-hidden="true">' +
      esc(text.charAt(0).toUpperCase()) + "</span>";
  }

  /** The button at the top right: who is playing. */
  function renderAccount() {
    var who = PS.cloud.me();
    var off = !who || PS.cloud.offline();
    el.account.innerHTML = avatar(who ? who.name : "?") + '<span class="account__name">' + esc(who ? who.name : "Log in") + "</span>";
    el.account.classList.toggle("is-off", off);
    el.account.setAttribute("aria-label", who ? who.name + ": your account and the leaderboard" : "Log in, and the leaderboard");
  }

  function dayText(iso) {
    var date = new Date(iso);
    return isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  /** "just now", "5m ago", "3h ago", "2d ago" */
  function ago(iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (!isFinite(s)) return "";
    if (s < 90) return "just now";
    if (s < 3600) return Math.round(s / 60) + "m ago";
    if (s < 86400) return Math.round(s / 3600) + "h ago";
    return Math.round(s / 86400) + "d ago";
  }

  function myRow() {
    var who = PS.cloud.me();
    var rows = view.board.rows;
    if (!who || !rows) return null;
    for (var i = 0; i < rows.length; i++) if (rows[i].id === who.id) return rows[i];
    return null;
  }

  function accountSub() {
    var who = PS.cloud.me();
    if (!who) return "Log in to see the leaderboard and get on it.";
    if (PS.cloud.offline()) return "Playing offline. Your progress goes on the leaderboard when you log in again.";
    var bits = [];
    if (who.joined) bits.push("Joined " + esc(dayText(who.joined)));
    var mine = myRow();
    if (mine) bits.push("<b>#" + (shownPlace(mine, view.board.by) || mine.rank) + "</b> in " + esc(PS.cloud.boardOf(view.board.by).name));
    return bits.join(" · ");
  }

  function boardRow(row, board, who) {
    var you = Boolean(who && row.id === who.id);
    var mod = PS.cloud.isAdmin();
    var ban = mod ? PS.cloud.banOf(row) : null;
    var open = Boolean(mod && view.board.mod && view.board.mod.id === row.id);
    // everyone sees the owner's title; only admins see who else is an admin
    var owner = Boolean(row.admin && String(row.name).toLowerCase() === "owner");
    var title = owner ? ' <em class="is-owner">owner</em>' : mod && row.admin && !you ? ' <em class="is-admin">admin</em>' : "";
    return (
      '<li class="board__row' + (you ? " is-me" : "") + (ban ? " is-banned" : "") + (open ? " is-open" : "") + '">' +
        '<span class="board__rank board__rank--' + Math.min(row.rank || 4, 4) + '">' + (row.rank || "\u2013") + "</span>" +
        avatar(row.name) +
        '<span class="board__who"><span class="board__name"><span class="board__nm">' + esc(row.name) + "</span>" + (you ? " <em>you</em>" : "") + title + "</span>" +
          "<small>" + (ban ? '<b class="board__ban">' + (ban.timeout ? "Timed out until " + esc(whenText(ban.until)) : "Banned") + "</b>"
            : (mod && view.board.presence ? presenceHtml(row.id) : esc(ago(row.updated_at)))) + "</small></span>" +
        '<span class="board__value">' + tierBadge(shownTier(row, board.key, row[board.key])) + "<span>" + esc(PS.cloud.shownAs(row, board.key)) + "</span></span>" +
        (mod ? modButtons(row, who) : "") +
        (open ? modForm() : "") +
      "</li>"
    );
  }

  /** For admins: banned and timed-out players, in their own list under the board. */
  function bannedPart(board, who, find) {
    var b = view.board;
    if (!PS.cloud.isAdmin() || !b.banned || !b.banned.length) return "";
    var list = find ? b.banned.filter(function (row) { return row.name.toLowerCase().indexOf(find) !== -1; }) : b.banned;
    return (
      '<div class="board__bannedbox">' +
        '<button class="board__bannedbtn" type="button" data-act="board-banned" aria-expanded="' + b.showBanned + '">' +
          (b.showBanned ? "Hide" : "Show") + " banned and timed out (" + b.banned.length + ")</button>" +
        (!b.showBanned ? ""
          : list.length ? '<ol class="board__list board__list--banned">' + list.map(function (row) { return boardRow(row, board, who); }).join("") + "</ol>"
          : '<p class="hint board__more">No one by that name.</p>') +
      "</div>"
    );
  }

  function boardBody() {
    var b = view.board;
    var who = PS.cloud.me();
    if (!who || PS.cloud.offline()) {
      return '<div class="board__empty"><p>The leaderboard needs a connection and an account.</p>' +
        '<button class="btn btn--sm btn--primary" type="button" data-act="login">Log in</button></div>';
    }
    if (b.error) {
      return '<div class="board__empty"><p>' + esc(b.error) + "</p>" +
        '<button class="btn btn--sm" type="button" data-act="board-refresh">Try again</button></div>';
    }
    if (!b.rows) {
      return '<ol class="board__list is-loading" aria-label="Loading">' + '<li class="board__row board__ghost"></li>'.repeat(5) + "</ol>";
    }
    var board = PS.cloud.boardOf(b.by);
    var find = b.q.trim().toLowerCase();
    var all = placed(b.rows, board.key); // anyone an admin gave a place to is moved there
    var rows = find ? all.filter(function (row) { return row.name.toLowerCase().indexOf(find) !== -1; }) : all;
    var when = b.span === "today" ? "today" : "this week";
    if (!rows.length) {
      var none = find
        ? "No one called “" + esc(b.q.trim()) + "” is on this board" + (b.span === "all" ? "." : " " + when + ".")
        : b.span === "all" ? "No scores here yet. Be the first!" : "No one has made progress " + when + " yet.";
      return '<div class="board__empty"><p>' + none + "</p></div>" + bannedPart(board, who, find);
    }
    var shown = rows.slice(0, BOARD_SHOW);
    var mine = who ? all.filter(function (row) { return row.id === who.id; })[0] || null : null;
    var html = '<ol class="board__list">' + shown.map(function (row) { return boardRow(row, board, who); }).join("") + "</ol>";
    if (rows.length > shown.length) html += '<p class="hint board__more">Showing the top ' + shown.length + " of " + fmt(rows.length) + ". Search for a name to find anyone else.</p>";
    if (!find && mine && shown.indexOf(mine) === -1) html += '<ol class="board__list board__list--me">' + boardRow(mine, board, who) + "</ol>";
    if (!find && !mine) {
      html += '<p class="hint board__more">You are not on this board ' + (b.span === "all" ? "yet." : when + ". Make some progress to get on it.") + "</p>";
    }
    return html + bannedPart(board, who, find);
  }

  /** Changing your name: it is your login too, so you log in with the new one afterwards. */
  function renameForm() {
    var r = view.rename;
    return (
      '<form class="acct__rename" data-form="rename" novalidate>' +
        '<label class="board__field"><span>New name</span>' +
          '<input id="rename-name" type="text" maxlength="16" autocomplete="off" spellcheck="false" value="' + esc(r.value) + '" /></label>' +
        '<p class="hint">3 to 16 letters, numbers or _. You log in with the new name from now on, with the same password.</p>' +
        '<p class="board__formerr" role="alert">' + esc(r.error || "") + "</p>" +
        '<div class="board__formbtns">' +
          '<button class="btn btn--sm" type="button" data-act="rename-cancel">Cancel</button>' +
          '<button class="btn btn--sm btn--primary" type="submit"' + (r.busy ? " disabled" : "") + ">" + (r.busy ? "Changing..." : "Change it") + "</button>" +
        "</div>" +
      "</form>"
    );
  }

  function renameSubmit(e) {
    e.preventDefault();
    var r = view.rename;
    if (!r || r.busy) return;
    var box = $("#rename-name");
    r.value = box ? box.value.trim() : r.value;
    r.busy = true;
    r.error = "";
    renderModal();
    PS.cloud.rename(r.value).then(function (res) {
      if (view.rename !== r) return;
      r.busy = false;
      if (res.error) {
        r.error = res.error;
        renderModal();
        return;
      }
      view.rename = null;
      renderAccount();
      toast("You are " + PS.cloud.me().name + " now. Log in with that name next time.");
      if (view.modal && view.modal.type === "account") {
        renderModal();
        loadBoard(true);
      }
    });
  }

  function accountModal() {
    var who = PS.cloud.me();
    var online = Boolean(who && !PS.cloud.offline());
    var b = view.board;
    var board = PS.cloud.boardOf(b.by);
    return (
      '<div class="acct">' +
        '<button class="modal__close" type="button" data-act="close" aria-label="Close">' + PS.icon("close") + "</button>" +
        '<div class="acct__me">' +
          avatar(who ? who.name : "?", "avatar--lg") +
          '<div class="acct__who">' +
            '<h2 id="modal-title">' + esc(who ? who.name : "Not logged in") + "</h2>" +
            '<p id="account-sub">' + accountSub() + "</p>" +
            (online && view.rename ? renameForm() : "") +
            (online
              ? '<span class="acct__btns">' +
                  (view.rename ? "" : '<button class="btn btn--sm" type="button" data-act="rename-open">Change name</button>') +
                  '<button class="btn btn--sm" type="button" data-act="logout">Log out</button></span>'
              : '<button class="btn btn--sm btn--primary" type="button" data-act="login">Log in</button>') +
          "</div>" +
        "</div>" +
        '<div class="ranks" id="my-ranks" role="group" aria-label="Your ranks">' + myRanks() + "</div>" +
        '<div class="board__head"><h3>Leaderboard</h3>' +
          (online ? '<button class="btn btn--sm" type="button" data-act="board-refresh">Refresh</button>' : "") +
        "</div>" +
        '<div class="filters board__by" role="group" aria-label="Rank by">' +
          PS.cloud.BOARDS.map(function (def) {
            return '<button class="filter" type="button" data-act="board-by" data-by="' + def.key + '" aria-pressed="' + (def.key === b.by) + '">' + PS.icon(def.icon) + esc(def.name) + "</button>";
          }).join("") +
        "</div>" +
        '<div class="board__tools">' +
          '<div class="board__span" role="group" aria-label="Who to show">' +
            PS.cloud.SPANS.map(function (span) {
              return '<button type="button" data-act="board-span" data-span="' + span.key + '" aria-pressed="' + (span.key === b.span) + '">' + esc(span.name) + "</button>";
            }).join("") +
          "</div>" +
          '<input class="board__search" id="board-search" type="search" placeholder="Find a name" aria-label="Find a player by name" autocomplete="off" spellcheck="false" maxlength="16" value="' + esc(b.q) + '" />' +
        "</div>" +
        '<p class="board__what">' + PS.icon(board.icon) + esc(board.text) +
          (b.span === "all" ? "" : b.span === "today" ? ", players with progress today" : ", players with progress this week") + "</p>" +
        '<div class="ladderbox" id="board-ladder">' + ladder() + "</div>" +
        '<div class="board" id="board" aria-live="polite">' + boardBody() + "</div>" +
      "</div>"
    );
  }

  /** Redraw the list and the rank line in place, so the search box keeps its focus. */
  function paintBoard() {
    if (!view.modal || view.modal.type !== "account") return;
    var box = $("#board");
    if (box) box.innerHTML = boardBody();
    var sub = $("#account-sub");
    if (sub) sub.innerHTML = accountSub();
    // the server's figures may have arrived, and they can lift your ranks
    var ranks = $("#my-ranks");
    if (ranks) ranks.innerHTML = myRanks();
    var steps = $("#board-ladder");
    if (steps) steps.innerHTML = ladder();
  }

  function loadBoard(fresh) {
    var b = view.board;
    var by = b.by;
    var span = b.span;
    if (fresh) {
      b.rows = null;
      b.error = "";
      paintBoard();
    }
    PS.cloud.board(by, span, fresh).then(function (res) {
      if (b.by !== by || b.span !== span) return; // the filters moved on while this was loading
      b.rows = res.error ? null : res.rows;
      b.banned = res.banned || [];
      b.error = res.error || "";
      paintBoard();
    });
    loadPresence();
  }

  /** A row on the board or in the banned list. */
  function boardFind(id) {
    var all = (view.board.rows || []).concat(view.board.banned || []);
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  function setBoard(by, span) {
    var b = view.board;
    b.mod = null;
    b.by = by || b.by;
    b.span = span || b.span;
    b.rows = null;
    b.banned = [];
    b.error = "";
    renderModal();
    loadBoard(false);
  }

  /* The screen before the menus: log in or make an account. */

  function gateHtml() {
    var g = view.gate;
    var signup = g.mode === "signup";
    return (
      '<div class="gate__card">' +
        '<div class="gate__art">' + PS.art("lemon") + "</div>" +
        '<h1 class="gate__title" id="gate-title">PIP SURVIVORS</h1>' +
        '<p class="gate__tag">a Lemon game</p>' +
        (g.checking
          ? '<p class="gate__checking">Connecting…</p>'
          : '<div class="gate__tabs" role="group" aria-label="Log in or sign up">' +
              '<button class="gate__tab" type="button" data-act="gate-mode" data-mode="login" aria-pressed="' + !signup + '">Log in</button>' +
              '<button class="gate__tab" type="button" data-act="gate-mode" data-mode="signup" aria-pressed="' + signup + '">Sign up</button>' +
            "</div>" +
            '<form class="gate__form" data-form="gate" novalidate>' +
              '<label class="gate__field"><span>Name</span>' +
                '<input id="gate-name" name="username" type="text" value="' + esc(g.name) + '" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="16" /></label>' +
              '<label class="gate__field"><span>Password</span>' +
                '<input id="gate-pass" name="password" type="password" autocomplete="' + (signup ? "new-password" : "current-password") + '" /></label>' +
              (signup
                ? '<label class="gate__field"><span>Password again</span><input id="gate-pass2" name="password2" type="password" autocomplete="new-password" /></label>'
                : "") +
              '<p class="gate__error" id="gate-error" role="alert">' + esc(g.error) + "</p>" +
              '<button class="btn btn--primary gate__go" id="gate-go" type="submit">' + (signup ? "Create account" : "Log in") + "</button>" +
            "</form>" +
            '<p class="gate__note">' +
              (signup
                ? "Your name goes on the leaderboard: 3 to 16 letters, numbers or _. There is no email, so keep your password somewhere safe."
                : "New here? Pick <b>Sign up</b> to make an account.") +
            "</p>" +
            '<div class="gate__down" id="gate-down"' + (g.down ? "" : " hidden") + ">" +
              "<p>No connection? You can still play. Your progress goes on the leaderboard next time you log in.</p>" +
              '<div class="gate__downbtns">' +
                '<button class="btn btn--sm" type="button" data-act="gate-retry">Try again</button>' +
                '<button class="btn btn--sm" type="button" data-act="gate-offline">Play offline</button>' +
              "</div>" +
            "</div>" +
            '<p class="gate__rules">' + PS.icon("skull") + "<span>Use your real name. If you’re caught using bad language, you’ll be banned.</span></p>") +
      "</div>"
    );
  }

  function showGate(info) {
    info = info || {};
    var g = view.gate || (view.gate = { mode: "login", name: "", error: "", down: false, checking: false, busy: false });
    g.checking = Boolean(info.checking);
    g.error = info.error || "";
    g.down = Boolean(info.down);
    g.busy = false;
    if (typeof info.name === "string") g.name = info.name;
    el.app.hidden = true;
    el.gate.innerHTML = gateHtml();
    el.gate.hidden = false;
    // on a phone the keyboard would cover the card before anyone has looked at it
    var touch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    var first = $(g.name ? "#gate-pass" : "#gate-name");
    if (first && !touch) first.focus();
  }

  /** Patch the form in place, so what has been typed stays put. */
  function gateState(busy, error, down) {
    var g = view.gate;
    if (!g) return;
    g.busy = busy;
    g.error = error || "";
    g.down = Boolean(down);
    var go = $("#gate-go");
    if (go) {
      go.disabled = busy;
      go.textContent = busy ? (g.mode === "signup" ? "Making your account…" : "Logging in…") : g.mode === "signup" ? "Create account" : "Log in";
    }
    var line = $("#gate-error");
    if (line) line.textContent = g.error;
    var down = $("#gate-down");
    if (down) down.hidden = !g.down;
  }

  function gateSubmit(e) {
    e.preventDefault();
    var g = view.gate;
    if (!g || g.busy) return;
    var nameBox = $("#gate-name");
    var passBox = $("#gate-pass");
    var again = $("#gate-pass2");
    g.name = nameBox ? nameBox.value.trim() : "";
    var password = passBox ? passBox.value : "";
    if (g.mode === "signup" && again && again.value !== password) {
      gateState(false, "The two passwords don't match.");
      again.focus();
      return;
    }
    gateState(true, "");
    var job = g.mode === "signup" ? PS.cloud.signUp(g.name, password) : PS.cloud.signIn(g.name, password);
    job.then(function (res) {
      if (view.gate !== g) return;
      if (res.error) {
        gateState(false, res.error, res.down);
        var aboutName = /^(Type a name|Names |That name is taken|That name can't)/.test(res.error);
        var box = aboutName ? nameBox : passBox;
        if (box) box.focus();
        return;
      }
      enter(g.mode === "signup");
    });
  }

  /** Into the menus as whoever is signed in (or playing offline). */
  function enter(welcome) {
    var who = PS.cloud.me();
    if (!PS.cloud.isAdmin()) PS.dev.lock(); // the tab may still remember an admin from before
    if (showBan()) return; // banned or timed out: the ban screen instead
    st.load(who ? who.id : null); // every account on this device has its own save
    view.gate = null;
    view.forge = null;
    view.results = null;
    view.board.rows = null;
    view.board.banned = [];
    view.board.error = "";
    view.board.mod = null;
    el.gate.hidden = true;
    el.gate.innerHTML = "";
    el.app.hidden = false;
    view.entering = true;
    renderAccount();
    render();
    chat.lastId = null; // so the next look only notes where the chat is up to
    setTimeout(checkMentions, 400);
    if (st.takeWipeNotice()) openModal({ type: "notice" });
    else if (welcome && who) toast("Welcome, " + who.name + "!");
    PS.cloud.sync();
    watch();
  }

  function signOut() {
    var who = PS.cloud.me();
    var name = who && !PS.cloud.offline() ? who.name : "";
    PS.dev.lock(); // the next person on this tab does not inherit the admin menu
    PS.cloud.signOut();
    view.gate = null;
    showGate({ name: name });
  }

  /** Pick up last time's session, or ask who is playing. */
  function boot() {
    var slow = setTimeout(function () { showGate({ checking: true }); }, 400);
    PS.cloud.start().then(function (res) {
      clearTimeout(slow);
      if (PS.cloud.me()) enter(false);
      else showGate(res);
    });
  }

  /* --------------------------------------------- moderation (admins only) */

  var TIMEOUTS = [[10, "10 minutes"], [60, "1 hour"], [1440, "1 day"], [10080, "1 week"]];
  var CHECK_EVERY = 45000; // how often a signed-in game asks about bans and gifts

  /** "4:05 PM" today, "22 Oct, 4:05 PM" another day. */
  function whenText(ms) {
    var date = new Date(ms);
    var today = date.toDateString() === new Date().toDateString();
    return today
      ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : date.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  }

  function timeoutName(minutes) {
    for (var i = 0; i < TIMEOUTS.length; i++) if (TIMEOUTS[i][0] === minutes) return TIMEOUTS[i][1];
    return minutes + " minutes";
  }

  function firstItem(slot) {
    for (var i = 0; i < PS.ITEM_ORDER.length; i++) if (PS.ITEMS[PS.ITEM_ORDER[i]].slot === slot) return PS.ITEM_ORDER[i];
    return PS.ITEM_ORDER[0];
  }

  function itemOptions(current) {
    return PS.SLOTS.map(function (slot) {
      return '<optgroup label="' + esc(slot.plural) + '">' +
        PS.ITEM_ORDER.filter(function (id) { return PS.ITEMS[id].slot === slot.key; }).map(function (id) {
          var def = PS.ITEMS[id];
          return '<option value="' + id + '"' + (id === current ? " selected" : "") + ">" + esc(def.name) + (def.grade !== "A" ? " (" + def.grade + ")" : "") + "</option>";
        }).join("") +
      "</optgroup>";
    }).join("");
  }

  function options(list, current) {
    return list.map(function (o) {
      return '<option value="' + o[0] + '"' + (String(o[0]) === String(current) ? " selected" : "") + ">" + esc(o[1]) + "</option>";
    }).join("");
  }

  /** The admin's buttons under a row: Give always; Time out and Ban, or Unban. */
  function modButtons(row, who) {
    var self = row.id === who.id;
    var banned = Boolean(PS.cloud.banOf(row));
    var open = view.board.mod && view.board.mod.id === row.id ? view.board.mod.act : "";
    function button(act, label, cls) {
      return '<button class="board__act' + (cls ? " " + cls : "") + '" type="button" data-act="mod-open" data-mod="' + act + '" data-id="' + esc(row.id) + '" aria-pressed="' + (open === act) + '">' + label + "</button>";
    }
    var out = [button("give", PS.icon("gift") + "Give"), button("inv", PS.icon("tabGear") + "Inventory"), button("shown", "Show as...")];
    if (!self && !row.admin) {
      if (banned) {
        out.push('<button class="board__act" type="button" data-act="mod-unban" data-id="' + esc(row.id) + '">Unban</button>');
      } else {
        out.push(button("timeout", PS.icon("clock") + "Time out"));
        out.push(button("ban", "Ban", "is-danger"));
      }
    }
    return '<div class="board__mod">' + out.join("") + "</div>";
  }

  /* ---- an admin looking at a player's inventory */

  var INV_PAGE = 120; // bag items drawn at once, so a giant bag cannot freeze the page

  /** A player's inventory as their game sent it, keeping only what makes sense:
   *  real item and pet ids, rarities in range, whole numbers. Never trusted as it came. */
  function cleanInv(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    function n(v, max) {
      v = Math.floor(Number(v));
      return isFinite(v) && v > 0 ? Math.min(v, max) : 0;
    }
    function rarity(r) {
      r = Math.floor(Number(r));
      return isFinite(r) && r >= 0 && r <= PS.MAX_RARITY ? r : -1;
    }
    var worn = [];
    PS.SLOTS.forEach(function (slot) {
      var w = raw.worn && Array.isArray(raw.worn[slot.key]) ? raw.worn[slot.key] : null;
      var ok = w && PS.ITEMS[w[0]] && PS.ITEMS[w[0]].slot === slot.key && rarity(w[1]) >= 0;
      worn.push({ slot: slot, item: ok ? { id: w[0], r: rarity(w[1]) } : null, lv: ok ? Math.max(1, n(w[2], 1000)) : 0 });
    });
    var bag = [];
    var bad = 0;
    var list = Array.isArray(raw.bag) ? raw.bag : [];
    for (var i = 0; i < list.length && i < 5000; i++) {
      var x = list[i];
      if (Array.isArray(x) && PS.ITEMS[x[0]] && rarity(x[1]) >= 0) bag.push({ id: x[0], r: rarity(x[1]) });
      else bad++;
    }
    var pets = [];
    (Array.isArray(raw.pets) ? raw.pets.slice(0, 500) : []).forEach(function (p) {
      if (Array.isArray(p) && PS.PET[p[0]] && PS.PET_RARITY[p[1]]) {
        pets.push({ sp: p[0], r: Number(p[1]), lv: Math.max(1, n(p[2], PS.PET_RARITY[p[1]].cap)), team: Boolean(p[3]) });
      } else {
        bad++;
      }
    });
    return {
      gold: n(raw.gold, 1e15), gems: n(raw.gems, 1e15), shards: n(raw.shards, 1e15), power: n(raw.power, 1e15), best: n(raw.best, 1e4),
      worn: worn, bag: bag, bagCount: Math.max(bag.length, n(raw.bagCount, 1e9)), bad: bad, pets: pets, petSlots: n(raw.petSlots, 10)
    };
  }

  /** Is the open form under a row a look at the inventory? */
  function isInv(m) {
    return Boolean(m && m.act === "inv");
  }

  var confirmTimer = 0;

  /** A remove button that asks once more ("Sure?") before it does anything. */
  function removeButton(m, key, label, attrs) {
    var sure = m.confirm === key;
    return '<button class="btn btn--sm inv__remove' + (sure ? " is-sure" : "") + '" type="button" data-act="inv-remove" data-key="' + esc(key) + '"' + attrs + ">" +
      (sure ? "Sure? " + label : label) + "</button>";
  }

  /** One of the player's items, with a button to remove it. `where` tells copies apart. */
  function invCell(item, sub, where) {
    var m = view.board.mod;
    var name = PS.RARITY[item.r].name + " " + PS.ITEMS[item.id].name;
    return (
      '<span class="inv__cell">' + tile(item, { plain: true }) + "<small>" + esc(name) + (sub ? "<em>" + esc(sub) + "</em>" : "") + "</small>" +
        (isInv(m) ? removeButton(m, "item:" + where, "Remove", ' data-kind="item" data-item="' + item.id + '" data-r="' + item.r + '" title="Remove ' + esc(name) + '"') : "") +
      "</span>"
    );
  }

  /** What a take does, in words: "all their gold", "3 × Rare Sprout Staff". */
  function takeText(t) {
    if (t.kind === "gold" || t.kind === "gems") {
      return !t.amount ? "all their " + t.kind : fmt(t.amount) + " " + t.kind;
    }
    var def = PS.ITEMS[t.item];
    var name = (PS.RARITY[t.rarity] ? PS.RARITY[t.rarity].name + " " : "") + (def ? def.name : t.item);
    return !t.amount ? "every " + name : t.amount === 1 ? "1 " + name : t.amount + " × " + name;
  }

  /** What is typed in one of the inventory's boxes (kept so a redraw does not lose it). */
  function takeInput(m, id) {
    return m.inputs && m.inputs[id] !== undefined ? m.inputs[id] : "";
  }

  /** Coins or gems: how many they have, a box for how many to remove, Remove and Remove all. */
  function moneyRow(m, kind) {
    var have = m.inv ? m.inv[kind] : null;
    return (
      '<div class="inv__money">' +
        '<span class="inv__have">' + (have !== null ? price(kind, have) : PS.icon(kind === "gems" ? "gem" : "coin") + "?") + "</span>" +
        '<input id="take-' + kind + '" type="number" min="1" step="1" placeholder="Amount" value="' + esc(String(takeInput(m, "take-" + kind))) + '" aria-label="' + kind + ' to remove" />' +
        removeButton(m, kind, "Remove", ' data-kind="' + kind + '"') +
        removeButton(m, kind + ":all", "Remove all", ' data-kind="' + kind + '" data-all="1"') +
      "</div>"
    );
  }

  /** The top of the inventory: the message, and removing coins and gems. */
  function takeBar(m) {
    return (
      '<div class="inv__takebar">' +
        '<label class="board__field"><span>Message to ' + esc(m.name) + " (optional)</span>" +
          '<input id="take-msg" type="text" maxlength="200" value="' + esc(String(takeInput(m, "take-msg"))) + '" placeholder="Leave empty to remove things quietly" /></label>' +
        '<p class="hint">With a message, they are told what was removed and see your message. Without one, it just disappears and they are not told. ' +
          "It happens when their game next checks in: within a minute if they are playing, or as soon as they next open the game.</p>" +
        moneyRow(m, "gold") + moneyRow(m, "gems") +
      "</div>"
    );
  }

  /** For gear that is not in the list (the bag was cut short, or no copy came yet). */
  function otherGear(m) {
    var item = takeInput(m, "take-item") || firstItem("weapon");
    var rarity = Number(takeInput(m, "take-rarity")) || 0;
    return (
      '<details class="inv__fold" data-invpart="other"' + (m.otherOpen ? " open" : "") + "><summary>Remove gear that isn't shown here</summary>" +
        '<div class="inv__other">' +
          '<div class="board__pair">' +
            '<label class="board__field"><span>Item</span><select id="take-item">' + itemOptions(item) + "</select></label>" +
            '<label class="board__field"><span>Rarity</span><select id="take-rarity">' + options(rarityOptions(PS.RARITY.length), rarity) + "</select></label>" +
          "</div>" +
          '<div class="inv__money">' +
            '<input id="take-count" type="number" min="1" step="1" placeholder="Copies (1)" value="' + esc(String(takeInput(m, "take-count"))) + '" aria-label="Copies to remove" />' +
            removeButton(m, "other", "Remove", ' data-kind="item" data-other="1"') +
            removeButton(m, "other:all", "Remove every copy", ' data-kind="item" data-other="1" data-all="1"') +
          "</div>" +
        "</div>" +
      "</details>"
    );
  }

  /** Takes the player's game has not picked up yet, each with a button to call it off. */
  function takesWaitingHtml(m) {
    if (!m.waiting || !m.waiting.length) return "";
    return (
      '<div class="inv__waiting"><p class="inv__label">Waiting for ' + esc(m.name) + "'s game to pick up</p><ul>" +
        m.waiting.map(function (row) {
          return "<li><span>Remove " + esc(takeText({ kind: row.kind, item: row.item, rarity: row.rarity, amount: Number(row.amount) || 0 })) +
            (row.message ? " <em>“" + esc(row.message) + "”</em>" : " <em>(quietly)</em>") + "</span>" +
            '<button class="btn btn--sm" type="button" data-act="take-undo" data-take="' + Number(row.id) + '">Call off</button></li>';
        }).join("") +
      "</ul></div>"
    );
  }

  function loadTakes(m) {
    PS.cloud.takesWaiting(m.id).then(function (res) {
      if (view.board.mod !== m) return;
      m.waiting = res.error ? [] : res.rows;
      paintBoard();
    });
  }

  /** Send a take to the server, with the message if one was typed. */
  function queueTake(m, t) {
    var message = String(takeInput(m, "take-msg")).trim();
    var what = takeText(t);
    PS.cloud.take(m.id, { kind: t.kind, item: t.item, rarity: t.rarity, amount: t.amount, message: message }).then(function (res) {
      if (view.board.mod !== m) return;
      if (res.error) {
        toast(res.error);
        return;
      }
      if (t.kind !== "item") m.inputs["take-" + t.kind] = "";
      toast("Removing " + what + " from " + m.name + (message ? " (they will see your message)" : " (quietly)"));
      loadTakes(m);
    });
  }

  function invPet(pet) {
    return (
      '<span class="inv__cell"><span class="trade__pet" style="--ring:' + PS.RARITY[pet.r].color + '">' + PS.petArt(pet.sp, pet.r) + "<b>Lv " + pet.lv + "</b></span>" +
      "<small>" + esc(PS.RARITY[pet.r].name + " " + PS.PET[pet.sp].name) + (pet.team ? "<em>on the team</em>" : "") + "</small></span>"
    );
  }

  /** The bag's tiles, drawn only once its fold is opened, a page at a time. */
  function invBagCells(m) {
    var inv = m.inv;
    var cells = inv.bag.slice(0, m.shown).map(function (item, i) { return invCell(item, "", "b" + i); }).join("");
    var left = inv.bag.length - Math.min(m.shown, inv.bag.length);
    return cells + (left > 0 ? '<button class="btn btn--sm inv__more" type="button" data-act="inv-more">Show ' + fmt(Math.min(INV_PAGE, left)) + " more (" + fmt(left) + " left)</button>" : "");
  }

  function invPanel(m) {
    var head = '<div class="inv__head"><b>' + esc(m.name) + "'s inventory</b>" +
      '<span><button class="btn btn--sm" type="button" data-act="inv-refresh">Refresh</button> <button class="btn btn--sm" type="button" data-act="mod-cancel">Close</button></span></div>' +
      (m.busy ? "" : takeBar(m)) + takesWaitingHtml(m);
    if (m.busy) return '<div class="inv">' + head + '<p class="hint">Loading...</p></div>';
    if (m.error) return '<div class="inv">' + head + '<p class="board__formerr">' + esc(m.error) + "</p></div>";
    var inv = m.inv;
    if (!inv) {
      return '<div class="inv">' + head +
        '<p class="hint">Nothing yet. ' + esc(m.name) + " hasn't played on the newest version of the game since inventories started being sent. " +
        "Once they open it (logged in, not offline), their game sends a copy, and it stays here for you to look at while they are offline. " +
        "You can still remove coins, gems or gear: it happens when they next play.</p>" + otherGear(m) + "</div>";
    }
    var team = inv.pets.filter(function (p) { return p.team; });
    var away = view.board.presence && !(view.board.presence[m.id] && view.board.presence[m.id].online);
    return (
      '<div class="inv">' + head +
        '<dl class="facts facts--tight inv__facts">' +
          "<div><dt>Gold</dt><dd>" + fmt(inv.gold) + "</dd></div>" +
          "<div><dt>Gems</dt><dd>" + fmt(inv.gems) + "</dd></div>" +
          "<div><dt>SS shards</dt><dd>" + fmt(inv.shards) + "</dd></div>" +
          "<div><dt>Power</dt><dd>" + fmt(inv.power) + "</dd></div>" +
          "<div><dt>Chapters cleared</dt><dd>" + fmt(inv.best) + "</dd></div>" +
          "<div><dt>Sent</dt><dd>" + esc(m.at ? ago(m.at) : "?") + "</dd></div>" +
          (view.board.presence ? "<div><dt>Status</dt><dd>" + presenceHtml(m.id) + "</dd></div>" : "") +
        "</dl>" +
        (away ? '<p class="hint">' + esc(m.name) + " is offline: this is what they had when they last played.</p>" : "") +
        '<p class="inv__label">Wearing</p>' +
        '<div class="inv__grid">' + inv.worn.map(function (w) {
          return w.item ? invCell(w.item, w.slot.name + " · Lv " + w.lv, "w" + w.slot.key) : '<span class="inv__cell inv__cell--empty"><small>' + esc(w.slot.name) + ": nothing</small></span>";
        }).join("") + "</div>" +
        '<p class="inv__label">Pet team (' + team.length + "/" + inv.petSlots + ")</p>" +
        '<div class="inv__grid">' + (team.length ? team.map(invPet).join("") : '<span class="hint">No pets along.</span>') + "</div>" +
        '<details class="inv__fold" data-invpart="pets"' + (m.petsOpen ? " open" : "") + "><summary>All pets (" + fmt(inv.pets.length) + ")</summary>" +
          '<div class="inv__grid">' + (m.petsOpen ? inv.pets.map(invPet).join("") || '<span class="hint">None.</span>' : "") + "</div></details>" +
        '<details class="inv__fold" data-invpart="bag"' + (m.bagOpen ? " open" : "") + "><summary>Bag (" + fmt(inv.bagCount) + " item" + (inv.bagCount === 1 ? "" : "s") + ")</summary>" +
          (inv.bagCount > inv.bag.length ? '<p class="hint">Showing the best ' + fmt(inv.bag.length) + ": the rest are not sent.</p>" : "") +
          '<div class="inv__grid" id="inv-bag">' + (m.bagOpen ? invBagCells(m) : "") + "</div></details>" +
        (inv.bad ? '<p class="hint">' + fmt(inv.bad) + " entries this game doesn't recognise were left out.</p>" : "") +
        otherGear(m) +
      "</div>"
    );
  }

  function loadInv(m) {
    m.busy = true;
    m.error = "";
    paintBoard();
    loadPresence(); // whether they are playing right now (so whether this is up to date)
    loadTakes(m);
    PS.cloud.inventoryOf(m.id).then(function (res) {
      if (view.board.mod !== m) return;
      m.busy = false;
      if (res.error) m.error = res.error;
      else {
        m.inv = cleanInv(res.data);
        m.at = res.at;
      }
      paintBoard();
    });
  }

  /** The form that opens under a row: the ban or timeout message, or what to give. */
  function modForm() {
    var m = view.board.mod;
    if (isInv(m)) return invPanel(m);
    if (m.act === "shown") return shownForm(m);
    var fields = "";
    var go = "";
    if (m.act === "ban" || m.act === "timeout") {
      if (m.act === "timeout") {
        fields += '<label class="board__field"><span>How long?</span><select id="mod-minutes">' + options(TIMEOUTS, m.minutes) + "</select></label>";
      }
      fields += '<label class="board__field"><span>What should the ' + (m.act === "ban" ? "ban" : "timeout") + " message be?</span>" +
        '<textarea id="mod-msg" rows="2" maxlength="200" placeholder="' + esc(m.name) + ' will see this">' + esc(m.msg) + "</textarea></label>";
      go = m.act === "ban" ? "Ban " + esc(m.name) : "Time out " + esc(m.name);
    } else {
      fields += '<label class="board__field"><span>What to give</span><select id="mod-kind">' +
        options([["item", "A weapon or gear"], ["gold", "Gold"], ["gems", "Gems"]], m.kind) + "</select></label>";
      if (m.kind === "item") {
        fields += '<div class="board__giveitem"><span class="board__preview" id="mod-preview">' + givePreview(m) + "</span>" +
          '<div class="board__pair">' +
          '<div class="board__field"><span>Item</span>' + itemPicker(m) + "</div>" +
          '<label class="board__field"><span>Rarity</span><select id="mod-rarity">' + options(rarityOptions(PS.RARITY.length), m.rarity) + "</select></label>" +
        "</div></div>" + itemPickList(m);
      } else {
        fields += '<label class="board__field"><span>How much?</span><input id="mod-amount" type="number" min="1" max="1000000000" step="1" value="' + esc(String(m.amount)) + '" /></label>';
      }
      fields += '<label class="board__field"><span>Message (optional)</span><input id="mod-msg" type="text" maxlength="200" value="' + esc(m.msg) + '" /></label>';
      go = "Send to " + esc(m.name);
    }
    return (
      '<form class="board__form" data-form="mod" novalidate>' + fields +
        '<p class="board__formerr" role="alert">' + esc(m.error || "") + "</p>" +
        '<div class="board__formbtns">' +
          '<button class="btn btn--sm" type="button" data-act="mod-cancel">Cancel</button>' +
          '<button class="btn btn--sm ' + (m.act === "ban" ? "btn--danger" : "btn--primary") + '" type="submit"' + (m.busy ? " disabled" : "") + ">" + go + "</button>" +
        "</div>" +
      "</form>"
    );
  }

  /** What the board shows for a player's figure: any number or text, for everyone to see. */
  function shownForm(m) {
    var row = boardFind(m.id) || {};
    var set = row.shown && typeof row.shown === "object" ? row.shown : {};
    var now = PS.cloud.BOARDS.filter(function (def) { return typeof set[def.key] === "string"; }).map(function (def) {
      return esc(def.name) + ": “" + esc(set[def.key]) + "”";
    });
    return (
      '<form class="board__form" data-form="mod" novalidate>' +
        '<div class="board__pair">' +
          '<label class="board__field"><span>Figure</span><select id="mod-figure">' +
            options(PS.cloud.BOARDS.map(function (def) { return [def.key, def.name]; }), m.figure) + "</select></label>" +
          '<label class="board__field"><span>Show it as (any number or text)</span><input id="mod-shown" type="text" maxlength="24" value="' + esc(m.text) + '" placeholder="' + esc(PS.cloud.show(m.figure, row[m.figure] || 0)) + '" /></label>' +
        "</div>" +
        '<div class="board__pair">' +
          '<label class="board__field"><span>Place on this board (empty = real)</span><input id="mod-place" type="number" min="1" max="100000" step="1" value="' + esc(m.place) + '" placeholder="' + esc(String(row.rank || "")) + '" /></label>' +
          '<label class="board__field"><span>Rank badge</span><select id="mod-tier">' +
            options([["", "Real rank"]].concat(PS.cloud.TIERS.map(function (t) { return [t.key, t.name]; })), m.tier) + "</select></label>" +
        "</div>" +
        '<p class="hint">Everyone sees these on this leaderboard. The figure text and rank badge only change what is shown; a place moves the row to that spot. Leave them empty to show the real ones again.' +
          (now.length ? " Showing now: " + now.join(", ") + "." : "") + "</p>" +
        '<p class="board__formerr" role="alert">' + esc(m.error || "") + "</p>" +
        '<div class="board__formbtns">' +
          '<button class="btn btn--sm" type="button" data-act="mod-cancel">Cancel</button>' +
          '<button class="btn btn--sm btn--primary" type="submit"' + (m.busy ? " disabled" : "") + ">Save</button>" +
        "</div>" +
      "</form>"
    );
  }

  /** A drop-down for the Give form where every item shows its picture (a plain
   *  <select> cannot): grouped by slot, with a search box. Drawn only when open. */
  function itemPicker(m) {
    var def = PS.ITEMS[m.item];
    var r = Number(m.rarity) || 0;
    var head =
      '<button class="itempick__btn" type="button" data-act="mod-pick-open" aria-expanded="' + Boolean(m.pickOpen) + '">' +
        (def ? tile({ id: m.item, r: r }, { plain: true }) + "<b>" + esc(def.name) + (def.grade !== "A" ? " (" + def.grade + ")" : "") + "</b>" : "<b>Pick an item</b>") +
        '<i aria-hidden="true">▾</i></button>';
    return head;
  }

  /** The open list of every item, under the pickers at full width. */
  function itemPickList(m) {
    if (!m.pickOpen) return "";
    var r = Number(m.rarity) || 0;
    var groups = PS.SLOTS.map(function (slot) {
      var cells = PS.ITEM_ORDER.filter(function (id) { return PS.ITEMS[id].slot === slot.key; }).map(function (id) {
        var d = PS.ITEMS[id];
        return '<button class="itempick__item' + (id === m.item ? " is-on" : "") + '" type="button" data-act="mod-pick" data-item="' + id + '" data-name="' + esc((d.name + " " + slot.plural).toLowerCase()) + '" data-grade="' + d.grade.toLowerCase() + '">' +
          tile({ id: id, r: r }, { plain: true }) + "<small>" + esc(d.name) + "</small></button>";
      }).join("");
      return '<p class="itempick__slot">' + esc(slot.plural) + '</p><div class="itempick__grid">' + cells + "</div>";
    }).join("");
    return '<div class="itempick__list">' +
        '<input id="mod-pick-q" type="search" placeholder="Find an item (try S or SS)" autocomplete="off" />' +
        '<div class="itempick__scroll">' + groups + "</div>" +
      "</div>";
  }

  /** The item about to be given, as it will look: its picture on the rarity's colour, with its S or SS mark. */
  function givePreview(m) {
    var def = PS.ITEMS[m.item];
    if (!def) return "";
    var r = Math.max(0, Math.min(PS.RARITY.length - 1, Number(m.rarity) || 0));
    return tile({ id: m.item, r: r }, { plain: true }) +
      "<small>" + esc(PS.RARITY[r].name + " " + def.name) + (def.grade !== "A" ? " <b class=\"g-" + def.grade + "\">" + def.grade + "</b>" : "") + "</small>";
  }

  function modSubmit(e) {
    e.preventDefault();
    var m = view.board.mod;
    if (!m || m.busy) return;
    var message = m.msg.trim();
    var job;
    var done;
    if (m.act === "shown") {
      var figureName = PS.cloud.boardOf(m.figure).name;
      var place = Math.floor(Number(m.place) || 0);
      job = Promise.all([
        PS.cloud.setShown(m.id, m.figure, m.text.trim()),
        PS.cloud.setShown(m.id, "place:" + m.figure, place >= 1 ? String(place) : ""),
        PS.cloud.setShown(m.id, "tier:" + m.figure, m.tier || "")
      ]).then(function (all) {
        for (var i = 0; i < all.length; i++) if (all[i].error) return all[i];
        return {};
      });
      done = m.name + "'s " + figureName + " board is set";
    } else if (m.act === "ban") {
      job = PS.cloud.banPlayer(m.id, 0, message);
      done = "Banned " + m.name;
    } else if (m.act === "timeout") {
      job = PS.cloud.banPlayer(m.id, m.minutes, message);
      done = "Timed out " + m.name + " for " + timeoutName(m.minutes);
    } else if (m.kind === "item") {
      job = PS.cloud.give(m.id, { kind: "item", item: m.item, rarity: m.rarity, message: message });
      done = "Sent " + m.name + " " + PS.RARITY[m.rarity].name + " " + PS.ITEMS[m.item].name;
    } else {
      var amount = Math.floor(Number(m.amount) || 0);
      if (amount < 1) {
        m.error = "Pick an amount of at least 1.";
        paintBoard();
        return;
      }
      job = PS.cloud.give(m.id, { kind: m.kind, amount: amount, message: message });
      done = "Sent " + m.name + " " + fmt(amount) + " " + m.kind;
    }
    m.busy = true;
    m.error = "";
    paintBoard();
    job.then(function (res) {
      if (view.board.mod !== m) return;
      m.busy = false;
      if (res.error) {
        m.error = res.error;
        paintBoard();
        return;
      }
      view.board.mod = null;
      toast(done);
      loadBoard(true);
    });
  }

  /* What a banned or timed-out player sees, in place of the menus. */

  function banHtml(ban) {
    return (
      '<div class="gate__card ban">' +
        '<div class="gate__art ban__art">' + PS.art("lemon") + "</div>" +
        '<h1 class="gate__title" id="gate-title">' + (ban.timeout ? "TIMED OUT" : "BANNED") + "</h1>" +
        '<p class="ban__lead">' + (ban.timeout ? "You have been timed out by a moderator." : "You have been banned by a moderator.") + "</p>" +
        (ban.message ? '<div class="ban__msg"><span>Moderator’s message:</span><p>“' + esc(ban.message) + "”</p></div>" : "") +
        (ban.timeout ? '<p class="ban__left">You can play again at <b>' + esc(whenText(ban.until)) + "</b>.</p>" : "") +
        '<div class="gate__downbtns">' +
          (ban.timeout ? '<button class="btn btn--sm" type="button" data-act="ban-check">Check again</button>' : "") +
          '<button class="btn btn--sm" type="button" data-act="logout">Log out</button>' +
        "</div>" +
      "</div>"
    );
  }

  function showBan() {
    var ban = PS.cloud.ban();
    if (!ban) return false;
    closeModal();
    view.gate = null;
    el.app.hidden = true;
    el.gate.innerHTML = banHtml(ban);
    el.gate.hidden = false;
    return true;
  }

  /** Banned while playing: out of any battle and onto the ban screen. */
  function kick() {
    if (!el.battle.hidden) {
      PS.B.stop();
      PS.B.hud.hide();
      el.battle.hidden = true;
      el.results.hidden = true;
      view.results = null;
      PS.music.play("camp");
    }
    showBan();
  }

  /** Put gifts from a moderator into the save, and say so as soon as the menus show. */
  function receiveGifts(list) {
    var got = [];
    list.forEach(function (gift) {
      if (gift.kind === "item" && PS.ITEMS[gift.item]) {
        var r = Math.max(0, Math.min(PS.MAX_RARITY, Math.floor(Number(gift.rarity) || 0)));
        got.push({ item: st.give(gift.item, r), message: gift.message || "" });
      } else if (gift.kind === "gold" || gift.kind === "gems") {
        var S = st.get();
        var n = Math.max(0, Math.floor(Number(gift.amount) || 0));
        st.setMoney(gift.kind === "gold" ? S.gold + n : S.gold, gift.kind === "gems" ? S.gems + n : S.gems);
        got.push({ kind: gift.kind, amount: n, message: gift.message || "" });
      }
    });
    if (!got.length) return;
    view.giftsWaiting = (view.giftsWaiting || []).concat(got);
    PS.sfx.play("coin");
    toast("A moderator sent you a gift!");
  }

  /* ------------------------------------------------------- public chat */
  /* Everyone signed in can read and write. The window asks for the newest
     messages every few seconds while it is open, and only redraws the list,
     so what is being typed is never lost. */

  var CHAT_EVERY = 4000;
  var chat = { rows: null, error: "", timer: 0, sending: false, lastId: null, fresh: {} };
  var MENTION_EVERY = 4000; // how often a game in front asks about new mentions
  var noteBox = null;

  /** Does this message call for my attention? "me" (@myname), "all" (an admin's @everyone) or "". */
  function mentionOf(m) {
    var who = PS.cloud.me();
    if (!who || !m) return "";
    var text = String(m.message || "").toLowerCase();
    var mine = String(who.name || "").toLowerCase();
    if (mine && new RegExp("(^|[^a-z0-9_])@" + mine + "(?![a-z0-9_])").test(text)) return "me";
    if (m.admin && /(^|[^a-z0-9_])@everyone(?![a-z0-9_])/.test(text)) return "all";
    return "";
  }

  /** Put the pop-ups back on top of everything (a window opened after them would cover them). */
  function bumpNotes() {
    if (!noteBox || !noteBox.children.length || !noteBox.showPopover) return;
    try {
      if (noteBox.matches(":popover-open")) noteBox.hidePopover();
      noteBox.showPopover();
    } catch (err) {
      /* an older browser: the z-index does the job except over a window */
    }
  }

  /** A box at the top right, wherever the player is (menus or a battle). A mention is
   *  a small box for a few seconds; an admin's @everyone is a big pulsing banner that
   *  stays longer, with a sound, and has to be noticed. */
  function showPing(m, kind) {
    if (!noteBox) {
      noteBox = document.createElement("div");
      noteBox.className = "chatnotes";
      noteBox.setAttribute("aria-live", "assertive");
      // a popover sits in the browser's top layer, so it shows above an open window (the chat, the menus)
      noteBox.setAttribute("popover", "manual");
      document.documentElement.appendChild(noteBox);
    }
    var all = kind === "all";
    var note = document.createElement("div");
    note.className = "chatnote" + (all ? " is-all" : "");
    if (all) {
      var tag = document.createElement("small");
      tag.textContent = "ANNOUNCEMENT";
      note.appendChild(tag);
    }
    var head = document.createElement("b");
    head.textContent = all ? m.name + " says:" : m.name + " mentioned you";
    var body = document.createElement("p");
    body.textContent = String(m.message || "").replace(/(^|\s)@everyone\b/gi, "$1").trim().slice(0, 200) || String(m.message || "").slice(0, 200);
    note.appendChild(head);
    note.appendChild(body);
    function close() { if (note.parentNode) note.parentNode.removeChild(note); }
    note.addEventListener("click", close);
    noteBox.appendChild(note);
    while (noteBox.children.length > (all ? 4 : 3)) noteBox.removeChild(noteBox.firstChild);
    bumpNotes();
    PS.sfx.play(all ? "boss" : "reveal", all ? 2 : 1);
    if (all) {
      // when the tab is in the background, the title shouts too, until it is looked at
      var old = document.title;
      document.title = "(!) " + m.name + ": " + body.textContent.slice(0, 40);
      var back = function () { document.title = old; document.removeEventListener("visibilitychange", back); };
      document.addEventListener("visibilitychange", back);
      setTimeout(back, 15000);
    }
    setTimeout(close, all ? 14000 : 9000);
  }

  /** Look for messages that call for me, whatever screen this game is on. The first
   *  look only notes where the chat is up to, so old messages are not shown. */
  function checkMentions() {
    if (!PS.cloud.me() || PS.cloud.offline() || document.visibilityState !== "visible") return Promise.resolve();
    var first = chat.lastId === null;
    return PS.cloud.chatSince(first ? null : chat.lastId).then(function (res) {
      if (res.error) return;
      var who = PS.cloud.me();
      res.rows.forEach(function (m) {
        if (chat.lastId === null || m.id > chat.lastId) chat.lastId = m.id;
        if (first || !who) return;
        var kind = mentionOf(m);
        if (kind === "all") {
          showPing(m, kind); // an announcement is shown to everyone, even its writer and whoever has the chat open
        } else if (kind === "me" && m.player !== who.id && !chatOpen() && !panelOn()) {
          showPing(m, kind); // (not for my own, nor what is already on the screen in front of me)
        }
      });
      if (first && chat.lastId === null) chat.lastId = 0;
    });
  }

  function chatOpen() {
    return Boolean(view.modal && view.modal.type === "chat");
  }

  function chatTime(iso) {
    var date = new Date(iso);
    return isNaN(date.getTime()) ? "" : date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  /** Take the newest rows from the server: note which are new (they pop in, and a quiet sound plays). */
  function chatTake(rows) {
    var top = chat.rows && chat.rows.length ? chat.rows[chat.rows.length - 1].id : null;
    var who = PS.cloud.me();
    chat.fresh = {};
    var others = 0;
    if (top !== null) {
      rows.forEach(function (m) {
        if (m.id > top) {
          chat.fresh[m.id] = true;
          if (!who || m.player !== who.id) others++;
        }
      });
    }
    chat.rows = rows;
    if (others) PS.sfx.play("coin", 0);
  }

  /** What a slash command turns into, or the text as it was. */
  function chatCommand(text) {
    var who = PS.cloud.me();
    var name = who ? who.name : "someone";
    var m = /^\/(\w+)\s*(.*)$/.exec(text);
    if (!m) return text;
    var cmd = m[1].toLowerCase();
    var rest = m[2].trim();
    if (cmd === "roll") {
      var sides = Math.max(2, Math.min(1000000, Math.floor(Number(rest) || 100)));
      return "\uD83C\uDFB2 rolled " + (1 + Math.floor(Math.random() * sides)) + " (1-" + sides + ")";
    }
    if (cmd === "flip" || cmd === "coin") return "\uD83E\uDE99 flipped a coin: " + (Math.random() < 0.5 ? "heads" : "tails");
    if (cmd === "table") return "(\u256F\u00B0\u25A1\u00B0)\u256F\uFE35 \u253B\u2501\u253B";
    if (cmd === "shrug") return (rest ? rest + " " : "") + "\u00AF\\_(\u30C4)_/\u00AF";
    if (cmd === "me" && rest) return "* " + name + " " + rest;
    return text;
  }

  var EMOJI = ["\uD83D\uDE00", "\uD83D\uDE02", "\uD83D\uDD25", "\uD83D\uDC80", "\uD83D\uDC4D", "\u2764\uFE0F", "\uD83C\uDF4B", "\uD83D\uDE0E", "\uD83E\uDD14", "\uD83D\uDE2D", "\uD83C\uDF89", "\u2694\uFE0F"];

  function chatListHtml() {
    if (chat.error && !chat.rows) return '<p class="chat__empty">' + esc(chat.error) + "</p>";
    if (!chat.rows) return '<p class="chat__empty">Loading...</p>';
    if (!chat.rows.length) return '<p class="chat__empty">No one has said anything yet. Say hi!</p>';
    var who = PS.cloud.me();
    var mod = PS.cloud.isAdmin();
    return chat.rows.map(function (m) {
      var mine = Boolean(who && m.player === who.id);
      var ping = !mine && mentionOf(m);
      // pressing someone else's name starts a message to them
      var name = mine ? "<b>" + esc(m.name) + "</b>"
        : '<button class="chat__name" type="button" data-act="chat-at" data-name="' + esc(m.name) + '" title="Message ' + esc(m.name) + '">' + esc(m.name) + "</button>";
      var action = /^\* /.test(m.message);
      return '<div class="chat__msg' + (mine ? " is-mine" : "") + (ping ? " is-ping" : "") + (action ? " is-action" : "") + (chat.fresh[m.id] ? " is-new" : "") +
        (/@everyone\b/i.test(m.message) && m.admin ? " is-all" : "") + '" style="--hue:' + (PS.hash(String(m.name).toLowerCase()) % 360) + '">' +
        '<span class="chat__who">' + avatar(m.name) + name + (m.admin ? '<em class="chat__admin' + (String(m.name).toLowerCase() === "owner" ? " is-owner" : "") + '">' + (String(m.name).toLowerCase() === "owner" ? "owner" : "admin") + "</em>" : "") + "<small>" + esc(chatTime(m.created_at)) + "</small>" +
        (mod ? '<button class="chat__del" type="button" data-act="chat-del" data-id="' + Number(m.id) + '" aria-label="Delete this message" title="Delete">&times;</button>' : "") + "</span>" +
        "<p>" + esc(m.message) + "</p></div>";
    }).join("");
  }

  function chatModal() {
    var who = PS.cloud.me();
    var can = Boolean(who && !PS.cloud.offline());
    return (
      '<div class="chat">' +
        '<button class="modal__close" type="button" data-act="close" aria-label="Close">' + PS.icon("close") + "</button>" +
        '<h2 id="modal-title">Chat</h2>' +
        '<p class="hint">Everyone playing can read this. Type @name to send a message to one person: they get a pop-up even in a battle. Press a name to start one.' +
          (PS.cloud.isAdmin() ? " As an admin, @everyone pops up for everyone." : "") + "</p>" +
        '<div class="chat__list" id="chat-list" aria-live="polite">' + chatListHtml() + "</div>" +
        (can
          ? '<div class="chat__emoji" role="group" aria-label="Emoji and commands">' +
              EMOJI.map(function (e) { return '<button type="button" data-act="chat-emoji" data-e="' + e + '">' + e + "</button>"; }).join("") +
              '<span class="chat__tip">/roll /flip /shrug /table /me</span></div>' +
            '<form class="chat__form" data-form="chat" novalidate>' +
              '<input id="chat-input" type="text" maxlength="200" autocomplete="off" placeholder="Say something..." aria-label="Your message" />' +
              '<button class="btn btn--primary btn--sm" type="submit">Send</button></form>' +
            '<p class="board__formerr" id="chat-error" role="alert"></p>'
          : '<p class="hint">Log in (not offline) to join in.</p>') +
      "</div>"
    );
  }

  /** Redraw just the list, keeping the scroll at the bottom if it was there. */
  function paintChat() {
    ["#chat-list", "#pchat-list"].forEach(function (sel) {
      var box = $(sel);
      if (!box) return;
      var atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
      box.innerHTML = chatListHtml();
      if (atEnd) box.scrollTop = box.scrollHeight;
    });
  }

  /* The same chat in the pause menu of a battle: the newest messages and a box
     to write in, refreshed while the battle is paused. */
  var panel = { node: null, timer: 0 };

  function panelOn() {
    return Boolean(panel.node && !panel.node.hidden);
  }

  function loadPanel() {
    if (!panelOn()) {
      clearInterval(panel.timer);
      panel.timer = 0;
      return Promise.resolve();
    }
    return PS.cloud.chatList().then(function (res) {
      if (!panelOn()) return;
      if (res.error) {
        chat.error = res.error;
      } else {
        chat.error = "";
        chatTake(res.rows);
        res.rows.forEach(function (m) { if (chat.lastId === null || m.id > chat.lastId) chat.lastId = m.id; });
      }
      paintChat();
    });
  }

  PS.chatPanel = {
    show: function (node, on) {
      var allowed = Boolean(on && node && PS.cloud.me() && !PS.cloud.offline());
      if (!allowed) {
        if (node) node.hidden = true;
        panel.node = null;
        clearInterval(panel.timer);
        panel.timer = 0;
        return;
      }
      if (panelOn() && panel.node === node) return;
      panel.node = node;
      node.hidden = false;
      node.innerHTML =
        '<p class="pausebox__label">Chat</p>' +
        '<div class="chat__list chat__list--mini" id="pchat-list" aria-live="polite">' + chatListHtml() + "</div>" +
        '<form class="chat__form" data-form="chat" novalidate>' +
          '<input id="pchat-input" type="text" maxlength="200" autocomplete="off" placeholder="Say something..." aria-label="Your message" />' +
          '<button class="btn btn--primary btn--sm" type="submit">Send</button></form>' +
        '<p class="board__formerr" role="alert"></p>';
      var list = $("#pchat-list");
      if (list) list.scrollTop = list.scrollHeight;
      loadPanel().then(function () {
        var l = $("#pchat-list");
        if (l) l.scrollTop = l.scrollHeight;
      });
      clearInterval(panel.timer);
      panel.timer = setInterval(loadPanel, CHAT_EVERY);
    }
  };

  function loadChat() {
    if (!chatOpen()) {
      clearInterval(chat.timer);
      chat.timer = 0;
      return Promise.resolve();
    }
    return PS.cloud.chatList().then(function (res) {
      if (!chatOpen()) return;
      if (res.error) {
        chat.error = res.error;
      } else {
        chat.error = "";
        chatTake(res.rows);
        // what is on screen has been seen: no pop-up for it
        res.rows.forEach(function (m) { if (chat.lastId === null || m.id > chat.lastId) chat.lastId = m.id; });
      }
      paintChat();
    });
  }

  function chatSubmit(e) {
    e.preventDefault();
    var form = e.target;
    var box = form.querySelector("input");
    var err = form.parentNode.querySelector(".board__formerr");
    var text = box ? chatCommand(box.value.trim()) : "";
    if (!text || chat.sending) return;
    chat.sending = true;
    PS.cloud.say(text).then(function (res) {
      chat.sending = false;
      if (err) err.textContent = res.error || "";
      if (res.error) return;
      if (box) box.value = "";
      Promise.all([loadChat(), loadPanel()]).then(function () {
        ["#chat-list", "#pchat-list"].forEach(function (sel) {
          var list = $(sel);
          if (list) list.scrollTop = list.scrollHeight;
        });
        // @everyone only works once the server marks admin messages: say so if it does not
        var mineNow = chat.rows && chat.rows.filter(function (m) { return m.player === (PS.cloud.me() || {}).id; }).pop();
        if (err && /@everyone/i.test(text) && PS.cloud.isAdmin() && mineNow && mineNow.admin === undefined) {
          err.textContent = "The server needs an update before @everyone can work. (Run supabase/setup.sql again.)";
        }
      });
    });
  }

  /** Take out of the save what an admin is taking away. Only a take that came with
   *  a message is mentioned (with the message); the rest just go, quietly. */
  function loseTakes(list) {
    var told = [];
    list.forEach(function (t) {
      var n = st.applyTake(t);
      if (!n || !t.message) return; // none of it left, or nothing to say
      if (t.kind === "item") told.push({ item: { id: t.item, r: Number(t.rarity) || 0 }, count: n, message: t.message });
      else told.push({ kind: t.kind, amount: n, message: t.message });
    });
    if (!told.length) return;
    view.takenWaiting = (view.takenWaiting || []).concat(told);
  }

  function takenModal(modal) {
    var notes = [];
    modal.lost.forEach(function (g) { if (g.message && notes.indexOf(g.message) === -1) notes.push(g.message); });
    return (
      '<div class="notice giftnote takennote">' +
        '<h2 id="modal-title">Some of your things were taken away</h2>' +
        '<div class="giftnote__got">' +
          modal.lost.map(function (g) {
            return g.item
              ? '<span class="giftnote__item">' + tile(g.item, { plain: true }) + "<small>" + (g.count > 1 ? g.count + " × " : "") + esc(PS.RARITY[g.item.r].name + " " + PS.ITEMS[g.item.id].name) + "</small></span>"
              : '<span class="giftnote__money">−' + price(g.kind, g.amount) + "</span>";
          }).join("") +
        "</div>" +
        notes.map(function (n) { return '<p class="giftnote__msg">“' + esc(n) + "”</p>"; }).join("") +
        '<div class="modal__actions"><button class="btn btn--primary" type="button" data-act="close" autofocus>OK</button></div>' +
      "</div>"
    );
  }

  function giftModal(modal) {
    var notes = [];
    modal.got.forEach(function (g) { if (g.message && notes.indexOf(g.message) === -1) notes.push(g.message); });
    return (
      '<div class="notice giftnote">' +
        '<div class="giftnote__art">' + PS.art("gift") + "</div>" +
        '<h2 id="modal-title">A gift from a moderator</h2>' +
        '<div class="giftnote__got">' +
          modal.got.map(function (g) {
            return g.item
              ? '<span class="giftnote__item">' + tile(g.item, { plain: true }) + "<small>" + esc(PS.RARITY[g.item.r].name + " " + PS.ITEMS[g.item.id].name) + "</small></span>"
              : '<span class="giftnote__money">' + price(g.kind, g.amount) + "</span>";
          }).join("") +
        "</div>" +
        notes.map(function (n) { return '<p class="giftnote__msg">“' + esc(n) + "”</p>"; }).join("") +
        '<div class="modal__actions"><button class="btn btn--primary" type="button" data-act="close" autofocus>Nice!</button></div>' +
      "</div>"
    );
  }

  /* ---------------------------------------------------------- the banner */
  /* The strip above the top bar. The owner sets its text from the admin menu
     (Settings) and the server keeps it; until then, or after "Use the text in
     index.html", it shows the text written in index.html. */
  var KEY_BANNER = "lemon:banner"; // the last banner the server gave, so a reload shows it at once
  var builtInBanner = "";

  function showBanner(text) {
    var shown = typeof text === "string" ? text : builtInBanner;
    if (el.status && el.status.textContent !== shown) el.status.textContent = shown; // text only, never markup
  }

  function keepBanner(text, at) {
    view.banner = { text: typeof text === "string" ? text : null, at: at || null };
    PS.store.set(KEY_BANNER, view.banner);
    showBanner(view.banner.text);
  }

  /** Ask the server for the banner. Without an answer the last one stays up. */
  function refreshBanner() {
    return PS.cloud.banner().then(function (res) {
      if (!res.error) keepBanner(res.text, res.at);
    });
  }

  /** The admin menu's buttons: send a new banner, '' to hide it, null for index.html's. */
  function sendBanner(text) {
    view.dev.bannerNote = "Sending…";
    renderModal();
    PS.cloud.setBanner(text).then(function (res) {
      if (res.error) {
        view.dev.bannerNote = res.error;
      } else {
        view.dev.banner = null; // the box goes back to showing what is up now
        view.dev.bannerNote = text === null ? "Back to the text in index.html, for everyone."
          : text === "" ? "The banner is hidden for everyone."
          : "Done: everyone sees the new banner.";
        keepBanner(text, new Date().toISOString());
      }
      if (view.modal && view.modal.type === "secret") renderModal();
    });
  }

  /* ------------------------------------------------- who is online (admins see it) */

  var PRESENCE_EVERY = 30000; // how often an admin's open leaderboard asks again
  var DOING = { menus: "in the menus", battle: "in a battle", "co-op": "playing co-op", duel: "in a duel", trading: "trading" };

  /** What this game is doing right now, for the admins' view. */
  function doing() {
    var R = PS.B.run;
    if (!el.battle.hidden && R) return R.mp ? (R.duel ? "duel" : "co-op") : "battle";
    if (PS.trade && PS.trade.active()) return "trading";
    return "menus";
  }

  /** Tell the server this game is open, and what it is doing. */
  function heartbeat() {
    if (PS.cloud.me() && !PS.cloud.offline()) PS.cloud.seen(true, doing());
  }

  /** "Online · in a battle" or "Offline · seen 3h ago", for an admin. */
  function presenceText(p) {
    if (!p) return { on: false, text: "Offline" };
    if (p.online) return { on: true, text: "Online" + (DOING[p.doing] ? " · " + DOING[p.doing] : "") };
    return { on: false, text: "Offline · seen " + ago(new Date(Date.now() - p.seconds * 1000).toISOString()) };
  }

  function presenceHtml(id) {
    var map = view.board.presence;
    if (!map) return "";
    var p = presenceText(map[id]);
    return '<b class="seen' + (p.on ? " is-on" : "") + '"><i aria-hidden="true"></i>' + esc(p.text) + "</b>";
  }

  /** For admins: ask the server who is online, and redraw the board with it. */
  function loadPresence() {
    if (!PS.cloud.isAdmin() || !PS.cloud.me() || PS.cloud.offline()) return;
    view.board.presenceAt = Date.now();
    PS.cloud.presence().then(function (res) {
      if (res.error) return; // an older server, or no connection: the board just goes without
      view.board.presence = res.map;
      paintBoard();
    });
  }

  /* ------------------------------------------------ admin abuse (events) */
  /* An admin fires an event and every open game plays it for a few seconds:
     an announcement over the top, and a bit of mischief. Nothing in anyone's
     save changes. A game that has only just opened does not play an old one. */

  var EVENTS = {
    confetti: { text: "PARTY TIME!", seconds: 6 },
    flip: { text: "Everything is upside down!", seconds: 7 },
    rain: { text: "It's raining lemons!", seconds: 7 },
    wobble: { text: "Earthquake!", seconds: 6 },
    disco: { text: "DISCO!", seconds: 8 },
    tiny: { text: "Everything shrank!", seconds: 7 },
    mirror: { text: "Mirror world!", seconds: 7 },
    blackout: { text: "Lights out...", seconds: 5 },
    shout: { text: "", seconds: 8 }
  };
  var EVENT_EVERY = 10000; // how often an open game asks whether an event was fired
  var eventSeen = null; // when the last event we know of was fired (null: not looked yet)
  var eventTimer = 0;
  var eventClean = null; // puts back whatever the event now playing changed

  /** Play one or more events together (`kinds`, or one name, or "a,b"), for `seconds`
   *  (empty or 0: the longest of their own times). */
  function playEvent(kinds, message, seconds) {
    kinds = (Array.isArray(kinds) ? kinds : String(kinds || "").split(",")).filter(function (k, i, all) {
      return EVENTS[k] && all.indexOf(k) === i;
    });
    if (!kinds.length) return;
    // a new event ends the ones still playing, so nothing of them is left behind
    clearTimeout(eventTimer);
    if (eventClean) eventClean();
    var root = document.documentElement;
    var calm = PS.reducedMotion();
    var bits = [];
    function add(node) {
      // on <html>, not <body>, so a flipped or darkened page does not take them along
      root.appendChild(node);
      bits.push(node);
    }
    // the announcement, as text only
    var note = document.createElement("div");
    note.className = "chaos__note";
    note.setAttribute("role", "status");
    note.textContent = message || EVENTS[kinds[0]].text;
    add(note);
    var classes = [];
    if (!calm) {
      kinds.forEach(function (kind) {
        if (kind === "flip" || kind === "wobble" || kind === "disco" || kind === "tiny" || kind === "mirror") {
          root.classList.add("chaos-" + kind);
          classes.push("chaos-" + kind);
        }
        if (kind === "blackout") {
          var dark = document.createElement("div");
          dark.className = "chaos__dark";
          add(dark);
        }
        var count = kind === "rain" ? 36 : kind === "confetti" ? 60 : 0;
        for (var i = 0; i < count; i++) {
          var bit = document.createElement("div");
          bit.className = "chaos__bit" + (kind === "confetti" ? " is-confetti" : "");
          bit.style.left = Math.random() * 100 + "vw";
          bit.style.animationDelay = Math.random() * 2.2 + "s";
          bit.style.animationDuration = 2.4 + Math.random() * 2 + "s";
          bit.style.animationIterationCount = "infinite"; // keeps falling for as long as the event lasts
          if (kind === "confetti") bit.style.background = "hsl(" + Math.floor(Math.random() * 360) + ",85%,60%)";
          else bit.innerHTML = PS.art("lemon");
          add(bit);
        }
      });
    }
    PS.sfx.play(kinds.indexOf("wobble") !== -1 || kinds.indexOf("blackout") !== -1 ? "boss" : "reveal", 2);
    var length = Math.floor(Number(seconds)) > 0 ? Math.min(120, Math.floor(Number(seconds))) : Math.max.apply(null, kinds.map(function (k) { return EVENTS[k].seconds; }));
    eventClean = function () {
      classes.forEach(function (c) { root.classList.remove(c); });
      bits.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
      eventClean = null;
    };
    eventTimer = setTimeout(function () { if (eventClean) eventClean(); }, length * 1000);
  }

  /** Is there a new event? The first look only notes what is there. */
  function checkEvent() {
    return PS.cloud.event().then(function (res) {
      if (res.error) return;
      var ev = res.event;
      var at = ev ? ev.at : "";
      if (eventSeen === null) {
        eventSeen = at;
        return;
      }
      if (ev && at !== eventSeen) {
        eventSeen = at;
        playEvent(String(ev.kind || "").split(","), ev.message ? String(ev.message).slice(0, 100) : "", ev.seconds);
      }
    });
  }

  /** The admin menu's card: free stuff for the players, and events. Each button asks twice. */
  var abuse = { who: "all", withEvent: false, events: [], seconds: "", what: "gold", amount: 500, item: "", rarity: 0, message: "", confirm: "", note: "" };

  var ABUSE_WHO = [["all", "Everyone"], ["online", "Everyone online right now"], ["random", "One random player (lucky dip)"]];
  var ABUSE_EVENTS = [
    ["confetti", "Confetti"], ["flip", "Flip every screen"], ["rain", "Lemon rain"], ["wobble", "Earthquake"],
    ["disco", "Disco"], ["tiny", "Shrink everything"], ["mirror", "Mirror world"], ["blackout", "Lights out"],
    ["shout", "Shout a message"]
  ];

  function devAbuse() {
    if (!PS.dev.admin || !PS.cloud.isAdmin()) return "";
    if (!abuse.item) abuse.item = firstItem("weapon");
    function button(key, label, cls, off) {
      var sure = abuse.confirm === key;
      return '<button class="btn btn--sm' + (sure ? " btn--danger" : cls ? " " + cls : "") + '" type="button" data-act="abuse" data-what="' + key + '"' + (off ? " disabled" : "") + ">" + (sure ? "Sure? " : "") + label + "</button>";
    }
    var item = abuse.what === "item";
    var who = abuse.who === "all" ? "everyone" : abuse.who === "online" ? "everyone online" : "one random player";
    var stuff = item
      ? PS.RARITY[abuse.rarity].name + " " + PS.ITEMS[abuse.item].name
      : fmt(abuse.amount) + " " + abuse.what;
    var picked = ABUSE_EVENTS.filter(function (e) { return abuse.events.indexOf(e[0]) !== -1; });
    var pickedNames = picked.map(function (e) { return e[1]; }).join(" + ");
    return devCard("Admin abuse",
      '<p class="hint">It cannot be called back. Gifts reach players who are offline too (not the banned), the next time they open the game. ' +
        "Events play in every open game within about 10 seconds (yours at once). Each button asks \"Sure?\" first.</p>" +
      '<label class="devabuse__msg">Message (optional)<input id="abuse-msg" type="text" maxlength="100" value="' + esc(abuse.message) + '" placeholder="Shown with the gift or the events" /></label>' +
      '<p class="devbox__label">Events <small>(tick as many as you like)</small></p>' +
      '<div class="devabuse__chips" role="group" aria-label="Events">' + ABUSE_EVENTS.map(function (e) {
        var on = abuse.events.indexOf(e[0]) !== -1;
        return '<button class="devabuse__chip' + (on ? " is-on" : "") + '" type="button" data-act="abuse-pick" data-ev="' + e[0] + '" aria-pressed="' + on + '">' + esc(e[1]) + "</button>";
      }).join("") + "</div>" +
      '<div class="dev__give">' +
        '<label>How long, in seconds<input id="abuse-seconds" type="number" min="1" max="120" step="1" value="' + esc(String(abuse.seconds)) + '" placeholder="automatic" /></label>' +
      "</div>" +
      devRow(button("fire", picked.length ? "Fire " + pickedNames : "Fire the events (tick some first)", "btn--primary", !picked.length)) +
      '<p class="devbox__label">Free stuff</p>' +
      '<div class="dev__give">' +
        devSelect("abuse-who", "Who gets it", ABUSE_WHO, abuse.who) +
        devSelect("abuse-what", "What", [["gold", "Gold"], ["gems", "Gems"], ["item", "A weapon or gear"]], abuse.what) +
        (item ? "" : '<label>Amount<input id="abuse-amount" type="number" min="1" max="1000000000" step="1" value="' + abuse.amount + '" /></label>') +
      "</div>" +
      (item
        ? '<div class="board__giveitem"><span class="board__preview">' + givePreview({ item: abuse.item, rarity: abuse.rarity }) + "</span>" +
            '<div class="board__pair">' + devSelect("abuse-item", "Item", PS.ITEM_ORDER.map(function (id) {
              return [id, PS.ITEMS[id].name + (PS.ITEMS[id].grade !== "A" ? " (" + PS.ITEMS[id].grade + ")" : "")];
            }), abuse.item) + devSelect("abuse-rarity", "Rarity", rarityOptions(PS.RARITY.length), abuse.rarity) + "</div></div>"
        : "") +
      '<label class="inv__all"><input id="abuse-with" type="checkbox"' + (abuse.withEvent ? " checked" : "") + (picked.length ? "" : " disabled") + " /> Fire the ticked events at the same moment" +
        (picked.length ? "" : " (tick some above)") + "</label>" +
      devRow(button("give", "Send " + stuff + " to " + who + (abuse.withEvent && picked.length ? " + " + pickedNames : ""), "btn--primary")) +
      (abuse.note ? '<p class="hint devbanner__note" role="status">' + esc(abuse.note) + "</p>" : "")
    );
  }

  /** Every so often (and on coming back to the tab): a new banner? banned since? any gifts? */
  function watch() {
    if (el.gate.hidden) {
      refreshBanner();
      checkEvent();
    }
    if (!PS.cloud.me() || PS.cloud.offline() || !el.gate.hidden) return;
    heartbeat();
    PS.cloud.status().then(function (ban) {
      if (ban) {
        if (el.gate.hidden) kick();
        return;
      }
      if (PS.trade && el.battle.hidden) PS.trade.pickUp(); // a trade that went through while this game was closed
      return PS.cloud.claimGifts().then(function (gifts) {
        if (gifts.length && el.gate.hidden) receiveGifts(gifts);
        return PS.cloud.claimTakes();
      }).then(function (takes) {
        if (takes && takes.length) loseTakes(takes);
      });
    });
  }

  /* ------------------------------------------------------------- battles */

  function startBattle(chapter, mode, twist) {
    closeModal();
    var pad = document.querySelector(".codepad"); // the admin key pad must not follow you into a battle
    if (pad) pad.hidden = true;
    view.results = null;
    el.results.hidden = true;
    el.app.hidden = true;
    el.battle.hidden = false;
    PS.music.play("battle");
    var R = PS.B.start(chapter, mode, twist);
    if (mode === "swarm") PS.B.toast("Endless swarm! Survive as long as you can.", 4);
    else if (R.twist) PS.B.toast("Daily challenge: " + R.twist.name + ". " + R.twist.text, 5);
    heartbeat();
  }

  /** A battle with a friend. mp.guest: this game shows the host's battle;
   *  otherwise this game runs it, with the friend's lemon in it. */
  function startTogether(mp) {
    closeModal();
    var pad = document.querySelector(".codepad");
    if (pad) pad.hidden = true;
    view.results = null;
    el.results.hidden = true;
    el.app.hidden = true;
    el.battle.hidden = false;
    PS.music.play("battle");
    if (mp.guest) {
      PS.B.startGuest(mp);
      PS.B.toast(mp.kind === "duel" ? "Duel! Best of three rounds." : "Playing with " + (mp.host && mp.host.name ? mp.host.name : "your friend") + "!", 4);
      heartbeat();
      return;
    }
    PS.B.start(mp.chapter, undefined, undefined, mp);
    heartbeat();
    PS.B.toast(mp.kind === "duel" ? "Duel! Best of three rounds." : "Playing with " + (mp.ally && mp.ally.name ? mp.ally.name : "your friend") + "!", 4);
  }

  function leaveBattle() {
    PS.music.play("camp");
    if (PS.multi && PS.multi.active()) PS.multi.leave();
    PS.B.stop();
    PS.B.hud.hide();
    el.battle.hidden = true;
    el.results.hidden = true;
    el.app.hidden = false;
    view.results = null;
    view.tab = "battle";
    render();
    heartbeat();
  }

  function showSwarmResults(result) {
    var ch = PS.chapter(result.chapter);
    el.results.innerHTML =
      '<div class="panel results results--loss">' +
        '<p class="kicker">Endless swarm · pests as tough as chapter ' + ch.n + "</p>" +
        "<h2>" + (result.newBest ? "New record!" : "Swarmed!") + "</h2>" +
        '<p class="results__sub">You held out for ' + PS.clock(result.time) + (result.newBest ? ", your longest yet." : ". Your best is " + PS.clock(result.best || 0) + ".") + " Endless pays gold for the time you last; nothing else is kept.</p>" +
        '<dl class="facts facts--tight">' +
          "<div><dt>Time</dt><dd>" + PS.clock(result.time) + "</dd></div>" +
          "<div><dt>Squashed</dt><dd>" + fmt(result.kills) + "</dd></div>" +
          "<div><dt>Level</dt><dd>" + result.level + "</dd></div>" +
          "<div><dt>Damage</dt><dd>" + fmt(result.dealt || 0) + "</dd></div>" +
          "<div><dt>Best combo</dt><dd>×" + fmt(result.combo || 0) + "</dd></div>" +
        "</dl>" +
        '<p class="loot__money">' + price("gold", result.gold) + "</p>" +
        '<div class="modal__actions">' +
          '<button class="btn" type="button" data-act="again" data-key="again">Go again</button>' +
          '<button class="btn btn--primary" type="button" data-act="home" data-key="home">Back to camp</button>' +
        "</div>" +
      "</div>";
    el.results.hidden = false;
    var button = $('[data-key="home"]', el.results);
    if (button) button.focus();
  }

  function showDuelResults(result) {
    var wins = result.wins || [0, 0];
    var foe = esc(result.foe || "your friend");
    el.results.innerHTML =
      '<div class="panel results results--' + (result.won ? "win" : "loss") + '">' +
        '<p class="kicker">Arena duel · against ' + foe + "</p>" +
        "<h2>" + (result.won ? "You win the duel!" : foe + " wins the duel") + "</h2>" +
        '<p class="results__sub">' + (result.forfeit
          ? (result.won ? foe + " left before the end, so the duel is yours." : "You left the duel early.")
          : "Rounds: you " + wins[0] + " – " + wins[1] + " " + foe + ".") + "</p>" +
        '<p class="loot__money">' + price("gold", result.gold) + (result.gems ? price("gems", result.gems) : "") + "</p>" +
        (result.won ? '<p class="results__unlock">' + PS.icon("check") + "Duels won: " + fmt(result.duels || 0) + "</p>" : "") +
        '<div class="modal__actions">' +
          '<button class="btn btn--primary" type="button" data-act="home" data-key="home">Back to camp</button>' +
        "</div>" +
      "</div>";
    el.results.hidden = false;
    var button = $('[data-key="home"]', el.results);
    if (button) button.focus();
  }

  function showResults(result) {
    view.results = result;
    PS.music.play("camp");
    if (result.duel) return showDuelResults(result);
    if (result.swarm) return showSwarmResults(result);
    var ch = PS.chapter(result.chapter);
    var title = result.won ? (result.finished ? "The grove is saved!" : "Chapter cleared!") : result.progress >= 1 ? "So close…" : "Overrun!";
    var sub = result.won
      ? result.first ? "First clear bonus: triple gold, gems and extra gear." : "Nicely done."
      : result.progress >= 1 ? esc(ch.bossName) + " got the better of you." : "You lasted " + PS.clock(result.time) + " of " + PS.clock(ch.duration) + ".";

    var twist = null;
    PS.CHALLENGE.twists.forEach(function (tw) { if (tw.id === result.twist) twist = tw; });
    var bonus = result.challenge;
    var items = bonus ? result.items.concat(bonus.items) : result.items;

    el.results.innerHTML =
      '<div class="panel results results--' + (result.won ? "win" : "loss") + '">' +
        '<p class="kicker">' + (twist ? "Daily challenge · " + esc(twist.name) + " · chapter " + ch.n : "Chapter " + ch.n + " · " + esc(ch.name)) + "</p>" +
        "<h2>" + title + "</h2>" +
        '<p class="results__sub">' + sub + "</p>" +
        '<dl class="facts facts--tight">' +
          "<div><dt>Time</dt><dd>" + PS.clock(result.time) + "</dd></div>" +
          "<div><dt>Squashed</dt><dd>" + fmt(result.kills) + "</dd></div>" +
          "<div><dt>Level</dt><dd>" + result.level + "</dd></div>" +
          "<div><dt>Damage</dt><dd>" + fmt(result.dealt || 0) + "</dd></div>" +
          "<div><dt>Best combo</dt><dd>×" + fmt(result.combo || 0) + "</dd></div>" +
        "</dl>" +
        '<p class="loot__money">' + price("gold", result.gold) + (result.gems ? price("gems", result.gems) : "") + "</p>" +
        (bonus ? '<p class="results__unlock results__challenge">' + PS.icon("gift") + "Challenge won! " + price("gems", bonus.gems) + " and a " + esc(PS.CHESTS[PS.CHALLENGE.chest].name) + "</p>" : "") +
        (twist && result.won && !bonus ? '<p class="hint">You already won the challenge today, so this win paid like a normal clear.</p>' : "") +
        (items.length
          ? '<div class="loot__items">' + items.map(function (item, index) {
              var def = st.def(item);
              return (
                '<div class="loot__item" style="--i:' + index + '">' + tile(item, { plain: true, cls: "tile--pop" }) +
                  '<strong class="rname r' + item.r + '">' + esc(def.name) + "</strong>" +
                  "<span>" + PS.RARITY[item.r].name + (def.grade !== "A" ? ' <b class="rname g-' + def.grade + '">' + def.grade + "</b>" : "") + "</span>" +
                "</div>"
              );
            }).join("") + "</div>"
          : '<p class="hint">No gear this time. Get at least halfway through a chapter to find some.</p>') +
        (result.unlocked ? '<p class="results__unlock">' + PS.icon("check") + "Chapter " + result.unlocked + " is open.</p>" : "") +
        (result.finished ? '<p class="results__unlock">That was the last chapter. Surpass and ??? gear is still out there for the forge.</p>' : "") +
        (result.together ? '<p class="hint">Played together with ' + esc(result.partner || "a friend") + "." +
          (result.left ? " They left before the end." : "") +
          (result.assist ? " That chapter is past your own progress, so it paid like your furthest chapter and opened nothing new." : "") + "</p>" : "") +
        '<div class="modal__actions">' +
          (result.together ? "" : '<button class="btn" type="button" data-act="again" data-key="again">' + (result.won ? "Play it again" : "Try again") + "</button>") +
          '<button class="btn btn--primary" type="button" data-act="home" data-key="home">' + (result.won ? "Continue" : "Back to camp") + "</button>" +
        "</div>" +
      "</div>";
    el.results.hidden = false;
    var button = $('[data-key="home"]', el.results);
    if (button) button.focus();
  }

  /* -------------------------------------------------------------- actions */

  var ACTIONS = {
    tab: function (node) { go(node.getAttribute("data-tab")); },
    close: function () { closeModal(); },
    settings: function () { openModal({ type: "settings", armed: false }); },
    "rename-open": function () {
      var who = PS.cloud.me();
      view.rename = { value: who ? who.name : "", busy: false, error: "" };
      renderModal();
      var box = $("#rename-name");
      if (box) {
        box.focus();
        box.select();
      }
    },
    "rename-cancel": function () {
      view.rename = null;
      renderModal();
    },
    account: function () {
      view.rename = null;
      view.board.mod = null;
      openModal({ type: "account" });
      if (!PS.cloud.me() || PS.cloud.offline()) return;
      // send the newest figures first, so your own row is up to date
      PS.cloud.sync().then(function () { loadBoard(false); });
    },
    "board-by": function (node) { setBoard(node.getAttribute("data-by"), null); },
    "board-span": function (node) { setBoard(null, node.getAttribute("data-span")); },
    "board-refresh": function () {
      PS.cloud.sync().then(function () { loadBoard(true); });
    },
    logout: function () {
      closeModal();
      signOut();
    },
    login: function () {
      closeModal();
      showGate({ name: "" });
    },
    "gate-mode": function (node) {
      var g = view.gate;
      if (!g || g.busy) return;
      var name = $("#gate-name");
      g.mode = node.getAttribute("data-mode") === "signup" ? "signup" : "login";
      showGate({ name: name ? name.value.trim() : g.name, down: g.down });
    },
    "gate-retry": function () { boot(); },
    "ban-check": function (node) {
      node.disabled = true;
      PS.cloud.status().then(function (ban) {
        if (ban) showBan();
        else enter(false);
      });
    },
    "mod-open": function (node) {
      var id = node.getAttribute("data-id");
      var act = node.getAttribute("data-mod");
      var row = boardFind(id);
      if (!row) return;
      var m = view.board.mod;
      if (m && m.id === id && m.act === act) {
        view.board.mod = null; // a second click on the same button closes the form
      } else {
        view.board.mod = { id: id, name: row.name, act: act, msg: "", minutes: 60, kind: "item", item: firstItem("weapon"), rarity: 0, amount: 1000, busy: false, error: "" };
        if (act === "shown") {
          // the figure the board is ranking by, and what it shows for it now
          view.board.mod.figure = view.board.by;
          var sh0 = row.shown && typeof row.shown === "object" ? row.shown : {};
          view.board.mod.text = typeof sh0[view.board.by] === "string" ? sh0[view.board.by] : "";
          view.board.mod.place = typeof sh0["place:" + view.board.by] === "string" ? sh0["place:" + view.board.by] : "";
          view.board.mod.tier = typeof sh0["tier:" + view.board.by] === "string" ? sh0["tier:" + view.board.by] : "";
        }
        if (act === "inv") {
          var inv = view.board.mod;
          inv.inv = null;
          inv.shown = INV_PAGE;
          inv.bagOpen = false;
          inv.petsOpen = false;
          inv.waiting = null;
          inv.inputs = {};
          inv.confirm = null;
          inv.otherOpen = false;
          loadInv(inv);
          return;
        }
      }
      paintBoard();
      var first = view.board.mod ? $("#board .board__form select, #board .board__form textarea") : null;
      if (first) first.focus();
    },
    "board-banned": function () {
      view.board.showBanned = !view.board.showBanned;
      paintBoard();
    },
    "mod-pick-open": function () {
      var m = view.board.mod;
      if (!m) return;
      m.pickOpen = !m.pickOpen;
      paintBoard();
      var q = $("#mod-pick-q");
      if (q) q.focus();
      var on = $(".itempick__item.is-on");
      if (on) on.scrollIntoView({ block: "nearest" });
    },
    "mod-pick": function (node) {
      var m = view.board.mod;
      var id = node.getAttribute("data-item");
      if (!m || !PS.ITEMS[id]) return;
      m.item = id;
      m.pickOpen = false;
      paintBoard();
    },
    "mod-cancel": function () {
      view.board.mod = null;
      paintBoard();
    },
    "inv-refresh": function () {
      var m = view.board.mod;
      if (isInv(m)) loadInv(m);
    },
    "inv-remove": function (node) {
      var m = view.board.mod;
      if (!isInv(m)) return;
      var key = node.getAttribute("data-key");
      if (m.confirm !== key) {
        // the first press only asks
        m.confirm = key;
        paintBoard();
        clearTimeout(confirmTimer);
        confirmTimer = setTimeout(function () {
          if (view.board.mod === m && m.confirm === key) {
            m.confirm = null;
            paintBoard();
          }
        }, 4000);
        return;
      }
      m.confirm = null;
      var kind = node.getAttribute("data-kind");
      var all = node.hasAttribute("data-all");
      var t = { kind: kind, item: null, rarity: 0, amount: 0 };
      if (kind === "item" && node.hasAttribute("data-other")) {
        t.item = takeInput(m, "take-item") || firstItem("weapon");
        t.rarity = Number(takeInput(m, "take-rarity")) || 0;
        t.amount = all ? 0 : Math.max(1, Math.floor(Number(takeInput(m, "take-count")) || 1));
      } else if (kind === "item") {
        t.item = node.getAttribute("data-item");
        t.rarity = Number(node.getAttribute("data-r")) || 0;
        t.amount = 1;
      } else {
        t.amount = all ? 0 : Math.floor(Number(takeInput(m, "take-" + kind)) || 0);
        if (!all && t.amount < 1) {
          paintBoard();
          toast("Type how many " + kind + " to remove, or press Remove all");
          return;
        }
      }
      if (kind === "item" && !PS.ITEMS[t.item]) return;
      paintBoard();
      queueTake(m, t);
    },
    "take-undo": function (node) {
      var m = view.board.mod;
      if (!isInv(m)) return;
      node.disabled = true;
      PS.cloud.cancelTake(Number(node.getAttribute("data-take"))).then(function (res) {
        if (res.error) toast(res.error);
        else toast("Called off");
        loadTakes(m);
      });
    },
    "inv-more": function () {
      var m = view.board.mod;
      var list = $("#inv-bag");
      if (!isInv(m) || !m.inv || !list) return;
      m.shown += INV_PAGE;
      list.innerHTML = invBagCells(m);
    },
    "mod-unban": function (node) {
      var id = node.getAttribute("data-id");
      var name = (boardFind(id) || { name: "" }).name;
      node.disabled = true;
      PS.cloud.unbanPlayer(id).then(function (res) {
        if (res.error) {
          toast(res.error);
          node.disabled = false;
          return;
        }
        toast("Unbanned " + name);
        loadBoard(true);
      });
    },
    "gate-offline": function () {
      PS.cloud.playOffline();
      enter(false);
    },
    // the Battle screen's "How to play": Settings, opened at the guide
    howto: function () {
      GUIDE_OPEN.basics = true;
      openModal({ type: "settings", armed: false });
      var guide = $("#guide");
      if (guide) guide.scrollIntoView({ block: "start" });
    },
    secret: function () {
      openModal({ type: "secret", open: PS.dev.unlocked, admin: false, wrong: false });
      var input = $("#secret-input");
      if (input) input.focus();
    },
    theme: function () {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      PS.store.set(KEY_THEME, next);
      renderModal();
    },
    reset: function () {
      if (!view.modal.armed) {
        view.modal.armed = true;
        renderModal();
        return;
      }
      closeModal();
      view.forge = null;
      view.filter = "all";
      view.tab = "battle";
      st.reset();
      toast("Fresh start. Good luck!");
    },

    chapter: function (node) {
      var dir = Number(node.getAttribute("data-dir"));
      view.slide = dir;
      st.selectChapter(st.get().chapter + dir);
    },
    sound: function () {
      PS.sfx.toggle();
      renderModal();
    },
    cycle: function (node) {
      var name = node.getAttribute("data-pref");
      var list = CYCLES[name];
      if (!list) return;
      var at = 0;
      list.forEach(function (o, i) { if (o[0] === PS.prefs.get(name)) at = i; });
      PS.prefs.set(name, list[(at + 1) % list.length][0]);
      renderModal();
    },
    "prefs-reset": function () {
      PS.prefs.reset();
      PS.sfx.refreshVolume();
      PS.music.refresh();
      applyBlur();
      renderModal();
      toast("Settings restored");
    },
    pref: function (node) {
      var name = node.getAttribute("data-pref");
      PS.prefs.set(name, !PS.prefs.get(name));
      if (name === "blur") applyBlur();
      if (name === "music") PS.music.refresh();
      renderModal();
    },
    motion: function () {
      var next = { auto: "on", on: "off", off: "auto" }[PS.motionMode()];
      PS.store.set("lemon:motion", next);
      if (next === "auto") document.documentElement.removeAttribute("data-motion");
      else document.documentElement.setAttribute("data-motion", next);
      renderModal();
      view.entering = true;
      render();
    },
    casino: function (node) {
      openModal({ type: node.getAttribute("data-game") === "spinner" ? "spinner" : "blackjack" });
    },
    bet: function (node) {
      view.casino.bet = Math.max(1, Math.floor(st.get().gold * Number(node.getAttribute("data-share"))));
      renderModal();
    },
    "bj-deal": bjDeal,
    "bj-hit": bjHit,
    "bj-stand": function () {
      var bj = view.casino.bj;
      if (bj && bj.phase === "play") bjDealer();
    },
    "bj-double": bjDouble,
    "bw-pick": function (node) {
      if (view.casino.bw.spinning) return;
      view.casino.bw.pick = node.getAttribute("data-pick") === "white" ? "white" : "black";
      renderModal();
    },
    "bw-spin": bwSpin,
    fight: function () { startBattle(st.get().chapter); },
    together: function () { if (PS.multi) PS.multi.open(); },
    trade: function () { if (PS.trade) PS.trade.open(); },
    chat: function () {
      chat.rows = null;
      chat.error = "";
      openModal({ type: "chat" });
      clearInterval(chat.timer);
      chat.timer = setInterval(loadChat, CHAT_EVERY);
      loadChat().then(function () {
        var list = $("#chat-list");
        if (list) list.scrollTop = list.scrollHeight;
        var box = $("#chat-input");
        if (box) box.focus();
      });
    },
    "chat-emoji": function (node) {
      var box = $("#chat-input");
      if (!box) return;
      var start = box.selectionStart === null ? box.value.length : box.selectionStart;
      var end = box.selectionEnd === null ? start : box.selectionEnd;
      box.value = (box.value.slice(0, start) + node.getAttribute("data-e") + box.value.slice(end)).slice(0, 200);
      box.focus();
      var at = start + node.getAttribute("data-e").length;
      try { box.setSelectionRange(at, at); } catch (err) { /* not every browser lets a text box move its cursor */ }
    },
    "chat-at": function (node) {
      var box = $("#chat-input") || $("#pchat-input");
      if (!box) return;
      var tag = "@" + node.getAttribute("data-name") + " ";
      if (box.value.indexOf(tag) !== 0) box.value = tag + box.value;
      box.focus();
    },
    "chat-del": function (node) {
      node.disabled = true;
      PS.cloud.chatDelete(Number(node.getAttribute("data-id"))).then(function (res) {
        if (res.error) toast(res.error);
        loadChat();
        loadPanel();
      });
    },
    endless: function () {
      var info = st.endlessInfo();
      if (info.open) startBattle(info.chapter, "swarm");
    },
    challenge: function () {
      var info = st.challengeInfo();
      if (info.open) startBattle(info.chapter, undefined, info.twist.id);
    },
    daily: function () {
      var got = st.claimDaily();
      if (!got) return;
      openModal({
        type: "loot", title: "Daily reward · day " + got.day, items: got.items, gold: got.gold, gems: got.gems, shards: got.shards,
        art: got.items.length ? "gilded" : "gift"
      });
      if (got.items.length) revealSound(got.items);
      else PS.sfx.play("coin");
    },
    again: function () {
      var chapter = view.results.chapter;
      var mode = view.results.swarm ? "swarm" : undefined;
      var twist = view.results.twist;
      PS.B.stop();
      // a challenge played again after midnight is the new day's challenge
      if (twist) {
        var info = st.challengeInfo();
        chapter = info.chapter;
        twist = info.twist.id;
      }
      startBattle(chapter, mode, twist);
    },
    home: function () { leaveBattle(); },

    filter: function (node) {
      view.filter = node.getAttribute("data-filter");
      render();
    },
    item: function (node) { openModal({ type: "item", u: Number(node.getAttribute("data-u")) }); },
    equip: function (node) {
      var item = st.item(Number(node.getAttribute("data-u")));
      if (!item) return;
      st.equip(item.u);
      toast(fullName(item) + " equipped");
      closeModal();
    },
    unequip: function (node) {
      st.unequip(node.getAttribute("data-slot"));
      if (view.modal && view.modal.type === "item") closeModal();
    },
    "equip-best": function () {
      var changed = st.equipBest();
      toast(changed ? "Swapped " + changed + (changed === 1 ? " slot" : " slots") + " for something better" : "You are already wearing your best");
    },
    upgrade: function (node) {
      var slot = node.getAttribute("data-slot");
      if (st.upgrade(slot, 1)) upgraded(slot, "+1");
    },
    "upgrade-max": function (node) {
      var slot = node.getAttribute("data-slot");
      var bought = st.upgrade(slot, 999);
      if (bought) {
        toast("+" + bought + (bought === 1 ? " level" : " levels"));
        upgraded(slot, "+" + bought);
      }
    },

    "forge-open": function () {
      view.forge = { main: 0, mats: [] };
      render();
      el.screen.scrollTop = 0;
    },
    "forge-close": function () {
      view.forge = null;
      render();
    },
    "forge-this": function (node) {
      closeModal();
      view.tab = "gear";
      view.forge = { main: Number(node.getAttribute("data-u")), mats: [] };
      render();
      el.screen.scrollTop = 0;
    },
    "forge-main": function (node) {
      view.forge.main = Number(node.getAttribute("data-u"));
      view.forge.mats = [];
      render();
    },
    "forge-clear": function () {
      view.forge.main = 0;
      view.forge.mats = [];
      render();
    },
    "forge-mat": function (node) {
      var u = Number(node.getAttribute("data-u"));
      var mats = view.forge.mats;
      var at = mats.indexOf(u);
      if (at !== -1) mats.splice(at, 1);
      else if (mats.length < 2) mats.push(u);
      else mats[1] = u;
      render();
    },
    "forge-unmat": function (node) {
      var u = Number(node.getAttribute("data-u"));
      view.forge.mats = view.forge.mats.filter(function (x) { return x !== u; });
      render();
    },
    "forge-auto": function () {
      var main = st.item(view.forge.main);
      if (!main) return;
      var options = st.forgeMaterials(main);
      for (var i = 0; i < options.length && view.forge.mats.length < 2; i++) {
        if (view.forge.mats.indexOf(options[i].u) === -1) view.forge.mats.push(options[i].u);
      }
      render();
    },
    "forge-quick": function () {
      openModal({ type: "quick", keep: true });
    },
    "quick-go": function () {
      var plan = st.quickForge(view.modal.keep);
      closeModal();
      if (!plan.steps.length) return;
      PS.sfx.play("forge");
      toast("Quick forge: " + plan.steps.length + (plan.steps.length === 1 ? " forge" : " forges") + ", " + plan.used + " items used up");
      pulse($(".bench"), "is-forged", 900);
    },
    "forge-go": function () {
      var forge = view.forge;
      // Epic and above, or S and SS grade, are not melted down without a second click
      if (costlyMats(forge).length && forge.armedFor !== forgeKey(forge)) {
        forge.armedFor = forgeKey(forge);
        PS.sfx.play("deny");
        render();
        return;
      }
      var made = st.forge(forge.main, forge.mats[0], forge.mats[1]);
      if (!made) return;
      forge.mats = [];
      toast("Forged: " + fullName(made) + "!");
      PS.sfx.play("forge");
      render();
      var out = $(".tile--result");
      if (out) out.classList.add("is-fresh");
      pulse($(".bench"), "is-forged", 900);
    },

    chest: function (node) {
      var kind = node.getAttribute("data-kind");
      var count = Number(node.getAttribute("data-count"));
      var items = st.openChest(kind, count);
      if (!items) return;
      openModal({ type: "loot", title: PS.CHESTS[kind].name + (count > 1 ? " × " + count : ""), items: items, shards: items.shards, art: kind, again: { kind: kind, count: count } });
      revealSound(items);
    },
    egg: function (node) {
      var results = st.hatch(Number(node.getAttribute("data-count")));
      if (!results) return;
      var best = 0;
      results.forEach(function (res) { if (res.pet.r > best) best = res.pet.r; });
      openModal({ type: "hatch", results: results });
      PS.sfx.play("chestOpen");
      setTimeout(function () { PS.sfx.play("reveal", best); }, 600);
    },
    "pet-equip": function (node) {
      var u = Number(node.getAttribute("data-u"));
      var was = st.petInfo(u).equipped;
      if (st.togglePet(u)) toast(was ? "Your pet stays home" : "Your pet is coming along");
      else toast("Your team is full. Send one home or unlock another slot");
    },
    "pet-slot": function () {
      if (!st.buyPetSlot()) return;
      PS.sfx.play("reveal", 2);
      toast("Pet slot " + st.get().petSlots + " unlocked");
    },
    "pet-level": function (node) {
      var u = Number(node.getAttribute("data-u"));
      if (!st.levelPet(u)) return;
      var button = $('[data-key="pet-lv-' + u + '"]');
      var card = button ? button.closest(".pet") : null;
      pulse(card, "is-pulse", 800);
      floater(card, "+1 Lv");
    },
    "chestinfo-r": function (node) {
      view.modal.r = Number(node.getAttribute("data-r"));
      renderModal();
    },
    book: function () { openModal({ type: "book", slot: "weapon", pick: null }); },
    "book-slot": function (node) {
      view.modal.slot = node.getAttribute("data-slot");
      view.modal.pick = null;
      renderModal();
    },
    "book-pick": function (node) {
      // only the caption changes, so the grid keeps its scroll position
      view.modal.pick = node.getAttribute("data-id");
      var was = $(".book__grid .is-picked");
      if (was) was.classList.remove("is-picked");
      node.classList.add("is-picked");
      $(".book__caption").innerHTML = bookCaption(view.modal.pick);
    },
    "book-claim": function () {
      var gems = st.claimBook();
      if (!gems) return;
      toast("+" + fmt(gems) + " gems from your collection");
      renderModal();
    },
    "chest-info": function (node) {
      openModal({ type: "chestinfo", kind: node.getAttribute("data-kind") });
    },
    craft: function () {
      var item = st.craftShards();
      if (!item) return;
      openModal({ type: "loot", title: "SS shards, crafted", items: [item], art: "gilded" });
      revealSound([item]);
    },
    gift: function () {
      var gift = st.claimGift();
      if (!gift) return;
      openModal({ type: "loot", title: "Free gift", items: gift.items, gold: gift.gold, gems: gift.gems, art: "gift" });
      revealSound(gift.items);
    },
    deal: function (node) {
      var item = st.buyDeal(Number(node.getAttribute("data-index")));
      if (item) toast(fullName(item) + " added to your bag");
    },
    gold: function () {
      var gold = st.buyGold();
      if (gold) toast("+" + fmt(gold) + " gold");
    },
    talent: function (node) {
      var id = node.getAttribute("data-id");
      if (!st.buyTalent(id)) return;
      var button = $('[data-key="talent-' + id + '"]');
      var card = button ? button.closest(".talent") : null;
      pulse(card, "is-pulse", 800);
      floater(card, "+1");
    },
    ascend: function () {
      var tier = st.ascend();
      if (!tier) return;
      PS.sfx.play("reveal", 4);
      toast("Ascended! Tier " + TIER_NUMERALS[tier - 1] + " talents unlocked");
      view.entering = true;
      render();
      el.screen.scrollTop = 0;
    },
    quest: function (node) {
      var gems = st.claimQuest(node.getAttribute("data-id"));
      if (gems) toast("+" + gems + " gems");
    },

    "dev-give": function () {
      var count = Math.max(1, Math.min(100, Math.round(Number($("#dev-count").value) || 1)));
      view.dev.count = count;
      var item = null;
      for (var i = 0; i < count; i++) item = st.give(view.dev.id, view.dev.r);
      st.equip(item.u);
      toast("Gave " + (count > 1 ? count + " × " : "") + fullName(item) + " and equipped one");
    },
    "dev-give-bag": function () {
      var count = Math.max(1, Math.min(100, Math.round(Number($("#dev-count").value) || 1)));
      view.dev.count = count;
      var item = null;
      for (var i = 0; i < count; i++) item = st.give(view.dev.id, view.dev.r);
      toast("Gave " + (count > 1 ? count + " × " : "") + fullName(item) + " to the bag");
    },
    "dev-give-all": function () {
      PS.ITEM_ORDER.forEach(function (id) { st.give(id, view.dev.r); });
      toast("Gave one of every item at " + PS.RARITY[view.dev.r].name);
    },
    "dev-set": function () {
      // one basic item per slot, so every empty slot gets filled
      var basics = { weapon: "sling", ring: "twig", amulet: "pebble", helmet: "cap", armor: "bark", boots: "mud" };
      PS.SLOTS.forEach(function (slot) {
        st.equip(st.give(basics[slot.key], view.dev.r).u);
      });
      toast("Gave a full " + PS.RARITY[view.dev.r].name + " set");
    },
    "dev-remove": function (node) {
      var item = st.item(Number(node.getAttribute("data-u")));
      if (item && st.take(item.u)) toast("Removed " + fullName(item));
    },
    sell: function (node) {
      var item = st.item(Number(node.getAttribute("data-u")));
      if (!item) return;
      // worth thousands, so it asks once more before it goes
      if (!view.modal.sellArmed) {
        view.modal.sellArmed = true;
        PS.sfx.play("deny");
        renderModal();
        return;
      }
      var name = fullName(item);
      var gold = st.sell(item.u);
      if (!gold) return;
      closeModal();
      PS.sfx.play("coin");
      toast("Sold " + name + " for " + fmt(gold) + " gold");
    },
    "dev-swarm": function () {
      var chapter = Math.max(1, Math.min(PS.BAL.CHAPTERS, Math.round(Number($("#dev-swarm-ch").value) || 1)));
      startBattle(chapter, "swarm");
    },
    "dev-tab": function (node) {
      view.devTab = node.getAttribute("data-tab-name");
      renderModal();
    },
    "dev-add": function (node) {
      var S = st.get();
      st.setMoney(S.gold + Number(node.getAttribute("data-gold")), S.gems + Number(node.getAttribute("data-gems")));
      toast("Now " + fmt(st.get().gold) + " gold and " + fmt(st.get().gems) + " gems");
    },
    "dev-shards": function () {
      st.devAddShards(PS.SHARDS.needed);
      toast("+" + PS.SHARDS.needed + " SS shards");
    },
    "dev-eggs": function () {
      var results = st.devHatch(10);
      openModal({ type: "hatch", results: results });
    },
    "dev-shop": function () {
      st.devRefreshShop();
      toast("Free gift is ready and today's deals are back");
    },
    "dev-best": function () {
      st.devSetBest(Number($("#dev-best").value));
      toast("Chapters cleared: " + st.get().best);
    },
    "dev-unlock": function () {
      st.devSetBest(PS.BAL.CHAPTERS);
      toast("Every chapter is open");
    },
    "dev-max-talents": function () {
      st.devMaxTalents();
      toast("Every talent is maxed");
    },
    "dev-max-slots": function () {
      st.devMaxSlots();
      toast("Slot levels maxed for what you are wearing");
    },
    "dev-start": function () {
      var chapter = Math.max(1, Math.min(PS.BAL.CHAPTERS, Math.round(Number($("#dev-start-ch").value) || 1)));
      startBattle(chapter);
    },
    "dev-export": function () {
      view.modal.exported = st.exportSave();
      renderModal();
      var box = $("#dev-save");
      if (box) box.select();
    },
    "dev-import": function () {
      var box = $("#dev-save");
      if (box && st.importSave(box.value.trim())) {
        toast("Save loaded");
      } else {
        view.devHistory.pop(); // nothing changed, so there is nothing to undo
        toast("That is not a save this game can read");
      }
    },
    "dev-chapter": function () {
      st.devSetChapter(Number($("#dev-chapter").value));
      toast("Battle screen is on chapter " + st.get().chapter);
    },
    "dev-lockall": function () {
      st.devSetBest(0);
      toast("Only chapter 1 is open");
    },
    "dev-ascend": function () {
      st.devAscend();
      toast("Talent tier " + st.ascendInfo().tier);
    },
    "dev-reset-talents": function () {
      st.devResetTalents();
      toast("All talents forgotten");
    },
    "dev-claim-quests": function () {
      var gems = st.devClaimQuests();
      toast(gems ? "Claimed " + fmt(gems) + " gems of quests" : "No quests are ready");
    },
    "dev-shards-set": function () {
      st.devSetShards(Number($("#dev-shards").value));
      toast("SS shards: " + st.get().shards);
    },
    "dev-start-toggle": function (node) {
      var key = node.getAttribute("data-key");
      PS.dev.startWith[key] = !PS.dev.startWith[key];
      renderModal();
    },
    "dev-start-mult": function (node) {
      PS.dev.startWith[node.getAttribute("data-key")] = Number(node.getAttribute("data-value"));
      renderModal();
    },
    "dev-start-levels": function (node) {
      PS.dev.startBuild.levels = Number(node.getAttribute("data-value"));
      renderModal();
    },
    "dev-start-maxall": function () {
      PS.dev.startBuild.maxAll = !PS.dev.startBuild.maxAll;
      renderModal();
    },
    "dev-start-reset": function () {
      PS.dev.TOGGLES.forEach(function (t) { PS.dev.startWith[t.key] = false; });
      PS.dev.MULTS.forEach(function (m) { PS.dev.startWith[m.key] = 1; });
      PS.dev.startBuild.levels = 0;
      PS.dev.startBuild.maxAll = false;
      renderModal();
    },

    /* gear */
    "dev-equip-best": function () {
      var changed = st.equipBest();
      toast(changed ? "Swapped " + changed + (changed === 1 ? " slot" : " slots") + " for something better" : "You are already wearing your best");
    },
    "dev-slot-levels": function () {
      // read every box first: each change redraws this menu and would reset the rest
      var levels = PS.SLOTS.map(function (slot) {
        var box = $("#dev-lv-" + slot.key);
        return [slot.key, box ? Number(box.value) : st.get().lv[slot.key]];
      });
      levels.forEach(function (pair) { st.devSetSlotLevel(pair[0], pair[1]); });
      toast("Slot levels set");
    },
    "dev-equip": function (node) {
      var item = st.item(Number(node.getAttribute("data-u")));
      if (!item) return;
      st.equip(item.u);
      toast(fullName(item) + " equipped");
    },
    "dev-owned-rarity": function (node) {
      var item = st.item(Number(node.getAttribute("data-u")));
      if (!item) return;
      var r = item.r + Number(node.getAttribute("data-dir"));
      if (r < 0 || r > PS.MAX_RARITY) return;
      st.devSetRarity(item.u, r);
      toast(fullName(item));
    },
    "dev-clean": function () {
      var removed = st.devCleanBag(view.dev.clean);
      toast(removed ? "Removed " + removed + (removed === 1 ? " item" : " items") : "Nothing to remove");
    },

    /* pets */
    "dev-pet-give": function () {
      var sp = $("#dev-psp").value;
      var r = Number($("#dev-pr").value);
      var lv = Number($("#dev-plv").value);
      view.dev.psp = sp;
      view.dev.pr = r;
      view.dev.plv = lv;
      var pet = st.devGivePet(sp, r, lv);
      if (pet) toast(PS.RARITY[pet.r].name + " " + PS.PET[pet.sp].name + " at level " + pet.lv);
    },
    "dev-pet-all": function () {
      st.devGiveAllPets();
      toast("Every pet at every rarity, at the top level");
    },
    "dev-pet-team": function (node) {
      if (!st.togglePet(Number(node.getAttribute("data-u")))) toast("The team is full. Open another slot or send one home");
    },
    "dev-pet-up": function (node) {
      var u = Number(node.getAttribute("data-u"));
      var pet = st.petInfo(u);
      if (pet) st.devSetPetLevel(u, pet.pet.lv + 1);
    },
    "dev-pet-max": function (node) {
      st.devSetPetLevel(Number(node.getAttribute("data-u")), 999);
    },
    "dev-pet-remove": function (node) {
      if (st.devRemovePet(Number(node.getAttribute("data-u")))) toast("Pet removed");
    },
    "dev-pets-max": function () {
      st.devMaxPets();
      toast("Every pet is at its top level");
    },
    "dev-pets-fill": function () {
      st.devFillTeam();
      toast("Your best pets are on the team");
    },
    "dev-pet-slots": function (node) {
      st.devSetPetSlots(Number(node.getAttribute("data-n")));
      toast("Team slots: " + st.get().petSlots);
    },

    /* shop */
    "dev-chest": function (node) {
      var kind = node.getAttribute("data-kind");
      var count = Number(node.getAttribute("data-count"));
      var items = st.devOpenChest(kind, count);
      if (!items) return;
      var byRarity = [];
      var graded = { S: 0, SS: 0 };
      items.forEach(function (item) {
        byRarity[item.r] = (byRarity[item.r] || 0) + 1;
        var grade = st.def(item).grade;
        if (grade !== "A") graded[grade]++;
      });
      var parts = [];
      byRarity.forEach(function (n, r) { if (n) parts.push(n + " " + PS.RARITY[r].name); });
      if (graded.S) parts.push(graded.S + " S-grade");
      if (graded.SS) parts.push(graded.SS + " SS-grade");
      if (items.shards) parts.push(items.shards + " SS shard" + (items.shards === 1 ? "" : "s"));
      toast(PS.CHESTS[kind].name + " × " + count + ": " + parts.join(", "));
    },
    "dev-sim": function (node) {
      view.devSim = st.devSimulateChests(node.getAttribute("data-kind"), 1000);
      renderModal();
    },
    "dev-pity": function () {
      var s = Number($("#dev-pity-s").value);
      var ss = Number($("#dev-pity-ss").value);
      st.devSetPity(s, ss);
      toast("Pity counters set");
    },
    "dev-gift-wait": function (node) {
      var seconds = Number(node.getAttribute("data-seconds"));
      st.devSetGiftWait(seconds);
      toast("The free gift is ready in " + PS.countdown(seconds * 1000));
    },

    /* quests and counters */
    "dev-quest-done": function (node) {
      if (st.devCompleteQuest(node.getAttribute("data-id"))) toast("Ready to claim");
    },
    "dev-quest-claim": function (node) {
      var gems = st.claimQuest(node.getAttribute("data-id"));
      if (gems) toast("+" + gems + " gems");
    },
    "dev-quests-all": function () {
      toast("Every quest finished: " + fmt(st.devFinishQuests()) + " gems claimed");
    },
    "dev-stats-set": function () {
      var values = {};
      Object.keys(st.get().stats).forEach(function (key) {
        var box = $("#dev-stat-" + key);
        if (box) values[key] = Number(box.value);
      });
      st.devSetStats(values);
      toast("Counters set");
    },

    /* chapters */
    "dev-play": function (node) {
      startBattle(Number(node.getAttribute("data-n")));
    },
    "dev-clear-to": function (node) {
      var n = Number(node.getAttribute("data-n"));
      st.devSetBest(n);
      toast("Chapters cleared: " + st.get().best);
    },

    /* undo, snapshots and files */
    "dev-undo": function () {
      var entry = view.devHistory.pop();
      if (!entry) return;
      if (st.importSave(entry.save)) toast("Undid: " + entry.label);
      else toast("That step could not be restored");
    },
    "dev-restore": function (node) {
      var i = Number(node.getAttribute("data-i"));
      var entry = view.devHistory[i];
      if (!entry) return;
      view.devHistory.length = i; // everything after it is undone with it
      if (st.importSave(entry.save)) toast("Back to before: " + entry.label);
    },
    "dev-snap-save": function () {
      var box = $("#dev-snap-name");
      var list = devSnaps();
      var name = ((box && box.value) || "").trim() || "Snapshot " + (list.length + 1);
      list.push({ name: name, at: Date.now(), save: st.exportSave() });
      if (PS.store.set(KEY_SNAPS, list)) toast("Saved: " + name);
      else toast("The browser has no room for another snapshot");
      renderModal();
    },
    "dev-snap-load": function (node) {
      var snap = devSnaps()[Number(node.getAttribute("data-i"))];
      if (!snap) return;
      if (st.importSave(snap.save)) toast("Loaded: " + snap.name);
      else toast("That snapshot could not be read");
    },
    "dev-snap-delete": function (node) {
      var list = devSnaps();
      var at = Number(node.getAttribute("data-i"));
      if (!list[at]) return;
      list.splice(at, 1);
      PS.store.set(KEY_SNAPS, list);
      renderModal();
    },
    "dev-download": function () {
      var stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
      var link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([st.exportSave()], { type: "application/json" }));
      link.download = "pip-survivors-save-" + stamp + ".json";
      el.modal.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(link.href); }, 2000);
    },
    "dev-volume": function (node) {
      PS.prefs.set("vol", PS.VOLUME_STEPS[Number(node.getAttribute("data-value"))]);
      PS.sfx.refreshVolume();
      renderModal();
      PS.sfx.play("coin");
    },
    "dev-notice": function () {
      openModal({ type: "notice" });
    },
    "dev-boost": function () {
      function read(id) {
        var box = $("#" + id);
        var v = box ? box.value.trim() : "";
        return v === "" ? undefined : Number(v);
      }
      var stats = {};
      BOOST_FIELDS.forEach(function (f) {
        var v = read("dev-b-" + f[0]);
        if (v !== undefined && isFinite(v) && v >= 0) stats[f[0]] = f[2] ? v / 100 : v;
      });
      var power = read("dev-b-power");
      var label = $("#dev-b-label");
      st.setBoost({ power: power !== undefined && isFinite(power) ? power : undefined, label: label ? label.value : "", stats: stats });
      toast(st.boost() ? "Your power and stats are set" : "Nothing set: all back to normal");
      renderModal();
    },
    "dev-boost-clear": function () {
      st.setBoost(null);
      toast("Your power and stats are back to normal");
      renderModal();
    },
    "abuse-pick": function (node) {
      var ev = node.getAttribute("data-ev");
      var at = abuse.events.indexOf(ev);
      if (at === -1) abuse.events.push(ev);
      else abuse.events.splice(at, 1);
      if (!abuse.events.length) abuse.withEvent = false;
      abuse.confirm = "";
      renderModal();
    },
    abuse: function (node) {
      var what = node.getAttribute("data-what");
      var msgBox = $("#abuse-msg");
      if (msgBox) abuse.message = msgBox.value;
      if (abuse.confirm !== what) {
        // the first press only asks
        abuse.confirm = what;
        abuse.note = "";
        renderModal();
        setTimeout(function () {
          if (abuse.confirm === what) {
            abuse.confirm = "";
            if (view.modal && view.modal.type === "secret") renderModal();
          }
        }, 4000);
        return;
      }
      abuse.confirm = "";
      var message = abuse.message.trim();
      var seconds = Math.max(0, Math.min(120, Math.floor(Number(abuse.seconds) || 0)));
      // in the menu's order, the same as the button says
      var events = ABUSE_EVENTS.map(function (e) { return e[0]; }).filter(function (k) { return abuse.events.indexOf(k) !== -1; });
      var together = what === "give" && abuse.withEvent && events.length;
      var job;
      if (what === "give") {
        var gift = { kind: abuse.what, item: abuse.item, rarity: abuse.rarity, amount: abuse.amount, message: message, who: abuse.who };
        var label = abuse.what === "item" ? PS.RARITY[abuse.rarity].name + " " + PS.ITEMS[abuse.item].name : fmt(abuse.amount) + " " + abuse.what;
        // the events go at the same moment, so the gift pops up in the middle of them
        var also = together ? PS.cloud.fireEvent(events, message, seconds) : Promise.resolve({});
        job = Promise.all([also, PS.cloud.giveMany(gift)]).then(function (both) {
          if (both[0].error) return both[0];
          var res = both[1];
          if (res.error) return res;
          if (together) label += " with " + events.join(" + ");
          if (abuse.who === "random") return { done: res.n ? res.name + " won " + label + "!" : "Nobody to give it to" };
          return { done: "Sent " + label + " to " + fmt(res.n) + " player" + (res.n === 1 ? "" : "s") + (message ? " (with your message)" : "") };
        });
      } else {
        if (!events.length) return;
        job = PS.cloud.fireEvent(events, message, seconds).then(function (res) {
          return res.error ? res : { done: "Fired " + events.join(" + ") + (seconds ? " for " + seconds + " seconds" : "") + ". Open games play it within about 10 seconds." };
        });
      }
      abuse.note = "Sending...";
      renderModal();
      job.then(function (res) {
        abuse.note = res.error || res.done;
        if (view.modal && view.modal.type === "secret") renderModal();
        // see it here at once: events play now, and a gift to yourself is picked up now
        if (!res.error) {
          if (together || what === "fire") checkEvent();
          if (what === "give") watch();
        }
      });
    },
    "dev-banner-save": function () {
      var box = $("#dev-banner");
      sendBanner((box ? box.value : "").replace(/\s+/g, " ").trim());
    },
    "dev-banner-hide": function () {
      sendBanner("");
    },
    "dev-banner-reset": function () {
      sendBanner(null);
    },
    "dev-copy": function () {
      var text = st.exportSave();
      view.modal.exported = text;
      renderModal();
      var box = $("#dev-save");
      if (box) box.select();
      try {
        navigator.clipboard.writeText(text).then(function () { toast("Save copied"); }, function () { toast("Copy was blocked: select the text and copy it"); });
      } catch (err) {
        toast("Copy was blocked: select the text and copy it");
      }
    },
    "dev-reset": function () {
      if (!view.modal.resetArmed) {
        view.modal.resetArmed = true;
        PS.sfx.play("deny");
        renderModal();
        return;
      }
      view.modal.resetArmed = false;
      view.forge = null;
      st.reset();
      toast("Save reset");
      renderModal();
    },
    "dev-lock": function () {
      PS.dev.lock();
      closeModal();
      toast("Dev menu locked");
    },
    "dev-money": function () {
      st.setMoney(Number($("#dev-gold").value), Number($("#dev-gems").value));
      toast("Set to " + fmt(st.get().gold) + " gold and " + fmt(st.get().gems) + " gems");
    }
  };

  /* what each action sounds like: a name, or null when the action plays its own */
  var SOUND = {
    tab: "tab", fight: "start", again: "start", equip: "equip", "equip-best": "equip", "dev-give": "equip", "dev-set": "equip",
    upgrade: "upgrade", "upgrade-max": "upgrade", talent: "talent", quest: "coin", deal: "coin", gold: "coin", "book-claim": "coin", challenge: "start",
    gift: null, daily: null, chest: null, craft: null, ascend: null, egg: null, "pet-slot": null, sell: null, "forge-go": null, "quick-go": null, sound: null, cycle: null,
    // the casino plays its own: a card dealt, the wheel let go, a win or a loss
    "bj-deal": null, "bj-hit": null, "bj-double": null, "bw-spin": null
  };

  function upgraded(slot, text) {
    var card = $('.slot[data-slot="' + slot + '"]');
    pulse(card, "is-pulse", 800);
    floater(card, text);
  }

  /** The chest rumbles while the lid shakes, then the finds ring out. */
  function revealSound(items) {
    var best = 0;
    items.forEach(function (item) { if (item.r > best) best = item.r; });
    PS.sfx.play("chestOpen");
    setTimeout(function () { PS.sfx.play("reveal", best); }, 700);
  }

  function onClick(e) {
    var node = e.target.closest("[data-act]");
    if (!node || node.disabled) return;
    var name = node.getAttribute("data-act");
    var action = ACTIONS[name];
    if (!action) return;
    var sound = SOUND[name];
    if (sound !== null) PS.sfx.play(sound || "click");
    // the admin menu can take back what it changes: remember the save first
    // (the first click on "Reset this save" only arms the button)
    var armed = name === "dev-reset" && !(view.modal && view.modal.resetArmed);
    if (DEV_UNDO[name] && PS.dev.admin && !armed) devSnapshot(DEV_UNDO[name]);
    action(node);
  }

  /** The Save section's file picker: read the chosen file and load it as a save. */
  function devLoadFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      devSnapshot(DEV_UNDO["dev-file-load"]);
      if (st.importSave(String(reader.result).trim())) {
        toast("Loaded " + file.name);
      } else {
        view.devHistory.pop();
        toast("That file is not a save this game can read");
      }
    };
    reader.onerror = function () { toast("The file could not be read"); };
    reader.readAsText(file);
  }

  function onSubmit(e) {
    if (e.target.getAttribute("data-form") === "gate") {
      gateSubmit(e);
      return;
    }
    if (e.target.getAttribute("data-form") === "mod") {
      modSubmit(e);
      return;
    }
    if (e.target.getAttribute("data-form") === "chat") {
      chatSubmit(e);
      return;
    }
    if (e.target.getAttribute("data-form") === "rename") {
      renameSubmit(e);
      return;
    }
    if (e.target.getAttribute("data-form") !== "secret") return;
    e.preventDefault();
    if (!view.modal) return;
    var input = $("#secret-input");
    if (input && !view.modal.admin && input.value === PS.dev.password) {
      PS.dev.lock();
      view.forge = null;
      st.reset();
      PS.sfx.play("lose");
      openModal({ type: "womp" });
      return;
    }
    if (input && view.modal.admin && PS.dev.unlock(input.value)) {
      view.modal.open = true;
      renderModal();
    } else {
      view.modal.wrong = true;
      renderModal();
      input = $("#secret-input");
      if (input) input.focus();
    }
  }

  /** Once a second: keep the countdowns moving and notice a gift coming due. */
  function tick() {
    if (el.app.hidden) return;
    // an admin with the leaderboard open sees who comes and goes
    if (view.modal && view.modal.type === "account" && view.board.presence && Date.now() - view.board.presenceAt > PRESENCE_EVERY) loadPresence();
    if (view.giftsWaiting && !view.modal) {
      openModal({ type: "gift", got: view.giftsWaiting });
      view.giftsWaiting = null;
    }
    if (view.takenWaiting && !view.modal) {
      openModal({ type: "taken", lost: view.takenWaiting });
      view.takenWaiting = null;
    }
    var giftReady = st.giftWait() === 0;
    var nodes = document.querySelectorAll("[data-countdown]");
    for (var i = 0; i < nodes.length; i++) {
      var kind = nodes[i].getAttribute("data-countdown");
      if (kind === "gift" && giftReady) {
        render();
        return;
      }
      nodes[i].textContent = PS.countdown(kind === "gift" ? st.giftWait() : untilMidnight());
    }
    el.tabbar.querySelector('[data-tab="shop"]').classList.toggle("has-badge", giftReady || st.dailyInfo().ready);
  }

  /* ---------------------------------------------------------------- boot */

  /* --------------------------------------------------- staying up to date */
  /* A page left open keeps running the version it loaded. Once a minute (and
     whenever the tab comes back into view) the game asks the server when each
     of its own files last changed. When one has, a new version is out: the
     page fetches the new files, then reloads itself as soon as that costs
     nothing. Never during a battle; while the page is in view, only with no
     pop-up open and nothing half-typed on the log-in screen. */

  var UPDATE_EVERY = 60000;
  var KEY_UPDATED = "lemon:updated"; // sessionStorage: when this tab last reloaded for an update
  var ownFiles = [];
  var prints = null; // when each file the page is running last changed
  var updateReady = false;
  var reloading = false;

  function lastUpdated() {
    try {
      return Number(sessionStorage.getItem(KEY_UPDATED)) || 0;
    } catch (err) {
      return 0;
    }
  }

  /** index.html and every script and stylesheet the page loaded from its own site. */
  function ownFileList() {
    var list = [location.href.split("#")[0].split("?")[0]];
    var nodes = document.querySelectorAll("script[src], link[rel=stylesheet][href]");
    for (var i = 0; i < nodes.length; i++) {
      var url = (nodes[i].src || nodes[i].href).split("#")[0];
      if (url.indexOf(location.origin + "/") === 0) list.push(url);
    }
    return list;
  }

  /** started: what the page loaded (from the browser's cache); otherwise what the server has now. */
  function readPrints(started) {
    return Promise.all(ownFiles.map(function (url) {
      var how = started ? { cache: "force-cache" } : { method: "HEAD", cache: "no-store" };
      return fetch(url, how).then(function (res) {
        return res.ok ? res.headers.get("last-modified") || res.headers.get("etag") || "" : "";
      }, function () { return ""; });
    }));
  }

  function checkForUpdate() {
    if (!prints || updateReady) return;
    readPrints(false).then(function (now) {
      var changed = now.some(function (print, i) { return print && prints[i] && print !== prints[i]; });
      // just reloaded for an update: let a minute or two pass rather than risk a loop
      if (!changed || updateReady || Date.now() - lastUpdated() < 120000) return;
      updateReady = true;
      // fetch the new files into the cache first, or the reload could start from old ones
      Promise.all(ownFiles.map(function (url) {
        return fetch(url, { cache: "reload" }).catch(function () {});
      })).then(tryReload);
    });
  }

  function safeToReload() {
    if (!el.battle.hidden) return false;
    if ((view.casino.bj && view.casino.bj.phase !== "done") || view.casino.bw.spinning) return false; // a bet is riding on it
    if (document.visibilityState === "hidden") return true;
    if (view.modal) return false;
    var boxes = el.gate.hidden ? [] : el.gate.querySelectorAll("input");
    for (var i = 0; i < boxes.length; i++) if (boxes[i].value) return false;
    return true;
  }

  function tryReload() {
    if (!updateReady || reloading || !safeToReload()) return;
    reloading = true;
    try {
      sessionStorage.setItem(KEY_UPDATED, String(Date.now()));
    } catch (err) {
      /* blocked */
    }
    var go = function () { location.reload(); };
    PS.cloud.sync().then(go, go); // the leaderboard gets the latest figures first
    setTimeout(go, 2000);
  }

  function startUpdateWatch() {
    if (!/^https?:$/.test(location.protocol) || !window.fetch) return; // nothing to watch when opened as a file
    if (Date.now() - lastUpdated() < 60000) toast("Updated to the newest version");
    ownFiles = ownFileList();
    readPrints(true).then(function (list) {
      prints = list;
      setInterval(checkForUpdate, UPDATE_EVERY);
      setInterval(tryReload, 3000);
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") checkForUpdate();
        else tryReload();
      });
    });
  }

  PS.ui = {
    startTogether: function (mp) { startTogether(mp); },
    // for the trade window (trade.js), so items look the same everywhere
    tile: tile,
    price: price,
    init: function () {
      el.app = $("#app");
      el.screen = $("#screen");
      el.tabbar = $("#tabbar");
      el.power = $("#top-power");
      el.gold = $("#top-gold");
      el.gems = $("#top-gems");
      el.modal = $("#modal");
      el.toast = $("#toast");
      el.battle = $("#battle");
      el.gate = $("#gate");
      el.account = $("#open-account");
      el.status = $("#status");

      // the banner: what index.html says, unless the owner has set one since
      checkEvent(); // notes the event already there, so only newer ones play
      builtInBanner = el.status ? el.status.textContent.trim() : "";
      var heldBanner = PS.store.get(KEY_BANNER, null);
      if (heldBanner && typeof heldBanner === "object") {
        view.banner = { text: typeof heldBanner.text === "string" ? heldBanner.text : null, at: heldBanner.at || null };
        showBanner(view.banner.text);
      }
      refreshBanner();

      if (PS.motionMode() !== "auto") document.documentElement.setAttribute("data-motion", PS.motionMode());
      var theme = PS.store.get(KEY_THEME, null);
      if (theme === "dark" || theme === "light") document.documentElement.setAttribute("data-theme", theme);

      applyBlur();
      PS.scenery.mount(); // the orchard behind the menus
      $("#open-settings").innerHTML = PS.icon("gear");
      var tabs = el.tabbar.querySelectorAll("[data-tab]");
      for (var i = 0; i < tabs.length; i++) {
        var name = tabs[i].getAttribute("data-tab");
        tabs[i].insertAdjacentHTML("afterbegin", PS.icon("tab" + name.charAt(0).toUpperCase() + name.slice(1)));
      }

      st.load();
      PS.music.play("camp"); // starts with the first click or key press
      PS.B.mount(el.battle);
      el.results = document.createElement("div");
      el.results.className = "sheet";
      el.results.hidden = true;
      el.battle.appendChild(el.results);

      document.addEventListener("click", onClick);
      document.addEventListener("submit", onSubmit);
      // the close event arrives a moment late: if another pop-up opened in between, it stays
      el.modal.addEventListener("close", function () { if (!el.modal.open) view.modal = null; });
      // remember which parts of the guide are open, so a redraw does not fold them up
      el.modal.addEventListener("toggle", function (e) {
        var id = e.target && e.target.getAttribute ? e.target.getAttribute("data-guide") : null;
        if (id) GUIDE_OPEN[id] = e.target.open;
        // an admin's look at an inventory: the bag and the pets are only drawn once unfolded
        var invPart = e.target && e.target.getAttribute ? e.target.getAttribute("data-invpart") : null;
        var invMod = view.board.mod;
        if (invPart && isInv(invMod) && invMod.inv) {
          if (invPart === "other") {
            invMod.otherOpen = e.target.open;
            return;
          }
          if (invPart === "bag") invMod.bagOpen = e.target.open;
          else invMod.petsOpen = e.target.open;
          var grid = e.target.querySelector(".inv__grid");
          if (e.target.open && grid && !grid.firstChild) {
            grid.innerHTML = invPart === "bag" ? invBagCells(invMod) : invMod.inv.pets.map(invPet).join("") || '<span class="hint">None.</span>';
          }
        }
        // a chest's slot list: remember it, and draw its items the first time it opens
        var part = e.target && e.target.getAttribute ? e.target.getAttribute("data-chestpart") : null;
        if (part) {
          CHEST_OPEN[part] = e.target.open;
          var list = e.target.querySelector(".chestinfo__list");
          if (e.target.open && list && !list.firstChild) {
            var bits = part.split(":");
            list.innerHTML = chestList(bits[0], bits[1], Number(e.target.getAttribute("data-r")));
          }
        }
      }, true);
      // the volume slider: move it and the sound changes at once, no redraw to interrupt the drag
      el.modal.addEventListener("input", function (e) {
        if (e.target.id === "cas-bet") {
          view.casino.bet = Math.floor(Number(e.target.value)) || 0;
          return;
        }
        if (e.target.id === "board-search") {
          view.board.q = e.target.value;
          paintBoard();
          return;
        }
        if (e.target.id === "dev-banner") {
          // the draft survives a redraw, and the preview follows the typing
          view.dev.banner = e.target.value;
          var preview = $("#dev-banner-preview");
          if (preview) preview.textContent = e.target.value;
          return;
        }
        if (/^take-/.test(e.target.id) && isInv(view.board.mod)) {
          view.board.mod.inputs[e.target.id] = e.target.value;
          return;
        }
        if (/^abuse-/.test(e.target.id)) {
          var key = e.target.id.slice(6);
          if (key === "amount") abuse.amount = Math.max(1, Math.min(1e9, Math.floor(Number(e.target.value) || 1)));
          else if (key === "msg") abuse.message = e.target.value;
          else if (key === "rarity") abuse.rarity = Number(e.target.value) || 0;
          else if (key === "with") abuse.withEvent = e.target.checked;
          else if (key === "seconds") abuse.seconds = e.target.value;
          else abuse[key] = e.target.value; // who, what, item
          abuse.confirm = "";
          if (key !== "amount" && key !== "msg" && key !== "seconds") {
            // what is shown depends on these: draw it again, keeping the focus
            renderModal();
            var again = $("#" + e.target.id);
            if (again) again.focus();
          }
          return;
        }
        if (e.target.id === "mod-pick-q") {
          // the item list filters in place, so typing keeps its focus
          var want = e.target.value.trim().toLowerCase();
          var picks = el.modal.querySelectorAll(".itempick__item");
          for (var pi = 0; pi < picks.length; pi++) {
            var words = picks[pi].getAttribute("data-name");
            var grade = picks[pi].getAttribute("data-grade");
            // "s" and "ss" find that grade; anything else looks in the names
            picks[pi].hidden = Boolean(want) && want.split(/\s+/).some(function (w) {
              return w === "s" || w === "ss" ? grade !== w : words.indexOf(w) === -1;
            });
          }
          return;
        }
        if (/^mod-/.test(e.target.id) && view.board.mod) {
          var m = view.board.mod;
          var v = e.target.value;
          if (e.target.id === "mod-msg") m.msg = v;
          else if (e.target.id === "mod-shown") m.text = v;
          else if (e.target.id === "mod-place") m.place = v;
          else if (e.target.id === "mod-tier") m.tier = v;
          else if (e.target.id === "mod-figure") {
            // start from what that board shows now
            m.figure = v;
            var shownRow = boardFind(m.id) || {};
            var sh = shownRow.shown && typeof shownRow.shown === "object" ? shownRow.shown : {};
            m.text = typeof sh[v] === "string" ? sh[v] : "";
            m.place = typeof sh["place:" + v] === "string" ? sh["place:" + v] : "";
            m.tier = typeof sh["tier:" + v] === "string" ? sh["tier:" + v] : "";
            paintBoard();
            var fig = $("#mod-figure");
            if (fig) fig.focus();
            return;
          }
          else if (e.target.id === "mod-minutes") m.minutes = Number(v);
          else if (e.target.id === "mod-item") m.item = v;
          else if (e.target.id === "mod-rarity") m.rarity = Number(v);
          if (e.target.id === "mod-item" || e.target.id === "mod-rarity") {
            // the picture follows the pickers
            var preview = $("#mod-preview");
            if (preview) preview.innerHTML = givePreview(m);
          }
          else if (e.target.id === "mod-amount") m.amount = Number(v);
          else if (e.target.id === "mod-kind") {
            m.kind = v;
            paintBoard(); // gold and gems ask for an amount instead of an item
            var kind = $("#mod-kind");
            if (kind) kind.focus();
          }
          return;
        }
        if (e.target.id === "set-music") {
          PS.prefs.set("musicVol", Number(e.target.value));
          PS.music.refresh();
          var musicLabel = $("#set-music-label");
          if (musicLabel) musicLabel.textContent = PS.prefs.get("musicVol") + "%";
          return;
        }
        if (e.target.id !== "set-vol") return;
        PS.prefs.set("vol", Number(e.target.value));
        PS.sfx.refreshVolume();
        var label = $("#set-vol-label");
        if (label) label.textContent = PS.prefs.get("vol") + "%";
      });
      el.modal.addEventListener("change", function (e) {
        if (e.target.id === "set-vol") PS.sfx.play("coin"); // so the new level can be judged
        if (e.target.id === "quick-keep" && view.modal && view.modal.type === "quick") {
          view.modal.keep = e.target.checked;
          renderModal();
        }
        if (e.target.id === "dev-id") view.dev.id = e.target.value;
        if (e.target.id === "dev-count") view.dev.count = Math.max(1, Math.min(100, Math.round(Number(e.target.value) || 1)));
        if (e.target.id === "dev-rarity") view.dev.r = Number(e.target.value);
        if (e.target.id === "dev-psp") view.dev.psp = e.target.value;
        if (e.target.id === "dev-pr") {
          view.dev.pr = Number(e.target.value);
          view.dev.plv = Math.min(view.dev.plv, PS.PET_RARITY[view.dev.pr].cap);
          renderModal(); // the level box's limit depends on the rarity
        }
        if (e.target.id === "dev-plv") view.dev.plv = Math.max(1, Math.round(Number(e.target.value) || 1));
        if (e.target.id === "dev-clean-r") view.dev.clean = Number(e.target.value);
        if (e.target.id === "dev-owned-filter") {
          view.dev.slot = e.target.value;
          renderModal();
        }
        if (e.target.id === "dev-file" && view.modal && view.modal.type === "secret") devLoadFile(e.target.files && e.target.files[0]);
      });
      el.modal.addEventListener("click", function (e) {
        // a click on the dimmed backdrop lands on the dialog itself
        if (e.target === el.modal) closeModal();
      });
      el.modal.addEventListener("keydown", function (e) {
        // Enter in the admin menu's banner box sends it
        if (e.key === "Enter" && e.target.id === "dev-banner") {
          e.preventDefault();
          ACTIONS["dev-banner-save"]();
        }
      });

      PS.on("change", function () {
        if (!el.app.hidden) render();
      });

      var logoClicks = [];
      var mark = $(".brand__mark");
      if (mark) {
        mark.addEventListener("click", function () {
          var now = Date.now();
          logoClicks.push(now);
          logoClicks = logoClicks.filter(function (t) { return now - t < 2000; });
          if (logoClicks.length >= 3) {
            logoClicks = [];
            logoArmedUntil = now + 60000;
            if (!PS.dev.admin && coarsePointer() && PS.cloud.isAdmin()) showCodePad();
          }
        });
      }

      var CODE = { size: 11, lock: "26ou7l4a1q7" };
      var typed = [];

      /** One key, from the keyboard or the pad; true when it finished the code. */
      function feedCode(key) {
        if (!PS.cloud.isAdmin()) return false;
        typed.push(key);
        if (typed.length > CODE.size) typed.shift();
        if (typed.length < CODE.size || PS.dev.mix(typed.join(",")) !== CODE.lock) return false;
        typed = [];
        if (PS.dev.admin) {
          hideCodePad();
          openModal({ type: "secret", open: true, admin: true, wrong: false });
        } else if (logoArmedUntil > Date.now()) {
          logoArmedUntil = 0;
          hideCodePad();
          openModal({ type: "secret", open: false, admin: true, wrong: false });
          var box = $("#secret-input");
          if (box) box.focus();
        }
        return true;
      }

      document.addEventListener("keydown", function (e) {
        var tag = e.target && e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.app.hidden || !e.key) return;
        // the last key must not also press whatever button has focus
        if (feedCode(e.key.toLowerCase())) e.preventDefault();
      });

      var padEl = null;
      var padTimer = 0;
      function coarsePointer() {
        return Boolean(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
      }
      function hideCodePad() {
        clearTimeout(padTimer);
        if (padEl) padEl.hidden = true;
      }
      function showCodePad() {
        if (!padEl) {
          padEl = document.createElement("div");
          padEl.className = "codepad";
          padEl.setAttribute("role", "group");
          padEl.setAttribute("aria-label", "Key code");
          padEl.innerHTML =
            '<button type="button" class="codepad__key codepad__key--up" data-code="arrowup" aria-label="Up">&#9650;</button>' +
            '<button type="button" class="codepad__key codepad__key--left" data-code="arrowleft" aria-label="Left">&#9664;</button>' +
            '<button type="button" class="codepad__key codepad__key--down" data-code="arrowdown" aria-label="Down">&#9660;</button>' +
            '<button type="button" class="codepad__key codepad__key--right" data-code="arrowright" aria-label="Right">&#9654;</button>' +
            '<button type="button" class="codepad__key codepad__key--b" data-code="b">B</button>' +
            '<button type="button" class="codepad__key codepad__key--a" data-code="a">A</button>' +
            '<button type="button" class="codepad__key codepad__key--start" data-code="enter">Start</button>' +
            '<button type="button" class="codepad__close" data-code="close" aria-label="Close the pad">&times;</button>';
          padEl.addEventListener("click", function (e) {
            var key = e.target.closest("[data-code]");
            if (!key) return;
            var code = key.getAttribute("data-code");
            if (code === "close") {
              hideCodePad();
              typed = [];
            } else {
              feedCode(code);
            }
          });
          document.body.appendChild(padEl);
        }
        typed = [];
        padEl.hidden = false;
        clearTimeout(padTimer);
        padTimer = setTimeout(hideCodePad, 60000); // as long as the logo stays armed
      }
      PS.on("battle:end", showResults);

      PS.on("cloud", renderAccount);
      document.body.insertAdjacentHTML("beforeend", tierDefs());
      setInterval(watch, CHECK_EVERY);
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") watch();
      });
      // @mentions in the chat reach a player on any screen (a small question every few seconds, only while the game is in front)
      setInterval(function () { if (el.gate.hidden) checkMentions(); }, MENTION_EVERY);
      // events are quick (a small question every 10 seconds, only while the game is in front)
      setInterval(function () {
        if (document.visibilityState === "visible" && el.gate.hidden && !PS.cloud.offline()) checkEvent();
      }, EVENT_EVERY);
      el.app.hidden = true; // until someone has logged in (or chosen to play offline)
      boot();
      startUpdateWatch();
      clearInterval(tickTimer);
      tickTimer = setInterval(tick, 1000);
    }
  };
})();
