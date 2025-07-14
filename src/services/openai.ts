import { OpenAIMessage, OpenAIResponse, Message, FileAttachment } from '@/types';
import { getAllPersonas, getPersonaById } from '@/config/personas';
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

  async sendMessage(
    messages: Message[],
    personaId: string,
    onChunk?: (chunk: string) => void,
    onComplete?: (fullResponse: string) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    try {
      // Get persona system message
      const persona = getPersonaById(personaId);
      if (!persona) {
        throw new Error('Invalid persona selected');
      }

      // Convert messages to OpenAI format
      const openAIMessages: OpenAIMessage[] = [
        {
          role: 'system',
          content: persona.systemMessage
        },
        ...this.convertMessagesToOpenAIFormat(messages)
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

      // Handle streaming response
      await this.handleStreamingResponse(
        response,
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

  async sendMessageWithFiles(
    messages: Message[],
    personaId: string,
    files: FileAttachment[],
    onChunk?: (chunk: string) => void,
    onComplete?: (fullResponse: string) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    try {
      // For now, we'll include file information in the message content
      // In a full implementation, you'd process files based on their type
      const messagesWithFiles = this.processMessagesWithFiles(messages, files);
      
      await this.sendMessage(
        messagesWithFiles,
        personaId,
        onChunk,
        onComplete,
        onError
      );
    } catch (error: any) {
      console.error('Error sending message with files:', error);
      onError?.(error.message || ERROR_MESSAGES.MESSAGE_SEND_ERROR);
      throw error;
    }
  }

  private async handleStreamingResponse(
    response: Response,
    onChunk?: (chunk: string) => void,
    onComplete?: (fullResponse: string) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    if (!reader) {
      throw new Error('No response body reader available');
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              onComplete?.(fullResponse);
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              
              if (content) {
                fullResponse += content;
                onChunk?.(content);
              }
            } catch (parseError) {
              console.warn('Failed to parse streaming chunk:', parseError);
            }
          }
        }
      }

      onComplete?.(fullResponse);
    } catch (error: any) {
      console.error('Streaming error:', error);
      onError?.(error.message || ERROR_MESSAGES.NETWORK_ERROR);
      throw error;
    }
  }

  private convertMessagesToOpenAIFormat(messages: Message[]): OpenAIMessage[] {
    return messages.map(message => ({
      role: message.role,
      content: this.formatMessageContent(message)
    }));
  }

  private formatMessageContent(message: Message): string {
    let content = message.content;

    // Add file information to content if files are attached
    if (message.files && message.files.length > 0) {
      const fileInfo = message.files.map(file => 
        `[Attached: ${file.name} (${file.type}, ${this.formatFileSize(file.size)})]`
      ).join('\n');
      
      content = `${content}\n\n${fileInfo}`;
    }

    return content;
  }

  private processMessagesWithFiles(messages: Message[], files: FileAttachment[]): Message[] {
    // Add files to the last user message
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'user' && files.length > 0) {
      return [
        ...messages.slice(0, -1),
        {
          ...lastMessage,
          files: [...(lastMessage.files || []), ...files]
        }
      ];
    }

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

// Export singleton instance
export const openAIService = OpenAIService.getInstance(); 