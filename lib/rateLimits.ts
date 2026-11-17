import 'server-only';
import { createHash } from 'node:crypto';
import { supabaseServer } from '@/lib/supabase-server';

const HOUR_MS = 3_600_000;

/** A count after increment is allowed up to and including the limit. */
export function checkRateLimit(count: number, limit: number): 'allowed' | 'denied' {
  return count > limit ? 'denied' : 'allowed';
}

type CounterField = 'operator_count' | 'search_count' | 'claude_count';

/** Reads a positive integer from the environment, or the fallback when unset or invalid. */
export function envInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** SHA-256 of the first forwarded address, first 16 hex chars. The raw IP is never stored. */
function hashIp(req: Request): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

/** Adds one to this IP's counter for the current hour. Returns null if the store fails. */
export async function bumpIpCounter(req: Request, field: CounterField): Promise<number | null> {
  const hour = Math.floor(Date.now() / HOUR_MS);
  const { data, error } = await supabaseServer.rpc('increment_rate_limit', {
    p_id: `ip:${hashIp(req)}:${hour}`,
    p_field: field,
    p_window_start: new Date(hour * HOUR_MS).toISOString(),
  });
  return error || typeof data !== 'number' ? null : data;
}

/** Adds one to today's global Claude counter (UTC day). Returns null if the store fails. */
export async function bumpGlobalClaudeCounter(): Promise<number | null> {
  const date = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseServer.rpc('increment_rate_limit', {
    p_id: `global:${date}`,
    p_field: 'claude_count',
    p_date: date,
  });
  return error || typeof data !== 'number' ? null : data;
}
