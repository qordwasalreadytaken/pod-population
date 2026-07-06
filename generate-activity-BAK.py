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

ACTIVITIES = [

    ("Maps", [
        r"\bmaps?\d*\b",
        r"\bmapping\b"
    ]),

    ("Baal", [
        r"\bbaal\d*\b",
        r"\bb\d*\b"
    ]),

    ("Chaos", [
        r"\bchaos\d*\b",
        r"\bcs\d*\b",
        r"\bi dia u\d*\b"
    ]),

    ("Cows", [
        r"\bcows?\d*\b"
    ]),

    ("Rush", [
        r"\brush",
        r"\brushing"
    ]),

    ("MF'ing", [
        r"\basd\d*\b",
        r"\bderp\d*\b",
        r"\bnico\d*\b",
        r"\bgord\d*\b",
        r"\baa\d*\b",
        r"\brun\d*\b",
        r"\bmf\d*\b",
        r"\b123\d*\b"
    ]),

    ("Trade", [
        r"\btrade\b",
        r"\bbring\b",
        r"\bn\btorch\b",
        r"\bwug\b",
        r"\bwuw\b",
        r"\biso\b",
        r"\bwtb\b",
        r"\bn\b",
        r"\bft\b"
    ]),

    ("Leveling", [
        r"\btrist\b",
        r"\btomb\b",
        r"\bwalk\b",
        r"\ba1\b",
        r"\ba2\b",
        r"\ba3\b",
        r"\ba4\b",
        r"\ba5\b",
        r"\bct\b",
        r"\bexp\b"
    ]),

    ("Uber", [
        r"\buber",
        r"\bubers",
        r"\btorch"
    ]),

    ("DClone", [
        r"dclone",
        r"diablo clone",
        r"\bclone\b"
    ])

]

def classify_activity(name):

    if not name:
        return "Other"

    text = normalize(name)

    for activity, patterns in ACTIVITIES:

        for pattern in patterns:

            if re.search(pattern, text):
                return activity

    return "Other"

#def normalize(name):
#    if not name:
#        return None
#    
#    name = name.strip().lower()
#    name = re.sub(r"\s+", " ", name)
#
#    return name

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