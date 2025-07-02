import { 
  supabase, 
  createConversation as supabaseCreateConversation,
  createMessage as supabaseCreateMessage,
  getConversations as supabaseGetConversations,
  getMessages as supabaseGetMessages,
  subscribeToConversations,
  subscribeToMessages
} from '@/lib/supabase';
import { Conversation, Message, ConversationRow, MessageRow } from '@/types';
import { DB_TABLES, ERROR_MESSAGES, PAGINATION } from '@/config/constants';

export class DatabaseService {
  private static instance: DatabaseService;

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  // Conversation Management
  async createConversation(
    userId: string, 
    personaId: string, 
    title: string
  ): Promise<Conversation> {
    try {
      const conversationData = await supabaseCreateConversation(userId, personaId, title);
      return this.mapConversationRowToConversation(conversationData);
    } catch (error: any) {
      console.error('Error creating conversation:', error);
      throw new Error(ERROR_MESSAGES.SUPABASE_CONNECTION_ERROR);
    }
  }

  async getConversations(
    userId: string, 
    limit: number = PAGINATION.CONVERSATIONS_PER_PAGE,
    offset: number = 0
  ): Promise<Conversation[]> {
    try {
      const { data, error } = await supabase
        .from(DB_TABLES.CONVERSATIONS)
        .select('*')
        .eq('user_id', userId)
        .order('last_message_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return data.map(this.mapConversationRowToConversation);
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
      throw new Error(ERROR_MESSAGES.CONVERSATION_LOAD_ERROR);
    }
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    try {
      const { data, error } = await supabase
        .from(DB_TABLES.CONVERSATIONS)
        .select('*')
        .eq('id', conversationId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw error;
      }

      return this.mapConversationRowToConversation(data);
    } catch (error: any) {
      console.error('Error fetching conversation:', error);
      throw new Error(ERROR_MESSAGES.CONVERSATION_LOAD_ERROR);
    }
  }

  async updateConversation(
    conversationId: string, 
    updates: Partial<Pick<Conversation, 'title' | 'persona_id'>>
  ): Promise<Conversation> {
    try {
      const { data, error } = await supabase
        .from(DB_TABLES.CONVERSATIONS)
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.mapConversationRowToConversation(data);
    } catch (error: any) {
      console.error('Error updating conversation:', error);
      throw new Error(ERROR_MESSAGES.SUPABASE_CONNECTION_ERROR);
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    try {
      // First delete all messages in the conversation
      await this.deleteMessagesInConversation(conversationId);

      // Then delete the conversation
      const { error } = await supabase
        .from(DB_TABLES.CONVERSATIONS)
        .delete()
        .eq('id', conversationId);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error('Error deleting conversation:', error);
      throw new Error(ERROR_MESSAGES.SUPABASE_CONNECTION_ERROR);
    }
  }

  async updateConversationActivity(conversationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from(DB_TABLES.CONVERSATIONS)
        .update({
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error('Error updating conversation activity:', error);
      // Don't throw here as this is not critical
    }
  }

  // Message Management
  async createMessage(messageData: {
    conversation_id: string;
    content: string;
    role: 'user' | 'assistant';
    persona_id?: string;
  }): Promise<Message> {
    try {
      const dbMessage = await supabaseCreateMessage(messageData);
      
      // Update conversation activity
      await this.updateConversationActivity(messageData.conversation_id);
      await this.incrementMessageCount(messageData.conversation_id);

      return this.mapMessageRowToMessage(dbMessage);
    } catch (error: any) {
      console.error('Error creating message:', error);
      throw new Error(ERROR_MESSAGES.MESSAGE_SEND_ERROR);
    }
  }

  async getMessages(
    conversationId: string,
    limit: number = PAGINATION.MESSAGES_PER_PAGE,
    offset: number = 0
  ): Promise<Message[]> {
    try {
      const messages = await supabaseGetMessages(conversationId);
      return messages.map(this.mapMessageRowToMessage);
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      throw new Error(ERROR_MESSAGES.CONVERSATION_LOAD_ERROR);
    }
  }

  async updateMessage(messageId: string, content: string): Promise<Message> {
    try {
      const { data, error } = await supabase
        .from(DB_TABLES.MESSAGES)
        .update({
          content,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.mapMessageRowToMessage(data);
    } catch (error: any) {
      console.error('Error updating message:', error);
      throw new Error(ERROR_MESSAGES.MESSAGE_SEND_ERROR);
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    try {
      // First delete file attachments
      await this.deleteMessageFileAttachments(messageId);

      // Then delete the message
      const { error } = await supabase
        .from(DB_TABLES.MESSAGES)
        .delete()
        .eq('id', messageId);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error('Error deleting message:', error);
      throw new Error(ERROR_MESSAGES.SUPABASE_CONNECTION_ERROR);
    }
  }

  private async deleteMessagesInConversation(conversationId: string): Promise<void> {
    try {
      // Get all messages in the conversation
      const { data: messages, error: fetchError } = await supabase
        .from(DB_TABLES.MESSAGES)
        .select('id')
        .eq('conversation_id', conversationId);

      if (fetchError) {
        throw fetchError;
      }

      // Delete file attachments for all messages
      for (const message of messages) {
        await this.deleteMessageFileAttachments(message.id);
      }

      // Delete all messages
      const { error: deleteError } = await supabase
        .from(DB_TABLES.MESSAGES)
        .delete()
        .eq('conversation_id', conversationId);

      if (deleteError) {
        throw deleteError;
      }
    } catch (error: any) {
      console.error('Error deleting messages in conversation:', error);
      throw error;
    }
  }

  private async deleteMessageFileAttachments(messageId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from(DB_TABLES.FILE_ATTACHMENTS)
        .delete()
        .eq('message_id', messageId);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error('Error deleting message file attachments:', error);
      // Don't throw here as this is cleanup
    }
  }

  private async incrementMessageCount(conversationId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('increment_message_count', {
        conversation_id: conversationId
      });

      if (error) {
        // If RPC doesn't exist, fall back to manual count
        const { data, error: countError } = await supabase
          .from(DB_TABLES.MESSAGES)
          .select('id', { count: 'exact' })
          .eq('conversation_id', conversationId);

        if (!countError && data) {
          await supabase
            .from(DB_TABLES.CONVERSATIONS)
            .update({ message_count: data.length })
            .eq('id', conversationId);
        }
      }
    } catch (error: any) {
      console.error('Error incrementing message count:', error);
      // Don't throw here as this is not critical
    }
  }

  // Search functionality
  async searchConversations(
    userId: string, 
    query: string, 
    limit: number = 20
  ): Promise<Conversation[]> {
    try {
      const { data, error } = await supabase
        .from(DB_TABLES.CONVERSATIONS)
        .select('*')
        .eq('user_id', userId)
        .or(`title.ilike.%${query}%`)
        .order('last_message_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data.map(this.mapConversationRowToConversation);
    } catch (error: any) {
      console.error('Error searching conversations:', error);
      throw new Error(ERROR_MESSAGES.CONVERSATION_LOAD_ERROR);
    }
  }

  async searchMessages(
    conversationId: string, 
    query: string, 
    limit: number = 50
  ): Promise<Message[]> {
    try {
      const { data, error } = await supabase
        .from(DB_TABLES.MESSAGES)
        .select('*')
        .eq('conversation_id', conversationId)
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data.map(this.mapMessageRowToMessage);
    } catch (error: any) {
      console.error('Error searching messages:', error);
      throw new Error(ERROR_MESSAGES.CONVERSATION_LOAD_ERROR);
    }
  }

  // Real-time subscriptions
  subscribeToConversations(userId: string, callback: (payload: any) => void) {
    return subscribeToConversations(userId, callback);
  }

  subscribeToMessages(conversationId: string, callback: (payload: any) => void) {
    return subscribeToMessages(conversationId, callback);
  }

  // Utility methods for data mapping
  private mapConversationRowToConversation(row: ConversationRow): Conversation {
    return {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      persona_id: row.persona_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_message_at: row.last_message_at,
      message_count: row.message_count
    };
  }

  private mapMessageRowToMessage(row: MessageRow): Message {
    return {
      id: row.id,
      conversation_id: row.conversation_id,
      content: row.content,
      role: row.role,
      persona_id: row.persona_id,
      files: row.files || [],
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  // Analytics and stats
  async getConversationStats(userId: string): Promise<{
    totalConversations: number;
    totalMessages: number;
    averageMessagesPerConversation: number;
  }> {
    try {
      const { data: conversations, error: convError } = await supabase
        .from(DB_TABLES.CONVERSATIONS)
        .select('id, message_count')
        .eq('user_id', userId);

      if (convError) {
        throw convError;
      }

      const totalConversations = conversations.length;
      const totalMessages = conversations.reduce((sum, conv) => sum + conv.message_count, 0);
      const averageMessagesPerConversation = totalConversations > 0 
        ? totalMessages / totalConversations 
        : 0;

      return {
        totalConversations,
        totalMessages,
        averageMessagesPerConversation: Math.round(averageMessagesPerConversation * 100) / 100
      };
    } catch (error: any) {
      console.error('Error fetching conversation stats:', error);
      throw new Error(ERROR_MESSAGES.SUPABASE_CONNECTION_ERROR);
    }
  }
}

// Export singleton instance
export const databaseService = DatabaseService.getInstance(); 