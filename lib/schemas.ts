import { z } from 'zod';

export const MAX_QUERY_CHARS = 300;

export const searchRequestSchema = z.object({
  type: z.enum(['businesses', 'residents']),
  query: z.string().max(MAX_QUERY_CHARS),
  spooky: z.boolean().optional(),
  spiritOnly: z.boolean().optional(),
});

export type SearchRequest = z.infer<typeof searchRequestSchema>;

/** Hard ceilings that keep a hostile body small. The configurable MAX_INPUT_CHARS is checked in the route. */
const BODY_MESSAGE_CEILING = 2000;
const HISTORY_CONTENT_CEILING = 2000;
const HISTORY_ENTRY_CEILING = 24;

export const operatorRequestSchema = z.object({
  number: z.string().min(1).max(12),
  message: z.string().max(BODY_MESSAGE_CEILING),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(HISTORY_CONTENT_CEILING),
      }),
    )
    .max(HISTORY_ENTRY_CEILING),
  turnIndex: z.number().int().min(0).max(1000),
});

export type OperatorRequest = z.infer<typeof operatorRequestSchema>;
