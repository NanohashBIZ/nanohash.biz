// nanohash.biz: static pages from ./public, plus the account API under /api/.
import * as admin from './admin.js';
import { callback, currentUser, logout, start } from './auth.js';
import * as user from './user.js';
import { fail } from './util.js';

async function route(req, env, url) {
  const { pathname: path } = url;
  const method = req.method;

  // Browsers always send Origin on POST; refusing other origins blocks cross-site form posts.
  if (method !== 'GET' && method !== 'HEAD' && req.headers.get('origin') !== url.origin) return fail(403, 'origin');

  if (method === 'GET' && path === '/api/auth/google') return start(req, env, url);
  if (method === 'GET' && path === '/api/auth/callback') return callback(req, env, url);
  if (method === 'POST' && path === '/api/auth/logout') return logout(req, env, url);

  const me = await currentUser(req, env);
  if (!me) return fail(401, 'signed_out');

  if (method === 'GET' && path === '/api/me') return user.me(me);
  if (method === 'GET' && path === '/api/licenses') return user.myLicenses(me, env);
  if (method === 'GET' && path === '/api/requests') return user.myRequests(me, env);
  if (method === 'POST' && path === '/api/requests') return user.createRequest(req, me, env);

  if (!path.startsWith('/api/admin/')) return fail(404, 'not_found');
  if (!me.admin) return fail(403, 'not_admin');
  let m;
  if (method === 'GET' && path === '/api/admin/requests') return admin.listRequests(env, url);
  if (method === 'GET' && (m = path.match(/^\/api\/admin\/requests\/(\d+)\/slip$/))) return admin.slip(env, m[1]);
  if (method === 'POST' && (m = path.match(/^\/api\/admin\/requests\/(\d+)\/approve$/))) return admin.approve(req, env, me, +m[1]);
  if (method === 'POST' && (m = path.match(/^\/api\/admin\/requests\/(\d+)\/reject$/))) return admin.reject(req, env, +m[1]);
  if (method === 'GET' && path === '/api/admin/licenses') return admin.listLicenses(env, url);
  if (method === 'POST' && path === '/api/admin/licenses') return admin.create(req, env, me);
  if (method === 'POST' && path === '/api/admin/licenses/import') return admin.importKeys(req, env, me);
  if (method === 'POST' && (m = path.match(/^\/api\/admin\/licenses\/(\d+)\/revoke$/))) return admin.revoke(env, +m[1]);
  return fail(404, 'not_found');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      return await route(req, env, url);
    } catch (e) {
      console.error(e);
      return fail(500, 'server');
    }
  },
};
