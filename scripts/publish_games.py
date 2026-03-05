#!/usr/bin/env python3
"""
publish_games.py — Automated game publishing pipeline for the gear repo.

Reads AI-generated games from Firestore (users/{userId}/developerGames
where process == "In Review"), integrates them into the gear React Native
repo by inserting code at pre-placed KRACKED_INSERT_* marker comments,
then marks each game as "Published" in Firestore.

Usage:
    python scripts/publish_games.py [OPTIONS]

Options:
    --dry-run                  Show what would be changed without touching
                               any files or Firestore.
    --game-type GAME_TYPE      Only process games with this specific gameType
                               (e.g. --game-type hangman).
    --similarity-threshold N   Similarity ratio 0-1 at which to warn about
                               suspiciously similar game-type names.
                               Default: 0.8.

Environment variables:
    FIREBASE_SERVICE_ACCOUNT_JSON   JSON content of the service account key
                                    (used in CI / GitHub Actions).
    GOOGLE_APPLICATION_CREDENTIALS Path to the service account JSON file
                                    (used locally when the file is on disk).
    GEAR_REPO_ROOT                  Path to the gear repo root.
                                    Defaults to the parent of this script.
"""

import argparse
import json
import os
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    from google.cloud.firestore_v1.base_query import FieldFilter
except ImportError:
    print("ERROR: firebase-admin not installed. Run: pip install -r scripts/requirements.txt")
    sys.exit(1)


# ── Color palette for new game types ─────────────────────────────────────────
# Chosen to not duplicate colors already in DesignSystem.ts GameColors.
_COLOR_PALETTE = [
    "#FF6B6B",  # Coral red
    "#4ECDC4",  # Mint teal
    "#45B7D1",  # Sky blue
    "#96CEB4",  # Sage green
    "#DDA0DD",  # Plum
    "#F97316",  # Orange
    "#A78BFA",  # Lavender
    "#34D399",  # Emerald
    "#F472B6",  # Hot pink
    "#60A5FA",  # Cornflower blue
    "#6EE7B7",  # Seafoam
    "#FB923C",  # Warm orange
]

# Ionicons icon name by keyword clusters
_ICON_MAP: List[Tuple[List[str], str]] = [
    (["word", "letter", "spell", "text", "crossword"], "text-outline"),
    (["math", "number", "calc", "arithmetic"], "calculator-outline"),
    (["trivia", "quiz", "question", "knowledge"], "trophy-outline"),
    (["maze", "path", "trail", "navigate", "flow"], "navigate-outline"),
    (["grid", "sudoku", "nonogram"], "grid-outline"),
    (["color", "code", "break", "master", "mastermind"], "color-palette-outline"),
    (["logic", "deduc", "reason"], "list-outline"),
    (["chain", "link", "connect"], "link-outline"),
    (["memory", "card", "match", "flip"], "layers-outline"),
    (["hang", "guess"], "help-circle-outline"),
    (["slide", "tile"], "apps-outline"),
    (["sequence", "order", "sort"], "swap-vertical-outline"),
    (["image", "picture", "pixel"], "image-outline"),
]

# Template category by keyword clusters
_CATEGORY_MAP: List[Tuple[List[str], str]] = [
    (["word", "letter", "spell", "chain", "crossword", "wordle", "hangman", "anagram"], "word"),
    (["math", "number", "calc", "square", "kenken", "arithmetic"], "math"),
    (["logic", "deduc", "sequence", "order", "inference", "reason"], "logic"),
    (["maze", "path", "trail", "flow", "pipe", "navigate"], "path"),
    (["grid", "sudoku", "nonogram", "futoshiki"], "grid"),
]


# ── String helpers ────────────────────────────────────────────────────────────

def name_to_game_type(name: str) -> str:
    """
    Convert a game name to a camelCase gameType.
    'Hangman'     → 'hangman'
    'Code Editor' → 'codeEditor'
    'Word Search' → 'wordSearch'
    'Magic Square'→ 'magicSquare'
    """
    words = re.split(r"[\s\-_]+", name.strip())
    words = [w for w in words if w]
    if not words:
        return name.lower()
    result = words[0].lower()
    for word in words[1:]:
        result += word[0].upper() + word[1:].lower() if word else ""
    return result


def to_pascal_case(s: str) -> str:
    """
    Convert any gameType string to PascalCase component name.
    'hangman' → 'Hangman'
    'wordSearch' → 'WordSearch'
    'word-search' → 'WordSearch'
    """
    # Insert underscore before existing uppercase letters (handle camelCase input)
    s = re.sub(r"([A-Z])", r"_\1", s)
    parts = re.split(r"[^a-zA-Z0-9]+", s)
    return "".join(p.capitalize() for p in parts if p)


def pick_color(index: int) -> str:
    return _COLOR_PALETTE[index % len(_COLOR_PALETTE)]


def pick_icon(game_type: str, name: str) -> str:
    keywords = (game_type + " " + name).lower()
    for kw_list, icon in _ICON_MAP:
        if any(kw in keywords for kw in kw_list):
            return icon
    return "game-controller-outline"


def pick_category(game_type: str, name: str) -> str:
    keywords = (game_type + " " + name).lower()
    for kw_list, cat in _CATEGORY_MAP:
        if any(kw in keywords for kw in kw_list):
            return cat
    return "custom"


# ── TypeScript generation ─────────────────────────────────────────────────────

def infer_ts_type(value: Any) -> str:
    """Infer a TypeScript type string from a Python value."""
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "number"
    if isinstance(value, float):
        return "number"
    if isinstance(value, str):
        return "string"
    if value is None:
        return "string | null"
    if isinstance(value, list):
        if not value:
            return "any[]"
        first = value[0]
        if isinstance(first, bool):
            return "boolean[]"
        if isinstance(first, (int, float)):
            return "number[]"
        if isinstance(first, str):
            return "string[]"
        if isinstance(first, dict):
            return "Record<string, any>[]"
        return "any[]"
    if isinstance(value, dict):
        return "Record<string, any>"
    return "any"


def generate_data_interface(pascal_name: str, mock_data: Dict) -> str:
    """Generate a TypeScript data interface from a mockData sample."""
    fields = [f"\t{key}: {infer_ts_type(val)};" for key, val in mock_data.items()]
    body = "\n".join(fields) if fields else "\t[key: string]: any;"
    return f"export interface {pascal_name}Data {{\n{body}\n}}"


def generate_parsing_block(game_type: str, pascal_name: str, mock_data: Dict) -> str:
    """
    Generate the else-if block for play-game/[gameId].tsx that reads
    Firestore fields into the typed data struct.
    """
    conditions = [f'normalizedGameType === "{game_type}"']
    assignments = []

    for key, value in mock_data.items():
        if isinstance(value, list):
            conditions.append(f"gameData.{key} &&\n\t\t\tArray.isArray(gameData.{key})")
        else:
            conditions.append(f"gameData.{key}")
        assignments.append(f"\t\t\t\t{key}: gameData.{key},")

    cond_joined = " &&\n\t\t\t".join(conditions)
    assign_joined = "\n".join(assignments)

    return (
        f"\t\t// Handle {pascal_name}\n"
        f"\t\telse if (\n"
        f"\t\t\t{cond_joined}\n"
        f"\t\t) {{\n"
        f"\t\t\tpuzzleData = {{\n"
        f"{assign_joined}\n"
        f"\t\t\t}} as {pascal_name}Data;\n"
        f"\t\t\tisValid = true;\n"
        f"\t\t}}"
    )


def generate_render_case(game_type: str, pascal_name: str) -> str:
    """Generate the GameWrapper.tsx switch-case block for the new game."""
    return (
        f'\t\t\tcase "{game_type}":\n'
        f"\t\t\t\treturn (\n"
        f"\t\t\t\t\t<{pascal_name}Game\n"
        f"\t\t\t\t\t\tkey={{puzzle.id}}\n"
        f"\t\t\t\t\t\tinputData={{puzzle.data as any}}\n"
        f"\t\t\t\t\t\tonComplete={{handleComplete}}\n"
        f"\t\t\t\t\t\tonAttempt={{onAttempt}}\n"
        f"\t\t\t\t\t\tstartTime={{gameStartTime}}\n"
        f"\t\t\t\t\t\tpuzzleId={{puzzle.id}}\n"
        f"\t\t\t\t\t\tonShowStats={{handleShowStats}}\n"
        f"\t\t\t\t\t\tisActive={{isActive && gameStarted}}\n"
        f"\t\t\t\t\t\tinitialCompletedResult={{completedResult}}\n"
        f"\t\t\t\t\t/>\n"
        f"\t\t\t\t);"
    )


def generate_template_entry(
    game_type: str,
    display_name: str,
    category: str,
    icon: str,
) -> str:
    """Generate the gameTemplates.ts entry for a new game type."""
    return (
        f"\t\t{{\n"
        f'\t\t\tid: "{game_type}",\n'
        f'\t\t\tname: "{display_name}",\n'
        f'\t\t\ttype: "{game_type}",\n'
        f'\t\t\tcategory: "{category}",\n'
        f'\t\t\ticon: "{icon}",\n'
        f'\t\t\tdescription: "A {display_name} game",\n'
        f"\t\t\tdefaultConfig: {{}},\n"
        f"\t\t}},"
    )


def generate_instructions_entry(game_type: str) -> str:
    """Generate a gameInstructions.ts placeholder entry."""
    return (
        f"\t{game_type}: {{\n"
        f'\t\tinstructions: ["Play the game to complete it"],\n'
        f'\t\texample: "",\n'
        f"\t}},"
    )


def generate_convert_case(game_type: str, pascal_name: str, mock_data: Dict) -> str:
    """Generate the case block for convertFirestoreGameToPuzzle in feed.tsx."""
    switch_case = game_type.lower()
    # uid is a top-level puzzle field, not part of data
    data_keys = {k: v for k, v in mock_data.items() if k != "uid"}
    conditions = []
    assignments = []
    for key, value in data_keys.items():
        if isinstance(value, list):
            conditions.append(f"game.{key} && Array.isArray(game.{key})")
        else:
            conditions.append(f"game.{key}")
        assignments.append(f"\t\t\t\t\t\t{key}: game.{key},")

    cond_joined = " &&\n\t\t\t\t".join(conditions)
    assign_joined = "\n".join(assignments)

    return (
        f'\t\tcase "{switch_case}":\n'
        f"\t\t\tif (\n"
        f"\t\t\t\t{cond_joined}\n"
        f"\t\t\t) {{\n"
        f"\t\t\t\treturn {{\n"
        f"\t\t\t\t\tid: gameId,\n"
        f'\t\t\t\t\ttype: "{game_type}",\n'
        f"\t\t\t\t\tdata: {{\n"
        f"{assign_joined}\n"
        f"\t\t\t\t\t}} as {pascal_name}Data,\n"
        f"\t\t\t\t\tdifficulty: difficultyNum,\n"
        f"\t\t\t\t\tcreatedAt: new Date().toISOString(),\n"
        f"\t\t\t\t\tusername: game.username,\n"
        f"\t\t\t\t\tuid: game.uid,\n"
        f"\t\t\t\t\tprofilePicture: null,\n"
        f"\t\t\t\t}};\n"
        f"\t\t\t}}\n"
        f"\t\t\tbreak;"
    )


# ── File insertion helpers ────────────────────────────────────────────────────

def _find_marker_line(text: str, marker_kw: str) -> Optional[Tuple[int, str, str]]:
    """
    Locate the line containing marker_kw.
    Returns (line_index, leading_whitespace, full_line) or None.
    """
    lines = text.split("\n")
    for i, line in enumerate(lines):
        if marker_kw in line:
            indent = re.match(r"^(\s*)", line).group(1)
            return i, indent, line
    return None


def insert_before_marker(
    file_path: Path,
    marker_kw: str,
    content: str,
    idempotency_check: str,
    dry_run: bool = False,
    label: str = "",
    use_prev_line_indent: bool = False,
) -> bool:
    """
    Insert a SINGLE LINE of `content` (without leading whitespace) on the
    line immediately before the marker.

    By default, the marker's own indentation is prepended to `content`.
    Pass use_prev_line_indent=True for array-item insertions where the marker
    sits at a shallower indent than the surrounding items (e.g. feed.tsx).

    Idempotency: if `idempotency_check` is already present in the file, skip.
    """
    text = file_path.read_text(encoding="utf-8")

    if idempotency_check and idempotency_check in text:
        print(f"    [skip] {label or file_path.name} — already has '{idempotency_check}'")
        return False

    found = _find_marker_line(text, marker_kw)
    if not found:
        print(f"    [ERROR] Marker '{marker_kw}' not found in {label or file_path.name}")
        return False

    marker_idx, marker_indent, full_marker_line = found

    if use_prev_line_indent:
        # Use the indentation of the previous non-empty line (e.g. the last array item)
        lines = text.split("\n")
        indent = marker_indent  # fallback
        for j in range(marker_idx - 1, max(0, marker_idx - 15), -1):
            stripped = lines[j].strip()
            if stripped:  # non-empty
                indent = re.match(r"^(\s*)", lines[j]).group(1)
                break
    else:
        indent = marker_indent

    insert_line = indent + content

    lines = text.split("\n")
    new_lines = lines[:marker_idx] + [insert_line] + lines[marker_idx:]
    new_text = "\n".join(new_lines)

    if dry_run:
        print(f"    [dry-run] {label or file_path.name} — would insert: {repr(insert_line)}")
    else:
        file_path.write_text(new_text, encoding="utf-8")
        print(f"    [ok] {label or file_path.name}")

    return True


def insert_multiline_before_marker(
    file_path: Path,
    marker_kw: str,
    content: str,
    idempotency_check: str,
    dry_run: bool = False,
    label: str = "",
) -> bool:
    """
    Insert a pre-formatted MULTI-LINE block before the marker line.
    `content` must already carry correct indentation for every line.
    A blank line is added between the inserted block and the marker.
    """
    text = file_path.read_text(encoding="utf-8")

    if idempotency_check and idempotency_check in text:
        print(f"    [skip] {label or file_path.name} — already has '{idempotency_check}'")
        return False

    found = _find_marker_line(text, marker_kw)
    if not found:
        print(f"    [ERROR] Marker '{marker_kw}' not found in {label or file_path.name}")
        return False

    marker_idx, _indent, _full = found
    lines = text.split("\n")
    content_lines = content.split("\n")
    new_lines = lines[:marker_idx] + content_lines + [""] + lines[marker_idx:]
    new_text = "\n".join(new_lines)

    if dry_run:
        preview = content.split("\n")[0]
        print(f"    [dry-run] {label or file_path.name} — would insert block starting: {repr(preview)}")
    else:
        file_path.write_text(new_text, encoding="utf-8")
        print(f"    [ok] {label or file_path.name}")

    return True


def write_component_file(
    file_path: Path,
    game_code: str,
    dry_run: bool = False,
) -> bool:
    """Write the AI-generated TSX component file. Skips if the file already exists."""
    if file_path.exists():
        print(f"    [skip] {file_path.name} — component file already exists")
        return False

    if dry_run:
        print(f"    [dry-run] Would create component: {file_path.name}")
    else:
        file_path.write_text(game_code, encoding="utf-8")
        print(f"    [ok] Created {file_path.name}")

    return True


# ── Duplicate / similarity check ─────────────────────────────────────────────

def get_existing_game_types(repo_root: Path) -> List[str]:
    """Parse config/types.ts and return all existing PuzzleType string literals."""
    types_file = repo_root / "config" / "types.ts"
    content = types_file.read_text(encoding="utf-8")
    # Match the PuzzleType union block
    m = re.search(r"export type PuzzleType\s*=\s*([\s\S]+?)(?=;)", content)
    if not m:
        return []
    return re.findall(r'\|\s*"([^"]+)"', m.group(1))


def check_duplicate_or_similar(
    game_type: str,
    existing_types: List[str],
    threshold: float = 0.8,
) -> Tuple[bool, str]:
    """
    Returns (hard_reject, message).

    hard_reject = True  → exact match (case-insensitive); publishing is blocked.
    hard_reject = False → similarity warning only; publishing continues with a note.
    """
    lower_new = game_type.lower()

    # Exact match — hard reject
    for existing in existing_types:
        if lower_new == existing.lower():
            return True, (
                f"Game type '{game_type}' already exists as '{existing}'. "
                "Marking as 'Rejected — duplicate type' in Firestore."
            )

    # Similarity warning
    warnings = []
    for existing in existing_types:
        ratio = SequenceMatcher(None, lower_new, existing.lower()).ratio()
        if ratio >= threshold:
            warnings.append(f"'{game_type}' is {ratio:.0%} similar to existing '{existing}'")

    if warnings:
        msg = "WARNING — suspiciously similar game types:\n    " + "\n    ".join(warnings)
        return False, msg

    return False, ""


# ── Main publish function ─────────────────────────────────────────────────────

def publish_game(
    game_data: Dict,
    user_id: str,
    game_doc_id: str,
    repo_root: Path,
    db: Any,
    dry_run: bool = False,
    game_index: int = 0,
) -> bool:
    """
    Integrate a single AI-generated game into the gear repo.
    Returns True on success.
    """
    name = (game_data.get("name") or "").strip()
    game_type = name_to_game_type(name) if name else (game_data.get("gameType") or "").strip()
    game_code = (game_data.get("gameCode") or "").strip()
    difficulty = game_data.get("difficulty", "medium")

    # Parse mockData — may arrive as a Firestore map or a JSON string
    raw_mock = game_data.get("mockData", {})
    if isinstance(raw_mock, str):
        try:
            mock_data: Dict = json.loads(raw_mock)
        except json.JSONDecodeError:
            print(f"  [ERROR] Could not parse mockData JSON for '{game_type}'")
            return False
    else:
        mock_data = raw_mock or {}

    if not game_type:
        print(f"  [ERROR] Missing gameType in document {game_doc_id}")
        return False

    pascal_name = to_pascal_case(game_type)
    display_name = name or re.sub(r"([A-Z])", r" \1", pascal_name).strip()
    color = pick_color(game_index)
    icon = pick_icon(game_type, display_name)
    category = pick_category(game_type, display_name)
    needs_normalization = game_type != game_type.lower()  # e.g. "wordSearch" needs it

    print(f"\n  ── {display_name}  |  gameType='{game_type}'  |  difficulty={difficulty}")
    print(f"     pascal={pascal_name}  color={color}  icon={icon}  category={category}")
    print(f"     mockData fields: {list(mock_data.keys()) if mock_data else '(none)'}")
    print(f"     gameCode: {len(game_code)} chars")

    # ── 1. config/types.ts ────────────────────────────────────────────────────
    types_file = repo_root / "config" / "types.ts"

    # 1a. PuzzleType union
    insert_before_marker(
        types_file,
        "KRACKED_INSERT_PUZZLE_TYPE",
        f'| "{game_type}"',
        f'| "{game_type}"',
        dry_run,
        "types.ts — PuzzleType union",
    )

    # 1b. Puzzle.data union
    insert_before_marker(
        types_file,
        "KRACKED_INSERT_DATA_UNION",
        f"| {pascal_name}Data",
        f"| {pascal_name}Data",
        dry_run,
        "types.ts — Puzzle.data union",
    )

    # 1c. Data interface (multi-line)
    if mock_data:
        interface_code = generate_data_interface(pascal_name, mock_data)
        insert_multiline_before_marker(
            types_file,
            "KRACKED_INSERT_DATA_INTERFACE",
            interface_code,
            f"interface {pascal_name}Data",
            dry_run,
            "types.ts — data interface",
        )
    else:
        print(f"    [warn] No mockData — skipping data interface generation for {pascal_name}Data")

    # ── 2. constants/DesignSystem.ts ──────────────────────────────────────────
    design_file = repo_root / "constants" / "DesignSystem.ts"

    # 2a. GameColors entry — CRITICAL: must come before DesignSystem is compiled
    insert_before_marker(
        design_file,
        "KRACKED_INSERT_GAME_COLOR",
        f'{game_type}: "{color}",',
        f"{game_type}:",
        dry_run,
        "DesignSystem.ts — GameColors",
    )

    # 2b. formatGameType specialCases
    insert_before_marker(
        design_file,
        "KRACKED_INSERT_FORMAT_GAME_TYPE",
        f'{game_type}: "{display_name}",',
        f'{game_type}: "{display_name}"',
        dry_run,
        "DesignSystem.ts — formatGameType",
    )

    # ── 3. config/gameInstructions.ts ─────────────────────────────────────────
    instr_file = repo_root / "config" / "gameInstructions.ts"
    instructions_entry = generate_instructions_entry(game_type)
    insert_multiline_before_marker(
        instr_file,
        "KRACKED_INSERT_INSTRUCTIONS",
        instructions_entry,
        f"{game_type}: {{",
        dry_run,
        "gameInstructions.ts",
    )

    # ── 4. components/games/GameWrapper.tsx ───────────────────────────────────
    wrapper_file = repo_root / "components" / "games" / "GameWrapper.tsx"

    # 4a. Import line
    insert_before_marker(
        wrapper_file,
        "KRACKED_INSERT_GAME_IMPORT",
        f'import {pascal_name}Game from "./{pascal_name}Game";',
        f"import {pascal_name}Game",
        dry_run,
        "GameWrapper.tsx — import",
    )

    # 4b. Render case (multi-line)
    render_case = generate_render_case(game_type, pascal_name)
    insert_multiline_before_marker(
        wrapper_file,
        "KRACKED_INSERT_RENDER_GAME",
        render_case,
        f'case "{game_type}":',
        dry_run,
        "GameWrapper.tsx — renderGame case",
    )

    # ── 5. components/GameIntroOverlay.tsx ────────────────────────────────────
    overlay_file = repo_root / "components" / "GameIntroOverlay.tsx"

    # 5a. Animation count (new types get default of 4 animations)
    insert_before_marker(
        overlay_file,
        "KRACKED_INSERT_ANIM_COUNT",
        f'case "{game_type}": return 4;',
        f'case "{game_type}": return',
        dry_run,
        "GameIntroOverlay.tsx — animCount",
    )

    # 5b. Render animation (return null — no custom animation for new types yet)
    insert_before_marker(
        overlay_file,
        "KRACKED_INSERT_RENDER_ANIM",
        f'case "{game_type}": return null;',
        f'case "{game_type}": return null',
        dry_run,
        "GameIntroOverlay.tsx — renderAnim",
    )

    # ── 6. app/create-game/index.tsx ──────────────────────────────────────────
    create_file = repo_root / "app" / "create-game" / "index.tsx"

    # 6a. GameType union
    insert_before_marker(
        create_file,
        "KRACKED_INSERT_GAME_TYPE_UNION",
        f'| "{game_type}"',
        f'| "{game_type}"',
        dry_run,
        "create-game/index.tsx — GameType union",
    )

    # 6b. gameTypes array entry
    insert_before_marker(
        create_file,
        "KRACKED_INSERT_GAME_TYPES",
        f'{{ type: "{game_type}", name: "{display_name}", icon: "{icon}" }},',
        f'type: "{game_type}"',
        dry_run,
        "create-game/index.tsx — gameTypes entry",
    )

    # ── 7. app/play-game/[gameId].tsx ─────────────────────────────────────────
    play_file = repo_root / "app" / "play-game" / "[gameId].tsx"

    # 7a. Data type import
    insert_before_marker(
        play_file,
        "KRACKED_INSERT_DATA_IMPORT",
        f"{pascal_name}Data,",
        f"{pascal_name}Data,",
        dry_run,
        "[gameId].tsx — data import",
    )

    # 7b. camelCase normalization (only for types like "wordSearch" that get
    #     lowercased in the puzzleId e.g. "wordsearch_easy_abc")
    if needs_normalization:
        lower_type = game_type.lower()
        norm_block = (
            f"}} else if (gameType === \"{lower_type}\") {{\n"
            f'\t\t\tgameType = "{game_type}";'
        )
        insert_multiline_before_marker(
            play_file,
            "KRACKED_INSERT_NORMALIZATION",
            norm_block,
            f'gameType === "{lower_type}"',
            dry_run,
            "[gameId].tsx — camelCase normalization",
        )

    # 7c. Data parsing else-if block (multi-line)
    if mock_data:
        parsing_block = generate_parsing_block(game_type, pascal_name, mock_data)
        insert_multiline_before_marker(
            play_file,
            "KRACKED_INSERT_DATA_PARSING",
            parsing_block,
            f'normalizedGameType === "{game_type}"',
            dry_run,
            "[gameId].tsx — data parsing",
        )
    else:
        print(f"    [warn] No mockData — skipping data parsing block for {game_type}")

    # ── 8. config/gameTemplates.ts ────────────────────────────────────────────
    templates_file = repo_root / "config" / "gameTemplates.ts"
    template_entry = generate_template_entry(game_type, display_name, category, icon)
    insert_multiline_before_marker(
        templates_file,
        "KRACKED_INSERT_TEMPLATE",
        template_entry,
        f'id: "{game_type}"',
        dry_run,
        "gameTemplates.ts",
    )

    # ── 9. app/feed.tsx ───────────────────────────────────────────────────────
    # The marker sits at a shallower indent than the surrounding array items,
    # so we use use_prev_line_indent=True to match the item indent.
    feed_file = repo_root / "app" / "feed.tsx"
    insert_before_marker(
        feed_file,
        "KRACKED_INSERT_FILTER_CHIP",
        f'"{game_type}",',
        f'"{game_type}",',
        dry_run,
        "feed.tsx — filter chip",
        use_prev_line_indent=True,
    )

    # ── 9b. app/feed.tsx — convertFirestoreGameToPuzzle import ────────────────
    insert_before_marker(
        feed_file,
        "KRACKED_INSERT_CONVERT_PUZZLE_IMPORT",
        f"{pascal_name}Data,",
        f"{pascal_name}Data,",
        dry_run,
        "feed.tsx — convert puzzle import",
    )

    # ── 9c. app/feed.tsx — convertFirestoreGameToPuzzle case ────────────────────
    if mock_data:
        switch_case = game_type.lower()
        convert_case = generate_convert_case(game_type, pascal_name, mock_data)
        insert_multiline_before_marker(
            feed_file,
            "KRACKED_INSERT_CONVERT_PUZZLE",
            convert_case,
            f'case "{switch_case}":',
            dry_run,
            "feed.tsx — convertFirestoreGameToPuzzle case",
        )
    else:
        print(f"    [warn] No mockData — skipping convertFirestoreGameToPuzzle case for {game_type}")

    # ── 10. config/firebase.ts ────────────────────────────────────────────────
    firebase_file = repo_root / "config" / "firebase.ts"
    insert_before_marker(
        firebase_file,
        "KRACKED_INSERT_SAVE_GAME",
        f'| "{game_type}"',
        f'| "{game_type}"',
        dry_run,
        "firebase.ts — saveGame union",
    )

    # ── 11. Create game component file ────────────────────────────────────────
    component_path = (
        repo_root / "components" / "games" / f"{pascal_name}Game.tsx"
    )
    write_component_file(component_path, game_code, dry_run)

    # ── 12. Write game instance to games/{gameType}/{difficulty}/{docId} ─────
    # This is what the gear app actually reads from to show games in the feed.
    if mock_data:
        valid_difficulties = {"easy", "medium", "hard"}
        diff = difficulty if difficulty in valid_difficulties else "medium"
        game_instance_ref = (
            db.collection("games")
            .document(game_type)
            .collection(diff)
            .document(game_doc_id)
        )
        if not dry_run:
            game_instance_ref.set(
                {**mock_data, "uid": user_id},
                merge=True,
            )
            print(f"\n  [firestore] Wrote game instance to games/{game_type}/{diff}/{game_doc_id}")
        else:
            print(f"\n  [dry-run] Would write game instance to games/{game_type}/{diff}/{game_doc_id}")
            print(f"            fields: {list(mock_data.keys())}")
    else:
        print(f"\n  [warn] No mockData — skipping games collection write for '{game_type}'")

    # ── 13. Write to users/{userId}/createdGames ──────────────────────────────
    # This is what profile.tsx reads to show the developer's created games.
    # Doc ID format matches the full puzzleId: {gameType}_{difficulty}_{docId}
    valid_difficulties = {"easy", "medium", "hard"}
    diff = difficulty if difficulty in valid_difficulties else "medium"
    full_puzzle_id = f"{game_type}_{diff}_{game_doc_id}"
    created_game_ref = (
        db.collection("users")
        .document(user_id)
        .collection("createdGames")
        .document(full_puzzle_id)
    )
    if not dry_run:
        created_game_ref.set(
            {
                "gameType": game_type,
                "difficulty": diff,
                "title": display_name,
                "playCount": 0,
                "createdAt": firestore.SERVER_TIMESTAMP,
                "visible": True,
            },
            merge=True,
        )
        print(f"  [firestore] Wrote to users/{user_id}/createdGames/{full_puzzle_id}")
    else:
        print(f"  [dry-run] Would write to users/{user_id}/createdGames/{full_puzzle_id}")

    # ── 14. Update developerGames status ─────────────────────────────────────
    if not dry_run:
        doc_ref = (
            db.collection("users")
            .document(user_id)
            .collection("developerGames")
            .document(game_doc_id)
        )
        doc_ref.set({"process": "Published", "gameType": game_type}, merge=True)
        print(f"  [firestore] Marked '{game_type}' as Published")
    else:
        print(f"  [dry-run] Would mark '{game_type}' as Published in Firestore")

    return True


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Publish AI-generated games from Firestore into the gear repo."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview all changes without writing files or updating Firestore.",
    )
    parser.add_argument(
        "--game-type",
        type=str,
        default=None,
        metavar="GAME_TYPE",
        help="Only process games of this specific gameType (e.g. hangman).",
    )
    parser.add_argument(
        "--similarity-threshold",
        type=float,
        default=0.8,
        metavar="N",
        help="Similarity ratio (0-1) at which to issue a warning (default: 0.8).",
    )
    args = parser.parse_args()

    if args.dry_run:
        print("=" * 60)
        print("  DRY RUN — no files or Firestore will be changed")
        print("=" * 60)

    # ── Repo root ─────────────────────────────────────────────────────────────
    repo_root = Path(
        os.environ.get("GEAR_REPO_ROOT", Path(__file__).parent.parent)
    ).resolve()
    print(f"\nRepo root : {repo_root}")

    # ── Firebase init ─────────────────────────────────────────────────────────
    sa_json_str = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if sa_json_str:
        try:
            sa_dict = json.loads(sa_json_str)
        except json.JSONDecodeError as exc:
            print(f"ERROR: FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: {exc}")
            sys.exit(1)
        cred = credentials.Certificate(sa_dict)
    elif os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        cred = credentials.ApplicationDefault()
    else:
        print(
            "ERROR: Provide FIREBASE_SERVICE_ACCOUNT_JSON (CI) "
            "or GOOGLE_APPLICATION_CREDENTIALS (local)."
        )
        sys.exit(1)

    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    db = firestore.client()

    # ── Query Firestore ───────────────────────────────────────────────────────
    print('\nQuerying Firestore for games with process == "In Review" …')
    query = (
        db.collection_group("developerGames")
        .where(filter=FieldFilter("process", "==", "In Review"))
    )
    if args.game_type:
        query = query.where(filter=FieldFilter("gameType", "==", args.game_type))

    docs = list(query.stream())

    # ── Early exit if nothing to do ───────────────────────────────────────────
    if not docs:
        print("\nNo games found with process == 'In Review'. Nothing to publish.")
        sys.exit(0)

    print(f"Found {len(docs)} game(s) in review.\n")

    # ── Get existing types for duplicate checking ─────────────────────────────
    existing_types = get_existing_game_types(repo_root)
    print(f"Existing PuzzleTypes in repo: {existing_types}\n")

    published = 0
    skipped = 0

    for i, doc in enumerate(docs):
        data = doc.to_dict()
        name = (data.get("name") or "").strip()
        game_type = name_to_game_type(name) if name else (data.get("gameType") or "").strip()

        # Derive user_id from doc path: users/{userId}/developerGames/{docId}
        path_parts = doc.reference.path.split("/")
        user_id = path_parts[1] if len(path_parts) >= 4 else "unknown"

        print(f"[{i + 1}/{len(docs)}] '{name}' — gameType='{game_type}'  user={user_id}")

        # ── Duplicate / similarity check ──────────────────────────────────────
        is_reject, msg = check_duplicate_or_similar(
            game_type, existing_types, args.similarity_threshold
        )

        if is_reject:
            print(f"  [REJECTED] {msg}")
            skipped += 1
            if not args.dry_run:
                doc.reference.set(
                    {"process": "Rejected — duplicate type"}, merge=True
                )
            continue

        if msg:
            print(f"  {msg}")
            print("  Proceeding (similarity is a warning only) …")

        # ── Validate required fields ──────────────────────────────────────────
        if not data.get("gameCode", "").strip():
            print(f"  [SKIP] gameCode is empty for '{game_type}'")
            skipped += 1
            continue

        # ── Publish ───────────────────────────────────────────────────────────
        success = publish_game(
            game_data=data,
            user_id=user_id,
            game_doc_id=doc.id,
            repo_root=repo_root,
            db=db,
            dry_run=args.dry_run,
            game_index=i,
        )

        if success:
            published += 1
            # Add to in-memory list so the next game in this batch doesn't
            # get a false "similar" warning against itself
            existing_types.append(game_type)
        else:
            skipped += 1

    print("\n" + "=" * 60)
    print(f"  Published : {published}")
    print(f"  Skipped   : {skipped}")
    if args.dry_run:
        print("  (dry-run — no changes applied)")
    print("=" * 60)


if __name__ == "__main__":
    main()
