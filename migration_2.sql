-- Run this in Supabase SQL Editor — adds the new bio field and daily targets
-- to your EXISTING database (safe to run once; does not touch existing data).

alter table users add column if not exists bio text;

create table if not exists daily_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  activity_type_id uuid references activity_types(id) on delete cascade,
  target_value numeric not null,
  unique (user_id, activity_type_id)
);

alter table daily_targets enable row level security;

create policy "public read daily targets" on daily_targets for select using (true);
create policy "public write daily targets" on daily_targets for insert with check (true);
create policy "public update daily targets" on daily_targets for update using (true);
