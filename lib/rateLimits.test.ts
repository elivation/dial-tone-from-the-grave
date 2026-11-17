import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase-server', () => ({ supabaseServer: { rpc: vi.fn() } }));

import { checkRateLimit } from '@/lib/rateLimits';
import { MAX_INPUT_CHARS, operatorRequestSchema } from '@/lib/schemas';

describe('rate limit properties', () => {
  it('[P10][Req 10.1] a count at or under the limit is allowed', () => {
    fc.assert(
      fc.property(fc.nat({ max: 1_000_000 }), fc.nat({ max: 1_000_000 }), (a, b) => {
        const limit = Math.max(a, b);
        const count = Math.min(a, b);
        expect(checkRateLimit(count, limit)).toBe('allowed');
      }),
    );
  });

  it('[P11][Req 10.2] a count over the limit is denied', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 1_000_000 }),
        fc.integer({ min: 1, max: 1_000_000 }),
        (limit, extra) => {
          expect(checkRateLimit(limit + extra, limit)).toBe('denied');
        },
      ),
    );
  });

  it('[P12][Req 3.9] a message longer than MAX_INPUT_CHARS fails the operator schema', () => {
    fc.assert(
      fc.property(fc.integer({ min: MAX_INPUT_CHARS + 1, max: MAX_INPUT_CHARS + 1000 }), (len) => {
        const result = operatorRequestSchema.safeParse({
          number: '1023',
          message: 'x'.repeat(len),
          history: [],
          turnIndex: 0,
        });
        expect(result.success).toBe(false);
      }),
    );
  });
});
