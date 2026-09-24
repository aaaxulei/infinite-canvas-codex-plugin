import { createHash, randomUUID } from 'node:crypto';
import { open, link, unlink, lstat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';

class DownloadError extends Error {}

export const downloadTool = {
  name: 'download_canvas_asset',
  description: 'Download an original owned/public Infinite Canvas asset to an authorized absolute local path using the paired token. Accepts an asset UUID, asset:// reference, or same-deployment /assets/{id}/file URL from a fresh snapshot. No browser session required. Never overwrites files. Returns byte count and SHA-256, not media decoding verification.',
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

export async function downloadAsset(args, current, fetchImpl = fetch) {
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
  const maxBytes = 2 * 1024 ** 3;
  const signal = AbortSignal.timeout(10 * 60 * 1000);
  let response;
  let stage = 'request';
  try {
    let url = new URL(`${current.apiUrl.replace(/\/+$/, '')}/assets/agent/${assetId}/file?download=true`);
    const origin = url.origin;
    for (let hop = 0; ; hop++) {
      response = await fetchImpl(url, {
        redirect: 'manual', signal,
        headers: { 'Accept-Encoding': 'identity', ...(hop === 0 ? { Authorization: `Bearer ${current.token}` } : {}) },
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location || hop >= 4) throw new DownloadError('Invalid or excessive storage redirects.');
      const next = new URL(location, url);
      if (next.username || next.password || (next.protocol !== 'https:' && !(next.protocol === 'http:' && next.origin === origin))) {
        throw new DownloadError('Unsafe storage redirect rejected.');
      }
      url = next;
    }
    if (response.status !== 200) {
      const meanings = { 401: 'Pairing token expired, revoked or invalid', 403: 'Access denied', 404: 'Asset unavailable or inaccessible; confirm the deployment and original asset ID', 410: 'Temporary asset expired', 429: 'Read rate limit reached; retry later' };
      throw new DownloadError(`Download HTTP ${response.status}: ${meanings[response.status] || 'file request failed'}. No replacement was generated.`);
    }
    const type = response.headers.get('content-type') || 'application/octet-stream';
    if (/text\/html|application\/(?:json|problem\+json)/i.test(type)) throw new DownloadError('Expected file bytes, received an HTML/JSON response.');
    const length = response.headers.get('content-length');
    const expected = length === null ? null : Number(length);
    if (expected !== null && (!Number.isSafeInteger(expected) || expected <= 0 || expected > maxBytes)) throw new DownloadError('Invalid file length or file exceeds the 2 GiB limit.');
    if (!response.body) throw new DownloadError('Empty file response.');
    stage = 'stream';
    let bytes = 0;
    const hash = createHash('sha256');
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > maxBytes) throw new DownloadError('File exceeds the 2 GiB limit.');
      hash.update(chunk);
      let offset = 0;
      while (offset < chunk.length) {
        const { bytesWritten } = await handle.write(chunk, offset, chunk.length - offset);
        if (!bytesWritten) throw new DownloadError('Local file write failed.');
        offset += bytesWritten;
      }
    }
    if (!bytes || (expected !== null && bytes !== expected)) throw new DownloadError('Incomplete file download.');
    await handle.sync();
    await handle.close();
    stage = 'publish';
    // Atomic no-clobber publication, including destinations created during download.
    await link(partial, output);
    return { asset_id: assetId, output_path: output, bytes, sha256: hash.digest('hex'), content_type: type, media_decode_verified: false };
  } catch (error) {
    // Network errors may embed signed storage URLs; never return their raw messages.
    if (error.code === 'EEXIST') throw new DownloadError('Destination already exists; choose a new output_path.');
    if (error instanceof TypeError || signal.aborted) throw new DownloadError(`Download failed during ${stage}; network interruption or timeout. Retry the same source. No replacement was generated.`);
    if (error instanceof DownloadError) throw error;
    throw new DownloadError(`Download failed during ${stage}; retry the same source after checking connectivity and destination access. No replacement was generated.`);
  } finally {
    await response?.body?.cancel().catch(() => {});
    await handle.close().catch(() => {});
    await unlink(partial).catch(() => {});
  }
}
