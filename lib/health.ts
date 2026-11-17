import 'server-only';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * Round trip to Postgres through PostgREST. supabase-js cannot send a raw SELECT 1, so this
 * counts rows in `businesses` with `head: true` (no rows transferred). That is enough database
 * activity to stop the free project pausing. The secret key bypasses RLS, so no policy is needed.
 * Callers get a plain boolean: error detail never leaves this module.
 */
export async function checkDatabase(): Promise<boolean> {
  try {
    const { error } = await supabaseServer
      .from('businesses')
      .select('id', { count: 'exact', head: true });
    return error === null;
  } catch {
    return false;
  }
}

/** Builds the JSON response shared by /api/health and the keepalive cron. */
export async function healthResponse(): Promise<Response> {
  const ok = await checkDatabase();
  const headers = { 'cache-control': 'no-store' };
  if (!ok) return Response.json({ ok: false }, { status: 503, headers });
  return Response.json({ ok: true, ts: new Date().toISOString() }, { headers });
}
