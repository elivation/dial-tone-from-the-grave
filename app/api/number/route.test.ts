// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase-server', () => ({ supabaseServer: { rpc } }));

const { POST } = await import('./route');

const post = (body: unknown, ip = '10.0.0.1') =>
  POST(
    new Request('http://localhost/api/number', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify(body),
    }),
  );

const row = {
  kind: 'business',
  id: 'b1',
  name: 'Sithole Hot Water',
  category: 'Plumber',
  suburb: 'Edenvale',
  address: '1 Mist Road',
  hours: '24 hours',
  description: 'Fixes geysers at night.',
  is_spirit: false,
  dial_number: '61019',
};

let count: number;
let lookup: { data: unknown; error: unknown };

beforeEach(() => {
  rpc.mockReset();
  delete process.env['SEARCH_LIMIT_PER_IP_PER_HOUR'];
  count = 1;
  lookup = { data: [row], error: null };
  rpc.mockImplementation(async (name: string) =>
    name === 'increment_rate_limit' ? { data: count, error: null } : lookup,
  );
});

describe('[Req 11.2, 11.4, 10.2] /api/number', () => {
  it('[Req 11.2] a listing number returns kind listing and two rings, and nothing else', async () => {
    const res = await post({ digits: '61019' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ kind: 'listing', ringCount: 2 });
    expect(rpc).toHaveBeenCalledWith('lookup_number', { digits: '61019' });
  });

  it('[Req 11.4] the response never carries listing details', async () => {
    const text = await (await post({ digits: '61019' })).text();
    for (const detail of [row.name, row.address, row.description, row.id]) {
      expect(text).not.toContain(detail);
    }
  });

  it('[Req 11.8] an unknown number returns kind none', async () => {
    lookup = { data: [], error: null };
    const res = await post({ digits: '99999' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ kind: 'none' });
  });

  it.each([
    ['no body fields', {}],
    ['digits missing', { number: '61019' }],
    ['letters', { digits: 'HO61019' }],
    ['too short', { digits: '61' }],
    ['too long', { digits: '1234567890123' }],
    ['not a string', { digits: 61019 }],
    ['spaces', { digits: '011 000 1234' }],
  ])(
    '[Req 11.4] a bad body (%s) is 400 invalid_body and never reaches the database',
    async (_n, body) => {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'invalid_body' });
      expect(rpc).not.toHaveBeenCalled();
    },
  );

  it('[Req 11.4] a body that is not JSON is 400 invalid_body', async () => {
    const res = await POST(
      new Request('http://localhost/api/number', { method: 'POST', body: 'not json' }),
    );
    expect(res.status).toBe(400);
  });

  it('[Req 10.2] over the search limit is 429 rate_limited before any lookup', async () => {
    process.env['SEARCH_LIMIT_PER_IP_PER_HOUR'] = '5';
    count = 6;
    const res = await post({ digits: '61019' });
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: 'rate_limited' });
    expect(rpc).not.toHaveBeenCalledWith('lookup_number', expect.anything());
  });

  it('[Req 10.2] it counts against the search bucket', async () => {
    await post({ digits: '61019' });
    expect(rpc).toHaveBeenCalledWith(
      'increment_rate_limit',
      expect.objectContaining({ p_field: 'search_count' }),
    );
  });

  it('[Req 15.1] a database failure is 500 lookup_failed with no detail', async () => {
    lookup = { data: null, error: { message: 'secret table detail' } };
    const res = await post({ digits: '61019' });
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toBe(JSON.stringify({ error: 'lookup_failed' }));
  });

  it('[Req 15.1] a failing rate limit store is 500 lookup_failed', async () => {
    rpc.mockImplementation(async () => ({ data: null, error: { message: 'down' } }));
    const res = await post({ digits: '61019' });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'lookup_failed' });
  });
});
