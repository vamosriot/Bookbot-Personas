/**
 * Production Environment Configuration
 * This file handles production environment variables for GitHub Pages deployment
 * 
 * ✅ CONFIGURED: Using GitHub Repository Secrets:
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY  
 * - VITE_CLOUDFLARE_WORKER_URL
 */

// Production Supabase Configuration - Uses GitHub Secrets automatically
export const PRODUCTION_CONFIG = {
  // These are automatically injected by GitHub Actions from Repository Secrets
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  CLOUDFLARE_WORKER_URL: import.meta.env.VITE_CLOUDFLARE_WORKER_URL || '',
  
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
