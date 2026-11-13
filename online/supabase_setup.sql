-- WASATCH BACK - global score walls
-- Paste into Supabase -> SQL Editor -> New query -> Run. Safe to run twice.

create table if not exists public.scores (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  initials    text not null,
  score       integer not null,
  distance    integer not null,
  rider       text not null,
  phase       text not null default '',
  cause       text not null default '',
  -- sanity limits so the wall can't be flooded with nonsense
  constraint initials_ok check (initials ~ '^[A-Z0-9!-]{1,3}$'),
  constraint initials_clean check (initials not in (
    'ASS','FUK','FUC','FCK','FKU','SEX','KKK','NIG','NGR','FAG','CUM','DIK','DIC',
    'TIT','XXX','SHT','CNT','KYS','NAZ','JIZ','POO','PEE','WTF','STD','HOE')),
  constraint score_ok check (score between 0 and 5000000),
  constraint distance_ok check (distance between 0 and 200000),
  constraint rider_ok check (rider in ('skier','snowboarder','fourx9','river')),
  constraint phase_len check (char_length(phase) <= 40),
  constraint cause_len check (char_length(cause) <= 40)
);

create index if not exists scores_score_idx on public.scores (score desc);
create index if not exists scores_distance_idx on public.scores (distance desc);

alter table public.scores enable row level security;

-- Anyone playing can read the walls and add a run. Nobody can edit or delete
-- (you still can, from the Supabase dashboard).
drop policy if exists "read walls" on public.scores;
create policy "read walls" on public.scores for select to anon using (true);

drop policy if exists "add runs" on public.scores;
create policy "add runs" on public.scores for insert to anon with check (true);

grant select, insert on public.scores to anon;
