-- Run this in Supabase SQL Editor.
-- Tracks every change to a daily target over time, so charts can show
-- what the target actually was on any given past day (a step-line),
-- instead of applying today's current target retroactively to old days.

create table daily_target_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  activity_type_id uuid references activity_types(id) on delete cascade,
  target_value numeric not null,
  effective_date date not null default current_date,
  created_at timestamptz default now()
);

alter table daily_target_history enable row level security;

create policy "public read target history" on daily_target_history for select using (true);
create policy "public write target history" on daily_target_history for insert with check (true);

-- Seed history with whatever targets are currently set, dated today.
-- (We don't know exactly when these were originally set, so this is the
-- honest starting point — charts won't show a target line for days before
-- today until this runs, which is correct since we don't have that history.)
insert into daily_target_history (user_id, activity_type_id, target_value, effective_date)
select user_id, activity_type_id, target_value, current_date from daily_targets;
