# Global score walls (HIGH SCORES + LONGEST DISTANCE)

The game has two public walls that everyone who plays sees: **HIGH SCORES** and **LONGEST DISTANCE** (top 10 each, with initials and rider). They run on a free Supabase project. Until it's configured, the game stays fully offline and the wall tabs are hidden.

## One-time setup (about 5 minutes)

1. Go to **supabase.com** → *Start your project* → sign in (GitHub sign-in works) → **New project**.
   Name it `wasatch-back`, pick any database password, choose a US West region, and use the **Free** plan.
2. When it's ready, open **SQL Editor** → *New query*, paste the whole of [`supabase_setup.sql`](supabase_setup.sql), and click **Run**.
3. Open **Project Settings → API** (or the green **Connect** button) and copy:
   - **Project URL**, e.g. `https://abcdefghijkl.supabase.co`
   - the **anon / publishable** key
4. Put both in [`scripts/data/online_config.gd`](../scripts/data/online_config.gd) and push, or send them to Claude to do it.
   GitHub Pages rebuilds the game, and the walls go live.

Both values are meant to be public: they ship inside every copy of the web game.
**Never** share the `service_role` / secret key; the game doesn't need it.

## What players can and can't do

- Read the walls, and add a run.
- They **can't** edit or delete anything. The database enforces this with row-level security.
- Rejected outright:
  - initials that aren't 1–3 letters/digits, or that are on the blocklist
  - impossible numbers
  - unknown riders
- Test bots and dev runs never post.

## Moderating

Supabase → **Table Editor** → `scores`: select a row and delete it (e.g. an obviously fake score). Its spot on the wall disappears immediately.
