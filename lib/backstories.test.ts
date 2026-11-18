import { describe, it, expect } from 'vitest';
import { findBrandNames } from './brandNames';
import { OPERATORS } from './operators';

// Review of the operator backstories against Req 14.4: tied to Johannesburg and its telephone
// history, invented, no real brands. People and political figures cannot be found by a word list,
// so the prompts were read by hand and the check below pins what they are allowed to name.
const BACKSTORY_OPERATORS = ['1023', '1026', '666'];

describe('operator backstories', () => {
  it.each(BACKSTORY_OPERATORS)(
    '[Req 14.4] %s is tied to Johannesburg and the old exchange',
    (number) => {
      const { systemPrompt } = OPERATORS[number]!;
      expect(systemPrompt).toContain('Johannesburg');
      expect(systemPrompt).toMatch(/exchange/);
    },
  );

  it.each(Object.keys(OPERATORS))('[Req 14.4] %s names no real brand', (number) => {
    const op = OPERATORS[number]!;
    expect(findBrandNames([op.name, op.greeting, op.systemPrompt].join(' '))).toEqual([]);
  });

  it('[Req 14.4] the only real place the backstories name is a street, never a person or a firm', () => {
    const text = BACKSTORY_OPERATORS.map((n) => OPERATORS[n]!.systemPrompt).join(' ');
    const placeNames = text.match(/\b[A-Z][a-z]+ (Street|Road|Avenue)\b/g) ?? [];
    expect(new Set(placeNames)).toEqual(new Set(['Rissik Street']));
  });
});
