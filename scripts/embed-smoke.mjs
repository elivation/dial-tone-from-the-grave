// Smoke test for the deployed embed function: `pnpm fn:smoke`. Prints only status codes and sizes.
const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!base || !secret || !publishable) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
  );
  process.exit(1);
}
const url = `${base.replace(/\/$/, '')}/functions/v1/embed`;
const call = (headers, body = { text: 'someone to fix my geyser tonight in Edenvale' }) =>
  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

let ok = true;
const check = (label, pass, detail) => {
  ok &&= pass;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}: ${detail}`);
};

const withSecret = await call({ apikey: secret });
const body = withSecret.ok ? await withSecret.json() : null;
const size = Array.isArray(body?.embedding) ? body.embedding.length : 0;
check(
  'secret key gets an embedding',
  withSecret.status === 200 && size === 384,
  `status ${withSecret.status}, ${size} numbers`,
);
if (size === 384) {
  const length = Math.hypot(...body.embedding);
  check('embedding is normalised', Math.abs(length - 1) < 1e-3, `length ${length.toFixed(4)}`);
}

const withoutKey = await call({});
check('no key is refused', withoutKey.status === 401, `status ${withoutKey.status}`);

const withPublishable = await call({ apikey: publishable });
check(
  'publishable key is refused',
  withPublishable.status === 401,
  `status ${withPublishable.status}`,
);

const blank = await call({ apikey: secret }, { text: '   ' });
check('blank text is refused', blank.status === 400, `status ${blank.status}`);

// Meaning: a geyser problem should sit nearer a plumber than a pharmacy.
const vectorOf = async (text) =>
  (await (await call({ apikey: secret }, { text })).json()).embedding;
const [query, plumber, pharmacy] = await Promise.all([
  vectorOf('my geyser burst and there is water everywhere'),
  vectorOf('Plumber. Burst geysers and leaking pipes fixed day and night.'),
  vectorOf('Pharmacy. Prescriptions, vitamins and baby care.'),
]);
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const near = dot(query, plumber);
const far = dot(query, pharmacy);
check(
  'meaning: geyser is nearer plumber than pharmacy',
  near > far,
  `${near.toFixed(3)} vs ${far.toFixed(3)}`,
);

process.exit(ok ? 0 : 1);
