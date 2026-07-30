#!/usr/bin/env node

import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const SERVER_INFO = { name: "infinite-canvas", version: "0.1.4" };
const DEFAULT_API_URL = "http://127.0.0.1:18000/api/v1";
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
      "Infinite Canvas is not paired. Open Infinite Canvas → user menu → 连接 Codex, "
      + "then call pair_infinite_canvas with the displayed code.",
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

async function resolveSession(sessionId) {
  if (sessionId) return sessionId;
  const payload = await request("/agent/control/sessions");
  const sessions = Array.isArray(payload?.sessions) ? payload.sessions : [];
  if (sessions.length === 0) {
    throw new Error(
      "No active Infinite Canvas browser canvas. Open a canvas and keep the tab visible.",
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
