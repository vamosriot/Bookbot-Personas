import { useState, useCallback } from 'react';
import { useChat as useChatContext } from '@/contexts/ChatContext';
import { openAIService } from '@/services/openai';
import { databaseService } from '@/services/database';
import { Message, FileAttachment } from '@/types';
import { ERROR_MESSAGES, LOADING_STATES } from '@/config/constants';

export interface UseChatReturn {
  // State
  isLoading: boolean;
  error: string | null;
  isStreaming: boolean;
  currentStreamingMessage: string;
  
  // Actions
  sendMessage: (content: string, files?: FileAttachment[]) => Promise<void>;
  resendMessage: (messageId: string) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  stopStreaming: () => void;
  clearError: () => void;
  regenerateResponse: (messageId: string) => Promise<void>;
}

export const useChat = (): UseChatReturn => {
  const {
    currentConversation,
    selectedPersona,
    messages,
    addMessage,
    updateMessage,
    error: contextError
  } = useChatContext();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState('');

  // Clear errors
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Send message with optional files
  const sendMessage = useCallback(async (content: string, files?: FileAttachment[]) => {
    if (!currentConversation) {
      setError('No active conversation');
      return;
    }

    if (!content.trim() && (!files || files.length === 0)) {
      setError('Message cannot be empty');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setIsStreaming(false);
      setCurrentStreamingMessage('');

      // Add user message to database
      const userMessage: Omit<Message, 'id' | 'created_at' | 'updated_at'> = {
        conversation_id: currentConversation.id,
        content,
        role: 'user',
        persona_id: selectedPersona.id,
        files: files || []
      };

      await addMessage(userMessage);

      // Prepare messages for OpenAI (get conversation context)
      const contextMessages = openAIService.getConversationContext([
        ...messages,
        {
          ...userMessage,
          id: 'temp-user-message',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);

      // Start streaming response
      setIsStreaming(true);
      let fullResponse = '';
      let assistantMessageId: string | null = null;

      await openAIService.sendMessage(
        contextMessages,
        selectedPersona.id,
        // On chunk received
        (chunk: string) => {
          fullResponse += chunk;
          setCurrentStreamingMessage(fullResponse);
        },
        // On complete
        async (completeResponse: string) => {
          try {
            // Add assistant message to database
            const assistantMessage: Omit<Message, 'id' | 'created_at' | 'updated_at'> = {
              conversation_id: currentConversation.id,
              content: completeResponse,
              role: 'assistant',
              persona_id: selectedPersona.id
            };

            await addMessage(assistantMessage);
            
            setIsStreaming(false);
            setCurrentStreamingMessage('');
          } catch (dbError: any) {
            console.error('Error saving assistant message:', dbError);
            setError(ERROR_MESSAGES.MESSAGE_SEND_ERROR);
          }
        },
        // On error
        (errorMessage: string) => {
          setError(errorMessage);
          setIsStreaming(false);
          setCurrentStreamingMessage('');
        }
      );

    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.message || ERROR_MESSAGES.MESSAGE_SEND_ERROR);
      setIsStreaming(false);
      setCurrentStreamingMessage('');
    } finally {
      setIsLoading(false);
    }
  }, [currentConversation, selectedPersona, messages, addMessage]);

  // Resend a message (retry sending)
  const resendMessage = useCallback(async (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) {
      setError('Message not found');
      return;
    }

    if (message.role !== 'user') {
      setError('Can only resend user messages');
      return;
    }

    // Resend the message content and files
    await sendMessage(message.content, message.files);
  }, [messages, sendMessage]);

  // Edit a message
  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!newContent.trim()) {
      setError('Message content cannot be empty');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      await updateMessage(messageId, newContent);

      // If this was a user message, we might want to regenerate the AI response
      const message = messages.find(m => m.id === messageId);
      if (message && message.role === 'user') {
        // Find the next assistant message and regenerate it
        const messageIndex = messages.findIndex(m => m.id === messageId);
        if (messageIndex !== -1 && messageIndex < messages.length - 1) {
          const nextMessage = messages[messageIndex + 1];
          if (nextMessage.role === 'assistant') {
            await regenerateResponse(nextMessage.id);
          }
        }
      }
    } catch (err: any) {
      console.error('Error editing message:', err);
      setError(err.message || 'Failed to edit message');
    } finally {
      setIsLoading(false);
    }
  }, [messages, updateMessage]);

  // Delete a message
  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      await databaseService.deleteMessage(messageId);
      
      // The message will be removed from the UI via real-time subscription
    } catch (err: any) {
      console.error('Error deleting message:', err);
      setError(err.message || 'Failed to delete message');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Stop current streaming
  const stopStreaming = useCallback(() => {
    openAIService.abortCurrentRequest();
    setIsStreaming(false);
    setCurrentStreamingMessage('');
  }, []);

  // Regenerate AI response
  const regenerateResponse = useCallback(async (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message || message.role !== 'assistant') {
      setError('Can only regenerate assistant messages');
      return;
    }

    if (!currentConversation) {
      setError('No active conversation');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setIsStreaming(true);
      setCurrentStreamingMessage('');

      // Get all messages up to (but not including) the message to regenerate
      const messageIndex = messages.findIndex(m => m.id === messageId);
      const contextMessages = messages.slice(0, messageIndex);

      let fullResponse = '';

      await openAIService.sendMessage(
        contextMessages,
        selectedPersona.id,
        // On chunk received
        (chunk: string) => {
          fullResponse += chunk;
          setCurrentStreamingMessage(fullResponse);
        },
        // On complete
        async (completeResponse: string) => {
          try {
            // Update the existing assistant message
            await updateMessage(messageId, completeResponse);
            
            setIsStreaming(false);
            setCurrentStreamingMessage('');
          } catch (dbError: any) {
            console.error('Error updating assistant message:', dbError);
            setError(ERROR_MESSAGES.MESSAGE_SEND_ERROR);
          }
        },
        // On error
        (errorMessage: string) => {
          setError(errorMessage);
          setIsStreaming(false);
          setCurrentStreamingMessage('');
        }
      );

    } catch (err: any) {
      console.error('Error regenerating response:', err);
      setError(err.message || ERROR_MESSAGES.MESSAGE_SEND_ERROR);
      setIsStreaming(false);
      setCurrentStreamingMessage('');
    } finally {
      setIsLoading(false);
    }
  }, [currentConversation, selectedPersona, messages, updateMessage]);

  return {
    // State
    isLoading,
    error: error || contextError,
    isStreaming,
    currentStreamingMessage,
    
    // Actions
    sendMessage,
    resendMessage,
    editMessage,
    deleteMessage,
    stopStreaming,
    clearError,
    regenerateResponse
  };
}; 