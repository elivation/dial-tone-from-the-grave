// Deploys one Edge Function to our project: `pnpm fn:deploy embed`.
// The project ref is read from NEXT_PUBLIC_SUPABASE_URL (public anyway). SUPABASE_ACCESS_TOKEN reaches
// the CLI through the environment only, never as an argument, and the CLI's own output is not shown,
// only whether it worked.
import { spawnSync } from 'node:child_process';

const name = process.argv[2];
if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error('Usage: pnpm fn:deploy <function-name>');
  process.exit(1);
}
const ref = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname.split('.')[0];
  } catch {
    return '';
  }
})();
if (!/^[a-z0-9]{20}$/.test(ref ?? '')) {
  console.error('NEXT_PUBLIC_SUPABASE_URL does not look like a Supabase project URL.');
  process.exit(1);
}
if (!process.env.SUPABASE_ACCESS_TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN is not set.');
  process.exit(1);
}
const result = spawnSync(
  'supabase',
  ['functions', 'deploy', name, '--use-api', `--remote=${ref}`, '--yes'],
  { encoding: 'utf8', env: { ...process.env, SUPABASE_DB_URL: '' } },
);
const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
if (result.status === 0) {
  console.log(`Deployed ${name}.`);
} else {
  // Only known, safe phrases are reported. The raw output can carry request details.
  const known = ['Unauthorized', 'Forbidden', 'not found', 'bundle', 'Entrypoint', 'quota'];
  const seen = known.filter((k) => output.toLowerCase().includes(k.toLowerCase()));
  console.error(`Deploy of ${name} failed${seen.length ? ` (${seen.join(', ')})` : ''}.`);
}
process.exit(result.status ?? 1);
