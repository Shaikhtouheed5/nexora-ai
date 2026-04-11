-- Run this in your Supabase SQL Editor

create table if not exists scenario_cache (
  id          uuid primary key default gen_random_uuid(),
  cache_key   text not null,
  payload     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_scenario_cache_key_created
  on scenario_cache (cache_key, created_at desc);
