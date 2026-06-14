#!/usr/bin/env python3
"""Trigger OrbisX calendar sync against the Business Memory API (max 5/run)."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    env_file = PROJECT_ROOT / ".env.local"
    if not env_file.exists():
        return env

    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip()
    return env


def main() -> int:
    env = load_env()
    api_url = env.get("BUSINESS_MEMORY_API_URL", "https://sad-biz-agent.vercel.app").rstrip("/")

    result = subprocess.run(
        ["curl", "-sf", "-X", "POST", f"{api_url}/api/orbisx/sync"],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        print(result.stderr or result.stdout or "Sync request failed", file=sys.stderr)
        return 1

    print(result.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
