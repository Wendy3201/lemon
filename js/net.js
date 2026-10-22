/*!
 * Pip Survivors — linking two games
 * Two players find each other through a room on the Supabase server (its
 * Realtime messages): one makes a room and gets a code, the other types the
 * code in. Then the two browsers link up directly (WebRTC), so the battle
 * itself does not use the server's monthly allowance of messages. When the
 * two cannot reach each other directly (some school, office or phone
 * networks), everything goes through the room instead.
 *
 *   PS.net.host(info)        -> Promise of the room's code
 *   PS.net.join(code, info)  -> Promise of the host's info
 *   PS.net.send(type, data, sure)   sure: must arrive, and in order
 *   PS.net.on(type, fn)      messages by type, and "peer", "link", "left"
 *   PS.net.leave()
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function () {
  "use strict";

  var PS = window.PS;

  var ICE = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  var DIRECT_WAIT = 7000; // how long to try a direct link before settling for the room
  var FIND_WAIT = 8000; // how long a guest looks for the room's host
  var QUIET = 12000; // nothing at all from the other side for this long: they have gone
  var CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I to mix up
  var CODE_LENGTH = 6;

  var room = null;
  var handlers = {};
  var me = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  function emit(type, data) {
    var list = handlers[type];
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      try {
        list[i](data);
      } catch (err) {
        if (window.console) console.error(err);
      }
    }
  }

  function client() {
    return PS.cloud && PS.cloud.client ? PS.cloud.client() : null;
  }

  function makeCode() {
    var out = "";
    var bytes = new Uint8Array(CODE_LENGTH);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
    else for (var j = 0; j < CODE_LENGTH; j++) bytes[j] = Math.floor(Math.random() * 256);
    for (var i = 0; i < CODE_LENGTH; i++) out += CODE_CHARS.charAt(bytes[i] % CODE_CHARS.length);
    return out;
  }

  function cleanCode(code) {
    return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);
  }

  /* ------------------------------------------------------ the room */

  function signal(kind, data) {
    if (!room || !room.channel) return;
    var payload = { from: me, kind: kind };
    for (var key in data) payload[key] = data[key];
    room.channel.send({ type: "broadcast", event: "sig", payload: payload });
  }

  function openRoom(code, role, info) {
    var c = client();
    if (!c) return Promise.reject(new Error("Playing together needs the internet (and the game's server)."));
    leave();
    room = {
      code: code, role: role, info: info || {}, partner: null, partnerInfo: null,
      link: "room", peer: null, fast: null, sure: null, heardAt: Date.now(), timers: [], queue: [],
      channel: c.channel("pip-room-" + code, { config: { broadcast: { self: false, ack: false } } })
    };
    var r = room;
    r.channel.on("broadcast", { event: "sig" }, function (msg) {
      if (room === r) onSignal(msg.payload || {});
    });
    r.channel.on("broadcast", { event: "g" }, function (msg) {
      if (room !== r) return;
      var m = msg.payload || {};
      if (m.from !== r.partner) return;
      r.heardAt = Date.now();
      deliver(m.t, m.d);
    });
    return new Promise(function (resolve, reject) {
      var settled = false;
      var giveUp = setTimeout(function () {
        if (settled) return;
        settled = true;
        reject(new Error("Couldn't reach the server. Check your connection and try again."));
      }, 9000);
      r.timers.push(giveUp);
      r.channel.subscribe(function (status) {
        if (settled) return;
        if (status === "SUBSCRIBED") {
          settled = true;
          clearTimeout(giveUp);
          resolve(r);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          settled = true;
          clearTimeout(giveUp);
          reject(new Error("Couldn't open a room on the server. Try again in a moment."));
        }
      });
    });
  }

  function onSignal(m) {
    var r = room;
    if (!r || m.from === me) return;
    if (m.to && m.to !== me) return;
    if (r.partner && m.from === r.partner) r.heardAt = Date.now();

    if (r.role === "host") {
      if (m.kind === "hello") {
        if (r.partner && r.partner !== m.from) {
          signal("full", { to: m.from });
          return;
        }
        var first = !r.partner;
        r.partner = m.from;
        r.partnerInfo = m.info || {};
        r.heardAt = Date.now();
        signal("welcome", { to: m.from, info: r.info });
        if (first) {
          emit("peer", r.partnerInfo);
          startDirect(true);
        }
      } else if (m.from === r.partner) {
        if (m.kind === "answer") gotAnswer(m.sdp);
        else if (m.kind === "ice") gotIce(m.c);
        else if (m.kind === "bye") partnerGone();
        else if (m.kind === "ping") r.heardAt = Date.now();
      }
      return;
    }

    // the guest
    if (m.kind === "welcome" && !r.partner) {
      r.partner = m.from;
      r.partnerInfo = m.info || {};
      r.heardAt = Date.now();
      if (r.found) r.found(r.partnerInfo);
      emit("peer", r.partnerInfo);
    } else if (m.kind === "full" && !r.partner) {
      if (r.lost) r.lost(new Error("That room already has two players."));
    } else if (m.from === r.partner) {
      if (m.kind === "offer") gotOffer(m.sdp);
      else if (m.kind === "ice") gotIce(m.c);
      else if (m.kind === "bye") partnerGone();
      else if (m.kind === "ping") r.heardAt = Date.now();
    }
  }

  /* --------------------------------------------- the direct link (WebRTC) */

  function canDirect() {
    return typeof window.RTCPeerConnection === "function";
  }

  function makePeer() {
    var r = room;
    var pc = new RTCPeerConnection({ iceServers: ICE });
    r.peer = pc;
    pc.onicecandidate = function (e) {
      if (e.candidate && room === r) signal("ice", { to: r.partner, c: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate });
    };
    pc.onconnectionstatechange = function () {
      if (room !== r) return;
      if (pc.connectionState === "failed" || pc.connectionState === "closed") useRoom();
    };
    // nothing direct in time: the room carries the battle (and the direct link may still turn up)
    r.timers.push(setTimeout(function () {
      if (room === r && r.link !== "direct") setLink("room");
    }, DIRECT_WAIT));
    return pc;
  }

  function wire(dc) {
    var r = room;
    dc.onmessage = function (e) {
      if (room !== r) return;
      r.heardAt = Date.now();
      var m;
      try {
        m = JSON.parse(e.data);
      } catch (err) {
        return;
      }
      deliver(m.t, m.d);
    };
    dc.onopen = function () {
      if (room !== r) return;
      if (r.sure && r.sure.readyState === "open" && r.fast && r.fast.readyState === "open") setLink("direct");
    };
    dc.onclose = function () {
      if (room === r && r.link === "direct") useRoom();
    };
    if (dc.label === "fast") r.fast = dc;
    else r.sure = dc;
  }

  function startDirect(host) {
    if (!canDirect()) {
      setLink("room");
      return;
    }
    var r = room;
    try {
      var pc = makePeer();
      if (host) {
        wire(pc.createDataChannel("sure", { ordered: true }));
        wire(pc.createDataChannel("fast", { ordered: false, maxRetransmits: 0 }));
        pc.createOffer().then(function (offer) {
          return pc.setLocalDescription(offer);
        }).then(function () {
          if (room === r) signal("offer", { to: r.partner, sdp: pc.localDescription.toJSON ? pc.localDescription.toJSON() : pc.localDescription });
        }).catch(function () { useRoom(); });
      } else {
        pc.ondatachannel = function (e) { wire(e.channel); };
      }
    } catch (err) {
      useRoom();
    }
  }

  function gotOffer(sdp) {
    var r = room;
    if (!canDirect()) {
      setLink("room");
      return;
    }
    if (!r.peer) startDirect(false);
    var pc = r.peer;
    if (!pc) return;
    pc.setRemoteDescription(sdp).then(function () {
      flushIce();
      return pc.createAnswer();
    }).then(function (answer) {
      return pc.setLocalDescription(answer);
    }).then(function () {
      if (room === r) signal("answer", { to: r.partner, sdp: pc.localDescription.toJSON ? pc.localDescription.toJSON() : pc.localDescription });
    }).catch(function () { useRoom(); });
  }

  function gotAnswer(sdp) {
    var pc = room && room.peer;
    if (!pc) return;
    pc.setRemoteDescription(sdp).then(flushIce).catch(function () { useRoom(); });
  }

  function gotIce(c) {
    var pc = room && room.peer;
    if (!pc || !c) return;
    if (!pc.remoteDescription) {
      room.queue.push(c);
      return;
    }
    pc.addIceCandidate(c).catch(function () {});
  }

  function flushIce() {
    var pc = room && room.peer;
    if (!pc) return;
    var list = room.queue.splice(0);
    list.forEach(function (c) { pc.addIceCandidate(c).catch(function () {}); });
  }

  function setLink(link) {
    if (!room || room.link === link) return;
    room.link = link;
    emit("link", link);
  }

  /** The direct link broke or never came: carry on through the room. */
  function useRoom() {
    if (!room) return;
    setLink("room");
  }

  /* ------------------------------------------------------ messages */

  function deliver(type, data) {
    if (type === "ping") {
      // answered at once, so the other side can time the round trip
      if (data && data.at) send("pong", { at: data.at }, true);
      return;
    }
    if (type === "pong") {
      if (room && data && data.at) {
        var rtt = Date.now() - data.at;
        // smoothed, so one slow message does not make it jump
        room.ping = room.ping ? Math.round(room.ping * 0.6 + rtt * 0.4) : rtt;
        emit("ping", room.ping);
      }
      return;
    }
    if (type === "bye") return partnerGone();
    emit(type, data);
  }

  function partnerGone() {
    var r = room;
    if (!r || r.gone) return;
    r.gone = true;
    emit("left", null);
  }

  var lastRoomSend = 0;

  /** Send a message to the other game. `sure`: it must arrive (cards, picks,
   *  the end of a battle); otherwise it may be dropped (positions, snapshots). */
  function send(type, data, sure) {
    var r = room;
    if (!r || !r.partner || r.gone) return false;
    var text = JSON.stringify({ t: type, d: data });
    if (r.link === "direct") {
      var dc = sure ? r.sure : r.fast;
      if (dc && dc.readyState === "open") {
        // a channel that has fallen behind drops the next quick message rather than queue it
        if (!sure && dc.bufferedAmount > 256 * 1024) return false;
        try {
          dc.send(text);
          return true;
        } catch (err) {
          useRoom();
        }
      }
    }
    // through the room: the server allows about ten a second from each game,
    // so quick messages are thinned out there
    var now = Date.now();
    if (!sure && now - lastRoomSend < 110) return false;
    lastRoomSend = now;
    r.channel.send({ type: "broadcast", event: "g", payload: { from: me, t: type, d: data } });
    return true;
  }

  /* --------------------------------------------- keeping watch */

  setInterval(function () {
    var r = room;
    if (!r || !r.partner || r.gone) return;
    // a quiet word now and then: it times the round trip (the ping), and a
    // game that has gone can be noticed
    send("ping", { at: Date.now() }, true);
    if (Date.now() - r.heardAt > QUIET) partnerGone();
  }, 2000);

  window.addEventListener("beforeunload", function () {
    if (room && room.partner) signal("bye", { to: room.partner });
  });

  /* ------------------------------------------------------ the API */

  function leave() {
    var r = room;
    room = null;
    if (!r) return;
    r.timers.forEach(clearTimeout);
    if (r.partner && !r.gone) {
      try {
        if (r.sure && r.sure.readyState === "open") r.sure.send(JSON.stringify({ t: "bye" }));
      } catch (err) {
        /* ignored */
      }
      try {
        r.channel.send({ type: "broadcast", event: "sig", payload: { from: me, kind: "bye", to: r.partner } });
      } catch (err) {
        /* ignored */
      }
    }
    try {
      if (r.peer) r.peer.close();
    } catch (err) {
      /* ignored */
    }
    var c = client();
    setTimeout(function () {
      try {
        if (c) c.removeChannel(r.channel);
      } catch (err) {
        /* ignored */
      }
    }, 300);
  }

  PS.net = {
    CODE_LENGTH: CODE_LENGTH,
    cleanCode: cleanCode,

    available: function () {
      return Boolean(client());
    },

    /** Make a room. Resolves with its code once the room is open. */
    host: function (info) {
      var code = makeCode();
      return openRoom(code, "host", info).then(function () { return code; });
    },

    /** Join the room with this code. Resolves with the host's info once it answers. */
    join: function (code, info) {
      code = cleanCode(code);
      if (code.length !== CODE_LENGTH) return Promise.reject(new Error("A room code has " + CODE_LENGTH + " letters and numbers."));
      return openRoom(code, "guest", info).then(function (r) {
        return new Promise(function (resolve, reject) {
          var tries = 0;
          var ask = setInterval(function () {
            if (room !== r || r.partner) {
              clearInterval(ask);
              return;
            }
            if (++tries * 900 > FIND_WAIT) {
              clearInterval(ask);
              reject(new Error("No room with that code. Check it, and that your friend still has the room open."));
              leave();
              return;
            }
            signal("hello", { info: r.info });
          }, 900);
          r.timers.push(ask);
          r.found = function (hostInfo) {
            clearInterval(ask);
            resolve(hostInfo);
          };
          r.lost = function (err) {
            clearInterval(ask);
            reject(err);
            leave();
          };
          signal("hello", { info: r.info });
        });
      });
    },

    send: send,
    leave: leave,

    on: function (type, fn) {
      (handlers[type] || (handlers[type] = [])).push(fn);
    },
    off: function (type) {
      delete handlers[type];
    },

    /** What is going on: { code, role, link, partner, ping } or null. */
    state: function () {
      if (!room) return null;
      return { code: room.code, role: room.role, link: room.link, partner: room.partnerInfo, gone: Boolean(room.gone), ping: room.ping || 0 };
    }
  };
})();
