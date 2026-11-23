/* Mystery Island - web version.
   Rules are ported from main.py. Differences: the Lighthouse can only be
   entered by "cross bridge" (closes the move-lighthouse shortcut). */

const VALID_MOVES = {
  "Beach": ["Jungle", "Old Bridge"],
  "Jungle": ["Beach", "Cave"],
  "Cave": ["Jungle", "Old Bridge"],
  "Old Bridge": ["Beach", "Cave"],
  "Lighthouse": ["Old Bridge"],
};

const ITEMS = { "Jungle": "rope", "Cave": "lantern" };

const SCENES = {
  "Beach": {
    img: "img/beach.jpg",
    text: "You wake near the shore. Waves break on the sand. Far away, a dark lighthouse waits.",
  },
  "Jungle": {
    img: "img/jungle.jpg",
    text: "The jungle is dense and full of mystery. You spot a rope hanging from a tree.",
  },
  "Cave": {
    img: "img/cave.jpg",
    text: "A cool cave hides a lantern in the shadows.",
  },
  "Old Bridge": {
    img: "img/bridge.jpg",
    text: "The old bridge creaks over the chasm. It leads to the lighthouse.",
  },
  "Lighthouse": {
    img: "img/lighthouse.jpg",
    text: "The lighthouse tower rises above the island with a dark beacon.",
  },
};

const MAX_ENERGY = 5;
let player = null;

const $ = (id) => document.getElementById(id);

function newGame(name) {
  return {
    name: name || "Player",
    location: "Beach",
    energy: MAX_ENERGY,
    inventory: [],
    won: false,
    gameOver: false,
  };
}

/* ---- game rules: each returns [ok, message] ---- */

function movePlayer(p, dest) {
  if (p.gameOver) return [false, "The game is already over."];
  if (!(VALID_MOVES[p.location] || []).includes(dest))
    return [false, `You cannot travel to ${dest} from ${p.location}.`];

  p.location = dest;
  p.energy -= 1;

  if (p.energy <= 0) {
    p.energy = 0;
    p.gameOver = true;
    return [true, `You reach ${dest}, but your energy is gone. You collapse on the island.`];
  }
  return [true, `You move to ${dest}. Energy left: ${p.energy}`];
}

function collectItem(p) {
  if (p.gameOver) return [false, "The game is already over."];
  const item = ITEMS[p.location];
  if (!item) return [false, "There is nothing useful to collect here."];
  if (p.inventory.includes(item)) return [false, `You already have the ${item}.`];
  p.inventory.push(item);
  return [true, `You found the ${item}!`];
}

function crossBridge(p) {
  if (p.gameOver) return [false, "The game is already over."];
  if (p.location !== "Old Bridge") return [false, "You must stand at the Old Bridge to cross it."];
  if (!p.inventory.includes("rope"))
    return [false, "The bridge is locked. You need a rope before you can cross."];
  p.location = "Lighthouse";
  return [true, "You cross the old bridge and reach the lighthouse."];
}

function lightBeacon(p) {
  if (p.gameOver) return [false, "The game is already over."];
  if (p.location !== "Lighthouse") return [false, "You must be at the Lighthouse to light the beacon."];
  if (!p.inventory.includes("lantern")) return [false, "The beacon is dark. You need a lantern to light it."];
  p.won = true;
  p.gameOver = true;
  return [true, "You light the beacon. The rescue boat arrives. YOU WIN!"];
}

/* ---- which buttons to show ---- */

function availableActions(p) {
  const acts = [];
  const loc = p.location;

  for (const dest of VALID_MOVES[loc] || []) {
    acts.push({ label: `Go to ${dest}`, run: () => movePlayer(p, dest) });
  }
  const item = ITEMS[loc];
  if (item && !p.inventory.includes(item)) {
    acts.push({ label: `Collect ${item}`, run: () => collectItem(p) });
  }
  if (loc === "Old Bridge") {
    acts.push({ label: "Cross bridge", run: () => crossBridge(p) });
  }
  if (loc === "Lighthouse") {
    acts.push({ label: "Light beacon", run: () => lightBeacon(p) });
  }
  return acts;
}

/* ---- rendering ---- */

function show(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(id).classList.add("active");
}

function setBg(el, url) {
  el.style.backgroundImage = `url('${url}')`;
}

function render(message, ok = true) {
  const scene = SCENES[player.location];
  setBg($("scene"), scene.img);
  $("hud-name").textContent = player.name;
  $("hud-loc").textContent = player.location;
  $("description").textContent = scene.text;

  const msg = $("message");
  msg.textContent = message || "";
  msg.className = "msg" + (message ? (ok ? " ok" : " bad") : "");

  // energy pips
  const en = $("energy");
  en.innerHTML = "";
  for (let i = 0; i < MAX_ENERGY; i++) {
    const pip = document.createElement("span");
    pip.className = "pip" + (i < player.energy ? " full" : "");
    en.appendChild(pip);
  }

  // inventory
  const inv = $("inventory");
  inv.innerHTML = "";
  if (!player.inventory.length) {
    inv.innerHTML = '<span class="empty">empty</span>';
  } else {
    player.inventory.forEach((it) => {
      const t = document.createElement("span");
      t.className = "item";
      t.textContent = it;
      inv.appendChild(t);
    });
  }

  // actions
  const box = $("actions");
  box.innerHTML = "";
  availableActions(player).forEach((a) => {
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent = a.label;
    b.addEventListener("click", () => act(a));
    box.appendChild(b);
  });
}

function flash() {
  const f = $("flash");
  f.classList.remove("go");
  void f.offsetWidth; // restart animation
  f.classList.add("go");
}

function act(a) {
  const [ok, message] = a.run();
  flash();
  render(message, ok);
  if (player.gameOver) {
    setTimeout(endGame, 1400);
  }
}

function endGame() {
  const title = $("end-title");
  const text = $("end-text");
  if (player.won) {
    title.textContent = "YOU WIN!";
    title.className = "win";
    text.textContent = `The beacon blazes. The rescue boat is coming. You survived the island, ${player.name}.`;
    setBg($("end-bg"), "img/title.jpg");
  } else if (player.energy <= 0) {
    title.textContent = "GAME OVER";
    title.className = "lose";
    text.textContent = "The island claims another traveler.";
    setBg($("end-bg"), SCENES[player.location].img);
  } else {
    title.textContent = "YOU GAVE UP";
    title.className = "lose";
    text.textContent = "You decide to quit the island adventure.";
    setBg($("end-bg"), SCENES[player.location].img);
  }
  show("screen-end");
}

/* ---- wiring ---- */

$("name-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("name-input").value.trim();
  if (!name) {
    $("name-error").hidden = false;
    return;
  }
  $("name-error").hidden = true;
  player = newGame(name);
  show("screen-game");
  render("");
});

$("quit").addEventListener("click", () => {
  player.gameOver = true;
  endGame();
});

$("again").addEventListener("click", () => {
  $("name-input").value = "";
  show("screen-title");
  $("name-input").focus();
});

// preload art
Object.values(SCENES).forEach((s) => { new Image().src = s.img; });
new Image().src = "img/title.jpg";

/* expose for tests */
if (typeof module !== "undefined") {
  module.exports = { newGame, movePlayer, collectItem, crossBridge, lightBeacon, availableActions };
}
