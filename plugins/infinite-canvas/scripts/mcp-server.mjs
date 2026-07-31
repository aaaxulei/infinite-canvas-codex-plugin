#!/usr/bin/env node

import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  resolve,
} from "node:path";
import { homedir } from "node:os";

const SERVER_INFO = { name: "infinite-canvas", version: "0.1.13" };
const CANVAS_APP_URL = "https://designer.etm.tech/";
const DEFAULT_API_URL = "http://127.0.0.1:18000/api/v1";
const MAX_LOCAL_ASSET_BYTES = 512 * 1024 * 1024;
const LOCAL_MEDIA_TYPES = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".bmp", "image/bmp"],
  [".tif", "image/tiff"],
  [".tiff", "image/tiff"],
  [".svg", "image/svg+xml"],
  [".mp4", "video/mp4"],
  [".mov", "video/quicktime"],
  [".webm", "video/webm"],
  [".avi", "video/x-msvideo"],
  [".mkv", "video/x-matroska"],
  [".mp3", "audio/mpeg"],
  [".wav", "audio/wav"],
  [".ogg", "audio/ogg"],
  [".flac", "audio/flac"],
  [".aac", "audio/aac"],
  [".m4a", "audio/mp4"],
]);
const configPath =
  process.env.INFINITE_CANVAS_CONFIG
  || join(homedir(), ".config", "infinite-canvas", "codex.json");

let fileConfig = null;

async function loadFileConfig() {
  if (fileConfig) return fileConfig;
  try {
    fileConfig = JSON.parse(await readFile(configPath, "utf8"));
  } catch {
    fileConfig = {};
  }
  return fileConfig;
}

function normalizeApiUrl(value) {
  return String(value || DEFAULT_API_URL).trim().replace(/\/+$/, "");
}

async function connection() {
  const saved = await loadFileConfig();
  return {
    apiUrl: normalizeApiUrl(
      process.env.INFINITE_CANVAS_API_URL || saved.api_url || DEFAULT_API_URL,
    ),
    token: process.env.INFINITE_CANVAS_TOKEN || saved.token || "",
  };
}

async function saveConnection(apiUrl, token) {
  const payload = {
    api_url: normalizeApiUrl(apiUrl),
    token,
    paired_at: new Date().toISOString(),
  };
  await mkdir(dirname(configPath), { recursive: true });
  const temporary = `${configPath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporary, configPath);
  await chmod(configPath, 0o600);
  fileConfig = payload;
}

async function request(path, { method = "GET", body, authenticated = true, apiUrl } = {}) {
  const current = await connection();
  const base = normalizeApiUrl(apiUrl || current.apiUrl);
  if (authenticated && !current.token) {
    throw new Error(
      `Infinite Canvas is not paired. Open ${CANVAS_APP_URL} in Chrome, choose `
      + "Infinite Canvas → user menu → 连接 Codex, then call pair_infinite_canvas "
      + "with the displayed code.",
    );
  }
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(authenticated ? { Authorization: `Bearer ${current.token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parseResponse(response);
}

async function parseResponse(response) {
  const text = await response.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { detail: text };
    }
  }
  if (!response.ok) {
    const detail =
      typeof parsed?.detail === "string"
        ? parsed.detail
        : `${response.status} ${response.statusText}`;
    throw new Error(detail);
  }
  return parsed;
}

async function prepareLocalMedia(spec) {
  if (!spec || typeof spec !== "object") {
    throw new Error("Each files item must be an object.");
  }
  const inputPath = String(spec.file_path || "").trim();
  if (!inputPath || !isAbsolute(inputPath)) {
    throw new Error(`Local media path must be absolute: ${inputPath || "(empty)"}`);
  }
  const filePath = resolve(inputPath);
  const info = await lstat(filePath).catch(() => null);
  if (!info || !info.isFile() || info.isSymbolicLink()) {
    throw new Error(`Local media file does not exist or is not a regular file: ${filePath}`);
  }
  if (info.size <= 0) {
    throw new Error(`Local media file is empty: ${filePath}`);
  }
  if (info.size > MAX_LOCAL_ASSET_BYTES) {
    throw new Error(
      `Local media file exceeds the 512 MiB plugin limit: ${filePath}`,
    );
  }
  const mimeType = LOCAL_MEDIA_TYPES.get(extname(filePath).toLowerCase());
  if (!mimeType) {
    throw new Error(
      `Unsupported local media type for ${filePath}. `
      + "Use a standard image, video, or audio file.",
    );
  }
  return {
    ...spec,
    filePath,
    filename: basename(filePath),
    mimeType,
    mediaType: mimeType.split("/", 1)[0],
    size: info.size,
  };
}

async function uploadLocalMedia(prepared) {
  const current = await connection();
  if (!current.token) {
    throw new Error(
      `Infinite Canvas is not paired. Open ${CANVAS_APP_URL} in Chrome, choose `
      + "Infinite Canvas → user menu → 连接 Codex, then pair the plugin.",
    );
  }
  const bytes = await readFile(prepared.filePath);
  const form = new FormData();
  form.append(
    "file",
    new Blob([bytes], { type: prepared.mimeType }),
    prepared.filename,
  );
  const response = await fetch(
    `${normalizeApiUrl(current.apiUrl)}/agent/control/assets/upload`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${current.token}` },
      body: form,
    },
  );
  return parseResponse(response);
}

function defaultAssetPosition(snapshot, item, index) {
  if (item.position) return item.position;
  const nodes = Array.isArray(snapshot?.nodes) ? snapshot.nodes : [];
  if (item.connect_to_node_id) {
    const target = nodes.find((node) => node.id === item.connect_to_node_id);
    if (target?.position) {
      return {
        x: Number(target.position.x || 0) - 420,
        y: Number(target.position.y || 0) + index * 90,
      };
    }
  }
  if (nodes.length === 0) {
    return {
      x: 100 + (index % 3) * 340,
      y: 100 + Math.floor(index / 3) * 280,
    };
  }
  const maxX = Math.max(
    ...nodes.map((node) => Number(node.position?.x || 0)),
  );
  const minY = Math.min(
    ...nodes.map((node) => Number(node.position?.y || 0)),
  );
  return {
    x: maxX + 420 + (index % 3) * 340,
    y: minY + Math.floor(index / 3) * 280,
  };
}

function assetNodeData(asset, prepared) {
  const metadata = asset?.metadata_ && typeof asset.metadata_ === "object"
    ? asset.metadata_
    : {};
  return {
    label: String(prepared.label || asset.original_name || prepared.filename),
    nodeLabel: "素材加载",
    imageUrl: `/api/v1/assets/${encodeURIComponent(asset.id)}/file`,
    assetId: asset.id,
    originalName: asset.original_name || prepared.filename,
    mediaType: prepared.mediaType,
    ...(metadata.image_width ? { imageWidth: metadata.image_width } : {}),
    ...(metadata.image_height ? { imageHeight: metadata.image_height } : {}),
  };
}

function buildAssetOperations(snapshot, uploaded, focus) {
  const operations = [];
  const refs = [];
  uploaded.forEach(({ asset, prepared }, index) => {
    const ref = `local_asset_${index + 1}`;
    refs.push(ref);
    operations.push({
      op: "add_node",
      ref,
      node_type: "mediaAsset",
      position: defaultAssetPosition(snapshot, prepared, index),
      data: assetNodeData(asset, prepared),
    });
    if (prepared.connect_to_node_id) {
      operations.push({
        op: "connect_nodes",
        source: ref,
        target: prepared.connect_to_node_id,
        target_handle: prepared.target_handle || null,
      });
    }
  });
  if (focus !== false) {
    operations.push({
      op: "focus_nodes",
      node_ids: refs,
      padding: 0.24,
      min_zoom: 0.1,
      max_zoom: 1.2,
      duration: 320,
    });
  }
  return { operations, refs };
}

async function resolveSession(sessionId) {
  if (sessionId) return sessionId;
  const payload = await request("/agent/control/sessions");
  const sessions = Array.isArray(payload?.sessions) ? payload.sessions : [];
  if (sessions.length === 0) {
    throw new Error(
      `No active Infinite Canvas browser canvas. Open ${CANVAS_APP_URL} in Chrome, `
      + "sign in, and keep the canvas tab visible.",
    );
  }
  if (sessions.length > 1) {
    throw new Error(
      `Multiple canvases are active; pass session_id. Sessions: ${JSON.stringify(sessions)}`,
    );
  }
  return sessions[0].id;
}

async function sendCommand(sessionId, commandType, args, idempotencyKey, timeoutSeconds = 30) {
  const resolved = await resolveSession(sessionId);
  return request(`/agent/control/sessions/${encodeURIComponent(resolved)}/commands`, {
    method: "POST",
    body: {
      command_type: commandType,
      arguments: args || {},
      idempotency_key: idempotencyKey || randomUUID(),
      timeout_seconds: timeoutSeconds,
    },
  });
}

const tools = [
  {
    name: "pair_infinite_canvas",
    description:
      "Pair this plugin with an Infinite Canvas account using the one-time code shown in the app. "
      + "This is the only tool that works before authentication.",
    inputSchema: {
      type: "object",
      properties: {
        pairing_code: {
          type: "string",
          description: "One-time code from Infinite Canvas → user menu → 连接 Codex.",
        },
        api_url: {
          type: "string",
          description:
            `Infinite Canvas API base URL including /api/v1. Default: ${DEFAULT_API_URL}`,
        },
      },
      required: ["pairing_code"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  {
    name: "list_canvas_sessions",
    description:
      "List this user's currently connected Infinite Canvas browser tabs and their revisions.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  {
    name: "get_canvas_snapshot",
    description:
      "Read nodes, edges, viewport, selected node, and revision from a live browser canvas. "
      + "Call before any mutation and reuse the returned revision as expected_revision.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Optional when exactly one canvas is active." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  {
    name: "get_canvas_model_catalog",
    description:
      "List the paired user's active, authorized Infinite Canvas Provider/model pairs. "
      + "Call before configuring generation nodes and copy both provider_id and model_id "
      + "from the same catalog entry.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  {
    name: "upload_local_assets_to_canvas",
    description:
      "Upload one or more user-authorized local image, video, or audio files as private Infinite "
      + "Canvas assets, create media asset nodes in one canvas batch, and optionally connect "
      + "each new node to an existing target node.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "Optional when exactly one canvas is active.",
        },
        files: {
          type: "array",
          minItems: 1,
          maxItems: 20,
          items: {
            type: "object",
            properties: {
              file_path: {
                type: "string",
                description:
                  "Absolute path to a local image, video, or audio file explicitly authorized "
                  + "by the user.",
              },
              label: {
                type: "string",
                description: "Optional canvas label. Defaults to the original file name.",
              },
              position: {
                type: "object",
                properties: {
                  x: { type: "number" },
                  y: { type: "number" },
                },
                required: ["x", "y"],
                additionalProperties: false,
              },
              connect_to_node_id: {
                type: "string",
                description: "Optional existing node to connect this asset node into.",
              },
              target_handle: {
                type: "string",
                description: "Optional target handle for the connection.",
              },
            },
            required: ["file_path"],
            additionalProperties: false,
          },
        },
        focus: {
          type: "boolean",
          description: "Focus the newly created asset nodes. Defaults to true.",
        },
        idempotency_key: {
          type: "string",
          minLength: 8,
          description: "Optional stable key for the canvas mutation.",
        },
      },
      required: ["files"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  {
    name: "apply_canvas_operations",
    description:
      "Atomically apply validated node, edge, group, viewport, snapshot, or clear operations "
      + "to the active browser canvas. The whole batch is one undo step. Always provide the "
      + "revision returned by get_canvas_snapshot.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Optional when exactly one canvas is active." },
        expected_revision: { type: "integer", minimum: 0 },
        idempotency_key: {
          type: "string",
          minLength: 8,
          description: "Stable key reused only when retrying the same mutation.",
        },
        operations: {
          type: "array",
          minItems: 1,
          maxItems: 100,
          items: { type: "object" },
          description:
            "Operations documented by the bundled skill: add_node, update_node, connect_nodes, "
            + "delete_node, group_nodes, ungroup_nodes, focus_nodes, set_viewport, "
            + "load_snapshot, clear_canvas.",
        },
      },
      required: ["expected_revision", "operations"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  {
    name: "run_canvas_nodes",
    description:
      "Start asynchronous execution of selected live-canvas nodes using Infinite Canvas' existing "
      + "frontend workflow executor. Returns execution_id immediately.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        node_ids: { type: "array", minItems: 1, items: { type: "string" } },
        idempotency_key: { type: "string", minLength: 8 },
      },
      required: ["node_ids"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  {
    name: "run_canvas_group",
    description:
      "Start asynchronous execution of a group node's children on the live canvas. "
      + "Returns execution_id immediately.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        group_id: { type: "string" },
        idempotency_key: { type: "string", minLength: 8 },
      },
      required: ["group_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  {
    name: "get_canvas_execution",
    description:
      "Poll an asynchronous node or group execution until it succeeds or fails.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        execution_id: { type: "string" },
      },
      required: ["execution_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
];

async function callTool(name, args) {
  if (name === "pair_infinite_canvas") {
    const apiUrl = normalizeApiUrl(args.api_url || DEFAULT_API_URL);
    const result = await request("/agent/pairing/exchange", {
      method: "POST",
      body: { code: args.pairing_code },
      authenticated: false,
      apiUrl,
    });
    await saveConnection(apiUrl, result.token);
    return {
      paired: true,
      api_url: apiUrl,
      token_name: result.token_info?.name,
      expires_at: result.token_info?.expires_at,
      config_path: configPath,
    };
  }
  if (name === "list_canvas_sessions") {
    return request("/agent/control/sessions");
  }
  if (name === "get_canvas_snapshot") {
    return sendCommand(args.session_id, "get_snapshot", {}, randomUUID());
  }
  if (name === "get_canvas_model_catalog") {
    return request("/agent/control/model-catalog");
  }
  if (name === "upload_local_assets_to_canvas") {
    const resolvedSession = await resolveSession(args.session_id);
    const preparedFiles = [];
    for (const item of args.files) {
      preparedFiles.push(await prepareLocalMedia(item));
    }

    const uploaded = [];
    try {
      for (const prepared of preparedFiles) {
        uploaded.push({
          prepared,
          asset: await uploadLocalMedia(prepared),
        });
      }
    } catch (error) {
      const uploadedIds = uploaded.map(({ asset }) => asset.id).filter(Boolean);
      const suffix = uploadedIds.length > 0
        ? ` Assets already uploaded before the failure: ${uploadedIds.join(", ")}.`
        : "";
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}${suffix}`,
      );
    }

    let snapshot = await sendCommand(
      resolvedSession,
      "get_snapshot",
      {},
      randomUUID(),
    );
    let built = buildAssetOperations(
      snapshot.snapshot,
      uploaded,
      args.focus,
    );
    let result;
    try {
      result = await sendCommand(
        resolvedSession,
        "apply_operations",
        {
          expected_revision: snapshot.revision,
          operations: built.operations,
        },
        args.idempotency_key,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/revision|版本冲突/i.test(message)) {
        throw new Error(
          `Assets were uploaded but canvas nodes could not be created: ${message}. `
          + `Uploaded asset IDs: ${uploaded.map(({ asset }) => asset.id).join(", ")}`,
        );
      }
      snapshot = await sendCommand(
        resolvedSession,
        "get_snapshot",
        {},
        randomUUID(),
      );
      built = buildAssetOperations(
        snapshot.snapshot,
        uploaded,
        args.focus,
      );
      result = await sendCommand(
        resolvedSession,
        "apply_operations",
        {
          expected_revision: snapshot.revision,
          operations: built.operations,
        },
        randomUUID(),
      );
    }

    return {
      revision: result.revision,
      node_count: result.node_count,
      edge_count: result.edge_count,
      assets: uploaded.map(({ asset, prepared }, index) => ({
        asset_id: asset.id,
        node_id: result.created?.[built.refs[index]],
        original_name: asset.original_name || prepared.filename,
        media_type: prepared.mediaType,
        file_size: asset.file_size ?? prepared.size,
      })),
    };
  }
  if (name === "apply_canvas_operations") {
    return sendCommand(
      args.session_id,
      "apply_operations",
      {
        expected_revision: args.expected_revision,
        operations: args.operations,
      },
      args.idempotency_key,
    );
  }
  if (name === "run_canvas_nodes") {
    return sendCommand(
      args.session_id,
      "run_nodes",
      { node_ids: args.node_ids },
      args.idempotency_key,
    );
  }
  if (name === "run_canvas_group") {
    return sendCommand(
      args.session_id,
      "run_group",
      { group_id: args.group_id },
      args.idempotency_key,
    );
  }
  if (name === "get_canvas_execution") {
    return sendCommand(
      args.session_id,
      "get_execution",
      { execution_id: args.execution_id },
      randomUUID(),
    );
  }
  throw new Error(`Unknown tool: ${name}`);
}

function toolResult(value, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

async function handleMessage(message) {
  const { id, method, params } = message;
  if (id === undefined || id === null) return;
  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: params?.protocolVersion || "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      },
    };
  }
  if (method === "ping") return { jsonrpc: "2.0", id, result: {} };
  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools } };
  }
  if (method === "tools/call") {
    try {
      const value = await callTool(params?.name, params?.arguments || {});
      return { jsonrpc: "2.0", id, result: toolResult(value) };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id,
        result: toolResult(
          { error: error instanceof Error ? error.message : String(error) },
          true,
        ),
      };
    }
  }
  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
}

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on("line", async (line) => {
  if (!line.trim()) return;
  try {
    const response = await handleMessage(JSON.parse(line));
    if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
  } catch (error) {
    process.stderr.write(
      `Infinite Canvas MCP message error: ${error instanceof Error ? error.stack : error}\n`,
    );
  }
});
