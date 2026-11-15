set search_path to public, extensions;

-- One row per hashed IP per hour, and one row per day for the global Claude cap.
-- The id is "ip:{sha256 prefix}:{epoch hour}" or "global:{yyyy-mm-dd}". Raw IPs are never stored.
create table rate_limits (
  id             text primary key,
  ip_hash        text,
  window_start   timestamptz,
  operator_count int not null default 0,
  search_count   int not null default 0,
  date           date,
  claude_count   int not null default 0,
  updated_at     timestamptz not null default now()
);

alter table rate_limits enable row level security;
revoke all on table rate_limits from anon, authenticated;

-- Adds one to a counter and returns the new count, in one statement, so two requests at the same
-- moment cannot both read the old value.
create function increment_rate_limit(
  p_id           text,
  p_field        text,
  p_window_start timestamptz default null,
  p_date         date default null
)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_count int;
begin
  if p_field not in ('operator_count', 'search_count', 'claude_count') then
    raise exception 'unknown rate limit counter: %', p_field;
  end if;

  insert into rate_limits as r (id, ip_hash, window_start, date, operator_count, search_count, claude_count)
  values (
    p_id,
    case when p_id like 'ip:%' then split_part(p_id, ':', 2) end,
    p_window_start,
    p_date,
    case when p_field = 'operator_count' then 1 else 0 end,
    case when p_field = 'search_count' then 1 else 0 end,
    case when p_field = 'claude_count' then 1 else 0 end
  )
  on conflict (id) do update
    set operator_count = r.operator_count + case when p_field = 'operator_count' then 1 else 0 end,
        search_count   = r.search_count   + case when p_field = 'search_count'   then 1 else 0 end,
        claude_count   = r.claude_count   + case when p_field = 'claude_count'   then 1 else 0 end,
        updated_at     = now()
  returning case p_field
              when 'operator_count' then r.operator_count
              when 'search_count' then r.search_count
              else r.claude_count
            end
  into new_count;

  return new_count;
end;
$$;

-- Only the server may count. Anyone else could otherwise use up the daily cap.
revoke execute on function increment_rate_limit(text, text, timestamptz, date) from public, anon, authenticated;
grant execute on function increment_rate_limit(text, text, timestamptz, date) to service_role;
