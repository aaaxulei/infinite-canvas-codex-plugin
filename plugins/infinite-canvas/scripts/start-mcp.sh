#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SERVER_PATH="$SCRIPT_DIR/mcp-server.mjs"

if [ -n "${INFINITE_CANVAS_NODE:-}" ]; then
  if [ ! -x "$INFINITE_CANVAS_NODE" ]; then
    echo "Infinite Canvas MCP: INFINITE_CANVAS_NODE is not executable: $INFINITE_CANVAS_NODE" >&2
    exit 127
  fi
  exec "$INFINITE_CANVAS_NODE" "$SERVER_PATH"
fi

if NODE_PATH=$(command -v node 2>/dev/null); then
  exec "$NODE_PATH" "$SERVER_PATH"
fi

for NODE_PATH in \
  "$HOME"/.cache/codex-runtimes/*/dependencies/node/bin/node \
  /opt/homebrew/bin/node \
  /usr/local/bin/node \
  /usr/bin/node
do
  if [ -x "$NODE_PATH" ]; then
    exec "$NODE_PATH" "$SERVER_PATH"
  fi
done

echo "Infinite Canvas MCP: Node.js was not found." >&2
echo "Install Node.js or set INFINITE_CANVAS_NODE to its absolute executable path, then restart Codex." >&2
exit 127
