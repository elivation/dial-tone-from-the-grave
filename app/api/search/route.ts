import { SPIRIT_EMBED_PHRASE } from '@/lib/embed';
import { searchBusinesses, searchResidents } from '@/lib/listingSearch';
import { bumpIpCounter, envInt } from '@/lib/rateLimit';
import { searchRequestSchema } from '@/lib/schemas';
import { isSpookyQuery } from '@/lib/spooky';

const DEFAULT_LIMIT = 60;

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
    const count = await bumpIpCounter(req, 'search_count');
    if (count === null) return reply(500, { error: 'search_failed' });
    if (count > envInt('SEARCH_LIMIT_PER_IP_PER_HOUR', DEFAULT_LIMIT)) {
      return reply(429, {
        error: 'rate_limited',
        message: 'All lines are busy. Try again later.',
      });
    }

    if (type === 'residents') {
      return reply(200, { results: await searchResidents({ surname: text }), type });
    }
    const results = await searchBusinesses({
      text,
      includeSpirit: Boolean(spooky) || isSpookyQuery(query),
      spiritOnly: Boolean(spiritOnly),
    });
    return reply(200, { results, type });
  } catch {
    return reply(500, { error: 'search_failed' });
  }
}
