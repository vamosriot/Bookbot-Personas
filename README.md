# Bookbot Personas 🤖

A modern AI chatbot application featuring 5 distinct AI personas, built with React, TypeScript, and Supabase.

## 🌟 Features

- **5 AI Personas (Placeholders)**: Each with unique characteristics and conversation styles
  - **Pepa**: Warm, encouraging life coach
  - **Jarka**: Analytical, structured problem solver
  - **Honza**: Creative, humorous storyteller
  - **Alena**: Empathetic, supportive listener
  - **Sofie**: Curious, exploratory knowledge seeker

- **Complete Authentication System**: Secure login, signup, and password reset
- **Real-time Chat**: Live conversation updates using Supabase subscriptions
- **File Upload Support**: Drag-and-drop file attachments in conversations
- **Responsive Design**: Modern UI with Tailwind CSS and shadcn/ui components
- **Persistent Chat History**: All conversations saved and synchronized
- **Multiple Conversation Management**: Switch between different AI personas

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
  file_name text not null,
  file_size integer not null,
  file_type text not null,
  file_url text not null,
  storage_path text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create storage bucket
insert into storage.buckets (id, name, public) values ('file-attachments', 'file-attachments', true);

-- Enable RLS and create policies
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.file_attachments enable row level security;

-- Add RLS policies (see full schema in docs)
```

## 🚀 Deployment

The project is configured for automatic deployment to GitHub Pages:

1. **Set up GitHub Secrets**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_CLOUDFLARE_WORKER_URL` (optional)

2. **Enable GitHub Pages**:
   - Go to repository Settings → Pages
   - Select "GitHub Actions" as source

3. **Deploy**:
   ```bash
   git push origin main
   ```

## 🏗️ Project Structure

```
src/
├── components/          # React components
│   ├── auth/           # Authentication components
│   ├── ui/             # shadcn/ui components
│   └── ...
├── contexts/           # React context providers
├── hooks/              # Custom React hooks
├── lib/                # Utility libraries
├── services/           # API and external services
├── types/              # TypeScript type definitions
├── config/             # Configuration files
└── pages/              # Page components
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🔗 Links

- [Live Demo](https://vamosriot.github.io/Bookbot-Personas/)
- [Supabase](https://supabase.com/)
- [React](https://reactjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)

---

Made with ❤️ by [vamosriot](https://github.com/vamosriot)

# Bookbot OpenAI Worker

This Cloudflare Worker acts as a secure proxy between your Bookbot Personas React app and the OpenAI API.

## Features

- 🔒 **Secure API Key Management**: Your OpenAI API key is stored securely in Cloudflare
- 🌐 **CORS Support**: Enables cross-origin requests from your React app
- ⚡ **Fast & Reliable**: Cloudflare's global edge network
- 📝 **Request Validation**: Validates requests before forwarding to OpenAI
- 🚨 **Error Handling**: Comprehensive error handling and logging

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Wrangler CLI

If you haven't already, install and authenticate with Wrangler:

```bash
npm install -g wrangler
wrangler login
```

### 3. Set Your OpenAI API Key

Set your OpenAI API key as a secret:

```bash
wrangler secret put OPENAI_API_KEY
```

When prompted, paste your OpenAI API key.

### 4. Deploy to Cloudflare

```bash
npm run deploy
```

### 5. Get Your Worker URL

After deployment, you'll get a URL like:
```
https://bookbot-openai-worker.your-username.workers.dev
```

### 6. Update Your React App

Add this URL to your GitHub repository secrets as `VITE_CLOUDFLARE_WORKER_URL`.

## Development

### Local Development

```bash
npm run dev
```

This starts a local development server at `http://localhost:8787`

### Testing the Worker

You can test the worker with curl:

```bash
curl -X POST https://your-worker-url.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

## API Reference

### POST /

Proxies chat completion requests to OpenAI.

**Request Body:**
```json
{
  "messages": [
    {"role": "user", "content": "Your message"}
  ],
  "model": "gpt-4-turbo-preview",
  "temperature": 0.7,
  "max_tokens": 4096
}
```

**Response:**
Standard OpenAI chat completion response.

## Security

- API keys are stored as encrypted secrets in Cloudflare
- CORS is configured to allow requests from your domain
- Input validation prevents malicious requests
- Comprehensive error handling prevents information leakage

## Troubleshooting

### Common Issues

1. **"OpenAI API key not configured"**
   - Make sure you've set the secret: `wrangler secret put OPENAI_API_KEY`

2. **CORS errors**
   - Update the `corsHeaders` in `src/index.js` to match your domain

3. **Deployment fails**
   - Check that you're logged in: `wrangler whoami`
   - Verify your account has Workers enabled

### Logs

View real-time logs:
```bash
wrangler tail
```

## Cost Considerations

- Cloudflare Workers: 100,000 requests/day on free tier
- OpenAI API: Pay per token used
- No additional hosting costs

## Support

For issues related to:
- Cloudflare Workers: [Cloudflare Docs](https://developers.cloudflare.com/workers/)
- OpenAI API: [OpenAI Docs](https://platform.openai.com/docs)
- This worker: Check the GitHub repository 
