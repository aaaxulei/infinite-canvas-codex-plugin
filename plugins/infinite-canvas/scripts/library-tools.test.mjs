import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { callLibraryTool, planPaths, MANIFEST_NAME } from "./library-tools.mjs";

function fakeLibrary(count) {
  const items = Array.from({ length: count }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    original_name: i === 1 ? "same.png" : i === 2 ? "SAME.png" : `model-${i}`,
    mime_type: "image/png", file_size: 3, category_id: i % 2 ? "cat-a" : null, category_name: i % 2 ? "模特" : null,
  }));
  const requests = [];
  const request = async path => {
    requests.push(path);
    const url = new URL(path, "http://x");
    const start = url.searchParams.get("cursor") ? items.findIndex(item => item.id === url.searchParams.get("cursor")) + 1 : 0;
    const page = items.slice(start, start + 2);
    return { total: items.length, items: page, next_cursor: start + 2 < items.length ? page.at(-1).id : null };
  };
  return { items, request, requests };
}

const noSleep = () => new Promise(() => {});

test("export walks every page, writes category folders and a manifest", async () => {
  const dir = join(await mkdtemp(join(tmpdir(), "lib-")), "out");
  const { request, requests } = fakeLibrary(5);
  const downloaded = [];
  const download = async ({ source, output_path }) => {
    downloaded.push(source);
    await writeFile(output_path, "abc", { flag: "wx" });
    return { bytes: 3, sha256: "h" };
  };
  const result = await callLibraryTool("export_library_assets", { output_dir: dir, category_id: "cat-a" }, { request, download, sleep: noSleep });
  assert.equal(result.complete, true);
  assert.equal(result.all_downloaded, true);
  assert.equal(result.downloaded, 5);
  assert.equal(result.listing_matches_server_total, true);
  assert.equal(downloaded.length, 5);
  assert.ok(requests.every(path => path.includes("category_id=cat-a")));
  const manifest = JSON.parse(await readFile(join(dir, MANIFEST_NAME), "utf8"));
  assert.deepEqual(manifest.items.map(item => item.path), [
    "未分类/model-0.png", "模特/same.png", "未分类/SAME.png", "模特/model-3.png", "未分类/model-4.png",
  ]);
  assert.equal(await readFile(join(dir, "模特/same.png"), "utf8"), "abc");
  // Completed exports do not download again.
  await callLibraryTool("export_library_assets", { output_dir: dir, category_id: "cat-a" }, { request, download, sleep: noSleep });
  assert.equal(downloaded.length, 5);
});

test("failed items are retried on the next call, other filters and non-empty dirs are refused", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lib-"));
  const { request } = fakeLibrary(3);
  let fail = true;
  const download = async ({ source, output_path }) => {
    if (fail && source.endsWith("1")) throw new Error("Download HTTP 404");
    await writeFile(output_path, "abc", { flag: "wx" });
    return { bytes: 3, sha256: "h" };
  };
  const first = await callLibraryTool("export_library_assets", { output_dir: dir }, { request, download, sleep: noSleep });
  assert.equal(first.downloaded, 2);
  assert.equal(first.all_downloaded, false);
  assert.equal(first.failures[0].error, "Download HTTP 404");
  fail = false;
  const second = await callLibraryTool("export_library_assets", { output_dir: dir }, { request, download, sleep: noSleep });
  assert.equal(second.all_downloaded, true);
  await assert.rejects(callLibraryTool("export_library_assets", { output_dir: dir, type: "video" }, { request, download, sleep: noSleep }), /different filter/);
  const busy = await mkdtemp(join(tmpdir(), "lib-"));
  await mkdir(join(busy, "x"));
  await assert.rejects(callLibraryTool("export_library_assets", { output_dir: busy }, { request, download, sleep: noSleep }), /must be empty/);
  await assert.rejects(callLibraryTool("export_library_assets", { output_dir: "relative" }, { request, download, sleep: noSleep }), /absolute/);
});

test("slow exports return progress and keep running in the background", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lib-"));
  const { request } = fakeLibrary(2);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const download = async ({ output_path }) => { await gate; await writeFile(output_path, "abc"); return { bytes: 3, sha256: "h" }; };
  const progress = await callLibraryTool("export_library_assets", { output_dir: dir }, { request, download, sleep: () => Promise.resolve() });
  assert.equal(progress.running, true);
  assert.equal(progress.complete, false);
  release();
  const done = await callLibraryTool("export_library_assets", { output_dir: dir }, { request, download, sleep: noSleep });
  assert.equal(done.all_downloaded, true);
});

test("list tools pass filters through", async () => {
  const paths = [];
  const request = async path => { paths.push(path); return {}; };
  await callLibraryTool("list_library_categories", { scope: "personal" }, { request });
  await callLibraryTool("list_library_assets", { category_id: "c", cursor: "k", limit: 10 }, { request });
  assert.deepEqual(paths, ["/assets/agent/library/categories?scope=personal", "/assets/agent/library?scope=public&category_id=c&cursor=k&limit=10"]);
});

test("planPaths strips unsafe characters", () => {
  const [item] = planPaths([{ id: "abcdef12-0000", original_name: "../a/b?.png", category_name: "x/y", mime_type: "image/png" }]);
  assert.equal(item.path, "x_y/_a_b_.png");
});
