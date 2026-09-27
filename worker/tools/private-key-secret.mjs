// Turns the .NET RSA private key XML into the JWK the Worker signs with, and writes it (base64) to stdout
// so it can be piped straight into `wrangler secret put LICENSE_PRIVATE_JWK` without being shown.
//   node tools/private-key-secret.mjs ../../TidyUpPC/dev/keys/private.xml | npx wrangler secret put LICENSE_PRIVATE_JWK
import { readFileSync } from 'node:fs';

export function xmlToJwk(xml) {
  const get = tag => {
    const m = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`));
    if (!m) throw new Error(`missing <${tag}>`);
    return Buffer.from(m[1], 'base64').toString('base64url');
  };
  return {
    kty: 'RSA', n: get('Modulus'), e: get('Exponent'), d: get('D'),
    p: get('P'), q: get('Q'), dp: get('DP'), dq: get('DQ'), qi: get('InverseQ'),
  };
}

if (process.argv[2]) process.stdout.write(Buffer.from(JSON.stringify(xmlToJwk(readFileSync(process.argv[2], 'utf8')))).toString('base64'));
