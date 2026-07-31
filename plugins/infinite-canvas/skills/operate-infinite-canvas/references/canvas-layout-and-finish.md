# Canvas layout and completion

Use this reference for every canvas mutation that creates a workflow, adds multiple
nodes, or finishes an executed task.

## Contents

- Layout goals
- Positioning procedure
- Workflow patterns
- Node and group naming
- Completion procedure
- Current protocol limits
- Verification checklist

## Layout goals

Keep the canvas readable as a workflow, not merely valid as a graph.

1. Lay out the main flow from left to right:
   input/reference → prompt/control → generation/process → result.
2. Put parallel variants on separate rows.
3. Keep every node and group boundary disjoint.
4. Keep unrelated existing content in place.
5. Leave enough room for expanded controls and media results.
6. Prefer short, direct edges that do not cross node bodies.

Treat spacing values as minimums:

| Boundary | Minimum gap |
|---|---:|
| Nodes in adjacent workflow columns | 160 px horizontally |
| Parallel nodes in one column | 120 px vertically |
| Content and its group boundary | 80 px |
| Separate task groups | 200 px |

Increase the gaps for tall parameter panels, large media, dense connections, or
long titles. Do not compress the layout merely to fit the current viewport.

## Positioning procedure

Before constructing an operation batch:

1. Read the live snapshot.
2. Resolve each node's absolute bounding box from its position and measured or
   declared width and height.
3. When dimensions are absent, reserve at least 320 × 240 px, matching the canvas
   store's fallback estimate.
4. Include group boundaries as obstacles.
5. Choose an empty task region. Prefer extending an existing related workflow to
   its right; otherwise place a new task group beyond the current occupied bounds.
6. Assign workflow columns by dependency depth.
7. Place shared inputs in the leftmost column, generation nodes in the middle, and
   outputs on the right.
8. Test every proposed rectangle, expanded by the minimum gap, against existing
   and proposed rectangles.
9. Move a colliding proposal to the next free row or column before sending it.

Do not use node center distance as an overlap test. Compare rectangles:

```text
left = x
right = x + width
top = y
bottom = y + height
```

Account for parent group positions when a snapshot node uses relative coordinates.

## Workflow patterns

| Content | Placement |
|---|---|
| Prompt, script, lyrics, or control text | Left of the node that consumes it |
| Reference image, first/last frame, video, or audio | Left of its consumer; stack multiple inputs vertically |
| Generation or processing nodes | Middle columns in execution order |
| Result nodes | Right of their source, normally on the same row |
| Alternative models or prompt variants | One shared input followed by one row per variant |
| One logical task | One clearly named group when grouping improves readability |

For connected nodes, order columns by graph dependency rather than creation time.
Do not place a result to the left of its generator merely because space is
available there.

## Node and group naming

Use the format:

```text
task | stage | variant-or-specification
```

Examples:

- `Spring poster | key visual | 4:5`
- `Product film | shot 02 | dolly in`
- `Voiceover | final | Eleven v3`

Use the user's language. Keep names short enough to scan while making sibling
nodes distinguishable. Avoid context-free labels such as `Node 1`, `Image`,
`Final`, or `Test`.

For nodes that display editable titles:

- write the display name to `data.nodeLabel`;
- preserve `data.label`, because unified video/audio nodes use it to determine
  their mode;
- preserve semantic `data.title` fields such as an AI Music song title instead of
  repurposing them as canvas labels.

For groups, use the `group_nodes.name` field, which becomes `data.name`.
If a node type does not render `nodeLabel`, name the group and make the connected
prompt or source content self-explanatory. Do not invent another display field.

## Completion procedure

After all requested executions reach `succeeded`, `failed`, or another
user-accepted terminal state:

1. Read a fresh snapshot and revision.
2. Identify the exact input, control, processing, and result nodes used by this
   task.
3. Verify their logical order, names, groups, spacing, and edges.
4. Delete duplicate or temporary nodes only when the user explicitly authorized
   that deletion.
5. Apply any supported non-destructive corrections with the fresh revision.
6. Put one `focus_nodes` operation last and include the complete task, not only the
   final result. Focus the group ID when one group contains the complete task.
7. Read the snapshot again and verify nodes, edges, viewport, and revision.
8. Report the execution outcome and any protocol limitation.

Plan final positions before adding nodes so the task is already ordered at
creation time. Do not repeatedly change the viewport while polling.

## Current protocol limits

| Requirement | Current support |
|---|---|
| Place new nodes cleanly | `add_node.position` |
| Rename displayable nodes | `update_node.data.nodeLabel` |
| Name and contain a task | `group_nodes.name` |
| Focus the complete task | `focus_nodes` |
| Move an existing node | Not exposed; `update_node` accepts data only |
| Invoke the store's group auto-layout | Not exposed |
| Confirm local canvas mutation | Returned revision plus a fresh snapshot |
| Confirm durable/cloud save | No explicit `saved` or `persisted_at` response |

The browser canvas store writes normal changes to local storage, but the MCP result
does not provide a separate durable-save acknowledgement. Say “the canvas was
updated and verified from a fresh snapshot” when that is what was observed. Do not
claim cloud persistence from a revision alone.

Do not use `load_snapshot` as a routine workaround for moving nodes. It replaces
the complete canvas and is destructive. Use it only when the user explicitly asks
to load or replace an exact snapshot and confirms that scope.

When existing nodes need rearrangement, explain that the current protocol cannot
move them atomically. Still verify their state and focus the complete task; never
claim that a re-layout occurred when it did not.

## Verification checklist

- [ ] The snapshot and current revision were read before writing.
- [ ] Proposed node rectangles do not intersect existing or proposed content.
- [ ] Inputs, controls, generators, and results follow a left-to-right sequence.
- [ ] Parallel variants occupy distinct rows.
- [ ] `nodeLabel` and group names explain task, stage, and variant.
- [ ] `data.label` and semantic fields were preserved.
- [ ] Unrelated nodes were not moved, renamed, regrouped, or deleted.
- [ ] The completion focus includes every node used by the task.
- [ ] A fresh snapshot confirms the final nodes, edges, viewport, and revision.
- [ ] Save and re-layout claims do not exceed the protocol evidence.
