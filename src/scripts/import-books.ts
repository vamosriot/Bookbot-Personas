#!/usr/bin/env ts-node

/**
 * CSV Import Script for Books Data
 * 
 * This script processes CSV files containing book metadata and imports them into the Supabase database.
 * It handles batch processing, data validation, duplicate detection, and comprehensive error logging.
 * 
 * Usage:
 *   npm run import:books /path/to/books.csv
 *   ts-node src/scripts/import-books.ts /path/to/books.csv
 * 
 * Environment variables required:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key for administrative access
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { parse } from 'csv-parse';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file
config();
import { 
  BookCSVRow, 
  ImportStats, 
  Database 
} from '../types/index.js';
import { 
  DB_TABLES, 
  IMPORT_CONFIG, 
  ERROR_MESSAGES, 
  SUCCESS_MESSAGES, 
  LOADING_STATES,
  validateImportEnvironmentVariables 
} from '../config/constants.node';

// Console colors for better visibility
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

/**
 * Enhanced logging utility with colors and timestamps
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

  static progress(current: number, total: number, message?: string): void {
    const percentage = Math.round((current / total) * 100);
    const progressBar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
    const display = `${colors.cyan}[${progressBar}] ${percentage}% (${current}/${total})${colors.reset}`;
    const extra = message ? ` ${message}` : '';
    process.stdout.write(`\r${display}${extra}`);
    if (current === total) {
      console.log(); // New line when complete
    }
  }
}

/**
 * Data validation and transformation utilities
 */
class DataProcessor {
  /**
   * Validates and transforms a CSV row into a Book record
   */
  static processBookRow(row: BookCSVRow, rowIndex: number): Database['public']['Tables']['books']['Insert'] | null {
    try {
      // Required field validation
      if (!row.title || typeof row.title !== 'string' || row.title.trim() === '') {
        throw new Error('Title is required and must be a non-empty string');
      }

      // ID validation helper - handles numeric IDs
      const validateID = (value: string | number | undefined | null): number | undefined => {
        if (!value) return undefined;
        
        // Handle numeric values
        if (typeof value === 'number') {
          if (!Number.isInteger(value) || value <= 0) {
            throw new Error(`Invalid numeric ID: ${value}`);
          }
          return value;
        }
        
        // Handle string values
        const stringValue = String(value).trim();
        if (stringValue === '') return undefined;
        
        // Check if it's a valid numeric string
        const numericValue = parseInt(stringValue, 10);
        if (isNaN(numericValue) || numericValue <= 0 || !stringValue.match(/^\d+$/)) {
          throw new Error(`Invalid ID format (expected positive integer): ${value}`);
        }
        
        return numericValue;
      };

      // Date validation helper
      const validateDate = (value: string | undefined | null): string | undefined => {
        if (!value || value.trim() === '') return undefined;
        const date = new Date(value.trim());
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid date format: ${value}`);
        }
        return date.toISOString();
      };

      // Boolean conversion helper
      const convertBoolean = (value: string | boolean | undefined | null): boolean => {
        if (typeof value === 'boolean') return value;
        if (!value) return false;
        const stringValue = String(value).toLowerCase().trim();
        return ['true', '1', 'yes', 'y'].includes(stringValue);
      };

      // Handle CSV column name variations (misspelled is primary, mispelled is legacy)
      const misspelledValue = row.misspelled || row.mispelled;

      // Validate ID from CSV if it exists
      let validatedId: number | undefined = undefined;
      if (row.id !== undefined && row.id !== null && row.id !== '') {
        validatedId = validateID(row.id);
      }

      // Process and validate the row with all required fields
      const processedRow: any = {
        title: row.title.trim(),
        master_mother_id: validateID(row.master_mother_id),
        deleted_at: validateDate(row.deleted_at),
        merged_to: validateID(row.merged_to),
        great_grandmother_id: validateID(row.great_grandmother_id),
        misspelled: misspelledValue !== undefined && misspelledValue !== null && misspelledValue !== '' 
          ? convertBoolean(misspelledValue) 
          : false
      };

      // Include ID from CSV if it's valid, otherwise let DB auto-generate
      if (validatedId !== undefined) {
        processedRow.id = validatedId;
      }

      return processedRow;
    } catch (error) {
      Logger.error(`Row ${rowIndex + 1} validation failed:`, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Chunks array into smaller batches for processing
   */
  static chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

/**
 * Main import class handling the CSV processing and database operations
 */
class BookImporter {
  private supabase: ReturnType<typeof createClient<Database>>;
  private stats: ImportStats;

  constructor() {
    // Validate environment variables
    validateImportEnvironmentVariables();

    // Initialize Supabase client with service role
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    Logger.info(`Connecting to Supabase: ${supabaseUrl}`);
    Logger.info(`Using service role key: ${serviceRoleKey.slice(0, 20)}...${serviceRoleKey.slice(-10)}`);
    
    this.supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Initialize statistics
    this.stats = {
      totalRecords: 0,
      successfulInserts: 0,
      successfulUpdates: 0,
      skippedRecords: 0,
      errorRecords: 0,
      errors: []
    };
  }

  /**
   * Temporarily disables foreign key constraints to allow importing data with cross-references
   */
  private async disableForeignKeyConstraints(): Promise<void> {
    Logger.info('Checking foreign key constraints...');
    Logger.warn('Foreign key constraints need to be disabled manually in Supabase.');
    Logger.warn('Please run the following SQL in your Supabase SQL Editor:');
    Logger.warn('');
    Logger.warn('ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_master_mother_id_fkey;');
    Logger.warn('ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_merged_to_fkey;');
    Logger.warn('');
    Logger.info('Once constraints are removed, the import should succeed.');
  }

  /**
   * Re-enables foreign key constraints after import (optional)
   */
  private async enableForeignKeyConstraints(): Promise<void> {
    Logger.info('To re-enable foreign key constraints after import, run:');
    Logger.info('');
    Logger.info('ALTER TABLE public.books ADD CONSTRAINT books_master_mother_id_fkey');
    Logger.info('  FOREIGN KEY (master_mother_id) REFERENCES public.books(id) NOT VALID;');
    Logger.info('');
    Logger.info('ALTER TABLE public.books ADD CONSTRAINT books_merged_to_fkey');
    Logger.info('  FOREIGN KEY (merged_to) REFERENCES public.books(id) NOT VALID;');
    Logger.info('');
  }

  /**
   * Validates CSV file exists and is readable
   */
  private async validateFile(filePath: string): Promise<void> {
    try {
      const stats = await fs.promises.stat(filePath);
      
      if (!stats.isFile()) {
        throw new Error('Path is not a file');
      }

      if (stats.size === 0) {
        throw new Error('File is empty');
      }

      if (stats.size > IMPORT_CONFIG.MAX_CSV_FILE_SIZE) {
        throw new Error(ERROR_MESSAGES.CSV_FILE_TOO_LARGE);
      }

      // Check file extension
      const ext = path.extname(filePath).toLowerCase();
      if (!['.csv', '.txt'].includes(ext)) {
        Logger.warn('File does not have .csv extension, but proceeding with import...');
      }

      Logger.info(`File validation passed. Size: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        throw new Error(ERROR_MESSAGES.CSV_FILE_NOT_FOUND);
      }
      throw error;
    }
  }

  /**
   * Parses CSV file and returns processed records
   */
  private async parseCSV(filePath: string): Promise<Database['public']['Tables']['books']['Insert'][]> {
    Logger.info(LOADING_STATES.PARSING_CSV);

    return new Promise((resolve, reject) => {
      const results: Database['public']['Tables']['books']['Insert'][] = [];
      const csvStream = fs.createReadStream(filePath);

      csvStream
        .pipe(parse({
          columns: true, // Use first row as headers
          skip_empty_lines: true,
          trim: true,
          cast: false // Keep all values as strings for manual processing
        }))
        .on('data', (row: BookCSVRow) => {
          this.stats.totalRecords++;
          
          const processedRow = DataProcessor.processBookRow(row, this.stats.totalRecords - 1);
          
          if (processedRow) {
            results.push(processedRow);
          } else {
            this.stats.skippedRecords++;
          }
        })
        .on('error', (error) => {
          Logger.error(ERROR_MESSAGES.CSV_PARSE_ERROR, error);
          reject(error);
        })
        .on('end', () => {
          Logger.success(`Parsed ${results.length} valid records from ${this.stats.totalRecords} total rows`);
          resolve(results);
        });
    });
  }

  /**
   * Processes a batch of records with retry logic
   */
  private async processBatch(
    batch: Database['public']['Tables']['books']['Insert'][], 
    batchIndex: number,
    totalBatches: number
  ): Promise<void> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        Logger.progress(batchIndex + 1, totalBatches, `${LOADING_STATES.PROCESSING_BATCH} ${batchIndex + 1}`);

        // Use upsert to handle both inserts and updates
        const { data, error } = await this.supabase
          .from(DB_TABLES.BOOKS)
          .upsert(batch as any, {
            onConflict: 'id',
            ignoreDuplicates: false
          })
          .select('id');

        if (error) {
          throw error;
        }

        // Count successful operations
        if (data) {
          this.stats.successfulInserts += data.length;
        } else {
          // If no data returned, assume all were updates
          this.stats.successfulUpdates += batch.length;
        }

        return; // Success, exit retry loop
      } catch (error) {
        attempt++;
        let errorMessage = 'Unknown error';
        
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'object' && error !== null) {
          // Handle Supabase error objects
          errorMessage = JSON.stringify(error, null, 2);
        } else {
          errorMessage = String(error);
        }
        
        if (attempt >= maxRetries) {
          // Final attempt failed
          this.stats.errorRecords += batch.length;
          this.stats.errors.push({
            row: batchIndex * IMPORT_CONFIG.BATCH_SIZE,
            error: `${ERROR_MESSAGES.IMPORT_BATCH_ERROR}: ${errorMessage}`,
            data: batch.slice(0, 3) // Include first few records for debugging
          });
          Logger.error(`Batch ${batchIndex + 1} failed after ${maxRetries} attempts:`);
          Logger.error(`Error details: ${errorMessage}`);
          return;
        } else {
          // Retry with exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          Logger.warn(`Batch ${batchIndex + 1} attempt ${attempt} failed, retrying in ${delay}ms...`);
          Logger.warn(`Error: ${errorMessage}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
  }

  /**
   * Resets the sequence after importing to ensure future auto-generated IDs are correct
   */
  private async resetSequence(): Promise<void> {
    try {
      Logger.info('Resetting ID sequence to prevent conflicts...');
      
      // Get the maximum ID in the table
      const { data, error } = await this.supabase
        .from(DB_TABLES.BOOKS)
        .select('id')
        .order('id', { ascending: false })
        .limit(1);
        
      if (error) {
        Logger.warn('Could not get max ID for sequence reset:', error.message);
        return;
      }
      
      if (data && data.length > 0) {
        // Type assertion to ensure 'data' is treated as an array of objects with an 'id' property
        const typedData = data as Array<{ id: number }>;
        const maxId = typedData[0].id;
        Logger.info(`Setting sequence to start after ID ${maxId}...`);
        
        // Note: Sequence reset would need to be done via SQL in Supabase
        Logger.info(`To reset the sequence manually, run in Supabase SQL Editor:`);
        Logger.info(`SELECT setval('books_id_seq', ${maxId});`);
      }
    } catch (error) {
      Logger.warn('Could not reset sequence:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Main import function
   */
  async importFromCSV(filePath: string): Promise<ImportStats> {
    const startTime = Date.now();
    
    try {
      Logger.info('Starting book import process...');
      Logger.info(`Input file: ${filePath}`);
      Logger.info('This import will preserve original IDs from CSV data.');

      // Validate the file
      await this.validateFile(filePath);

      // Parse CSV file
      const records = await this.parseCSV(filePath);

      if (records.length === 0) {
        throw new Error('No valid records found in CSV file');
      }

      // Check if records have IDs
      const recordsWithIds = records.filter(r => r.id !== undefined);
      const recordsWithoutIds = records.filter(r => r.id === undefined);
      
      Logger.info(`Records with explicit IDs: ${recordsWithIds.length}`);
      Logger.info(`Records without IDs (will be auto-generated): ${recordsWithoutIds.length}`);

      // Disable foreign key constraints to allow importing cross-referenced data
      await this.disableForeignKeyConstraints();

      try {
        // Process records in batches
        Logger.info(LOADING_STATES.IMPORTING_BOOKS);
        const batches = DataProcessor.chunkArray(records, IMPORT_CONFIG.BATCH_SIZE);
        Logger.info(`Processing ${records.length} records in ${batches.length} batches of ${IMPORT_CONFIG.BATCH_SIZE}`);

        // Process each batch
        for (let i = 0; i < batches.length; i++) {
          await this.processBatch(batches[i], i, batches.length);
        }
        
        // Reset sequence to prevent ID conflicts
        await this.resetSequence();
      } finally {
        // Re-enable foreign key constraints after import
        await this.enableForeignKeyConstraints();
      }

      // Calculate final statistics
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      Logger.success('\n' + '='.repeat(60));
      Logger.success(SUCCESS_MESSAGES.CSV_IMPORT_COMPLETED);
      Logger.success('Import Statistics:');
      Logger.info(`  Total records processed: ${this.stats.totalRecords}`);
      Logger.info(`  Successful inserts: ${this.stats.successfulInserts}`);
      Logger.info(`  Successful updates: ${this.stats.successfulUpdates}`);
      Logger.info(`  Skipped records: ${this.stats.skippedRecords}`);
      Logger.info(`  Error records: ${this.stats.errorRecords}`);
      Logger.info(`  Duration: ${duration}s`);
      
      if (this.stats.errors.length > 0) {
        Logger.warn('\nErrors encountered:');
        this.stats.errors.forEach((error, index) => {
          Logger.error(`  ${index + 1}. Row ${error.row}: ${error.error}`);
        });
      }

      Logger.success('='.repeat(60));

      return this.stats;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error('Import failed:', errorMessage);
      throw error;
    }
  }
}

/**
 * CLI interface and main execution logic
 */
async function main(): Promise<void> {
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    Logger.error('Usage: npm run import:books <csv-file-path>');
    Logger.error('Example: npm run import:books ./data/books.csv');
    process.exit(1);
  }

  const csvFilePath = args[0];
  
  if (!csvFilePath) {
    Logger.error('Please provide a CSV file path');
    process.exit(1);
  }

  // Resolve to absolute path
  const absolutePath = path.resolve(csvFilePath);

  try {
    const importer = new BookImporter();
    const stats = await importer.importFromCSV(absolutePath);

    // Exit with error code if there were any errors
    const hasErrors = stats.errorRecords > 0;
    process.exit(hasErrors ? 1 : 0);
  } catch (error) {
    Logger.error('Fatal error during import:', error instanceof Error ? error.message : String(error));
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

export default BookImporter;
export { BookImporter, DataProcessor, Logger };
