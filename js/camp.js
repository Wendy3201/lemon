/*!
 * Pip Survivors — the camp
 * Your lemon and the pets on your team, strolling along the top of the tab bar
 * while you are in the menus. They wander, stop, look about and hop; tapped,
 * the lemon jumps and says something (often a nudge about what is waiting),
 * and a pet sends up hearts. Left alone for a while, the lemon nods off. Now
 * and then a lemon drops from the trees: tap it for a little gold (PS.CAMP in
 * data.js sets how often, how much and how many a day).
 *
 * Copyright (c) 2026 Lemon. MIT licensed (see LICENSE).
 */
(function () {
  "use strict";

  var PS = window.PS;
  var st = PS.state;

  var SPEED = 38; // px a second, walking
  var SLEEP_AFTER = 75; // seconds without a tap or a key before the lemon dozes off
  var EDGE = 26; // px kept clear at each end of the bar

  var box = null; // the strip above the tab bar
  var me = null; // the lemon: { el, x, to, face, wait, state }
  var pets = []; // { el, x, sp, hop }
  var drops = []; // fallen lemons: { el, x, age, golden }
  var bubble = null;
  var bubbleT = 0;
  var dropIn = 0;
  var lastInput = 0;
  var pokes = [];
  var raf = 0;
  var last = 0;
  var team = ""; // which pets are drawn, so they are only redrawn when the team changes
  var weaponShown = "";

  function still() {
    return PS.reducedMotion();
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function width() {
    return box ? box.clientWidth : 0;
  }

  /* ------------------------------------------------------------- talking */

  var JOKES = [
    "I'm not sour, I'm zesty.",
    "Squeeze the day!",
    "When life gives you lemons... that's me!",
    "Zest in peace, pests.",
    "Pith off, pests!",
    "I could really go for some lemonade. Wait...",
    "Main character energy: lemon.",
    "Lemme at 'em!",
    "Feeling a-peel-ing today. Wrong fruit?",
    "Don't call me sour. I'm well-rounded."
  ];
  var POKED = ["Hey! That tickles!", "Okay, okay, I'm awake!", "Stop squeezing me!", "I'm not a stress ball!"];
  var TAB_LINES = {
    shop: ["Ooh, shopping!", "Something shiny in here..."],
    gear: ["Looking sharp.", "Is that a new hat?"],
    pets: ["Hi, little buddies!", "Who's a good bug?"],
    talents: ["Big brain time.", "Thinking juice, activate!"],
    quests: ["So many things to do!", "A to-do list! My favourite."],
    battle: ["Let's go squash some pests!", "Battle time?"]
  };

  /* Something worth saying now: a nudge about what is waiting, the next chapter, or a joke. */
  function line() {
    var S = st.get();
    var nudges = [];
    var b = st.badges();
    if (b.quests) nudges.push("Psst! A quest is ready to claim.");
    if (b.shop) nudges.push("There's something free waiting in the Shop!");
    if (b.talents) nudges.push("We can ascend! Have a look at Talents.");
    if (b.gear) nudges.push("Equipment has something new for us.");
    if (S.keys > 0) nudges.push("We have " + PS.fmt(S.keys) + " Enchantment Key" + (S.keys === 1 ? "" : "s") + " to use!");
    if (nudges.length && Math.random() < 0.55) return pick(nudges);

    var ch = PS.chapter(S.chapter);
    var stats = st.calc();
    var ratio = (stats.realPower || stats.power) / ch.rec;
    var chapterLines = [
      ratio >= 1 ? "We're ready for " + ch.name + "!" : ratio >= 0.7 ? ch.bossName + " looks tough... but we're tougher." : ch.bossName + " looks scary. More upgrades first?",
      "Next up: chapter " + ch.n + ". " + PS.fmt(ch.kills) + " pests, then " + ch.bossName + ".",
      S.stats.kills ? "We've squashed " + PS.fmt(S.stats.kills) + " pests so far!" : "I've never squashed a pest. Shall we?"
    ];
    return Math.random() < 0.5 ? pick(chapterLines) : pick(JOKES);
  }

  function say(text, seconds) {
    if (!bubble) return;
    bubble.textContent = text;
    bubble.hidden = false;
    bubble.classList.remove("is-on");
    void bubble.offsetWidth;
    bubble.classList.add("is-on");
    bubbleT = seconds || Math.min(6, 2.4 + text.length / 18);
    place();
  }

  /* ---------------------------------------------------------- the actors */

  function lemonHtml() {
    var weapon = st.get() ? st.equipped("weapon") : null; // the camp is built before a save is loaded
    weaponShown = weapon ? weapon.id : "";
    return (
      '<span class="camp__body">' + PS.art("lemon") +
        (weapon ? '<span class="camp__weapon">' + PS.itemIcon(weapon.id) + "</span>" : "") +
      "</span>" +
      '<span class="camp__zzz" aria-hidden="true">z<i>z</i><b>Z</b></span>'
    );
  }

  function drawPets() {
    var list = st.petTeam();
    var sig = list.map(function (p) { return p.u + ":" + p.r; }).join(",");
    if (sig === team) return;
    team = sig;
    pets.forEach(function (p) { p.el.remove(); });
    pets = list.map(function (pet, i) {
      var el = document.createElement("button");
      el.type = "button";
      el.className = "camp__pet";
      el.setAttribute("aria-label", PS.PET[pet.sp].name + " (pet)");
      el.innerHTML = '<span class="camp__body">' + PS.petArt(pet.sp, pet.r) + "</span>";
      box.appendChild(el);
      var p = { el: el, x: me.x - me.face * (40 + 32 * i), sp: pet.sp, i: i };
      el.addEventListener("click", function () { petTapped(p); });
      return p;
    });
  }

  function hop(el, kind) {
    el.classList.remove("is-hop", "is-jump", "is-spin");
    void el.offsetWidth;
    el.classList.add(kind || "is-hop");
  }

  function hearts(x, color) {
    for (var i = 0; i < 3; i++) {
      var h = document.createElement("span");
      h.className = "camp__heart";
      h.textContent = i === 1 ? "♥" : "❤";
      h.style.left = x + rand(-10, 10) + "px";
      h.style.setProperty("--dx", rand(-18, 18).toFixed(0) + "px");
      h.style.animationDelay = i * 0.12 + "s";
      if (color) h.style.color = color;
      box.appendChild(h);
      setTimeout(h.remove.bind(h), 1600);
    }
  }

  function float(x, text, cls) {
    var f = document.createElement("span");
    f.className = "camp__float" + (cls ? " " + cls : "");
    f.textContent = text;
    f.style.left = x + "px";
    box.appendChild(f);
    setTimeout(f.remove.bind(f), 1500);
  }

  function lemonTapped() {
    woke();
    var now = performance.now();
    pokes = pokes.filter(function (t) { return now - t < 3000; });
    pokes.push(now);
    PS.sfx.play("click");
    if (me.state === "sleep") {
      me.state = "idle";
      me.el.classList.remove("is-asleep");
      hop(me.el, "is-jump");
      say("Huh? I'm up! I'm up!");
      return;
    }
    hop(me.el, pokes.length >= 4 ? "is-spin" : "is-jump");
    say(pokes.length >= 4 ? pick(POKED) : line());
    me.wait = Math.max(me.wait, 2.5); // stand still a moment to be talked to
    me.to = me.x;
  }

  function petTapped(p) {
    woke();
    PS.sfx.play("pick");
    hop(p.el, "is-jump");
    hearts(p.x, "#ff6f91");
  }

  /* --------------------------------------------------------- falling lemons */

  function dropLemon() {
    if (st.campLeft() <= 0) return;
    var w = width();
    if (w < 120) return;
    var golden = Math.random() < PS.CAMP.golden;
    var el = document.createElement("button");
    el.type = "button";
    el.className = "camp__drop" + (golden ? " is-golden" : "") + (still() ? "" : " is-falling");
    el.setAttribute("aria-label", golden ? "A golden lemon: tap for gold" : "A fallen lemon: tap for gold");
    el.innerHTML = PS.art("lemon");
    var d = { el: el, x: rand(EDGE + 10, w - EDGE - 10), age: 0, golden: golden };
    el.style.left = d.x + "px";
    el.addEventListener("click", function () { collect(d); });
    box.appendChild(el);
    drops.push(d);
    // the lemon notices, now and then, and heads over
    if (me.state !== "sleep" && Math.random() < 0.6) {
      me.to = PS.clamp(d.x - 30 * Math.sign(d.x - me.x || 1), EDGE, w - EDGE);
      me.wait = 0;
      setTimeout(function () { if (drops.indexOf(d) !== -1) say(golden ? "A golden one! Tap it, quick!" : "Ooh, a lemon! Tap it!", 3); }, 700);
    }
  }

  function collect(d) {
    woke();
    var i = drops.indexOf(d);
    if (i === -1) return;
    drops.splice(i, 1);
    var gold = st.campLemon(d.golden);
    d.el.classList.add("is-taken");
    setTimeout(d.el.remove.bind(d.el), 400);
    if (!gold) {
      float(d.x, "That's all for today");
      return;
    }
    PS.sfx.play(d.golden ? "golden" : "coin");
    float(d.x, "+" + PS.fmt(gold) + " gold", d.golden ? "is-golden" : "");
    if (st.campLeft() === 0) setTimeout(function () { say("That's every lemon for today. More tomorrow!", 4); }, 600);
  }

  /* ---------------------------------------------------------------- loop */

  function woke() {
    lastInput = performance.now();
  }

  function shown() {
    var app = document.getElementById("app");
    return box && app && !app.hidden && !document.hidden && box.offsetParent !== null;
  }

  function place() {
    me.el.style.transform = "translateX(" + me.x.toFixed(1) + "px)";
    me.el.style.setProperty("--face", me.face);
    pets.forEach(function (p) { p.el.style.transform = "translateX(" + p.x.toFixed(1) + "px)"; });
    if (bubble && !bubble.hidden) {
      var w = width();
      var half = bubble.offsetWidth / 2;
      bubble.style.transform = "translateX(" + PS.clamp(me.x - half, 4, Math.max(4, w - half * 2 - 4)).toFixed(1) + "px)";
      bubble.style.setProperty("--tail", PS.clamp(me.x - PS.clamp(me.x - half, 4, w - half * 2 - 4), 14, half * 2 - 14).toFixed(0) + "px");
    }
  }

  function step(dt) {
    var w = width();
    if (w < 80) return;
    var now = performance.now();

    // the lemon: walk to a spot, wait there a while, pick another; doze off when left alone
    if (me.state !== "sleep" && now - lastInput > SLEEP_AFTER * 1000 && !drops.length) {
      me.state = "sleep";
      me.to = me.x;
      me.el.classList.add("is-asleep");
      me.el.classList.remove("is-walking");
    }
    if (me.state !== "sleep") {
      if (still()) me.to = me.x;
      var gap = me.to - me.x;
      if (Math.abs(gap) > 1) {
        me.face = gap > 0 ? 1 : -1;
        me.x += Math.sign(gap) * Math.min(Math.abs(gap), SPEED * dt);
        me.el.classList.add("is-walking");
      } else {
        me.el.classList.remove("is-walking");
        me.wait -= dt;
        if (me.wait <= 0) {
          me.wait = rand(2, 6);
          if (Math.random() < 0.25 && !still()) hop(me.el);
          else if (Math.random() < 0.3) me.face = -me.face; // a look the other way
          else me.to = PS.clamp(me.x + rand(-220, 220), EDGE, w - EDGE);
        }
      }
    }
    me.x = PS.clamp(me.x, EDGE, w - EDGE);

    // the pets trail behind, each a little further back, and catch up at their own pace
    pets.forEach(function (p, i) {
      var target = PS.clamp(me.x - me.face * (40 + 32 * i), EDGE * 0.6, w - EDGE * 0.6);
      var before = p.x;
      p.x += (target - p.x) * Math.min(1, dt * (1.6 - i * 0.25));
      var moving = Math.abs(p.x - before) / Math.max(dt, 1e-3) > 6;
      p.el.classList.toggle("is-walking", moving && !still());
      if (moving) p.el.style.setProperty("--face", p.x < target ? 1 : -1);
    });

    // fallen lemons: a new one now and then, and old ones fade away
    dropIn -= dt;
    if (dropIn <= 0) {
      dropIn = rand(PS.CAMP.every[0], PS.CAMP.every[1]);
      if (drops.length < 2) dropLemon();
    }
    for (var i = drops.length - 1; i >= 0; i--) {
      var d = drops[i];
      d.age += dt;
      if (d.age > PS.CAMP.life) {
        drops.splice(i, 1);
        d.el.classList.add("is-gone");
        setTimeout(d.el.remove.bind(d.el), 600);
      }
    }

    if (bubbleT > 0) {
      bubbleT -= dt;
      if (bubbleT <= 0) bubble.classList.remove("is-on");
    }
    place();
  }

  /* the weapon in hand and the team follow the save: on every change to it, and once a second */
  function refresh() {
    if (!box || !st.get()) return;
    var weapon = st.equipped("weapon");
    if ((weapon ? weapon.id : "") !== weaponShown) me.el.innerHTML = lemonHtml();
    drawPets();
  }

  var since = 0;
  function frame(t) {
    raf = requestAnimationFrame(frame);
    var dt = Math.min(0.1, Math.max(0, (t - last) / 1000));
    last = t;
    if (!shown() || !st.get()) return;
    since += dt;
    if (since > 1) {
      since = 0;
      refresh();
    }
    step(dt);
  }

  PS.camp = {
    mount: function () {
      var bar = document.getElementById("tabbar");
      if (!bar || box) return;
      box = document.createElement("div");
      box.className = "camp";
      bar.insertBefore(box, bar.firstChild);
      bubble = document.createElement("p");
      bubble.className = "camp__say";
      bubble.setAttribute("role", "status");
      bubble.hidden = true;
      box.appendChild(bubble);
      var el = document.createElement("button");
      el.type = "button";
      el.className = "camp__me";
      el.setAttribute("aria-label", "Your lemon: tap to say hello");
      me = { el: el, x: 0, to: 0, face: 1, wait: 1, state: "idle" };
      el.innerHTML = lemonHtml();
      el.addEventListener("click", lemonTapped);
      box.appendChild(el);
      me.x = me.to = Math.max(EDGE, width() * 0.2);
      dropIn = rand(8, 16); // the first lemon comes soon
      woke();
      ["pointerdown", "keydown"].forEach(function (type) { document.addEventListener(type, woke, true); });
      // now and then a word about the tab just opened
      bar.addEventListener("click", function (e) {
        var tab = e.target.closest("[data-tab]");
        if (!tab || me.state === "sleep" || Math.random() > 0.3) return;
        var lines = TAB_LINES[tab.getAttribute("data-tab")];
        if (lines) setTimeout(function () { say(pick(lines), 2.6); }, 250);
      });
      PS.on("change", refresh);
      refresh();
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    /** For tests: the parts, and a way to drop a lemon or say something now. */
    debug: function () {
      return { me: me, pets: pets, drops: drops, drop: dropLemon, say: say, line: line, step: step };
    }
  };
})();
