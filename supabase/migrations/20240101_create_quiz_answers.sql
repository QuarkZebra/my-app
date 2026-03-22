-- Run this SQL in your Supabase dashboard under SQL Editor.
--
-- Creates the quiz_answers table to store each time a user
-- submits an answer on the 310S prep quiz page.

create table if not exists public.quiz_answers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  topic text not null,
  question_text text not null,
  user_answer text not null,        -- e.g. "A", "B", "C", "D"
  correct_answer text not null,     -- e.g. "A"
  confidence_level integer not null, -- the confidence slider value (0-100) for the chosen answer
  is_correct boolean not null,
  created_at timestamptz default now() not null
);

-- Row Level Security: users can only see and insert their own records.
alter table public.quiz_answers enable row level security;

create policy "Users can insert own quiz answers"
  on public.quiz_answers
  for insert
  with check (auth.uid() = user_id);

create policy "Users can view own quiz answers"
  on public.quiz_answers
  for select
  using (auth.uid() = user_id);
