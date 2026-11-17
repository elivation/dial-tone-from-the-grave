import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { SPIRIT_EMBED_PHRASE } from '@/lib/embed';
import {
  searchBusinesses,
  searchResidents,
  type BusinessResult,
  type ResidentResult,
} from '@/lib/listingSearch';
import { OPERATORS, type OperatorDefinition } from '@/lib/operators';
import {
  BUSY_MESSAGE,
  DEFAULT_MODEL,
  MAX_TOKENS,
  TOOL_DEFINITIONS,
  TURN_CAP_GOODBYE,
  buildSystemPrompt,
} from '@/lib/operatorPrompt';
import { bumpGlobalClaudeCounter, bumpIpCounter, checkRateLimit, envInt } from '@/lib/rateLimits';
import {
  createOperatorRequestSchema,
  MAX_INPUT_CHARS,
  MAX_QUERY_CHARS,
  type OperatorRequest,
} from '@/lib/schemas';
import { isSpookyQuery } from '@/lib/spooky';

// Vercel Pro allows long streams. Cache Components rejects `runtime` but this option is accepted.
export const maxDuration = 60;

const DEFAULT_MAX_TURNS = 6;
const DEFAULT_IP_LIMIT = 20;
const DEFAULT_GLOBAL_CAP = 500;
/** One search then the spoken answer. A second search is allowed, a third never is. */
const MAX_TOOL_ROUNDS = 2;
const SPIRIT_LINE = '1313';

type Listing = BusinessResult | ResidentResult;

type SseEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool_start'; tool: 'search_businesses' | 'search_residents'; query: string }
  | { type: 'tool_result'; results: Listing[] }
  | { type: 'done' }
  | { type: 'error'; code: 'turn_cap' | 'operator_down' };

type Send = (event: SseEvent) => void;

const businessInput = z.object({
  query: z.string().trim().min(1).max(MAX_QUERY_CHARS),
  suburb: z.string().trim().max(100).optional(),
  spooky: z.boolean().optional(),
});
const residentInput = z.object({
  surname: z.string().trim().min(1).max(100),
  initial: z.string().trim().max(30).optional(),
  suburb: z.string().trim().max(100).optional(),
});

const json = (status: number, body: unknown) => Response.json(body, { status });
const busy = () => json(429, { error: 'rate_limited', message: BUSY_MESSAGE });

function sseResponse(run: (send: Send) => Promise<void>): Response {
  const encoder = new TextEncoder();
  let open = true;
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: Send = (event) => {
        if (open) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        await run(send);
      } catch (error) {
        console.error('operator stream failed:', error instanceof Error ? error.name : 'unknown');
        send({ type: 'error', code: 'operator_down' });
      }
      if (open) controller.close();
    },
    cancel() {
      open = false;
    },
  });
  return new Response(body, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}

/** The model has to alternate roles, starting with the caller and ending with the operator. */
function historyIsOrdered(history: OperatorRequest['history']): boolean {
  return (
    history.every((turn, i) => turn.role === (i % 2 === 0 ? 'user' : 'assistant')) &&
    history.length % 2 === 0
  );
}

function compactForModel(listings: Listing[]): string {
  if (listings.length === 0) {
    return 'No listings found. Tell the caller in character that nothing matched, and suggest a broader search, such as a nearby suburb or a different kind of service.';
  }
  return JSON.stringify(
    listings.map((listing) => {
      if ('name' in listing) {
        const { name, category, suburb, address, phone, hours, description } = listing;
        return { name, category, suburb, address, phone, hours, description };
      }
      const { initials, surname, suburb, address, phone } = listing;
      return { initials, surname, suburb, address, phone };
    }),
  );
}

async function runTool(
  operator: OperatorDefinition,
  use: Anthropic.ToolUseBlock,
  send: Send,
): Promise<Anthropic.ToolResultBlockParam> {
  const failure = (content: string): Anthropic.ToolResultBlockParam => ({
    type: 'tool_result',
    tool_use_id: use.id,
    content,
    is_error: true,
  });
  const allowed = operator.tools.find((tool) => tool === use.name);
  try {
    if (allowed === 'search_businesses') {
      const input = businessInput.safeParse(use.input);
      if (!input.success) return failure('The search was not understood.');
      send({ type: 'tool_start', tool: allowed, query: input.data.query });
      const results = await searchBusinesses({
        text: input.data.query,
        suburb: input.data.suburb,
        includeSpirit: Boolean(input.data.spooky) || isSpookyQuery(input.data.query),
      });
      send({ type: 'tool_result', results });
      return { type: 'tool_result', tool_use_id: use.id, content: compactForModel(results) };
    }
    if (allowed === 'search_residents') {
      const input = residentInput.safeParse(use.input);
      if (!input.success) return failure('The search was not understood.');
      send({ type: 'tool_start', tool: allowed, query: input.data.surname });
      const results = await searchResidents(input.data);
      send({ type: 'tool_result', results });
      return { type: 'tool_result', tool_use_id: use.id, content: compactForModel(results) };
    }
    return failure('That tool is not available on this line.');
  } catch {
    return failure(
      'The directory is unavailable right now. Tell the caller so, in character, and apologise. Do not search again.',
    );
  }
}

/** Only the blocks the next request needs. Echoing whole response blocks risks unknown fields. */
function toAssistantParam(content: Anthropic.ContentBlock[]): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] = [];
  for (const block of content) {
    if (block.type === 'text' && block.text !== '') blocks.push({ type: 'text', text: block.text });
    if (block.type === 'tool_use') {
      blocks.push({ type: 'tool_use', id: block.id, name: block.name, input: block.input });
    }
  }
  return blocks;
}

async function converse(
  operator: OperatorDefinition,
  request: OperatorRequest,
  maxTurns: number,
  apiKey: string,
  signal: AbortSignal,
  send: Send,
): Promise<void> {
  const client = new Anthropic({ apiKey });
  const system = buildSystemPrompt(operator, {
    maxTurns,
    finalTurn: request.turnIndex === maxTurns - 1,
    now: new Date(),
  });
  const tools = operator.tools.map((name) => TOOL_DEFINITIONS[name]);
  const messages: Anthropic.MessageParam[] = [
    ...request.history,
    { role: 'user', content: request.message },
  ];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const stream = client.messages.stream(
      {
        model: process.env['ANTHROPIC_MODEL'] || DEFAULT_MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages,
        ...(tools.length > 0 && round < MAX_TOOL_ROUNDS ? { tools } : {}),
      },
      { signal },
    );
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        send({ type: 'delta', text: event.delta.text });
      }
    }
    const final = await stream.finalMessage();
    const uses = final.content.filter((block) => block.type === 'tool_use');
    if (final.stop_reason !== 'tool_use' || uses.length === 0) break;

    messages.push({ role: 'assistant', content: toAssistantParam(final.content) });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const use of uses) results.push(await runTool(operator, use, send));
    messages.push({ role: 'user', content: results });
  }
  send({ type: 'done' });
}

export async function POST(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(400, { error: 'invalid_body' });
  }
  const parsed = createOperatorRequestSchema(envInt('MAX_INPUT_CHARS', MAX_INPUT_CHARS)).safeParse(
    raw,
  );
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some(
      (issue) => issue.code === 'too_big' && issue.path.join('.') === 'message',
    );
    return json(400, { error: tooLong ? 'input_too_long' : 'invalid_body' });
  }
  const request = parsed.data;

  const operator = Object.hasOwn(OPERATORS, request.number) ? OPERATORS[request.number] : undefined;
  if (!operator) return json(400, { error: 'invalid_number' });

  const isSpiritLine = operator.number === SPIRIT_LINE;
  if (!isSpiritLine && (request.message.trim() === '' || !historyIsOrdered(request.history))) {
    return json(400, { error: 'invalid_body' });
  }

  const maxTurns = envInt('MAX_TURNS_PER_CALL', DEFAULT_MAX_TURNS);
  if (!isSpiritLine && request.turnIndex >= maxTurns) {
    return sseResponse(async (send) => {
      send({ type: 'delta', text: TURN_CAP_GOODBYE });
      send({ type: 'error', code: 'turn_cap' });
    });
  }

  // Limits are checked before anything that costs money.
  const ipCount = await bumpIpCounter(req, 'operator_count');
  if (ipCount === null) return json(500, { error: 'operator_down' });
  if (
    checkRateLimit(ipCount, envInt('OPERATOR_LIMIT_PER_IP_PER_HOUR', DEFAULT_IP_LIMIT)) === 'denied'
  ) {
    return busy();
  }

  if (isSpiritLine) {
    try {
      const results = await searchBusinesses({
        text: SPIRIT_EMBED_PHRASE,
        includeSpirit: true,
        spiritOnly: true,
      });
      return sseResponse(async (send) => {
        send({ type: 'delta', text: operator.greeting });
        send({ type: 'tool_result', results });
        send({ type: 'done' });
      });
    } catch {
      return json(500, { error: 'operator_down' });
    }
  }

  const globalCount = await bumpGlobalClaudeCounter();
  if (globalCount === null) return json(500, { error: 'operator_down' });
  if (
    checkRateLimit(globalCount, envInt('CLAUDE_DAILY_GLOBAL_CAP', DEFAULT_GLOBAL_CAP)) === 'denied'
  ) {
    return busy();
  }

  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) return json(500, { error: 'operator_down' });

  return sseResponse((send) => converse(operator, request, maxTurns, apiKey, req.signal, send));
}
