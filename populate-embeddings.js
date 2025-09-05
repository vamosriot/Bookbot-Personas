/**
 * Script to populate the book_embeddings table with test data
 * This bypasses the SQL length limitations by using the Supabase client directly
 */

const { createClient } = require('@supabase/supabase-js');

// You'll need to set these environment variables or replace with your actual values
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rawbfwomfixfqfzggcrn.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';
const CLOUDFLARE_WORKER_URL = 'https://bookbot-openai-worker.vojtech-gryc.workers.dev/';

// Test books to generate embeddings for
const testBooks = [
  { id: 1, title: 'Harry Potter a Kámen mudrců' },
  { id: 2, title: 'Harry Potter a Tajemná komnata' },
  { id: 3, title: 'Harry Potter a vězeň z Azkabanu' },
  { id: 4, title: 'Harry Potter a Ohnivý pohár' },
  { id: 5, title: 'Harry Potter a Fénixův řád' }
];

async function generateEmbedding(text) {
  try {
    console.log(`🔮 Generating embedding for: "${text}"`);
    
    const response = await fetch(CLOUDFLARE_WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'embedding',
        text: text,
        model: 'text-embedding-3-small'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Embedding generation failed: ${response.status}`, errorText);
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

async function insertEmbedding(supabase, bookId, embedding) {
  try {
    console.log(`💾 Inserting embedding for book ID ${bookId}...`);
    
    const { data, error } = await supabase
      .from('book_embeddings')
      .upsert({
        book_id: bookId,
        embedding: embedding,
        model: 'text-embedding-3-small'
      }, {
        onConflict: 'book_id,model'
      });

    if (error) {
      console.error(`❌ Failed to insert embedding for book ${bookId}:`, error);
      return false;
    }

    console.log(`✅ Successfully inserted embedding for book ID ${bookId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error inserting embedding for book ${bookId}:`, error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting embedding population...');
  
  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  let successCount = 0;
  let totalCount = testBooks.length;
  
  for (const book of testBooks) {
    console.log(`\n📚 Processing: ${book.title} (ID: ${book.id})`);
    
    // Generate embedding
    const embedding = await generateEmbedding(book.title);
    
    if (embedding) {
      // Insert into database
      const success = await insertEmbedding(supabase, book.id, embedding);
      if (success) {
        successCount++;
      }
    } else {
      console.log(`❌ Skipping book ID ${book.id} due to embedding generation failure`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n🎯 Results: ${successCount}/${totalCount} embeddings successfully inserted`);
  
  if (successCount > 0) {
    console.log('\n✅ Embeddings populated! You can now test the Harry Potter search.');
    console.log('The vector search should now find actual results instead of "No embeddings found in database".');
  } else {
    console.log('\n❌ No embeddings were inserted. Please check the errors above.');
  }
}

main().catch(console.error);
