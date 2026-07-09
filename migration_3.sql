-- Run this in Supabase SQL Editor.
-- Bug fix: the users table was missing an UPDATE policy, so editing
-- an existing teammate's name/bio/photo was silently failing.

create policy "public update users" on users for update using (true);
