// Latest released version of each app, read from GitHub Releases (the same place /download/* points to).
// Cached at the edge for 10 minutes so the site does not hit GitHub's rate limit.
import { json } from './util.js';

const REPOS = { tidyup: 'NanohashBIZ/TidyUP', nanopdf: 'NanohashBIZ/NanoPDF', nanoshare: 'NanohashBIZ/NanoShare' };
const TTL = 600;

async function latest(repo) {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { 'user-agent': 'nanohash.biz', accept: 'application/vnd.github+json' },
  });
  if (!res.ok) return null;
  const r = await res.json();
  const version = String(r.tag_name || '').replace(/^v/i, '');
  return /^\d+(\.\d+){1,3}$/.test(version) ? { version, date: String(r.published_at || '').slice(0, 10) } : null;
}

export async function versions(req, ctx) {
  const cache = caches.default;
  const key = new Request(new URL('/api/versions', req.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;
  const entries = await Promise.all(Object.entries(REPOS).map(async ([app, repo]) => [app, await latest(repo).catch(() => null)]));
  const res = json(Object.fromEntries(entries));
  const ok = entries.every(([, v]) => v);
  res.headers.set('cache-control', `public, max-age=${ok ? TTL : 60}`);
  if (ctx) ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}
