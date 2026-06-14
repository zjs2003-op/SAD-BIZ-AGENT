# iMessage Monitor

Watches your Mac's Messages database and automatically creates notes in Business Memory.

## One-time Mac setup

### 1. Grant Full Disk Access

macOS blocks access to `~/Library/Messages/chat.db` unless you allow it.

1. Open **System Settings**
2. Go to **Privacy & Security → Full Disk Access**
3. Click **+** and add **both** of these:
   - **Terminal** (or **iTerm** if you use that)
   - **Python 3.13** at `/Library/Frameworks/Python.framework/Versions/3.13/Resources/Python.app`
4. Toggle both **on**
5. Quit and reopen Terminal

The background monitor runs through Python, not Terminal — both need access.

### 2. Configure the API URL

```bash
cd ~/Documents/business-memory/scripts/imessage-monitor
cp config.example.env config.env
```

Edit `config.env` and set your live Vercel URL:

```
API_URL=https://your-app.vercel.app
```

Optional: limit which chats get imported:

```
CHAT_FILTER=John Smith,+15551234567
```

### 3. List your chats (optional)

```bash
python3 monitor.py --list-chats
```

Use display names or phone numbers from this list in `CHAT_FILTER`.

### 4. Install and start background monitor

```bash
chmod +x install.sh
./install.sh
```

This will:
- Install a **LaunchAgent** (runs in the background while you're logged in)
- Reset the cursor to the **start of the 30-day window** and backfill from there
- Poll every 60 seconds, importing up to 25 new messages per cycle

Logs are written to:
- `~/.business-memory-imessage/monitor.log`
- `~/.business-memory-imessage/monitor.error.log`

## Manual commands

```bash
# One-time poll (useful for testing)
python3 monitor.py --once

# Preview imports without posting
python3 monitor.py --dry-run

# Start from now, skip old messages
python3 monitor.py --init

# Stop background monitor
launchctl bootout gui/$(id -u)/com.businessmemory.imessage-monitor

# Start background monitor again
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.businessmemory.imessage-monitor.plist
launchctl kickstart -k gui/$(id -u)/com.businessmemory.imessage-monitor
```

## What gets imported

Only messages from the **last 30 days** (configurable via `LOOKBACK_DAYS`). Older messages are never touched.

Each poll imports at most **25 messages** (configurable via `MAX_IMPORTS_PER_CYCLE`) to avoid memory spikes. The monitor reads `chat.db` directly — it does **not** copy the full database.

Each message becomes one `business_memory` note:

| Field | Value |
|-------|-------|
| Title | `iMessage: {contact or chat name}` |
| Content | chat, sender, timestamp, message text |
| Tags | `imessage` |

## Requirements

- Mac signed into Messages
- Mac awake / logged in (monitor pauses when asleep)
- Business Memory deployed on Vercel with working `/api/memory` endpoint

## Privacy note

Message text is sent to your Vercel app and stored in Supabase. Only enable this for chats you're comfortable storing in the cloud.
