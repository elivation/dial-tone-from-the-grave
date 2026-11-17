import { z } from 'zod';

export const MAX_QUERY_CHARS = 300;

export const searchRequestSchema = z.object({
  type: z.enum(['businesses', 'residents']),
  query: z.string().max(MAX_QUERY_CHARS),
  spooky: z.boolean().optional(),
  spiritOnly: z.boolean().optional(),
});

export type SearchRequest = z.infer<typeof searchRequestSchema>;

/** Default cap on one spoken or typed message. The MAX_INPUT_CHARS env var can change it per deploy. */
export const MAX_INPUT_CHARS = 300;

/** Hard ceilings that keep a hostile body small. */
const HISTORY_CONTENT_CEILING = 2000;
const HISTORY_ENTRY_CEILING = 24;

export function createOperatorRequestSchema(maxInputChars: number) {
  return z.object({
    number: z.string().min(1).max(12),
    message: z.string().max(maxInputChars),
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
}

export const operatorRequestSchema = createOperatorRequestSchema(MAX_INPUT_CHARS);
export type OperatorRequest = z.infer<typeof operatorRequestSchema>;
