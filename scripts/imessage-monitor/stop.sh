#!/bin/bash
# Stop the iMessage monitor so it won't run on login or consume RAM.
set -euo pipefail

SERVICE_LABEL="com.businessmemory.imessage-monitor"

pkill -f "imessage-monitor/monitor.py" 2>/dev/null || true
launchctl bootout "gui/$(id -u)/$SERVICE_LABEL" 2>/dev/null || true

echo "Stopped iMessage monitor."
echo "It will NOT run again until you run: bash install.sh"
