// npm run deploy: copy the committed site, apply D1 migrations without the confirmation prompt, deploy the Worker.
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cwd = join(dirname(fileURLToPath(import.meta.url)), '..');
const run = cmd => execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, CI: 'true' } });
run('node build.mjs');
run('npx wrangler d1 migrations apply nanohash --remote');
run('npx wrangler deploy');
