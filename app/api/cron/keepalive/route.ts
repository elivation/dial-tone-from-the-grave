import { createHash, timingSafeEqual } from 'node:crypto';
import { healthResponse } from '@/lib/health';

const sha256 = (value: string) => createHash('sha256').update(value).digest();

/** Hashing first gives equal-length buffers, so timingSafeEqual never throws and length does not leak. */
function bearerMatches(header: string | null, secret: string): boolean {
  if (secret === '' || header === null) return false;
  return timingSafeEqual(sha256(header), sha256(`Bearer ${secret}`));
}

// Calls the shared health helper directly. An HTTP hop to /api/health would add a failure mode
// and need an absolute URL, and the cron route already runs in the same deployment.
export async function GET(req: Request): Promise<Response> {
  const secret = process.env['CRON_SECRET'] ?? '';
  if (!bearerMatches(req.headers.get('authorization'), secret)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  return healthResponse();
}
