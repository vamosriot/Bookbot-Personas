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
        'X-Client-Info': 'bookbot-personas@1.0.0',
        'apikey': SUPABASE_ANON_KEY
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
  
  // First, try with message_feedback. If it fails, fall back to without it
  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        file_attachments (*),
        message_feedback (*)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      // If it's a relationship error, fall back to query without feedback
      if (error.code === 'PGRST200' && error.message.includes('message_feedback')) {
        console.warn('message_feedback table not found, falling back to query without feedback');
        return getMessagesWithoutFeedback(conversationId);
      }
      throw error;
    }

    // Transform the data to match our frontend types
    const transformedMessages = data?.map(message => ({
      ...message,
      files: message.file_attachments?.map((attachment: any) => ({
        id: attachment.id,
        name: attachment.name,
        type: attachment.type,
        size: attachment.size,
        url: attachment.url,
        storage_path: attachment.storage_path,
        uploaded_at: attachment.created_at
      })) || [],
      feedback: message.message_feedback?.[0] || null
    })) || [];

    return transformedMessages;
  } catch (err: any) {
    // If it's a relationship error, fall back to query without feedback
    if (err.code === 'PGRST200' && err.message.includes('message_feedback')) {
      console.warn('message_feedback table not found, falling back to query without feedback');
      return getMessagesWithoutFeedback(conversationId);
    }
    throw err;
  }
};

// Fallback function for when message_feedback table doesn't exist yet
const getMessagesWithoutFeedback = async (conversationId: string) => {
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

  // Transform the data to match our frontend types (without feedback)
  const transformedMessages = data?.map(message => ({
    ...message,
    files: message.file_attachments?.map((attachment: any) => ({
      id: attachment.id,
      name: attachment.name,
      type: attachment.type,
      size: attachment.size,
      url: attachment.url,
      storage_path: attachment.storage_path,
      uploaded_at: attachment.created_at
    })) || [],
    feedback: null // No feedback available yet
  })) || [];

  return transformedMessages;
};

export const createMessage = async (message: {
  conversation_id: string;
  content: string;
  role: 'user' | 'assistant';
  persona_id?: string;
  files?: any[];
}) => {
  if (!supabase) {
    throw new Error('Supabase not initialized');
  }
  
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: message.conversation_id,
      content: message.content,
      role: message.role,
      persona_id: message.persona_id
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  // Handle file attachments if provided
  if (message.files && message.files.length > 0) {
    const fileAttachments = message.files.map(file => ({
      message_id: data.id,
      name: file.name,
      type: file.type,
      size: file.size,
      url: file.url,
      storage_path: file.storage_path || ''
    }));

    const { error: fileError } = await supabase
      .from('file_attachments')
      .insert(fileAttachments);

    if (fileError) {
      console.error('Error inserting file attachments:', fileError);
      // Don't throw here as the message was already created
    }
  }

  return data;
};

export const deleteConversation = async (conversationId: string) => {
  if (!supabase) {
    throw new Error('Supabase not initialized');
  }

  // Get all messages in the conversation with their file attachments
  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select(`
      id,
      file_attachments (
        id,
        storage_path
      )
    `)
    .eq('conversation_id', conversationId);

  if (messagesError) {
    throw messagesError;
  }

  // Delete all file attachments from storage
  for (const message of messages || []) {
    if (message.file_attachments) {
      for (const attachment of message.file_attachments) {
        try {
          await deleteFile(attachment.storage_path);
        } catch (err) {
          console.error('Error deleting file from storage:', err);
          // Continue with cleanup even if file deletion fails
        }
      }
    }
  }

  // Delete file attachment records
  const { error: fileAttachmentsError } = await supabase
    .from('file_attachments')
    .delete()
    .in('message_id', messages?.map(m => m.id) || []);

  if (fileAttachmentsError) {
    throw fileAttachmentsError;
  }

  // Delete all messages in the conversation
  const { error: messagesDeleteError } = await supabase
    .from('messages')
    .delete()
    .eq('conversation_id', conversationId);

  if (messagesDeleteError) {
    throw messagesDeleteError;
  }

  // Finally, delete the conversation
  const { error: conversationError } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId);

  if (conversationError) {
    throw conversationError;
  }
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
      (payload) => {
        callback({
          ...payload,
          eventType: payload.eventType
        });
      }
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
      (payload) => {
        callback({
          ...payload,
          eventType: payload.eventType
        });
      }
    )
    .subscribe();
};

// Message feedback functions
export const createMessageFeedback = async (messageId: string, userId: string, feedbackType: 'upvote' | 'downvote') => {
  if (!supabase) {
    throw new Error('Supabase not initialized');
  }

  try {
    const { data, error } = await supabase
      .from('message_feedback')
      .upsert({
        message_id: messageId,
        user_id: userId,
        feedback_type: feedbackType
      })
      .select()
      .single();

    if (error) {
      // If table doesn't exist, log and return null
      if (error.code === 'PGRST106' || error.message.includes('message_feedback')) {
        console.warn('message_feedback table not found - feedback feature not available yet');
        return null;
      }
      throw error;
    }

    return data;
  } catch (err: any) {
    // If table doesn't exist, log and return null
    if (err.code === 'PGRST106' || err.message.includes('message_feedback')) {
      console.warn('message_feedback table not found - feedback feature not available yet');
      return null;
    }
    throw err;
  }
};

export const deleteMessageFeedback = async (messageId: string, userId: string) => {
  if (!supabase) {
    throw new Error('Supabase not initialized');
  }

  try {
    const { error } = await supabase
      .from('message_feedback')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId);

    if (error) {
      // If table doesn't exist, log and return
      if (error.code === 'PGRST106' || error.message.includes('message_feedback')) {
        console.warn('message_feedback table not found - feedback feature not available yet');
        return;
      }
      throw error;
    }
  } catch (err: any) {
    // If table doesn't exist, log and return
    if (err.code === 'PGRST106' || err.message.includes('message_feedback')) {
      console.warn('message_feedback table not found - feedback feature not available yet');
      return;
    }
    throw err;
  }
};

export const getMessageFeedback = async (messageId: string, userId: string) => {
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('message_feedback')
      .select('*')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found error is okay
      // If table doesn't exist, log and return null
      if (error.code === 'PGRST106' || error.message.includes('message_feedback')) {
        console.warn('message_feedback table not found - feedback feature not available yet');
        return null;
      }
      throw error;
    }

    return data;
  } catch (err: any) {
    // If table doesn't exist, log and return null
    if (err.code === 'PGRST106' || err.message.includes('message_feedback')) {
      console.warn('message_feedback table not found - feedback feature not available yet');
      return null;
    }
    throw err;
  }
}; 