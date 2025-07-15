import { supabase } from './supabase';

interface CacheEntry<T> {
  data: T;
  expiry: number;
  key: string;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  invalidateOnMutation?: boolean;
}

export class SupabaseCache {
  private static instance: SupabaseCache;
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 300000; // 5 minutes
  private mutationKeys = new Set<string>(); // Track keys that should be invalidated on mutations

  static getInstance(): SupabaseCache {
    if (!SupabaseCache.instance) {
      SupabaseCache.instance = new SupabaseCache();
    }
    return SupabaseCache.instance;
  }

  // Get cached data or fetch from Supabase
  async getCachedOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const { ttl = this.defaultTTL, invalidateOnMutation = false } = options;

    // Check if data is in cache and not expired
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    // Fetch fresh data
    try {
      const data = await fetcher();
      
      // Cache the result
      this.cache.set(key, {
        data,
        expiry: Date.now() + ttl,
        key
      });

      // Track for mutation invalidation if requested
      if (invalidateOnMutation) {
        this.mutationKeys.add(key);
      }

      return data;
    } catch (error) {
      console.error('Cache fetch error:', error);
      throw error;
    }
  }

  // Cached conversation queries
  async getConversations(userId: string, options?: CacheOptions) {
    return this.getCachedOrFetch(
      `conversations:${userId}`,
      async () => {
        const { data, error } = await supabase
          .from('conversations')
          .select('*')
          .eq('user_id', userId)
          .order('last_message_at', { ascending: false });

        if (error) throw error;
        return data;
      },
      { ttl: 600000, invalidateOnMutation: true, ...options } // 10 minutes
    );
  }

  // Cached message queries
  async getMessages(conversationId: string, options?: CacheOptions) {
    return this.getCachedOrFetch(
      `messages:${conversationId}`,
      async () => {
        const { data, error } = await supabase
          .from('messages')
          .select(`
            *,
            file_attachments (*)
          `)
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        return data;
      },
      { ttl: 120000, invalidateOnMutation: true, ...options } // 2 minutes
    );
  }

  // Cached persona queries
  async getPersonas(options?: CacheOptions) {
    return this.getCachedOrFetch(
      'personas',
      async () => {
        // Since personas are stored in config, just return them
        const { getAllPersonas } = await import('@/config/personas');
        return getAllPersonas();
      },
      { ttl: 3600000, ...options } // 1 hour
    );
  }

  // Cached file attachment queries
  async getFileAttachments(messageId: string, options?: CacheOptions) {
    return this.getCachedOrFetch(
      `file_attachments:${messageId}`,
      async () => {
        const { data, error } = await supabase
          .from('file_attachments')
          .select('*')
          .eq('message_id', messageId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        return data;
      },
      { ttl: 600000, ...options } // 10 minutes
    );
  }

  // Cached user profile queries
  async getUserProfile(userId: string, options?: CacheOptions) {
    return this.getCachedOrFetch(
      `user_profile:${userId}`,
      async () => {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (error && error.code !== 'PGRST116') throw error; // Ignore "not found" errors
        return data;
      },
      { ttl: 1800000, ...options } // 30 minutes
    );
  }

  // Cached persona memory queries
  async getPersonaMemory(conversationId: string, personaId: string, options?: CacheOptions) {
    return this.getCachedOrFetch(
      `persona_memory:${conversationId}:${personaId}`,
      async () => {
        const { data, error } = await supabase
          .from('persona_memories')
          .select('*')
          .eq('conversation_id', conversationId)
          .eq('persona_id', personaId)
          .single();

        if (error && error.code !== 'PGRST116') throw error; // Ignore "not found" errors
        return data;
      },
      { ttl: 300000, invalidateOnMutation: true, ...options } // 5 minutes
    );
  }

  // Invalidate cache entries
  invalidate(pattern?: string): void {
    if (!pattern) {
      // Clear all cache
      this.cache.clear();
      this.mutationKeys.clear();
      return;
    }

    // Clear entries matching pattern
    const keysToDelete: string[] = [];
    this.cache.forEach((entry, key) => {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.mutationKeys.delete(key);
    });
  }

  // Invalidate on mutations (create, update, delete operations)
  invalidateOnMutation(table: string, operation: 'INSERT' | 'UPDATE' | 'DELETE'): void {
    switch (table) {
      case 'conversations':
        this.invalidate('conversations:');
        break;
      case 'messages':
        this.invalidate('messages:');
        // Also invalidate conversations since last_message_at might change
        this.invalidate('conversations:');
        break;
      case 'file_attachments':
        this.invalidate('file_attachments:');
        // Also invalidate messages since they include file attachments
        this.invalidate('messages:');
        break;
      case 'persona_memories':
        this.invalidate('persona_memory:');
        break;
      case 'user_profiles':
        this.invalidate('user_profile:');
        break;
    }
  }

  // Manual cache warming for important data
  async warmCache(userId: string): Promise<void> {
    try {
      // Pre-load conversations
      await this.getConversations(userId);
      
      // Pre-load personas
      await this.getPersonas();
      
      // Pre-load user profile
      await this.getUserProfile(userId);

      console.log('Cache warmed for user:', userId);
    } catch (error) {
      console.error('Cache warming failed:', error);
    }
  }

  // Get cache statistics
  getStats(): { size: number; entries: string[]; expiredCount: number } {
    const now = Date.now();
    let expiredCount = 0;
    const entries: string[] = [];

    this.cache.forEach((entry, key) => {
      entries.push(key);
      if (entry.expiry <= now) {
        expiredCount++;
      }
    });

    return {
      size: this.cache.size,
      entries,
      expiredCount
    };
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (entry.expiry <= now) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.mutationKeys.delete(key);
    });

    if (keysToDelete.length > 0) {
      console.log(`Cleaned up ${keysToDelete.length} expired cache entries`);
    }
  }

  // Set up automatic cleanup
  startAutoCleanup(intervalMs: number = 600000): void { // 10 minutes
    setInterval(() => {
      this.cleanup();
    }, intervalMs);
  }
}

// Create singleton instance
export const supabaseCache = SupabaseCache.getInstance();

// Helper functions for common operations
export const cachedQueries = {
  // Conversations
  getConversations: (userId: string, options?: CacheOptions) => 
    supabaseCache.getConversations(userId, options),
  
  // Messages
  getMessages: (conversationId: string, options?: CacheOptions) => 
    supabaseCache.getMessages(conversationId, options),
  
  // File attachments
  getFileAttachments: (messageId: string, options?: CacheOptions) => 
    supabaseCache.getFileAttachments(messageId, options),
  
  // User profile
  getUserProfile: (userId: string, options?: CacheOptions) => 
    supabaseCache.getUserProfile(userId, options),
  
  // Persona memory
  getPersonaMemory: (conversationId: string, personaId: string, options?: CacheOptions) => 
    supabaseCache.getPersonaMemory(conversationId, personaId, options),
  
  // Personas
  getPersonas: (options?: CacheOptions) => 
    supabaseCache.getPersonas(options)
};

// Set up auto cleanup
supabaseCache.startAutoCleanup(); 