import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("direct tools upload, generate, recover, poll and cancel without touching browser sessions", { timeout: 10000 }, async (context) => {
  const requests = [];
  const server = createServer(async (request, response) => {
    assert.equal(request.headers.authorization, "Bearer icx_pat_headless");
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = request.headers["content-type"]?.startsWith("application/json") && chunks.length
      ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    requests.push({ path: request.url, method: request.method, body });
    const reply = value => response.end(JSON.stringify(value));
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/api/v1/ai/agent/models") return reply({ providers: [{ provider_id: "p", models: [{ model_id: "image" }] }] });
    if (request.url === "/api/v1/ai/agent/assets/upload") return reply({ id: "asset-1", mime_type: "image/png", original_name: "ref.png", file_size: 4 });
    if (request.url === "/api/v1/ai/agent/generations") {
      if (body.request_id === "limited-request") {
        response.statusCode = 429;
        response.setHeader("Retry-After", "2");
        return reply({ detail: "try later" });
      }
      return reply({ record_id: "record-1", status: "queued" });
    }
    if (request.url === "/api/v1/ai/agent/generations/by-request/request-123") return reply({ record_id: "record-1", status: "running" });
    if (request.url === "/api/v1/ai/agent/generations/record-1") return reply({ record_id: "record-1", status: "succeeded", assets: [{ asset_ref: "asset://result" }] });
    if (request.url === "/api/v1/ai/agent/generations/record-1/cancel") return reply({ record_id: "record-1", status: "cancelled" });
    response.statusCode = 404;
    reply({ detail: "unexpected route" });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());
  const directory = await mkdtemp(join(tmpdir(), "canvas-direct-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, "ref.png");
  await writeFile(file, Buffer.from([1, 2, 3, 4]));
  const child = spawn(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), "mcp-server.mjs")], {
    env: { ...process.env, INFINITE_CANVAS_API_URL: `http://127.0.0.1:${server.address().port}/api/v1`, INFINITE_CANVAS_TOKEN: "icx_pat_headless" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const lines = createInterface({ input: child.stdout });
  context.after(() => { lines.close(); child.kill(); });
  let sequence = 0;
  const rpc = async (method, params = {}) => {
    const next = once(lines, "line");
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: ++sequence, method, params }) + "\n");
    return JSON.parse((await next)[0]).result;
  };
  const call = async (name, args = {}) => {
    const result = await rpc("tools/call", { name, arguments: args });
    return { ...JSON.parse(result.content[0].text), isError: result.isError };
  };
  await rpc("initialize", { protocolVersion: "2025-06-18" });
  const tools = (await rpc("tools/list")).tools;
  assert.ok(tools.some(t => t.name === "submit_generation"));
  assert.equal((await call("get_generation_model_catalog")).providers[0].provider_id, "p");
  assert.equal((await call("upload_generation_asset", { file_path: file })).asset_ref, "asset://asset-1");
  const input = { request_id: "request-123", provider_id: "p", model: "image", prompt: "a cat", params: { image_urls: ["asset://asset-1"] } };
  assert.equal((await call("submit_generation", input)).record_id, "record-1");
  assert.deepEqual(requests.find(r => r.path.endsWith("/generations")).body, input);
  assert.equal((await call("get_generation", { request_id: input.request_id })).status, "running");
  assert.equal((await call("get_generation", { record_id: "record-1" })).status, "succeeded");
  assert.equal((await call("cancel_generation", { record_id: "record-1" })).status, "cancelled");
  const error = await call("submit_generation", { ...input, request_id: "limited-request" });
  assert.equal(error.isError, true);
  assert.equal(error.http_status, 429);
  assert.equal(error.retry_after_seconds, 2);
  assert.equal(error.request_id, "limited-request");
  assert.ok(error.recovery);
  const before = requests.length;
  assert.equal((await call("get_generation", { record_id: "x", request_id: "y" })).isError, true);
  assert.equal((await call("submit_generation", { provider_id: "p", model: "image" })).isError, true);
  assert.equal(requests.length, before);
  assert.ok(requests.every(r => r.path.startsWith("/api/v1/ai/agent/")));
});
