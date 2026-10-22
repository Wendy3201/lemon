/*!
 * Pip Survivors — accounts and the leaderboard
 * Signing up and logging in with a name and a password (through Supabase),
 * sending this player's best figures, and reading everyone's back. The table
 * and the rules that guard it are in supabase/setup.sql.
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function () {
  "use strict";

  var PS = window.PS;

  // The project and its publishable key are meant to be public: the table's
  // rules (supabase/setup.sql) are what keep the data safe, not this key.
  var URL = "https://ownmhmcbdigpzcldpvle.supabase.co";
  var KEY = "sb_publishable_kzN7txAU_itQCE8zYc_ySA_hrgl21JS";
  // Supabase signs people in by email, so a name becomes name@DOMAIN. The
  // .invalid ending is reserved: no mail can ever go there.
  var DOMAIN = "players.pipsurvivors.invalid";
  var KEY_LAST = "lemon:cloud:last"; // who last signed in on this device, for playing offline
  var MIN_PASSWORD = 6;
  var SEND_AFTER = 3000; // how long the save has to sit still before the figures go up
  var CACHE_FOR = 30000;
  var LIMIT = 500;
  /* The Duels column came later: until the owner runs the newer setup.sql the
     server has no such column, and everything else carries on without it. */
  var duelsOk = true;

  function figureList() {
    return "chapter, power, endless, kills, challenges, collection" + (duelsOk ? ", duels" : "");
  }

  function fieldList() {
    return "id, name, " + figureList() + ", created_at, updated_at, admin, banned_until, ban_message";
  }

  /** Is this the server saying it has no Duels column yet? Then stop asking for it. */
  function noDuels(error) {
    if (!duelsOk || !error) return false;
    var code = error.code || "";
    var text = String(error.message || "");
    if ((code === "42703" || code === "PGRST204") && text.indexOf("duels") !== -1) {
      duelsOk = false;
      return true;
    }
    return false;
  }
  var DOWN = "Can't reach the server. Check your connection and try again.";
  var KEY_BAN = "lemon:cloud:ban"; // the last ban seen on this device, so playing offline cannot dodge it

  /* The ranks, lowest first. Each board says what its figure must reach for
     Bronze up to Zenith; anything below Bronze is Unranked. */
  var TIERS = [
    { key: "unranked", name: "Unranked" },
    { key: "bronze", name: "Bronze" },
    { key: "silver", name: "Silver" },
    { key: "gold", name: "Gold" },
    { key: "diamond", name: "Diamond" },
    { key: "platinum", name: "Platinum" },
    { key: "citrine", name: "Citrine" },
    { key: "zenith", name: "Zenith" }
  ];
  // Chapter ranks, and Power ranks at the Power those chapters recommend, so the two agree
  var RANK_CHAPTERS = [1, 10, 25, 40, 60, 80, 100];

  /* What the leaderboard can rank by. `then` breaks ties; `max` matches the
     limits in setup.sql, so a figure the server would refuse is never sent. */
  var BOARDS = [
    { key: "chapter", name: "Chapter", icon: "tabBattle", text: "Furthest chapter cleared on your save now", then: "power", max: 1000, ranks: RANK_CHAPTERS },
    { key: "power", name: "Power", icon: "power", text: "Power right now, with what you are wearing", then: "chapter", max: 1e12,
      ranks: RANK_CHAPTERS.map(function (n) { return PS.chapter(n).rec; }) },
    { key: "endless", name: "Endless", icon: "clock", text: "Longest endless swarm survived", then: "power", max: 604800,
      ranks: [60, 180, 300, 480, 720, 960, 1200] },
    { key: "kills", name: "Pests", icon: "skull", text: "Pests squashed in all", then: "power", max: 1e12,
      ranks: [100, 1000, 5000, 15000, 40000, 100000, 250000] },
    { key: "challenges", name: "Challenges", icon: "gift", text: "Daily challenges won", then: "power", max: 1e6,
      ranks: [1, 3, 7, 14, 30, 60, 100] },
    { key: "collection", name: "Collection", icon: "book", text: "Items in your collection now", then: "power", max: 1e6,
      ranks: [10, 50, 100, 200, 300, 450, PS.ITEM_ORDER.length] },
    { key: "duels", name: "Duels", icon: "atk", text: "Arena duels won against friends", then: "power", max: 1e6,
      ranks: [1, 3, 7, 15, 30, 60, 100] }
  ];
  var SPANS = [
    { key: "all", name: "All time" },
    { key: "week", name: "This week" },
    { key: "today", name: "Today" }
  ];

  var client = null;
  try {
    if (window.supabase && typeof window.supabase.createClient === "function") {
      client = window.supabase.createClient(URL, KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
    }
  } catch (err) {
    client = null;
  }

  var me = null; // { id, name, joined } of whoever is playing, or null
  var offline = false; // playing without the server
  var sent = ""; // the figures last sent, as text, so the same ones are not sent twice
  var timer = 0;
  var cache = {}; // "board:span" -> { at, rows }
  var stored = null; // this player's figures as the server holds them, once known

  function noop() {}

  function boardOf(key) {
    for (var i = 0; i < BOARDS.length; i++) if (BOARDS[i].key === key) return BOARDS[i];
    return BOARDS[0];
  }

  /** A figure as the leaderboard shows it. */
  function show(key, value) {
    if (key === "chapter") return "Chapter " + value;
    if (key === "endless") return PS.clock(value);
    if (key === "collection") return PS.fmt(value) + " / " + PS.fmt(PS.ITEM_ORDER.length);
    return PS.fmt(value);
  }

  /** 0 (Unranked) to 7 (Zenith): the rank a figure earns on a board. */
  function tierOf(key, value) {
    var ranks = boardOf(key).ranks;
    var tier = 0;
    for (var i = 0; i < ranks.length; i++) if (value >= ranks[i]) tier = i + 1;
    return tier;
  }

  /** A figure written short, for the rank ladder: "25", "2.59M", "5:00". */
  function short(key, value) {
    return key === "endless" ? PS.clock(value) : PS.fmt(value);
  }

  function nameProblem(name) {
    if (!name) return "Type a name.";
    if (name.length < 3) return "Names need at least 3 characters.";
    if (name.length > 16) return "Names can be 16 characters at most.";
    if (!/^[A-Za-z0-9_]+$/.test(name)) return "Names can only use letters, numbers and _.";
    return "";
  }

  function emailFor(name) {
    return name.toLowerCase() + "@" + DOMAIN;
  }

  function isDown(error) {
    if (!error) return false;
    var text = String(error.message || error);
    return error.name === "AuthRetryableFetchError" || error.status === 0 || /fetch|network|load failed|timed? ?out/i.test(text);
  }

  /** Turn whatever went wrong into something a player can act on. */
  function why(error) {
    if (!error) return "";
    if (isDown(error)) return DOWN;
    var code = String(error.code || "");
    var text = String(error.message || "");
    if (code === "invalid_credentials" || /invalid login/i.test(text)) return "That name and password don't match.";
    if (code === "user_already_exists" || code === "email_exists" || /already registered/i.test(text)) return "That name is taken. Pick another one.";
    if (code === "weak_password" || /password should/i.test(text)) return "Passwords need at least " + MIN_PASSWORD + " characters.";
    // Supabase only sends (and runs out of) email while Confirm email is on
    if (code === "email_not_confirmed" || code === "over_email_send_rate_limit" || /not confirmed|email rate limit/i.test(text)) {
      return "The server is waiting for an email check, so nobody can log in yet. (Game owner: switch off Confirm email in Supabase.)";
    }
    if (code === "over_request_rate_limit" || error.status === 429) return "The server is busy. Wait a minute, then try again.";
    if (code === "signup_disabled") return "New accounts are switched off right now.";
    if (code === "email_address_invalid" || /database error/i.test(text)) return "That name can't be used. Try another one.";
    if (code === "PGRST205" || code === "42P01") return "The leaderboard isn't set up yet. (Game owner: run supabase/setup.sql.)";
    if (code === "42703" || code === "PGRST202" || code === "PGRST204") return "The server needs an update. (Game owner: run supabase/setup.sql again.)";
    return text || "Something went wrong. Try again.";
  }

  function failed(error) {
    return { error: why(error), down: isDown(error) };
  }

  /** A row's ban or timeout, if it is still running: { until (ms, Infinity for good), message, timeout }. */
  function banOf(row) {
    if (!row || !row.banned_until) return null;
    var until = row.banned_until === "infinity" ? Infinity : new Date(row.banned_until).getTime();
    if (!(until > Date.now())) return null;
    return { until: until, message: String(row.ban_message || ""), timeout: until !== Infinity };
  }

  function remember(ban) {
    if (!me) return;
    if (ban) {
      PS.store.set(KEY_BAN, { id: me.id, until: ban.timeout ? ban.until : null, message: ban.message });
    } else {
      var held = PS.store.get(KEY_BAN, null);
      if (held && held.id === me.id) PS.store.remove(KEY_BAN);
    }
  }

  function adopt(user, row) {
    var meta = user.user_metadata || {};
    me = {
      id: user.id,
      name: (row && row.name) || meta.name || String(user.email || "player").split("@")[0],
      joined: (row && row.created_at) || user.created_at || "",
      admin: Boolean(row && row.admin)
    };
    offline = false;
    sent = "";
    cache = {};
    stored = row ? keepFigures(row) : null;
    PS.store.set(KEY_LAST, { id: me.id, name: me.name, joined: me.joined, admin: me.admin });
    me.ban = banOf(row);
    remember(me.ban);
    PS.emit("cloud");
    clearTimeout(timer);
    timer = setTimeout(push, SEND_AFTER); // the board gets this save's figures, even before anything changes
    return me;
  }

  /** The player's row: the name as they typed it, when they joined, admin, and any ban. */
  function fetchRow(user) {
    var ask = function () {
      return client.from("players").select("name, created_at, admin, banned_until, ban_message, " + figureList()).eq("id", user.id).maybeSingle();
    };
    return ask().then(function (res) {
      return res.error && noDuels(res.error) ? ask() : res;
    }).then(
      function (res) { return adopt(user, res.data); },
      function () { return adopt(user, null); }
    );
  }

  /* ------------------------------------------------------- the figures */

  function figures() {
    var st = PS.state;
    var S = st.get();
    var raw = {
      chapter: S.best,
      power: st.calc().power, // current Power, so it can go down as well as up
      endless: S.endless.best,
      kills: S.stats.kills,
      challenges: S.challenge.count,
      collection: st.bookInfo().found,
      duels: S.stats.duels || 0
    };
    var out = {};
    BOARDS.forEach(function (board) {
      out[board.key] = Math.max(0, Math.min(board.max, Math.floor(Number(raw[board.key]) || 0)));
    });
    return out;
  }

  // the figures that show the save as it is now, and so can go down; the
  // others are the best the server has seen
  var CURRENT = ["chapter", "power", "collection"];

  function keepFigures(row) {
    var out = {};
    BOARDS.forEach(function (board) { out[board.key] = Number(row[board.key]) || 0; });
    return out;
  }

  /** Send the figures if they changed since last time. Never fails loudly:
   *  what did not go up goes up with the next change. */
  function push() {
    clearTimeout(timer);
    timer = 0;
    if (!client || !me || offline || PS.cloud.ban()) return Promise.resolve();
    var now = figures();
    if (!duelsOk) delete now.duels;
    var text = JSON.stringify(now);
    if (text === sent) return Promise.resolve();
    var id = me.id;
    return client.from("players").update(now).eq("id", id).select(figureList()).then(function (res) {
      // an older server without the Duels column: send again without it
      if (res.error && noDuels(res.error)) return push();
      if (res.error || !me || me.id !== id) return;
      cache = {};
      if (res.data && res.data[0]) stored = keepFigures(res.data[0]);
      // If the server kept something else (an older copy of setup.sql only lets
      // figures go up), it does not count as sent, so the next push tries again.
      var kept = res.data && res.data[0];
      var same = !kept || CURRENT.every(function (key) { return Number(kept[key]) === now[key]; });
      sent = same ? text : "";
    }, noop);
  }

  PS.on("change", function () {
    if (me && !offline && !timer) timer = setTimeout(push, SEND_AFTER);
  });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") push();
  });

  if (client) {
    // signed out from somewhere else (or the session ran out): stop sending
    client.auth.onAuthStateChange(function (event) {
      if (event === "SIGNED_OUT" && me && !offline) {
        me = null;
        PS.emit("cloud");
      }
    });
  }

  function moderate(name, args) {
    if (!client || !me || offline) return Promise.resolve({ error: DOWN, down: true });
    return client.rpc(name, args).then(function (res) {
      if (res.error) return failed(res.error);
      cache = {};
      return {};
    }, failed);
  }

  /* -------------------------------------------------------- the board */

  function spanStart(span) {
    if (span === "today") {
      var midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      return midnight.toISOString();
    }
    if (span === "week") return new Date(Date.now() - 7 * 864e5).toISOString();
    return null;
  }

  /** Number the rows; players on the same figure share a place. */
  function ranked(rows, key) {
    var place = 0;
    rows.forEach(function (row, i) {
      if (i === 0 || row[key] !== rows[i - 1][key]) place = i + 1;
      row.rank = place;
    });
    return rows;
  }

  PS.cloud = {
    BOARDS: BOARDS,
    SPANS: SPANS,
    MIN_PASSWORD: MIN_PASSWORD,
    LIMIT: LIMIT,
    TIERS: TIERS,
    boardOf: boardOf,
    show: show,
    short: short,
    tierOf: tierOf,
    figures: figures,
    /** This player's figures as the server last said it holds them, or null. */
    held: function () {
      return me ? stored : null;
    },
    /** Whether a board shows the save as it is now (and so can go down). */
    isCurrent: function (key) {
      return CURRENT.indexOf(key) !== -1;
    },
    nameProblem: nameProblem,
    ready: function () {
      return Boolean(client);
    },
    /** The Supabase client, for net.js (rooms for playing together). */
    client: function () {
      return client;
    },
    me: function () {
      return me;
    },
    /** Admin accounts are ticked "admin" in the players table (setup.sql). */
    isAdmin: function () {
      return Boolean(me && me.admin);
    },
    /** This player's ban or timeout, while it lasts. */
    ban: function () {
      if (me && me.ban && !(me.ban.until > Date.now())) me.ban = null;
      return me ? me.ban || null : null;
    },
    banOf: banOf,

    /** Ask the server again whether this player is banned. Resolves with the ban or null. */
    status: function () {
      if (!client || !me || offline) return Promise.resolve(PS.cloud.ban());
      var id = me.id;
      return client.from("players").select("admin, banned_until, ban_message").eq("id", id).maybeSingle().then(function (res) {
        if (!res.error && res.data && me && me.id === id) {
          me.admin = Boolean(res.data.admin);
          me.ban = banOf(res.data);
          remember(me.ban);
        }
        return PS.cloud.ban();
      }, function () { return PS.cloud.ban(); });
    },

    /** Pick up the gifts waiting for this player; each comes once. Resolves with a list. */
    claimGifts: function () {
      if (!client || !me || offline) return Promise.resolve([]);
      var id = me.id;
      return client.rpc("pip_claim_gifts").then(function (res) {
        return !res.error && Array.isArray(res.data) && me && me.id === id ? res.data : [];
      }, function () { return []; });
    },

    /* The admin tools. Each resolves with {} or { error }. The server checks
       that the caller is an admin, so these do nothing for anyone else. */
    banPlayer: function (target, minutes, message) {
      return moderate("pip_ban", { target: target, minutes: Math.max(0, Math.floor(minutes || 0)), message: message || "" });
    },
    unbanPlayer: function (target) {
      return moderate("pip_unban", { target: target });
    },
    give: function (target, gift) {
      return moderate("pip_give", {
        target: target,
        kind: gift.kind,
        item: gift.kind === "item" ? gift.item : null,
        rarity: gift.kind === "item" ? gift.rarity || 0 : 0,
        amount: gift.kind === "item" ? 0 : Math.max(0, Math.floor(gift.amount || 0)),
        message: gift.message || ""
      });
    },
    offline: function () {
      return offline;
    },

    /** Pick up a session kept from last time. Resolves with { down, error }
     *  when the server cannot be reached; PS.cloud.me() says who is in. */
    start: function () {
      if (!client) return Promise.resolve({ down: true, error: DOWN });
      return client.auth.getSession().then(function (res) {
        var session = res.data && res.data.session;
        if (session) return fetchRow(session.user).then(function () { return {}; });
        return res.error ? failed(res.error) : {};
      }, failed);
    },

    signUp: function (name, password) {
      name = String(name || "").trim();
      var problem = nameProblem(name) || (String(password || "").length < MIN_PASSWORD ? "Passwords need at least " + MIN_PASSWORD + " characters." : "");
      if (problem) return Promise.resolve({ error: problem });
      if (!client) return Promise.resolve({ error: DOWN, down: true });
      return client.auth.signUp({ email: emailFor(name), password: password, options: { data: { name: name } } }).then(function (res) {
        if (res.error) return failed(res.error);
        if (!res.data || !res.data.session) return failed({ code: "email_not_confirmed" });
        return fetchRow(res.data.user).then(function () { return {}; });
      }, failed);
    },

    signIn: function (name, password) {
      name = String(name || "").trim();
      if (!name || !password) return Promise.resolve({ error: "Type your name and your password." });
      if (nameProblem(name)) return Promise.resolve({ error: "That name and password don't match." });
      if (!client) return Promise.resolve({ error: DOWN, down: true });
      return client.auth.signInWithPassword({ email: emailFor(name), password: password }).then(function (res) {
        if (res.error) return failed(res.error);
        return fetchRow(res.data.user).then(function () { return {}; });
      }, failed);
    },

    /** Send what is waiting, then sign out on this device only. */
    signOut: function () {
      var online = Boolean(client && me && !offline);
      return (online ? push() : Promise.resolve()).then(function () {
        me = null;
        offline = false;
        sent = "";
        cache = {};
        PS.store.remove(KEY_LAST);
        PS.emit("cloud");
        return online ? client.auth.signOut({ scope: "local" }).then(noop, noop) : null;
      });
    },

    /** Play without the server, as whoever was last signed in here (if anyone). */
    playOffline: function () {
      var last = PS.store.get(KEY_LAST, null);
      me = last && typeof last.id === "string" && typeof last.name === "string" ? last : null;
      var held = PS.store.get(KEY_BAN, null);
      if (me && held && held.id === me.id) {
        var until = held.until === null ? Infinity : Number(held.until);
        me.ban = until > Date.now() ? { until: until, message: String(held.message || ""), timeout: until !== Infinity } : null;
      }
      offline = true;
      PS.emit("cloud");
      return me;
    },

    sync: push,

    /** The leaderboard for one figure, best first, limited to players who
     *  played in `span` ("all", "week" or "today"). Resolves with { rows }
     *  or { rows: [], error }. */
    board: function (key, span, fresh) {
      var board = boardOf(key);
      var id = board.key + ":" + span;
      var hit = cache[id];
      if (hit && !fresh && Date.now() - hit.at < CACHE_FOR) return Promise.resolve({ rows: hit.rows, banned: hit.banned });
      if (!client || !me || offline) return Promise.resolve({ rows: [], error: DOWN, down: true });
      var since = spanStart(span);
      // your own figures go up first, so your row is the save you have now
      if (board.key === "duels" && !duelsOk) {
        return Promise.resolve({ rows: [], error: "The server needs an update for duels. (Game owner: run supabase/setup.sql again.)" });
      }
      var ask = function () {
        var query = client.from("players").select(fieldList()).gt(board.key, 0);
        if (since) query = query.gte("updated_at", since);
        return query
          .order(board.key, { ascending: false })
          .order(board.then, { ascending: false })
          .order("name", { ascending: true })
          .limit(LIMIT);
      };
      return push().then(ask).then(function (res) {
        // no Duels column yet: the other boards ask again without it
        return res.error && noDuels(res.error) && board.key !== "duels" ? ask() : res;
      }).then(function (res) {
        if (res.error) {
          var out = failed(res.error);
          out.rows = [];
          return out;
        }
        // banned and timed-out players (only admins get them back) are kept off the ranking
        var all = res.data || [];
        var rows = ranked(all.filter(function (row) { return !banOf(row); }), board.key);
        var banned = all.filter(function (row) { return Boolean(banOf(row)); });
        cache[id] = { at: Date.now(), rows: rows, banned: banned };
        return { rows: rows, banned: banned };
      }, function (err) {
        var out = failed(err);
        out.rows = [];
        return out;
      });
    }
  };
})();
