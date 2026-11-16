// @vitest-environment node
/** [Req 4.1, 4.2] The seed runner: embed every listing, then upsert it, without ever printing a key. */
import { describe, it, expect, vi } from 'vitest';
import { seedAll, type SeedTarget } from './run';
import { BUSINESSES } from './businesses';
import { RESIDENTS } from './residents';

const vector = Array.from({ length: 384 }, () => 0.05);

function fakeTarget(overrides: Partial<SeedTarget> = {}): SeedTarget & {
  upserted: Record<string, unknown[]>;
} {
  const upserted: Record<string, unknown[]> = { businesses: [], residents: [] };
  return {
    upserted,
    embed: vi.fn(async () => vector),
    upsert: vi.fn(async (table: 'businesses' | 'residents', rows: unknown[]) => {
      upserted[table]?.push(...rows);
    }),
    ...overrides,
  };
}

describe('seedAll', () => {
  it('[Req 4.1, 4.2] embeds and upserts every business and every resident', async () => {
    const target = fakeTarget();
    const report = await seedAll(target, { batchSize: 25, concurrency: 4 });
    expect(report).toEqual({ businesses: BUSINESSES.length, residents: RESIDENTS.length });
    expect(target.upserted['businesses']).toHaveLength(BUSINESSES.length);
    expect(target.upserted['residents']).toHaveLength(RESIDENTS.length);
    expect(target.embed).toHaveBeenCalledTimes(BUSINESSES.length + RESIDENTS.length);
  });

  it('stores each embedding in the text form pgvector reads', async () => {
    const target = fakeTarget();
    await seedAll(target, { batchSize: 50, concurrency: 2 });
    const first = target.upserted['businesses']?.[0] as { embedding: string };
    expect(first.embedding.startsWith('[')).toBe(true);
    expect(JSON.parse(first.embedding)).toHaveLength(384);
  });

  it('never sends the generated phone_digits column', async () => {
    const target = fakeTarget();
    await seedAll(target, { batchSize: 50, concurrency: 2 });
    for (const row of [
      ...(target.upserted['businesses'] ?? []),
      ...(target.upserted['residents'] ?? []),
    ]) {
      expect(row).not.toHaveProperty('phone_digits');
    }
  });

  it('stops at the first failure and says where, without passing the raw error on', async () => {
    const target = fakeTarget({
      embed: vi.fn(async (text: string) => {
        if (text.includes('Graveyard Shift')) throw new Error('secret detail sb_secret_abc');
        return vector;
      }),
    });
    await expect(seedAll(target, { batchSize: 25, concurrency: 1 })).rejects.toThrow(
      /^Embedding failed for business "Graveyard Shift Electrical"\.$/,
    );
  });

  it('refuses an embedding of the wrong size', async () => {
    const target = fakeTarget({ embed: vi.fn(async () => [1, 2, 3]) });
    await expect(seedAll(target, { batchSize: 25, concurrency: 1 })).rejects.toThrow(
      /Embedding failed/,
    );
    expect(target.upsert).not.toHaveBeenCalled();
  });
});
