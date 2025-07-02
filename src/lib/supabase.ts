import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types';
import { SUPABASE_URL, SUPABASE_ANON_KEY, validateEnvironmentVariables } from '@/config/constants';

// Check if Supabase credentials are available
const hasSupabaseCredentials = SUPABASE_URL && SUPABASE_ANON_KEY;

// Log environment state for debugging
console.log('Supabase Environment Check:', {
  hasURL: !!SUPABASE_URL,
  hasKey: !!SUPABASE_ANON_KEY,
  urlPrefix: SUPABASE_URL ? SUPABASE_URL.substring(0, 20) + '...' : 'missing',
  environment: process.env.NODE_ENV || 'unknown'
});

// Validate environment variables only if we have them
if (hasSupabaseCredentials) {
  try {
    validateEnvironmentVariables();
  } catch (error) {
    console.error('Supabase configuration error:', error);
  }
} else {
  console.warn('Supabase credentials missing - app will run in demo mode');
}

// Create Supabase client with proper TypeScript types
export const supabase = hasSupabaseCredentials ? createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    },
    global: {
      headers: {
        'X-Client-Info': 'bookbot-personas@1.0.0'
      }
    }
  }
) : null;

// Helper function to get the current user
export const getCurrentUser = async () => {
  if (!supabase) {
    console.warn('Supabase not initialized - returning null user');
    return null;
  }
  
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error getting current user:', error);
    return null;
  }
  return user;
};

// Helper function to get the current session
export const getCurrentSession = async () => {
  if (!supabase) {
    console.warn('Supabase not initialized - returning null session');
    return null;
  }
  
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting current session:', error);
    return null;
  }
  return session;
};

// Helper function to check if user is authenticated
export const isAuthenticated = async (): Promise<boolean> => {
  const session = await getCurrentSession();
  return !!session;
};

// Helper function to get auth headers for API calls
export const getAuthHeaders = async () => {
  const session = await getCurrentSession();
  if (!session?.access_token) {
    throw new Error('No valid session found');
  }
  
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  };
};

// Storage helpers
export const uploadFile = async (file: File, path: string) => {
  if (!supabase) {
    throw new Error('Supabase not initialized');
  }
  
  const { data, error } = await supabase.storage
    .from('file-attachments')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    throw error;
  }

  return data;
};

export const getFileUrl = (path: string) => {
  if (!supabase) {
    return '';
  }
  
  const { data } = supabase.storage
    .from('file-attachments')
    .getPublicUrl(path);

  return data.publicUrl;
};

export const deleteFile = async (path: string) => {
  if (!supabase) {
    throw new Error('Supabase not initialized');
  }
  
  const { error } = await supabase.storage
    .from('file-attachments')
    .remove([path]);

  if (error) {
    throw error;
  }
};

// Database helpers
export const createConversation = async (userId: string, personaId: string, title: string) => {
  if (!supabase) {
    throw new Error('Supabase not initialized');
  }
  
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: userId,
      persona_id: personaId,
      title,
      last_message_at: new Date().toISOString(),
      message_count: 0
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
};

export const getConversations = async (userId: string) => {
  if (!supabase) {
    return [];
  }
  
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
};

export const getMessages = async (conversationId: string) => {
  if (!supabase) {
    return [];
  }
  
  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      file_attachments (*)
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
};

export const createMessage = async (message: {
  conversation_id: string;
  content: string;
  role: 'user' | 'assistant';
  persona_id?: string;
}) => {
  if (!supabase) {
    throw new Error('Supabase not initialized');
  }
  
  const { data, error } = await supabase
    .from('messages')
    .insert(message)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
};

// Real-time subscriptions
export const subscribeToConversations = (userId: string, callback: (payload: any) => void) => {
  if (!supabase) {
    console.warn('Supabase not initialized - skipping subscription');
    return { unsubscribe: () => {} };
  }
  
  return supabase
    .channel('conversations')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `user_id=eq.${userId}`
      },
      callback
    )
    .subscribe();
};

export const subscribeToMessages = (conversationId: string, callback: (payload: any) => void) => {
  if (!supabase) {
    console.warn('Supabase not initialized - skipping subscription');
    return { unsubscribe: () => {} };
  }
  
  return supabase
    .channel('messages')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      callback
    )
    .subscribe();
}; 