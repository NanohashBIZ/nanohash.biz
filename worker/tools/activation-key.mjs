// Activation token key pair (separate from the License Key pair on purpose).
// The private key lives next to the License Key private key, in TidyUpPC/dev/keys (git-ignored).
//   node tools/activation-key.mjs --public-xml                    print the public key for the apps
//   node tools/activation-key.mjs | npx wrangler secret put ACTIVATION_PRIVATE_JWK
// The first run creates the key pair.
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const file = join(dirname(fileURLToPath(import.meta.url)), '../../../TidyUpPC/dev/keys/activation-private.jwk.json');
if (!existsSync(file)) {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  writeFileSync(file, JSON.stringify(privateKey.export({ format: 'jwk' })));
  console.error(`created ${file}`);
}
const jwk = JSON.parse(readFileSync(file, 'utf8'));
if (process.argv.includes('--public-xml')) {
  const b64 = s => Buffer.from(s, 'base64url').toString('base64');
  process.stdout.write(`<RSAKeyValue><Modulus>${b64(jwk.n)}</Modulus><Exponent>${b64(jwk.e)}</Exponent></RSAKeyValue>`);
} else {
  process.stdout.write(Buffer.from(JSON.stringify(jwk)).toString('base64'));
}
