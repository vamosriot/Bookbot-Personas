#!/usr/bin/env node

/**
 * Database State Diagnostic Script
 * 
 * This script checks the current state of the Supabase database and identifies
 * potential issues with the vector search system.
 * 
 * Usage: node scripts/check-database-state.js
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
const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY'
];

const EXPECTED_TABLES = [
  'books',
  'book_embeddings',
  'conversations',
  'messages',
  'file_attachments',
  'persona_memories',
  'user_profiles',
  'message_feedback'
];

const EXPECTED_FUNCTIONS = [
  'search_similar_books'
];

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

async function checkEnvironmentVariables() {
  logSection('Environment Variables Check');
  
  let allPresent = true;
  
  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar];
    if (value && value !== 'your_' + envVar.toLowerCase() + '_here') {
      logSuccess(`${envVar}: Present and configured`);
    } else if (value) {
      logWarning(`${envVar}: Present but appears to be placeholder value`);
      allPresent = false;
    } else {
      logError(`${envVar}: Missing`);
      allPresent = false;
    }
  }
  
  // Check optional variables
  const optionalVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_CLOUDFLARE_WORKER_URL'];
  for (const envVar of optionalVars) {
    const value = process.env[envVar];
    if (value && value !== 'your_' + envVar.toLowerCase().replace('vite_', '') + '_here') {
      logSuccess(`${envVar}: Present (frontend)`);
    } else {
      logWarning(`${envVar}: Missing or placeholder (frontend variable)`);
    }
  }
  
  return allPresent;
}

async function createSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }
  
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function testSupabaseConnection(supabase) {
  logSection('Supabase Connection Test');
  
  try {
    // Test basic connection with a simple query
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(1);
    
    if (error) {
      logError(`Connection failed: ${error.message}`);
      return false;
    }
    
    logSuccess('Successfully connected to Supabase');
    return true;
  } catch (error) {
    logError(`Connection failed: ${error.message}`);
    return false;
  }
}

async function checkTableExistence(supabase) {
  logSection('Table Existence Check');
  
  try {
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    if (error) {
      logError(`Failed to query tables: ${error.message}`);
      return false;
    }
    
    const existingTables = tables.map(t => t.table_name);
    let allTablesExist = true;
    
    for (const expectedTable of EXPECTED_TABLES) {
      if (existingTables.includes(expectedTable)) {
        logSuccess(`Table '${expectedTable}' exists`);
      } else {
        logError(`Table '${expectedTable}' missing`);
        allTablesExist = false;
      }
    }
    
    // Show additional tables that exist
    const extraTables = existingTables.filter(t => !EXPECTED_TABLES.includes(t));
    if (extraTables.length > 0) {
      logInfo(`Additional tables found: ${extraTables.join(', ')}`);
    }
    
    return allTablesExist;
  } catch (error) {
    logError(`Table check failed: ${error.message}`);
    return false;
  }
}

async function checkFunctionExistence(supabase) {
  logSection('Function Existence Check');
  
  try {
    const { data: functions, error } = await supabase
      .from('information_schema.routines')
      .select('routine_name, routine_type')
      .eq('routine_schema', 'public');
    
    if (error) {
      logError(`Failed to query functions: ${error.message}`);
      return false;
    }
    
    const existingFunctions = functions.map(f => f.routine_name);
    let allFunctionsExist = true;
    
    for (const expectedFunction of EXPECTED_FUNCTIONS) {
      if (existingFunctions.includes(expectedFunction)) {
        logSuccess(`Function '${expectedFunction}' exists`);
      } else {
        logError(`Function '${expectedFunction}' missing`);
        allFunctionsExist = false;
      }
    }
    
    return allFunctionsExist;
  } catch (error) {
    logError(`Function check failed: ${error.message}`);
    return false;
  }
}

async function checkDataCounts(supabase) {
  logSection('Data Count Analysis');
  
  try {
    // Check books count
    const { count: booksCount, error: booksError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true });
    
    if (booksError) {
      logError(`Failed to count books: ${booksError.message}`);
    } else {
      logInfo(`Total books: ${booksCount || 0}`);
    }
    
    // Check embeddings count
    const { count: embeddingsCount, error: embeddingsError } = await supabase
      .from('book_embeddings')
      .select('*', { count: 'exact', head: true });
    
    if (embeddingsError) {
      logError(`Failed to count embeddings: ${embeddingsError.message}`);
    } else {
      logInfo(`Total embeddings: ${embeddingsCount || 0}`);
      
      if (booksCount && embeddingsCount) {
        const coverage = ((embeddingsCount / booksCount) * 100).toFixed(1);
        if (coverage >= 90) {
          logSuccess(`Embedding coverage: ${coverage}%`);
        } else if (coverage >= 50) {
          logWarning(`Embedding coverage: ${coverage}% (consider generating more embeddings)`);
        } else {
          logError(`Embedding coverage: ${coverage}% (very low - run embedding generation)`);
        }
      }
    }
    
    // Check deleted books
    const { count: deletedCount, error: deletedError } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true })
      .not('deleted_at', 'is', null);
    
    if (!deletedError && deletedCount) {
      logInfo(`Deleted books: ${deletedCount}`);
    }
    
    return { booksCount, embeddingsCount };
  } catch (error) {
    logError(`Data count check failed: ${error.message}`);
    return { booksCount: 0, embeddingsCount: 0 };
  }
}

async function validateEmbeddingData(supabase) {
  logSection('Embedding Data Validation');
  
  try {
    // Get sample embeddings to validate structure
    const { data: sampleEmbeddings, error } = await supabase
      .from('book_embeddings')
      .select('book_id, embedding, model')
      .limit(5);
    
    if (error) {
      logError(`Failed to fetch sample embeddings: ${error.message}`);
      return false;
    }
    
    if (!sampleEmbeddings || sampleEmbeddings.length === 0) {
      logWarning('No embeddings found in database');
      return false;
    }
    
    let validEmbeddings = 0;
    let invalidEmbeddings = 0;
    
    for (const embedding of sampleEmbeddings) {
      if (!embedding.embedding || !Array.isArray(embedding.embedding)) {
        logError(`Book ${embedding.book_id}: Invalid embedding format`);
        invalidEmbeddings++;
        continue;
      }
      
      if (embedding.embedding.length !== 1536) {
        logError(`Book ${embedding.book_id}: Invalid embedding dimensions (${embedding.embedding.length}, expected 1536)`);
        invalidEmbeddings++;
        continue;
      }
      
      if (embedding.model !== 'text-embedding-3-small') {
        logWarning(`Book ${embedding.book_id}: Unexpected model '${embedding.model}'`);
      }
      
      validEmbeddings++;
    }
    
    if (validEmbeddings > 0) {
      logSuccess(`Sample validation: ${validEmbeddings}/${sampleEmbeddings.length} embeddings are valid`);
    }
    
    if (invalidEmbeddings > 0) {
      logError(`Found ${invalidEmbeddings} invalid embeddings in sample`);
    }
    
    return validEmbeddings > 0;
  } catch (error) {
    logError(`Embedding validation failed: ${error.message}`);
    return false;
  }
}

async function testVectorSearchFunction(supabase) {
  logSection('Vector Search Function Test');
  
  try {
    // Create a dummy embedding for testing
    const dummyEmbedding = Array(1536).fill(0).map(() => Math.random() * 0.1);
    const embeddingString = `[${dummyEmbedding.join(',')}]`;
    
    logInfo('Testing vector search function with dummy embedding...');
    
    const { data, error } = await supabase.rpc('search_similar_books', {
      query_embedding: embeddingString,
      similarity_threshold: 0.1,
      max_results: 3
    });
    
    if (error) {
      logError(`Vector search function failed: ${error.message}`);
      return false;
    }
    
    if (!data) {
      logWarning('Vector search function returned no data (this might be normal if no embeddings exist)');
      return true;
    }
    
    logSuccess(`Vector search function works! Returned ${data.length} results`);
    
    if (data.length > 0) {
      const sample = data[0];
      logInfo(`Sample result: Book ID ${sample.book_id}, Title: "${sample.title}", Similarity: ${sample.similarity_score?.toFixed(4)}`);
    }
    
    return true;
  } catch (error) {
    logError(`Vector search test failed: ${error.message}`);
    return false;
  }
}

async function checkIndexes(supabase) {
  logSection('Index Analysis');
  
  try {
    const { data: indexes, error } = await supabase
      .from('pg_indexes')
      .select('indexname, tablename')
      .eq('schemaname', 'public');
    
    if (error) {
      logWarning(`Could not check indexes: ${error.message}`);
      return;
    }
    
    const vectorIndexes = indexes.filter(idx => 
      idx.indexname.includes('hnsw') || 
      idx.indexname.includes('embedding') ||
      idx.tablename === 'book_embeddings'
    );
    
    if (vectorIndexes.length > 0) {
      logSuccess(`Found ${vectorIndexes.length} vector-related indexes:`);
      vectorIndexes.forEach(idx => {
        logInfo(`  - ${idx.indexname} on ${idx.tablename}`);
      });
    } else {
      logWarning('No vector-specific indexes found - performance may be slow');
    }
    
  } catch (error) {
    logWarning(`Index check failed: ${error.message}`);
  }
}

async function generateRecommendations(results) {
  logSection('Recommendations');
  
  const issues = [];
  const recommendations = [];
  
  if (!results.envVarsValid) {
    issues.push('Environment variables not properly configured');
    recommendations.push('1. Copy .env.template to .env and fill in your actual API keys');
  }
  
  if (!results.connectionWorking) {
    issues.push('Cannot connect to Supabase');
    recommendations.push('2. Verify your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are correct');
  }
  
  if (!results.tablesExist) {
    issues.push('Required tables are missing');
    recommendations.push('3. Run the database-setup.sql script in your Supabase SQL Editor');
  }
  
  if (!results.functionsExist) {
    issues.push('Vector search function is missing');
    recommendations.push('4. Ensure the search_similar_books function was created (check database-setup.sql)');
  }
  
  if (results.embeddingsCount === 0) {
    issues.push('No embeddings found in database');
    recommendations.push('5. Run the embedding generation script: node populate-embeddings.js');
  }
  
  if (!results.vectorSearchWorks) {
    issues.push('Vector search function not working');
    recommendations.push('6. Check the vector search function implementation and permissions');
  }
  
  if (issues.length === 0) {
    logSuccess('🎉 All checks passed! Your vector search system appears to be working correctly.');
    logInfo('You can now test the recommendation system in your application.');
  } else {
    logError(`Found ${issues.length} issue(s) that need attention:`);
    issues.forEach((issue, index) => {
      logError(`  ${index + 1}. ${issue}`);
    });
    
    console.log('\\n' + colorize('📋 Recommended Actions:', 'bright'));
    recommendations.forEach(rec => {
      console.log(colorize(rec, 'yellow'));
    });
  }
}

async function main() {
  console.log(colorize('🔍 Bookbot Personas - Database State Diagnostic', 'bright'));
  console.log(colorize('This script will check your database configuration and identify issues.', 'cyan'));
  
  const results = {
    envVarsValid: false,
    connectionWorking: false,
    tablesExist: false,
    functionsExist: false,
    booksCount: 0,
    embeddingsCount: 0,
    embeddingsValid: false,
    vectorSearchWorks: false
  };
  
  try {
    // Step 1: Check environment variables
    results.envVarsValid = await checkEnvironmentVariables();
    
    if (!results.envVarsValid) {
      logError('Cannot proceed without proper environment configuration');
      await generateRecommendations(results);
      process.exit(1);
    }
    
    // Step 2: Create Supabase client and test connection
    const supabase = await createSupabaseClient();
    results.connectionWorking = await testSupabaseConnection(supabase);
    
    if (!results.connectionWorking) {
      await generateRecommendations(results);
      process.exit(1);
    }
    
    // Step 3: Check table existence
    results.tablesExist = await checkTableExistence(supabase);
    
    // Step 4: Check function existence
    results.functionsExist = await checkFunctionExistence(supabase);
    
    // Step 5: Check data counts
    const counts = await checkDataCounts(supabase);
    results.booksCount = counts.booksCount || 0;
    results.embeddingsCount = counts.embeddingsCount || 0;
    
    // Step 6: Validate embedding data (if embeddings exist)
    if (results.embeddingsCount > 0) {
      results.embeddingsValid = await validateEmbeddingData(supabase);
    }
    
    // Step 7: Test vector search function (if function exists)
    if (results.functionsExist) {
      results.vectorSearchWorks = await testVectorSearchFunction(supabase);
    }
    
    // Step 8: Check indexes
    await checkIndexes(supabase);
    
    // Step 9: Generate recommendations
    await generateRecommendations(results);
    
  } catch (error) {
    logError(`Diagnostic failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the diagnostic
main().catch(console.error);
