-- Run this in Supabase SQL Editor.
-- Adds a messages table so teammates can post short supportive notes
-- to each other's (or their own) board on the Daily page.

create table messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references users(id) on delete cascade,
  recipient_id uuid references users(id) on delete cascade,
  message text not null,
  created_at timestamptz default now()
);

alter table messages enable row level security;

create policy "public read messages" on messages for select using (true);
create policy "public write messages" on messages for insert with check (true);
create policy "public delete messages" on messages for delete using (true);
