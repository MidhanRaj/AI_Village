"""
AI Village - deterministic villager generator (v2)

What changed vs v1:
  * No random_character / no random clothes. Each role has a hand-written outfit
    recipe; colours come from small harmonious palettes.
  * Identities (name/gender/role/seed) in villagers.json are KEPT. Re-running only
    rebuilds appearance, so a villager never changes who they are.
  * Gender-aware heads, hair and beards (the catalog's body_type filter does NOT
    filter heads/hair, so we do it ourselves).
  * Render call matches the working test_lpc.py exactly (walk only, split=False,
    ".png" filename). If a render fails it probes items one by one, strips bad
    colours / drops bad items, and tells you which ones were the problem.

Usage:
  python generate_villagers.py --dry-run     # build villagers.json only, no MCP
  python generate_villagers.py               # build + render PNGs
  python generate_villagers.py --only Elara  # one villager (good for debugging)
  python generate_villagers.py --force       # re-render even if PNG exists
  python generate_villagers.py --reroll Elara  # new look for one villager
"""
import argparse
import asyncio
import json
import os
import random
import re
import sys
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = PROJECT_DIR / "assets" / "characters"
MANIFEST_FILE = PROJECT_DIR / "villagers.json"
CATALOG_REPORT = PROJECT_DIR / "lpc_catalog_report.json"

MASTER_SEED = 20261125
ANIMATIONS = ["walk", "idle"]

NAMES = {
    "male": ["Aldric", "Rowan", "Bram", "Kael", "Tomas", "Cedric", "Finn", "Gareth", "Darian",
             "Milo", "Edric", "Silas", "Arthur", "Elias", "Orin", "Felix", "Ronan", "Theo"],
    "female": ["Elara", "Mira", "Lyra", "Nora", "Freya", "Evelyn", "Isolde", "Clara", "Iris",
               "Luna", "Amara", "Vera", "Rosalie", "Alice", "Maeve", "Talia", "Sophie", "Eira"],
}

ROLES = ["Blacksmith", "Wizard", "Merchant", "Farmer", "Guard", "Healer",
         "Innkeeper", "Villager", "Elder", "Fisherman", "Villager", "Hunter"]

# ---------------------------------------------------------------------------
# Appearance pools (item names are the last part of the LPC id; full ids are
# resolved from lpc_catalog_report.json / the old manifest at runtime)
# ---------------------------------------------------------------------------
SKIN = ["light", "olive", "bronze", "brown", "taupe"]
HAIR_COLORS = ["black", "chestnut", "light_brown", "sandy", "ginger", "redhead", "ash"]
OLD_HAIR = ["white", "ash", "platinum"]

HEADS = {
    "male": ["heads_human_male", "heads_human_male", "heads_human_male_plump", "heads_human_male_small"],
    "female": ["heads_human_female", "heads_human_female", "heads_human_female_small"],
}
ELDER_HEAD = {"male": "heads_human_male_elderly", "female": "heads_human_female_elderly"}

HAIR = {
    "male": ["hair_bedhead", "hair_cowlick", "hair_curly_short", "hair_relm_short",
             "hair_topknot_short", "hair_halfmessy", "hair_unkempt", "hair_ponytail"],
    "female": ["hair_ponytail2", "hair_high_ponytail", "hair_topknot_long", "hair_curly_long",
               "hair_long_tied", "hair_pigtails", "hair_curls_large", "hair_bangs"],
}
BEARDS = ["beards_trimmed", "beards_beard", "beards_medium", "beards_5oclock_shadow", "beards_mustache"]

# Role recipes. Lists = random choice (seeded). Missing keys = nothing worn.
OUTFITS = {
    "Blacksmith": dict(shirt=["torso_clothes_shortsleeve"], shirt_c=["red", "charcoal", "tan"],
                       apron=["torso_aprons_apron"], apron_c=["brown", "black", "leather"],
                       gloves=["arms_gloves"],
                       tool=["tool_hammer"],
                       legs=["legs_pants"], legs_c=["charcoal", "oak"],
                       feet=["feet_boots_basic"], feet_c=["black", "oak"],
                       hat=["hat_headband_kerchief"], hat_chance=1.0, beard_chance=0.8),
    "Wizard":     dict(shirt=["torso_clothes_longsleeve2_vneck"], shirt_c=["bluegray", "maroon", "navy"],
                       cape=["cape_solid"], cape_c=["purple", "blue", "maroon"],
                       belt=["belt_robe"],
                       tool=["weapon_magic_gnarled", "weapon_magic_crystal"],
                       legs=["legs_pantaloons"], legs_c=["bluegray", "charcoal"],
                       feet=["feet_boots_rim"], feet_c=["black"],
                       hat=["hat_magic_wizard", "hat_magic_celestial"], hat_c=["blue", "purple", "black"],
                       hat_chance=1.0, beard_chance=1.0, glasses=["facial_glasses_round"],
                       glasses_chance=0.7, old=True),
    "Merchant":   dict(shirt=["torso_clothes_longsleeve2_buttoned"], shirt_c=["ivory", "maroon", "orange"],
                       vest=["torso_clothes_vest"], vest_c=["maroon", "brown", "black"],
                       belt=["belt_formal"],
                       legs=["legs_formal"], legs_c=["black", "charcoal"],
                       feet=["feet_boots_rim"], feet_c=["black", "oak"],
                       hat=["hat_formal_bowler"], hat_chance=1.0, beard_chance=0.4),
    "Farmer":     dict(shirt=["torso_clothes_longsleeve"], shirt_c=["tan", "ivory", "orange"],
                       apron=["torso_aprons_suspenders"],
                       tool=["tool_hoe", "tool_watering_can"],
                       legs=["legs_pants"], legs_c=["oak", "tan"],
                       feet=["feet_boots_fold"], feet_c=["oak", "leather"],
                       hat=["hat_headband_kerchief"], hat_chance=0.9, beard_chance=0.4),
    "Guard":      dict(shirt=["torso_clothes_longsleeve2_polo"], shirt_c=["bluegray", "slate"],
                       armor=["torso_armour_plate", "torso_torso_chainmail"],
                       tool=["weapon_polearm_spear", "weapon_sword_longsword"],
                       shield=["shield_kite"],
                       legs=["legs_formal"], legs_c=["charcoal", "gray"],
                       feet=["feet_boots_revised"], feet_c=["black"],
                       hat=["hat_helmet_kettle", "hat_helmet_norman"], hat_chance=1.0, beard_chance=0.3),
    "Healer":     dict(shirt=["torso_clothes_longsleeve2_cardigan"], shirt_c=["white", "ivory"],
                       belt=["belt_sash"], belt_c=["sky", "teal"],
                       legs=["legs_skirts_plain"], legs_female=["legs_skirts_plain"], legs_male=["legs_pants"],
                       legs_c=["white", "sky"],
                       feet=["feet_boots_basic"], feet_c=["ivory", "oak"],
                       hat=["hat_headband_tied"], hat_chance=0.8, beard_chance=0.1),
    "Innkeeper":  dict(shirt=["torso_clothes_longsleeve2_buttoned"], shirt_c=["ivory", "tan"],
                       vest=["torso_clothes_vest_open"], vest_c=["brown", "maroon"],
                       apron=["torso_aprons_apron"], apron_c=["white", "ivory"],
                       legs=["legs_cuffed"], legs_c=["oak", "charcoal"],
                       feet=["feet_boots_basic"], feet_c=["oak"],
                       hat_chance=0.0, beard_chance=0.7),
    "Villager":   dict(shirt=["torso_clothes_tshirt_scoop", "torso_clothes_shortsleeve"],
                       shirt_c=["sky", "tan", "teal", "orange", "ivory", "red"],
                       legs=["legs_pants", "legs_pants2"], legs_female=["legs_skirts_plain", "legs_pants2"],
                       legs_c=["oak", "blue", "gray", "tan"],
                       feet=["feet_boots_basic", "feet_shoes_basic"],
                       feet_c=["oak", "brown", "black"], hat_chance=0.15, hat=["hat_headband_kerchief"], beard_chance=0.3),
    "Elder":      dict(shirt=["torso_clothes_longsleeve2_cardigan"], shirt_c=["bluegray", "maroon"],
                       vest=["torso_jacket_iverness"],
                       belt=["belt_robe"],
                       tool=["weapon_magic_simple"],
                       legs=["legs_pants"], legs_c=["gray", "charcoal"],
                       feet=["feet_boots_basic"], feet_c=["oak"],
                       hat_chance=0.0, beard_chance=0.8, glasses=["facial_glasses_halfmoon"], glasses_chance=1.0, old=True),
    "Fisherman":  dict(shirt=["torso_clothes_longsleeve_scoop"], shirt_c=["sky", "bluegray"],
                       apron=["torso_aprons_overalls"], apron_c=["blue", "navy", "tan"],
                       legs=["legs_cuffed"], legs_c=["tan", "oak"],
                       feet=["feet_boots_fold"], feet_c=["oak", "black"],
                       hat=["hat_cap_bonnie", "hat_bandana"], hat_chance=1.0, beard_chance=0.6),
    "Hunter":     dict(shirt=["torso_clothes_longsleeve2_polo"], shirt_c=["tan", "oak", "teal"],
                       armor=["torso_armour_leather"],
                       cape=["cape_solid"], cape_c=["forest", "green", "brown"],
                       back=["quiver"],
                       tool=["weapon_ranged_crossbow"],
                       legs=["legs_pants2"], legs_c=["oak", "charcoal"],
                       feet=["feet_boots_revised"], feet_c=["oak", "black"],
                       hat=["hat_cap_leather"], hat_chance=1.0, beard_chance=0.4),
}

EXTRA_IDS = {
    "arms_gloves": "arms/arms_gloves",
    "hat_magic_wizard": "headwear/hats/magic/hat_magic_wizard",
    "hat_magic_celestial": "headwear/hats/magic/hat_magic_celestial",
    "hat_magic_large": "headwear/hats/magic/hat_magic_large",
    "hat_helmet_kettle": "headwear/helmets/helmets/hat_helmet_kettle",
    "hat_helmet_norman": "headwear/helmets/helmets/hat_helmet_norman",
    "hat_cap_bonnie": "headwear/hats/caps/hat_cap_bonnie",
    "hat_cap_leather": "headwear/hats/caps/hat_cap_leather",
    "hat_headband_tied": "headwear/coverings/headbands/hat_headband_tied",
    "legs_skirts_plain": "legs/skirts/legs_skirts_plain",
    "tool_hammer": "tools/tool_hammer",
    "tool_hoe": "tools/tool_hoe",
    "tool_watering_can": "tools/tool_watering_can",
    "torso_aprons_apron": "torso/aprons/torso_aprons_apron",
    "torso_armour_plate": "torso/armour/torso_armour_plate",
    "torso_armour_leather": "torso/armour/torso_armour_leather",
    "torso_torso_chainmail": "torso/torso_chainmail",
    "quiver": "torso/backpack/quiver",
    "cape_solid": "torso/cape/cape_solid",
    "torso_jacket_iverness": "torso/jacket/torso_jacket_iverness",
    "torso_clothes_vest": "torso/vest/torso_clothes_vest",
    "torso_clothes_vest_open": "torso/vest/torso_clothes_vest_open",
    "belt_formal": "torso/waist/belt_formal",
    "belt_robe": "torso/waist/belt_robe",
    "belt_sash": "torso/waist/belt_sash",
    "weapon_magic_gnarled": "weapons/magic/weapon_magic_gnarled",
    "weapon_magic_crystal": "weapons/magic/weapon_magic_crystal",
    "weapon_magic_simple": "weapons/magic/weapon_magic_simple",
    "weapon_polearm_spear": "weapons/polearm/weapon_polearm_spear",
    "weapon_sword_longsword": "weapons/sword/weapon_sword_longsword",
    "weapon_ranged_crossbow": "weapons/ranged/weapon_ranged_crossbow",
    "shield_kite": "weapons/shields/shield_kite",
}


# ---------------------------------------------------------------------------
# id resolution: basename -> full LPC id
# ---------------------------------------------------------------------------
def build_id_lookup():
    lookup = {}

    def add(item_id):
        if isinstance(item_id, str) and "/" in item_id:
            lookup[item_id.split("/")[-1]] = item_id

    if CATALOG_REPORT.exists():
        # The report stores MCP replies as JSON *strings*, so decode first, then scan.
        def scan(value):
            if isinstance(value, dict):
                for child in value.values():
                    scan(child)
            elif isinstance(value, list):
                for child in value:
                    scan(child)
            elif isinstance(value, str):
                for m in re.findall(r'"id":\s*"([^"]+)"', value):
                    add(m)
        try:
            scan(json.loads(CATALOG_REPORT.read_text(encoding="utf-8")))
        except Exception as e:
            print("warning: could not read catalog report:", e)
    if MANIFEST_FILE.exists():
        try:
            for v in json.loads(MANIFEST_FILE.read_text(encoding="utf-8")).get("villagers", []):
                for it in v.get("items", []):
                    add(it.get("id"))
        except Exception:
            pass
    lookup["body"] = "body/body"
    lookup.update(EXTRA_IDS)
    return lookup


LOOKUP = build_id_lookup()
MISSING = set()


def rid(basename):
    full = LOOKUP.get(basename)
    if full is None:
        MISSING.add(basename)
    return full


def layer(basename, color=None):
    full = rid(basename)
    if full is None:
        return None
    item = {"id": full}
    if color:
        item["color"] = color
    return item


# ---------------------------------------------------------------------------
# appearance builder (pure function of identity + seed -> same look every time)
# ---------------------------------------------------------------------------
def build_items(role, gender, seed):
    rng = random.Random(seed)
    o = OUTFITS[role]
    old = o.get("old", False)

    head = ELDER_HEAD[gender] if old else rng.choice(HEADS[gender])
    hair_color = rng.choice(OLD_HAIR if old else HAIR_COLORS)

    items = [
        layer("body", rng.choice(SKIN)),
        layer(head),
        layer(rng.choice(HAIR[gender]), hair_color),
    ]
    if gender == "male" and rng.random() < o.get("beard_chance", 0):
        items.append(layer(rng.choice(BEARDS), hair_color))

    items.append(layer(rng.choice(o["shirt"]), rng.choice(o["shirt_c"])))
    for slot, color_key in [("armor", None), ("vest", "vest_c"), ("apron", "apron_c"),
                            ("cape", "cape_c"), ("belt", "belt_c"), ("gloves", None), ("back", None)]:
        if slot in o:
            col = rng.choice(o[color_key]) if color_key and color_key in o else None
            items.append(layer(rng.choice(o[slot]), col))

    legs_pool = o.get(f"legs_{gender}", o["legs"])
    items.append(layer(rng.choice(legs_pool), rng.choice(o["legs_c"])))
    items.append(layer(rng.choice(o["feet"]), rng.choice(o["feet_c"])))
    if o.get("hat") and rng.random() < o.get("hat_chance", 0):
        hat_col = rng.choice(o["hat_c"]) if "hat_c" in o else None
        items.append(layer(rng.choice(o["hat"]), hat_col))
    if o.get("glasses") and rng.random() < o.get("glasses_chance", 0):
        items.append(layer(rng.choice(o["glasses"])))
    for slot in ("tool", "shield"):
        if slot in o:
            items.append(layer(rng.choice(o[slot])))

    return [i for i in items if i]


# ---------------------------------------------------------------------------
# identities (kept stable across runs)
# ---------------------------------------------------------------------------
def load_identities():
    if MANIFEST_FILE.exists():
        try:
            data = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
            vs = data.get("villagers", [])
            if len(vs) == len(ROLES):
                return {v["id"]: v for v in vs}
        except Exception:
            pass
    return {}


def make_identities():
    rng = random.Random(MASTER_SEED)
    pool = {g: NAMES[g][:] for g in NAMES}
    for g in pool:
        rng.shuffle(pool[g])
    out = {}
    for idx, role in enumerate(ROLES, start=1):
        gender = rng.choice(["male", "female"])
        out[idx] = dict(id=idx, name=pool[gender].pop(), gender=gender, role=role,
                        seed=rng.randint(1, 2_000_000_000))
    return out


def build_manifest(reroll=None):
    old = load_identities()
    ident = old or make_identities()
    villagers = []
    for idx in range(1, len(ROLES) + 1):
        base = ident[idx]
        seed = base["seed"]
        if reroll and base["name"].lower() == reroll.lower():
            seed = random.randint(1, 2_000_000_000)
        filename = f"villager_{idx:02d}_{base['name'].lower()}"
        villagers.append({
            "id": idx, "name": base["name"], "gender": base["gender"], "role": base["role"],
            "body_type": base["gender"], "seed": seed,
            "filename": filename, "sprite": f"assets/characters/{filename}.png",
            "items": build_items(base["role"], base["gender"], seed),
            "rendered": bool(base.get("rendered")) and seed == base["seed"],
        })
    return villagers


def save_manifest(villagers):
    MANIFEST_FILE.write_text(json.dumps({"village_seed": MASTER_SEED, "villagers": villagers},
                                        indent=4, ensure_ascii=False), encoding="utf-8")


# ---------------------------------------------------------------------------
# rendering (MCP)
# ---------------------------------------------------------------------------
def result_text(result):
    return "\n".join(getattr(c, "text", "") for c in (getattr(result, "content", None) or []) if getattr(c, "text", ""))


def is_err(result):
    return bool(getattr(result, "isError", False) or getattr(result, "is_error", False))


async def render(session, items, body_type, filename):
    return await session.call_tool("generate_character", arguments={
        "items": items,
        "body_type": body_type,
        "animations": ANIMATIONS,
        "filename": filename,          # with .png, exactly like the working test_lpc.py
        "layout": "standard",
        "split": False,
        "prefer_complete": False,
        "output_dir": str(OUTPUT_DIR),
    })


async def render_with_repair(session, v):
    """Try the full outfit. On failure find which layers break and fix/drop them."""
    items, gender, png = v["items"], v["gender"], v["filename"] + ".png"
    res = await render(session, items, gender, png)
    if not is_err(res):
        return items, []

    print(f"    ! render failed: {result_text(res) or res!r}")
    print("    probing layers...")
    notes = []
    base = items[:2]                                   # body + head always required
    fixed = list(base)
    for it in items[2:]:
        probe = await render(session, base + [it], gender, "_probe.png")
        if not is_err(probe):
            fixed.append(it)
            continue
        if "color" in it:
            plain = {"id": it["id"]}
            probe = await render(session, base + [plain], gender, "_probe.png")
            if not is_err(probe):
                notes.append(f"colour '{it['color']}' not valid for {it['id']} -> used default colour")
                fixed.append(plain)
                continue
        notes.append(f"dropped {it['id']} (breaks rendering)")
    res = await render(session, fixed, gender, png)
    (OUTPUT_DIR / "_probe.png").unlink(missing_ok=True)
    if is_err(res):
        raise RuntimeError("still failing after repair: " + (result_text(res) or repr(res)))
    return fixed, notes


async def render_all(villagers, only, force):
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    server = StdioServerParameters(command="lpc-character-mcp", args=[],
                                   env={**os.environ, "LPC_OUTPUT_DIR": str(OUTPUT_DIR)})
    async with stdio_client(server) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            for v in villagers:
                if only and v["name"].lower() != only.lower():
                    continue
                png = PROJECT_DIR / v["sprite"]
                if png.exists() and v.get("rendered") and not force:
                    print(f"skip {v['name']} (already rendered)")
                    continue
                print(f"\n== {v['name']} | {v['gender']} | {v['role']}")
                try:
                    items, notes = await render_with_repair(session, v)
                    v["items"] = items
                    v["rendered"] = png.exists()
                    for n in notes:
                        print("    ~", n)
                    print("    OK" if v["rendered"] else "    ! tool said OK but PNG is missing")
                except Exception as e:
                    v["rendered"] = False
                    print("    FAILED:", e)
                save_manifest(villagers)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--only")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--reroll")
    args = ap.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    villagers = build_manifest(reroll=args.reroll)
    if args.reroll:
        for v in villagers:
            if v["name"].lower() == args.reroll.lower():
                v["rendered"] = False
    save_manifest(villagers)

    if MISSING:
        print("WARNING: not in catalog report, skipped:", ", ".join(sorted(MISSING)))
        print("         (run inspect_lpc_items.py with more search terms to find them)\n")

    for v in villagers:
        print(f"{v['id']:>2} {v['name']:<8} {v['gender']:<6} {v['role']:<10} "
              + ", ".join(i["id"].split("/")[-1] + (f":{i['color']}" if "color" in i else "") for i in v["items"]))

    if args.dry_run:
        print("\nDry run: villagers.json written, nothing rendered.")
        return
    asyncio.run(render_all(villagers, args.only, args.force))
    done = sum(1 for v in villagers if v.get("rendered"))
    print(f"\nRendered {done}/{len(villagers)} villagers.")


if __name__ == "__main__":
    main()