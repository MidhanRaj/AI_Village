
import asyncio
import json
import os
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

PROJECT = Path(__file__).resolve().parent
OUTPUT = PROJECT / "assets" / "characters"
REPORT = PROJECT / "lpc_catalog_report.json"

SEARCHES = [
    "human head",
    "short hair",
    "long hair",
    "ponytail",
    "beard",
    "shirt",
    "tunic",
    "vest",
    "apron",
    "overalls",
    "robe",
    "armor",
    "pants",
    "boots",
    "hat",
    "hood",
    "glasses",
    "staff",
    "hammer",
    "shield",
    "bow",
]

def get_text(result):
    return "\n".join(
        block.text
        for block in (result.content or [])
        if getattr(block, "text", None)
    )

def parse_result(result):
    raw = get_text(result).strip()
    try:
        return json.loads(raw)
    except Exception:
        return {"raw_text": raw}

def collect_ids(value, found):
    if isinstance(value, dict):
        item_id = value.get("id")
        if isinstance(item_id, str) and "/" in item_id:
            found.add(item_id)

        for child in value.values():
            collect_ids(child, found)

    elif isinstance(value, list):
        for child in value:
            collect_ids(child, found)

async def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)

    server = StdioServerParameters(
        command="lpc-character-mcp",
        args=[],
        env={
            **os.environ,
            "LPC_OUTPUT_DIR": str(OUTPUT)
        }
    )

    report = {
        "search_results": {},
        "item_details": {},
        "output_directory": str(OUTPUT)
    }

    async with stdio_client(server) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            tools = await session.list_tools()
            names = {tool.name for tool in tools.tools}

            if "search_items" not in names:
                raise RuntimeError("search_items not found")

            if "get_item" not in names:
                raise RuntimeError("get_item not found")

            found_ids = set()

            # Search for compatible assets for both body types.
            for body_type in ["male", "female"]:
                for query in SEARCHES:
                    print(f"Searching {body_type}: {query}")

                    result = await session.call_tool(
                        "search_items",
                        arguments={
                            "query": query,
                            "body_type": body_type,
                            "animation": "walk",
                            "complete_only": True,
                            "limit": 20
                        }
                    )

                    data = parse_result(result)

                    report["search_results"][
                        f"{body_type}:{query}"
                    ] = data

                    collect_ids(data, found_ids)

            # Inspect every discovered item.
            for item_id in sorted(found_ids):
                print("Inspecting:", item_id)

                result = await session.call_tool(
                    "get_item",
                    arguments={"item_id": item_id}
                )

                report["item_details"][item_id] = {
                    "is_error": bool(result.is_error),
                    "data": parse_result(result)
                }

    REPORT.write_text(
        json.dumps(report, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )

    print("\nInspection complete!")
    print("Unique assets:", len(found_ids))
    print("Report:", REPORT)

if __name__ == "__main__":
    asyncio.run(main())
