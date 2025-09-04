import { getEnvironmentConfig } from './production';

// Get environment-specific configuration (automatically uses GitHub Secrets in production)
const envConfig = getEnvironmentConfig();

// Supabase Configuration (environment-aware)
// ✅ Production: Uses GitHub Repository Secrets automatically
// ✅ Development: Uses local .env file
export const SUPABASE_URL = envConfig.SUPABASE_URL;
export const SUPABASE_ANON_KEY = envConfig.SUPABASE_ANON_KEY;

// API Configuration
export const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
export const CLOUDFLARE_WORKER_URL = envConfig.CLOUDFLARE_WORKER_URL;

// Debug: Log configuration on load (remove in production)
console.log('🔧 Configuration loaded:', {
  hasSupabaseUrl: !!envConfig.SUPABASE_URL,
  hasSupabaseKey: !!envConfig.SUPABASE_ANON_KEY,
  hasWorkerUrl: !!envConfig.CLOUDFLARE_WORKER_URL,
  workerUrl: envConfig.CLOUDFLARE_WORKER_URL,
  openaiModel: 'gpt-5'
});

// GitHub Pages Configuration
export const BASE_URL = import.meta.env.BASE_URL || '/';

// OpenAI Configuration - Latest GPT-5 Model 🚀
export const OPENAI_MODEL = 'gpt-5'; // BREAKING: Upgraded to GPT-5! Superior reasoning, creativity, and book understanding
export const OPENAI_MAX_TOKENS = 8192; // GPT-5 supports larger context windows
export const OPENAI_TEMPERATURE = 0.7;

// File Upload Configuration
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_FILES_PER_MESSAGE = 5;
export const ALLOWED_FILE_TYPES = [
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
];

// CSV Import Configuration
export const IMPORT_CONFIG = {
  BATCH_SIZE: 500,
  MAX_CSV_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  SUPPORTED_CSV_MIME_TYPES: ['text/csv', 'application/csv', 'text/plain']
} as const;

// Supabase Storage Configuration
export const STORAGE_BUCKET = 'file-attachments';
export const STORAGE_URL = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}`;

// Database Configuration
export const DB_TABLES = {
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  FILE_ATTACHMENTS: 'file_attachments',
  BOOKS: 'books',
  BOOK_EMBEDDINGS: 'book_embeddings'
} as const;

// Real-time Subscriptions
export const REALTIME_CHANNELS = {
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages'
} as const;

// Authentication Configuration
export const AUTH_SETTINGS = {
  SIGN_IN_REDIRECT_URL: BASE_URL,
  SIGN_OUT_REDIRECT_URL: `${BASE_URL}login`
} as const;

// UI Configuration
export const UI_CONSTANTS = {
  SIDEBAR_WIDTH: 320,
  CHAT_MAX_WIDTH: 800,
  MESSAGE_ANIMATION_DURATION: 200,
  TYPING_INDICATOR_DELAY: 500
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  AUTH_ERROR: 'Authentication failed. Please check your credentials.',
  FILE_TOO_LARGE: `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
  FILE_TYPE_NOT_ALLOWED: 'File type not supported',
  TOO_MANY_FILES: `Maximum ${MAX_FILES_PER_MESSAGE} files allowed per message`,
  CONVERSATION_LOAD_ERROR: 'Failed to load conversation',
  MESSAGE_SEND_ERROR: 'Failed to send message',
  SUPABASE_CONNECTION_ERROR: 'Database connection error',
  CSV_FILE_TOO_LARGE: `CSV file size must be less than ${IMPORT_CONFIG.MAX_CSV_FILE_SIZE / (1024 * 1024)}MB`,
  CSV_FILE_NOT_FOUND: 'CSV file not found',
  CSV_PARSE_ERROR: 'Failed to parse CSV file',
  CSV_INVALID_FORMAT: 'Invalid CSV format or missing required columns',
  IMPORT_BATCH_ERROR: 'Failed to import batch of records',
  IMPORT_VALIDATION_ERROR: 'Validation error during import'
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  CONVERSATION_CREATED: 'New conversation created',
  CONVERSATION_DELETED: 'Conversation deleted',
  FILE_UPLOADED: 'File uploaded successfully',
  MESSAGE_SENT: 'Message sent',
  SIGNED_IN: 'Successfully signed in',
  SIGNED_OUT: 'Successfully signed out',
  CSV_IMPORT_STARTED: 'CSV import started',
  CSV_IMPORT_COMPLETED: 'CSV import completed successfully',
  BATCH_IMPORTED: 'Batch imported successfully'
} as const;

// Loading States
export const LOADING_STATES = {
  INITIALIZING: 'Initializing...',
  LOADING_CONVERSATIONS: 'Loading conversations...',
  LOADING_MESSAGES: 'Loading messages...',
  SENDING_MESSAGE: 'Sending message...',
  UPLOADING_FILES: 'Uploading files...',
  SIGNING_IN: 'Signing in...',
  SIGNING_OUT: 'Signing out...',
  PARSING_CSV: 'Parsing CSV file...',
  IMPORTING_BOOKS: 'Importing books...',
  PROCESSING_BATCH: 'Processing batch...'
} as const;

// Pagination
export const PAGINATION = {
  CONVERSATIONS_PER_PAGE: 50,
  MESSAGES_PER_PAGE: 100
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
  SELECTED_PERSONA: 'selected_persona',
  SIDEBAR_COLLAPSED: 'sidebar_collapsed',
  THEME: 'theme'
} as const;

// Development Configuration
export const IS_DEVELOPMENT = import.meta.env.DEV;
export const IS_PRODUCTION = import.meta.env.PROD;

// Environment Variables Validation
export const validateEnvironmentVariables = () => {
  const requiredVars = {
    VITE_SUPABASE_URL: SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
    VITE_CLOUDFLARE_WORKER_URL: CLOUDFLARE_WORKER_URL
  };

  const missingVars = Object.entries(requiredVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}`
    );
  }
};

// Import script environment validation
export const validateImportEnvironmentVariables = () => {
  const requiredVars = {
    SUPABASE_URL: process.env.SUPABASE_URL || SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
  };

  const missingVars = Object.entries(requiredVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables for import: ${missingVars.join(', ')}`
    );
  }
}; 