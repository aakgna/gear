#!/usr/bin/env python3
"""
backfill_games.py — One-off script to write already-published developer games
into games/{gameType}/{difficulty}/{docId} AND users/{uid}/createdGames/
so they show up in the gear app feed and on the developer's profile.

Usage:
    python scripts/backfill_games.py
"""
import json
import os
import sys

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    from google.cloud.firestore_v1.base_query import FieldFilter
except ImportError:
    print("ERROR: firebase-admin not installed. Run: pip install -r scripts/requirements.txt")
    sys.exit(1)

# ── Firebase init ──────────────────────────────────────────────────────────────
sa_json_str = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
if sa_json_str:
    cred = credentials.Certificate(json.loads(sa_json_str))
elif os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
    cred = credentials.ApplicationDefault()
else:
    print("ERROR: Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON")
    sys.exit(1)

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
db = firestore.client()

# ── Query all Published developer games ───────────────────────────────────────
print('Querying developerGames where process == "Published" …')
docs = list(
    db.collection_group("developerGames")
    .where(filter=FieldFilter("process", "==", "Published"))
    .stream()
)
print(f"Found {len(docs)} published game(s).\n")

for doc in docs:
    data = doc.to_dict()
    game_type = (data.get("gameType") or "").strip()
    name      = (data.get("name") or game_type).strip()
    difficulty = data.get("difficulty", "medium")
    if difficulty not in {"easy", "medium", "hard"}:
        difficulty = "medium"

    path_parts = doc.reference.path.split("/")
    user_id = path_parts[1] if len(path_parts) >= 4 else "unknown"
    full_puzzle_id = f"{game_type}_{difficulty}_{doc.id}"

    print(f"\n  {name}  ({game_type} / {difficulty})")

    if not game_type:
        print(f"    [skip] no gameType")
        continue

    # ── 1. Write to games/{gameType}/{difficulty}/{docId} ────────────────────
    raw_mock = data.get("mockData", {})
    if isinstance(raw_mock, str):
        try:
            mock_data = json.loads(raw_mock)
        except json.JSONDecodeError:
            mock_data = {}
    else:
        mock_data = raw_mock or {}

    game_ref = (
        db.collection("games")
        .document(game_type)
        .collection(difficulty)
        .document(doc.id)
    )
    if mock_data:
        if game_ref.get().exists:
            print(f"    [skip] games/{game_type}/{difficulty}/{doc.id} — already exists")
        else:
            game_ref.set({**mock_data, "uid": user_id}, merge=True)
            print(f"    [ok] Wrote games/{game_type}/{difficulty}/{doc.id}")
    else:
        print(f"    [warn] no mockData — skipped games collection write")

    # ── 2. Always write to users/{uid}/createdGames ──────────────────────────
    # This is independent of whether games/ already existed.
    created_ref = (
        db.collection("users")
        .document(user_id)
        .collection("createdGames")
        .document(full_puzzle_id)
    )
    created_ref.set(
        {
            "gameType": game_type,
            "difficulty": difficulty,
            "title": name,
            "playCount": 0,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "visible": True,
        },
        merge=True,
    )
    print(f"    [ok] Wrote users/{user_id}/createdGames/{full_puzzle_id}")

print("\nDone.")
