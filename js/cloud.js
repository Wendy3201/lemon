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

  // likewise the "shown" column (what an admin made the board show instead of a figure)
  var shownOk = true;

  function fieldList() {
    return "id, name, " + figureList() + ", created_at, updated_at, admin, banned_until, ban_message" + (shownOk ? ", shown" : "");
  }

  /** Is this the server saying it has no Duels (or "shown") column yet? Then stop asking for it. */
  function noDuels(error) {
    if (!error) return false;
    var code = error.code || "";
    var text = String(error.message || "");
    if (code !== "42703" && code !== "PGRST204") return false;
    if (duelsOk && text.indexOf("duels") !== -1) {
      duelsOk = false;
      return true;
    }
    if (shownOk && text.indexOf("shown") !== -1) {
      shownOk = false;
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

  /* The inventory admins can look at: sent now and then, not on every change. */
  var INV_EVERY = 30000; // at most this often
  var INV_BAG = 3000; // the best items in the bag that are sent; the count is always the real one
  var invSent = ""; // the inventory last sent, as text
  var invAt = 0;
  var invTimer = 0;
  var invOk = true; // false once the server turns out not to have inventories yet

  /* Whether this game is open, for the admins' "online" dots. */
  var seenOk = true; // false once the server turns out not to have it yet
  var seenAt = 0;
  var seenDoing = "";
  var token = ""; // the signed-in player's access token, for the last word when the page closes

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
    invSent = "";
    invAt = 0;
    seenAt = 0;
    seenDoing = "";
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

  /** What this player owns, short, for the admins' inventory view: worn gear
   *  [id, rarity, slot level], the bag [id, rarity] best first, and pets
   *  [species, rarity, level, on the team]. */
  function inventory() {
    var st = PS.state;
    var S = st.get();
    var worn = {};
    PS.SLOTS.forEach(function (slot) {
      var item = st.equipped(slot.key);
      worn[slot.key] = item ? [item.id, item.r, S.lv[slot.key]] : null;
    });
    var bag = st.tradeable().items;
    return {
      v: 1,
      gold: S.gold,
      gems: S.gems,
      shards: S.shards,
      power: st.calc().power,
      best: S.best,
      worn: worn,
      bagCount: bag.length,
      bag: bag.slice(0, INV_BAG).map(function (item) { return [item.id, item.r]; }),
      pets: S.pets.map(function (pet) { return [pet.sp, pet.r, pet.lv, S.petTeam.indexOf(pet.u) !== -1 ? 1 : 0]; }),
      petSlots: S.petSlots
    };
  }

  /** Send the inventory if it changed, at most every INV_EVERY (`now` skips the wait). */
  function pushInventory(now) {
    clearTimeout(invTimer);
    invTimer = 0;
    if (!client || !me || offline || !invOk || PS.cloud.ban()) return Promise.resolve();
    var wait = INV_EVERY - (Date.now() - invAt);
    if (!now && wait > 0) {
      invTimer = setTimeout(function () { pushInventory(true); }, wait);
      return Promise.resolve();
    }
    var data = inventory();
    var text = JSON.stringify(data);
    if (text === invSent) return Promise.resolve();
    invAt = Date.now();
    var id = me.id;
    return client.rpc("pip_put_inventory", { inv: data }).then(function (res) {
      if (res.error) {
        // an older server without inventories: stop asking until the next page load
        if (res.error.code === "PGRST202" || res.error.code === "42883") invOk = false;
        return;
      }
      if (me && me.id === id) invSent = text;
    }, noop);
  }

  /** A server function called so that it still goes through while the page
   *  closes (a keepalive request). False if it could not even be sent. */
  function lastWord(fn, args) {
    if (!client || !me || offline || !token || !window.fetch) return false;
    try {
      window.fetch(URL + "/rest/v1/rpc/" + fn, {
        method: "POST",
        keepalive: true,
        headers: { apikey: KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(args)
      }).catch(noop);
      return true;
    } catch (err) {
      return false;
    }
  }

  // a keepalive request can carry about 64 KB, so a huge bag is cut to fit (best items kept)
  var LAST_WORD_MAX = 60000;

  /** The inventory once more as the game goes into the background or closes,
   *  so what admins see while this player is offline is how they left it. */
  function inventoryOnLeave() {
    clearTimeout(invTimer);
    invTimer = 0;
    if (!client || !me || offline || !invOk || PS.cloud.ban()) return;
    var data = inventory();
    var text = JSON.stringify(data);
    if (text === invSent) return;
    var body = data;
    while (JSON.stringify({ inv: body }).length > LAST_WORD_MAX && body.bag.length) {
      var cut = {};
      for (var key in body) cut[key] = body[key];
      cut.bag = body.bag.slice(0, Math.floor(body.bag.length * 0.7));
      body = cut;
    }
    if (lastWord("pip_put_inventory", { inv: body })) {
      // a cut-down copy does not count as sent: the whole one goes next time the game is open
      invSent = body === data ? text : "";
      invAt = Date.now();
    }
  }

  /** Send the figures if they changed since last time. Never fails loudly:
   *  what did not go up goes up with the next change. */
  function push() {
    clearTimeout(timer);
    timer = 0;
    if (!client || !me || offline || PS.cloud.ban()) return Promise.resolve();
    pushInventory(false);
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
    if (document.visibilityState === "hidden") {
      push();
      inventoryOnLeave();
    }
  });

  if (client) {
    // signed out from somewhere else (or the session ran out): stop sending
    client.auth.onAuthStateChange(function (event, session) {
      token = session && session.access_token ? session.access_token : "";
      if (event === "SIGNED_OUT" && me && !offline) {
        me = null;
        PS.emit("cloud");
      }
    });
  }

  function noServerFunction(error) {
    return Boolean(error && (error.code === "PGRST202" || error.code === "42883"));
  }

  /** Tell the server this game is open (here) or closing, and what it is doing.
   *  Never fails loudly; the same news twice within 20 seconds is not sent again. */
  function seen(here, doing) {
    if (!client || !me || offline || !seenOk) return Promise.resolve();
    doing = here ? String(doing || "") : "";
    if (here && doing === seenDoing && Date.now() - seenAt < 20000) return Promise.resolve();
    seenAt = here ? Date.now() : 0;
    seenDoing = doing;
    return client.rpc("pip_seen", { here: Boolean(here), doing: doing }).then(function (res) {
      if (res.error && noServerFunction(res.error)) seenOk = false;
    }, noop);
  }

  // closing the page: the inventory as it is now, and a last word that the game is
  // gone, so it shows offline at once (without it, the admins' view notices after
  // two minutes anyway)
  window.addEventListener("pagehide", function () {
    inventoryOnLeave();
    if (seenOk) lastWord("pip_seen", { here: false, doing: "" });
    seenAt = 0;
    seenDoing = "";
  });

  function moderate(name, args) {
    if (!client || !me || offline) return Promise.resolve({ error: DOWN, down: true });
    return client.rpc(name, args).then(function (res) {
      if (res.error) return failed(res.error);
      cache = {};
      return {};
    }, failed);
  }

  /** A server function for a signed-in player. Resolves with { data } or { error, down }. */
  function ask(name, args) {
    if (!client || !me || offline) return Promise.resolve({ error: "Trading needs an account and the internet.", down: true });
    return client.rpc(name, args || {}).then(function (res) {
      return res.error ? failed(res.error) : { data: res.data };
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

    /** Pick up what an admin is taking away from this player; each comes once.
     *  Resolves with a list of { kind, item, rarity, amount (0: all of it), message }. */
    claimTakes: function () {
      if (!client || !me || offline) return Promise.resolve([]);
      var id = me.id;
      return client.rpc("pip_claim_takes").then(function (res) {
        return !res.error && Array.isArray(res.data) && me && me.id === id ? res.data : [];
      }, function () { return []; });
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
    seen: seen,

    /** For admins: who has the game open. Resolves with { map: { id: { online, doing, seconds } } }
     *  (seconds since the game was last heard from) or { error }. */
    presence: function () {
      if (!client || !me || offline) return Promise.resolve({ error: DOWN, down: true });
      return client.rpc("pip_presence").then(function (res) {
        if (res.error) return failed(res.error);
        var map = {};
        (Array.isArray(res.data) ? res.data : []).forEach(function (row) {
          if (row && typeof row.player === "string") {
            map[row.player] = { online: row.online === true, doing: String(row.doing || ""), seconds: Math.max(0, Number(row.seconds) || 0) };
          }
        });
        return { map: map };
      }, failed);
    },

    /** For admins: what a player owns, as their game last sent it.
     *  Resolves with { data, at } (data null if nothing came yet) or { error }. */
    inventoryOf: function (id) {
      if (!client || !me || offline) return Promise.resolve({ error: DOWN, down: true });
      return client.from("inventories").select("data, updated_at").eq("player", id).maybeSingle().then(function (res) {
        if (res.error) return failed(res.error);
        return { data: res.data ? res.data.data : null, at: res.data ? res.data.updated_at : null };
      }, failed);
    },

    /* Trading. The server holds both offers (setup.sql explains the rules);
       each resolves with { data: the trade as this player sees it } or { error }. */
    tradeOpen: function () { return ask("pip_trade_open"); },
    tradeJoin: function (code) { return ask("pip_trade_join", { join_code: String(code || "") }); },
    tradeState: function (id) { return ask("pip_trade_state", { trade_id: id }); },
    tradeOffer: function (id, offer) { return ask("pip_trade_offer", { trade_id: id, offer: offer }); },
    tradeAccept: function (id, version, ok) { return ask("pip_trade_accept", { trade_id: id, seen_version: version, ok: Boolean(ok) }); },
    tradeLeave: function (id) { return ask("pip_trade_cancel", { trade_id: id }); },
    tradeGot: function (id) { return ask("pip_trade_got", { trade_id: id }); },
    /** Finished trades this game has not picked up yet: { data: [trade, ...] }. */
    tradePending: function () { return ask("pip_trade_pending"); },

    /* Co-op and the arena: an admin who joins someone else's room proves to
       that game that they are an admin, through the server. */
    devToken: function () { return ask("pip_dev_token"); },
    checkDevToken: function (token) {
      if (typeof token !== "string" || !/^[0-9a-f-]{36}$/i.test(token)) return Promise.resolve(false);
      return ask("pip_dev_check", { check_token: token }).then(function (res) { return res.data === true; });
    },

    /** Change the banner above the top bar for everyone ('' hides it, null
     *  goes back to the text in index.html). Admins only, checked by the server. */
    setBanner: function (text) {
      return moderate("pip_set_banner", { new_text: text === null ? null : String(text) });
    },

    /** The banner as the owner last set it. Needs no account. Resolves with
     *  { text, at } (text null: use the one in index.html) or { error }. */
    banner: function () {
      if (!client) return Promise.resolve({ error: DOWN, down: true });
      return client.from("banner").select("message, updated_at").limit(1).maybeSingle().then(function (res) {
        if (res.error) return failed(res.error);
        var row = res.data;
        return { text: row && typeof row.message === "string" ? row.message : null, at: row ? row.updated_at : null };
      }, failed);
    },
    /** Take gold, gems or gear away from a player (amount 0: all of it). Their
     *  game does it when it next checks in, online or the next time they play. */
    take: function (target, t) {
      return moderate("pip_take", {
        target: target,
        kind: t.kind,
        item: t.kind === "item" ? t.item : null,
        rarity: t.kind === "item" ? t.rarity || 0 : 0,
        amount: Math.max(0, Math.floor(t.amount || 0)),
        message: t.message || ""
      });
    },
    /** What is still waiting to be taken from a player: { rows } or { error }. */
    takesWaiting: function (target) {
      if (!client || !me || offline) return Promise.resolve({ error: DOWN, down: true });
      return client.rpc("pip_takes_waiting", { target: target }).then(function (res) {
        return res.error ? failed(res.error) : { rows: Array.isArray(res.data) ? res.data : [] };
      }, failed);
    },
    /** Make the leaderboard show any number or text for one of a player's figures ('' undoes it). */
    setShown: function (target, figure, text) {
      return moderate("pip_set_shown", { target: target, figure: figure, shown_as: String(text || "") });
    },
    /** What the board shows for a figure: the admin's text if there is one, else the figure. */
    shownAs: function (row, key) {
      var t = row && row.shown && typeof row.shown === "object" ? row.shown[key] : null;
      return typeof t === "string" && t ? t.slice(0, 24) : show(key, row ? row[key] : 0);
    },
    cancelTake: function (id) {
      return moderate("pip_take_cancel", { take_id: id });
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

    /** Change this player's name, and the login with it (same password).
     *  If the login cannot follow, the name goes back. Resolves with {} or { error }. */
    rename: function (name) {
      name = String(name || "").trim();
      var problem = nameProblem(name);
      if (problem) return Promise.resolve({ error: problem });
      if (!client || !me || offline) return Promise.resolve({ error: DOWN, down: true });
      var old = me.name;
      if (name === old) return Promise.resolve({});
      return client.rpc("pip_rename", { new_name: name }).then(function (res) {
        if (res.error) return failed(res.error);
        return client.auth.updateUser({ email: emailFor(name), data: { name: name } }).then(function (u) {
          var email = u && u.data && u.data.user ? String(u.data.user.email || "").toLowerCase() : "";
          if (u.error || email !== emailFor(name)) {
            // the login stayed as it was: so does the name
            return client.rpc("pip_rename", { new_name: old }).then(function () {
              return { error: "Your login could not be changed, so your name is still " + old + ". Try again later." };
            }, function () {
              return { error: "Your login could not be changed. Log in with your old name, " + old + "." };
            });
          }
          me.name = name;
          PS.store.set(KEY_LAST, { id: me.id, name: me.name, joined: me.joined, admin: me.admin });
          cache = {};
          PS.emit("cloud");
          return {};
        }, failed);
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
      return (online ? Promise.all([push(), pushInventory(true), seen(false)]) : Promise.resolve()).then(function () {
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
        return res.error && noDuels(res.error) && (board.key !== "duels" || duelsOk) ? ask() : res;
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
