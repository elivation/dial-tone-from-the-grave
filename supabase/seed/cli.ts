// Seeds the live database: `pnpm db:seed`. Prints only counts, never a key or a row.
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../lib/database.types';
import { seedAll } from './run';

const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const secret = process.env['SUPABASE_SECRET_KEY'];
if (!url || !secret) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.');
  process.exit(1);
}

const supabase = createClient<Database>(url, secret, { auth: { persistSession: false } });
const embedUrl = `${url.replace(/\/$/, '')}/functions/v1/embed`;

async function embed(text: string): Promise<number[]> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(embedUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: secret as string },
      body: JSON.stringify({ text }),
    });
    if (res.ok) return ((await res.json()) as { embedding: number[] }).embedding;
    // A cold start or a busy worker can fail once. Anything else, or a third failure, is final.
    if (attempt >= 3 || res.status < 500) throw new Error(`embed returned ${res.status}`);
    await new Promise((r) => setTimeout(r, 500 * attempt));
  }
}

// Run as CommonJS by tsx, which has no top-level await.
async function main(): Promise<void> {
  try {
    const report = await seedAll(
      {
        embed,
        upsert: async (table, rows) => {
          const { error } = await supabase
            .from(table)
            .upsert(rows as never, { onConflict: 'phone_digits' });
          if (error) throw new Error(`Upsert into ${table} failed (${error.code}).`);
        },
      },
      { batchSize: 25, concurrency: 4 },
    );
    console.log(`SEED|businesses|${report.businesses}`);
    console.log(`SEED|residents|${report.residents}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Seeding failed.');
    process.exit(1);
  }
}

void main();
