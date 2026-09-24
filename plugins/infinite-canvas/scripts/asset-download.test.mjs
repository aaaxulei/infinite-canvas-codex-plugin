import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { downloadAsset, resolveAssetId } from './asset-download.mjs';

const id = '11111111-1111-1111-1111-111111111111';
const current = { apiUrl: 'https://canvas.example/api/v1', appUrl: 'https://canvas.example/', token: 'icx_pat_secret' };
async function destination(t) {
  const dir = await mkdtemp(join(tmpdir(), 'ic-download-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return { dir, output_path: join(dir, 'original.mp4'), source: id };
}

test('resolves only exact assets from the paired environment', () => {
  for (const source of [id, `asset://${id}`, `/api/v1/assets/${id}/file`, `${current.apiUrl}/assets/agent/${id}/file?download=true`]) assert.equal(resolveAssetId(source, current), id);
  for (const source of [`https://other.example/api/v1/assets/${id}/file`, '/storage/result.mp4', 'not-an-id', `${current.apiUrl}/assets/${id}/thumbnail`]) assert.throws(() => resolveAssetId(source, current));
});

test('streams original bytes, hashes and publishes without disclosing signed URLs', async (t) => {
  const args = await destination(t);
  const calls = [];
  const result = await downloadAsset(args, current, async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return new Response(null, { status: 307, headers: { location: 'https://storage.example/original?secret=signature' } });
    return new Response('original-video', { headers: { 'content-type': 'video/mp4', 'content-length': '14' } });
  });
  assert.equal(calls[0].url, `${current.apiUrl}/assets/agent/${id}/file?download=true`);
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${current.token}`);
  assert.equal(calls[1].options.headers.Authorization, undefined);
  assert.equal(result.bytes, 14);
  assert.equal(result.sha256, createHash('sha256').update('original-video').digest('hex'));
  assert.equal(result.media_decode_verified, false);
  assert.equal(await readFile(args.output_path, 'utf8'), 'original-video');
  assert.deepEqual(await readdir(args.dir), ['original.mp4']);
  assert.ok(!JSON.stringify(result).includes('signature'));
});

test('HTTP failures, invalid bytes, interrupted streams and unsafe redirects leave no output', async (t) => {
  const args = await destination(t);
  const cases = [
    ...[401,403,404,410,429].map(status => async () => new Response('private error body', { status })),
    async () => new Response('short', { headers: { 'content-length': '100' } }),
    async () => new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } }),
    async () => new Response('', { headers: { 'content-length': '2147483649' } }),
    async () => new Response(null, { status: 307, headers: { location: 'http://storage.example/insecure' } }),
    async () => new Response(null, { status: 307, headers: { location: 'https://storage.example/loop' } }),
    async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1])); controller.error(new Error('https://storage.example/?secret=signature')); } })),
  ];
  for (const fetchImpl of cases) {
    await assert.rejects(downloadAsset(args, current, fetchImpl), error => !error.message.includes('signature') && !error.message.includes('private error body'));
    assert.deepEqual(await readdir(args.dir), []);
  }
});

test('never overwrites a destination, including one created during streaming', async (t) => {
  const args = await destination(t);
  await writeFile(args.output_path, 'keep');
  await assert.rejects(downloadAsset(args, current, async () => { throw new Error('must not fetch'); }), /already exists/);
  assert.equal(await readFile(args.output_path, 'utf8'), 'keep');
  await rm(args.output_path);
  await assert.rejects(downloadAsset(args, current, async () => {
    await writeFile(args.output_path, 'raced');
    return new Response('video');
  }), /already exists/);
  assert.equal(await readFile(args.output_path, 'utf8'), 'raced');
  assert.deepEqual(await readdir(args.dir), ['original.mp4']);
});

test('rejects unpaired calls and invalid destinations without fetching', async (t) => {
  const args = await destination(t);
  const noFetch = async () => { throw new Error('must not fetch'); };
  await assert.rejects(downloadAsset(args, { ...current, token: '' }, noFetch), /not paired/);
  await assert.rejects(downloadAsset({ ...args, output_path: 'relative.mp4' }, current, noFetch), /absolute/);
  assert.deepEqual(await readdir(args.dir), []);
});
