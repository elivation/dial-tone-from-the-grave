set search_path to public, extensions;

-- Every listing gets a short number to dial on the rotary phone: five digits, starting 2 to 9, so it
-- can never begin like 1023, 1026, 1313 or an emergency number starting with 1, and never starting
-- 666, 911 or 999. Printed in the book exchange style (61001 is "HO 6-1001"). It is nullable here so
-- the existing rows can be re-seeded, and made required in the next migration.
alter table businesses
  add column dial_number text
  constraint businesses_dial_number_short check (dial_number ~ '^[2-9][0-9]{4}$' and dial_number !~ '^(666|911|999)');
create unique index businesses_dial_number_idx on businesses (dial_number);

alter table residents
  add column dial_number text
  constraint residents_dial_number_short check (dial_number ~ '^[2-9][0-9]{4}$' and dial_number !~ '^(666|911|999)');
create unique index residents_dial_number_idx on residents (dial_number);

-- The searches return the dial number for the book, so their return types change. Postgres can only
-- change a return type by dropping the function and creating it again; no table is touched.
drop function search_businesses(extensions.vector, text, text, boolean, boolean, int);
drop function search_residents(extensions.vector, text, text, text, int);
drop function lookup_number(text);

create function search_businesses(
  query_embedding extensions.vector(384),
  query_text      text,
  suburb_hint     text default null,
  include_spirit  boolean default false,
  spirit_only     boolean default false,
  match_count     int default 10
)
returns table (
  id uuid, name text, category text, suburb text, address text, phone text, dial_number text, hours text,
  is_24hr boolean, description text, is_advert boolean, is_spirit boolean, score float
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    b.id, b.name, b.category, b.suburb, b.address, b.phone, b.dial_number, b.hours,
    b.is_24hr, b.description, b.is_advert, b.is_spirit,
    (
      0.50 * coalesce(1 - (b.embedding <=> query_embedding), 0)
      + 0.35 * ts_rank(
          to_tsvector('english', b.name || ' ' || b.category || ' ' || b.suburb || ' ' || b.description),
          plainto_tsquery('english', coalesce(query_text, ''))
        )
      + 0.15 * case when suburb_hint is not null and lower(b.suburb) = lower(suburb_hint) then 1.0 else 0.0 end
    )::float as score
  from businesses b
  where (spirit_only = false or b.is_spirit = true)
    and (spirit_only = true or include_spirit = true or b.is_spirit = false)
  order by score desc, b.name
  limit least(greatest(match_count, 1), 50);
$$;

create function search_residents(
  query_embedding extensions.vector(384),
  surname_hint    text,
  initial_hint    text default null,
  suburb_hint     text default null,
  match_count     int default 10
)
returns table (
  id uuid, surname text, initials text, suburb text, address text, phone text, dial_number text, score float
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with hint as (
    select regexp_replace(lower(coalesce(surname_hint, '')), '[^a-z]', '', 'g') as surname
  )
  select
    r.id, r.surname, r.initials, r.suburb, r.address, r.phone, r.dial_number,
    (
      0.40 * coalesce(1 - (r.embedding <=> query_embedding), 0)
      + 0.40 * case
                 when regexp_replace(lower(r.surname), '[^a-z]', '', 'g') = hint.surname then 1.0
                 else similarity(regexp_replace(lower(r.surname), '[^a-z]', '', 'g'), hint.surname)
               end
      + 0.10 * case when initial_hint is not null and lower(r.initials) like lower(initial_hint) || '%'
                    then 1.0 else 0.0 end
      + 0.10 * case when suburb_hint is not null and lower(r.suburb) = lower(suburb_hint)
                    then 1.0 else 0.0 end
    )::float as score
  from residents r, hint
  order by score desc, r.surname
  limit least(greatest(match_count, 1), 50);
$$;

-- Who answers a dialled number: the short dial number, or the full 011 number in digits.
create function lookup_number(digits text)
returns table (
  kind text, id uuid, name text, category text, suburb text, address text,
  hours text, description text, is_spirit boolean, dial_number text
)
language sql
stable
security invoker
set search_path = public
as $$
  (
    select 'business', b.id, b.name, b.category, b.suburb, b.address, b.hours, b.description, b.is_spirit, b.dial_number
    from businesses b where b.dial_number = digits or b.phone_digits = digits
    union all
    select 'resident', r.id, r.surname || ' ' || r.initials, null, r.suburb, r.address, null, null, false, r.dial_number
    from residents r where r.dial_number = digits or r.phone_digits = digits
  )
  limit 1;
$$;

revoke execute on function search_businesses(extensions.vector, text, text, boolean, boolean, int) from public, anon, authenticated;
revoke execute on function search_residents(extensions.vector, text, text, text, int) from public, anon, authenticated;
revoke execute on function lookup_number(text) from public, anon, authenticated;
grant execute on function search_businesses(extensions.vector, text, text, boolean, boolean, int) to service_role;
grant execute on function search_residents(extensions.vector, text, text, text, int) to service_role;
grant execute on function lookup_number(text) to service_role;
