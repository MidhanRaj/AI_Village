"""
AI Brain for AI Village:
- SQLite persistent conversation history & memories per villager
- Local Ollama chat integration (auto-detects Qwen/local models if needed)
- Role-based personalities and shared village roster context
"""
import json
import os
import sqlite3
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "village_memory.db"

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
DEFAULT_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:3b")

ROLE_PERSONALITIES = {
    "Blacksmith": "You are gruff, practical, and proud of your forge work. You speak plainly and often mention metal, tools, heat, or repairing gear.",
    "Wizard": "You are wise, eccentric, and slightly mysterious. You speak thoughtfully and occasionally mention arcane studies, stars, or strange energies.",
    "Witch": "You are sharp-witted, mysterious, and deeply knowledgeable about herbs, charms, and village secrets.",
    "Merchant": "You are friendly, persuasive, and always thinking about trade, prices, goods, and news from travelers.",
    "Farmer": "You are warm, grounded, and hardworking. You care about the weather, crops, soil, and simple village life.",
    "Guard": "You are alert, dutiful, and protective of the village. You keep an eye on strangers and care about order and safety.",
    "Healer": "You are gentle, empathetic, and attentive. You care about everyone's health, herbs, and wellbeing.",
    "Innkeeper": "You are jovial, hospitable, and love hearing and sharing local stories over warm food and drink.",
    "Elder": "You are patient, nostalgic, and respected. You remember the village's history and offer calm advice.",
    "Fisherman": "You are relaxed, observant, and fond of the water, tides, and tall tales about big catches.",
    "Fisherwoman": "You are sharp, independent, and fond of the water, tides, and stories about what bites in the river.",
    "Hunter": "You are quiet, keen-eyed, and practical. You know the woods, tracks, and wildlife around the village.",
    "Villager": "You are friendly, curious, and enjoy chatting about daily life and neighbors in the village.",
}


def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                villager_name TEXT NOT NULL,
                sender TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                villager_name TEXT NOT NULL,
                fact TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def get_recent_messages(villager_name, limit=10):
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute(
            """
            SELECT sender, content
            FROM messages
            WHERE villager_name = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (villager_name, limit),
        ).fetchall()
    return list(reversed(rows))


def save_message(villager_name, sender, content):
    now = datetime.utcnow().isoformat()
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "INSERT INTO messages (villager_name, sender, content, created_at) VALUES (?, ?, ?, ?)",
            (villager_name, sender, content, now),
        )
        conn.commit()


def get_memories(villager_name, limit=8):
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute(
            """
            SELECT fact
            FROM memories
            WHERE villager_name = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (villager_name, limit),
        ).fetchall()
    return [r[0] for r in reversed(rows)]


def save_memory(villager_name, fact):
    fact = fact.strip()
    if not fact:
        return
    now = datetime.utcnow().isoformat()
    with sqlite3.connect(DB_PATH) as conn:
        existing = conn.execute(
            "SELECT 1 FROM memories WHERE villager_name = ? AND fact = ?",
            (villager_name, fact),
        ).fetchone()
        if not existing:
            conn.execute(
                "INSERT INTO memories (villager_name, fact, created_at) VALUES (?, ?, ?)",
                (villager_name, fact, now),
            )
            conn.commit()


def pick_ollama_model():
    """Return DEFAULT_MODEL if available, otherwise first Qwen or installed model."""
    try:
        req = urllib.request.Request(f"{OLLAMA_URL}/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=2.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        models = [m.get("name", "") for m in data.get("models", []) if m.get("name")]
        if not models:
            return None
        if DEFAULT_MODEL in models:
            return DEFAULT_MODEL
        for m in models:
            if "qwen" in m.lower():
                return m
        return models[0]
    except Exception:
        return None


def build_system_prompt(villager_name, role, roster_summary, memories, player_name="Traveler"):
    personality = ROLE_PERSONALITIES.get(role, ROLE_PERSONALITIES["Villager"])
    memory_block = (
        "\n".join(f"- {m}" for m in memories)
        if memories
        else "- You have not learned any specific personal facts about this traveler yet."
    )
    return (
        f"You are {villager_name}, a real person living in a medieval fantasy village who works as the {role}.\n"
        f"You are chatting casually with {player_name}.\n"
        f"{personality}\n\n"
        f"Other villagers you know:\n{roster_summary}\n\n"
        f"Memories about {player_name}:\n{memory_block}\n\n"
        "How to speak:\n"
        "- Talk like a warm, down-to-earth human being—NOT a customer-service bot or assistant.\n"
        "- You have personal opinions, feelings, hobbies, and humor outside of work. If asked about dogs, food, boredom, or everyday life, answer naturally as a person (never say 'I am a smith, not related to dogs' or 'feel free to ask' or 'how can I assist').\n"
        "- Stay in your medieval world; if asked about something unfamiliar, react with curiosity or guess casually.\n"
        "- Reply in 1 to 2 natural, conversational sentences."
    )


def chat_with_villager(villager_name, role, user_text, roster_summary, player_name="Traveler"):
    """Send player message to Ollama, persist chat + memory in SQLite, return reply."""
    save_message(villager_name, "player", user_text)

    # Store simple player facts if they introduce themselves or share preferences
    lowered = user_text.lower()
    if any(k in lowered for k in ("my name is", "i am ", "i'm ", "i like ", "i love ", "from ")):
        save_memory(villager_name, f"The player said: {user_text[:140]}")

    model = pick_ollama_model()
    if not model:
        reply = (
            f"[{villager_name} looks thoughtful] (No Ollama model found. "
            f"Run 'ollama pull qwen2.5:3b' and ensure Ollama is running.)"
        )
        save_message(villager_name, "villager", reply)
        return reply

    memories = get_memories(villager_name)
    history = get_recent_messages(villager_name, limit=10)

    messages = [
        {"role": "system", "content": build_system_prompt(villager_name, role, roster_summary, memories, player_name)}
    ]
    for sender, content in history:
        messages.append({
            "role": "user" if sender == "player" else "assistant",
            "content": content,
        })

    payload = json.dumps({
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {"temperature": 0.7, "num_predict": 120},
    }).encode("utf-8")

    try:
        req = urllib.request.Request(
            f"{OLLAMA_URL}/api/chat",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        reply = data.get("message", {}).get("content", "").strip()
        if not reply:
            reply = "..."
    except urllib.error.URLError:
        reply = f"[{villager_name} couldn't be reached — is Ollama running on {OLLAMA_URL}?]"
    except Exception as e:
        reply = f"[{villager_name} pauses] (Error: {e})"

    save_message(villager_name, "villager", reply)
    return reply
