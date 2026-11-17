import { z } from 'zod';
import type { BusinessResult, ResidentResult } from '@/lib/listingSearch';

// Zod probes for eval with new Function(), which the page's CSP blocks and reports. Turning the
// compiled parser off skips the probe and costs nothing at this event size.
z.config({ jitless: true });

export type Listing = BusinessResult | ResidentResult;

/** The events `/api/operator` streams. Anything else on the wire is dropped. */
const operatorEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({
    type: z.literal('tool_start'),
    tool: z.enum(['search_businesses', 'search_residents']),
    query: z.string(),
  }),
  z.object({
    type: z.literal('tool_result'),
    results: z.array(z.custom<Listing>((value) => typeof value === 'object' && value !== null)),
  }),
  z.object({ type: z.literal('done') }),
  z.object({
    type: z.literal('error'),
    code: z.enum(['turn_cap', 'operator_down', 'input_too_long', 'rate_limited', 'invalid_number']),
  }),
]);

export type OperatorEvent = z.infer<typeof operatorEventSchema>;

/**
 * Turns streamed text into events. A network chunk can end in the middle of an event, so the
 * unfinished tail is kept until the rest arrives.
 */
export function createSseParser(): { push: (chunk: string) => OperatorEvent[] } {
  let buffer = '';
  return {
    push(chunk) {
      buffer += chunk.replace(/\r\n?/g, '\n');
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';
      const events: OperatorEvent[] = [];
      for (const block of blocks) {
        const data = block
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).replace(/^ /, ''))
          .join('\n');
        if (data === '') continue;
        try {
          const parsed = operatorEventSchema.safeParse(JSON.parse(data));
          if (parsed.success) events.push(parsed.data);
        } catch {
          // A block that is not JSON is skipped, the stream carries on.
        }
      }
      return events;
    },
  };
}
