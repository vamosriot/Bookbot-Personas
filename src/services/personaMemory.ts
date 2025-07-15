import { supabase } from '@/lib/supabase';
import { Persona, Message } from '@/types';
import { ProcessedFileContent } from './fileUpload';

export interface PersonaMemory {
  conversationId: string;
  personaId: string;
  userPreferences: Record<string, any>;
  discussedTopics: string[];
  bookRecommendations: string[];
  userInterests: string[];
  previousContext: string[];
  lastInteraction: string;
  sessionCount: number;
}

export interface EnhancedPersonaContext {
  persona: Persona;
  memory: PersonaMemory;
  fileContext?: ProcessedFileContent[];
  conversationHistory: Message[];
}

export class PersonaMemoryService {
  private static instance: PersonaMemoryService;
  private memories = new Map<string, PersonaMemory>();

  static getInstance(): PersonaMemoryService {
    if (!PersonaMemoryService.instance) {
      PersonaMemoryService.instance = new PersonaMemoryService();
    }
    return PersonaMemoryService.instance;
  }

  // Get or create memory for a conversation
  async getOrCreateMemory(conversationId: string, personaId: string): Promise<PersonaMemory> {
    const key = `${conversationId}-${personaId}`;
    
    if (this.memories.has(key)) {
      return this.memories.get(key)!;
    }

    // Try to load from database
    const stored = await this.loadMemoryFromDatabase(conversationId, personaId);
    if (stored) {
      this.memories.set(key, stored);
      return stored;
    }

    // Create new memory
    const newMemory: PersonaMemory = {
      conversationId,
      personaId,
      userPreferences: {},
      discussedTopics: [],
      bookRecommendations: [],
      userInterests: [],
      previousContext: [],
      lastInteraction: new Date().toISOString(),
      sessionCount: 1
    };

    this.memories.set(key, newMemory);
    await this.saveMemoryToDatabase(newMemory);
    return newMemory;
  }

  // Update memory with new information from conversation
  async updateMemory(
    conversationId: string, 
    personaId: string, 
    messages: Message[],
    fileContext?: ProcessedFileContent[]
  ): Promise<void> {
    const memory = await this.getOrCreateMemory(conversationId, personaId);
    
    // Extract topics from recent messages
    const recentTopics = this.extractTopicsFromMessages(messages.slice(-5));
    memory.discussedTopics = [...new Set([...memory.discussedTopics, ...recentTopics])];
    
    // Extract user preferences
    const preferences = this.extractUserPreferences(messages);
    memory.userPreferences = { ...memory.userPreferences, ...preferences };
    
    // Extract book recommendations from AI responses
    const recommendations = this.extractBookRecommendations(messages);
    memory.bookRecommendations = [...new Set([...memory.bookRecommendations, ...recommendations])];
    
    // Update file context
    if (fileContext && fileContext.length > 0) {
      const fileTopics = fileContext
        .filter(f => f.content)
        .map(f => this.extractTopicsFromText(f.content!))
        .flat();
      memory.discussedTopics = [...new Set([...memory.discussedTopics, ...fileTopics])];
    }
    
    // Update session info
    memory.lastInteraction = new Date().toISOString();
    memory.sessionCount += 1;
    
    // Keep only recent context to prevent memory bloat
    memory.discussedTopics = memory.discussedTopics.slice(-20);
    memory.bookRecommendations = memory.bookRecommendations.slice(-15);
    
    await this.saveMemoryToDatabase(memory);
  }

  // Generate enhanced system prompt with memory context
  generatePersonalizedSystemPrompt(
    persona: Persona, 
    memory: PersonaMemory,
    fileContext?: ProcessedFileContent[]
  ): string {
    let enhancedPrompt = persona.systemMessage;
    
    // Add memory context
    if (memory.discussedTopics.length > 0) {
      enhancedPrompt += `\n\nPrevious topics discussed: ${memory.discussedTopics.slice(-10).join(', ')}`;
    }
    
    if (Object.keys(memory.userPreferences).length > 0) {
      enhancedPrompt += `\n\nUser preferences you've learned: ${JSON.stringify(memory.userPreferences)}`;
    }
    
    if (memory.bookRecommendations.length > 0) {
      enhancedPrompt += `\n\nBooks you've previously recommended: ${memory.bookRecommendations.slice(-5).join(', ')}`;
    }
    
    // Add file context
    if (fileContext && fileContext.length > 0) {
      const fileDescriptions = fileContext.map(f => {
              if (f.type === 'text') {
          return `Text file with content: ${f.content?.substring(0, 300)}...`;
        } else if (f.type === 'image') {
          return `Image file that the user has shared`;
        }
        return `Document file that the user has shared`;
      });
      
      enhancedPrompt += `\n\nUser has shared files: ${fileDescriptions.join('; ')}`;
    }
    
    enhancedPrompt += `\n\nMaintain consistency with previous conversations and build upon what you've learned about this user.`;
    
    return enhancedPrompt;
  }

  // Extract topics from messages using simple keyword analysis
  private extractTopicsFromMessages(messages: Message[]): string[] {
    const topics: string[] = [];
    
    messages.forEach(message => {
      if (message.content) {
        topics.push(...this.extractTopicsFromText(message.content));
      }
    });
    
    return [...new Set(topics)];
  }

  private extractTopicsFromText(text: string): string[] {
    const bookKeywords = [
      'book', 'author', 'novel', 'fiction', 'non-fiction', 'genre', 'reading',
      'literary', 'poetry', 'biography', 'history', 'science', 'fantasy',
      'mystery', 'romance', 'thriller', 'classic', 'bestseller', 'review'
    ];
    
    const topics: string[] = [];
    const words = text.toLowerCase().split(/\s+/);
    
    bookKeywords.forEach(keyword => {
      if (words.some(word => word.includes(keyword))) {
        topics.push(keyword);
      }
    });
    
    // Extract potential book titles (words in quotes or capitalized phrases)
    const titlePattern = /"([^"]+)"|([A-Z][a-z]+ (?:[A-Z][a-z]+ )*[A-Z][a-z]+)/g;
    const matches = text.match(titlePattern);
    if (matches) {
      topics.push(...matches.map(m => m.replace(/"/g, '')));
    }
    
    return topics;
  }

  private extractUserPreferences(messages: Message[]): Record<string, any> {
    const preferences: Record<string, any> = {};
    const userMessages = messages.filter(m => m.role === 'user');
    
    userMessages.forEach(message => {
      const content = message.content.toLowerCase();
      
      // Extract reading preferences
      if (content.includes('love') || content.includes('enjoy')) {
        const words = content.split(' ');
        const loveIndex = words.findIndex(w => w.includes('love') || w.includes('enjoy'));
        if (loveIndex !== -1 && loveIndex < words.length - 1) {
          preferences.interests = preferences.interests || [];
          preferences.interests.push(words.slice(loveIndex + 1, loveIndex + 3).join(' '));
        }
      }
      
      // Extract budget sensitivity
      if (content.includes('cheap') || content.includes('expensive') || content.includes('budget')) {
        preferences.priceSensitive = content.includes('cheap') || content.includes('budget');
      }
      
      // Extract format preferences
      if (content.includes('digital') || content.includes('ebook')) {
        preferences.preferredFormat = 'digital';
      } else if (content.includes('physical') || content.includes('paperback') || content.includes('hardcover')) {
        preferences.preferredFormat = 'physical';
      }
    });
    
    return preferences;
  }

  private extractBookRecommendations(messages: Message[]): string[] {
    const recommendations: string[] = [];
    const aiMessages = messages.filter(m => m.role === 'assistant');
    
    aiMessages.forEach(message => {
      // Look for book titles in quotes or common recommendation phrases
      const recommendPattern = /(?:recommend|suggest|try|read)\s+["']?([^"'.,!?]+)["']?/gi;
      const matches = message.content.match(recommendPattern);
      if (matches) {
        recommendations.push(...matches.map(m => m.replace(/^(recommend|suggest|try|read)\s+["']?/i, '').replace(/["']?$/, '')));
      }
    });
    
    return recommendations;
  }

  // Database operations
  private async loadMemoryFromDatabase(conversationId: string, personaId: string): Promise<PersonaMemory | null> {
    try {
      const { data, error } = await supabase
        .from('persona_memories')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('persona_id', personaId)
        .single();
      
      if (error || !data) {
        return null;
      }
      
      return {
        conversationId: data.conversation_id,
        personaId: data.persona_id,
        userPreferences: data.user_preferences || {},
        discussedTopics: data.discussed_topics || [],
        bookRecommendations: data.book_recommendations || [],
        userInterests: data.user_interests || [],
        previousContext: data.previous_context || [],
        lastInteraction: data.last_interaction,
        sessionCount: data.session_count || 1
      };
    } catch (error) {
      console.error('Error loading persona memory:', error);
      return null;
    }
  }

  private async saveMemoryToDatabase(memory: PersonaMemory): Promise<void> {
    try {
      const { error } = await supabase
        .from('persona_memories')
        .upsert({
          conversation_id: memory.conversationId,
          persona_id: memory.personaId,
          user_preferences: memory.userPreferences,
          discussed_topics: memory.discussedTopics,
          book_recommendations: memory.bookRecommendations,
          user_interests: memory.userInterests,
          previous_context: memory.previousContext,
          last_interaction: memory.lastInteraction,
          session_count: memory.sessionCount
        }, {
          onConflict: 'conversation_id,persona_id'
        });
      
      if (error) {
        console.error('Error saving persona memory:', error);
      }
    } catch (error) {
      console.error('Error saving persona memory:', error);
    }
  }

  // Clear memory for a conversation
  async clearMemory(conversationId: string, personaId: string): Promise<void> {
    const key = `${conversationId}-${personaId}`;
    this.memories.delete(key);
    
    try {
      await supabase
        .from('persona_memories')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('persona_id', personaId);
    } catch (error) {
      console.error('Error clearing persona memory:', error);
    }
  }
}

export const personaMemoryService = PersonaMemoryService.getInstance(); 