import 'server-only';

/** Embeds a fixed phrase for the 1313 path: an empty string is refused and a zero vector gives NaN. */
export const SPIRIT_EMBED_PHRASE = 'haunted spirit listings';

/**
 * Asks the deployed embed Edge Function for a 384 number vector. The secret key goes on the
 * apikey header only, as secret keys are not JWTs. Errors carry no detail from the response.
 */
export async function embedText(text: string): Promise<number[]> {
  const base = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const secret = process.env['SUPABASE_SECRET_KEY'];
  if (!base || !secret) throw new Error('embed is not configured');
  const res = await fetch(`${base.replace(/\/$/, '')}/functions/v1/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: secret },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`embed failed with status ${res.status}`);
  const body = (await res.json()) as { embedding?: unknown };
  if (!Array.isArray(body.embedding)) throw new Error('embed returned no embedding');
  return body.embedding as number[];
}
