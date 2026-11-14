import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const publishableKey = process.env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];

if (!supabaseUrl || !publishableKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variables.',
  );
}

/**
 * Browser-safe Supabase client. Uses the publishable key (sb_publishable_...).
 * The publishable key carries the same low privileges as the legacy anon key.
 * RLS policies still enforce access.
 * Safe to import in client components.
 */
export const supabase = createClient(supabaseUrl, publishableKey);
