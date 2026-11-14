// Supabase Edge Function: embed
// Accepts { text: string }, returns { embedding: number[] } using the
// built-in gte-small model (384 dimensions).
//
// Authentication: called only from server-side routes using the secret key.
// verify_jwt must be set to false in config.toml (secret keys are not JWTs).

import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Read the secret key from the new SUPABASE_SECRET_KEYS env var (JSON object).
  const secretKeysJson = Deno.env.get('SUPABASE_SECRET_KEYS');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');

  if (!secretKeysJson || !supabaseUrl) {
    return new Response('Missing environment variables', { status: 500 });
  }

  const secretKey = (JSON.parse(secretKeysJson) as Record<string, string>)['default'];
  if (!secretKey) {
    return new Response('Missing default secret key', { status: 500 });
  }

  const body = (await req.json()) as { text?: string };
  if (typeof body.text !== 'string' || body.text.trim() === '') {
    return new Response(JSON.stringify({ error: 'text is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, secretKey);

  const { data, error } = await supabase.functions.invoke('_embeddings', {
    body: { input: body.text, model: 'gte-small' },
  });

  if (error || !data) {
    return new Response(JSON.stringify({ error: 'Embedding failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ embedding: data.embedding as number[] }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
