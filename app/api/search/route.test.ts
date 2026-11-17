// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
const embedText = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase-server', () => ({ supabaseServer: { rpc } }));
vi.mock('@/lib/embed', () => ({
  embedText,
  SPIRIT_EMBED_PHRASE: 'haunted spirit listings',
}));

const { POST } = await import('./route');

const post = (body: unknown, ip = '10.0.0.1') =>
  POST(
    new Request('http://localhost/api/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify(body),
    }),
  );

const businessRow = { id: 'b1', name: 'Geyser Guys', dial_number: '5551234', score: 0.9 };
const residentRow = { id: 'r1', surname: 'Botha', dial_number: '5559876', score: 0.8 };

beforeEach(() => {
  rpc.mockReset();
  embedText.mockReset();
  embedText.mockResolvedValue([0.1, 0.2]);
  rpc.mockImplementation(async (name: string) => {
    if (name === 'increment_rate_limit') return { data: 1, error: null };
    if (name === 'search_businesses') return { data: [businessRow], error: null };
    return { data: [residentRow], error: null };
  });
});

describe('[Req 4.1, 4.2] /api/search', () => {
  it('[Req 4.1] a valid business query returns results', async () => {
    const res = await post({ type: 'businesses', query: 'fix my geyser' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [businessRow], type: 'businesses' });
    expect(rpc).toHaveBeenCalledWith(
      'search_businesses',
      expect.objectContaining({ query_text: 'fix my geyser', spirit_only: false }),
    );
  });

  it('[Req 4.2] a valid resident query returns results', async () => {
    const res = await post({ type: 'residents', query: 'Botha' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [residentRow], type: 'residents' });
    expect(rpc).toHaveBeenCalledWith(
      'search_residents',
      expect.objectContaining({ surname_hint: 'Botha' }),
    );
  });

  it('[Req 4.4] spooky queries include spirit listings, ordinary ones do not', async () => {
    await post({ type: 'businesses', query: 'a locksmith at midnight' });
    expect(rpc).toHaveBeenCalledWith(
      'search_businesses',
      expect.objectContaining({ include_spirit: true }),
    );
    rpc.mockClear();
    await post({ type: 'businesses', query: 'a locksmith' });
    expect(rpc).toHaveBeenCalledWith(
      'search_businesses',
      expect.objectContaining({ include_spirit: false }),
    );
  });

  it('[Req 7.2] spiritOnly calls the RPC with the spirit_only flag and the fixed phrase', async () => {
    const res = await post({ type: 'businesses', query: '', spiritOnly: true });
    expect(res.status).toBe(200);
    expect(embedText).toHaveBeenCalledWith('haunted spirit listings');
    expect(rpc).toHaveBeenCalledWith(
      'search_businesses',
      expect.objectContaining({ spirit_only: true }),
    );
  });
});

describe('[Req 10.2, 10.4, 10.7] /api/search validation and limits', () => {
  it('[Req 10.7] rejects a body with no type', async () => {
    const res = await post({ query: 'geyser' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_body' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('[Req 10.7] rejects a query over 300 characters', async () => {
    const res = await post({ type: 'businesses', query: 'a'.repeat(301) });
    expect(res.status).toBe(400);
  });

  it('[Req 10.2] over the limit returns 429 in character and skips the search', async () => {
    rpc.mockImplementation(async () => ({ data: 61, error: null }));
    const res = await post({ type: 'businesses', query: 'geyser' });
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe('rate_limited');
    expect(body.message).toBe('All lines are busy. Try again later.');
    expect(embedText).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('[Req 10.2] counts search_count against a hashed IP key, never the raw IP', async () => {
    await post({ type: 'businesses', query: 'geyser' }, '203.0.113.9');
    const [, args] = rpc.mock.calls[0] as [string, { p_id: string; p_field: string }];
    expect(args.p_field).toBe('search_count');
    expect(args.p_id).toMatch(/^ip:[0-9a-f]{16}:\d+$/);
    expect(args.p_id).not.toContain('203.0.113.9');
  });

  it('[Req 10.4] failures return search_failed with no detail', async () => {
    embedText.mockRejectedValue(new Error('secret detail'));
    const res = await post({ type: 'businesses', query: 'geyser' });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'search_failed' });
  });
});
