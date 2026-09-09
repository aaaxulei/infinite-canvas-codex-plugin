---
name: operate-infinite-canvas
description: Open Infinite Canvas in Chrome, upload user-authorized local media, or inspect, edit, connect, group, arrange, save, export, clear, and execute nodes on a user's live Infinite Canvas browser canvas through the infinite-canvas MCP server. Use when the user asks Codex to open, show, visit, view, understand, modify, build, organize, save, export, or run an Infinite Canvas workflow; choose models, prompts, or aspect ratios for canvas generation; clean up and focus a completed canvas task; also read material-center options, generate titles and Tags, upload offline templates, retry failed uploads, and inspect personal upload history; including requests such as "打开画布" or "打开 Infinite Canvas"; or pair Codex with Infinite Canvas.
---

# Operate Infinite Canvas

Use the `infinite-canvas` MCP tools. Do not edit browser storage, call internal APIs
directly, or manipulate React Flow through generic browser automation.

## Open

Use the deployment selected by the user or pairing information. The standard
local default is **http://localhost:8899/**; production, staging, and regional
deployments must keep their own application/API URLs and credentials.

When the user asks to open, show, visit, or go to Infinite Canvas or the canvas:

1. Choose the exact URL named by the user. If none is named, use the configured
   deployment URL; only fall back to the local development default when no
   managed environment is selected.
2. Load and follow the available Chrome browser control skill
   (`chrome:control-chrome` when plugin-prefixed), then navigate the user's Chrome
   to the exact canonical URL above. Treat this as explicit Chrome intent even when
   the user did not name a browser.
3. Reuse and focus an existing Chrome tab at that URL when practical; otherwise
   open a new Chrome tab.
4. Do not substitute the in-app browser, web search, a shell `open` command, or the
   canvas MCP tools for this navigation.
5. If the request is only to open the canvas, finish after successful navigation.
   Opening the site does not require pairing.

If the same request also asks to inspect or change the canvas, open it in Chrome
first, then continue with pairing or the read-before-writing flow below.

## Pair

If tools report that the plugin is not paired:

1. If Infinite Canvas is not already open, open the canonical URL in Chrome using
   the flow above.
2. Ask the user to choose **Infinite Canvas → user menu → 连接 Codex**.
3. Ask for the displayed one-time code.
4. Call `pair_infinite_canvas`. Use the default API URL only for standard local
   development. For staging, production, or a regional environment, pass both
   that deployment's `api_url` and `app_url`; never reuse another environment's
   pairing token.
5. Never repeat or expose the returned token. The MCP server stores it itself.

## Read before writing

1. Call `list_canvas_sessions`.
2. When exactly one session is active, omit `session_id` in later calls. When
   multiple sessions exist, identify the intended session from its label and URL.
3. Call `get_canvas_snapshot`.
4. Base every mutation on the returned nodes, edges, and `revision`.
5. Pass that exact revision as `expected_revision`. On a conflict, read again and
   rebuild the operation batch; do not blindly retry stale operations.

Before adding or reconfiguring any generation node, also call
`get_canvas_model_catalog`. Select a Provider/model pair from the paired user's
current authorized catalog and write both `selectedProvider` and `selectedModel`
from the same catalog entry. Never combine a Provider ID from one entry with a
model ID from another entry.

Use the runtime catalog as the capability source of truth. Public model
documentation may guide selection and prompting but cannot add an unavailable
model or parameter to the paired account.

## Upload local media

Use `upload_local_assets_to_canvas` when the user explicitly supplies or authorizes
local image, video, or audio files. The tool uploads them as private assets owned by
the paired Infinite Canvas user and creates their media asset nodes in one canvas
batch.

1. Call `list_canvas_sessions` first. Pass `session_id` when more than one session
   is active.
2. Pass absolute local paths in `files[].file_path`. The tool accepts standard
   image, video, and audio formats up to 512 MiB per file.
3. Use `connect_to_node_id` and `target_handle` when the requested workflow already
   identifies each downstream node. Otherwise create the asset nodes first, read
   the returned node IDs, and connect them in the later workflow mutation.
4. Never upload arbitrary files discovered on disk. Only upload paths the user
   supplied or files created within the current authorized task. Never upload
   credentials, configuration files, browser data, tokens, or unrelated content.
5. The upload creates durable private assets even if a later canvas mutation fails.
   Report any returned uploaded asset IDs so the user can recover them without
   uploading duplicates.

## Mutate

Use one `apply_canvas_operations` call for one logical user request. Give temporary
nodes short `ref` values so later operations in the same batch can update or connect
them. Reuse an `idempotency_key` only when retrying the identical request.

Supported operation shapes and node types are in
[references/canvas-operations.md](references/canvas-operations.md). Read it before
constructing a mutation.

For every mutation that creates or extends a workflow, read and follow
[references/canvas-layout-and-finish.md](references/canvas-layout-and-finish.md).
Plan final positions before adding nodes. Use node bounding boxes, keep the main
flow left to right, leave the documented minimum gaps, and avoid all existing
nodes and groups. Do not move, rename, regroup, or delete unrelated content.

Give displayable nodes concise `data.nodeLabel` values in the user's language using
`task | stage | variant-or-specification`. Preserve `data.label`, which may control
a unified node's mode, and preserve semantic fields such as an AI Music
`data.title`. Give logical task groups clear names.

For generation or editing requests, follow
[references/model-routing.md](references/model-routing.md). Prefer an explicit model
chosen by the user. Otherwise apply the task-specific defaults, resolve them
against `get_canvas_model_catalog`, and persist the returned Provider/model pair
atomically. Never invent or cache Provider IDs.

For model choice, prompt construction, or aspect-ratio decisions, use
[references/model-selection-and-prompting.md](references/model-selection-and-prompting.md).
When a model is known, search that file for its exact ID and read the mapped family
section plus the aspect-ratio section when relevant. When no model is known, start
with its model-selection section. Explain a non-obvious model choice briefly.

Choose aspect ratios from delivery channel, subject geometry, source media, series
consistency, and the selected endpoint's runtime schema. For image editing,
image-to-video, first/last-frame, and transition tasks, preserve the source ratio
with `auto`, `adaptive`, or an omitted ratio when supported unless the user or
delivery target requires another ratio. Never choose `16:9`, `1:1`, or `9:16`
without a task-specific reason.

When adding nodes, focus the complete new task or its group. Put `focus_nodes`
after add, connect, update, and group operations in the same batch. The browser
bridge also focuses newly created top-level nodes as a fallback. Do not repeatedly
change the viewport while polling an execution.

Use targeted edge operations for wiring corrections: `delete_edge` for a known
edge ID, `disconnect_nodes` for endpoint/handle matching, and
`replace_edge`/`retarget_edge` to move a connection without deleting its target
node. Use `delete_edges_batch` for a reviewed set of erroneous edges. `undo` and
`redo` must each be the only operation in their batch.

Use `duplicate_nodes` for reusable subgraphs, `layout_nodes` for arbitrary nodes in
one hierarchy level, and `align_nodes`/`distribute_nodes`/`move_nodes_batch` for
precise cleanup. Group membership can be changed with `add_nodes_to_group` and
`remove_nodes_from_group` without dissolving the group. Use `resize_node` or
`resize_group` only when the requested size is intentional.

Treat `delete_node`, `delete_edge`, `delete_edges_batch`, `disconnect_nodes`,
`clear_canvas`, and `load_snapshot` as destructive. Describe the scope and obtain
confirmation unless the user already explicitly requested that exact destructive
change. Retargeting one known incorrect edge does not require a second confirmation
when it is the requested correction.

## Material center

For requests about automatic tagging, titles, uploading canvas results to the
material center (素材中心 / 上线), or upload history, read
[references/material-center.md](references/material-center.md). Use the dedicated
material-center MCP tools through the authenticated browser bridge. A material
upload creates an offline template; keep destination, per-item request IDs and
submission authorization explicit.

## Execute

Call `run_canvas_nodes` or `run_canvas_group`. These return immediately with an
`execution_id`. Poll `get_canvas_execution` until `succeeded`, `failed`, or
`cancelled`; report failed node messages without hiding them. Do not start the same
run again while its execution is still `running`.

Use `cancel_canvas_execution` when the user asks to stop an Agent-started execution.
It aborts the browser executor and best-effort cancels discovered queued/running
generation records through the normal authenticated queue API. Use
`retry_failed_canvas_nodes` with the failed execution ID to run only its recorded
failed nodes. Use `retry_canvas_batch_item` for one failed image/video batch item;
the target node must be mounted and retain its retry context.

Run commands automatically focus their target nodes or group before execution.

Execution uses the application's queue and provider permissions. Do not bypass model
permissions, create another queue worker, or call providers directly.

## Finish and verify

After a mutation, inspect the returned counts and created-id map. For non-trivial
changes, call `get_canvas_snapshot` again and verify the intended nodes and edges.

After all requested executions reach a terminal state, follow the completion
procedure in
[references/canvas-layout-and-finish.md](references/canvas-layout-and-finish.md):
read a fresh snapshot, verify the task's logical order, names, spacing, groups, and
edges, apply only supported non-destructive corrections, then focus the complete
task and read once more.

Use `move_node` or `move_nodes_batch` for targeted repositioning, `layout_group` for
a group's dependency-aware layout, and `layout_nodes` for an ungrouped or same-level
selection. Verify final bounding boxes after layout; do not use destructive
`load_snapshot` as a layout workaround.

When durable persistence is requested, call `save_canvas` with the latest revision
and use its `saved`, `workflow_id`, and `saved_at` response as the acknowledgement.
Call `get_canvas_save_status` to distinguish a persisted clean canvas from a dirty
or unsaved one. A mutation revision alone is still not proof of cloud persistence.

Use `export_canvas_workflow` for a selected subgraph or group. Pass either
`node_ids` or `group_id`; optionally provide an authorized absolute `output_path`.
Existing files are not replaced unless `overwrite: true`. Use `import_snapshot_at`
to add an exported workflow at a chosen canvas position without replacing the
current canvas.
