/* Mystery Island - illustrated adventure: browser layer.
   Rules live in rules.js (Game), data in story.js. This file draws and listens. */
(() => {
  const $ = (id) => document.getElementById(id);
  const DATA = { CHARACTERS, SCENES, START_SCENE, START_X, WIDTHS_PER_ENERGY };

  let state = "title";               // title | select | boat | playing | ending
  let game = null, chosen = null;
  let muted = false;

  function show(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    $(id).classList.add("active");
  }

  /* ---------------- audio (tiny synth) ---------------- */
  let actx = null;
  function audio() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} }
    if (actx && actx.state === "suspended") actx.resume();
    return actx;
  }
  function beep(freq, dur = 0.12, type = "sine", vol = 0.06, slide = 0) {
    const a = audio(); if (!a || muted) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, a.currentTime + dur);
    g.gain.setValueAtTime(vol, a.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + dur);
  }
  function thunder() {
    const a = audio(); if (!a || muted) return;
    const n = a.sampleRate * 1.6, buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    f.type = "lowpass"; f.frequency.value = 200; g.gain.value = 0.4;
    s.buffer = buf; s.connect(f); f.connect(g); g.connect(a.destination); s.start();
  }
  const SFX = {
    pickup: () => { beep(660, .09, "triangle"); setTimeout(() => beep(990, .14, "triangle"), 90); },
    build:  () => { beep(180, .12, "square", .05); setTimeout(() => beep(240, .12, "square", .05), 120); setTimeout(() => beep(330, .2, "square", .05), 240); },
    deny:   () => beep(140, .18, "sawtooth", .05),
    tired:  () => beep(260, .25, "sine", .05, -120),
    scene:  () => beep(480, .16, "sine", .04),
    win:    () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, .3, "triangle", .07), i * 150)),
    lose:   () => [330, 262, 196, 130].forEach((f, i) => setTimeout(() => beep(f, .35, "sawtooth", .05), i * 200)),
  };
  $("mute").addEventListener("click", () => { muted = !muted; $("mute").textContent = muted ? "Sound off" : "Sound on"; });

  /* ---------------- lightning ---------------- */
  function bolt(el) {
    el.classList.remove("go"); void el.offsetWidth; el.classList.add("go");
    setTimeout(thunder, 300 + Math.random() * 500);
  }
  let boltTimer = null;
  function startStorm() {
    stopStorm();
    const tick = () => {
      if (state === "playing") bolt($("bolt")); else if (state === "boat") bolt($("boat-bolt"));
      boltTimer = setTimeout(tick, 5000 + Math.random() * 8000);
    };
    boltTimer = setTimeout(tick, 2500);
  }
  function stopStorm() { clearTimeout(boltTimer); }

  /* ---------------- rain canvas ---------------- */
  const rain = $("rain"), rctx = rain.getContext("2d");
  let RW = 0, RH = 0;
  const drops = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), s: .6 + Math.random() }));
  function sizeRain() { RW = rain.width = window.innerWidth; RH = rain.height = window.innerHeight; }
  window.addEventListener("resize", sizeRain); sizeRain();
  function drawRain(dt) {
    rctx.clearRect(0, 0, RW, RH);
    rctx.strokeStyle = "rgba(190,225,235,.32)"; rctx.lineWidth = 1; rctx.beginPath();
    for (const d of drops) {
      d.y += dt * (1.0 + d.s * .7); d.x -= dt * .1;
      if (d.y > 1) { d.y = -.05; d.x = Math.random() * 1.15; }
      if (d.x < 0) d.x += 1.1;
      const x = d.x * RW, y = d.y * RH; rctx.moveTo(x, y); rctx.lineTo(x - 4, y + 13 * d.s);
    }
    rctx.stroke();
  }

  /* ---------------- input ---------------- */
  const keys = new Set();
  let useQueued = false;
  const HOLD = { left: false, right: false };      // on-screen arrow buttons

  window.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "KeyA"].includes(e.code)) { keys.add("l"); e.preventDefault(); }
    if (["ArrowRight", "KeyD"].includes(e.code)) { keys.add("r"); e.preventDefault(); }
    if (["KeyE", "Space", "Enter"].includes(e.code) && !e.repeat) {
      if (state === "playing") { useQueued = true; e.preventDefault(); }
      if (state === "boat") { nextStory(); e.preventDefault(); }
    }
  });
  window.addEventListener("keyup", (e) => {
    if (["ArrowLeft", "KeyA"].includes(e.code)) keys.delete("l");
    if (["ArrowRight", "KeyD"].includes(e.code)) keys.delete("r");
  });
  window.addEventListener("blur", () => { keys.clear(); HOLD.left = HOLD.right = false; });

  function holdBtn(id, side) {
    const el = $(id);
    el.addEventListener("pointerdown", (e) => { HOLD[side] = true; try { el.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); });
    const up = () => { HOLD[side] = false; };
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up); el.addEventListener("lostpointercapture", up);
  }
  holdBtn("arrow-l", "left"); holdBtn("arrow-r", "right");
  $("act").addEventListener("pointerdown", (e) => { if (state === "playing") useQueued = true; e.preventDefault(); });
  document.addEventListener("gesturestart", (e) => e.preventDefault());

  function dirInput() {
    const l = keys.has("l") || HOLD.left, r = keys.has("r") || HOLD.right;
    return (r ? 1 : 0) - (l ? 1 : 0);
  }

  /* tap the painting: walk there, or use the object you tapped */
  $("stage").addEventListener("pointerdown", (e) => {
    if (state !== "playing") return;
    audio();
    const r = $("stage").getBoundingClientRect();
    game.tap((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  });

  /* ---------------- stage layout ---------------- */
  /* The scene art is square. Cover the screen with it, and keep a figure standing on the ground line. */
  const stage = $("stage"), bg = $("scene-bg"), figure = $("figure");
  let currentImg = "";
  function layoutFigure() {
    const s = game.sceneData, W = stage.clientWidth, H = stage.clientHeight;
    const h = H * s.scale * 0.62;                                  // figure height in px
    figure.style.height = h + "px";
    figure.style.left = (game.x * W) + "px";
    figure.style.top = (s.ground * H) + "px";
    const bob = game.moving ? Math.abs(Math.sin(performance.now() / 110)) * 4 : 0;
    figure.style.transform = `translate(-50%, -100%) translateY(${-bob}px) scaleX(${game.facing === "left" ? -1 : 1})`;
  }
  function setScene() {
    const s = game.sceneData;
    if (currentImg !== s.img) { bg.style.backgroundImage = `url('${s.img}')`; currentImg = s.img; }
    // hotspot markers (soft glow only, no UI chrome)
    const hs = $("hotspots"); hs.innerHTML = "";
    game.hotspotsHere().forEach((h) => {
      const d = document.createElement("div"); d.className = "hs " + h.kind;
      d.style.left = (h.x * 100) + "%"; d.style.top = (h.y * 100) + "%";
      d.style.width = d.style.height = (h.r * 2 * 100) + "vmin";
      hs.appendChild(d);
    });
  }

  /* ---------------- HUD ---------------- */
  function buildHud() {
    $("hud-face").src = `img/${chosen}.jpg`;
    $("hud-name").textContent = `${game.name} (${CHARACTERS[chosen].title})`;
    const en = $("energy"); en.innerHTML = "";
    for (let i = 0; i < game.maxEnergy; i++) { const p = document.createElement("span"); p.className = "pip"; en.appendChild(p); }
  }
  let lastInv = "", lastScene = "";
  function updateHud() {
    $("hud-loc").textContent = game.sceneData.name;
    document.querySelectorAll("#energy .pip").forEach((p, i) => p.classList.toggle("full", i < game.energy));
    const invKey = game.inventory.join(",");
    if (invKey !== lastInv) {
      lastInv = invKey; const inv = $("inventory"); inv.innerHTML = "";
      if (!game.inventory.length) inv.innerHTML = '<span class="empty">empty</span>';
      game.inventory.forEach((it) => { const t = document.createElement("span"); t.className = "item"; t.textContent = it; inv.appendChild(t); });
    }
    $("message").textContent = game.message; $("message").style.opacity = game.message ? 1 : 0;
    const pr = game.over ? "" : game.prompt();
    $("prompt").textContent = pr ? `${pr}  [E]` : ""; $("prompt").style.opacity = pr ? 1 : 0;
    $("act").style.display = pr ? "" : "none";
    $("goal").textContent = goalText();
    if (game.scene !== lastScene) { lastScene = game.scene; setScene(); }
  }
  function goalText() {
    if (game.won) return "";
    const R = game.inventory.includes("rope"), L = game.inventory.includes("lantern");
    if (!R) return "Goal: find a rope in the jungle";
    if (!L) return "Goal: find a lantern in the cave";
    if (!game.bridgeRepaired) return "Goal: repair the old bridge";
    return "Goal: light the beacon at the top of the lighthouse";
  }

  /* ---------------- boat opening ---------------- */
  const STORY = [
    { img: "img/boat.jpg",    text: "The storm came out of nowhere. Your boat is all that is left, and the sea is winning." },
    { img: "img/boat.jpg",    text: "Through the rain you see a light: a lighthouse on a black island. It flickers, then dies." },
    { img: "img/landing.jpg", text: "The waves throw you onto the sand. A rope, a lantern and a broken bridge. That is how you get off this island." },
  ];
  let storyIdx = 0;
  function showStory() {
    const st = STORY[storyIdx];
    $("boat-bg").style.backgroundImage = `url('${st.img}')`;
    const el = $("story-text"); el.textContent = "";
    let i = 0; clearInterval(showStory.t);
    showStory.t = setInterval(() => { el.textContent = st.text.slice(0, ++i); if (i >= st.text.length) clearInterval(showStory.t); }, 22);
    $("story-next").textContent = storyIdx === STORY.length - 1 ? "Wake on the beach" : "Continue";
  }
  function nextStory() {
    const st = STORY[storyIdx];
    if ($("story-text").textContent.length < st.text.length) { clearInterval(showStory.t); $("story-text").textContent = st.text; return; }
    if (++storyIdx >= STORY.length) { beginGame(); return; }
    showStory();
  }
  $("story-next").addEventListener("click", () => { audio(); nextStory(); });
  $("story-skip").addEventListener("click", () => { clearInterval(showStory.t); beginGame(); });

  /* ---------------- flow ---------------- */
  function startBoat() {
    game = new Game(DATA, chosen, $("name-input").value.trim());
    state = "boat"; storyIdx = 0; show("screen-boat"); showStory(); startStorm();
  }
  function beginGame() {
    clearInterval(showStory.t);
    state = "playing"; useQueued = false; lastInv = "~"; lastScene = ""; currentImg = "";
    $("figure").src = `img/fig_${chosen}.png`;
    show("screen-game"); buildHud(); setScene();
    game.say(`${game.name}, find a rope and a lantern. Light the beacon.`, 5);
    lastT = performance.now(); startStorm();
  }
  function endGame() {
    stopStorm();
    const title = $("end-title"), text = $("end-text");
    if (game.won) {
      title.textContent = "YOU WIN!"; title.className = "win";
      text.textContent = `The beacon blazes. The rescue boat is coming. You survived the island, ${game.name}.`;
      $("end-bg").style.backgroundImage = "url('img/title.jpg')";
    } else {
      title.textContent = "GAME OVER"; title.className = "lose";
      text.textContent = "The island claims another traveler.";
      $("end-bg").style.backgroundImage = "url('img/scene_cave.jpg')";
    }
    state = "title"; show("screen-end");
  }

  /* ---------------- title + select ---------------- */
  function buildCards() {
    const box = $("cards"); box.innerHTML = "";
    Object.entries(CHARACTERS).forEach(([key, c]) => {
      const card = document.createElement("button"); card.type = "button"; card.className = "card"; card.dataset.key = key;
      card.innerHTML = `<img src="img/${key}.jpg" alt="${c.title}"><span class="c-title">${c.title}</span><span class="c-blurb">${c.blurb}</span><span class="c-perk">${c.perk}</span>`;
      card.addEventListener("click", () => {
        chosen = key; document.querySelectorAll(".card").forEach((x) => x.classList.toggle("sel", x.dataset.key === key));
        $("begin").disabled = false;
      });
      box.appendChild(card);
    });
  }
  $("start").addEventListener("click", () => { audio(); chosen = null; $("begin").disabled = true; buildCards(); state = "select"; show("screen-select"); });
  $("name-form").addEventListener("submit", (e) => {
    e.preventDefault(); audio();
    if (!chosen) return;
    if (!$("name-input").value.trim()) { $("name-error").hidden = false; return; }
    $("name-error").hidden = true; startBoat();
  });
  $("quit").addEventListener("click", () => { if (state === "playing") { game.over = true; game.won = false; endGame(); } });
  $("again").addEventListener("click", () => { $("name-input").value = ""; state = "title"; show("screen-title"); });

  /* ---------------- loop ---------------- */
  let lastT = performance.now(), endTimer = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
    if (state !== "playing") return;

    if (useQueued) { game.interact(); useQueued = false; }
    game.update(dt, dirInput());
    game.autoUse();
    game.events.splice(0).forEach((ev) => {
      if (SFX[ev]) SFX[ev]();
      if (ev === "win" || ev === "lose") { state = "ending"; endTimer = ev === "win" ? 2.8 : 2.2; setTimeout(endGame, endTimer * 1000); }
    });
    drawRain(dt); layoutFigure(); updateHud();
  }
  requestAnimationFrame(frame);
  document.addEventListener("visibilitychange", () => { lastT = performance.now(); });

  // preload art so scene changes are instant
  Object.values(SCENES).forEach((s) => { new Image().src = s.img; });
  ["boat", "landing", "title"].forEach((n) => { new Image().src = `img/${n}.jpg`; });
  Object.keys(CHARACTERS).forEach((k) => { new Image().src = `img/fig_${k}.png`; new Image().src = `img/${k}.jpg`; });

  window.__game = { get game() { return game; }, get state() { return state; }, use() { useQueued = true; } };
})();
