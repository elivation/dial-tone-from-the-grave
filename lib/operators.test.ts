import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { findBrandNames } from './brandNames';
import { OPERATOR_NUMBERS } from './dialPlan';
import {
  EMERGENCY_NUMBERS,
  type OperatorDefinition,
  OPERATORS,
  MAX_TURNS_PLACEHOLDER,
  TIME_PLACEHOLDER,
} from './operators';

const defs = Object.values(OPERATORS);
function op(number: string): OperatorDefinition {
  const found = OPERATORS[number];
  if (!found) throw new Error(`no operator ${number}`);
  return found;
}
const claudeOperators = defs.filter((o) => o.number !== '1313');

describe('operators', () => {
  it('[Req 3.1] defines 1023, 1026, 666 and 1313, matching the dial plan', () => {
    expect(Object.keys(OPERATORS).sort()).toEqual([...OPERATOR_NUMBERS].sort());
  });

  it('[Req 3.1] each record is keyed by its own number', () => {
    for (const [key, op] of Object.entries(OPERATORS)) expect(op.number).toBe(key);
  });

  it('[Req 2.5] no operator number is an emergency number', () => {
    for (const op of defs) expect(EMERGENCY_NUMBERS.has(op.number)).toBe(false);
  });

  it('[Req 2.5] the emergency set holds the six numbers', () => {
    expect([...EMERGENCY_NUMBERS].sort()).toEqual(['10111', '10177', '107', '112', '911', '999']);
  });

  it('[Req 3.2] all ring counts are 2 or 3', () => {
    for (const op of defs) expect([2, 3]).toContain(op.ringCount);
  });

  it('[Req 3.2] 1023 rings 3 times with both search tools; 1026 and 666 ring twice with none', () => {
    expect(op('1023').ringCount).toBe(3);
    expect(op('1023').tools).toEqual(['search_businesses', 'search_residents']);
    expect(op('1026').ringCount).toBe(2);
    expect(op('666').ringCount).toBe(2);
    expect(op('1026').tools).toEqual([]);
    expect(op('666').tools).toEqual([]);
  });

  it('[Req 3.2] voice settings are within the speech synthesis range', () => {
    for (const op of defs) {
      expect(op.voiceConfig.pitch).toBeGreaterThanOrEqual(0.5);
      expect(op.voiceConfig.pitch).toBeLessThanOrEqual(2);
      expect(op.voiceConfig.rate).toBeGreaterThanOrEqual(0.5);
      expect(op.voiceConfig.rate).toBeLessThanOrEqual(2);
      expect(op.voiceConfig.voiceHint.length).toBeGreaterThan(0);
    }
  });

  it('[Req 3.2] every operator has a name and a greeting', () => {
    for (const op of defs) {
      expect(op.name.length).toBeGreaterThan(0);
      expect(op.greeting.length).toBeGreaterThan(0);
    }
  });

  it('[Req 14.3] prompts stay in character and claim no real service', () => {
    for (const op of claudeOperators) {
      expect(op.systemPrompt).toMatch(/stay in character/i);
      expect(op.systemPrompt).toMatch(/never claim to be a real service/i);
    }
  });

  it('[Req 14.3] prompts refuse medical, legal and financial advice and unsafe requests in character', () => {
    for (const op of claudeOperators) {
      expect(op.systemPrompt).toMatch(/medical, legal or financial advice/i);
      expect(op.systemPrompt).toMatch(/refuse unsafe requests in character/i);
    }
  });

  it('[Req 14.3] prompts say the line to the living is out of order for real help', () => {
    for (const op of claudeOperators) {
      expect(op.systemPrompt).toContain('the line to the living is out of order');
    }
  });

  it('[Req 14.4] prompts ask for South African English and a Johannesburg backstory', () => {
    for (const op of claudeOperators) {
      expect(op.systemPrompt).toMatch(/South African English/);
      expect(op.systemPrompt).toMatch(/Johannesburg/);
      expect(op.systemPrompt).toMatch(/exchange/i);
    }
  });

  it('[Req 14.4] prompts cap replies at 4 sentences', () => {
    for (const op of claudeOperators)
      expect(op.systemPrompt).toMatch(/never more than 4 sentences/i);
  });

  it('[Req 3.1] the 1023 prompt carries the turn cap placeholder and the search rules', () => {
    const p = op('1023').systemPrompt;
    expect(p).toContain(MAX_TURNS_PLACEHOLDER);
    expect(p).toContain('search_businesses');
    expect(p).toContain('search_residents');
    expect(p).toMatch(/never invent listings/i);
  });

  it('[Req 3.1] the 1026 prompt accepts the Johannesburg time', () => {
    expect(op('1026').systemPrompt).toContain(TIME_PLACEHOLDER);
  });

  it('[Req 7.3] the 1313 greeting is hardcoded and has no tools', () => {
    expect(op('1313').tools).toEqual([]);
    expect(op('1313').greeting.length).toBeGreaterThan(10);
  });

  it('[Req 14.4] no prompt or greeting contains a dash or a brand name', () => {
    for (const op of defs) {
      for (const text of [op.systemPrompt, op.greeting, op.name]) {
        expect(text).not.toMatch(/[\u2013\u2014]/);
        expect(findBrandNames(text)).toEqual([]);
      }
    }
  });

  it('[Req 2.5] [P-ops] no generated number string that is an emergency number is an operator key', () => {
    fc.assert(fc.property(fc.constantFrom(...EMERGENCY_NUMBERS), (n) => !(n in OPERATORS)));
  });
});
