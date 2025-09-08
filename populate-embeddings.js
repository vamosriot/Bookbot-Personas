/**
 * Enhanced Script to populate the book_embeddings table
 * 
 * Features:
 * - Environment variable validation
 * - Better error handling with retry logic
 * - Progress tracking with estimated time remaining
 * - Batch processing to avoid overwhelming APIs
 * - Resume capability (skip existing embeddings)
 * - Data validation
 * - Dry-run mode for testing
 * 
 * Usage:
 *   node populate-embeddings.js                    # Process all books
 *   node populate-embeddings.js --dry-run          # Test without generating embeddings
 *   node populate-embeddings.js --batch-size=10    # Custom batch size
 *   node populate-embeddings.js --limit=100        # Limit number of books to process
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Configuration
const CONFIG = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  CLOUDFLARE_WORKER_URL: process.env.VITE_CLOUDFLARE_WORKER_URL || 'https://bookbot-openai-worker.vojtech-gryc.workers.dev/',
  
  // Performance settings
  BATCH_SIZE: parseInt(process.env.EMBEDDING_BATCH_SIZE) || 50,
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000, // 2 seconds
  RATE_LIMIT_DELAY: 1000, // 1 second between requests
  REQUEST_TIMEOUT: 30000, // 30 seconds
  
  // Embedding settings
  MODEL: 'text-embedding-3-small',
  EXPECTED_DIMENSIONS: 1536
};

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
const limitArg = args.find(arg => arg.startsWith('--limit='));

if (batchSizeArg) {
  CONFIG.BATCH_SIZE = parseInt(batchSizeArg.split('=')[1]) || CONFIG.BATCH_SIZE;
}

const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : null;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

// Statistics tracking
const stats = {
  totalBooks: 0,
  processedBooks: 0,
  successfulEmbeddings: 0,
  skippedExisting: 0,
  failedEmbeddings: 0,
  startTime: Date.now(),
  errors: []
};

function validateEnvironmentVariables() {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter(key => !CONFIG[key] || CONFIG[key].includes('your_'));
  
  if (missing.length > 0) {
    console.error(colorize('❌ Missing required environment variables:', 'red'));
    missing.forEach(key => console.error(colorize(`   - ${key}`, 'red')));
    console.error(colorize('\nPlease set these in your .env file', 'yellow'));
    process.exit(1);
  }
  
  if (!CONFIG.OPENAI_API_KEY && !CONFIG.CLOUDFLARE_WORKER_URL) {
    console.error(colorize('❌ Need either OPENAI_API_KEY or CLOUDFLARE_WORKER_URL', 'red'));
    process.exit(1);
  }
  
  console.log(colorize('✅ Environment variables validated', 'green'));
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function printProgress() {
  const elapsed = Date.now() - stats.startTime;
  const rate = stats.processedBooks / (elapsed / 1000);
  const remaining = stats.totalBooks - stats.processedBooks;
  const eta = remaining > 0 ? remaining / rate * 1000 : 0;
  
  console.log(colorize(`\n📊 Progress: ${stats.processedBooks}/${stats.totalBooks} books`, 'cyan'));
  console.log(colorize(`   ✅ Successful: ${stats.successfulEmbeddings}`, 'green'));
  console.log(colorize(`   ⏭️  Skipped: ${stats.skippedExisting}`, 'yellow'));
  console.log(colorize(`   ❌ Failed: ${stats.failedEmbeddings}`, 'red'));
  console.log(colorize(`   ⏱️  Elapsed: ${formatDuration(elapsed)}`, 'blue'));
  if (eta > 0) {
    console.log(colorize(`   🔮 ETA: ${formatDuration(eta)}`, 'magenta'));
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateEmbedding(text, retryCount = 0) {
  try {
    if (isDryRun) {
      console.log(colorize(`🔮 [DRY RUN] Would generate embedding for: "${text}"`, 'yellow'));
      // Return a dummy embedding for dry run
      return Array(CONFIG.EXPECTED_DIMENSIONS).fill(0.1);
    }
    
    console.log(`🔮 Generating embedding for: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);
    
    const response = await fetch(CONFIG.CLOUDFLARE_WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'embedding',
        text: text,
        model: CONFIG.MODEL
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const embedding = data.data?.[0]?.embedding;
    
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Invalid embedding response format');
    }
    
    if (embedding.length !== CONFIG.EXPECTED_DIMENSIONS) {
      throw new Error(`Invalid embedding dimensions: ${embedding.length}, expected ${CONFIG.EXPECTED_DIMENSIONS}`);
    }
    
    console.log(colorize(`✅ Generated embedding with ${embedding.length} dimensions`, 'green'));
    return embedding;
    
  } catch (error) {
    console.error(colorize(`❌ Embedding generation failed: ${error.message}`, 'red'));
    
    if (retryCount < CONFIG.MAX_RETRIES) {
      console.log(colorize(`🔄 Retrying in ${CONFIG.RETRY_DELAY}ms... (attempt ${retryCount + 1}/${CONFIG.MAX_RETRIES})`, 'yellow'));
      await sleep(CONFIG.RETRY_DELAY);
      return generateEmbedding(text, retryCount + 1);
    }
    
    stats.errors.push({ text: text.substring(0, 100), error: error.message });
    return null;
  }
}

async function checkExistingEmbedding(supabase, bookId) {
  try {
    const { data, error } = await supabase
      .from('book_embeddings')
      .select('id')
      .eq('book_id', bookId)
      .eq('model', CONFIG.MODEL)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw error;
    }
    
    return !!data;
  } catch (error) {
    console.error(colorize(`❌ Error checking existing embedding for book ${bookId}: ${error.message}`, 'red'));
    return false;
  }
}

async function insertEmbedding(supabase, bookId, embedding, retryCount = 0) {
  try {
    if (isDryRun) {
      console.log(colorize(`💾 [DRY RUN] Would insert embedding for book ID ${bookId}`, 'yellow'));
      return true;
    }
    
    console.log(`💾 Inserting embedding for book ID ${bookId}...`);
    
    const { data, error } = await supabase
      .from('book_embeddings')
      .upsert({
        book_id: bookId,
        embedding: embedding,
        model: CONFIG.MODEL
      }, {
        onConflict: 'book_id,model'
      });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    console.log(colorize(`✅ Successfully inserted embedding for book ID ${bookId}`, 'green'));
    return true;
    
  } catch (error) {
    console.error(colorize(`❌ Failed to insert embedding for book ${bookId}: ${error.message}`, 'red'));
    
    if (retryCount < CONFIG.MAX_RETRIES) {
      console.log(colorize(`🔄 Retrying database insert... (attempt ${retryCount + 1}/${CONFIG.MAX_RETRIES})`, 'yellow'));
      await sleep(CONFIG.RETRY_DELAY);
      return insertEmbedding(supabase, bookId, embedding, retryCount + 1);
    }
    
    stats.errors.push({ bookId, error: error.message });
    return false;
  }
}

async function fetchBooksToProcess(supabase) {
  try {
    console.log(colorize('📚 Fetching books from database...', 'cyan'));
    
    let query = supabase
      .from('books')
      .select('id, title')
      .is('deleted_at', null) // Only non-deleted books
      .order('id');
    
    if (LIMIT) {
      query = query.limit(LIMIT);
    }
    
    const { data: books, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch books: ${error.message}`);
    }
    
    if (!books || books.length === 0) {
      throw new Error('No books found in database');
    }
    
    console.log(colorize(`✅ Found ${books.length} books to process`, 'green'));
    return books;
    
  } catch (error) {
    console.error(colorize(`❌ Error fetching books: ${error.message}`, 'red'));
    throw error;
  }
}

async function processBatch(supabase, books) {
  console.log(colorize(`\n🔄 Processing batch of ${books.length} books...`, 'cyan'));
  
  for (const book of books) {
    try {
      stats.processedBooks++;
      
      console.log(colorize(`\n📖 Processing: "${book.title}" (ID: ${book.id})`, 'bright'));
      
      // Check if embedding already exists
      const exists = await checkExistingEmbedding(supabase, book.id);
      if (exists) {
        console.log(colorize(`⏭️  Skipping - embedding already exists for book ID ${book.id}`, 'yellow'));
        stats.skippedExisting++;
        continue;
      }
      
      // Generate embedding
      const embedding = await generateEmbedding(book.title);
      
      if (embedding) {
        // Insert into database
        const success = await insertEmbedding(supabase, book.id, embedding);
        if (success) {
          stats.successfulEmbeddings++;
        } else {
          stats.failedEmbeddings++;
        }
      } else {
        console.log(colorize(`❌ Skipping book ID ${book.id} due to embedding generation failure`, 'red'));
        stats.failedEmbeddings++;
      }
      
      // Progress update every 10 books
      if (stats.processedBooks % 10 === 0) {
        printProgress();
      }
      
      // Rate limiting
      if (!isDryRun) {
        await sleep(CONFIG.RATE_LIMIT_DELAY);
      }
      
    } catch (error) {
      console.error(colorize(`❌ Error processing book ${book.id}: ${error.message}`, 'red'));
      stats.failedEmbeddings++;
      stats.errors.push({ bookId: book.id, title: book.title, error: error.message });
    }
  }
}

function printFinalReport() {
  const elapsed = Date.now() - stats.startTime;
  
  console.log(colorize('\n' + '='.repeat(60), 'cyan'));
  console.log(colorize('📊 FINAL REPORT', 'bright'));
  console.log(colorize('='.repeat(60), 'cyan'));
  
  console.log(colorize(`📚 Total books processed: ${stats.processedBooks}`, 'blue'));
  console.log(colorize(`✅ Successful embeddings: ${stats.successfulEmbeddings}`, 'green'));
  console.log(colorize(`⏭️  Skipped (already existed): ${stats.skippedExisting}`, 'yellow'));
  console.log(colorize(`❌ Failed embeddings: ${stats.failedEmbeddings}`, 'red'));
  console.log(colorize(`⏱️  Total time: ${formatDuration(elapsed)}`, 'blue'));
  
  if (stats.successfulEmbeddings > 0) {
    const rate = stats.successfulEmbeddings / (elapsed / 1000);
    console.log(colorize(`⚡ Average rate: ${rate.toFixed(2)} embeddings/second`, 'magenta'));
  }
  
  if (stats.errors.length > 0) {
    console.log(colorize(`\n❌ Errors encountered (${stats.errors.length}):`, 'red'));
    stats.errors.slice(0, 10).forEach((error, index) => {
      console.log(colorize(`   ${index + 1}. Book ${error.bookId || 'unknown'}: ${error.error}`, 'red'));
    });
    if (stats.errors.length > 10) {
      console.log(colorize(`   ... and ${stats.errors.length - 10} more errors`, 'red'));
    }
  }
  
  if (stats.successfulEmbeddings > 0) {
    console.log(colorize('\n🎉 SUCCESS! Embeddings have been populated.', 'green'));
    console.log(colorize('You can now test the vector search functionality.', 'green'));
  } else if (stats.processedBooks === 0) {
    console.log(colorize('\n⚠️  No books were processed. Check your database connection and book data.', 'yellow'));
  } else {
    console.log(colorize('\n❌ No embeddings were successfully generated. Please check the errors above.', 'red'));
  }
}

async function main() {
  console.log(colorize('🚀 Enhanced Embedding Population Script', 'bright'));
  console.log(colorize('=====================================', 'cyan'));
  
  if (isDryRun) {
    console.log(colorize('🔍 DRY RUN MODE - No actual embeddings will be generated', 'yellow'));
  }
  
  console.log(colorize(`📊 Configuration:`, 'blue'));
  console.log(colorize(`   - Batch size: ${CONFIG.BATCH_SIZE}`, 'blue'));
  console.log(colorize(`   - Max retries: ${CONFIG.MAX_RETRIES}`, 'blue'));
  console.log(colorize(`   - Rate limit delay: ${CONFIG.RATE_LIMIT_DELAY}ms`, 'blue'));
  console.log(colorize(`   - Model: ${CONFIG.MODEL}`, 'blue'));
  if (LIMIT) {
    console.log(colorize(`   - Limit: ${LIMIT} books`, 'blue'));
  }
  
  try {
    // Step 1: Validate environment
    validateEnvironmentVariables();
    
    // Step 2: Initialize Supabase client
    console.log(colorize('\n🔌 Initializing Supabase client...', 'cyan'));
    const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // Step 3: Test connection
    console.log(colorize('🔍 Testing database connection...', 'cyan'));
    const { error: connectionError } = await supabase
      .from('books')
      .select('count', { count: 'exact', head: true })
      .limit(1);
    
    if (connectionError) {
      throw new Error(`Database connection failed: ${connectionError.message}`);
    }
    console.log(colorize('✅ Database connection successful', 'green'));
    
    // Step 4: Fetch books to process
    const allBooks = await fetchBooksToProcess(supabase);
    stats.totalBooks = allBooks.length;
    
    // Step 5: Process books in batches
    console.log(colorize(`\n🔄 Processing ${stats.totalBooks} books in batches of ${CONFIG.BATCH_SIZE}...`, 'cyan'));
    
    for (let i = 0; i < allBooks.length; i += CONFIG.BATCH_SIZE) {
      const batch = allBooks.slice(i, i + CONFIG.BATCH_SIZE);
      console.log(colorize(`\n📦 Batch ${Math.floor(i / CONFIG.BATCH_SIZE) + 1}/${Math.ceil(allBooks.length / CONFIG.BATCH_SIZE)}`, 'magenta'));
      
      await processBatch(supabase, batch);
      
      // Progress update after each batch
      printProgress();
      
      // Small delay between batches
      if (i + CONFIG.BATCH_SIZE < allBooks.length && !isDryRun) {
        console.log(colorize('⏸️  Pausing between batches...', 'yellow'));
        await sleep(2000);
      }
    }
    
    // Step 6: Final report
    printFinalReport();
    
  } catch (error) {
    console.error(colorize(`\n💥 Fatal error: ${error.message}`, 'red'));
    console.error(error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(colorize('\n\n⏹️  Process interrupted by user', 'yellow'));
  printFinalReport();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(colorize('\n\n⏹️  Process terminated', 'yellow'));
  printFinalReport();
  process.exit(0);
});

// Run the script
main().catch((error) => {
  console.error(colorize(`\n💥 Unhandled error: ${error.message}`, 'red'));
  console.error(error);
  process.exit(1);
});
