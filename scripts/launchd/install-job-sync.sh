#!/usr/bin/env bash
# Install (or reinstall) the local daily job catalog sync on macOS.
# Uninstall: launchctl bootout gui/$(id -u)/com.careeros.job-sync
#            && rm ~/Library/LaunchAgents/com.careeros.job-sync.plist
set -euo pipefail
repo="$(cd "$(dirname "$0")/../.." && pwd)"
target="$HOME/Library/LaunchAgents/com.careeros.job-sync.plist"
mkdir -p "$repo/.local/logs" "$HOME/Library/LaunchAgents"
sed "s|__REPO__|$repo|g" "$repo/scripts/launchd/com.careeros.job-sync.plist.template" > "$target"
launchctl bootout "gui/$(id -u)/com.careeros.job-sync" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$target"
echo "Installed $target (daily at 06:15; log: $repo/.local/logs/job-sync.log)"
