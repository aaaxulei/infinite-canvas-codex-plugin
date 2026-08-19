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
`firstLastFrame`, `videoEffect`, `vibeMV`, `productVideo`, `audioGeneration`,
`textToSpeech`, `aiMusic`,
`avatar`, `mediaAsset`, `llm`, `translate`, `promptList`, `imageList`, `outpaint`,
`erase`, `videoProcess`, `videoResult`.

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

### Move a node

```json
{
  "op": "move_node",
  "node_id": "prompt",
  "position": { "x": 360, "y": 200 }
}
```

Positions use the same coordinate space as the node's snapshot entry. A top-level
node uses canvas coordinates; a grouped child uses coordinates relative to its
parent group. Plan the final rectangle and avoid overlaps before moving it.

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

Rename, recolor, or arrange an existing group with:

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

Layout mode is `horizontal` for dependency-aware left-to-right arrangement or
`grid` for a compact grid.

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
Use `move_node` or `layout_group` instead of `load_snapshot` for arrangement.

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
