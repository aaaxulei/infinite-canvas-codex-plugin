import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import test from "node:test";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const json = async (path) => JSON.parse(await readFile(path, "utf8"));

async function startClient(context, home, client, configPath) {
  const manifest = await json(join(pluginRoot, `.${client}-plugin/plugin.json`));
  const config = client === "codex"
    ? manifest.mcpServers["infinite-canvas"]
    : (await json(join(pluginRoot, ".mcp.json"))).mcpServers["infinite-canvas"];
  const env = { ...process.env, HOME: home, INFINITE_CANVAS_NODE: process.execPath };
  for (const key of ["INFINITE_CANVAS_CONFIG", "INFINITE_CANVAS_TOKEN", "INFINITE_CANVAS_API_URL", "INFINITE_CANVAS_APP_URL"]) {
    delete env[key];
  }
  if (configPath) env.INFINITE_CANVAS_CONFIG = configPath;
  const child = spawn(config.command, config.args.map(arg => arg.replaceAll("${CLAUDE_PLUGIN_ROOT}", pluginRoot)), {
    // Codex supplies plugin cwd. Claude must start from any project directory.
    cwd: client === "codex" ? resolve(pluginRoot, config.cwd) : home,
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const lines = createInterface({ input: child.stdout });
  context.after(() => { lines.close(); child.kill(); });
  let sequence = 0;
  const call = async (method, params = {}) => {
    const reply = once(lines, "line");
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: ++sequence, method, params })}\n`);
    return JSON.parse((await reply)[0]).result;
  };
  const initialized = await call("initialize", {
    protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: client, version: "test" },
  });
  assert.equal(initialized.serverInfo.version, manifest.version);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
  const invoke = async (name, args = {}) => {
    const result = await call("tools/call", { name, arguments: args });
    return { ...JSON.parse(result.content[0].text), isError: result.isError };
  };
  return { call, invoke, child };
}

test("both plugin launchers discover tools, pair independently, reconnect and revoke independently", { timeout: 15000 }, async (context) => {
  const home = await mkdtemp(join(tmpdir(), "canvas client compatibility "));
  context.after(() => rm(home, { recursive: true, force: true }));
  const revoked = new Set();
  const issued = new Set();
  const tokens = { CODEX123: "icx_test_codex", CLAUDE12: "icx_test_claude", PROFILE1: "icx_test_profile" };
  const server = createServer(async (request, response) => {
    const reply = (status, body) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(body));
    };
    if (request.url === "/api/v1/agent/pairing/exchange") {
      assert.equal(request.headers.authorization, undefined);
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const { code } = JSON.parse(Buffer.concat(chunks).toString());
      if (!tokens[code] || issued.has(code)) return reply(400, { detail: "Pairing code already used or invalid" });
      issued.add(code);
      return reply(200, { token: tokens[code], token_info: { name: code } });
    }
    const token = request.headers.authorization?.replace("Bearer ", "");
    if (!Object.values(tokens).includes(token) || revoked.has(token)) {
      return reply(401, { detail: "Token revoked or invalid" });
    }
    if (request.url === "/api/v1/agent/control/sessions") return reply(200, { sessions: [{ id: "canvas-1" }] });
    reply(404, { detail: "not found" });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());
  const apiUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  const codex = await startClient(context, home, "codex");
  const claude = await startClient(context, home, "claude");
  assert.deepEqual((await codex.call("tools/list")).tools, (await claude.call("tools/list")).tools);
  for (const [client, code, filename] of [[codex, "CODEX123", "codex.json"], [claude, "CLAUDE12", "claude-code.json"]]) {
    const result = await client.invoke("pair_infinite_canvas", { pairing_code: code, api_url: apiUrl, app_url: "http://localhost:8899/" });
    assert.equal(result.paired, true);
    assert.ok(!JSON.stringify(result).includes(tokens[code]));
    const path = join(home, ".config/infinite-canvas", filename);
    assert.equal(result.config_path, path);
    assert.equal((await json(path)).token, tokens[code]);
    assert.equal((await stat(path)).mode & 0o777, 0o600);
    assert.deepEqual((await client.invoke("list_canvas_sessions")).sessions, [{ id: "canvas-1" }]);
  }
  assert.equal((await claude.invoke("pair_infinite_canvas", { pairing_code: "CLAUDE12", api_url: apiUrl })).isError, true);
  const restarted = await startClient(context, home, "claude");
  assert.deepEqual((await restarted.invoke("list_canvas_sessions")).sessions, [{ id: "canvas-1" }]);
  revoked.add(tokens.CLAUDE12);
  assert.equal((await restarted.invoke("list_canvas_sessions")).isError, true);
  assert.deepEqual((await codex.invoke("list_canvas_sessions")).sessions, [{ id: "canvas-1" }]);

  const override = join(home, "staging/claude.json");
  const profile = await startClient(context, home, "claude", override);
  const paired = await profile.invoke("pair_infinite_canvas", { pairing_code: "PROFILE1", api_url: apiUrl });
  assert.equal(paired.config_path, override);
  assert.equal((await json(override)).token, tokens.PROFILE1);
  assert.equal((await json(join(home, ".config/infinite-canvas/claude-code.json"))).token, tokens.CLAUDE12);
});
