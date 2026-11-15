import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { vector } from '@electric-sql/pglite-pgvector';

const MIGRATIONS = path.resolve(process.cwd(), 'supabase/migrations');

/**
 * A fresh Postgres in memory, set up the way a new Supabase project is before our migrations run:
 * the anon, authenticated and service_role roles, an `extensions` schema, and Supabase's default
 * privileges, which give the public roles access to every new table and function. The migrations
 * then have to take that access away themselves, which is what the tests check.
 */
export async function migratedDatabase(): Promise<PGlite> {
  const db = new PGlite({ extensions: { vector, pg_trgm } });
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema if not exists extensions;
    grant usage on schema public, extensions to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  `);
  for (const file of readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    await db.exec(readFileSync(path.join(MIGRATIONS, file), 'utf8'));
  }
  return db;
}

/** A 384-dimension embedding pointing mostly along `axis`, with a little of `mix` added. */
export function embedding(axis: number, mix?: { axis: number; weight: number }): string {
  const v = new Array<number>(384).fill(0);
  v[axis] = 1;
  if (mix) v[mix.axis] = (v[mix.axis] ?? 0) + mix.weight;
  return `[${v.join(',')}]`;
}

/** Runs `query` as `role`, then switches back to the owner, whatever happens. */
export async function asRole<T>(db: PGlite, role: string, query: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${role}`);
  try {
    return await query();
  } finally {
    await db.exec('reset role');
  }
}
