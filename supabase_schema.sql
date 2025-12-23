-- Create a table for storing save games
create table save_games (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  game_state jsonb not null,
  summary text,
  turn_count integer
);

-- Set up Row Level Security (RLS)
-- For a simple single-player game without auth, we might want to allow public access
-- OR (better) use anonymous auth if possible, but for simplicity here we'll enable public access for demo purposes.
-- WARNING: In a production app with multi-user, you'd want to link saves to a user_id.

alter table save_games enable row level security;

create policy "Enable read access for all users"
on save_games for select
using (true);

create policy "Enable insert access for all users"
on save_games for insert
with check (true);

create policy "Enable delete access for all users"
on save_games for delete
using (true);

create policy "Enable update access for all users"
on save_games for update
using (true)
with check (true);
