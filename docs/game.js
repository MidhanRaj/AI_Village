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
  Wizard: "You are wise, eccentric, and slightly mysterious, studying stars and arcane spells.",
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

const SKIN_PRESETS = [
  { label: "Fair", shift: [1.0, 1.0, 1.0] },
  { label: "Olive", shift: [0.92, 0.88, 0.72] },
  { label: "Bronze", shift: [0.85, 0.68, 0.50] },
  { label: "Deep Brown", shift: [0.62, 0.44, 0.32] },
  { label: "Pale", shift: [1.06, 1.02, 1.04] },
];

const HAIR_PRESETS = [
  { label: "Chestnut", rgb: [115, 68, 42] },
  { label: "Raven Black", rgb: [38, 38, 48] },
  { label: "Golden Blonde", rgb: [215, 178, 82] },
  { label: "Fiery Ginger", rgb: [196, 86, 40] },
  { label: "Silver", rgb: [208, 214, 224] },
  { label: "Emerald", rgb: [56, 148, 96] },
];

const OUTFIT_PRESETS = [
  { label: "Crimson Tunic", rgb: [175, 52, 56] },
  { label: "Royal Blue", rgb: [52, 92, 175] },
  { label: "Forest Green", rgb: [54, 132, 72] },
  { label: "Arcane Purple", rgb: [122, 64, 168] },
  { label: "Golden Tunic", rgb: [192, 148, 48] },
  { label: "Obsidian", rgb: [52, 54, 64] },
];

const HAT_PRESETS = [
  { label: "None", type: "none" },
  { label: "Adventurer Cap", type: "cap", color: "#3d6b4b" },
  { label: "Wizard Hat", type: "wizard", color: "#433478" },
  { label: "Red Bandana", type: "bandana", color: "#b83b3b" },
  { label: "Golden Crown", type: "crown", color: "#e8be3a" },
];

const CAPE_PRESETS = [
  { label: "None", color: null },
  { label: "Crimson Cloak", color: "#8c262c" },
  { label: "Forest Cloak", color: "#2c663c" },
  { label: "Midnight Cloak", color: "#282e47" },
  { label: "Royal Purple", color: "#5e2c7a" },
];

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const promptEl = document.getElementById("prompt");
const dlgBox = document.getElementById("dialogue-box");
const dlgName = document.getElementById("dlg-name");
const dlgClear = document.getElementById("dlg-clear");
const dlgHistory = document.getElementById("dlg-history");
const dlgForm = document.getElementById("dlg-form");
const dlgInput = document.getElementById("dlg-input");
const playerLabel = document.getElementById("player-label");
const btnCustomize = document.getElementById("btn-customize");
const custModal = document.getElementById("customizer-modal");
const custPreview = document.getElementById("cust-preview");
const custName = document.getElementById("cust-name");
const custSkin = document.getElementById("cust-skin");
const custHair = document.getElementById("cust-hair");
const custOutfit = document.getElementById("cust-outfit");
const custHat = document.getElementById("cust-hat");
const custCape = document.getElementById("cust-cape");
const custRandom = document.getElementById("cust-random");
const custSave = document.getElementById("cust-save");
const custCancel = document.getElementById("cust-cancel");
const btnAi = document.getElementById("btn-ai");
const aiStatus = document.getElementById("ai-status");

const keys = new Set();
let webllmEngine = null;
let aiLoading = false;
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

function buildCustomPlayerSheet(baseSheet, cfg) {
  const off = document.createElement("canvas");
  off.width = baseSheet.width;
  off.height = baseSheet.height;
  const octx = off.getContext("2d");
  octx.drawImage(baseSheet, 0, 0);

  const skin = SKIN_PRESETS[cfg.skin % SKIN_PRESETS.length];
  const hair = HAIR_PRESETS[cfg.hair % HAIR_PRESETS.length];
  const outfit = OUTFIT_PRESETS[cfg.outfit % OUTFIT_PRESETS.length];
  const hat = HAT_PRESETS[cfg.hat % HAT_PRESETS.length];
  const cape = CAPE_PRESETS[cfg.cape % CAPE_PRESETS.length];

  // Recolor skin, hair, and shirt pixels per frame
  const imgData = octx.getImageData(0, 0, off.width, off.height);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;

    // Warm peach skin tones -> tint with skin preset
    if (r > g + 12 && g > b + 6 && r > 130 && max - min < 95) {
      d[i] = Math.min(255, Math.round(r * skin.shift[0]));
      d[i + 1] = Math.min(255, Math.round(g * skin.shift[1]));
      d[i + 2] = Math.min(255, Math.round(b * skin.shift[2]));
    } else if (b > r + 15 && b > g) {
      // Blue/cool shirt pixels -> recolor to chosen outfit color
      const shade = 0.55 + lum * 0.75;
      d[i] = Math.min(255, Math.round(outfit.rgb[0] * shade));
      d[i + 1] = Math.min(255, Math.round(outfit.rgb[1] * shade));
      d[i + 2] = Math.min(255, Math.round(outfit.rgb[2] * shade));
    } else if (r > b + 20 && g > 50 && g < 160 && r < 180) {
      // Warm brown hair -> recolor to chosen hair color
      const shade = 0.5 + lum * 0.85;
      d[i] = Math.min(255, Math.round(hair.rgb[0] * shade));
      d[i + 1] = Math.min(255, Math.round(hair.rgb[1] * shade));
      d[i + 2] = Math.min(255, Math.round(hair.rgb[2] * shade));
    }
  }
  octx.putImageData(imgData, 0, 0);

  // Draw cape & hat overlays on walk rows (8..11)
  for (let dirRow = 0; dirRow < 4; dirRow++) {
    const row = WALK_START_ROW + dirRow;
    for (let col = 0; col < WALK_FRAMES; col++) {
      const fx = col * FRAME_SIZE;
      const fy = row * FRAME_SIZE;

      if (cape.color && dirRow !== 2) {
        octx.fillStyle = cape.color;
        octx.fillRect(fx + 22, fy + 30, 20, 22);
      }
      if (hat.type === "cap") {
        octx.fillStyle = hat.color;
        octx.fillRect(fx + 22, fy + 11, 20, 7);
        octx.fillRect(fx + 20, fy + 16, 24, 3);
      } else if (hat.type === "wizard") {
        octx.fillStyle = hat.color;
        octx.fillRect(fx + 18, fy + 15, 28, 4);
        octx.beginPath();
        octx.moveTo(fx + 22, fy + 15);
        octx.lineTo(fx + 32, fy + 2);
        octx.lineTo(fx + 42, fy + 15);
        octx.fill();
      } else if (hat.type === "bandana") {
        octx.fillStyle = hat.color;
        octx.fillRect(fx + 22, fy + 13, 20, 5);
      } else if (hat.type === "crown") {
        octx.fillStyle = hat.color;
        octx.fillRect(fx + 23, fy + 11, 18, 4);
        octx.fillRect(fx + 24, fy + 8, 3, 3);
        octx.fillRect(fx + 31, fy + 7, 3, 4);
        octx.fillRect(fx + 37, fy + 8, 3, 3);
      }
    }
  }
  return off;
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

function loadChat(name) {
  try {
    return JSON.parse(localStorage.getItem(`ai_village_chat_v2_${name}`) || "[]");
  } catch {
    return [];
  }
}

function saveChat(name, history) {
  localStorage.setItem(`ai_village_chat_v2_${name}`, JSON.stringify(history.slice(-20)));
}

function smartFallbackReply(npc, text, playerName) {
  const lower = text.toLowerCase();
  const modernWords = ["google", "internet", "iphone", "phone", "computer", "laptop", "car", "airplane", "tv", "youtube", "wifi"];
  if (modernWords.some((w) => lower.includes(w))) {
    const guesses = {
      Blacksmith: `'${text}'? Never heard of it, ${playerName}. Sounds like some strange foreign ore or a secret smithing guild.`,
      Wizard: `Hmm, '${text}'... I have never seen that in any ancient tome. Perhaps it is a distant scrying crystal?`,
      Witch: `'${text}'? No herb or charm in my satchel goes by that name, ${playerName}.`,
      Fisherwoman: `'${text}'? Never caught anything by that name in this river, ${playerName}. Is it a kind of bait?`,
      Fisherman: `'${text}'? Sounds like a strange tide or a fish from deeper waters than I sail.`,
      Farmer: `'${text}'? Is that a new kind of grain or plow, ${playerName}?`,
      Guard: `'${text}'? Never seen that banner or weapon at our gates, ${playerName}.`,
    };
    return guesses[npc.role] || `'${text}'? I've never heard of that in our village, ${playerName}. What does it do?`;
  }

  if (lower.includes("passing by") || lower.includes("just looking") || lower.includes("wandering")) {
    return `Safe travels through town, ${playerName}! Take a look around—there's always plenty happening in the village.`;
  }

  if (lower.includes("what are you doing") || lower.includes("what do you do") || lower.includes("busy")) {
    const doing = {
      Blacksmith: `Just hammering out iron horseshoes and keeping the forge coals hot, ${playerName}.`,
      Wizard: `Studying the star charts and tending to my crystal staff, ${playerName}.`,
      Witch: `Sorting dried moonleaf and brewing a calming tonic.`,
      Merchant: `Counting today's spices and checking my trade ledger.`,
      Farmer: `Checking the soil moisture and repairing a fence post.`,
      Guard: `Keeping watch over the main crossroads to make sure everyone is safe.`,
      Healer: `Preparing herbal poultices in case anyone twists an ankle.`,
      Innkeeper: `Sweeping up and getting a fresh pot of stew ready for dinner.`,
      Elder: `Enjoying the fresh air and watching the younger folk bustle about.`,
      Fisherwoman: `Mending my river nets and watching for trout ripples.`,
      Fisherman: `Checking my lines by the bank.`,
      Hunter: `Checking my crossbow string before heading toward the north woods.`,
      Villager: `Just taking a stroll down the village path and catching up with neighbors, ${playerName}!`,
    };
    return doing[npc.role] || `Just enjoying a quiet afternoon in the village, ${playerName}!`;
  }

  if (lower.includes("magic") || lower.includes("mgic") || lower.includes("spell")) {
    if (npc.role === "Wizard" || npc.role === "Witch") {
      return `Aye, ${playerName}! I weave starlight wards, scrying charms, and fire sparks—though the elders warn not to cast indoors.`;
    }
    return `Magic? Leave that to Aldric the Wizard, ${playerName}—I stick to my own craft!`;
  }

  if (lower.includes("who") || lower.includes("name") || lower.includes("job")) {
    return `I'm ${npc.name}, the village ${npc.role}. Nice to meet you, ${playerName}!`;
  }

  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
    return `Good day, ${playerName}! How are you finding our little village?`;
  }

  const roleLines = {
    Blacksmith: `The forge is running hot today, ${playerName}. Need a blade sharpened?`,
    Wizard: `The stars shifted strangely last night, ${playerName}. What brings you to me?`,
    Witch: `My cauldron's simmering with moonleaf tea, ${playerName}. What's on your mind?`,
    Merchant: `I've got fine cloth and spices from the southern road, ${playerName}.`,
    Farmer: `If the rain holds off until dusk, the wheat harvest will be our best yet!`,
    Guard: `All roads into the village look clear today, ${playerName}.`,
    Healer: `You look well enough, ${playerName}, though chamomile tea never hurts.`,
    Innkeeper: `Pull up a chair sometime, ${playerName}—there's warm stew at the inn!`,
    Elder: `I've watched this village grow for sixty summers, ${playerName}.`,
    Fisherwoman: `The river trout are biting near the bend today, ${playerName}!`,
    Fisherman: `Patience is everything by the water, ${playerName}.`,
    Hunter: `Fresh deer tracks near the north pines, ${playerName}.`,
    Villager: `It's a lovely day for a walk around the square, isn't it, ${playerName}?`,
  };
  return roleLines[npc.role] || `Lovely day in the village, isn't it, ${playerName}?`;
}

async function generateReply(npc, text, rosterSummary, playerName) {
  const history = loadChat(npc.name);
  history.push({ sender: "player", text });

  let reply = "";
  if (webllmEngine) {
    const personality = ROLE_PERSONALITIES[npc.role] || ROLE_PERSONALITIES.Villager;
    const systemPrompt =
      `You are ${npc.name}, a ${npc.role} in a medieval fantasy village.\n` +
      `You are chatting with ${playerName}. ${personality}\n` +
      `Other villagers: ${rosterSummary.replace(/\n/g, ", ")}.\n` +
      `Reply directly and naturally to what ${playerName} just said in 1-2 short sentences. Stay in character.`;

    const messages = [{ role: "system", content: systemPrompt }];
    for (const m of history.slice(-8)) {
      messages.push({ role: m.sender === "player" ? "user" : "assistant", content: m.text });
    }
    try {
      const out = await webllmEngine.chat.completions.create({
        messages,
        temperature: 0.75,
        max_tokens: 90,
      });
      reply = out.choices?.[0]?.message?.content?.trim() || "";
    } catch {
      reply = "";
    }
  }
  if (!reply) {
    reply = smartFallbackReply(npc, text, playerName);
  }
  history.push({ sender: "npc", text: reply });
  saveChat(npc.name, history);
  return reply;
}

async function initBrowserAI() {
  if (webllmEngine || aiLoading) return;
  if (!navigator.gpu) {
    aiStatus.textContent = "Smart Fallback Active (No WebGPU)";
    btnAi.classList.add("hidden");
    return;
  }
  aiLoading = true;
  btnAi.disabled = true;
  aiStatus.textContent = "Downloading Qwen2.5-1.5B for browser...";
  try {
    const webllm = await import("https://esm.run/@mlc-ai/web-llm");
    const models = ["Qwen2.5-1.5B-Instruct-q4f16_1-MLC", "Qwen2.5-0.5B-Instruct-q4f16_1-MLC"];
    for (const modelId of models) {
      try {
        webllmEngine = await webllm.CreateMLCEngine(modelId, {
          initProgressCallback: (p) => {
            aiStatus.textContent = p.text ? p.text.slice(0, 46) : `Loading ${modelId}...`;
          },
        });
        aiStatus.textContent = `Browser AI Ready (${modelId.split("-Instruct")[0]})`;
        btnAi.classList.add("hidden");
        return;
      } catch (e) {
        console.warn("Failed loading", modelId, e);
      }
    }
    aiStatus.textContent = "WebGPU AI unavailable (using fallback)";
    btnAi.disabled = false;
  } catch (err) {
    console.warn("WebLLM import failed:", err);
    aiStatus.textContent = "AI load failed (using fallback)";
    btnAi.disabled = false;
  } finally {
    aiLoading = false;
  }
}

btnAi.addEventListener("click", initBrowserAI);

async function main() {
  const manifest = await (await fetch("villagers.json")).json();
  const entries = manifest.villagers || [];

  const playerBaseSheet = await loadImage("assets/characters/lpc_test.png");
  const npcSheets = await Promise.all(entries.map((e) => loadImage(e.sprite)));

    function fillSelect(el, list) {
      el.innerHTML = "";
      list.forEach((item, i) => {
        const o = document.createElement("option");
        o.value = String(i);
        o.textContent = item.label;
        el.appendChild(o);
      });
    }

    fillSelect(custSkin, SKIN_PRESETS);
    fillSelect(custHair, HAIR_PRESETS);
    fillSelect(custOutfit, OUTFIT_PRESETS);
    fillSelect(custHat, HAT_PRESETS);
    fillSelect(custCape, CAPE_PRESETS);

    const savedCfg = JSON.parse(localStorage.getItem("ai_village_player_v2") || "{}");
    const playerCfg = {
      name: savedCfg.name || "Traveler",
      skin: Number(savedCfg.skin || 0),
      hair: Number(savedCfg.hair || 0),
      outfit: Number(savedCfg.outfit || 1),
      hat: Number(savedCfg.hat || 0),
      cape: Number(savedCfg.cape || 0),
    };

    function syncModalFromCfg(cfg) {
      custName.value = cfg.name;
      custSkin.value = String(cfg.skin);
      custHair.value = String(cfg.hair);
      custOutfit.value = String(cfg.outfit);
      custHat.value = String(cfg.hat);
      custCape.value = String(cfg.cape);
    }

    function readModalCfg() {
      return {
        name: custName.value.trim() || "Traveler",
        skin: Number(custSkin.value || 0),
        hair: Number(custHair.value || 0),
        outfit: Number(custOutfit.value || 0),
        hat: Number(custHat.value || 0),
        cape: Number(custCape.value || 0),
      };
    }

    function renderPreview() {
      const previewSheet = buildCustomPlayerSheet(playerBaseSheet, readModalCfg());
      const pctx = custPreview.getContext("2d");
      pctx.imageSmoothingEnabled = false;
      pctx.clearRect(0, 0, custPreview.width, custPreview.height);
      pctx.drawImage(
        previewSheet,
        0, (WALK_START_ROW + 2) * FRAME_SIZE, FRAME_SIZE, FRAME_SIZE,
        16, 16, 64, 64
      );
    }

    [custName, custSkin, custHair, custOutfit, custHat, custCape].forEach((el) => {
      el.addEventListener("change", renderPreview);
    });

      custRandom.addEventListener("click", () => {
        syncModalFromCfg({
          name: custName.value.trim() || "Traveler",
          skin: Math.floor(Math.random() * SKIN_PRESETS.length),
          hair: Math.floor(Math.random() * HAIR_PRESETS.length),
          outfit: Math.floor(Math.random() * OUTFIT_PRESETS.length),
          hat: Math.floor(Math.random() * HAT_PRESETS.length),
          cape: Math.floor(Math.random() * CAPE_PRESETS.length),
        });
        renderPreview();
      });

      syncModalFromCfg(playerCfg);
      playerLabel.textContent = playerCfg.name;

      const initialSheet = buildCustomPlayerSheet(playerBaseSheet, playerCfg);
      const player = new Character(400, 400, initialSheet, playerCfg.name, "Traveler", false);

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

      dlgClear.addEventListener("click", () => {
        if (!activeNpc) return;
        localStorage.removeItem(`ai_village_chat_v2_${activeNpc.name}`);
        renderDialogueHistory();
      });

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
        if (!dialogueOpen) {
          renderPreview();
          custModal.classList.remove("hidden");
        }
      });
      custCancel.addEventListener("click", () => custModal.classList.add("hidden"));
      custSave.addEventListener("click", () => {
        const nextCfg = readModalCfg();
        player.name = nextCfg.name;
        player.sheet = buildCustomPlayerSheet(playerBaseSheet, nextCfg);
        player.hasIdle = hasIdleRows(player.sheet);
        playerLabel.textContent = nextCfg.name;
        localStorage.setItem("ai_village_player_v2", JSON.stringify(nextCfg));
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
          renderPreview();
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

      // Auto-start browser AI if WebGPU is supported
      initBrowserAI();

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
