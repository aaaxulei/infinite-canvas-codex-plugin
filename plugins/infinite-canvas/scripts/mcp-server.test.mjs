import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
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
