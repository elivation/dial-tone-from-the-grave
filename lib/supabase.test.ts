import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('[Req 10.5, 10.10] Supabase browser client', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test-project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test-key');
  });

  it('creates a client with the publishable key', async () => {
    const { supabase } = await import('./supabase');
    expect(supabase).toBeDefined();
    expect(typeof supabase.from).toBe('function');
  });

  it('throws when NEXT_PUBLIC_SUPABASE_URL is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    await expect(import('./supabase')).rejects.toThrow('Missing NEXT_PUBLIC_SUPABASE_URL');
  });
});
