-- Extensions live in their own schema, as Supabase recommends, so they stay out of the public API.
create schema if not exists extensions;

-- pgvector: embeddings for meaning-based search.
create extension if not exists vector with schema extensions;

-- pg_trgm: fuzzy surname matching in the white pages.
create extension if not exists pg_trgm with schema extensions;
