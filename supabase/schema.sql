-- DistroLearn — Supabase Schema
-- Run this in the Supabase SQL Editor to set up all tables, RLS policies,
-- and the add_xp RPC function.

-- ─── Extensions ───────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";

-- ─── Tables ───────────────────────────────────────────────────────────────────

-- Card content (the question bank — seeded from qbank JSON)
create table if not exists public.cards (
  id         text primary key,          -- e.g. 'rep-001'
  front      text not null,
  back       text not null,
  topic      text not null,
  subtopic   text not null,
  level      text not null default 'L1' -- 'L1'–'L5'
);

-- Per-user SM-2 spaced repetition state
create table if not exists public.card_sm2 (
  card_id     text not null references public.cards(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  easiness    numeric not null default 2.5,
  interval    integer not null default 1,
  repetitions integer not null default 0,
  next_review date not null default current_date,
  last_quality integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (card_id, user_id)
);

-- Per-user XP, level and streak
create table if not exists public.user_progress (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  total_xp       integer not null default 0,
  level          integer not null default 1,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_review_date date
);

-- Review sessions log
create table if not exists public.review_sessions (
  id             text primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  topic          text,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,
  xp_earned      integer not null default 0,
  cards_reviewed integer not null default 0
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table public.cards enable row level security;
alter table public.card_sm2 enable row level security;
alter table public.user_progress enable row level security;
alter table public.review_sessions enable row level security;

-- cards: readable by all authenticated users
create policy "cards_read" on public.cards
  for select to authenticated using (true);

-- card_sm2: users can only see and write their own rows
create policy "card_sm2_select" on public.card_sm2
  for select to authenticated using (auth.uid() = user_id);

create policy "card_sm2_upsert" on public.card_sm2
  for insert to authenticated with check (auth.uid() = user_id);

create policy "card_sm2_update" on public.card_sm2
  for update to authenticated using (auth.uid() = user_id);

-- user_progress: own row only
create policy "progress_select" on public.user_progress
  for select to authenticated using (auth.uid() = user_id);

create policy "progress_upsert" on public.user_progress
  for insert to authenticated with check (auth.uid() = user_id);

create policy "progress_update" on public.user_progress
  for update to authenticated using (auth.uid() = user_id);

-- review_sessions: own rows only
create policy "sessions_select" on public.review_sessions
  for select to authenticated using (auth.uid() = user_id);

create policy "sessions_insert" on public.review_sessions
  for insert to authenticated with check (auth.uid() = user_id);

-- ─── RPC: add_xp ──────────────────────────────────────────────────────────────
-- Called by the app after each session to update remote XP + streak.

create or replace function public.add_xp(
  p_user_id uuid,
  p_xp      integer,
  p_streak  integer
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.user_progress (user_id, total_xp, level, current_streak, longest_streak)
  values (
    p_user_id,
    p_xp,
    greatest(1, p_xp / 400 + 1),
    p_streak,
    p_streak
  )
  on conflict (user_id) do update set
    total_xp       = public.user_progress.total_xp + p_xp,
    level          = greatest(1, (public.user_progress.total_xp + p_xp) / 400 + 1),
    current_streak = p_streak,
    longest_streak = greatest(public.user_progress.longest_streak, p_streak),
    last_review_date = current_date;
end;
$$;
