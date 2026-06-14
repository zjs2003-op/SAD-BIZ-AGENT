#!/usr/bin/env python3
"""
Monitor macOS iMessage (chat.db) and POST recent messages to Business Memory API.

SAFETY: Never copies chat.db. Processes at most 5 messages per run.
Use --once for manual/scheduled runs. Use --daemon only if you know what you're doing.
"""

from __future__ import annotations

import argparse
import gc
import json
import logging
import os
import re
import sqlite3
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterator

APPLE_EPOCH = 978307200
HARD_MAX_IMPORTS = 5
MAX_TEXT_CHARS = 2000
MAX_BLOB_BYTES = 32_768
DEFAULT_CHAT_DB = Path.home() / "Library" / "Messages" / "chat.db"
DEFAULT_STATE_DIR = Path.home() / ".business-memory-imessage"
DEFAULT_STATE_FILE = DEFAULT_STATE_DIR / "state.json"

LOG = logging.getLogger("imessage-monitor")

MESSAGE_SELECT = """
    SELECT
        message.ROWID AS rowid,
        message.text,
        message.date,
        message.is_from_me,
        handle.id AS handle_address,
        chat.chat_identifier,
        chat.display_name
    FROM message
    JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
    JOIN chat ON chat_message_join.chat_id = chat.ROWID
    LEFT JOIN handle ON message.handle_id = handle.ROWID
"""


def load_config() -> dict[str, Any]:
    script_dir = Path(__file__).resolve().parent
    config_path = script_dir / "config.env"

    config: dict[str, Any] = {
        "API_URL": os.environ.get("BUSINESS_MEMORY_API_URL", ""),
        "POLL_INTERVAL_SECONDS": int(
            os.environ.get("POLL_INTERVAL_SECONDS", "180")
        ),
        "LOOKBACK_DAYS": int(os.environ.get("LOOKBACK_DAYS", "30")),
        "MAX_IMPORTS_PER_CYCLE": int(
            os.environ.get("MAX_IMPORTS_PER_CYCLE", "5")
        ),
        "CHAT_FILTER": os.environ.get("CHAT_FILTER", ""),
        "IMPORT_FROM_ME": os.environ.get("IMPORT_FROM_ME", "true").lower()
        == "true",
        "IMPORT_FROM_OTHERS": os.environ.get("IMPORT_FROM_OTHERS", "true").lower()
        == "true",
    }

    if config_path.exists():
        for line in config_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip()
            if key in (
                "POLL_INTERVAL_SECONDS",
                "LOOKBACK_DAYS",
                "MAX_IMPORTS_PER_CYCLE",
            ):
                config[key] = int(value)
            elif key in ("IMPORT_FROM_ME", "IMPORT_FROM_OTHERS"):
                config[key] = value.lower() == "true"
            else:
                config[key] = value

    if not config["API_URL"]:
        raise ValueError(
            "API_URL is not set. Copy config.example.env to config.env and set your Vercel URL."
        )

    config["API_URL"] = config["API_URL"].rstrip("/")
    config["CHAT_FILTERS"] = [
        item.strip().lower()
        for item in str(config["CHAT_FILTER"]).split(",")
        if item.strip()
    ]
    config["MAX_IMPORTS_PER_CYCLE"] = min(
        int(config["MAX_IMPORTS_PER_CYCLE"]), HARD_MAX_IMPORTS
    )
    return config


def load_state(state_file: Path) -> dict[str, Any]:
    if not state_file.exists():
        return {"last_rowid": 0, "imported_count": 0}
    return json.loads(state_file.read_text(encoding="utf-8"))


def save_state(state_file: Path, state: dict[str, Any]) -> None:
    state_file.parent.mkdir(parents=True, exist_ok=True)
    state_file.write_text(json.dumps(state, indent=2), encoding="utf-8")


def apple_time_to_datetime(raw_date: int | float | None) -> datetime | None:
    if raw_date is None:
        return None

    value = float(raw_date)
    if value > 1e15:
        seconds = value / 1e9 + APPLE_EPOCH
    elif value > 1e12:
        seconds = value / 1e6 + APPLE_EPOCH
    else:
        seconds = value + APPLE_EPOCH

    return datetime.fromtimestamp(seconds, tz=timezone.utc)


def datetime_to_apple_ns(dt: datetime) -> int:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int((dt.timestamp() - APPLE_EPOCH) * 1_000_000_000)


def lookback_cutoff_ns(lookback_days: int) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=lookback_days)
    return datetime_to_apple_ns(cutoff)


def decode_attributed_body(blob: bytes) -> str | None:
    """Extract plain text from Apple's typedstream NSAttributedString blob."""
    if len(blob) > MAX_BLOB_BYTES:
        return None

    idx = blob.find(b"NSString")
    if idx < 0:
        return None

    segment = blob[idx:]
    start = -1

    for marker in (b"\x84\x01+", b"\x84\x01\x2b"):
        marker_at = segment.find(marker)
        if marker_at >= 0:
            start = marker_at + len(marker)
            break

    if start < 0:
        plus = segment.find(b"+", 8)
        if plus < 0:
            return None
        start = plus + 1

    end = segment.find(b"\x86", start)
    if end < 0:
        end = len(segment)

    raw = segment[start:end]

    # Short messages use a single length byte before the text.
    if len(raw) >= 2 and raw[0] < 0x80:
        length = raw[0]
        if 0 < length < len(raw):
            candidate = raw[1 : 1 + length].decode("utf-8", errors="ignore").strip()
            if candidate and not candidate.startswith("__kIM"):
                return candidate[:MAX_TEXT_CHARS]

    text = raw.decode("utf-8", errors="ignore")
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text).strip()

    if not text or text.startswith("__kIM"):
        return None

    return text[:MAX_TEXT_CHARS]


def get_message_body(
    conn: sqlite3.Connection, rowid: int, text: str | None
) -> str | None:
    if text and text.strip():
        return text.strip()[:MAX_TEXT_CHARS]

    row = conn.execute(
        "SELECT attributedBody FROM message WHERE ROWID = ?",
        (rowid,),
    ).fetchone()
    if not row or not row["attributedBody"]:
        return None

    blob = row["attributedBody"]
    if isinstance(blob, memoryview):
        blob = blob.tobytes()

    return decode_attributed_body(blob)


def connect_chat_db(source: Path = DEFAULT_CHAT_DB) -> sqlite3.Connection:
    """Open chat.db read-only. NEVER copy the file."""
    if not source.exists():
        raise FileNotFoundError(
            f"Messages database not found at {source}. "
            "Make sure Messages is signed in on this Mac."
        )

    conn = sqlite3.connect(
        f"file:{source}?mode=ro",
        uri=True,
        timeout=5.0,
        check_same_thread=False,
    )
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA query_only = ON")
    conn.execute("PRAGMA cache_size = -512")
    conn.execute("PRAGMA mmap_size = 0")
    return conn


def iter_messages(
    conn: sqlite3.Connection,
    after_rowid: int,
    min_date_ns: int,
    limit: int,
) -> Iterator[sqlite3.Row]:
    query = (
        MESSAGE_SELECT
        + """
        WHERE message.ROWID > ?
          AND message.date >= ?
        ORDER BY message.ROWID ASC
        LIMIT ?
    """
    )
    cursor = conn.execute(query, (after_rowid, min_date_ns, limit))
    try:
        for row in cursor:
            yield row
    finally:
        cursor.close()


def fetch_window_start_rowid(
    conn: sqlite3.Connection, min_date_ns: int
) -> int:
    row = conn.execute(
        "SELECT MIN(ROWID) AS min_id FROM message WHERE date >= ?",
        (min_date_ns,),
    ).fetchone()
    if row and row["min_id"] is not None:
        return max(0, int(row["min_id"]) - 1)
    return 0


def list_chats(
    conn: sqlite3.Connection, min_date_ns: int, limit: int = 30
) -> list[dict[str, Any]]:
    query = """
        SELECT
            chat.display_name,
            chat.chat_identifier,
            handle.id AS handle_address,
            MAX(message.date) AS last_message_date
        FROM chat
        JOIN chat_message_join ON chat.ROWID = chat_message_join.chat_id
        JOIN message ON chat_message_join.message_id = message.ROWID
        LEFT JOIN chat_handle_join ON chat.ROWID = chat_handle_join.chat_id
        LEFT JOIN handle ON chat_handle_join.handle_id = handle.ROWID
        WHERE message.date >= ?
        GROUP BY chat.ROWID, chat.display_name, chat.chat_identifier, handle.id
        ORDER BY last_message_date DESC
        LIMIT ?
    """
    rows = conn.execute(query, (min_date_ns, limit)).fetchall()
    chats: list[dict[str, Any]] = []
    for row in rows:
        chats.append(
            {
                "display_name": row["display_name"] or "(no name)",
                "chat_identifier": row["chat_identifier"] or "",
                "handle_address": row["handle_address"] or "",
                "last_message_at": apple_time_to_datetime(row["last_message_date"]),
            }
        )
    return chats


def chat_label(row: sqlite3.Row) -> str:
    return (
        row["display_name"]
        or row["handle_address"]
        or row["chat_identifier"]
        or "Unknown chat"
    )


def matches_chat_filter(row: sqlite3.Row, filters: list[str]) -> bool:
    if not filters:
        return True

    haystack = " ".join(
        [
            str(row["display_name"] or ""),
            str(row["handle_address"] or ""),
            str(row["chat_identifier"] or ""),
        ]
    ).lower()

    return any(token in haystack for token in filters)


def should_import_message(row: sqlite3.Row, config: dict[str, Any]) -> bool:
    if row["is_from_me"] and not config["IMPORT_FROM_ME"]:
        return False
    if not row["is_from_me"] and not config["IMPORT_FROM_OTHERS"]:
        return False
    return matches_chat_filter(row, config["CHAT_FILTERS"])


def build_note_payload(row: sqlite3.Row, body: str) -> dict[str, Any]:
    label = chat_label(row)
    direction = "You" if row["is_from_me"] else label
    sent_at = apple_time_to_datetime(row["date"])
    sent_label = (
        sent_at.astimezone().strftime("%Y-%m-%d %H:%M:%S %Z") if sent_at else "unknown"
    )

    title = f"iMessage: {label}"
    content = "\n".join(
        [
            f"message_id: {row['rowid']}",
            f"chat: {label}",
            f"from: {direction}",
            f"sent_at: {sent_label}",
            f"handle: {row['handle_address'] or row['chat_identifier'] or 'unknown'}",
            "",
            body.strip()[:MAX_TEXT_CHARS],
        ]
    )

    return {
        "title": title[:200],
        "content": content,
        "tags": ["imessage"],
    }


def post_note(api_url: str, payload: dict[str, Any]) -> None:
    result = subprocess.run(
        [
            "curl",
            "-sf",
            "-X",
            "POST",
            "-H",
            "Content-Type: application/json",
            "-d",
            json.dumps(payload),
            f"{api_url}/api/memory",
        ],
        capture_output=True,
        text=True,
        timeout=30,
    )

    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "request failed").strip()
        raise RuntimeError(detail)


def process_new_messages(
    config: dict[str, Any],
    state_file: Path = DEFAULT_STATE_FILE,
    chat_db: Path = DEFAULT_CHAT_DB,
    dry_run: bool = False,
) -> int:
    state = load_state(state_file)
    last_rowid = int(state.get("last_rowid", 0))
    lookback_days = int(config["LOOKBACK_DAYS"])
    max_per_cycle = int(config["MAX_IMPORTS_PER_CYCLE"])
    min_date_ns = lookback_cutoff_ns(lookback_days)
    imported = 0

    conn = connect_chat_db(chat_db)
    try:
        window_start = fetch_window_start_rowid(conn, min_date_ns)
        if last_rowid < window_start:
            last_rowid = window_start
            LOG.info("Advanced cursor to window start (ROWID %s)", window_start)

        max_seen = last_rowid

        for row in iter_messages(conn, last_rowid, min_date_ns, max_per_cycle):
            max_seen = max(max_seen, int(row["rowid"]))

            if not should_import_message(row, config):
                continue

            body = get_message_body(conn, int(row["rowid"]), row["text"])
            if not body:
                continue

            payload = build_note_payload(row, body)

            if dry_run:
                LOG.info(
                    "DRY RUN would import ROWID %s: %s", row["rowid"], payload["title"]
                )
            else:
                try:
                    post_note(config["API_URL"], payload)
                    LOG.info("Imported ROWID %s: %s", row["rowid"], payload["title"])
                except Exception as exc:
                    LOG.error("Failed ROWID %s: %s", row["rowid"], exc)
                    continue

            imported += 1

        if not dry_run:
            state["last_rowid"] = max_seen
            state["imported_count"] = int(state.get("imported_count", 0)) + imported
            state["lookback_days"] = lookback_days
            state["window_start_rowid"] = window_start
            state["updated_at"] = datetime.now(timezone.utc).isoformat()
            save_state(state_file, state)
    finally:
        conn.close()
        gc.collect()

    return imported


def initialize_state(
    chat_db: Path = DEFAULT_CHAT_DB,
    state_file: Path = DEFAULT_STATE_FILE,
    lookback_days: int = 30,
) -> int:
    min_date_ns = lookback_cutoff_ns(lookback_days)
    conn = connect_chat_db(chat_db)
    try:
        start_rowid = fetch_window_start_rowid(conn, min_date_ns)
    finally:
        conn.close()

    save_state(
        state_file,
        {
            "last_rowid": start_rowid,
            "imported_count": 0,
            "lookback_days": lookback_days,
            "initialized_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    return start_rowid


def run_daemon(config: dict[str, Any]) -> None:
    interval = max(int(config["POLL_INTERVAL_SECONDS"]), 60)
    lookback_days = int(config["LOOKBACK_DAYS"])
    max_per_cycle = int(config["MAX_IMPORTS_PER_CYCLE"])

    LOG.warning(
        "Daemon mode: polling every %ss. Prefer scheduled --once runs instead.",
        interval,
    )
    LOG.info("Indexing last %s days only (max %s imports/cycle)", lookback_days, max_per_cycle)
    LOG.info("Posting to %s/api/memory", config["API_URL"])

    while True:
        try:
            imported = process_new_messages(config)
            if imported:
                LOG.info("Imported %s message(s) this cycle", imported)
        except Exception:
            LOG.exception("Monitor cycle failed")

        time.sleep(interval)


def main() -> int:
    parser = argparse.ArgumentParser(description="Monitor iMessage and import to Business Memory")
    parser.add_argument("--list-chats", action="store_true", help="List recent chats and exit")
    parser.add_argument(
        "--init",
        action="store_true",
        help="Reset cursor to start of lookback window (default 30 days)",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Import up to 5 messages and exit (safe default)",
    )
    parser.add_argument(
        "--daemon",
        action="store_true",
        help="Run continuous loop (not recommended)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview without posting")
    parser.add_argument("--reset-state", action="store_true", help="Delete saved monitor state")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    if args.reset_state:
        DEFAULT_STATE_FILE.unlink(missing_ok=True)
        LOG.info("Deleted state file %s", DEFAULT_STATE_FILE)
        return 0

    try:
        config = load_config()
    except ValueError as exc:
        LOG.error("%s", exc)
        return 1

    lookback_days = int(config["LOOKBACK_DAYS"])
    min_date_ns = lookback_cutoff_ns(lookback_days)

    if args.list_chats:
        conn = connect_chat_db()
        try:
            chats = list_chats(conn, min_date_ns)
            print(f"Chats with messages in the last {lookback_days} days:")
            print(f"{'DISPLAY NAME':<28} {'HANDLE / IDENTIFIER':<28} LAST MESSAGE")
            print("-" * 80)
            for chat in chats:
                last = chat["last_message_at"]
                last_label = (
                    last.astimezone().strftime("%Y-%m-%d %H:%M")
                    if last
                    else "unknown"
                )
                handle = chat["handle_address"] or chat["chat_identifier"] or ""
                print(
                    f"{chat['display_name'][:28]:<28} {handle[:28]:<28} {last_label}"
                )
        finally:
            conn.close()
        return 0

    if args.init:
        start_rowid = initialize_state(lookback_days=lookback_days)
        LOG.info(
            "Initialized at ROWID %s (last %s days only)",
            start_rowid,
            lookback_days,
        )
        if not args.once and not args.dry_run and not args.daemon:
            return 0

    if args.dry_run:
        imported = process_new_messages(config, dry_run=True)
        LOG.info("Dry run complete. %s message(s) would be imported.", imported)
        return 0

    if args.once:
        imported = process_new_messages(config)
        LOG.info("Imported %s message(s)", imported)
        return 0

    if args.daemon:
        run_daemon(config)
        return 0

    parser.print_help()
    print("\nSafe usage: python3 monitor.py --once")
    return 0


if __name__ == "__main__":
    sys.exit(main())
