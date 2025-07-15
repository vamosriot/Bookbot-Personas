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
import { getAuthHeaders } from '@/lib/supabase';

export class OpenAIService {
  private static instance: OpenAIService;
  private controller: AbortController | null = null;

  static getInstance(): OpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService();
    }
    return OpenAIService.instance;
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

      // Generate enhanced system prompt with memory and file context
      const enhancedSystemPrompt = personaMemoryService.generatePersonalizedSystemPrompt(
        persona, 
        memory, 
        processedFiles
      );

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

      // Prepare request payload
      const payload = {
        model: OPENAI_MODEL,
        messages: openAIMessages,
        max_tokens: OPENAI_MAX_TOKENS,
        temperature: OPENAI_TEMPERATURE,
        stream: true
      };

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
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Handle streaming response with memory update
      await this.handleStreamingResponseWithMemory(
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