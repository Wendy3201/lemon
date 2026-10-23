/*!
 * Pip Survivors — dev panel for battles
 * The DEV button in a battle (or the ` key) opens this. The dev password gets
 * cheats (godmode, one-hit kills, game speed), taking any upgrade by hand, and
 * run controls. The admin password also gets a Player tab (stats, levels,
 * weapon swap, build presets), a Spawn tab (any pest, elites, the boss, a
 * training dummy, status effects, drops) and a Stats tab that reads the whole
 * run back. The battle stands still while the panel is open.
 *
 * Which switches exist lives in PS.dev (core.js), so the lobby menu and this
 * panel always offer the same ones.
 *
 * Playing together (co-op and the arena) the panel is there with the admin
 * password, and the battle does not stop for it. Cheats act on your own lemon
 * only. In the room maker's game the buttons work straight away; in the other
 * player's game each press is sent to the room maker's game, which runs the
 * battle and does it on that player's lemon, once the server has confirmed
 * they are on an admin account.
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function () {
  "use strict";

  var PS = window.PS;
  var B = PS.B;
  var TAU = Math.PI * 2;

  var TABS = [["cheats", "Cheats"], ["upgrades", "Upgrades"], ["run", "Run"]];
  var ADMIN_TABS = [
    ["cheats", "Cheats"], ["upgrades", "Upgrades"], ["player", "Player"],
    ["spawn", "Spawn"], ["run", "Run"], ["stats", "Stats"]
  ];

  var KIND_NAMES = {
    grunt: "Grunt", dart: "Dart", brute: "Brute", spitter: "Spitter", splitter: "Splitter",
    charger: "Charger", bomber: "Bomber", mini: "Mini", crate: "Crate"
  };

  /* what the Player tab's boost buttons do; each adds to the run's own numbers */
  var BOOSTS = [
    { id: "dmg", label: "+50% damage", take: function (p) { p.mods.dmg += 0.5; } },
    { id: "haste", label: "+50% attack speed", take: function (p) { p.mods.haste += 0.5; } },
    { id: "crit", label: "+25% crit chance", take: function (p) { p.mods.crit += 0.25; } },
    { id: "critDmg", label: "+100% crit damage", take: function (p) { p.mods.critDmg += 1; } },
    { id: "area", label: "+25% attack size", take: function (p) { p.mods.area += 0.25; } },
    { id: "count", label: "+1 extra shot", take: function (p) { p.mods.count += 1; } },
    { id: "pierce", label: "+1 pierce", take: function (p) { p.mods.pierce += 1; } },
    { id: "speed", label: "+25% move speed", take: function (p) { p.mods.speed += 0.25; } },
    { id: "armor", label: "10% less damage taken", take: function (p) { p.mods.armor *= 0.9; } },
    { id: "regen", label: "+1% regen a second", take: function (p) { p.mods.regen += 0.01; } },
    { id: "magnet", label: "Pickup reach ×2", take: function (p) { p.reach *= 2; } },
    { id: "luck", label: "+1 luck", take: function (p) { p.luck += 1; } },
    { id: "xp", label: "+50% XP gained", take: function (p) { p.xpMul += 0.5; } }
  ];

  var el = null;
  var tab = "cheats";
  var note = ""; // what the last button did, shown above the tab
  var filterText = ""; // upgrades tab: the search box
  var tierFilter = -1; // upgrades tab: -1 shows every tier
  var spawn = { kind: "grunt", elite: false, near: false };
  // set while running something the other player pressed: their number boxes and pickers
  var inputs = null;

  /* buttons that only change this panel, never the battle */
  var PANEL_ONLY = { close: 1, tab: 1, tier: 1, "pick-kind": 1, "spawn-elite": 1, "spawn-near": 1 };
  /* the cheat switches: the other player's game sends them over whole */
  var SWITCHES = { toggle: 1, mult: 1, "reset-cheats": 1 };
  /* never from the other player's game: starting over would end the battle for both */
  var NOT_SHARED = { restart: 1, "restart-at": 1, lose: 1 };

  function run() {
    return B.run;
  }

  function together() {
    var R = run();
    return Boolean(R && R.mp);
  }

  function tabs() {
    var R = run();
    // the other player's game does not have the numbers the Stats tab reads out
    if (R && R.mirror) return ADMIN_TABS.filter(function (t) { return t[0] !== "stats"; });
    return PS.dev.admin ? ADMIN_TABS : TABS;
  }

  /** A number box or picker's value, from this panel or from what the other player's game sent. */
  function field(id) {
    if (inputs) return inputs[id] !== undefined ? String(inputs[id]) : "";
    var box = el && el.querySelector("#" + id);
    return box ? box.value : "";
  }

  function pct(value) {
    return Math.round(value * 1000) / 10 + "%";
  }

  /* ---------------------------------------------------------------- pieces */

  function toggle(key, label, hint) {
    var on = PS.dev.cheats[key];
    return (
      '<button class="devbox__toggle' + (on ? " is-on" : "") + '" type="button" data-dev="toggle" data-key="' + key + '" aria-pressed="' + on + '">' +
        "<b>" + label + "</b><span>" + hint + "</span><i>" + (on ? "ON" : "OFF") + "</i>" +
      "</button>"
    );
  }

  function action(name, label, extra, cls) {
    return '<button class="btn btn--sm' + (cls ? " " + cls : "") + '" type="button" data-dev="' + name + '"' + (extra || "") + ">" + label + "</button>";
  }

  function label(text, small) {
    return '<p class="devbox__label">' + text + (small ? " <small>" + small + "</small>" : "") + "</p>";
  }

  function row(inner) {
    return '<div class="devbox__row">' + inner + "</div>";
  }

  /** A row of buttons for one multiplier; the admin sees the extra values too. */
  function multRow(def) {
    var values = def.values.concat(PS.dev.admin && def.more ? def.more : []);
    var now = PS.dev.cheats[def.key];
    return label(def.label) + row(values.map(function (v) {
      return '<button class="btn btn--sm' + (now === v ? " btn--primary" : "") + '" type="button" data-dev="mult" data-key="' + def.key + '" data-value="' + v + '">' + v + "×</button>";
    }).join(""));
  }

  /** A number box with a button beside it; Enter in the box presses the button. */
  function numberRow(id, text, value, min, max, name, buttonLabel) {
    return (
      '<div class="devbox__field"><label>' + text +
        '<input id="' + id + '" type="number" min="' + min + '" max="' + max + '" step="1" value="' + value + '" data-enter="' + name + '" /></label>' +
        action(name, buttonLabel) +
      "</div>"
    );
  }

  function facts(rows) {
    return '<dl class="facts facts--tight devbox__facts">' + rows.map(function (r) {
      return "<div><dt>" + r[0] + "</dt><dd>" + r[1] + "</dd></div>";
    }).join("") + "</dl>";
  }

  function weaponName(id) {
    return PS.ITEMS[id] ? PS.ITEMS[id].name : id;
  }

  /* ------------------------------------------------------------------ tabs */

  function cheatsTab(R) {
    var admin = PS.dev.admin;
    var shared = Boolean(R.mp);
    return (
      '<div class="devbox__toggles">' +
        PS.dev.TOGGLES.filter(function (t) { return admin || !t.admin; }).map(function (t) {
          return toggle(t.key, t.label, t.hint);
        }).join("") +
      "</div>" +
      // playing together the battle keeps one speed, so the other game keeps up
      PS.dev.MULTS.filter(function (m) { return (admin || !m.admin) && !(shared && m.key === "speed"); }).map(multRow).join("") +
      (shared ? '<p class="hint">Playing together: these work on your lemon only (Freeze and Stop spawning work on the whole battle). Game speed stays at 1×.</p>' : "") +
      (admin ? row(action("reset-cheats", "Switch every cheat off")) : "") +
      label("You") +
      row(
        action("heal", "Heal fully") +
        action("revive", "+1 Second Wind") +
        action("rerolls", "+10 rerolls")
      ) +
      label("Levels", "(currently " + R.p.level + ")") +
      row(
        action("levels", "+1 level", ' data-value="1"') +
        action("levels", "+5", ' data-value="5"') +
        action("levels", "+10", ' data-value="10"')
      ) +
      '<p class="hint">Press the ` key to open or close this panel.</p>'
    );
  }

  function upgradesTab(R) {
    var admin = PS.dev.admin;
    var choosing = Boolean(R.choices);
    var rows = B.UPGRADES.map(function (up) {
      var have = R.p.up[up.id] || 0;
      var full = have >= up.max;
      var name = typeof up.name === "function" ? up.name(have + 1, R) : up.name;
      var text = typeof up.text === "function" ? up.text(have + 1, R) : up.text;
      var search = (name + " " + text + " " + B.UP_TIERS[up.tier].name).toLowerCase();
      var hide = (tierFilter >= 0 && up.tier !== tierFilter) || (filterText && search.indexOf(filterText) === -1);
      return (
        '<li class="devup' + (full ? " is-full" : "") + '" style="--tier:' + B.UP_TIERS[up.tier].color + '" data-search="' + PS.esc(search) + '" data-tier="' + up.tier + '"' + (hide ? " hidden" : "") + ">" +
          '<span class="devup__icon">' + PS.icon(up.icon) + "</span>" +
          '<span class="devup__body"><b>' + PS.esc(name) + ' <em>' + have + "/" + up.max + "</em></b><small>" + PS.esc(text) + "</small></span>" +
          '<button class="btn btn--sm" type="button" data-dev="up" data-id="' + up.id + '"' + (full ? " disabled" : "") + ">" + (choosing ? "Pick" : "+1") + "</button>" +
          '<button class="btn btn--sm" type="button" data-dev="up-max" data-id="' + up.id + '"' + (full ? " disabled" : "") + ">Max</button>" +
        "</li>"
      );
    }).join("");
    var chips = [-1].concat(B.UP_TIERS.map(function (t, i) { return i; })).map(function (i) {
      return '<button class="btn btn--sm' + (tierFilter === i ? " btn--primary" : "") + '" type="button" data-dev="tier" data-value="' + i + '">' + (i < 0 ? "All" : B.UP_TIERS[i].name) + "</button>";
    }).join("");
    return (
      row(action("up-all", "Max every upgrade")) +
      (admin ? row(B.UP_TIERS.map(function (t, i) {
        return action("up-tier", "Max every " + t.name, ' data-value="' + i + '"');
      }).join("")) : "") +
      '<p class="hint">' + (choosing
        ? "Level-up cards are open: Pick takes that upgrade and counts as your choice. Max does not use up the level-up."
        : "Take any upgrade for free. Max every upgrade leaves out Glass Lemon, which makes you weaker.") + "</p>" +
      '<input class="devbox__search" id="devbox-filter" type="search" placeholder="Search upgrades" value="' + PS.esc(filterText) + '" autocomplete="off" aria-label="Search upgrades" />' +
      row(chips) +
      '<ul class="devbox__ups">' + rows + "</ul>"
    );
  }

  function playerTab(R) {
    var p = R.p;
    var weapons = PS.ITEM_ORDER.filter(function (id) { return B.WEAPONS[id]; }).map(function (id) {
      return '<option value="' + id + '"' + (id === R.weaponId ? " selected" : "") + ">" + PS.esc(weaponName(id)) + "</option>";
    }).join("");
    return (
      label("Health", PS.fmt(Math.ceil(p.hp)) + " / " + PS.fmt(Math.round(p.maxHp))) +
      row(
        action("heal", "Heal fully") +
        action("hp-half", "Half health") +
        action("hp-one", "1 HP") +
        action("shield", "Refill shield") +
        action("invuln", "Untouchable for 10 s") +
        action("revive", "+1 Second Wind")
      ) +
      label("Max health") +
      row(
        action("maxhp", "×1.5", ' data-value="1.5"') +
        action("maxhp", "×2", ' data-value="2"') +
        action("maxhp", "×5", ' data-value="5"')
      ) +
      label("Boost your stats", "(this battle only)") +
      row(BOOSTS.map(function (b) { return action("boost", b.label, ' data-id="' + b.id + '"'); }).join("")) +
      label("Levels", "(currently " + p.level + ")") +
      '<p class="hint">Auto-levelling takes a random upgrade for every level, with no cards to pick.</p>' +
      row(
        action("autolevel", "+5", ' data-value="5"') +
        action("autolevel", "+10", ' data-value="10"') +
        action("autolevel", "+25", ' data-value="25"') +
        action("autolevel", "+50", ' data-value="50"')
      ) +
      numberRow("devbox-level", "Level up to", p.level + 10, p.level + 1, 200, "set-level", "Go") +
      label("Experience") +
      row(
        action("xp", "+100", ' data-value="100"') +
        action("xp", "+1,000", ' data-value="1000"') +
        action("xp", "+10,000", ' data-value="10000"')
      ) +
      label("Weapon") +
      '<div class="devbox__field"><label>Swap to<select id="devbox-weapon">' + weapons + "</select></label>" + action("weapon-swap", "Swap") + "</div>" +
      '<p class="hint">Gear perks that belong to your own weapon stop applying once you swap.</p>' +
      label("Build presets") +
      row(
        action("preset-max", "Everything maxed") +
        action("preset-tank", "Tank") +
        action("preset-glass", "Glass cannon")
      ) +
      label("Position") +
      row(action("centre", "Back to the centre"))
    );
  }

  function spawnTab(R) {
    var kinds = Object.keys(B.KINDS).map(function (k) {
      return '<button class="btn btn--sm' + (spawn.kind === k ? " btn--primary" : "") + '" type="button" data-dev="pick-kind" data-value="' + k + '">' + KIND_NAMES[k] + "</button>";
    }).join("");
    var boss = R.boss && !R.boss.dead;
    return (
      label("Pest") + row(kinds) +
      '<div class="devbox__toggles">' +
        '<button class="devbox__toggle' + (spawn.elite ? " is-on" : "") + '" type="button" data-dev="spawn-elite" aria-pressed="' + spawn.elite + '"><b>Elite</b><span>Bigger, tougher, drops more</span><i>' + (spawn.elite ? "ON" : "OFF") + "</i></button>" +
        '<button class="devbox__toggle' + (spawn.near ? " is-on" : "") + '" type="button" data-dev="spawn-near" aria-pressed="' + spawn.near + '"><b>Close by</b><span>Appear around you, not at the screen edge</span><i>' + (spawn.near ? "ON" : "OFF") + "</i></button>" +
      "</div>" +
      label("Spawn", KIND_NAMES[spawn.kind] + (spawn.elite ? " (elite)" : "") + " · " + R.enemies.length + " pests out now") +
      row(
        action("spawn", "×1", ' data-value="1"') +
        action("spawn", "×10", ' data-value="10"') +
        action("spawn", "×50", ' data-value="50"') +
        action("spawn", "×200", ' data-value="200"')
      ) +
      label("Bosses and dummies") +
      row(
        action("boss-spawn", "Call the boss now", R.phase === "swarm" ? "" : " disabled") +
        action("dummy", "Training dummy")
      ) +
      '<p class="hint">The dummy never moves or attacks and has a billion health. Watch the damage meter to read your build\'s damage per second.</p>' +
      label("Do this to every pest", "(bosses shrug off pushes and stuns)") +
      row(
        action("fx-burn", "Set alight") +
        action("fx-chill", "Chill") +
        action("fx-shock", "Shock") +
        action("fx-stun", "Stun 5 s") +
        action("fx-push", "Push away") +
        action("fx-pull", "Pull in") +
        action("fx-halve", "Halve health") +
        action("fx-heal", "Heal to full")
      ) +
      label("Clear") +
      row(
        action("kill-all", "Kill every pest (with loot)") +
        action("remove-pests", "Remove every pest") +
        action("clear-shots", "Clear enemy shots") +
        action("boss-dead", "Kill the boss", boss ? "" : " disabled")
      ) +
      label("Pickups", "(" + R.drops.length + " on the ground)") +
      row(
        action("drop-xp", "20 XP gems") +
        action("drop-coin", "20 coins") +
        action("drop-heal", "Heal pickup") +
        action("drop-magnet", "Magnet") +
        action("vacuum", "Collect everything")
      )
    );
  }

  function runTab(R) {
    var admin = PS.dev.admin;
    var duel = Boolean(R.duel);
    var normal = R.mode !== "swarm" && !duel;
    var boss = R.boss && !R.boss.dead;
    var out =
      row(
        action("kill-all", "Kill every pest") +
        action("coins", "+100 coins") +
        (normal && R.phase === "swarm" ? action("boss", "Skip to the boss") : "")
      ) +
      // a duel is won in the ring
      (duel ? "" : row(
        action("win", "Win this battle") +
        action("lose", R.mirror ? "Leave this battle" : "End as a loss")
      ));
    if (admin && duel) {
      out += '<p class="hint">A duel has no clock or boss. Cheats, upgrades, pests and pickups are all in the other tabs.</p>';
    } else if (admin) {
      out +=
        label("Clock") +
        row(
          action("time", "+30 s", ' data-value="30"') +
          action("time", "+60 s", ' data-value="60"') +
          action("time", "+120 s", ' data-value="120"') +
          action("coins", "+1,000 coins", ' data-value="1000"')
        ) +
        label(liveBosses(R).length > 1 ? "Bosses" : "Boss", boss ? liveBosses(R).map(function (b) { return PS.esc(b.name) + " · " + pct(b.hp / b.maxHp); }).join(", ") : "not here") +
        row(
          action("boss-hp", "Down to 50%", ' data-value="0.5"', boss ? "" : " disabled") +
          action("boss-hp", "Down to 10%", ' data-value="0.1"', boss ? "" : " disabled") +
          action("boss-hp", "Down to 1%", ' data-value="0.01"', boss ? "" : " disabled") +
          action("boss-hp", "Heal fully", ' data-value="1"', boss ? "" : " disabled") +
          action("boss-spawn", "Call the boss now", R.phase === "swarm" ? "" : " disabled") +
          action("boss-dead", "Kill the boss", boss ? "" : " disabled")
        ) +
        (R.mp ? "" :
          label("Start over") +
          row(action("restart", "Restart this battle")) +
          numberRow("devbox-chapter", "Restart on chapter", R.ch.n, 1, PS.BAL.CHAPTERS, "restart-at", "Start") +
          '<p class="hint">Restarting throws this run away. It is saved only if you win the new one.</p>');
    }
    return (
      out +
      '<p class="hint">' + (duel ? "Arena duel · round " + R.duel.round : "Chapter " + R.ch.n + " · " + PS.esc(R.ch.name)) + " · " + PS.clock(R.t) + " · " + R.kills + " kills" +
        (R.mode === "swarm" ? " · swarm mode" : "") + "</p>"
    );
  }

  function statsTab(R) {
    var p = R.p;
    var cheats = PS.dev.cheats;
    var seconds = Math.max(1, R.t);
    var elites = R.enemies.filter(function (e) { return !e.dead && e.elite; }).length;
    var alive = R.enemies.filter(function (e) { return !e.dead; }).length;
    var ups = (p.order || []).map(function (id) {
      var up = B.upgrade(id);
      var name = typeof up.name === "function" ? up.name(p.up[id], R) : up.name;
      return PS.esc(name) + " " + p.up[id] + (up.max === Infinity ? "" : "/" + up.max);
    });
    var pets = (R.pets || []).map(function (pet) { return PS.PET[pet.sp].name + " Lv " + pet.lv; });
    var changed = [];
    PS.dev.TOGGLES.forEach(function (t) { if (cheats[t.key]) changed.push(t.label); });
    PS.dev.MULTS.forEach(function (m) { if (cheats[m.key] !== 1) changed.push(m.label + " " + cheats[m.key] + "×"); });
    return (
      label("You") +
      facts([
        ["Weapon", PS.esc(weaponName(R.weaponId))],
        ["Damage per hit", PS.fmt(B.dmg())],
        ["Attacks a second", (1 / B.cooldown(R.weapon.cd)).toFixed(2)],
        ["Crit chance", pct(Math.min(1, p.crit + p.mods.crit))],
        ["Crit damage", "×" + (p.critDmg + p.mods.critDmg).toFixed(2)],
        ["Attack size", "×" + B.area().toFixed(2)],
        ["Extra shots · pierce", B.count() + " · " + B.pierce()],
        ["Move speed", Math.round(p.moveSpeed * p.mods.speed * cheats.moveMul)],
        ["Health", PS.fmt(Math.ceil(p.hp)) + " / " + PS.fmt(Math.round(p.maxHp))],
        ["Shield", PS.fmt(Math.round(p.barrier)) + " / " + PS.fmt(Math.round(p.barrierMax))],
        ["Damage taken", pct((1 - p.armor) * p.mods.armor)],
        ["Regen", pct(p.regen + p.mods.regen) + " a second"],
        ["Pickup reach", Math.round(p.reach)],
        ["XP gained", "×" + p.xpMul.toFixed(2)],
        ["Luck", p.luck.toFixed(2)],
        ["Level", p.level + " · " + PS.fmt(p.xp) + " / " + PS.fmt(p.need) + " XP"],
        ["Second Winds · rerolls", p.revives + " · " + p.rerolls]
      ]) +
      label("This battle") +
      facts([
        ["Chapter", R.ch.n + " · " + PS.esc(R.ch.name) + (R.mode === "swarm" ? " (swarm)" : "")],
        ["Phase", R.phase],
        ["Time", PS.clock(R.t) + (R.mode === "swarm" ? "" : " of " + PS.clock(R.dur))],
        ["Pests alive · elites", alive + " · " + elites],
        ["Squashed", PS.fmt(R.kills)],
        ["Damage dealt", PS.fmt(R.dealt) + " · " + PS.fmt(R.dealt / seconds) + " a second"],
        ["Coins", PS.fmt(R.coins)],
        ["On the ground", R.drops.length],
        ["Your shots · pest shots", R.shots.length + " · " + R.ebullets.length],
        ["Zones · effects", R.zones.length + " · " + R.fx.length]
      ]) +
      label("Taken so far", "(" + ups.length + ")") +
      '<p class="hint">' + (ups.length ? ups.join(" · ") : "Nothing yet.") + "</p>" +
      label("Pets") +
      '<p class="hint">' + (pets.length ? PS.esc(pets.join(" · ")) : "No pet along.") + "</p>" +
      label("Cheats on") +
      '<p class="hint">' + (changed.length ? PS.esc(changed.join(" · ")) : "None.") + "</p>"
    );
  }

  /* ---------------------------------------------------------------- render */

  function render() {
    var R = run();
    if (!el || !R) return;
    var list = tabs();
    if (!list.some(function (t) { return t[0] === tab; })) tab = "cheats";
    var views = { cheats: cheatsTab, upgrades: upgradesTab, run: runTab, player: playerTab, spawn: spawnTab, stats: statsTab };
    var body = views[tab](R);
    var scroll = el.querySelector(".devbox__body");
    var top = scroll ? scroll.scrollTop : 0;
    var shared = "";
    if (R.mirror) {
      var host = PS.esc((R.partner && R.partner.name) || "The room maker");
      var ok = R.mp ? R.mp.devOk : null;
      shared = ok === true
        ? host + "'s game runs this battle: what you press here is sent to it and done on your lemon. The battle keeps going while this is open."
        : ok === false
          ? host + "'s game could not confirm that you are on an admin account, so nothing here works in this battle. (It needs the newer setup.sql.)"
          : "Checking your admin account with " + host + "'s game...";
    } else if (R.mp) {
      shared = "Playing together: the battle keeps going while this is open, and cheats work on your lemon only.";
    }
    el.innerHTML =
      '<div class="panel devbox">' +
        '<div class="devbox__head"><h2>' + (PS.dev.admin ? "Admin menu" : "Dev menu") + "</h2>" +
          '<button class="btn btn--primary btn--sm" type="button" data-dev="close">Back to the battle</button></div>' +
        (shared ? '<p class="hint devbox__shared">' + shared + "</p>" : "") +
        '<div class="devbox__tabs" role="tablist">' + list.map(function (t) {
          return '<button class="devbox__tab' + (tab === t[0] ? " is-active" : "") + '" type="button" role="tab" aria-selected="' + (tab === t[0]) + '" data-dev="tab" data-value="' + t[0] + '">' + t[1] + "</button>";
        }).join("") + "</div>" +
        (note ? '<p class="devbox__note" role="status">' + PS.esc(note) + "</p>" : "") +
        '<div class="devbox__body">' + body + "</div>" +
      "</div>";
    el.querySelector(".devbox__body").scrollTop = top;
  }

  /* --------------------------------------------------------------- actions */

  function takeUpgrade(id, toMax) {
    var R = run();
    var up = B.upgrade(id);
    if (!up) return;
    var have = R.p.up[id] || 0;
    var times = toMax ? up.max - have : 1;
    for (var i = 0; i < times && (R.p.up[id] || 0) < up.max; i++) B.takeUpgrade({ id: id });
    if (toMax) return;
    // with the cards up, Pick counts as the choice (the other player's cards, for their lemon)
    if (R.ally && R.p === R.ally) B.devResolveAlly();
    else B.devResolve();
  }

  /** Max every upgrade that is allowed (and, when `tier` is given, only that tier). */
  function maxUpgrades(R, tier) {
    var count = 0;
    B.UPGRADES.forEach(function (up) {
      if (up.id === "glass" || (up.needs && !up.needs(R))) return;
      if (tier !== undefined && up.tier !== tier) return;
      if ((R.p.up[up.id] || 0) >= up.max) return;
      takeUpgrade(up.id, true);
      count++;
    });
    return count;
  }

  /** Levels gained at once: a random upgrade for each, no cards. */
  function autoLevels(R, n) {
    var p = R.p;
    for (var i = 0; i < n; i++) {
      p.level++;
      p.need = B.xpNeeded(p.level);
      if (p.fx.levelAtk) {
        p.lvlAtk += p.fx.levelAtk;
        B.heal(p.maxHp * 0.1);
      }
      B.takeUpgrade(B.rollChoices()[0]);
    }
  }

  /* the lobby's "start the next battle with" card: called from B.start */
  B.devStartBuild = function (build) {
    var R = run();
    if (!R || !build) return;
    if (build.maxAll) maxUpgrades(R);
    if (build.levels > 0) autoLevels(R, Math.min(200, Math.round(build.levels)));
  };

  /** Every boss still standing (late chapters have two). */
  function liveBosses(R) {
    return (R.bosses || (R.boss ? [R.boss] : [])).filter(function (b) { return !b.dead; });
  }

  function eachPest(R, fn) {
    var count = 0;
    R.enemies.forEach(function (e) {
      if (e.dead || e.proxyOf) return; // a duel's lemons are not pests
      fn(e);
      count++;
    });
    return count;
  }

  function spawnPest(R, kind, angle, near, plain) {
    var dist = near ? PS.rand(90, 170) : B.view.ring;
    var e = B.spawn(kind, R.p.x + Math.cos(angle) * dist, R.p.y + Math.sin(angle) * dist);
    if (spawn.elite && !plain) B.eliteUp(e);
    return e;
  }

  function dropNearYou(R, type, count, value) {
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * TAU;
      B.drop(type, R.p.x + Math.cos(angle) * 50, R.p.y + Math.sin(angle) * 50, value);
      R.drops[R.drops.length - 1].pull = true; // straight to you
    }
  }

  function barrierToMax(p) {
    p.barrierMax = p.maxHp * (p.fx.barrier || 0);
    p.barrier = Math.min(p.barrier, p.barrierMax);
  }

  function resetCheats() {
    PS.dev.TOGGLES.forEach(function (t) { PS.dev.cheats[t.key] = false; });
    PS.dev.MULTS.forEach(function (m) { PS.dev.cheats[m.key] = 1; });
  }

  function chapterInput(id) {
    return PS.clamp(Math.round(Number(field(id)) || 1), 1, PS.BAL.CHAPTERS);
  }

  var ACTIONS = {
    close: function () { B.devPanel.close(); },
    tab: function (R, node) {
      tab = node.getAttribute("data-value");
      note = "";
    },
    toggle: function (R, node) {
      var key = node.getAttribute("data-key");
      PS.dev.cheats[key] = !PS.dev.cheats[key];
    },
    mult: function (R, node) { PS.dev.cheats[node.getAttribute("data-key")] = Number(node.getAttribute("data-value")); },
    "reset-cheats": function () {
      resetCheats();
      return "Every cheat is off";
    },
    tier: function (R, node) { tierFilter = Number(node.getAttribute("data-value")); },

    /* you */
    heal: function (R) {
      R.p.hp = R.p.maxHp;
      R.p.barrier = R.p.barrierMax;
      return "Healed";
    },
    "hp-half": function (R) {
      R.p.hp = R.p.maxHp * 0.5;
      return "Down to half health";
    },
    "hp-one": function (R) {
      R.p.hp = 1;
      return "Down to 1 HP";
    },
    shield: function (R) {
      R.p.barrier = R.p.barrierMax;
      return R.p.barrierMax ? "Shield refilled" : "No gear gives you a shield";
    },
    invuln: function (R) {
      R.p.invuln = Math.max(R.p.invuln, 10);
      return "Untouchable for 10 seconds of battle time";
    },
    revive: function (R) {
      R.p.revives += 1;
      return "Second Winds: " + R.p.revives;
    },
    rerolls: function (R) {
      R.p.rerolls += 10;
      return "Rerolls: " + R.p.rerolls;
    },
    maxhp: function (R, node) {
      var p = R.p;
      var k = Number(node.getAttribute("data-value"));
      p.maxHp *= k;
      p.hp = Math.min(p.maxHp, p.hp * k);
      barrierToMax(p);
      return "Max health " + PS.fmt(Math.round(p.maxHp));
    },
    boost: function (R, node) {
      var id = node.getAttribute("data-id");
      var boost = BOOSTS.filter(function (b) { return b.id === id; })[0];
      if (!boost) return;
      boost.take(R.p);
      return boost.label;
    },
    levels: function (R, node) {
      // enough experience for N levels in a row; the cards come up once the panel is closed
      var p = R.p;
      var n = Number(node.getAttribute("data-value"));
      var need = p.need - p.xp;
      for (var k = 1; k < n; k++) need += B.xpNeeded(p.level + k);
      p.xp += need;
      return n + " level" + (n === 1 ? "" : "s") + " of experience: the cards come up when you go back";
    },
    autolevel: function (R, node) {
      var n = Number(node.getAttribute("data-value"));
      autoLevels(R, n);
      return "Level " + R.p.level;
    },
    "set-level": function (R) {
      var target = Math.min(200, Math.round(Number(field("devbox-level")) || 0));
      if (target <= R.p.level) return "Pick a level above " + R.p.level;
      autoLevels(R, target - R.p.level);
      return "Level " + R.p.level;
    },
    xp: function (R, node) {
      var n = Number(node.getAttribute("data-value"));
      R.p.xp += n;
      return "+" + PS.fmt(n) + " XP: any level-ups come up when you go back";
    },
    "weapon-swap": function (R) {
      var id = field("devbox-weapon");
      if (!B.WEAPONS[id]) return;
      if (id === R.weaponId) return "Already holding the " + weaponName(id);
      R.weaponId = id;
      R.weapon = B.WEAPONS[id];
      // each lemon keeps its own weapon (playing together, the battle swaps them round)
      R.p.weaponId = id;
      R.p.weapon = R.weapon;
      R.src = id;
      R.p.cd = 0.2;
      return "Now holding the " + weaponName(id);
    },
    centre: function (R) {
      R.p.x = 0;
      R.p.y = 0;
      return "Back at the centre";
    },
    "preset-max": function (R) {
      var n = maxUpgrades(R);
      R.p.hp = R.p.maxHp;
      R.p.barrier = R.p.barrierMax;
      return n ? "Maxed " + n + " upgrades" : "Everything was already maxed";
    },
    "preset-tank": function (R) {
      var p = R.p;
      p.maxHp *= 3;
      p.hp = p.maxHp;
      barrierToMax(p);
      p.barrier = p.barrierMax;
      p.mods.armor *= 0.5;
      p.mods.regen += 0.02;
      return "Tank: triple health, half damage taken, regeneration";
    },
    "preset-glass": function (R) {
      var p = R.p;
      p.mods.dmg += 4;
      p.mods.haste += 1;
      p.mods.crit += 0.5;
      p.maxHp = Math.max(10, p.maxHp * 0.25);
      p.hp = Math.min(p.hp, p.maxHp);
      barrierToMax(p);
      return "Glass cannon: five times the damage, a quarter of the health";
    },

    /* upgrades */
    up: function (R, node) { takeUpgrade(node.getAttribute("data-id"), false); },
    "up-max": function (R, node) { takeUpgrade(node.getAttribute("data-id"), true); },
    "up-all": function (R) {
      var n = maxUpgrades(R);
      return n ? "Maxed " + n + " upgrades" : "Everything was already maxed";
    },
    "up-tier": function (R, node) {
      var tier = Number(node.getAttribute("data-value"));
      var n = maxUpgrades(R, tier);
      return n ? "Maxed " + n + " " + B.UP_TIERS[tier].name + " upgrades" : "No " + B.UP_TIERS[tier].name + " upgrades left to max";
    },

    /* spawn */
    "pick-kind": function (R, node) { spawn.kind = node.getAttribute("data-value"); },
    "spawn-elite": function () { spawn.elite = !spawn.elite; },
    "spawn-near": function () { spawn.near = !spawn.near; },
    spawn: function (R, node) {
      var n = Number(node.getAttribute("data-value"));
      var made = 0;
      var base = Math.random() * TAU;
      for (var i = 0; i < n && R.enemies.length < 600; i++) {
        // a few land in a clump, a crowd closes in all the way round
        var angle = n <= 10 ? base + PS.rand(-0.6, 0.6) : base + (i / n) * TAU;
        spawnPest(R, spawn.kind, angle, spawn.near);
        made++;
      }
      return made < n ? "Spawned " + made + " (600 pests is the limit)" : "Spawned " + made + " " + KIND_NAMES[spawn.kind] + (made === 1 ? "" : "s");
    },
    "boss-spawn": function (R) {
      if (R.phase !== "swarm") return "The boss is already here, or the battle is over";
      B.startBoss();
      return "The boss has arrived";
    },
    dummy: function (R) {
      var e = spawnPest(R, "brute", Math.random() * TAU, true, true);
      e.hp = e.maxHp = 1e9;
      e.speed = 0;
      e.hurt = 0;
      e.mass = 1e6;
      e.xp = 0;
      e.fill = "#C9BEA6";
      return "A training dummy stands near you";
    },
    "fx-burn": function (R) {
      var dps = B.dmg() * 0.5;
      var n = eachPest(R, function (e) {
        e.burnT = 6;
        e.burnDps = Math.max(e.burnDps, dps);
      });
      return n + " pests are burning";
    },
    "fx-chill": function (R) {
      var n = eachPest(R, function (e) {
        e.chillT = 6;
        e.chillAmt = e.boss ? 0.35 : 0.7;
      });
      return n + " pests are chilled";
    },
    "fx-shock": function (R) {
      var n = eachPest(R, function (e) {
        e.shockT = 8;
        e.shockAmp = 0.5;
      });
      return n + " pests take 50% more damage for a while";
    },
    "fx-stun": function (R) {
      var n = 0;
      eachPest(R, function (e) {
        if (e.boss) return;
        e.stun = Math.max(e.stun, 5);
        n++;
      });
      return n + " pests are stunned";
    },
    "fx-push": function (R) {
      var p = R.p;
      var n = 0;
      eachPest(R, function (e) {
        if (e.boss) return;
        var dx = e.x - p.x;
        var dy = e.y - p.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        e.kx += (dx / d) * 900 / e.mass;
        e.ky += (dy / d) * 900 / e.mass;
        n++;
      });
      return n + " pests pushed away";
    },
    "fx-pull": function (R) {
      var p = R.p;
      var n = 0;
      eachPest(R, function (e) {
        if (e.boss) return;
        e.x = p.x + (e.x - p.x) * 0.25;
        e.y = p.y + (e.y - p.y) * 0.25;
        n++;
      });
      return n + " pests pulled in";
    },
    "fx-halve": function (R) {
      var n = eachPest(R, function (e) { e.hp = Math.max(1, e.hp / 2); });
      return n + " pests at half health";
    },
    "fx-heal": function (R) {
      var n = eachPest(R, function (e) { e.hp = e.maxHp; });
      return n + " pests healed";
    },
    "kill-all": function (R) {
      var n = 0;
      R.enemies.slice().forEach(function (e) {
        if (!e.dead && !e.boss && !e.proxyOf) {
          B.hit(e, e.hp + 1, { dot: true });
          n++;
        }
      });
      return n + " pests squashed";
    },
    "remove-pests": function (R) {
      var n = 0;
      R.enemies.forEach(function (e) {
        if (!e.dead && !e.boss && !e.proxyOf) {
          e.dead = true;
          n++;
        }
      });
      return n + " pests removed, no loot";
    },
    "clear-shots": function (R) {
      var n = R.ebullets.length;
      R.ebullets.length = 0;
      return n + " enemy shots cleared";
    },
    "drop-xp": function (R) {
      dropNearYou(R, "xp", 20, R.p.need * 0.05);
      return "20 XP gems: about one level";
    },
    "drop-coin": function (R) {
      dropNearYou(R, "coin", 20, R.coinValue);
      return "20 coins";
    },
    "drop-heal": function (R) {
      dropNearYou(R, "heal", 1, 0.25);
      return "A heal pickup (25%)";
    },
    "drop-magnet": function (R) {
      dropNearYou(R, "magnet", 1, 0);
      return "A magnet pickup";
    },
    vacuum: function (R) {
      R.drops.forEach(function (d) { d.pull = true; });
      return "Everything on the ground is on its way";
    },

    /* the run */
    coins: function (R, node) {
      var n = Number(node.getAttribute("data-value")) || 100;
      R.coins += R.coinValue * n;
      return "+" + PS.fmt(n) + " coins";
    },
    boss: function (R) { R.t = R.dur; },
    time: function (R, node) {
      if (R.phase !== "swarm") return "The clock only moves before the boss";
      var n = Number(node.getAttribute("data-value"));
      R.t = R.mode === "swarm" ? R.t + n : Math.min(R.t + n, R.dur);
      return "Clock at " + PS.clock(R.t);
    },
    "boss-hp": function (R, node) {
      var all = liveBosses(R);
      if (!all.length) return;
      var f = Number(node.getAttribute("data-value"));
      all.forEach(function (b) { b.hp = f >= 1 ? b.maxHp : Math.min(b.hp, b.maxHp * f); });
      var who = all.length > 1 ? "Both bosses are" : "The boss is";
      return f >= 1 ? who + " back to full health" : who + " down to " + pct(f);
    },
    "boss-dead": function (R) {
      // every boss on the field, so the chapter is won
      liveBosses(R).forEach(function (b) { if (!b.dead) B.hit(b, b.hp + 1, { dot: true }); });
    },
    restart: function (R) {
      var chapter = R.ch.n;
      var mode = R.mode === "swarm" ? "swarm" : undefined;
      B.devPanel.close();
      B.start(chapter, mode);
    },
    "restart-at": function () {
      var chapter = chapterInput("devbox-chapter");
      B.devPanel.close();
      B.start(chapter);
    },
    win: function () {
      B.devPanel.close();
      B.win();
    },
    lose: function () {
      B.devPanel.close();
      B.giveUp();
    }
  };

  /** What a button says about itself, for sending to the room maker's game. */
  function attrsOf(node) {
    var out = {};
    ["value", "key", "id"].forEach(function (k) {
      var v = node && node.getAttribute ? node.getAttribute("data-" + k) : null;
      if (v !== null) out[k] = String(v).slice(0, 40);
    });
    return out;
  }

  /** The other player's game: send the press to the room maker's game, which runs the battle. */
  function sendOn(R, name, node) {
    if (R.mp.devOk === false) return "Not confirmed as an admin account, so this did nothing.";
    if (R.mp.devOk !== true) return "Still checking your admin account. Try again in a moment.";
    if (SWITCHES[name]) {
      ACTIONS[name](R, node); // this panel shows the switches as they now are
      B.mpDevSend("devcheats", { cheats: PS.dev.cheats });
      return name === "reset-cheats" ? "Every cheat is off" : "";
    }
    B.mpDevSend("dev", {
      name: name,
      attrs: attrsOf(node),
      inputs: { "devbox-level": field("devbox-level"), "devbox-weapon": field("devbox-weapon") },
      spawn: { kind: spawn.kind, elite: spawn.elite, near: spawn.near }
    });
    return "Sent to " + ((R.partner && R.partner.name) || "the room maker") + "'s game...";
  }

  /** A press from this panel: here, or (the other player's game) passed on. */
  function press(name, node) {
    var R = run();
    var fn = ACTIONS[name];
    if (!fn || !R) return;
    var said;
    if (PANEL_ONLY[name] || (R.mirror && name === "lose")) said = fn(R, node);
    else if (R.mirror) said = sendOn(R, name, node);
    else if (R.mp && NOT_SHARED[name] && name !== "lose") said = "Not while playing together";
    else if (R.players) said = B.ownAs(R.players[0], function () { return fn(R, node); }); // this game's own lemon
    else said = fn(R, node);
    if (typeof said === "string" && said) note = said;
    if (run() && run().devOpen) render();
  }

  function onClick(e) {
    var node = e.target.closest("[data-dev]");
    if (!node || node.disabled || !run()) return;
    PS.sfx.play("click");
    press(node.getAttribute("data-dev"), node);
  }

  /* Enter in a number box does what its button does */
  function onKey(e) {
    if (e.key !== "Enter" || !run()) return;
    var name = e.target && e.target.getAttribute ? e.target.getAttribute("data-enter") : null;
    if (name && ACTIONS[name]) press(name, e.target);
  }

  /** A button the other player pressed, done on their lemon (q) in this game, which runs the battle. */
  function runFor(q, m) {
    var R = run();
    var name = m && typeof m.name === "string" ? m.name : "";
    var fn = ACTIONS[name];
    if (!R || !fn || PANEL_ONLY[name] || SWITCHES[name] || NOT_SHARED[name]) return "";
    if (R.duel && (name === "win" || name === "boss" || name === "time")) return "Not in a duel";
    var attrs = m.attrs && typeof m.attrs === "object" ? m.attrs : {};
    var node = {
      getAttribute: function (k) {
        var v = attrs[String(k).replace(/^data-/, "")];
        return v === undefined || v === null ? null : String(v).slice(0, 40);
      }
    };
    var theirs = m.spawn && typeof m.spawn === "object" ? m.spawn : {};
    var mine = spawn;
    spawn = { kind: B.KINDS[theirs.kind] ? theirs.kind : "grunt", elite: theirs.elite === true, near: theirs.near === true };
    inputs = m.inputs && typeof m.inputs === "object" ? m.inputs : {};
    var said;
    try {
      said = B.ownAs(q, function () { return fn(R, node); });
    } finally {
      spawn = mine;
      inputs = null;
    }
    B.hud.build(R); // taking an upgrade as that lemon drew its chips; put this game's back
    return typeof said === "string" && said ? said : "Done";
  }

  /* the search box filters the list in place, so typing never loses its focus */
  function onInput(e) {
    if (!e.target || e.target.id !== "devbox-filter") return;
    filterText = e.target.value.trim().toLowerCase();
    var items = el.querySelectorAll(".devup");
    for (var i = 0; i < items.length; i++) {
      var tier = Number(items[i].getAttribute("data-tier"));
      var show = (tierFilter < 0 || tier === tierFilter) && (!filterText || items[i].getAttribute("data-search").indexOf(filterText) !== -1);
      items[i].hidden = !show;
    }
  }

  B.devPanel = {
    mount: function (root) {
      el = document.createElement("div");
      el.className = "sheet devsheet";
      el.hidden = true;
      root.appendChild(el);
      el.addEventListener("click", onClick);
      el.addEventListener("keydown", onKey);
      el.addEventListener("input", onInput);
    },
    open: function () {
      var R = run();
      if (!R || R.done || !PS.dev.unlocked) return;
      R.devOpen = true;
      note = "";
      el.hidden = false;
      render();
    },
    close: function () {
      var R = run();
      if (R) R.devOpen = false;
      if (el) el.hidden = true;
    },
    runFor: runFor,
    /** Redraw if open (the room maker's game has answered, say). */
    refresh: function () {
      var R = run();
      if (R && R.devOpen) render();
    },
    /** Show what the room maker's game did with a press. */
    say: function (text) {
      note = text;
      var R = run();
      if (R && R.devOpen) render();
    }
  };

  /* a finished or abandoned battle must not leave the panel hanging around */
  PS.on("battle:end", function () { B.devPanel.close(); });
})();
