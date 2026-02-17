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

-- Function to check max save count per user
create or replace function check_max_saves()
returns trigger as $$
declare
  save_count int;
  max_saves int := 10; -- Configurable limit
begin
  -- If ID is provided and exists, it's an update, skip count check
  if NEW.id is not null and exists (select 1 from save_games where id = NEW.id) then
    return NEW;
  end if;

  -- Check current count for this user
  select count(*) into save_count from save_games where user_id = NEW.user_id;
  
  if save_count >= max_saves then
    raise exception 'Save limit reached. Maximum allowed saves is %.', max_saves;
  end if;
  
  return NEW;
end;
$$ language plpgsql;

-- Trigger to enforce limit on insert
drop trigger if exists enforce_max_saves on save_games;
create trigger enforce_max_saves
before insert on save_games
for each row
execute function check_max_saves();

-- =================================================================
-- RAG & Memory System Extensions
-- =================================================================

-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create memories table
create table if not exists memories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid default auth.uid(),
  timeline_id uuid not null references save_games(id) on delete cascade, -- Links to save_games.id with Cascade Delete
  scp_number text,
  content text not null,
  embedding vector(3072),
  role text,
  turn_number integer,
  tags jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for memories
alter table memories enable row level security;

-- Drop existing policies if they exist to avoid conflict on re-run
drop policy if exists "Users can view their own memories" on memories;
create policy "Users can view their own memories"
on memories for select
using (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000'::uuid);

drop policy if exists "Users can insert their own memories" on memories;
create policy "Users can insert their own memories"
on memories for insert
with check (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000'::uuid);

-- Similarity search function
create or replace function match_memories (
  query_embedding vector(3072),
  match_threshold float,
  match_count int,
  filter_timeline_id uuid
)
returns table (
  id uuid,
  content text,
  role text,
  similarity float,
  turn_number integer,
  scp_number text
)
language plpgsql
as $$
begin
  return query
  select
    memories.id,
    memories.content,
    memories.role,
    1 - (memories.embedding <=> query_embedding) as similarity,
    memories.turn_number,
    memories.scp_number
  from memories
  where 1 - (memories.embedding <=> query_embedding) > match_threshold
  and memories.timeline_id = filter_timeline_id
  order by memories.embedding <=> query_embedding
  limit match_count;
end;
$$;

create table if not exists ai_usage_daily (
  day date not null,
  subject text not null,
  count integer not null default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (day, subject)
);

alter table ai_usage_daily enable row level security;

create or replace function increment_ai_usage(p_day date, p_subject text)
returns integer
language plpgsql
as $$
declare
  new_count integer;
begin
  insert into ai_usage_daily(day, subject, count)
  values (p_day, p_subject, 1)
  on conflict (day, subject)
  do update set count = ai_usage_daily.count + 1, updated_at = timezone('utc'::text, now())
  returning count into new_count;
  return new_count;
end;
$$;
