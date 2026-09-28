// nanohash.biz: static pages from ./public, plus the account API under /api/.
import * as act from './activation.js';
import * as ns from './nanoshare.js';
import * as admin from './admin.js';
import { callback, currentUser, logout, start } from './auth.js';
import * as pay from './stripe.js';
import * as user from './user.js';
import { fail } from './util.js';
import { versions } from './versions.js';

async function route(req, env, url, ctx) {
  const { pathname: path } = url;
  const site = new URL(env.SITE_ORIGIN || url.origin);
  const method = req.method;

  // Stripe calls the webhook server to server (no Origin); it is authenticated by its signature instead.
  if (method === 'POST' && path === '/api/stripe/webhook') return pay.webhook(req, env);
  if (method === 'GET' && path === '/api/prices') return pay.prices();
  if (method === 'GET' && path === '/api/versions') return versions(req, ctx);
  // the desktop apps activate keys here; no browser, no cookie, no Origin
  if (method === 'POST' && path === '/api/activate') return act.activate(req, env);

  // Browsers always send Origin on POST; refusing other origins blocks cross-site form posts.
  const origin = req.headers.get('origin');
  if (method !== 'GET' && method !== 'HEAD' && origin !== site.origin && origin !== url.origin) return fail(403, 'origin');

  if (method === 'GET' && path === '/api/auth/google') return start(req, env, url, site);
  if (method === 'GET' && path === '/api/auth/callback') return callback(req, env, url, site);
  if (method === 'POST' && path === '/api/auth/logout') return logout(req, env, site);
  // NanoShare asks for a pass here; signs in first when needed
  if (method === 'GET' && path === ns.PASS_PATH) return ns.passPage(req, env, url, site);

  const me = await currentUser(req, env);
  if (!me) return fail(401, 'signed_out');

  if (method === 'GET' && path === '/api/me') return user.me(me);
  if (method === 'GET' && path === '/api/licenses') return user.myLicenses(me, env);
  if (method === 'GET' && path === '/api/requests') return user.myRequests(me, env);
  if (method === 'GET' && path === '/api/nanoshare') return ns.status(me, env);
  if (method === 'POST' && path === '/api/requests') return user.createRequest(req, me, env);
  if (method === 'POST' && path === '/api/checkout') return pay.createCheckout(req, me, env, site);
  let a;
  if (method === 'POST' && (a = path.match(/^\/api\/machines\/(\d+)\/remove$/))) return act.removeOwnMachine(env, me, +a[1]);
  let c;
  if (method === 'POST' && (c = path.match(/^\/api\/checkout\/(cs_[A-Za-z0-9_]+)\/confirm$/))) return pay.confirm(me, env, c[1]);

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
  if (method === 'POST' && path === '/api/admin/nanoshare/supporter') return ns.setSupporter(req, env);
  if (method === 'GET' && path === '/api/admin/nanoshare/supporters') return ns.listSupporters(env);
  if (method === 'POST' && (m = path.match(/^\/api\/admin\/licenses\/(\d+)\/revoke$/))) return admin.revoke(env, +m[1]);
  if (method === 'POST' && (m = path.match(/^\/api\/admin\/licenses\/(\d+)\/delete$/))) return admin.removeLicense(env, +m[1]);
  if (method === 'POST' && (m = path.match(/^\/api\/admin\/machines\/(\d+)\/remove$/))) return act.removeMachineAsAdmin(env, +m[1]);
  if (method === 'POST' && (m = path.match(/^\/api\/admin\/requests\/(\d+)\/delete$/))) return admin.removeRequest(env, +m[1]);
  return fail(404, 'not_found');
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      return await route(req, env, url, ctx);
    } catch (e) {
      console.error(e);
      return fail(500, 'server');
    }
  },
};
