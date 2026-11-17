import type Anthropic from '@anthropic-ai/sdk';
import { MAX_TURNS_PLACEHOLDER, TIME_PLACEHOLDER, type OperatorDefinition } from '@/lib/operators';

export const DEFAULT_MODEL = 'claude-haiku-5-5';
export const MAX_TOKENS = 300;

export const BUSY_MESSAGE = 'All lines are busy, please try later.';
export const TURN_CAP_GOODBYE =
  'The line is fading now. Goodnight, caller, and mind the cables on your way out.';

const FINAL_TURN_INSTRUCTION =
  'This is the final turn of the call. Say goodbye in character, in one or two sentences, and do not ask a question.';

/** Wall clock in Johannesburg as HH:MM, so the speaking clock is right whatever the server timezone. */
export function johannesburgTime(now: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Johannesburg',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
}

export function buildSystemPrompt(
  operator: OperatorDefinition,
  options: { maxTurns: number; finalTurn: boolean; now: Date },
): string {
  const prompt = operator.systemPrompt
    .replaceAll(MAX_TURNS_PLACEHOLDER, String(options.maxTurns))
    .replaceAll(TIME_PLACEHOLDER, johannesburgTime(options.now));
  return options.finalTurn ? `${prompt}\n${FINAL_TURN_INSTRUCTION}` : prompt;
}

export const TOOL_DEFINITIONS: Record<'search_businesses' | 'search_residents', Anthropic.Tool> = {
  search_businesses: {
    name: 'search_businesses',
    description: 'Search the Dead Pages business directory for shops, services or tradespeople.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What the caller is looking for, in their words.' },
        suburb: { type: 'string', description: 'Suburb or area mentioned by the caller, if any.' },
        spooky: {
          type: 'boolean',
          description: 'True if the query sounds supernatural or spooky.',
        },
      },
      required: ['query'],
    },
  },
  search_residents: {
    name: 'search_residents',
    description: 'Search the Dead Pages white pages for a resident by name.',
    input_schema: {
      type: 'object',
      properties: {
        surname: { type: 'string', description: 'Surname to search for.' },
        initial: { type: 'string', description: 'First name or initial, if given.' },
        suburb: { type: 'string', description: 'Suburb or area, if given.' },
      },
      required: ['surname'],
    },
  },
};
