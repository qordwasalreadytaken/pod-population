import argparse
import json
from pathlib import Path


DEFAULT_EXCLUDED_SERVER_IDS = {22}


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Remove public games from excluded server IDs in historical "
            "social snapshots and recompute only public-game-derived fields."
        )
    )
    parser.add_argument(
        "paths",
        nargs="*",
        default=["data/social/2026-06.jsonl", "data/social/2026-07.jsonl"],
        help="JSONL snapshot files to rewrite in place.",
    )
    parser.add_argument(
        "--exclude-server",
        dest="excluded_servers",
        action="append",
        type=int,
        default=None,
        help="Server ID to exclude. May be passed multiple times.",
    )
    return parser.parse_args()


def normalize_server_id(value):
    if value is None:
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def build_histogram(games):
    histogram = {
        "1": 0,
        "2": 0,
        "3": 0,
        "4+": 0,
    }

    for game in games:
        players = int(game.get("players", 0) or 0)

        if players <= 1:
            histogram["1"] += 1
        elif players == 2:
            histogram["2"] += 1
        elif players == 3:
            histogram["3"] += 1
        else:
            histogram["4+"] += 1

    return histogram


def rewrite_snapshot(snapshot, excluded_server_ids):
    snapshot.pop("public_games_sanitized", None)
    snapshot.pop("excluded_server_ids", None)

    public_games = snapshot.get("public_games", [])

    filtered_games = [
        game for game in public_games
        if normalize_server_id(game.get("server")) not in excluded_server_ids
    ]

    removed_games = len(public_games) - len(filtered_games)

    public_players = sum(
        int(game.get("players", 0) or 0)
        for game in filtered_games
    )

    public_game_count = len(filtered_games)

    snapshot["public_games"] = filtered_games
    snapshot.setdefault("totals", {})["public_players"] = public_players
    snapshot["totals"]["public_games"] = public_game_count

    metrics = snapshot.setdefault("metrics", {})
    metrics["avg_public_players_per_game"] = (
        public_players / public_game_count
        if public_game_count > 0
        else None
    )

    snapshot["public_game_histogram"] = build_histogram(filtered_games)

    return removed_games


def rewrite_file(path, excluded_server_ids):
    lines = path.read_text(encoding="utf-8").splitlines()
    updated_lines = []
    changed_snapshots = 0
    removed_games = 0

    for line in lines:
        if not line.strip():
            continue

        snapshot = json.loads(line)
        removed = rewrite_snapshot(snapshot, excluded_server_ids)

        if removed > 0:
            changed_snapshots += 1
            removed_games += removed

        updated_lines.append(json.dumps(snapshot, separators=(",", ":")))

    path.write_text("\n".join(updated_lines) + "\n", encoding="utf-8")

    return changed_snapshots, removed_games, len(updated_lines)


def main():
    args = parse_args()
    excluded_server_ids = set(args.excluded_servers or DEFAULT_EXCLUDED_SERVER_IDS)

    for raw_path in args.paths:
        path = Path(raw_path)

        if not path.exists():
            print(f"Skipping missing file: {path}")
            continue

        changed_snapshots, removed_games, total_snapshots = rewrite_file(
            path,
            excluded_server_ids,
        )

        print(
            f"{path}: updated {changed_snapshots}/{total_snapshots} snapshots, "
            f"removed {removed_games} public games from excluded servers "
            f"{sorted(excluded_server_ids)}"
        )


if __name__ == "__main__":
    main()