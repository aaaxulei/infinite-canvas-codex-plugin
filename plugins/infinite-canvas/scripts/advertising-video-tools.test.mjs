import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("advertising video tools create, recover, poll, retry and cancel through the agent API", { timeout: 10000 }, async (context) => {
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
    const base = "/api/v1/ai/agent/advertising-videos";
    if (request.url === `${base}/models`) return reply({ models: [{ model: "minimax/h3-max/reference-to-video", label: "H3 Max" }] });
    if (request.url === base && request.method === "POST") {
      if (body.request_id === "limited-request") {
        response.statusCode = 429; response.setHeader("Retry-After", "3");
        return reply({ detail: "try later" });
      }
      response.statusCode = 202;
      return reply({ job_id: "job-1", request_id: body.request_id, status: "analyzing", model: body.model || "minimax/h3-max/reference-to-video" });
    }
    if (request.url === `${base}/by-request/request-123`) return reply({ job_id: "job-1", status: "queued" });
    if (request.url === `${base}/job-1`) return reply({ job_id: "job-1", status: "succeeded", video_url: "https://media.example/v.mp4", assets: [{ asset_ref: "asset://result" }] });
    if (request.url === `${base}/job-1/retry`) return reply({ job_id: "job-1", status: "analyzing" });
    if (request.url === `${base}/job-1/cancel`) return reply({ job_id: "job-1", status: "cancelled" });
    response.statusCode = 404;
    reply({ detail: "unexpected route" });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());
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
  for (const name of ["list_advertising_video_models", "create_advertising_video", "get_advertising_video", "retry_advertising_video", "cancel_advertising_video"]) {
    assert.ok(tools.some(t => t.name === name), name);
  }
  assert.equal((await call("list_advertising_video_models")).models[0].label, "H3 Max");
  const created = await call("create_advertising_video", { request_id: "request-123", asset_id: "asset-1" });
  assert.equal((created.job_id, created.status), "analyzing");
  assert.deepEqual(requests.find(r => r.path.endsWith("/advertising-videos") && r.method === "POST").body, { request_id: "request-123", asset_id: "asset-1" });
  const explicit = await call("create_advertising_video", { request_id: "request-456", asset_id: "asset-1", model: "bytedance/seedance-2.0-fast/runninghub-multimodal" });
  assert.equal(explicit.model, "bytedance/seedance-2.0-fast/runninghub-multimodal");
  assert.equal((await call("get_advertising_video", { request_id: "request-123" })).status, "queued");
  const done = await call("get_advertising_video", { job_id: "job-1" });
  assert.equal(done.video_url, "https://media.example/v.mp4");
  assert.equal((await call("retry_advertising_video", { job_id: "job-1" })).status, "analyzing");
  assert.equal((await call("cancel_advertising_video", { job_id: "job-1" })).status, "cancelled");
  const limited = await call("create_advertising_video", { request_id: "limited-request", asset_id: "asset-1" });
  assert.equal((limited.isError, limited.http_status, limited.retry_after_seconds, limited.request_id), "limited-request");
  assert.ok(limited.recovery.includes("get_advertising_video"));
  const before = requests.length;
  assert.equal((await call("get_advertising_video", { job_id: "x", request_id: "y" })).isError, true);
  assert.equal((await call("create_advertising_video", { request_id: "short", asset_id: "asset-1" })).isError, true);
  assert.equal((await call("create_advertising_video", { request_id: "request-789" })).isError, true);
  assert.equal(requests.length, before);
  assert.ok(requests.every(r => r.path.startsWith("/api/v1/ai/agent/advertising-videos")));
});
