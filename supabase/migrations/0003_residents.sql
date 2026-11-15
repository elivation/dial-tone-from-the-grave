set search_path to public, extensions;

-- The white pages. Every resident is invented: no real people.
create table residents (
  id           uuid primary key default gen_random_uuid(),
  surname      text not null,
  initials     text not null,
  suburb       text not null,
  address      text not null,
  phone        text not null,
  phone_digits text generated always as (regexp_replace(phone, '[^0-9]', '', 'g')) stored,
  embedding    extensions.vector(384),
  created_at   timestamptz not null default now(),
  constraint residents_phone_fictional check (phone_digits ~ '^011000[0-9]{4}$')
);

create unique index residents_phone_digits_idx on residents (phone_digits);

create index residents_embedding_idx
  on residents using hnsw (embedding extensions.vector_cosine_ops);

create index residents_surname_idx on residents (lower(surname) text_pattern_ops);

create index residents_surname_trgm_idx
  on residents using gin (lower(surname) extensions.gin_trgm_ops);

alter table residents enable row level security;
revoke all on table residents from anon, authenticated;
