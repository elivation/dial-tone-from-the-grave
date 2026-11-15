set search_path to public, extensions;

-- Hybrid business search: 50% meaning, 35% words, 15% suburb.
-- A listing with no embedding yet scores 0 on meaning instead of null, so it never jumps the queue.
create function search_businesses(
  query_embedding extensions.vector(384),
  query_text      text,
  suburb_hint     text default null,
  include_spirit  boolean default false,
  spirit_only     boolean default false,
  match_count     int default 10
)
returns table (
  id uuid, name text, category text, suburb text, address text, phone text, hours text,
  is_24hr boolean, description text, is_advert boolean, is_spirit boolean, score float
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    b.id, b.name, b.category, b.suburb, b.address, b.phone, b.hours,
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

-- White pages search: the surname matters most. Spaces and case are ignored, so "Vandermerwe"
-- finds "van der Merwe", and a near miss scores by how near it is.
create function search_residents(
  query_embedding extensions.vector(384),
  surname_hint    text,
  initial_hint    text default null,
  suburb_hint     text default null,
  match_count     int default 10
)
returns table (
  id uuid, surname text, initials text, suburb text, address text, phone text, score float
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
    r.id, r.surname, r.initials, r.suburb, r.address, r.phone,
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

-- Who answers when a number from the book is dialled. One row or none.
create function lookup_number(digits text)
returns table (
  kind text, id uuid, name text, category text, suburb text, address text,
  hours text, description text, is_spirit boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  (
    select 'business', b.id, b.name, b.category, b.suburb, b.address, b.hours, b.description, b.is_spirit
    from businesses b where b.phone_digits = digits
    union all
    select 'resident', r.id, r.surname || ' ' || r.initials, null, r.suburb, r.address, null, null, false
    from residents r where r.phone_digits = digits
  )
  limit 1;
$$;

-- Server only. The searches need an embedding made with the secret key anyway.
revoke execute on function search_businesses(extensions.vector, text, text, boolean, boolean, int) from public, anon, authenticated;
revoke execute on function search_residents(extensions.vector, text, text, text, int) from public, anon, authenticated;
revoke execute on function lookup_number(text) from public, anon, authenticated;
grant execute on function search_businesses(extensions.vector, text, text, boolean, boolean, int) to service_role;
grant execute on function search_residents(extensions.vector, text, text, text, int) to service_role;
grant execute on function lookup_number(text) to service_role;
