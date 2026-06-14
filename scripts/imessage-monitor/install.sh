#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_NAME="com.businessmemory.imessage-monitor.plist"
PLIST_SRC="$SCRIPT_DIR/$PLIST_NAME"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME"
CONFIG_FILE="$SCRIPT_DIR/config.env"
PYTHON_BIN="$(command -v python3)"
SERVICE_LABEL="com.businessmemory.imessage-monitor"

if [[ -z "$PYTHON_BIN" ]]; then
  echo "python3 not found. Install Python 3 first."
  exit 1
fi

if [[ ! -f "$CONFIG_FILE" ]]; then
  cp "$SCRIPT_DIR/config.example.env" "$CONFIG_FILE"
  echo "Created $CONFIG_FILE — edit API_URL, then run again."
  exit 1
fi

if grep -q "your-app.vercel.app" "$CONFIG_FILE"; then
  echo "Update API_URL in $CONFIG_FILE before installing."
  exit 1
fi

chmod +x "$SCRIPT_DIR/monitor.py" "$SCRIPT_DIR/stop.sh"
mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$HOME/.business-memory-imessage"

sed \
  -e "s|__PYTHON_BIN__|$PYTHON_BIN|g" \
  -e "s|__SCRIPT_PATH__|$SCRIPT_DIR/monitor.py|g" \
  -e "s|__WORKING_DIR__|$SCRIPT_DIR|g" \
  -e "s|REPLACE_USERNAME|$USER|g" \
  "$PLIST_SRC" > "$PLIST_DST"

launchctl bootout "gui/$(id -u)/$SERVICE_LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_DST"
launchctl enable "gui/$(id -u)/$SERVICE_LABEL"

"$PYTHON_BIN" "$SCRIPT_DIR/monitor.py" --init

echo ""
echo "Installed SAFE iMessage monitor."
echo "- Runs --once every 3 minutes (max 5 messages, then exits)"
echo "- Does NOT copy chat.db"
echo "- Does NOT auto-start a heavy loop"
echo ""
echo "To stop: bash $SCRIPT_DIR/stop.sh"
echo "To test:  python3 $SCRIPT_DIR/monitor.py --once"
echo "Logs:     $HOME/.business-memory-imessage/monitor.log"
