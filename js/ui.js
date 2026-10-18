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
    results: null
  };
  var logoArmedUntil = 0; // when the double-clicked logo stops unlocking the admin key code
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

  function renderTop() {
    var S = st.get();
    countTo("power", el.power, "power", st.calc().power);
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
              '<span class="stage__label">You' + '<b class="power">' + PS.icon("power") + fmt(stats.power) + "</b></span>" +
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
          '<p class="hint">Move with WASD or the arrow keys, or drag on the screen. Your lemon attacks by itself.</p>' +
          '<button class="btn btn--sm home__guide" type="button" data-act="howto" data-key="howto">' + PS.icon("info") + "New here? How to play</button>" +
        "</div>" +
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
            '<div><p class="kicker">Power</p><p class="bigpower">' + PS.icon("power") + fmt(stats.power) + "</p></div>" +
            '<div class="gear__buttons">' +
              '<button class="btn btn--sm" type="button" data-act="equip-best" data-key="equip-best">Equip best</button>' +
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
      "</section>"
    );
  };

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
        guideSection("combo", "Combos", "bolt",
          "<p>Squash pests one after another, no more than about two seconds apart, to build a <b>combo</b>. It shows on the right once it reaches ×10 and changes colour at ×25, ×50 and ×100. Your best combo is on the results screen.</p>") +
        guideSection("bosses", "The bosses", "skull",
          "<p>Every boss fights like the creature it is named after. Red circles and red lanes always show where an attack is about to land. Below half health a boss glows red and attacks faster. From chapter " + PS.TWIN_BOSS.from + " on, <b>two bosses</b> come at once, and both must fall.</p>" +
          '<ul class="guide__list">' + bosses + "</ul>") +
        guideSection("gear", "Gear and the Forge", "tabGear",
          '<ul class="howto">' +
            "<li>You wear six pieces of gear: a weapon, a ring, an amulet, a helmet, armour and boots. Your weapon decides how you attack.</li>" +
            '<li>Rarities, from the bottom: <span class="rlist">' + rarities + "</span>. Rarer gear is stronger and unlocks more of its perks.</li>" +
            "<li>Battles drop gear up to " + rarityName(PS.MAX_DROP_RARITY) + ". Anything rarer comes from the <b>Forge</b>: put in three items of the same slot and rarity, and the one you keep goes up a rarity. <b>Quick forge</b> does every forge it can at once.</li>" +
            "<li>Spend gold to <b>level up</b> each slot. An item's rarity caps how high its slot's level counts.</li>" +
            "<li>Some items are <b>S</b> or <b>SS grade</b>: stronger at every rarity.</li>" +
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

  function devOverview(S, calc) {
    var minutes = Math.round(S.stats.time / 60);
    var open = st.unlockedTalents();
    var maxed = open.filter(function (t) { return (S.talents[t.id] || 0) >= t.max; }).length;
    var ready = st.quests().filter(function (q) { return q.ready; }).length;
    var bytes = JSON.stringify(S).length;
    return (
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
      devCard("Messages",
        devRow(
          devButton("dev-notice", "Show the data-reset notice") +
          devButton("dev-lock", "Lock the dev menu again")
        )
      )
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
    // the dev password only gets the Battle section; the admin password gets all of it
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
  function chestInfoModal(modal) {
    var chest = PS.CHESTS[modal.kind];
    if (!chest) return null;
    // the rarities this chest can roll, and which one is being shown
    var open = [];
    chest.odds.forEach(function (share, r) { if (share > 0) open.push(r); });
    var shown = open.indexOf(modal.r) !== -1 ? modal.r : open[0];
    function section(grade, note, rarity) {
      var rows = "";
      PS.SLOTS.forEach(function (slot) {
        var ids = (PS.POOL[slot.key] || {})[grade] || [];
        if (!ids.length) return;
        rows += '<h4 class="chestinfo__slot">' + slot.plural + "</h4>";
        rows += '<ul class="chestinfo__list">' + ids.map(function (id) {
          var def = PS.ITEMS[id];
          return (
            '<li class="chestinfo__item">' + tile({ id: id, r: rarity }, { plain: true, cls: "tile--mini" }) +
              '<span class="chestinfo__text"><strong>' + esc(def.name) + "</strong>" +
              (slot.key === "weapon" ? "<small>" + esc(def.blurb) + "</small>" : "") + "</span>" +
            "</li>"
          );
        }).join("") + "</ul>";
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
    else if (modal.type === "hatch") html = hatchModal(modal);
    else if (modal.type === "chestinfo") html = chestInfoModal(modal);
    if (html === null) {
      closeModal();
      return;
    }
    el.modal.className = "modal modal--" + modal.type;
    el.modal.innerHTML = html;
  }

  /* ------------------------------------------------------------- battles */

  function startBattle(chapter, mode) {
    closeModal();
    var pad = document.querySelector(".codepad"); // the admin key pad must not follow you into a battle
    if (pad) pad.hidden = true;
    view.results = null;
    el.results.hidden = true;
    el.app.hidden = true;
    el.battle.hidden = false;
    PS.music.play("battle");
    PS.B.start(chapter, mode);
    if (mode === "swarm") PS.B.toast("Endless swarm! Survive as long as you can.", 4);
  }

  function leaveBattle() {
    PS.music.play("camp");
    PS.B.stop();
    PS.B.hud.hide();
    el.battle.hidden = true;
    el.results.hidden = true;
    el.app.hidden = false;
    view.results = null;
    view.tab = "battle";
    render();
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

  function showResults(result) {
    view.results = result;
    PS.music.play("camp");
    if (result.swarm) return showSwarmResults(result);
    var ch = PS.chapter(result.chapter);
    var title = result.won ? (result.finished ? "The grove is saved!" : "Chapter cleared!") : result.progress >= 1 ? "So close…" : "Overrun!";
    var sub = result.won
      ? result.first ? "First clear bonus: triple gold, gems and extra gear." : "Nicely done."
      : result.progress >= 1 ? esc(ch.bossName) + " got the better of you." : "You lasted " + PS.clock(result.time) + " of " + PS.clock(ch.duration) + ".";

    el.results.innerHTML =
      '<div class="panel results results--' + (result.won ? "win" : "loss") + '">' +
        '<p class="kicker">Chapter ' + ch.n + " · " + esc(ch.name) + "</p>" +
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
        (result.items.length
          ? '<div class="loot__items">' + result.items.map(function (item, index) {
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
        '<div class="modal__actions">' +
          '<button class="btn" type="button" data-act="again" data-key="again">' + (result.won ? "Play it again" : "Try again") + "</button>" +
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
    fight: function () { startBattle(st.get().chapter); },
    endless: function () {
      var info = st.endlessInfo();
      if (info.open) startBattle(info.chapter, "swarm");
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
      PS.B.stop();
      startBattle(chapter, mode);
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
    upgrade: "upgrade", "upgrade-max": "upgrade", talent: "talent", quest: "coin", deal: "coin", gold: "coin",
    gift: null, daily: null, chest: null, craft: null, ascend: null, egg: null, "pet-slot": null, sell: null, "forge-go": null, "quick-go": null, sound: null, cycle: null
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
    if (e.target.getAttribute("data-form") !== "secret") return;
    e.preventDefault();
    var input = $("#secret-input");
    // the ordinary prompt takes the dev password; the one the key code opens takes the admin one
    var good = view.modal.admin ? PS.dev.adminPassword : PS.dev.password;
    if (input && input.value === good) {
      PS.dev.unlock(view.modal.admin ? 2 : 1);
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

  PS.ui = {
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
      el.modal.addEventListener("close", function () { view.modal = null; });
      // remember which parts of the guide are open, so a redraw does not fold them up
      el.modal.addEventListener("toggle", function (e) {
        var id = e.target && e.target.getAttribute ? e.target.getAttribute("data-guide") : null;
        if (id) GUIDE_OPEN[id] = e.target.open;
      }, true);
      // the volume slider: move it and the sound changes at once, no redraw to interrupt the drag
      el.modal.addEventListener("input", function (e) {
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

      PS.on("change", function () {
        if (!el.app.hidden) render();
      });

      // Step one of the hidden admin door: click (or tap) the lemon logo twice.
      // That arms the key code below for a minute; without it the code does
      // nothing. On a phone there is no keyboard, so arming also brings up a
      // small pad with the same keys to tap.
      var logoClicks = [];
      var mark = $(".brand__mark");
      if (mark) {
        mark.addEventListener("click", function () {
          var now = Date.now();
          logoClicks.push(now);
          logoClicks = logoClicks.filter(function (t) { return now - t < 2000; });
          if (logoClicks.length >= 2) {
            logoClicks = [];
            logoArmedUntil = now + 60000;
            if (!PS.dev.admin && coarsePointer()) showCodePad();
          }
        });
      }

      // up, up, down, down, left, right, left, right, then B and A (either way round)
      var CODE = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright"];
      var typed = [];

      /** One key of the code, from the keyboard or from the on-screen pad. */
      function feedCode(key) {
        typed.push(key);
        if (typed.length > 10) typed.shift();
        if (typed.length < 10) return;
        var head = typed.slice(0, 8).join(",") === CODE.join(",");
        var tail = typed.slice(8).join("");
        if (head && (tail === "ba" || tail === "ab")) {
          typed = [];
          if (PS.dev.admin) {
            hideCodePad();
            openModal({ type: "secret", open: true, admin: true, wrong: false });
          } else if (logoArmedUntil > Date.now()) {
            // the logo was double-clicked first; now the password is asked for
            logoArmedUntil = 0;
            hideCodePad();
            openModal({ type: "secret", open: false, admin: true, wrong: false });
            var box = $("#secret-input");
            if (box) box.focus();
          }
        }
      }

      document.addEventListener("keydown", function (e) {
        var tag = e.target && e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.app.hidden || !e.key) return;
        feedCode(e.key.toLowerCase());
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

      render();
      if (st.takeWipeNotice()) openModal({ type: "notice" });
      clearInterval(tickTimer);
      tickTimer = setInterval(tick, 1000);
    }
  };
})();
