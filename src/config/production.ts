/**
 * Production Environment Configuration
 * This file handles production environment variables for GitHub Pages deployment
 */

// Production Supabase Configuration
export const PRODUCTION_CONFIG = {
  // Replace these with your production Supabase values
  SUPABASE_URL: 'https://your-project-id.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-anon-key-here',
  
  // API Configuration for production
  CLOUDFLARE_WORKER_URL: 'https://your-worker.your-subdomain.workers.dev',
  
  // Environment detection
  IS_PRODUCTION: window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
};

/**
 * Get the appropriate configuration based on environment
 */
export const getEnvironmentConfig = () => {
  if (PRODUCTION_CONFIG.IS_PRODUCTION) {
    return {
      SUPABASE_URL: PRODUCTION_CONFIG.SUPABASE_URL,
      SUPABASE_ANON_KEY: PRODUCTION_CONFIG.SUPABASE_ANON_KEY,
      CLOUDFLARE_WORKER_URL: PRODUCTION_CONFIG.CLOUDFLARE_WORKER_URL,
    };
  }
  
  // Development configuration (from .env)
  return {
    SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
    SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    CLOUDFLARE_WORKER_URL: import.meta.env.VITE_CLOUDFLARE_WORKER_URL || '',
  };
};
