// Static checks for the NanoHash pages. Run from the website folder: node tests/check-site.mjs
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = [
  { html: 'index.html', copy: 'nh-copy-home.js' },
  { html: 'nanopdf.html', copy: 'nh-copy-nanopdf.js' },
  { html: 'tidyup.html', copy: 'nh-copy-tidyup.js' },
  { html: 'install.html', copy: 'nh-copy-install.js' },
];
const BANNED = [/ผม/, /\bsolo\b/i, /\bAI\b/];
const REDIRECTS = new Set(existsSync(join(ROOT, '_redirects'))
  ? readFileSync(join(ROOT, '_redirects'), 'utf8').split('\n').map(l => l.trim().split(/\s+/)[0]).filter(p => p && p.startsWith('/'))
  : []);
const problems = [];
const fail = (page, msg) => problems.push(`${page}: ${msg}`);

function htmlKeys(html) {
  const keys = new Set();
  for (const m of html.matchAll(/data-i18n(?:-html|-src)?="([^"]+)"/g)) keys.add(m[1]);
  for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g))
    for (const pair of m[1].split(';')) { const key = pair.split(':')[1]; if (key) keys.add(key.trim()); }
  return keys;
}

function loadCopy(file) {
  const ctx = { window: {} };
  vm.runInNewContext(readFileSync(join(ROOT, file), 'utf8'), ctx);
  return ctx.window.NH_COPY?.en ?? {};
}

function isLocal(ref) { return ref && !/^(https?:|mailto:|tel:|data:|#)/.test(ref); }

for (const { html: page, copy } of PAGES) {
  if (!existsSync(join(ROOT, page))) { fail(page, 'file missing'); continue; }
  if (!existsSync(join(ROOT, copy))) { fail(page, `${copy} missing`); continue; }
  const html = readFileSync(join(ROOT, page), 'utf8');
  const en = loadCopy(copy);
  const used = htmlKeys(html);
  for (const k of used) if (!(k in en)) fail(page, `missing EN key "${k}"`);
  for (const k of Object.keys(en)) if (!used.has(k)) fail(page, `unused EN key "${k}"`);

  const refs = [...html.matchAll(/\s(?:src|href)="([^"]+)"/g)].map(m => m[1]);
  for (const v of Object.values(en)) if (/\.(png|jpe?g|svg|webp)$/.test(v)) refs.push(v);
  for (const ref of refs.filter(isLocal)) {
    const path = ref.split(/[?#]/)[0];
    if (path === '/') { if (!existsSync(join(ROOT, 'index.html'))) fail(page, 'link to / but index.html is missing'); continue; }
    if (path.startsWith('/')) {
      if (!REDIRECTS.has(path)) fail(page, `"${ref}" is not a file or a path in _redirects`);
      continue;
    }
    if (!existsSync(join(ROOT, path))) fail(page, `broken local reference "${ref}"`);
  }

  for (const m of html.matchAll(/href="#([^"]*)"/g))
    if (m[1] && !new RegExp(`id="${m[1]}"`).test(html)) fail(page, `anchor #${m[1]} has no target`);

  // the founder note (data-voice="founder") is the one place allowed to speak as "ผม" and mention AI
const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<section[^>]*data-voice="founder"[\s\S]*?<\/section>/g, '').replace(/<[^>]+>/g, ' ');
  for (const re of BANNED) {
    if (re.test(text)) fail(page, `banned word ${re} in page`);
    if (Object.entries(en).some(([k, v]) => !k.startsWith('founder.') && re.test(v))) fail(page, `banned word ${re} in ${copy}`);
  }

  if (!/<html lang="th"/.test(html)) fail(page, '<html lang="th"> missing');
  const copyAt = html.indexOf(`src="${copy}"`), engineAt = html.indexOf('src="nh-i18n.js"');
  if (copyAt < 0 || engineAt < 0 || copyAt > engineAt) fail(page, `${copy} must load before nh-i18n.js`);
  if (/<img(?![^>]*\bwidth=)[^>]*>/.test(html)) fail(page, 'an <img> has no width');
}

if (problems.length) { console.log(problems.join('\n')); console.log(`\n${problems.length} problem(s)`); process.exit(1); }
console.log('check-site: all pages pass');
