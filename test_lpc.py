
import asyncio
import json
import os
import traceback

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


OUTPUT_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "assets",
    "characters"
)

os.makedirs(OUTPUT_DIR, exist_ok=True)


def print_result(result):
    """Print all text returned by an MCP tool."""
    for item in result.content:
        if hasattr(item, "text"):
            print(item.text)
        else:
            print(item)


async def main():
    server = StdioServerParameters(
        command="lpc-character-mcp",
        args=[],
        env={
            **os.environ,
            "LPC_OUTPUT_DIR": OUTPUT_DIR
        }
    )

    async with stdio_client(server) as (read, write):
        async with ClientSession(read, write) as session:

            print("\nConnecting to LPC Character Generator...")

            await session.initialize()

            # --------------------------------------------------
            # 1. Inspect generate_character schema
            # --------------------------------------------------

            tools = await session.list_tools()

            generate_tool = next(
                (tool for tool in tools.tools
                 if tool.name == "generate_character"),
                None
            )

            random_tool = next(
                (tool for tool in tools.tools
                 if tool.name == "random_character"),
                None
            )

            if generate_tool is None:
                print("ERROR: generate_character tool not found.")
                return

            if random_tool is None:
                print("ERROR: random_character tool not found.")
                return

            print("\n--- GENERATE CHARACTER SCHEMA ---")
            print(json.dumps(
                generate_tool.input_schema,
                indent=4
            ))

            print("\n--- RANDOM CHARACTER SCHEMA ---")
            print(json.dumps(
                random_tool.input_schema,
                indent=4
            ))

            # --------------------------------------------------
            # 2. Generate a random character
            # --------------------------------------------------

            print("\n--- GENERATING RANDOM CHARACTER ---")

            random_result = await session.call_tool(
                "random_character",
                arguments={
                    "body_type": "male",
                    "seed": 12345
                }
            )

            print("Random character response:")
            print_result(random_result)

            if random_result.is_error:
                print("\nERROR: random_character failed.")
                return

            # --------------------------------------------------
            # 3. Extract character data
            # --------------------------------------------------

            character_data = None

            for item in random_result.content:
                if hasattr(item, "text"):
                    try:
                        character_data = json.loads(item.text)
                        break
                    except json.JSONDecodeError:
                        pass

            if not character_data:
                print("\nERROR: Could not parse random character data.")
                return

            items = character_data.get("items")

            if not isinstance(items, list) or not items:
                print("\nERROR: No valid items found.")
                print(json.dumps(character_data, indent=4))
                return

            body_type = character_data.get("body_type", "male")

            print("\n--- ITEMS TO RENDER ---")
            print(json.dumps(items, indent=4))

            # --------------------------------------------------
            # 4. Generate PNG
            # --------------------------------------------------

            print("\n--- GENERATING PNG ---")

            render_result = await session.call_tool(
                "generate_character",
                arguments={
                    "items": items,
                    "body_type": body_type,
                    "animations": ["walk"],
                    "filename": "lpc_test.png",
                    "layout": "standard",
                    "split": False,
                    "prefer_complete": False,
                    "output_dir": OUTPUT_DIR
                }
            )

            print("\n--- GENERATION RESPONSE ---")
            print_result(render_result)

            if render_result.is_error:
                print("\nERROR: Sprite generation failed.")
                return

            # --------------------------------------------------
            # 5. Check generated files
            # --------------------------------------------------

            print("\n--- OUTPUT DIRECTORY ---")
            print(OUTPUT_DIR)

            print("\n--- GENERATED FILES ---")

            found = False

            for root, dirs, files in os.walk(OUTPUT_DIR):
                for filename in files:
                    print(os.path.join(root, filename))
                    found = True

            if not found:
                print("No files found in output directory.")

            print("\nTest completed.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception:
        print("\n--- UNEXPECTED ERROR ---")
        traceback.print_exc()
