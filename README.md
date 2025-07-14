# Bookbot Personas 🤖

A modern AI-powered customer research tool featuring 5 detailed customer personas based on European book market research, built with React, TypeScript, and Supabase.

## 🌟 Features

- **5 Customer Research Personas**: Each representing distinct customer segments based on market research
  - **The Book Lover**: Avid reader, price-conscious but quality-focused
  - **The Occasional Reader**: 2-5 books/year, trend-influenced, highly price-sensitive
  - **The Knowledge Seeker**: Non-fiction focused, professional development needs
  - **The Student**: Budget-constrained, textbook-focused, peer-influenced
  - **The Parent**: Educational focus, age-appropriate content, family-oriented

- **Interactive Chat Interface**: Have conversations with each persona to understand their needs
- **Complete Authentication System**: Secure login, signup, and password reset
- **Real-time Chat**: Live conversation updates using Supabase subscriptions
- **File Upload Support**: Drag-and-drop file attachments in conversations (images and documents)
- **Responsive Design**: Modern UI with Tailwind CSS and shadcn/ui components
- **Persistent Chat History**: All conversations saved and synchronized
- **Detailed Customer Insights**: Demographics, psychographics, and behavioral data for each persona

## 🚀 Live Demo

Visit the live application: [https://vamosriot.github.io/Bookbot-Personas/](https://vamosriot.github.io/Bookbot-Personas/)

> **Note**: If you see a 404 error, the deployment may still be in progress. Check the [Actions tab](https://github.com/vamosriot/Bookbot-Personas/actions) for deployment status.

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Supabase (Database, Auth, Storage)
- **Styling**: Tailwind CSS, shadcn/ui
- **State Management**: React Context API
- **Routing**: React Router DOM
- **File Upload**: React Dropzone
- **Real-time**: Supabase Subscriptions
- **Deployment**: GitHub Pages

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/vamosriot/Bookbot-Personas.git
   cd Bookbot-Personas
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_url_here
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   VITE_CLOUDFLARE_WORKER_URL=your_cloudflare_worker_url_here
   ```

4. **Set up Supabase database**
   Run the SQL schema in your Supabase SQL Editor (see Database Schema section)

5. **Start development server**
   ```bash
   npm run dev
   ```

## 🗄️ Database Schema

Run this SQL in your Supabase SQL Editor to set up the required tables:

```sql
-- Create conversations table
create table public.conversations (
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
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  content text not null,
  role text not null check (role in ('user', 'assistant')),
  persona_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create file_attachments table
create table public.file_attachments (
  id uuid default gen_random_uuid() primary key,
  message_id uuid references public.messages(id) on delete cascade not null,
  name text not null,
  type text not null,
  size integer not null,
  url text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.file_attachments enable row level security;

-- Create policies
create policy "Users can only see their own conversations" on public.conversations
  for all using (auth.uid() = user_id);

create policy "Users can only see messages from their conversations" on public.messages
  for all using (
    conversation_id in (
      select id from public.conversations where user_id = auth.uid()
    )
  );

create policy "Users can only see their own file attachments" on public.file_attachments
  for all using (
    message_id in (
      select m.id from public.messages m
      join public.conversations c on m.conversation_id = c.id
      where c.user_id = auth.uid()
    )
  );

-- Create storage bucket for file attachments
insert into storage.buckets (id, name, public) values ('file-attachments', 'file-attachments', true);

-- Create storage policies
create policy "Anyone can upload files" on storage.objects for insert with check (bucket_id = 'file-attachments');
create policy "Anyone can view files" on storage.objects for select using (bucket_id = 'file-attachments');
create policy "Users can delete their own files" on storage.objects for delete using (bucket_id = 'file-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
```

## 🎯 How to Use

1. **Sign up/Login**: Create an account or log in to access the personas
2. **View Personas**: Click "View Personas" to see detailed information about each customer segment
3. **Start Chat**: Return to the main chat interface and select a persona to start a conversation
4. **Upload Files**: Share images and documents with personas for analysis and feedback
5. **Explore Insights**: Learn about each persona's demographics, behaviors, and pain points

## 👥 Customer Personas

### 📚 The Book Lover
- **Age**: 25-45, university educated, urban Prague
- **Reading**: 10-20 books/year, medium price sensitivity
- **Motivation**: Rare finds, sustainability, quality over quantity
- **Platforms**: Goodreads, Instagram, Facebook book groups

### 📱 The Occasional Reader
- **Age**: 18-50, balanced gender, Prague suburbs
- **Reading**: 2-5 books/year, highly price-sensitive
- **Motivation**: Trending titles, media adaptations, convenience
- **Platforms**: Instagram, TikTok, Facebook

### 🧠 The Knowledge Seeker
- **Age**: 25-50, university+, works in tech/academia
- **Reading**: 10-15 books/year, low price sensitivity
- **Motivation**: Professional development, current information
- **Platforms**: LinkedIn, Reddit, research communities

### 🎓 The Student
- **Age**: 18-25, university student, low income
- **Reading**: Required + 2-3 leisure books/year, very price-sensitive
- **Motivation**: Academic success, peer recommendations
- **Platforms**: WhatsApp, Facebook student groups, Instagram

### 👩‍👧‍👦 The Parent
- **Age**: 30-45, 70% female, suburbs
- **Reading**: Daily with kids, medium price sensitivity
- **Motivation**: Children's education, age-appropriate content
- **Platforms**: Facebook parenting groups, Pinterest

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Environment Variables

- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `VITE_CLOUDFLARE_WORKER_URL` - Your Cloudflare Worker URL for OpenAI API

## 🚀 Deployment

This app is configured for GitHub Pages deployment. Push to main branch to automatically deploy.

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🎯 Use Cases

- **Market Research**: Understand different customer segments
- **Product Development**: Get feedback from various user types
- **Marketing Strategy**: Test messaging with different audiences
- **Team Training**: Help teams understand customer needs
- **Campaign Testing**: Preview how different segments might respond

---

Built with ❤️ using React, TypeScript, and Supabase 
