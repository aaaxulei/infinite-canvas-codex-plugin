import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "mcp-server.mjs");

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function writeJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

test("uploads a local image and creates its canvas asset node", async (context) => {
  const commandBodies = [];
  let uploadAuthorization = null;
  const server = createServer(async (request, response) => {
    if (request.method === "POST" && request.url === "/api/v1/agent/control/assets/upload") {
      uploadAuthorization = request.headers.authorization;
      for await (const _chunk of request) {
        // Consume multipart bytes before replying.
      }
      writeJson(response, 201, {
        id: "asset-1",
        original_name: "earring.jpg",
        mime_type: "image/jpeg",
        file_size: 4,
        metadata_: { image_width: 640, image_height: 640 },
      });
      return;
    }
    if (request.method === "GET" && request.url === "/api/v1/agent/control/sessions") {
      writeJson(response, 200, { sessions: [{ id: "session-1" }] });
      return;
    }
    if (
      request.method === "POST"
      && request.url === "/api/v1/agent/control/sessions/session-1/commands"
    ) {
      const body = await readJson(request);
      commandBodies.push(body);
      if (body.command_type === "get_snapshot") {
        writeJson(response, 200, {
          revision: 4,
          snapshot: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
        });
        return;
      }
      if (body.command_type === "apply_operations") {
        writeJson(response, 200, {
          revision: 5,
          created: { local_asset_1: "node-1" },
          node_count: 1,
          edge_count: 0,
        });
        return;
      }
    }
    writeJson(response, 404, { detail: "not found" });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());

  const tempRoot = await mkdtemp(join(tmpdir(), "infinite-canvas-mcp-"));
  context.after(() => rm(tempRoot, { recursive: true, force: true }));
  const imagePath = join(tempRoot, "earring.jpg");
  await writeFile(imagePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

  const address = server.address();
  const child = spawn(process.execPath, [scriptPath], {
    env: {
      ...process.env,
      INFINITE_CANVAS_API_URL: `http://127.0.0.1:${address.port}/api/v1`,
      INFINITE_CANVAS_TOKEN: "icx_pat_test",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  context.after(() => child.kill());

  let stdout = "";
  const responses = new Map();
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    let newline;
    while ((newline = stdout.indexOf("\n")) >= 0) {
      const line = stdout.slice(0, newline);
      stdout = stdout.slice(newline + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      responses.get(message.id)?.(message);
    }
  });

  const call = (id, method, params) => new Promise((resolve) => {
    responses.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });

  await call(1, "initialize", { protocolVersion: "2025-06-18" });
  const response = await call(2, "tools/call", {
    name: "upload_local_assets_to_canvas",
    arguments: { files: [{ file_path: imagePath, label: "Product" }] },
  });

  assert.equal(response.result.isError, undefined);
  const result = JSON.parse(response.result.content[0].text);
  assert.deepEqual(result.assets, [{
    asset_id: "asset-1",
    node_id: "node-1",
    original_name: "earring.jpg",
    media_type: "image",
    file_size: 4,
  }]);
  assert.equal(uploadAuthorization, "Bearer icx_pat_test");
  assert.equal(commandBodies.length, 2);
  const operations = commandBodies[1].arguments.operations;
  assert.equal(operations[0].op, "add_node");
  assert.equal(operations[0].node_type, "mediaAsset");
  assert.equal(operations[0].data.assetId, "asset-1");
  assert.equal(operations[0].data.mediaType, "image");
  assert.match(operations[0].data.imageUrl, /\/api\/v1\/assets\/asset-1\/file$/);
  assert.equal(operations[1].op, "focus_nodes");
});

test("returns the paired user's provider and model catalog", async (context) => {
  let catalogAuthorization = null;
  const server = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/api/v1/agent/control/model-catalog") {
      catalogAuthorization = request.headers.authorization;
      writeJson(response, 200, {
        providers: [{
          provider_id: "provider-fal",
          provider_name: "fal.ai",
          provider_type: "fal",
          category: "image",
          models: [{
            model_id: "openai/gpt-image-2",
            model_label: "GPT Image 2",
          }],
        }],
      });
      return;
    }
    writeJson(response, 404, { detail: "not found" });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());

  const address = server.address();
  const child = spawn(process.execPath, [scriptPath], {
    env: {
      ...process.env,
      INFINITE_CANVAS_API_URL: `http://127.0.0.1:${address.port}/api/v1`,
      INFINITE_CANVAS_TOKEN: "icx_pat_catalog",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  context.after(() => child.kill());

  let stdout = "";
  const responses = new Map();
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    let newline;
    while ((newline = stdout.indexOf("\n")) >= 0) {
      const line = stdout.slice(0, newline);
      stdout = stdout.slice(newline + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      responses.get(message.id)?.(message);
    }
  });

  const call = (id, method, params) => new Promise((resolve) => {
    responses.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });

  await call(1, "initialize", { protocolVersion: "2025-06-18" });
  const listed = await call(2, "tools/list", {});
  assert.ok(listed.result.tools.some((tool) => tool.name === "get_canvas_model_catalog"));

  const response = await call(3, "tools/call", {
    name: "get_canvas_model_catalog",
    arguments: {},
  });
  assert.equal(response.result.isError, undefined);
  const result = JSON.parse(response.result.content[0].text);
  assert.equal(result.providers[0].provider_id, "provider-fal");
  assert.equal(result.providers[0].models[0].model_id, "openai/gpt-image-2");
  assert.equal(catalogAuthorization, "Bearer icx_pat_catalog");
});

test("forwards execution control, save, status, and workflow export commands", async (context) => {
  const commandBodies = [];
  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/api/v1/agent/control/sessions") {
      writeJson(response, 200, { sessions: [{ id: "session-1" }] });
      return;
    }
    if (
      request.method === "POST"
      && request.url === "/api/v1/agent/control/sessions/session-1/commands"
    ) {
      const body = await readJson(request);
      commandBodies.push(body);
      const results = {
        cancel_execution: { status: "cancelled", cancelled: true },
        retry_failed_nodes: { execution_id: "exec-retry", status: "running" },
        retry_batch_item: { execution_id: "exec-item", status: "running" },
        save_canvas: { saved: true, workflow_id: "workflow-1", revision: 7 },
        get_save_status: { persisted: true, dirty: false },
        material_center: { job_id: "job-1", status: "running" },
        export_workflow: {
          filename: "group.workflow.json",
          node_count: 1,
          edge_count: 0,
          workflow: {
            format: "infinitcanvas.workflow",
            version: 1,
            workflowName: "Group",
            snapshot: {
              nodes: [{ id: "node-1", position: { x: 0, y: 0 }, data: {} }],
              edges: [],
              counter: 1,
            },
          },
        },
      };
      writeJson(response, 200, results[body.command_type]);
      return;
    }
    writeJson(response, 404, { detail: "not found" });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());

  const tempRoot = await mkdtemp(join(tmpdir(), "infinite-canvas-mcp-commands-"));
  context.after(() => rm(tempRoot, { recursive: true, force: true }));
  const outputPath = join(tempRoot, "group.workflow.json");
  const address = server.address();
  const child = spawn(process.execPath, [scriptPath], {
    env: {
      ...process.env,
      INFINITE_CANVAS_API_URL: `http://127.0.0.1:${address.port}/api/v1`,
      INFINITE_CANVAS_TOKEN: "icx_pat_commands",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  context.after(() => child.kill());

  let stdout = "";
  const responses = new Map();
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    let newline;
    while ((newline = stdout.indexOf("\n")) >= 0) {
      const line = stdout.slice(0, newline);
      stdout = stdout.slice(newline + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      responses.get(message.id)?.(message);
    }
  });
  const call = (id, name, args) => new Promise((resolve) => {
    responses.set(id, resolve);
    child.stdin.write(`${JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: args },
    })}\n`);
  });

  const calls = [
    [1, "cancel_canvas_execution", { execution_id: "exec-1" }],
    [2, "retry_failed_canvas_nodes", { execution_id: "exec-1" }],
    [3, "retry_canvas_batch_item", { node_id: "node-1", result_index: 2 }],
    [4, "save_canvas", { expected_revision: 7, name: "Saved" }],
    [5, "get_canvas_save_status", {}],
    [6, "export_canvas_workflow", { group_id: "group-1", output_path: outputPath }],
    [7, "get_material_center_context", { target_environment: "prod", target_platform: "lovhub-web", node_ids: ["image-1"], expected_revision: 7 }],
    [8, "generate_material_center_suggestions", { target_environment: "test", target_platform: "lovhub-web", kind: "tags", media: { media_kind: "video", source_url: "video.mp4" } }],
    [9, "upload_material_center_templates", { idempotency_key: "upload-key-1", items: [{ request_id: "request-1", title: "Portrait" }] }],
    [10, "get_material_center_job", { job_id: "job-1" }],
    [11, "retry_material_center_uploads", { job_id: "job-1", idempotency_key: "retry-key-1" }],
    [12, "get_material_center_history", { target_environment: "prod", limit: 10 }],
  ];
  for (const [id, name, args] of calls) {
    const response = await call(id, name, args);
    assert.equal(response.result.isError, undefined, `${name} failed`);
  }

  assert.deepEqual(commandBodies.map((body) => body.command_type), [
    "cancel_execution",
    "retry_failed_nodes",
    "retry_batch_item",
    "save_canvas",
    "get_save_status",
    "export_workflow",
    ...Array(6).fill("material_center"),
  ]);
  assert.deepEqual(commandBodies[2].arguments, { node_id: "node-1", result_index: 2 });
  assert.deepEqual(commandBodies[5].arguments, { group_id: "group-1" });
  assert.deepEqual(commandBodies.slice(6).map((body) => body.arguments.action), ["context", "suggest", "upload", "get_job", "retry_uploads", "history"]);
  assert.equal(commandBodies[6].arguments.target_environment, "prod");
  assert.deepEqual(commandBodies[7].arguments.media, { media_kind: "video", source_url: "video.mp4" });
  assert.equal(commandBodies[8].idempotency_key, "upload-key-1");
  assert.equal(commandBodies[8].arguments.items[0].request_id, "request-1");
  assert.equal(commandBodies[10].idempotency_key, "retry-key-1");
  assert.ok(!("idempotency_key" in commandBodies[8].arguments));
  const exported = JSON.parse(await readFile(outputPath, "utf8"));
  assert.equal(exported.workflowName, "Group");
  assert.equal(exported.snapshot.nodes[0].id, "node-1");
  assert.equal((await stat(outputPath)).mode & 0o777, 0o600);
});

test("uses the selected deployment app URL and exposes the plugin version", async (context) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "infinite-canvas-mcp-config-"));
  context.after(() => rm(tempRoot, { recursive: true, force: true }));
  const child = spawn(process.execPath, [scriptPath], {
    env: {
      ...process.env,
      INFINITE_CANVAS_APP_URL: "https://staging.example.test/",
      INFINITE_CANVAS_API_URL: "https://staging.example.test/api/v1",
      INFINITE_CANVAS_TOKEN: "",
      INFINITE_CANVAS_CONFIG: join(tempRoot, "missing-config.json"),
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  context.after(() => child.kill());

  let stdout = "";
  const responses = new Map();
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    let newline;
    while ((newline = stdout.indexOf("\n")) >= 0) {
      const line = stdout.slice(0, newline);
      stdout = stdout.slice(newline + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      responses.get(message.id)?.(message);
    }
  });

  const call = (id, method, params) => new Promise((resolve) => {
    responses.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });

  const initialized = await call(1, "initialize", { protocolVersion: "2025-06-18" });
  const manifest = JSON.parse(await readFile(join(dirname(scriptPath), "../.codex-plugin/plugin.json"), "utf8"));
  assert.equal(initialized.result.serverInfo.version, manifest.version);
  const listed = await call(2, "tools/list", {});
  const toolNames = listed.result.tools.map((tool) => tool.name);
  for (const expected of [
    "cancel_canvas_execution",
    "retry_failed_canvas_nodes",
    "retry_canvas_batch_item",
    "save_canvas",
    "get_canvas_save_status",
    "export_canvas_workflow",
    "get_material_center_context",
    "generate_material_center_suggestions",
    "upload_material_center_templates",
    "get_material_center_job",
    "retry_material_center_uploads",
    "get_material_center_history",
  ]) {
    assert.ok(toolNames.includes(expected), `missing MCP tool: ${expected}`);
  }
  const response = await call(3, "tools/call", {
    name: "list_canvas_sessions",
    arguments: {},
  });
  assert.equal(response.result.isError, true);
  const result = JSON.parse(response.result.content[0].text);
  assert.match(result.error, /https:\/\/staging\.example\.test\//);
});
