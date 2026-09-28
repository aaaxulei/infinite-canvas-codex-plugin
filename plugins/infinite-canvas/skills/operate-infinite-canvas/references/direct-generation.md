# Direct generation without a canvas

Requires Plugin 0.1.23 and the application's `/api/v1/ai/agent` routes. Existing
valid Agent Tokens work; no browser session, snapshot, or node ID is required
after pairing. Pairing for the first time still uses the logged-in application.

Use this path when the user requests a standalone generated image, video, or
audio result, especially when they explicitly say not to build canvas nodes.
Use the existing canvas tools when they want an editable connected workflow.
The direct tools cover models served by the media generation queue; they do not
automatically expose separate LLM, translation, or video-editing endpoints.

1. Call `get_generation_model_catalog`. Select an exact permitted Provider/model
   pair; preserve explicit user choices and read [model-routing.md](model-routing.md)
   for the team defaults when a model was not specified.
   Returned options are capability hints. A `param_schema` string is an identifier,
   not a JSON Schema; do not invent unsupported params from that name. The `params`
   object uses the same provider-specific fields as `/ai/generate`, not node data
   (`selectedProvider`, `selectedModel`, etc.). Consult available model references
   or application code when the mapping is unknown.
2. If a reference is local, call `upload_generation_asset` with the explicitly
   authorized absolute path. It creates a private asset and returns `asset_ref`;
   it never creates nodes. For existing assets, use their `asset://<id>` reference.
   Put references in the model's media fields, e.g. `params.image_urls` for image
   lists, or `params.image_url` for models requiring a single image. URLs must be
   from allowed media hosts; arbitrary websites, server paths and data URLs are
   rejected. Do not silently regenerate or replace an inaccessible reference.
3. Choose and retain a unique `request_id` (8–128 characters) before submission.
   Call `submit_generation` with that ID, `provider_id`, `model`, `prompt`, optional
   `negative_prompt`, `width`/`height`, and provider-specific `params`.
   Width/height default to 512; model-specific resolution/aspect fields belong in
   `params` and can override dimensions according to the model adapter.
4. Retain the returned `record_id`. Poll `get_generation` every few seconds,
   increasing the delay for long jobs. Provide exactly one of `record_id` or
   `request_id`. Respect `retry_after_seconds` on 429; a transport error is not a
   failed generation. Cancellation uses `cancel_generation` with the record ID.
5. Report `queued`/`running` as progress, and `succeeded`/`failed`/`cancelled` as
   terminal states. Results retain existing provider response fields (images,
   video, audio, etc.). Archival runs independently: `succeeded` can precede
   `assets`, and archive failure does not mean generation failed. Use returned
   result URLs while waiting for archival. When `assets[*].asset_ref` is present,
   use `download_canvas_asset` to download the original without a canvas session.
   Do not send the Agent Token to a remote result URL. If archival fails, report
   the available URL and limitation; do not regenerate merely to obtain an asset.

## Retry and recovery

- On a timeout, lost reply, or restart, query `get_generation` using the original
  `request_id`. If no record exists, retry the same submission with identical inputs
  and ID. Never manufacture a new ID to recover an uncertain submission.
- Repeating identical input returns the original record, including after success,
  failure or cancellation. Changing input under an existing ID returns 409.
- A deliberate new attempt after confirmed generation failure uses a new ID and
  may incur a new charge. Follow the user's retry authorization and stop conditions.
- 401 requires checking expiry/revocation; 403 requires model permission; 404 on
  `/ai/agent` may mean the app has not been deployed. Do not silently fall back to
  creating canvas nodes when the user asked for direct generation.

Local media are ownership-checked server-side. RunningHub, ComfyUI and supported
Aliyun deferred inputs keep `asset://` until the existing worker prepares them;
use their documented plural media fields. Other providers reuse the existing
server uploaders. Internal underscore-prefixed parameters, credentials, provider
addresses and callback overrides are forbidden. All jobs use the existing queue,
history, model permissions and concurrency limits.
