import { z } from 'zod';

export const MAX_QUERY_CHARS = 300;

export const searchRequestSchema = z.object({
  type: z.enum(['businesses', 'residents']),
  query: z.string().max(MAX_QUERY_CHARS),
  spooky: z.boolean().optional(),
  spiritOnly: z.boolean().optional(),
});

export type SearchRequest = z.infer<typeof searchRequestSchema>;
