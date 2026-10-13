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
    dev: { id: "sling", r: 0 }, // the dev menu's picker
    devTab: "gear", // which tab of the dev menu is showing
    entering: true, // the next render should play the screen's entrance animation
    slide: 0, // -1 / 1 while the chapter title slides in from a side
    modal: null, // { type, ... } while a pop-up is open
    results: null
  };
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
            "<div><dt>Length</dt><dd>" + PS.clock(ch.duration) + " then the boss</dd></div>" +
            "<div><dt>" + (first ? "First clear" : "Reward") + "</dt><dd>" + price("gold", ch.gold * (first ? 3 : 1)) + (first ? price("gems", PS.BAL.gemsFirst(ch.n)) : "") + "</dd></div>" +
            "<div><dt>Gear drops</dt><dd>" + (first ? (ch.milestone ? "6" : "5") : "3") + ' × <span class="rlist">' + lootPreview(ch.n) + (first && ch.milestone ? '<span class="rname g-' + ch.milestone[0] + '">' + ch.milestone[0] + "-grade</span>" : "") + "</span></dd></div>" +
            "<div><dt>Best</dt><dd>" + (record && record.n ? PS.clock(record.time) + " · cleared " + record.n + (record.n === 1 ? " time" : " times") : "Not cleared yet") + "</dd></div>" +
          "</dl>" +

          '<button class="btn btn--primary btn--xl" type="button" data-act="fight" data-key="fight">' + PS.icon("tabBattle") + "Battle</button>" +
          '<p class="hint">Move with WASD or the arrow keys, or drag on the screen. Your lemon attacks by itself.</p>' +
        "</div>" +
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

  function untilMidnight() {
    var now = new Date();
    var next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return next - now;
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

  function settingsModal(modal) {
    var S = st.get();
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    var minutes = Math.round(S.stats.time / 60);
    return (
      '<div class="settings">' +
        '<button class="modal__close" type="button" data-act="close" aria-label="Close">' + PS.icon("close") + "</button>" +
        '<h2 id="modal-title">Settings</h2>' +
        '<div class="settings__row"><span>Sound effects</span>' +
          '<button class="btn btn--sm" type="button" data-act="sound" data-key="sound">' + (PS.sfx.on() ? "On" : "Off") + "</button></div>" +
        '<div class="settings__row"><span>Sound volume</span>' +
          '<button class="btn btn--sm" type="button" data-act="volume" data-key="volume">' + PS.VOLUMES[PS.prefs.get("volume")].name + "</button></div>" +
        '<div class="settings__row"><span>Screen shake</span>' +
          '<button class="btn btn--sm" type="button" data-act="pref" data-pref="shake" data-key="pref-shake">' + (PS.prefs.get("shake") ? "On" : "Off") + "</button></div>" +
        '<div class="settings__row"><span>Damage numbers</span>' +
          '<button class="btn btn--sm" type="button" data-act="pref" data-pref="numbers" data-key="pref-numbers">' + (PS.prefs.get("numbers") ? "On" : "Off") + "</button></div>" +
        '<div class="settings__row"><span>Pause when you leave the tab</span>' +
          '<button class="btn btn--sm" type="button" data-act="pref" data-pref="autopause" data-key="pref-autopause">' + (PS.prefs.get("autopause") ? "On" : "Off") + "</button></div>" +
        '<div class="settings__row"><span>Animations</span>' +
          '<button class="btn btn--sm" type="button" data-act="motion" data-key="motion">' + { auto: "Auto (follow device)", on: "Always on", off: "Off" }[PS.motionMode()] + "</button></div>" +
        '<div class="settings__row"><span>Colours</span>' +
          '<button class="btn btn--sm" type="button" data-act="theme" data-key="theme">' + (dark ? "Switch to day" : "Switch to night") + "</button></div>" +
        "<h3>How to play</h3>" +
        '<ul class="howto">' +
          "<li>Move with WASD or the arrow keys, or drag on the screen. The lemon attacks by itself.</li>" +
          "<li>Gems dropped by pests fill the bar at the top. Each level, pick one of three upgrades (keys 1, 2, 3).</li>" +
          "<li>Last until the timer runs out, then beat the boss to clear the chapter.</li>" +
          "<li>Esc or P pauses.</li>" +
        "</ul>" +
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
        '<h2 id="modal-title">' + (modal.open ? "Unlocked" : "Password") + "</h2>" +
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
     section has its numbers at the top, then the switches and setters. */

  var DEV_TABS = [
    ["overview", "Overview", "info"],
    ["gear", "Gear", "tabGear"],
    ["money", "Money", "coin"],
    ["progress", "Progress", "tabTalents"],
    ["battle", "Battle", "tabBattle"],
    ["owned", "Owned", "tabShop"],
    ["settings", "Settings", "gear"],
    ["save", "Save", "forge"]
  ];

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
        ["Talents maxed", maxed + " / " + open.length],
        ["Talent tier", st.ascendInfo().tier + " of " + PS.TALENT_TIERS],
        ["Quests ready", ready]
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
        ["Dev tools", PS.dev.unlocked ? "unlocked" : "locked"],
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
          devButton("dev-max-slots", "Max every slot's level")
        ) + '<p class="hint">Rarity comes from the picker above. Slot levels stop at what the worn item\'s rarity allows.</p>'
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
          devButton("dev-add", "+1B gold", ' data-gold="1000000000" data-gems="0"')
        ) +
        devRow(
          devButton("dev-add", "+100 gems", ' data-gold="0" data-gems="100"') +
          devButton("dev-add", "+1K gems", ' data-gold="0" data-gems="1000"') +
          devButton("dev-add", "+100K gems", ' data-gold="0" data-gems="100000"')
        )
      ) +
      devCard("Shards and shop",
        '<div class="dev__give">' + devNumber("dev-shards", "SS shards", S.shards, 0) + devButton("dev-shards-set", "Set") + "</div>" +
        devRow(
          devButton("dev-shards", "+" + PS.SHARDS.needed + " shards") +
          devButton("dev-shop", "Free gift ready, deals restocked")
        )
      )
    );
  }

  function devProgress(S) {
    var open = st.unlockedTalents();
    var asc = st.ascendInfo();
    var maxed = open.filter(function (t) { return (S.talents[t.id] || 0) >= t.max; }).length;
    var learned = PS.TALENTS.reduce(function (n, t) { return n + (S.talents[t.id] || 0); }, 0);
    var quests = st.quests();
    var ready = quests.filter(function (q) { return q.ready; }).length;
    var finished = quests.filter(function (q) { return q.done; }).length;
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
      ) +
      devCard("Quests",
        devRow(devButton("dev-claim-quests", "Claim everything that is ready")),
        [["Ready to claim", ready], ["Ladders finished", finished + " / " + quests.length]]
      )
    );
  }

  function devBattle(S) {
    var sw = PS.dev.startWith;
    var ch = PS.chapter(S.chapter);
    var rec = S.clears[S.chapter];
    var speeds = [0.5, 1, 2, 4];
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
          ["Best clear", rec ? PS.clock(rec.time) : "none"]
        ]
      ) +
      devCard("Swarm mode",
        '<div class="dev__give">' +
          devNumber("dev-swarm-ch", "Pests as tough as chapter", S.chapter, 1, PS.BAL.CHAPTERS) +
          devButton("dev-swarm", "Start swarm mode", "", "btn--primary") +
        "</div>" +
        '<p class="hint">Endless, no boss. Pays 1.2× the usual gold for the chapter you pick and keeps nothing else.</p>'
      ) +
      devCard("Start the next battle with",
        '<div class="devbox__toggles">' +
          devToggle("dev-start-toggle", ' data-key="god"', "Godmode", "Nothing can hurt you", sw.god) +
          devToggle("dev-start-toggle", ' data-key="oneHit"', "One-hit kills", "Every hit kills, bosses too", sw.oneHit) +
        "</div>" +
        '<p class="devbox__label">Game speed</p>' +
        devRow(speeds.map(function (v) {
          return '<button class="btn btn--sm' + (sw.speed === v ? " btn--primary" : "") + '" type="button" data-act="dev-start-speed" data-value="' + v + '">' + v + "×</button>";
        }).join("")) +
        '<p class="hint">Inside any battle the DEV button changes these live and adds every upgrade to pick or max.</p>'
      )
    );
  }

  function devOwned(S) {
    var counts = [];
    S.items.forEach(function (item) { counts[item.r] = (counts[item.r] || 0) + 1; });
    var grades = { S: 0, SS: 0 };
    S.items.forEach(function (item) {
      var g = st.def(item).grade;
      if (g !== "A") grades[g]++;
    });
    var info = [["Items", S.items.length], ["S-grade", grades.S], ["SS-grade", grades.SS]];
    counts.forEach(function (n, r) { if (n) info.push([PS.RARITY[r].name, n]); });
    var owned = st.sorted(S.items).map(function (item) {
      var worn = st.isEquipped(item);
      // worn gear is only taken off, never deleted, so nothing can be lost by accident
      return (
        '<li class="dev__row"><span class="rname r' + item.r + '">' + esc(st.def(item).name) + "</span>" +
        "<span>" + PS.RARITY[item.r].name + (st.def(item).grade !== "A" ? " · " + st.def(item).grade : "") + (worn ? " · equipped" : "") + "</span>" +
        (worn
          ? (st.def(item).slot === "weapon" ? "" : '<button class="btn btn--sm" type="button" data-act="unequip" data-slot="' + st.def(item).slot + '">Take off</button>')
          : '<button class="btn btn--sm" type="button" data-act="dev-remove" data-u="' + item.u + '">Remove</button>') + "</li>"
      );
    }).join("");
    return devCard("Everything you own", '<ul class="dev__list">' + owned + "</ul>", info);
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
          return '<button class="btn btn--sm' + (PS.prefs.get("volume") === i ? " btn--primary" : "") + '" type="button" data-act="dev-volume" data-value="' + i + '">' + v.name + "</button>";
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
    return (
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
      devCard("Start again",
        devRow(devButton("dev-reset", modal.resetArmed ? "Yes, wipe this save" : "Reset this save", "", "btn--danger")) +
        '<p class="hint">Only this browser\'s save. Everything goes back to a new game.</p>'
      )
    );
  }

  function devMenu(modal) {
    var S = st.get();
    var tab = view.devTab;
    var calc = st.calc();
    if (!DEV_TABS.some(function (t) { return t[0] === tab; })) tab = view.devTab = "overview";
    var body = tab === "gear" ? devGear(S, view.dev, calc)
      : tab === "money" ? devMoney(S)
      : tab === "progress" ? devProgress(S)
      : tab === "battle" ? devBattle(S)
      : tab === "owned" ? devOwned(S)
      : tab === "settings" ? devSettings()
      : tab === "save" ? devSave(modal, S)
      : devOverview(S, calc);
    return (
      '<div class="dev devshell">' +
        '<button class="modal__close" type="button" data-act="close" aria-label="Close">' + PS.icon("close") + "</button>" +
        '<h2 id="modal-title">Dev menu</h2>' +
        '<p class="hint">For testing. Changes only touch this browser\'s save.</p>' +
        '<div class="devshell__main">' +
          '<nav class="devnav" role="tablist" aria-label="Dev menu sections">' + DEV_TABS.map(function (t) {
            return '<button class="devnav__item' + (tab === t[0] ? " is-active" : "") + '" type="button" role="tab" aria-selected="' + (tab === t[0]) + '" data-act="dev-tab" data-tab-name="' + t[0] + '">' +
              PS.icon(t[2]) + "<span>" + t[1] + "</span></button>";
          }).join("") + "</nav>" +
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
    view.results = null;
    el.results.hidden = true;
    el.app.hidden = true;
    el.battle.hidden = false;
    PS.B.start(chapter, mode);
    if (mode === "swarm") PS.B.toast("Swarm mode! Survive as long as you can.", 4);
  }

  function leaveBattle() {
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
        '<p class="kicker">Swarm mode · pests as tough as chapter ' + ch.n + "</p>" +
        "<h2>Swarmed!</h2>" +
        '<p class="results__sub">You held out for ' + PS.clock(result.time) + ". Swarm mode pays 1.2× the usual gold; nothing else is kept.</p>" +
        '<dl class="facts facts--tight">' +
          "<div><dt>Time</dt><dd>" + PS.clock(result.time) + "</dd></div>" +
          "<div><dt>Squashed</dt><dd>" + fmt(result.kills) + "</dd></div>" +
          "<div><dt>Level</dt><dd>" + result.level + "</dd></div>" +
          "<div><dt>Damage</dt><dd>" + fmt(result.dealt || 0) + "</dd></div>" +
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
    secret: function () {
      openModal({ type: "secret", open: PS.dev.unlocked, wrong: false });
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
    volume: function () {
      PS.prefs.set("volume", (PS.prefs.get("volume") + 1) % PS.VOLUMES.length);
      PS.sfx.refreshVolume();
      renderModal();
      PS.sfx.play("coin");
    },
    pref: function (node) {
      var name = node.getAttribute("data-pref");
      PS.prefs.set(name, !PS.prefs.get(name));
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
      if (box && st.importSave(box.value.trim())) toast("Save loaded");
      else toast("That is not a save this game can read");
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
    "dev-start-speed": function (node) {
      PS.dev.startWith.speed = Number(node.getAttribute("data-value"));
      renderModal();
    },
    "dev-volume": function (node) {
      PS.prefs.set("volume", Number(node.getAttribute("data-value")));
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
      PS.dev.unlocked = false;
      try { sessionStorage.removeItem("lemon:dev"); } catch (err) { /* blocked */ }
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
    gift: null, chest: null, craft: null, ascend: null, sell: null, "forge-go": null, "quick-go": null, sound: null, volume: null
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
    action(node);
  }

  function onSubmit(e) {
    if (e.target.getAttribute("data-form") !== "secret") return;
    e.preventDefault();
    var input = $("#secret-input");
    if (input && input.value === PS.dev.password) {
      PS.dev.unlock();
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
    el.tabbar.querySelector('[data-tab="shop"]').classList.toggle("has-badge", giftReady);
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

      $("#open-settings").innerHTML = PS.icon("gear");
      var tabs = el.tabbar.querySelectorAll("[data-tab]");
      for (var i = 0; i < tabs.length; i++) {
        var name = tabs[i].getAttribute("data-tab");
        tabs[i].insertAdjacentHTML("afterbegin", PS.icon("tab" + name.charAt(0).toUpperCase() + name.slice(1)));
      }

      st.load();
      PS.B.mount(el.battle);
      el.results = document.createElement("div");
      el.results.className = "sheet";
      el.results.hidden = true;
      el.battle.appendChild(el.results);

      document.addEventListener("click", onClick);
      document.addEventListener("submit", onSubmit);
      el.modal.addEventListener("close", function () { view.modal = null; });
      el.modal.addEventListener("change", function (e) {
        if (e.target.id === "quick-keep" && view.modal && view.modal.type === "quick") {
          view.modal.keep = e.target.checked;
          renderModal();
        }
        if (e.target.id === "dev-id") view.dev.id = e.target.value;
        if (e.target.id === "dev-count") view.dev.count = Math.max(1, Math.min(100, Math.round(Number(e.target.value) || 1)));
        if (e.target.id === "dev-rarity") view.dev.r = Number(e.target.value);
      });
      el.modal.addEventListener("click", function (e) {
        // a click on the dimmed backdrop lands on the dialog itself
        if (e.target === el.modal) closeModal();
      });

      PS.on("change", function () {
        if (!el.app.hidden) render();
      });
      PS.on("battle:end", showResults);

      render();
      if (st.takeWipeNotice()) openModal({ type: "notice" });
      clearInterval(tickTimer);
      tickTimer = setInterval(tick, 1000);
    }
  };
})();
