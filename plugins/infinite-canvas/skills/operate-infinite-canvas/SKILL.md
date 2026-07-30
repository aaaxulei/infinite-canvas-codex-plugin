---
name: operate-infinite-canvas
description: Open Infinite Canvas in Chrome, or inspect, edit, connect, group, clear, and execute nodes on a user's live Infinite Canvas browser canvas through the infinite-canvas MCP server. Use when the user asks Codex to open, show, visit, view, understand, modify, build, or run an Infinite Canvas workflow, including requests such as "打开画布" or "打开 Infinite Canvas", or to pair Codex with Infinite Canvas.
---

# Operate Infinite Canvas

Use the `infinite-canvas` MCP tools. Do not edit browser storage, call internal APIs
directly, or manipulate React Flow through generic browser automation.

## Open

The canonical Infinite Canvas URL is **https://designer.etm.tech/**.

When the user asks to open, show, visit, or go to Infinite Canvas or the canvas:

1. Load and follow the available Chrome browser control skill
   (`chrome:control-chrome` when plugin-prefixed), then navigate the user's Chrome
   to the exact canonical URL above. Treat this as explicit Chrome intent even when
   the user did not name a browser.
2. Reuse and focus an existing Chrome tab at that URL when practical; otherwise
   open a new Chrome tab.
3. Do not substitute the in-app browser, web search, a shell `open` command, or the
   canvas MCP tools for this navigation.
4. If the request is only to open the canvas, finish after successful navigation.
   Opening the site does not require pairing.

If the same request also asks to inspect or change the canvas, open it in Chrome
first, then continue with pairing or the read-before-writing flow below.

## Pair

If tools report that the plugin is not paired:

1. If Infinite Canvas is not already open, open the canonical URL in Chrome using
   the flow above.
2. Ask the user to choose **Infinite Canvas → user menu → 连接 Codex**.
3. Ask for the displayed one-time code.
4. Call `pair_infinite_canvas`. Use the default API URL for the standard local
   development environment; pass a deployment URL only when the user provides it.
5. Never repeat or expose the returned token. The MCP server stores it itself.

## Read before writing

1. Call `list_canvas_sessions`.
2. When exactly one session is active, omit `session_id` in later calls. When
   multiple sessions exist, identify the intended session from its label and URL.
3. Call `get_canvas_snapshot`.
4. Base every mutation on the returned nodes, edges, and `revision`.
5. Pass that exact revision as `expected_revision`. On a conflict, read again and
   rebuild the operation batch; do not blindly retry stale operations.

## Mutate

Use one `apply_canvas_operations` call for one logical user request. Give temporary
nodes short `ref` values so later operations in the same batch can update or connect
them. Reuse an `idempotency_key` only when retrying the identical request.

Supported operation shapes and node types are in
[references/canvas-operations.md](references/canvas-operations.md). Read it before
constructing a mutation.

For generation or editing requests, follow
[references/model-routing.md](references/model-routing.md). Prefer an explicit model
chosen by the user. Otherwise apply the task-specific defaults without inventing
Provider IDs.

When adding nodes, focus the new task or its group. Put `focus_nodes` after the add,
connect, and group operations in the same batch. The browser bridge also focuses
newly created top-level nodes as a fallback. Do not repeatedly change the viewport
while polling an execution.

For image-to-video nodes, set `aspectRatio` to `auto` when the user did not request
a specific ratio and the selected model supports automatic aspect ratio. Do not
infer `16:9` or `9:16` only from the prompt.

Treat `delete_node`, `clear_canvas`, and `load_snapshot` as destructive. Describe the
scope and obtain confirmation unless the user already explicitly requested that
exact destructive change.

## Execute

Call `run_canvas_nodes` or `run_canvas_group`. These return immediately with an
`execution_id`. Poll `get_canvas_execution` until `succeeded` or `failed`; report
failed node messages without hiding them. Do not start the same run again while its
execution is still `running`.

Run commands automatically focus their target nodes or group before execution.

Execution uses the application's queue and provider permissions. Do not bypass model
permissions, create another queue worker, or call providers directly.

## Verify

After a mutation, inspect the returned counts and created-id map. For non-trivial
changes, call `get_canvas_snapshot` again and verify the intended nodes and edges.
