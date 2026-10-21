import { createHash, randomUUID } from 'node:crypto';
import { open, link, unlink, lstat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';

class DownloadError extends Error {}

const MAX_BYTES = 2 * 1024 ** 3;
const DEFAULTS = {
  maxAttempts: 6,
  deadlineMs: 20 * 60 * 1000,
  idleTimeoutMs: 30 * 1000,
  switchDelayMs: 500,
  retryDelayMs: 1000,
  maxRetryDelayMs: 10 * 1000,
};
// Hosts that refused a connection recently are tried last within this process,
// so a blocked CDN or origin costs one connect timeout, not one per download.
const DEAD_HOST_TTL_MS = 10 * 60 * 1000;
const deadHosts = new Map();

function safeNetworkCode(error, depth = 0) {
  if (!error || depth > 4) return null;
  const allowed = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ECONNREFUSED',
    'ECONNRESET', 'ENETUNREACH', 'EHOSTUNREACH', 'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'UND_ERR_SOCKET',
    'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'DEPTH_ZERO_SELF_SIGNED_CERT']);
  if (allowed.has(error.code)) return error.code;
  for (const cause of [error.cause, ...(Array.isArray(error.errors) ? error.errors : [])]) {
    const code = safeNetworkCode(cause, depth + 1);
    if (code) return code;
  }
  return null;
}

export const downloadTool = {
  name: 'download_canvas_asset',
  description: 'Download an original owned/public Infinite Canvas asset to an authorized absolute local path using the paired token. Accepts an asset UUID, asset:// reference, or same-deployment /assets/{id}/file URL from a fresh snapshot. No browser session required. Tries server-signed CDN and origin links, resumes interrupted transfers with Range and retries a bounded number of times. Never overwrites files. Returns byte count and SHA-256, not media decoding verification.',
  inputSchema: {
    type: 'object',
    properties: {
      source: { type: 'string', description: 'Exact asset ID/reference/file URL from the requested result; external provider/CDN URLs are not supported.' },
      output_path: { type: 'string', description: 'Authorized absolute destination file path; parent directory must exist.' },
    },
    required: ['source', 'output_path'], additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
};

export function resolveAssetId(source, { apiUrl, appUrl }) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof source !== 'string') throw new DownloadError('An asset source is required.');
  if (uuid.test(source)) return source;
  if (source.startsWith('asset://') && uuid.test(source.slice(8))) return source.slice(8);
  const base = new URL(apiUrl);
  const url = new URL(source, appUrl);
  const origins = new Set([base.origin, new URL(appUrl).origin]);
  const prefix = base.pathname.replace(/\/+$/, '') + '/assets/';
  if (origins.has(url.origin) && !url.username && !url.password && url.pathname.startsWith(prefix)) {
    const parts = url.pathname.slice(prefix.length).split('/');
    if (parts[0] === 'agent') parts.shift();
    if (parts.length === 2 && uuid.test(parts[0]) && parts[1] === 'file') return parts[0];
  }
  throw new DownloadError('Unsupported source. Use the exact asset ID, asset:// reference or same-deployment asset file URL. Do not substitute or regenerate the result.');
}

const STATUS_MEANINGS = {
  401: 'Pairing token expired, revoked or invalid',
  403: 'Access denied',
  404: 'Asset unavailable or inaccessible; confirm the deployment and original asset ID',
  410: 'Temporary asset expired',
  429: 'Read rate limit reached; retry later',
};

function terminalStatusError(status) {
  return new DownloadError(`Download HTTP ${status}: ${STATUS_MEANINGS[status] || 'file request failed'}. No replacement was generated.`);
}

function safeStorageUrl(value, apiOrigin) {
  const url = new URL(value);
  if (url.username || url.password) throw new DownloadError('Unsafe storage link rejected.');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.origin === apiOrigin)) {
    throw new DownloadError('Unsafe storage link rejected.');
  }
  return url;
}

/** Server-signed candidates, fastest first; absent on backends that predate them. */
async function loadCandidates(fetchImpl, current, assetId, apiBase, signal) {
  const apiOrigin = new URL(apiBase).origin;
  let response;
  try {
    response = await fetchImpl(new URL(`${apiBase}/assets/agent/${assetId}/download-links`), {
      signal, redirect: 'manual',
      headers: { Accept: 'application/json', Authorization: `Bearer ${current.token}` },
    });
  } catch {
    return [];
  }
  try {
    if ([401, 410, 429].includes(response.status)) throw terminalStatusError(response.status);
    if (response.status !== 200) return [];
    const body = await response.json().catch(() => null);
    if (!body || !Array.isArray(body.candidates)) return [];
    const candidates = [];
    for (const item of body.candidates) {
      if (!item || typeof item.url !== 'string' || typeof item.source !== 'string') continue;
      try {
        candidates.push({ source: item.source.slice(0, 32), url: safeStorageUrl(item.url, apiOrigin), auth: false });
      } catch { /* skip an unsafe link; the API file route remains */ }
    }
    return candidates;
  } finally {
    await response.body?.cancel().catch(() => {});
  }
}

function parseContentRange(header) {
  const match = /^bytes (\d+)-(\d+)\/(\d+|\*)$/.exec(header || '');
  if (!match) return null;
  return { start: Number(match[1]), end: Number(match[2]), total: match[3] === '*' ? null : Number(match[3]) };
}

function isHostDead(hostname, now) {
  const until = deadHosts.get(hostname);
  if (until === undefined) return false;
  if (until > now) return true;
  deadHosts.delete(hostname);
  return false;
}

export function resetDeadHosts() { deadHosts.clear(); }

export async function downloadAsset(args, current, fetchImpl = fetch, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const sleep = opts.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  if (!current.token) throw new DownloadError('Infinite Canvas is not paired. Pair with the intended deployment first.');
  const assetId = resolveAssetId(args.source, current);
  const output = args.output_path;
  if (typeof output !== 'string' || !isAbsolute(output)) throw new DownloadError('output_path must be an absolute authorized local file path.');
  // Fail before requesting private bytes if the destination already exists.
  try {
    await lstat(output);
    throw new DownloadError('Destination already exists; choose a new output_path.');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const partial = `${output}.${randomUUID()}.part`;
  const handle = await open(partial, 'wx', 0o600);
  const apiBase = current.apiUrl.replace(/\/+$/, '');
  const apiOrigin = new URL(apiBase).origin;
  const deadline = Date.now() + opts.deadlineMs;
  const overall = new AbortController();
  const deadlineTimer = setTimeout(() => overall.abort(), opts.deadlineMs);

  const candidates = [];
  const attempts = [];
  const dead = new Set();
  let bytes = 0;
  let expected = null;
  let etag = null;
  let contentType = 'application/octet-stream';
  let hash = createHash('sha256');
  let resumed = false;
  let index = 0;
  let sameCandidateRetries = 0;
  let response;
  let stage = 'request';
  let host;

  const restart = async () => {
    bytes = 0;
    expected = null;
    etag = null;
    hash = createHash('sha256');
    await handle.truncate(0);
  };

  const pickCandidate = () => {
    const now = Date.now();
    const order = [...Array(candidates.length).keys()].map(i => (index + i) % candidates.length);
    const live = order.filter(i => !dead.has(i));
    if (!live.length) return -1;
    return live.find(i => candidates[i].auth || !isHostDead(candidates[i].url.hostname, now)) ?? live[0];
  };

  const fetchCandidate = async (candidate, signal) => {
    let url = candidate.url;
    for (let hop = 0; ; hop++) {
      host = url.hostname;
      const headers = { 'Accept-Encoding': 'identity' };
      if (candidate.auth && hop === 0) headers.Authorization = `Bearer ${current.token}`;
      if (bytes > 0) {
        headers.Range = `bytes=${bytes}-`;
        if (etag) headers['If-Range'] = etag;
      }
      const res = await fetchImpl(url, { redirect: 'manual', signal, headers });
      if (![301, 302, 303, 307, 308].includes(res.status)) return res;
      const location = res.headers.get('location');
      await res.body?.cancel();
      if (!location || hop >= 4) throw new DownloadError('Invalid or excessive storage redirects.');
      try {
        url = safeStorageUrl(new URL(location, url).href, apiOrigin);
      } catch {
        throw new DownloadError('Unsafe storage redirect rejected.');
      }
    }
  };

  try {
    candidates.push(...await loadCandidates(fetchImpl, current, assetId, apiBase, overall.signal));
    // The API file route stays last: it re-signs on every attempt and serves local files.
    candidates.push({ source: 'api', url: new URL(`${apiBase}/assets/agent/${assetId}/file?download=true`), auth: true });
    for (let attempt = 1; ; attempt++) {
      const chosen = pickCandidate();
      if (chosen < 0) throw new DownloadError(`Download failed: no usable link left after ${attempts.length} attempt(s) (${describe(attempts)}); check DNS and IPv4/IPv6 connectivity in the plugin process, then retry the same source. No replacement was generated.`);
      const candidate = candidates[chosen];
      const switching = chosen !== index;
      index = chosen;
      const record = { source: candidate.source, host: candidate.url.hostname, stage: 'request' };
      attempts.push(record);
      stage = 'request';
      host = candidate.url.hostname;
      response = undefined;
      const attemptController = new AbortController();
      let idleTimer;
      const armIdle = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => attemptController.abort(new Error('idle')), opts.idleTimeoutMs);
      };
      const onOverallAbort = () => attemptController.abort(new Error('deadline'));
      overall.signal.addEventListener('abort', onOverallAbort, { once: true });
      let outcome = 'retry';
      try {
        armIdle();
        response = await fetchCandidate(candidate, attemptController.signal);
        record.status = response.status;
        if (response.status === 401 || response.status === 410 || response.status === 429 || (candidate.auth && response.status === 404)) {
          throw terminalStatusError(response.status);
        }
        if (candidate.auth && response.status === 403) throw terminalStatusError(403);
        if ([403, 404].includes(response.status)) {
          // A signed link this host refuses will keep refusing; try the next one.
          dead.add(chosen);
          outcome = 'switch';
          continue;
        }
        if (response.status === 416 || (response.status === 200 && bytes > 0)) {
          // The link ignored or refused our offset; start this transfer over.
          await restart();
          if (response.status === 416) { outcome = 'retry'; continue; }
        } else if (response.status === 206) {
          const range = parseContentRange(response.headers.get('content-range'));
          if (!range || range.start !== bytes) { await restart(); outcome = 'retry'; continue; }
          if (range.total !== null) {
            if (expected !== null && expected !== range.total) { await restart(); outcome = 'retry'; continue; }
            expected = range.total;
          }
          const resumedTag = response.headers.get('etag');
          if (etag && resumedTag && resumedTag !== etag) { await restart(); outcome = 'retry'; continue; }
          if (bytes > 0) resumed = true;
        } else if (response.status !== 200) {
          if (response.status >= 500) { outcome = 'switch'; continue; }
          throw terminalStatusError(response.status);
        }
        const type = response.headers.get('content-type') || 'application/octet-stream';
        if (/text\/html|application\/(?:json|problem\+json)/i.test(type)) throw new DownloadError('Expected file bytes, received an HTML/JSON response.');
        if (response.status === 200) {
          contentType = type;
          etag = response.headers.get('etag');
          const length = response.headers.get('content-length');
          expected = length === null ? null : Number(length);
          if (expected !== null && (!Number.isSafeInteger(expected) || expected <= 0 || expected > MAX_BYTES)) throw new DownloadError('Invalid file length or file exceeds the 2 GiB limit.');
        } else if (expected !== null && expected > MAX_BYTES) {
          throw new DownloadError('Invalid file length or file exceeds the 2 GiB limit.');
        }
        if (!response.body) throw new DownloadError('Empty file response.');
        stage = 'stream';
        record.stage = 'stream';
        for await (const chunk of response.body) {
          armIdle();
          if (bytes + chunk.length > MAX_BYTES) throw new DownloadError('File exceeds the 2 GiB limit.');
          hash.update(chunk);
          let offset = 0;
          while (offset < chunk.length) {
            const { bytesWritten } = await handle.write(chunk, offset, chunk.length - offset, bytes);
            if (!bytesWritten) throw new DownloadError('Local file write failed.');
            offset += bytesWritten;
            bytes += bytesWritten;
          }
        }
        record.bytes = bytes;
        if (!bytes || (expected !== null && bytes !== expected)) {
          // Truncated without an error: resume from what arrived.
          record.error = 'INCOMPLETE';
          outcome = 'retry';
          continue;
        }
        outcome = 'done';
        break;
      } catch (error) {
        record.bytes = bytes;
        record.host = host;
        outcome = 'fatal';
        if (error instanceof DownloadError || error.code === 'EEXIST') throw error;
        const deadlineHit = overall.signal.aborted;
        const idle = attemptController.signal.aborted && !deadlineHit;
        const network = error instanceof TypeError || attemptController.signal.aborted;
        if (!network) throw error;
        record.error = deadlineHit ? 'TIMEOUT' : idle ? 'IDLE_TIMEOUT' : safeNetworkCode(error) || 'NETWORK_ERROR';
        if (deadlineHit) {
          throw new DownloadError(`Download failed: time limit reached after ${attempt} attempt(s) (${describe(attempts)}); check DNS and IPv4/IPv6 connectivity in the plugin process, then retry the same source. No replacement was generated.`);
        }
        if (stage === 'request') {
          // Never connected: this link is unusable on this network for a while.
          dead.add(chosen);
          if (!candidate.auth) deadHosts.set(candidate.url.hostname, Date.now() + DEAD_HOST_TTL_MS);
          outcome = 'switch';
        } else {
          outcome = 'retry';
        }
      } finally {
        clearTimeout(idleTimer);
        overall.signal.removeEventListener('abort', onOverallAbort);
        if (outcome !== 'done') await response?.body?.cancel().catch(() => {});
        if (outcome === 'retry' || outcome === 'switch') {
          if (attempt >= opts.maxAttempts) {
            const last = attempts[attempts.length - 1];
            throw new DownloadError(`Download failed after ${attempt} attempts (last: ${last.error || `HTTP ${last.status}`} during ${last.stage}, host: ${last.host}; ${describe(attempts)}); check DNS and IPv4/IPv6 connectivity in the plugin process, then retry the same source. No replacement was generated.`);
          }
          if (outcome === 'switch') {
            index = (chosen + 1) % candidates.length;
            sameCandidateRetries = 0;
          } else {
            sameCandidateRetries = switching ? 1 : sameCandidateRetries + 1;
          }
          const delay = outcome === 'switch' ? opts.switchDelayMs
            : Math.min(opts.retryDelayMs * 2 ** Math.max(0, sameCandidateRetries - 1), opts.maxRetryDelayMs);
          if (Date.now() + delay > deadline) {
            throw new DownloadError(`Download failed: time limit reached after ${attempt} attempt(s) (${describe(attempts)}); retry the same source later. No replacement was generated.`);
          }
          await sleep(delay);
        }
      }
    }
    await handle.sync();
    await handle.close();
    stage = 'publish';
    // Atomic no-clobber publication, including destinations created during download.
    await link(partial, output);
    return {
      asset_id: assetId, output_path: output, bytes, sha256: hash.digest('hex'), content_type: contentType,
      media_decode_verified: false, source: candidates[index].source, attempts: attempts.length, resumed,
    };
  } catch (error) {
    // Network errors may embed signed storage URLs; never return their raw messages.
    if (error.code === 'EEXIST') throw new DownloadError('Destination already exists; choose a new output_path.');
    if (error instanceof DownloadError) throw error;
    if (error instanceof TypeError || overall.signal.aborted) {
      const code = overall.signal.aborted ? 'TIMEOUT' : safeNetworkCode(error) || 'NETWORK_ERROR';
      throw new DownloadError(`Download failed during ${stage} (${code}, host: ${host}); check DNS and IPv4/IPv6 connectivity in the plugin process, then retry the same source. No replacement was generated.`);
    }
    throw new DownloadError(`Download failed during ${stage}; retry the same source after checking connectivity and destination access. No replacement was generated.`);
  } finally {
    clearTimeout(deadlineTimer);
    await response?.body?.cancel().catch(() => {});
    await handle.close().catch(() => {});
    await unlink(partial).catch(() => {});
  }
}

/** Attempt summary for error messages: sources, hosts and outcomes only, never URLs. */
function describe(attempts) {
  return attempts.map(a => `${a.source}@${a.host}:${a.error || (a.status ? `HTTP ${a.status}` : 'ok')}${a.bytes ? `/${a.bytes}B` : ''}`).join(', ');
}
