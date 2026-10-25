/*!
 * Pip Survivors — invites
 * No codes to read out: the Trade and Play-with-a-friend windows list the
 * players who have the game open, and one press invites them. The invited
 * player gets a pop-up ("bob wants to trade with you") with Join, which
 * opens the trade or the room with its code already in. Codes still work.
 *
 * The server keeps the invites (setup.sql: pip_invite, pip_invites,
 * pip_invite_answer, pip_invite_state, pip_online_players). An invite
 * nobody answers is gone after 2 minutes.
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function () {
  "use strict";

  var PS = window.PS;
  var esc = PS.esc;

  var LIFE = 120; // seconds an invite lasts (as in setup.sql)
  var CHECK_EVERY = 4000; // how often a game looks for invites to it
  var LIST_EVERY = 10000; // how often an open list of players is fetched again
  var STATE_EVERY = 3000; // how often a sent invite is asked about

  var online = { rows: null, error: "", at: 0, loading: false };
  var sent = {}; // lower-case name: { name, kind, id, state: sending|waiting|yes|no|expired|error, note }
  var incoming = []; // invites to this player: { id, from, kind, code, detail, until, note }
  var seen = {}; // ids already taken in
  var box = null;

  function signedIn() {
    return Boolean(PS.cloud.me() && !PS.cloud.offline());
  }

  function inGame() {
    var gate = document.getElementById("gate");
    return !gate || gate.hidden;
  }

  function inBattle() {
    var battle = document.getElementById("battle");
    return Boolean(battle && !battle.hidden);
  }

  /* ------------------------------------------------- the list of players */

  /** Fetch who is online (at most every 10 seconds unless `force`), then repaint the lists. */
  function load(force) {
    if (!signedIn() || online.loading) return;
    if (!force && online.rows && Date.now() - online.at < LIST_EVERY) return;
    online.loading = true;
    PS.cloud.onlinePlayers().then(function (res) {
      online.loading = false;
      online.at = Date.now();
      online.error = res.error || "";
      if (!res.error) online.rows = res.rows;
      paintLists();
    });
  }

  function statusHtml(s) {
    if (s.state === "sending") return '<span class="invite__state">Sending...</span>';
    if (s.state === "waiting") return '<span class="invite__state is-wait"><span class="mp__spin"></span>Invited: waiting for them</span>';
    if (s.state === "yes") return '<span class="invite__state is-yes">' + PS.icon("check") + "Joining!</span>";
    if (s.state === "no") return '<span class="invite__state is-no">Said no thanks</span>';
    if (s.state === "expired") return '<span class="invite__state is-no">Didn\'t answer</span>';
    return '<span class="invite__state is-no">' + esc(s.note || "Couldn't invite them") + "</span>";
  }

  /** The rows of a list. `attr` is the window's own button attribute ("data-tr",
   *  "data-mp"); `buttons` is a list of [kind, label]. */
  function rowsHtml(attr, buttons) {
    if (online.error) return '<li class="invite__empty">' + esc(online.error) + "</li>";
    if (!online.rows) return '<li class="invite__empty"><span class="mp__spin"></span>Looking for players online...</li>';
    if (!online.rows.length) return '<li class="invite__empty">Nobody else is online right now. You can still make a code below.</li>';
    return online.rows.map(function (p) {
      var s = sent[p.name.toLowerCase()];
      var again = s && (s.state === "no" || s.state === "expired" || s.state === "error");
      return (
        '<li class="invite__row">' +
          '<span class="invite__dot' + (p.busy ? " is-busy" : "") + '" aria-hidden="true"></span>' +
          '<b class="invite__name">' + esc(p.name) + "</b>" +
          (p.busy ? '<small class="invite__busy">busy</small>' : "") +
          '<span class="invite__acts">' +
            (s ? statusHtml(s) : "") +
            (!s || again
              ? buttons.map(function (b) {
                  return '<button class="btn btn--sm" type="button" ' + attr + '="invite" data-name="' + esc(p.name) + '" data-kind="' + b[0] + '">' + esc(again ? "Again" : b[1]) + "</button>";
                }).join("")
              : "") +
          "</span>" +
        "</li>"
      );
    }).join("");
  }

  /** The whole "Players online" block for a window. */
  function listHtml(attr, buttons, title) {
    load();
    return (
      '<section class="invite" data-inv-attr="' + attr + '" data-inv-buttons="' + esc(JSON.stringify(buttons)) + '">' +
        '<h3 class="invite__title">' + esc(title || "Players online") + "</h3>" +
        '<ul class="invite__list">' + rowsHtml(attr, buttons) + "</ul>" +
        '<div class="invite__typed">' +
          '<input id="inv-name" maxlength="16" autocomplete="off" spellcheck="false" placeholder="Or type their name" aria-label="Their name" />' +
          buttons.map(function (b) {
            return '<button class="btn btn--sm" type="button" ' + attr + '="invite-typed" data-kind="' + b[0] + '">' + esc(b[1]) + "</button>";
          }).join("") +
        "</div>" +
        typedNote() +
      "</section>"
    );
  }

  var typed = null; // the last name typed in by hand, for its status line

  function typedNote() {
    if (!typed) return "";
    var s = sent[typed.toLowerCase()];
    if (!s || (online.rows || []).some(function (p) { return p.name.toLowerCase() === typed.toLowerCase(); })) return "";
    return '<p class="invite__typednote"><b>' + esc(s.name) + "</b> " + statusHtml(s) + "</p>";
  }

  /** Redraw the lists on screen in place (so a box being typed in keeps its focus). */
  function paintLists() {
    var lists = document.querySelectorAll(".invite");
    for (var i = 0; i < lists.length; i++) {
      var node = lists[i];
      var attr = node.getAttribute("data-inv-attr");
      var buttons;
      try {
        buttons = JSON.parse(node.getAttribute("data-inv-buttons"));
      } catch (err) {
        continue;
      }
      var ul = node.querySelector(".invite__list");
      if (ul) ul.innerHTML = rowsHtml(attr, buttons);
      var old = node.querySelector(".invite__typednote");
      if (old) old.parentNode.removeChild(old);
      var note = typedNote();
      if (note) node.insertAdjacentHTML("beforeend", note);
    }
  }

  /** The name typed in a window's box (and remember it for its status line). */
  function typedName(root) {
    var input = (root || document).querySelector("#inv-name");
    var name = input ? input.value.trim() : "";
    if (name) typed = name;
    return name;
  }

  /* ------------------------------------------------- sending */

  /** Invite `name` to a trade or a room by its code. */
  function send(name, kind, code, detail) {
    name = String(name || "").trim();
    if (!name) return;
    var key = name.toLowerCase();
    sent[key] = { name: name, kind: kind, id: 0, state: "sending", note: "" };
    paintLists();
    PS.cloud.invite(name, kind, code, detail).then(function (res) {
      var s = sent[key];
      if (!s || s.state !== "sending") return;
      if (res.error) {
        s.state = "error";
        s.note = res.error;
      } else {
        s.id = res.id;
        s.state = "waiting";
        s.at = Date.now();
      }
      paintLists();
    });
  }

  /** A new trade or room (or none): the old invites no longer count. */
  function forget() {
    sent = {};
    typed = null;
    paintLists();
  }

  function checkSent() {
    Object.keys(sent).forEach(function (key) {
      var s = sent[key];
      if (s.state !== "waiting" || !s.id || s.asking) return;
      s.asking = true;
      PS.cloud.inviteState(s.id).then(function (res) {
        s.asking = false;
        if (sent[key] !== s || res.error) return;
        if (res.state !== "waiting") {
          s.state = res.state;
          paintLists();
        }
      });
    });
  }

  /* ------------------------------------------------- invites to me */

  function kindLine(inv) {
    if (inv.kind === "trade") return { icon: "gift", text: "wants to trade with you" };
    if (inv.kind === "duel") return { icon: "atk", text: "challenges you to an arena duel" + (inv.detail ? " (" + inv.detail + ")" : "") };
    return { icon: "tabBattle", text: "invites you to play co-op" + (inv.detail ? ": " + inv.detail : "") };
  }

  function layer() {
    if (!box) {
      box = document.createElement("div");
      box.className = "invites";
      box.setAttribute("aria-live", "polite");
      box.setAttribute("popover", "manual");
      document.documentElement.appendChild(box);
      box.addEventListener("click", onCard);
    }
    return box;
  }

  /** Draw the cards (none during a battle: they wait until it is over). */
  function paintCards() {
    var now = Date.now();
    incoming = incoming.filter(function (inv) { return inv.until > now; });
    var show = inGame() && signedIn() && !inBattle() ? incoming.slice(-3) : [];
    if (!show.length) {
      if (box) {
        box.innerHTML = "";
        try {
          if (box.matches(":popover-open")) box.hidePopover();
        } catch (err) {
          /* nothing to hide */
        }
      }
      return;
    }
    var root = layer();
    // a window of the game's own (the chat, the menus) makes anything outside it unclickable
    var blocked = Boolean(document.querySelector("dialog[open]"));
    var key = JSON.stringify([show.map(function (inv) { return [inv.id, inv.note]; }), blocked]);
    if (root.getAttribute("data-key") === key && root.children.length) {
      // the same cards: only their clocks move (redrawing could swallow a click)
      show.forEach(function (inv) {
        var clock = root.querySelector('[data-id="' + inv.id + '"] .invitecard__left');
        if (clock) clock.textContent = PS.clock(Math.max(0, Math.ceil((inv.until - now) / 1000)));
      });
      return;
    }
    root.setAttribute("data-key", key);
    root.innerHTML = show.map(function (inv) {
      var line = kindLine(inv);
      var left = Math.max(0, Math.ceil((inv.until - now) / 1000));
      return (
        '<div class="invitecard invitecard--' + inv.kind + '" role="alert" data-id="' + inv.id + '">' +
          '<span class="invitecard__icon">' + PS.icon(line.icon) + "</span>" +
          '<div class="invitecard__body">' +
            "<p><b>" + esc(inv.from) + "</b> " + esc(line.text) + "</p>" +
            (inv.note ? '<p class="invitecard__note">' + esc(inv.note) + "</p>" : "") +
            (blocked ? '<p class="invitecard__note">Close the window you have open to answer.</p>' : "") +
            '<div class="invitecard__acts">' +
              '<button class="btn btn--primary btn--sm" type="button" data-inv="yes">' + PS.icon("check") + "Join</button>" +
              '<button class="btn btn--sm" type="button" data-inv="no">No thanks</button>' +
              '<span class="invitecard__left">' + PS.clock(left) + "</span>" +
            "</div>" +
          "</div>" +
        "</div>"
      );
    }).join("");
    try {
      if (root.showPopover) {
        if (root.matches(":popover-open")) root.hidePopover();
        root.showPopover(); // on top of everything, even what opened after it
      }
    } catch (err) {
      /* an older browser: it sits under open windows instead */
    }
  }

  function onCard(e) {
    var button = e.target.closest("[data-inv]");
    if (!button) return;
    var card = button.closest(".invitecard");
    var id = Number(card && card.getAttribute("data-id"));
    var inv = incoming.filter(function (x) { return x.id === id; })[0];
    if (!inv) return;
    PS.sfx.play("click");
    if (button.getAttribute("data-inv") === "no") {
      PS.cloud.answerInvite(inv.id, false);
      drop(inv);
      return;
    }
    // one thing at a time: a trade and a room cannot both be going
    if (inv.kind === "trade" && PS.multi && PS.multi.active()) {
      inv.note = "Leave your room first, then press Join.";
      paintCards();
      return;
    }
    if (inv.kind !== "trade" && PS.trade && PS.trade.active()) {
      inv.note = "Finish or leave your trade first, then press Join.";
      paintCards();
      return;
    }
    PS.cloud.answerInvite(inv.id, true);
    drop(inv);
    if (inv.kind === "trade") PS.trade.joinCode(inv.code);
    else PS.multi.joinCode(inv.code);
  }

  function drop(inv) {
    incoming = incoming.filter(function (x) { return x !== inv; });
    paintCards();
  }

  /** Look for new invites to this player. */
  function check() {
    if (!signedIn() || !inGame() || document.visibilityState !== "visible") return;
    PS.cloud.invites().then(function (res) {
      if (res.error) return;
      var fresh = false;
      var ids = {};
      res.rows.forEach(function (r) {
        var id = Number(r.id);
        ids[id] = true;
        if (seen[id]) return;
        var age = Number(r.age) || 0;
        if (age >= LIFE - 2) return;
        seen[id] = true;
        // a newer invite from the same player for the same thing takes the old one's place
        incoming = incoming.filter(function (x) { return !(x.from === r.from_name && x.kind === r.kind); });
        incoming.push({ id: id, from: String(r.from_name), kind: String(r.kind), code: String(r.code), detail: String(r.detail || ""), until: Date.now() + (LIFE - age) * 1000, note: "" });
        fresh = true;
      });
      // gone from the server (answered on another device, or replaced): gone here too
      incoming = incoming.filter(function (x) { return ids[x.id]; });
      if (fresh && !inBattle()) PS.sfx.play("reveal", 2);
      paintCards();
    });
  }

  setInterval(check, CHECK_EVERY);
  setInterval(checkSent, STATE_EVERY);
  setInterval(function () {
    // the cards' clocks, cards that waited out a battle, and a list that is open
    if (incoming.length || (box && box.children.length)) paintCards();
    if (document.querySelector(".invite") && document.visibilityState === "visible") load();
  }, 1000);

  PS.invite = {
    listHtml: listHtml,
    typedName: typedName,
    send: send,
    forget: forget,
    check: check,
    load: load
  };
})();
