import { BUSINESSES } from './businesses';
import { RESIDENTS } from './residents';
import { embeddingText, type BusinessSeed, type ResidentSeed } from './rows';

const EMBEDDING_SIZE = 384;

/** Where the seed goes: the embed function and the two tables. The CLI wires the real ones. */
export type SeedTarget = {
  embed: (text: string) => Promise<number[]>;
  upsert: (
    table: 'businesses' | 'residents',
    rows: Array<Record<string, unknown>>,
  ) => Promise<void>;
};

type Options = { batchSize: number; concurrency: number };

/** Runs `work` over `items`, at most `limit` at a time, keeping their order. */
async function mapLimited<T, R>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await work(items[i] as T);
    }
  });
  await Promise.all(workers);
  return results;
}

async function embedOrFail(target: SeedTarget, text: string, label: string): Promise<string> {
  let vector: number[];
  try {
    vector = await target.embed(text);
  } catch {
    // The raw error can carry request details, so only the listing is named.
    throw new Error(`Embedding failed for ${label}.`);
  }
  if (!Array.isArray(vector) || vector.length !== EMBEDDING_SIZE)
    throw new Error(`Embedding failed for ${label}.`);
  // pgvector reads its text form, "[0.1,0.2,...]".
  return JSON.stringify(vector);
}

const businessRow = (b: BusinessSeed, embedding: string) => ({ ...b, embedding });
const residentRow = (r: ResidentSeed, embedding: string) => ({ ...r, embedding });

/**
 * Embeds every listing and upserts it, in batches. Rows are matched on their number, so running it
 * again updates the same rows instead of adding copies. Stops at the first failure.
 */
export async function seedAll(
  target: SeedTarget,
  { batchSize, concurrency }: Options,
): Promise<{ businesses: number; residents: number }> {
  let businesses = 0;
  for (let i = 0; i < BUSINESSES.length; i += batchSize) {
    const batch = BUSINESSES.slice(i, i + batchSize);
    const rows = await mapLimited(batch, concurrency, async (b) =>
      businessRow(
        b,
        await embedOrFail(
          target,
          embeddingText({ kind: 'business', row: b }),
          `business "${b.name}"`,
        ),
      ),
    );
    await target.upsert('businesses', rows);
    businesses += rows.length;
  }
  let residents = 0;
  for (let i = 0; i < RESIDENTS.length; i += batchSize) {
    const batch = RESIDENTS.slice(i, i + batchSize);
    const rows = await mapLimited(batch, concurrency, async (r) =>
      residentRow(
        r,
        await embedOrFail(
          target,
          embeddingText({ kind: 'resident', row: r }),
          `resident "${r.surname} ${r.initials}"`,
        ),
      ),
    );
    await target.upsert('residents', rows);
    residents += rows.length;
  }
  return { businesses, residents };
}
