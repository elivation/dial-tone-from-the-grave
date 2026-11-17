import { LISTING_RING_COUNT } from '@/lib/listingGhost';
import { lookupListing } from '@/lib/listingLookup';
import { bumpIpCounter, checkRateLimit, envInt } from '@/lib/rateLimits';
import { numberRequestSchema } from '@/lib/schemas';

const DEFAULT_LIMIT = 60;

const reply = (status: number, body: unknown) => Response.json(body, { status });

/**
 * Tells the browser what a dialled number reaches, so it can ring or play a wrong number. It says
 * only the kind, never who the listing is: the persona is built on the server when the call connects.
 */
export async function POST(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return reply(400, { error: 'invalid_body' });
  }
  const parsed = numberRequestSchema.safeParse(raw);
  if (!parsed.success) return reply(400, { error: 'invalid_body' });

  try {
    const count = await bumpIpCounter(req, 'search_count');
    if (count === null) return reply(500, { error: 'lookup_failed' });
    if (checkRateLimit(count, envInt('SEARCH_LIMIT_PER_IP_PER_HOUR', DEFAULT_LIMIT)) === 'denied') {
      return reply(429, { error: 'rate_limited', message: 'All lines are busy. Try again later.' });
    }
    const listing = await lookupListing(parsed.data.digits);
    return reply(
      200,
      listing ? { kind: 'listing', ringCount: LISTING_RING_COUNT } : { kind: 'none' },
    );
  } catch {
    return reply(500, { error: 'lookup_failed' });
  }
}
