#!/usr/bin/env python3
"""Delete existing imessage-tagged notes and restart a clean 14-day backfill."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent


def load_api_url() -> str:
    config = SCRIPT_DIR / "config.env"
    for line in config.read_text(encoding="utf-8").splitlines():
        if line.startswith("API_URL="):
            return line.split("=", 1)[1].strip().rstrip("/")
    raise ValueError("API_URL not found in config.env")


def curl_json(url: str, method: str = "GET", data: dict | None = None) -> object:
    cmd = ["curl", "-sf", "-X", method, url, "-H", "Accept: application/json"]
    if data is not None:
        cmd.extend(["-H", "Content-Type: application/json", "-d", json.dumps(data)])
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


def main() -> int:
    api_url = load_api_url()
    notes = curl_json(f"{api_url}/api/memory")
    if not isinstance(notes, list):
        print("Unexpected API response", file=sys.stderr)
        return 1

    imessage_notes = [n for n in notes if "imessage" in (n.get("tags") or [])]
    print(f"Deleting {len(imessage_notes)} existing imessage note(s)...")

    for note in imessage_notes:
        curl_json(f"{api_url}/api/memory/{note['id']}", method="DELETE")
        print(f"  deleted {note['id']}")

    subprocess.run(
        [sys.executable, str(SCRIPT_DIR / "monitor.py"), "--init"],
        check=True,
    )
    subprocess.run(
        [sys.executable, str(SCRIPT_DIR / "monitor.py"), "--once"],
        check=True,
    )

    print("Clean re-import started. Background monitor will continue backfill.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
