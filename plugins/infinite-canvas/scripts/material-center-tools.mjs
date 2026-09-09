const string = { type: "string", minLength: 1 };
const session = { session_id: { ...string, description: "Required when multiple browser canvases are online." } };
const target = {
  target_environment: { type: "string", enum: ["test", "prod"] },
  target_platform: { ...string, description: "Exact product code from the material-center config, e.g. lovhub-web." },
};
const nullableString = { type: ["string", "null"] };
const media = {
  media_kind: { type: "string", enum: ["image", "video"] },
  ...Object.fromEntries(["source", "cover"].flatMap((prefix) => [
    [`${prefix}_asset_id`, nullableString], [`${prefix}_url`, nullableString],
    [`${prefix}_original_name`, nullableString],
  ])),
};
const templateProperties = {
  ...target, ...media,
  request_id: { type: "string", minLength: 8, maxLength: 80, description: "One stable, unique ID per material; reuse unchanged on retry. New content requires a new ID." },
  title: { type: "string", minLength: 1, maxLength: 100 },
  play_type: { ...string, description: "Exact playTypes[].value from context." },
  prompt: { type: "string", minLength: 1, maxLength: 20000 },
  model: { ...string, description: "Material-center model code from config/mappings; never a Provider ID." },
  description: { type: "string", maxLength: 1000 },
  category_id: { type: ["integer", "null"] },
  tag_ids: { type: "array", maxItems: 50, uniqueItems: true, items: { type: "integer", minimum: 1 } },
  duration: { type: "integer", minimum: 0, maximum: 3600 },
  input_image_count: { type: "integer", minimum: 0, maximum: 20 },
  batch_type: { type: "string", enum: ["none", "single", "double", "multi"] },
  gender: { type: "string", enum: ["none", "female", "male"] },
  content_level: { type: "string", enum: ["clean", "soft", "medium", "hard"] },
  ...Object.fromEntries(["forbid_merge_images", "is_vip", "free_enabled"].map((key) => [key, { type: "boolean" }])),
  ...Object.fromEntries([
    "submodel", "ratio", "resolution", "effect_id", "fixed_output",
    "combo_video_prompt", "combo_video_model", "combo_video_submodel",
    "free_prompt", "free_model", "free_submodel", "free_resolution",
    "free_combo_video_prompt", "free_combo_video_model", "free_combo_video_submodel",
  ].map((key) => [key, { type: "string" }])),
  ...Object.fromEntries(["preview_video", "user_example"].flatMap((prefix) => [
    [`${prefix}_asset_id`, nullableString], [`${prefix}_url`, nullableString],
    [`${prefix}_original_name`, nullableString],
  ])),
};

function tool(name, action, description, properties, required) {
  return {
    name, action, description,
    inputSchema: {
      type: "object", properties: { ...session, ...properties }, required, additionalProperties: false,
    },
  };
}
const idempotency = { idempotency_key: { type: "string", minLength: 8, maxLength: 128, description: "Reuse for transport retries of this exact tool call; use a new key for an intentional new job." } };
const definitions = [
  tool("get_material_center_context", "context",
    "Read material-center config, categories and fresh Tags for an explicit environment/product. Optionally freeze canvas result sources and inferred upload payloads in visual order. Returns job_id; poll get_material_center_job. Payloads are drafts to review and complete before upload.",
    { ...target, ...idempotency, node_ids: { type: "array", minItems: 1, maxItems: 100, items: string }, expected_revision: { type: "integer", description: "Required with node_ids; use get_canvas_snapshot revision." } },
    ["target_environment", "target_platform"]),
  tool("generate_material_center_suggestions", "suggest",
    "Generate three bilingual title candidates and/or automatic Tags from actual media using the existing Grok service. Video uses custom cover or first frame. Tags come from the current environment/product pool. Returns job_id; poll get_material_center_job. This does not upload a template.",
    { ...target, ...idempotency, kind: { type: "string", enum: ["titles", "tags", "both"] }, media: { type: "object", properties: media, required: ["media_kind"], additionalProperties: false } },
    ["target_environment", "target_platform", "kind", "media"]),
  tool("upload_material_center_templates", "upload",
    "Submit 1–50 completed material configurations to the existing authenticated upload service. Creates offline templates, not public publication. Each item needs its own stable request_id. Returns job_id; poll get_material_center_job for per-item results. Batch is non-atomic; successful items remain recorded.",
    { ...idempotency, items: { type: "array", minItems: 1, maxItems: 50, items: {
      type: "object", properties: templateProperties,
      required: ["request_id", "target_environment", "target_platform", "media_kind", "title", "play_type", "prompt", "model"], additionalProperties: false,
    } } }, ["items"]),
  tool("get_material_center_job", "get_job",
    "Read a material-center job's progress, suggestions or upload results from the same browser session. Jobs expire one hour after completion and are lost on page refresh/sign-out; use upload history and the original request_id to reconcile uncertain submissions.",
    { job_id: string }, ["job_id"]),
  tool("retry_material_center_uploads", "retry_uploads",
    "Retry only failed items of a finished upload job, preserving their exact configuration and request_id. Successful items are excluded. Returns a new job_id; poll get_material_center_job. Never use to resubmit a still-running batch.",
    { ...idempotency, job_id: string }, ["job_id"]),
  tool("get_material_center_history", "history",
    "Read the current user's successful offline-template uploads with optional environment/product filters. Returns job_id; poll get_material_center_job. Does not expose other users' history.",
    { ...target, ...idempotency, offset: { type: "integer", minimum: 0 }, limit: { type: "integer", minimum: 1, maximum: 100 } }, []),
];

export const materialCenterTools = definitions.map(({ action: _action, ...definition }) => definition);
export const materialCenterActions = new Map(definitions.map(({ name, action }) => [name, action]));

export async function callMaterialCenterTool(name, args, sendCommand) {
  const { session_id, idempotency_key, ...parameters } = args;
  return sendCommand(session_id, "material_center", {
    ...parameters, action: materialCenterActions.get(name),
  }, idempotency_key);
}
