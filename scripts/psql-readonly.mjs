// Runs psql against SUPABASE_DB_URL in a read-only session. The URL is split here and handed to
// psql as PG* environment variables, so psql never parses it (its URI parser trips on some
// passwords) and the connection string never appears in arguments or output.
import { spawnSync } from 'node:child_process';

const raw = process.env.SUPABASE_DB_URL;
if (!raw) {
  console.error('SUPABASE_DB_URL is not set.');
  process.exit(1);
}
let url;
try {
  url = new URL(raw);
} catch {
  console.error('SUPABASE_DB_URL is not a valid URL.');
  process.exit(1);
}
// The session pooler drops PGOPTIONS, so read-only is also set as the first command of the session.
const readOnly = ['-c', 'set session characteristics as transaction read only'];
const result = spawnSync(
  'psql',
  ['-X', '-q', '-v', 'ON_ERROR_STOP=1', ...readOnly, ...process.argv.slice(2)],
  {
    stdio: ['inherit', 'inherit', 'pipe'],
    env: {
      ...process.env,
      SUPABASE_DB_URL: '',
      PGHOST: url.hostname,
      PGPORT: url.port || '5432',
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
      PGDATABASE: url.pathname.replace(/^\//, '') || 'postgres',
      PGSSLMODE: 'require',
      PGOPTIONS: '-c default_transaction_read_only=on',
    },
  },
);
if (result.status !== 0) {
  // psql's own message can echo connection details, so only say that it failed.
  console.error('psql failed. Check SUPABASE_DB_URL in .env.local.');
}
process.exit(result.status ?? 1);
