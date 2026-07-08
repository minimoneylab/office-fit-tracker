-- Run this once in Supabase → SQL Editor

create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  photo_url text,
  created_at timestamptz default now()
);

create table activity_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null,        -- e.g. "times", "seconds", "litres"
  icon text default '💪',
  active boolean default true,
  created_at timestamptz default now()
);

create table logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  activity_type_id uuid references activity_types(id) on delete cascade,
  value numeric not null,
  log_date date not null default current_date,
  created_at timestamptz default now()
);

create table weekly_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  activity_type_id uuid references activity_types(id) on delete cascade,
  target_value numeric not null,
  unique (user_id, activity_type_id)
);

-- Starter activities (edit/add more from the Users Registration page)
insert into activity_types (name, unit, icon) values
  ('Squat', 'times', '🏋️'),
  ('Plank', 'seconds', '🧘'),
  ('Water', 'litres', '💧');

-- Row Level Security
-- This app has no login, so we open read/write to the anon key.
-- That's fine for a small internal team tool, but do NOT put sensitive
-- data in this database, and don't share the URL/key publicly.
alter table users enable row level security;
alter table activity_types enable row level security;
alter table logs enable row level security;
alter table weekly_targets enable row level security;

create policy "public read users" on users for select using (true);
create policy "public write users" on users for insert with check (true);
create policy "public delete users" on users for delete using (true);

create policy "public read activity_types" on activity_types for select using (true);
create policy "public write activity_types" on activity_types for insert with check (true);
create policy "public update activity_types" on activity_types for update using (true);

create policy "public read logs" on logs for select using (true);
create policy "public write logs" on logs for insert with check (true);
create policy "public delete logs" on logs for delete using (true);

create policy "public read targets" on weekly_targets for select using (true);
create policy "public write targets" on weekly_targets for insert with check (true);
create policy "public update targets" on weekly_targets for update using (true);

-- ─────────────────────────────────────────────────────────
-- Photo uploads (Storage)
-- After creating a PUBLIC bucket named "avatars" in the Storage tab,
-- run this so the site (using the anon key) is allowed to upload to it.
-- ─────────────────────────────────────────────────────────
create policy "public upload avatars" on storage.objects
  for insert with check (bucket_id = 'avatars');

create policy "public read avatars" on storage.objects
  for select using (bucket_id = 'avatars');

