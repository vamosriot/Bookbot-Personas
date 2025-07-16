-- Database Schema for Bookbot Personas with Enhanced Features
-- Run this SQL in your Supabase SQL Editor

-- Create conversations table
create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  persona_id text not null,
  title text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_message_at timestamp with time zone default timezone('utc'::text, now()) not null,
  message_count integer default 0 not null
);

-- Create messages table
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  content text not null,
  role text not null check (role in ('user', 'assistant')),
  persona_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create file_attachments table
create table if not exists public.file_attachments (
  id uuid default gen_random_uuid() primary key,
  message_id uuid references public.messages(id) on delete cascade not null,
  name text not null,
  type text not null,
  size integer not null,
  url text not null,
  storage_path text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create persona_memories table for enhanced persona functionality
create table if not exists public.persona_memories (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  persona_id text not null,
  user_preferences jsonb default '{}' not null,
  discussed_topics text[] default '{}' not null,
  book_recommendations text[] default '{}' not null,
  user_interests text[] default '{}' not null,
  previous_context text[] default '{}' not null,
  last_interaction timestamp with time zone default timezone('utc'::text, now()) not null,
  session_count integer default 1 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Ensure one memory record per conversation-persona pair
  constraint unique_conversation_persona unique (conversation_id, persona_id)
);

-- Create user_profiles table for additional user data
create table if not exists public.user_profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  display_name text,
  preferences jsonb default '{}' not null,
  metadata jsonb default '{}' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create message_feedback table for AI response feedback
create table if not exists public.message_feedback (
  id uuid default gen_random_uuid() primary key,
  message_id uuid references public.messages(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  feedback_type text not null check (feedback_type in ('upvote', 'downvote')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Ensure one feedback per user per message
  constraint unique_user_message_feedback unique (user_id, message_id)
);

-- Set up Row Level Security (RLS)
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.file_attachments enable row level security;
alter table public.persona_memories enable row level security;
alter table public.user_profiles enable row level security;
alter table public.message_feedback enable row level security;

-- Create policies for conversations
drop policy if exists "Users can only see their own conversations" on public.conversations;
create policy "Users can only see their own conversations" on public.conversations
  for all using (auth.uid() = user_id);

-- Create policies for messages
drop policy if exists "Users can only see messages from their conversations" on public.messages;
create policy "Users can only see messages from their conversations" on public.messages
  for all using (
    conversation_id in (
      select id from public.conversations where user_id = auth.uid()
    )
  );

-- Create policies for file_attachments
drop policy if exists "Users can only see their own file attachments" on public.file_attachments;
create policy "Users can only see their own file attachments" on public.file_attachments
  for all using (
    message_id in (
      select m.id from public.messages m
      join public.conversations c on m.conversation_id = c.id
      where c.user_id = auth.uid()
    )
  );

-- Create policies for persona_memories
drop policy if exists "Users can only see their own persona memories" on public.persona_memories;
create policy "Users can only see their own persona memories" on public.persona_memories
  for all using (
    conversation_id in (
      select id from public.conversations where user_id = auth.uid()
    )
  );

-- Create policies for user_profiles
drop policy if exists "Users can only see their own profile" on public.user_profiles;
create policy "Users can only see their own profile" on public.user_profiles
  for all using (auth.uid() = user_id);

-- Create policies for message_feedback
drop policy if exists "Users can only see their own feedback" on public.message_feedback;
create policy "Users can only see their own feedback" on public.message_feedback
  for all using (auth.uid() = user_id);

-- Create storage bucket for file attachments
insert into storage.buckets (id, name, public) 
values ('file-attachments', 'file-attachments', true)
on conflict (id) do nothing;

-- Create storage policies
drop policy if exists "Anyone can upload files" on storage.objects;
create policy "Anyone can upload files" on storage.objects 
  for insert with check (bucket_id = 'file-attachments');

drop policy if exists "Anyone can view files" on storage.objects;
create policy "Anyone can view files" on storage.objects 
  for select using (bucket_id = 'file-attachments');

drop policy if exists "Users can delete their own files" on storage.objects;
create policy "Users can delete their own files" on storage.objects 
  for delete using (
    bucket_id = 'file-attachments' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create indexes for better performance
create index if not exists idx_conversations_user_id on public.conversations(user_id);
create index if not exists idx_conversations_last_message_at on public.conversations(last_message_at desc);
create index if not exists idx_messages_conversation_id on public.messages(conversation_id);
create index if not exists idx_messages_created_at on public.messages(created_at);
create index if not exists idx_file_attachments_message_id on public.file_attachments(message_id);
create index if not exists idx_persona_memories_conversation_persona on public.persona_memories(conversation_id, persona_id);
create index if not exists idx_user_profiles_user_id on public.user_profiles(user_id);

-- Create function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create triggers for updated_at
drop trigger if exists update_conversations_updated_at on public.conversations;
create trigger update_conversations_updated_at
  before update on public.conversations
  for each row execute function update_updated_at_column();

drop trigger if exists update_messages_updated_at on public.messages;
create trigger update_messages_updated_at
  before update on public.messages
  for each row execute function update_updated_at_column();

drop trigger if exists update_file_attachments_updated_at on public.file_attachments;
create trigger update_file_attachments_updated_at
  before update on public.file_attachments
  for each row execute function update_updated_at_column();

drop trigger if exists update_persona_memories_updated_at on public.persona_memories;
create trigger update_persona_memories_updated_at
  before update on public.persona_memories
  for each row execute function update_updated_at_column();

drop trigger if exists update_user_profiles_updated_at on public.user_profiles;
create trigger update_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function update_updated_at_column();

drop trigger if exists update_message_feedback_updated_at on public.message_feedback;
create trigger update_message_feedback_updated_at
  before update on public.message_feedback
  for each row execute function update_updated_at_column(); 