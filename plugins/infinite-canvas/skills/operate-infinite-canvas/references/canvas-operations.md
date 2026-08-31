# Canvas operation reference

## Contents

- Local asset upload
- Supported node types
- Operation shapes
- Execution, retry, cancellation, save, and export tools
- Generation defaults
- Safe workflow pattern

## Local asset upload

Use `upload_local_assets_to_canvas` for user-authorized local image, video, or audio
files. Do not create empty `mediaAsset` nodes with local paths in their data:
generation workflows require server-side asset IDs.

The upload tool validates absolute paths and supported media types, uploads each
file as a private user-owned asset, then creates all requested `mediaAsset` nodes in
one canvas batch. Each file item may include `position`, `connect_to_node_id`, and
`target_handle`. Use the returned `asset_id` and `node_id` values for later workflow
operations.

## Supported node types

Use these values for `add_node.node_type`:

`imageOutput`, `text`, `videoGeneration`, `img2video`, `videoOutput`, `seedance`,
`firstLastFrame`, `videoEffect`, `vibeMV`, `productVideo`, `audioGeneration`,
`textToSpeech`, `aiMusic`, `avatar`, `mediaAsset`, `llm`, `translate`, `promptList`,
`imageList`, `outpaint`, `erase`, `videoProcess`, `videoResult`.

Legacy video and audio entry types are normalized by Infinite Canvas to the unified
`videoGeneration` and `audioGeneration` React Flow node types.

`run_canvas_nodes` executes image generation, every configured video-generation
mode, text-to-speech, AI Music, avatar, LLM, translation, text, outpaint, erase,
and video processing. `mediaAsset`, `promptList`, `imageList`, `videoResult`, and
derived `imageOutput` nodes with `hideParamsPanel: true` are data/result nodes and
do not run independently.

For `erase`, set `data.maskAssetId` to a user-owned black-and-white mask asset
before execution. Upload the mask with `upload_local_assets_to_canvas`, then use
its returned `asset_id`; never infer or fabricate an erase region.

For `videoProcess`, set `data.operation` to one of:

| operation | Additional data |
|---|---|
| `removeAudio` | None; this is the default |
| `trim` | `startTimeSec`, `endTimeSec` |
| `extractAudio` | None |
| `mergeAudio` | `audioAssetId` for a user-owned audio asset |
| `captureFrame` | `captureTimeSec` |

The primary media can be supplied by a normal incoming connection or by
`data.assetId`. Processing writes `resultAssetId`, `resultMediaType`, and
`resultOriginalName` back to the node, so downstream nodes consume the result.

## Operation shapes

### Add or update nodes

```json
{
  "op": "add_node",
  "ref": "prompt",
  "node_type": "text",
  "position": { "x": 100, "y": 200 },
  "data": {
    "nodeLabel": "Campaign | prompt | portrait",
    "content": "A cinematic portrait"
  }
}
```

`ref` is optional and resolves only inside the same operation batch. Plan the
rectangle against the live snapshot. Use `data.nodeLabel` for display names and do
not overwrite `data.label`, which may select a unified video/audio mode.

```json
{
  "op": "update_node",
  "node_id": "prompt",
  "data": { "nodeLabel": "Campaign | prompt | approved", "content": "Updated" }
}
```

`node_id` may be a real node ID or an earlier `ref`.

### Move, lay out, align, distribute, or resize

```json
{ "op": "move_node", "node_id": "prompt", "position": { "x": 360, "y": 200 } }
```

```json
{
  "op": "move_nodes_batch",
  "moves": [
    { "node_id": "prompt", "position": { "x": 100, "y": 200 } },
    { "node_id": "image", "position": { "x": 520, "y": 200 } }
  ]
}
```

Positions use each node's snapshot coordinate space: canvas coordinates for a
top-level node and parent-relative coordinates for a grouped child.

Arrange arbitrary nodes sharing one parent level with `mode: "horizontal"` or
`"grid"`:

```json
{ "op": "layout_nodes", "node_ids": ["a", "b", "c"], "mode": "horizontal" }
```

Align at least two same-level nodes. Valid values are `left`, `right`, `top`,
`bottom`, `center_x`, and `center_y`:

```json
{ "op": "align_nodes", "node_ids": ["a", "b"], "alignment": "top" }
```

Distribute at least three same-level nodes. Omit `spacing` to preserve the first to
last span, or provide a non-negative pixel gap:

```json
{
  "op": "distribute_nodes",
  "node_ids": ["a", "b", "c"],
  "direction": "horizontal",
  "spacing": 64
}
```

```json
{ "op": "resize_node", "node_id": "image", "width": 420, "height": 560 }
```

```json
{ "op": "resize_group", "group_id": "group", "width": 1400, "height": 760 }
```

Width and height are pixels with a minimum of 80.

### Connect, delete, disconnect, retarget, or edit edges

```json
{
  "op": "connect_nodes",
  "source": "prompt",
  "target": "image",
  "source_handle": null,
  "target_handle": "text-in"
}
```

Handle fields are optional. Respect snapshot handle patterns; the browser validates
connection compatibility.

```json
{ "op": "delete_edge", "edge_id": "edge_123" }
```

```json
{ "op": "delete_edges_batch", "edge_ids": ["edge_1", "edge_2"] }
```

`disconnect_nodes` removes every matching endpoint pair. An omitted handle is a
wildcard; explicit `null` matches the default handle:

```json
{
  "op": "disconnect_nodes",
  "source": "image-a",
  "target": "video",
  "target_handle": "product-images-in"
}
```

Retarget a known edge while preserving its target node. Omitted fields retain the
current value. `replace_edge` and `retarget_edge` are aliases:

```json
{
  "op": "retarget_edge",
  "edge_id": "edge_123",
  "new_source": "correct-image",
  "new_target": "video",
  "new_source_handle": null,
  "new_target_handle": "product-images-in"
}
```

`update_edge` can also change endpoints/handles and presentation. Route is one of
`bezier`, `smoothstep`, `step`, or `straight`:

```json
{
  "op": "update_edge",
  "edge_id": "edge_123",
  "label": "hero reference",
  "animated": true,
  "route": "smoothstep",
  "style": { "strokeWidth": 3 },
  "data": { "role": "primary" }
}
```

### Delete or duplicate nodes

```json
{ "op": "delete_node", "node_id": "node_123" }
```

`duplicate_nodes` clones the supplied nodes and internal edges. Supplying a group
through the bridge includes its descendants and remaps their `parentId` to the
cloned group. External edges are omitted by default.

```json
{
  "op": "duplicate_nodes",
  "node_ids": ["group_1"],
  "ref": "group-copy",
  "refs": { "child_1": "child-copy" },
  "include_external_edges": false
}
```

The operation result includes `id_map`. `ref` aliases the first requested node;
`refs` maps source IDs to additional batch-local aliases.

### Group membership and group layout

```json
{
  "op": "group_nodes",
  "ref": "group",
  "node_ids": ["prompt", "image"],
  "name": "Image workflow"
}
```

```json
{ "op": "ungroup_nodes", "group_id": "group" }
```

```json
{ "op": "add_nodes_to_group", "group_id": "group", "node_ids": ["node-a", "node-b"] }
```

```json
{ "op": "remove_nodes_from_group", "group_id": "group", "node_ids": ["node-b"] }
```

`group_id` is optional for removal. Absolute positions are preserved; adding
members expands the group if necessary.

```json
{ "op": "rename_group", "group_id": "group", "name": "Final workflow" }
```

```json
{ "op": "set_group_color", "group_id": "group", "color": "blue" }
```

Valid colors are `gray`, `red`, `orange`, `yellow`, `green`, `cyan`, `blue`, and
`purple`.

```json
{ "op": "layout_group", "group_id": "group", "mode": "horizontal" }
```

Group layout mode is `horizontal` for dependency-aware left-to-right arrangement
or `grid` for a compact grid.

### Reorder or split generated results

Reorder a multi-input edge among edges sharing its target and target handle. Use a
zero-based `to_index`, or `direction: "up"|"down"` (also `-1|1`):

```json
{ "op": "reorder_incoming_edge", "edge_id": "edge_123", "to_index": 0 }
```

Split a successful zero-based image/video batch result or AI Music track into an
independent result node:

```json
{ "op": "split_batch_result", "node_id": "image-batch", "result_index": 2, "ref": "hero" }
```

```json
{ "op": "split_music_track", "node_id": "music", "track_index": 1, "ref": "track-b" }
```

The new node ID is returned and may receive a batch-local `ref`.

### Select, focus, or clear selection

```json
{ "op": "select_nodes", "node_ids": ["a", "b"], "additive": false }
```

```json
{ "op": "clear_selection" }
```

Selection is distinct from viewport focus. `additive: true` preserves already
selected nodes. Prefer `focus_nodes` to raw viewport coordinates:

```json
{
  "op": "focus_nodes",
  "node_ids": ["prompt", "image"],
  "padding": 0.24,
  "min_zoom": 0.1,
  "max_zoom": 1.2,
  "duration": 320
}
```

Put focus after mutations in the same batch. Use raw viewport coordinates only
when the user asks for them:

```json
{
  "op": "set_viewport",
  "viewport": { "x": 20, "y": 30, "zoom": 0.8 },
  "duration": 320
}
```

### Undo or redo

```json
{ "op": "undo" }
```

```json
{ "op": "redo" }
```

Each must be the sole operation in a request. Every normal multi-operation request
is recorded as one undo step.

### Import, replace, or clear

Import a workflow/subgraph without replacing current content:

```json
{
  "op": "import_snapshot_at",
  "snapshot": { "nodes": [], "edges": [], "counter": 0 },
  "position": { "x": 1200, "y": 400 },
  "ref": "import-root"
}
```

`snapshot` may be a normal exported workflow object containing a nested
`snapshot`. IDs and internal edge endpoints are remapped. Group children keep
relative positions while top-level nodes move to the anchor.

```json
{ "op": "load_snapshot", "snapshot": { "nodes": [], "edges": [] } }
```

```json
{ "op": "clear_canvas" }
```

The last two operations replace or clear content and are destructive. Prefer
targeted operations for editing and layout.

## Execution, retry, cancellation, save, and export tools

These are MCP tools, not entries inside `apply_canvas_operations`.

- `run_canvas_nodes({node_ids})` and `run_canvas_group({group_id})` return an
  `execution_id`; poll it with `get_canvas_execution({execution_id})`.
- `cancel_canvas_execution({execution_id})` aborts a running Agent execution and
  cancels discoverable user-owned queue records. A terminal execution returns
  `cancelled: false` without changing it.
- `retry_failed_canvas_nodes({execution_id})` starts a new execution containing
  only the prior execution's recorded failed node IDs.
- `retry_canvas_batch_item({node_id, result_index})` retries one zero-based failed
  batch item through the mounted node's existing retry path and returns a new
  `execution_id`.
- `save_canvas({expected_revision, name?})` persists the live snapshot, creating a
  workflow when needed, and returns `saved`, `workflow_id`, `saved_at`, and
  `revision`.
- `get_canvas_save_status()` returns `persisted`, `dirty`, `last_saved_at`, and any
  workflow error.
- `export_canvas_workflow({node_ids?, group_id?, name?, output_path?, overwrite?})`
  returns an importable workflow. Use one of `node_ids` or `group_id`; when both are
  omitted, the current node selection is used. An absolute `output_path` writes
  JSON with mode `0600`; existing files require `overwrite: true`.

## Generation defaults

For `img2video` or `videoGeneration` nodes in image-to-video mode, set
`data.aspectRatio` to `auto` unless the user requests a specific ratio. If the
selected model does not support aspect ratio selection, omit the field and let the
model preserve the source image ratio.

## Safe workflow pattern

1. Read the live snapshot and revision.
2. Plan non-overlapping final positions from node and group bounding boxes.
3. Preserve existing node data fields not explicitly targeted.
4. Create one logical batch with temporary refs; keep `undo`/`redo` separate.
5. Give displayable nodes clear `nodeLabel` values and groups clear names.
6. Focus the complete active task with `focus_nodes`.
7. Supply the read revision and a new idempotency key.
8. Read again to verify complex changes.
9. Call `save_canvas` only when durable persistence is requested; verify with
   `get_canvas_save_status` when needed.
