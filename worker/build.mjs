// Copies the committed site (git HEAD) into worker/public, leaving out source and dev files.
// Only committed files are published, so commit before `npm run deploy`.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..');
const out = join(here, 'public');
const tar = join(here, '.site.tar');
const SKIP = ['worker', 'tests', 'README.md', '.gitignore', 'vercel.json', '.vercelignore'];

// empty the folder rather than delete it: `wrangler dev` keeps a handle on it
mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) rmSync(join(out, f), { recursive: true, force: true });
execFileSync('git', ['-C', site, 'archive', '--format=tar', '-o', tar, 'HEAD']);
// relative paths: GNU tar reads "C:" as a remote host
execFileSync('tar', ['-xf', '.site.tar', '-C', 'public'], { cwd: here });
rmSync(tar);
for (const p of SKIP) rmSync(join(out, p), { recursive: true, force: true });
console.log(`site copied to ${out}`);
