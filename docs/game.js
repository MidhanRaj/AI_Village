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

const RIVER_RECT = { x: 1480, y: 180, w: 320, h: 1060 };
const DOCK_RECT = { x: 1420, y: 456, w: 160, h: 96 };

const WORLD_PROPS = [
  { key: "bldg_tavern", x: 80, y: 80, rect: { x: 96, y: 217, w: 224, h: 129 } },
  { key: "bldg_forge", x: 620, y: 120, rect: { x: 636, y: 244, w: 224, h: 115 } },
  { key: "bldg_wizard", x: 980, y: 45, rect: { x: 996, y: 209, w: 224, h: 156 } },
  { key: "bldg_healer", x: 80, y: 740, rect: { x: 96, y: 863, w: 224, h: 115 } },
  { key: "bldg_cottage", x: 660, y: 800, rect: { x: 676, y: 924, w: 224, h: 116 } },
  { key: "bldg_cottage2", x: 1080, y: 750, rect: { x: 1096, y: 880, w: 224, h: 121 } },
  { key: "anvil", x: 530, y: 250, rect: { x: 536, y: 266, w: 64, h: 48 } },
  { key: "furnace", x: 880, y: 250, rect: { x: 888, y: 302, w: 80, h: 64 } },
  { key: "alchemy", x: 1225, y: 290, rect: { x: 1232, y: 330, w: 80, h: 48 } },
  { key: "workbench", x: 920, y: 920, rect: { x: 928, y: 964, w: 80, h: 48 } },
  { key: "farm_crops", x: 480, y: 790, rect: null, ground: true },
  { key: "farm_crops", x: 480, y: 880, rect: null, ground: true },
  { key: "flowers", x: 120, y: 990, rect: null, ground: true },
  { key: "tree_1", x: 40, y: 20, rect: { x: 64, y: 130, w: 48, h: 36 } },
  { key: "tree_2", x: 470, y: 40, rect: { x: 494, y: 150, w: 48, h: 36 } },
  { key: "tree_3", x: 860, y: 30, rect: { x: 884, y: 140, w: 48, h: 36 } },
  { key: "tree_1", x: 1320, y: 40, rect: { x: 1344, y: 150, w: 48, h: 36 } },
  { key: "tree_2", x: 40, y: 560, rect: { x: 64, y: 670, w: 48, h: 36 } },
  { key: "tree_3", x: 60, y: 1140, rect: { x: 84, y: 1250, w: 48, h: 36 } },
  { key: "tree_1", x: 520, y: 1180, rect: { x: 544, y: 1290, w: 48, h: 36 } },
  { key: "tree_2", x: 960, y: 1180, rect: { x: 984, y: 1290, w: 48, h: 36 } },
  { key: "tree_3", x: 1330, y: 1060, rect: { x: 1354, y: 1170, w: 48, h: 36 } },
  { key: "bush", x: 270, y: 360, rect: { x: 280, y: 380, w: 44, h: 32 } },
  { key: "bush", x: 910, y: 640, rect: { x: 920, y: 660, w: 44, h: 32 } },
  { key: "rock", x: 1380, y: 680, rect: { x: 1390, y: 696, w: 56, h: 36 } },
];

const OBSTACLES = WORLD_PROPS.filter((p) => p.rect).map((p) => p.rect).concat([
  { x: RIVER_RECT.x, y: RIVER_RECT.y, w: RIVER_RECT.w, h: DOCK_RECT.y - RIVER_RECT.y },
  { x: RIVER_RECT.x, y: DOCK_RECT.y + DOCK_RECT.h, w: RIVER_RECT.w, h: (RIVER_RECT.y + RIVER_RECT.h) - (DOCK_RECT.y + DOCK_RECT.h) },
]);

const ROLE_POSITIONS = {
  Blacksmith: [690, 380],
  Wizard: [1050, 380],
  Merchant: [740, 1050],
  Farmer: [490, 880],
  Guard: [440, 460],
  Healer: [210, 990],
  Innkeeper: [210, 355],
  Elder: [1160, 1010],
  Fisherwoman: [1420, 470],
  Fisherman: [1420, 470],
  Hunter: [1280, 280],
};
const VILLAGER_POSITIONS = [[540, 560], [880, 560]];

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

const LPC_SKINS = [
  { label: "Light", id: "light" },
  { label: "Olive", id: "olive" },
  { label: "Bronze", id: "bronze" },
  { label: "Brown", id: "brown" },
];

const LPC_HAIR = {
  male: [
    { label: "Bedhead (Black)", file: "male_hair_bedhead_black.png" },
    { label: "Cowlick (Chestnut)", file: "male_hair_cowlick_chestnut.png" },
    { label: "Curly Short (Ginger)", file: "male_hair_curly_ginger.png" },
    { label: "Half-Messy (Sandy)", file: "male_hair_messy_sandy.png" },
    { label: "Ponytail (Ash)", file: "male_hair_ponytail_ash.png" },
  ],
  female: [
    { label: "Ponytail (Chestnut)", file: "female_hair_ponytail_chestnut.png" },
    { label: "Bangs (Black)", file: "female_hair_bangs_black.png" },
    { label: "Curly Long (Ginger)", file: "female_hair_curly_ginger.png" },
    { label: "Pigtails (Sandy)", file: "female_hair_pigtails_sandy.png" },
    { label: "Topknot (Ash)", file: "female_hair_topknot_ash.png" },
  ],
};

const LPC_SHIRTS = [
  { label: "Red Tunic", key: "shirt_tunic_red" },
  { label: "Teal Tunic", key: "shirt_tunic_teal" },
  { label: "Maroon V-Neck", key: "shirt_vneck_maroon" },
  { label: "Blue-Gray V-Neck", key: "shirt_vneck_blue" },
  { label: "White Cardigan", key: "shirt_cardigan_white" },
];

const LPC_LEGS = {
  male: [
    { label: "Charcoal Pants", file: "male_legs_pants_charcoal.png" },
    { label: "Blue Pants", file: "male_legs_pants_blue.png" },
    { label: "Oak Pants", file: "male_legs_pants_oak.png" },
    { label: "Tan Cuffed Pants", file: "male_legs_cuffed_tan.png" },
  ],
  female: [
    { label: "Charcoal Pants", file: "female_legs_pants_charcoal.png" },
    { label: "Blue Pants", file: "female_legs_pants_blue.png" },
    { label: "Sky Skirt", file: "female_legs_skirt_sky.png" },
    { label: "White Skirt", file: "female_legs_skirt_white.png" },
  ],
};

const LPC_HATS = [
  { label: "None", file: null },
  { label: "Bandana", file: "shared_hat_bandana.png" },
  { label: "Kerchief", file: "shared_hat_kerchief.png" },
  { label: "Leather Cap", file: "shared_hat_cap_leather.png" },
  { label: "Bowler Hat", file: "shared_hat_bowler.png" },
  { label: "Wizard Hat", file: "shared_hat_wizard.png" },
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
const custGender = document.getElementById("cust-gender");
const custSkin = document.getElementById("cust-skin");
const custHair = document.getElementById("cust-hair");
const custShirt = document.getElementById("cust-shirt");
const custLegs = document.getElementById("cust-legs");
const custHat = document.getElementById("cust-hat");
const custRandom = document.getElementById("cust-random");
const custSave = document.getElementById("cust-save");
const custCancel = document.getElementById("cust-cancel");
const btnAi = document.getElementById("btn-ai");
const aiStatus = document.getElementById("ai-status");

const lpcCache = new Map();
async function loadLpcLayer(filename) {
  if (!filename) return null;
  if (lpcCache.has(filename)) return lpcCache.get(filename);
  const img = await loadImage(`assets/lpc_layers/${filename}`);
  lpcCache.set(filename, img);
  return img;
}

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

async function buildCustomLpcSheet(cfg) {
  const g = cfg.gender === "female" ? "female" : "male";
  const skin = LPC_SKINS[cfg.skin % LPC_SKINS.length].id;
  const hairFile = LPC_HAIR[g][cfg.hair % LPC_HAIR[g].length].file;
  const shirtKey = LPC_SHIRTS[cfg.shirt % LPC_SHIRTS.length].key;
  const legsFile = LPC_LEGS[g][cfg.legs % LPC_LEGS[g].length].file;
  const hatFile = LPC_HATS[cfg.hat % LPC_HATS.length].file;

  const layerFiles = [
    `base_${g}_${skin}.png`,
    legsFile,
    "shared_boots_oak.png",
    `${g}_${shirtKey}.png`,
    hairFile,
    hatFile,
  ].filter(Boolean);

  const imgs = await Promise.all(layerFiles.map(loadLpcLayer));
  const off = document.createElement("canvas");
  off.width = imgs[0].width;
  off.height = imgs[0].height;
  const octx = off.getContext("2d");
  for (const img of imgs) {
    if (img) octx.drawImage(img, 0, 0);
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
      `You are ${npc.name}, a real person living in a medieval fantasy village who works as the ${npc.role}.\n` +
      `You are chatting casually with ${playerName}. ${personality}\n` +
      `Other villagers: ${rosterSummary.replace(/\n/g, ", ")}.\n` +
      `How to speak: Talk like a warm, down-to-earth human—NOT a customer-service bot or assistant. ` +
      `You have personal opinions, feelings, hobbies, and humor outside of work. If asked about dogs, food, boredom, or everyday life, answer naturally as a person (never say 'I am a smith, not related to dogs' or 'feel free to ask'). ` +
      `Reply in 1-2 natural sentences.`;

    const messages = [{ role: "system", content: systemPrompt }];
    for (const m of history.slice(-8)) {
      messages.push({ role: m.sender === "player" ? "user" : "assistant", content: m.text });
    }
    try {
      const out = await webllmEngine.chat.completions.create({
        messages,
        temperature: 0.85,
        presence_penalty: 0.4,
        frequency_penalty: 0.4,
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

  function refreshGenderedOptions(gender) {
    fillSelect(custHair, LPC_HAIR[gender]);
    fillSelect(custLegs, LPC_LEGS[gender]);
  }

  fillSelect(custSkin, LPC_SKINS);
  fillSelect(custShirt, LPC_SHIRTS);
  fillSelect(custHat, LPC_HATS);

  const savedCfg = JSON.parse(localStorage.getItem("ai_village_player_v3") || "{}");
  const playerCfg = {
    name: savedCfg.name || "Traveler",
    gender: savedCfg.gender === "female" ? "female" : "male",
    skin: Number(savedCfg.skin || 0),
    hair: Number(savedCfg.hair || 0),
    shirt: Number(savedCfg.shirt || 0),
    legs: Number(savedCfg.legs || 0),
    hat: Number(savedCfg.hat || 0),
  };

  function syncModalFromCfg(cfg) {
    custName.value = cfg.name;
    custGender.value = cfg.gender;
    refreshGenderedOptions(cfg.gender);
    custSkin.value = String(cfg.skin);
    custHair.value = String(cfg.hair);
    custShirt.value = String(cfg.shirt);
    custLegs.value = String(cfg.legs);
    custHat.value = String(cfg.hat);
  }

  function readModalCfg() {
    return {
      name: custName.value.trim() || "Traveler",
      gender: custGender.value === "female" ? "female" : "male",
      skin: Number(custSkin.value || 0),
      hair: Number(custHair.value || 0),
      shirt: Number(custShirt.value || 0),
      legs: Number(custLegs.value || 0),
      hat: Number(custHat.value || 0),
    };
  }

  async function renderPreview() {
    const previewSheet = await buildCustomLpcSheet(readModalCfg());
    const pctx = custPreview.getContext("2d");
    pctx.imageSmoothingEnabled = false;
    pctx.clearRect(0, 0, custPreview.width, custPreview.height);
    pctx.drawImage(
      previewSheet,
      0, (WALK_START_ROW + 2) * FRAME_SIZE, FRAME_SIZE, FRAME_SIZE,
      16, 16, 64, 64
    );
  }

  custGender.addEventListener("change", () => {
    refreshGenderedOptions(custGender.value);
    custHair.value = "0";
    custLegs.value = "0";
    renderPreview();
  });

  [custName, custSkin, custHair, custShirt, custLegs, custHat].forEach((el) => {
    el.addEventListener("change", renderPreview);
  });

  custRandom.addEventListener("click", () => {
    const g = Math.random() < 0.5 ? "male" : "female";
    syncModalFromCfg({
      name: custName.value.trim() || "Traveler",
      gender: g,
      skin: Math.floor(Math.random() * LPC_SKINS.length),
      hair: Math.floor(Math.random() * LPC_HAIR[g].length),
      shirt: Math.floor(Math.random() * LPC_SHIRTS.length),
      legs: Math.floor(Math.random() * LPC_LEGS[g].length),
      hat: Math.floor(Math.random() * LPC_HATS.length),
    });
    renderPreview();
  });

  syncModalFromCfg(playerCfg);
  playerLabel.textContent = playerCfg.name;

  const initialSheet = await buildCustomLpcSheet(playerCfg);
  const player = new Character(400, 400, initialSheet, playerCfg.name, "Traveler", false);

  let vIdx = 0;
  const npcs = entries.map((e, i) => {
    const role = formatOccupation(e.role, e.gender);
    let pos = ROLE_POSITIONS[role];
    if (!pos) {
      pos = VILLAGER_POSITIONS[vIdx % VILLAGER_POSITIONS.length];
      vIdx += 1;
    }
    return new Character(pos[0], pos[1], npcSheets[i], e.name, role, !STATIONARY_ROLES.has(role));
  });

  const worldKeys = [
    "tile_grass", "tile_path", "tile_path_left", "tile_path_right", "tile_path_top", "tile_path_bottom",
    "tile_cobble", "tile_water", "tile_water_left", "tile_water_top", "tile_water_bottom", "tile_wood",
    "bldg_tavern", "bldg_forge", "bldg_wizard", "bldg_healer", "bldg_cottage", "bldg_cottage2",
    "anvil", "furnace", "alchemy", "workbench", "farm_crops", "flowers",
    "tree_1", "tree_2", "tree_3", "bush", "rock",
  ];
  const worldImgs = {};
  await Promise.all(worldKeys.map(async (k) => {
    worldImgs[k] = await loadImage(`assets/world/${k}.png`);
  }));

  const groundCanvas = document.createElement("canvas");
  groundCanvas.width = WORLD_WIDTH;
  groundCanvas.height = WORLD_HEIGHT;
  const gctx = groundCanvas.getContext("2d");
  gctx.imageSmoothingEnabled = false;
  for (let x = 0; x < WORLD_WIDTH; x += 32) {
    for (let y = 0; y < WORLD_HEIGHT; y += 32) {
      gctx.drawImage(worldImgs.tile_grass, x, y);
    }
  }
  for (let y = 0; y < WORLD_HEIGHT; y += 32) {
    gctx.drawImage(worldImgs.tile_path_left, 352, y);
    gctx.drawImage(worldImgs.tile_path, 384, y);
    gctx.drawImage(worldImgs.tile_path_right, 416, y);
  }
  for (let x = 0; x < 1480; x += 32) {
    gctx.drawImage(worldImgs.tile_path_top, x, 448);
    gctx.drawImage(worldImgs.tile_path, x, 480);
    gctx.drawImage(worldImgs.tile_path_bottom, x, 512);
  }
  for (const ix of [352, 384, 416]) {
    for (const iy of [448, 480, 512]) gctx.drawImage(worldImgs.tile_path, ix, iy);
  }
  for (let x = 448; x < 672; x += 32) {
    for (let y = 384; y < 576; y += 32) gctx.drawImage(worldImgs.tile_cobble, x, y);
  }
  for (let x = RIVER_RECT.x; x < RIVER_RECT.x + RIVER_RECT.w; x += 32) {
    for (let y = RIVER_RECT.y; y < RIVER_RECT.y + RIVER_RECT.h; y += 32) {
      let wt = worldImgs.tile_water;
      if (x === RIVER_RECT.x) wt = worldImgs.tile_water_left;
      else if (y === RIVER_RECT.y) wt = worldImgs.tile_water_top;
      else if (y >= RIVER_RECT.y + RIVER_RECT.h - 32) wt = worldImgs.tile_water_bottom;
      gctx.drawImage(wt, x, y);
    }
  }
  for (let x = DOCK_RECT.x; x < DOCK_RECT.x + DOCK_RECT.w; x += 32) {
    for (let y = DOCK_RECT.y; y < DOCK_RECT.y + DOCK_RECT.h; y += 32) gctx.drawImage(worldImgs.tile_wood, x, y);
  }

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
      custSave.addEventListener("click", async () => {
        const nextCfg = readModalCfg();
        player.name = nextCfg.name;
        player.sheet = await buildCustomLpcSheet(nextCfg);
        player.hasIdle = hasIdleRows(player.sheet);
        playerLabel.textContent = nextCfg.name;
        localStorage.setItem("ai_village_player_v3", JSON.stringify(nextCfg));
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

        ctx.drawImage(groundCanvas, camX, camY, WIDTH, HEIGHT, 0, 0, WIDTH, HEIGHT);

        const renderables = [];
        for (const p of WORLD_PROPS) {
          const img = worldImgs[p.key];
          if (!img) continue;
          const sortY = p.ground ? 0 : p.y + img.height;
          renderables.push({ sortY, draw: () => ctx.drawImage(img, Math.round(p.x - camX), Math.round(p.y - camY)) });
        }
        for (const c of [player, ...npcs]) {
          renderables.push({ sortY: c.y + 62, draw: () => c.draw(camX, camY) });
        }
        renderables.sort((a, b) => a.sortY - b.sortY);
        for (const r of renderables) r.draw();

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
