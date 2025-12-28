-- Create a table for storing save games
create table save_games (
  id uuid default gen_random_uuid(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  game_state jsonb not null,
  summary text,
  turn_count integer,
  background_thumbnail text,
  user_id uuid default auth.uid(),
  primary key (id, user_id)
);

-- Set up Row Level Security (RLS)
alter table save_games enable row level security;

-- Policies for RLS
-- Users can view their own saves OR the sandbox user's saves
create policy "Users can view their own saves" 
on save_games for select 
using (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000'::uuid);

-- Users can insert their own saves OR as the sandbox user
create policy "Users can create their own saves" 
on save_games for insert 
with check (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000'::uuid);

-- Users can update their own saves OR the sandbox user's saves
create policy "Users can update their own saves" 
on save_games for update 
using (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000'::uuid)
with check (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000'::uuid);

-- Users can delete their own saves OR the sandbox user's saves
create policy "Users can delete their own saves" 
on save_games for delete 
using (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000'::uuid);
