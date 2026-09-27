// Copies the committed site (git HEAD) into worker/public, leaving out source and dev files.
// Only committed files are published, so commit before `npm run deploy`.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..');
const out = join(here, 'public');
const tar = join(here, '.site.tar');
const SKIP = ['worker', 'tests', 'README.md', '.gitignore', 'vercel.json', '.vercelignore'];

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
execFileSync('git', ['-C', site, 'archive', '--format=tar', '-o', tar, 'HEAD']);
execFileSync('tar', ['-xf', tar, '-C', out]);
rmSync(tar);
for (const p of SKIP) rmSync(join(out, p), { recursive: true, force: true });
console.log(`site copied to ${out}`);
