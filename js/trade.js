/*!
 * Pip Survivors — trading
 * The Trade window: one player makes a trade code, the other types it in,
 * and both put in gear, pets, gold or gems. The server holds both offers
 * (supabase/setup.sql has the rules): changing an offer takes back both
 * acceptances, once both have accepted the trade locks so nothing can
 * change, and three seconds later it goes through. Each game then takes away
 * what it gave and adds what it got, once (the save remembers which trades
 * it has done, so a trade can never be added twice).
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function () {
  "use strict";

  var PS = window.PS;
  var esc = PS.esc;

  var POLL = 1000; // how often the open window asks the server how the trade stands
  var LOCK_MS = 3000; // from both accepting to the trade going through (as in setup.sql)
  var MAX_ITEMS = 20; // as in setup.sql
  var MAX_PETS = 6;
  var PAGE = 60; // bag items drawn at once in the picker

  var box = null;
  var view = {
    screen: "home", // home | waiting | trade | done | over
    t: null, // the trade as the server last said it stands
    draft: null, // what this player gives, as shown here (it can be a step ahead of the server)
    sending: false, // an offer is on its way to the server
    dirty: false, // and another change was made meanwhile
    busy: false,
    error: "",
    netError: false, // the error is only the connection, and goes once the server answers again
    code: "",
    skew: 0, // the server's clock minus this one
    changed: 0, // when the other player's offer last changed
    theirText: "",
    pick: "all", // which part of the bag the picker shows: "all", a slot, or "pets"
    shown: PAGE,
    result: null, // { t, out } once a trade has gone through
    sig: ""
  };
  var pollTimer = 0;
  var countTimer = 0;
  var asking = false;

  function S() {
    return PS.state.get();
  }

  function live() {
    var t = view.t;
    return Boolean(t && (t.status === "waiting" || t.status === "open" || t.status === "locked"));
  }

  function emptyOffer() {
    return { items: [], pets: [], gold: 0, gems: 0 };
  }

  function whole(v, max) {
    v = Math.floor(Number(v));
    return isFinite(v) && v > 0 ? Math.min(v, max) : 0;
  }

  /** An offer as the server sent it, with only what this game can use. */
  function cleanOffer(o) {
    o = o && typeof o === "object" ? o : {};
    return {
      items: (Array.isArray(o.items) ? o.items : []).filter(function (x) { return x && typeof x.id === "string"; }).slice(0, MAX_ITEMS).map(function (x) {
        return { id: x.id, r: whole(x.r, 20), u: whole(x.u, 1e12) };
      }),
      pets: (Array.isArray(o.pets) ? o.pets : []).filter(function (x) { return x && typeof x.sp === "string"; }).slice(0, MAX_PETS).map(function (x) {
        return { sp: x.sp, r: whole(x.r, 20), lv: Math.max(1, whole(x.lv, 1000)), u: whole(x.u, 1e12) };
      }),
      gold: whole(o.gold, 1e12),
      gems: whole(o.gems, 1e12)
    };
  }

  function isEmpty(o) {
    return !o || (!o.items.length && !o.pets.length && !o.gold && !o.gems);
  }

  /** Server times come with microseconds; Date.parse wants milliseconds at most. */
  function when(iso) {
    return Date.parse(String(iso || "").replace(/(\.\d{3})\d+/, "$1"));
  }

  /* --------------------------------------------------------- pieces */

  function itemName(x) {
    var def = PS.ITEMS[x.id];
    return def && PS.RARITY[x.r] ? PS.RARITY[x.r].name + " " + def.name : "An item this game doesn't know";
  }

  function petName(x) {
    var def = PS.PET[x.sp];
    // pets use the first rarities of the gear list: Common to Epic
    return def && PS.PET_RARITY[x.r] ? PS.RARITY[x.r].name + " " + def.name : "A pet this game doesn't know";
  }

  function itemTile(x) {
    if (!PS.ITEMS[x.id] || !PS.RARITY[x.r]) return '<span class="trade__unknown">?</span>';
    return PS.ui.tile({ id: x.id, r: x.r }, { plain: true });
  }

  function petTile(x) {
    if (!PS.PET[x.sp] || !PS.PET_RARITY[x.r]) return '<span class="trade__unknown">?</span>';
    return '<span class="trade__pet" style="--ring:' + PS.RARITY[x.r].color + '">' + PS.petArt(x.sp, x.r) + "<b>Lv " + x.lv + "</b></span>";
  }

  /** What getting this pet would do, for someone who may already have one like it. */
  function petNote(x) {
    var have = null;
    S().pets.forEach(function (pet) { if (pet.sp === x.sp && pet.r === x.r) have = pet; });
    if (!have) return "";
    return have.lv >= x.lv ? "You have one at Lv " + have.lv + ": no change" : "You have one: it goes up to Lv " + x.lv;
  }

  /** One side of the trade. `mine`: what this player gives (removable while the trade is open). */
  function offerHtml(o, mine, editable) {
    var cells = [];
    o.items.forEach(function (x, i) {
      var inner = itemTile(x) + "<small>" + esc(itemName(x)) + "</small>";
      cells.push(editable
        ? '<button class="trade__cell" type="button" data-tr="drop-item" data-i="' + i + '" title="Take out: ' + esc(itemName(x)) + '">' + inner + '<i aria-hidden="true">&times;</i></button>'
        : '<span class="trade__cell">' + inner + "</span>");
    });
    o.pets.forEach(function (x, i) {
      var note = mine ? "" : petNote(x);
      var inner = petTile(x) + "<small>" + esc(petName(x)) + (note ? "<em>" + esc(note) + "</em>" : "") + "</small>";
      cells.push(editable
        ? '<button class="trade__cell" type="button" data-tr="drop-pet" data-i="' + i + '" title="Take out: ' + esc(petName(x)) + '">' + inner + '<i aria-hidden="true">&times;</i></button>'
        : '<span class="trade__cell">' + inner + "</span>");
    });
    var money = "";
    if (editable) {
      money =
        '<div class="trade__money">' +
          '<label>' + PS.icon("coin") + '<input id="tr-gold" type="number" min="0" max="' + S().gold + '" step="1" value="' + o.gold + '" aria-label="Gold to give" /></label>' +
          '<label>' + PS.icon("gem") + '<input id="tr-gems" type="number" min="0" max="' + S().gems + '" step="1" value="' + o.gems + '" aria-label="Gems to give" /></label>' +
        "</div>";
    } else if (o.gold || o.gems) {
      money = '<div class="trade__money">' + (o.gold ? PS.ui.price("gold", o.gold) : "") + (o.gems ? PS.ui.price("gems", o.gems) : "") + "</div>";
    }
    return (
      '<div class="trade__offer">' + (cells.length ? cells.join("") : '<p class="trade__none">' + (mine ? "Nothing yet. Pick from your bag below." : "Nothing yet.") + "</p>") + "</div>" +
      money
    );
  }

  /** The player's own bag and pets, to add to the offer. Drawn a page at a time. */
  function pickerHtml(d) {
    var have = PS.state.tradeable();
    var inItems = {};
    var inPets = {};
    d.items.forEach(function (x) { inItems[x.u] = true; });
    d.pets.forEach(function (x) { inPets[x.u] = true; });
    var chips = [["all", "All gear"]].concat(PS.SLOTS.map(function (slot) { return [slot.key, slot.plural]; })).concat([["pets", "Pets"]]);
    var tabs = '<div class="filters trade__tabs" role="group" aria-label="Show">' + chips.map(function (c) {
      return '<button class="filter" type="button" data-tr="pick" data-v="' + c[0] + '" aria-pressed="' + (view.pick === c[0]) + '">' + esc(c[1]) + "</button>";
    }).join("") + "</div>";
    var cells;
    var total;
    if (view.pick === "pets") {
      var pets = have.pets.filter(function (pet) { return !inPets[pet.u]; });
      total = pets.length;
      cells = pets.slice(0, view.shown).map(function (pet) {
        return '<button class="trade__cell" type="button" data-tr="add-pet" data-u="' + pet.u + '"' + (d.pets.length >= MAX_PETS ? " disabled" : "") + ">" +
          petTile(pet) + "<small>" + esc(petName(pet)) + "</small></button>";
      });
    } else {
      var items = have.items.filter(function (item) {
        return !inItems[item.u] && (view.pick === "all" || PS.ITEMS[item.id].slot === view.pick);
      });
      total = items.length;
      cells = items.slice(0, view.shown).map(function (item) {
        return '<button class="trade__cell" type="button" data-tr="add-item" data-u="' + item.u + '"' + (d.items.length >= MAX_ITEMS ? " disabled" : "") + ">" +
          itemTile(item) + "<small>" + esc(itemName(item)) + "</small></button>";
      });
    }
    var more = total > cells.length ? '<button class="btn btn--sm trade__more" type="button" data-tr="more">Show more (' + PS.fmt(total - cells.length) + " left)</button>" : "";
    return (
      '<section class="trade__pick">' +
        "<h3>Add from your bag <small>(" + d.items.length + "/" + MAX_ITEMS + " items, " + d.pets.length + "/" + MAX_PETS + " pets · worn gear can't be traded)</small></h3>" +
        tabs +
        '<div class="trade__grid">' + (cells.length ? cells.join("") : '<p class="trade__none">Nothing ' + (view.pick === "pets" ? "here" : "to trade here") + ".</p>") + "</div>" +
        more +
      "</section>"
    );
  }

  function countdown() {
    var t = view.t;
    if (!t || t.status !== "locked") return 0;
    var left = when(t.locked_at) + LOCK_MS - (Date.now() + view.skew);
    return Math.max(0, left);
  }

  function reasonText(t) {
    var them = t.their_name || "Your friend";
    if (t.reason === t.side + "_left") return "You left the trade. Nothing changed hands.";
    if (/_left$/.test(t.reason)) return them + " left the trade. Nothing changed hands.";
    if (t.reason === "left") return t.their_name ? them + " seems to have closed the game, so the trade was called off." : "Nobody joined in time.";
    if (t.reason === "expired") return "Nobody joined in time.";
    if (t.reason === "replaced") return "You started another trade, so this one was called off.";
    return "The trade was called off. Nothing changed hands.";
  }

  function gotHtml(o, out) {
    var parts = [];
    o.items.forEach(function (x) {
      parts.push('<span class="trade__cell">' + itemTile(x) + "<small>" + esc(itemName(x)) + "</small></span>");
    });
    o.pets.forEach(function (x, i) {
      var how = out && out.pets[i] ? out.pets[i].status : "";
      var note = how === "level" ? "Yours went up to Lv " + out.pets[i].pet.lv : how === "same" ? "You had one as good: no change" : "";
      parts.push('<span class="trade__cell">' + petTile(x) + "<small>" + esc(petName(x)) + (note ? "<em>" + esc(note) + "</em>" : "") + "</small></span>");
    });
    if (o.gold) parts.push('<span class="trade__cell trade__cell--money">' + PS.ui.price("gold", o.gold) + "</span>");
    if (o.gems) parts.push('<span class="trade__cell trade__cell--money">' + PS.ui.price("gems", o.gems) + "</span>");
    return parts.length ? '<div class="trade__offer">' + parts.join("") + "</div>" : '<p class="trade__none">Nothing.</p>';
  }

  /* --------------------------------------------------------- the window */

  function mount() {
    if (box) return;
    box = document.createElement("div");
    box.className = "mp trade";
    box.hidden = true;
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-labelledby", "tr-title");
    document.body.appendChild(box);
    box.addEventListener("click", onClick);
    box.addEventListener("submit", onSubmit);
    box.addEventListener("input", function (e) {
      if (e.target.id === "tr-code") {
        var clean = PS.net.cleanCode(e.target.value);
        if (clean !== e.target.value) e.target.value = clean;
      }
    });
    box.addEventListener("change", function (e) {
      if (e.target.id === "tr-gold" || e.target.id === "tr-gems") setMoney();
    });
    box.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && (e.target.id === "tr-gold" || e.target.id === "tr-gems")) {
        e.preventDefault();
        setMoney();
      }
    });
    document.addEventListener("keydown", function (e) {
      if (box.hidden || e.key !== "Escape") return;
      e.preventDefault();
      close();
    });
    // a gift or a sale elsewhere changes what can be offered
    PS.on("change", function () {
      if (!box.hidden && view.screen === "trade") render(true);
    });
  }

  function screenHtml() {
    var t = view.t;
    if (view.screen === "waiting") {
      return (
        '<h2 id="tr-title">Your trade code</h2>' +
        '<div class="mp__code" aria-label="Trade code">' + esc(t.code) + "</div>" +
        '<button class="btn btn--sm mp__copy" type="button" data-tr="copy">' + PS.icon("check") + "Copy the code</button>" +
        '<p class="mp__how">Tell your friend this code. They press <b>Trade</b> and type it in.</p>' +
        '<div class="mp__who"><span class="mp__spin"></span>Waiting for your friend to join...</div>' +
        '<div class="modal__actions"><button class="btn" type="button" data-tr="leave">Cancel</button></div>'
      );
    }
    if (view.screen === "trade") {
      var them = esc(t.their_name || "your friend");
      var locked = t.status === "locked";
      var d = view.draft || emptyOffer();
      var theirs = cleanOffer(t.theirs);
      var fresh = Date.now() - view.changed < 4000;
      var waitingOn = view.sending || view.dirty;
      var state;
      if (locked) state = '<p class="trade__lock" role="status">' + PS.icon("check") + 'Locked: you both accepted, and nothing can change now. It goes through in <b id="tr-count">' + Math.ceil(countdown() / 1000) + "</b>.</p>";
      else if (t.my_ok && !t.their_ok) state = '<p class="trade__state">You accepted. Waiting for ' + them + " to accept.</p>";
      else if (t.their_ok && !t.my_ok) state = '<p class="trade__state">' + them + " accepted. Check what you get, then accept.</p>";
      else state = '<p class="trade__state">Put in what you want to give, then both press <b>Accept</b>.</p>';
      var accept = locked
        ? '<button class="btn btn--danger" type="button" data-tr="stop">Stop!</button>'
        : t.my_ok
          ? '<button class="btn" type="button" data-tr="accept">Take back my accept</button>'
          : '<button class="btn btn--primary" type="button" data-tr="accept"' + (waitingOn || (isEmpty(d) && isEmpty(theirs)) ? " disabled" : "") + ">" + PS.icon("check") + "Accept</button>";
      return (
        '<h2 id="tr-title">Trading with ' + them + "</h2>" +
        state +
        '<div class="trade__sides' + (locked ? " is-locked" : "") + '">' +
          '<section class="trade__side' + (t.my_ok ? " is-ok" : "") + '">' +
            "<h3>You give" + (t.my_ok ? ' <span class="trade__ok">' + PS.icon("check") + "Accepted</span>" : "") + "</h3>" +
            offerHtml(d, true, !locked) +
          "</section>" +
          '<section class="trade__side trade__side--theirs' + (t.their_ok ? " is-ok" : "") + (fresh ? " is-changed" : "") + '">' +
            "<h3>" + them + " gives" + (t.their_ok ? ' <span class="trade__ok">' + PS.icon("check") + "Accepted</span>" : "") + "</h3>" +
            (fresh && !locked ? '<p class="trade__flash" role="status">' + them + " just changed their offer.</p>" : "") +
            offerHtml(theirs, false, false) +
          "</section>" +
        "</div>" +
        (locked ? "" : pickerHtml(d)) +
        '<p class="hint trade__rules">Changing either offer takes back both accepts. Once you both accept, the trade locks and goes through 3 seconds later: press <b>Stop</b> in those 3 seconds if anything looks wrong.</p>' +
        '<div class="modal__actions">' +
          '<button class="btn" type="button" data-tr="leave">Leave the trade</button>' +
          accept +
        "</div>"
      );
    }
    if (view.screen === "done") {
      var r = view.result;
      var got = cleanOffer(r.t.theirs);
      var gave = cleanOffer(r.t.mine);
      var skipped = r.out && r.out.skipped ? '<p class="hint">' + r.out.skipped + " thing" + (r.out.skipped === 1 ? "" : "s") + " from the trade are not in this version of the game and were left out.</p>" : "";
      return (
        '<h2 id="tr-title">Trade done!</h2>' +
        '<p class="trade__state">Your trade with ' + esc(r.t.their_name || "your friend") + " went through.</p>" +
        '<section class="trade__side is-ok"><h3>You got</h3>' + gotHtml(got, r.out) + "</section>" +
        '<section class="trade__side"><h3>You gave</h3>' + gotHtml(gave, null) + "</section>" +
        skipped +
        '<div class="modal__actions"><button class="btn btn--primary" type="button" data-tr="close" autofocus>Nice!</button></div>'
      );
    }
    if (view.screen === "over") {
      return (
        '<h2 id="tr-title">Trade called off</h2>' +
        '<p class="trade__state">' + esc(reasonText(t)) + "</p>" +
        '<div class="modal__actions">' +
          '<button class="btn" type="button" data-tr="close">Close</button>' +
          '<button class="btn btn--primary" type="button" data-tr="new">Start a new trade</button>' +
        "</div>"
      );
    }
    var who = PS.cloud.me();
    var can = Boolean(who && !PS.cloud.offline());
    return (
      '<h2 id="tr-title">Trade with a friend</h2>' +
      '<p class="hint mp__lead">Swap gear, pets, gold and gems. One of you makes a trade code; the other types it in. Both of you need the game open.</p>' +
      '<ul class="trade__how">' +
        "<li>Change anything, and you both have to accept again.</li>" +
        "<li>When you both accept, the trade <b>locks</b>: nothing can change.</li>" +
        "<li>3 seconds later it goes through. Press Stop in those 3 seconds if anything looks wrong.</li>" +
      "</ul>" +
      (can
        ? '<button class="btn btn--primary" type="button" data-tr="new"' + (view.busy ? " disabled" : "") + ">" + PS.icon("gift") + "Make a trade code</button>" +
          '<form class="mp__join" data-tr-form="join">' +
            '<label for="tr-code">Got a code from a friend?</label>' +
            '<div class="mp__joinrow"><input id="tr-code" maxlength="6" autocomplete="off" spellcheck="false" autocapitalize="characters" placeholder="ABC234" value="' + esc(view.code) + '" />' +
            '<button class="btn" type="submit"' + (view.busy ? " disabled" : "") + ">Join</button></div>" +
          "</form>"
        : '<p class="mp__error">Trading needs an account and the internet. Log in (not offline) to trade.</p>')
    );
  }

  /** Draw the window. Unless `force`, only when something it shows has changed,
   *  so the once-a-second check does not keep redrawing (or steal the focus). */
  function render(force) {
    if (!box || box.hidden) return;
    var t = view.t;
    var sig = JSON.stringify([view.screen, view.error, view.busy, view.sending, view.dirty, view.draft, view.pick, view.shown,
      t && [t.id, t.status, t.version, t.mine, t.theirs, t.my_ok, t.their_ok, t.reason], Date.now() - view.changed < 4000]);
    if (!force && sig === view.sig) return;
    view.sig = sig;
    // keep what the player is typing in a box that gets redrawn
    var focus = document.activeElement;
    var focusId = focus && box.contains(focus) ? focus.id : "";
    var typed = focusId && focus.tagName === "INPUT" ? focus.value : null;
    var scroller = box.querySelector(".trade__grid");
    var scroll = scroller ? scroller.scrollTop : 0;
    box.innerHTML =
      '<div class="mp__box panel trade__box">' +
        '<button class="modal__close" type="button" data-tr="close" aria-label="' + (live() ? "Leave the trade" : "Close") + '">' + PS.icon("close") + "</button>" +
        screenHtml() +
        (view.error ? '<p class="mp__error" role="alert">' + esc(view.error) + "</p>" : "") +
        (view.busy ? '<p class="mp__busy"><span class="mp__spin"></span>Talking to the server...</p>' : "") +
      "</div>";
    var grid = box.querySelector(".trade__grid");
    if (grid) grid.scrollTop = scroll;
    if (focusId) {
      var again = box.querySelector("#" + focusId);
      if (again) {
        if (typed !== null) again.value = typed;
        again.focus();
      }
    }
  }

  function tickCount() {
    var node = box && box.querySelector("#tr-count");
    var left = countdown();
    if (node) node.textContent = String(Math.ceil(left / 1000));
    if (left <= 0 && !asking) poll();
  }

  function stopTimers() {
    clearTimeout(pollTimer);
    pollTimer = 0;
    clearInterval(countTimer);
    countTimer = 0;
  }

  function schedule() {
    clearTimeout(pollTimer);
    pollTimer = 0;
    if (!live()) {
      clearInterval(countTimer);
      countTimer = 0;
      return;
    }
    pollTimer = setTimeout(poll, POLL);
    if (view.t.status === "locked") {
      if (!countTimer) countTimer = setInterval(tickCount, 100);
    } else if (countTimer) {
      clearInterval(countTimer);
      countTimer = 0;
    }
  }

  /** The server's word on the trade: show it, and when it is done, put it in the save. */
  function apply(t) {
    if (!t || typeof t.id !== "number") return;
    var before = view.t;
    view.t = t;
    var now = when(t.now);
    if (isFinite(now)) view.skew = now - Date.now();
    var theirs = JSON.stringify(t.theirs || {});
    if (before && before.id === t.id && theirs !== view.theirText) view.changed = Date.now();
    view.theirText = theirs;
    if (!view.sending && !view.dirty) view.draft = cleanOffer(t.mine);
    if (t.status === "done") {
      deliver(t);
      return;
    }
    if (t.status === "waiting") view.screen = "waiting";
    else if (t.status === "open" || t.status === "locked") view.screen = "trade";
    else view.screen = "over";
    schedule();
    render();
  }

  /** A trade that went through: take away what was given and add what was got (once). */
  function deliver(t) {
    stopTimers();
    var out = null;
    if (!t.got) {
      out = PS.state.applyTrade(t.id, t.mine, t.theirs);
      PS.cloud.tradeGot(t.id);
    }
    if (view.result && view.result.t.id === t.id && !out) out = view.result.out;
    view.result = { t: t, out: out };
    view.screen = "done";
    view.error = "";
    if (out) PS.sfx.play("reveal", 2);
    mount();
    box.hidden = false;
    render(true);
  }

  function poll() {
    pollTimer = 0;
    var t = view.t;
    if (!t || asking || !live()) return;
    asking = true;
    PS.cloud.tradeState(t.id).then(function (res) {
      asking = false;
      if (!view.t || view.t.id !== t.id) return;
      if (res.error) {
        view.error = res.error;
        if (res.down) {
          view.netError = true;
          schedule(); // the connection may come back
        } else {
          view.t = { id: t.id, status: "cancelled", reason: "", side: t.side, their_name: t.their_name };
          view.screen = "over";
          stopTimers();
        }
        render();
        return;
      }
      if (view.netError) {
        view.error = "";
        view.netError = false;
      }
      apply(res.data);
    });
  }

  /** An error from something the player pressed stays up until they press something else;
   *  the trade is fetched again at once, so they see what changed. */
  function failedAction(res) {
    view.error = res.error;
    view.netError = Boolean(res.down);
    render();
    if (!res.down && live()) {
      clearTimeout(pollTimer);
      pollTimer = setTimeout(poll, 0);
    }
  }

  function request(job) {
    view.busy = true;
    view.error = "";
    view.netError = false;
    render();
    return job.then(function (res) {
      view.busy = false;
      if (res.error) {
        failedAction(res);
        return null;
      }
      apply(res.data);
      return res.data;
    });
  }

  /* --------------------------------------------------------- changing the offer */

  /** Send this player's offer, one at a time: a change made while one is on its way goes next. */
  function sendDraft() {
    var t = view.t;
    if (!t || t.status !== "open") return;
    if (view.sending) {
      view.dirty = true;
      render();
      return;
    }
    view.sending = true;
    view.dirty = false;
    var offer = view.draft;
    render();
    PS.cloud.tradeOffer(t.id, offer).then(function (res) {
      view.sending = false;
      if (!view.t || view.t.id !== t.id) return;
      if (res.error) {
        view.dirty = false;
        view.draft = cleanOffer(view.t.mine);
        failedAction(res);
        return;
      }
      if (view.dirty) {
        view.t = res.data;
        view.dirty = false;
        sendDraft();
        return;
      }
      apply(res.data);
    });
  }

  function edit(fn) {
    var t = view.t;
    if (!t || t.status !== "open") return;
    var d = cleanOffer(view.draft);
    if (fn(d) === false) return;
    view.draft = d;
    view.error = "";
    view.netError = false;
    sendDraft();
  }

  function setMoney() {
    var gold = box.querySelector("#tr-gold");
    var gems = box.querySelector("#tr-gems");
    edit(function (d) {
      var g = whole(gold ? gold.value : d.gold, S().gold);
      var m = whole(gems ? gems.value : d.gems, S().gems);
      if (g === d.gold && m === d.gems) {
        // typed more than they have: show the real figure again
        if (gold) gold.value = d.gold;
        if (gems) gems.value = d.gems;
        return false;
      }
      d.gold = g;
      d.gems = m;
    });
  }

  /* --------------------------------------------------------- clicks */

  function onClick(e) {
    if (e.target === box) {
      // the dimmed backdrop closes the window, but never walks out of a trade by accident
      if (!live()) close();
      return;
    }
    var node = e.target.closest("[data-tr]");
    if (!node || node.disabled) return;
    var act = node.getAttribute("data-tr");
    PS.sfx.play("click");
    var t = view.t;
    if (act === "close") close();
    else if (act === "new") start();
    else if (act === "leave") close(); // leaving closes the window (unless the trade had already gone through)
    else if (act === "copy") copyCode(node);
    else if (act === "accept" && t) request(PS.cloud.tradeAccept(t.id, t.version, !t.my_ok));
    else if (act === "stop" && t) request(PS.cloud.tradeAccept(t.id, t.version, false));
    else if (act === "pick") {
      view.pick = node.getAttribute("data-v");
      view.shown = PAGE;
      render();
    } else if (act === "more") {
      view.shown += PAGE;
      render();
    } else if (act === "add-item") {
      var item = PS.state.item(Number(node.getAttribute("data-u")));
      if (item && !PS.state.isEquipped(item)) {
        edit(function (d) {
          if (d.items.length >= MAX_ITEMS) return false;
          d.items.push({ id: item.id, r: item.r, u: item.u });
        });
      }
    } else if (act === "add-pet") {
      var u = Number(node.getAttribute("data-u"));
      var pet = S().pets.filter(function (p) { return p.u === u; })[0];
      if (pet) {
        edit(function (d) {
          if (d.pets.length >= MAX_PETS) return false;
          d.pets.push({ sp: pet.sp, r: pet.r, lv: pet.lv, u: pet.u });
        });
      }
    } else if (act === "drop-item") {
      var i = Number(node.getAttribute("data-i"));
      edit(function (d) { d.items.splice(i, 1); });
    } else if (act === "drop-pet") {
      var k = Number(node.getAttribute("data-i"));
      edit(function (d) { d.pets.splice(k, 1); });
    }
  }

  function onSubmit(e) {
    if (e.target.getAttribute("data-tr-form") !== "join") return;
    e.preventDefault();
    var input = box.querySelector("#tr-code");
    var code = PS.net.cleanCode(input ? input.value : "");
    view.code = code;
    if (code.length !== 6) {
      view.error = "A trade code has 6 letters and numbers.";
      render();
      return;
    }
    request(PS.cloud.tradeJoin(code));
  }

  function copyCode(node) {
    try {
      navigator.clipboard.writeText(view.t.code).then(function () { node.lastChild.textContent = "Copied!"; }, function () {});
    } catch (err) {
      /* the code is on screen to read out anyway */
    }
  }

  /* --------------------------------------------------------- starting and stopping */

  function reset() {
    stopTimers();
    view.screen = "home";
    view.t = null;
    view.draft = null;
    view.sending = view.dirty = view.busy = false;
    view.error = "";
    view.changed = 0;
    view.theirText = "";
    view.pick = "all";
    view.shown = PAGE;
  }

  function start() {
    if (view.busy) return;
    reset();
    request(PS.cloud.tradeOpen());
  }

  /** Walk out of the trade. Too late once a locked trade's three seconds are up: then it goes through. */
  function leave() {
    var t = view.t;
    if (!t || !live()) {
      reset();
      render(true);
      return Promise.resolve();
    }
    stopTimers();
    return PS.cloud.tradeLeave(t.id).then(function (res) {
      if (res.error) {
        view.error = res.error;
        render(true);
        return;
      }
      apply(res.data);
    });
  }

  function open() {
    mount();
    if (!live() && view.screen !== "done") reset();
    box.hidden = false;
    render(true);
    var first = box.querySelector("#tr-code") || box.querySelector("[data-tr]");
    if (first && view.screen === "home") first.focus();
  }

  function close() {
    if (!box) return;
    if (live()) {
      // leaving: what the server says decides (a trade past its three seconds still goes through)
      leave().then(function () {
        if (!live() && view.screen !== "done") {
          box.hidden = true;
          reset();
        }
      });
      return;
    }
    box.hidden = true;
    if (view.screen !== "home") reset();
  }

  /** Finished trades this game has not picked up yet (the game was closed during
   *  the countdown, say): put them in the save and show what came. */
  function pickUp() {
    if (!PS.cloud.me() || PS.cloud.offline() || live()) return;
    PS.cloud.tradePending().then(function (res) {
      if (res.error || !Array.isArray(res.data) || live()) return;
      res.data.forEach(function (t) {
        if (t && typeof t.id === "number") deliver(t);
      });
    });
  }

  PS.trade = {
    open: open,
    close: close,
    pickUp: pickUp,
    active: live
  };
})();
