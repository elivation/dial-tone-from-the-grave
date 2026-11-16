// Read-only smoke test of live search: `pnpm db:search-smoke`. Prints only the top listing names.
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.');
  process.exit(1);
}
const supabase = createClient(url, secret, { auth: { persistSession: false } });

async function embed(text) {
  const res = await fetch(`${url.replace(/\/$/, '')}/functions/v1/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: secret },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`embed returned ${res.status}`);
  return JSON.stringify((await res.json()).embedding);
}

let ok = true;
const check = (label, pass, detail) => {
  ok &&= pass;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}: ${detail}`);
};

async function businesses(query, args = {}) {
  const { data, error } = await supabase.rpc('search_businesses', {
    query_embedding: await embed(query || 'listing'),
    query_text: query,
    ...args,
  });
  if (error) throw new Error(`search_businesses failed (${error.code})`);
  return data;
}

const geyser = await businesses('someone to fix my geyser tonight in Edenvale', {
  suburb_hint: 'Edenvale',
});
check(
  'geyser in Edenvale finds geyser or plumbing help',
  ['Geyser repairs', 'Plumber'].includes(geyser[0]?.category),
  geyser
    .slice(0, 3)
    .map((b) => `${b.name} (${b.category}, ${b.suburb})`)
    .join('; '),
);

const gate = await businesses('my gate motor is stuck and will not open');
check(
  'gate motor finds gate motors',
  gate[0]?.category === 'Gate motors',
  gate
    .slice(0, 2)
    .map((b) => b.name)
    .join('; '),
);

const power = await businesses('load shedding backup power for my house');
check(
  'load shedding finds backup power',
  power[0]?.category === 'Generators and inverters',
  power
    .slice(0, 2)
    .map((b) => b.name)
    .join('; '),
);

check(
  'ordinary search hides spirit listings',
  geyser.every((b) => !b.is_spirit),
  `${geyser.length} results`,
);

const spooky = await businesses('a locksmith at midnight', { include_spirit: true });
check(
  'spooky search can find a spirit listing',
  spooky.some((b) => b.is_spirit),
  spooky
    .slice(0, 2)
    .map((b) => b.name)
    .join('; '),
);

// Spirit-only still needs an embedding: a zero vector makes the cosine NaN, so a fixed phrase is used.
const spirits = await businesses('haunted spirit listings', { spirit_only: true, match_count: 20 });
check(
  '1313 returns only the 12 spirit listings',
  spirits.length === 12 && spirits.every((b) => b.is_spirit),
  `${spirits.length} results`,
);

const { data: botha, error: residentError } = await supabase.rpc('search_residents', {
  query_embedding: await embed('Botha in Edenvale'),
  surname_hint: 'Bota',
});
if (residentError) throw new Error(`search_residents failed (${residentError.code})`);
check(
  'a near miss on Botha finds a Botha first',
  botha[0]?.surname === 'Botha',
  botha
    .slice(0, 3)
    .map((r) => `${r.surname} ${r.initials}`)
    .join('; '),
);

const { data: found } = await supabase.rpc('lookup_number', { digits: '0110001001' });
check(
  'dialling 011 000 1001 reaches a business',
  found?.[0]?.kind === 'business',
  found?.[0]?.name ?? 'nobody',
);
const { data: nobody } = await supabase.rpc('lookup_number', { digits: '0110009999' });
check(
  'an unused number reaches nobody',
  (nobody ?? []).length === 0,
  `${(nobody ?? []).length} rows`,
);

const { data: short } = await supabase.rpc('lookup_number', { digits: '61001' });
check(
  'dialling HO 6-1001 reaches the same business',
  short?.[0]?.name === found?.[0]?.name,
  short?.[0]?.name ?? 'nobody',
);
const { data: spiritLine } = await supabase.rpc('lookup_number', { digits: '31301' });
check(
  'dialling DU 3-1301 reaches a spirit listing',
  spiritLine?.[0]?.is_spirit === true,
  spiritLine?.[0]?.name ?? 'nobody',
);
check(
  'search results carry their dial number',
  geyser.every((b) => /^[2-9]\d{4}$/.test(b.dial_number ?? '')),
  `${geyser.length} results`,
);

process.exit(ok ? 0 : 1);
