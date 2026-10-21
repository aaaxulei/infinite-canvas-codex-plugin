import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { downloadAsset, resolveAssetId, resetDeadHosts } from './asset-download.mjs';

const id = '11111111-1111-1111-1111-111111111111';
const current = { apiUrl: 'https://canvas.example/api/v1', appUrl: 'https://canvas.example/', token: 'icx_pat_secret' };
const linksUrl = `${current.apiUrl}/assets/agent/${id}/download-links`;
const fileUrl = `${current.apiUrl}/assets/agent/${id}/file?download=true`;
const cdn = 'https://cdn.example/original?secret=cdn-signature';
const origin = 'https://origin.example/original?secret=origin-signature';
const fast = { sleep: async () => {}, idleTimeoutMs: 200 };
const payload = 'original-video-bytes';
const sha = createHash('sha256').update(payload).digest('hex');

async function destination(t) {
  resetDeadHosts();
  const dir = await mkdtemp(join(tmpdir(), 'ic-download-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return { dir, output_path: join(dir, 'original.mp4'), source: id };
}

function links(candidates) {
  return new Response(JSON.stringify({ asset_id: id, candidates, expires_in: 3600 }), { headers: { 'content-type': 'application/json' } });
}

function file(body = payload, extra = {}) {
  return new Response(body, { headers: { 'content-type': 'video/mp4', 'content-length': String(body.length), etag: '"v1"', ...extra } });
}

/** Honour a Range request against the full payload like S3 does. */
function ranged(options, body = payload, etag = '"v1"') {
  const range = /^bytes=(\d+)-$/.exec(options.headers.Range || '');
  if (!range) return file(body, { etag });
  const start = Number(range[1]);
  return new Response(body.slice(start), { status: 206, headers: {
    'content-type': 'video/mp4', 'content-length': String(body.length - start),
    'content-range': `bytes ${start}-${body.length - 1}/${body.length}`, etag } });
}

function networkError(code) {
  return new TypeError('fetch failed: secret=signature', { cause: Object.assign(new Error('private secret=signature'), { code }) });
}

/** A body that delivers `head`, then breaks like a dropped connection. */
function broken(head, error = networkError('ECONNRESET')) {
  return new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode(head)); },
    pull(controller) { controller.error(error); },
  });
}

/** A body that delivers `head`, then stalls until the request signal aborts. */
function stalled(head, signal) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(head));
      signal.addEventListener('abort', () => controller.error(new TypeError('terminated')), { once: true });
    },
  });
}

/** Records every call and routes by URL prefix; handlers may read the call count. */
function server(routes) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const key = Object.keys(routes).find(prefix => String(url).startsWith(prefix));
    calls.push({ url: String(url), options, host: new URL(url).hostname });
    if (!key) throw new Error(`unexpected ${String(url)}`);
    return routes[key](options, calls.filter(c => c.url.startsWith(key)).length, calls.length);
  };
  return { calls, fetchImpl };
}

test('resolves only exact assets from the paired environment', () => {
  for (const source of [id, `asset://${id}`, `/api/v1/assets/${id}/file`, fileUrl]) assert.equal(resolveAssetId(source, current), id);
  for (const source of [`https://other.example/api/v1/assets/${id}/file`, '/storage/result.mp4', 'not-an-id', `${current.apiUrl}/assets/${id}/thumbnail`]) assert.throws(() => resolveAssetId(source, current));
});

test('falls back to the authorised file route on backends without download links', async (t) => {
  const args = await destination(t);
  const { calls, fetchImpl } = server({
    [linksUrl]: () => new Response('{"detail":"Not Found"}', { status: 404 }),
    [fileUrl]: () => new Response(null, { status: 307, headers: { location: 'https://storage.example/original?secret=signature' } }),
    'https://storage.example/': () => file(),
  });
  const result = await downloadAsset(args, current, fetchImpl, fast);
  assert.deepEqual(calls.map(c => c.url.split('?')[0]), [linksUrl, fileUrl.split('?')[0], 'https://storage.example/original']);
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${current.token}`);
  assert.equal(calls[1].options.headers.Authorization, `Bearer ${current.token}`);
  assert.equal(calls[2].options.headers.Authorization, undefined);
  assert.equal(result.bytes, payload.length);
  assert.equal(result.sha256, sha);
  assert.equal(result.source, 'api');
  assert.equal(result.attempts, 1);
  assert.equal(result.resumed, false);
  assert.equal(result.media_decode_verified, false);
  assert.equal(await readFile(args.output_path, 'utf8'), payload);
  assert.deepEqual(await readdir(args.dir), ['original.mp4']);
  assert.ok(!JSON.stringify(result).includes('signature'));
});

test('downloads from the first server-signed candidate without forwarding the token', async (t) => {
  const args = await destination(t);
  const { calls, fetchImpl } = server({
    [linksUrl]: () => links([{ source: 'cdn', url: cdn }, { source: 'origin', url: origin }]),
    'https://cdn.example/': () => file(),
  });
  const result = await downloadAsset(args, current, fetchImpl, fast);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.headers.Authorization, undefined);
  assert.equal(calls[1].options.headers.Range, undefined);
  assert.equal(result.source, 'cdn');
  assert.equal(result.sha256, sha);
});

test('switches to the next candidate when a host cannot be reached and remembers it', async (t) => {
  const args = await destination(t);
  const { calls, fetchImpl } = server({
    [linksUrl]: () => links([{ source: 'cdn', url: cdn }, { source: 'origin', url: origin }]),
    'https://cdn.example/': () => { throw networkError('ETIMEDOUT'); },
    'https://origin.example/': () => file(),
  });
  const result = await downloadAsset(args, current, fetchImpl, fast);
  assert.deepEqual(calls.map(c => c.host), ['canvas.example', 'cdn.example', 'origin.example']);
  assert.equal(result.source, 'origin');
  assert.equal(result.attempts, 2);
  // The unreachable CDN is tried last for a while within this process.
  const second = await downloadAsset({ ...args, output_path: join(args.dir, 'second.mp4') }, current, fetchImpl, fast);
  assert.equal(second.source, 'origin');
  assert.deepEqual(calls.slice(3).map(c => c.host), ['canvas.example', 'origin.example']);
});

test('resumes an interrupted stream with Range and If-Range on the same candidate', async (t) => {
  const args = await destination(t);
  const { calls, fetchImpl } = server({
    [linksUrl]: () => links([{ source: 'origin', url: origin }]),
    'https://origin.example/': (options, n) => {
      if (n === 1) return new Response(broken(payload.slice(0, 7)),
        { headers: { 'content-type': 'video/mp4', 'content-length': String(payload.length), etag: '"v1"' } });
      return ranged(options);
    },
  });
  const result = await downloadAsset(args, current, fetchImpl, fast);
  assert.equal(calls[2].options.headers.Range, 'bytes=7-');
  assert.equal(calls[2].options.headers['If-Range'], '"v1"');
  assert.equal(result.resumed, true);
  assert.equal(result.attempts, 2);
  assert.equal(result.bytes, payload.length);
  assert.equal(result.sha256, sha);
  assert.equal(await readFile(args.output_path, 'utf8'), payload);
});

test('resumes after a stalled stream hits the idle timeout', async (t) => {
  const args = await destination(t);
  const { calls, fetchImpl } = server({
    [linksUrl]: () => links([{ source: 'origin', url: origin }]),
    'https://origin.example/': (options, n) => n === 1
      ? new Response(stalled(payload.slice(0, 4), options.signal), { headers: { 'content-type': 'video/mp4', 'content-length': String(payload.length) } })
      : ranged(options),
  });
  const result = await downloadAsset(args, current, fetchImpl, { ...fast, idleTimeoutMs: 30 });
  assert.equal(calls[2].options.headers.Range, 'bytes=4-');
  assert.equal(result.sha256, sha);
  assert.equal(result.resumed, true);
});

test('restarts from zero when a link ignores Range or the object changed', async (t) => {
  for (const respond of [
    options => file(),
    options => ranged(options, payload, '"v2"'),
  ]) {
    const args = await destination(t);
    const { fetchImpl } = server({
      [linksUrl]: () => links([{ source: 'origin', url: origin }]),
      'https://origin.example/': (options, n) => {
        if (n === 1) return new Response(broken('stale'),
          { headers: { 'content-type': 'video/mp4', 'content-length': String(payload.length), etag: '"v1"' } });
        if (n === 2) return respond(options);
        return ranged(options);
      },
    });
    const result = await downloadAsset(args, current, fetchImpl, fast);
    assert.equal(result.sha256, sha);
    assert.equal(await readFile(args.output_path, 'utf8'), payload);
  }
});

test('a refused signed link is skipped and the file route still serves the bytes', async (t) => {
  const args = await destination(t);
  const { calls, fetchImpl } = server({
    [linksUrl]: () => links([{ source: 'cdn', url: cdn }, { source: 'origin', url: origin }]),
    'https://cdn.example/': () => new Response('<Error>AccessDenied</Error>', { status: 403 }),
    'https://origin.example/': () => new Response('', { status: 503 }),
    [fileUrl]: () => file(),
  });
  const result = await downloadAsset(args, current, fetchImpl, fast);
  assert.deepEqual(calls.map(c => c.host), ['canvas.example', 'cdn.example', 'origin.example', 'canvas.example']);
  assert.equal(result.source, 'api');
  assert.equal(result.sha256, sha);
});

test('ignores unsafe candidates from the server', async (t) => {
  const args = await destination(t);
  const { calls, fetchImpl } = server({
    [linksUrl]: () => links([{ source: 'cdn', url: 'http://cdn.example/plain' }, { source: 'x', url: 'https://user:pw@origin.example/o' }, 'junk']),
    [fileUrl]: () => file(),
  });
  const result = await downloadAsset(args, current, fetchImpl, fast);
  assert.deepEqual(calls.map(c => c.host), ['canvas.example', 'canvas.example']);
  assert.equal(result.source, 'api');
});

test('gives up after the attempt budget with a summary that names no URLs', async (t) => {
  const args = await destination(t);
  const { calls, fetchImpl } = server({
    [linksUrl]: () => links([{ source: 'origin', url: origin }]),
    'https://origin.example/': () => new Response(broken('x'), { headers: { 'content-type': 'video/mp4', 'content-length': '100' } }),
  });
  await assert.rejects(downloadAsset(args, current, fetchImpl, { ...fast, maxAttempts: 3 }), error => {
    assert.match(error.message, /after 3 attempts/);
    assert.match(error.message, /ECONNRESET during stream, host: origin\.example/);
    assert.doesNotMatch(error.message, /signature|icx_pat_secret|\?/);
    return true;
  });
  assert.equal(calls.length, 4);
  assert.deepEqual(await readdir(args.dir), []);
});

test('HTTP failures, invalid bytes and unsafe redirects leave no output', async (t) => {
  const args = await destination(t);
  const noLinks = () => new Response('{"detail":"Not Found"}', { status: 404 });
  const cases = [
    ...[401, 403, 404, 410, 429].map(status => () => new Response('private error body', { status })),
    () => new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } }),
    () => new Response('', { headers: { 'content-length': '2147483649' } }),
    () => new Response(null, { status: 307, headers: { location: 'http://storage.example/insecure' } }),
    () => new Response(null, { status: 307, headers: { location: 'https://storage.example/loop' } }),
  ];
  for (const respond of cases) {
    const { fetchImpl } = server({ [linksUrl]: noLinks, [fileUrl]: respond, 'https://storage.example/': respond });
    await assert.rejects(downloadAsset(args, current, fetchImpl, { ...fast, maxAttempts: 2 }), error => !error.message.includes('signature') && !error.message.includes('private error body'));
    assert.deepEqual(await readdir(args.dir), []);
  }
  for (const status of [401, 410, 429]) {
    const { calls, fetchImpl } = server({ [linksUrl]: () => new Response('private error body', { status }) });
    await assert.rejects(downloadAsset(args, current, fetchImpl, fast), new RegExp(`HTTP ${status}`));
    assert.equal(calls.length, 1);
    assert.deepEqual(await readdir(args.dir), []);
  }
});

test('never overwrites a destination, including one created during streaming', async (t) => {
  const args = await destination(t);
  await writeFile(args.output_path, 'keep');
  await assert.rejects(downloadAsset(args, current, async () => { throw new Error('must not fetch'); }, fast), /already exists/);
  assert.equal(await readFile(args.output_path, 'utf8'), 'keep');
  await rm(args.output_path);
  const { fetchImpl } = server({
    [linksUrl]: () => links([]),
    [fileUrl]: async () => { await writeFile(args.output_path, 'raced'); return file('video'); },
  });
  await assert.rejects(downloadAsset(args, current, fetchImpl, fast), /already exists/);
  assert.equal(await readFile(args.output_path, 'utf8'), 'raced');
  assert.deepEqual(await readdir(args.dir), ['original.mp4']);
});

test('reports nested network codes and hostname without leaking signed URLs or tokens', async (t) => {
  const args = await destination(t);
  const { fetchImpl } = server({
    [linksUrl]: () => new Response('{"detail":"Not Found"}', { status: 404 }),
    [fileUrl]: () => new Response(null, { status: 307, headers: { location: 'https://storage.example/private-key?secret=signature' } }),
    'https://storage.example/': () => {
      const cause = new AggregateError([Object.assign(new Error('private-key secret=signature icx_pat_secret'), { code: 'ETIMEDOUT' })]);
      throw new TypeError('fetch failed: secret=signature', { cause });
    },
  });
  await assert.rejects(downloadAsset(args, current, fetchImpl, fast), error => {
    assert.match(error.message, /api@storage\.example:ETIMEDOUT/);
    assert.doesNotMatch(error.message, /signature|private-key|icx_pat_secret/);
    return true;
  });
  assert.deepEqual(await readdir(args.dir), []);
});

test('rejects unpaired calls and invalid destinations without fetching', async (t) => {
  const args = await destination(t);
  const noFetch = async () => { throw new Error('must not fetch'); };
  await assert.rejects(downloadAsset(args, { ...current, token: '' }, noFetch), /not paired/);
  await assert.rejects(downloadAsset({ ...args, output_path: 'relative.mp4' }, current, noFetch), /absolute/);
  assert.deepEqual(await readdir(args.dir), []);
});
