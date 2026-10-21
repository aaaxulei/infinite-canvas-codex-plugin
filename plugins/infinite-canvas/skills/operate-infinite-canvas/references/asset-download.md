# Download requested original assets

Read a fresh canvas snapshot and identify the exact successful result requested by
the user. Preserve the node ID and its actual `videoUrl`, image/audio URL or asset
ID. Do not infer an asset ID from a filename or replace an unavailable result.

Call `download_canvas_asset` with:

- `source`: the original asset UUID, `asset://<uuid>`, or same-deployment
  `/api/v1/assets/<uuid>/file` URL (the Agent file path is also accepted).
- `output_path`: an authorized absolute local filename in an existing directory.
  Existing files are never overwritten; select another name if necessary.

The MCP server keeps the paired token private, asks the deployed
`/api/v1/assets/agent/<uuid>/download-links` endpoint for server-signed CDN and
origin links (fastest first), and keeps the authorised
`/api/v1/assets/agent/<uuid>/file` endpoint as the final fallback, following its
storage redirects without forwarding the token. Backends without the links
endpoint simply use the fallback. No browser login/session or new pairing is needed when the
current pairing remains valid. Do not inspect credential files or copy tokens into
shell commands to perform downloads.

The tool streams one file at a time, with a 2 GiB limit and a twenty-minute
overall limit. It writes a private, uniquely named `.part` file, checks response
length when provided, then atomically publishes the completed destination. Within
one call it retries up to six attempts: a link that cannot be reached or refuses
the signature is skipped for the next one, and an interrupted or stalled stream is
resumed on the same link with `Range`/`If-Range` (restarting from zero if the link
ignores Range or the object changed). The result reports `source`, `attempts` and
`resumed`. When the call still fails, the partial file is removed and a new call
starts over. It does not download parallel ranges. Do not claim that capability.

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

Agent asset reads use short-lived server-signed Spaces links; Plugin 0.1.26 tries
the CDN link first and falls back to the origin link and the API file route, so a
network that blocks either host still completes. A host that could not be reached
is tried last for ten minutes within the MCP process. Plugin 0.1.24 prefers IPv4
for dual-stack hosts while still allowing IPv6-only hosts. Network failures include only a known error
code and hostname, never a signed path/query or token. After a plugin update,
restart its MCP connection so the new DNS ordering takes effect. For ETIMEDOUT,
ENETUNREACH or ENOTFOUND, check the failing hostname from the plugin process;
a successful connection to a different storage/CDN hostname is not sufficient.
Do not rewrite signed links, disable TLS verification or regenerate the asset.
