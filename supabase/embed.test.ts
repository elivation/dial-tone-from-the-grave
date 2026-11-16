// @vitest-environment node
/** [Req 4.1, 4.2] The embed Edge Function's handler: text in, a 384-number embedding out. */
import { describe, it, expect, vi } from 'vitest';
import { EMBEDDING_SIZE, MAX_EMBED_CHARS, handleEmbed } from './functions/embed/handler';

const vector = Array.from({ length: EMBEDDING_SIZE }, (_, i) => i / EMBEDDING_SIZE);
const post = (body: unknown) =>
  new Request('https://example.test/embed', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const read = async (res: Response) => ({
  status: res.status,
  body: (await res.json()) as Record<string, unknown>,
});

describe('handleEmbed', () => {
  it('[Req 4.1] returns the 384-number embedding for the text', async () => {
    const embed = vi.fn(async () => vector);
    const { status, body } = await read(
      await handleEmbed(post({ text: 'fix my geyser in Edenvale' }), embed),
    );
    expect(status).toBe(200);
    expect(body['embedding']).toEqual(vector);
    expect(embed).toHaveBeenCalledWith('fix my geyser in Edenvale');
  });

  it('trims the text before embedding it', async () => {
    const embed = vi.fn(async () => vector);
    await handleEmbed(post({ text: '  geyser  ' }), embed);
    expect(embed).toHaveBeenCalledWith('geyser');
  });

  it('accepts only POST', async () => {
    const embed = vi.fn(async () => vector);
    const res = await handleEmbed(
      new Request('https://example.test/embed', { method: 'GET' }),
      embed,
    );
    expect(res.status).toBe(405);
    expect(embed).not.toHaveBeenCalled();
  });

  it('[Req 10.7] refuses a body that is not JSON, has no text, or has blank text', async () => {
    for (const body of ['not json', {}, { text: 42 }, { text: '   ' }]) {
      const embed = vi.fn(async () => vector);
      const { status, body: reply } = await read(await handleEmbed(post(body), embed));
      expect(status, JSON.stringify(body)).toBe(400);
      expect(reply['error']).toBe('invalid_body');
      expect(embed).not.toHaveBeenCalled();
    }
  });

  it('[Req 10.7] refuses text longer than it will ever need, so nobody can burn compute with it', async () => {
    const embed = vi.fn(async () => vector);
    const res = await handleEmbed(post({ text: 'a'.repeat(MAX_EMBED_CHARS + 1) }), embed);
    expect(res.status).toBe(400);
    expect(embed).not.toHaveBeenCalled();
    expect((await handleEmbed(post({ text: 'a'.repeat(MAX_EMBED_CHARS) }), embed)).status).toBe(
      200,
    );
  });

  it('fails cleanly if the model returns the wrong size, without leaking what it returned', async () => {
    const { status, body } = await read(
      await handleEmbed(post({ text: 'geyser' }), async () => [1, 2, 3]),
    );
    expect(status).toBe(500);
    expect(body).toEqual({ error: 'embed_failed' });
  });

  it('fails cleanly if the model throws, without passing the error on', async () => {
    const { status, body } = await read(
      await handleEmbed(post({ text: 'geyser' }), async () => {
        throw new Error('model exploded: internal detail');
      }),
    );
    expect(status).toBe(500);
    expect(body).toEqual({ error: 'embed_failed' });
  });
});
