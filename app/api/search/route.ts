import { createHash } from 'node:crypto';
import { supabaseServer } from '@/lib/supabase-server';
import { embedText, SPIRIT_EMBED_PHRASE } from '@/lib/embed';
import { searchRequestSchema } from '@/lib/schemas';
import { isSpookyQuery } from '@/lib/spooky';

const HOUR_MS = 3_600_000;
const DEFAULT_LIMIT = 60;

function limitPerHour(): number {
  const parsed = Number.parseInt(process.env['SEARCH_LIMIT_PER_IP_PER_HOUR'] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LIMIT;
}

/** SHA-256 of the first forwarded address, first 16 hex chars. The raw IP is never stored. */
function hashIp(req: Request): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

const reply = (status: number, body: unknown) => Response.json(body, { status });

export async function POST(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return reply(400, { error: 'invalid_body' });
  }
  const parsed = searchRequestSchema.safeParse(raw);
  if (!parsed.success) return reply(400, { error: 'invalid_body' });
  const { type, query, spooky, spiritOnly } = parsed.data;
  const text = spiritOnly ? SPIRIT_EMBED_PHRASE : query.trim();
  if (text === '') return reply(400, { error: 'invalid_body' });

  try {
    const hour = Math.floor(Date.now() / HOUR_MS);
    const { data: count, error: limitError } = await supabaseServer.rpc('increment_rate_limit', {
      p_id: `ip:${hashIp(req)}:${hour}`,
      p_field: 'search_count',
      p_window_start: new Date(hour * HOUR_MS).toISOString(),
    });
    if (limitError || typeof count !== 'number') return reply(500, { error: 'search_failed' });
    if (count > limitPerHour()) {
      return reply(429, {
        error: 'rate_limited',
        message: 'All lines are busy. Try again later.',
      });
    }

    const query_embedding = JSON.stringify(await embedText(text));

    if (type === 'residents') {
      const { data, error } = await supabaseServer.rpc('search_residents', {
        query_embedding,
        surname_hint: text,
      });
      if (error) return reply(500, { error: 'search_failed' });
      return reply(200, { results: data ?? [], type });
    }

    const { data, error } = await supabaseServer.rpc('search_businesses', {
      query_embedding,
      query_text: text,
      include_spirit: Boolean(spooky) || isSpookyQuery(query),
      spirit_only: Boolean(spiritOnly),
    });
    if (error) return reply(500, { error: 'search_failed' });
    return reply(200, { results: data ?? [], type });
  } catch {
    return reply(500, { error: 'search_failed' });
  }
}
