# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

**Bookbot Personas** is a modern AI-powered customer research tool featuring 5 detailed customer personas based on European book market research. Built with React, TypeScript, and Supabase, it provides an interactive chat interface for conversing with different customer personas to understand their needs, behaviors, and pain points.

## Architecture Overview

### Core Technologies
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Supabase (Database, Auth, Storage, Real-time)
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: React Context API
- **AI Integration**: OpenAI GPT-4o-mini via Cloudflare Worker
- **Deployment**: GitHub Pages

### High-Level Architecture

The application follows a **layered service architecture**:

```
├── UI Layer (React Components)
├── Context Layer (React Context APIs)
├── Service Layer (Abstracted business logic)
├── API Layer (Supabase client + OpenAI service)
└── Database Layer (Supabase PostgreSQL)
```

### Key Architectural Components

**1. Context Providers**
- `AuthContext` - Manages user authentication state
- `ChatContext` - Manages conversations, messages, and persona state

**2. Service Layer**
- `DatabaseService` - Singleton for all database operations
- `FileUploadService` - Handles file uploads and processing
- `OpenAIService` - Manages AI interactions with persona context
- `PersonaMemoryService` - Tracks conversation context per persona

**3. Real-time Features**
- Supabase subscriptions for live conversation updates
- Real-time message synchronization across sessions

**4. Persona System**
The application features 5 distinct AI personas:
- **The Book Lover** - Avid reader, quality-focused
- **The Occasional Reader** - Trend-influenced, price-sensitive
- **The Knowledge Seeker** - Non-fiction focused, professional development
- **The Student** - Budget-constrained, textbook-focused
- **The Parent** - Educational focus, age-appropriate content

Each persona has detailed demographics, psychographics, and behavioral patterns configured in `/src/config/personas.ts`.

## Common Development Commands

### Development
```bash
# Start development server (localhost:8080)
npm run dev

# Start development server with Vite defaults
vite

# Preview production build locally
npm run preview
```

### Build & Deployment
```bash
# Build for production (includes TypeScript compilation and GitHub Pages deployment)
npm run build

# Build specifically for GitHub Pages
npm run build:gh

# Type check only
tsc
```

### Code Quality
```bash
# Run ESLint with TypeScript support
npm run lint

# Run ESLint and fix auto-fixable issues
npx eslint . --ext ts,tsx --fix
```

### Database & Content
```bash
# Import books data (development script)
npm run import:books

# Run TypeScript node scripts directly
npx ts-node src/scripts/import-books.ts
```

### File Structure Analysis
```bash
# Analyze dependency cycles (madge is available)
npx madge --circular src/

# Generate dependency graph
npx madge --image graph.svg src/
```

## Environment Setup

### Required Environment Variables
Create a `.env` file in the root:
```env
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
VITE_CLOUDFLARE_WORKER_URL=your_cloudflare_worker_url_here
```

### Supabase Database Setup
Run the complete schema found in `/src/lib/database-schema.sql` in your Supabase SQL Editor. This includes:
- Core tables (conversations, messages, file_attachments)
- Enhanced features (persona_memories, message_feedback, user_profiles)
- Book data tables with vector embeddings support
- Row Level Security (RLS) policies
- Storage bucket configuration

## Development Guidelines

### Component Organization
- **Pages**: `/src/pages/` - Route-level components
- **Components**: `/src/components/` - Reusable UI components
- **UI Components**: `/src/components/ui/` - shadcn/ui base components
- **Contexts**: `/src/contexts/` - React Context providers
- **Services**: `/src/services/` - Business logic layer
- **Config**: `/src/config/` - Configuration and constants
- **Types**: `/src/types/` - TypeScript type definitions

### Path Aliases
The project uses `@/*` aliases mapping to `./src/*`:
```typescript
import { useChat } from '@/contexts/ChatContext';
import { Button } from '@/components/ui/button';
```

### State Management Pattern
- **Global State**: Use React Context for user auth and chat state
- **Local State**: Use `useState` for component-specific state
- **Server State**: Direct Supabase queries with real-time subscriptions

### File Upload System
The application supports:
- **Images**: JPEG, PNG, GIF, WebP (processed for OpenAI Vision)
- **Documents**: Text, Markdown, JSON, CSV, Word, Excel
- **Processing**: Automatic content extraction for AI context
- **Storage**: Supabase Storage with organized user/conversation folders

### Real-time Architecture
- Supabase subscriptions automatically update UI when data changes
- Message streaming from OpenAI provides real-time typing effects
- Conversation list updates live across browser tabs

### AI Integration Pattern
1. **Message Processing**: User input → File processing → Context building
2. **Persona Context**: Each persona has unique system prompts and memory
3. **Response Streaming**: Chunked responses for better UX
4. **Memory Management**: Conversation context maintained per persona

## Testing & Debugging

### Development Server
The dev server runs on `localhost:8080` (configurable in `vite.config.ts`)

### Environment Validation
The app validates required environment variables on startup and falls back to demo mode if Supabase credentials are missing.

### Real-time Debugging
Monitor Supabase real-time subscriptions in browser dev tools:
```javascript
// Check active subscriptions
console.log(supabase.getChannels());
```

### File Upload Testing
Test file processing capabilities:
- Images: Ensure vision model processing works
- Documents: Verify text extraction and context inclusion
- Storage: Check Supabase bucket permissions

## Deployment

### GitHub Pages
The project auto-deploys to GitHub Pages on push to main branch:
- Build command: `npm run build`
- Output directory: `dist/`
- Base path: `/Bookbot-Personas/` (configured in `vite.config.ts`)

### Environment Considerations
- Production builds use `VITE_` prefixed environment variables
- GitHub Pages deployment script in `/scripts/gh-pages.sh`
- Base URL handling for both development and production environments

## Key Dependencies

### Core Framework
- `react` + `react-dom` - UI framework
- `typescript` - Type safety
- `vite` - Build tool and dev server

### Backend Integration
- `@supabase/supabase-js` - Database and auth
- `@tanstack/react-query` - Server state management

### UI & Styling
- `tailwindcss` - Utility-first CSS
- `@radix-ui/*` - Accessible UI components
- `lucide-react` - Icon library
- `next-themes` - Dark mode support

### Development Tools
- `eslint` + `@typescript-eslint/*` - Linting
- `ts-node` - TypeScript execution
- `madge` - Dependency analysis

## Troubleshooting

### Common Issues
1. **Supabase Connection**: Check environment variables and network connectivity
2. **File Upload Failures**: Verify storage bucket policies and file size limits
3. **Real-time Not Working**: Check Supabase project settings and subscription setup
4. **Build Errors**: Usually TypeScript compilation issues - check `tsconfig.json`

### Performance Optimization
- Images are automatically optimized for OpenAI Vision API
- Vite build includes code splitting for vendor libraries
- Supabase queries use appropriate indexes (defined in schema)

This architecture provides a scalable foundation for AI-powered customer research with real-time collaboration features and comprehensive file handling capabilities.
