export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Persona {
  id: string;
  name: string;
  displayName: string;
  description: string;
  systemMessage: string;
  avatar: string;
  color: string;
}

export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  storage_path?: string;
  uploaded_at: string;
}

export interface MessageFeedback {
  id: string;
  message_id: string;
  user_id: string;
  feedback_type: 'upvote' | 'downvote';
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  content: string;
  role: 'user' | 'assistant';
  persona_id?: string;
  files?: FileAttachment[];
  feedback?: MessageFeedback;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  persona_id: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  message_count: number;
}

export interface ChatContextType {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  selectedPersona: Persona;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  setSelectedPersona: (persona: Persona) => void;
  createNewConversation: (personaId: string) => Promise<void>;
  switchConversation: (conversationId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  addMessage: (message: Omit<Message, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateMessage: (messageId: string, content: string) => Promise<void>;
}

// Database row interfaces for type safety
export interface MessageRow {
  id: string;
  conversation_id: string;
  content: string;
  role: 'user' | 'assistant';
  persona_id?: string;
  created_at: string;
  updated_at: string;
}

export interface FileAttachmentRow {
  id: string;
  message_id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  storage_path?: string;
  created_at: string;
  updated_at: string;
}

export interface MessageFeedbackRow {
  id: string;
  message_id: string;
  user_id: string;
  feedback_type: 'upvote' | 'downvote';
  created_at: string;
  updated_at: string;
}

export interface AuthContextType {
  user: User | null;
  session: any;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
      detail?: 'low' | 'high' | 'auto';
    };
  }>;
}

export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
}

export interface FileUploadState {
  files: File[];
  uploading: boolean;
  uploadProgress: { [key: string]: number };
  error: string | null;
}

export interface DatabaseRow {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationRow extends DatabaseRow {
  user_id: string;
  title: string;
  persona_id: string;
  last_message_at: string;
  message_count: number;
}

export interface MessageRow extends DatabaseRow {
  conversation_id: string;
  content: string;
  role: 'user' | 'assistant';
  persona_id?: string;
  files?: FileAttachment[];
}

export interface FileAttachmentRow extends DatabaseRow {
  message_id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

// Book-related interfaces (updated for numeric IDs and CSV compatibility)
export interface BookRow {
  id: number;
  title: string;
  master_mother_id?: number;
  deleted_at?: string;
  merged_to?: number;
  great_grandmother_id?: number;
  misspelled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Book {
  id: number;
  title: string;
  master_mother_id?: number;
  deleted_at?: string;
  merged_to?: number;
  great_grandmother_id?: number;
  misspelled: boolean;
  created_at: string;
  updated_at: string;
}

export interface BookEmbeddingRow {
  id: number;
  book_id: number;
  embedding?: number[];
  model: string;
  created_at: string;
  updated_at: string;
}

export interface BookEmbedding {
  id: number;
  book_id: number;
  embedding?: number[];
  model: string;
  created_at: string;
  updated_at: string;
}

// CSV import types (updated for numeric IDs and column name consistency)
export interface BookCSVRow {
  id?: string | number;
  title: string;
  master_mother_id?: string | number;
  deleted_at?: string;
  merged_to?: string | number;
  great_grandmother_id?: string | number;
  misspelled?: string | boolean; // Primary column name from CSV
  mispelled?: string | boolean; // Handle legacy variation
  [key: string]: any;
}

export interface ImportStats {
  totalRecords: number;
  successfulInserts: number;
  successfulUpdates: number;
  skippedRecords: number;
  errorRecords: number;
  errors: Array<{
    row: number;
    error: string;
    data?: any;
  }>;
}

// Recommendation system types
export interface RecommendationResult {
  id: number;
  title: string;
  similarity_score: number;
  master_mother_id?: number;
  great_grandmother_id?: number;
  misspelled: boolean;
  deleted_at?: string;
}

export interface EmbeddingGenerationProgress {
  processed: number;
  total: number;
  errors: number;
  estimatedCost: number;
  processingTimeMs: number;
}

export interface RecommendationRequest {
  title: string;
  limit?: number;
  threshold?: number;
}

export interface RecommendationResponse {
  recommendations: RecommendationResult[];
  query: string;
  processing_time_ms: number;
  total_found: number;
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      conversations: {
        Row: ConversationRow;
        Insert: Omit<ConversationRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ConversationRow, 'id' | 'created_at' | 'updated_at'>>;
      };
      messages: {
        Row: MessageRow;
        Insert: Omit<MessageRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<MessageRow, 'id' | 'created_at' | 'updated_at'>>;
      };
      file_attachments: {
        Row: FileAttachmentRow;
        Insert: Omit<FileAttachmentRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<FileAttachmentRow, 'id' | 'created_at' | 'updated_at'>>;
      };
      books: {
        Row: BookRow;
        Insert: Omit<BookRow, 'created_at' | 'updated_at'> & { id?: number };
        Update: Partial<Omit<BookRow, 'created_at' | 'updated_at'>>;
      };
      book_embeddings: {
        Row: BookEmbeddingRow;
        Insert: Omit<BookEmbeddingRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<BookEmbeddingRow, 'id' | 'created_at' | 'updated_at'>>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
} 