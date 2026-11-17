import 'server-only';
import { supabaseServer } from '@/lib/supabase-server';
import type { ListingRow } from '@/lib/listingGhost';

/** Who answers a dialled number, or null if nobody does. Throws if the database fails. */
export async function lookupListing(digits: string): Promise<ListingRow | null> {
  const { data, error } = await supabaseServer.rpc('lookup_number', { digits });
  if (error) throw new Error('lookup_number failed');
  return data?.[0] ?? null;
}
