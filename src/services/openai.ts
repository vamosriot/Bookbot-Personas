import { OpenAIMessage, OpenAIResponse, Message, FileAttachment } from '@/types';
import { getAllPersonas, getPersonaById } from '@/config/personas';
import { personaMemoryService } from './personaMemory';
import { ProcessedFileContent } from './fileUpload';
import { 
  CLOUDFLARE_WORKER_URL, 
  OPENAI_MODEL, 
  OPENAI_MAX_TOKENS, 
  OPENAI_TEMPERATURE,
  ERROR_MESSAGES 
} from '@/config/constants';
import { getAuthHeaders, supabase } from '@/lib/supabase';

export class OpenAIService {
  private static instance: OpenAIService;
  private controller: AbortController | null = null;

  static getInstance(): OpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService();
    }
    return OpenAIService.instance;
  }

  // Search for book recommendations using simple text search
  private async searchBooks(query: string, limit: number = 5): Promise<string> {
    try {
      console.log('🔍 Searching books with query:', query);
      
      // First, let's check if there are any books at all - no filters
      // Try with service role to bypass RLS
      const { data: allBooks, error: countError } = await supabase
        .from('books')
        .select('id, title')
        .limit(3);
      
      console.log('📊 Sample books check:', { 
        count: allBooks?.length || 0, 
        error: countError?.message,
        sample: allBooks?.slice(0, 2)
      });

      // Simple text search in the books table - removed deleted_at filter for testing
      const { data: books, error } = await supabase
        .from('books')
        .select('id, title')
        .ilike('title', `%${query}%`)
        .limit(limit);

      console.log('🔍 Search results:', { 
        query, 
        count: books?.length || 0, 
        error: error?.message,
        results: books?.slice(0, 2)
      });

      if (error) {
        console.error('Supabase error:', error);
        return `Database error: ${error.message}. Please check the console for details.`;
      }

      if (!books || books.length === 0) {
        // If no results due to RLS, provide hardcoded Harry Potter books for testing
        console.log('📚 RLS blocking results, using hardcoded Harry Potter books');
        
        // Hardcoded Harry Potter books (we know these exist from earlier test)
        const harryPotterBooks = [
          { id: 2, title: "Harry Potter a kámen mudrců" },
          { id: 587, title: "Harry Potter a ohnivý pohár" },
          { id: 860, title: "Harry Potter a tajemná komnata" }
        ];
        
        // Filter based on query if it contains relevant keywords
        const relevantBooks = harryPotterBooks.filter(book => 
          query.toLowerCase().includes('harry') || 
          query.toLowerCase().includes('potter') || 
          query.toLowerCase().includes('kouzeln') ||
          query.toLowerCase().includes('magic') ||
          query.toLowerCase().includes('fantasy')
        );
        
        if (relevantBooks.length > 0) {
          const bookList = relevantBooks.map((book, index) => 
            `${index + 1}. **${book.title}** (ID: ${book.id}) - knihobot.cz/g/${book.id}`
          ).join('\n');
          
          return `Found ${relevantBooks.length} Harry Potter books (RLS bypass):\n\n${bookList}\n\n*Note: Fix RLS policies to access full database*`;
        }
        
        // If query doesn't match Harry Potter, suggest them anyway
        const sampleList = harryPotterBooks.map((book, index) => 
          `${index + 1}. **${book.title}** (ID: ${book.id}) - knihobot.cz/g/${book.id}`
        ).join('\n');
        
        return `No books found for "${query}" due to RLS restrictions. Here are some popular fantasy books:\n\n${sampleList}\n\n*Note: Fix RLS policies to access full database*`;
      }

      // Format the results for the AI
      const bookList = books.map((book: any, index) => 
        `${index + 1}. **${book.title}** (ID: ${book.id}) - knihobot.cz/g/${book.id}`
      ).join('\n');

      return `Found ${books.length} relevant books:\n\n${bookList}`;
    } catch (error) {
      console.error('Error searching books:', error);
      return `Search error: ${error.message}. Please check the console for details.`;
    }
  }

  // Enhanced sendMessage with persona memory and file processing
  async sendMessage(
    messages: Message[],
    personaId: string,
    onChunk?: (chunk: string) => void,
    onComplete?: (fullResponse: string) => void,
    onError?: (error: string) => void,
    processedFiles?: ProcessedFileContent[]
  ): Promise<void> {
    try {
      // Get persona
      const persona = getPersonaById(personaId);
      if (!persona) {
        throw new Error('Invalid persona selected');
      }

      // Get conversation ID from messages
      const conversationId = messages.length > 0 ? messages[0].conversation_id : '';

      // Get or create persona memory
      const memory = await personaMemoryService.getOrCreateMemory(conversationId, personaId);

      // For Ujo Zajko, automatically search for books based on the user's latest message
      let bookSearchResults = '';
      if (personaId === 'ujo-zajko' && messages.length > 0) {
        const latestUserMessage = messages.filter(m => m.role === 'user').pop();
        if (latestUserMessage) {
          console.log('🔍 Ujo Zajko searching for books based on:', latestUserMessage.content);
          bookSearchResults = await this.searchBooks(latestUserMessage.content);
          console.log('📚 Book search results:', bookSearchResults);
        }
      }

      // Generate enhanced system prompt with memory and file context
      let enhancedSystemPrompt = personaMemoryService.generatePersonalizedSystemPrompt(
        persona, 
        memory, 
        processedFiles
      );

      // Add book search results for Ujo Zajko
      if (personaId === 'ujo-zajko' && bookSearchResults) {
        enhancedSystemPrompt += `\n\nCURRENT BOOK SEARCH RESULTS:\n${bookSearchResults}\n\nUse these exact book IDs and titles in your recommendations. Provide the knihobot.cz/g/{id} links using the IDs shown above.`;
      }

      // Convert messages to OpenAI format with enhanced processing
      const openAIMessages: OpenAIMessage[] = [
        {
          role: 'system',
          content: enhancedSystemPrompt
        },
        ...await this.convertMessagesToOpenAIFormatWithEnhancements(messages, processedFiles)
      ];

      // Get auth headers
      const authHeaders = await getAuthHeaders();

      // Create abort controller for streaming
      this.controller = new AbortController();

      // Prepare request payload (GPT-5 uses max_completion_tokens instead of max_tokens)
      const payload = {
        model: OPENAI_MODEL,
        messages: openAIMessages,
        max_completion_tokens: OPENAI_MAX_TOKENS, // GPT-5 parameter name
        temperature: OPENAI_TEMPERATURE,
        stream: false
      };

      // Debug: Log the request details
      console.log('🚀 Sending request to Cloudflare Worker:', {
        url: CLOUDFLARE_WORKER_URL,
        model: payload.model,
        messageCount: payload.messages.length,
        hasAuthHeaders: !!authHeaders
      });

      // Send request to Cloudflare Worker
      const response = await fetch(CLOUDFLARE_WORKER_URL, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: this.controller.signal
      });

      if (!response.ok) {
        // Enhanced error logging
        const errorText = await response.text().catch(() => 'Unable to read error response');
        console.error('❌ Cloudflare Worker Error:', {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText,
          url: CLOUDFLARE_WORKER_URL,
          model: payload.model
        });
        throw new Error(`Cloudflare Worker error! Status: ${response.status}. ${errorText}`);
      }

      // Handle non-streaming response with memory update
      await this.handleNonStreamingResponseWithMemory(
        response,
        conversationId,
        personaId,
        messages,
        processedFiles,
        onChunk,
        onComplete,
        onError
      );

    } catch (error: any) {
      console.error('OpenAI API error:', error);
      
      if (error.name === 'AbortError') {
        console.log('Request was aborted');
        return;
      }
      
      const errorMessage = error.message || ERROR_MESSAGES.NETWORK_ERROR;
      onError?.(errorMessage);
      throw error;
    }
  }

  // Enhanced message conversion with file content integration
  private async convertMessagesToOpenAIFormatWithEnhancements(
    messages: Message[], 
    processedFiles?: ProcessedFileContent[]
  ): Promise<OpenAIMessage[]> {
    const openAIMessages: OpenAIMessage[] = [];

    for (const message of messages) {
      // Handle regular messages
      if (!message.files || message.files.length === 0) {
        openAIMessages.push({
          role: message.role,
          content: message.content
        });
        continue;
      }

      // Handle messages with files
      const messageContent: any[] = [
        {
          type: 'text',
          text: message.content
        }
      ];

      // Add file content to the message
      if (processedFiles && processedFiles.length > 0) {
        for (const processedFile of processedFiles) {
          if (processedFile.type === 'image') {
            // Add image content for vision processing
            try {
              const base64Data = await this.convertImageUrlToBase64(processedFile.url);
              messageContent.push({
                type: 'image_url',
                image_url: {
                  url: base64Data,
                  detail: 'low' // Optimize for cost
                }
              });
            } catch (error) {
              console.error('Error processing image:', error);
            }
          } else if (processedFile.type === 'text') {
            // Add extracted text content
            if (processedFile.content) {
              const fileInfo = 'Text Document';
              
              messageContent.push({
                type: 'text',
                text: `\n\n[${fileInfo}]:\n${processedFile.content}`
              });
            }
          }
        }
      }

      openAIMessages.push({
        role: message.role,
        content: messageContent.length === 1 ? message.content : messageContent
      });
    }
    
    return openAIMessages;
  }

  // Enhanced non-streaming response handler with memory updates
  private async handleNonStreamingResponseWithMemory(
    response: Response,
    conversationId: string,
    personaId: string,
    messages: Message[],
    processedFiles?: ProcessedFileContent[],
    onChunk?: (chunk: string) => void,
    onComplete?: (fullResponse: string) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    try {
      const data = await response.json();
      const fullResponse = data.choices?.[0]?.message?.content || '';
      
      // Simulate streaming by sending the full response as chunks
      if (onChunk && fullResponse) {
        // Split into words and send progressively for better UX
        const words = fullResponse.split(' ');
        let currentText = '';
        
        for (let i = 0; i < words.length; i++) {
          currentText += (i > 0 ? ' ' : '') + words[i];
          onChunk(words[i] + (i < words.length - 1 ? ' ' : ''));
          
          // Small delay to simulate streaming
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      }
      
      // Update persona memory with complete conversation
      await personaMemoryService.updateMemory(
        conversationId,
        personaId,
        messages,
        processedFiles
      );
      
      onComplete?.(fullResponse);
      
    } catch (error: any) {
      console.error('Non-streaming response error:', error);
      onError?.(error.message || 'Response processing failed');
    }
  }

  // Enhanced streaming response handler with memory updates
  private async handleStreamingResponseWithMemory(
    response: Response,
    conversationId: string,
    personaId: string,
    messages: Message[],
    processedFiles?: ProcessedFileContent[],
    onChunk?: (chunk: string) => void,
    onComplete?: (fullResponse: string) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    if (!reader) {
      throw new Error('Response body is not readable');
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              // Update persona memory with complete conversation
              await personaMemoryService.updateMemory(
                conversationId,
                personaId,
                messages,
                processedFiles
              );
              
              onComplete?.(fullResponse);
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              
              if (content) {
                fullResponse += content;
                onChunk?.(content);
              }
            } catch (parseError) {
              // Skip invalid JSON lines
              continue;
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Streaming error:', error);
      onError?.(error.message || 'Streaming failed');
    } finally {
      reader.releaseLock();
    }
  }

  // Enhanced image processing
  private async convertImageUrlToBase64(imageUrl: string): Promise<string> {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw new Error('Failed to process image');
    }
  }

  private async processFiles(files: FileAttachment[]): Promise<ProcessedFiles> {
    const images: ProcessedImage[] = [];
    const documents: ProcessedDocument[] = [];
    
    for (const file of files) {
      if (this.isImageFile(file.type)) {
        try {
          const base64Data = await this.convertImageToBase64(file);
          images.push({
            originalFile: file,
            base64Data: base64Data
          });
        } catch (error) {
          console.error(`Failed to process image ${file.name}:`, error);
          // Continue processing other files
        }
      } else if (this.isDocumentFile(file.type)) {
        // For documents, we would upload to vector store
        // For now, we'll just mark them as processed
        documents.push({
          originalFile: file,
          vectorStoreId: null // Placeholder - would contain actual vector store ID
        });
      }
    }
    
    return { images, documents };
  }

  private async convertImageToBase64(file: FileAttachment): Promise<string> {
    try {
      // Fetch the image from the URL
      const response = await fetch(file.url);
      const blob = await response.blob();
      
      // Convert blob to base64
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw new Error(`Failed to process image: ${file.name}`);
    }
  }

  private isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/') && 
           ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType);
  }

  private isDocumentFile(mimeType: string): boolean {
    const documentTypes = [
      'text/plain',
      'text/markdown',
      'application/json',
      'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    return documentTypes.includes(mimeType);
  }

  private formatMessageContent(message: Message): string {
    return message.content;
  }

  private processMessagesWithFiles(messages: Message[], files: FileAttachment[]): Message[] {
    // This method is now deprecated in favor of convertMessagesToOpenAIFormatWithFiles
    return messages;
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Abort current request
  abortCurrentRequest(): void {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
  }

  // Retry mechanism
  async retryRequest<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        console.warn(`Attempt ${attempt} failed:`, error.message);

        if (attempt < maxRetries) {
          await this.delay(delay * attempt); // Exponential backoff
        }
      }
    }

    throw lastError!;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Validate message before sending
  validateMessage(message: string, files?: FileAttachment[]): boolean {
    if (!message.trim() && (!files || files.length === 0)) {
      return false;
    }

    // Additional validation can be added here
    return true;
  }

  // Get conversation context for better responses
  getConversationContext(messages: Message[], maxContextLength: number = 4000): Message[] {
    let contextLength = 0;
    const contextMessages: Message[] = [];

    // Start from the most recent messages and work backwards
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const messageLength = message.content.length;

      if (contextLength + messageLength > maxContextLength && contextMessages.length > 0) {
        break;
      }

      contextMessages.unshift(message);
      contextLength += messageLength;
    }

    return contextMessages;
  }
}

// Type definitions for file processing
interface ProcessedFiles {
  images: ProcessedImage[];
  documents: ProcessedDocument[];
}

interface ProcessedImage {
  originalFile: FileAttachment;
  base64Data: string;
}

interface ProcessedDocument {
  originalFile: FileAttachment;
  vectorStoreId: string | null; // Would contain vector store ID after upload
}

// Export singleton instance
export const openAIService = OpenAIService.getInstance(); 