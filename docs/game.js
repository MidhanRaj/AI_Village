const WIDTH = 1000;
const HEIGHT = 700;
const WORLD_WIDTH = 1800;
const WORLD_HEIGHT = 1400;
const FRAME_SIZE = 64;
const WALK_START_ROW = 8;
const WALK_FRAMES = 9;
const IDLE_START_ROW = 22;
const IDLE_FRAMES = 2;
const DIRECTIONS = { up: 0, left: 1, down: 2, right: 3 };

const OBSTACLES = [
  { x: 200, y: 200, w: 100, h: 100 },
  { x: 700, y: 200, w: 120, h: 100 },
  { x: 1100, y: 500, w: 120, h: 120 },
  { x: 300, y: 900, w: 150, h: 100 },
];

const NPC_POSITIONS = [
  [600, 400], [800, 500], [1000, 350], [1200, 700],
  [500, 850], [900, 950], [1300, 1000], [300, 600],
  [1500, 400], [700, 1100], [1100, 1200], [550, 250],
];

const STATIONARY_ROLES = new Set(["Wizard", "Witch", "Elder", "Blacksmith", "Healer"]);

const ROLE_PERSONALITIES = {
  Blacksmith: "You are gruff, practical, and proud of your forge work.",
  Wizard: "You are wise, eccentric, and slightly mysterious, studying stars and arcane energies.",
  Witch: "You are sharp-witted, mysterious, and knowledgeable about herbs and charms.",
  Merchant: "You are friendly, persuasive, and always thinking about trade and prices.",
  Farmer: "You are warm, grounded, and care about weather, crops, and soil.",
  Guard: "You are alert, dutiful, and protective of the village.",
  Healer: "You are gentle, empathetic, and attentive to herbs and wellbeing.",
  Innkeeper: "You are jovial, hospitable, and love village stories.",
  Elder: "You are patient, nostalgic, and remember the village's history.",
  Fisherman: "You are relaxed, observant, and fond of the river and big catches.",
  Fisherwoman: "You are sharp, independent, and fond of the river and tall tales.",
  Hunter: "You are quiet, keen-eyed, and know the woods and wildlife.",
  Villager: "You are friendly, curious, and enjoy chatting about daily village life.",
};

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const promptEl = document.getElementById("prompt");
const dlgBox = document.getElementById("dialogue-box");
const dlgName = document.getElementById("dlg-name");
const dlgHistory = document.getElementById("dlg-history");
const dlgForm = document.getElementById("dlg-form");
const dlgInput = document.getElementById("dlg-input");
const playerLabel = document.getElementById("player-label");
const btnCustomize = document.getElementById("btn-customize");
const custModal = document.getElementById("customizer-modal");
const custName = document.getElementById("cust-name");
const custSprite = document.getElementById("cust-sprite");
const custSave = document.getElementById("cust-save");
const custCancel = document.getElementById("cust-cancel");
const btnAi = document.getElementById("btn-ai");
const aiStatus = document.getElementById("ai-status");

const keys = new Set();
let webllmEngine = null;
let aiThinking = false;
let dialogueOpen = false;
let activeNpc = null;

function formatOccupation(role, gender) {
  if (gender === "female") {
    if (role === "Fisherman") return "Fisherwoman";
    if (role === "Wizard") return "Witch";
  }
  return role;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function hasIdleRows(img) {
  const c = document.createElement("canvas");
  c.width = FRAME_SIZE;
  c.height = FRAME_SIZE;
  const x = c.getContext("2d");
  x.drawImage(img, 0, (IDLE_START_ROW + 2) * FRAME_SIZE, FRAME_SIZE, FRAME_SIZE, 0, 0, FRAME_SIZE, FRAME_SIZE);
  const data = x.getImageData(0, 0, FRAME_SIZE, FRAME_SIZE).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) return true;
  }
  return false;
}

class Character {
  constructor(x, y, sheet, name, role, canWander = false) {
    this.x = x;
    this.y = y;
    this.homeX = x;
    this.homeY = y;
    this.sheet = sheet;
    this.hasIdle = hasIdleRows(sheet);
    this.name = name;
    this.role = role;
    this.direction = "down";
    this.frame = 0;
    this.timer = 0;
    this.moving = false;
    this.bob = 0;
    this.speed = 180;
    this.canWander = canWander;
    this.wanderSpeed = 55;
    this.wanderRadius = 130;
    this.wanderTimer = 1 + Math.random() * 2.5;
    this.wanderDx = 0;
    this.wanderDy = 0;
  }

  get rect() {
    return { x: this.x + 15, y: this.y + 38, w: 34, h: 24 };
  }

  faceToward(tx, ty) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.direction = dx > 0 ? "right" : "left";
    } else {
      this.direction = dy > 0 ? "down" : "up";
    }
  }

  updateAnim(dt) {
    this.timer += dt;
    if (this.moving) {
      this.bob = 0;
      if (this.timer >= 0.12) {
        this.frame = (this.frame + 1) % WALK_FRAMES;
        this.timer = 0;
      }
    } else if (this.hasIdle) {
      if (this.timer >= 0.45) {
        this.frame = (this.frame + 1) % IDLE_FRAMES;
        this.timer = 0;
      }
    } else {
      this.frame = 0;
      if (this.timer >= 0.55) {
        this.bob = 1 - this.bob;
        this.timer = 0;
      }
    }
  }

  draw(camX, camY) {
    const dirRow = DIRECTIONS[this.direction];
    let row = WALK_START_ROW + dirRow;
    let col = 0;
    if (this.moving) {
      col = this.frame % WALK_FRAMES;
    } else if (this.hasIdle) {
      row = IDLE_START_ROW + dirRow;
      col = this.frame % IDLE_FRAMES;
    }
    const bob = this.moving ? 0 : this.bob;
    ctx.drawImage(
      this.sheet,
      col * FRAME_SIZE, row * FRAME_SIZE, FRAME_SIZE, FRAME_SIZE,
      Math.round(this.x - camX), Math.round(this.y - camY + bob), FRAME_SIZE, FRAME_SIZE
    );
  }
}

function rectsCollide(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function collidesAny(rect, list) {
  return list.some((r) => rectsCollide(rect, r));
}

function getMemoryKey(name) {
  return `ai_village_chat_${name}`;
}

function loadChat(name) {
  try {
    return JSON.parse(localStorage.getItem(getMemoryKey(name)) || "[]");
  } catch {
    return [];
  }
}

function saveChat(name, history) {
  localStorage.setItem(getMemoryKey(name), JSON.stringify(history.slice(-12)));
}

function medievalFallbackReply(npc, text, playerName) {
  const lower = text.toLowerCase();
  const modernWords = ["google", "internet", "phone", "computer", "ai", "car", "plane", "tv", "youtube", "wifi"];
  if (modernWords.some((w) => lower.includes(w))) {
    const guesses = {
      Blacksmith: `'${text}'? Never heard of such a thing, ${playerName}. Sounds like some strange foreign ore or a secret smithing guild.`,
      Wizard: `Hmm, '${text}'... I have never seen that in any ancient tome. Perhaps it is a distant scrying crystal or a forgotten spell?`,
      Witch: `'${text}'? No herb or charm in my satchel goes by that name, ${playerName}.`,
      Fisherwoman: `'${text}'? Never caught anything by that name in this river, ${playerName}. Is it a kind of bait?`,
      Fisherman: `'${text}'? Sounds like a strange tide or a fish from deeper waters than I sail.`,
      Farmer: `'${text}'? Is that a new kind of grain or plow, ${playerName}? We don't have it in our fields.`,
      Guard: `'${text}'? Never seen that banner or weapon at the village gates, ${playerName}.`,
    };
    return guesses[npc.role] || `'${text}'? I've never heard of such a thing in our village, ${playerName}.`;
  }
  return `Well met, ${playerName}! As the village ${npc.role}, I'm always busy here. What else brings you by?`;
}

async function generateReply(npc, text, rosterSummary, playerName) {
  const history = loadChat(npc.name);
  history.push({ sender: "player", text });

  let reply = "";
  if (webllmEngine) {
    const personality = ROLE_PERSONALITIES[npc.role] || ROLE_PERSONALITIES.Villager;
    const systemPrompt =
      `You are ${npc.name}, the ${npc.role} in a pre-industrial medieval fantasy village.\n` +
      `The player is named ${playerName}. ${personality}\n` +
      `Other villagers:\n${rosterSummary}\n` +
      `Rules: Never mention modern technology (Google, internet, phones, computers, cars). ` +
      `If asked about modern things, act confused and guess what it is using your profession (${npc.role}). ` +
      `Reply in 1 to 2 short sentences.`;

    const messages = [{ role: "system", content: systemPrompt }];
    for (const m of history.slice(-8)) {
      messages.push({ role: m.sender === "player" ? "user" : "assistant", content: m.text });
    }
    try {
      const out = await webllmEngine.chat.completions.create({
        messages,
        temperature: 0.7,
        max_tokens: 90,
      });
      reply = out.choices?.[0]?.message?.content?.trim() || "";
    } catch {
      reply = "";
    }
  }
  if (!reply) {
    reply = medievalFallbackReply(npc, text, playerName);
  }
  history.push({ sender: "npc", text: reply });
  saveChat(npc.name, history);
  return reply;
}

btnAi.addEventListener("click", async () => {
  if (webllmEngine) return;
  if (!navigator.gpu) {
    aiStatus.textContent = "WebGPU unavailable (using fallback)";
    return;
  }
  btnAi.disabled = true;
  aiStatus.textContent = "Loading Qwen2.5-0.5B...";
  try {
    const webllm = await import("https://esm.run/@mlc-ai/web-llm");
    webllmEngine = await webllm.CreateMLCEngine("Qwen2.5-0.5B-Instruct-q4f16_1-MLC", {
      initProgressCallback: (p) => {
        aiStatus.textContent = p.text || "Loading model...";
      },
    });
    aiStatus.textContent = "Browser AI Ready (Qwen2.5-0.5B)";
  } catch (err) {
    aiStatus.textContent = "AI load failed (using fallback)";
    btnAi.disabled = false;
  }
});

async function main() {
  const manifest = await (await fetch("villagers.json")).json();
  const entries = manifest.villagers || [];

  const playerDefaultSheet = await loadImage("assets/characters/lpc_test.png");
  const npcSheets = await Promise.all(entries.map((e) => loadImage(e.sprite)));

  // Populate customizer dropdown
  const spriteOptions = [{ label: "Default Traveler", sheet: playerDefaultSheet, path: "assets/characters/lpc_test.png" }];
  entries.forEach((e, i) => {
    spriteOptions.push({ label: `${e.name} Style (${formatOccupation(e.role, e.gender)})`, sheet: npcSheets[i], path: e.sprite });
  });
  spriteOptions.forEach((opt, idx) => {
    const o = document.createElement("option");
    o.value = String(idx);
    o.textContent = opt.label;
    custSprite.appendChild(o);
  });

  const savedPlayer = JSON.parse(localStorage.getItem("ai_village_player") || "{}");
  const playerName = savedPlayer.name || "Traveler";
  const spriteIdx = Number(savedPlayer.spriteIdx || 0);
  custName.value = playerName;
  custSprite.value = String(spriteIdx);
  playerLabel.textContent = playerName;

  const player = new Character(400, 400, spriteOptions[spriteIdx]?.sheet || playerDefaultSheet, playerName, "Traveler", false);
  const npcs = entries.map((e, i) => {
    const role = formatOccupation(e.role, e.gender);
    const [x, y] = NPC_POSITIONS[i % NPC_POSITIONS.length];
    return new Character(x, y, npcSheets[i], e.name, role, !STATIONARY_ROLES.has(role));
  });

  const rosterSummary = npcs.map((n) => `- ${n.name}: ${n.role}`).join("\n");

  function renderDialogueHistory() {
    dlgHistory.innerHTML = "";
    const hist = loadChat(activeNpc.name);
    const items = hist.length
      ? hist.slice(-6)
      : [{ sender: "npc", text: `Greetings, ${player.name}! I'm ${activeNpc.name}, the village ${activeNpc.role}.` }];
    for (const m of items) {
      const div = document.createElement("div");
      div.className = m.sender === "player" ? "msg-player" : "msg-npc";
      div.textContent = (m.sender === "player" ? "You: " : `${activeNpc.name}: `) + m.text;
      dlgHistory.appendChild(div);
    }
    if (aiThinking) {
      const div = document.createElement("div");
      div.className = "msg-npc";
      div.textContent = `${activeNpc.name} is thinking...`;
      dlgHistory.appendChild(div);
    }
    dlgHistory.scrollTop = dlgHistory.scrollHeight;
  }

  function openDialogue(npc) {
    dialogueOpen = true;
    activeNpc = npc;
    npc.faceToward(player.x, player.y);
    dlgName.textContent = `${npc.name} (${npc.role})`;
    dlgBox.classList.remove("hidden");
    renderDialogueHistory();
    dlgInput.focus();
  }

  function closeDialogue() {
    dialogueOpen = false;
    activeNpc = null;
    dlgBox.classList.add("hidden");
  }

  dlgForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activeNpc || aiThinking) return;
    const text = dlgInput.value.trim();
    if (!text) return;
    dlgInput.value = "";
    aiThinking = true;
    renderDialogueHistory();
    await generateReply(activeNpc, text, rosterSummary, player.name);
    aiThinking = false;
    if (activeNpc) renderDialogueHistory();
  });

  btnCustomize.addEventListener("click", () => {
    if (!dialogueOpen) custModal.classList.remove("hidden");
  });
  custCancel.addEventListener("click", () => custModal.classList.add("hidden"));
  custSave.addEventListener("click", () => {
    const newName = custName.value.trim() || "Traveler";
    const idx = Number(custSprite.value || 0);
    player.name = newName;
    player.sheet = spriteOptions[idx]?.sheet || playerDefaultSheet;
    player.hasIdle = hasIdleRows(player.sheet);
    playerLabel.textContent = newName;
    localStorage.setItem("ai_village_player", JSON.stringify({ name: newName, spriteIdx: idx }));
    custModal.classList.add("hidden");
  });

  window.addEventListener("keydown", (e) => {
    if (document.activeElement === dlgInput || document.activeElement === custName) {
      if (e.key === "Escape") {
        closeDialogue();
        custModal.classList.add("hidden");
      }
      return;
    }
    keys.add(e.key.toLowerCase());
    if (e.key === "Escape") {
      closeDialogue();
      custModal.classList.add("hidden");
    } else if (e.key.toLowerCase() === "c" && !dialogueOpen) {
      custModal.classList.toggle("hidden");
    } else if (e.key.toLowerCase() === "e" && !dialogueOpen && custModal.classList.contains("hidden")) {
      const near = findNearestNpc();
      if (near) openDialogue(near);
    }
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

  function findNearestNpc() {
    let best = null;
    let minD = 85;
    const px = player.x + 32;
    const py = player.y + 48;
    for (const npc of npcs) {
      const d = Math.hypot(px - (npc.x + 32), py - (npc.y + 48));
      if (d < minD) {
        minD = d;
        best = npc;
      }
    }
    return best;
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (!dialogueOpen && custModal.classList.contains("hidden")) {
      let dx = 0;
      let dy = 0;
      if (keys.has("w") || keys.has("arrowup")) { dy = -1; player.direction = "up"; }
      else if (keys.has("s") || keys.has("arrowdown")) { dy = 1; player.direction = "down"; }
      if (keys.has("a") || keys.has("arrowleft")) { dx = -1; player.direction = "left"; }
      else if (keys.has("d") || keys.has("arrowright")) { dx = 1; player.direction = "right"; }

      player.moving = dx !== 0 || dy !== 0;
      if (player.moving) {
        const len = Math.hypot(dx, dy);
        const sx = (dx / len) * player.speed * dt;
        const sy = (dy / len) * player.speed * dt;
        const solid = OBSTACLES.concat(npcs.map((n) => n.rect));

        player.x += sx;
        if (collidesAny(player.rect, solid)) player.x -= sx;
        player.y += sy;
        if (collidesAny(player.rect, solid)) player.y -= sy;

        player.x = Math.max(0, Math.min(WORLD_WIDTH - 64, player.x));
        player.y = Math.max(0, Math.min(WORLD_HEIGHT - 64, player.y));
      }
    } else {
      player.moving = false;
    }
    player.updateAnim(dt);

    for (const npc of npcs) {
      if (dialogueOpen && npc === activeNpc) {
        npc.moving = false;
        npc.updateAnim(dt);
        continue;
      }
      if (!npc.canWander) {
        npc.moving = false;
        npc.updateAnim(dt);
        continue;
      }
      npc.wanderTimer -= dt;
      if (npc.wanderTimer <= 0) {
        if (npc.wanderDx || npc.wanderDy) {
          npc.wanderDx = 0;
          npc.wanderDy = 0;
          npc.wanderTimer = 1.5 + Math.random() * 2.5;
        } else {
          const dirs = [[1, 0, "right"], [-1, 0, "left"], [0, 1, "down"], [0, -1, "up"]];
          const [wx, wy, dir] = dirs[Math.floor(Math.random() * dirs.length)];
          npc.wanderDx = wx;
          npc.wanderDy = wy;
          npc.direction = dir;
          npc.wanderTimer = 0.9 + Math.random() * 1.3;
        }
      }
      if (npc.wanderDx || npc.wanderDy) {
        npc.moving = true;
        const solid = OBSTACLES.concat([player.rect]).concat(npcs.filter((o) => o !== npc).map((o) => o.rect));
        const sx = npc.wanderDx * npc.wanderSpeed * dt;
        const sy = npc.wanderDy * npc.wanderSpeed * dt;
        npc.x += sx;
        if (collidesAny(npc.rect, solid) || Math.abs(npc.x - npc.homeX) > npc.wanderRadius || npc.x < 0 || npc.x > WORLD_WIDTH - 64) {
          npc.x -= sx;
          npc.wanderDx = 0;
          npc.wanderDy = 0;
        }
        npc.y += sy;
        if (collidesAny(npc.rect, solid) || Math.abs(npc.y - npc.homeY) > npc.wanderRadius || npc.y < 0 || npc.y > WORLD_HEIGHT - 64) {
          npc.y -= sy;
          npc.wanderDx = 0;
          npc.wanderDy = 0;
        }
      } else {
        npc.moving = false;
      }
      npc.updateAnim(dt);
    }

    const camX = Math.max(0, Math.min(WORLD_WIDTH - WIDTH, player.x - WIDTH / 2));
    const camY = Math.max(0, Math.min(WORLD_HEIGHT - HEIGHT, player.y - HEIGHT / 2));

    ctx.fillStyle = "rgb(91,153,87)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "rgb(82,140,77)";
    for (let x = 0; x < WORLD_WIDTH; x += 64) {
      for (let y = 0; y < WORLD_HEIGHT; y += 64) {
        if (((x / 64 + y / 64) | 0) % 2 === 0) {
          ctx.fillRect(x - camX, y - camY, 32, 32);
        }
      }
    }
    ctx.fillStyle = "rgb(183,151,106)";
    ctx.fillRect(350 - camX, -camY, 100, WORLD_HEIGHT);
    ctx.fillRect(-camX, 450 - camY, WORLD_WIDTH, 90);

    ctx.fillStyle = "rgb(75,100,50)";
    for (const o of OBSTACLES) {
      ctx.fillRect(o.x - camX, o.y - camY, o.w, o.h);
    }

    const chars = [player, ...npcs].sort((a, b) => a.y - b.y);
    for (const c of chars) c.draw(camX, camY);

    const near = findNearestNpc();
    if (near && !dialogueOpen && custModal.classList.contains("hidden")) {
      promptEl.textContent = `Press E to talk to ${near.name} (${near.role})`;
      promptEl.classList.remove("hidden");
    } else {
      promptEl.classList.add("hidden");
    }

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

main();

