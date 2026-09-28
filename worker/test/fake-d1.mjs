// A small stand-in for Cloudflare D1 on node:sqlite, with the real migrations applied. Every call yields to the
// event loop first, like a network round trip, so concurrent requests interleave the way they do in production.
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const tick = () => new Promise(r => setImmediate(r));

export function fakeD1() {
  const db = new DatabaseSync(':memory:');
  const dir = new URL('../migrations/', import.meta.url);
  for (const f of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) db.exec(readFileSync(new URL(f, dir), 'utf8'));
  const prepare = sql => {
    let args = [];
    const stmt = {
      bind: (...a) => { args = a; return stmt; },
      first: async () => { await tick(); return db.prepare(sql).get(...args) ?? null; },
      all: async () => { await tick(); return { results: db.prepare(sql).all(...args) }; },
      run: async () => {
        await tick();
        const r = db.prepare(sql).run(...args);
        return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
      },
    };
    return stmt;
  };
  return { prepare, raw: db };
}
