import 'server-only';
import { supabaseServer } from '@/lib/supabase-server';
import { embedText } from '@/lib/embed';
import type { Database } from '@/lib/database.types';

export type BusinessResult =
  Database['public']['Functions']['search_businesses']['Returns'][number];
export type ResidentResult = Database['public']['Functions']['search_residents']['Returns'][number];

type BusinessSearch = {
  text: string;
  suburb?: string | undefined;
  includeSpirit?: boolean | undefined;
  spiritOnly?: boolean | undefined;
};

type ResidentSearch = {
  surname: string;
  initial?: string | undefined;
  suburb?: string | undefined;
};

/** Both searches throw on failure so each route can answer in its own voice. */
export async function searchBusinesses(search: BusinessSearch): Promise<BusinessResult[]> {
  const query_embedding = JSON.stringify(await embedText(search.text));
  const { data, error } = await supabaseServer.rpc('search_businesses', {
    query_embedding,
    query_text: search.text,
    include_spirit: Boolean(search.includeSpirit),
    spirit_only: Boolean(search.spiritOnly),
    ...(search.suburb ? { suburb_hint: search.suburb } : {}),
  });
  if (error) throw new Error('search_businesses failed');
  return data ?? [];
}

export async function searchResidents(search: ResidentSearch): Promise<ResidentResult[]> {
  const query_embedding = JSON.stringify(await embedText(search.surname));
  const { data, error } = await supabaseServer.rpc('search_residents', {
    query_embedding,
    surname_hint: search.surname,
    ...(search.initial ? { initial_hint: search.initial } : {}),
    ...(search.suburb ? { suburb_hint: search.suburb } : {}),
  });
  if (error) throw new Error('search_residents failed');
  return data ?? [];
}
