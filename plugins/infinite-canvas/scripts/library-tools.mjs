import { lstat, mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join } from "node:path";

const readOnly = { readOnlyHint: true, destructiveHint: false };
const scopeSchema = { type: "string", enum: ["public", "personal"], default: "public", description: "public = shared public library; personal = the paired user's own personal library." };
const filterSchema = {
  scope: scopeSchema,
  category_id: { type: "string", description: "Category ID from list_library_categories, or \"none\" for uncategorized assets. Omit for all categories." },
  type: { type: "string", enum: ["all", "image", "video", "audio"], default: "all" },
  q: { type: "string", description: "Optional case-insensitive file-name filter." },
};

export const MANIFEST_NAME = "infinite-canvas-library-manifest.json";
const PAGE_LIMIT = 200;
const CONCURRENCY = 3;
const MAX_ATTEMPTS = 3;

export const libraryTools = [
  {
    name: "list_library_categories",
    description: "List public (or your personal) asset-library categories with asset counts and the library total. Uses the paired token; no browser required. Use the IDs to filter list_library_assets or export_library_assets, and the counts to verify an export.",
    inputSchema: { type: "object", properties: { scope: scopeSchema }, additionalProperties: false },
    annotations: readOnly,
  },
  {
    name: "list_library_assets",
    description: "Read one page (up to 200) of the public or personal asset library with asset ID, file name, size, category and dimensions. Follow next_cursor until null to walk the whole library; total counts the same filter. Uses the paired token; no browser required.",
    inputSchema: {
      type: "object",
      properties: { ...filterSchema, cursor: { type: "string", description: "next_cursor from the previous page." }, limit: { type: "integer", minimum: 1, maximum: 200, default: 200 } },
      additionalProperties: false,
    },
    annotations: readOnly,
  },
  {
    name: "export_library_assets",
    description: "Download the original files of every asset matching a library filter (e.g. one public category such as 模特) into an authorized absolute local directory, one sub-folder per category, plus "
      + `${MANIFEST_NAME} listing every asset ID, category, local path, bytes and SHA-256. The full list is fixed on the first call and compared with the server total. `
      + "Downloads run in the background of the plugin process: each call waits up to wait_seconds and returns progress; call again with the same arguments until complete is true. "
      + "Re-calling after completion retries only failed items. Never overwrites existing files. The directory must be empty or hold a manifest from the same filter. Zip the directory afterwards if an archive is needed.",
    inputSchema: {
      type: "object",
      properties: {
        output_dir: { type: "string", description: "Authorized absolute local directory; created if missing." },
        ...filterSchema,
        wait_seconds: { type: "integer", minimum: 0, maximum: 50, default: 25, description: "How long this call waits for the export to finish before returning progress." },
      },
      required: ["output_dir"], additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
];

function query(args, extra = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ scope: args.scope || "public", category_id: args.category_id, type: args.type, q: args.q, ...extra })) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  return params.toString();
}

function filterOf(args) {
  return { scope: args.scope || "public", category_id: args.category_id || null, type: args.type && args.type !== "all" ? args.type : null, q: args.q || null };
}

const UNSAFE = /[\x00-\x1f\x7f/\\:*?"<>|]+/g;
const EXT_BY_MIME = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif", "video/mp4": ".mp4", "video/quicktime": ".mov", "video/webm": ".webm", "audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/x-wav": ".wav" };

function safeSegment(value, fallback) {
  const cleaned = String(value || "").replace(UNSAFE, "_").trim().replace(/^[ .]+|[ .]+$/g, "").slice(0, 120);
  return cleaned || fallback;
}

/** Stable, collision-free relative paths: <category>/<file name>. */
export function planPaths(items) {
  const used = new Set();
  return items.map(item => {
    const folder = safeSegment(item.category_name, item.category_id ? `category-${item.category_id.slice(0, 8)}` : "未分类");
    let name = safeSegment(item.original_name, item.id);
    if (!extname(name) && EXT_BY_MIME[item.mime_type]) name += EXT_BY_MIME[item.mime_type];
    let relative = `${folder}/${name}`;
    if (used.has(relative.toLowerCase())) {
      const ext = extname(name);
      relative = `${folder}/${name.slice(0, name.length - ext.length)}_${item.id.slice(0, 8)}${ext}`;
    }
    used.add(relative.toLowerCase());
    return { ...item, path: relative, status: "pending", attempts: 0 };
  });
}

async function writeManifest(dir, manifest) {
  manifest.updated_at = new Date().toISOString();
  const target = join(dir, MANIFEST_NAME);
  const temporary = `${target}.tmp`;
  await writeFile(temporary, JSON.stringify(manifest, null, 2), { mode: 0o600 });
  await rename(temporary, target);
}

function summary(manifest, running) {
  const counts = { done: 0, failed: 0, pending: 0 };
  for (const item of manifest.items) counts[item.status === "done" ? "done" : item.status === "failed" && item.attempts >= MAX_ATTEMPTS ? "failed" : "pending"]++;
  const complete = !running && counts.pending === 0;
  return {
    output_dir: manifest.output_dir,
    manifest_path: join(manifest.output_dir, MANIFEST_NAME),
    filter: manifest.filter,
    server_total: manifest.server_total,
    listed: manifest.items.length,
    listing_matches_server_total: manifest.items.length === manifest.server_total,
    downloaded: counts.done,
    failed: counts.failed,
    remaining: counts.pending,
    bytes: manifest.items.reduce((sum, item) => sum + (item.bytes || 0), 0),
    running,
    complete,
    all_downloaded: complete && counts.failed === 0,
    failures: manifest.items.filter(item => item.status === "failed").slice(0, 20).map(item => ({ id: item.id, path: item.path, attempts: item.attempts, error: item.error })),
    next_step: running ? "Call export_library_assets again with the same arguments to keep waiting."
      : counts.failed ? "Call again with the same arguments to retry the failed items, or report them."
        : "Export complete; every listed asset is on disk.",
  };
}

const jobs = new Map();

async function loadOrCreateManifest(dir, filter, request) {
  await mkdir(dir, { recursive: true });
  const info = await stat(dir);
  if (!info.isDirectory()) throw new Error("output_dir must be a directory.");
  let manifest = null;
  try {
    manifest = JSON.parse(await readFile(join(dir, MANIFEST_NAME), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw new Error(`Cannot read ${MANIFEST_NAME}; choose a new output_dir.`);
  }
  if (manifest) {
    if (JSON.stringify(manifest.filter) !== JSON.stringify(filter)) {
      throw new Error("output_dir already holds an export with a different filter; choose a new output_dir.");
    }
    for (const item of manifest.items) if (item.status === "failed") item.attempts = Math.min(item.attempts, MAX_ATTEMPTS - 1);
    return manifest;
  }
  if ((await readdir(dir)).length) throw new Error("output_dir must be empty for a new export; choose a new or empty directory.");
  const items = [];
  let cursor = null;
  let serverTotal = null;
  do {
    const page = await request(`/assets/agent/library?${query(filter, { cursor, limit: PAGE_LIMIT })}`);
    serverTotal ??= page.total;
    items.push(...page.items);
    cursor = page.next_cursor;
  } while (cursor);
  manifest = { version: 1, output_dir: dir, filter, server_total: serverTotal, listed_at: new Date().toISOString(), items: planPaths(items) };
  await writeManifest(dir, manifest);
  return manifest;
}

async function runExport(manifest, download) {
  const queue = manifest.items.filter(item => item.status !== "done" && item.attempts < MAX_ATTEMPTS);
  let saving = Promise.resolve();
  const save = () => { saving = saving.then(() => writeManifest(manifest.output_dir, manifest)).catch(() => {}); return saving; };
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const target = join(manifest.output_dir, item.path);
      item.attempts += 1;
      try {
        await mkdir(dirname(target), { recursive: true });
        let existing = null;
        try { existing = await lstat(target); } catch (error) { if (error.code !== "ENOENT") throw error; }
        if (existing) {
          // Files are published atomically, so one already here came from an
          // earlier run of this export whose manifest write was interrupted.
          if (!existing.isFile()) throw new Error("A non-file entry occupies the target path.");
          Object.assign(item, { status: "done", bytes: existing.size, error: undefined });
        } else {
          const result = await download({ source: item.id, output_path: target });
          Object.assign(item, { status: "done", bytes: result.bytes, sha256: result.sha256, error: undefined });
        }
      } catch (error) {
        Object.assign(item, { status: "failed", error: error instanceof Error ? error.message : String(error) });
      }
      await save();
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await save();
}

async function exportLibrary(args, { request, download, sleep }) {
  const dir = args.output_dir;
  if (typeof dir !== "string" || !isAbsolute(dir)) throw new Error("output_dir must be an absolute authorized local directory.");
  const filter = filterOf(args);
  let job = jobs.get(dir);
  if (job && JSON.stringify(job.manifest.filter) !== JSON.stringify(filter)) {
    throw new Error("An export with a different filter is running in this output_dir.");
  }
  if (!job) {
    const manifest = await loadOrCreateManifest(dir, filter, request);
    job = { manifest, done: false };
    job.promise = runExport(manifest, download).finally(() => { job.done = true; jobs.delete(dir); });
    jobs.set(dir, job);
  }
  const waitMs = Math.max(0, Math.min(50, args.wait_seconds ?? 25)) * 1000;
  await Promise.race([job.promise, sleep(waitMs)]);
  return summary(job.manifest, !job.done);
}

export async function callLibraryTool(name, args, { request, download, sleep = ms => new Promise(resolve => setTimeout(resolve, ms).unref()) }) {
  if (name === "list_library_categories") return request(`/assets/agent/library/categories?${query({ scope: args.scope })}`);
  if (name === "list_library_assets") return request(`/assets/agent/library?${query(args, { cursor: args.cursor, limit: args.limit })}`);
  if (name === "export_library_assets") return exportLibrary(args, { request, download, sleep });
  throw new Error(`Unknown library tool: ${name}`);
}
