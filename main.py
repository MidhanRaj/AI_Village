import json
import random
import sys
import threading
from pathlib import Path

import pygame

import ai_brain
import player_customizer

pygame.init()

# ==========================================
# CONFIGURATION
# ==========================================

WIDTH = 1000
HEIGHT = 700
FPS = 60

WORLD_WIDTH = 1800
WORLD_HEIGHT = 1400

BASE_DIR = Path(__file__).resolve().parent
CHARACTER_DIR = BASE_DIR / "assets" / "characters"
MANIFEST_FILE = BASE_DIR / "villagers.json"

screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("AI Village")

clock = pygame.time.Clock()

FONT = pygame.font.SysFont("Arial", 22)
SMALL_FONT = pygame.font.SysFont("Arial", 16)

# LPC sprite settings
FRAME_SIZE = 64
SHEET_WIDTH = 832
WALK_START_ROW = 8
WALK_FRAMES = 9
IDLE_START_ROW = 22
IDLE_FRAMES = 2

# LPC directions: up, left, down, right
DIRECTIONS = {
    "up": 0,
    "left": 1,
    "down": 2,
    "right": 3,
}

# ==========================================
# COLORS
# ==========================================

GRASS = (91, 153, 87)
GRASS_DARK = (82, 140, 77)
PATH = (183, 151, 106)
WHITE = (255, 255, 255)
BLACK = (20, 20, 20)


# ==========================================
# LOAD LPC SPRITES & VILLAGER MANIFEST
# ==========================================

def format_occupation(role, gender):
    if gender == "female":
        if role == "Fisherman":
            return "Fisherwoman"
        if role == "Wizard":
            return "Witch"
    return role


def load_sheet(path):
    if not Path(path).exists():
        return None
    try:
        sheet = pygame.image.load(str(path)).convert_alpha()
        if sheet.get_width() != SHEET_WIDTH or sheet.get_height() < 3456:
            return None
        return sheet
    except (pygame.error, FileNotFoundError, OSError):
        return None


def load_villagers():
    villagers = []

    if not MANIFEST_FILE.exists():
        print("villagers.json does not exist.")
        return villagers

    try:
        data = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        print("Failed to read villagers.json:", e)
        return villagers

    for entry in data.get("villagers", []):
        sprite_path = BASE_DIR / entry.get("sprite", "")
        sheet = load_sheet(sprite_path)
        if sheet is None:
            continue

        villagers.append({
            "name": entry.get("name", "Villager"),
            "role": format_occupation(entry.get("role", "Villager"), entry.get("gender", "")),
            "sheet": sheet,
            "path": sprite_path,
        })
        print("Loaded:", sprite_path)

    return villagers


# ==========================================
# ANIMATION SYSTEM
# ==========================================

class AnimatedCharacter:

    def __init__(self, sheet):
        self.sheet = sheet
        self.direction = "down"
        self.frame = 0
        self.animation_timer = 0.0
        self.moving = False

        self.walk_speed = 0.12
        self.idle_speed = 0.45

        # Detect whether the LPC sheet has dedicated idle rows (rows 22-25)
        sample = self.sheet.subsurface(
            pygame.Rect(0, (IDLE_START_ROW + 2) * FRAME_SIZE, FRAME_SIZE, FRAME_SIZE)
        )
        self.has_idle = pygame.mask.from_surface(sample).count() > 0
        self.idle_bob_offset = 0

    def update(self, dt):
        self.animation_timer += dt

        if self.moving:
            self.idle_bob_offset = 0
            if self.animation_timer >= self.walk_speed:
                self.frame = (self.frame + 1) % WALK_FRAMES
                self.animation_timer = 0.0
        else:
            if self.has_idle:
                if self.animation_timer >= self.idle_speed:
                    self.frame = (self.frame + 1) % IDLE_FRAMES
                    self.animation_timer = 0.0
            else:
                self.frame = 0
                if self.animation_timer >= 0.55:
                    self.idle_bob_offset = 1 - self.idle_bob_offset
                    self.animation_timer = 0.0

    def get_image(self):
        direction_row = DIRECTIONS[self.direction]

        if self.moving:
            row = WALK_START_ROW + direction_row
            col = self.frame % WALK_FRAMES
        elif self.has_idle:
            row = IDLE_START_ROW + direction_row
            col = self.frame % IDLE_FRAMES
        else:
            row = WALK_START_ROW + direction_row
            col = 0

        return self.sheet.subsurface(
            pygame.Rect(col * FRAME_SIZE, row * FRAME_SIZE, FRAME_SIZE, FRAME_SIZE)
        )


# ==========================================
# GAME CHARACTER
# ==========================================

class Character:

    def __init__(self, x, y, sheet, name="Villager", role="Villager", can_wander=False):
        self.x = float(x)
        self.y = float(y)
        self.home_x = float(x)
        self.home_y = float(y)

        self.name = name
        self.role = role
        self.animation = AnimatedCharacter(sheet)
        self.speed = 180

        # Wandering state (for NPCs)
        self.can_wander = can_wander
        self.wander_speed = 55
        self.wander_radius = 130
        self.wander_timer = random.uniform(1.0, 3.5)
        self.wander_dx = 0.0
        self.wander_dy = 0.0

        self.rect = pygame.Rect(int(x) + 15, int(y) + 38, 34, 24)

    def sync_rect(self):
        self.rect.topleft = (int(self.x + 15), int(self.y + 38))

    def face_toward(self, target_x, target_y):
        dx = target_x - self.x
        dy = target_y - self.y
        if abs(dx) > abs(dy):
            self.animation.direction = "right" if dx > 0 else "left"
        else:
            self.animation.direction = "down" if dy > 0 else "up"

    def update(self, dt):
        self.animation.update(dt)
        self.sync_rect()

    def update_wander(self, dt, solid_rects):
        if not self.can_wander:
            self.animation.moving = False
            self.update(dt)
            return

        self.wander_timer -= dt
        if self.wander_timer <= 0:
            if self.wander_dx != 0 or self.wander_dy != 0:
                # Pause and stand idle
                self.wander_dx = 0.0
                self.wander_dy = 0.0
                self.wander_timer = random.uniform(1.5, 4.0)
            else:
                # Pick a random cardinal/diagonal direction
                angle_choices = [
                    (1, 0, "right"), (-1, 0, "left"),
                    (0, 1, "down"), (0, -1, "up"),
                ]
                dx, dy, direction = random.choice(angle_choices)
                self.wander_dx = dx
                self.wander_dy = dy
                self.animation.direction = direction
                self.wander_timer = random.uniform(0.9, 2.2)

        if self.wander_dx != 0 or self.wander_dy != 0:
            self.animation.moving = True
            step_x = self.wander_dx * self.wander_speed * dt
            step_y = self.wander_dy * self.wander_speed * dt

            self.x += step_x
            self.sync_rect()
            blocked = (
                check_collision(self.rect, solid_rects)
                or abs(self.x - self.home_x) > self.wander_radius
                or self.x < 0
                or self.x > WORLD_WIDTH - 64
            )
            if blocked:
                self.x -= step_x
                self.sync_rect()
                self.wander_dx = 0.0
                self.wander_dy = 0.0
                self.wander_timer = random.uniform(1.0, 2.5)

            self.y += step_y
            self.sync_rect()
            blocked = (
                check_collision(self.rect, solid_rects)
                or abs(self.y - self.home_y) > self.wander_radius
                or self.y < 0
                or self.y > WORLD_HEIGHT - 64
            )
            if blocked:
                self.y -= step_y
                self.sync_rect()
                self.wander_dx = 0.0
                self.wander_dy = 0.0
                self.wander_timer = random.uniform(1.0, 2.5)
        else:
            self.animation.moving = False

        self.update(dt)

    def draw(self, surface, camera_x, camera_y):
        image = self.animation.get_image()
        bob = 0 if self.animation.moving else self.animation.idle_bob_offset
        surface.blit(
            image,
            (int(self.x - camera_x), int(self.y - camera_y + bob)),
        )


# ==========================================
# PLAYER & NPCS
# ==========================================

def create_player(villagers):
    cfg = player_customizer.load_config()
    player_sheet = load_sheet(player_customizer.PLAYER_SPRITE)
    if player_sheet is None:
        player_sheet = load_sheet(CHARACTER_DIR / "lpc_test.png")
    if player_sheet is None and villagers:
        player_sheet = villagers[0]["sheet"]

    if player_sheet is not None:
        return Character(400, 400, player_sheet, cfg.get("name", "Traveler"), "Traveler")

    return None


def create_npcs(villagers):
    npcs = []
    if not villagers:
        return npcs

    positions = [
        (600, 400),
        (800, 500),
        (1000, 350),
        (1200, 700),
        (500, 850),
        (900, 950),
        (1300, 1000),
        (300, 600),
        (1500, 400),
        (700, 1100),
        (1100, 1200),
        (550, 250),
    ]

    # These roles stay near their post; others wander around their home area
    stationary_roles = {"Wizard", "Witch", "Elder", "Blacksmith", "Healer"}

    for villager, position in zip(villagers, positions):
        can_wander = villager["role"] not in stationary_roles
        npc = Character(
            position[0],
            position[1],
            villager["sheet"],
            villager["name"],
            villager["role"],
            can_wander=can_wander,
        )
        npcs.append(npc)

    return npcs


# ==========================================
# COLLISION & WORLD
# ==========================================

def check_collision(rect, obstacles_list):
    for obstacle in obstacles_list:
        if rect.colliderect(obstacle):
            return True
    return False


obstacles = [
    pygame.Rect(200, 200, 100, 100),
    pygame.Rect(700, 200, 120, 100),
    pygame.Rect(1100, 500, 120, 120),
    pygame.Rect(300, 900, 150, 100),
]


def draw_world(camera_x, camera_y):
    screen.fill(GRASS)

    for x in range(0, WORLD_WIDTH, 64):
        for y in range(0, WORLD_HEIGHT, 64):
            if (x // 64 + y // 64) % 2 == 0:
                pygame.draw.rect(
                    screen,
                    GRASS_DARK,
                    (x - camera_x, y - camera_y, 32, 32),
                )

    pygame.draw.rect(screen, PATH, (350 - camera_x, 0 - camera_y, 100, WORLD_HEIGHT))
    pygame.draw.rect(screen, PATH, (0 - camera_x, 450 - camera_y, WORLD_WIDTH, 90))

    for obstacle in obstacles:
        rect = pygame.Rect(
            obstacle.x - camera_x,
            obstacle.y - camera_y,
            obstacle.width,
            obstacle.height,
        )
        pygame.draw.rect(screen, (75, 100, 50), rect)


# ==========================================
# PLAYER MOVEMENT
# ==========================================

def move_player(player, dt, npcs):
    keys = pygame.key.get_pressed()

    dx = 0
    dy = 0
    player.animation.moving = False

    if keys[pygame.K_w] or keys[pygame.K_UP]:
        dy = -1
        player.animation.direction = "up"
    elif keys[pygame.K_s] or keys[pygame.K_DOWN]:
        dy = 1
        player.animation.direction = "down"

    if keys[pygame.K_a] or keys[pygame.K_LEFT]:
        dx = -1
        player.animation.direction = "left"
    elif keys[pygame.K_d] or keys[pygame.K_RIGHT]:
        dx = 1
        player.animation.direction = "right"

    if dx != 0 or dy != 0:
        player.animation.moving = True
        length = (dx * dx + dy * dy) ** 0.5
        dx = (dx / length) * player.speed * dt
        dy = (dy / length) * player.speed * dt

    solid_rects = obstacles + [npc.rect for npc in npcs]

    player.x += dx
    player.rect.x = int(player.x + 15)
    if check_collision(player.rect, solid_rects):
        player.x -= dx
        player.rect.x = int(player.x + 15)

    player.y += dy
    player.rect.y = int(player.y + 38)
    if check_collision(player.rect, solid_rects):
        player.y -= dy
        player.rect.y = int(player.y + 38)

    player.x = max(0, min(WORLD_WIDTH - 64, player.x))
    player.y = max(0, min(WORLD_HEIGHT - 64, player.y))

    player.update(dt)


# ==========================================
# NEAREST NPC & TEXT WRAPPING
# ==========================================

def find_nearest_npc(player, npcs):
    nearest = None
    minimum_distance = 85
    player_center = pygame.Vector2(player.x + 32, player.y + 48)

    for npc in npcs:
        npc_center = pygame.Vector2(npc.x + 32, npc.y + 48)
        distance = player_center.distance_to(npc_center)
        if distance < minimum_distance:
            minimum_distance = distance
            nearest = npc

    return nearest


def wrap_text(text, font, max_width):
    words = text.split(" ")
    lines = []
    current = ""
    for word in words:
        test = f"{current} {word}".strip()
        if font.size(test)[0] <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


# ==========================================
# INITIALIZE GAME
# ==========================================

ai_brain.init_db()

villagers = load_villagers()

if not villagers:
    print("\nNo LPC villager sheets found!")
    print("Run generate_villagers.py first.")
    pygame.quit()
    sys.exit()

player = create_player(villagers)
npcs = create_npcs(villagers)
roster_summary = "\n".join(f"- {npc.name}: {npc.role}" for npc in npcs)

print(f"\nLoaded {len(villagers)} villager sheets.")
print(f"Created {len(npcs)} unique villagers.")


# ==========================================
# GAME LOOP, DIALOGUE & CUSTOMIZER STATE
# ==========================================

dialogue_open = False
active_npc = None
chat_history = []       # list of (sender, text)
input_text = ""
ai_thinking = False
ai_lock = threading.Lock()

customizer_open = False
customizer_cfg = player_customizer.load_config()
customizer_row = 0
customizer_rendering = False
customizer_status = ""
customizer_reload_ready = False

CUSTOMIZER_FIELDS = [
    "Name", "Gender", "Skin", "Hair", "Hair Color", "Shirt", "Legs", "Hat"
]


def get_customizer_value(cfg, row_idx):
    field = CUSTOMIZER_FIELDS[row_idx]
    if field == "Name":
        return cfg["name"] or "(type name)"
    if field == "Gender":
        return cfg["gender"].title()
    if field == "Skin":
        return player_customizer.SKINS[cfg["skin_idx"] % len(player_customizer.SKINS)].title()
    if field == "Hair":
        pool = player_customizer.HAIR_STYLES[cfg["gender"]]
        return pool[cfg["hair_idx"] % len(pool)][0]
    if field == "Hair Color":
        return player_customizer.HAIR_COLORS[cfg["hair_color_idx"] % len(player_customizer.HAIR_COLORS)].replace("_", " ").title()
    if field == "Shirt":
        return player_customizer.SHIRTS[cfg["shirt_idx"] % len(player_customizer.SHIRTS)][0]
    if field == "Legs":
        return player_customizer.LEGS[cfg["legs_idx"] % len(player_customizer.LEGS)][0]
    if field == "Hat":
        return player_customizer.HATS[cfg["hat_idx"] % len(player_customizer.HATS)][0]
    return ""


def cycle_customizer(cfg, row_idx, delta):
    field = CUSTOMIZER_FIELDS[row_idx]
    if field == "Gender":
        idx = (player_customizer.GENDERS.index(cfg["gender"]) + delta) % len(player_customizer.GENDERS)
        cfg["gender"] = player_customizer.GENDERS[idx]
        cfg["hair_idx"] = 0
    elif field == "Skin":
        cfg["skin_idx"] = (cfg["skin_idx"] + delta) % len(player_customizer.SKINS)
    elif field == "Hair":
        n = len(player_customizer.HAIR_STYLES[cfg["gender"]])
        cfg["hair_idx"] = (cfg["hair_idx"] + delta) % n
    elif field == "Hair Color":
        cfg["hair_color_idx"] = (cfg["hair_color_idx"] + delta) % len(player_customizer.HAIR_COLORS)
    elif field == "Shirt":
        cfg["shirt_idx"] = (cfg["shirt_idx"] + delta) % len(player_customizer.SHIRTS)
    elif field == "Legs":
        cfg["legs_idx"] = (cfg["legs_idx"] + delta) % len(player_customizer.LEGS)
    elif field == "Hat":
        cfg["hat_idx"] = (cfg["hat_idx"] + delta) % len(player_customizer.HATS)


def apply_customization():
    global customizer_rendering, customizer_status, customizer_reload_ready
    customizer_rendering = True
    customizer_status = "Rendering character sprite..."
    cfg_copy = dict(customizer_cfg)
    if not cfg_copy["name"].strip():
        cfg_copy["name"] = "Traveler"

    def worker():
        global customizer_rendering, customizer_status, customizer_reload_ready
        try:
            ok = player_customizer.render_player_sprite(cfg_copy)
            if ok:
                customizer_status = "Saved!"
                customizer_reload_ready = True
            else:
                customizer_status = "Render failed. Try another combo."
        except Exception as e:
            customizer_status = f"Error: {e}"
        finally:
            customizer_rendering = False

    threading.Thread(target=worker, daemon=True).start()


def open_dialogue(npc):
    global dialogue_open, active_npc, chat_history, input_text
    dialogue_open = True
    active_npc = npc
    input_text = ""
    npc.face_toward(player.x, player.y)
    history = ai_brain.get_recent_messages(npc.name, limit=6)
    if not history:
        history = [("villager", f"Greetings! I'm {npc.name}, the village {npc.role}. What brings you by?")]
    chat_history = history


def send_player_message(npc, text):
    global ai_thinking, chat_history
    with ai_lock:
        ai_thinking = True
        chat_history.append(("player", text))

    def worker():
        global ai_thinking
        reply = ai_brain.chat_with_villager(
            npc.name, npc.role, text, roster_summary, player_name=player.name
        )
        with ai_lock:
            if active_npc is npc:
                chat_history.append(("villager", reply))
            ai_thinking = False

    threading.Thread(target=worker, daemon=True).start()


running = True

while running:
    dt = min(clock.tick(FPS) / 1000, 0.05)

    if customizer_reload_ready:
        customizer_reload_ready = False
        new_sheet = load_sheet(player_customizer.PLAYER_SPRITE)
        if new_sheet is not None:
            player.animation = AnimatedCharacter(new_sheet)
        player.name = customizer_cfg.get("name", "Traveler").strip() or "Traveler"
        customizer_open = False

    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False

        elif event.type == pygame.KEYDOWN:
            if customizer_open:
                if customizer_rendering:
                    continue
                if event.key == pygame.K_ESCAPE:
                    customizer_open = False
                elif event.key == pygame.K_UP:
                    customizer_row = (customizer_row - 1) % len(CUSTOMIZER_FIELDS)
                elif event.key == pygame.K_DOWN:
                    customizer_row = (customizer_row + 1) % len(CUSTOMIZER_FIELDS)
                elif event.key == pygame.K_LEFT and customizer_row > 0:
                    cycle_customizer(customizer_cfg, customizer_row, -1)
                elif event.key == pygame.K_RIGHT and customizer_row > 0:
                    cycle_customizer(customizer_cfg, customizer_row, 1)
                elif event.key == pygame.K_RETURN:
                    apply_customization()
                elif customizer_row == 0:
                    if event.key == pygame.K_BACKSPACE:
                        customizer_cfg["name"] = customizer_cfg["name"][:-1]
                    elif event.unicode and event.unicode.isprintable() and len(customizer_cfg["name"]) < 18:
                        customizer_cfg["name"] += event.unicode

            elif event.key == pygame.K_ESCAPE:
                dialogue_open = False
                active_npc = None
                input_text = ""

            elif dialogue_open and active_npc:
                if event.key == pygame.K_RETURN:
                    msg = input_text.strip()
                    if msg and not ai_thinking:
                        input_text = ""
                        send_player_message(active_npc, msg)
                elif event.key == pygame.K_BACKSPACE:
                    input_text = input_text[:-1]
                elif event.unicode and event.unicode.isprintable() and len(input_text) < 120:
                    input_text += event.unicode

            elif event.key == pygame.K_c and not dialogue_open:
                customizer_cfg = player_customizer.load_config()
                customizer_status = ""
                customizer_open = True

            elif event.key == pygame.K_e and not dialogue_open:
                nearby = find_nearest_npc(player, npcs)
                if nearby:
                    open_dialogue(nearby)

    # Update player & NPCs
    if not dialogue_open and not customizer_open:
        move_player(player, dt, npcs)
    else:
        player.animation.moving = False
        player.update(dt)

    for npc in npcs:
        if dialogue_open and npc is active_npc:
            npc.animation.moving = False
            npc.update(dt)
        else:
            other_rects = obstacles + [player.rect] + [o.rect for o in npcs if o is not npc]
            npc.update_wander(dt, other_rects)

    # Camera
    camera_x = max(0, min(WORLD_WIDTH - WIDTH, player.x - WIDTH // 2))
    camera_y = max(0, min(WORLD_HEIGHT - HEIGHT, player.y - HEIGHT // 2))

    # Draw world & Y-sorted characters
    draw_world(camera_x, camera_y)

    for character in sorted([player] + npcs, key=lambda c: c.y):
        character.draw(screen, camera_x, camera_y)

    # HUD hint
    if not dialogue_open and not customizer_open:
        hud = SMALL_FONT.render(f"{player.name}  |  Press C to Customize Player", True, WHITE)
        hud_bg = pygame.Rect(12, 12, hud.get_width() + 18, 28)
        pygame.draw.rect(screen, (20, 20, 32), hud_bg, border_radius=6)
        screen.blit(hud, (21, 17))

    # Interaction prompt
    nearby_npc = find_nearest_npc(player, npcs)
    if nearby_npc and not dialogue_open and not customizer_open:
        prompt = SMALL_FONT.render(
            f"Press E to talk to {nearby_npc.name} ({nearby_npc.role})",
            True,
            WHITE,
        )
        screen.blit(prompt, (WIDTH // 2 - prompt.get_width() // 2, HEIGHT - 45))

    # Dialogue box
    if dialogue_open and active_npc:
        box = pygame.Rect(50, HEIGHT - 230, WIDTH - 100, 200)
        pygame.draw.rect(screen, (26, 26, 40), box, border_radius=8)
        pygame.draw.rect(screen, WHITE, box, 2, border_radius=8)

        header = FONT.render(f"{active_npc.name} ({active_npc.role})", True, (255, 220, 100))
        screen.blit(header, (box.x + 18, box.y + 10))

        hint = SMALL_FONT.render("ESC to close  |  Enter to send", True, (160, 160, 175))
        screen.blit(hint, (box.right - hint.get_width() - 18, box.y + 14))

        # Render recent conversation lines
        with ai_lock:
            lines_to_render = []
            for sender, msg in chat_history[-4:]:
                prefix = "You: " if sender == "player" else f"{active_npc.name}: "
                color = (170, 225, 255) if sender == "player" else WHITE
                for idx, wrapped in enumerate(wrap_text(prefix + msg, SMALL_FONT, box.width - 36)):
                    lines_to_render.append((wrapped, color))
            if ai_thinking:
                lines_to_render.append((f"{active_npc.name} is thinking...", (200, 200, 140)))

        y_cursor = box.y + 44
        for line_text, color in lines_to_render[-5:]:
            surf = SMALL_FONT.render(line_text, True, color)
            screen.blit(surf, (box.x + 18, y_cursor))
            y_cursor += 20

        # Input bar
        input_box = pygame.Rect(box.x + 16, box.bottom - 42, box.width - 32, 30)
        pygame.draw.rect(screen, (42, 42, 62), input_box, border_radius=5)
        pygame.draw.rect(screen, (130, 130, 160), input_box, 1, border_radius=5)

        display_input = input_text if input_text else "Type a message..."
        input_color = WHITE if input_text else (140, 140, 155)
        input_surf = SMALL_FONT.render(display_input, True, input_color)
        screen.blit(input_surf, (input_box.x + 10, input_box.y + 6))

    # Player Customizer Overlay
    if customizer_open:
        panel = pygame.Rect(WIDTH // 2 - 250, 90, 500, 440)
        pygame.draw.rect(screen, (26, 26, 40), panel, border_radius=10)
        pygame.draw.rect(screen, WHITE, panel, 2, border_radius=10)

        title = FONT.render("Customize Player", True, (255, 220, 100))
        screen.blit(title, (panel.x + 22, panel.y + 16))

        sub = SMALL_FONT.render("Up/Down: Select  |  Left/Right: Change  |  Enter: Save  |  ESC: Cancel", True, (170, 170, 185))
        screen.blit(sub, (panel.x + 22, panel.y + 48))

        y = panel.y + 90
        for idx, field in enumerate(CUSTOMIZER_FIELDS):
            selected = idx == customizer_row
            row_rect = pygame.Rect(panel.x + 18, y - 4, panel.width - 36, 32)
            if selected:
                pygame.draw.rect(screen, (52, 52, 82), row_rect, border_radius=6)

            label_col = (255, 220, 100) if selected else (200, 200, 210)
            val = get_customizer_value(customizer_cfg, idx)
            val_display = f"{val}_" if (selected and idx == 0) else (f"< {val} >" if idx > 0 else val)

            lbl_surf = SMALL_FONT.render(f"{field}:", True, label_col)
            val_surf = SMALL_FONT.render(val_display, True, WHITE)
            screen.blit(lbl_surf, (panel.x + 28, y + 3))
            screen.blit(val_surf, (panel.right - val_surf.get_width() - 28, y + 3))
            y += 38

        if customizer_status:
            st_surf = SMALL_FONT.render(customizer_status, True, (150, 230, 160))
            screen.blit(st_surf, (panel.centerx - st_surf.get_width() // 2, panel.bottom - 38))

    pygame.display.flip()

pygame.quit()
sys.exit()
