# Canvas operation reference

## Contents

- Local asset upload
- Supported node types
- Operation shapes
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
`firstLastFrame`, `videoEffect`, `audioGeneration`, `textToSpeech`, `aiMusic`,
`avatar`, `mediaAsset`, `llm`, `translate`, `promptList`, `imageList`, `outpaint`,
`erase`, `videoProcess`, `videoResult`.

Legacy video and audio entry types are normalized by Infinite Canvas to the unified
`videoGeneration` and `audioGeneration` React Flow node types.

## Operation shapes

### Add a node

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

`ref` is optional. It is resolved only inside the same operation batch.
Choose `position` only after checking the proposed node rectangle against the live
snapshot. Use `data.nodeLabel` for a display name when the node type supports it.
Do not overwrite `data.label`, because unified video and audio nodes may use that
field to select their mode.

### Update a node

```json
{
  "op": "update_node",
  "node_id": "prompt",
  "data": {
    "nodeLabel": "Campaign | prompt | approved",
    "content": "Updated text"
  }
}
```

`node_id` may be a real node ID or an earlier `ref`.

### Connect nodes

```json
{
  "op": "connect_nodes",
  "source": "prompt",
  "target": "image",
  "source_handle": null,
  "target_handle": "text-in"
}
```

Handle fields are optional. Respect existing edge handle patterns when extending a
workflow. Infinite Canvas validates connection compatibility.

### Delete a node

```json
{ "op": "delete_node", "node_id": "node_123" }
```

### Group or ungroup

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

### Set viewport

Prefer `focus_nodes` to raw viewport coordinates:

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

`node_ids` may contain real node IDs or refs created earlier in the same batch.
Padding and zoom fields are optional. Put this operation after adding, connecting,
or grouping the active task.

Use raw viewport coordinates only when the user asks for a specific viewport:

```json
{
  "op": "set_viewport",
  "viewport": { "x": 20, "y": 30, "zoom": 0.8 },
  "duration": 320
}
```

### Replace or clear

```json
{ "op": "load_snapshot", "snapshot": { "nodes": [], "edges": [] } }
```

```json
{ "op": "clear_canvas" }
```

These are destructive. Prefer targeted operations.
Do not use `load_snapshot` as a routine workaround for moving existing nodes.

## Generation defaults

For `img2video` or `videoGeneration` nodes in image-to-video mode, set
`data.aspectRatio` to `auto` unless the user requests a specific ratio. If the
selected model does not support aspect ratio selection, omit the field and let the
model preserve the source image ratio.

## Safe workflow pattern

1. Read the live snapshot and revision.
2. Plan non-overlapping final positions from node and group bounding boxes.
3. Preserve existing node data fields not explicitly targeted.
4. Create a single logical batch using temporary refs.
5. Give displayable nodes clear `nodeLabel` values and groups clear names.
6. Focus the complete active task with `focus_nodes`.
7. Supply the read revision and a new idempotency key.
8. Read again to verify complex changes.
