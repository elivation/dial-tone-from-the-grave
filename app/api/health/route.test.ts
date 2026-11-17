// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const select = vi.fn();
const from = vi.fn(() => ({ select }));

vi.mock('server-only', () => ({}));
vi.mock('next/server', () => ({ connection: async () => undefined }));
vi.mock('@/lib/supabase-server', () => ({ supabaseServer: { from } }));

const { GET } = await import('./route');

beforeEach(() => {
  select.mockReset();
  from.mockClear();
});

describe('[Req 10.9] /api/health', () => {
  it('[Req 10.9] returns ok:true and an ISO timestamp when Postgres answers', async () => {
    select.mockResolvedValue({ error: null, count: 3 });
    const res = await GET();
    const body = (await res.json()) as { ok: boolean; ts: string };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(new Date(body.ts).toISOString()).toBe(body.ts);
    expect(from).toHaveBeenCalledWith('businesses');
    expect(select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
  });

  it('[Req 10.9] returns 503 with no error detail when Supabase errors', async () => {
    select.mockResolvedValue({ error: { message: 'secret detail' }, count: null });
    const res = await GET();
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).not.toContain('secret detail');
    expect(JSON.parse(text)).toEqual({ ok: false });
  });

  it('[Req 10.9] returns 503 when the client throws', async () => {
    select.mockRejectedValue(new Error('network down'));
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain('network down');
  });
});
