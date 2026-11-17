import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createSseParser } from './sse';

const frame = (event: unknown) => `data: ${JSON.stringify(event)}\n\n`;

describe('createSseParser', () => {
  it('[Req 3.3] parses whole events from one chunk', () => {
    const parser = createSseParser();
    const events = parser.push(frame({ type: 'delta', text: 'Hello' }) + frame({ type: 'done' }));
    expect(events).toEqual([{ type: 'delta', text: 'Hello' }, { type: 'done' }]);
  });

  it('[Req 3.3] keeps an event split across chunks until it is complete', () => {
    const parser = createSseParser();
    const text = frame({ type: 'delta', text: 'Hi' });
    expect(parser.push(text.slice(0, 10))).toEqual([]);
    expect(parser.push(text.slice(10))).toEqual([{ type: 'delta', text: 'Hi' }]);
  });

  it('[Req 3.3] drops malformed and unknown events and keeps going', () => {
    const parser = createSseParser();
    const events = parser.push(
      'data: {not json\n\n' + frame({ type: 'mystery' }) + frame({ type: 'done' }),
    );
    expect(events).toEqual([{ type: 'done' }]);
  });

  it('[Req 3.3] reads CRLF line endings', () => {
    const parser = createSseParser();
    expect(parser.push('data: {"type":"done"}\r\n\r\n')).toEqual([{ type: 'done' }]);
  });

  it('[Req 3.3] gives the same events however the stream is cut', () => {
    const texts = ['a', 'b "quoted"', 'caf\u00e9'];
    const stream =
      texts.map((text) => frame({ type: 'delta', text })).join('') + frame({ type: 'done' });
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: stream.length }), { maxLength: 6 }),
        (cuts) => {
          const points = [0, ...[...cuts].sort((a, b) => a - b), stream.length];
          const parser = createSseParser();
          const events = points
            .slice(1)
            .flatMap((end, i) => parser.push(stream.slice(points[i], end)));
          expect(events).toHaveLength(texts.length + 1);
          expect(events[0]).toEqual({ type: 'delta', text: 'a' });
        },
      ),
    );
  });
});
