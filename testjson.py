import json

with open("data/social/2026-07.jsonl") as f:
    for i, line in enumerate(f, 1):
        try:
            json.loads(line)
        except Exception as e:
            print(i, e)