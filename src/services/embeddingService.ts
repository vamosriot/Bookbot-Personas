/**
 * OpenAI Embedding Service
 * 
 * Handles generating and managing embeddings for book recommendations using OpenAI's text-embedding-3-small model.
 * Includes batch processing, rate limiting, cost estimation, and comprehensive error handling.
 * 
 * Features:
 * - Batch processing with configurable batch sizes
 * - Exponential backoff retry logic
 * - Rate limiting compliance (3,500 RPM)
 * - Cost estimation and tracking
 * - Token counting and text preprocessing
 * - Database integration with Supabase
 */

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { Database, EmbeddingGenerationProgress } from '@/types';

// Constants for OpenAI API limits and pricing
const OPENAI_LIMITS = {
  MAX_TOKENS_PER_REQUEST: 8192, // tokens per request
  MAX_REQUESTS_PER_MINUTE: 3500, // RPM limit
  BATCH_SIZE: 50, // items per batch
  RETRY_ATTEMPTS: 3,
  BASE_DELAY: 1000, // ms
} as const;

const PRICING = {
  TEXT_EMBEDDING_3_SMALL: 0.00002 / 1000, // $0.00002 per 1K tokens
} as const;

interface EmbeddingBatch {
  books: Array<{
    id: number;
    title: string;
    misspelled?: boolean;
  }>;
  texts: string[];
  estimatedTokens: number;
}

interface EmbeddingResult {
  book_id: number;
  embedding: number[];
  tokens_used: number;
}

export class EmbeddingService {
  private openai: OpenAI;
  private supabase: ReturnType<typeof createClient<Database>>;
  private requestCount = 0;
  private lastRequestTime = 0;

  constructor() {
    // Initialize OpenAI client
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.openai = new OpenAI({
      apiKey,
    });

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required');
    }

    this.supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  /**
   * Estimates token count for text (rough approximation)
   */
  private estimateTokenCount(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Prepares text for embedding generation
   */
  private prepareEmbeddingText(title: string, misspelled?: boolean): string {
    let text = `Title: ${title.trim()}`;
    
    // Add context for misspelled titles
    if (misspelled) {
      text += ' (misspelled variant)';
    }

    return text;
  }

  /**
   * Implements rate limiting to respect OpenAI API limits
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // Reset counter every minute
    if (timeSinceLastRequest > 60000) {
      this.requestCount = 0;
    }

    // Check if we're approaching the rate limit
    if (this.requestCount >= OPENAI_LIMITS.MAX_REQUESTS_PER_MINUTE) {
      const waitTime = 60000 - timeSinceLastRequest;
      console.log(`Rate limit reached. Waiting ${waitTime}ms...`);
      await this.sleep(waitTime);
      this.requestCount = 0;
    }

    this.requestCount++;
    this.lastRequestTime = now;
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generates embeddings for a batch of texts with retry logic
   */
  private async generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
    let attempt = 0;
    
    while (attempt < OPENAI_LIMITS.RETRY_ATTEMPTS) {
      try {
        await this.enforceRateLimit();

        const response = await this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: texts,
          encoding_format: 'float',
        });

        return response.data.map(item => item.embedding);
      } catch (error) {
        attempt++;
        
        if (error instanceof Error) {
          // Handle specific OpenAI errors
          if (error.message.includes('rate_limit_exceeded')) {
            const delay = OPENAI_LIMITS.BASE_DELAY * Math.pow(2, attempt);
            console.log(`Rate limit exceeded. Retrying in ${delay}ms... (attempt ${attempt}/${OPENAI_LIMITS.RETRY_ATTEMPTS})`);
            await this.sleep(delay);
            continue;
          }
          
          if (error.message.includes('token')) {
            throw new Error(`Token limit exceeded for batch. Reduce batch size. Error: ${error.message}`);
          }
        }

        if (attempt >= OPENAI_LIMITS.RETRY_ATTEMPTS) {
          throw new Error(`Failed to generate embeddings after ${OPENAI_LIMITS.RETRY_ATTEMPTS} attempts: ${error}`);
        }

        const delay = OPENAI_LIMITS.BASE_DELAY * Math.pow(2, attempt);
        console.log(`Attempt ${attempt} failed. Retrying in ${delay}ms...`);
        await this.sleep(delay);
      }
    }

    throw new Error('Failed to generate embeddings');
  }

  /**
   * Saves embeddings to the database
   */
  private async saveEmbeddings(results: EmbeddingResult[]): Promise<void> {
    const embeddings: Database['public']['Tables']['book_embeddings']['Insert'][] = results.map(result => ({
      book_id: result.book_id,
      embedding: result.embedding,
      model: 'text-embedding-3-small'
    }));

    const { error } = await this.supabase
      .from('book_embeddings')
      .upsert(embeddings as any, {
        onConflict: 'book_id,model'
      });

    if (error) {
      throw new Error(`Failed to save embeddings: ${error.message}`);
    }
  }

  /**
   * Gets books that need embeddings generated
   */
  async getBooksNeedingEmbeddings(limit: number = 1000): Promise<Array<{
    id: number;
    title: string;
    misspelled: boolean;
  }>> {
    // First, get all book IDs that already have embeddings
    const { data: embeddedBookIds, error: embeddedError } = await this.supabase
      .from('book_embeddings')
      .select('book_id')
      .eq('model', 'text-embedding-3-small');

    if (embeddedError) {
      throw new Error(`Failed to fetch embedded books: ${embeddedError.message}`);
    }

    // Extract the IDs into an array
    const existingIds = embeddedBookIds?.map((row: any) => row.book_id) || [];

    // Now get books that don't have embeddings
    let query = this.supabase
      .from('books')
      .select('id, title, misspelled')
      .or('deleted_at.is.null,deleted_at.eq.'); // Include both null and empty string values

    // Only add the not-in filter if there are existing embeddings
    if (existingIds.length > 0) {
      query = query.not('id', 'in', `(${existingIds.join(',')})`);
    }

    const { data, error } = await query
      .limit(limit)
      .order('id');

    if (error) {
      throw new Error(`Failed to fetch books: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Gets embedding statistics
   */
  async getEmbeddingStats(): Promise<{
    total_books: number;
    embedded_books: number;
    coverage_percentage: number;
  }> {
    // Get total book count (only active books - null or empty string)
    const { count: totalBooks, error: totalError } = await this.supabase
      .from('books')
      .select('*', { count: 'exact', head: true })
      .or('deleted_at.is.null,deleted_at.eq.');

    if (totalError) {
      throw new Error(`Failed to get total book count: ${totalError.message}`);
    }

    // Get embedded book count
    const { count: embeddedBooks, error: embeddedError } = await this.supabase
      .from('book_embeddings')
      .select('*', { count: 'exact', head: true })
      .eq('model', 'text-embedding-3-small');

    if (embeddedError) {
      // Don't throw error if table doesn't exist yet, just return 0
      const embedded = 0;
      const total = totalBooks || 0;
      const coverage = total > 0 ? (embedded / total) * 100 : 0;

      return {
        total_books: total,
        embedded_books: embedded,
        coverage_percentage: Math.round(coverage * 100) / 100
      };
    }

    const total = totalBooks || 0;
    const embedded = embeddedBooks || 0;
    const coverage = total > 0 ? (embedded / total) * 100 : 0;

    return {
      total_books: total,
      embedded_books: embedded,
      coverage_percentage: Math.round(coverage * 100) / 100
    };
  }

  /**
   * Generates a single embedding for a given text (used for queries)
   */
  async generateSingleEmbedding(text: string): Promise<number[]> {
    try {
      await this.enforceRateLimit();

      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: [text],
        encoding_format: 'float',
      });

      return response.data[0].embedding;
    } catch (error) {
      throw new Error(`Failed to generate single embedding: ${error}`);
    }
  }

  /**
   * Main function to process embeddings in batches
   */
  async generateEmbeddings(
    batchSize: number = OPENAI_LIMITS.BATCH_SIZE,
    limit?: number
  ): Promise<EmbeddingGenerationProgress> {
    const startTime = Date.now();
    let processed = 0;
    let errors = 0;
    let totalCost = 0;
    let totalTokens = 0;

    try {
      // Get books that need embeddings
      const books = await this.getBooksNeedingEmbeddings(limit);
      const totalBooks = books.length;

      if (totalBooks === 0) {
        console.log('No books need embeddings generated.');
        return {
          processed: 0,
          total: 0,
          errors: 0,
          estimatedCost: 0,
          processingTimeMs: Date.now() - startTime
        };
      }

      console.log(`Processing ${totalBooks} books in batches of ${batchSize}...`);

      // Process in batches
      for (let i = 0; i < books.length; i += batchSize) {
        const batch = books.slice(i, i + batchSize);
        const batchTexts = batch.map(book => 
          this.prepareEmbeddingText(book.title, book.misspelled)
        );

        try {
          // Estimate tokens for this batch
          const batchTokens = batchTexts.reduce((sum, text) => 
            sum + this.estimateTokenCount(text), 0);

          console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(books.length / batchSize)} (${batch.length} books, ~${batchTokens} tokens)`);

          // Generate embeddings
          const embeddings = await this.generateEmbeddingBatch(batchTexts);

          // Prepare results
          const results: EmbeddingResult[] = batch.map((book, index) => ({
            book_id: book.id,
            embedding: embeddings[index],
            tokens_used: this.estimateTokenCount(batchTexts[index])
          }));

          // Save to database
          await this.saveEmbeddings(results);

          // Update statistics
          processed += batch.length;
          totalTokens += batchTokens;
          totalCost += batchTokens * PRICING.TEXT_EMBEDDING_3_SMALL;

          console.log(`✓ Batch completed. Progress: ${processed}/${totalBooks} (${Math.round((processed / totalBooks) * 100)}%)`);

          // Small delay between batches to be respectful
          if (i + batchSize < books.length) {
            await this.sleep(100);
          }

        } catch (error) {
          errors += batch.length;
          console.error(`✗ Batch failed:`, error);
        }
      }

      const processingTime = Date.now() - startTime;

      console.log('\n📊 Embedding Generation Complete:');
      console.log(`   Successfully processed: ${processed}/${totalBooks} books`);
      console.log(`   Errors: ${errors}`);
      console.log(`   Total tokens used: ~${totalTokens.toLocaleString()}`);
      console.log(`   Estimated cost: $${totalCost.toFixed(4)}`);
      console.log(`   Processing time: ${Math.round(processingTime / 1000)}s`);

      return {
        processed,
        total: totalBooks,
        errors,
        estimatedCost: totalCost,
        processingTimeMs: processingTime
      };

    } catch (error) {
      throw new Error(`Embedding generation failed: ${error}`);
    }
  }
}

export default EmbeddingService;
