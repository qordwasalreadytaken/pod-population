import json
import os
from datetime import datetime, timezone
from pathlib import Path
import requests

BASE = "https://beta.pathofdiablo.com/api"

URLS = {
    "servers": f"{BASE}/servers",
    "stats": f"{BASE}/stats",
    "open_games": f"{BASE}/open-games",
}

from pathlib import Path

STATE_FILE = Path("state/last_commit.txt")

def fetch_json(url):
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    return response.json()


def classify_game(name):
    """
    Very rough first-pass classification.
    You can improve this later without changing collection.
    """
    n = name.lower()

    if any(x in n for x in ["baal", "chaos", "cs"]):
        return "xp"

    if any(x in n for x in ["map"]):
        return "mapping"

    if any(x in n for x in ["rush"]):
        return "rush"

    if any(x in n for x in ["trade", "shop", "sell", "buy"]):
        return "trade"

    if any(x in n for x in ["free", "help"]):
        return "help"

    if any(x in n for x in ["boss", "andariel", "duriel", "meph", "diablo", "baal"]):
        return "questing"

    return "other"

import subprocess


def main():
    timestamp = datetime.now(timezone.utc).replace(second=0, microsecond=0)

    servers = fetch_json(URLS["servers"])
    stats = fetch_json(URLS["stats"])
    raw_open_games = fetch_json(URLS["open_games"])

    active_servers = [
        server for server in servers
        if server.get("serverStatus") == 0
    ]

    open_games = []

    for item in raw_open_games:
        if isinstance(item, dict):
            open_games.append(item)

        elif isinstance(item, list):
            open_games.extend(
                x for x in item
                if isinstance(x, dict)
            )
    #
    # Server totals
    #
    server_players = sum(
        server.get("players", 0)
        for server in active_servers
    )
    server_games = sum(
        server.get("games", 0)
        for server in active_servers
    )

    #
    # Public games
    #
    public_games = len(open_games)
    public_players = sum(g.get("plrs", 0) for g in open_games)

    #
    # Private estimates
    #
    private_games = max(server_games - public_games, 0)
    private_players = max(server_players - public_players, 0)

    #
    # Occupancy estimates
    #
    avg_total = (
        server_players / server_games
        if server_games > 0
        else None
    )

    avg_public = (
        public_players / public_games
        if public_games > 0
        else None
    )

    avg_private = (
        private_players / private_games
        if private_games > 0
        else None
    )

    #
    # Public participation
    #
    online_in_any_games = int(stats[0].get("online_in_any_games", 0))

    public_participation = (
        public_players / online_in_any_games
        if online_in_any_games > 0
        else None
    )

    #
    # Introvert Index™
    #
    introvert_index = (
        1 - (public_players / server_players)
        if server_players > 0
        else None
    )

    #
    # Public game size histogram
    #
    histogram = {
        "1": 0,
        "2": 0,
        "3": 0,
        "4+": 0,
    }

    games = []

    for game in open_games:
        plrs = int(game.get("plrs", 0))

        if plrs <= 1:
            histogram["1"] += 1
        elif plrs == 2:
            histogram["2"] += 1
        elif plrs == 3:
            histogram["3"] += 1
        else:
            histogram["4+"] += 1

        games.append({
            "name": game.get("name"),
            "players": plrs,
            "difficulty": game.get("diff"),
            "mode": game.get("mode"),
            "category": classify_game(game.get("name", "")),
            "server": game.get("gsID"),
            "country": game.get("country"),
            "created": game.get("crtd"),
        })

    snapshot = {
        "timestamp": timestamp.isoformat(),
#        "sample_interval_minutes":sample_interval_minutes,
        "stats": stats[0],

        "totals": {
            "server_players": server_players,
            "server_games": server_games,

            "public_players": public_players,
            "public_games": public_games,

            "private_players_est": private_players,
            "private_games_est": private_games,
        },

        "metrics": {
            "avg_players_per_game": avg_total,
            "avg_public_players_per_game": avg_public,
            "avg_private_players_per_game_est": avg_private,

            "public_participation": public_participation,
            "introvert_index": introvert_index,
        },

        "public_game_histogram": histogram,

        "public_games": games,
    }

    #
    # Save as monthly JSONL
    #
    out_dir = Path("data/social")
    out_dir.mkdir(parents=True, exist_ok=True)

    filename = timestamp.strftime("%Y-%m")
    outfile = out_dir / f"{filename}.jsonl"

    with outfile.open("a", encoding="utf-8") as f:
        f.write(json.dumps(snapshot))
        f.write("\n")

    print(
        f"{timestamp.isoformat()} "
        f"- public={public_players}/{public_games} "
        f"- private≈{private_players}/{private_games}"
    )


if __name__ == "__main__":
    main()


