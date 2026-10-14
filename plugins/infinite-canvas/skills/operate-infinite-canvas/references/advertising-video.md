# Advertising videos (投放视频) without a canvas

Requires Plugin 0.1.25 and the application's `/api/v1/ai/agent/advertising-videos`
routes. Existing valid Agent Tokens work; no browser session or node is needed
after pairing. Use this path when the user wants the ASMR cleaning/care short
video that the web "投放视频" workspace produces from one picture: the server
analyses the image, writes the prompt and queues a 6 s portrait video. Do not use
`submit_generation` for this; the prompt and format are owned by the server.

1. Call `list_advertising_video_models`. The order is fixed (H3 Max, Seedance 2.0
   海外版, Seedance 2.0 Fast) and only models this account may use are listed.
   Keep an explicit user choice; otherwise omit `model` and the first entry is used.
   Aspect ratio 9:16, 6 seconds and the 720p tier (768P for H3 Max) cannot be changed.
2. Upload the picture with `upload_generation_asset` (PNG, JPEG or WebP) and keep
   the returned `asset_id`. Existing owned assets can be reused by id.
3. Choose and retain a unique `request_id` (8–128 characters) before calling
   `create_advertising_video` with `asset_id` and optional `model`. The call returns
   `202` with a job in status `analyzing`; retain `job_id`.
4. Poll `get_advertising_video` with exactly one of `job_id` or `request_id`,
   every few seconds and slower for long waits. Statuses: `analyzing` → `queued` →
   `running` → `succeeded` / `failed` / `cancelled`, plus `needs_review` when the
   model found no reliable cleaning target (nothing is charged; ask the user for a
   different picture). `plan` and `prompt` show what the server decided.
5. On `succeeded`, `video_url` is usable immediately; `assets[*].asset_ref`
   appears after archival and works with `download_canvas_asset`. Archive failure
   does not mean generation failed; never regenerate just to obtain an asset.
6. `retry_advertising_video` re-analyses a `needs_review`/`failed` analysis or
   re-submits a failed generation with the saved prompt. `cancel_advertising_video`
   ends an analysing job without generation, or cancels the queued generation.

## Retry and recovery

- On a timeout or lost reply, query `get_advertising_video` with the original
  `request_id` before anything else. The same `request_id` with the same
  `asset_id` and `model` returns the existing job; different inputs return 409.
  Never invent a new `request_id` to recover an uncertain submission.
- Respect `retry_after_seconds` on 429; it is request admission, not a failure.
- Up to 100 jobs can be created per batch on the HTTP API; through MCP create them
  one by one with distinct `request_id` values and poll each job.
