import json
import os
import re
from collections import Counter
from datetime import datetime

DATA_DIR = "data/social"
OUTPUT = "data/activity/activity_latest.json"
OUTPUT_HISTORY = "data/activity/activity_history.json"
OUTPUT_REVIEW = "data/activity/activity_review.json"

import re

ACTIVITIES = {

    "Maps": {
        "map",
        "maps",
        "mapping",
        "maap"
    },

    "Baal": {
        "baal",
        "b"
    },

    "Chaos": {
        "chaos",
        "cs",
        "i dia u",
        "dia",
        "arcane"
    },

    "Cows": {
        "cow",
        "cows"
    },

    "Rush": {
        "rush",
        "rushing"
    },

    "Misc. Public MF Runs": {
        "asd",
        "asdff",
        "mf",
        "derp",
        "nico",
        "gord",
        "aa",
        "run",
        "123",
        "hielitos",
        "ted",
        "mmk",
        "aaa",
        "meph"
    },

    "Trade": {
        "trade",
        "bring",
        "iso",
        "wug",
        "wuw",
        "ft",
        "torch",
        "n",
        "swap",
        "lmk",
        "for",
        "buy"
    },

    "Leveling": {
        "trist",
        "tomb",
        "walk",
        "exp",
        "ct",
        "act",
        "norm",
        "lv",
        "leveli",
        "start"
    },

    "Uber": {
        "uber",
        "ubers"
    },

    "DClone": {
        "dclone",
        "clone"
    }

}

def classify_activity(name):

    tokens = set(tokenize(name))

    if not tokens:
        return "Other"

    for activity, keywords in ACTIVITIES.items():
        for token in tokens:
            if any(keyword in token for keyword in keywords):
                return activity
            
    return "Other"

def tokenize(name):

    if not name:
        return []

    name = name.lower()

    name = re.sub(r"([a-z]+)\d+\b", r"\1", name)
    name = re.sub(r"[^a-z0-9]+", " ", name)
    name = re.sub(r"\s+", " ", name).strip()

    tokens = []

    for token in name.split():

        tokens.append(token)

        # Common prefixes players stick onto game names
        for prefix in ("n", "h", "nm"):

            if token.startswith(prefix) and len(token) > len(prefix) + 2:
                tokens.append(token[len(prefix):])

    return list(set(tokens))

def normalize(name):
    if not name:
        return None

    name = name.strip().lower()

    # collapse whitespace
    name = re.sub(r"\s+", " ", name)

    # remove trailing numbers from words
    # asd15  -> asd
    # cow7   -> cow
    # baal99 -> baal
    # cs2    -> cs
    name = re.sub(r"([a-z]+)\d+\b", r"\1", name)

    return name

def normalize_unknown(name):
    """
    Collapse similar game names together so they can be reviewed.

    Examples:
        asd1      -> asd#
        baal23    -> baal#
        cow-15    -> cow-#
        map 123   -> map #
    """

    if not name:
        return None

    name = normalize(name)

    # Replace every run of digits with #
    name = re.sub(r"\d+", "#", name)

    # Collapse repeated #'s
    name = re.sub(r"#+", "#", name)

    return name

def is_placeholder_null_game(game):
    return (
        game.get("name") is None
        and game.get("difficulty") is None
        and game.get("mode") is None
        and game.get("server") is None
        and game.get("country") is None
        and game.get("created") is None
        and game.get("players") in (None, 0)
    )


def iter_snapshots():

    snapshots = []

    for root, _, files in os.walk(DATA_DIR):

        for file in sorted(files):

            if not file.endswith(".jsonl"):
                continue

            path = os.path.join(root, file)

            with open(path, encoding="utf8") as f:

                for line in f:

                    line = line.strip()

                    if not line:
                        continue

                    try:
                        snapshots.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue

    snapshots.sort(
        key=lambda s: datetime.fromisoformat(s["timestamp"])
    )

    return snapshots


def summarize_snapshot(snapshot):

    difficulty = Counter()
    mode = Counter()
    names = Counter()
    activities = Counter()
    unknown = Counter()
    unknown_examples = {}    

    games = snapshot.get("public_games", [])
    filtered_games = []

    for game in games:

        if is_placeholder_null_game(game):
            continue

        filtered_games.append(game)

        difficulty[game.get("difficulty")] += 1
        mode[game.get("mode")] += 1

        name = normalize(game.get("name"))

        if name:

            names[name] += 1

            activity = classify_activity(name)

            activities[activity] += 1

            if activity == "Other":

                key = normalize_unknown(name)

                unknown[key] += 1

                unknown_examples.setdefault(key, set()).add(name)
    return {

        "timestamp": snapshot["timestamp"],

        "difficulty": dict(difficulty),

        "mode": dict(mode),

        "activities": [

            {
                "name": activity,
                "count": count
            }

            for activity, count
            in activities.most_common()

        ],

        "top_games": [

            {
                "name": name,
                "count": count
            }

            for name, count in names.most_common(15)

        ],

        "unknown_games": [

            {
                "normalized": key,
                "count": count,
                "examples": sorted(
                    list(unknown_examples[key])
                )[:8]
            }

            for key, count
            in unknown.most_common()

        ],

        "interesting": {

            "unique_names": len(names),

            "public_games": len(filtered_games),

            "average_name_length":

                round(

                    sum(len(n) for n in names)

                    / max(len(names), 1),

                    2

                )

        }

    }


snapshots = iter_snapshots()

history = [
    summarize_snapshot(snapshot)
    for snapshot in snapshots
]

review_counts = Counter()
review_examples = {}

for snapshot in history:

    for game in snapshot["unknown_games"]:

        review_counts[game["normalized"]] += game["count"]

        review_examples.setdefault(
            game["normalized"],
            set()
        ).update(game["examples"])

review = [

    {
        "normalized": key,
        "count": count,
        "examples": sorted(
            list(review_examples[key])
        )[:10]
    }

    for key, count
    in review_counts.most_common()

]

latest = history[-1] if history else {
    "timestamp": None,
    "difficulty": {},
    "mode": {},
    "activities": [],
    "top_games": [],
    "interesting": {
        "unique_names": 0,
        "public_games": 0,
        "average_name_length": 0,
    },
}

os.makedirs("data/activity", exist_ok=True)

with open(OUTPUT, "w") as f:
    json.dump(latest, f, indent=4)

with open(OUTPUT_HISTORY, "w") as f:
    json.dump(history, f, indent=4)

with open(OUTPUT_REVIEW, "w") as f:
    json.dump(review, f, indent=4)

print("Wrote", OUTPUT)
print("Wrote", OUTPUT_HISTORY)
print("Wrote", OUTPUT_REVIEW)