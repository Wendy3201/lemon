/*!
 * Pip Survivors — playing with a friend
 * The "Play with a friend" window: make a co-op or arena room (and get its
 * code), or join one with a code. Then it starts the battle on both games and
 * passes the battle's messages between them (net.js does the carrying).
 *
 * Co-op: both lemons in the host's chapter; the host's game runs the battle.
 * Arena: a duel in a ring, best of three rounds.
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function () {
  "use strict";

  var PS = window.PS;
  var esc = PS.esc;

  var box = null;
  var view = { screen: "home", kind: "coop", duelMode: "equal", code: "", error: "", busy: false, partner: null, hostInfo: null, link: "room" };
  var session = null; // { role: "host"|"guest", kind, chapter, duelMode, inBattle }

  function myName() {
    var who = PS.cloud && PS.cloud.me ? PS.cloud.me() : null;
    return who && who.name ? who.name : "Lemon";
  }

  /** What this player's lemon brings to a battle together. */
  function loadout() {
    var calc = PS.state.calc();
    return {
      name: myName(),
      power: calc.power,
      stats: {
        atk: calc.atk, hp: calc.hp, crit: calc.crit, critDmg: calc.critDmg, haste: calc.haste, speed: calc.speed,
        armor: calc.armor, regen: calc.regen, magnet: calc.magnet, xp: calc.xp, luck: calc.luck, area: calc.area,
        bossDmg: calc.bossDmg, fx: calc.fx, weapon: calc.weapon
      },
      outfit: PS.B.outfitOf(),
      pets: PS.state.petTeam().map(function (pet) { return { sp: pet.sp, r: pet.r, lv: pet.lv }; })
    };
  }

  function kindText(kind, chapter, duelMode) {
    if (kind === "duel") return "Arena duel · " + (duelMode === "full" ? "full power" : "equal");
    var ch = PS.chapter(chapter || 1);
    return "Co-op · chapter " + ch.n + ": " + ch.name;
  }

  function linkText() {
    if (view.link === "direct") return "Linked directly";
    var st = PS.net.state();
    return st && st.partner ? "Linked through the server (a direct link wasn't possible)" : "";
  }

  /* --------------------------------------------------------- the window */

  function mount() {
    if (box) return;
    box = document.createElement("div");
    box.className = "mp";
    box.hidden = true;
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-labelledby", "mp-title");
    document.body.appendChild(box);
    box.addEventListener("click", onClick);
    box.addEventListener("submit", onSubmit);
    box.addEventListener("input", function (e) {
      if (e.target.id === "mp-code") {
        var clean = PS.net.cleanCode(e.target.value);
        if (clean !== e.target.value) e.target.value = clean;
      }
    });
    document.addEventListener("keydown", function (e) {
      if (box.hidden || e.key !== "Escape") return;
      e.preventDefault();
      close();
    });
  }

  function render() {
    var html;
    var S = PS.state.get();
    if (view.screen === "hosting") {
      var partner = view.partner;
      html =
        '<h2 id="mp-title">Your room</h2>' +
        '<p class="kicker">' + esc(kindText(view.kind, S.chapter, view.duelMode)) + "</p>" +
        '<div class="mp__code" aria-label="Room code">' + esc(view.code) + "</div>" +
        '<button class="btn btn--sm mp__copy" type="button" data-mp="copy">' + PS.icon("check") + "Copy the code</button>" +
        '<p class="mp__how">Tell your friend this code. They press <b>Play with a friend</b> and type it in.</p>' +
        '<div class="mp__who' + (partner ? " is-in" : "") + '">' +
          (partner
            ? '<span class="mp__dot"></span><b>' + esc(partner.name || "Your friend") + "</b> joined" + (partner.power ? ' <span class="power">' + PS.icon("power") + PS.fmt(partner.power) + "</span>" : "")
            : '<span class="mp__spin"></span>Waiting for a friend to join...') +
        "</div>" +
        '<p class="mp__link">' + esc(partner ? linkText() || "Linking up..." : "") + "</p>" +
        '<div class="modal__actions">' +
          '<button class="btn" type="button" data-mp="cancel">Close the room</button>' +
          '<button class="btn btn--primary" type="button" data-mp="start"' + (partner && !view.busy ? "" : " disabled") + ">" + PS.icon("tabBattle") + "Start</button>" +
        "</div>";
    } else if (view.screen === "joined") {
      var host = view.hostInfo || {};
      html =
        '<h2 id="mp-title">In ' + esc(host.name || "your friend") + "'s room</h2>" +
        '<p class="kicker">' + esc(kindText(host.kind, host.chapter, host.duelMode)) + "</p>" +
        '<div class="mp__who is-in"><span class="mp__spin"></span>Waiting for ' + esc(host.name || "the host") + " to start...</div>" +
        '<p class="mp__link">' + esc(linkText() || "Linking up...") + "</p>" +
        (host.kind !== "duel" && host.chapter > PS.state.get().best + 1
          ? '<p class="hint">This chapter is past your own progress: it pays like your furthest chapter and won\'t open new ones for you.</p>' : "") +
        '<div class="modal__actions"><button class="btn" type="button" data-mp="cancel">Leave</button></div>';
    } else {
      var ch = PS.chapter(S.chapter);
      html =
        '<h2 id="mp-title">Play with a friend</h2>' +
        '<p class="hint mp__lead">Both of you need the game open and the internet. One of you makes a room; the other types in its code.</p>' +
        '<div class="mp__cards">' +
          '<section class="mp__card">' +
            '<h3>' + PS.icon("tabBattle") + "Co-op</h3>" +
            "<p>Play <b>chapter " + ch.n + ": " + esc(ch.name) + "</b> together. More pests and a tougher boss; if one of you goes down, the other can help them up.</p>" +
            '<button class="btn btn--primary" type="button" data-mp="host" data-kind="coop"' + (view.busy ? " disabled" : "") + ">Make a co-op room</button>" +
          "</section>" +
          '<section class="mp__card">' +
            '<h3>' + PS.icon("atk") + "Arena duel</h3>" +
            "<p>Lemon against lemon in a ring, best of three rounds.</p>" +
            '<div class="mp__seg" role="group" aria-label="Duel rules">' +
              '<button type="button" data-mp="mode" data-mode="equal" aria-pressed="' + (view.duelMode === "equal") + '">Equal</button>' +
              '<button type="button" data-mp="mode" data-mode="full" aria-pressed="' + (view.duelMode === "full") + '">Full power</button>' +
            "</div>" +
            '<p class="hint">' + (view.duelMode === "equal"
              ? "Same health and damage for both: only weapons, perks and upgrades make the difference."
              : "Your real gear and stats. Hits between lemons are cut down so rounds still last.") + "</p>" +
            '<button class="btn btn--primary" type="button" data-mp="host" data-kind="duel"' + (view.busy ? " disabled" : "") + ">Make an arena room</button>" +
          "</section>" +
        "</div>" +
        '<form class="mp__join" data-mp-form="join">' +
          '<label for="mp-code">Got a code from a friend?</label>' +
          '<div class="mp__joinrow"><input id="mp-code" maxlength="' + PS.net.CODE_LENGTH + '" autocomplete="off" spellcheck="false" autocapitalize="characters" placeholder="ABC234" value="' + esc(view.code) + '" />' +
          '<button class="btn" type="submit"' + (view.busy ? " disabled" : "") + ">Join</button></div>" +
        "</form>";
    }
    box.innerHTML =
      '<div class="mp__box panel">' +
        '<button class="modal__close" type="button" data-mp="close" aria-label="Close">' + PS.icon("close") + "</button>" +
        html +
        (view.error ? '<p class="mp__error" role="alert">' + esc(view.error) + "</p>" : "") +
        (view.busy && view.screen === "home" ? '<p class="mp__busy"><span class="mp__spin"></span>Connecting...</p>' : "") +
      "</div>";
  }

  function open() {
    mount();
    if (!PS.net.available()) {
      view.screen = "home";
      view.error = "Playing together needs the internet and the game's server, and neither can be reached right now.";
    }
    box.hidden = false;
    render();
    var first = box.querySelector("#mp-code") || box.querySelector("[data-mp]");
    if (first && view.screen === "home") first.focus();
  }

  function close() {
    if (!box) return;
    if (view.screen !== "home") leave();
    box.hidden = true;
    view.error = "";
  }

  function reset(error) {
    view.screen = "home";
    view.code = "";
    view.partner = null;
    view.hostInfo = null;
    view.busy = false;
    view.link = "room";
    view.error = error || "";
    session = null;
  }

  /* --------------------------------------------------------- the clicks */

  function onClick(e) {
    if (e.target === box) {
      close();
      return;
    }
    var node = e.target.closest("[data-mp]");
    if (!node || node.disabled) return;
    var act = node.getAttribute("data-mp");
    PS.sfx.play("click");
    if (act === "close") close();
    else if (act === "mode") {
      view.duelMode = node.getAttribute("data-mode") === "full" ? "full" : "equal";
      render();
    } else if (act === "host") host(node.getAttribute("data-kind") === "duel" ? "duel" : "coop");
    else if (act === "copy") copyCode(node);
    else if (act === "cancel") {
      leave();
      render();
    } else if (act === "start") startAsHost();
  }

  function onSubmit(e) {
    if (e.target.getAttribute("data-mp-form") !== "join") return;
    e.preventDefault();
    var input = box.querySelector("#mp-code");
    join(input ? input.value : "");
  }

  function copyCode(node) {
    var text = view.code;
    var done = function () { node.lastChild.textContent = "Copied!"; };
    try {
      navigator.clipboard.writeText(text).then(done, function () {});
    } catch (err) {
      /* the code is on screen to read out anyway */
    }
  }

  /* --------------------------------------------------------- rooms */

  function listen() {
    PS.net.off("peer");
    PS.net.off("link");
    PS.net.off("left");
    ["start", "go", "begin", "s", "cards", "end", "in", "dash", "pick", "reroll", "again"].forEach(function (t) { PS.net.off(t); });

    PS.net.on("link", function (link) {
      view.link = link;
      PS.B.mpSetLink(link);
      if (!box.hidden) render();
    });
    PS.net.on("left", function () {
      if (session && session.inBattle) {
        PS.B.mpPartnerLeft();
        return;
      }
      if (session && session.role === "host") {
        // the room stays open for someone else
        var gone = view.partner ? view.partner.name : "Your friend";
        PS.net.leave();
        var kind = view.kind;
        reset();
        host(kind, gone + " left the room. Here's a new one.");
        return;
      }
      reset((view.hostInfo ? view.hostInfo.name : "Your friend") + " closed the room.");
      PS.net.leave();
      if (!box.hidden) render();
    });

    // the host's side
    PS.net.on("peer", function (info) {
      if (!session || session.role !== "host") return;
      view.partner = info || {};
      PS.sfx.play("reveal", 1);
      render();
    });
    PS.net.on("go", function (m) {
      if (!session || session.role !== "host" || session.inBattle) return;
      beginAsHost(m && m.loadout);
    });
    PS.net.on("in", function (m) { PS.B.mpInput(m); });
    PS.net.on("dash", function () { PS.B.mpDash(); });
    PS.net.on("pick", function (m) { PS.B.mpPick(m); });
    PS.net.on("reroll", function () { PS.B.mpReroll(); });
    PS.net.on("again", function () { PS.B.mpCardsAgain(); });

    // the guest's side
    PS.net.on("start", function () {
      if (!session || session.role !== "guest") return;
      PS.net.send("go", { loadout: loadout() }, true);
    });
    PS.net.on("begin", function (m) {
      if (!session || session.role !== "guest" || session.inBattle || !m) return;
      session.inBattle = true;
      session.kind = m.kind;
      box.hidden = true;
      PS.B.mpHooks.send = PS.net.send;
      PS.ui.startTogether({
        guest: true, kind: m.kind, chapter: m.chapter, duelMode: m.duelMode, host: m.host, myName: myName()
      });
    });
    PS.net.on("s", function (m) { PS.B.mirrorSnapshot(m); });
    PS.net.on("cards", function (m) { PS.B.mirrorCards(m); });
    PS.net.on("end", function (m) {
      PS.B.mirrorEnd(m);
    });
  }

  function host(kind, note) {
    if (view.busy) return;
    view.busy = true;
    view.error = "";
    view.kind = kind;
    render();
    listen();
    var S = PS.state.get();
    var info = { name: myName(), kind: kind, chapter: kind === "duel" ? 1 : S.chapter, duelMode: view.duelMode, power: PS.state.calc().power };
    PS.net.host(info).then(function (code) {
      session = { role: "host", kind: kind, chapter: info.chapter, duelMode: view.duelMode, inBattle: false };
      view.screen = "hosting";
      view.code = code;
      view.partner = null;
      view.busy = false;
      view.error = note || "";
      view.link = "room";
      render();
    }, function (err) {
      view.busy = false;
      view.error = err && err.message ? err.message : "Couldn't make a room. Try again.";
      render();
    });
  }

  function join(code) {
    if (view.busy) return;
    code = PS.net.cleanCode(code);
    view.code = code;
    if (code.length !== PS.net.CODE_LENGTH) {
      view.error = "A room code has " + PS.net.CODE_LENGTH + " letters and numbers.";
      render();
      return;
    }
    view.busy = true;
    view.error = "";
    render();
    listen();
    PS.net.join(code, { name: myName(), power: PS.state.calc().power }).then(function (hostInfo) {
      session = { role: "guest", kind: hostInfo.kind, chapter: hostInfo.chapter, duelMode: hostInfo.duelMode, inBattle: false };
      view.screen = "joined";
      view.hostInfo = hostInfo;
      view.busy = false;
      view.link = PS.net.state() ? PS.net.state().link : "room";
      render();
    }, function (err) {
      view.busy = false;
      view.error = err && err.message ? err.message : "Couldn't join that room.";
      render();
    });
  }

  function startAsHost() {
    if (!session || session.role !== "host" || !view.partner) return;
    view.busy = true;
    render();
    PS.net.send("start", {}, true);
    // the friend answers with what their lemon brings; nothing back in a while: ask again
    var asked = 0;
    var again = setInterval(function () {
      if (!session || session.inBattle || !view.busy) {
        clearInterval(again);
        return;
      }
      if (++asked > 5) {
        clearInterval(again);
        view.busy = false;
        view.error = "Your friend's game didn't answer. Try Start again.";
        render();
        return;
      }
      PS.net.send("start", {}, true);
    }, 2000);
  }

  function beginAsHost(allyLoad) {
    if (!allyLoad) return;
    session.inBattle = true;
    view.busy = false;
    box.hidden = true;
    PS.B.mpHooks.send = PS.net.send;
    var chapter = session.kind === "duel" ? 1 : PS.state.get().chapter;
    // "begin" goes first: the battle may send the friend's first cards straight away
    PS.net.send("begin", { kind: session.kind, chapter: chapter, duelMode: session.duelMode, host: loadout() }, true);
    PS.ui.startTogether({
      guest: false, kind: session.kind, chapter: chapter, duelMode: session.duelMode,
      ally: allyLoad, name: myName(), relay: view.link !== "direct"
    });
  }

  /** Done playing together: close the room and forget the session. */
  function leave() {
    PS.net.leave();
    PS.B.mpHooks.send = null;
    reset();
  }

  PS.multi = {
    open: open,
    close: close,
    leave: leave,
    active: function () {
      return Boolean(session);
    }
  };
})();
