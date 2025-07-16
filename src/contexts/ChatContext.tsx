import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { ChatContextType, Conversation, Message, Persona } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { getAllPersonas, getDefaultPersona, getPersonaById } from '@/config/personas';
import { 
  getConversations, 
  getMessages, 
  createConversation, 
  createMessage,
  subscribeToConversations,
  subscribeToMessages 
} from '@/lib/supabase';
import { DatabaseService } from '@/services/database';
import { ERROR_MESSAGES, SUCCESS_MESSAGES, STORAGE_KEYS } from '@/config/constants';

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

interface ChatProviderProps {
  children: React.ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<Persona>(getDefaultPersona());
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use refs to track subscriptions for proper cleanup
  const conversationsSubscriptionRef = useRef<any>(null);
  const messagesSubscriptionRef = useRef<any>(null);

  // Load user's conversations when user changes
  useEffect(() => {
    if (user) {
      loadUserConversations();
      setupConversationsSubscription();
    } else {
      // Clear data when user logs out
      setConversations([]);
      setCurrentConversation(null);
      setMessages([]);
      cleanupSubscriptions();
    }

    return () => {
      cleanupSubscriptions();
    };
  }, [user]);

  // Setup message subscription when current conversation changes
  useEffect(() => {
    if (user && currentConversation) {
      setupMessagesSubscription(currentConversation.id);
    } else {
      cleanupMessagesSubscription();
    }

    return () => {
      cleanupMessagesSubscription();
    };
  }, [user, currentConversation?.id]);

  // Load selected persona from localStorage
  useEffect(() => {
    const savedPersonaId = localStorage.getItem(STORAGE_KEYS.SELECTED_PERSONA);
    if (savedPersonaId) {
      const persona = getPersonaById(savedPersonaId);
      if (persona) {
        setSelectedPersona(persona);
      }
    }
  }, []);

  // Save selected persona to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SELECTED_PERSONA, selectedPersona.id);
  }, [selectedPersona]);

  const cleanupSubscriptions = () => {
    cleanupConversationsSubscription();
    cleanupMessagesSubscription();
  };

  const cleanupConversationsSubscription = () => {
    if (conversationsSubscriptionRef.current) {
      conversationsSubscriptionRef.current.unsubscribe();
      conversationsSubscriptionRef.current = null;
    }
  };

  const cleanupMessagesSubscription = () => {
    if (messagesSubscriptionRef.current) {
      messagesSubscriptionRef.current.unsubscribe();
      messagesSubscriptionRef.current = null;
    }
  };

  const loadUserConversations = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);
      const userConversations = await getConversations(user.id);
      setConversations(userConversations);
      
      // Auto-conversation logic: automatically select first conversation or create new one
      if (userConversations.length > 0) {
        const firstConversation = userConversations[0];
        setCurrentConversation(firstConversation);
        
        // Set persona for this conversation
        const persona = getPersonaById(firstConversation.persona_id);
        if (persona) {
          setSelectedPersona(persona);
        }
        
        // Load messages for the first conversation
        await loadMessages(firstConversation.id);
      } else {
        // Auto-create first conversation with default persona
        await createNewConversation(getDefaultPersona().id);
      }
    } catch (err: any) {
      console.error('Error loading conversations:', err);
      setError(ERROR_MESSAGES.CONVERSATION_LOAD_ERROR);
    } finally {
      setIsLoading(false);
    }
  };

  const setupConversationsSubscription = () => {
    if (!user) return;

    cleanupConversationsSubscription();
    
    // Subscribe to conversation changes
    conversationsSubscriptionRef.current = subscribeToConversations(user.id, (payload) => {
      console.log('Conversation change:', payload);
      // Reload conversations when there are changes
      loadUserConversations();
    });
  };

  const setupMessagesSubscription = (conversationId: string) => {
    if (!user || !conversationId) return;

    cleanupMessagesSubscription();

    // Subscribe to message changes for the specified conversation
    messagesSubscriptionRef.current = subscribeToMessages(conversationId, (payload) => {
      console.log('Message change:', payload);
      if (payload.eventType === 'INSERT') {
        setMessages(prev => [...prev, payload.new]);
      } else if (payload.eventType === 'UPDATE') {
        setMessages(prev => prev.map(msg => 
          msg.id === payload.new.id ? payload.new : msg
        ));
      }
    });
  };

  const createNewConversation = async (personaId: string) => {
    if (!user) {
      setError(ERROR_MESSAGES.AUTH_ERROR);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const persona = getPersonaById(personaId);
      if (!persona) {
        setError('Invalid persona selected');
        return;
      }

      const title = `New conversation with ${persona.displayName}`;
      const newConversation = await createConversation(user.id, personaId, title);
      
      // Update conversations list
      setConversations(prev => [newConversation, ...prev]);
      
      // Switch to new conversation
      setCurrentConversation(newConversation);
      setSelectedPersona(persona);
      setMessages([]);
      
    } catch (err: any) {
      console.error('Error creating conversation:', err);
      setError(ERROR_MESSAGES.CONVERSATION_LOAD_ERROR);
    } finally {
      setIsLoading(false);
    }
  };

  const switchConversation = async (conversationId: string) => {
    const conversation = conversations.find(conv => conv.id === conversationId);
    if (!conversation) {
      setError('Conversation not found');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Clear current messages immediately to avoid showing wrong content
      setMessages([]);

      // Set current conversation
      setCurrentConversation(conversation);
      
      // Set persona for this conversation
      const persona = getPersonaById(conversation.persona_id);
      if (persona) {
        setSelectedPersona(persona);
      }

      // Load messages for this conversation
      await loadMessages(conversationId);
      
    } catch (err: any) {
      console.error('Error switching conversation:', err);
      setError(ERROR_MESSAGES.CONVERSATION_LOAD_ERROR);
      // If there's an error, clear messages to avoid showing stale data
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteConversation = async (conversationId: string) => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      // Use database service to properly delete conversation
      const databaseService = DatabaseService.getInstance();
      await databaseService.deleteConversation(conversationId);
      
      // Update conversations list
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      
      // Handle conversation switching logic
      if (currentConversation?.id === conversationId) {
        // Switch to another conversation or create new one
        const remainingConversations = conversations.filter(conv => conv.id !== conversationId);
        if (remainingConversations.length > 0) {
          // Switch to the first remaining conversation
          await switchConversation(remainingConversations[0].id);
        } else {
          // No conversations left, create a new one
          setCurrentConversation(null);
          setMessages([]);
          await createNewConversation(selectedPersona.id);
        }
      }
      
    } catch (err: any) {
      console.error('Error deleting conversation:', err);
      setError('Failed to delete conversation');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      setError(null);
      
      const conversationMessages = await getMessages(conversationId);
      setMessages(conversationMessages || []);
      
    } catch (err: any) {
      console.error('Error loading messages:', err);
      setError(ERROR_MESSAGES.CONVERSATION_LOAD_ERROR);
      // Clear messages on error to avoid showing stale data
      setMessages([]);
    }
  };

  const addMessage = async (message: Omit<Message, 'id' | 'created_at' | 'updated_at'>) => {
    if (!currentConversation) {
      setError('No active conversation');
      return;
    }

    try {
      setError(null);
      
      const newMessage = await createMessage({
        conversation_id: message.conversation_id,
        content: message.content,
        role: message.role,
        persona_id: message.persona_id
      });

      // Message will be added via real-time subscription
      // But we can optimistically add it for better UX
      setMessages(prev => [...prev, {
        ...newMessage,
        files: message.files || []
      }]);
      
    } catch (err: any) {
      console.error('Error adding message:', err);
      setError(ERROR_MESSAGES.MESSAGE_SEND_ERROR);
    }
  };

  const updateMessage = async (messageId: string, content: string) => {
    try {
      setError(null);
      
      // Update message in local state optimistically
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, content } : msg
      ));

      // TODO: Implement message update in Supabase
      
    } catch (err: any) {
      console.error('Error updating message:', err);
      setError('Failed to update message');
    }
  };

  const handlePersonaChange = useCallback((persona: Persona) => {
    setSelectedPersona(persona);
  }, []);

  const value: ChatContextType = {
    conversations,
    currentConversation,
    selectedPersona,
    messages,
    isLoading,
    error,
    setSelectedPersona: handlePersonaChange,
    createNewConversation,
    switchConversation,
    deleteConversation,
    loadMessages,
    addMessage,
    updateMessage
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}; 