#!/usr/bin/env python3
"""Debug script to inspect crossword developerGames document."""
import json, os, sys

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    from google.cloud.firestore_v1.base_query import FieldFilter
except ImportError:
    print("ERROR: pip install -r scripts/requirements.txt")
    sys.exit(1)

sa_json_str = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
if sa_json_str:
    cred = credentials.Certificate(json.loads(sa_json_str))
elif os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
    cred = credentials.ApplicationDefault()
else:
    print("ERROR: Set GOOGLE_APPLICATION_CREDENTIALS")
    sys.exit(1)

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
db = firestore.client()

docs = list(
    db.collection_group("developerGames")
    .where(filter=FieldFilter("process", "==", "Published"))
    .stream()
)
crossword_docs = [d for d in docs if (d.to_dict().get("gameType") or "").strip() == "crossword"]
print(f"Found {len(crossword_docs)} crossword developerGames doc(s)\n")
for doc in crossword_docs:
    d = doc.to_dict()
    print(f"Path    : {doc.reference.path}")
    print(f"process : {d.get('process')}")
    print(f"mockData: {d.get('mockData')}")
    print(f"gameCode len: {len(d.get('gameCode',''))}")
