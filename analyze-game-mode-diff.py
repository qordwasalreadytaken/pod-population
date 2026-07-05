import json
import os
from collections import Counter

DATA_DIR = "data/social"

# Keep both 2 and 3 mapped to "hell" so we can handle either encoding.
DIFFICULTY_MAP = {
    0: "normal",
    1: "nightmare",
    2: "hell",
    3: "hell",
}

MODE_MAP = {
    0: "softcore",
    1: "hardcore",
}


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


def iter_public_games(data_dir):
    for root, _, files in os.walk(data_dir):
        for file in files:
            if not file.endswith(".jsonl"):
                continue

            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue

                        snapshot = json.loads(line)
                        games = snapshot.get("public_games", [])
                        for game in games:
                            if isinstance(game, dict):
                                yield game
            except Exception as e:
                print(f"Skipping {path}: {e}")


def to_label(code, mapping):
    if code is None:
        return "missing"
    return mapping.get(code, f"unknown({code})")


def print_counter(title, counter, total):
    print(f"\n=== {title} ===")
    if total == 0:
        print("No records found.")
        return

    for label, count in counter.most_common():
        pct = (count / total) * 100
        print(f"{label:12} {count:6} ({pct:6.2f}%)")


def analyze_game_difficulty_and_mode(data_dir):
    difficulty_counts = Counter()
    mode_counts = Counter()
    combo_counts = Counter()

    total_games = 0
    skipped_placeholder_games = 0

    for game in iter_public_games(data_dir):
        if is_placeholder_null_game(game):
            skipped_placeholder_games += 1
            continue

        total_games += 1
        difficulty_label = to_label(game.get("difficulty"), DIFFICULTY_MAP)
        mode_label = to_label(game.get("mode"), MODE_MAP)

        difficulty_counts[difficulty_label] += 1
        mode_counts[mode_label] += 1
        combo_counts[f"{difficulty_label} + {mode_label}"] += 1

    print(f"Data directory: {data_dir}")
    print(f"Total public game records: {total_games}")
    print(f"Skipped placeholder null records: {skipped_placeholder_games}")

    print_counter("DIFFICULTY COUNTS", difficulty_counts, total_games)
    print_counter("MODE COUNTS", mode_counts, total_games)
    print_counter("DIFFICULTY + MODE COMBOS", combo_counts, total_games)


if __name__ == "__main__":
    analyze_game_difficulty_and_mode(DATA_DIR)