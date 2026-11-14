// This import ensures this module cannot be bundled into client-side code.
import 'server-only';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const secretKey = process.env['SUPABASE_SECRET_KEY'];

if (!supabaseUrl || !secretKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY environment variables.');
}

/**
 * Server-only Supabase client using the secret key (sb_secret_...).
 * The secret key bypasses Row Level Security and has full data access.
 * Never import this in client components or pages.
 * The server-only guard causes a build error if you try.
 *
 * Note: secret keys are not JWTs. Send them on the apikey header only
 * (the Supabase JS client does this automatically via createClient).
 */
export const supabaseServer = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false },
});
