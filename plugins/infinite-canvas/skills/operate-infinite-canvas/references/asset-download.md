# Download requested original assets

Read a fresh canvas snapshot and identify the exact successful result requested by
the user. Preserve the node ID and its actual `videoUrl`, image/audio URL or asset
ID. Do not infer an asset ID from a filename or replace an unavailable result.

Call `download_canvas_asset` with:

- `source`: the original asset UUID, `asset://<uuid>`, or same-deployment
  `/api/v1/assets/<uuid>/file` URL (the Agent file path is also accepted).
- `output_path`: an authorized absolute local filename in an existing directory.
  Existing files are never overwritten; select another name if necessary.

The MCP server keeps the paired token private, calls the deployed
`/api/v1/assets/agent/<uuid>/file` endpoint, and follows storage redirects without
forwarding the token. No browser login/session or new pairing is needed when the
current pairing remains valid. Do not inspect credential files or copy tokens into
shell commands to perform downloads.

The tool streams one file at a time, with a 2 GiB limit and a ten-minute timeout.
It writes a private, uniquely named `.part` file, checks response length when
provided, then atomically publishes the completed destination. Interrupted partials
are removed; retry restarts the same source. It does not support resumable or
parallel range downloads. Do not claim those capabilities.

The result includes the absolute path, byte count, MIME type and SHA-256. These
verify transfer only: `media_decode_verified` is false. If the user requests video
track or full decoding checks, perform those separately on the downloaded file
with available local media tools before claiming acceptance. Never interpret a
successful download as proof of valid audio/video tracks.

External provider/CDN links and legacy `/storage/` URLs are not accepted by this
tool. Look for the corresponding asset ID in the same result/snapshot; if none is
available, report this limitation and preserve the original URL. Do not fabricate
an asset ID or silently fall back to different media.

On 401, report the pairing problem and use the normal pairing flow for the intended
environment. On 403/404/410, report access/unavailability/expiry and retain the
original result. On 429, retry later without changing the source. On interruption,
retry the same source to a free destination. If automatic approval review rejects
an action, explain the rejected action and the provided reason; do not bypass the
rejection, hide it, or manufacture replacement content to make the task appear done.
