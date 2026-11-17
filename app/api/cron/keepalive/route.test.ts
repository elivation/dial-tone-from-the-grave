// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const select = vi.fn();
const from = vi.fn(() => ({ select }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase-server', () => ({ supabaseServer: { from } }));

const { GET } = await import('./route');

const call = (authorization?: string) =>
  GET(
    new Request('http://localhost/api/cron/keepalive', {
      headers: authorization === undefined ? {} : { authorization },
    }),
  );

beforeEach(() => {
  from.mockClear();
  select.mockReset();
  select.mockResolvedValue({ error: null, count: 1 });
  vi.stubEnv('CRON_SECRET', 'correct-horse-battery');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('[Req 10.9] /api/cron/keepalive', () => {
  it('[Req 10.9] missing bearer returns 401 and does not touch the database', async () => {
    const res = await call();
    expect(res.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it('[Req 10.9] wrong bearer returns 401', async () => {
    expect((await call('Bearer wrong')).status).toBe(401);
    expect((await call('Bearer correct-horse-battery-and-more')).status).toBe(401);
    expect((await call('correct-horse-battery')).status).toBe(401);
  });

  it('[Req 10.9] refuses every request when CRON_SECRET is unset', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect((await call('Bearer ')).status).toBe(401);
    expect((await call('Bearer undefined')).status).toBe(401);
  });

  it('[Req 10.9] right bearer returns the health result', async () => {
    const res = await call('Bearer correct-horse-battery');
    const body = (await res.json()) as { ok: boolean };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('[Req 10.9] right bearer passes a 503 through when the database is down', async () => {
    select.mockResolvedValue({ error: { message: 'x' }, count: null });
    const res = await call('Bearer correct-horse-battery');
    expect(res.status).toBe(503);
  });
});
