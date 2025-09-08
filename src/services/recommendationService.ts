/**
 * Book Recommendation Service
 * 
 * Provides book recommendations using vector similarity search with OpenAI embeddings.
 * Includes caching, filtering, and comprehensive search capabilities.
 * 
 * Features:
 * - Vector similarity search using pgvector cosine distance
 * - Query embedding generation with OpenAI
 * - Result filtering (deleted books, duplicates, etc.)
 * - In-memory caching for frequent queries
 * - Comprehensive error handling and logging
 * - Support for different search modes and thresholds
 */

import { Database, RecommendationResult, RecommendationRequest, RecommendationResponse } from '@/types';
import { supabase } from '@/lib/supabase';
import { CLOUDFLARE_WORKER_URL } from '@/config/constants';
import { getAuthHeaders } from '@/lib/supabase';

interface CacheEntry {
  results: RecommendationResult[];
  timestamp: number;
  ttl: number;
}

interface SearchOptions {
  similarity_threshold?: number;
  include_deleted?: boolean;
  exclude_ids?: number[];
}

export class RecommendationService {
  private cache = new Map<string, CacheEntry>();
  
  // Cache configuration
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000; // Maximum cached queries

  // Search configuration
  private readonly DEFAULT_SIMILARITY_THRESHOLD = 0.7;
  private readonly DEFAULT_LIMIT = 10;
  private readonly MAX_LIMIT = 100;

  constructor() {
    // No server-side dependencies in browser environment
  }

  /**
   * Generates a cache key for a query
   */
  private generateCacheKey(query: string, options: SearchOptions, limit: number): string {
    const optionsString = JSON.stringify(options);
    return `${query}:${limit}:${optionsString}`;
  }

  /**
   * Gets cached results if available and not expired
   */
  private getCachedResults(cacheKey: string): RecommendationResult[] | null {
    const entry = this.cache.get(cacheKey);
    
    if (!entry) {
      return null;
    }

    // Check if cache entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(cacheKey);
      return null;
    }

    return entry.results;
  }

  /**
   * Caches search results
   */
  private setCachedResults(cacheKey: string, results: RecommendationResult[]): void {
    // Implement LRU cache by removing oldest entries when cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(cacheKey, {
      results,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL
    });
  }

  /**
   * Performs text-based search for browser compatibility
   */
  private async performTextBasedSearch(
    query: string,
    limit: number,
    options: SearchOptions = {}
  ): Promise<RecommendationResult[]> {
    try {
      console.log('🔍 Performing text-based search for:', query);
      
      // Extract meaningful keywords from Czech queries
      const searchKeywords = this.extractSearchKeywords(query);
      console.log('🔑 Extracted keywords:', searchKeywords);
      
      if (searchKeywords.length === 0) {
        // If no keywords found, return some popular books
        return this.getPopularBooks(limit, options);
      }

      // Try searching with different keyword combinations
      let allResults: any[] = [];
      
      for (const keyword of searchKeywords) {
        let supabaseQuery = supabase
          .from('books')
          .select('id, title, master_mother_id, great_grandmother_id, misspelled, deleted_at')
          .ilike('title', `%${keyword}%`)
          .limit(limit * 2); // Get more results to filter and rank

        // Add filtering conditions
        if (!options.include_deleted) {
          supabaseQuery = supabaseQuery.is('deleted_at', null);
        }

        if (options.exclude_ids && options.exclude_ids.length > 0) {
          supabaseQuery = supabaseQuery.not('id', 'in', `(${options.exclude_ids.join(',')})`);
        }

        const { data, error } = await supabaseQuery;

        if (!error && data) {
          allResults = allResults.concat(data);
        }
      }

      if (allResults.length === 0) {
        return this.getPopularBooks(limit, options);
      }

      // Remove duplicates and calculate similarity scores
      const uniqueResults = new Map();
      
      allResults.forEach((book: any) => {
        if (!uniqueResults.has(book.id)) {
          uniqueResults.set(book.id, {
            id: book.id,
            title: book.title,
            similarity_score: this.calculateEnhancedTextSimilarity(query, book.title, searchKeywords),
            master_mother_id: book.master_mother_id || undefined,
            great_grandmother_id: book.great_grandmother_id || undefined,
            misspelled: book.misspelled || false,
            deleted_at: book.deleted_at || undefined
          });
        }
      });

      // Sort by similarity score and return top results
      return Array.from(uniqueResults.values())
        .filter(result => result.similarity_score >= (options.similarity_threshold || 0.1))
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, limit);

    } catch (error) {
      console.error('Text-based search error:', error);
      throw error;
    }
  }

  /**
   * Extract meaningful search keywords from Czech queries
   */
  private extractSearchKeywords(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    
    // Common Czech words to ignore
    const stopWords = new Set([
      'najdi', 'mi', 'něco', 'prostě', 'pošli', 'spíše', 'nějaký', 'nějaké',
      'českou', 'český', 'české', 'a', 'nebo', 'také', 'jen', 'pouze',
      'doporuč', 'doporučte', 'chci', 'chtěl', 'chtěla', 'bych', 'by'
    ]);
    
    // Extract potential book-related keywords
    const keywords: string[] = [];
    
    // Look for genre/category words
    const genreWords = {
      'prózu': ['próza', 'román', 'povídka'],
      'poezii': ['poezie', 'báseň', 'verš'],
      'román': ['román'],
      'současnost': ['současný', 'moderní', 'nový'],
      'syrového': ['syrový', 'drsný', 'realistický'],
      'fantasy': ['fantasy', 'fantazie'],
      'sci-fi': ['sci-fi', 'science', 'fiction'],
      'detektivka': ['detektivka', 'krimi', 'thriller'],
      'historický': ['historický', 'historie'],
      'romantický': ['romantický', 'láska', 'romance']
    };
    
    // Check for genre matches
    for (const [key, variations] of Object.entries(genreWords)) {
      if (lowerQuery.includes(key)) {
        keywords.push(...variations);
      }
    }
    
    // Extract other meaningful words (longer than 3 characters, not stop words)
    const words = lowerQuery.split(/\s+/);
    for (const word of words) {
      const cleanWord = word.replace(/[.,!?;:]/, '');
      if (cleanWord.length > 3 && !stopWords.has(cleanWord)) {
        keywords.push(cleanWord);
      }
    }
    
    // If still no keywords, try some common book-related terms
    if (keywords.length === 0) {
      keywords.push('román', 'kniha', 'příběh');
    }
    
    return [...new Set(keywords)]; // Remove duplicates
  }

  /**
   * Get popular books as fallback
   */
  private async getPopularBooks(limit: number, options: SearchOptions = {}): Promise<RecommendationResult[]> {
    try {
      console.log('📚 Getting popular books as fallback');
      
      let supabaseQuery = supabase
        .from('books')
        .select('id, title, master_mother_id, great_grandmother_id, misspelled, deleted_at')
        .limit(limit);

      if (!options.include_deleted) {
        supabaseQuery = supabaseQuery.is('deleted_at', null);
      }

      if (options.exclude_ids && options.exclude_ids.length > 0) {
        supabaseQuery = supabaseQuery.not('id', 'in', `(${options.exclude_ids.join(',')})`);
      }

      const { data, error } = await supabaseQuery;

      if (error || !data) {
        return [];
      }

      return data.map((book: any) => ({
        id: book.id,
        title: book.title,
        similarity_score: 0.5, // Neutral score for popular books
        master_mother_id: book.master_mother_id || undefined,
        great_grandmother_id: book.great_grandmother_id || undefined,
        misspelled: book.misspelled || false,
        deleted_at: book.deleted_at || undefined
      }));

    } catch (error) {
      console.error('Error getting popular books:', error);
      return [];
    }
  }

  /**
   * Calculate enhanced text similarity score using keywords
   */
  private calculateEnhancedTextSimilarity(query: string, title: string, keywords: string[]): number {
    const titleLower = title.toLowerCase();
    let score = 0;
    
    // Check for keyword matches in title
    let keywordMatches = 0;
    for (const keyword of keywords) {
      if (titleLower.includes(keyword.toLowerCase())) {
        keywordMatches++;
        score += 0.3; // Each keyword match adds to score
      }
    }
    
    // Bonus for multiple keyword matches
    if (keywordMatches > 1) {
      score += 0.2 * (keywordMatches - 1);
    }
    
    // Check for partial matches
    const titleWords = titleLower.split(/\s+/);
    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      for (const titleWord of titleWords) {
        if (titleWord.includes(keywordLower) || keywordLower.includes(titleWord)) {
          score += 0.1;
        }
      }
    }
    
    // Ensure score doesn't exceed 1.0
    return Math.min(score, 1.0);
  }

  /**
   * Calculate simple text similarity score
   */
  private calculateTextSimilarity(query: string, title: string): number {
    const queryLower = query.toLowerCase();
    const titleLower = title.toLowerCase();
    
    // Exact match
    if (titleLower === queryLower) {
      return 1.0;
    }
    
    // Contains query
    if (titleLower.includes(queryLower)) {
      return 0.8;
    }
    
    // Word overlap
    const queryWords = queryLower.split(/\s+/);
    const titleWords = titleLower.split(/\s+/);
    const commonWords = queryWords.filter(word => titleWords.includes(word));
    
    if (commonWords.length > 0) {
      return 0.6 * (commonWords.length / queryWords.length);
    }
    
    // Partial matches
    const hasPartialMatch = queryWords.some(word => 
      titleWords.some(titleWord => titleWord.includes(word) || word.includes(titleWord))
    );
    
    return hasPartialMatch ? 0.3 : 0.1;
  }

  /**
   * Performs vector similarity search in the database
   */
  private async performVectorSearch(
    queryEmbedding: number[],
    limit: number,
    options: SearchOptions = {}
  ): Promise<RecommendationResult[]> {
    try {
      console.log(`🔍 Attempting vector search with RPC function for ${queryEmbedding.length} dimensions`);
      
      // Convert embedding array to string format for PostgreSQL
      const embeddingString = `[${queryEmbedding.join(',')}]`;
      const similarityThreshold = options.similarity_threshold || this.DEFAULT_SIMILARITY_THRESHOLD;
      
      console.log(`📊 Using similarity threshold: ${similarityThreshold}, limit: ${limit}`);

      // Call the Supabase RPC function for vector similarity search
      const rpcResult = await (supabase as any).rpc('search_similar_books', {
        query_embedding: embeddingString,
        similarity_threshold: similarityThreshold,
        max_results: limit * 2 // Get more results to allow for filtering
      });
      const { data, error } = rpcResult;

      if (error) {
        console.warn('❌ RPC vector search function failed:', error.message);
        console.log('🔄 Falling back to client-side vector search');
        return this.performClientSideVectorSearch(queryEmbedding, limit, options);
      }

      if (!data || data.length === 0) {
        console.log('📭 RPC vector search returned no results');
        return [];
      }

      console.log(`✅ RPC vector search found ${data.length} initial results`);

      // Transform results to match expected format
      let results = (data as any[]).map((row: any) => ({
        id: row.book_id,
        title: row.title,
        similarity_score: parseFloat(row.similarity_score),
        master_mother_id: row.master_mother_id,
        great_grandmother_id: row.great_grandmother_id,
        misspelled: row.misspelled,
        deleted_at: row.deleted_at
      }));

      // Apply exclude_ids filter if specified (since the RPC function doesn't handle this)
      if (options.exclude_ids && options.exclude_ids.length > 0) {
        const beforeCount = results.length;
        results = results.filter(book => !options.exclude_ids!.includes(book.id));
        console.log(`🚫 Filtered out ${beforeCount - results.length} excluded books`);
      }

      // Apply final limit
      results = results.slice(0, limit);
      
      console.log(`📚 Returning ${results.length} vector search results`);
      return results;

    } catch (error) {
      console.warn('❌ Vector search failed with exception:', error);
      console.log('🔄 Falling back to client-side vector search');
      return this.performClientSideVectorSearch(queryEmbedding, limit, options);
    }
  }

  /**
   * Fallback method using Supabase client for vector search
   */
  private async performClientSideVectorSearch(
    queryEmbedding: number[],
    limit: number,
    options: SearchOptions = {}
  ): Promise<RecommendationResult[]> {
    try {
      console.log(`🔄 Using client-side vector search fallback for ${queryEmbedding.length} dimensions`);
      
      // Validate embedding dimensions
      if (queryEmbedding.length !== 1536) {
        console.error(`❌ Invalid embedding dimensions: ${queryEmbedding.length}, expected 1536`);
        return [];
      }

      let query = supabase
        .from('book_embeddings')
        .select(`
          book_id,
          embedding,
          books!inner (
            id,
            title,
            master_mother_id,
            great_grandmother_id,
            misspelled,
            deleted_at
          )
        `)
        .eq('model', 'text-embedding-3-small');

      // Better filtering for deleted books - handle both NULL and empty string
      if (!options.include_deleted) {
        query = query.or('books.deleted_at.is.null,books.deleted_at.eq.');
      }

      if (options.exclude_ids && options.exclude_ids.length > 0) {
        query = query.not('book_id', 'in', `(${options.exclude_ids.join(',')})`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Client-side vector search query failed:', error.message);
        throw new Error(`Vector search failed: ${error.message}`);
      }

      if (!data || data.length === 0) {
        console.log('📭 No embeddings found for client-side search');
        return [];
      }

      console.log(`📊 Processing ${data.length} embeddings for similarity calculation`);

      const similarityThreshold = options.similarity_threshold || this.DEFAULT_SIMILARITY_THRESHOLD;
      let validResults = 0;
      let invalidEmbeddings = 0;

      // Compute cosine similarity client-side
      const results = data
        .map((row: any) => {
          const book = row.books;
          const embedding = row.embedding;
          
          if (!embedding || !Array.isArray(embedding)) {
            invalidEmbeddings++;
            return null;
          }

          // Validate embedding dimensions
          if (embedding.length !== 1536) {
            console.warn(`⚠️ Invalid embedding dimensions for book ${book.id}: ${embedding.length}`);
            invalidEmbeddings++;
            return null;
          }

          const similarity = this.cosineSimilarity(queryEmbedding, embedding);
          
          if (similarity >= similarityThreshold) {
            validResults++;
          }
          
          return {
            id: book.id,
            title: book.title,
            similarity_score: similarity,
            master_mother_id: book.master_mother_id || undefined,
            great_grandmother_id: book.great_grandmother_id || undefined,
            misspelled: book.misspelled || false,
            deleted_at: book.deleted_at || undefined
          };
        })
        .filter((result) => 
          result !== null && 
          result.similarity_score >= similarityThreshold
        )
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, limit) as RecommendationResult[];

      console.log(`✅ Client-side search: ${validResults} results above threshold ${similarityThreshold}`);
      console.log(`⚠️ Skipped ${invalidEmbeddings} invalid embeddings`);
      console.log(`📚 Returning ${results.length} client-side vector search results`);

      return results;
      
    } catch (error) {
      console.error('❌ Client-side vector search failed:', error);
      return [];
    }
  }

  /**
   * Computes cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Gets a book by its ID
   */
  async getBookById(id: number): Promise<RecommendationResult | null> {
    const { data, error } = await supabase
      .from('books')
      .select('id, title, master_mother_id, great_grandmother_id, misspelled, deleted_at')
      .eq('id', id)
      .single() as { data: any; error: any };

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      title: data.title,
      similarity_score: 1.0, // Perfect match for self
      master_mother_id: data.master_mother_id || undefined,
      great_grandmother_id: data.great_grandmother_id || undefined,
      misspelled: data.misspelled || false,
      deleted_at: data.deleted_at || undefined
    };
  }

  /**
   * Finds books similar to a given title using AI-powered two-step approach
   */
  async findSimilarBooksByTitle(
    title: string,
    limit: number = this.DEFAULT_LIMIT,
    options: SearchOptions = {}
  ): Promise<RecommendationResponse> {
    const startTime = Date.now();
    
    try {
      // Validate input
      if (!title || title.trim().length === 0) {
        throw new Error('Title cannot be empty');
      }

      const cleanTitle = title.trim();
      const actualLimit = Math.min(limit, this.MAX_LIMIT);
      
      // Check cache first
      const cacheKey = this.generateCacheKey(cleanTitle, options, actualLimit);
      const cachedResults = this.getCachedResults(cacheKey);
      
      if (cachedResults) {
        return {
          recommendations: cachedResults,
          query: cleanTitle,
          processing_time_ms: Date.now() - startTime,
          total_found: cachedResults.length
        };
      }

      // Step 1: Generate AI-powered book suggestions based on the query
      const aiSuggestions = await this.generateAIBookSuggestions(cleanTitle);
      console.log('🤖 AI generated book suggestions:', aiSuggestions);

      // Step 2: Search database for closest matches to AI suggestions
      const recommendations = await this.findBestMatchesForSuggestions(
        aiSuggestions,
        actualLimit,
        options
      );

      // Cache the results
      this.setCachedResults(cacheKey, recommendations);

      return {
        recommendations,
        query: cleanTitle,
        processing_time_ms: Date.now() - startTime,
        total_found: recommendations.length
      };

    } catch (error) {
      throw new Error(`Failed to find similar books: ${error}`);
    }
  }

  /**
   * Finds books similar to a specific book ID
   */
  async findSimilarBooksById(
    bookId: number,
    limit: number = this.DEFAULT_LIMIT,
    options: SearchOptions = {}
  ): Promise<RecommendationResponse> {
    const startTime = Date.now();

    try {
      // Get the source book
      const sourceBook = await this.getBookById(bookId);
      if (!sourceBook) {
        throw new Error(`Book with ID ${bookId} not found`);
      }

      // Exclude the source book from results
      const searchOptions: SearchOptions = {
        ...options,
        exclude_ids: [...(options.exclude_ids || []), bookId]
      };

      // Find similar books using the source book's title
      const result = await this.findSimilarBooksByTitle(
        sourceBook.title,
        limit,
        searchOptions
      );

      return {
        ...result,
        query: `Similar to: ${sourceBook.title}`,
        processing_time_ms: Date.now() - startTime
      };

    } catch (error) {
      throw new Error(`Failed to find similar books for ID ${bookId}: ${error}`);
    }
  }

  /**
   * Gets recommendation statistics
   */
  async getRecommendationStats(): Promise<{
    total_embeddings: number;
    cache_size: number;
    cache_hit_rate?: number;
  }> {
    const { count, error } = await supabase
      .from('book_embeddings')
      .select('*', { count: 'exact', head: true })
      .eq('model', 'text-embedding-3-small');

    if (error) {
      throw new Error(`Failed to get recommendation stats: ${error.message}`);
    }

    return {
      total_embeddings: count || 0,
      cache_size: this.cache.size
    };
  }

  /**
   * Searches with iterative threshold lowering and AI suggestion regeneration
   * Implements "search from most relevant until finds something" logic
   */
  async searchWithIterativeThresholds(
    query: string,
    limit: number = 5
  ): Promise<RecommendationResult[]> {
    const startTime = Date.now();
    const thresholds = [0.9, 0.8, 0.7, 0.6, 0.5];
    const maxAIAttempts = 3; // Maximum number of times to regenerate AI suggestions
    
    try {
      console.log('🎯 Starting iterative threshold search with AI regeneration:', { query, limit });
      
      for (let aiAttempt = 1; aiAttempt <= maxAIAttempts; aiAttempt++) {
        console.log(`🤖 AI attempt ${aiAttempt}/${maxAIAttempts}: Generating suggestions`);
        
        // Generate AI suggestions (regenerate for each attempt)
        const aiSuggestions = await this.generateAIBookSuggestions(query);
        console.log(`🤖 AI generated suggestions (attempt ${aiAttempt}):`, aiSuggestions);
        
        // Try all thresholds with current AI suggestions
        for (const threshold of thresholds) {
          console.log(`🔍 Trying similarity threshold: ${threshold} (AI attempt ${aiAttempt})`);
          
          const options = {
            similarity_threshold: threshold,
            include_deleted: false
          };
          
          const recommendations = await this.findBestMatchesForSuggestions(
            aiSuggestions,
            limit,
            options
          );
          
          if (recommendations && recommendations.length > 0) {
            console.log(`✅ Found ${recommendations.length} results at threshold ${threshold} (AI attempt ${aiAttempt})`);
            console.log(`⚡ Search completed in ${Date.now() - startTime}ms`);
            
            // Add performance metadata to results
            const enhancedResults = recommendations.map(book => ({
              ...book,
              search_threshold: threshold,
              search_method: 'iterative_vector',
              ai_attempt: aiAttempt
            }));
            
            return enhancedResults;
          }
          
          console.log(`❌ No results at threshold ${threshold} (AI attempt ${aiAttempt})`);
        }
        
        if (aiAttempt < maxAIAttempts) {
          console.log(`🔄 No results found with current AI suggestions, regenerating... (attempt ${aiAttempt + 1})`);
        }
      }
      
      console.log(`🚫 No results found after ${maxAIAttempts} AI attempts and all thresholds`);
      return [];
      
    } catch (error) {
      console.error('Error in iterative threshold search:', error);
      throw new Error(`Iterative search failed: ${error}`);
    }
  }

  /**
   * Generate AI-powered book suggestions based on user query using GPT
   */
  private async generateAIBookSuggestions(query: string): Promise<string[]> {
    try {
      console.log('🤖 Asking AI to generate book suggestions for:', query);
      
      const systemPrompt = `You are a book recommendation expert with deep knowledge of Czech and international literature. Given a user's request, generate a list of 8-10 specific book titles that would be most relevant to their request.

IMPORTANT RULES:
1. Return ONLY book titles, one per line
2. If user mentions a specific author, provide ACTUAL titles by that author
3. For Czech authors, use Czech titles (original or translated versions)
4. Be accurate with author's actual works - don't invent titles
5. Consider the user's language (Czech requests should prioritize Czech authors/translations)
6. Include both popular and lesser-known works by the requested author
7. No explanations, just the book titles

Examples:
User: "I want fantasy books"
Response:
Harry Potter and the Philosopher's Stone
The Lord of the Rings
A Game of Thrones
The Name of the Wind
The Way of Kings
The Hobbit
The Chronicles of Narnia
The Dark Tower

User: "Něco od Kundery"
Response:
Nesnesitelná lehkost bytí
Žert
Kniha smíchu a zapomnění
Valčík na rozloučenou
Život je jinde
Ignorance
Totožnost
Pomalost

User: "Chtěl bych si přečíst něco Mornštajnové"
Response:
Hlava XXII
Hana
Slepá mapa
Tiché roky
Rozmarné léto
Hotýlek
Zápisník alkoholičky Hany
Němci`;

      const userPrompt = `User request: "${query}"

Generate 8-10 specific book titles that match this request:`;

      // Call OpenAI via Cloudflare Worker
      const authHeaders = await getAuthHeaders();
      
      const response = await fetch(CLOUDFLARE_WORKER_URL, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Use faster model for suggestions
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_completion_tokens: 300,
          temperature: 0.8, // Higher temperature for more variety in regenerated suggestions
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`AI service error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content || '';
      
      // Parse the AI response to extract book titles
      const suggestions = aiResponse
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('User:') && !line.startsWith('Response:'))
        .slice(0, 10); // Limit to 10 suggestions

      console.log('🤖 AI generated suggestions:', suggestions);
      
      if (suggestions.length === 0) {
        // Fallback to some popular books if AI fails
        return ['Harry Potter', 'Lord of the Rings', 'The Great Gatsby', 'To Kill a Mockingbird'];
      }

      return suggestions;

    } catch (error) {
      console.error('Error generating AI suggestions:', error);
      
      // Fallback to basic suggestions if AI fails
      const fallbackSuggestions = [
        'Harry Potter and the Philosopher\'s Stone',
        'The Lord of the Rings',
        'The Great Gatsby',
        'To Kill a Mockingbird',
        'Pride and Prejudice',
        '1984'
      ];
      
      console.log('🔄 Using fallback suggestions:', fallbackSuggestions);
      return fallbackSuggestions;
    }
  }

  /**
   * Find best matches in database for AI-generated suggestions using embeddings
   */
  private async findBestMatchesForSuggestions(
    suggestions: string[],
    limit: number,
    options: SearchOptions = {}
  ): Promise<RecommendationResult[]> {
    console.log('🔍 Searching database for AI suggestions using embeddings:', suggestions);
    
    const allMatches: RecommendationResult[] = [];
    
    for (const suggestion of suggestions) {
      try {
        console.log(`🎯 Processing AI suggestion: "${suggestion}"`);
        
        // Generate embedding for this AI suggestion
        const embedding = await this.generateEmbeddingForSuggestion(suggestion);
        
        if (embedding) {
          // Use vector similarity search to find matches
          const matches = await this.searchByEmbedding(embedding, limit, options);
          
          // Add matches with relevance score based on suggestion order
          matches.forEach((match, index) => {
            const suggestionIndex = suggestions.indexOf(suggestion);
            const relevanceBonus = (suggestions.length - suggestionIndex) / suggestions.length;
            
            allMatches.push({
              ...match,
              similarity_score: Math.min(match.similarity_score + relevanceBonus * 0.1, 1.0),
              ai_suggestion: suggestion, // Track which AI suggestion led to this match
              search_method: 'embedding_vector'
            } as RecommendationResult & { ai_suggestion: string });
          });
          
          console.log(`✅ Found ${matches.length} embedding matches for "${suggestion}"`);
        } else {
          // Fallback to enhanced text search if embedding generation fails
          console.log(`⚠️ Embedding failed for "${suggestion}", falling back to enhanced text search`);
          
          // Try multiple search strategies for better results
          let textMatches: RecommendationResult[] = [];
          
          // Strategy 1: Direct title search
          textMatches = await this.searchDatabaseForTitle(suggestion, options);
          
          // Strategy 2: If no results, try searching by individual words
          if (textMatches.length === 0) {
            const words = suggestion.split(/\s+/).filter(word => word.length > 2);
            for (const word of words) {
              const wordMatches = await this.searchDatabaseForTitle(word, options);
              textMatches.push(...wordMatches);
              if (textMatches.length >= 10) break; // Limit to avoid too many results
            }
          }
          
          // Add matches with appropriate relevance scoring
          textMatches.forEach((match, index) => {
            const suggestionIndex = suggestions.indexOf(suggestion);
            const relevanceBonus = (suggestions.length - suggestionIndex) / suggestions.length;
            
            allMatches.push({
              ...match,
              similarity_score: Math.min(match.similarity_score * 0.8 + relevanceBonus * 0.1, 1.0),
              ai_suggestion: suggestion,
              search_method: 'text_fallback_enhanced'
            } as RecommendationResult & { ai_suggestion: string });
          });
          
          console.log(`📊 Enhanced text search found ${textMatches.length} matches for "${suggestion}"`);
        }
        
      } catch (error) {
        console.warn(`Failed to search for suggestion "${suggestion}":`, error);
      }
    }

    // Remove duplicates (same book ID), keeping the highest scoring match
    const uniqueMatches = new Map<number, RecommendationResult>();
    
    allMatches.forEach(match => {
      const existing = uniqueMatches.get(match.id);
      if (!existing || match.similarity_score > existing.similarity_score) {
        uniqueMatches.set(match.id, match);
      }
    });

    // Sort by similarity score and return top results
    const results = Array.from(uniqueMatches.values())
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, limit);
      
    console.log(`🎯 Final results: ${results.length} unique books found`);
    return results;
  }

  /**
   * Generate embedding for an AI suggestion using the Cloudflare Worker
   */
  private async generateEmbeddingForSuggestion(suggestion: string): Promise<number[] | null> {
    try {
      console.log(`🔮 Generating embedding for: "${suggestion}"`);
      
      const authHeaders = await getAuthHeaders();
      const response = await fetch(CLOUDFLARE_WORKER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          action: 'embedding',
          text: suggestion,
          model: 'text-embedding-3-small'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`❌ Embedding generation failed: ${response.status}`, errorText);
        
        // Check if this is the "messages array required" error - indicates old worker version
        if (errorText.includes('messages array is required')) {
          console.warn('🔄 Cloudflare Worker needs to be updated with embedding support');
        }
        
        return null;
      }

      const data = await response.json();
      const embedding = data.data?.[0]?.embedding;
      
      if (embedding && Array.isArray(embedding)) {
        console.log(`✅ Generated embedding with ${embedding.length} dimensions`);
        return embedding;
      } else {
        console.warn('❌ Invalid embedding response format');
        return null;
      }
      
    } catch (error) {
      console.error('❌ Error generating embedding:', error);
      return null;
    }
  }

  /**
   * Search database using vector embedding similarity
   * Uses direct Supabase queries instead of RPC functions to avoid parameter issues
   */
  private async searchByEmbedding(
    embedding: number[],
    limit: number,
    options: SearchOptions = {}
  ): Promise<RecommendationResult[]> {
    try {
      console.log(`🔍 Searching by embedding with ${embedding.length} dimensions`);
      console.log(`🔢 Using direct vector similarity search approach`);
      
      // Simplified approach: fetch embeddings and books separately to avoid join issues
      console.log('🔍 Step 1: Fetching embeddings...');
      
      const { data: embeddingData, error: embeddingError } = await supabase
        .from('book_embeddings')
        .select('book_id, embedding')
        .eq('model', 'text-embedding-3-small');

      console.log('🔍 Embeddings query result:', { 
        hasData: !!embeddingData, 
        dataLength: embeddingData?.length || 0,
        error: embeddingError?.message || 'none'
      });

      if (embeddingError) {
        console.error('❌ Embeddings query error:', embeddingError);
        return [];
      }

      if (!embeddingData || embeddingData.length === 0) {
        console.log('❌ No embeddings found with model text-embedding-3-small');
        return [];
      }

      // Get unique book IDs from embeddings
      const bookIds = [...new Set((embeddingData as any[]).map(item => item.book_id))];
      console.log(`🔍 Step 2: Found ${embeddingData.length} embeddings for ${bookIds.length} unique books`);

      // Fetch corresponding books
      let bookQuery = supabase
        .from('books')
        .select('id, title, master_mother_id, great_grandmother_id, misspelled, deleted_at')
        .in('id', bookIds);

      if (!options.include_deleted) {
        // Include only non-deleted books - handle both NULL and empty string as "not deleted"
        bookQuery = bookQuery.or('deleted_at.is.null,deleted_at.eq.');
      }

      const { data: bookData, error: bookError } = await bookQuery;

      console.log('📚 Books query result:', { 
        hasData: !!bookData, 
        dataLength: bookData?.length || 0,
        error: bookError?.message || 'none'
      });

      if (bookError) {
        console.error('❌ Books query error:', bookError);
        return [];
      }

      if (!bookData || bookData.length === 0) {
        console.log('❌ No books found for embedding book_ids (possibly all deleted)');
        
        // Debug: Check if books exist without the deleted_at filter
        const { data: allBooks, error: allBooksError } = await supabase
          .from('books')
          .select('id, title, deleted_at')
          .in('id', bookIds.slice(0, 10)); // Check first 10 book IDs
          
        console.log('🔍 Debug - Books without deleted filter:', {
          hasData: !!allBooks,
          dataLength: allBooks?.length || 0,
          sampleBooks: allBooks?.slice(0, 3),
          error: allBooksError?.message || 'none'
        });
        
        // Debug: Check a few specific book IDs
        const sampleIds = bookIds.slice(0, 5);
        console.log('🔍 Debug - Sample book_ids from embeddings:', sampleIds);
        
        return [];
      }

      // Create a map of book_id to book data for efficient lookup
      const bookMap = new Map((bookData as any[]).map(book => [book.id, book]));
      console.log(`📊 Retrieved ${embeddingData.length} embeddings and ${bookData.length} books for similarity calculation`);

      // Calculate cosine similarity for each embedding
      const results: (RecommendationResult & { similarity_score: number })[] = [];
      
      for (const embeddingItem of (embeddingData as any[])) {
        if (!embeddingItem.embedding || !Array.isArray(embeddingItem.embedding)) {
          continue;
        }

        // Get the corresponding book data
        const book = bookMap.get(embeddingItem.book_id);
        if (!book) {
          continue; // Book not found (possibly deleted)
        }

        // Apply exclude_ids filter
        if (options.exclude_ids && options.exclude_ids.includes(book.id)) {
          continue;
        }

        // Calculate cosine similarity
        const similarity = this.calculateCosineSimilarity(embedding, embeddingItem.embedding);
        
        // Only include results above threshold
        if (similarity >= 0.5) {
          results.push({
            id: book.id,
            title: book.title,
            master_mother_id: book.master_mother_id,
            great_grandmother_id: book.great_grandmother_id,
            misspelled: book.misspelled || false,
            deleted_at: book.deleted_at || undefined,
            similarity_score: similarity,
            search_method: 'vector_embedding_client' as any,
            search_threshold: 0.5
          } as any);
        }
      }

      // Sort by similarity score (highest first)
      results.sort((a, b) => b.similarity_score - a.similarity_score);

      console.log(`✅ Vector search found ${results.length} results with similarity >= 0.5`);
      return results.slice(0, limit);
      
    } catch (error) {
      console.error('❌ Error in vector search:', error);
      console.log('🔄 Falling back to text search due to vector search failure');
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Search database for a specific title
   */
  private async searchDatabaseForTitle(
    title: string,
    options: SearchOptions = {}
  ): Promise<RecommendationResult[]> {
    try {
      console.log('🔍 Searching database for title:', title);
      
      // Escape special characters and handle Czech characters properly
      const escapedTitle = title.replace(/[%_]/g, '\\$&');
      const firstWord = title.split(' ')[0].replace(/[%_]/g, '\\$&');
      
      // Try multiple search strategies with increasing flexibility
      const words = escapedTitle.split(' ').filter(word => word.length > 2);
      const searchStrategies = [
        // Exact title match
        { field: 'title', operator: 'ilike', value: `%${escapedTitle}%`, description: 'exact_title' },
        // First word match
        { field: 'title', operator: 'ilike', value: `%${firstWord}%`, description: 'first_word' },
        // Each significant word individually
        ...words.map(word => ({ 
          field: 'title', 
          operator: 'ilike', 
          value: `%${word}%`, 
          description: `word_${word}` 
        })),
        // Common variations for popular books
        ...(title.toLowerCase().includes('harry potter') ? [
          { field: 'title', operator: 'ilike', value: '%harry%potter%', description: 'harry_potter_variation' },
          { field: 'title', operator: 'ilike', value: '%potter%', description: 'potter_only' }
        ] : []),
        ...(title.toLowerCase().includes('hobit') ? [
          { field: 'title', operator: 'ilike', value: '%hobbit%', description: 'hobbit_english' }
        ] : []),
        ...(title.toLowerCase().includes('pán prstenů') ? [
          { field: 'title', operator: 'ilike', value: '%lord%rings%', description: 'lotr_english' },
          { field: 'title', operator: 'ilike', value: '%prstenů%', description: 'rings_czech' }
        ] : [])
      ];

      let allResults: any[] = [];

      for (const strategy of searchStrategies) {
        try {
          let supabaseQuery = supabase
            .from('books')
            .select('id, title, master_mother_id, great_grandmother_id, misspelled, deleted_at')
            .ilike(strategy.field, strategy.value)
            .limit(10);

          // Add filtering conditions
          if (!options.include_deleted) {
            supabaseQuery = supabaseQuery.is('deleted_at', null);
          }

          if (options.exclude_ids && options.exclude_ids.length > 0) {
            supabaseQuery = supabaseQuery.not('id', 'in', `(${options.exclude_ids.join(',')})`);
          }

          const { data, error } = await supabaseQuery;

          if (!error && data && (data as any[]).length > 0) {
            console.log(`✅ Found ${(data as any[]).length} results with strategy:`, strategy.description, 'Query:', strategy.value);
            console.log('Sample results:', (data as any[]).slice(0, 3).map(book => book.title));
            allResults = allResults.concat(data as any[]);
          } else if (error) {
            console.warn(`❌ Strategy ${strategy.description} failed:`, error.message);
          }
        } catch (strategyError) {
          console.warn('Search strategy failed:', strategy, strategyError);
        }
      }

      if (allResults.length === 0) {
        console.log('❌ No results found for title:', title);
        
        // Debug: Let's see what books are actually in the database
        try {
          const { data: sampleBooks, error: sampleError } = await supabase
            .from('books')
            .select('id, title')
            .is('deleted_at', null)
            .limit(10);
            
          if (!sampleError && sampleBooks) {
            console.log('📚 Sample books in database:', (sampleBooks as any[]).map(book => book.title));
          } else {
            console.log('❌ Could not fetch sample books:', sampleError?.message);
          }
        } catch (debugError) {
          console.log('❌ Debug query failed:', debugError);
        }
        
        return [];
      }

      // Remove duplicates and calculate similarity scores
      const uniqueResults = new Map<number, any>();
      
      allResults.forEach(book => {
        if (!uniqueResults.has(book.id)) {
          uniqueResults.set(book.id, book);
        }
      });

      // Calculate similarity scores for each match
      const results = Array.from(uniqueResults.values()).map((book: any) => ({
        id: book.id,
        title: book.title,
        similarity_score: this.calculateTitleSimilarity(title, book.title),
        master_mother_id: book.master_mother_id || undefined,
        great_grandmother_id: book.great_grandmother_id || undefined,
        misspelled: book.misspelled || false,
        deleted_at: book.deleted_at || undefined
      })).filter(result => result.similarity_score > 0.1);

      console.log(`📚 Returning ${results.length} results for "${title}"`);
      return results;

    } catch (error) {
      console.error('Database search error for title:', title, error);
      return [];
    }
  }

  /**
   * Calculate similarity between AI suggestion and database title
   */
  private calculateTitleSimilarity(suggestion: string, dbTitle: string): number {
    const suggestionLower = suggestion.toLowerCase();
    const titleLower = dbTitle.toLowerCase();
    
    // Exact match
    if (titleLower === suggestionLower) {
      return 1.0;
    }
    
    // Title contains suggestion
    if (titleLower.includes(suggestionLower)) {
      return 0.9;
    }
    
    // Suggestion contains title
    if (suggestionLower.includes(titleLower)) {
      return 0.8;
    }
    
    // Word-by-word comparison
    const suggestionWords = suggestionLower.split(/\s+/);
    const titleWords = titleLower.split(/\s+/);
    
    let matchingWords = 0;
    for (const suggestionWord of suggestionWords) {
      for (const titleWord of titleWords) {
        if (suggestionWord === titleWord || 
            suggestionWord.includes(titleWord) || 
            titleWord.includes(suggestionWord)) {
          matchingWords++;
          break;
        }
      }
    }
    
    if (matchingWords > 0) {
      return 0.5 + (matchingWords / Math.max(suggestionWords.length, titleWords.length)) * 0.3;
    }
    
    return 0.1;
  }

  /**
   * Clears the recommendation cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Validates recommendation request
   */
  validateRequest(request: RecommendationRequest): void {
    if (!request.title || request.title.trim().length === 0) {
      throw new Error('Title is required');
    }

    if (request.limit && (request.limit <= 0 || request.limit > this.MAX_LIMIT)) {
      throw new Error(`Limit must be between 1 and ${this.MAX_LIMIT}`);
    }

    if (request.threshold && (request.threshold < 0 || request.threshold > 1)) {
      throw new Error('Threshold must be between 0 and 1');
    }
  }
}

export default RecommendationService;
