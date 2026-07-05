import json
import os
import re
from collections import Counter

DATA_DIR = "data/social"
OUTPUT = "data/activity/activity_latest.json"

import re

ACTIVITIES = [

    ("Maps", [
        r"\bmap\b",
        r"\bmaps\b",
        r"\bmapping\b"
    ]),

    ("Baal", [
        r"\bbaal\b",
        r"\bb\b"
    ]),

    ("Chaos", [
        r"\bchaos\b",
        r"\bcs\b"
    ]),

    ("Cows", [
        r"\bcow\b",
        r"\bcows\b"
    ]),

    ("Rush", [
        r"\brush",
        r"\brushing"
    ]),

    ("Trade", [
        r"\btrade",
        r"\bbring\b",
        r"\bwug\b",
        r"\bwuw\b",
        r"\biso\b",
        r"\bwtb\b",
        r"\bn\b",
        r"\bft\b"
    ]),

    ("Leveling", [
        r"\btrist",
        r"\btomb",
        r"\bwalk",
        r"\ba1",
        r"\ba2",
        r"\ba3",
        r"\ba4",
        r"\ba5",
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

def normalize(name):
    if not name:
        return None

    name = name.strip().lower()
    name = re.sub(r"\s+", " ", name)

    return name


def newest_snapshot():

    newest = None

    for root, _, files in os.walk(DATA_DIR):

        for file in sorted(files):

            if not file.endswith(".jsonl"):
                continue

            path = os.path.join(root, file)

            with open(path, encoding="utf8") as f:

                for line in f:

                    line = line.strip()

                    if line:
                        newest = json.loads(line)

    return newest


snapshot = newest_snapshot()

difficulty = Counter()
mode = Counter()
names = Counter()
activities = Counter()

games = snapshot.get("public_games", [])

for game in games:

    difficulty[game["difficulty"]] += 1

    mode[game["mode"]] += 1

    name = normalize(game.get("name"))

    if name:

        names[name] += 1

        activities[classify_activity(name)] += 1


output = {

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

    "interesting": {

        "unique_names": len(names),

        "public_games": len(games),

        "average_name_length":

            round(

                sum(len(n) for n in names)

                / max(len(names), 1),

                2

            )

    }

}

os.makedirs("data/activity", exist_ok=True)

with open(OUTPUT, "w") as f:
    json.dump(output, f, indent=4)

print("Wrote", OUTPUT)