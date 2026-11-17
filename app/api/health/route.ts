import { connection } from 'next/server';
import { healthResponse } from '@/lib/health';

export async function GET(): Promise<Response> {
  // Opts out of prerendering so the result is a live database check, never a build-time snapshot.
  await connection();
  return healthResponse();
}
