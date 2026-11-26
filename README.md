# 🌲 Whisperwood

### A little village where every villager has a life, a personality, and a memory.

Whisperwood is an AI-powered, pixel-art village simulation where you can explore a medieval fantasy village, meet its inhabitants, and have natural conversations with them.

Unlike traditional games with NPCs limited to predefined dialogue, Whisperwood aims to make every villager feel like an individual. They have different occupations, personalities, knowledge, and memories of their conversations with you.

**Every villager has a story. And they might remember yours.**

---

## ✨ Features

### 🏡 Explore the Village
-Try it out https://midhanraj.github.io/AI_Village/
- Retro, top-down pixel-art experience.
- WASD or arrow-key movement.
- Interact with villagers using the E key.
- NPCs can wander around their surroundings.
- Collision detection and character animations.

### 🧑‍🤝‍🧑 Meet the Villagers
Whisperwood features 12 individually designed villagers, each with a distinct name, appearance, and occupation.

| Villager | Occupation |
|---|---|
| Elara | Blacksmith |
| Aldric | Wizard |
| Luna | Merchant |
| Edric | Farmer |
| Evelyn | Guard |
| Lyra | Healer |
| Orin | Innkeeper |
| Clara | Villager |
| Gareth | Elder |
| Freya | Fisherman |
| Rowan | Villager |
| Isolde | Hunter |

### 🧠 AI-Powered Conversations
- Chat naturally with villagers instead of selecting predefined dialogue options.
- Each occupation has its own personality and conversational style.
- Villagers can discuss their work, interests, everyday life, and other inhabitants.
- Powered by local language models through Ollama in the desktop version.
- Browser version supports in-browser AI through WebLLM.

### 💭 Persistent Memory
Whisperwood aims to make conversations meaningful beyond a single interaction.

- Conversation history is stored separately for each villager.
- Personal facts shared by the player can be saved as memories.
- Villagers can use remembered information in future conversations.
- Desktop memory is stored using SQLite.
- Browser conversation history is stored using local storage.

### 🎨 Character Customization
- Choose your character's name and body type.
- Customize skin tone, hairstyle, hair colour, clothing, and headwear.
- Randomize your appearance.
- Save your character configuration.
- Character sprites are generated using the Universal LPC Character Generator.

---

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| Python | Main game logic |
| Pygame | Desktop game and rendering |
| Ollama | Local AI inference |
| Qwen 2.5 | Conversational AI model |
| SQLite | Persistent NPC memory |
| MCP | LPC character generator integration |
| Universal LPC | Pixel-art character assets |
| HTML, CSS, JavaScript | Browser version |
| WebLLM | In-browser AI inference |

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/MidhanRaj/AI_Village.git
cd AI_Village
```

### 2. Install Python dependencies

```bash
py -m pip install pygame mcp lpc-character-mcp
```

### 3. Set up the character generator

```bash
lpc-character-mcp --setup
```

The project includes pre-generated character sprites, so you can start exploring without generating them again.

### 4. Install Ollama

Download Ollama:

https://ollama.com/

Pull the recommended model:

```bash
ollama pull qwen2.5:3b
```

Make sure Ollama is running.

### 5. Launch Whisperwood

```bash
py main.py
```

---

## 🎮 Controls

| Key | Action |
|---|---|
| W / ↑ | Move up |
| A / ← | Move left |
| S / ↓ | Move down |
| D / → | Move right |
| E | Talk to a nearby villager |
| C | Customize player |
| ESC | Close dialogue |

---

## 🌐 Browser Version

Whisperwood also includes a browser-based version in the `docs/` directory.

It uses HTML, CSS, and JavaScript for the game, with WebLLM for optional in-browser AI conversations.

To host it using GitHub Pages:

1. Open your GitHub repository.
2. Go to **Settings → Pages**.
3. Select **Deploy from a branch**.
4. Choose the `main` branch.
5. Select `/docs` as the folder.
6. Save.

The browser AI may need to download its model the first time and requires compatible browser hardware.

---

## 📁 Project Structure

```text
AI_Village/
│
├── main.py                  # Pygame desktop game
├── ai_brain.py              # AI conversations and NPC memory
├── player_customizer.py     # Player customization
├── generate_villagers.py    # Villager sprite generation
├── inspect_lpc_items.py     # LPC asset inspection
├── test_lpc.py              # LPC generator testing
│
├── villagers.json           # Villager data and appearance
├── player_config.json       # Saved player configuration
│
├── assets/
│   └── characters/          # Character sprites and credits
│
└── docs/
    ├── index.html           # Browser game
    ├── game.js              # Browser game logic
    ├── style.css            # Browser styling
    ├── villagers.json       # Browser villager data
    └── assets/              # Browser character assets
```

---

## 🗺️ The Vision

Whisperwood is an experiment in making game worlds feel more alive.

The long-term idea is to move beyond NPCs that simply repeat scripted lines. Imagine a village where:

- Villagers remember your previous conversations.
- Different characters have different opinions.
- Villagers know one another and can discuss each other.
- Conversations can influence relationships.
- The world develops stories through player interactions.
- Every playthrough can create different experiences.

The goal isn't just to build a game where you talk to AI.

**It's to build a world where you feel like you're meeting people.**

---

## 📜 Asset Credits

Character sprites are generated using the [Universal LPC Character Generator](https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/).

Individual character credit information is included alongside generated sprites in the `assets/characters/` directory.

Please refer to the original asset licenses and attribution requirements when redistributing assets.

---

## 👨‍💻 Project

**Whisperwood — An AI-powered living village experiment.**

Built with Python, Pygame, local AI, and pixel art.

