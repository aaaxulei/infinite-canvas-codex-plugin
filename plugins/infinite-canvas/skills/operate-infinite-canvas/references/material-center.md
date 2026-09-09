# Material-center delivery

Use these tools when the user wants to generate titles, automatically tag canvas
results, prepare upload configurations, upload to the material center, retry failed
uploads, or inspect upload history. Requires Plugin **0.1.19+**, the matching app
deployment, an online canvas, and material-center access for the paired account.
Owner, administrators, and explicitly authorized ordinary users are supported.
These tools create **offline templates**; they do not make templates publicly live.
Tag/model/ratio administration remains in the web interface.

## Tools and asynchronous results

| Tool | Inputs and result |
|---|---|
| `get_material_center_context` | Explicit `target_environment` (`test`/`prod`) and `target_platform`; optionally `node_ids` plus the current `expected_revision`. Returns config, current categories/Tags, and per-result upload drafts via a job. |
| `generate_material_center_suggestions` | Same target, `kind` (`titles`, `tags`, `both`), and `media`. Returns three bilingual title candidates and/or current-pool Tag IDs via a job. |
| `upload_material_center_templates` | `items`: 1–50 completed template payloads with distinct stable `request_id` values. Returns an upload job with per-item progress/results. |
| `get_material_center_job` | `job_id`; returns current status and results immediately. |
| `retry_material_center_uploads` | `job_id` of a finished upload job; starts a new job containing only its failed items with their original payloads and request IDs. |
| `get_material_center_history` | Optional target filters, `offset`, `limit` (1–100); returns the paired user's successful uploads via a job. |

All tools accept `session_id`. Keep using the same browser session to poll a job.
Except for job polling, tools return `job_id` and `status: running` immediately.
Poll until `succeeded` or `failed`; the initial response is not upload completion.
A failed upload job can contain successful items: inspect every item's `status`,
`result` and `error`. Title suggestions may be preserved when tagging fails.

The optional tool-level `idempotency_key` deduplicates command delivery. Reuse it
after a lost response to the same tool call. Use a new command key for a deliberate
new operation, including `retry_material_center_uploads`. Each template's separate
`request_id` stays unchanged across upload retries.

## Prepare a reviewable configuration

1. Identify the user's requested destination environment and product. Do not infer
   these from the canvas deployment; a production canvas can target the material
   center's test environment. Ask only when the destination is not established.
2. Read the canvas snapshot, identify the requested result nodes, and call context
   with their IDs and revision. For groups, select the appropriate result children
   from the snapshot. Context freezes the web UI's visual ordering and individual
   batch-result prompts. It does not select every canvas result automatically.
3. Retain each returned draft's `request_id`. Treat `initial_values` and `payload`
   as inference to review, not a complete upload. Check media, play type, model,
   prompt, ratio, input count, user example and all user-specified settings. An
   unmapped model is intentionally blank: choose a current model code or ask the
   user, rather than guessing a Provider ID. `initial_values` also exposes separate
   image/video fields when a combo configuration is needed.
4. Generate titles/Tags from actual result media if requested. `media` accepts only
   `media_kind`, `source_asset_id`, `source_url`, `source_original_name`,
   `cover_asset_id`, `cover_url`, `cover_original_name`. For video, use the intended
   custom cover if present; otherwise the service uses the result's first frame.
   Do not substitute a text prompt or an unrelated reference image for the result.
5. Keep the three English/Chinese title candidates available for review; fill
   `title` with the chosen English candidate. Put automatic `tag_ids` in that
   material's payload, replacing the previous selection. Empty Tag results are
   valid. Only second-level Tags are selectable; first-level Tags are group headings.
   Changing environment/product requires fresh context and fresh Tags;
   never reuse numeric category/Tag IDs across scopes.
6. Before submission, present a concise per-item configuration with destination,
   media, title, play type, category/Tags, model and any free/combo settings. If the
   user has already authorized these uploads and their scope is clear, proceed.
   A request only to prepare, tag, or preview does not authorize an upload; ask for
   upload approval after preparing the concrete configurations.

## Upload payload

Required fields: `request_id`, `target_environment`, `target_platform`,
`media_kind`, `title`, `play_type`, `prompt`, `model`, and a usable
`source_asset_id` or `source_url`. Use values from context's current config.
Source URLs/assets must belong to the authorized task; the service enforces media
ownership and remote-domain restrictions.

The tool schema exposes the same optional fields as the existing template API:
description, category, Tags, ratio, resolution, duration, input count, batch type,
gender, content level, merge policy, effect ID, fixed output, VIP, user example,
cover, custom preview video, and free/combo variants. Omitted optional fields use
the existing server defaults (including `is_vip: true`, `free_enabled: false`,
`content_level: clean`). Explicitly set values when the user requested otherwise.
Custom preview video is video-only. Combo play types require
`combo_video_prompt` and `combo_video_model`; free mode requires `free_prompt` and
`free_model`. Preserve approved prompts exactly when filling paid/free variants.

## Failures, recovery and completion

Uploads run sequentially within each batch. Nonempty Tag selections are checked
against the destination's current selectable pool before a new upload; an invalid
ID fails that item without silently removing the user's selection. The batch is not an atomic transaction:
successful items immediately enter the same personal history used by the web UI.
Use `retry_material_center_uploads` for transient failures of a finished job.
Never retry a running job. Corrected configuration is new content and needs a new
`request_id`; inspect history first when an earlier submission's outcome is unknown.
Do not silently rerun suggestions or change parameters during an upload retry.

Jobs are held in the current browser's memory, expire one hour after completion,
and disappear on page refresh/sign-out. Keep request IDs and reviewed payloads in
the task context. After refresh or an uncertain response, inspect upload history
before resubmitting and reuse the original request IDs and payloads. Server-side
idempotency replays recorded success, but an external success before local commit
can still require reconciliation; do not promise exactly-once delivery.

Report per-item template ID, unique ID, destination and **offline** status, plus
failures and their reasons. Do not describe a started job or an offline template
as publicly published. Keeping the browser open is required for pending work;
sign-out/account changes stop subsequent submissions and hide previous-user jobs.
