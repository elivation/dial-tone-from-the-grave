// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const { embedText } = await import('./embed');

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co/');
  vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test');
});

describe('[Req 4.1] embedText', () => {
  it('posts the text with the secret key on the apikey header and returns the vector', async () => {
    const fetchMock = vi.fn(async () => Response.json({ embedding: [0.5, 0.5] }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await embedText('geyser')).toEqual([0.5, 0.5]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://example.supabase.co/functions/v1/embed');
    expect(init.headers).toMatchObject({ apikey: 'sb_secret_test' });
    expect(init.body).toBe(JSON.stringify({ text: 'geyser' }));
  });

  it('throws without leaking the response when the function fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'embed_failed' }, { status: 500 })),
    );
    await expect(embedText('geyser')).rejects.toThrow('embed failed with status 500');
  });
});
