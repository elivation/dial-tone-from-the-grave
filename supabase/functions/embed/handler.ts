/**
 * The embed function's logic, kept free of Deno and npm imports so it can be tested with Vitest.
 * `index.ts` wires it to the secret-key check and the gte-small model.
 */

/** gte-small returns 384 numbers. The database columns are vector(384). */
export const EMBEDDING_SIZE = 384;
/** A query is at most 300 characters and a seed listing a few hundred, so this is generous. */
export const MAX_EMBED_CHARS = 2000;

export type Embedder = (text: string) => Promise<number[]>;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Takes `{ text }` and returns `{ embedding }`. Errors never pass on internal detail. */
export async function handleEmbed(req: Request, embed: Embedder): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  let text: unknown;
  try {
    text = ((await req.json()) as { text?: unknown }).text;
  } catch {
    return json(400, { error: 'invalid_body' });
  }
  if (typeof text !== 'string' || text.trim() === '' || text.length > MAX_EMBED_CHARS) {
    return json(400, { error: 'invalid_body' });
  }
  try {
    const embedding = await embed(text.trim());
    if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_SIZE) {
      return json(500, { error: 'embed_failed' });
    }
    return json(200, { embedding });
  } catch {
    return json(500, { error: 'embed_failed' });
  }
}
