import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types';
import { SUPABASE_URL, SUPABASE_ANON_KEY, validateEnvironmentVariables } from '@/config/constants';

// Validate environment variables before creating client
try {
  validateEnvironmentVariables();
} catch (error) {
  console.error('Supabase configuration error:', error);
}

// Create Supabase client with proper TypeScript types
export const supabase = createClient<Database>(
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
);

// Helper function to get the current user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error getting current user:', error);
    return null;
  }
  return user;
};

// Helper function to get the current session
export const getCurrentSession = async () => {
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
  const { data } = supabase.storage
    .from('file-attachments')
    .getPublicUrl(path);

  return data.publicUrl;
};

export const deleteFile = async (path: string) => {
  const { error } = await supabase.storage
    .from('file-attachments')
    .remove([path]);

  if (error) {
    throw error;
  }
};

// Database helpers
export const createConversation = async (userId: string, personaId: string, title: string) => {
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