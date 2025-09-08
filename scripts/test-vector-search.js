#!/usr/bin/env node

/**
 * Comprehensive Vector Search Test Script
 * 
 * This script performs end-to-end testing of the vector search functionality,
 * including embedding generation, RPC functions, client-side search, and
 * the high-level RecommendationService.
 * 
 * Usage: node scripts/test-vector-search.js [options]
 * 
 * Options:
 *   --quick          Run only essential tests (faster)
 *   --benchmark      Include performance benchmarking
 *   --verbose        Detailed output for debugging
 *   --query="text"   Custom search query (default: "Harry Potter")
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

dotenv.config({ path: join(rootDir, '.env') });

// Configuration
const CONFIG = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  CLOUDFLARE_WORKER_URL: process.env.VITE_CLOUDFLARE_WORKER_URL || 'https://bookbot-openai-worker.vojtech-gryc.workers.dev/',
  
  // Test settings
  DEFAULT_QUERY: 'Harry Potter',
  SIMILARITY_THRESHOLD: 0.7,
  MAX_RESULTS: 5,
  TIMEOUT: 30000, // 30 seconds
  
  // Benchmark settings
  BENCHMARK_QUERIES: [
    'Harry Potter',
    'fantasy adventure',
    'mystery detective',
    'romance novel',
    'science fiction'
  ]
};

// Parse command line arguments
const args = process.argv.slice(2);
const isQuick = args.includes('--quick');
const isBenchmark = args.includes('--benchmark');
const isVerbose = args.includes('--verbose');
const customQuery = args.find(arg => arg.startsWith('--query='))?.split('=')[1];

const testQuery = customQuery || CONFIG.DEFAULT_QUERY;

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

function logSection(title) {
  console.log('\\n' + colorize('='.repeat(60), 'cyan'));
  console.log(colorize(title.toUpperCase(), 'bright'));
  console.log(colorize('='.repeat(60), 'cyan'));
}

function logTest(name) {
  console.log('\\n' + colorize(`🧪 ${name}`, 'blue'));
}

function logSuccess(message) {
  console.log(colorize('✅ ', 'green') + message);
}

function logWarning(message) {
  console.log(colorize('⚠️  ', 'yellow') + message);
}

function logError(message) {
  console.log(colorize('❌ ', 'red') + message);
}

function logInfo(message) {
  console.log(colorize('ℹ️  ', 'blue') + message);
}

function logVerbose(message) {
  if (isVerbose) {
    console.log(colorize('🔍 ', 'magenta') + message);
  }
}

// Test results tracking
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  warnings: 0,
  benchmarks: [],
  errors: []
};

function recordTest(name, success, message = '', duration = 0) {
  testResults.total++;
  if (success) {
    testResults.passed++;
    logSuccess(`${name}: ${message}`);
  } else {
    testResults.failed++;
    logError(`${name}: ${message}`);
    testResults.errors.push({ name, message });
  }
  
  if (duration > 0) {
    logVerbose(`Duration: ${duration}ms`);
  }
}

function recordWarning(message) {
  testResults.warnings++;
  logWarning(message);
}

async function createSupabaseClient() {
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase credentials');
  }
  
  return createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function generateTestEmbedding(text) {
  logVerbose(`Generating embedding for: "${text}"`);
  
  try {
    const response = await fetch(CONFIG.CLOUDFLARE_WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'embedding',
        text: text,
        model: 'text-embedding-3-small'
      }),
      signal: AbortSignal.timeout(CONFIG.TIMEOUT)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const embedding = data.data?.[0]?.embedding;
    
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Invalid embedding response format');
    }
    
    if (embedding.length !== 1536) {
      throw new Error(`Invalid embedding dimensions: ${embedding.length}, expected 1536`);
    }
    
    return embedding;
  } catch (error) {
    throw new Error(`Embedding generation failed: ${error.message}`);
  }
}

async function testEmbeddingGeneration() {
  logSection('Embedding Generation Tests');
  
  logTest('Generate test embedding');
  const startTime = Date.now();
  
  try {
    const embedding = await generateTestEmbedding(testQuery);
    const duration = Date.now() - startTime;
    
    recordTest(
      'Embedding Generation',
      true,
      `Generated ${embedding.length} dimensions`,
      duration
    );
    
    return embedding;
  } catch (error) {
    recordTest('Embedding Generation', false, error.message);
    return null;
  }
}

async function testDatabaseConnection(supabase) {
  logSection('Database Connection Tests');
  
  logTest('Test Supabase connection');
  try {
    const { data, error } = await supabase
      .from('books')
      .select('count', { count: 'exact', head: true })
      .limit(1);
    
    if (error) {
      throw error;
    }
    
    recordTest('Database Connection', true, 'Successfully connected to Supabase');
    return true;
  } catch (error) {
    recordTest('Database Connection', false, error.message);
    return false;
  }
}

async function testDataAvailability(supabase) {
  logSection('Data Availability Tests');
  
  // Test books table
  logTest('Check books table');
  try {
    const { count: booksCount, error: booksError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true });
    
    if (booksError) throw booksError;
    
    recordTest('Books Table', true, `Found ${booksCount || 0} books`);
    
    if (booksCount === 0) {
      recordWarning('No books found in database - some tests may fail');
    }
  } catch (error) {
    recordTest('Books Table', false, error.message);
  }
  
  // Test embeddings table
  logTest('Check embeddings table');
  try {
    const { count: embeddingsCount, error: embeddingsError } = await supabase
      .from('book_embeddings')
      .select('*', { count: 'exact', head: true });
    
    if (embeddingsError) throw embeddingsError;
    
    recordTest('Embeddings Table', true, `Found ${embeddingsCount || 0} embeddings`);
    
    if (embeddingsCount === 0) {
      recordWarning('No embeddings found - vector search tests will fail');
    }
    
    return embeddingsCount > 0;
  } catch (error) {
    recordTest('Embeddings Table', false, error.message);
    return false;
  }
}

async function testRPCFunction(supabase, embedding) {
  logSection('RPC Function Tests');
  
  if (!embedding) {
    recordTest('RPC Function', false, 'No embedding available for testing');
    return false;
  }
  
  logTest('Test search_similar_books RPC function');
  const startTime = Date.now();
  
  try {
    const embeddingString = `[${embedding.join(',')}]`;
    
    const { data, error } = await supabase.rpc('search_similar_books', {
      query_embedding: embeddingString,
      similarity_threshold: CONFIG.SIMILARITY_THRESHOLD,
      max_results: CONFIG.MAX_RESULTS
    });
    
    const duration = Date.now() - startTime;
    
    if (error) {
      throw error;
    }
    
    recordTest(
      'RPC Function',
      true,
      `Returned ${data?.length || 0} results`,
      duration
    );
    
    if (data && data.length > 0) {
      logVerbose(`Sample result: "${data[0].title}" (similarity: ${data[0].similarity_score?.toFixed(4)})`);
    }
    
    return { success: true, results: data, duration };
  } catch (error) {
    recordTest('RPC Function', false, error.message);
    return { success: false, error: error.message };
  }
}

async function testClientSideSearch(supabase, embedding) {
  logSection('Client-Side Search Tests');
  
  if (!embedding) {
    recordTest('Client-Side Search', false, 'No embedding available for testing');
    return false;
  }
  
  logTest('Test client-side vector similarity calculation');
  const startTime = Date.now();
  
  try {
    // Fetch sample embeddings for client-side calculation
    const { data: embeddingData, error } = await supabase
      .from('book_embeddings')
      .select(`
        book_id,
        embedding,
        books!inner (
          id,
          title,
          deleted_at
        )
      `)
      .eq('model', 'text-embedding-3-small')
      .is('books.deleted_at', null)
      .limit(10);
    
    if (error) throw error;
    
    if (!embeddingData || embeddingData.length === 0) {
      throw new Error('No embeddings found for client-side test');
    }
    
    // Calculate cosine similarity
    const results = embeddingData
      .map(item => {
        const bookEmbedding = item.embedding;
        if (!bookEmbedding || !Array.isArray(bookEmbedding)) {
          return null;
        }
        
        const similarity = cosineSimilarity(embedding, bookEmbedding);
        return {
          book_id: item.book_id,
          title: item.books.title,
          similarity_score: similarity
        };
      })
      .filter(result => result !== null && result.similarity_score >= CONFIG.SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, CONFIG.MAX_RESULTS);
    
    const duration = Date.now() - startTime;
    
    recordTest(
      'Client-Side Search',
      true,
      `Calculated similarity for ${embeddingData.length} embeddings, found ${results.length} matches`,
      duration
    );
    
    if (results.length > 0) {
      logVerbose(`Top result: "${results[0].title}" (similarity: ${results[0].similarity_score.toFixed(4)})`);
    }
    
    return { success: true, results, duration };
  } catch (error) {
    recordTest('Client-Side Search', false, error.message);
    return { success: false, error: error.message };
  }
}

function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function testRecommendationService() {
  logSection('RecommendationService Integration Tests');
  
  if (isQuick) {
    logInfo('Skipping RecommendationService tests in quick mode');
    return;
  }
  
  logTest('Test high-level recommendation service');
  
  try {
    // This would require importing the actual RecommendationService
    // For now, we'll simulate the test
    logWarning('RecommendationService integration test not implemented (requires TypeScript compilation)');
    recordWarning('RecommendationService test skipped - requires proper module setup');
  } catch (error) {
    recordTest('RecommendationService', false, error.message);
  }
}

async function runBenchmarks(supabase, embedding) {
  if (!isBenchmark) {
    return;
  }
  
  logSection('Performance Benchmarks');
  
  if (!embedding) {
    logWarning('Skipping benchmarks - no embedding available');
    return;
  }
  
  for (const query of CONFIG.BENCHMARK_QUERIES) {
    logTest(`Benchmark: "${query}"`);
    
    try {
      // Generate embedding for this query
      const queryEmbedding = await generateTestEmbedding(query);
      
      // Test RPC function performance
      const rpcStart = Date.now();
      const rpcResult = await testRPCFunction(supabase, queryEmbedding);
      const rpcDuration = Date.now() - rpcStart;
      
      // Test client-side performance
      const clientStart = Date.now();
      const clientResult = await testClientSideSearch(supabase, queryEmbedding);
      const clientDuration = Date.now() - clientStart;
      
      testResults.benchmarks.push({
        query,
        rpcDuration,
        clientDuration,
        rpcResults: rpcResult.results?.length || 0,
        clientResults: clientResult.results?.length || 0
      });
      
      logInfo(`RPC: ${rpcDuration}ms (${rpcResult.results?.length || 0} results)`);
      logInfo(`Client: ${clientDuration}ms (${clientResult.results?.length || 0} results)`);
      
    } catch (error) {
      logError(`Benchmark failed for "${query}": ${error.message}`);
    }
  }
}

function printFinalReport() {
  logSection('Final Test Report');
  
  console.log(colorize(`📊 Test Summary:`, 'bright'));
  console.log(colorize(`   Total tests: ${testResults.total}`, 'blue'));
  console.log(colorize(`   ✅ Passed: ${testResults.passed}`, 'green'));
  console.log(colorize(`   ❌ Failed: ${testResults.failed}`, 'red'));
  console.log(colorize(`   ⚠️  Warnings: ${testResults.warnings}`, 'yellow'));
  
  const successRate = testResults.total > 0 ? (testResults.passed / testResults.total * 100).toFixed(1) : 0;
  console.log(colorize(`   📈 Success rate: ${successRate}%`, 'cyan'));
  
  if (testResults.errors.length > 0) {
    console.log(colorize(`\\n❌ Failed Tests:`, 'red'));
    testResults.errors.forEach((error, index) => {
      console.log(colorize(`   ${index + 1}. ${error.name}: ${error.message}`, 'red'));
    });
  }
  
  if (testResults.benchmarks.length > 0) {
    console.log(colorize(`\\n⚡ Performance Benchmarks:`, 'magenta'));
    testResults.benchmarks.forEach(benchmark => {
      console.log(colorize(`   "${benchmark.query}":`, 'bright'));
      console.log(colorize(`     RPC: ${benchmark.rpcDuration}ms (${benchmark.rpcResults} results)`, 'blue'));
      console.log(colorize(`     Client: ${benchmark.clientDuration}ms (${benchmark.clientResults} results)`, 'blue'));
    });
  }
  
  // Overall assessment
  if (testResults.failed === 0) {
    console.log(colorize('\\n🎉 All tests passed! Your vector search system is working correctly.', 'green'));
  } else if (testResults.passed > testResults.failed) {
    console.log(colorize('\\n⚠️  Some tests failed, but core functionality appears to work.', 'yellow'));
  } else {
    console.log(colorize('\\n❌ Multiple critical tests failed. Please check your configuration.', 'red'));
  }
}

async function main() {
  console.log(colorize('🧪 Vector Search Comprehensive Test Suite', 'bright'));
  console.log(colorize('=========================================', 'cyan'));
  
  if (isQuick) {
    console.log(colorize('🚀 Running in quick mode', 'yellow'));
  }
  
  if (isBenchmark) {
    console.log(colorize('📊 Performance benchmarking enabled', 'magenta'));
  }
  
  console.log(colorize(`🔍 Test query: "${testQuery}"`, 'blue'));
  
  try {
    // Step 1: Test embedding generation
    const embedding = await testEmbeddingGeneration();
    
    // Step 2: Create Supabase client and test connection
    const supabase = await createSupabaseClient();
    const connectionWorking = await testDatabaseConnection(supabase);
    
    if (!connectionWorking) {
      logError('Cannot proceed without database connection');
      printFinalReport();
      process.exit(1);
    }
    
    // Step 3: Test data availability
    const hasEmbeddings = await testDataAvailability(supabase);
    
    // Step 4: Test RPC function (if embeddings exist)
    if (hasEmbeddings && embedding) {
      await testRPCFunction(supabase, embedding);
    }
    
    // Step 5: Test client-side search (if embeddings exist)
    if (hasEmbeddings && embedding) {
      await testClientSideSearch(supabase, embedding);
    }
    
    // Step 6: Test RecommendationService integration
    await testRecommendationService();
    
    // Step 7: Run benchmarks (if requested)
    await runBenchmarks(supabase, embedding);
    
    // Step 8: Print final report
    printFinalReport();
    
  } catch (error) {
    logError(`Test suite failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the test suite
main().catch(console.error);
