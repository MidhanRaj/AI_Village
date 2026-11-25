"""
Player customization config + LPC sprite renderer for AI Village.
Saves choices to player_config.json and renders assets/characters/player_custom.png.
"""
import asyncio
import json
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "assets" / "characters"
CONFIG_FILE = BASE_DIR / "player_config.json"
PLAYER_SPRITE = OUTPUT_DIR / "player_custom.png"

GENDERS = ["male", "female"]
SKINS = ["light", "olive", "bronze", "brown", "taupe"]
HAIR_STYLES = {
    "male": [
        ("Bedhead", "hair/short/hair_bedhead"),
        ("Cowlick", "hair/short/hair_cowlick"),
        ("Curly Short", "hair/curly/hair_curly_short"),
        ("Short Bob", "hair/bob/hair_relm_short"),
        ("Half Messy", "hair/spiky/hair_halfmessy"),
        ("Ponytail", "hair/ponytails/hair_ponytail"),
    ],
    "female": [
        ("Ponytail", "hair/braids/hair_ponytail2"),
        ("Bangs", "hair/short/hair_bangs"),
        ("Curly Long", "hair/curly/hair_curly_long"),
        ("Large Curls", "hair/curly/hair_curls_large"),
        ("Pigtails", "hair/pigtails/hair_pigtails"),
        ("Topknot", "hair/braids/hair_topknot_long"),
    ],
}
HAIR_COLORS = ["black", "chestnut", "light_brown", "sandy", "ginger", "ash", "white"]
SHIRTS = [
    ("Tunic (Red)", "torso/shirts/shortsleeve/torso_clothes_shortsleeve", "red"),
    ("Tunic (Teal)", "torso/shirts/shortsleeve/torso_clothes_shortsleeve", "teal"),
    ("Tunic (Tan)", "torso/shirts/shortsleeve/torso_clothes_shortsleeve", "tan"),
    ("V-Neck (Maroon)", "torso/shirts/longsleeve/torso_clothes_longsleeve2_vneck", "maroon"),
    ("V-Neck (Blue)", "torso/shirts/longsleeve/torso_clothes_longsleeve2_vneck", "bluegray"),
    ("Cardigan (White)", "torso/shirts/longsleeve/torso_clothes_longsleeve2_cardigan", "white"),
    ("Polo (Slate)", "torso/shirts/longsleeve/torso_clothes_longsleeve2_polo", "slate"),
]
LEGS = [
    ("Pants (Charcoal)", "legs/pants/legs_pants", "charcoal"),
    ("Pants (Blue)", "legs/pants/legs_pants", "blue"),
    ("Pants (Oak)", "legs/pants/legs_pants", "oak"),
    ("Cuffed (Tan)", "legs/pants/legs_cuffed", "tan"),
    ("Skirt (Sky)", "legs/skirts/legs_skirts_plain", "sky"),
    ("Skirt (White)", "legs/skirts/legs_skirts_plain", "white"),
]
HATS = [
    ("None", None),
    ("Bandana", "headwear/coverings/bandana/hat_bandana"),
    ("Kerchief", "headwear/coverings/headbands/hat_headband_kerchief"),
    ("Leather Cap", "headwear/hats/caps/hat_cap_leather"),
    ("Bowler Hat", "headwear/hats/formal/hat_formal_bowler"),
    ("Wizard Hat", "headwear/hats/magic/hat_magic_wizard"),
    ("Celestial Hat", "headwear/hats/magic/hat_magic_celestial"),
]

DEFAULT_CONFIG = {
    "name": "Traveler",
    "gender": "male",
    "skin_idx": 0,
    "hair_idx": 0,
    "hair_color_idx": 1,
    "shirt_idx": 1,
    "legs_idx": 0,
    "hat_idx": 0,
}


def load_config():
    cfg = dict(DEFAULT_CONFIG)
    if CONFIG_FILE.exists():
        try:
            loaded = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
            cfg.update({k: v for k, v in loaded.items() if k in DEFAULT_CONFIG})
        except Exception:
            pass
    return cfg


def save_config(cfg):
    CONFIG_FILE.write_text(json.dumps(cfg, indent=2), encoding="utf-8")


def build_player_items(cfg):
    gender = cfg["gender"]
    skin = SKINS[cfg["skin_idx"] % len(SKINS)]
    head = "head/heads/human/heads_human_male" if gender == "male" else "head/heads/human/heads_human_female"
    hair_pool = HAIR_STYLES[gender]
    _, hair_id = hair_pool[cfg["hair_idx"] % len(hair_pool)]
    hair_color = HAIR_COLORS[cfg["hair_color_idx"] % len(HAIR_COLORS)]
    _, shirt_id, shirt_color = SHIRTS[cfg["shirt_idx"] % len(SHIRTS)]
    _, legs_id, legs_color = LEGS[cfg["legs_idx"] % len(LEGS)]
    _, hat_id = HATS[cfg["hat_idx"] % len(HATS)]

    items = [
        {"id": "body/body", "color": skin},
        {"id": head},
        {"id": hair_id, "color": hair_color},
        {"id": shirt_id, "color": shirt_color},
        {"id": legs_id, "color": legs_color},
        {"id": "feet/boots/feet_boots_basic", "color": "oak"},
    ]
    if hat_id:
        items.append({"id": hat_id})
    return items


async def _render_async(cfg):
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    items = build_player_items(cfg)
    body_type = cfg["gender"]

    server = StdioServerParameters(
        command="lpc-character-mcp",
        args=[],
        env={**os.environ, "LPC_OUTPUT_DIR": str(OUTPUT_DIR)},
    )
    async with stdio_client(server) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            async def call_gen(layer_items, fname):
                return await session.call_tool("generate_character", arguments={
                    "items": layer_items,
                    "body_type": body_type,
                    "animations": ["walk", "idle"],
                    "filename": fname,
                    "layout": "standard",
                    "split": False,
                    "prefer_complete": False,
                    "output_dir": str(OUTPUT_DIR),
                })

            res = await call_gen(items, PLAYER_SPRITE.name)
            if not (getattr(res, "isError", False) or getattr(res, "is_error", False)):
                return True

            # Fallback repair: drop any incompatible layer/color
            fixed = list(items[:2])
            for it in items[2:]:
                probe = await call_gen(items[:2] + [it], "_probe_player.png")
                if not (getattr(probe, "isError", False) or getattr(probe, "is_error", False)):
                    fixed.append(it)
                elif "color" in it:
                    plain = {"id": it["id"]}
                    probe = await call_gen(items[:2] + [plain], "_probe_player.png")
                    if not (getattr(probe, "isError", False) or getattr(probe, "is_error", False)):
                        fixed.append(plain)
            (OUTPUT_DIR / "_probe_player.png").unlink(missing_ok=True)
            res2 = await call_gen(fixed, PLAYER_SPRITE.name)
            return not (getattr(res2, "isError", False) or getattr(res2, "is_error", False))


def render_player_sprite(cfg):
    save_config(cfg)
    return asyncio.run(_render_async(cfg))
