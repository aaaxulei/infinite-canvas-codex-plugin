#!/bin/sh

set -eu

# Keep Claude Code pairing independent from the existing Codex connection.
# An explicit override still supports separate staging/production profiles.
INFINITE_CANVAS_CONFIG=${INFINITE_CANVAS_CONFIG:-"$HOME/.config/infinite-canvas/claude-code.json"}
export INFINITE_CANVAS_CONFIG

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec /bin/sh "$SCRIPT_DIR/start-mcp.sh"
