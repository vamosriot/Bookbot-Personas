#!/usr/bin/env ts-node

/**
 * Embedding Generation Script
 * 
 * Generates OpenAI embeddings for books in the database that don't have embeddings yet.
 * Supports batch processing, progress tracking, and cost estimation.
 * 
 * Usage:
 *   npm run generate:embeddings
 *   npm run generate:embeddings -- --limit 100 --batch-size 25 --dry-run
 *   ts-node src/scripts/generate-embeddings.ts --help
 * 
 * Options:
 *   --batch-size <size>   Number of books to process per batch (default: 50)
 *   --limit <limit>       Maximum number of books to process (default: all)
 *   --dry-run            Show what would be processed without actually doing it
 *   --stats              Show embedding coverage statistics
 *   --help               Show this help message
 * 
 * Environment variables required:
 *   OPENAI_API_KEY - OpenAI API key
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key for administrative access
 */

import { config } from 'dotenv';
import { Command } from 'commander';
import EmbeddingService from '../services/embeddingService';

// Load environment variables
config();

// Console colors for better visibility
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

/**
 * Enhanced logging utility
 */
class Logger {
  private static timestamp(): string {
    return new Date().toISOString();
  }

  static info(message: string, ...args: any[]): void {
    console.log(`${colors.blue}[INFO ${this.timestamp()}]${colors.reset} ${message}`, ...args);
  }

  static success(message: string, ...args: any[]): void {
    console.log(`${colors.green}[SUCCESS ${this.timestamp()}]${colors.reset} ${message}`, ...args);
  }

  static warn(message: string, ...args: any[]): void {
    console.log(`${colors.yellow}[WARN ${this.timestamp()}]${colors.reset} ${message}`, ...args);
  }

  static error(message: string, ...args: any[]): void {
    console.error(`${colors.red}[ERROR ${this.timestamp()}]${colors.reset} ${message}`, ...args);
  }

  static progress(message: string): void {
    console.log(`${colors.cyan}[PROGRESS]${colors.reset} ${message}`);
  }

  static stats(message: string): void {
    console.log(`${colors.magenta}[STATS]${colors.reset} ${message}`);
  }
}

/**
 * Progress bar utility
 */
class ProgressBar {
  private total: number;
  private current: number;
  private startTime: number;

  constructor(total: number) {
    this.total = total;
    this.current = 0;
    this.startTime = Date.now();
  }

  update(current: number): void {
    this.current = current;
    const percentage = Math.round((current / this.total) * 100);
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
    const eta = current > 0 ? Math.round(((this.total - current) / current) * elapsed) : 0;
    
    const progressBar = '█'.repeat(Math.floor(percentage / 2)) + 
                       '░'.repeat(50 - Math.floor(percentage / 2));
    
    const display = `[${progressBar}] ${percentage}% (${current}/${this.total}) | ` +
                   `Elapsed: ${elapsed}s | ETA: ${eta}s`;
    
    process.stdout.write(`\r${colors.cyan}${display}${colors.reset}`);
    
    if (current === this.total) {
      console.log(); // New line when complete
    }
  }
}

/**
 * Validates required environment variables
 */
function validateEnvironment(): void {
  const required = [
    'OPENAI_API_KEY',
    'SUPABASE_URL', 
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    Logger.error('Missing required environment variables:');
    missing.forEach(key => {
      Logger.error(`  - ${key}`);
    });
    Logger.error('Please check your .env file or set these environment variables.');
    process.exit(1);
  }
}

/**
 * Shows embedding statistics
 */
async function showStats(): Promise<void> {
  try {
    Logger.info('Fetching embedding statistics...');
    
    const service = new EmbeddingService();
    const stats = await service.getEmbeddingStats();
    
    console.log('\n' + '='.repeat(60));
    Logger.stats('📊 Embedding Coverage Statistics');
    console.log('='.repeat(60));
    Logger.stats(`Total books in database: ${stats.total_books.toLocaleString()}`);
    Logger.stats(`Books with embeddings: ${stats.embedded_books.toLocaleString()}`);
    Logger.stats(`Coverage percentage: ${stats.coverage_percentage}%`);
    
    const remaining = stats.total_books - stats.embedded_books;
    if (remaining > 0) {
      Logger.stats(`Books needing embeddings: ${remaining.toLocaleString()}`);
      
      // Cost estimation for remaining books
      const estimatedTokens = remaining * 10; // rough estimate
      const estimatedCost = estimatedTokens * 0.00002 / 1000;
      Logger.stats(`Estimated cost for remaining: ~$${estimatedCost.toFixed(4)}`);
    } else {
      Logger.success('🎉 All books have embeddings generated!');
    }
    console.log('='.repeat(60));
    
  } catch (error) {
    Logger.error('Failed to fetch statistics:', error);
    process.exit(1);
  }
}

/**
 * Shows what would be processed in dry-run mode
 */
async function showDryRun(options: any): Promise<void> {
  try {
    Logger.info('Running in dry-run mode...');
    
    const service = new EmbeddingService();
    const books = await service.getBooksNeedingEmbeddings(options.limit);
    
    console.log('\n' + '='.repeat(60));
    Logger.info('🔍 Dry Run Results');
    console.log('='.repeat(60));
    Logger.info(`Books that would be processed: ${books.length}`);
    Logger.info(`Batch size: ${options.batchSize}`);
    Logger.info(`Number of batches: ${Math.ceil(books.length / options.batchSize)}`);
    
    if (books.length > 0) {
      // Estimate tokens and cost
      const estimatedTokens = books.length * 10; // rough estimate
      const estimatedCost = estimatedTokens * 0.00002 / 1000;
      Logger.info(`Estimated tokens: ~${estimatedTokens.toLocaleString()}`);
      Logger.info(`Estimated cost: ~$${estimatedCost.toFixed(4)}`);
      
      Logger.info('\nFirst 5 books that would be processed:');
      books.slice(0, 5).forEach((book, index) => {
        const misspelledFlag = book.misspelled ? ' (misspelled)' : '';
        Logger.info(`  ${index + 1}. [ID:${book.id}] ${book.title}${misspelledFlag}`);
      });
      
      if (books.length > 5) {
        Logger.info(`  ... and ${books.length - 5} more books`);
      }
    } else {
      Logger.success('✨ No books need embeddings generated!');
    }
    console.log('='.repeat(60));
    
  } catch (error) {
    Logger.error('Dry run failed:', error);
    process.exit(1);
  }
}

/**
 * Main embedding generation function
 */
async function generateEmbeddings(options: any): Promise<void> {
  const startTime = Date.now();
  
  try {
    Logger.info('🚀 Starting embedding generation process...');
    Logger.info(`Batch size: ${options.batchSize}`);
    if (options.limit) {
      Logger.info(`Limit: ${options.limit} books`);
    }
    
    const service = new EmbeddingService();
    
    // Show initial stats
    const initialStats = await service.getEmbeddingStats();
    Logger.info(`Initial coverage: ${initialStats.embedded_books}/${initialStats.total_books} books (${initialStats.coverage_percentage}%)`);
    
    if (initialStats.total_books === initialStats.embedded_books) {
      Logger.success('✨ All books already have embeddings generated!');
      return;
    }
    
    // Generate embeddings
    const result = await service.generateEmbeddings(options.batchSize, options.limit);
    
    // Show final results
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    console.log('\n' + '='.repeat(60));
    Logger.success('🎉 Embedding Generation Complete!');
    console.log('='.repeat(60));
    Logger.success(`Successfully processed: ${result.processed}/${result.total} books`);
    
    if (result.errors > 0) {
      Logger.warn(`Errors encountered: ${result.errors}`);
    }
    
    Logger.success(`Estimated cost: $${result.estimatedCost.toFixed(4)}`);
    Logger.success(`Total processing time: ${duration}s`);
    
    // Show updated coverage
    const finalStats = await service.getEmbeddingStats();
    Logger.success(`Final coverage: ${finalStats.embedded_books}/${finalStats.total_books} books (${finalStats.coverage_percentage}%)`);
    
    console.log('='.repeat(60));
    
  } catch (error) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    Logger.error(`Embedding generation failed after ${duration}s:`, error);
    process.exit(1);
  }
}

/**
 * Main CLI function
 */
async function main(): Promise<void> {
  // Validate environment
  validateEnvironment();
  
  // Set up CLI
  const program = new Command();
  
  program
    .name('generate-embeddings')
    .description('Generate OpenAI embeddings for books in the database')
    .version('1.0.0');

  program
    .option('-b, --batch-size <size>', 'number of books to process per batch', '50')
    .option('-l, --limit <limit>', 'maximum number of books to process')
    .option('-d, --dry-run', 'show what would be processed without doing it')
    .option('-s, --stats', 'show embedding coverage statistics')
    .option('--help', 'show help message');

  program.parse();
  
  const options = program.opts();
  
  // Convert string options to numbers
  options.batchSize = parseInt(options.batchSize, 10);
  if (options.limit) {
    options.limit = parseInt(options.limit, 10);
  }
  
  // Validate options
  if (options.batchSize <= 0 || options.batchSize > 100) {
    Logger.error('Batch size must be between 1 and 100');
    process.exit(1);
  }
  
  if (options.limit && options.limit <= 0) {
    Logger.error('Limit must be greater than 0');
    process.exit(1);
  }

  try {
    if (options.stats) {
      await showStats();
    } else if (options.dryRun) {
      await showDryRun(options);
    } else {
      await generateEmbeddings(options);
    }
  } catch (error) {
    Logger.error('Script failed:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  Logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  Logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Execute main function if script is run directly
if (require.main === module) {
  main();
}

export default main;
