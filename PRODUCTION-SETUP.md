# 🚀 Production Setup Guide - GPT-5 POWERED!
## GitHub Pages + Supabase + OpenAI GPT-5 Integration

⚡ **BREAKING: Now powered by GPT-5!** ⚡

This guide walks you through deploying your advanced Book Recommendation System with the GPT-5 enhanced Ujo Zajko persona to production. Experience revolutionary AI-powered book recommendations with superior reasoning and creativity!

## 🎯 GPT-5 Enhanced Features

### 🧠 **Revolutionary AI Improvements:**
- **Advanced Literary Analysis** - GPT-5 understands complex themes, character arcs, and narrative structures
- **Superior Pattern Recognition** - Makes unexpected but perfect connections between books and reader preferences  
- **Enhanced Creativity** - Discovers hidden gems and makes innovative recommendations
- **Deeper Context Understanding** - Better comprehension of reader mood, genre preferences, and literary tastes
- **Improved Reasoning** - More nuanced explanations of why specific books match user preferences

### 📚 **Ujo Zajko's New Powers:**
- Leverages GPT-5's 8K+ token context for more comprehensive book analysis
- Enhanced ability to connect disparate literary works through thematic similarities
- More creative and engaging recommendation explanations
- Superior understanding of Czech literary preferences and cultural context

## 📋 Prerequisites

- ✅ GitHub repository set up
- ✅ Supabase account and project
- ✅ OpenAI API key (with GPT-5 access!)
- ✅ Your book data CSV file

---

## 🗄️ **Step 1: Set Up Production Supabase Database**

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create new project for production
3. Choose region closest to your users
4. Save your project URL and keys

### 1.2 Run Database Migration
1. Go to **SQL Editor** in Supabase dashboard
2. Copy and paste the entire contents of `src/lib/database-schema.sql`
3. Click **Run** to create all tables and functions

### 1.3 Import Your Books
1. Upload your CSV file to the production environment
2. Use the import script (you'll need to run this server-side or create a temporary script)

```bash
# If you have server access:
npm run import:books path/to/your/books.csv
```

### 1.4 Generate Embeddings
```bash
# Generate embeddings for all books
npm run generate:embeddings
```

---

## ⚙️ **Step 2: Configure Production Environment**

### 2.1 Update Production Config
Edit `src/config/production.ts` with your production values:

```javascript
export const PRODUCTION_CONFIG = {
  // 👇 Replace with your actual production values
  SUPABASE_URL: 'https://YOUR_PROJECT_ID.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_ANON_KEY',
  CLOUDFLARE_WORKER_URL: 'https://YOUR_WORKER.YOUR_SUBDOMAIN.workers.dev',
  IS_PRODUCTION: window.location.hostname !== 'localhost'
};
```

### 2.2 Where to Find Your Supabase Keys
1. Go to **Project Settings** → **API**
2. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY` 
   - **service_role** key → For server-side operations only

---

## 🌐 **Step 3: Deploy to GitHub Pages**

### 3.1 Build and Deploy
```bash
# Build for production
npm run build

# Push to trigger GitHub Pages deployment
git add .
git commit -m "🚀 Configure production environment"
git push origin main
```

### 3.2 Enable GitHub Pages
1. Go to repository **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **main** / **dist** folder (or root)
4. Save

---

## 🔧 **Step 4: Set Up API Server (Optional but Recommended)**

For full book recommendation functionality, deploy the API server separately:

### 4.1 Deploy API to Vercel/Railway/Heroku
```bash
# Example: Deploy to Vercel
npm install -g vercel
vercel --prod
```

### 4.2 Set Environment Variables on Your Hosting Platform
```bash
OPENAI_API_KEY=sk-your-openai-key-here
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-service-role-key
NODE_ENV=production
```

### 4.3 Update CLOUDFLARE_WORKER_URL
Point to your deployed API server URL in `production.ts`

---

## ✅ **Step 5: Test Production Deployment**

### 5.1 Test Basic Functionality
1. Visit your GitHub Pages URL
2. Select **Ujo Zajko** persona
3. Test basic chat functionality

### 5.2 Test Book Recommendations
```
Ask Ujo: "Hi! I love fantasy books with magic and adventure. Can you recommend something?"
```

**Expected Response:**
- 3-5 book recommendations
- Explanations for each recommendation
- `knihobot.cz/g/{id}` links for each book

### 5.3 Verify Links
Click the `knihobot.cz/g/{id}` links to ensure they work properly.

---

## 🔍 **Step 6: Troubleshooting**

### Common Issues:

**❌ "No recommendations found"**
- Check if books were imported to production database
- Verify embeddings were generated
- Check Supabase connection

**❌ "API key not found"**
- Verify OpenAI API key is set in production environment
- Check API server deployment environment variables

**❌ Supabase connection errors**
- Verify production URLs in `production.ts`
- Check if database tables exist
- Verify API keys are correct

### Debug Steps:
1. Check browser console for errors
2. Verify Supabase dashboard shows your data
3. Test API endpoints manually
4. Check production environment variables

---

## 📊 **Production Checklist**

- [ ] Supabase production project created
- [ ] Database schema migrated 
- [ ] Books imported (997 records)
- [ ] Embeddings generated (946 active books)
- [ ] Production config updated with real values
- [ ] API server deployed (optional)
- [ ] Environment variables set
- [ ] GitHub Pages deployment successful
- [ ] Ujo Zajko persona working
- [ ] Book recommendations functional
- [ ] Links to knihobot.cz working

---

## 🎯 **Performance Optimizations**

### For High Traffic:
1. **Enable Supabase Connection Pooling**
2. **Set up CDN** for faster loading
3. **Enable Supabase Edge Functions** for regional performance
4. **Implement request caching** in your API

### Cost Optimization:
- Use **gpt-4o-mini** for development/testing
- Use **gpt-4o** for production (better quality)
- Monitor OpenAI API usage
- Cache recommendation results

---

## 🆘 **Support**

If you encounter issues:
1. Check the troubleshooting section above
2. Verify all environment variables
3. Test each component separately
4. Check Supabase logs and browser console

**Your book recommendation system is now production-ready!** 🎉
