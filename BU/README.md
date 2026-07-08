# CA Trading Team — Atomic Habit Tracker

A small internal site for the team to log daily exercise (squats, plank, water — or anything you add), and see weekly progress vs targets.

Static frontend (hosted free on GitHub Pages) + [Supabase](https://supabase.com) as the database (free tier).

## Setup (15 minutes, one-time)

1. **Create a Supabase project**
   - Go to https://supabase.com → New project (free tier is enough for a team this size).

2. **Create the tables**
   - In your Supabase project, open **SQL Editor** → paste the contents of `schema.sql` → Run.
   - This creates `users`, `activity_types`, `logs`, `weekly_targets`, and seeds Squat / Plank / Water.

3. **Get your API keys**
   - Project Settings → API → copy the **Project URL** and the **anon public key**.

4. **Connect the site**
   - Open `js/supabase-client.js` and paste your URL and key into `SUPABASE_URL` / `SUPABASE_ANON_KEY`.

5. **Push to GitHub and enable Pages**
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your repo url>
   git push -u origin main
   ```
   Then in the repo: Settings → Pages → Deploy from branch → `main` / root.

6. Visit the Pages URL — done.

## Adding teammates and activities

Use the **Users Registration** page in the site itself — no code changes needed to add a new teammate or a new activity type (e.g. Push-up, Pull-up, Stretch — any name/unit combo).

## Notes on security

There's no login — anyone with the link can log activity as anyone (matches "click your name" request). The database uses the public `anon` key with open read/write policies, which is fine for a small trusted internal team, but:
- Don't put anything sensitive in this database.
- Don't publish the repo/site link outside the team if you'd rather keep entries private.
- If you later want per-person login, Supabase Auth can be added without changing the schema much — just ask.

## Structure

```
index.html      Daily — click your card, log activities, see today's summary
weekly.html     Weekly — bar chart of actual per day + cumulative vs target
stats.html      Stats — team totals and leaderboards for the week
register.html   Users Registration — add teammates, add/manage activity types
css/style.css   Shared styling
js/             Page logic + Supabase client config
schema.sql      Database schema to run once in Supabase
```
