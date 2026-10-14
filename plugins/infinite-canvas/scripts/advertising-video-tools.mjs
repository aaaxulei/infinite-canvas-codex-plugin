const readOnly = { readOnlyHint: true, destructiveHint: false };
const write = { readOnlyHint: false, destructiveHint: false };
const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const BASE = "/ai/agent/advertising-videos";

export const advertisingVideoTools = [
  {
    name: "list_advertising_video_models",
    description: "List the advertising-video models this account may use, in selector order (H3 Max, Seedance 2.0 海外版, Seedance 2.0 Fast). Output format is fixed server-side: 9:16, 6 s, 720p tier. No browser required.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: readOnly,
  },
  {
    name: "create_advertising_video",
    description: "Turn one uploaded image (asset_id from upload_generation_asset) into a 6 s portrait ASMR advertising video. The server analyses the picture, writes the prompt and queues generation; poll with get_advertising_video. Reuse request_id and identical inputs after a timeout; a deliberate new video needs a new request_id. Returns status needs_review (no charge) when the image has no reliable cleaning target.",
    inputSchema: {
      type: "object", properties: {
        request_id: { type: "string", minLength: 8, maxLength: 128, pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]+$", description: "Persist a unique ID before calling; reuse it for retries of this same submission." },
        asset_id: { type: "string", description: "PNG/JPEG/WebP asset owned by this account." },
        model: { type: "string", description: "Optional; one of the ids from list_advertising_video_models. Defaults to the first available." },
      }, required: ["request_id", "asset_id"], additionalProperties: false,
    },
    annotations: write,
  },
  {
    name: "get_advertising_video",
    description: "Get one advertising-video job by job_id, or recover a lost create response by request_id. Provide exactly one. Terminal status: succeeded, failed, cancelled, needs_review. video_url appears on success; assets list the archived asset_ref for download_canvas_asset.",
    inputSchema: { type: "object", properties: { job_id: { type: "string" }, request_id: { type: "string" } }, additionalProperties: false },
    annotations: readOnly,
  },
  {
    name: "retry_advertising_video",
    description: "Retry your own needs_review, failed or cancelled advertising-video job. A reviewed/failed analysis is analysed again; a failed generation re-submits the saved prompt without paying for analysis twice.",
    inputSchema: { type: "object", properties: { job_id: { type: "string" } }, required: ["job_id"], additionalProperties: false },
    annotations: write,
  },
  {
    name: "cancel_advertising_video",
    description: "Cancel your own advertising-video job. During analysis the job ends without generation; once queued the shared queue cancellation and upstream notification apply (best effort, no refund promise).",
    inputSchema: { type: "object", properties: { job_id: { type: "string" } }, required: ["job_id"], additionalProperties: false },
    annotations: write,
  },
];

export async function callAdvertisingVideoTool(name, args, { request }) {
  if (name === "list_advertising_video_models") return request(`${BASE}/models`);
  if (name === "create_advertising_video") {
    if (typeof args.request_id !== "string" || !REQUEST_ID.test(args.request_id)) {
      throw new Error("request_id must be 8–128 characters (letters, digits, dot, underscore, colon or hyphen), starting with a letter or digit; reuse it on retries.");
    }
    if (typeof args.asset_id !== "string" || !args.asset_id) throw new Error("asset_id is required; upload the image with upload_generation_asset first.");
    const body = { request_id: args.request_id, asset_id: args.asset_id, ...(args.model ? { model: args.model } : {}) };
    try {
      return await request(BASE, { method: "POST", body });
    } catch (error) {
      error.requestId = args.request_id;
      throw error;
    }
  }
  if (name === "get_advertising_video") {
    if (Boolean(args.job_id) === Boolean(args.request_id)) throw new Error("Provide exactly one of job_id or request_id.");
    const suffix = args.job_id ? encodeURIComponent(args.job_id) : `by-request/${encodeURIComponent(args.request_id)}`;
    return request(`${BASE}/${suffix}`);
  }
  if (name === "retry_advertising_video" || name === "cancel_advertising_video") {
    if (!args.job_id) throw new Error("job_id is required.");
    const action = name === "retry_advertising_video" ? "retry" : "cancel";
    return request(`${BASE}/${encodeURIComponent(args.job_id)}/${action}`, { method: "POST" });
  }
  throw new Error(`Unknown advertising video tool: ${name}`);
}
