---
name: operate-infinite-canvas
description: Inspect, edit, connect, group, clear, and execute nodes on a user's live Infinite Canvas browser canvas through the infinite-canvas MCP server. Use when the user asks Codex to view, understand, modify, build, or run an Infinite Canvas workflow, or to pair Codex with Infinite Canvas.
---

# Operate Infinite Canvas

Use the `infinite-canvas` MCP tools. Do not edit browser storage, call internal APIs
directly, or manipulate React Flow through generic browser automation.

## Pair

If tools report that the plugin is not paired:

1. Ask the user to open **Infinite Canvas → user menu → 连接 Codex**.
2. Ask for the displayed one-time code.
3. Call `pair_infinite_canvas`. Use the default API URL for the standard local
   development environment; pass a deployment URL only when the user provides it.
4. Never repeat or expose the returned token. The MCP server stores it itself.

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

Treat `delete_node`, `clear_canvas`, and `load_snapshot` as destructive. Describe the
scope and obtain confirmation unless the user already explicitly requested that
exact destructive change.

## Execute

Call `run_canvas_nodes` or `run_canvas_group`. These return immediately with an
`execution_id`. Poll `get_canvas_execution` until `succeeded` or `failed`; report
failed node messages without hiding them. Do not start the same run again while its
execution is still `running`.

Execution uses the application's queue and provider permissions. Do not bypass model
permissions, create another queue worker, or call providers directly.

## Verify

After a mutation, inspect the returned counts and created-id map. For non-trivial
changes, call `get_canvas_snapshot` again and verify the intended nodes and edges.
