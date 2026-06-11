import os
import json
from collections import Counter, defaultdict
import re

DATA_DIR = "data/social"

def normalize(name):
    if not name:
        return None
    name = name.strip().lower()
    name = re.sub(r"\s+", " ", name)
    return name

def is_numeric_like(name):
    # catches things like "1223", "12345", etc.
    return bool(re.fullmatch(r"\d+", name))

def load_names():
    names = []

    for root, _, files in os.walk(DATA_DIR):
        for file in files:
            if not file.endswith(".jsonl"):
                continue

            path = os.path.join(root, file)

            try:
                with open(path, "r") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue

                        data = json.loads(line)

                        games = data.get("public_games", [])
                        for g in games:
                            name = g.get("name")
                            if name:
                                names.append(name)

            except Exception as e:
                print(f"Skipping {path}: {e}")

    return names

def analyze(names):
    normed = [normalize(n) for n in names if n]
    normed = [n for n in normed if n]

    counts = Counter(normed)

    print("\n=== TOP GAME NAMES ===")
    for name, c in counts.most_common(20):
        print(f"{name:20} {c}")

    print("\n=== BASIC STATS ===")
    print("Total games:", len(normed))
    print("Unique names:", len(set(normed)))

    numeric = sum(is_numeric_like(n) for n in normed)
    print(f"Numeric-only names: {numeric} ({numeric/len(normed):.1%})")

    lengths = [len(n) for n in normed]
    print(f"Avg name length: {sum(lengths)/len(lengths):.2f}")

    print("\n=== LENGTH BUCKETS ===")
    buckets = defaultdict(int)
    for n in normed:
        l = len(n)
        if l <= 2:
            buckets["1-2"] += 1
        elif l <= 5:
            buckets["3-5"] += 1
        elif l <= 10:
            buckets["6-10"] += 1
        else:
            buckets["10+"] += 1

    for k, v in buckets.items():
        print(k, v)

    print("\n=== POSSIBLE PATTERNS ===")
    pattern_counts = Counter()

    for n in normed:
        if is_numeric_like(n):
            pattern_counts["numeric"] += 1
        elif re.search(r"\d", n):
            pattern_counts["alphanumeric"] += 1
        else:
            pattern_counts["text"] += 1

    for k, v in pattern_counts.items():
        print(k, v)

    print("\n=== POTENTIAL 'COMMON PREFIXES' ===")
    prefixes = Counter()
    for n in normed:
        parts = n.split()
        if parts:
            prefixes[parts[0]] += 1

    for p, c in prefixes.most_common(15):
        print(p, c)


if __name__ == "__main__":
    names = load_names()
    analyze(names)