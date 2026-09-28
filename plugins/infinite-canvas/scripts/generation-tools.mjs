const readOnly = { readOnlyHint: true, destructiveHint: false };
const write = { readOnlyHint: false, destructiveHint: false };

export const generationTools = [
  {
    name: "get_generation_model_catalog",
    description: "List the paired user's permitted media Provider/model pairs and available options. No browser or canvas required. Read before submitting a direct generation; model options are hints, not a universal parameter schema.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: readOnly,
  },
  {
    name: "upload_generation_asset",
    description: "Upload one explicitly authorized local image, video, or audio file as a private asset. Returns asset:// for submit_generation params. Does not create canvas nodes or require an online browser.",
    inputSchema: {
      type: "object", properties: { file_path: { type: "string", description: "Absolute authorized local media path; max 512 MiB." } },
      required: ["file_path"], additionalProperties: false,
    },
    annotations: write,
  },
  {
    name: "submit_generation",
    description: "Submit a headless image/video/audio generation to the existing Infinite Canvas queue. Creates no canvas nodes. Requires application support for /ai/agent. Select a permitted Provider/model pair and use provider-specific params. Always reuse request_id and identical inputs after timeout; query by request_id before resubmitting. A deliberate new generation requires a new request_id.",
    inputSchema: {
      type: "object", properties: {
        request_id: { type: "string", minLength: 8, maxLength: 128, pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]+$", description: "Persist a unique ID (e.g. UUID) before calling; reuse for retries of this same submission." },
        provider_id: { type: "string" }, model: { type: "string" },
        prompt: { type: "string", default: "" }, negative_prompt: { type: "string" },
        width: { type: "integer", minimum: 1, maximum: 16384, default: 512 },
        height: { type: "integer", minimum: 1, maximum: 16384, default: 512 },
        params: { type: "object", additionalProperties: true, description: "Provider-specific settings/media inputs, e.g. image_urls: ['asset://...']. Reserved/internal keys and server paths are forbidden. RunningHub/ComfyUI media uploads remain deferred to the worker." },
      }, required: ["request_id", "provider_id", "model"], additionalProperties: false,
    },
    annotations: write,
  },
  {
    name: "get_generation",
    description: "Get your generation status/results by record_id, or recover a lost submission response by request_id. Provide exactly one. No browser required. Terminal status: succeeded, failed, cancelled. Assets may appear later after archival; use download_canvas_asset with returned asset_ref. Transport errors are not generation failures.",
    inputSchema: { type: "object", properties: { record_id: { type: "string" }, request_id: { type: "string" } }, additionalProperties: false },
    annotations: readOnly,
  },
  {
    name: "cancel_generation",
    description: "Cancel your own queued/running generation without an online canvas. Terminal records remain terminal; upstream cancellation is best effort and cannot promise a refund.",
    inputSchema: { type: "object", properties: { record_id: { type: "string" } }, required: ["record_id"], additionalProperties: false },
    annotations: write,
  },
];

export async function callGenerationTool(name, args, { request, prepareLocalMedia, uploadLocalMedia }) {
  if (name === "get_generation_model_catalog") return request("/ai/agent/models");
  if (name === "upload_generation_asset") {
    const asset = await uploadLocalMedia(await prepareLocalMedia({ file_path: args.file_path }), "/ai/agent/assets/upload");
    return { asset_id: asset.id, asset_ref: `asset://${asset.id}`, mime_type: asset.mime_type,
      original_name: asset.original_name, file_size: asset.file_size };
  }
  if (name === "submit_generation") {
    if (typeof args.request_id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(args.request_id)) {
      throw new Error("request_id must be 8–128 characters (letters, digits, dot, underscore, colon or hyphen), starting with a letter or digit; reuse it on retries.");
    }
    try {
      return { ...await request("/ai/agent/generations", { method: "POST", body: args }), request_id: args.request_id };
    } catch (error) {
      error.requestId = args.request_id;
      throw error;
    }
  }
  if (name === "get_generation") {
    if (Boolean(args.record_id) === Boolean(args.request_id)) throw new Error("Provide exactly one of record_id or request_id.");
    const suffix = args.record_id ? encodeURIComponent(args.record_id) : `by-request/${encodeURIComponent(args.request_id)}`;
    return request(`/ai/agent/generations/${suffix}`);
  }
  if (name === "cancel_generation") {
    if (!args.record_id) throw new Error("record_id is required.");
    return request(`/ai/agent/generations/${encodeURIComponent(args.record_id)}/cancel`, { method: "POST" });
  }
  throw new Error(`Unknown direct generation tool: ${name}`);
}
