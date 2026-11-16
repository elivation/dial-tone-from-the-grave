-- Read-only checks after a push. Run with `pnpm db:verify`, which opens a read-only session.
-- Every row starts with CHECK| so nothing else is ever shown.
\pset tuples_only on
\pset format unaligned

select 'CHECK|migration|' || version || ' ' || coalesce(name, '')
from supabase_migrations.schema_migrations order by version;

select 'CHECK|table|' || c.relname
       || ' rls=' || c.relrowsecurity
       || ' anon_select=' || has_table_privilege('anon', c.oid, 'select')
       || ' authenticated_select=' || has_table_privilege('authenticated', c.oid, 'select')
       || ' policies=' || (select count(*) from pg_policy p where p.polrelid = c.oid)
from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
order by c.relname;

select 'CHECK|function|' || p.proname
       || ' anon=' || has_function_privilege('anon', p.oid, 'execute')
       || ' authenticated=' || has_function_privilege('authenticated', p.oid, 'execute')
       || ' service_role=' || has_function_privilege('service_role', p.oid, 'execute')
from pg_proc p
where p.pronamespace = 'public'::regnamespace
order by p.proname;

select 'CHECK|extension|' || extname || ' ' || extversion || ' in ' || extnamespace::regnamespace
from pg_extension where extname in ('vector', 'pg_trgm') order by extname;

select 'CHECK|index|' || indexname from pg_indexes where schemaname = 'public' order by indexname;
