set search_path to public, extensions;

-- The business section of The Dead Pages. Seeded demo data only: every business is invented.
create table businesses (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     text not null,
  suburb       text not null,
  address      text not null,
  phone        text not null,
  -- Digits only, so a number dialled on the rotary phone finds its listing however it is printed.
  phone_digits text generated always as (regexp_replace(phone, '[^0-9]', '', 'g')) stored,
  hours        text not null,
  is_24hr      boolean not null default false,
  description  text not null,
  is_advert    boolean not null default false,
  is_spirit    boolean not null default false,
  embedding    extensions.vector(384),
  created_at   timestamptz not null default now(),
  -- Every listing number is fictional: 011 000 xxxx is not a real exchange.
  constraint businesses_phone_fictional check (phone_digits ~ '^011000[0-9]{4}$')
);

create unique index businesses_phone_digits_idx on businesses (phone_digits);

create index businesses_embedding_idx
  on businesses using hnsw (embedding extensions.vector_cosine_ops);

create index businesses_fts_idx
  on businesses
  using gin (to_tsvector('english', name || ' ' || category || ' ' || suburb || ' ' || description));

-- No policies: the browser never reads the database directly. The server uses the secret key,
-- which bypasses RLS. Supabase grants the public roles access to new tables by default, so take it back.
alter table businesses enable row level security;
revoke all on table businesses from anon, authenticated;
