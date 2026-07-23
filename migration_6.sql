-- Run this in Supabase SQL Editor.
-- Bug fix: the logs table was missing an UPDATE policy, so editing an
-- existing entry's value (via the pencil icon on Daily) silently failed —
-- the request succeeded but matched zero rows, so nothing actually saved.

create policy "public update logs" on logs for update using (true);
